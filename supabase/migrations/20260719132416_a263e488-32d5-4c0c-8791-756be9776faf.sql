DROP POLICY IF EXISTS "auth view odometer photos" ON storage.objects;

CREATE POLICY "auth view odometer photos" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'odometer-photos' AND (
    owner = auth.uid()
    OR (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'viewer')
  ));