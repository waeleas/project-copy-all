DROP POLICY IF EXISTS "auth read service_types" ON public.service_types;
CREATE POLICY "role holders read service_types" ON public.service_types FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()));
DROP POLICY IF EXISTS "auth read governorates" ON public.governorates;
CREATE POLICY "role holders read governorates" ON public.governorates FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()));