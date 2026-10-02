-- 007_phase7_orchestration.sql
-- MediFusion AI: Phase 7 - Intelligent Model Orchestration Plans

CREATE TABLE IF NOT EXISTS public.orchestration_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES public.patient_cases(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'executing', 'completed', 'failed', 'superseded')),
    input_modalities JSONB NOT NULL DEFAULT '[]'::jsonb,
    symptoms_context TEXT,
    selected_models JSONB NOT NULL DEFAULT '[]'::jsonb,
    skipped_capabilities JSONB NOT NULL DEFAULT '[]'::jsonb,
    execution_order JSONB NOT NULL DEFAULT '[]'::jsonb,
    dag JSONB NOT NULL DEFAULT '{}'::jsonb,
    selection_reasons JSONB NOT NULL DEFAULT '{}'::jsonb,
    resource_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    summary TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_orchestration_plans_case_id ON public.orchestration_plans(case_id);
CREATE INDEX IF NOT EXISTS idx_orchestration_plans_patient_id ON public.orchestration_plans(patient_id);
CREATE INDEX IF NOT EXISTS idx_orchestration_plans_status ON public.orchestration_plans(status);
CREATE INDEX IF NOT EXISTS idx_orchestration_plans_created_at ON public.orchestration_plans(created_at DESC);

-- Enable RLS
ALTER TABLE public.orchestration_plans ENABLE ROW LEVEL SECURITY;

-- Policies for Authenticated Clinicians
DROP POLICY IF EXISTS "Clinicians can view orchestration plans" ON public.orchestration_plans;
CREATE POLICY "Clinicians can view orchestration plans"
    ON public.orchestration_plans FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Clinicians can insert orchestration plans" ON public.orchestration_plans;
CREATE POLICY "Clinicians can insert orchestration plans"
    ON public.orchestration_plans FOR INSERT
    TO authenticated
    WITH CHECK (true);

DROP POLICY IF EXISTS "Clinicians can update orchestration plans" ON public.orchestration_plans;
CREATE POLICY "Clinicians can update orchestration plans"
    ON public.orchestration_plans FOR UPDATE
    TO authenticated
    USING (true);

-- Policy for Service Role Bypass
DROP POLICY IF EXISTS "Service role has full access to orchestration plans" ON public.orchestration_plans;
CREATE POLICY "Service role has full access to orchestration plans"
    ON public.orchestration_plans FOR ALL
    TO service_role
    USING (true);
