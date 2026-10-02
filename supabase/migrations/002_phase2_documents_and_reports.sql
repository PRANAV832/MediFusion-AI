-- ==============================================================================
-- MediFusion AI — Phase 2: Documents & Screening Reports
-- ==============================================================================

-- 1. DOCUMENTS TABLE
CREATE TABLE IF NOT EXISTS public.documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    document_type TEXT NOT NULL, -- 'discharge_summary', 'lab_report', 'radiology_report', 'prescription', 'clinical_note', 'referral'
    document_date DATE NOT NULL DEFAULT CURRENT_DATE,
    department TEXT DEFAULT 'General Medicine',
    author_name TEXT,
    summary TEXT,
    file_url TEXT,
    metadata JSONB DEFAULT '{}'::JSONB,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. SCREENING REPORTS TABLE
CREATE TABLE IF NOT EXISTS public.screening_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    case_id UUID REFERENCES public.patient_cases(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    report_type TEXT NOT NULL DEFAULT 'clinical_screening',
    status TEXT NOT NULL DEFAULT 'draft', -- 'draft', 'preliminary', 'final', 'reviewed'
    findings_summary TEXT,
    recommendations TEXT,
    review_notes TEXT,
    reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_documents_patient ON public.documents(patient_id);
CREATE INDEX IF NOT EXISTS idx_documents_type ON public.documents(document_type);
CREATE INDEX IF NOT EXISTS idx_reports_patient ON public.screening_reports(patient_id);
CREATE INDEX IF NOT EXISTS idx_reports_case ON public.screening_reports(case_id);

-- ROW LEVEL SECURITY
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.screening_reports ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Service role full access on documents" ON public.documents;
    CREATE POLICY "Service role full access on documents" ON public.documents
        FOR ALL TO service_role USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Clinicians can view documents" ON public.documents;
    CREATE POLICY "Clinicians can view documents" ON public.documents
        FOR SELECT TO authenticated USING (true);

    DROP POLICY IF EXISTS "Clinicians can create documents" ON public.documents;
    CREATE POLICY "Clinicians can create documents" ON public.documents
        FOR INSERT TO authenticated WITH CHECK (true);

    DROP POLICY IF EXISTS "Service role full access on reports" ON public.screening_reports;
    CREATE POLICY "Service role full access on reports" ON public.screening_reports
        FOR ALL TO service_role USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Clinicians can view reports" ON public.screening_reports;
    CREATE POLICY "Clinicians can view reports" ON public.screening_reports
        FOR SELECT TO authenticated USING (true);

    DROP POLICY IF EXISTS "Clinicians can create reports" ON public.screening_reports;
    CREATE POLICY "Clinicians can create reports" ON public.screening_reports
        FOR INSERT TO authenticated WITH CHECK (true);
END $$;
