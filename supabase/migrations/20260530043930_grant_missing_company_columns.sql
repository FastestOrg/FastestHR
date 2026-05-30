-- PostgreSQL Migration: Grant SELECT on missing company columns to authenticated users
--
-- Since migration 20260505072923_cdb27cbd-d401-4137-bc4e-e1ea9edd7df2.sql revoked broad SELECT
-- and granted column-level SELECT on companies to authenticated, any newly added columns
-- must be explicitly granted as well so that the settings pages can fetch them.
--
-- This migration grants SELECT on the geofencing, IP whitelist, and payroll settings columns
-- added in subsequent migrations.

GRANT SELECT (
  geofence_latitude,
  geofence_longitude,
  geofence_radius,
  ip_whitelist,
  payroll_settings
) ON public.companies TO authenticated;
