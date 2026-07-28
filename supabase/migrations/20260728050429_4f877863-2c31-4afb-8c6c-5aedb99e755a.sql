DROP POLICY IF EXISTS "user delete own open trips" ON public.trips;
CREATE POLICY "user delete own open trips" ON public.trips
  FOR DELETE TO authenticated
  USING ((auth.uid() = created_by) AND (status = 'open'::text));