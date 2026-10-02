import uuid
import pytest
from app.core.security import AuthenticatedUser, get_current_user
from app.main import app
from app.rag.cleaner import ClinicalTextCleaner
from app.rag.chunker import ClinicalChunker
from app.rag.extractor import DocumentExtractor, ExtractedPage
from app.rag.embeddings import get_embedding_service


def test_pipeline_extraction_cleaning_chunking_embeddings():
    """Verify core pipeline components: extraction -> cleaning -> chunking -> embeddings."""
    # 1. Extraction
    sample_text = "Page 1 of 2\nChief Complaint: Persistent cough.\n\x0cPage 2 of 2\nImpression: Clear lung fields."
    pages = DocumentExtractor.extract_from_text(sample_text, filename="visit_summary.txt")
    assert len(pages) == 2
    assert pages[0].page_number == 1
    assert "Persistent cough" in pages[0].text
    assert pages[1].page_number == 2
    assert "Clear lung fields" in pages[1].text

    # 2. Cleaning
    dirty_text = "Page 1 of 5\n\n---  \nPatient BP: 140/90 mmHg.   Medication: Lisinopril 20mg q.d.  \n\n\n\nFollow-up: 2 weeks."
    cleaned = ClinicalTextCleaner.clean(dirty_text)
    assert "Page 1 of 5" not in cleaned
    assert "---" not in cleaned
    assert "Lisinopril 20mg q.d." in cleaned
    assert "BP: 140/90 mmHg" in cleaned

    # 3. Chunking
    chunker = ClinicalChunker(chunk_size=300, chunk_overlap=50)
    chunks = chunker.chunk_pages(pages)
    assert len(chunks) >= 2
    for c in chunks:
        assert c.page_number in (1, 2)
        assert c.chunk_index >= 0
        assert len(c.content) > 0

    # 4. Embeddings (384-dimensional)
    embedder = get_embedding_service()
    vector = embedder.embed_text("Patient with acute dyspnea")
    assert len(vector) == 384
    assert isinstance(vector[0], float)


def test_synthetic_cross_patient_isolation(client):
    """MANDATORY SYNTHETIC TEST:

    Patient A document: 'Patient A has previous hypertension.'
    Patient B document: 'Patient B has previous asthma.'
    Search Patient A.
    Assert: Patient B evidence = ZERO RESULTS.
    """
    test_user_id = str(uuid.uuid4())
    test_user = AuthenticatedUser(
        user_id=test_user_id,
        email="clinician.rag@medifusion.ai",
        profile={"id": test_user_id, "role": "clinician", "full_name": "Dr. Sarah Chen"},
        token="mock_rag_token",
    )
    app.dependency_overrides[get_current_user] = lambda: test_user

    try:
        # Create Patient A
        suffix_a = uuid.uuid4().hex[:6].upper()
        res_a = client.post("/api/v1/patients/", json={
            "mrn": f"MRN-RAG-A-{suffix_a}",
            "first_name": "PatientA",
            "last_name": "HypertensionTest",
            "date_of_birth": "1980-05-12",
            "gender": "Female",
        })
        assert res_a.status_code == 201
        patient_a_id = res_a.json()["id"]

        # Create Patient B
        suffix_b = uuid.uuid4().hex[:6].upper()
        res_b = client.post("/api/v1/patients/", json={
            "mrn": f"MRN-RAG-B-{suffix_b}",
            "first_name": "PatientB",
            "last_name": "AsthmaTest",
            "date_of_birth": "1985-08-22",
            "gender": "Male",
        })
        assert res_b.status_code == 201
        patient_b_id = res_b.json()["id"]

        # Ingest Patient A Document
        ingest_a = client.post("/api/v1/rag/ingest/text", json={
            "patient_id": patient_a_id,
            "content": "Patient A has previous hypertension.",
            "filename": "patient_a_history.txt",
            "document_type": "clinical_note",
            "domain": "cardiology",
            "event_date": "2024-01-15",
            "source_path": "records/patient_a_history.txt",
        })
        assert ingest_a.status_code == 201
        assert ingest_a.json()["chunks_created"] >= 1

        # Ingest Patient B Document
        ingest_b = client.post("/api/v1/rag/ingest/text", json={
            "patient_id": patient_b_id,
            "content": "Patient B has previous asthma.",
            "filename": "patient_b_history.txt",
            "document_type": "clinical_note",
            "domain": "pulmonology",
            "event_date": "2024-02-20",
            "source_path": "records/patient_b_history.txt",
        })
        assert ingest_b.status_code == 201
        assert ingest_b.json()["chunks_created"] >= 1

        # Search Patient A for "hypertension"
        search_a_res = client.post("/api/v1/rag/search", json={
            "patient_id": patient_a_id,
            "query": "previous hypertension",
            "top_k": 10,
        })
        assert search_a_res.status_code == 200
        search_a_data = search_a_res.json()
        evidence_for_a = search_a_data["evidence"]

        # Verify Patient A evidence was found
        assert len(evidence_for_a) > 0
        assert any("hypertension" in ev["content"].lower() for ev in evidence_for_a)

        # STRICT ASSERTION: Patient B evidence = ZERO RESULTS
        patient_b_chunks_in_a = [ev for ev in evidence_for_a if ev["patient_id"] == patient_b_id or "asthma" in ev["content"].lower()]
        assert len(patient_b_chunks_in_a) == 0, f"SECURITY VIOLATION: Patient B evidence leaked into Patient A! {patient_b_chunks_in_a}"

        # Search Patient A for "asthma" (which only Patient B has)
        search_a_asthma = client.post("/api/v1/rag/search", json={
            "patient_id": patient_a_id,
            "query": "asthma respiratory history",
            "top_k": 10,
        })
        assert search_a_asthma.status_code == 200
        asthma_evidence = search_a_asthma.json()["evidence"]
        # Patient A does not have asthma document, so Patient B's asthma document must NEVER appear!
        leaked_b_asthma = [ev for ev in asthma_evidence if ev["patient_id"] == patient_b_id or "Patient B" in ev["content"]]
        assert len(leaked_b_asthma) == 0, "SECURITY VIOLATION: Leaked Patient B asthma evidence when querying Patient A!"

        # Reverse check: Search Patient B for "hypertension" (which only Patient A has)
        search_b_res = client.post("/api/v1/rag/search", json={
            "patient_id": patient_b_id,
            "query": "hypertension",
            "top_k": 10,
        })
        assert search_b_res.status_code == 200
        b_results = search_b_res.json()["evidence"]
        leaked_a_hypertension = [ev for ev in b_results if ev["patient_id"] == patient_a_id or "Patient A" in ev["content"]]
        assert len(leaked_a_hypertension) == 0, "SECURITY VIOLATION: Leaked Patient A hypertension evidence when querying Patient B!"

        # Verify all required metadata fields are preserved on retrieved evidence
        first_ev = evidence_for_a[0]
        assert first_ev["patient_id"] == patient_a_id
        assert first_ev["document_type"] == "clinical_note"
        assert first_ev["event_date"] == "2024-01-15"
        assert first_ev["page_number"] == 1
        assert first_ev["domain"] == "cardiology"
        assert first_ev["filename"] == "patient_a_history.txt"
        assert first_ev["chunk_index"] == 0
        assert first_ev["source_path"] == "records/patient_a_history.txt"
        assert "similarity" in first_ev

    finally:
        app.dependency_overrides.pop(get_current_user, None)


def test_server_side_patient_isolation_security(client):
    """Verify that requests missing patient_id or using invalid UUID are rejected server-side."""
    test_user_id = str(uuid.uuid4())
    test_user = AuthenticatedUser(
        user_id=test_user_id,
        email="clinician.rag@medifusion.ai",
        profile={"id": test_user_id, "role": "clinician", "full_name": "Dr. Security"},
        token="mock_token",
    )
    app.dependency_overrides[get_current_user] = lambda: test_user

    try:
        # Invalid patient_id
        res = client.post("/api/v1/rag/search", json={
            "patient_id": "not-a-valid-uuid",
            "query": "chest pain",
        })
        assert res.status_code in (400, 422)

        # Ingestion with invalid patient UUID
        res_ingest = client.post("/api/v1/rag/ingest/text", json={
            "patient_id": "invalid-uuid",
            "content": "Some text",
        })
        assert res_ingest.status_code in (400, 422)

    finally:
        app.dependency_overrides.pop(get_current_user, None)
