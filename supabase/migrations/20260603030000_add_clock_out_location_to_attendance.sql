-- PostgreSQL Migration: Add clock_out_location to attendance
-- Adds the clock_out_location JSONB column to the attendance table to support geofencing checks on clock-out.

ALTER TABLE public.attendance 
ADD COLUMN IF NOT EXISTS clock_out_location jsonb,
ALTER COLUMN total_hours TYPE numeric(6,2),
ALTER COLUMN overtime_hours TYPE numeric(6,2);

COMMENT ON COLUMN public.attendance.clock_out_location IS 'JSON metadata storing clock-out geofencing, IP address, and location details';

