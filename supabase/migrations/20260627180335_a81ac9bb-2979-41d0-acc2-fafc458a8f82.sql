
-- Add viewer role (read-only access to all trips)
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'viewer';
