-- ==============================================================================
-- MediFusion AI — Phase 9: Patient-Centric RAG & Clinical Knowledge Store
-- ==============================================================================

-- 1. Ensure vector extension is enabled and in search path
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;
SET search_path TO public, extensions;

-- 2. Patient Knowledge Chunks Table
CREATE TABLE IF NOT EXISTS public.patient_knowledge_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE,
    case_id UUID REFERENCES public.patient_cases(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    clean_content TEXT,
    embedding vector(384),
    
    -- Mandatory metadata preserving provenance & temporal context
    document_type TEXT NOT NULL, -- 'discharge_summary', 'radiology_report', 'clinical_note', 'lab_report', 'prescription'
    event_date DATE NOT NULL DEFAULT CURRENT_DATE,
    page_number INTEGER NOT NULL DEFAULT 1,
    domain TEXT NOT NULL DEFAULT 'clinical', -- 'cardiology', 'pulmonology', 'radiology', 'oncology', 'general'
    filename TEXT NOT NULL,
    chunk_index INTEGER NOT NULL DEFAULT 0,
    source_path TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_pkc_patient_id ON public.patient_knowledge_chunks(patient_id);
CREATE INDEX IF NOT EXISTS idx_pkc_document_id ON public.patient_knowledge_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_pkc_case_id ON public.patient_knowledge_chunks(case_id);
CREATE INDEX IF NOT EXISTS idx_pkc_document_type ON public.patient_knowledge_chunks(document_type);
CREATE INDEX IF NOT EXISTS idx_pkc_event_date ON public.patient_knowledge_chunks(event_date);
CREATE INDEX IF NOT EXISTS idx_pkc_domain ON public.patient_knowledge_chunks(domain);

-- Vector HNSW index for fast cosine distance search
CREATE INDEX IF NOT EXISTS idx_pkc_embedding_hnsw 
    ON public.patient_knowledge_chunks 
    USING hnsw (embedding vector_cosine_ops);

-- 4. Row Level Security
ALTER TABLE public.patient_knowledge_chunks ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Service role full access on patient_knowledge_chunks" ON public.patient_knowledge_chunks;
    CREATE POLICY "Service role full access on patient_knowledge_chunks" ON public.patient_knowledge_chunks
        FOR ALL TO service_role USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Clinicians can view patient_knowledge_chunks" ON public.patient_knowledge_chunks;
    CREATE POLICY "Clinicians can view patient_knowledge_chunks" ON public.patient_knowledge_chunks
        FOR SELECT TO authenticated USING (true);

    DROP POLICY IF EXISTS "Clinicians can insert patient_knowledge_chunks" ON public.patient_knowledge_chunks;
    CREATE POLICY "Clinicians can insert patient_knowledge_chunks" ON public.patient_knowledge_chunks
        FOR INSERT TO authenticated WITH CHECK (true);

    DROP POLICY IF EXISTS "Clinicians can delete patient_knowledge_chunks" ON public.patient_knowledge_chunks;
    CREATE POLICY "Clinicians can delete patient_knowledge_chunks" ON public.patient_knowledge_chunks
        FOR DELETE TO authenticated USING (true);
END $$;

-- 5. RPC Function: Patient-Scoped Evidence Retrieval
-- CRITICAL SECURITY: Patient isolation is enforced at the database level.
CREATE OR REPLACE FUNCTION public.match_patient_evidence(
    p_patient_id UUID,
    query_embedding extensions.vector(384),
    match_threshold FLOAT DEFAULT 0.0,
    match_count INT DEFAULT 10,
    p_case_id UUID DEFAULT NULL,
    p_domain TEXT DEFAULT NULL,
    p_document_type TEXT DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    patient_id UUID,
    document_id UUID,
    case_id UUID,
    content TEXT,
    clean_content TEXT,
    document_type TEXT,
    event_date DATE,
    page_number INT,
    domain TEXT,
    filename TEXT,
    chunk_index INT,
    source_path TEXT,
    metadata JSONB,
    similarity FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Server-side patient isolation enforcement: p_patient_id is MANDATORY and strictly filtered
    IF p_patient_id IS NULL THEN
        RAISE EXCEPTION 'CRITICAL SECURITY: patient_id is strictly required for patient-scoped evidence retrieval';
    END IF;

    RETURN QUERY
    SELECT
        c.id,
        c.patient_id,
        c.document_id,
        c.case_id,
        c.content,
        c.clean_content,
        c.document_type,
        c.event_date,
        c.page_number,
        c.domain,
        c.filename,
        c.chunk_index,
        c.source_path,
        c.metadata,
        (1 - (c.embedding <=> query_embedding))::FLOAT AS similarity
    FROM public.patient_knowledge_chunks c
    WHERE c.patient_id = p_patient_id
      AND (p_case_id IS NULL OR c.case_id = p_case_id)
      AND (p_domain IS NULL OR c.domain = p_domain)
      AND (p_document_type IS NULL OR c.document_type = p_document_type)
      AND (1 - (c.embedding <=> query_embedding)) >= match_threshold
    ORDER BY c.embedding <=> query_embedding ASC
    LIMIT match_count;
END;
$$;
