import React, { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../services/apiClient';
import type {
  SchedulerDashboardData,
  LoadedModelEntry,
  CapabilityMemoryEstimate,
  SchedulerEventItem,
} from '../types/api';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import {
  Cpu,
  Server,
  Zap,
  HardDrive,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Layers,
  Activity,
  Trash2,
  Sliders,
  Play,
  Database,
  Info,
} from 'lucide-react';

export const ResourceSchedulerPage: React.FC = () => {
  const [data, setData] = useState<SchedulerDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [eventFilter, setEventFilter] = useState<string>('all');

  // Simulation form state
  const [simMaxRam, setSimMaxRam] = useState<number>(512);
  const [simMaxVram, setSimMaxVram] = useState<number>(0);
  const [simSaving, setSimSaving] = useState(false);

  const fetchDashboard = useCallback(async (isSilent: boolean = false) => {
    if (!isSilent) setRefreshing(true);
    try {
      const resp = await apiClient.getSchedulerDashboard();
      setData(resp);
      if (!isSilent) {
        if (resp.simulated_limits.simulated_max_ram_mb !== null) {
          setSimMaxRam(resp.simulated_limits.simulated_max_ram_mb);
        }
        if (resp.simulated_limits.simulated_max_vram_mb !== null) {
          setSimMaxVram(resp.simulated_limits.simulated_max_vram_mb);
        }
      }
    } catch (err) {
      console.error('Failed to load scheduler telemetry:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  // Auto-refresh interval (polling every 3.5 seconds)
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchDashboard(true);
    }, 3500);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchDashboard]);

  const handleSimSave = async (enable: boolean) => {
    setSimSaving(true);
    try {
      await apiClient.configureSimulatedLimits({
        enabled: enable,
        max_ram_mb: enable ? simMaxRam : null,
        max_vram_mb: enable ? simMaxVram : null,
      });
      setActionMessage(
        enable
          ? `SIMULATED_RESOURCE_LIMIT enabled (Capped at ${simMaxRam} MB RAM). Host telemetry remains real.`
          : 'Simulated constrained limits disabled. Operating on real host hardware limits.'
      );
      await fetchDashboard(true);
    } catch (err) {
      console.error('Failed to configure simulated limits:', err);
    } finally {
      setSimSaving(false);
    }
  };

  const handleUnloadModel = async (capId: string) => {
    try {
      await apiClient.unloadSchedulerModel(capId);
      setActionMessage(`Model for capability '${capId}' resident memory evicted.`);
      await fetchDashboard(true);
    } catch (err) {
      console.error(`Failed to unload model ${capId}:`, err);
    }
  };

  const handleUnloadAll = async () => {
    if (!window.confirm('Evict all resident models from memory cache?')) return;
    try {
      const resp = await apiClient.unloadAllSchedulerModels();
      setActionMessage(resp.message);
      await fetchDashboard(true);
    } catch (err) {
      console.error('Failed to unload all models:', err);
    }
  };

  if (loading && !data) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-[#6E5D4F]">
          <RefreshCw className="h-8 w-8 animate-spin text-cyan-400" />
          <p className="text-sm">Initializing Resource Scheduler Telemetry...</p>
        </div>
      </div>
    );
  }

  const telemetry = data?.telemetry;
  const sim = data?.simulated_limits;
  const cache = data?.cache;
  const queue = data?.queue;
  const estimates = data?.memory_estimates || [];
  const events = data?.recent_events || [];

  const filteredEvents = events.filter((ev) => {
    if (eventFilter === 'all') return true;
    if (eventFilter === 'errors') return ev.status === 'failed' || ev.stage === 'ERROR';
    if (eventFilter === 'simulated') return ev.is_simulated;
    return ev.stage.toLowerCase() === eventFilter.toLowerCase();
  });

  const getStageColor = (stage: string) => {
    switch (stage.toUpperCase()) {
      case 'SELECT':
        return 'border-indigo-500/30 text-indigo-300 bg-indigo-500/10';
      case 'RESOURCE_CHECK':
        return 'border-amber-500/30 text-amber-300 bg-amber-500/10';
      case 'LOAD':
        return 'border-purple-500/30 text-purple-300 bg-purple-500/10';
      case 'INFER':
        return 'border-emerald-500/30 text-emerald-300 bg-emerald-500/10';
      case 'PERSIST':
        return 'border-teal-500/30 text-teal-300 bg-teal-500/10';
      case 'CACHE':
        return 'border-cyan-500/30 text-cyan-300 bg-cyan-500/10';
      case 'UNLOAD':
        return 'border-orange-500/30 text-orange-300 bg-orange-500/10';
      case 'ERROR':
        return 'border-rose-500/30 text-rose-300 bg-rose-500/10';
      default:
        return 'border-[#D9C6B7] text-[#5A4D3B] bg-[#FAF6F0]';
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-[#3B2A1C]">
              Resource-Aware Scheduler
            </h1>
            <Badge variant="outline" className="border-cyan-500/40 font-mono text-xs text-cyan-400">
              PHASE 8
            </Badge>
            <Badge variant="outline" className="border-[#D9C6B7] font-mono text-xs text-[#5A4D3B]">
              Telemetry Live
            </Badge>
          </div>
          <p className="mt-1 text-sm text-[#6E5D4F]">
            Hardware resource supervision, LRU model caching, execution queues, and lifecycle orchestration.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={autoRefresh ? 'default' : 'outline'}
            onClick={() => setAutoRefresh(!autoRefresh)}
            className="text-xs h-8"
          >
            <Clock className="mr-1.5 h-3.5 w-3.5" />
            {autoRefresh ? 'Polling 3.5s' : 'Polling Paused'}
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => fetchDashboard(false)}
            disabled={refreshing}
            className="text-xs h-8 text-[#5A4D3B] border-[#D9C6B7] hover:bg-[#FAF6F0]"
          >
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Action Notification Banner */}
      {actionMessage && (
        <div className="flex items-center justify-between rounded-lg border border-cyan-500/30 bg-cyan-500/10 p-3 text-xs text-cyan-200">
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-cyan-400 shrink-0" />
            <span>{actionMessage}</span>
          </div>
          <button
            onClick={() => setActionMessage(null)}
            className="text-[#6E5D4F] hover:text-[#3B2A1C] text-xs px-2"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* DEMO MODE: Constrained-Resource Warning / Controller */}
      <Card className={`p-4 border ${sim?.enabled ? 'border-amber-500/60 bg-amber-950/20' : 'border-[#D9C6B7] bg-[#FAF6F0]/60'}`}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-lg ${sim?.enabled ? 'bg-amber-500/20 text-amber-300' : 'bg-[#FAF6F0] text-[#6E5D4F]'}`}>
              <Sliders className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-[#3B2A1C]">
                  Demo Mode: Constrained-Resource Simulation
                </span>
                {sim?.enabled ? (
                  <Badge variant="outline" className="border-amber-500/50 bg-amber-500/10 font-mono text-[10px] text-amber-300 animate-pulse">
                    SIMULATED_RESOURCE_LIMIT
                  </Badge>
                ) : (
                  <Badge variant="outline" className="border-[#D9C6B7] font-mono text-[10px] text-[#6E5D4F]">
                    REAL_HARDWARE_LIMITS
                  </Badge>
                )}
              </div>
              <p className="mt-1 text-xs text-[#6E5D4F] leading-relaxed">
                {sim?.enabled ? (
                  <span className="text-amber-200">
                    <strong>CRITICAL NOTICE:</strong> Model allocation checks are enforcing artificial synthetic ceilings (
                    {sim.simulated_max_ram_mb} MB RAM). Telemetry below shows both physical hardware and synthetic ceilings.
                    Simulated limits are not physical measurements.
                  </span>
                ) : (
                  <span>
                    Simulate constrained CPU/RAM environments to evaluate graceful degradation and{' '}
                    <code className="rounded bg-[#FAF6F0] px-1 text-rose-300">MODEL_RESOURCE_UNAVAILABLE</code> handling.
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Simulation Controls */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs text-[#5A4D3B] whitespace-nowrap">Cap RAM (MB):</label>
              <input
                type="number"
                min={128}
                max={65536}
                step={128}
                value={simMaxRam}
                onChange={(e) => setSimMaxRam(parseInt(e.target.value) || 256)}
                disabled={simSaving}
                className="w-24 rounded border border-[#D9C6B7] bg-[#FAF6F0] px-2 py-1 text-xs font-mono text-[#3B2A1C] focus:border-cyan-500 focus:outline-none"
              />
            </div>

            {sim?.enabled ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleSimSave(false)}
                disabled={simSaving}
                className="h-8 text-xs border-amber-500/40 text-amber-300 hover:bg-amber-500/10"
              >
                Disable Simulation
              </Button>
            ) : (
              <Button
                size="sm"
                variant="default"
                onClick={() => handleSimSave(true)}
                disabled={simSaving}
                className="h-8 text-xs bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold"
              >
                Enable Simulation
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* SECTION 1: Hardware Resource Dashboard */}
      <div>
        <h2 className="mb-3 text-base font-semibold text-[#3B2A1C] flex items-center gap-2">
          <Activity className="h-4 w-4 text-cyan-400" />
          Hardware Telemetry Dashboard
        </h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* CPU Card */}
          <Card className="p-4 border-[#D9C6B7] bg-[#FAF6F0]/60">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[#6E5D4F]">Host CPU Utilization</span>
              <Cpu className="h-4 w-4 text-cyan-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-[#3B2A1C]">
                {telemetry?.cpu_percent ?? 0}%
              </span>
              <span className="text-xs text-[#6E5D4F]">({telemetry?.cpu_cores ?? 1} Cores)</span>
            </div>
            <div className="mt-3 w-full bg-[#FAF6F0] rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-cyan-500 h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(0, telemetry?.cpu_percent ?? 0))}%` }}
              />
            </div>
            <p className="mt-2 text-[11px] text-[#6E5D4F]">Physical host processor load</p>
          </Card>

          {/* Physical RAM Card */}
          <Card className="p-4 border-[#D9C6B7] bg-[#FAF6F0]/60">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[#6E5D4F]">Host Physical RAM</span>
              <Server className="h-4 w-4 text-teal-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-[#3B2A1C]">
                {telemetry?.used_ram_mb ? (telemetry.used_ram_mb / 1024).toFixed(1) : 0} GB
              </span>
              <span className="text-xs text-[#6E5D4F]">
                / {telemetry?.total_ram_mb ? (telemetry.total_ram_mb / 1024).toFixed(1) : 0} GB
              </span>
            </div>
            <div className="mt-3 w-full bg-[#FAF6F0] rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-teal-500 h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(0, telemetry?.ram_usage_percent ?? 0))}%` }}
              />
            </div>
            <div className="mt-2 flex justify-between text-[11px] text-[#6E5D4F]">
              <span>{telemetry?.ram_usage_percent ?? 0}% Allocated</span>
              <span className="text-teal-300 font-mono">
                {telemetry?.available_ram_mb ? (telemetry.available_ram_mb / 1024).toFixed(1) : 0} GB Free
              </span>
            </div>
          </Card>

          {/* GPU / VRAM Card */}
          <Card className="p-4 border-[#D9C6B7] bg-[#FAF6F0]/60">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[#6E5D4F]">Host GPU / VRAM</span>
              <Zap className="h-4 w-4 text-purple-400" />
            </div>
            <div className="mt-2">
              {telemetry?.cuda_available ? (
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold font-mono text-[#3B2A1C]">
                      {telemetry.allocated_vram_mb} MB
                    </span>
                    <span className="text-xs text-[#6E5D4F]">/ {telemetry.total_vram_mb} MB</span>
                  </div>
                  <p className="mt-1 text-xs text-purple-300 truncate" title={telemetry.gpu_name || 'GPU'}>
                    {telemetry.gpu_name || 'CUDA Device'}
                  </p>
                </div>
              ) : (
                <div>
                  <span className="text-sm font-semibold text-[#5A4D3B]">CPU Fallback</span>
                  <p className="mt-1 text-[11px] text-[#6E5D4F]">CUDA unavailable; Torch CPU runtime active</p>
                </div>
              )}
            </div>
            <div className="mt-3 w-full bg-[#FAF6F0] rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-purple-500 h-1.5 rounded-full transition-all duration-500"
                style={{
                  width: `${
                    telemetry?.total_vram_mb && telemetry.total_vram_mb > 0
                      ? Math.min(100, (telemetry.allocated_vram_mb / telemetry.total_vram_mb) * 100)
                      : 0
                  }%`,
                }}
              />
            </div>
            <p className="mt-2 text-[11px] text-[#6E5D4F]">
              {telemetry?.cuda_available ? `${telemetry.gpu_count} GPU device ready` : 'Zero VRAM allocated'}
            </p>
          </Card>

          {/* Cache Headroom Card */}
          <Card className="p-4 border-[#D9C6B7] bg-[#FAF6F0]/60">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[#6E5D4F]">Resident Model Cache</span>
              <HardDrive className="h-4 w-4 text-indigo-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-[#3B2A1C]">
                {cache?.total_resident_ram_mb ?? 0} MB
              </span>
              <span className="text-xs text-[#6E5D4F]">/ {cache?.max_resident_ram_mb ?? 4096} MB max</span>
            </div>
            <div className="mt-3 w-full bg-[#FAF6F0] rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-indigo-500 h-1.5 rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(
                    100,
                    ((cache?.total_resident_ram_mb ?? 0) / (cache?.max_resident_ram_mb || 4096)) * 100
                  )}%`,
                }}
              />
            </div>
            <div className="mt-2 flex justify-between text-[11px] text-[#6E5D4F]">
              <span>{cache?.resident_models_count ?? 0} / {cache?.max_resident_models ?? 3} Models Loaded</span>
              <span className="text-indigo-300 font-mono">{cache?.hits ?? 0} Hits / {cache?.misses ?? 0} Misses</span>
            </div>
          </Card>
        </div>
      </div>

      {/* SECTION 2: 6-Stage Lifecycle Flow Visualization */}
      <Card className="p-4 border-[#D9C6B7] bg-[#FAF6F0]/60">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#6E5D4F]">
            Model Scheduler Execution Lifecycle
          </span>
          <span className="text-[11px] font-mono text-cyan-400">Deterministic Pipeline</span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-6 gap-2 text-center text-xs">
          <div className="rounded-lg border border-indigo-500/30 bg-indigo-950/20 p-2.5">
            <span className="font-mono font-bold text-indigo-300 block">1. SELECT</span>
            <span className="text-[10px] text-[#6E5D4F] mt-1 block">Capability & Adapter match</span>
          </div>

          <div className="rounded-lg border border-amber-500/30 bg-amber-950/20 p-2.5">
            <span className="font-mono font-bold text-amber-300 block">2. RESOURCE CHECK</span>
            <span className="text-[10px] text-[#6E5D4F] mt-1 block">RAM/VRAM & Sim validation</span>
          </div>

          <div className="rounded-lg border border-purple-500/30 bg-purple-950/20 p-2.5">
            <span className="font-mono font-bold text-purple-300 block">3. LOAD</span>
            <span className="text-[10px] text-[#6E5D4F] mt-1 block">Weights instantiated / Cache</span>
          </div>

          <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/20 p-2.5">
            <span className="font-mono font-bold text-emerald-300 block">4. INFER</span>
            <span className="text-[10px] text-[#6E5D4F] mt-1 block">PyTorch inference execution</span>
          </div>

          <div className="rounded-lg border border-teal-500/30 bg-teal-950/20 p-2.5">
            <span className="font-mono font-bold text-teal-300 block">5. PERSIST</span>
            <span className="text-[10px] text-[#6E5D4F] mt-1 block">Model run & findings recorded</span>
          </div>

          <div className="rounded-lg border border-cyan-500/30 bg-cyan-950/20 p-2.5">
            <span className="font-mono font-bold text-cyan-300 block">6. CACHE/UNLOAD</span>
            <span className="text-[10px] text-[#6E5D4F] mt-1 block">LRU retention or reclamation</span>
          </div>
        </div>
      </Card>

      {/* SECTION 3 & 4: Loaded Models (Cache) & Execution Queue */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Loaded Models */}
        <Card className="p-4 border-[#D9C6B7] bg-[#FAF6F0]/60 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-[#D9C6B7]">
              <div className="flex items-center gap-2">
                <HardDrive className="h-4 w-4 text-cyan-400" />
                <h3 className="font-semibold text-sm text-[#3B2A1C]">Loaded Models (Resident Cache)</h3>
                <Badge variant="outline" className="border-cyan-500/30 text-[10px] text-cyan-300">
                  {cache?.resident_models_count ?? 0} Resident
                </Badge>
              </div>

              {cache && cache.resident_models_count > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleUnloadAll}
                  className="h-7 text-[11px] text-rose-300 border-rose-500/30 hover:bg-rose-500/10"
                >
                  <Trash2 className="mr-1 h-3 w-3" />
                  Evict All
                </Button>
              )}
            </div>

            <div className="mt-3 space-y-2">
              {cache?.resident_models && cache.resident_models.length > 0 ? (
                cache.resident_models.map((model: LoadedModelEntry) => (
                  <div
                    key={model.capability_id}
                    className="flex items-center justify-between rounded-lg border border-[#D9C6B7] bg-[#FCF9F5] p-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-xs text-[#3B2A1C]">{model.model_name}</span>
                        <Badge variant="outline" className="text-[9px] font-mono text-[#6E5D4F]">
                          {model.capability_id}
                        </Badge>
                        <Badge variant="outline" className="text-[9px] font-mono border-cyan-500/30 text-cyan-300">
                          {model.device}
                        </Badge>
                      </div>
                      <div className="mt-1 flex items-center gap-3 text-[11px] text-[#6E5D4F]">
                        <span>
                          Memory: <strong className="text-[#3B2A1C]">{model.estimated_ram_mb} MB</strong>
                        </span>
                        <span>•</span>
                        <span>
                          Load Time: <strong className="text-[#3B2A1C]">{model.load_time_ms.toFixed(0)} ms</strong>
                        </span>
                        <span>•</span>
                        <span>
                          Hits: <strong className="text-[#3B2A1C]">{model.access_count}</strong>
                        </span>
                      </div>
                    </div>

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleUnloadModel(model.capability_id)}
                      className="h-7 text-xs text-[#6E5D4F] hover:text-rose-400 hover:bg-rose-500/10"
                      title="Evict from cache"
                    >
                      Unload
                    </Button>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center text-[#6E5D4F]">
                  <HardDrive className="h-8 w-8 text-slate-600 mb-2" />
                  <p className="text-xs">No models currently resident in RAM cache.</p>
                  <p className="text-[11px] text-slate-600 mt-1">
                    Models load lazily on inference demand and persist according to LRU policy.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[#D9C6B7] flex justify-between text-[11px] text-[#6E5D4F]">
            <span>Cache eviction policy: <strong>LRU (Least Recently Used)</strong></span>
            <span>Evictions to date: <strong className="font-mono text-amber-300">{cache?.evictions ?? 0}</strong></span>
          </div>
        </Card>

        {/* Concurrency Queue */}
        <Card className="p-4 border-[#D9C6B7] bg-[#FAF6F0]/60 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-[#D9C6B7]">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-purple-400" />
                <h3 className="font-semibold text-sm text-[#3B2A1C]">Scheduler Concurrency Queue</h3>
                <Badge variant="outline" className="border-purple-500/30 text-[10px] text-purple-300">
                  Max {queue?.max_concurrency ?? 2} Parallel Runs
                </Badge>
              </div>

              <div className="flex items-center gap-2 text-[11px]">
                <span className="text-emerald-400 font-mono font-semibold">
                  {queue?.running_count ?? 0} Active
                </span>
                <span className="text-[#6E5D4F]">|</span>
                <span className="text-amber-400 font-mono font-semibold">
                  {queue?.queued_count ?? 0} Queued
                </span>
              </div>
            </div>

            <div className="mt-3 space-y-2">
              {queue?.active_tasks && queue.active_tasks.length > 0 ? (
                queue.active_tasks.map((task) => (
                  <div
                    key={task.task_id}
                    className="flex items-center justify-between rounded-lg border border-[#D9C6B7] bg-[#FCF9F5] p-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={
                            task.status === 'running'
                              ? 'border-emerald-500/40 text-emerald-300 bg-emerald-500/10'
                              : 'border-amber-500/40 text-amber-300 bg-amber-500/10'
                          }
                        >
                          {task.status}
                        </Badge>
                        <span className="font-medium text-xs text-[#3B2A1C]">{task.capability_id}</span>
                        <span className="font-mono text-[10px] text-[#6E5D4F]">{task.task_id.substring(0, 8)}...</span>
                      </div>
                      <div className="mt-1 text-[11px] text-[#6E5D4F]">
                        Case: {task.case_id || 'Direct Trigger'} • Model: {task.model_id}
                      </div>
                    </div>
                    <span className="text-[11px] font-mono text-[#6E5D4F]">
                      {new Date(task.queued_at * 1000).toLocaleTimeString()}
                    </span>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center text-[#6E5D4F]">
                  <CheckCircle2 className="h-8 w-8 text-emerald-500/40 mb-2" />
                  <p className="text-xs">Execution queue idle. All slots available.</p>
                  <p className="text-[11px] text-slate-600 mt-1">
                    Async semaphore protects against memory exhaustion under concurrent workloads.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[#D9C6B7] flex justify-between text-[11px] text-[#6E5D4F]">
            <span>Completed Runs: <strong className="font-mono text-[#3B2A1C]">{queue?.total_completed ?? 0}</strong></span>
            <span>Watchdog Timeouts (30s): <strong className="font-mono text-rose-400">{queue?.total_timeouts ?? 0}</strong></span>
          </div>
        </Card>
      </div>

      {/* SECTION 5: Memory Estimates Catalog Matrix */}
      <div>
        <h2 className="mb-3 text-base font-semibold text-[#3B2A1C] flex items-center gap-2">
          <Database className="h-4 w-4 text-cyan-400" />
          Capability Memory Estimates &amp; Headroom Matrix
        </h2>

        <div className="overflow-x-auto rounded-lg border border-[#D9C6B7] bg-[#FAF6F0]/60">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[#D9C6B7] bg-[#FCF9F5] text-[#6E5D4F]">
              <tr>
                <th className="px-4 py-3 font-medium">Capability</th>
                <th className="px-4 py-3 font-medium">Modality</th>
                <th className="px-4 py-3 font-medium">Model ID</th>
                <th className="px-4 py-3 font-medium">Est. RAM</th>
                <th className="px-4 py-3 font-medium">Est. VRAM</th>
                <th className="px-4 py-3 font-medium">Latency</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Feasibility</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-[#5A4D3B]">
              {estimates.map((est: CapabilityMemoryEstimate) => {
                const availRam = sim?.enabled && sim.simulated_max_ram_mb !== null
                  ? sim.simulated_max_ram_mb
                  : telemetry?.available_ram_mb ?? 4096;
                const fits = est.estimated_ram_mb <= availRam;

                return (
                  <tr key={est.capability_id} className="hover:bg-[#FAF6F0]/40">
                    <td className="px-4 py-3 font-medium text-[#3B2A1C]">
                      <div>{est.name}</div>
                      <span className="font-mono text-[10px] text-[#6E5D4F]">{est.capability_id}</span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="text-[10px] border-[#D9C6B7]">
                        {est.modality}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 font-mono text-[#6E5D4F] text-[11px]">
                      {est.model_id}
                    </td>
                    <td className="px-4 py-3 font-mono font-semibold text-[#3B2A1C]">
                      {est.estimated_ram_mb} MB
                    </td>
                    <td className="px-4 py-3 font-mono text-[#6E5D4F]">
                      {est.estimated_vram_mb > 0 ? `${est.estimated_vram_mb} MB` : 'CPU Only'}
                    </td>
                    <td className="px-4 py-3 text-[#6E5D4F]">
                      ~{est.expected_latency_ms} ms
                    </td>
                    <td className="px-4 py-3">
                      {est.status === 'ready' ? (
                        <Badge variant="outline" className="border-emerald-500/40 text-emerald-300 bg-emerald-500/10 text-[10px]">
                          READY
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-[#D9C6B7] text-[#6E5D4F] text-[10px]">
                          NOT_CONFIGURED
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {fits ? (
                        <span className="flex items-center gap-1 text-[11px] text-emerald-400">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Feasible
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[11px] text-rose-400" title="Exceeds available headroom">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          Exceeds Limit
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION 6: Scheduler Lifecycle Events Timeline */}
      <div>
        <div className="mb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <h2 className="text-base font-semibold text-[#3B2A1C] flex items-center gap-2">
            <Clock className="h-4 w-4 text-cyan-400" />
            Scheduler Lifecycle Events Log
          </h2>

          {/* Filter options */}
          <div className="flex items-center gap-1 text-xs">
            <span className="text-[#6E5D4F] mr-1">Filter:</span>
            {['all', 'SELECT', 'LOAD', 'INFER', 'CACHE', 'errors', 'simulated'].map((f) => (
              <button
                key={f}
                onClick={() => setEventFilter(f)}
                className={`rounded px-2 py-0.5 text-[11px] capitalize transition-colors ${
                  eventFilter === f
                    ? 'bg-cyan-500 text-slate-950 font-semibold'
                    : 'text-[#6E5D4F] hover:bg-[#FAF6F0]'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          {filteredEvents.length > 0 ? (
            filteredEvents.map((ev: SchedulerEventItem) => (
              <div
                key={ev.id}
                className="flex flex-col md:flex-row md:items-center justify-between rounded-lg border border-[#D9C6B7] bg-[#FAF6F0]/60 p-3 gap-2"
              >
                <div className="flex items-start md:items-center gap-2.5">
                  <Badge variant="outline" className={`font-mono text-[10px] ${getStageColor(ev.stage)}`}>
                    {ev.stage}
                  </Badge>

                  {ev.status === 'success' && (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  )}
                  {ev.status === 'failed' && (
                    <XCircle className="h-4 w-4 text-rose-400 shrink-0" />
                  )}
                  {ev.status === 'started' && (
                    <Play className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                  )}

                  <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-3">
                    <span className="text-xs font-semibold text-[#3B2A1C]">
                      {ev.capability_id}
                    </span>
                    <span className="font-mono text-[11px] text-[#6E5D4F]">
                      ({ev.model_id})
                    </span>

                    {ev.error_code && (
                      <Badge variant="outline" className="border-rose-500/50 bg-rose-500/10 text-rose-300 font-mono text-[10px]">
                        {ev.error_code}
                      </Badge>
                    )}

                    {ev.is_simulated && (
                      <Badge variant="outline" className="border-amber-500/50 bg-amber-500/10 text-amber-300 font-mono text-[9px]">
                        SIMULATED_RESOURCE_LIMIT
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 text-[11px] text-[#6E5D4F]">
                  {ev.latency_ms !== null && ev.latency_ms !== undefined && (
                    <span>
                      Latency: <strong className="text-[#3B2A1C] font-mono">{ev.latency_ms.toFixed(1)} ms</strong>
                    </span>
                  )}
                  {ev.ram_mb !== null && ev.ram_mb !== undefined && (
                    <span>
                      RAM: <strong className="text-[#3B2A1C] font-mono">{ev.ram_mb} MB</strong>
                    </span>
                  )}
                  <span className="font-mono text-[#6E5D4F]">
                    {new Date(ev.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center text-[#6E5D4F] rounded-lg border border-[#D9C6B7] bg-[#FAF6F0]/40">
              <Clock className="h-8 w-8 text-slate-600 mb-2" />
              <p className="text-xs">No scheduler events recorded for the selected filter.</p>
              <p className="text-[11px] text-slate-600 mt-1">
                Scheduler events are published live as capabilities progress through the 6-stage lifecycle.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResourceSchedulerPage;
