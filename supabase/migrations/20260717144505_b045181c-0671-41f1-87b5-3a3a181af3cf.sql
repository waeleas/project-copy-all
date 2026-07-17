ALTER TABLE public.cars ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS car_description text;