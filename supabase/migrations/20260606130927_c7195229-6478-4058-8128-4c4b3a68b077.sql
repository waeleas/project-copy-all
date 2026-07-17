ALTER TABLE public.cars ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'company';

COMMENT ON COLUMN public.cars.type IS 'company or rental';

ALTER TABLE public.cars ALTER COLUMN code DROP NOT NULL;