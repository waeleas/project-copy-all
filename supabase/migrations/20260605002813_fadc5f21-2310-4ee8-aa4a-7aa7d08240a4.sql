
-- 1. Fix trips UPDATE policy: owner-scoped
DROP POLICY IF EXISTS "auth update trips" ON public.trips;
CREATE POLICY "auth update own trips" ON public.trips
  FOR UPDATE TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

-- 2. Fix storage UPDATE policy for odometer-photos
DROP POLICY IF EXISTS "auth update odometer photos" ON storage.objects;
CREATE POLICY "auth update own odometer photos" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'odometer-photos' AND owner = auth.uid())
  WITH CHECK (bucket_id = 'odometer-photos' AND owner = auth.uid());

-- 3. Admin role system for lookup tables
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Auto-assign admin role to the first user, regular user role to others
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_role ON auth.users;
CREATE TRIGGER on_auth_user_created_role
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_role();

-- Backfill: make existing users admins (so app doesn't break)
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role FROM auth.users
ON CONFLICT (user_id, role) DO NOTHING;

-- 4. Restrict lookup tables: read for all authenticated, write only for admins
-- offices
DROP POLICY IF EXISTS "auth write offices" ON public.offices;
CREATE POLICY "admin write offices" ON public.offices
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- managers
DROP POLICY IF EXISTS "auth write managers" ON public.managers;
CREATE POLICY "admin write managers" ON public.managers
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- technicians
DROP POLICY IF EXISTS "auth write technicians" ON public.technicians;
CREATE POLICY "admin write technicians" ON public.technicians
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- drivers
DROP POLICY IF EXISTS "auth write drivers" ON public.drivers;
CREATE POLICY "admin write drivers" ON public.drivers
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- service_types
DROP POLICY IF EXISTS "auth write service_types" ON public.service_types;
CREATE POLICY "admin write service_types" ON public.service_types
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
