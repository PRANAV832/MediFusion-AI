import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog } from '../ui/dialog';
import { Button } from '../ui/button';
import { apiClient } from '../../services/apiClient';
import type { PatientRecord, CaseRecord } from '../../types/api';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

interface CreateCaseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultPatientId?: string;
  defaultPatientName?: string;
  onCaseCreated?: (newCase: CaseRecord) => void;
}

export const CreateCaseModal: React.FC<CreateCaseModalProps> = ({
  open,
  onOpenChange,
  defaultPatientId,
  defaultPatientName,
  onCaseCreated,
}) => {
  const navigate = useNavigate();
  const [patients, setPatients] = useState<PatientRecord[]>([]);
  const [loadingPatients, setLoadingPatients] = useState(false);

  const [patientId, setPatientId] = useState(defaultPatientId || '');
  const [title, setTitle] = useState('');
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [symptomsInput, setSymptomsInput] = useState('');
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [priority, setPriority] = useState<'routine' | 'urgent' | 'stat'>('routine');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (defaultPatientId) {
      setPatientId(defaultPatientId);
    }
  }, [defaultPatientId]);

  useEffect(() => {
    if (open && !defaultPatientId && patients.length === 0) {
      setLoadingPatients(true);
      apiClient
        .getPatients()
        .then((res) => {
          setPatients(res);
          if (res.length > 0 && !patientId) {
            setPatientId(res[0].id);
          }
        })
        .catch(() => {})
        .finally(() => setLoadingPatients(false));
    }
  }, [open, defaultPatientId, patients.length, patientId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientId) {
      setError('Please select a patient.');
      return;
    }
    if (!title.trim()) {
      setError('Please enter a clinical case title.');
      return;
    }
    if (!chiefComplaint.trim()) {
      setError('Please enter a chief complaint.');
      return;
    }

    setSubmitting(true);
    setError(null);

    const parsedSymptoms = symptomsInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    try {
      const createdCase = await apiClient.createCase({
        patient_id: patientId,
        title: title.trim(),
        chief_complaint: chiefComplaint.trim(),
        symptoms: parsedSymptoms,
        clinical_notes: clinicalNotes.trim() || undefined,
        priority,
      });

      setSuccess(true);
      if (onCaseCreated) {
        onCaseCreated(createdCase);
      }

      setTimeout(() => {
        setSuccess(false);
        onOpenChange(false);
        setTitle('');
        setChiefComplaint('');
        setSymptomsInput('');
        setClinicalNotes('');
        setPriority('routine');
        navigate(`/cases/${createdCase.id}`);
      }, 700);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create case';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Initialize New Clinical Case"
      description="Establish a diagnostic case container for multimodal imaging, biosignals, and clinical documents."
      className="max-w-2xl"
    >
      {error && (
        <div className="flex items-center gap-2.5 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm mb-3">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2.5 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-sm mb-3">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
          <span>Clinical case created successfully! Loading workspace...</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Patient Selector */}
        <div>
          <label className="block text-xs font-semibold text-[#5A4D3B] mb-1.5 uppercase tracking-wider">
            Associated Patient *
          </label>
          {defaultPatientName ? (
            <div className="px-3.5 py-2 rounded-lg bg-[#FCF9F5] border border-[#D9C6B7] text-[#3B2A1C] text-sm font-medium">
              {defaultPatientName}
            </div>
          ) : loadingPatients ? (
            <div className="flex items-center gap-2 text-xs text-[#6E5D4F] py-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-[#8B6F5B]" />
              Loading patient directory...
            </div>
          ) : (
            <select
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
              required
              className="w-full px-3.5 py-2 rounded-lg bg-[#FAF6F0] border border-[#D9C6B7] text-[#3B2A1C] text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
            >
              <option value="">Select a patient</option>
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
            <label className="block text-xs font-semibold text-[#5A4D3B] mb-1.5 uppercase tracking-wider">
              Case Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Cardiopulmonary Screening & Evaluation"
              required
              className="w-full px-3.5 py-2 rounded-lg bg-[#FAF6F0] border border-[#D9C6B7] text-[#3B2A1C] placeholder:text-[#6E5D4F] text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#5A4D3B] mb-1.5 uppercase tracking-wider">
              Priority
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as 'routine' | 'urgent' | 'stat')}
              className="w-full px-3.5 py-2 rounded-lg bg-[#FAF6F0] border border-[#D9C6B7] text-[#3B2A1C] text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
            >
              <option value="routine">Routine</option>
              <option value="urgent">Urgent</option>
              <option value="stat">STAT / Immediate</option>
            </select>
          </div>
        </div>

        {/* Chief Complaint */}
        <div>
          <label className="block text-xs font-semibold text-[#5A4D3B] mb-1.5 uppercase tracking-wider">
            Chief Complaint *
          </label>
          <input
            type="text"
            value={chiefComplaint}
            onChange={(e) => setChiefComplaint(e.target.value)}
            placeholder="Primary symptom or presentation reason"
            required
            className="w-full px-3.5 py-2 rounded-lg bg-[#FAF6F0] border border-[#D9C6B7] text-[#3B2A1C] placeholder:text-[#6E5D4F] text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
          />
        </div>

        {/* Symptoms Context */}
        <div>
          <label className="block text-xs font-semibold text-[#5A4D3B] mb-1.5 uppercase tracking-wider">
            Symptoms / Context (Comma separated)
          </label>
          <input
            type="text"
            value={symptomsInput}
            onChange={(e) => setSymptomsInput(e.target.value)}
            placeholder="e.g. Shortness of breath, Chest tightness, Diaphoresis"
            className="w-full px-3.5 py-2 rounded-lg bg-[#FAF6F0] border border-[#D9C6B7] text-[#3B2A1C] placeholder:text-[#6E5D4F] text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
          />
        </div>

        {/* Clinical Notes */}
        <div>
          <label className="block text-xs font-semibold text-[#5A4D3B] mb-1.5 uppercase tracking-wider">
            Clinical Notes & Intake Findings
          </label>
          <textarea
            rows={3}
            value={clinicalNotes}
            onChange={(e) => setClinicalNotes(e.target.value)}
            placeholder="Document physical examination observations, history of present illness, or intake instructions..."
            className="w-full px-3.5 py-2 rounded-lg bg-[#FAF6F0] border border-[#D9C6B7] text-[#3B2A1C] placeholder:text-[#6E5D4F] text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500 resize-none"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#D9C6B7]">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
            className="border-[#D9C6B7] text-[#6E5D4F] hover:text-[#3B2A1C]"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={submitting}
            className="bg-[#8B6F5B] hover:bg-[#5A4D3B] text-slate-950 font-semibold"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Creating Case...
              </>
            ) : (
              'Create & Open Case'
            )}
          </Button>
        </div>
      </form>
    </Dialog>
  );
};
