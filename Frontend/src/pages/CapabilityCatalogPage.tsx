import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../services/apiClient';
import type { ClinicalCapability } from '../types/api';
import { CapabilityCard } from '../components/capabilities/CapabilityCard';
import { CapabilityDetailModal } from '../components/capabilities/CapabilityDetailModal';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import {
  Brain,
  Cpu,
  Layers,
  Search,
  RefreshCw,
  Scan,
  Activity,
  CheckCircle2,
  AlertCircle,
  Database,
} from 'lucide-react';

export const CapabilityCatalogPage: React.FC = () => {
  const [capabilities, setCapabilities] = useState<ClinicalCapability[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedModality, setSelectedModality] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedCapability, setSelectedCapability] = useState<ClinicalCapability | null>(null);

  const fetchCapabilities = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiClient.getCapabilities();
      setCapabilities(data);
    } catch (err) {
      console.error('Failed to load capability catalog:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCapabilities();
  }, [fetchCapabilities]);

  // Filter capabilities
  const filteredCapabilities = capabilities.filter((c) => {
    if (selectedModality !== 'all') {
      const mod = c.expected_modality.toLowerCase();
      if (selectedModality === 'ct_mri') {
        if (mod !== 'ct' && mod !== 'mri') return false;
      } else if (mod !== selectedModality) {
        return false;
      }
    }
    if (selectedStatus !== 'all') {
      if (c.status.toLowerCase() !== selectedStatus.toLowerCase()) return false;
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        c.name.toLowerCase().includes(q) ||
        c.capability_id.toLowerCase().includes(q) ||
        c.expected_modality.toLowerCase().includes(q) ||
        c.adapter_class.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Summary Metrics
  const totalCapabilities = capabilities.length;
  const readyCapabilities = capabilities.filter((c) => c.status.toLowerCase() === 'ready').length;
  const notConfiguredCapabilities = totalCapabilities - readyCapabilities;
  const distinctModalities = new Set(capabilities.map((c) => c.expected_modality)).size;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* 1. Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-[#D9C6B7] p-6 rounded-2xl shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="space-y-1 relative z-10">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-[#F2E4D5] border border-[#D9C6B7] text-[#8B6F5B]">
              <Cpu className="w-5 h-5" />
            </span>
            <Badge variant="outline" className="text-xs border-[#D9C6B7] text-[#5A4D3B] bg-[#F2E4D5]">
              Phase 6 Architecture
            </Badge>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#3B2A1C]">
            Clinical AI Capability Catalog
          </h1>
          <p className="text-xs text-[#6E5D4F] max-w-2xl leading-relaxed">
            The six-capability clinical foundation of MediFusion AI. Enforces standardized adapter contracts, 
            9-point candidate model verification, and dynamic case resolution. Simulated predictions are strictly prohibited.
          </p>
        </div>

        <div className="flex items-center gap-3 relative z-10">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchCapabilities}
            disabled={loading}
            className="border-[#D9C6B7] bg-white hover:bg-[#FAF6F0] text-[#5A4D3B] text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
            Refresh Status
          </Button>

          <Link to="/registry">
            <Button size="sm" variant="outline" className="border-[#D9C6B7] bg-[#FAF6F0] hover:bg-[#D9C6B7] text-[#3B2A1C] text-xs">
              <Database className="w-3.5 h-3.5 mr-1.5 text-indigo-400" />
              Model Registry
            </Button>
          </Link>
        </div>
      </div>

      {/* 2. KPI Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 bg-white border-[#D9C6B7] shadow-sm">
          <span className="text-[11px] uppercase tracking-wider text-[#6E5D4F] font-semibold flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            Total Capabilities
          </span>
          <div className="text-2xl font-bold text-[#3B2A1C] mt-2 font-mono">6</div>
          <span className="text-[11px] text-[#6E5D4F] mt-0.5 block">Standardized clinical adapters</span>
        </Card>

        <Card className="p-4 bg-white border-[#D9C6B7] shadow-sm">
          <span className="text-[11px] uppercase tracking-wider text-emerald-400 font-semibold flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            Verified & Ready
          </span>
          <div className="text-2xl font-bold text-emerald-400 mt-2 font-mono">{readyCapabilities}</div>
          <span className="text-[11px] text-[#6E5D4F] mt-0.5 block">Pneumonia & Lung Opacity</span>
        </Card>

        <Card className="p-4 bg-white border-[#D9C6B7] shadow-sm">
          <span className="text-[11px] uppercase tracking-wider text-amber-400 font-semibold flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
            Under Configuration
          </span>
          <div className="text-2xl font-bold text-amber-400 mt-2 font-mono">{notConfiguredCapabilities}</div>
          <span className="text-[11px] text-[#6E5D4F] mt-0.5 block">Weights unconfigured on disk</span>
        </Card>

        <Card className="p-4 bg-white border-[#D9C6B7] shadow-sm">
          <span className="text-[11px] uppercase tracking-wider text-indigo-400 font-semibold flex items-center gap-1.5">
            <Brain className="w-3.5 h-3.5 text-indigo-400" />
            Modalities Covered
          </span>
          <div className="text-2xl font-bold text-indigo-300 mt-2 font-mono">{distinctModalities || 5}</div>
          <span className="text-[11px] text-[#6E5D4F] mt-0.5 block">CXR, MRI, CT, ECG, Derm</span>
        </Card>
      </div>

      {/* 3. Filter Bar & Modality Tabs */}
      <div className="space-y-3">
        {/* Modality Tabs */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-3">
          {[
            { id: 'all', label: 'All Modalities' },
            { id: 'chest_xray', label: 'Chest X-Ray', icon: Scan },
            { id: 'mri', label: 'Brain MRI', icon: Brain },
            { id: 'ct', label: 'Head CT', icon: Scan },
            { id: 'ecg', label: '12-Lead ECG', icon: Activity },
            { id: 'skin_image', label: 'Dermoscopy / Skin', icon: Layers },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = selectedModality === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setSelectedModality(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  active
                    ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                    : 'bg-slate-900 border border-slate-800 text-[#6E5D4F] hover:text-[#3B2A1C] hover:bg-slate-800'
                }`}
              >
                {Icon && <Icon className="w-3.5 h-3.5" />}
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Search and Status Filters */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-[#6E5D4F] absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search capabilities, adapters, or targets..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-[#FAF6F0] border border-[#D9C6B7] text-xs text-[#3B2A1C] placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-[#6E5D4F]">Status:</span>
            {['all', 'ready', 'not_configured'].map((st) => (
              <button
                key={st}
                onClick={() => setSelectedStatus(st)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  selectedStatus === st
                    ? 'bg-slate-800 text-cyan-300 border border-cyan-500/30'
                    : 'text-[#6E5D4F] hover:text-[#3B2A1C]'
                }`}
              >
                {st === 'all' ? 'All' : st === 'ready' ? 'Ready / Runnable' : 'Not Configured'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 4. Capabilities Grid */}
      {loading ? (
        <div className="py-20 text-center space-y-3">
          <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin mx-auto" />
          <p className="text-xs text-[#6E5D4F]">Loading six-capability clinical catalog...</p>
        </div>
      ) : filteredCapabilities.length === 0 ? (
        <div className="py-16 text-center space-y-3 bg-slate-900/50 border border-slate-800 rounded-2xl">
          <Layers className="w-10 h-10 text-slate-600 mx-auto" />
          <h3 className="text-sm font-semibold text-[#5A4D3B]">No capabilities match the selected filters</h3>
          <p className="text-xs text-[#6E5D4F]">Try clearing the search query or selecting All Modalities.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredCapabilities.map((cap) => (
            <CapabilityCard
              key={cap.capability_id}
              capability={cap}
              onSelect={(c) => setSelectedCapability(c)}
            />
          ))}
        </div>
      )}

      {/* 5. Capability Detail / Audit Verification Modal */}
      <CapabilityDetailModal
        capability={selectedCapability}
        onClose={() => setSelectedCapability(null)}
        onHealthUpdated={(updated) => {
          setCapabilities((prev) =>
            prev.map((c) => (c.capability_id === updated.capability_id ? updated : c))
          );
          setSelectedCapability(updated);
        }}
      />
    </div>
  );
};
