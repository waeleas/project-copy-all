ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'company';
ALTER TABLE public.drivers ALTER COLUMN sap_number DROP NOT NULL;