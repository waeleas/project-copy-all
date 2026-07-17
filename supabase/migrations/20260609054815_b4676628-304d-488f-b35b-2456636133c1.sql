
CREATE TABLE public.trip_segments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  sequence INTEGER NOT NULL DEFAULT 1,
  route TEXT NOT NULL,
  odometer INTEGER NOT NULL,
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

CREATE POLICY "read own or admin segments" ON public.trip_segments FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.trips t WHERE t.id = trip_id AND (t.created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role)))
);

CREATE POLICY "insert segments on own open or admin" ON public.trip_segments FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.trips t WHERE t.id = trip_id AND (
    has_role(auth.uid(), 'admin'::app_role) OR (t.created_by = auth.uid() AND t.status = 'open')
  ))
);

CREATE POLICY "update segments on own open or admin" ON public.trip_segments FOR UPDATE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.trips t WHERE t.id = trip_id AND (
    has_role(auth.uid(), 'admin'::app_role) OR (t.created_by = auth.uid() AND t.status = 'open')
  ))
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.trips t WHERE t.id = trip_id AND (
    has_role(auth.uid(), 'admin'::app_role) OR (t.created_by = auth.uid() AND t.status = 'open')
  ))
);

CREATE POLICY "delete segments admin or own open" ON public.trip_segments FOR DELETE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.trips t WHERE t.id = trip_id AND (
    has_role(auth.uid(), 'admin'::app_role) OR (t.created_by = auth.uid() AND t.status = 'open')
  ))
);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_trip_segments_updated_at BEFORE UPDATE ON public.trip_segments
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
