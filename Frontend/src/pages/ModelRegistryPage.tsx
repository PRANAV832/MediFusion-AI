import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../services/apiClient';
import type { ModelRegistryItem } from '../types/api';
import { ModelStatusPill } from '../components/registry/ModelStatusPill';
import { RegisterModelModal } from '../components/registry/RegisterModelModal';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { CardSkeleton } from '../components/ui/skeleton';
import { EmptyState } from '../components/ui/empty-state';
import { MedicalSafetyBanner } from '../components/ui/clinical-badges';
import {
  Brain,
  Cpu,
  Layers,
  Search,
  Plus,
  RefreshCw,
  Scan,
  Activity,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';

export const ModelRegistryPage: React.FC = () => {
  const [models, setModels] = useState<ModelRegistryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedModality, setSelectedModality] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);

  const fetchModels = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiClient.getRegistryModels();
      setModels(data);
    } catch (err) {
      console.error('Failed to load model registry:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  // Filter models
  const filteredModels = models.filter((m) => {
    if (selectedModality !== 'all' && m.modality !== selectedModality) return false;
    if (selectedStatus !== 'all') {
      const effective = (m.runtime_status || m.status).toLowerCase();
      if (selectedStatus === 'ready' && effective !== 'ready' && effective !== 'active') return false;
      if (selectedStatus === 'not_configured' && effective !== 'not_configured') return false;
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        m.name.toLowerCase().includes(q) ||
        m.id.toLowerCase().includes(q) ||
        m.domain.toLowerCase().includes(q) ||
        m.capabilities.some((c) => c.toLowerCase().includes(q))
      );
    }
    return true;
  });

  // KPI calculations
  const totalModels = models.length;
  const readyModels = models.filter(
    (m) => (m.runtime_status || m.status).toLowerCase() === 'ready' || (m.runtime_status || m.status).toLowerCase() === 'active'
  ).length;
  const distinctModalities = new Set(models.map((m) => m.modality)).size;
  const totalParams = models.reduce((acc, m) => acc + (m.parameter_count || 0), 0);

  const formatParams = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
    return num.toString();
  };

  const getModalityIcon = (modality: string) => {
    switch (modality) {
      case 'chest_xray':
        return <Scan className="w-4 h-4 text-cyan-400" />;
      case 'mri':
        return <Brain className="w-4 h-4 text-indigo-400" />;
      case 'ct':
        return <Scan className="w-4 h-4 text-blue-400" />;
      case 'ecg':
        return <Activity className="w-4 h-4 text-emerald-400" />;
      default:
        return <Layers className="w-4 h-4 text-amber-400" />;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Medical Safety Banner */}
      <MedicalSafetyBanner />

      {/* 1. Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-[#D9C6B7] p-6 rounded-2xl shadow-sm relative overflow-hidden">
        <div className="space-y-1.5 relative z-10">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-[#F2E4D5] border border-[#D9C6B7] text-[#5A4D3B]">
              <Cpu className="w-6 h-6 text-[#8B6F5B]" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#3B2A1C] flex items-center gap-2">
                Specialized Medical Model Registry
                <Badge variant="outline" className="text-[#5A4D3B] border-[#D9C6B7] bg-[#F2E4D5] text-xs">
                  Database-Backed
                </Badge>
              </h1>
              <p className="text-xs text-[#6E5D4F] mt-0.5">
                Centralized registry for specialized clinical vision, biosignal, and imaging models
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 relative z-10 flex-wrap">
          <Link to="/capabilities">
            <Button
              variant="outline"
              size="sm"
              className="text-xs bg-[#F2E4D5] border-[#D9C6B7] text-[#5A4D3B] hover:bg-[#D9C6B7]"
            >
              <Layers className="w-3.5 h-3.5 mr-1.5 text-[#8B6F5B]" />
              Six Capability Catalog
            </Button>
          </Link>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchModels}
            disabled={loading}
            className="text-xs bg-white border-[#D9C6B7] text-[#5A4D3B] hover:bg-[#FAF6F0]"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => setIsRegisterOpen(true)}
            className="bg-[#8B6F5B] hover:bg-[#5A4D3B] text-white font-medium text-xs px-4 flex items-center gap-1.5 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Register Model
          </Button>
        </div>
      </div>

      {/* 2. KPI Metrics Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-white border border-[#D9C6B7] p-4 rounded-xl shadow-sm">
          <span className="text-xs text-[#6E5D4F] block mb-1">Cataloged Models</span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-[#3B2A1C]">{totalModels}</span>
            <span className="text-xs text-[#6E5D4F]">architectures</span>
          </div>
        </Card>

        <Card className="bg-white border border-[#D9C6B7] p-4 rounded-xl shadow-sm">
          <span className="text-xs text-[#6E5D4F] block mb-1">Active / Ready Models</span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-emerald-700">{readyModels}</span>
            <span className="text-xs text-[#6E5D4F]">verified</span>
          </div>
        </Card>

        <Card className="bg-white border border-[#D9C6B7] p-4 rounded-xl shadow-sm">
          <span className="text-xs text-[#6E5D4F] block mb-1">Covered Modalities</span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-[#8B6F5B]">{distinctModalities}</span>
            <span className="text-xs text-[#6E5D4F]">clinical types</span>
          </div>
        </Card>

        <Card className="bg-white border border-[#D9C6B7] p-4 rounded-xl shadow-sm">
          <span className="text-xs text-[#6E5D4F] block mb-1">Total Model Weights</span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-[#3B2A1C]">
              {formatParams(totalParams)}
            </span>
            <span className="text-xs text-[#6E5D4F]">parameters</span>
          </div>
        </Card>
      </div>

      {/* 3. Search and Filters */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-xl border border-[#D9C6B7] shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-[#6E5D4F] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by model, domain, or capability..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#FAF6F0] border border-[#D9C6B7] rounded-lg pl-9 pr-3 py-1.5 text-xs text-[#3B2A1C] placeholder-[#6E5D4F] focus:outline-none focus:border-[#8B6F5B]"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          {/* Modality Filter */}
          <select
            value={selectedModality}
            onChange={(e) => setSelectedModality(e.target.value)}
            className="bg-[#FAF6F0] border border-[#D9C6B7] text-xs text-[#3B2A1C] rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#8B6F5B]"
          >
            <option value="all">All Modalities</option>
            <option value="chest_xray">Chest X-Ray</option>
            <option value="mri">Brain / Neuro MRI</option>
            <option value="ct">Head / Torso CT</option>
            <option value="ecg">12-Lead ECG</option>
            <option value="skin_image">Dermatology Skin</option>
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="bg-[#FAF6F0] border border-[#D9C6B7] text-xs text-[#3B2A1C] rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#8B6F5B]"
          >
            <option value="all">All Statuses</option>
            <option value="ready">Ready (Active)</option>
            <option value="not_configured">Not Configured</option>
          </select>
        </div>
      </div>

      {/* 4. Model Cards Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" role="status" aria-label="Loading registered model cards">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : filteredModels.length === 0 ? (
        <EmptyState
          icon={Cpu}
          title="No Medical Models Match Filter"
          description="Adjust your search criteria, modality filter, or register a new specialized clinical model."
          action={{
            label: "Register New Model",
            onClick: () => setIsRegisterOpen(true),
          }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredModels.map((model) => (
            <Card
              key={model.id}
              className="bg-white border border-[#D9C6B7] rounded-xl p-5 hover:border-[#8B6F5B] transition-all duration-200 flex flex-col justify-between shadow-sm group"
            >
              <div className="space-y-3">
                {/* Header: Modality icon & Status */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-[#FAF6F0] border border-[#D9C6B7]">
                      {getModalityIcon(model.modality)}
                    </div>
                    <div>
                      <Badge variant="outline" className="bg-[#F2E4D5] text-[#5A4D3B] border-[#D9C6B7] text-[10px] uppercase">
                        {model.domain}
                      </Badge>
                      <span className="text-[10px] text-[#6E5D4F] font-mono block mt-0.5">
                        {model.version}
                      </span>
                    </div>
                  </div>
                  <ModelStatusPill status={model.status} runtimeStatus={model.runtime_status} size="sm" />
                </div>

                {/* Model Title & ID */}
                <div>
                  <h3 className="font-bold text-[#3B2A1C] text-sm group-hover:text-[#8B6F5B] transition-colors line-clamp-1">
                    {model.name}
                  </h3>
                  <span className="font-mono text-xs text-[#6E5D4F] block truncate mt-0.5">
                    {model.id}
                  </span>
                </div>

                {/* Capabilities Tags */}
                <div className="flex flex-wrap gap-1">
                  {model.capabilities.slice(0, 3).map((cap) => (
                    <Badge
                      key={cap}
                      variant="outline"
                      className="bg-[#FAF6F0] text-[#5A4D3B] border-[#D9C6B7] text-[10px] font-mono"
                    >
                      {cap.replace(/_/g, ' ')}
                    </Badge>
                  ))}
                  {model.capabilities.length > 3 && (
                    <Badge variant="outline" className="bg-[#FAF6F0] text-[#6E5D4F] border-[#D9C6B7] text-[10px]">
                      +{model.capabilities.length - 3} more
                    </Badge>
                  )}
                </div>

                {/* Specifications Strip */}
                <div className="grid grid-cols-3 gap-2 bg-[#FCF9F5] p-2.5 rounded-lg border border-[#D9C6B7] text-[11px] font-mono text-[#3B2A1C]">
                  <div>
                    <span className="text-[9px] text-[#6E5D4F] uppercase block font-sans">Params</span>
                    <span>{formatParams(model.parameter_count)}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-[#6E5D4F] uppercase block font-sans">RAM</span>
                    <span>{model.estimated_ram_mb} MB</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-[#6E5D4F] uppercase block font-sans">Latency</span>
                    <span>~{model.expected_latency_ms} ms</span>
                  </div>
                </div>
              </div>

              {/* Card Footer: Detail Link */}
              <div className="pt-4 mt-4 border-t border-[#D9C6B7] flex items-center justify-between">
                <span className="text-[10px] text-[#6E5D4F] flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-600" />
                  {model.framework}
                </span>

                <Link
                  to={`/registry/${model.id}`}
                  className="text-xs text-[#8B6F5B] hover:text-[#5A4D3B] font-semibold flex items-center gap-1 group-hover:translate-x-0.5 transition-transform"
                >
                  View Details
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}


      {/* Register Model Modal */}
      <RegisterModelModal
        isOpen={isRegisterOpen}
        onClose={() => setIsRegisterOpen(false)}
        onModelRegistered={(newModel) => {
          setModels((prev) => [newModel, ...prev]);
        }}
      />
    </div>
  );
};
