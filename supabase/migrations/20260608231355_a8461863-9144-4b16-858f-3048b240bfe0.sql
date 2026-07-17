ALTER TABLE public.cars ADD COLUMN IF NOT EXISTS handheld_code text;
CREATE UNIQUE INDEX IF NOT EXISTS cars_handheld_code_unique ON public.cars(handheld_code) WHERE handheld_code IS NOT NULL;
ALTER TABLE public.offices ADD COLUMN IF NOT EXISTS code text;