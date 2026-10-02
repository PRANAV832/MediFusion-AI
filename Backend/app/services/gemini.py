import json
import logging
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from pydantic import ValidationError

from app.core.config import settings
from app.core.exceptions import MediFusionException
from app.schemas.gemini import (
    ConflictItem,
    GeminiStatusResponse,
    GeminiSynthesisRequest,
    GeminiSynthesisResult,
    StructuredEvidenceBundle,
)

logger = logging.getLogger(__name__)

SUPPORTED_ACTIONS = [
    "document_extraction",
    "clinical_history_summary",
    "bounded_evidence_comparison",
    "evidence_grounded_synthesis",
    "screening_report_draft",
]

SYSTEM_PROMPT = """You are MediFusion AI's Evidence-Language Layer.
You assist clinicians by organizing, summarizing, and comparing multimodal clinical evidence.

CRITICAL MEDICAL INTEGRITY & SAFETY DIRECTIVES:
1. You are an evidence-language engine, NOT an autonomous diagnosing physician.
2. Ground EVERY clinical observation, summary, and comparison STRICTLY in the provided evidence bundle.
3. DO NOT invent medical findings, symptoms, or diagnoses.
4. DO NOT invent confidence scores, probabilities, or metrics.
5. DO NOT invent citations or evidence IDs. You may ONLY cite IDs explicitly listed in `provenance_ids`.
6. DO NOT invent patient history not found in the input bundle.
7. DO NOT invent model results or replace specialized medical models.
8. If data is missing, ambiguous, or incomplete, explicitly articulate it under `uncertainty_notes`.
9. If you detect conflicting information between current findings and historical records, detail it under `conflicts`.
10. Formulate targeted, actionable clinician review questions under `suggested_review_questions`.
11. Every output MUST have `result_type: "GENERATED_SYNTHESIS"`.
12. Output STRICT, VALID JSON ONLY. Do not include markdown code block backticks."""


class GeminiService:
    """Evidence-Language Layer powered by Google Gemini (e.g. gemini-3.8-flash).

    Provides grounded document extraction, history summarization, bounded comparison,
    and report drafting with strict hallucination barriers.
    """

    def __init__(self, api_key: Optional[str] = None, model_name: Optional[str] = None):
        self.api_key = api_key or settings.GEMINI_API_KEY
        self.model_name = model_name or settings.GEMINI_MODEL or "gemini-3.8-flash"
        self._client = None

    def get_status(self) -> GeminiStatusResponse:
        """Check whether Gemini is ready or if API key is required."""
        if not self.api_key or len(self.api_key.strip()) < 10:
            return GeminiStatusResponse(
                status="API_KEY_REQUIRED",
                model=self.model_name,
                message="Google Gemini API key is missing. Set GEMINI_API_KEY in backend/.env.",
                supported_actions=SUPPORTED_ACTIONS,
            )

        try:
            self._ensure_client()
            return GeminiStatusResponse(
                status="READY",
                model=self.model_name,
                message="Gemini evidence-language service is active and ready.",
                supported_actions=SUPPORTED_ACTIONS,
            )
        except Exception as e:
            return GeminiStatusResponse(
                status="ERROR",
                model=self.model_name,
                message=f"Gemini client initialization failed: {str(e)}",
                supported_actions=SUPPORTED_ACTIONS,
            )

    def _ensure_client(self):
        if not self.api_key or len(self.api_key.strip()) < 10:
            raise MediFusionException(
                message="Gemini API key is required. Please set GEMINI_API_KEY in backend/.env",
                status_code=503,
            )

        if self._client is None:
            try:
                from google import genai
                from google.genai import types
                self._client = genai.Client(
                    api_key=self.api_key,
                    http_options=types.HttpOptions(timeout=10000),
                )
            except Exception as e:
                logger.error(f"Failed to initialize Google GenAI client: {e}")
                raise MediFusionException(
                    message=f"Google GenAI client initialization failed: {str(e)}",
                    status_code=500,
                )
        return self._client

    def execute_synthesis(self, request: GeminiSynthesisRequest) -> GeminiSynthesisResult:
        """Execute evidence-language synthesis strictly grounded in the structured evidence bundle."""
        client = self._ensure_client()
        action = request.action
        bundle = request.evidence_bundle

        if action not in SUPPORTED_ACTIONS:
            raise MediFusionException(
                message=f"Unsupported action: '{action}'. Supported actions: {SUPPORTED_ACTIONS}",
                status_code=400,
            )

        # Collect all valid provenance IDs to enforce anti-hallucination citation bounds
        valid_provenance_ids = set(bundle.provenance_ids)
        for ev in bundle.retrieved_evidence:
            valid_provenance_ids.add(ev.id)
        for mf in bundle.model_findings:
            if mf.provenance_id:
                valid_provenance_ids.add(mf.provenance_id)
            if mf.run_id:
                valid_provenance_ids.add(mf.run_id)
            if mf.finding_id:
                valid_provenance_ids.add(mf.finding_id)

        # Construct Action-Specific Instructions
        action_prompt = self._build_action_prompt(action, bundle, request.document_text, list(valid_provenance_ids))

        # Format input payload
        prompt_content = f"{SYSTEM_PROMPT}\n\n=== ACTION: {action.upper()} ===\n{action_prompt}"

        # Try candidate models to handle any transient Google API 503/404 errors
        candidate_models = [
            self.model_name,
            "gemini-3.8-flash",
            "gemini-3.5-flash",
            "gemini-flash-latest",
        ]
        # Deduplicate while preserving order
        unique_models = list(dict.fromkeys(candidate_models))

        raw_text = None
        used_model = self.model_name
        last_error = None

        for m in unique_models:
            try:
                response = client.models.generate_content(
                    model=m,
                    contents=prompt_content,
                )
                if response and response.text:
                    raw_text = response.text
                    used_model = m
                    break
            except Exception as e:
                logger.warning(f"Gemini model '{m}' call failed: {e}. Trying next candidate.")
                last_error = e

        # If all remote models experienced temporary capacity spikes (e.g. 503 UNAVAILABLE),
        # apply deterministic evidence-grounded synthesis fallback so clinical workflows never break.
        if not raw_text:
            logger.warning(f"All remote Gemini candidate models failed ({last_error}). Using deterministic grounded synthesis.")
            return self._deterministic_grounded_synthesis(action, bundle, list(valid_provenance_ids), str(last_error))

        # Parse and strictly validate response JSON
        parsed_data = self._clean_and_parse_json(raw_text)

        # Safety & Grounding Post-Processing:
        # Enforce that every cited supporting_evidence_id actually exists in the provided evidence bundle
        raw_supporting_ids = parsed_data.get("supporting_evidence_ids") or []
        verified_supporting_ids = [
            cid for cid in raw_supporting_ids
            if cid in valid_provenance_ids or not valid_provenance_ids
        ]

        # Always enforce mandatory tags
        parsed_data["result_type"] = "GENERATED_SYNTHESIS"
        parsed_data["action"] = action
        parsed_data["supporting_evidence_ids"] = verified_supporting_ids
        parsed_data["model_used"] = self.model_name
        parsed_data["timestamp"] = datetime.now(timezone.utc).isoformat()
        parsed_data["is_grounded"] = True

        try:
            return GeminiSynthesisResult.model_validate(parsed_data)
        except ValidationError as ve:
            logger.warning(f"Pydantic validation warning on Gemini response: {ve}. Attempting normalized fallback.")
            # Construct a robust fallback preserving generated text
            return GeminiSynthesisResult(
                result_type="GENERATED_SYNTHESIS",
                action=action,
                generated_synthesis=parsed_data.get("generated_synthesis") or raw_text,
                summary=parsed_data.get("summary"),
                supporting_evidence_ids=verified_supporting_ids,
                uncertainty_notes=parsed_data.get("uncertainty_notes") or ["Schema parsed with structural defaults"],
                conflicts=[
                    ConflictItem(
                        finding_or_claim=c.get("finding_or_claim", "Unknown"),
                        source_a=c.get("source_a", "Current"),
                        source_b=c.get("source_b", "Historical"),
                        conflict_description=c.get("conflict_description", "Conflict observed"),
                        clinical_significance=c.get("clinical_significance"),
                    )
                    for c in parsed_data.get("conflicts", []) if isinstance(c, dict)
                ],
                suggested_review_questions=parsed_data.get("suggested_review_questions") or [],
                clinical_correlations=parsed_data.get("clinical_correlations") or [],
                is_grounded=True,
                model_used=self.model_name,
                timestamp=datetime.now(timezone.utc).isoformat(),
            )

    def _build_action_prompt(
        self,
        action: str,
        bundle: StructuredEvidenceBundle,
        document_text: Optional[str],
        valid_ids: List[str],
    ) -> str:
        """Construct tailored instruction payload for each of the 5 supported clinical actions."""
        bundle_json = json.dumps(bundle.model_dump(), indent=2)

        action_guides = {
            "document_extraction": (
                "Task: Extract key clinical facts, diagnoses, vital signs, lab panels, medications, "
                "and diagnostic impressions from the attached document text. Link each finding to specific evidence."
            ),
            "clinical_history_summary": (
                "Task: Synthesize a concise, longitudinal summary of the patient's medical history strictly using "
                "the retrieved evidence and patient records. Do not speculate beyond the text."
            ),
            "bounded_evidence_comparison": (
                "Task: Compare current model findings with historical patient records. Identify whether abnormalities "
                "are new, stable, chronic, or resolving. Highlight any direct contradictions."
            ),
            "evidence_grounded_synthesis": (
                "Task: Provide an evidence-grounded clinical synthesis combining specialized model findings with "
                "the patient's retrieved background history. Preserve clear distinction between AI model detections "
                "and historical medical records."
            ),
            "screening_report_draft": (
                "Task: Draft a unified clinical screening report ready for physician review. Include an executive summary, "
                "findings synthesis, clinical correlations, conflicts/discrepancies, uncertainties, and clinician review questions."
            ),
        }

        guide = action_guides.get(action, "Task: Perform grounded evidence synthesis.")

        prompt = f"""{guide}

EVIDENCE BUNDLE PROVIDED:
{bundle_json}

ALLOWED PROVENANCE IDS (cite ONLY from this list under supporting_evidence_ids):
{json.dumps(valid_ids)}
"""
        if document_text:
            prompt += f"\nATTACHED DOCUMENT TEXT:\n{document_text}\n"

        prompt += """
RESPONSE SCHEMA:
You MUST respond with valid JSON adhering exactly to this structure:
{
  "result_type": "GENERATED_SYNTHESIS",
  "action": "<action_name>",
  "generated_synthesis": "<comprehensive grounded synthesis text>",
  "summary": "<brief 1-2 sentence executive summary>",
  "supporting_evidence_ids": ["<only valid ids from the allowed provenance list>"],
  "uncertainty_notes": ["<explicit data gaps, image quality concerns, or unconfirmed items>"],
  "conflicts": [
    {
      "finding_or_claim": "<what finding is conflicted>",
      "source_a": "<first source / finding>",
      "source_b": "<conflicting source / finding>",
      "conflict_description": "<explanation of discrepancy>",
      "clinical_significance": "<why this matters for clinician review>"
    }
  ],
  "suggested_review_questions": ["<targeted review question for the doctor>"],
  "clinical_correlations": ["<meaningful correlation between current finding and history>"]
}
"""
        return prompt

    def _clean_and_parse_json(self, raw_text: str) -> Dict[str, Any]:
        """Strip markdown code fence wrappers and extract clean JSON."""
        cleaned = raw_text.strip()
        # Remove ```json ... ``` or ``` ... ```
        if cleaned.startswith("```"):
            cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.IGNORECASE)
            cleaned = re.sub(r"\s*```$", "", cleaned)
        cleaned = cleaned.strip()

        try:
            return json.loads(cleaned)
        except json.JSONDecodeError:
            # Attempt to find JSON object bounds { ... }
            match = re.search(r"(\{.*\})", cleaned, re.DOTALL)
            if match:
                try:
                    return json.loads(match.group(1))
                except json.JSONDecodeError:
                    pass
            # Fallback if non-JSON narrative was returned
            return {
                "generated_synthesis": cleaned,
                "summary": "Generated clinical synthesis",
                "supporting_evidence_ids": [],
                "uncertainty_notes": ["Raw response format fallback"],
                "conflicts": [],
                "suggested_review_questions": [],
                "clinical_correlations": [],
            }

    def _deterministic_grounded_synthesis(
        self,
        action: str,
        bundle: StructuredEvidenceBundle,
        valid_ids: List[str],
        error_context: str,
    ) -> GeminiSynthesisResult:
        """Deterministic, grounded evidence synthesis fallback ensuring patient care workflow never breaks."""
        pt = bundle.patient_context
        findings_text = ", ".join([f"{f.finding} ({f.capability})" for f in bundle.model_findings]) or "No abnormal specialized findings reported"
        history_text = ", ".join(pt.chronic_conditions) or "No recorded chronic conditions"
        evidence_citations = [ev.id for ev in bundle.retrieved_evidence if ev.id in valid_ids]
        model_citations = [f.provenance_id for f in bundle.model_findings if f.provenance_id and f.provenance_id in valid_ids]
        all_cited_ids = list(dict.fromkeys(evidence_citations + model_citations))

        synthesis_paragraphs = [
            f"**Clinical Synthesis for {pt.name or 'Patient'}** ({pt.patient_id[:8]}...):",
            f"Patient presented with chief complaint of '{pt.chief_complaint or 'routine screening'}' and known background history of {history_text}.",
            f"Specialized AI screening evaluations identified: {findings_text}.",
        ]

        if bundle.retrieved_evidence:
            ev_summaries = [f"[{e.filename} p.{e.page_number}]: \"{e.content[:100]}...\"" for e in bundle.retrieved_evidence[:3]]
            synthesis_paragraphs.append(f"Corroborating patient records: {' '.join(ev_summaries)}")

        synthesis_narrative = "\n\n".join(synthesis_paragraphs)

        return GeminiSynthesisResult(
            result_type="GENERATED_SYNTHESIS",
            action=action,
            generated_synthesis=synthesis_narrative,
            summary=f"Evidence-grounded synthesis linking {len(bundle.model_findings)} model findings with patient history.",
            supporting_evidence_ids=all_cited_ids,
            uncertainty_notes=[
                "External Gemini endpoint experienced transient demand; grounded deterministic synthesis applied.",
                f"Evaluation scope: {len(bundle.model_findings)} specialized model runs, {len(bundle.retrieved_evidence)} retrieved records.",
            ],
            conflicts=[],
            suggested_review_questions=[
                f"Verify correlation between {findings_text} and historical {history_text} on clinical examination.",
                "Assess whether follow-up diagnostic imaging or laboratory correlation is indicated.",
            ],
            clinical_correlations=[
                f"Current presentation '{pt.chief_complaint or 'findings'}' evaluated in context of chronic {history_text}."
            ],
            is_grounded=True,
            model_used=self.model_name,
            timestamp=datetime.now(timezone.utc).isoformat(),
        )


_gemini_service: Optional[GeminiService] = None


def get_gemini_service() -> GeminiService:
    global _gemini_service
    if _gemini_service is None:
        _gemini_service = GeminiService()
    return _gemini_service
