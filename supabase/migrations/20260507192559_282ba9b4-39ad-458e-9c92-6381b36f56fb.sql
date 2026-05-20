
INSERT INTO storage.buckets (id, name, public)
VALUES ('app-assets', 'app-assets', true)
ON CONFLICT (id) DO UPDATE SET public = true;

CREATE POLICY "public reads app-assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'app-assets');

CREATE POLICY "staff writes app-assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'app-assets' AND public.is_staff_or_admin(auth.uid()));

CREATE POLICY "staff updates app-assets"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'app-assets' AND public.is_staff_or_admin(auth.uid()));

CREATE POLICY "staff deletes app-assets"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'app-assets' AND public.is_staff_or_admin(auth.uid()));
