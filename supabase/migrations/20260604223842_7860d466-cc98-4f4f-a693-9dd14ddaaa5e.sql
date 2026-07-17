
CREATE POLICY "auth view odometer photos" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'odometer-photos');
CREATE POLICY "auth upload odometer photos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'odometer-photos');
CREATE POLICY "auth update odometer photos" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'odometer-photos');
CREATE POLICY "auth delete odometer photos" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'odometer-photos' AND owner = auth.uid());
