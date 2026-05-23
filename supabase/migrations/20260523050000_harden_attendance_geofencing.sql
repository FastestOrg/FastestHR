-- PostgreSQL Migration: Harden Attendance Geofencing Server-Side
-- Verifies physical coordinates on INSERT/UPDATE of attendance records when work_type is 'office'

-- 1. Create a helper function to compute Haversine distance in meters
CREATE OR REPLACE FUNCTION public.calculate_geofence_distance(
    lat1 double precision, lon1 double precision,
    lat2 double precision, lon2 double precision
)
RETURNS double precision
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    r double precision := 6371000.0; -- Earth radius in meters
    d_lat double precision;
    d_lon double precision;
    a double precision;
    c double precision;
BEGIN
    IF lat1 IS NULL OR lon1 IS NULL OR lat2 IS NULL OR lon2 IS NULL THEN
        RETURN NULL;
    END IF;
    
    d_lat := radians(lat2 - lat1);
    d_lon := radians(lon2 - lon1);
    
    a := sin(d_lat / 2.0) * sin(d_lat / 2.0) +
         cos(radians(lat1)) * cos(radians(lat2)) *
         sin(d_lon / 2.0) * sin(d_lon / 2.0);
         
    c := 2.0 * atan2(sqrt(a), sqrt(1.0 - a));
    RETURN r * c;
END;
$$;

-- 2. Create the geofencing validation trigger function
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
BEGIN
    -- Check clock-in location
    IF NEW.clock_in_location IS NOT NULL THEN
        v_work_type := NEW.clock_in_location->>'work_type';
        
        IF v_work_type = 'office' THEN
            -- Fetch company geofencing parameters
            SELECT geofence_latitude, geofence_longitude, geofence_radius
            INTO v_comp_lat, v_comp_lon, v_comp_rad
            FROM public.companies
            WHERE id = NEW.company_id;
            
            -- Only validate if company actually has geofencing coordinates set
            IF v_comp_lat IS NOT NULL AND v_comp_lon IS NOT NULL THEN
                v_gps := NEW.clock_in_location->'gps';
                IF v_gps IS NULL OR v_gps->>'latitude' IS NULL OR v_gps->>'longitude' IS NULL THEN
                    RAISE EXCEPTION 'Office clock-in requires valid GPS location verification.';
                END IF;
                
                v_lat := (v_gps->>'latitude')::double precision;
                v_lon := (v_gps->>'longitude')::double precision;
                v_distance := public.calculate_geofence_distance(v_lat, v_lon, v_comp_lat, v_comp_lon);
                
                IF v_distance > COALESCE(v_comp_rad, 200) THEN
                    RAISE EXCEPTION 'Location verification failed. You are outside the allowed office boundary (% meters away, allowed radius: % meters).', 
                        ROUND(v_distance::numeric), COALESCE(v_comp_rad, 200);
                END IF;
            END IF;
        END IF;
    END IF;

    -- Check clock-out location
    IF NEW.clock_out_location IS NOT NULL THEN
        v_work_type := NEW.clock_out_location->>'work_type';
        
        IF v_work_type = 'office' THEN
            -- Fetch company geofencing parameters if not fetched already
            IF v_comp_lat IS NULL THEN
                SELECT geofence_latitude, geofence_longitude, geofence_radius
                INTO v_comp_lat, v_comp_lon, v_comp_rad
                FROM public.companies
                WHERE id = NEW.company_id;
            END IF;
            
            IF v_comp_lat IS NOT NULL AND v_comp_lon IS NOT NULL THEN
                v_gps := NEW.clock_out_location->'gps';
                IF v_gps IS NULL OR v_gps->>'latitude' IS NULL OR v_gps->>'longitude' IS NULL THEN
                    RAISE EXCEPTION 'Office clock-out requires valid GPS location verification.';
                END IF;
                
                v_lat := (v_gps->>'latitude')::double precision;
                v_lon := (v_gps->>'longitude')::double precision;
                v_distance := public.calculate_geofence_distance(v_lat, v_lon, v_comp_lat, v_comp_lon);
                
                IF v_distance > COALESCE(v_comp_rad, 200) THEN
                    RAISE EXCEPTION 'Location verification failed. You are outside the allowed office boundary (% meters away on clock-out, allowed radius: % meters).', 
                        ROUND(v_distance::numeric), COALESCE(v_comp_rad, 200);
                END IF;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

-- 3. Attach trigger to public.attendance
DROP TRIGGER IF EXISTS trigger_verify_attendance_geofence ON public.attendance;
CREATE TRIGGER trigger_verify_attendance_geofence
BEFORE INSERT OR UPDATE ON public.attendance
FOR EACH ROW
EXECUTE FUNCTION public.verify_attendance_geofence();
