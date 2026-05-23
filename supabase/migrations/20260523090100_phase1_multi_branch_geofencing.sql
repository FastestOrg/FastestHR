-- PostgreSQL Migration: Phase 1 - Multi-Branch Geofencing in Attendance
-- Introduces company_locations table and updates employee + attendance schemas and geofencing triggers.

-- 1. Create company_locations table
CREATE TABLE IF NOT EXISTS public.company_locations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    radius_meters INTEGER DEFAULT 200 NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 2. Add location_id columns to public.employees and public.attendance
ALTER TABLE public.employees 
ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES public.company_locations(id) ON DELETE SET NULL;

ALTER TABLE public.attendance 
ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES public.company_locations(id) ON DELETE SET NULL;

-- 3. Enable RLS on company_locations
ALTER TABLE public.company_locations ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS Policies for company_locations
DROP POLICY IF EXISTS "Company members can view company locations" ON public.company_locations;
CREATE POLICY "Company members can view company locations"
    ON public.company_locations FOR SELECT TO authenticated
    USING (company_id = public.get_user_company_id() OR public.is_super_admin());

DROP POLICY IF EXISTS "Company admins can manage company locations" ON public.company_locations;
CREATE POLICY "Company admins can manage company locations"
    ON public.company_locations FOR ALL TO authenticated
    USING (company_id = public.get_user_company_id() AND public.is_company_admin());

-- 5. Harden and update the geofencing trigger function
CREATE OR REPLACE FUNCTION public.verify_attendance_geofence()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_comp_lat double precision;
    v_comp_lon double precision;
    v_comp_rad integer;
    v_gps jsonb;
    v_lat double precision;
    v_lon double precision;
    v_distance double precision;
    v_work_type text;
    v_location_id uuid;
    v_location_matched boolean := FALSE;
    r_loc record;
BEGIN
    -- Check clock-in location
    IF NEW.clock_in_location IS NOT NULL THEN
        v_work_type := NEW.clock_in_location->>'work_type';
        
        IF v_work_type = 'office' THEN
            v_gps := NEW.clock_in_location->'gps';
            IF v_gps IS NULL OR v_gps->>'latitude' IS NULL OR v_gps->>'longitude' IS NULL THEN
                RAISE EXCEPTION 'Office clock-in requires valid GPS location verification.';
            END IF;
            
            v_lat := (v_gps->>'latitude')::double precision;
            v_lon := (v_gps->>'longitude')::double precision;

            -- 1. Check if the employee has a designated assigned location
            SELECT location_id INTO v_location_id
            FROM public.employees
            WHERE id = NEW.employee_id;

            IF v_location_id IS NOT NULL THEN
                -- Fetch coordinates for the assigned branch
                SELECT latitude, longitude, radius_meters
                INTO v_comp_lat, v_comp_lon, v_comp_rad
                FROM public.company_locations
                WHERE id = v_location_id AND is_active = TRUE;

                IF v_comp_lat IS NOT NULL AND v_comp_lon IS NOT NULL THEN
                    v_distance := public.calculate_geofence_distance(v_lat, v_lon, v_comp_lat, v_comp_lon);
                    IF v_distance <= COALESCE(v_comp_rad, 200) THEN
                        v_location_matched := TRUE;
                        NEW.location_id := v_location_id; -- Set matched branch ID
                    ELSE
                        RAISE EXCEPTION 'Location verification failed. You are outside your assigned office boundary (% meters away, allowed radius: % meters).', 
                            ROUND(v_distance::numeric), COALESCE(v_comp_rad, 200);
                    END IF;
                END IF;
            ELSE
                -- 2. No specific location assigned. Loop through ALL active locations for the company
                FOR r_loc IN 
                    SELECT id, latitude, longitude, radius_meters
                    FROM public.company_locations
                    WHERE company_id = NEW.company_id AND is_active = TRUE
                LOOP
                    v_distance := public.calculate_geofence_distance(v_lat, v_lon, r_loc.latitude, r_loc.longitude);
                    IF v_distance <= COALESCE(r_loc.radius_meters, 200) THEN
                        v_location_matched := TRUE;
                        v_location_id := r_loc.id;
                        NEW.location_id := r_loc.id; -- Set matched branch ID
                        EXIT; -- Found a matching geofence!
                    END IF;
                END LOOP;

                -- 3. If no branch matches, but there is a company-level default geofence
                IF NOT v_location_matched THEN
                    SELECT geofence_latitude, geofence_longitude, geofence_radius
                    INTO v_comp_lat, v_comp_lon, v_comp_rad
                    FROM public.companies
                    WHERE id = NEW.company_id;

                    IF v_comp_lat IS NOT NULL AND v_comp_lon IS NOT NULL THEN
                        v_distance := public.calculate_geofence_distance(v_lat, v_lon, v_comp_lat, v_comp_lon);
                        IF v_distance <= COALESCE(v_comp_rad, 200) THEN
                            v_location_matched := TRUE;
                        END IF;
                    END IF;
                END IF;

                -- If still not matched and there are locations or default coordinates defined
                IF NOT v_location_matched THEN
                    -- Check if company has ANY locations or default coordinates configured
                    IF EXISTS (SELECT 1 FROM public.company_locations WHERE company_id = NEW.company_id AND is_active = TRUE) 
                       OR (v_comp_lat IS NOT NULL AND v_comp_lon IS NOT NULL) THEN
                        RAISE EXCEPTION 'Location verification failed. You are outside the allowed office boundaries.';
                    END IF;
                END IF;
            END IF;
        END IF;
    END IF;

    -- Check clock-out location
    IF NEW.clock_out_location IS NOT NULL THEN
        v_work_type := NEW.clock_out_location->>'work_type';
        
        IF v_work_type = 'office' THEN
            v_gps := NEW.clock_out_location->'gps';
            IF v_gps IS NULL OR v_gps->>'latitude' IS NULL OR v_gps->>'longitude' IS NULL THEN
                RAISE EXCEPTION 'Office clock-out requires valid GPS location verification.';
            END IF;
            
            v_lat := (v_gps->>'latitude')::double precision;
            v_lon := (v_gps->>'longitude')::double precision;
            v_location_matched := FALSE;

            -- 1. If we matched a location ID during clock-in, prioritize validating against it on clock-out
            IF NEW.location_id IS NOT NULL THEN
                SELECT latitude, longitude, radius_meters
                INTO v_comp_lat, v_comp_lon, v_comp_rad
                FROM public.company_locations
                WHERE id = NEW.location_id AND is_active = TRUE;

                IF v_comp_lat IS NOT NULL AND v_comp_lon IS NOT NULL THEN
                    v_distance := public.calculate_geofence_distance(v_lat, v_lon, v_comp_lat, v_comp_lon);
                    IF v_distance <= COALESCE(v_comp_rad, 200) THEN
                        v_location_matched := TRUE;
                    ELSE
                        RAISE EXCEPTION 'Location verification failed. You are outside the allowed office boundary on clock-out (% meters away on clock-out, allowed radius: % meters).', 
                            ROUND(v_distance::numeric), COALESCE(v_comp_rad, 200);
                    END IF;
                END IF;
            ELSE
                -- 2. Loop through active locations
                FOR r_loc IN 
                    SELECT id, latitude, longitude, radius_meters
                    FROM public.company_locations
                    WHERE company_id = NEW.company_id AND is_active = TRUE
                LOOP
                    v_distance := public.calculate_geofence_distance(v_lat, v_lon, r_loc.latitude, r_loc.longitude);
                    IF v_distance <= COALESCE(r_loc.radius_meters, 200) THEN
                        v_location_matched := TRUE;
                        NEW.location_id := r_loc.id;
                        EXIT;
                    END IF;
                END LOOP;

                -- 3. Check default company geofence
                IF NOT v_location_matched THEN
                    SELECT geofence_latitude, geofence_longitude, geofence_radius
                    INTO v_comp_lat, v_comp_lon, v_comp_rad
                    FROM public.companies
                    WHERE id = NEW.company_id;

                    IF v_comp_lat IS NOT NULL AND v_comp_lon IS NOT NULL THEN
                        v_distance := public.calculate_geofence_distance(v_lat, v_lon, v_comp_lat, v_comp_lon);
                        IF v_distance <= COALESCE(v_comp_rad, 200) THEN
                            v_location_matched := TRUE;
                        END IF;
                    END IF;
                END IF;

                IF NOT v_location_matched THEN
                    IF EXISTS (SELECT 1 FROM public.company_locations WHERE company_id = NEW.company_id AND is_active = TRUE) 
                       OR (v_comp_lat IS NOT NULL AND v_comp_lon IS NOT NULL) THEN
                        RAISE EXCEPTION 'Location verification failed on clock-out. You are outside the allowed office boundaries.';
                    END IF;
                END IF;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;
