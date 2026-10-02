import React, { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../../services/apiClient';
import type {
  RetrievedEvidenceItem,
  PatientKnowledgeChunk,
} from '../../types/api';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  BrainCircuit,
  Search,
  BookOpen,
  FileText,
  Calendar,
  Layers,
  ShieldCheck,
  UploadCloud,
  Plus,
  RefreshCw,
  Trash2,
  AlertCircle,
  CheckCircle2,
  FileCheck2,
  Compass,
  Filter,
  Sparkles,
} from 'lucide-react';

interface PatientKnowledgeViewProps {
  patientId: string;
  caseId?: string;
  patientName?: string;
}

export const PatientKnowledgeView: React.FC<PatientKnowledgeViewProps> = ({
  patientId,
  caseId,
  patientName,
}) => {
  // Query & Results
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [retrievedEvidence, setRetrievedEvidence] = useState<RetrievedEvidenceItem[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchDomain, setSearchDomain] = useState<string>('');
  const [searchType, setSearchType] = useState<string>('');
  const [topK, setTopK] = useState<number>(5);
  const [temporalScope, setTemporalScope] = useState<'all' | 'current' | 'historical'>('all');

  // Knowledge Bank State
  const [knowledgeChunks, setKnowledgeChunks] = useState<PatientKnowledgeChunk[]>([]);
  const [loadingKnowledge, setLoadingKnowledge] = useState(false);
  const [knowledgeError, setKnowledgeError] = useState<string | null>(null);

  // Ingestion Modal
  const [ingestModalOpen, setIngestModalOpen] = useState(false);
  const [ingestMode, setIngestMode] = useState<'text' | 'file'>('text');
  const [ingestTextContent, setIngestTextContent] = useState('');
  const [ingestFilename, setIngestFilename] = useState('clinical_note.txt');
  const [ingestDocType, setIngestDocType] = useState('clinical_note');
  const [ingestDomain, setIngestDomain] = useState('clinical');
  const [ingestDate, setIngestDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [ingesting, setIngesting] = useState(false);
  const [ingestSuccess, setIngestSuccess] = useState<string | null>(null);
  const [ingestError, setIngestError] = useState<string | null>(null);

  // Load Patient Knowledge Bank
  const loadKnowledge = useCallback(async () => {
    if (!patientId) return;
    setLoadingKnowledge(true);
    setKnowledgeError(null);
    try {
      const res = await apiClient.getPatientKnowledge(patientId, {
        case_id: caseId,
        limit: 100,
      });
      setKnowledgeChunks(res.chunks || []);
    } catch (err: unknown) {
      setKnowledgeError(err instanceof Error ? err.message : 'Failed to load patient knowledge bank');
    } finally {
      setLoadingKnowledge(false);
    }
  }, [patientId, caseId]);

  useEffect(() => {
    loadKnowledge();
  }, [loadKnowledge]);

  // Execute Patient-Scoped Semantic Search
  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;

    setSearching(true);
    setHasSearched(true);
    try {
      const res = await apiClient.searchEvidence({
        patient_id: patientId,
        query: searchQuery.trim(),
        case_id: caseId || undefined,
        domain: searchDomain || undefined,
        document_type: searchType || undefined,
        top_k: topK,
        match_threshold: 0.0,
        temporal_scope: temporalScope,
      });
      setRetrievedEvidence(res.evidence || []);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Evidence search failed');
    } finally {
      setSearching(false);
    }
  };

  // Ingest Text or File
  const handleIngest = async (e: React.FormEvent) => {
    e.preventDefault();
    setIngesting(true);
    setIngestSuccess(null);
    setIngestError(null);

    try {
      if (ingestMode === 'text') {
        if (!ingestTextContent.trim()) {
          throw new Error('Please enter clinical text to ingest.');
        }
        const res = await apiClient.ingestText({
          patient_id: patientId,
          content: ingestTextContent,
          filename: ingestFilename || 'clinical_note.txt',
          document_type: ingestDocType,
          case_id: caseId || undefined,
          domain: ingestDomain,
          event_date: ingestDate,
        });
        setIngestSuccess(res.message);
        setIngestTextContent('');
      } else {
        if (!selectedFile) {
          throw new Error('Please select a PDF or document file to upload.');
        }
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('patient_id', patientId);
        if (caseId) formData.append('case_id', caseId);
        formData.append('document_type', ingestDocType);
        formData.append('domain', ingestDomain);
        if (ingestDate) formData.append('event_date', ingestDate);

        const res = await apiClient.ingestFile(formData);
        setIngestSuccess(res.message);
        setSelectedFile(null);
      }

      await loadKnowledge();
      setTimeout(() => {
        setIngestModalOpen(false);
        setIngestSuccess(null);
      }, 1200);
    } catch (err: unknown) {
      setIngestError(err instanceof Error ? err.message : 'Ingestion failed');
    } finally {
      setIngesting(false);
    }
  };

  // Delete chunk
  const handleDeleteChunk = async (chunkId: string) => {
    if (!confirm('Are you sure you want to remove this knowledge chunk?')) return;
    try {
      await apiClient.deleteKnowledgeChunk(chunkId);
      setKnowledgeChunks((prev) => prev.filter((c) => c.id !== chunkId));
      setRetrievedEvidence((prev) => prev.filter((c) => c.id !== chunkId));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to delete chunk');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner: Patient Knowledge Overview & Security */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-xl border border-[#D9C6B7] bg-gradient-to-r from-slate-900/90 via-slate-900/70 to-indigo-950/30 backdrop-blur">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <BrainCircuit className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white tracking-tight">Patient Knowledge Bank</h2>
              <p className="text-xs text-[#6E5D4F]">
                Patient-scoped clinical vector store powered by pgvector (384-dim HNSW embeddings)
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <Badge className="bg-emerald-950/60 text-emerald-400 border border-emerald-800/60 flex items-center gap-1.5 text-xs py-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              Server-Side Patient Isolation Active
            </Badge>
            <Badge className="bg-[#F2E4D5] text-[#8B6F5B] border border-[#D9C6B7] flex items-center gap-1.5 text-xs py-1">
              <BookOpen className="w-3.5 h-3.5 text-[#8B6F5B]" />
              {knowledgeChunks.length} Knowledge Chunks Indexed
            </Badge>
            {patientName && (
              <Badge className="bg-[#FAF6F0] text-[#5A4D3B] border border-[#D9C6B7] text-xs py-1">
                Active Scope: {patientName}
              </Badge>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={loadKnowledge}
            disabled={loadingKnowledge}
            className="border-[#D9C6B7] hover:bg-[#FAF6F0] text-[#5A4D3B] text-xs flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingKnowledge ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => setIngestModalOpen(true)}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs flex items-center gap-1.5 shadow-lg shadow-indigo-600/20"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Clinical Knowledge
          </Button>
        </div>
      </div>

      {/* Semantic Retrieval Search Section */}
      <Card className="border-[#D9C6B7] bg-white shadow-lg">
        <CardHeader className="pb-3 border-b border-[#D9C6B7]">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base text-white font-medium flex items-center gap-2">
              <Search className="w-4 h-4 text-indigo-400" />
              Semantic Evidence Retrieval
            </CardTitle>
            <span className="text-xs text-[#6E5D4F]">Queries execute against patient vector subspace</span>
          </div>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          <form onSubmit={handleSearch} className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-3 w-4 h-4 text-[#6E5D4F]" />
                <input
                  type="text"
                  placeholder="Ask a clinical question or enter symptoms (e.g. 'previous hypertension history', 'abnormal ECG findings')..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white border border-[#D9C6B7] rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                />
              </div>
              <Button
                type="submit"
                disabled={searching || !searchQuery.trim()}
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 text-sm font-medium flex items-center gap-2 shrink-0 shadow-md"
              >
                {searching ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Searching...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Search Patient Evidence
                  </>
                )}
              </Button>
            </div>

            {/* Filters Row */}
            <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-[#6E5D4F]">
              <div className="flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-[#6E5D4F]" />
                <span>Filters:</span>
              </div>
              <select
                value={searchDomain}
                onChange={(e) => setSearchDomain(e.target.value)}
                className="bg-[#FAF6F0] border border-[#D9C6B7] rounded px-2.5 py-1 text-[#5A4D3B] focus:outline-none"
              >
                <option value="">All Domains</option>
                <option value="cardiology">Cardiology</option>
                <option value="pulmonology">Pulmonology</option>
                <option value="radiology">Radiology</option>
                <option value="oncology">Oncology</option>
                <option value="general">General</option>
                <option value="clinical">Clinical</option>
              </select>

              <select
                value={searchType}
                onChange={(e) => setSearchType(e.target.value)}
                className="bg-[#FAF6F0] border border-[#D9C6B7] rounded px-2.5 py-1 text-[#5A4D3B] focus:outline-none"
              >
                <option value="">All Document Types</option>
                <option value="discharge_summary">Discharge Summary</option>
                <option value="radiology_report">Radiology Report</option>
                <option value="clinical_note">Clinical Note</option>
                <option value="lab_report">Lab Report</option>
                <option value="prescription">Prescription</option>
              </select>

              <div className="flex items-center gap-1.5 bg-[#FAF6F0] border border-[#D9C6B7] rounded px-2.5 py-1">
                <Calendar className="w-3.5 h-3.5 text-[#8B6F5B]" />
                <span className="text-[#6E5D4F]">Timeline:</span>
                <select
                  value={temporalScope}
                  onChange={(e) => setTemporalScope(e.target.value as any)}
                  className="bg-transparent text-[#8B6F5B] font-medium focus:outline-none"
                >
                  <option value="all">All Evidence (Current &amp; Historical)</option>
                  <option value="current">Current Encounter Only (&le;30d)</option>
                  <option value="historical">Historical Records Only (&gt;30d)</option>
                </select>
              </div>

              <div className="flex items-center gap-1 ml-auto">
                <span>Top Results:</span>
                <select
                  value={topK}
                  onChange={(e) => setTopK(Number(e.target.value))}
                  className="bg-[#FAF6F0] border border-[#D9C6B7] rounded px-2 py-1 text-[#5A4D3B] focus:outline-none"
                >
                  <option value={3}>3</option>
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                </select>
              </div>
            </div>
          </form>

          {/* Quick Query Pills */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-xs text-[#6E5D4F]">Suggested:</span>
            {[
              'hypertension history',
              'previous asthma',
              'abnormal chest xray',
              'blood pressure & medications',
              'discharge recommendations',
            ].map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => {
                  setSearchQuery(q);
                }}
                className="px-2.5 py-1 rounded bg-[#FAF6F0] hover:bg-[#FAF6F0] text-xs text-[#5A4D3B] border border-[#D9C6B7] transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* RETRIEVED EVIDENCE RESULTS SECTION */}
      {hasSearched && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              Retrieved Evidence
              <Badge className="bg-indigo-950 text-indigo-300 border border-indigo-800 text-xs ml-1">
                {retrievedEvidence.length} Found
              </Badge>
            </h3>
            <span className="text-xs text-[#6E5D4F]">Strictly isolated to Patient ID: {patientId.slice(0, 8)}...</span>
          </div>

          {retrievedEvidence.length === 0 ? (
            <Card className="border-[#D9C6B7] bg-white/30 p-8 text-center">
              <AlertCircle className="w-8 h-8 text-amber-400/80 mx-auto mb-2" />
              <p className="text-sm font-medium text-[#5A4D3B]">No matching evidence found for this patient.</p>
              <p className="text-xs text-[#6E5D4F] mt-1">
                Verify terms or ingest relevant clinical documents into this patient's knowledge store.
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {retrievedEvidence.map((evidence, idx) => (
                <Card
                  key={evidence.id || idx}
                  className="border-[#D9C6B7] bg-white/70 hover:border-indigo-500/40 transition-all shadow-md overflow-hidden"
                >
                  <CardContent className="p-5 space-y-3.5">
                    {/* Metadata Header Line */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[#D9C6B7] text-xs">
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Evidence Type */}
                        <Badge className="bg-indigo-950/80 text-indigo-300 border border-indigo-800 font-mono text-[11px] capitalize">
                          {evidence.document_type.replace('_', ' ')}
                        </Badge>
                        {/* Domain */}
                        <Badge className="bg-[#FAF6F0] text-[#5A4D3B] border border-[#D9C6B7] capitalize text-[11px]">
                          {evidence.domain}
                        </Badge>
                        {/* Temporal Category Distinction */}
                        {evidence.temporal_category === 'CURRENT' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold font-mono tracking-wider bg-[#F2E4D5]/90 text-[#8B6F5B] border border-[#8B6F5B]/60 animate-pulse">
                            ⚡ CURRENT EVIDENCE {evidence.days_offset !== null && evidence.days_offset !== undefined ? `(${evidence.days_offset}d)` : ''}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold font-mono tracking-wider bg-indigo-950/70 text-indigo-300 border border-indigo-700/50">
                            🕰️ HISTORICAL RECORD {evidence.days_offset !== null && evidence.days_offset !== undefined ? `(${evidence.days_offset}d ago)` : ''}
                          </span>
                        )}
                      </div>

                      {/* Similarity Match */}
                      <div className="flex items-center gap-2">
                        <span className="text-[#6E5D4F]">Similarity:</span>
                        <Badge className="bg-emerald-950/70 text-emerald-400 border border-emerald-800/80 font-mono font-semibold text-xs">
                          {(evidence.similarity * 100).toFixed(1)}% match
                        </Badge>
                      </div>
                    </div>

                    {/* Content Excerpt */}
                    <div className="p-3.5 rounded-lg bg-white border border-[#D9C6B7]/90 text-[#3B2A1C] text-sm leading-relaxed whitespace-pre-wrap font-sans">
                      {evidence.clean_content || evidence.content}
                    </div>

                    {/* Provenance & Temporal Context Badges */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs text-[#6E5D4F]">
                      {/* Source Document */}
                      <div className="flex items-center gap-1.5 p-2 rounded bg-[#FCF9F5] border border-[#D9C6B7] truncate">
                        <FileText className="w-3.5 h-3.5 text-[#8B6F5B] shrink-0" />
                        <span className="text-[#6E5D4F] shrink-0">Source:</span>
                        <span className="text-[#3B2A1C] truncate font-medium" title={evidence.filename}>
                          {evidence.filename}
                        </span>
                      </div>

                      {/* Page */}
                      <div className="flex items-center gap-1.5 p-2 rounded bg-[#FCF9F5] border border-[#D9C6B7]">
                        <Layers className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span className="text-[#6E5D4F]">Page:</span>
                        <span className="text-[#3B2A1C] font-medium">Page {evidence.page_number}</span>
                      </div>

                      {/* Date */}
                      <div className="flex items-center gap-1.5 p-2 rounded bg-[#FCF9F5] border border-[#D9C6B7]">
                        <Calendar className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span className="text-[#6E5D4F]">Date:</span>
                        <span className="text-[#3B2A1C] font-medium">{evidence.event_date || 'N/A'}</span>
                      </div>

                      {/* Chunk Index */}
                      <div className="flex items-center gap-1.5 p-2 rounded bg-[#FCF9F5] border border-[#D9C6B7]">
                        <Compass className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                        <span className="text-[#6E5D4F]">Chunk:</span>
                        <span className="text-[#3B2A1C] font-medium">#{evidence.chunk_index}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* COMPLETE PATIENT KNOWLEDGE BANK CHUNKS LIST */}
      <Card className="border-[#D9C6B7] bg-white shadow-lg">
        <CardHeader className="pb-3 border-b border-[#D9C6B7]">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base text-white font-medium flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-[#8B6F5B]" />
              Indexed Patient Knowledge ({knowledgeChunks.length} chunks)
            </CardTitle>
            <span className="text-xs text-[#6E5D4F]">All chunks stored in pgvector for this patient</span>
          </div>
        </CardHeader>
        <CardContent className="pt-4 space-y-3">
          {knowledgeError && (
            <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{knowledgeError}</span>
            </div>
          )}

          {loadingKnowledge ? (
            <div className="flex items-center justify-center p-8 text-[#6E5D4F] text-sm gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
              Loading patient knowledge store...
            </div>
          ) : knowledgeChunks.length === 0 ? (
            <div className="p-8 text-center text-[#6E5D4F]">
              <FileCheck2 className="w-8 h-8 text-[#6E5D4F] mx-auto mb-2" />
              <p className="text-sm font-medium text-[#5A4D3B]">No knowledge chunks indexed yet for this patient.</p>
              <p className="text-xs text-[#6E5D4F] mt-1">
                Click "Add Clinical Knowledge" above to ingest clinical notes, lab reports, or PDF summaries.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {knowledgeChunks.map((chunk) => (
                <div
                  key={chunk.id}
                  className="p-4 rounded-lg bg-[#FCF9F5] border border-[#D9C6B7] hover:border-[#D9C6B7] transition-all flex flex-col md:flex-row md:items-start justify-between gap-3 text-xs"
                >
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-[11px]">
                      <Badge className="bg-[#FAF6F0] text-[#8B6F5B] border border-[#D9C6B7] capitalize">
                        {chunk.document_type.replace('_', ' ')}
                      </Badge>
                      <Badge className="bg-[#FAF6F0] text-[#5A4D3B] border border-[#D9C6B7] capitalize">
                        {chunk.domain}
                      </Badge>
                      <span className="text-[#6E5D4F] flex items-center gap-1">
                        <FileText className="w-3 h-3 text-[#6E5D4F]" />
                        {chunk.filename}
                      </span>
                      <span className="text-[#6E5D4F]">•</span>
                      <span className="text-[#6E5D4F]">Page {chunk.page_number}</span>
                      <span className="text-[#6E5D4F]">•</span>
                      <span className="text-[#6E5D4F]">Date: {chunk.event_date}</span>
                    </div>

                    <p className="text-[#5A4D3B] text-xs leading-relaxed whitespace-pre-wrap font-sans bg-white p-2.5 rounded border border-[#D9C6B7]">
                      {chunk.clean_content || chunk.content}
                    </p>
                  </div>

                  <div className="shrink-0 flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteChunk(chunk.id)}
                      className="text-[#6E5D4F] hover:text-rose-400 hover:bg-rose-950/20 p-1.5 h-auto text-xs"
                      title="Remove chunk"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Ingestion Modal */}
      {ingestModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-[#D9C6B7] rounded-xl shadow-2xl max-w-xl w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#D9C6B7]">
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-indigo-400" />
                Ingest Clinical Document into Knowledge Store
              </h3>
              <button
                onClick={() => setIngestModalOpen(false)}
                className="text-[#6E5D4F] hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            {/* Ingestion Mode Toggle */}
            <div className="flex rounded-lg bg-[#FAF6F0] p-1 border border-[#D9C6B7]">
              <button
                type="button"
                onClick={() => setIngestMode('text')}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${
                  ingestMode === 'text' ? 'bg-indigo-600 text-white shadow' : 'text-[#6E5D4F] hover:text-white'
                }`}
              >
                Direct Text / Clinical Note
              </button>
              <button
                type="button"
                onClick={() => setIngestMode('file')}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${
                  ingestMode === 'file' ? 'bg-indigo-600 text-white shadow' : 'text-[#6E5D4F] hover:text-white'
                }`}
              >
                Upload Document (PDF / TXT)
              </button>
            </div>

            <form onSubmit={handleIngest} className="space-y-3.5 text-xs">
              {ingestMode === 'text' ? (
                <div>
                  <label className="block text-[#5A4D3B] font-medium mb-1">Clinical Note / Document Text</label>
                  <textarea
                    rows={5}
                    value={ingestTextContent}
                    onChange={(e) => setIngestTextContent(e.target.value)}
                    placeholder="Enter clinical notes, discharge summaries, medical history, or laboratory findings..."
                    className="w-full bg-[#FAF6F0] border border-[#D9C6B7] rounded-lg p-3 text-white text-xs placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-[#5A4D3B] font-medium mb-1">Select Document (PDF, TXT, MD)</label>
                  <input
                    type="file"
                    accept=".pdf,.txt,.md"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    className="w-full bg-[#FAF6F0] border border-[#D9C6B7] rounded-lg p-2.5 text-white text-xs file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:bg-indigo-600 file:text-white hover:file:bg-indigo-500 cursor-pointer"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#5A4D3B] font-medium mb-1">Document Type</label>
                  <select
                    value={ingestDocType}
                    onChange={(e) => setIngestDocType(e.target.value)}
                    className="w-full bg-[#FAF6F0] border border-[#D9C6B7] rounded-lg p-2 text-white text-xs focus:outline-none"
                  >
                    <option value="clinical_note">Clinical Note</option>
                    <option value="discharge_summary">Discharge Summary</option>
                    <option value="radiology_report">Radiology Report</option>
                    <option value="lab_report">Lab Report</option>
                    <option value="prescription">Prescription</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[#5A4D3B] font-medium mb-1">Specialty Domain</label>
                  <select
                    value={ingestDomain}
                    onChange={(e) => setIngestDomain(e.target.value)}
                    className="w-full bg-[#FAF6F0] border border-[#D9C6B7] rounded-lg p-2 text-white text-xs focus:outline-none"
                  >
                    <option value="clinical">Clinical (General)</option>
                    <option value="cardiology">Cardiology</option>
                    <option value="pulmonology">Pulmonology</option>
                    <option value="radiology">Radiology</option>
                    <option value="oncology">Oncology</option>
                    <option value="neurology">Neurology</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#5A4D3B] font-medium mb-1">Filename</label>
                  <input
                    type="text"
                    value={ingestFilename}
                    onChange={(e) => setIngestFilename(e.target.value)}
                    placeholder="clinical_note.txt"
                    className="w-full bg-[#FAF6F0] border border-[#D9C6B7] rounded-lg p-2 text-white text-xs focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[#5A4D3B] font-medium mb-1">Clinical Event Date</label>
                  <input
                    type="date"
                    value={ingestDate}
                    onChange={(e) => setIngestDate(e.target.value)}
                    className="w-full bg-[#FAF6F0] border border-[#D9C6B7] rounded-lg p-2 text-white text-xs focus:outline-none"
                  />
                </div>
              </div>

              {ingestSuccess && (
                <div className="p-3 rounded-lg bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                  <span>{ingestSuccess}</span>
                </div>
              )}

              {ingestError && (
                <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{ingestError}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#D9C6B7]">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIngestModalOpen(false)}
                  className="border-[#D9C6B7] text-[#5A4D3B] hover:bg-[#FAF6F0] text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={ingesting}
                  size="sm"
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs flex items-center gap-1.5"
                >
                  {ingesting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Ingesting & Embedding...
                    </>
                  ) : (
                    <>
                      <UploadCloud className="w-3.5 h-3.5" />
                      Index into pgvector
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
