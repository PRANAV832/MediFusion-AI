-- ==============================================================================
-- MediFusion AI — Phase 1: Core Schema & Row Level Security
-- ==============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. PROFILES
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    role TEXT NOT NULL DEFAULT 'clinician',
    organization TEXT DEFAULT 'MediFusion Health System',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. PATIENTS
CREATE TABLE IF NOT EXISTS public.patients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mrn TEXT UNIQUE NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    date_of_birth DATE NOT NULL,
    gender TEXT NOT NULL,
    blood_type TEXT,
    allergies TEXT[] DEFAULT ARRAY[]::TEXT[],
    chronic_conditions TEXT[] DEFAULT ARRAY[]::TEXT[],
    assigned_clinician_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. PATIENT CASES
CREATE TABLE IF NOT EXISTS public.patient_cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    case_number TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    chief_complaint TEXT NOT NULL,
    symptoms TEXT[] DEFAULT ARRAY[]::TEXT[],
    clinical_notes TEXT,
    status TEXT NOT NULL DEFAULT 'draft',
    priority TEXT NOT NULL DEFAULT 'routine',
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. CLINICAL EVENTS (Longitudinal Timeline)
CREATE TABLE IF NOT EXISTS public.clinical_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    case_id UUID REFERENCES public.patient_cases(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL,
    event_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    summary TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::JSONB,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. MEDICAL ASSETS
CREATE TABLE IF NOT EXISTS public.medical_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    case_id UUID NOT NULL REFERENCES public.patient_cases(id) ON DELETE CASCADE,
    modality TEXT NOT NULL,
    filename TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size_bytes BIGINT NOT NULL,
    metadata JSONB DEFAULT '{}'::JSONB,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- INDEXES
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_patients_mrn ON public.patients(mrn);
CREATE INDEX IF NOT EXISTS idx_patients_assigned ON public.patients(assigned_clinician_id);
CREATE INDEX IF NOT EXISTS idx_cases_patient ON public.patient_cases(patient_id);
CREATE INDEX IF NOT EXISTS idx_cases_status ON public.patient_cases(status);
CREATE INDEX IF NOT EXISTS idx_events_patient ON public.clinical_events(patient_id);
CREATE INDEX IF NOT EXISTS idx_events_date ON public.clinical_events(event_date);
CREATE INDEX IF NOT EXISTS idx_assets_patient ON public.medical_assets(patient_id);
CREATE INDEX IF NOT EXISTS idx_assets_case ON public.medical_assets(case_id);
CREATE INDEX IF NOT EXISTS idx_assets_modality ON public.medical_assets(modality);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ==============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinical_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_assets ENABLE ROW LEVEL SECURITY;

-- Service role bypass policies for backend execution
DO $$
BEGIN
    DROP POLICY IF EXISTS "Service role full access on profiles" ON public.profiles;
    CREATE POLICY "Service role full access on profiles" ON public.profiles
        FOR ALL TO service_role USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Service role full access on patients" ON public.patients;
    CREATE POLICY "Service role full access on patients" ON public.patients
        FOR ALL TO service_role USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Service role full access on cases" ON public.patient_cases;
    CREATE POLICY "Service role full access on cases" ON public.patient_cases
        FOR ALL TO service_role USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Service role full access on events" ON public.clinical_events;
    CREATE POLICY "Service role full access on events" ON public.clinical_events
        FOR ALL TO service_role USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Service role full access on assets" ON public.medical_assets;
    CREATE POLICY "Service role full access on assets" ON public.medical_assets
        FOR ALL TO service_role USING (true) WITH CHECK (true);
END $$;

-- Authenticated user policies
DO $$
BEGIN
    -- Profiles: Users can view all clinician profiles, but only update their own
    DROP POLICY IF EXISTS "Users can read profiles" ON public.profiles;
    CREATE POLICY "Users can read profiles" ON public.profiles
        FOR SELECT TO authenticated USING (true);

    DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
    CREATE POLICY "Users can update own profile" ON public.profiles
        FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

    DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
    CREATE POLICY "Users can insert own profile" ON public.profiles
        FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

    -- Patients: Authenticated clinicians can view and create patients
    DROP POLICY IF EXISTS "Clinicians can view patients" ON public.patients;
    CREATE POLICY "Clinicians can view patients" ON public.patients
        FOR SELECT TO authenticated USING (true);

    DROP POLICY IF EXISTS "Clinicians can create patients" ON public.patients;
    CREATE POLICY "Clinicians can create patients" ON public.patients
        FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by OR created_by IS NULL);

    DROP POLICY IF EXISTS "Clinicians can update patients" ON public.patients;
    CREATE POLICY "Clinicians can update patients" ON public.patients
        FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

    -- Patient Cases
    DROP POLICY IF EXISTS "Clinicians can view cases" ON public.patient_cases;
    CREATE POLICY "Clinicians can view cases" ON public.patient_cases
        FOR SELECT TO authenticated USING (true);

    DROP POLICY IF EXISTS "Clinicians can create cases" ON public.patient_cases;
    CREATE POLICY "Clinicians can create cases" ON public.patient_cases
        FOR INSERT TO authenticated WITH CHECK (true);

    DROP POLICY IF EXISTS "Clinicians can update cases" ON public.patient_cases;
    CREATE POLICY "Clinicians can update cases" ON public.patient_cases
        FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

    -- Clinical Events
    DROP POLICY IF EXISTS "Clinicians can view clinical events" ON public.clinical_events;
    CREATE POLICY "Clinicians can view clinical events" ON public.clinical_events
        FOR SELECT TO authenticated USING (true);

    DROP POLICY IF EXISTS "Clinicians can create clinical events" ON public.clinical_events;
    CREATE POLICY "Clinicians can create clinical events" ON public.clinical_events
        FOR INSERT TO authenticated WITH CHECK (true);

    -- Medical Assets
    DROP POLICY IF EXISTS "Clinicians can view medical assets" ON public.medical_assets;
    CREATE POLICY "Clinicians can view medical assets" ON public.medical_assets
        FOR SELECT TO authenticated USING (true);

    DROP POLICY IF EXISTS "Clinicians can create medical assets" ON public.medical_assets;
    CREATE POLICY "Clinicians can create medical assets" ON public.medical_assets
        FOR INSERT TO authenticated WITH CHECK (true);
END $$;

-- Automatic profile creation trigger when a user signs up via Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (
        new.id,
        new.email,
        COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
        COALESCE(new.raw_user_meta_data->>'role', 'clinician')
    )
    ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name);
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT OR UPDATE ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==============================================================================
-- STORAGE: Create private bucket for medical assets if not exists
-- ==============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'medical-assets',
    'medical-assets',
    false,
    52428800, -- 50MB
    ARRAY[
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/dicom',
        'application/pdf',
        'application/json',
        'text/plain'
    ]
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: authenticated users can access medical-assets bucket
DO $$
BEGIN
    DROP POLICY IF EXISTS "Authenticated users can read medical assets" ON storage.objects;
    CREATE POLICY "Authenticated users can read medical assets" ON storage.objects
        FOR SELECT TO authenticated USING (bucket_id = 'medical-assets');

    DROP POLICY IF EXISTS "Authenticated users can upload medical assets" ON storage.objects;
    CREATE POLICY "Authenticated users can upload medical assets" ON storage.objects
        FOR INSERT TO authenticated WITH CHECK (bucket_id = 'medical-assets');

    DROP POLICY IF EXISTS "Service role full access on storage" ON storage.objects;
    CREATE POLICY "Service role full access on storage" ON storage.objects
        FOR ALL TO service_role USING (bucket_id = 'medical-assets') WITH CHECK (bucket_id = 'medical-assets');
END $$;
