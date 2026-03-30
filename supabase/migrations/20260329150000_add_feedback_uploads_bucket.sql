INSERT INTO storage.buckets (id, name, public)
VALUES ('feedback-uploads', 'feedback-uploads', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Admins can view feedback uploads" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete feedback uploads" ON storage.objects;

CREATE POLICY "Admins can view feedback uploads"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'feedback-uploads'
  AND public.is_admin(auth.uid())
);

CREATE POLICY "Admins can delete feedback uploads"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'feedback-uploads'
  AND public.is_admin(auth.uid())
);
