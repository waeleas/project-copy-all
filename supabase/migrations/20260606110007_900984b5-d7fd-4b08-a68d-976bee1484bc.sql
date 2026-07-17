
-- Add car_type, trip_no, created_by_email
ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS car_type text NOT NULL DEFAULT 'company',
  ADD COLUMN IF NOT EXISTS created_by_email text;

-- Sequential trip number
CREATE SEQUENCE IF NOT EXISTS public.trips_trip_no_seq;
ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS trip_no bigint NOT NULL DEFAULT nextval('public.trips_trip_no_seq');
ALTER SEQUENCE public.trips_trip_no_seq OWNED BY public.trips.trip_no;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'trips_trip_no_key') THEN
    CREATE UNIQUE INDEX trips_trip_no_key ON public.trips(trip_no);
  END IF;
END $$;

-- Restrict normal user update to open trips only
DROP POLICY IF EXISTS "auth update own trips" ON public.trips;
CREATE POLICY "user update own open trips" ON public.trips
  FOR UPDATE TO authenticated
  USING (auth.uid() = created_by AND status = 'open')
  WITH CHECK (auth.uid() = created_by AND status = 'open');

-- Admin can update any trip in any state
DROP POLICY IF EXISTS "admin update trips" ON public.trips;
CREATE POLICY "admin update trips" ON public.trips
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Restrict delete: remove user self-delete, keep admin-only
DROP POLICY IF EXISTS "auth delete trips" ON public.trips;

-- user_roles: allow admin to manage roles
DROP POLICY IF EXISTS "admin manage roles" ON public.user_roles;
CREATE POLICY "admin manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
