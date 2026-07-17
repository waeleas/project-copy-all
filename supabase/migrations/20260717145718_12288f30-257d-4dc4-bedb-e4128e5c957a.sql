
-- App-wide settings (single row)
CREATE TABLE public.app_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  rental_cars_visible boolean NOT NULL DEFAULT true,
  trip_creation_enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read settings" ON public.app_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin update settings" ON public.app_settings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin insert settings" ON public.app_settings FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
INSERT INTO public.app_settings (id) VALUES (true) ON CONFLICT DO NOTHING;

-- Per-user overrides on profiles: NULL = follow global setting
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS rental_cars_override boolean,
  ADD COLUMN IF NOT EXISTS trip_create_override boolean;

-- Helpers
CREATE OR REPLACE FUNCTION public.can_see_rentals(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT rental_cars_override FROM public.profiles WHERE user_id = _user_id),
    (SELECT rental_cars_visible FROM public.app_settings WHERE id = true),
    true
  )
$$;

CREATE OR REPLACE FUNCTION public.can_create_trips(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT trip_create_override FROM public.profiles WHERE user_id = _user_id),
    (SELECT trip_creation_enabled FROM public.app_settings WHERE id = true),
    true
  )
$$;

REVOKE EXECUTE ON FUNCTION public.can_see_rentals(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_create_trips(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_see_rentals(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_create_trips(uuid) TO authenticated;

-- Filter rentals from cars SELECT
DROP POLICY IF EXISTS "auth read cars" ON public.cars;
CREATE POLICY "auth read cars" ON public.cars FOR SELECT TO authenticated
  USING (type <> 'rental' OR public.can_see_rentals(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));

-- Restrict trip insert
DROP POLICY IF EXISTS "auth insert trips" ON public.trips;
CREATE POLICY "auth insert trips" ON public.trips FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by AND (public.can_create_trips(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role)));
