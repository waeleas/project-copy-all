
-- Tighten odometer-photos bucket policies: enforce ownership on upload and select
DROP POLICY IF EXISTS "auth upload odometer photos" ON storage.objects;
DROP POLICY IF EXISTS "auth view odometer photos" ON storage.objects;

CREATE POLICY "auth upload odometer photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'odometer-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "auth view odometer photos"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'odometer-photos'
  AND (
    owner = auth.uid()
    OR (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  )
);

-- Trigger function should not be directly callable by clients
REVOKE EXECUTE ON FUNCTION public.handle_new_user_role() FROM PUBLIC, anon, authenticated;
