
-- Cars table
CREATE TABLE public.cars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  plate text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cars TO authenticated;
GRANT ALL ON public.cars TO service_role;
ALTER TABLE public.cars ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read cars" ON public.cars FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin write cars" ON public.cars FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- Promote specified users to admin
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role FROM auth.users
WHERE email IN ('waeleas@gmail.com','ahakim02@elarabygroup.com','kwagih01@elarabygroup.com','welneg01@elarabygroup.com')
ON CONFLICT (user_id, role) DO NOTHING;

-- Remove auto-admin-on-first-signup; new users get 'user' role only
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Allow admins to delete any trip (existing policy already allows owner delete)
DROP POLICY IF EXISTS "admin delete trips" ON public.trips;
CREATE POLICY "admin delete trips" ON public.trips FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'));
