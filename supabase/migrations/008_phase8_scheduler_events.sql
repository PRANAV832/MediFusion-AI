-- 008_phase8_scheduler_events.sql
-- MediFusion AI: Phase 8 - Resource-Aware Scheduler Events & Metrics

CREATE TABLE IF NOT EXISTS public.scheduler_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL DEFAULT 'lifecycle_event',
    stage TEXT NOT NULL CHECK (stage IN ('SELECT', 'RESOURCE_CHECK', 'LOAD', 'INFER', 'PERSIST', 'CACHE', 'UNLOAD', 'ERROR')),
    model_id TEXT,
    capability_id TEXT,
    case_id UUID REFERENCES public.patient_cases(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'info' CHECK (status IN ('success', 'warning', 'error', 'info')),
    message TEXT NOT NULL,
    load_time_ms DOUBLE PRECISION,
    inference_time_ms DOUBLE PRECISION,
    memory_mb INTEGER,
    is_simulated BOOLEAN NOT NULL DEFAULT false,
    error_code TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_scheduler_events_stage ON public.scheduler_events(stage);
CREATE INDEX IF NOT EXISTS idx_scheduler_events_model_id ON public.scheduler_events(model_id);
CREATE INDEX IF NOT EXISTS idx_scheduler_events_case_id ON public.scheduler_events(case_id);
CREATE INDEX IF NOT EXISTS idx_scheduler_events_created_at ON public.scheduler_events(created_at DESC);

-- Enable RLS
ALTER TABLE public.scheduler_events ENABLE ROW LEVEL SECURITY;

-- Policies for Authenticated Clinicians
DROP POLICY IF EXISTS "Clinicians can view scheduler events" ON public.scheduler_events;
CREATE POLICY "Clinicians can view scheduler events"
    ON public.scheduler_events FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Clinicians can insert scheduler events" ON public.scheduler_events;
CREATE POLICY "Clinicians can insert scheduler events"
    ON public.scheduler_events FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Policy for Service Role Bypass
DROP POLICY IF EXISTS "Service role has full access to scheduler events" ON public.scheduler_events;
CREATE POLICY "Service role has full access to scheduler events"
    ON public.scheduler_events FOR ALL
    TO service_role
    USING (true);
