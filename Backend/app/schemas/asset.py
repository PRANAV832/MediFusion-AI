from datetime import datetime
from enum import Enum
from typing import Any, Dict, Optional
from pydantic import BaseModel, Field


class ModalityEnum(str, Enum):
    MRI = "mri"
    CT = "ct"
    CHEST_XRAY = "chest_xray"
    ECG = "ecg"
    SKIN_IMAGE = "skin_image"
    PDF_REPORT = "pdf_report"
    PRESCRIPTION = "prescription"
    CLINICAL_NOTE = "clinical_note"


# Mapping modality to acceptable MIME types and file extensions
ALLOWED_MIME_TYPES = {
    ModalityEnum.MRI: {
        "application/dicom",
        "image/png",
        "image/jpeg",
        "application/octet-stream",
        "application/x-nifti",
        "application/gzip",
    },
    ModalityEnum.CT: {
        "application/dicom",
        "image/png",
        "image/jpeg",
        "application/octet-stream",
    },
    ModalityEnum.CHEST_XRAY: {
        "image/png",
        "image/jpeg",
        "application/dicom",
        "application/octet-stream",
    },
    ModalityEnum.ECG: {
        "text/csv",
        "application/json",
        "text/plain",
        "application/pdf",
        "image/png",
        "image/jpeg",
        "application/xml",
        "text/xml",
        "application/octet-stream",
    },
    ModalityEnum.SKIN_IMAGE: {
        "image/png",
        "image/jpeg",
        "image/webp",
    },
    ModalityEnum.PDF_REPORT: {
        "application/pdf",
    },
    ModalityEnum.PRESCRIPTION: {
        "application/pdf",
        "image/png",
        "image/jpeg",
        "text/plain",
    },
    ModalityEnum.CLINICAL_NOTE: {
        "text/plain",
        "application/pdf",
        "text/markdown",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    },
}

ALLOWED_EXTENSIONS = {
    ModalityEnum.MRI: {".dcm", ".nii", ".gz", ".png", ".jpg", ".jpeg"},
    ModalityEnum.CT: {".dcm", ".png", ".jpg", ".jpeg"},
    ModalityEnum.CHEST_XRAY: {".png", ".jpg", ".jpeg", ".dcm"},
    ModalityEnum.ECG: {".csv", ".json", ".txt", ".pdf", ".png", ".jpg", ".xml", ".dat"},
    ModalityEnum.SKIN_IMAGE: {".png", ".jpg", ".jpeg", ".webp"},
    ModalityEnum.PDF_REPORT: {".pdf"},
    ModalityEnum.PRESCRIPTION: {".pdf", ".png", ".jpg", ".jpeg", ".txt"},
    ModalityEnum.CLINICAL_NOTE: {".txt", ".pdf", ".md", ".doc", ".docx"},
}


class MedicalAssetResponse(BaseModel):
    id: str
    patient_id: str
    case_id: str
    modality: str
    filename: str
    storage_path: str
    mime_type: str
    size_bytes: int
    metadata: Dict[str, Any] = Field(default_factory=dict)
    created_by: Optional[str] = None
    created_at: datetime
    signed_url: Optional[str] = None


class AssetSignedUrlResponse(BaseModel):
    asset_id: str
    filename: str
    signed_url: str
    expires_in_seconds: int
