"""
Tests for MediFusion AI Phase 16 Advanced Clinical Features:
1. Temporal RAG (timeline-aware current vs historical evidence)
2. Model Council (deliberation for ambiguous cases, missing models truthfulness)
3. Evidence Sensitivity (synthesis attribution with non-causal disclaimer)
4. Imaging Explainability (authentic Grad-CAM with MODEL-SPECIFIC EXPLAINABILITY label)
"""

from unittest.mock import MagicMock, patch
import pytest

from app.schemas.council import ModelCouncilResult
from app.schemas.explainability import EXPLAINABILITY_HEADER, ImagingExplainabilityResult
from app.schemas.sensitivity import NON_CAUSAL_DISCLAIMER, EvidenceSensitivityAssessment
from app.services.explainability import ImagingExplainabilityService
from app.services.model_council import ModelCouncilService
from app.services.sensitivity import EvidenceSensitivityService


class TestTemporalRAG:
    """Verify temporal categorization and filtering logic."""

    def test_temporal_categorization_logic(self):
        from app.rag.service import PatientRAGService
        from datetime import datetime, timezone, timedelta

        service = PatientRAGService()
        now = datetime.now(timezone.utc)
        recent_date = (now - timedelta(days=5)).strftime("%Y-%m-%d")
        older_date = (now - timedelta(days=120)).strftime("%Y-%m-%d")

        # Recent date (< 30 days) is CURRENT
        cat_recent, days_recent = service.compute_temporal_category(
            event_date_str=recent_date,
            reference_date=now,
            threshold_days=30,
        )
        assert cat_recent == "CURRENT"
        assert days_recent is not None and days_recent <= 30

        # Older date (> 30 days) is HISTORICAL
        cat_old, days_old = service.compute_temporal_category(
            event_date_str=older_date,
            reference_date=now,
            threshold_days=30,
        )
        assert cat_old == "HISTORICAL"
        assert days_old is not None and days_old > 30


class TestModelCouncil:
    """Verify multi-model council evaluation and missing model truthfulness."""

    @patch("app.services.model_council.get_supabase_admin_client")
    def test_non_ambiguous_case_skips_deliberation(self, mock_get_client):
        # Mock supabase client
        mock_client = MagicMock()
        mock_get_client.return_value = mock_client

        # Mock asset response
        mock_client.table().select().eq().execute.side_effect = [
            # asset response
            MagicMock(data=[{"id": "asset-1", "modality": "chest_xray", "filename": "cxr.png"}]),
            # model_runs response: definitive low probability (non-ambiguous)
            MagicMock(data=[{
                "id": "run-1",
                "case_id": "case-1",
                "output_data": {
                    "findings": [{"label": "Pneumonia", "probability": 0.08, "threshold": 0.35}]
                }
            }]),
        ]

        service = ModelCouncilService()
        result = service.assess_case(case_id="case-1", asset_id="asset-1", force_council=False)

        assert isinstance(result, ModelCouncilResult)
        assert result.is_ambiguous is False
        assert result.consensus_status == "CONSENSUS_REACHED"
        assert "definitive" in result.ambiguity_rationale.lower()

    @patch("app.services.model_council.get_supabase_admin_client")
    def test_ambiguous_case_evaluates_models_and_lists_missing_models(self, mock_get_client):
        mock_client = MagicMock()
        mock_get_client.return_value = mock_client

        mock_client.table().select().eq().execute.side_effect = [
            # asset response
            MagicMock(data=[{"id": "asset-ambig", "modality": "chest_xray", "filename": "borderline.png"}]),
            # model_runs response with borderline probability
            MagicMock(data=[{
                "id": "run-ambig",
                "case_id": "case-ambig",
                "output_data": {
                    "findings": [{"label": "Consolidation", "probability": 0.48, "threshold": 0.50}]
                }
            }]),
        ]

        service = ModelCouncilService()
        result = service.assess_case(case_id="case-ambig", asset_id="asset-ambig")

        assert isinstance(result, ModelCouncilResult)
        assert result.is_ambiguous is True
        # Verify missing models are explicitly reported without invented results
        assert result.missing_models_count > 0
        for m in result.missing_models:
            assert m.is_missing is True
            assert m.status == "MISSING_MODEL"
            assert m.probability is None  # NEVER invent a missing result
            assert m.missing_reason is not None and len(m.missing_reason) > 0


class TestEvidenceSensitivity:
    """Verify evidence sensitivity attribution and non-causal disclaimer."""

    @patch("app.services.sensitivity.get_supabase_admin_client")
    def test_evidence_sensitivity_assessment(self, mock_get_client):
        mock_client = MagicMock()
        mock_get_client.return_value = mock_client

        # Mock report response with clinical synthesis
        mock_client.table().select().eq().order().limit().execute.side_effect = [
            MagicMock(data=[{
                "id": "rep-1",
                "case_id": "case-sens",
                "generated_synthesis": "Screening synthesis indicates prominent focal consolidation and airspace opacity. Historical records corroborate recurring pneumonia.",
            }]),
        ]

        # Mock canonical evidence items
        mock_client.table().select().eq().neq().execute.return_value = MagicMock(data=[
            {
                "id": "ev-1",
                "evidence_type": "MODEL_FINDING",
                "title": "Model Finding: Consolidation",
                "summary": "Dense airspace consolidation detected in right middle lung zone.",
                "provenance": {"model_name": "TorchXRayVision DenseNet-121"}
            },
            {
                "id": "ev-2",
                "evidence_type": "PATIENT_RECORD",
                "title": "Historical Discharge Summary",
                "summary": "Patient has previous history of recurrent pneumonia and chronic bronchitis.",
                "provenance": {"document_filename": "discharge_2023.pdf", "event_date": "2023-11-10"}
            },
        ])

        service = EvidenceSensitivityService()
        assessment = service.analyze_case_sensitivity(case_id="case-sens")

        assert isinstance(assessment, EvidenceSensitivityAssessment)
        assert assessment.total_contributing_items == 2
        assert len(assessment.contributions) == 2

        # Verify weights sum to approximately 1.0 (or 100%)
        total_pct = sum(c.contribution_percentage for c in assessment.contributions)
        assert 99.0 <= total_pct <= 101.0

        # Verify strict non-causal disclaimer is present
        assert NON_CAUSAL_DISCLAIMER in assessment.non_causal_disclaimer
        assert "DO NOT establish" in assessment.non_causal_disclaimer or "DO NOT claim" in assessment.non_causal_disclaimer


class TestImagingExplainability:
    """Verify model-specific Grad-CAM explainability and anti-decorative rules."""

    @patch("app.services.explainability.get_supabase_admin_client")
    def test_unsupported_modality_rejects_decorative_heatmaps(self, mock_get_client):
        mock_client = MagicMock()
        mock_get_client.return_value = mock_client

        # Return dermatology skin image asset (not supported by chest X-ray Grad-CAM)
        mock_client.table().select().eq().execute.return_value = MagicMock(data=[{
            "id": "asset-skin",
            "modality": "skin_image",
            "filename": "lesion.jpg"
        }])

        service = ImagingExplainabilityService()
        result = service.generate_explainability(asset_id="asset-skin", target_pathology="Melanoma")

        assert isinstance(result, ImagingExplainabilityResult)
        assert result.label == EXPLAINABILITY_HEADER
        assert result.is_available is False
        assert "prohibited" in result.unavailability_reason.lower() or "unavailable" in result.unavailability_reason.lower()
        # Ensure zero decorative heatmaps are produced
        assert result.heatmap_png_base64 is None
        assert result.overlay_png_base64 is None

    @patch("app.services.explainability.get_supabase_admin_client")
    def test_chest_xray_computes_authentic_gradcam(self, mock_get_client):
        mock_client = MagicMock()
        mock_get_client.return_value = mock_client

        # Return chest radiograph asset
        mock_client.table().select().eq().execute.return_value = MagicMock(data=[{
            "id": "asset-cxr-real",
            "modality": "chest_xray",
            "filename": "chest_xray_real.png",
            "storage_path": None,  # will use authentic baseline radiograph tensor
        }])

        service = ImagingExplainabilityService()
        result = service.generate_explainability(asset_id="asset-cxr-real", target_pathology="Pneumonia")

        assert isinstance(result, ImagingExplainabilityResult)
        assert result.label == "MODEL-SPECIFIC EXPLAINABILITY"
        assert result.is_available is True
        assert result.target_layer == "features.denseblock4"
        assert result.heatmap_png_base64 is not None
        assert result.heatmap_png_base64.startswith("data:image/png;base64,")
        assert result.overlay_png_base64 is not None
        assert result.overlay_png_base64.startswith("data:image/png;base64,")
        assert result.peak_activation_coords is not None
        assert result.activation_coverage_pct is not None
        assert "Grad-CAM" in result.method
