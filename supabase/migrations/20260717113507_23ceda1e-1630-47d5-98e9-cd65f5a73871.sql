-- Lookup tables
CREATE TABLE public.offices (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL UNIQUE, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.managers (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL UNIQUE, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.technicians (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, sap_number text NOT NULL UNIQUE, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.drivers (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, sap_number text, type text NOT NULL DEFAULT 'company', created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.service_types (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL UNIQUE, created_at timestamptz NOT NULL DEFAULT now());

-- Role enum & user_roles (create BEFORE trips references)
CREATE TYPE public.app_role AS ENUM ('admin', 'user', 'viewer');

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

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

CREATE POLICY "users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "admin manage roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Cars table
CREATE TABLE public.cars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text,
  plate text NOT NULL,
  type text NOT NULL DEFAULT 'company',
  route_code text,
  route_description text,
  follow_office_id uuid,
  handheld_code text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX cars_handheld_code_unique ON public.cars(handheld_code) WHERE handheld_code IS NOT NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cars TO authenticated;
GRANT ALL ON public.cars TO service_role;
ALTER TABLE public.cars ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read cars" ON public.cars FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin write cars" ON public.cars FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Offices extras
ALTER TABLE public.offices ADD COLUMN code text;

-- Managers extras
ALTER TABLE public.managers ADD COLUMN sap_number TEXT;
ALTER TABLE public.managers ADD COLUMN cost_center TEXT;

-- Trips
CREATE SEQUENCE public.trips_trip_no_seq;
CREATE TABLE public.trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_no bigint NOT NULL DEFAULT nextval('public.trips_trip_no_seq') UNIQUE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_email text,
  created_by_name text,
  office_id uuid REFERENCES public.offices(id) ON DELETE SET NULL,
  manager_id uuid REFERENCES public.managers(id) ON DELETE SET NULL,
  technician_id uuid REFERENCES public.technicians(id) ON DELETE SET NULL,
  driver_id uuid REFERENCES public.drivers(id) ON DELETE SET NULL,
  driver_name_rental text,
  service_type_id uuid REFERENCES public.service_types(id) ON DELETE SET NULL,
  car_code text,
  car_plate text,
  car_type text NOT NULL DEFAULT 'company',
  handheld_code text,
  route_code text,
  follow_office_id uuid REFERENCES public.offices(id) ON DELETE SET NULL,
  route_start text NOT NULL,
  start_odometer integer NOT NULL,
  start_photo_url text NOT NULL,
  start_at timestamptz NOT NULL DEFAULT now(),
  end_odometer integer,
  end_photo_url text,
  end_at timestamptz,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER SEQUENCE public.trips_trip_no_seq OWNED BY public.trips.trip_no;
CREATE INDEX idx_trips_status ON public.trips(status);
CREATE INDEX idx_trips_created_by ON public.trips(created_by);

-- Grants for lookup tables and trips
GRANT SELECT, INSERT, UPDATE, DELETE ON public.offices TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.managers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.technicians TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.drivers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_types TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trips TO authenticated;
GRANT ALL ON public.offices, public.managers, public.technicians, public.drivers, public.service_types, public.trips TO service_role;

-- RLS
ALTER TABLE public.offices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.managers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.technicians ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read offices" ON public.offices FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin write offices" ON public.offices FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "auth read managers" ON public.managers FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin write managers" ON public.managers FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "auth read technicians" ON public.technicians FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin write technicians" ON public.technicians FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "auth read drivers" ON public.drivers FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin write drivers" ON public.drivers FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "auth read service_types" ON public.service_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin write service_types" ON public.service_types FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "read own admin or viewer trips" ON public.trips FOR SELECT TO authenticated
  USING (auth.uid() = created_by OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'viewer'));
CREATE POLICY "auth insert trips" ON public.trips FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "user update own open trips" ON public.trips FOR UPDATE TO authenticated
  USING (auth.uid() = created_by AND status = 'open')
  WITH CHECK (auth.uid() = created_by AND status IN ('open','closed'));
CREATE POLICY "admin update trips" ON public.trips FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin delete trips" ON public.trips FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER LANGUAGE plpgsql SET search_path=public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trips_updated_at BEFORE UPDATE ON public.trips FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-assign 'user' role on new auth signup
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.handle_new_user_role() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER on_auth_user_created_role AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_role();

-- Profiles
CREATE TABLE public.profiles (
  id uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  username text,
  display_name text,
  must_change_password boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX profiles_username_lower_idx ON public.profiles (lower(username)) WHERE username IS NOT NULL;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "admin read all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER profiles_set_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Trip segments
CREATE TABLE public.trip_segments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  sequence INTEGER NOT NULL DEFAULT 1,
  route TEXT NOT NULL,
  odometer INTEGER,
  photo_url TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_trip_segments_trip ON public.trip_segments(trip_id, sequence);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trip_segments TO authenticated;
GRANT ALL ON public.trip_segments TO service_role;
ALTER TABLE public.trip_segments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own admin or viewer segments" ON public.trip_segments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.trips t WHERE t.id = trip_segments.trip_id AND
    (t.created_by = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'viewer'))));
CREATE POLICY "insert segments on own open or admin" ON public.trip_segments FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.trips t WHERE t.id = trip_id AND
    (public.has_role(auth.uid(),'admin') OR (t.created_by = auth.uid() AND t.status = 'open'))));
CREATE POLICY "update segments on own open or admin" ON public.trip_segments FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.trips t WHERE t.id = trip_id AND
    (public.has_role(auth.uid(),'admin') OR (t.created_by = auth.uid() AND t.status = 'open'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.trips t WHERE t.id = trip_id AND
    (public.has_role(auth.uid(),'admin') OR (t.created_by = auth.uid() AND t.status = 'open'))));
CREATE POLICY "delete segments admin or own open" ON public.trip_segments FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.trips t WHERE t.id = trip_id AND
    (public.has_role(auth.uid(),'admin') OR (t.created_by = auth.uid() AND t.status = 'open'))));
CREATE TRIGGER update_trip_segments_updated_at BEFORE UPDATE ON public.trip_segments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Storage policies for odometer-photos bucket
CREATE POLICY "auth upload odometer photos" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'odometer-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "auth view odometer photos" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'odometer-photos' AND (
    owner = auth.uid() OR (storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(),'admin')
  ));
CREATE POLICY "odometer photos delete own or admin" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'odometer-photos' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(),'admin')));
CREATE POLICY "odometer photos update own or admin" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'odometer-photos' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(),'admin')))
  WITH CHECK (bucket_id = 'odometer-photos' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(),'admin')));