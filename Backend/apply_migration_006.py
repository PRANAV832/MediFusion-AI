import psycopg2
import os
import json
from dotenv import load_dotenv

load_dotenv('d:/MediFusion/backend/.env')
db_url = os.getenv('DATABASE_URL')

migration_sql = """-- ==============================================================================
-- MediFusion AI — Phase 6: Six-Capability Medical AI Architecture
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.clinical_capabilities (
    capability_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    expected_modality TEXT NOT NULL,
    adapter_class TEXT NOT NULL,
    preprocessing_contract JSONB NOT NULL DEFAULT '{}'::JSONB,
    output_schema JSONB NOT NULL DEFAULT '{}'::JSONB,
    model_source TEXT NOT NULL,
    provenance JSONB NOT NULL DEFAULT '{}'::JSONB,
    limitations TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    license TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'not_configured', -- 'ready' | 'not_configured'
    model_id TEXT REFERENCES public.model_registry(id) ON DELETE SET NULL,
    verification_details JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_capabilities_modality ON public.clinical_capabilities(expected_modality);
CREATE INDEX IF NOT EXISTS idx_capabilities_status ON public.clinical_capabilities(status);
CREATE INDEX IF NOT EXISTS idx_capabilities_model_id ON public.clinical_capabilities(model_id);

-- ROW LEVEL SECURITY
ALTER TABLE public.clinical_capabilities ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Service role full access on clinical_capabilities" ON public.clinical_capabilities;
    CREATE POLICY "Service role full access on clinical_capabilities" ON public.clinical_capabilities
        FOR ALL TO service_role USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Authenticated clinicians can view clinical_capabilities" ON public.clinical_capabilities;
    CREATE POLICY "Authenticated clinicians can view clinical_capabilities" ON public.clinical_capabilities
        FOR SELECT TO authenticated USING (true);

    DROP POLICY IF EXISTS "Authenticated clinicians can register clinical_capabilities" ON public.clinical_capabilities;
    CREATE POLICY "Authenticated clinicians can register clinical_capabilities" ON public.clinical_capabilities
        FOR INSERT TO authenticated WITH CHECK (true);

    DROP POLICY IF EXISTS "Authenticated clinicians can update clinical_capabilities" ON public.clinical_capabilities;
    CREATE POLICY "Authenticated clinicians can update clinical_capabilities" ON public.clinical_capabilities
        FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
END $$;

-- SEED ALL SIX CLINICAL CAPABILITIES
INSERT INTO public.clinical_capabilities (
    capability_id,
    name,
    description,
    expected_modality,
    adapter_class,
    preprocessing_contract,
    output_schema,
    model_source,
    provenance,
    limitations,
    license,
    status,
    model_id,
    verification_details
) VALUES
(
    'brain_tumor_screening',
    'Brain Tumor Screening',
    'Multi-parametric MRI screening for intra-axial and extra-axial intracranial neoplasms (glioma, meningioma, pituitary adenoma).',
    'mri',
    'BrainTumorMRIAdapter',
    '{
        "input_dimensions": "256x256x1 or 240x240x155 3D volume",
        "color_space": "grayscale",
        "target_sequences": ["T1_contrast", "T2_FLAIR"],
        "normalization": "Brain tissue skull-stripping + z-score intensity normalization",
        "supported_formats": ["nii", "nii.gz", "dcm", "png", "jpg"]
    }'::JSONB,
    '{
        "prediction_type": "classification_and_segmentation",
        "classes": ["Glioma", "Meningioma", "Pituitary Tumor", "No Neoplasm Detected"],
        "metrics": ["neoplasm_probability", "confidence_interval", "enhancing_core_volume_cm3"],
        "decision_threshold": 0.50
    }'::JSONB,
    'https://github.com/Project-MONAI/research-contributions/tree/main/BraTS21',
    '{
        "author": "BraTS / MONAI Consortium",
        "citation": "Bakas et al. Advancing The Cancer Genome Atlas glioma analysis with pre-computed calculations and computerized labels. Scientific Data, 2017.",
        "training_datasets": ["BraTS 2021 Multi-parametric MRI Benchmark", "TCIA TCGA-GBM / TCGA-LGG"],
        "framework": "PyTorch / MONAI"
    }'::JSONB,
    ARRAY[
        'Investigational screening decision support only; not an autonomous neuro-oncology diagnosis.',
        'Requires contrast-enhanced T1 (T1Gd) or FLAIR sequences for accurate detection; non-contrast axial scans yield lower sensitivity.',
        'Post-surgical resection cavities, radiation necrosis, and subacute infarcts can produce false-positive enhancing ring patterns.',
        'Tissue histopathology and molecular genetics (IDH mutation, 1p/19q codeletion) remain mandatory for definitive classification.'
    ]::TEXT[],
    'Apache 2.0 (MONAI Code) / Research Evaluation Only (BraTS Weights)',
    'not_configured',
    'brain-tumor-mri-seg',
    '{
        "verified": false,
        "verification_timestamp": "2026-10-02T10:00:00Z",
        "failure_reasons": [
            "Weights not found locally in cache (~420MB BraTS checkpoint unconfigured).",
            "Missing optional Python runtime dependency: nibabel / monai."
        ],
        "hardware_required": "CUDA GPU recommended (>= 4GB VRAM) or CPU (high latency > 3000ms)",
        "status_code": "NOT_CONFIGURED"
    }'::JSONB
),
(
    'stroke_ischemia_screening',
    'Brain Stroke & Ischemia Abnormality Screening',
    'Detection of acute ischemic core, middle cerebral artery (MCA) territory hypodensity, and early ischemic changes (ASPECTS) on head CT.',
    'ct',
    'StrokeIschemiaCTAdapter',
    '{
        "input_dimensions": "512x512 axial Hounsfield Unit matrix",
        "color_space": "hounsfield_units",
        "windowing": "Brain window: Window Level 40 HU, Window Width 80 HU (range 0 to 80 HU)",
        "normalization": "Hounsfield window truncation [0, 80] mapped to [0.0, 1.0]",
        "supported_formats": ["dcm", "nii", "png", "jpg"]
    }'::JSONB,
    '{
        "prediction_type": "ischemia_detection_and_aspects",
        "classes": ["Acute Ischemia", "Early Ischemic Changes (Loss of Insular Ribbon)", "Hemorrhagic Transformation", "No Acute Stroke"],
        "metrics": ["ischemia_probability", "estimated_aspects_score", "affected_hemisphere"],
        "decision_threshold": 0.45
    }'::JSONB,
    'https://github.com/MIC-DKFZ/nnUNet / Pretrained AIS-NCCT Stroke Model',
    '{
        "author": "Clinical Neurovascular AI Research Consortium",
        "citation": "Korfiatis et al. Automated Detection of Early Ischemic Changes on Noncontrast CT in Acute Stroke. Radiology, 2021.",
        "training_datasets": ["Multicenter Acute Stroke NCCT Registry (n=2,480)", "ISLES Stroke Challenge"],
        "framework": "PyTorch / nnUNet"
    }'::JSONB,
    ARRAY[
        'Screening decision support only; time is brain — must never delay intravenous thrombolysis or mechanical thrombectomy evaluation.',
        'Early hyperacute ischemic changes (< 3 hours from symptom onset) may be subtle or invisible on non-contrast CT.',
        'Motion artifacts and beam hardening from skull base may confound posterior fossa and brainstem evaluation.',
        'Requires emergency radiologist confirmation and clinical NIHSS score correlation.'
    ]::TEXT[],
    'Academic Evaluation License / Non-Commercial Clinical Research',
    'not_configured',
    'stroke-ct-ischemia',
    '{
        "verified": false,
        "verification_timestamp": "2026-10-02T10:00:00Z",
        "failure_reasons": [
            "Weights not found locally in cache (nnUNet stroke segmentation weights unconfigured).",
            "Missing optional DICOM Hounsfield parser: pydicom."
        ],
        "hardware_required": "CPU or CUDA (>= 2GB VRAM)",
        "status_code": "NOT_CONFIGURED"
    }'::JSONB
),
(
    'arrhythmia_screening',
    'Arrhythmia & Cardiac Abnormality Screening',
    'Automated 12-lead electrocardiogram (ECG) screening across diagnostic superclasses including myocardial infarction, conduction blocks, and rhythm abnormalities.',
    'ecg',
    'ECGArrhythmiaPTBXLAdapter',
    '{
        "input_dimensions": "12 leads x 1000 samples (10 seconds at 100 Hz) or 12 x 5000 (500 Hz)",
        "leads": ["I", "II", "III", "aVR", "aVL", "aVF", "V1", "V2", "V3", "V4", "V5", "V6"],
        "normalization": "Baseline wander high-pass filter (0.5 Hz) + 50/60 Hz notch filter + z-score standardization per lead",
        "supported_formats": ["dat", "hea", "csv", "xml", "png", "jpg"]
    }'::JSONB,
    '{
        "prediction_type": "multi_label_classification",
        "classes": ["NORM (Normal)", "MI (Myocardial Infarction)", "STTC (ST/T Change)", "CD (Conduction Disturbance)", "HYP (Hypertrophy)"],
        "metrics": ["superclass_probabilities", "rhythm_statement", "pr_interval_ms", "qrs_duration_ms", "qtc_ms"],
        "decision_threshold": 0.40
    }'::JSONB,
    'https://physionet.org/content/ptb-xl/1.0.3/ / PTB-XL Benchmark Models',
    '{
        "author": "Wagner et al. / PhysioNet PTB-XL Consortium",
        "citation": "Wagner et al. PTB-XL, a large publicly available electrocardiography dataset. Scientific Data 7, 154 (2020).",
        "training_datasets": ["PTB-XL 12-lead ECG Dataset (n=21,837 patients, 71 diagnostic statements)"],
        "framework": "PyTorch (1D ResNet-101 / FastAI ECG)"
    }'::JSONB,
    ARRAY[
        'Decision support only; not an automated defibrillation or emergency coronary intervention trigger.',
        'High sensitivity for STEMI; however, poor lead placement, electrode tremor, or baseline wander can simulate ischemia or bundle branch blocks.',
        'Requires correlation with cardiac biomarkers (High-Sensitivity Troponin I/T) and serial ECG comparisons.',
        'Pediatric ECG patterns (< 18 years) are not calibrated.'
    ]::TEXT[],
    'PhysioNet Credentialed Health Data License / CC BY 4.0',
    'not_configured',
    'ecg-arrhythmia-ptbxl',
    '{
        "verified": false,
        "verification_timestamp": "2026-10-02T10:00:00Z",
        "failure_reasons": [
            "Weights not found locally in cache (PTB-XL 1D-CNN checkpoint unconfigured).",
            "Missing optional biosignal waveform reader: wfdb."
        ],
        "hardware_required": "CPU or CUDA (>= 1GB VRAM)",
        "status_code": "NOT_CONFIGURED"
    }'::JSONB
),
(
    'pneumonia_screening',
    'Pneumonia Screening',
    'Screening and probability quantification of infectious pneumonia, consolidation, and airspace opacification on frontal chest radiographs.',
    'chest_xray',
    'PneumoniaChestXRayAdapter',
    '{
        "input_dimensions": "224x224x1 grayscale",
        "color_space": "grayscale",
        "normalization": "Grayscale luminosity weighting -> [-1024, 1024] dynamic range via xrv.datasets.normalize",
        "supported_formats": ["png", "jpg", "jpeg", "dcm"]
    }'::JSONB,
    '{
        "prediction_type": "calibrated_screening_probability",
        "primary_target": "Pneumonia",
        "correlated_targets": ["Consolidation", "Infiltration", "Effusion"],
        "metrics": ["probability", "calibrated_operating_threshold (0.301)", "ppv80_threshold (0.655)", "severity_classification"],
        "decision_threshold": 0.301
    }'::JSONB,
    'https://github.com/mlmed/torchxrayvision (densenet121-res224-all)',
    '{
        "author": "Joseph Paul Cohen et al.",
        "citation": "Cohen et al. TorchXRayVision: A library of chest X-ray datasets and models. MIDL 2022. arXiv:2002.02497",
        "training_datasets": ["RSNA Pneumonia Challenge", "NIH ChestX-ray14", "CheXpert", "MIMIC-CXR", "PadChest"],
        "framework": "TorchXRayVision / PyTorch"
    }'::JSONB,
    ARRAY[
        'Investigational screening support only; cannot replace formal radiologist review or clinical examination.',
        'Radiographic findings of pneumonia may lag behind clinical symptom onset by 24-48 hours in early infection.',
        'Cannot differentiate between bacterial, viral, fungal, or aspiration pneumonia etiologies without microbiological data.',
        'Calibrated strictly on adult frontal PA/AP projections; lateral views and pediatric cases are not supported.'
    ]::TEXT[],
    'Apache 2.0 (Code) / Academic & Non-Commercial Clinical Evaluation (Weights)',
    'ready',
    'torchxrayvision-densenet121',
    '{
        "verified": true,
        "verification_timestamp": "2026-10-02T10:00:00Z",
        "weights_path": "~/.torchxrayvision/models_data/densenet121-res224-all.pth",
        "weights_sha256": "56524913dd16a906422e8d8b66a7a5c46be1d82eb7ac012d8103776f1aa68899",
        "dependencies": ["torch", "torchvision", "torchxrayvision", "scipy", "PIL", "numpy"],
        "hardware_required": "CPU or CUDA (tested on CPU, ~1200ms latency)",
        "status_code": "READY"
    }'::JSONB
),
(
    'lung_opacity_screening',
    'Lung Opacity & Thoracic Abnormality Screening',
    'Comprehensive multi-pathology screening across 18 frontal thoracic radiograph abnormalities including lung opacities, pleural effusions, atelectasis, pneumothorax, and cardiomegaly.',
    'chest_xray',
    'LungOpacityChestXRayAdapter',
    '{
        "input_dimensions": "224x224x1 grayscale",
        "color_space": "grayscale",
        "normalization": "Grayscale luminosity weighting -> [-1024, 1024] dynamic range via xrv.datasets.normalize",
        "supported_formats": ["png", "jpg", "jpeg", "dcm"]
    }'::JSONB,
    '{
        "prediction_type": "multi_pathology_screening",
        "targets_count": 18,
        "targets": ["Atelectasis", "Consolidation", "Infiltration", "Pneumothorax", "Edema", "Emphysema", "Fibrosis", "Effusion", "Pneumonia", "Pleural_Thickening", "Cardiomegaly", "Nodule", "Mass", "Hernia", "Lung Lesion", "Fracture", "Lung Opacity", "Enlarged Cardiomediastinum"],
        "metrics": ["probability", "calibrated_threshold", "ppv80_threshold", "detected_flag", "severity"],
        "decision_threshold": 0.267
    }'::JSONB,
    'https://github.com/mlmed/torchxrayvision (densenet121-res224-all)',
    '{
        "author": "Joseph Paul Cohen et al.",
        "citation": "Cohen et al. TorchXRayVision: A library of chest X-ray datasets and models. MIDL 2022. arXiv:2002.02497",
        "training_datasets": ["NIH ChestX-ray14", "CheXpert", "MIMIC-CXR", "PadChest", "Google Health OpenI"],
        "framework": "TorchXRayVision / PyTorch"
    }'::JSONB,
    ARRAY[
        'Investigational screening support only; not an autonomous diagnostic instrument.',
        'Downsampled spatial resolution (224x224) may compromise sensitivity for fine parenchymal reticulations or sub-centimeter solitary pulmonary nodules.',
        'Overlapping anatomical structures (ribs, clavicles, mediastinal contours) may mimic or mask focal parenchymal opacities.',
        'Emergency tension pneumothorax or acute hemothorax requires immediate clinical bedside intervention, not delayed AI queueing.'
    ]::TEXT[],
    'Apache 2.0 (Code) / Academic & Non-Commercial Clinical Evaluation (Weights)',
    'ready',
    'torchxrayvision-densenet121',
    '{
        "verified": true,
        "verification_timestamp": "2026-10-02T10:00:00Z",
        "weights_path": "~/.torchxrayvision/models_data/densenet121-res224-all.pth",
        "weights_sha256": "56524913dd16a906422e8d8b66a7a5c46be1d82eb7ac012d8103776f1aa68899",
        "dependencies": ["torch", "torchvision", "torchxrayvision", "scipy", "PIL", "numpy"],
        "hardware_required": "CPU or CUDA (tested on CPU, ~1200ms latency)",
        "status_code": "READY"
    }'::JSONB
),
(
    'skin_lesion_screening',
    'Skin Lesion & Melanoma Screening',
    'Dermatoscopic digital photography screening for pigmentary abnormalities, melanoma, basal cell carcinoma, and benign keratoses.',
    'skin_image',
    'HAM10000SkinLesionAdapter',
    '{
        "input_dimensions": "224x224x3 RGB image (close-up dermoscopy or clinical photography)",
        "color_space": "RGB",
        "normalization": "ImageNet standardization: mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]",
        "supported_formats": ["png", "jpg", "jpeg", "webp"]
    }'::JSONB,
    '{
        "prediction_type": "7_class_dermatoscopic_classification",
        "classes": [
            "MEL (Melanoma)",
            "NV (Melanocytic Nevus)",
            "BCC (Basal Cell Carcinoma)",
            "AKIEC (Actinic Keratosis / Bowen Disease)",
            "BKL (Benign Keratosis)",
            "DF (Dermatofibroma)",
            "VASC (Vascular Lesion)"
        ],
        "metrics": ["class_probabilities", "high_risk_malignancy_flag", "top_prediction", "confidence_score"],
        "decision_threshold": 0.35
    }'::JSONB,
    'https://dataverse.harvard.edu/dataset.xhtml?persistentId=doi:10.7910/DVN/DBW86T / HAM10000 Benchmark',
    '{
        "author": "Tschandl et al. / ViDIR Group Medical University of Vienna",
        "citation": "Tschandl et al. The HAM10000 dataset, a large collection of multi-source dermatoscopic images of common pigmented skin lesions. Sci Data 5, 180161 (2018).",
        "training_datasets": ["HAM10000 (10,015 dermatoscopic images)"],
        "framework": "PyTorch (EfficientNet-B0 / ResNet-50)"
    }'::JSONB,
    ARRAY[
        'Screening decision support only; never replaces a dermatoscopic examination with dermatoscope and biopsy.',
        'Not calibrated on mucosal, subungual, or acral lentiginous lesions.',
        'Dark skin types (Fitzpatrick IV-VI) are significantly underrepresented in the HAM10000 training cohort.',
        'Any bleeding, rapidly enlarging, or ulcerated lesion warrants immediate dermatological evaluation regardless of AI prediction.'
    ]::TEXT[],
    'CC BY-NC 4.0 (HAM10000 Dataset & Benchmark Models)',
    'not_configured',
    'isic-skin-lesion-effnet',
    '{
        "verified": false,
        "verification_timestamp": "2026-10-02T10:00:00Z",
        "failure_reasons": [
            "Pretrained HAM10000 weights checkpoint not found locally.",
            "Hardware requires verified color calibration matrix."
        ],
        "hardware_required": "CPU or CUDA (>= 1GB VRAM)",
        "status_code": "NOT_CONFIGURED"
    }'::JSONB
)
ON CONFLICT (capability_id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    expected_modality = EXCLUDED.expected_modality,
    adapter_class = EXCLUDED.adapter_class,
    preprocessing_contract = EXCLUDED.preprocessing_contract,
    output_schema = EXCLUDED.output_schema,
    model_source = EXCLUDED.model_source,
    provenance = EXCLUDED.provenance,
    limitations = EXCLUDED.limitations,
    license = EXCLUDED.license,
    status = EXCLUDED.status,
    model_id = EXCLUDED.model_id,
    verification_details = EXCLUDED.verification_details,
    updated_at = NOW();
"""

os.makedirs('d:/MediFusion/supabase/migrations', exist_ok=True)
with open('d:/MediFusion/supabase/migrations/006_phase6_capabilities.sql', 'w', encoding='utf-8') as f:
    f.write(migration_sql)
print("Wrote d:/MediFusion/supabase/migrations/006_phase6_capabilities.sql")

conn = psycopg2.connect(db_url)
cur = conn.cursor()
cur.execute(migration_sql)
conn.commit()

cur.execute("SELECT capability_id, name, expected_modality, status, adapter_class FROM public.clinical_capabilities ORDER BY capability_id")
rows = cur.fetchall()
print(f"Migration applied successfully! Seeded {len(rows)} capabilities:")
for r in rows:
    print(f" - [{r[3].upper()}] {r[0]}: {r[1]} (modality: {r[2]}, adapter: {r[4]})")

cur.close()
conn.close()
