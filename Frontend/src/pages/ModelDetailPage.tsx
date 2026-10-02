import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { apiClient } from '../services/apiClient';
import type { ModelHealthInfo, ModelRegistryItem } from '../types/api';
import { ModelStatusPill } from '../components/registry/ModelStatusPill';
import { ModelProvenanceView } from '../components/registry/ModelProvenanceView';
import { ModelLimitationsView } from '../components/registry/ModelLimitationsView';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import {
  ArrowLeft,
  Cpu,
  RefreshCw,
  Activity,
  Copy,
  Check,
} from 'lucide-react';

export const ModelDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [model, setModel] = useState<ModelRegistryItem | null>(null);
  const [health, setHealth] = useState<ModelHealthInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkingHealth, setCheckingHealth] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedJson, setCopiedJson] = useState(false);

  const fetchModel = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.getRegistryModel(id);
      setModel(data);

      // Auto-fetch health
      try {
        const h = await apiClient.getModelHealth(id);
        setHealth(h);
      } catch (hErr) {
        console.warn('Could not retrieve model health:', hErr);
      }
    } catch (err: any) {
      console.error('Failed to load model details:', err);
      setError(err.message || 'Model not found in registry.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchModel();
  }, [fetchModel]);

  const handleCheckHealth = async () => {
    if (!id) return;
    setCheckingHealth(true);
    try {
      const h = await apiClient.getModelHealth(id);
      setHealth(h);
    } catch (err) {
      console.error('Health check failed:', err);
    } finally {
      setCheckingHealth(false);
    }
  };

  const handleCopyJson = () => {
    if (!model) return;
    navigator.clipboard.writeText(JSON.stringify(model, null, 2));
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

  if (loading) {
    return (
      <div className="p-16 text-center text-slate-400">
        <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-cyan-400" />
        <p className="text-sm">Loading specialized model profile...</p>
      </div>
    );
  }

  if (error || !model) {
    return (
      <div className="max-w-3xl mx-auto p-8 text-center space-y-4">
        <div className="p-4 bg-rose-950/40 border border-rose-500/50 rounded-xl text-rose-300 text-sm">
          {error || 'Model not found in database registry.'}
        </div>
        <Link to="/registry">
          <Button variant="outline" className="text-xs bg-slate-900 border-slate-800 text-slate-300">
            <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
            Back to Model Registry
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-16">
      {/* Back button */}
      <div>
        <Link
          to="/registry"
          className="inline-flex items-center gap-1.5 text-xs text-[#6E5D4F] hover:text-[#3B2A1C] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Model Registry
        </Link>
      </div>

      {/* 1. Header Banner */}
      <Card className="bg-white border border-[#D9C6B7] p-6 rounded-2xl shadow-sm relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="bg-[#F2E4D5] border-[#D9C6B7] text-[#5A4D3B] text-xs uppercase">
                {model.domain}
              </Badge>
              <Badge variant="outline" className="bg-[#FAF6F0] border-[#D9C6B7] text-[#6E5D4F] text-xs uppercase font-mono">
                {model.modality}
              </Badge>
              <ModelStatusPill status={model.status} runtimeStatus={model.runtime_status} />
            </div>

            <h1 className="text-2xl font-bold text-[#3B2A1C]">{model.name}</h1>
            <p className="font-mono text-xs text-[#6E5D4F]">
              Identifier: <span className="text-[#8B6F5B] font-semibold">{model.id}</span> | Version: {model.version}
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCheckHealth}
              disabled={checkingHealth}
              className="text-xs bg-white border-[#D9C6B7] text-[#5A4D3B] hover:bg-[#FAF6F0]"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${checkingHealth ? 'animate-spin' : ''}`} />
              Verify Runtime Health
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyJson}
              className="text-xs bg-white border-[#D9C6B7] text-[#5A4D3B] hover:bg-[#FAF6F0]"
            >
              {copiedJson ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600 mr-1.5" />
                  Copied JSON
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 mr-1.5" />
                  Export Metadata
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Live Health Panel */}
        {health && (
          <div className="mt-5 p-4 rounded-xl bg-[#FCF9F5] border border-[#D9C6B7] text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-[#3B2A1C] flex items-center gap-2">
                <Activity className="w-4 h-4 text-[#8B6F5B]" />
                Live Runtime Health & Telemetry
              </span>
              <span className="text-[11px] text-[#6E5D4F] font-mono">
                Verified: {new Date(health.last_verified_at).toLocaleTimeString()}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-[11px]">
              <div>
                <span className="text-[#6E5D4F] block">Runtime Ready:</span>
                <span className={`font-semibold ${health.runtime_ready ? 'text-emerald-700' : 'text-amber-800'}`}>
                  {health.runtime_ready ? 'YES (Operational)' : 'NO (Unconfigured)'}
                </span>
              </div>
              <div>
                <span className="text-[#6E5D4F] block">Hardware Device:</span>
                <span className="text-[#3B2A1C] uppercase font-mono">{health.device}</span>
              </div>
              <div>
                <span className="text-[#6E5D4F] block">Weights Present:</span>
                <span className={health.weights_present ? 'text-emerald-700' : 'text-amber-800'}>
                  {health.weights_present ? 'Cached on Disk' : 'Not Downloaded'}
                </span>
              </div>
              <div>
                <span className="text-[#6E5D4F] block">Dependencies:</span>
                <span className={health.dependencies_ready ? 'text-emerald-700' : 'text-rose-700'}>
                  {health.dependencies_ready ? 'Installed' : 'Missing'}
                </span>
              </div>
            </div>
            {Boolean(health.details?.message) && (
              <p className="text-[11px] text-[#6E5D4F] italic pt-1 border-t border-[#D9C6B7]">
                {String(health.details?.message)}
              </p>
            )}
          </div>
        )}
      </Card>

      {/* 2. Architectural & Compute Specifications */}
      <Card className="bg-white border border-[#D9C6B7] p-6 rounded-2xl space-y-4 shadow-sm">
        <h3 className="text-sm font-bold text-[#3B2A1C] flex items-center gap-2">
          <Cpu className="w-4 h-4 text-[#8B6F5B]" />
          Architectural & Resource Requirements
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div className="bg-[#FCF9F5] p-3.5 rounded-lg border border-[#D9C6B7]">
            <span className="text-[#6E5D4F] uppercase text-[10px] block mb-1">Parameter Count</span>
            <span className="font-mono text-base font-bold text-[#3B2A1C]">
              {model.parameter_count ? model.parameter_count.toLocaleString() : 'N/A'}
            </span>
          </div>

          <div className="bg-[#FCF9F5] p-3.5 rounded-lg border border-[#D9C6B7]">
            <span className="text-[#6E5D4F] uppercase text-[10px] block mb-1">Estimated RAM</span>
            <span className="font-mono text-base font-bold text-[#3B2A1C]">
              {model.estimated_ram_mb} MB
            </span>
          </div>

          <div className="bg-[#FCF9F5] p-3.5 rounded-lg border border-[#D9C6B7]">
            <span className="text-[#6E5D4F] uppercase text-[10px] block mb-1">Estimated VRAM</span>
            <span className="font-mono text-base font-bold text-[#3B2A1C]">
              {model.estimated_vram_mb} MB
            </span>
          </div>

          <div className="bg-[#FCF9F5] p-3.5 rounded-lg border border-[#D9C6B7]">
            <span className="text-[#6E5D4F] uppercase text-[10px] block mb-1">Expected Latency</span>
            <span className="font-mono text-base font-bold text-[#3B2A1C]">
              ~{model.expected_latency_ms} ms
            </span>
          </div>
        </div>

        {/* Device Support and Capabilities */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 text-xs">
          <div className="bg-[#FCF9F5] p-3.5 rounded-lg border border-[#D9C6B7] space-y-1.5">
            <span className="text-[#6E5D4F] uppercase text-[10px] block font-semibold">
              Supported Hardware Accelerators
            </span>
            <div className="flex gap-2 flex-wrap">
              {model.device_support.map((d) => (
                <Badge key={d} variant="outline" className="bg-[#FAF6F0] border-[#D9C6B7] text-[#3B2A1C] text-xs uppercase">
                  {d}
                </Badge>
              ))}
            </div>
          </div>

          <div className="bg-[#FCF9F5] p-3.5 rounded-lg border border-[#D9C6B7] space-y-1.5">
            <span className="text-[#6E5D4F] uppercase text-[10px] block font-semibold">
              Screening Capabilities
            </span>
            <div className="flex flex-wrap gap-1.5">
              {model.capabilities.map((c) => (
                <Badge key={c} variant="outline" className="bg-[#FAF6F0] border-[#D9C6B7] text-[#5A4D3B] text-xs">
                  {c.replace(/_/g, ' ')}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* 3. Model Provenance Component */}
      <ModelProvenanceView model={model} />

      {/* 4. Model Limitations Component */}
      <ModelLimitationsView limitations={model.limitations} />
    </div>
  );
};

