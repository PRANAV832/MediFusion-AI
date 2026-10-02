import React from 'react';
import type { OrchestrationEventItem } from '../../types/api';
import {
  Clock,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  Loader2,
  Terminal,
} from 'lucide-react';

interface EventTimelineStreamProps {
  events: OrchestrationEventItem[];
  activeStage?: string | null;
}

const EVENT_STATE_ICONS = {
  QUEUED: Clock,
  RUNNING: Loader2,
  COMPLETED: CheckCircle2,
  FAILED: XCircle,
  REVIEW_REQUIRED: ShieldAlert,
};

export const EventTimelineStream: React.FC<EventTimelineStreamProps> = ({ events, activeStage }) => {
  return (
    <div className="flex flex-col h-full bg-white rounded-xl border border-[#D9C6B7] p-4 space-y-3 shadow-sm">
      <div className="flex items-center justify-between pb-2 border-b border-[#D9C6B7]/60">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-[#8B6F5B]" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#3B2A1C]">
            Real-Time Backend Trace Stream
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {activeStage && (
            <span className="text-[10px] font-mono font-bold text-[#3B2A1C] bg-[#F2E4D5] px-2 py-0.5 rounded border border-[#8B6F5B]">
              {activeStage}
            </span>
          )}
          <span className="text-[11px] font-mono text-[#5A4D3B] bg-[#FAF6F0] px-2 py-0.5 rounded border border-[#D9C6B7]">
            {events.length} Event(s)
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar text-xs">
        {events.length === 0 ? (
          <div className="py-12 text-center text-[#8B6F5B] space-y-2">
            <Clock className="w-6 h-6 mx-auto text-[#8B6F5B]/60" />
            <p className="font-medium text-[#3B2A1C]">No orchestration events triggered yet.</p>
            <p className="text-[11px] text-[#6E5D4F]">Click "Trigger Live Execution" to run the pipeline.</p>
          </div>
        ) : (
          events.map((ev, idx) => {
            const StateIcon = EVENT_STATE_ICONS[ev.state] || CheckCircle2;
            const isLatest = idx === events.length - 1;

            let badgeColor = 'text-[#6E5D4F] bg-[#FAF6F0] border-[#D9C6B7]';
            if (ev.state === 'RUNNING') badgeColor = 'text-[#8B6F5B] bg-[#F2E4D5] border-[#8B6F5B]';
            if (ev.state === 'COMPLETED') badgeColor = 'text-emerald-800 bg-emerald-50 border-emerald-300';
            if (ev.state === 'REVIEW_REQUIRED') badgeColor = 'text-amber-800 bg-amber-50 border-amber-300';
            if (ev.state === 'FAILED') badgeColor = 'text-rose-800 bg-rose-50 border-rose-300';

            return (
              <div
                key={ev.id || idx}
                className={`p-2.5 rounded-lg border transition-all ${
                  isLatest
                    ? 'bg-[#FAF6F0] border-[#8B6F5B] shadow-sm'
                    : 'bg-[#FAF6F0]/60 border-[#D9C6B7]/60 hover:border-[#8B6F5B]'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold border ${badgeColor}`}>
                    <StateIcon className={`w-2.5 h-2.5 ${ev.state === 'RUNNING' ? 'animate-spin' : ''}`} />
                    {ev.stage_node} • #{ev.sequence}
                  </span>
                  <span className="text-[10px] font-mono text-[#6E5D4F]">
                    {ev.duration_ms ? `${ev.duration_ms} ms` : new Date(ev.created_at).toLocaleTimeString()}
                  </span>
                </div>

                <div className="font-semibold text-[#3B2A1C] text-xs">{ev.title}</div>
                <p className="text-[#5A4D3B] text-[11px] leading-relaxed mt-0.5">{ev.message}</p>

                {ev.payload && Object.keys(ev.payload).length > 0 && (
                  <div className="mt-1.5 pt-1.5 border-t border-[#D9C6B7]/60 font-mono text-[10px] text-[#6E5D4F] truncate">
                    payload: {JSON.stringify(ev.payload)}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
