-- ==============================================================================
-- MediFusion AI — Phase 5: Database-backed Model Registry
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.model_registry (
    id TEXT PRIMARY KEY, -- Slug identifier like 'torchxrayvision-densenet121'
    name TEXT NOT NULL,
    version TEXT NOT NULL,
    domain TEXT NOT NULL, -- 'pulmonology', 'radiology', 'neurology', 'cardiology', 'dermatology'
    modality TEXT NOT NULL, -- 'chest_xray', 'mri', 'ct', 'ecg', 'skin_image'
    capabilities TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    framework TEXT NOT NULL, -- 'pytorch', 'torchxrayvision', 'onnx', 'tensorflow'
    artifact_source TEXT NOT NULL,
    parameter_count BIGINT NOT NULL DEFAULT 0,
    estimated_ram_mb INTEGER NOT NULL DEFAULT 512,
    estimated_vram_mb INTEGER NOT NULL DEFAULT 1024,
    expected_latency_ms INTEGER NOT NULL DEFAULT 350,
    device_support TEXT[] NOT NULL DEFAULT ARRAY['cpu']::TEXT[],
    status TEXT NOT NULL DEFAULT 'ready', -- 'ready', 'active', 'not_configured', 'model_unavailable', 'error', 'deprecated'
    provenance JSONB NOT NULL DEFAULT '{}'::JSONB,
    limitations TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    license TEXT NOT NULL,
    checksum TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_model_registry_modality ON public.model_registry(modality);
CREATE INDEX IF NOT EXISTS idx_model_registry_domain ON public.model_registry(domain);
CREATE INDEX IF NOT EXISTS idx_model_registry_status ON public.model_registry(status);

-- ROW LEVEL SECURITY
ALTER TABLE public.model_registry ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Service role full access on model_registry" ON public.model_registry;
    CREATE POLICY "Service role full access on model_registry" ON public.model_registry
        FOR ALL TO service_role USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Authenticated clinicians can view model_registry" ON public.model_registry;
    CREATE POLICY "Authenticated clinicians can view model_registry" ON public.model_registry
        FOR SELECT TO authenticated USING (true);

    DROP POLICY IF EXISTS "Authenticated clinicians can register models" ON public.model_registry;
    CREATE POLICY "Authenticated clinicians can register models" ON public.model_registry
        FOR INSERT TO authenticated WITH CHECK (true);

    DROP POLICY IF EXISTS "Authenticated clinicians can update models" ON public.model_registry;
    CREATE POLICY "Authenticated clinicians can update models" ON public.model_registry
        FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
END $$;

-- SEED DATA: Registered Specialized Models
INSERT INTO public.model_registry (
    id,
    name,
    version,
    domain,
    modality,
    capabilities,
    framework,
    artifact_source,
    parameter_count,
    estimated_ram_mb,
    estimated_vram_mb,
    expected_latency_ms,
    device_support,
    status,
    provenance,
    limitations,
    license,
    checksum,
    metadata
) VALUES
(
    'torchxrayvision-densenet121',
    'DenseNet-121 Frontal Chest Radiography Classifier',
    'densenet121-res224-all',
    'pulmonology',
    'chest_xray',
    ARRAY['chest_xray_screening', 'pneumonia_detection', 'lung_abnormality_screening']::TEXT[],
    'torchxrayvision',
    'https://github.com/mlmed/torchxrayvision/releases/download/v1/nih-pc-chex-mimic_ch-google-openi-kaggle-densenet121-d121-tw-lr001-rot45-tr15-sc15-seed0-best.pt',
    7035922,
    512,
    1024,
    350,
    ARRAY['cpu', 'cuda']::TEXT[],
    'ready',
    '{
        "author": "Joseph Paul Cohen et al.",
        "citation": "Cohen et al. TorchXRayVision: A library of chest X-ray datasets and models. MIDL 2022. arXiv:2002.02497",
        "training_datasets": ["NIH ChestX-ray14", "PadChest (PC)", "CheXpert", "MIMIC-CXR", "Google Health OpenI", "RSNA Pneumonia Challenge"],
        "input_dimensions": "224x224x1",
        "normalization_range": "[-1024, 1024]"
    }'::JSONB,
    ARRAY[
        'Investigational Decision Support: Screening support only, not an autonomous diagnostic device.',
        'PA/AP Projection Requirement: Calibrated strictly on frontal chest views.',
        'Downsampled Spatial Resolution: Processed at 224x224 pixels, which may obscure subtle micro-nodules or fine non-displaced fractures.',
        'Pathology Scope: Evaluates 18 specific thoracic classes; unmodeled chest diseases or acute traumas are not evaluated.'
    ]::TEXT[],
    'Code: Apache 2.0; Weights: Academic/Research & Non-Commercial Clinical Evaluation',
    '56524913dd16a906422e8d8b66a7a5c46be1d82eb7ac012d8103776f1aa68899',
    '{
        "pathologies_count": 18,
        "input_channels": 1,
        "color_space": "grayscale"
    }'::JSONB
),
(
    'brain-tumor-mri-seg',
    'BraTS Neuro-Oncology Tumor Segmentation Net',
    'brats-2023-v1',
    'neurology',
    'mri',
    ARRAY['brain_tumor_segmentation', 'edema_quantification']::TEXT[],
    'pytorch',
    'https://huggingface.co/models/medifusion/brats2023-unet',
    18450000,
    2048,
    4096,
    850,
    ARRAY['cpu', 'cuda']::TEXT[],
    'not_configured',
    '{
        "author": "BraTS Consortium",
        "citation": "Bakas et al. Advancing The Cancer Genome Atlas glioma analysis with multi-modal brain tumor segmentation. Scientific Data 2017.",
        "training_datasets": ["BraTS 2023 Challenge Dataset"]
    }'::JSONB,
    ARRAY[
        'Requires 4 structural MRI sequences (T1, T1Gd, T2, FLAIR).',
        'Not configured: Model weights and dependencies require registration in Phase 6.'
    ]::TEXT[],
    'CC BY-NC-SA 4.0',
    NULL,
    '{"modality_sequence": ["T1", "T1Gd", "T2", "FLAIR"]}'::JSONB
),
(
    'stroke-ct-ischemia',
    'ASPECTS Ischemic Stroke & Hemorrhage Detector',
    'aspects-ct-v2',
    'neurology',
    'ct',
    ARRAY['stroke_abnormality', 'intracranial_hemorrhage']::TEXT[],
    'pytorch',
    'https://huggingface.co/models/medifusion/aspects-ct',
    24100000,
    1536,
    4096,
    620,
    ARRAY['cpu', 'cuda']::TEXT[],
    'not_configured',
    '{
        "author": "RSNA Stroke AI Working Group",
        "training_datasets": ["RSNA Intracranial Hemorrhage Dataset", "CQ500"]
    }'::JSONB,
    ARRAY[
        'Non-contrast head CT required within 6 hours of symptom onset.',
        'Not configured: Model weights and dependencies require registration in Phase 6.'
    ]::TEXT[],
    'Apache 2.0',
    NULL,
    '{"slice_thickness_max_mm": 5.0}'::JSONB
),
(
    'ecg-arrhythmia-ptbxl',
    '12-Lead ECG Arrhythmia ResNet-1D',
    'ptbxl-resnet1d-v1',
    'cardiology',
    'ecg',
    ARRAY['arrhythmia_screening', 'st_elevation_detection']::TEXT[],
    'pytorch',
    'https://physionet.org/content/ptb-xl/1.0.3/',
    4200000,
    256,
    512,
    120,
    ARRAY['cpu', 'cuda']::TEXT[],
    'not_configured',
    '{
        "author": "Wagner et al.",
        "citation": "PTB-XL, a large publicly available electrocardiography dataset. Scientific Data 2020.",
        "training_datasets": ["PTB-XL 12-lead ECG Dataset"]
    }'::JSONB,
    ARRAY[
        'Requires standard 12-lead 10-second ECG recording at >= 500 Hz.',
        'Not configured: Model weights and dependencies require registration in Phase 6.'
    ]::TEXT[],
    'PhysioNet Credentialed Health Data License',
    NULL,
    '{"leads": 12, "sample_rate_hz": 500}'::JSONB
),
(
    'isic-skin-lesion-effnet',
    'ISIC Melanoma & Skin Lesion EfficientNet-B4',
    'isic-effnet-b4-v1',
    'dermatology',
    'skin_image',
    ARRAY['skin_lesion_screening', 'melanoma_risk_stratification']::TEXT[],
    'pytorch',
    'https://challenge.isic-archive.com/',
    19300000,
    512,
    1024,
    220,
    ARRAY['cpu', 'cuda']::TEXT[],
    'not_configured',
    '{
        "author": "International Skin Imaging Collaboration (ISIC)",
        "citation": "Rotemberg et al. A patient-centric dataset of images and metadata for identifying melanomas. Nature Scientific Data 2021.",
        "training_datasets": ["ISIC 2020 Archive"]
    }'::JSONB,
    ARRAY[
        'Calibrated for dermoscopic photography only; clinical macro-photos yield reduced specificity.',
        'Not configured: Model weights and dependencies require registration in Phase 6.'
    ]::TEXT[],
    'CC BY-NC 4.0',
    NULL,
    '{"dermoscopy_standard": true}'::JSONB
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    version = EXCLUDED.version,
    domain = EXCLUDED.domain,
    modality = EXCLUDED.modality,
    capabilities = EXCLUDED.capabilities,
    framework = EXCLUDED.framework,
    artifact_source = EXCLUDED.artifact_source,
    parameter_count = EXCLUDED.parameter_count,
    estimated_ram_mb = EXCLUDED.estimated_ram_mb,
    estimated_vram_mb = EXCLUDED.estimated_vram_mb,
    expected_latency_ms = EXCLUDED.expected_latency_ms,
    device_support = EXCLUDED.device_support,
    status = EXCLUDED.status,
    provenance = EXCLUDED.provenance,
    limitations = EXCLUDED.limitations,
    license = EXCLUDED.license,
    checksum = EXCLUDED.checksum,
    metadata = EXCLUDED.metadata,
    updated_at = NOW();
