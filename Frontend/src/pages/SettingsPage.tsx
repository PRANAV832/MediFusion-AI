import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { MedicalSafetyBanner } from '../components/ui/clinical-badges';
import {
  Settings,
  User,
  Shield,
  Monitor,
  Cpu,
  Keyboard,
  CheckCircle2,
  Save,
  RotateCcw,
} from 'lucide-react';

interface WorkstationPreferences {
  clinicianName: string;
  clinicianRole: string;
  npiNumber: string;
  department: string;
  density: 'comfortable' | 'compact' | 'high_density';
  highContrast: boolean;
  audioAlerts: boolean;
  autoRefreshInterval: number; // in seconds
  disagreementSensitivity: 'strict' | 'standard' | 'lenient';
  requireDualSignOff: boolean;
  devicePreference: 'cuda_preferred' | 'cpu_only';
  maxConcurrentInferences: number;
}

const DEFAULT_PREFERENCES: WorkstationPreferences = {
  clinicianName: 'Dr. Jane Doe, MD',
  clinicianRole: 'Attending Radiologist',
  npiNumber: 'NPI-849201948',
  department: 'Diagnostic Imaging & Acute Care',
  density: 'compact',
  highContrast: false,
  audioAlerts: true,
  autoRefreshInterval: 5,
  disagreementSensitivity: 'strict',
  requireDualSignOff: true,
  devicePreference: 'cuda_preferred',
  maxConcurrentInferences: 2,
};

export const SettingsPage: React.FC = () => {
  const { profile } = useAuth();
  const [prefs, setPrefs] = useState<WorkstationPreferences>(() => {
    try {
      const saved = localStorage.getItem('medifusion_workstation_prefs');
      if (saved) return { ...DEFAULT_PREFERENCES, ...JSON.parse(saved) };
    } catch {
      // fallback
    }
    return DEFAULT_PREFERENCES;
  });

  const [savedSuccess, setSavedSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'display' | 'safety' | 'hardware' | 'shortcuts'>('profile');

  // Update profile from auth context if available
  useEffect(() => {
    if (profile?.full_name) {
      setPrefs((prev) => ({
        ...prev,
        clinicianName: profile.full_name || prev.clinicianName || '',
        clinicianRole: profile.role || prev.clinicianRole,
      }));
    }
  }, [profile]);

  const handleSave = () => {
    try {
      localStorage.setItem('medifusion_workstation_prefs', JSON.stringify(prefs));
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (e) {
      console.error('Failed to save preferences:', e);
    }
  };

  const handleReset = () => {
    setPrefs(DEFAULT_PREFERENCES);
    localStorage.removeItem('medifusion_workstation_prefs');
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Medical Safety Notice */}
      <MedicalSafetyBanner />

      {/* Screen Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-[#F2E4D5] text-[#5A4D3B] border border-[#D9C6B7]">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#3B2A1C]">
              Workstation Settings & Preferences
            </h1>
            <p className="text-xs sm:text-sm text-[#6E5D4F]">
              Configure clinician credentials, ergonomics, decision support sensitivity & keyboard shortcuts
            </p>
          </div>
        </div>

        {/* Save / Reset Buttons */}
        <div className="flex items-center gap-2">
          {savedSuccess && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium animate-in fade-in">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Settings Saved
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            className="border-[#D9C6B7] bg-white text-[#5A4D3B] hover:bg-[#FAF6F0] gap-1.5 text-xs"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Defaults
          </Button>
          <Button
            size="sm"
            variant="default"
            onClick={handleSave}
            className="bg-[#8B6F5B] hover:bg-[#5A4D3B] text-white shadow-sm gap-1.5 text-xs"
          >
            <Save className="w-3.5 h-3.5" />
            Save Changes
          </Button>
        </div>
      </div>

      {/* Settings Navigation Tabs */}
      <div className="flex overflow-x-auto gap-2 border-b border-[#D9C6B7] pb-2">
        {[
          { id: 'profile', label: 'Clinician Profile', icon: User },
          { id: 'display', label: 'Ergonomics & Display', icon: Monitor },
          { id: 'safety', label: 'Clinical Thresholds', icon: Shield },
          { id: 'hardware', label: 'Compute & Engine', icon: Cpu },
          { id: 'shortcuts', label: 'Keyboard Shortcuts', icon: Keyboard },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
                isActive
                  ? 'bg-slate-800 text-[#8B6F5B] border border-[#D9C6B7] font-semibold'
                  : 'text-[#6E5D4F] hover:text-[#3B2A1C] hover:bg-[#FCF9F5]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab 1: Clinician Profile */}
      {activeTab === 'profile' && (
        <Card className="p-6 bg-white border-[#D9C6B7] shadow-sm space-y-5">
          <div>
            <h2 className="text-base font-semibold text-[#3B2A1C] flex items-center gap-2">
              <User className="w-4 h-4 text-[#8B6F5B]" />
              Clinician Identification & Credentialing
            </h2>
            <p className="text-xs text-[#6E5D4F] mt-1">
              These details are attached to audit logs, review signatures, and generated clinical screening reports.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#5A4D3B]">Clinician Full Name & Degree</label>
              <input
                type="text"
                value={prefs.clinicianName}
                onChange={(e) => setPrefs({ ...prefs, clinicianName: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-[#FAF6F0] border border-[#D9C6B7] text-sm text-[#3B2A1C] focus:outline-none focus:border-[#8B6F5B]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#5A4D3B]">Clinical Specialty / Role</label>
              <input
                type="text"
                value={prefs.clinicianRole}
                onChange={(e) => setPrefs({ ...prefs, clinicianRole: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-[#FAF6F0] border border-[#D9C6B7] text-sm text-[#3B2A1C] focus:outline-none focus:border-[#8B6F5B]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#5A4D3B]">NPI or Medical License Identifier</label>
              <input
                type="text"
                value={prefs.npiNumber}
                onChange={(e) => setPrefs({ ...prefs, npiNumber: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-[#FAF6F0] border border-[#D9C6B7] text-sm font-mono text-[#3B2A1C] focus:outline-none focus:border-[#8B6F5B]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#5A4D3B]">Hospital Department / Ward</label>
              <input
                type="text"
                value={prefs.department}
                onChange={(e) => setPrefs({ ...prefs, department: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-[#FAF6F0] border border-[#D9C6B7] text-sm text-[#3B2A1C] focus:outline-none focus:border-[#8B6F5B]"
              />
            </div>
          </div>
        </Card>
      )}

      {/* Tab 2: Ergonomics & Display */}
      {activeTab === 'display' && (
        <Card className="p-6 bg-white border-[#D9C6B7] shadow-sm space-y-6">
          <div>
            <h2 className="text-base font-semibold text-[#3B2A1C] flex items-center gap-2">
              <Monitor className="w-4 h-4 text-[#8B6F5B]" />
              Workstation Ergonomics & Density
            </h2>
            <p className="text-xs text-[#6E5D4F] mt-1">
              Optimize visual density for reading room monitors, high-DPI displays, and bedside tablets.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-[#5A4D3B] block mb-2">Information Density</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { id: 'comfortable', label: 'Comfortable', desc: 'Standard spacing for general review' },
                  { id: 'compact', label: 'Compact (Workstation)', desc: 'Optimized for high-volume triage' },
                  { id: 'high_density', label: 'High Density', desc: 'Maximum telemetry per screen pixel' },
                ].map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setPrefs({ ...prefs, density: d.id as any })}
                    className={`p-3.5 rounded-xl border text-left transition-all ${
                      prefs.density === d.id
                        ? 'border-cyan-500/60 bg-cyan-950/30 text-cyan-200'
                        : 'border-[#D9C6B7] bg-[#FAF6F0] text-[#6E5D4F] hover:border-[#D9C6B7]'
                    }`}
                  >
                    <div className="text-xs font-semibold">{d.label}</div>
                    <div className="text-[11px] text-[#6E5D4F] mt-1">{d.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-[#D9C6B7] space-y-3">
              <label className="flex items-center justify-between cursor-pointer p-3 rounded-xl bg-[#FAF6F0] border border-[#D9C6B7]/80 hover:border-[#D9C6B7]">
                <div className="space-y-0.5">
                  <div className="text-xs font-medium text-[#3B2A1C]">High Contrast Reading Room Mode</div>
                  <div className="text-[11px] text-[#6E5D4F]">Increase outline contrast for dimly-lit radiology suites</div>
                </div>
                <input
                  type="checkbox"
                  checked={prefs.highContrast}
                  onChange={(e) => setPrefs({ ...prefs, highContrast: e.target.checked })}
                  className="rounded border-[#D9C6B7] text-cyan-500 focus:ring-cyan-400 h-4 w-4"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer p-3 rounded-xl bg-[#FAF6F0] border border-[#D9C6B7]/80 hover:border-[#D9C6B7]">
                <div className="space-y-0.5">
                  <div className="text-xs font-medium text-[#3B2A1C]">Audible STAT Case Notification</div>
                  <div className="text-[11px] text-[#6E5D4F]">Play clinical chime when a STAT case enters the queue</div>
                </div>
                <input
                  type="checkbox"
                  checked={prefs.audioAlerts}
                  onChange={(e) => setPrefs({ ...prefs, audioAlerts: e.target.checked })}
                  className="rounded border-[#D9C6B7] text-cyan-500 focus:ring-cyan-400 h-4 w-4"
                />
              </label>
            </div>
          </div>
        </Card>
      )}

      {/* Tab 3: Safety & Decision Support Thresholds */}
      {activeTab === 'safety' && (
        <Card className="p-6 bg-white border-[#D9C6B7] shadow-sm space-y-6">
          <div>
            <h2 className="text-base font-semibold text-[#3B2A1C] flex items-center gap-2">
              <Shield className="w-4 h-4 text-amber-400" />
              Clinical Conflict & Uncertainty Policy
            </h2>
            <p className="text-xs text-[#6E5D4F] mt-1">
              Governs automated conflict flagging, sensitivity analysis bounds, and dual-review requirements.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-[#5A4D3B] block mb-2">Cross-Model Disagreement Sensitivity</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { id: 'strict', label: 'Strict (Conservative)', desc: 'Flag conflict if findings disagree by > 15%' },
                  { id: 'standard', label: 'Standard (Balanced)', desc: 'Flag conflict if findings disagree by > 25%' },
                  { id: 'lenient', label: 'Permissive', desc: 'Flag conflict only on major semantic opposition' },
                ].map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setPrefs({ ...prefs, disagreementSensitivity: s.id as any })}
                    className={`p-3.5 rounded-xl border text-left transition-all ${
                      prefs.disagreementSensitivity === s.id
                        ? 'border-amber-500/60 bg-amber-950/20 text-amber-200'
                        : 'border-[#D9C6B7] bg-[#FAF6F0] text-[#6E5D4F] hover:border-[#D9C6B7]'
                    }`}
                  >
                    <div className="text-xs font-semibold">{s.label}</div>
                    <div className="text-[11px] text-[#6E5D4F] mt-1">{s.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-[#D9C6B7]">
              <label className="flex items-center justify-between cursor-pointer p-3 rounded-xl bg-[#FAF6F0] border border-[#D9C6B7]/80 hover:border-[#D9C6B7]">
                <div className="space-y-0.5">
                  <div className="text-xs font-medium text-[#3B2A1C]">Mandatory Dual Sign-Off for High-Risk Cases</div>
                  <div className="text-[11px] text-[#6E5D4F]">Requires two credentialed clinician signatures before closing a STAT or high-uncertainty case</div>
                </div>
                <input
                  type="checkbox"
                  checked={prefs.requireDualSignOff}
                  onChange={(e) => setPrefs({ ...prefs, requireDualSignOff: e.target.checked })}
                  className="rounded border-[#D9C6B7] text-cyan-500 focus:ring-cyan-400 h-4 w-4"
                />
              </label>
            </div>
          </div>
        </Card>
      )}

      {/* Tab 4: Compute & Engine */}
      {activeTab === 'hardware' && (
        <Card className="p-6 bg-white border-[#D9C6B7] shadow-sm space-y-6">
          <div>
            <h2 className="text-base font-semibold text-[#3B2A1C] flex items-center gap-2">
              <Cpu className="w-4 h-4 text-[#8B6F5B]" />
              Specialized Model Compute & Scheduling
            </h2>
            <p className="text-xs text-[#6E5D4F] mt-1">
              Inspect device allocation, VRAM management, and Gemini evidence synthesis connection.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-[#FAF6F0] border border-[#D9C6B7] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[#3B2A1C]">Device Preference</span>
                <Badge variant="outline" className="font-mono text-[10px] text-[#8B6F5B]">
                  {prefs.devicePreference === 'cuda_preferred' ? 'CUDA / GPU' : 'CPU FALLBACK'}
                </Badge>
              </div>
              <p className="text-xs text-[#6E5D4F]">
                Allocates PyTorch tensor processing to NVIDIA CUDA acceleration if available, otherwise safely falls back to CPU tensors.
              </p>
              <select
                value={prefs.devicePreference}
                onChange={(e) => setPrefs({ ...prefs, devicePreference: e.target.value as any })}
                className="w-full bg-[#FCF9F5] border border-[#D9C6B7] rounded-lg p-2 text-xs text-[#3B2A1C]"
              >
                <option value="cuda_preferred">CUDA Accelerated (Recommended)</option>
                <option value="cpu_only">CPU Only Mode</option>
              </select>
            </div>

            <div className="p-4 rounded-xl bg-[#FAF6F0] border border-[#D9C6B7] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[#3B2A1C]">Gemini Synthesis Layer</span>
                <Badge variant="success" className="text-[10px]">
                  BOUNDED SYNTHESIS ACTIVE
                </Badge>
              </div>
              <p className="text-xs text-[#6E5D4F]">
                Gemini evidence synthesis runs exclusively through backend structured JSON schemas with zero autonomous diagnostic authority.
              </p>
              <div className="text-[11px] font-mono text-[#6E5D4F]">
                Backend Key: Stored in backend/.env • Frontend Key: Never Exposed
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Tab 5: Keyboard Shortcuts */}
      {activeTab === 'shortcuts' && (
        <Card className="p-6 bg-white border-[#D9C6B7] shadow-sm space-y-5">
          <div>
            <h2 className="text-base font-semibold text-[#3B2A1C] flex items-center gap-2">
              <Keyboard className="w-4 h-4 text-[#8B6F5B]" />
              Clinical Workstation Keyboard Navigation
            </h2>
            <p className="text-xs text-[#6E5D4F] mt-1">
              Rapid access keybindings designed for high-efficiency clinical reading and triage workflows.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              { key: 'Ctrl + K / ⌘ + K', desc: 'Open Command Palette & Global Clinical Search' },
              { key: 'ESC', desc: 'Close dialogs, drawer panels, or search overlays' },
              { key: 'Tab / Shift + Tab', desc: 'Navigate through interactive controls and tabs' },
              { key: 'Enter / Return', desc: 'Select highlighted case, node, or action item' },
              { key: 'G then D', desc: 'Navigate to Clinical Dashboard' },
              { key: 'G then P', desc: 'Navigate to Patient Directory' },
              { key: 'C then N', desc: 'Intake a New Clinical Case' },
              { key: 'G then O', desc: 'Inspect Live Multi-Agent Orchestration' },
              { key: 'G then E', desc: 'Inspect Interactive Evidence Graph' },
              { key: 'G then R', desc: 'View Screening Reports & Intelligence Summaries' },
              { key: 'G then M', desc: 'Inspect Model Registry & Weight Cards' },
              { key: 'G then S', desc: 'Open Workstation Settings' },
            ].map((sc, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-3 rounded-lg bg-[#FAF6F0] border border-[#D9C6B7] text-xs"
              >
                <span className="text-[#5A4D3B]">{sc.desc}</span>
                <kbd className="px-2.5 py-1 rounded bg-[#FCF9F5] text-[#8B6F5B] font-mono text-[11px] border border-[#D9C6B7] shrink-0 ml-3">
                  {sc.key}
                </kbd>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};
