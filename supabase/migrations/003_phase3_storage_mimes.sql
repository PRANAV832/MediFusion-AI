-- ==============================================================================
-- Migration: 003_phase3_storage_mimes.sql
-- Description: Provision and configure medical-assets bucket in storage.buckets
-- ==============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('medical-assets', 'medical-assets', false, 52428800, NULL)
ON CONFLICT (id) DO UPDATE SET allowed_mime_types = NULL;

-- Ensure storage policies exist for authenticated users and service_role
DO $$
BEGIN
    DROP POLICY IF EXISTS "Authenticated users can read medical assets" ON storage.objects;
    CREATE POLICY "Authenticated users can read medical assets" ON storage.objects
        FOR SELECT TO authenticated USING (bucket_id = 'medical-assets');

    DROP POLICY IF EXISTS "Authenticated users can insert medical assets" ON storage.objects;
    CREATE POLICY "Authenticated users can insert medical assets" ON storage.objects
        FOR INSERT TO authenticated WITH CHECK (bucket_id = 'medical-assets');

    DROP POLICY IF EXISTS "Service role full access on medical assets" ON storage.objects;
    CREATE POLICY "Service role full access on medical assets" ON storage.objects
        FOR ALL TO service_role USING (bucket_id = 'medical-assets') WITH CHECK (bucket_id = 'medical-assets');
END $$;
