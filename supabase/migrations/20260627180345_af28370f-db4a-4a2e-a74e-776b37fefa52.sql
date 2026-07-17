
DROP POLICY IF EXISTS "read own or admin trips" ON public.trips;
CREATE POLICY "read own or admin or viewer trips" ON public.trips
FOR SELECT TO authenticated
USING (
  auth.uid() = created_by
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'viewer')
);

DROP POLICY IF EXISTS "read own or admin segments" ON public.trip_segments;
CREATE POLICY "read own admin or viewer segments" ON public.trip_segments
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.trips t
    WHERE t.id = trip_segments.trip_id
      AND (
        t.created_by = auth.uid()
        OR public.has_role(auth.uid(), 'admin')
        OR public.has_role(auth.uid(), 'viewer')
      )
  )
);
