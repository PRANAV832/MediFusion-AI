-- ==============================================================================
-- MediFusion AI — Phase 15: Clinician-Facing Screening Reports
-- ==============================================================================

-- 1. ADD STRUCTURED REPORT PAYLOAD AND SIGN-OFF FIELDS TO SCREENING_REPORTS
ALTER TABLE public.screening_reports 
ADD COLUMN IF NOT EXISTS structured_payload JSONB DEFAULT '{}'::JSONB,
ADD COLUMN IF NOT EXISTS review_status TEXT DEFAULT 'REVIEW_REQUIRED',
ADD COLUMN IF NOT EXISTS uncertainty_level TEXT DEFAULT 'MODERATE',
ADD COLUMN IF NOT EXISTS clinician_signature TEXT;

-- 2. CREATE INDEXES ON CASE AND REVIEW STATUS
CREATE INDEX IF NOT EXISTS idx_reports_review_status ON public.screening_reports(review_status);
CREATE INDEX IF NOT EXISTS idx_reports_updated_at ON public.screening_reports(updated_at);

-- 3. ENSURE RLS POLICIES FOR CLINICIANS
DO $$
BEGIN
    DROP POLICY IF EXISTS "Clinicians can update reports" ON public.screening_reports;
    CREATE POLICY "Clinicians can update reports" ON public.screening_reports
        FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
END $$;
