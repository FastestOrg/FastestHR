-- PostgreSQL Migration: Add IP Whitelist to Companies table
-- Supports office location IP checks as a fallback/bypass for geofencing

ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS ip_whitelist text;

COMMENT ON COLUMN public.companies.ip_whitelist IS 'Comma-separated list of allowed office IP addresses or CIDR blocks';
