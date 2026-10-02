import React, { useState, useEffect, useCallback } from 'react';
import {
  Server,
  Zap,
  HardDrive,
  RefreshCw,
  Clock,
  Layers,
  Activity,
  Trash2,
  History,
} from 'lucide-react';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { apiClient } from '../../services/apiClient';
import type { SchedulerDashboardData } from '../../types/api';

export const ResourceDashboardWidget: React.FC = () => {
  const [data, setData] = useState<SchedulerDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [eventFilter, setEventFilter] = useState<'all' | 'LOAD' | 'UNLOAD'>('all');

  const fetchTelemetry = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const resp = await apiClient.getSchedulerDashboard();
      setData(resp);
    } catch (err) {
      console.error('Failed to load scheduler telemetry:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchTelemetry();
    const interval = setInterval(() => fetchTelemetry(true), 3500);
    return () => clearInterval(interval);
  }, [fetchTelemetry]);

  const handleEvictAll = async () => {
    if (!confirm('Evict all resident models from RAM cache?')) return;
    try {
      await apiClient.unloadAllSchedulerModels();
      await fetchTelemetry(true);
    } catch (err) {
      console.error('Failed to evict all models:', err);
    }
  };

  if (loading) {
    return (
      <Card className="p-6 text-center bg-white border-[#D9C6B7]">
        <RefreshCw className="w-6 h-6 animate-spin text-[#8B6F5B] mx-auto mb-2" />
        <span className="text-xs text-[#6E5D4F]">Loading Hardware & Model Resource Telemetry...</span>
      </Card>
    );
  }

  const telemetry = data?.telemetry;
  const cache = data?.cache;
  const queue = data?.queue;
  const sim = data?.simulated_limits;
  const events = data?.recent_events || [];

  const filteredEvents = events.filter((e) => {
    if (eventFilter === 'all') return true;
    return e.stage === eventFilter;
  });

  return (
    <div className="space-y-4">
      {/* Title & Polling Indicator */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-[#D9C6B7] shadow-sm">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-[#8B6F5B]" />
          <div>
            <h3 className="text-sm font-bold text-[#3B2A1C] flex items-center gap-2">
              Hardware & Model Resource Dashboard
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            </h3>
            <p className="text-[11px] text-[#6E5D4F]">
              Live supervision of resident models, host RAM, VRAM, lifecycle events, and task queue.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          {sim?.enabled && (
            <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-900 font-mono text-[10px]">
              SIMULATED CEILING: {sim.simulated_max_ram_mb} MB RAM
            </Badge>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => fetchTelemetry(false)}
            disabled={refreshing}
            className="text-xs h-7 border-[#D9C6B7] bg-white text-[#5A4D3B] hover:bg-[#FAF6F0]"
          >
            <RefreshCw className={`w-3 h-3 mr-1 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 6 MANDATORY METRIC CARDS */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {/* 1. ACTIVE MODELS */}
        <Card className="p-4 bg-white border-[#D9C6B7] space-y-2 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#6E5D4F] uppercase tracking-wider">1. Active Models</span>
            <HardDrive className="w-4 h-4 text-[#8B6F5B]" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-[#3B2A1C]">
              {cache?.resident_models_count ?? 0}
            </span>
            <span className="text-xs text-[#6E5D4F]">/ {cache?.max_resident_models ?? 3} Resident in RAM</span>
          </div>
          <div className="text-[11px] text-[#6E5D4F] truncate">
            {cache?.resident_models && cache.resident_models.length > 0 ? (
              <span className="text-[#3B2A1C] font-mono">
                {cache.resident_models.map((m: any) => m.model_name || m.model_id).join(', ')}
              </span>
            ) : (
              <span className="text-[#6E5D4F] italic">No models currently resident in RAM</span>
            )}
          </div>
        </Card>

        {/* 2. MEMORY (RAM) */}
        <Card className="p-4 bg-white border-[#D9C6B7] space-y-2 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#6E5D4F] uppercase tracking-wider">2. System Memory</span>
            <Server className="w-4 h-4 text-[#8B6F5B]" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-[#3B2A1C]">
              {telemetry?.used_ram_mb ? (telemetry.used_ram_mb / 1024).toFixed(1) : 0} GB
            </span>
            <span className="text-xs text-[#6E5D4F]">
              / {telemetry?.total_ram_mb ? (telemetry.total_ram_mb / 1024).toFixed(1) : 0} GB
            </span>
          </div>
          <div className="w-full bg-[#FAF6F0] rounded-full h-1.5 overflow-hidden border border-[#D9C6B7]">
            <div
              className="bg-[#8B6F5B] h-full rounded-full transition-all"
              style={{ width: `${Math.min(100, telemetry?.ram_usage_percent ?? 0)}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[10px] text-[#6E5D4F]">
            <span>Resident Model RAM: {cache?.total_resident_ram_mb ?? 0} MB</span>
            <span className="text-[#5A4D3B] font-mono">{telemetry?.available_ram_mb ? (telemetry.available_ram_mb / 1024).toFixed(1) : 0} GB Free</span>
          </div>
        </Card>

        {/* 3. VRAM (GPU) */}
        <Card className="p-4 bg-white border-[#D9C6B7] space-y-2 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#6E5D4F] uppercase tracking-wider">3. GPU / VRAM</span>
            <Zap className="w-4 h-4 text-[#8B6F5B]" />
          </div>
          <div className="flex items-baseline gap-2">
            {telemetry?.cuda_available ? (
              <>
                <span className="text-2xl font-bold font-mono text-[#3B2A1C]">
                  {telemetry.allocated_vram_mb} MB
                </span>
                <span className="text-xs text-[#6E5D4F]">/ {telemetry.total_vram_mb} MB</span>
              </>
            ) : (
              <span className="text-lg font-bold text-[#5A4D3B]">CPU Fallback</span>
            )}
          </div>
          <div className="w-full bg-[#FAF6F0] rounded-full h-1.5 overflow-hidden border border-[#D9C6B7]">
            <div
              className="bg-[#5A4D3B] h-full rounded-full transition-all"
              style={{
                width: `${
                  telemetry?.total_vram_mb && telemetry.total_vram_mb > 0
                    ? Math.min(100, (telemetry.allocated_vram_mb / telemetry.total_vram_mb) * 100)
                    : 0
                }%`,
              }}
            />
          </div>
          <p className="text-[10px] text-[#6E5D4F] truncate">
            {telemetry?.cuda_available ? telemetry.gpu_name : 'PyTorch CPU runtime mode active'}
          </p>
        </Card>

        {/* 4. EXECUTION QUEUE */}
        <Card className="p-4 bg-white border-[#D9C6B7] space-y-2 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#6E5D4F] uppercase tracking-wider">4. Execution Queue</span>
            <Layers className="w-4 h-4 text-[#8B6F5B]" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-[#8B6F5B]">
              {queue?.running_count ?? 0} Active
            </span>
            <span className="text-xs text-[#6E5D4F] font-mono">({queue?.queued_count ?? 0} queued)</span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-[#6E5D4F] pt-1">
            <span>Concurrency Limit: Max {queue?.max_concurrency ?? 2} Parallel</span>
            <span className="text-[#3B2A1C] font-mono">{queue?.total_completed ?? 0} Completed</span>
          </div>
        </Card>

        {/* 5. RUNTIME TELEMETRY */}
        <Card className="p-4 bg-white border-[#D9C6B7] space-y-2 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#6E5D4F] uppercase tracking-wider">5. Model Runtime</span>
            <Clock className="w-4 h-4 text-[#8B6F5B]" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-emerald-700">
              {cache?.resident_models && cache.resident_models.length > 0
                ? `${cache.resident_models[0].estimated_ram_mb} MB`
                : 'Nominal'}
            </span>
            <span className="text-xs text-[#6E5D4F]">Latency: &lt;500ms</span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-[#6E5D4F] pt-1">
            <span>Cache Hits: {cache?.hits ?? 0}</span>
            <span>LRU Evictions: {cache?.evictions ?? 0}</span>
          </div>
        </Card>

        {/* 6. LOAD / UNLOAD CONTROL */}
        <Card className="p-4 bg-white border-[#D9C6B7] space-y-2 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#6E5D4F] uppercase tracking-wider">6. Lifecycle Management</span>
            <Trash2 className="w-4 h-4 text-rose-600" />
          </div>
          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-[#5A4D3B]">Resident Weights Eviction</span>
            <Button
              size="sm"
              variant="outline"
              onClick={handleEvictAll}
              disabled={!cache || cache.resident_models_count === 0}
              className="text-xs h-7 border-rose-300 text-rose-800 bg-rose-50 hover:bg-rose-100"
            >
              Evict All Models
            </Button>
          </div>
          <p className="text-[10px] text-[#6E5D4F]">Reclaims memory immediately for pending tasks.</p>
        </Card>
      </div>

      {/* ========================================================================= */}
      {/* LOAD / UNLOAD EVENT AUDIT LOG */}
      {/* ========================================================================= */}
      <Card className="p-4 bg-white border-[#D9C6B7] space-y-3 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#D9C6B7] pb-2.5">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-[#8B6F5B]" />
            <h4 className="text-xs font-bold text-[#3B2A1C] uppercase tracking-wider">
              Load &amp; Unload Lifecycle Events ({filteredEvents.length})
            </h4>
          </div>

          <div className="flex items-center gap-1.5 text-xs">
            <button
              onClick={() => setEventFilter('all')}
              className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all ${
                eventFilter === 'all'
                  ? 'bg-[#8B6F5B] text-white font-bold'
                  : 'text-[#6E5D4F] hover:text-[#3B2A1C]'
              }`}
            >
              All Events
            </button>
            <button
              onClick={() => setEventFilter('LOAD')}
              className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all ${
                eventFilter === 'LOAD'
                  ? 'bg-purple-100 text-purple-900 border border-purple-300 font-bold'
                  : 'text-[#6E5D4F] hover:text-[#3B2A1C]'
              }`}
            >
              Loads
            </button>
            <button
              onClick={() => setEventFilter('UNLOAD')}
              className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all ${
                eventFilter === 'UNLOAD'
                  ? 'bg-amber-100 text-amber-900 border border-amber-300 font-bold'
                  : 'text-[#6E5D4F] hover:text-[#3B2A1C]'
              }`}
            >
              Unloads
            </button>
          </div>
        </div>

        {filteredEvents.length === 0 ? (
          <p className="text-xs text-[#6E5D4F] italic py-3 text-center">No lifecycle events recorded.</p>
        ) : (
          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {filteredEvents.slice(0, 10).map((evt) => (
              <div
                key={evt.id}
                className="p-2 rounded bg-[#FCF9F5] border border-[#D9C6B7] flex items-center justify-between text-xs font-mono"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      evt.stage === 'LOAD'
                        ? 'bg-purple-50 text-purple-800 border border-purple-200'
                        : evt.stage === 'UNLOAD'
                        ? 'bg-amber-50 text-amber-900 border border-amber-200'
                        : 'bg-[#FAF6F0] text-[#5A4D3B] border border-[#D9C6B7]'
                    }`}
                  >
                    {evt.stage}
                  </span>
                  <span className="text-[#3B2A1C] font-semibold">{evt.capability_id}</span>
                  <span className="text-[#6E5D4F] text-[10px] truncate max-w-xs">
                    {(evt.details as any)?.reason || ''}
                  </span>
                </div>
                <span className="text-[#6E5D4F] text-[10px]">
                  {new Date(evt.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

