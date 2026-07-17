DROP POLICY IF EXISTS "user update own open trips" ON public.trips;

CREATE POLICY "user update own open trips"
ON public.trips
FOR UPDATE
TO authenticated
USING (auth.uid() = created_by AND status = 'open')
WITH CHECK (auth.uid() = created_by AND status IN ('open','closed'));