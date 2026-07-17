DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND (policyname ILIKE '%odometer%' AND (policyname ILIKE '%delete%' OR policyname ILIKE '%update%'))
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "odometer photos delete own or admin"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'odometer-photos'
  AND (
    (storage.foldername(name))[1] = (auth.uid())::text
    OR has_role(auth.uid(), 'admin'::app_role)
  )
);

CREATE POLICY "odometer photos update own or admin"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'odometer-photos'
  AND (
    (storage.foldername(name))[1] = (auth.uid())::text
    OR has_role(auth.uid(), 'admin'::app_role)
  )
)
WITH CHECK (
  bucket_id = 'odometer-photos'
  AND (
    (storage.foldername(name))[1] = (auth.uid())::text
    OR has_role(auth.uid(), 'admin'::app_role)
  )
);