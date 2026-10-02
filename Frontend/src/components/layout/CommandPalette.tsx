import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  LayoutDashboard,
  Users,
  PlusCircle,
  Activity,
  GitGraph,
  Cpu,
  FileCheck2,
  Settings,
  Calendar,
  Layers,
  Sparkles,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import { apiClient } from '../../services/apiClient';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ActionItem {
  id: string;
  title: string;
  subtitle?: string;
  category: 'Navigation' | 'Actions' | 'Cases';
  icon: React.ComponentType<{ className?: string }>;
  path: string;
  shortcut?: string;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentCases, setRecentCases] = useState<any[]>([]);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch recent cases for fast context switching
  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;
    apiClient
      .getCases()
      .then((res: any) => {
        if (isMounted) {
          const items = Array.isArray(res) ? res : res?.items || res?.cases || [];
          setRecentCases(items);
        }
      })
      .catch(() => {
        // Non-blocking fallback
      });
    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  // Base navigation actions
  const staticActions: ActionItem[] = [
    {
      id: 'dashboard',
      title: 'Clinical Dashboard',
      subtitle: 'Triage queue & active telemetry',
      category: 'Navigation',
      icon: LayoutDashboard,
      path: '/',
      shortcut: 'G D',
    },
    {
      id: 'patients',
      title: 'Patient Directory',
      subtitle: 'Master clinical cohort index',
      category: 'Navigation',
      icon: Users,
      path: '/patients',
      shortcut: 'G P',
    },
    {
      id: 'new-case',
      title: 'New Clinical Case Intake',
      subtitle: 'Ingest multi-modal patient assets',
      category: 'Actions',
      icon: PlusCircle,
      path: '/cases/new',
      shortcut: 'C N',
    },
    {
      id: 'orchestration',
      title: 'Live Orchestration DAG',
      subtitle: 'Real-time multi-agent pipeline telemetry',
      category: 'Navigation',
      icon: Activity,
      path: '/orchestration',
      shortcut: 'G O',
    },
    {
      id: 'evidence-graph',
      title: 'Interactive Evidence Graph',
      subtitle: 'Inspect causal provenance & cross-modal linkages',
      category: 'Navigation',
      icon: GitGraph,
      path: '/evidence-graph',
      shortcut: 'G E',
    },
    {
      id: 'reports',
      title: 'Screening Reports & Summaries',
      subtitle: 'Structured intelligence synthesis & review notes',
      category: 'Navigation',
      icon: FileCheck2,
      path: '/reports',
      shortcut: 'G R',
    },
    {
      id: 'registry',
      title: 'Model Registry',
      subtitle: 'Inspect specialized clinical model weights & versions',
      category: 'Navigation',
      icon: Cpu,
      path: '/registry',
      shortcut: 'G M',
    },
    {
      id: 'scheduler',
      title: 'Resource Scheduler',
      subtitle: 'GPU VRAM, queue pressure & worker nodes',
      category: 'Navigation',
      icon: Calendar,
      path: '/scheduler',
    },
    {
      id: 'capabilities',
      title: 'Capability Catalog',
      subtitle: 'Registered diagnostic & analytical capabilities',
      category: 'Navigation',
      icon: Layers,
      path: '/capabilities',
    },
    {
      id: 'settings',
      title: 'Workstation Settings',
      subtitle: 'Clinician credentials, display & safety thresholds',
      category: 'Navigation',
      icon: Settings,
      path: '/settings',
      shortcut: 'G S',
    },
  ];

  // Map recent cases into dynamic actions
  const caseActions: ActionItem[] = recentCases.map((c) => ({
    id: `case-${c.id}`,
    title: `Case #${c.id.slice(0, 8)}: ${c.patient_name || c.patient_id || 'Patient Record'}`,
    subtitle: `Status: ${c.review_state || c.status || 'Active'} • Priority: ${c.priority || 'ROUTINE'}`,
    category: 'Cases',
    icon: Sparkles,
    path: `/cases/${c.id}`,
  }));

  const allActions = [...staticActions, ...caseActions];

  const filtered = allActions.filter((item) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      item.title.toLowerCase().includes(q) ||
      (item.subtitle && item.subtitle.toLowerCase().includes(q)) ||
      item.category.toLowerCase().includes(q)
    );
  });

  // Reset index when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
    }
  }, [isOpen]);

  // Keyboard navigation inside palette
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev < filtered.length - 1 ? prev + 1 : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : filtered.length - 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const selected = filtered[selectedIndex];
        if (selected) {
          navigate(selected.path);
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedIndex, filtered, navigate, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Clinical Workstation Command Palette"
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-[#3B2A1C]/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl overflow-hidden rounded-2xl border border-[#D9C6B7] bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="relative flex items-center border-b border-[#D9C6B7] px-4 py-3.5 bg-[#FAF6F0]">
          <Search className="w-5 h-5 text-[#8B6F5B] shrink-0 mr-3" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a screen, command, patient ID or case..."
            className="w-full bg-transparent text-sm text-[#3B2A1C] placeholder-[#8B6F5B] focus:outline-none font-medium"
          />
          <kbd className="hidden sm:inline-flex items-center gap-1 rounded bg-white px-2 py-0.5 text-[10px] font-mono text-[#5A4D3B] border border-[#D9C6B7]">
            ESC to close
          </kbd>
        </div>

        {/* Results List */}
        <div className="max-h-[380px] overflow-y-auto p-2 divide-y divide-[#E8DCD1]/50">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-[#6E5D4F]">
              No matching clinical screens, actions or cases found.
            </div>
          ) : (
            filtered.map((item, index) => {
              const Icon = item.icon;
              const isSelected = index === selectedIndex;
              return (
                <div
                  key={item.id}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    navigate(item.path);
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl cursor-pointer text-sm transition-all ${
                    isSelected
                      ? 'bg-[#F2E4D5] border border-[#D9C6B7] text-[#3B2A1C]'
                      : 'text-[#5A4D3B] hover:bg-[#FAF6F0] border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`p-2 rounded-lg shrink-0 ${
                        isSelected
                          ? 'bg-[#8B6F5B] text-white shadow-2xs'
                          : 'bg-[#F2E4D5] text-[#8B6F5B]'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-[#3B2A1C] truncate flex items-center gap-2">
                        <span>{item.title}</span>
                        {item.category === 'Cases' && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#FAF6F0] text-[#8B6F5B] border border-[#D9C6B7]">
                            Active Case
                          </span>
                        )}
                      </div>
                      {item.subtitle && (
                        <div className="text-xs text-[#6E5D4F] truncate">{item.subtitle}</div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    {item.shortcut && (
                      <span className="text-[10px] font-mono text-[#8B6F5B] bg-white px-1.5 py-0.5 rounded border border-[#D9C6B7]">
                        {item.shortcut}
                      </span>
                    )}
                    <ArrowRight
                      className={`w-3.5 h-3.5 transition-transform ${
                        isSelected ? 'text-[#8B6F5B] translate-x-0.5' : 'text-[#D9C6B7]'
                      }`}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Safety Footer */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-[#FAF6F0] border-t border-[#D9C6B7] text-[11px] text-[#6E5D4F]">
          <div className="flex items-center gap-1.5 text-[#5A4D3B]">
            <ShieldAlert className="w-3.5 h-3.5 text-[#8B6F5B]" />
            <span>Clinical Workstation Navigation • Non-Autonomous Mode</span>
          </div>
          <div className="hidden sm:flex items-center gap-3 font-mono text-[#8B6F5B]">
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
          </div>
        </div>
      </div>
    </div>
  );
};
