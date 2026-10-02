import React, { useState } from 'react';
import { apiClient } from '../../services/apiClient';
import type { ModelRegistryItem } from '../../types/api';
import { Button } from '../ui/button';
import {
  X,
  Plus,
  Loader2,
  AlertCircle,
} from 'lucide-react';

interface RegisterModelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onModelRegistered: (model: ModelRegistryItem) => void;
}

export const RegisterModelModal: React.FC<RegisterModelModalProps> = ({
  isOpen,
  onClose,
  onModelRegistered,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    id: '',
    name: '',
    version: '1.0.0',
    domain: 'pulmonology',
    modality: 'chest_xray',
    capabilities: 'chest_xray_screening, lung_abnormality_screening',
    framework: 'pytorch',
    artifact_source: 'https://huggingface.co/models/',
    parameter_count: '15000000',
    estimated_ram_mb: '1024',
    estimated_vram_mb: '2048',
    expected_latency_ms: '350',
    device_support: 'cpu, cuda',
    status: 'ready',
    license: 'Apache 2.0',
    checksum: '',
    author: 'Medical AI Research Lab',
    citation: 'Clinical Deep Learning Benchmarks (2025)',
    limitations: 'Investigational decision support only. Calibrated strictly on standard projections.',
  });

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.id.trim() || !form.name.trim() || !form.artifact_source.trim()) {
      setError('Model ID, Name, and Artifact Source are required.');
      return;
    }

    setLoading(true);
    try {
      const payload: Partial<ModelRegistryItem> = {
        id: form.id.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-'),
        name: form.name.trim(),
        version: form.version.trim(),
        domain: form.domain.trim(),
        modality: form.modality.trim(),
        capabilities: form.capabilities
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        framework: form.framework.trim(),
        artifact_source: form.artifact_source.trim(),
        parameter_count: parseInt(form.parameter_count, 10) || 0,
        estimated_ram_mb: parseInt(form.estimated_ram_mb, 10) || 512,
        estimated_vram_mb: parseInt(form.estimated_vram_mb, 10) || 1024,
        expected_latency_ms: parseInt(form.expected_latency_ms, 10) || 300,
        device_support: form.device_support
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        status: form.status,
        license: form.license.trim(),
        checksum: form.checksum.trim() || undefined,
        provenance: {
          author: form.author.trim(),
          citation: form.citation.trim(),
        },
        limitations: form.limitations
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
        metadata: {},
      };

      const created = await apiClient.registerModel(payload);
      onModelRegistered(created);
      onClose();
    } catch (err: any) {
      console.error('Failed to register model:', err);
      setError(err.message || 'Failed to register model in database.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#3B2A1C]/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white border border-[#D9C6B7] rounded-xl max-w-2xl w-full text-[#3B2A1C] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-5 border-b border-[#D9C6B7] flex items-center justify-between bg-[#FCF9F5]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[#F2E4D5] border border-[#D9C6B7] text-[#8B6F5B]">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#3B2A1C]">Register Specialized Model</h3>
              <p className="text-xs text-[#6E5D4F]">
                Register a validated deep learning model to the clinical registry
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-[#6E5D4F] hover:text-[#3B2A1C] hover:bg-[#FAF6F0]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
          {error && (
            <div className="p-3 rounded-lg bg-rose-950/50 border border-rose-500/50 text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-[#5A4D3B] font-semibold mb-1">Model Identifier (Slug) *</label>
              <input
                type="text"
                required
                placeholder="e.g. unet-brain-mri-seg"
                value={form.id}
                onChange={(e) => setForm({ ...form, id: e.target.value })}
                className="w-full bg-[#FAF6F0] border border-[#D9C6B7] rounded-lg px-3 py-2 text-[#3B2A1C] font-mono focus:outline-none focus:border-[#8B6F5B]"
              />
            </div>
            <div>
              <label className="block text-[#5A4D3B] font-semibold mb-1">Human-Readable Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. U-Net Brain MRI Tumor Segmenter"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full bg-[#FAF6F0] border border-[#D9C6B7] rounded-lg px-3 py-2 text-[#3B2A1C] focus:outline-none focus:border-[#8B6F5B]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[#5A4D3B] font-semibold mb-1">Version *</label>
              <input
                type="text"
                required
                value={form.version}
                onChange={(e) => setForm({ ...form, version: e.target.value })}
                className="w-full bg-[#FAF6F0] border border-[#D9C6B7] rounded-lg px-3 py-2 text-[#3B2A1C] font-mono focus:outline-none focus:border-[#8B6F5B]"
              />
            </div>
            <div>
              <label className="block text-[#5A4D3B] font-semibold mb-1">Clinical Domain *</label>
              <select
                value={form.domain}
                onChange={(e) => setForm({ ...form, domain: e.target.value })}
                className="w-full bg-[#FAF6F0] border border-[#D9C6B7] rounded-lg px-3 py-2 text-[#3B2A1C] focus:outline-none focus:border-[#8B6F5B]"
              >
                <option value="pulmonology">Pulmonology</option>
                <option value="neurology">Neurology</option>
                <option value="cardiology">Cardiology</option>
                <option value="dermatology">Dermatology</option>
                <option value="radiology">Radiology</option>
                <option value="oncology">Oncology</option>
              </select>
            </div>
            <div>
              <label className="block text-[#5A4D3B] font-semibold mb-1">Input Modality *</label>
              <select
                value={form.modality}
                onChange={(e) => setForm({ ...form, modality: e.target.value })}
                className="w-full bg-[#FAF6F0] border border-[#D9C6B7] rounded-lg px-3 py-2 text-[#3B2A1C] focus:outline-none focus:border-[#8B6F5B]"
              >
                <option value="chest_xray">Chest X-Ray</option>
                <option value="mri">Brain / Neuro MRI</option>
                <option value="ct">Head / Torso CT</option>
                <option value="ecg">12-Lead ECG</option>
                <option value="skin_image">Dermatology Skin Image</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-[#5A4D3B] font-semibold mb-1">Framework *</label>
              <input
                type="text"
                required
                placeholder="pytorch, torchxrayvision, onnx"
                value={form.framework}
                onChange={(e) => setForm({ ...form, framework: e.target.value })}
                className="w-full bg-[#FAF6F0] border border-[#D9C6B7] rounded-lg px-3 py-2 text-[#3B2A1C] focus:outline-none focus:border-[#8B6F5B]"
              />
            </div>
            <div>
              <label className="block text-[#5A4D3B] font-semibold mb-1">Status *</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="w-full bg-[#FAF6F0] border border-[#D9C6B7] rounded-lg px-3 py-2 text-[#3B2A1C] focus:outline-none focus:border-[#8B6F5B]"
              >
                <option value="ready">Ready (Active)</option>
                <option value="not_configured">Not Configured</option>
                <option value="model_unavailable">Model Unavailable</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[#5A4D3B] font-semibold mb-1">Target Capabilities (Comma Separated) *</label>
            <input
              type="text"
              required
              placeholder="e.g. brain_tumor_segmentation, edema_screening"
              value={form.capabilities}
              onChange={(e) => setForm({ ...form, capabilities: e.target.value })}
              className="w-full bg-[#FAF6F0] border border-[#D9C6B7] rounded-lg px-3 py-2 text-[#3B2A1C] focus:outline-none focus:border-[#8B6F5B]"
            />
          </div>

          <div>
            <label className="block text-[#5A4D3B] font-semibold mb-1">Artifact / Weights Source URL *</label>
            <input
              type="text"
              required
              placeholder="https://..."
              value={form.artifact_source}
              onChange={(e) => setForm({ ...form, artifact_source: e.target.value })}
              className="w-full bg-[#FAF6F0] border border-[#D9C6B7] rounded-lg px-3 py-2 text-[#3B2A1C] font-mono text-[11px] focus:outline-none focus:border-[#8B6F5B]"
            />
          </div>

          {/* Resource Estimates */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-[#FCF9F5] p-3 rounded-lg border border-[#D9C6B7]">
            <div>
              <label className="block text-[#6E5D4F] text-[10px] mb-1 uppercase">Parameters</label>
              <input
                type="number"
                value={form.parameter_count}
                onChange={(e) => setForm({ ...form, parameter_count: e.target.value })}
                className="w-full bg-[#FAF6F0] border border-[#D9C6B7] rounded px-2 py-1 text-[#3B2A1C] font-mono text-xs"
              />
            </div>
            <div>
              <label className="block text-[#6E5D4F] text-[10px] mb-1 uppercase">RAM (MB)</label>
              <input
                type="number"
                value={form.estimated_ram_mb}
                onChange={(e) => setForm({ ...form, estimated_ram_mb: e.target.value })}
                className="w-full bg-[#FAF6F0] border border-[#D9C6B7] rounded px-2 py-1 text-[#3B2A1C] font-mono text-xs"
              />
            </div>
            <div>
              <label className="block text-[#6E5D4F] text-[10px] mb-1 uppercase">VRAM (MB)</label>
              <input
                type="number"
                value={form.estimated_vram_mb}
                onChange={(e) => setForm({ ...form, estimated_vram_mb: e.target.value })}
                className="w-full bg-[#FAF6F0] border border-[#D9C6B7] rounded px-2 py-1 text-[#3B2A1C] font-mono text-xs"
              />
            </div>
            <div>
              <label className="block text-[#6E5D4F] text-[10px] mb-1 uppercase">Latency (ms)</label>
              <input
                type="number"
                value={form.expected_latency_ms}
                onChange={(e) => setForm({ ...form, expected_latency_ms: e.target.value })}
                className="w-full bg-[#FAF6F0] border border-[#D9C6B7] rounded px-2 py-1 text-[#3B2A1C] font-mono text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-[#5A4D3B] font-semibold mb-1">License Designation *</label>
              <input
                type="text"
                required
                value={form.license}
                onChange={(e) => setForm({ ...form, license: e.target.value })}
                className="w-full bg-[#FAF6F0] border border-[#D9C6B7] rounded-lg px-3 py-2 text-[#3B2A1C] focus:outline-none focus:border-[#8B6F5B]"
              />
            </div>
            <div>
              <label className="block text-[#5A4D3B] font-semibold mb-1">Weights SHA-256 Checksum (Optional)</label>
              <input
                type="text"
                placeholder="64-character hex hash"
                value={form.checksum}
                onChange={(e) => setForm({ ...form, checksum: e.target.value })}
                className="w-full bg-[#FAF6F0] border border-[#D9C6B7] rounded-lg px-3 py-2 text-[#3B2A1C] font-mono text-[11px] focus:outline-none focus:border-[#8B6F5B]"
              />
            </div>
          </div>

          <div>
            <label className="block text-[#5A4D3B] font-semibold mb-1">Clinical Limitations & Warnings (One per line)</label>
            <textarea
              rows={2}
              value={form.limitations}
              onChange={(e) => setForm({ ...form, limitations: e.target.value })}
              className="w-full bg-[#FAF6F0] border border-[#D9C6B7] rounded-lg px-3 py-2 text-[#3B2A1C] resize-none focus:outline-none focus:border-[#8B6F5B]"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-[#D9C6B7] flex items-center justify-end gap-2.5">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="text-xs bg-[#FAF6F0] border-[#D9C6B7] text-[#5A4D3B]"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-[#8B6F5B] hover:bg-[#5A4D3B] text-white font-medium shadow-sm text-xs px-4"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Registering...
                </>
              ) : (
                'Register Model'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
