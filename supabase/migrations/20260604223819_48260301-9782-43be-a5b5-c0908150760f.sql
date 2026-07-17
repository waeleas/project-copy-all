
-- Lookup tables
CREATE TABLE public.offices (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL UNIQUE, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.managers (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL UNIQUE, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.technicians (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, sap_number text NOT NULL UNIQUE, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.drivers (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, sap_number text NOT NULL UNIQUE, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.service_types (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL UNIQUE, created_at timestamptz NOT NULL DEFAULT now());

-- Trips
CREATE TABLE public.trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  office_id uuid REFERENCES public.offices(id) ON DELETE SET NULL,
  manager_id uuid REFERENCES public.managers(id) ON DELETE SET NULL,
  technician_id uuid REFERENCES public.technicians(id) ON DELETE SET NULL,
  driver_id uuid REFERENCES public.drivers(id) ON DELETE SET NULL,
  service_type_id uuid REFERENCES public.service_types(id) ON DELETE SET NULL,
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

CREATE INDEX idx_trips_status ON public.trips(status);
CREATE INDEX idx_trips_created_by ON public.trips(created_by);

-- Grants
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
CREATE POLICY "auth write offices" ON public.offices FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth read managers" ON public.managers FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write managers" ON public.managers FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth read technicians" ON public.technicians FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write technicians" ON public.technicians FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth read drivers" ON public.drivers FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write drivers" ON public.drivers FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth read service_types" ON public.service_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write service_types" ON public.service_types FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "auth read trips" ON public.trips FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert trips" ON public.trips FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "auth update trips" ON public.trips FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth delete trips" ON public.trips FOR DELETE TO authenticated USING (auth.uid() = created_by);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER LANGUAGE plpgsql SET search_path=public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER trips_updated_at BEFORE UPDATE ON public.trips FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
