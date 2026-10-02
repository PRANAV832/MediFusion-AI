-- ==============================================================================
-- MediFusion AI — Phase 12: Structured Conflict Detection & Review System
-- ==============================================================================

-- 1. Case Conflicts Table (stores Evidence A vs Evidence B contradictions)
CREATE TABLE IF NOT EXISTS public.case_conflicts (
    id TEXT PRIMARY KEY,
    case_id UUID NOT NULL REFERENCES public.patient_cases(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    conflict_type TEXT NOT NULL, 
    -- 'MODEL_DISAGREEMENT', 'MODEL_VS_HISTORY', 'HISTORICAL_CONTRADICTION',
    -- 'MISSING_EVIDENCE', 'POOR_IMAGE_QUALITY', 'UNSUPPORTED_MODALITY', 'INCOMPLETE_CONTEXT'
    review_state TEXT NOT NULL,
    -- 'CLEAR', 'REVIEW_REQUIRED', 'INSUFFICIENT_EVIDENCE', 'MODEL_DISAGREEMENT', 'INPUT_QUALITY_ISSUE'
    severity TEXT NOT NULL DEFAULT 'MODERATE', -- 'LOW', 'MODERATE', 'HIGH', 'CRITICAL'
    title TEXT NOT NULL,
    explanation TEXT NOT NULL,
    evidence_a JSONB NOT NULL DEFAULT '{}'::jsonb,
    evidence_b JSONB NOT NULL DEFAULT '{}'::jsonb,
    clinical_implication TEXT,
    recommended_action TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'OPEN', -- 'OPEN', 'ACKNOWLEDGED', 'RESOLVED'
    resolution_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Case Review Assessments Table (five strictly separated dimensions)
CREATE TABLE IF NOT EXISTS public.case_review_assessments (
    id TEXT PRIMARY KEY,
    case_id UUID NOT NULL REFERENCES public.patient_cases(id) ON DELETE CASCADE UNIQUE,
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    review_state TEXT NOT NULL,
    -- 'CLEAR', 'REVIEW_REQUIRED', 'INSUFFICIENT_EVIDENCE', 'MODEL_DISAGREEMENT', 'INPUT_QUALITY_ISSUE'
    human_review_required BOOLEAN NOT NULL DEFAULT FALSE,
    review_reasons TEXT[] NOT NULL DEFAULT '{}'::text[],
    
    -- Strictly Separated Dimensions (never conflated into a fake diagnosis score)
    model_confidence NUMERIC(5, 4),      -- strictly model-produced confidence
    cross_model_agreement NUMERIC(5, 4), -- agreement ratio between multiple models
    historical_support NUMERIC(5, 4),    -- correlation with patient longitudinal baseline
    evidence_completeness NUMERIC(5, 4), -- intake completeness (notes, vitals, assets)
    input_quality NUMERIC(5, 4),         -- asset resolution, aspect ratio, metadata integrity
    
    metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
    conflicts_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_cc_case_id ON public.case_conflicts(case_id);
CREATE INDEX IF NOT EXISTS idx_cc_patient_id ON public.case_conflicts(patient_id);
CREATE INDEX IF NOT EXISTS idx_cc_conflict_type ON public.case_conflicts(conflict_type);
CREATE INDEX IF NOT EXISTS idx_cc_review_state ON public.case_conflicts(review_state);

CREATE INDEX IF NOT EXISTS idx_cra_case_id ON public.case_review_assessments(case_id);
CREATE INDEX IF NOT EXISTS idx_cra_patient_id ON public.case_review_assessments(patient_id);
CREATE INDEX IF NOT EXISTS idx_cra_review_state ON public.case_review_assessments(review_state);

-- 4. Row Level Security Policies
ALTER TABLE public.case_conflicts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_review_assessments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    -- case_conflicts
    DROP POLICY IF EXISTS "Service role full access on case_conflicts" ON public.case_conflicts;
    CREATE POLICY "Service role full access on case_conflicts" ON public.case_conflicts
        FOR ALL TO service_role USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Authenticated users view case_conflicts" ON public.case_conflicts;
    CREATE POLICY "Authenticated users view case_conflicts" ON public.case_conflicts
        FOR SELECT TO authenticated USING (true);

    DROP POLICY IF EXISTS "Authenticated users insert case_conflicts" ON public.case_conflicts;
    CREATE POLICY "Authenticated users insert case_conflicts" ON public.case_conflicts
        FOR INSERT TO authenticated WITH CHECK (true);

    DROP POLICY IF EXISTS "Authenticated users update case_conflicts" ON public.case_conflicts;
    CREATE POLICY "Authenticated users update case_conflicts" ON public.case_conflicts
        FOR UPDATE TO authenticated USING (true);

    -- case_review_assessments
    DROP POLICY IF EXISTS "Service role full access on case_review_assessments" ON public.case_review_assessments;
    CREATE POLICY "Service role full access on case_review_assessments" ON public.case_review_assessments
        FOR ALL TO service_role USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Authenticated users view case_review_assessments" ON public.case_review_assessments;
    CREATE POLICY "Authenticated users view case_review_assessments" ON public.case_review_assessments
        FOR SELECT TO authenticated USING (true);

    DROP POLICY IF EXISTS "Authenticated users insert case_review_assessments" ON public.case_review_assessments;
    CREATE POLICY "Authenticated users insert case_review_assessments" ON public.case_review_assessments
        FOR INSERT TO authenticated WITH CHECK (true);

    DROP POLICY IF EXISTS "Authenticated users update case_review_assessments" ON public.case_review_assessments;
    CREATE POLICY "Authenticated users update case_review_assessments" ON public.case_review_assessments
        FOR UPDATE TO authenticated USING (true);
END $$;
