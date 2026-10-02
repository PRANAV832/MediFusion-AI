import React, { useEffect, useState, useCallback } from 'react';
import { apiClient } from '../../services/apiClient';
import type { HealthStatusResponse } from '../../types/api';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';
import { Activity, CheckCircle2, XCircle, RefreshCw, Server } from 'lucide-react';

interface HealthStatusProps {
  compact?: boolean;
  onStatusChange?: (connected: boolean) => void;
}

export const HealthStatus: React.FC<HealthStatusProps> = ({
  compact = false,
  onStatusChange,
}) => {
  const [data, setData] = useState<HealthStatusResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [latency, setLatency] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const checkHealth = useCallback(async () => {
    setLoading(true);
    setError(null);
    const start = performance.now();

    try {
      const response = await apiClient.getHealth();
      const elapsed = Math.round(performance.now() - start);
      setLatency(elapsed);
      setData(response);
      onStatusChange?.(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Backend unreachable');
      setData(null);
      setLatency(null);
      onStatusChange?.(false);
    } finally {
      setLoading(false);
    }
  }, [onStatusChange]);

  useEffect(() => {
    checkHealth();
    // Poll health status every 30 seconds
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, [checkHealth]);

  if (compact) {
    if (loading && !data) {
      return (
        <div
          data-testid="health-status-compact-loading"
          className="inline-flex items-center gap-2 rounded-full border border-[#D9C6B7] bg-[#FAF6F0] px-3 py-1 text-xs text-[#5A4D3B]"
        >
          <RefreshCw className="h-3 w-3 animate-spin text-[#8B6F5B]" />
          <span>Checking Backend...</span>
        </div>
      );
    }

    if (error || !data) {
      return (
        <div
          data-testid="health-status-compact-unavailable"
          className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs text-rose-800"
          title={error || 'Backend Unavailable'}
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-600" />
          </span>
          <span className="font-medium">Backend Unavailable</span>
          <button
            onClick={checkHealth}
            className="ml-1 text-rose-700 hover:text-rose-900 transition-colors"
            title="Retry Connection"
            aria-label="Retry backend connection"
          >
            <RefreshCw className="h-3 w-3" />
          </button>
        </div>
      );
    }

    return (
      <div
        data-testid="health-status-compact-connected"
        className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs text-emerald-800"
      >
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-600" />
        </span>
        <span className="font-medium">Backend Connected</span>
        {latency !== null && (
          <span className="text-[10px] text-emerald-700 font-mono border-l border-emerald-200 pl-2">
            {latency}ms
          </span>
        )}
      </div>
    );
  }

  // Full card presentation
  return (
    <div
      data-testid="health-status-full"
      className="flex flex-col gap-4 rounded-xl border border-[#D9C6B7] bg-white p-5 shadow-sm"
    >
      <div className="flex items-center justify-between border-b border-[#E8DCD1] pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-[#F2E4D5] text-[#8B6F5B]">
            <Server className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-[#3B2A1C]">Backend System Telemetry</h4>
            <p className="text-xs text-[#6E5D4F]">Endpoint: GET /health</p>
          </div>
        </div>

        {loading ? (
          <Badge variant="secondary" className="gap-1.5 py-1">
            <RefreshCw className="h-3 w-3 animate-spin text-[#8B6F5B]" />
            <span>Checking...</span>
          </Badge>
        ) : data ? (
          <Badge variant="success" className="gap-1.5 py-1">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span className="font-semibold">Backend Connected</span>
          </Badge>
        ) : (
          <Badge variant="destructive" className="gap-1.5 py-1">
            <XCircle className="h-3.5 w-3.5" />
            <span className="font-semibold">Backend Unavailable</span>
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="rounded-lg bg-[#FAF6F0] p-2.5 border border-[#D9C6B7]">
          <span className="text-[#6E5D4F] block mb-1">Status</span>
          <span className="font-mono font-semibold text-[#3B2A1C]">
            {loading ? '...' : data ? data.status.toUpperCase() : 'OFFLINE'}
          </span>
        </div>

        <div className="rounded-lg bg-[#FAF6F0] p-2.5 border border-[#D9C6B7]">
          <span className="text-[#6E5D4F] block mb-1">Environment</span>
          <span className="font-mono font-semibold text-[#8B6F5B]">
            {loading ? '...' : data ? data.environment : 'N/A'}
          </span>
        </div>

        <div className="rounded-lg bg-[#FAF6F0] p-2.5 border border-[#D9C6B7]">
          <span className="text-[#6E5D4F] block mb-1">Version</span>
          <span className="font-mono font-semibold text-[#3B2A1C]">
            {loading ? '...' : data ? `v${data.version}` : 'N/A'}
          </span>
        </div>

        <div className="rounded-lg bg-[#FAF6F0] p-2.5 border border-[#D9C6B7]">
          <span className="text-[#6E5D4F] block mb-1">Round-trip Latency</span>
          <span className="font-mono font-semibold text-emerald-700">
            {loading ? '...' : latency !== null ? `${latency} ms` : 'N/A'}
          </span>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
          <p className="font-medium mb-1">Connection Error Details:</p>
          <p className="font-mono text-rose-700">{error}</p>
          <p className="mt-2 text-[#6E5D4F] text-[11px]">
            Ensure the FastAPI backend is running via{' '}
            <code className="bg-white border border-[#D9C6B7] px-1 py-0.5 rounded text-[#3B2A1C]">
              uvicorn app.main:app --port 8000
            </code>
          </p>
        </div>
      )}

      {data && (
        <div className="flex items-center justify-between pt-1 text-[11px] text-[#6E5D4F]">
          <div className="flex items-center gap-1.5">
            <Activity className="h-3 w-3 text-emerald-700" />
            <span>Server Uptime: {Math.floor(data.uptime_seconds)}s</span>
          </div>
          <span>Reported: {new Date(data.timestamp).toLocaleTimeString()}</span>
        </div>
      )}

      <div className="flex justify-end pt-1">
        <Button
          size="sm"
          variant="outline"
          onClick={checkHealth}
          disabled={loading}
          className="gap-2 text-xs"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin text-[#8B6F5B]')} />
          Refresh Status
        </Button>
      </div>
    </div>
  );
};
