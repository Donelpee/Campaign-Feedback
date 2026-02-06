-- Create storage bucket for company assets
INSERT INTO storage.buckets (id, name, public) 
VALUES ('company-assets', 'company-assets', true);

-- Create storage bucket for campaign documents (private)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('campaign-documents', 'campaign-documents', false);

-- RLS policies for company-assets bucket (public read, admin write)
CREATE POLICY "Anyone can view company assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'company-assets');

CREATE POLICY "Admins can upload company assets"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'company-assets' 
  AND is_admin(auth.uid())
);

CREATE POLICY "Admins can update company assets"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'company-assets' 
  AND is_admin(auth.uid())
);

CREATE POLICY "Admins can delete company assets"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'company-assets' 
  AND is_admin(auth.uid())
);

-- RLS policies for campaign-documents bucket (admin only)
CREATE POLICY "Admins can view campaign documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'campaign-documents' 
  AND is_admin(auth.uid())
);

CREATE POLICY "Admins can upload campaign documents"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'campaign-documents' 
  AND is_admin(auth.uid())
);

CREATE POLICY "Admins can delete campaign documents"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'campaign-documents' 
  AND is_admin(auth.uid())
);

-- Add logo_url column to companies table
ALTER TABLE public.companies 
ADD COLUMN logo_url TEXT;

-- Add campaign_type and questions columns to campaigns table
ALTER TABLE public.campaigns 
ADD COLUMN campaign_type TEXT DEFAULT 'feedback',
ADD COLUMN questions JSONB DEFAULT '[]'::jsonb;