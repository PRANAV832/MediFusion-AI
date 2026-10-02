import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { apiClient } from '../services/apiClient';
import type { PatientRecord } from '../types/api';
import { AlertCircle, ArrowLeft, BriefcaseMedical, CheckCircle2, Loader2 } from 'lucide-react';
import { MedicalSafetyBanner } from '../components/ui/clinical-badges';

export const NewCasePage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialPatientId = searchParams.get('patient_id') || '';

  const [patients, setPatients] = useState<PatientRecord[]>([]);
  const [loadingPatients, setLoadingPatients] = useState(false);

  const [patientId, setPatientId] = useState(initialPatientId);
  const [title, setTitle] = useState('');
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [symptomsInput, setSymptomsInput] = useState('');
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [priority, setPriority] = useState<'routine' | 'urgent' | 'stat'>('routine');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    setLoadingPatients(true);
    apiClient
      .getPatients()
      .then((data) => {
        setPatients(data);
        if (!patientId && data.length > 0) {
          setPatientId(data[0].id);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingPatients(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientId) {
      setError('Please select a patient.');
      return;
    }
    if (!title.trim()) {
      setError('Please provide a clinical case title.');
      return;
    }
    if (!chiefComplaint.trim()) {
      setError('Please describe the chief complaint.');
      return;
    }

    setSubmitting(true);
    setError(null);

    const symptoms = symptomsInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    try {
      const created = await apiClient.createCase({
        patient_id: patientId,
        title: title.trim(),
        chief_complaint: chiefComplaint.trim(),
        symptoms,
        clinical_notes: clinicalNotes.trim() || undefined,
        priority,
      });

      setSuccess(true);
      setTimeout(() => {
        navigate(`/cases/${created.id}`);
      }, 600);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create case');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Medical Safety Notice */}
      <MedicalSafetyBanner />

      <div className="flex items-center gap-3">
        <Link
          to="/patients"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-[#D9C6B7] text-xs font-semibold text-[#6E5D4F] hover:text-[#3B2A1C] hover:bg-[#F2E4D5] transition-colors shadow-sm"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Directory
        </Link>
        <span className="text-[#D9C6B7]">/</span>
        <span className="text-xs text-[#6E5D4F] font-medium">New Case Intake</span>
      </div>

      <Card className="p-6 bg-white border-[#D9C6B7] shadow-sm space-y-5">
        <div>
          <h1 className="text-xl font-bold text-[#3B2A1C] flex items-center gap-2">
            <BriefcaseMedical className="h-6 w-6 text-[#8B6F5B]" />
            Initialize Clinical Case Container
          </h1>
          <p className="text-xs text-[#6E5D4F] mt-1">
            Establish patient-associated clinical case before uploading multimodal assets.
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2 font-medium">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 font-medium">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-700" />
            <span>Case initialized! Redirecting to multimodal intake workspace...</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Patient Selection */}
          <div>
            <label className="block text-xs font-semibold text-[#3B2A1C] mb-1.5 uppercase tracking-wider">
              Patient *
            </label>
            {loadingPatients ? (
              <div className="flex items-center gap-2 text-xs text-[#8B6F5B] py-2">
                <Loader2 className="h-4 w-4 animate-spin text-[#8B6F5B]" />
                Loading patients...
              </div>
            ) : (
              <select
                value={patientId}
                onChange={(e) => setPatientId(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 rounded-lg bg-[#FAF6F0] border border-[#D9C6B7] text-[#3B2A1C] text-sm focus:outline-none focus:border-[#8B6F5B] focus:bg-white focus:ring-1 focus:ring-[#8B6F5B]"
              >
                <option value="">Select target patient</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.first_name} {p.last_name} ({p.mrn})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Title & Priority */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-[#3B2A1C] mb-1.5 uppercase tracking-wider">
                Case Title *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Cardiopulmonary Screening & Chest Workup"
                required
                className="w-full px-3.5 py-2.5 rounded-lg bg-[#FAF6F0] border border-[#D9C6B7] text-[#3B2A1C] placeholder-[#8B6F5B]/50 text-sm focus:outline-none focus:border-[#8B6F5B] focus:bg-white focus:ring-1 focus:ring-[#8B6F5B]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#3B2A1C] mb-1.5 uppercase tracking-wider">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as 'routine' | 'urgent' | 'stat')}
                className="w-full px-3.5 py-2.5 rounded-lg bg-[#FAF6F0] border border-[#D9C6B7] text-[#3B2A1C] text-sm focus:outline-none focus:border-[#8B6F5B] focus:bg-white focus:ring-1 focus:ring-[#8B6F5B]"
              >
                <option value="routine">Routine</option>
                <option value="urgent">Urgent</option>
                <option value="stat">STAT / Immediate</option>
              </select>
            </div>
          </div>

          {/* Chief Complaint */}
          <div>
            <label className="block text-xs font-semibold text-[#3B2A1C] mb-1.5 uppercase tracking-wider">
              Chief Complaint *
            </label>
            <input
              type="text"
              value={chiefComplaint}
              onChange={(e) => setChiefComplaint(e.target.value)}
              placeholder="Primary symptom or presentation reason"
              required
              className="w-full px-3.5 py-2.5 rounded-lg bg-[#FAF6F0] border border-[#D9C6B7] text-[#3B2A1C] placeholder-[#8B6F5B]/50 text-sm focus:outline-none focus:border-[#8B6F5B] focus:bg-white focus:ring-1 focus:ring-[#8B6F5B]"
            />
          </div>

          {/* Symptoms */}
          <div>
            <label className="block text-xs font-semibold text-[#3B2A1C] mb-1.5 uppercase tracking-wider">
              Symptoms / Context (Comma-separated)
            </label>
            <input
              type="text"
              value={symptomsInput}
              onChange={(e) => setSymptomsInput(e.target.value)}
              placeholder="e.g. Dyspnea on exertion, Diaphoresis, Substernal tightness"
              className="w-full px-3.5 py-2.5 rounded-lg bg-[#FAF6F0] border border-[#D9C6B7] text-[#3B2A1C] placeholder-[#8B6F5B]/50 text-sm focus:outline-none focus:border-[#8B6F5B] focus:bg-white focus:ring-1 focus:ring-[#8B6F5B]"
            />
          </div>

          {/* Clinical Notes */}
          <div>
            <label className="block text-xs font-semibold text-[#3B2A1C] mb-1.5 uppercase tracking-wider">
              Clinical Notes & Preliminary Assessment
            </label>
            <textarea
              rows={3}
              value={clinicalNotes}
              onChange={(e) => setClinicalNotes(e.target.value)}
              placeholder="Document physical exam notes, vital signs, or clinical impressions..."
              className="w-full px-3.5 py-2.5 rounded-lg bg-[#FAF6F0] border border-[#D9C6B7] text-[#3B2A1C] placeholder-[#8B6F5B]/50 text-sm focus:outline-none focus:border-[#8B6F5B] focus:bg-white focus:ring-1 focus:ring-[#8B6F5B] resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#D9C6B7]">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(-1)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Creating Case Container...
                </>
              ) : (
                'Create Case & Open Workspace'
              )}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};
