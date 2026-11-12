DROP POLICY IF EXISTS "auth read offices" ON public.offices;
CREATE POLICY "role holders read offices" ON public.offices FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()));