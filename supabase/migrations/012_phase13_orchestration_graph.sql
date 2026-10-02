-- ==============================================================================
-- MediFusion AI — Phase 13: Live Orchestration Runs & Event Reconstruction
-- ==============================================================================

-- 1. Case Orchestration Runs Table
CREATE TABLE IF NOT EXISTS public.case_orchestration_runs (
    id TEXT PRIMARY KEY,
    case_id UUID NOT NULL REFERENCES public.patient_cases(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    state TEXT NOT NULL DEFAULT 'QUEUED' CHECK (state IN ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'REVIEW_REQUIRED')),
    summary TEXT,
    active_stage TEXT NOT NULL DEFAULT 'case_accepted',
    total_events INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    review_reasons TEXT[] NOT NULL DEFAULT '{}'::text[],
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- 2. Case Orchestration Events Table (Chronological Trace Log for Graph Reconstruction)
CREATE TABLE IF NOT EXISTS public.case_orchestration_events (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL REFERENCES public.case_orchestration_runs(id) ON DELETE CASCADE,
    case_id UUID NOT NULL REFERENCES public.patient_cases(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL, 
    -- 'case_accepted', 'asset_inspection', 'rag_retrieval', 'capability_selection',
    -- 'model_selection', 'resource_check', 'model_load', 'inference',
    -- 'evidence_creation', 'conflict_detection', 'gemini_synthesis', 'report_generation',
    -- 'error', 'review_required'
    stage_node TEXT NOT NULL,
    -- 'CASE', 'INPUTS', 'CAPABILITY_SELECTION', 'RESOURCE_CHECK', 'SPECIALIZED_MODEL',
    -- 'MODEL_FINDING', 'EVIDENCE', 'CONFLICT_UNCERTAINTY', 'GEMINI', 'REPORT'
    state TEXT NOT NULL DEFAULT 'COMPLETED' CHECK (state IN ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'REVIEW_REQUIRED')),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    sequence INTEGER NOT NULL DEFAULT 0,
    duration_ms DOUBLE PRECISION,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for rapid time-series retrieval & reconstruction
CREATE INDEX IF NOT EXISTS idx_cor_case_id ON public.case_orchestration_runs(case_id);
CREATE INDEX IF NOT EXISTS idx_cor_patient_id ON public.case_orchestration_runs(patient_id);
CREATE INDEX IF NOT EXISTS idx_cor_state ON public.case_orchestration_runs(state);
CREATE INDEX IF NOT EXISTS idx_cor_created_at ON public.case_orchestration_runs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_coe_run_id ON public.case_orchestration_events(run_id);
CREATE INDEX IF NOT EXISTS idx_coe_case_id ON public.case_orchestration_events(case_id);
CREATE INDEX IF NOT EXISTS idx_coe_stage_node ON public.case_orchestration_events(stage_node);
CREATE INDEX IF NOT EXISTS idx_coe_sequence ON public.case_orchestration_events(sequence ASC);
CREATE INDEX IF NOT EXISTS idx_coe_created_at ON public.case_orchestration_events(created_at ASC);

-- Row Level Security
ALTER TABLE public.case_orchestration_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_orchestration_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    -- Service role full access
    DROP POLICY IF EXISTS "Service role full access on case_orchestration_runs" ON public.case_orchestration_runs;
    CREATE POLICY "Service role full access on case_orchestration_runs" ON public.case_orchestration_runs
        FOR ALL TO service_role USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Service role full access on case_orchestration_events" ON public.case_orchestration_events;
    CREATE POLICY "Service role full access on case_orchestration_events" ON public.case_orchestration_events
        FOR ALL TO service_role USING (true) WITH CHECK (true);

    -- Authenticated Clinicians access
    DROP POLICY IF EXISTS "Authenticated users view case_orchestration_runs" ON public.case_orchestration_runs;
    CREATE POLICY "Authenticated users view case_orchestration_runs" ON public.case_orchestration_runs
        FOR SELECT TO authenticated USING (true);

    DROP POLICY IF EXISTS "Authenticated users insert case_orchestration_runs" ON public.case_orchestration_runs;
    CREATE POLICY "Authenticated users insert case_orchestration_runs" ON public.case_orchestration_runs
        FOR INSERT TO authenticated WITH CHECK (true);

    DROP POLICY IF EXISTS "Authenticated users update case_orchestration_runs" ON public.case_orchestration_runs;
    CREATE POLICY "Authenticated users update case_orchestration_runs" ON public.case_orchestration_runs
        FOR UPDATE TO authenticated USING (true);

    DROP POLICY IF EXISTS "Authenticated users view case_orchestration_events" ON public.case_orchestration_events;
    CREATE POLICY "Authenticated users view case_orchestration_events" ON public.case_orchestration_events
        FOR SELECT TO authenticated USING (true);

    DROP POLICY IF EXISTS "Authenticated users insert case_orchestration_events" ON public.case_orchestration_events;
    CREATE POLICY "Authenticated users insert case_orchestration_events" ON public.case_orchestration_events
        FOR INSERT TO authenticated WITH CHECK (true);
END $$;
