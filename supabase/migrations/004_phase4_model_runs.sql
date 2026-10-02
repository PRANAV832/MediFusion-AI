-- ==============================================================================
-- MediFusion AI — Phase 4: Model Runs Persistence & Provenance
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.model_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES public.patient_cases(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    asset_id UUID NOT NULL REFERENCES public.medical_assets(id) ON DELETE CASCADE,
    model_id TEXT NOT NULL,
    model_version TEXT NOT NULL,
    capability TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'completed', -- 'completed', 'failed'
    findings JSONB NOT NULL DEFAULT '[]'::JSONB,
    scores JSONB NOT NULL DEFAULT '{}'::JSONB,
    runtime_ms DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    device TEXT NOT NULL DEFAULT 'cpu',
    provenance JSONB NOT NULL DEFAULT '{}'::JSONB,
    limitations JSONB NOT NULL DEFAULT '[]'::JSONB,
    error_message TEXT,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_model_runs_case ON public.model_runs(case_id);
CREATE INDEX IF NOT EXISTS idx_model_runs_patient ON public.model_runs(patient_id);
CREATE INDEX IF NOT EXISTS idx_model_runs_asset ON public.model_runs(asset_id);
CREATE INDEX IF NOT EXISTS idx_model_runs_capability ON public.model_runs(capability);

-- ROW LEVEL SECURITY
ALTER TABLE public.model_runs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Service role full access on model_runs" ON public.model_runs;
    CREATE POLICY "Service role full access on model_runs" ON public.model_runs
        FOR ALL TO service_role USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Clinicians can view model_runs" ON public.model_runs;
    CREATE POLICY "Clinicians can view model_runs" ON public.model_runs
        FOR SELECT TO authenticated USING (true);

    DROP POLICY IF EXISTS "Clinicians can insert model_runs" ON public.model_runs;
    CREATE POLICY "Clinicians can insert model_runs" ON public.model_runs
        FOR INSERT TO authenticated WITH CHECK (true);
END $$;
