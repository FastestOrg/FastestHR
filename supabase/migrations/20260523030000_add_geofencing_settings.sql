-- PostgreSQL Migration: Phase 3 - Add Geofencing Settings to Companies
-- Adds geofence_latitude, geofence_longitude, and geofence_radius columns to support physical location checks.

ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS geofence_latitude double precision,
ADD COLUMN IF NOT EXISTS geofence_longitude double precision,
ADD COLUMN IF NOT EXISTS geofence_radius integer DEFAULT 200;

-- Optional comment explaining columns
COMMENT ON COLUMN public.companies.geofence_latitude IS 'Latitude coordinates of the primary office location';
COMMENT ON COLUMN public.companies.geofence_longitude IS 'Longitude coordinates of the primary office location';
COMMENT ON COLUMN public.companies.geofence_radius IS 'Allowed office clock-in radius in meters';
