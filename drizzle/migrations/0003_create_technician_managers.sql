CREATE TABLE public.technician_managers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  technician_id UUID NOT NULL REFERENCES public.technicians(id) ON DELETE CASCADE,
  manager_id UUID NOT NULL REFERENCES public.managers(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (technician_id, manager_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.technician_managers TO authenticated;
GRANT ALL ON public.technician_managers TO service_role;

ALTER TABLE public.technician_managers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin write technician managers"
ON public.technician_managers
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "role holders read technician managers"
ON public.technician_managers
FOR SELECT
TO authenticated
USING (has_any_role(auth.uid()));