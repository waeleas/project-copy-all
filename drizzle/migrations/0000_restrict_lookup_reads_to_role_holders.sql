CREATE OR REPLACE FUNCTION public.has_any_role(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _user_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id)
$$;
REVOKE EXECUTE ON FUNCTION public.has_any_role(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.has_any_role(uuid) TO authenticated;

DROP POLICY IF EXISTS "auth read drivers" ON public.drivers;
CREATE POLICY "role holders read drivers" ON public.drivers FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()));
DROP POLICY IF EXISTS "auth read technicians" ON public.technicians;
CREATE POLICY "role holders read technicians" ON public.technicians FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()));
DROP POLICY IF EXISTS "auth read managers" ON public.managers;
CREATE POLICY "role holders read managers" ON public.managers FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()));
DROP POLICY IF EXISTS "auth read settings" ON public.app_settings;
CREATE POLICY "role holders read settings" ON public.app_settings FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()));