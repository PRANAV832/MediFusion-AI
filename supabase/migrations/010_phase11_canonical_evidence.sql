-- ==============================================================================
-- MediFusion AI — Phase 11: Canonical Evidence System
-- ==============================================================================

-- 1. Canonical Evidence Items Table
CREATE TABLE IF NOT EXISTS public.canonical_evidence_items (
    id TEXT PRIMARY KEY,
    case_id UUID REFERENCES public.patient_cases(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    evidence_type TEXT NOT NULL CHECK (evidence_type IN ('MODEL_FINDING', 'PATIENT_RECORD', 'TRUSTED_KNOWLEDGE', 'GENERATED_SYNTHESIS')),
    title TEXT NOT NULL,
    summary TEXT NOT NULL,
    content TEXT,
    confidence NUMERIC(5, 4) CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
    modality TEXT,
    event_date DATE,
    provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Canonical Findings Table
CREATE TABLE IF NOT EXISTS public.canonical_findings (
    id TEXT PRIMARY KEY,
    case_id UUID NOT NULL REFERENCES public.patient_cases(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'MODERATE' CHECK (severity IN ('NORMAL', 'LOW', 'MODERATE', 'HIGH', 'CRITICAL')),
    status TEXT NOT NULL DEFAULT 'DETECTED' CHECK (status IN ('DETECTED', 'RULED_OUT', 'EQUIVOCAL', 'PENDING_REVIEW')),
    confidence NUMERIC(5, 4) CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
    source_evidence_type TEXT NOT NULL CHECK (source_evidence_type IN ('MODEL_FINDING', 'PATIENT_RECORD', 'TRUSTED_KNOWLEDGE', 'GENERATED_SYNTHESIS')),
    primary_evidence_id TEXT REFERENCES public.canonical_evidence_items(id) ON DELETE SET NULL,
    supporting_evidence_ids TEXT[] NOT NULL DEFAULT '{}'::text[],
    provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
    clinical_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Canonical Evidence Links Table
CREATE TABLE IF NOT EXISTS public.canonical_evidence_links (
    id TEXT PRIMARY KEY,
    case_id UUID NOT NULL REFERENCES public.patient_cases(id) ON DELETE CASCADE,
    source_id TEXT NOT NULL,
    source_type TEXT NOT NULL,
    target_evidence_id TEXT NOT NULL REFERENCES public.canonical_evidence_items(id) ON DELETE CASCADE,
    target_evidence_type TEXT NOT NULL CHECK (target_evidence_type IN ('MODEL_FINDING', 'PATIENT_RECORD', 'TRUSTED_KNOWLEDGE', 'GENERATED_SYNTHESIS')),
    link_type TEXT NOT NULL DEFAULT 'SUPPORTS' CHECK (link_type IN ('SUPPORTS', 'CONTRADICTS', 'CONTEXTUALIZES', 'DERIVED_FROM')),
    rationale TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Indexes for high performance querying
CREATE INDEX IF NOT EXISTS idx_cei_case_id ON public.canonical_evidence_items(case_id);
CREATE INDEX IF NOT EXISTS idx_cei_patient_id ON public.canonical_evidence_items(patient_id);
CREATE INDEX IF NOT EXISTS idx_cei_evidence_type ON public.canonical_evidence_items(evidence_type);

CREATE INDEX IF NOT EXISTS idx_cf_case_id ON public.canonical_findings(case_id);
CREATE INDEX IF NOT EXISTS idx_cf_patient_id ON public.canonical_findings(patient_id);
CREATE INDEX IF NOT EXISTS idx_cf_source_type ON public.canonical_findings(source_evidence_type);

CREATE INDEX IF NOT EXISTS idx_cel_case_id ON public.canonical_evidence_links(case_id);
CREATE INDEX IF NOT EXISTS idx_cel_source_id ON public.canonical_evidence_links(source_id);
CREATE INDEX IF NOT EXISTS idx_cel_target_id ON public.canonical_evidence_links(target_evidence_id);

-- 5. Row Level Security Policies
ALTER TABLE public.canonical_evidence_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.canonical_findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.canonical_evidence_links ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    -- canonical_evidence_items
    DROP POLICY IF EXISTS "Service role full access on canonical_evidence_items" ON public.canonical_evidence_items;
    CREATE POLICY "Service role full access on canonical_evidence_items" ON public.canonical_evidence_items
        FOR ALL TO service_role USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Authenticated users view canonical_evidence_items" ON public.canonical_evidence_items;
    CREATE POLICY "Authenticated users view canonical_evidence_items" ON public.canonical_evidence_items
        FOR SELECT TO authenticated USING (true);

    DROP POLICY IF EXISTS "Authenticated users insert canonical_evidence_items" ON public.canonical_evidence_items;
    CREATE POLICY "Authenticated users insert canonical_evidence_items" ON public.canonical_evidence_items
        FOR INSERT TO authenticated WITH CHECK (true);

    -- canonical_findings
    DROP POLICY IF EXISTS "Service role full access on canonical_findings" ON public.canonical_findings;
    CREATE POLICY "Service role full access on canonical_findings" ON public.canonical_findings
        FOR ALL TO service_role USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Authenticated users view canonical_findings" ON public.canonical_findings;
    CREATE POLICY "Authenticated users view canonical_findings" ON public.canonical_findings
        FOR SELECT TO authenticated USING (true);

    DROP POLICY IF EXISTS "Authenticated users insert canonical_findings" ON public.canonical_findings;
    CREATE POLICY "Authenticated users insert canonical_findings" ON public.canonical_findings
        FOR INSERT TO authenticated WITH CHECK (true);

    -- canonical_evidence_links
    DROP POLICY IF EXISTS "Service role full access on canonical_evidence_links" ON public.canonical_evidence_links;
    CREATE POLICY "Service role full access on canonical_evidence_links" ON public.canonical_evidence_links
        FOR ALL TO service_role USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Authenticated users view canonical_evidence_links" ON public.canonical_evidence_links;
    CREATE POLICY "Authenticated users view canonical_evidence_links" ON public.canonical_evidence_links
        FOR SELECT TO authenticated USING (true);

    DROP POLICY IF EXISTS "Authenticated users insert canonical_evidence_links" ON public.canonical_evidence_links;
    CREATE POLICY "Authenticated users insert canonical_evidence_links" ON public.canonical_evidence_links
        FOR INSERT TO authenticated WITH CHECK (true);
END $$;
