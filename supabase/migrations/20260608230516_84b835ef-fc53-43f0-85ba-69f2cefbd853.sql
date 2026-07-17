ALTER TABLE public.cars
  ADD COLUMN IF NOT EXISTS route_code text,
  ADD COLUMN IF NOT EXISTS route_description text,
  ADD COLUMN IF NOT EXISTS follow_office_id uuid REFERENCES public.offices(id) ON DELETE SET NULL;