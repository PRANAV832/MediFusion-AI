import logging
import uuid
from datetime import date, datetime, timezone
from typing import Any, Dict, List, Optional
from app.core.exceptions import MediFusionException
from app.core.supabase import get_supabase_admin_client
from app.rag.cleaner import ClinicalTextCleaner
from app.rag.chunker import ClinicalChunker
from app.rag.embeddings import get_embedding_service
from app.rag.extractor import DocumentExtractor, ExtractedPage
from app.schemas.rag import (
    IngestResponse,
    PatientKnowledgeChunk,
    RetrievedEvidenceItem,
)

logger = logging.getLogger(__name__)


class PatientRAGService:
    """Service orchestrating Document -> extraction -> cleaning -> chunking -> embeddings -> pgvector

    -> patient-scoped retrieval.
    Enforces strict server-side patient isolation.
    """

    def __init__(self, chunk_size: int = 500, chunk_overlap: int = 80):
        self.chunker = ClinicalChunker(chunk_size=chunk_size, chunk_overlap=chunk_overlap)
        self.embedding_service = get_embedding_service()

    def _validate_patient_id(self, patient_id: str) -> str:
        """Strict server-side validation of patient identifier."""
        if not patient_id or not isinstance(patient_id, str):
            raise MediFusionException(
                message="Security Violation: patient_id is mandatory for patient isolation",
                status_code=400,
            )
        clean_id = patient_id.strip()
        try:
            uuid.UUID(clean_id)
        except ValueError:
            raise MediFusionException(
                message=f"Invalid patient_id UUID format: '{patient_id}'",
                status_code=400,
            )
        return clean_id

    def ingest_document(
        self,
        patient_id: str,
        content_bytes: bytes,
        filename: str,
        document_type: str = "clinical_note",
        case_id: Optional[str] = None,
        document_id: Optional[str] = None,
        event_date: Optional[str] = None,
        domain: str = "clinical",
        source_path: Optional[str] = None,
        extra_metadata: Optional[Dict[str, Any]] = None,
    ) -> IngestResponse:
        """Full pipeline: Document -> extraction -> cleaning -> chunking -> embeddings -> pgvector."""
        valid_patient_id = self._validate_patient_id(patient_id)
        if extra_metadata is None:
            extra_metadata = {}

        # 1. Extraction (PDF or Text)
        try:
            pages = DocumentExtractor.extract(content_bytes, filename=filename)
        except Exception as e:
            raise MediFusionException(
                message=f"Document extraction failed for '{filename}': {str(e)}",
                status_code=422,
            )

        if not pages:
            pages = [ExtractedPage(page_number=1, text="", metadata={"filename": filename})]

        # 2 & 3. Cleaning & Chunking
        chunk_items = self.chunker.chunk_pages(pages)
        if not chunk_items:
            # Create a single fallback chunk if document was empty
            chunk_items = self.chunker.chunk_pages([
                ExtractedPage(page_number=1, text="No textual content extracted.", metadata={"filename": filename})
            ])

        # 4. Embeddings
        texts_to_embed = [item.clean_content or item.content for item in chunk_items]
        embeddings = self.embedding_service.embed_batch(texts_to_embed)

        # Standardize event date
        if not event_date:
            event_date_str = date.today().isoformat()
        else:
            event_date_str = event_date.split("T")[0]

        # 5. Prepare rows for pgvector storage
        admin_client = get_supabase_admin_client()
        records_to_insert = []

        for idx, (chunk, embedding) in enumerate(zip(chunk_items, embeddings)):
            record = {
                "patient_id": valid_patient_id,
                "document_id": document_id,
                "case_id": case_id,
                "content": chunk.content,
                "clean_content": chunk.clean_content,
                "embedding": embedding,
                # Required metadata preserved on every chunk:
                "document_type": document_type,
                "event_date": event_date_str,
                "page_number": chunk.page_number,
                "domain": domain,
                "filename": filename,
                "chunk_index": chunk.chunk_index,
                "source_path": source_path or f"documents/{filename}",
                "metadata": {
                    **extra_metadata,
                    "char_count": chunk.char_count,
                    "ingested_at": datetime.now(timezone.utc).isoformat(),
                },
            }
            records_to_insert.append(record)

        # Insert chunks into PostgreSQL / pgvector table
        try:
            insert_res = (
                admin_client.table("patient_knowledge_chunks")
                .insert(records_to_insert)
                .execute()
            )
            created_count = len(insert_res.data) if insert_res.data else len(records_to_insert)
        except Exception as e:
            logger.error(f"Failed to persist knowledge chunks to pgvector: {e}")
            raise MediFusionException(
                message=f"Database error saving knowledge chunks: {str(e)}",
                status_code=500,
            )

        return IngestResponse(
            patient_id=valid_patient_id,
            filename=filename,
            document_type=document_type,
            total_chunks=len(chunk_items),
            chunks_created=created_count,
            message=f"Successfully indexed {created_count} clinical chunks for patient {valid_patient_id}",
        )

    def ingest_text(
        self,
        patient_id: str,
        content: str,
        filename: str = "clinical_note.txt",
        document_type: str = "clinical_note",
        case_id: Optional[str] = None,
        document_id: Optional[str] = None,
        event_date: Optional[str] = None,
        domain: str = "clinical",
        source_path: Optional[str] = None,
        extra_metadata: Optional[Dict[str, Any]] = None,
    ) -> IngestResponse:
        """Direct text ingestion helper (converts to bytes and runs standard pipeline)."""
        content_bytes = content.encode("utf-8")
        return self.ingest_document(
            patient_id=patient_id,
            content_bytes=content_bytes,
            filename=filename,
            document_type=document_type,
            case_id=case_id,
            document_id=document_id,
            event_date=event_date,
            domain=domain,
            source_path=source_path,
            extra_metadata=extra_metadata,
        )

    def search_patient_evidence(
        self,
        patient_id: str,
        query: str,
        case_id: Optional[str] = None,
        domain: Optional[str] = None,
        document_type: Optional[str] = None,
        top_k: int = 10,
        match_threshold: float = 0.0,
        temporal_scope: Optional[str] = "all",
        current_threshold_days: int = 30,
        reference_date: Optional[str] = None,
    ) -> List[RetrievedEvidenceItem]:
        """Patient-scoped semantic and temporal retrieval.

        SECURITY GUARANTEE: Server-side patient isolation is enforced:
        1. patient_id is validated and strictly non-empty.
        2. The match_patient_evidence database RPC requires p_patient_id and queries WHERE c.patient_id = p_patient_id.
        3. An additional server-side filter discards any row not matching the requested patient_id (defense in depth).
        4. Temporal RAG differentiates CURRENT encounter evidence from HISTORICAL evidence based on event_date.
        """
        valid_patient_id = self._validate_patient_id(patient_id)
        if not query or not query.strip():
            return []

    @staticmethod
    def compute_temporal_category(
        event_date_str: Optional[str],
        reference_date: Optional[Any] = None,
        threshold_days: int = 30,
    ) -> Tuple[str, Optional[int]]:
        """
        Distinguishes CURRENT vs HISTORICAL clinical evidence using event dates.
        """
        if not event_date_str:
            return "HISTORICAL", None

        # Normalize reference date
        if reference_date is None:
            ref_dt = date.today()
        elif isinstance(reference_date, datetime):
            ref_dt = reference_date.date()
        elif isinstance(reference_date, date):
            ref_dt = reference_date
        elif isinstance(reference_date, str):
            try:
                ref_dt = datetime.strptime(reference_date.split("T")[0], "%Y-%m-%d").date()
            except Exception:
                ref_dt = date.today()
        else:
            ref_dt = date.today()

        clean_ev_date = event_date_str.split("T")[0].strip()
        try:
            ev_dt = datetime.strptime(clean_ev_date, "%Y-%m-%d").date()
            days_diff = (ref_dt - ev_dt).days
        except Exception:
            return "HISTORICAL", None

        temporal_cat = "CURRENT" if abs(days_diff) <= threshold_days else "HISTORICAL"
        return temporal_cat, days_diff

    def retrieve_patient_evidence(
        self,
        patient_id: str,
        query: str,
        top_k: int = 5,
        match_threshold: float = 0.5,
        case_id: Optional[str] = None,
        domain: Optional[str] = None,
        document_type: Optional[str] = None,
        temporal_scope: Optional[str] = "all",
        current_threshold_days: int = 30,
        reference_date: Optional[str] = None,
    ) -> List[RetrievedEvidenceItem]:
        valid_patient_id = self._validate_patient_id(patient_id)

        # Parse reference date
        try:
            ref_dt = datetime.strptime(reference_date.split("T")[0], "%Y-%m-%d").date() if reference_date else date.today()
        except Exception:
            ref_dt = date.today()

        # Generate query vector
        clean_query = ClinicalTextCleaner.clean(query)
        query_vector = self.embedding_service.embed_text(clean_query)

        admin_client = get_supabase_admin_client()

        rpc_params = {
            "p_patient_id": valid_patient_id,
            "query_embedding": query_vector,
            "match_threshold": float(match_threshold),
            "match_count": int(top_k * 2) if temporal_scope in ["current", "historical"] else int(top_k),
            "p_case_id": case_id,
            "p_domain": domain,
            "p_document_type": document_type,
        }

        try:
            rpc_res = admin_client.rpc("match_patient_evidence", rpc_params).execute()
            rows = rpc_res.data or []
        except Exception as e:
            logger.error(f"match_patient_evidence RPC execution failed: {e}")
            raise MediFusionException(
                message=f"Evidence retrieval failed: {str(e)}",
                status_code=500,
            )

        evidence_items: List[RetrievedEvidenceItem] = []
        for r in rows:
            # DEFENSE IN DEPTH: Strict server-side verification of patient isolation
            if str(r.get("patient_id")) != valid_patient_id:
                logger.error(
                    f"CRITICAL SECURITY ALERT: Cross-patient leakage detected! "
                    f"Queried {valid_patient_id}, got chunk from {r.get('patient_id')}. Dropping record."
                )
                continue

            # Temporal differentiation
            ev_date_str = str(r.get("event_date", ""))
            temporal_cat, days_diff = self.compute_temporal_category(
                event_date_str=ev_date_str,
                reference_date=ref_dt,
                threshold_days=current_threshold_days,
            )

            # Apply temporal scope filter if requested
            if temporal_scope == "current" and temporal_cat != "CURRENT":
                continue
            if temporal_scope == "historical" and temporal_cat != "HISTORICAL":
                continue

            evidence_items.append(
                RetrievedEvidenceItem(
                    id=str(r.get("id")),
                    patient_id=str(r.get("patient_id")),
                    document_id=str(r["document_id"]) if r.get("document_id") else None,
                    case_id=str(r["case_id"]) if r.get("case_id") else None,
                    content=r.get("content", ""),
                    clean_content=r.get("clean_content"),
                    document_type=r.get("document_type", "clinical_note"),
                    event_date=ev_date_str,
                    page_number=r.get("page_number", 1),
                    domain=r.get("domain", "clinical"),
                    filename=r.get("filename", "unknown"),
                    chunk_index=r.get("chunk_index", 0),
                    source_path=r.get("source_path"),
                    metadata=r.get("metadata") or {},
                    similarity=round(float(r.get("similarity", 0.0)), 4),
                    temporal_category=temporal_cat,
                    days_offset=days_diff if days_diff != 999 else None,
                )
            )
            if len(evidence_items) >= top_k:
                break

        return evidence_items

    search_patient_evidence = retrieve_patient_evidence

    def list_patient_knowledge(
        self,
        patient_id: str,
        case_id: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[PatientKnowledgeChunk]:
        """List indexed knowledge chunks for a specific patient."""
        valid_patient_id = self._validate_patient_id(patient_id)
        admin_client = get_supabase_admin_client()

        query = (
            admin_client.table("patient_knowledge_chunks")
            .select("id, patient_id, document_id, case_id, content, clean_content, document_type, event_date, page_number, domain, filename, chunk_index, source_path, metadata, created_at")
            .eq("patient_id", valid_patient_id)
            .order("created_at", desc=True)
            .range(offset, offset + limit - 1)
        )

        if case_id:
            query = query.eq("case_id", case_id)

        res = query.execute()
        rows = res.data or []

        return [
            PatientKnowledgeChunk(
                id=str(r.get("id")),
                patient_id=str(r.get("patient_id")),
                document_id=str(r["document_id"]) if r.get("document_id") else None,
                case_id=str(r["case_id"]) if r.get("case_id") else None,
                content=r.get("content", ""),
                clean_content=r.get("clean_content"),
                document_type=r.get("document_type", "clinical_note"),
                event_date=str(r.get("event_date", "")),
                page_number=r.get("page_number", 1),
                domain=r.get("domain", "clinical"),
                filename=r.get("filename", "unknown"),
                chunk_index=r.get("chunk_index", 0),
                source_path=r.get("source_path"),
                metadata=r.get("metadata") or {},
                created_at=str(r.get("created_at", "")),
            )
            for r in rows
        ]

    def delete_chunk(self, chunk_id: str) -> bool:
        """Delete an individual knowledge chunk."""
        admin_client = get_supabase_admin_client()
        admin_client.table("patient_knowledge_chunks").delete().eq("id", chunk_id).execute()
        return True


_rag_service: Optional[PatientRAGService] = None


def get_rag_service() -> PatientRAGService:
    global _rag_service
    if _rag_service is None:
        _rag_service = PatientRAGService()
    return _rag_service
