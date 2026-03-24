-- Align company logo storage access with tenant-aware company permissions.
-- New uploads are expected under: <tenant_id>/logos/<uuid>.<ext>

DROP POLICY IF EXISTS "Admins can upload company assets" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update company assets" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete company assets" ON storage.objects;

CREATE POLICY "Admins can upload company assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'company-assets'
  AND auth.uid() IS NOT NULL
  AND (
    public.has_role(auth.uid(), 'super_admin')
    OR (
      (
        public.is_tenant_admin(auth.uid(), public.get_user_tenant(auth.uid()))
        OR public.has_permission(auth.uid(), 'companies')
      )
      AND (storage.foldername(name))[1] = public.get_user_tenant(auth.uid())::text
    )
  )
);

CREATE POLICY "Admins can update company assets"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'company-assets'
  AND auth.uid() IS NOT NULL
  AND (
    public.has_role(auth.uid(), 'super_admin')
    OR (
      (
        public.is_tenant_admin(auth.uid(), public.get_user_tenant(auth.uid()))
        OR public.has_permission(auth.uid(), 'companies')
      )
      AND (
        (storage.foldername(name))[1] = public.get_user_tenant(auth.uid())::text
        OR (storage.foldername(name))[1] = 'logos'
      )
    )
  )
)
WITH CHECK (
  bucket_id = 'company-assets'
  AND auth.uid() IS NOT NULL
  AND (
    public.has_role(auth.uid(), 'super_admin')
    OR (
      (
        public.is_tenant_admin(auth.uid(), public.get_user_tenant(auth.uid()))
        OR public.has_permission(auth.uid(), 'companies')
      )
      AND (storage.foldername(name))[1] = public.get_user_tenant(auth.uid())::text
    )
  )
);

CREATE POLICY "Admins can delete company assets"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'company-assets'
  AND auth.uid() IS NOT NULL
  AND (
    public.has_role(auth.uid(), 'super_admin')
    OR (
      (
        public.is_tenant_admin(auth.uid(), public.get_user_tenant(auth.uid()))
        OR public.has_permission(auth.uid(), 'companies')
      )
      AND (
        (storage.foldername(name))[1] = public.get_user_tenant(auth.uid())::text
        OR (storage.foldername(name))[1] = 'logos'
      )
    )
  )
);
