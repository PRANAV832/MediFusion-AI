# MediFusion AI — Complete Windows PC Run Guide

This guide contains the verified, step-by-step instructions to set up, configure, and run **MediFusion AI** on a Windows PC.

---

## 1. Prerequisites & Required Installations

Ensure the following tools are installed on your Windows system:

| Tool | Version Requirement | Verification Command (PowerShell) | Notes |
| :--- | :--- | :--- | :--- |
| **Python** | 3.10 – 3.14 | `python --version` | Ensure "Add Python to PATH" was checked during installation. |
| **Node.js** | 18.x or 20+ (LTS) | `node -v` | Bundles `npm` (`npm -v`). |
| **PowerShell** | 5.1 or PowerShell 7+ | `$PSVersionTable.PSVersion` | Default Windows shell. |
| **Git** *(Optional)* | Any modern version | `git --version` | For tracking revisions. |

### PowerShell Script Execution Policy
If PowerShell blocks virtual environment scripts (`Activate.ps1`), run this once as Administrator:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

---

## 2. Project Directory Structure

The project root is located at `d:\MediFusion`.

```
d:\MediFusion\
├── Backend\             # FastAPI Python backend service
│   ├── .venv\          # Python virtual environment
│   ├── app\            # Application source code
│   ├── tests\          # Automated test suite
│   ├── requirements.txt
│   ├── seed_demo.py    # Synthetic demo case generator
│   └── .env            # Backend environment variables
├── Frontend\            # React 19 + Vite + Tailwind CSS frontend
│   ├── src\            # React components and views
│   ├── package.json
│   └── .env            # Frontend environment variables
└── supabase\
    └── migrations\     # 13 SQL migration files (001 to 013)
```

---

## 3. Environment Variables & Supabase Configuration

Both the Backend and Frontend require configured `.env` files.

### A. Backend Configuration: `d:\MediFusion\Backend\.env`
Verify or create `d:\MediFusion\Backend\.env` with the following keys:

```dotenv
# Server Settings
ENVIRONMENT=development
DEBUG=true
PORT=8000
HOST=127.0.0.1
PROJECT_NAME="MediFusion AI Backend"
API_V1_STR=/api/v1
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173

# Supabase Credentials (Cloud or Self-Hosted)
SUPABASE_URL=https://<your-project-ref>.supabase.co
SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
DATABASE_URL=postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres

# Google Gemini Evidence Layer (Required for Phase 10 Synthesis)
GEMINI_API_KEY=<your-gemini-api-key>
GEMINI_MODEL=gemini-3.8-flash
```

> [!IMPORTANT]
> The `SUPABASE_SERVICE_ROLE_KEY` is required on the backend to bypass RLS for administrative indexing, asset storage management, and model execution ledger writes. Never expose this key in the frontend.

### B. Frontend Configuration: `d:\MediFusion\Frontend\.env`
Verify or create `d:\MediFusion\Frontend\.env`:

```dotenv
VITE_API_BASE_URL=http://127.0.0.1:8000
VITE_APP_NAME="MediFusion AI"
VITE_APP_DESCRIPTION="Multimodal Clinical Intelligence with Adaptive AI Orchestration"
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
```

### C. Storage Bucket Setup
MediFusion AI stores medical assets (DICOM/X-Rays, ECGs, PDF reports, clinical notes) in a Supabase Storage bucket named:
- **Bucket Name:** `medical-assets`
- **Visibility:** Private (Authenticated access only; backend generates 3600-second signed URLs).

If creating from scratch in the Supabase Dashboard:
1. Navigate to **Storage** → **New Bucket**.
2. Name the bucket `medical-assets` and keep it **Private**.

---

## 4. Install Dependencies

### Backend Dependencies (Python)

Open Windows PowerShell and run:

```powershell
# 1. Navigate to the Backend folder
cd d:\MediFusion\Backend

# 2. Create the virtual environment if it does not already exist
python -m venv .venv

# 3. Activate the virtual environment
.\.venv\Scripts\Activate.ps1

# 4. Upgrade pip and install all required packages
python -m pip install --upgrade pip
pip install -r requirements.txt
```

### Frontend Dependencies (Node.js)

Open a second Windows PowerShell window:

```powershell
# 1. Navigate to the Frontend folder
cd d:\MediFusion\Frontend

# 2. Install Node packages
npm install
```

---

## 5. Database Migrations

MediFusion AI includes 13 phase-specific SQL migrations in `supabase\migrations\`:
- `001_phase1_initial_schema.sql` (Profiles, Patients, Cases, Clinical Events)
- `002_phase2_documents_and_reports.sql` (Documents & Basic Reports)
- `003_phase3_storage_mimes.sql` (Medical Assets schema)
- `004_phase4_model_runs.sql` (Inference Runs & Findings)
- `005_phase5_model_registry.sql` (Model Registry catalog)
- `006_phase6_capabilities.sql` (Clinical Capabilities)
- `007_phase7_orchestration.sql` (Orchestration Plans)
- `008_phase8_scheduler_events.sql` (Scheduler Telemetry)
- `009_phase9_rag_knowledge.sql` (pgvector Patient Knowledge Chunks)
- `010_phase11_canonical_evidence.sql` (Canonical Evidence Items & DAG)
- `011_phase12_conflict_detection.sql` (Conflicts & Case Review Assessments)
- `012_phase13_orchestration_graph.sql` (Live Orchestration Runs & Event Streams)
- `013_phase15_screening_reports.sql` (Clinical Intelligence Screening Reports)

### Applying Migrations
- **If using Supabase Cloud:** Go to **SQL Editor** in your Supabase dashboard and run the `.sql` scripts in numerical order (`001` through `013`).
- **If already connected to existing database:** All 13 migrations are already applied and verified in the current workspace database.

---

## 6. How to Start the Application

You will need **two terminal windows** running simultaneously.

### Terminal 1: Backend API Server (FastAPI + Uvicorn)

Open **Terminal 1** (PowerShell):

```powershell
cd d:\MediFusion\Backend
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

*Expected output:*
```
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
INFO:     Started reloader process
INFO:     Application startup complete.
```

> [!CAUTION]
> Always execute the `uvicorn` command from the `d:\MediFusion\Backend` directory so Python correctly resolves module imports (`app.main`) and local `.env` settings.

---

### Terminal 2: Frontend Dev Server (Vite + React)

Open **Terminal 2** (PowerShell):

```powershell
cd d:\MediFusion\Frontend
npm run dev
```

*Expected output:*
```
  VITE v8.3.2  ready in 270 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

---

### Terminal 3 (Optional): Seed Verified Synthetic Demo Cases

To populate the database with complete, reproducible multimodal clinical cases (Case A: Multimodal, Case B: Resource-Constrained, Case C: Conflicting Evidence):

Open **Terminal 3** (PowerShell):

```powershell
cd d:\MediFusion\Backend
.\.venv\Scripts\python.exe seed_demo.py
```

*Expected output:*
```
============================================================
MediFusion AI — Seeding Synthetic Demo Cases (Phase 18)
============================================================
...
Successfully generated Case A, Case B, and Case C!
============================================================
```

---

## 7. URLs & Application Verification

Once both servers are running:

| Service | URL | Verification Check |
| :--- | :--- | :--- |
| **Frontend Workstation** | `http://localhost:5173` | Opens the MediFusion AI Clinical Workstation. |
| **Backend Health Check** | `http://127.0.0.1:8000/health` | Returns `{"status": "ok", "environment": "development", "version": "0.1.0"}`. |
| **Interactive API Docs** | `http://127.0.0.1:8000/docs` | Swagger UI documentation of all REST endpoints. |

### Sign In / Sign Up
- **Sign In:** Use your registered clinician email and password.
- **Sign Up:** Click "Sign Up" on the login screen to register a new clinical account (`Full Name`, `Email`, `Password`, and `Role`). New accounts are automatically assigned clinician access and provisioned in `profiles`.

---

## 8. AI Models & Gemini Configuration Status

### 1. Chest X-Ray Screening (TorchXRayVision DenseNet-121)
- **Status:** **Active & Verified** (`READY`)
- **Weights Location:** `%USERPROFILE%\.torchxrayvision\models_data\nih-pc-chex-mimic_ch-google-openi-kaggle-densenet121-d121-tw-lr001-rot45-tr15-sc15-seed0-best.pt`
- **Capabilities:** Analyzes PA/AP frontal chest radiographs across 18 pathology classes (Pneumonia, Lung Opacity, Effusion, Consolidation, Cardiomegaly, etc.) with operating thresholds and Grad-CAM heatmaps.
- **Weights Download:** Weights are pre-cached locally. If missing, the adapter automatically downloads the `.pt` file on first run.

### 2. Clinical Document RAG Embeddings (SentenceTransformers)
- **Status:** **Active & Verified** (`READY`)
- **Model:** `all-MiniLM-L6-v2` (384 dimensions)
- **Fallback:** Includes a built-in deterministic clinical feature hashing fallback if offline.

### 3. Gemini Evidence Synthesis Layer
- **Status:** Controlled by `GEMINI_API_KEY` in `Backend\.env`
- **Model:** `gemini-3.8-flash`
- **Function:** Drafts evidence synthesis notes, historical record summaries, and cross-modality comparison notes.
- **Requirement:** If `GEMINI_API_KEY` is not provided, other deterministic components (TorchXRayVision, Orchestrator DAG, Conflict Detection, Screening Reports) continue functioning normally, while the Gemini tab displays an `API_KEY_REQUIRED` status indicator.

### 4. Non-Configured Candidate Capabilities
Per system architecture, four specialized adapters are registered in the Model Registry with an intentional `NOT_CONFIGURED` status:
- Brain Tumor MRI (MONAI BraTS UNet)
- Brain Stroke CT (DenseNet-3D)
- Arrhythmia ECG (12-lead ResNet-1D)
- Skin Lesion Dermoscopy (ResNet-50)

The Intelligent Model Orchestrator dynamically detects missing weights for these capabilities and safely skips them in the execution DAG with documented clinical rationale.

---

## 9. Common Errors & Troubleshooting

### Error: `Supabase is not configured. Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.`
- **Cause:** Running `uvicorn` from `d:\MediFusion` instead of `d:\MediFusion\Backend`.
- **Fix:** `cd d:\MediFusion\Backend` before starting `uvicorn`.

### Error: `Execution of scripts is disabled on this system (PSSecurityException)`
- **Cause:** PowerShell execution policy prevents running `.venv\Scripts\Activate.ps1`.
- **Fix:** Run `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser` in PowerShell.

### Error: `Address already in use` (Port 8000 or 5173)
- **Cause:** A previous instance of the server is still running in the background.
- **Fix:** In PowerShell, find and terminate the process:
  ```powershell
  # Find processes using port 8000
  Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess | Stop-Process -Force

  # Find processes using port 5173
  Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess | Stop-Process -Force
  ```

### Error: `Validation error in request parameters or body`
- **Cause:** Calling the orchestration endpoint without an initialized `caseId` or sending unnormalized context.
- **Fix:** Already resolved in the codebase via flexible schema handling (`Union[str, List[str]]`), explicit `Body(default=None)`, and fallback fetching via `GET /plan`.

---

## 10. How to Stop the Application Safely

To shut down the platform:
1. In **Terminal 1** (Backend): Press `Ctrl + C`. Wait for `Application shutdown complete`.
2. In **Terminal 2** (Frontend): Press `Ctrl + C` and type `y` to confirm exiting Vite.
3. Close the browser tab.
