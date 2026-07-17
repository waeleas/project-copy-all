ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS handheld_code text,
  ADD COLUMN IF NOT EXISTS route_code text,
  ADD COLUMN IF NOT EXISTS follow_office_id uuid REFERENCES public.offices(id) ON DELETE SET NULL;