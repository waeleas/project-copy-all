ALTER TABLE public.service_types ADD COLUMN IF NOT EXISTS pmact_type text;
ALTER TABLE public.cars ADD COLUMN IF NOT EXISTS acty_type text;