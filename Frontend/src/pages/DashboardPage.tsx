import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../services/apiClient';
import { HealthStatus } from '../components/health/HealthStatus';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { TableSkeleton } from '../components/ui/skeleton';
import { EmptyState } from '../components/ui/empty-state';
import { ErrorState } from '../components/ui/error-state';
import {
  MedicalSafetyBanner,
  ReviewStateBadge,
  PriorityBadge,
} from '../components/ui/clinical-badges';
import {
  Activity,
  CheckCircle2,
  Database,
  Plus,
  RefreshCw,
  ArrowRight,
  Shield,
  Cpu,
  Users,
  GitGraph,
  FileCheck2,
  Settings,
  Sparkles,
} from 'lucide-react';

interface PatientRecord {
  id: string;
  mrn: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  gender: string;
  blood_type?: string;
  allergies?: string[];
  chronic_conditions?: string[];
  created_at: string;
}

export const DashboardPage: React.FC = () => {
  const { session } = useAuth();
  const [patients, setPatients] = useState<PatientRecord[]>([]);
  const [recentCases, setRecentCases] = useState<any[]>([]);
  const [loadingPatients, setLoadingPatients] = useState<boolean>(false);
  const [patientError, setPatientError] = useState<string | null>(null);
  const [creatingPatient, setCreatingPatient] = useState<boolean>(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async () => {
    if (!session) {
      setPatients([]);
      setRecentCases([]);
      return;
    }
    setLoadingPatients(true);
    setPatientError(null);
    try {
      const [patientsData, casesData] = await Promise.allSettled([
        apiClient.getPatients(),
        apiClient.getCases(),
      ]);

      if (patientsData.status === 'fulfilled') {
        setPatients((patientsData.value as unknown as PatientRecord[]) || []);
      } else {
        throw new Error('Failed to load patient cohort from database');
      }

      if (casesData.status === 'fulfilled') {
        const res = casesData.value;
        const items = Array.isArray(res) ? res : (res as any)?.items || (res as any)?.cases || [];
        setRecentCases(items);
      }
    } catch (err) {
      setPatientError(err instanceof Error ? err.message : 'Failed to fetch clinical dashboard records');
    } finally {
      setLoadingPatients(false);
    }
  }, [session]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const handleCreateTestPatient = async () => {
    if (!session) return;
    setCreatingPatient(true);
    setActionSuccess(null);
    setPatientError(null);

    const randomDigits = Math.floor(1000 + Math.random() * 9000);
    const demoPatient = {
      mrn: `MRN-${randomDigits}`,
      first_name: 'Patient',
      last_name: `#${randomDigits}`,
      date_of_birth: '1980-06-15',
      gender: randomDigits % 2 === 0 ? 'Female' : 'Male',
      blood_type: 'A+',
      allergies: ['Amoxicillin'],
      chronic_conditions: ['Mild Hypertension'],
    };

    try {
      const created = await apiClient.createPatient(demoPatient);
      setActionSuccess(`Patient ${(created as unknown as PatientRecord).mrn} successfully added.`);
      await fetchDashboardData();
    } catch (err) {
      setPatientError(err instanceof Error ? err.message : 'Database write failed');
    } finally {
      setCreatingPatient(false);
    }
  };

  const quickNavCards = [
    {
      title: 'Patient Directory',
      desc: 'Master longitudinal cohort registry & 360 patient records',
      icon: Users,
      path: '/patients',
      color: 'bg-[#F2E4D5] text-[#5A4D3B] border-[#D9C6B7]',
    },
    {
      title: 'New Case Intake',
      desc: 'Multimodal asset upload & clinical intake ingestion',
      icon: Plus,
      path: '/cases/new',
      color: 'bg-[#F2E4D5] text-[#8B6F5B] border-[#D9C6B7]',
    },
    {
      title: 'Live Orchestration DAG',
      desc: 'Real-time multi-agent execution & telemetry graph',
      icon: Activity,
      path: '/orchestration',
      color: 'bg-[#F2E4D5] text-[#5A4D3B] border-[#D9C6B7]',
    },
    {
      title: 'Interactive Evidence Graph',
      desc: 'Causal multi-tier provenance DAG with direct links',
      icon: GitGraph,
      path: '/evidence-graph',
      color: 'bg-[#F2E4D5] text-[#8B6F5B] border-[#D9C6B7]',
    },
    {
      title: 'Screening Reports',
      desc: '14-section clinician summary & structured sign-off',
      icon: FileCheck2,
      path: '/reports',
      color: 'bg-[#F2E4D5] text-[#5A4D3B] border-[#D9C6B7]',
    },
    {
      title: 'Model Registry',
      desc: 'Specialized PyTorch model cards & verified checkpoints',
      icon: Cpu,
      path: '/registry',
      color: 'bg-[#F2E4D5] text-[#8B6F5B] border-[#D9C6B7]',
    },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Persistent Medical Safety Notice */}
      <MedicalSafetyBanner />

      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-[#D9C6B7] pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#8B6F5B]">
              Clinical Command Center
            </span>
            <Badge variant="outline" className="text-[10px] text-[#5A4D3B] border-[#D9C6B7] bg-white">
              WORKSTATION READY
            </Badge>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#3B2A1C]">
            Clinical Intelligence Workstation
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-[#5A4D3B]">
            Multimodal decision support, specialized model inference, canonical evidence graphing & Gemini bounded synthesis.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link to="/cases/new">
            <Button size="sm" variant="default" className="bg-[#8B6F5B] hover:bg-[#5A4D3B] text-white gap-2 text-xs shadow-xs">
              <Plus className="w-4 h-4" />
              New Case Intake
            </Button>
          </Link>
          <Link to="/settings">
            <Button size="sm" variant="outline" className="border-[#D9C6B7] text-[#5A4D3B] hover:bg-[#FAF6F0] gap-1.5 text-xs">
              <Settings className="w-3.5 h-3.5" />
              Settings
            </Button>
          </Link>
        </div>
      </div>

      {/* Quick Launch Cards for 9 Core Workstation Modules */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {quickNavCards.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.title}
              to={item.path}
              className="p-4 rounded-xl border border-[#D9C6B7] bg-white hover:border-[#B89A7D] hover:shadow-xs transition-all group flex items-start gap-3.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B6F5B]"
            >
              <div className={`p-2.5 rounded-lg border shrink-0 ${item.color} group-hover:scale-105 transition-transform`}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-[#3B2A1C] group-hover:text-[#8B6F5B] transition-colors flex items-center justify-between">
                  <span>{item.title}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-[#B89A7D] group-hover:text-[#8B6F5B] group-hover:translate-x-0.5 transition-all" />
                </div>
                <p className="text-xs text-[#5A4D3B] mt-0.5 line-clamp-2 leading-relaxed">
                  {item.desc}
                </p>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Active Clinical Cases & Triage Queue */}
      <Card className="border-[#D9C6B7] bg-white shadow-sm">
        <CardHeader className="pb-3 border-b border-[#E8DCD1]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2 text-[#3B2A1C]">
                <Sparkles className="w-4 h-4 text-[#8B6F5B]" />
                Active Clinical Cases & Triage Queue
              </CardTitle>
              <CardDescription className="text-xs text-[#5A4D3B]">
                Recent multi-modal screening cases, review status flags, and causal evidence pipelines.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={fetchDashboardData}
                disabled={loadingPatients}
                className="h-8 gap-1.5 text-xs border-[#D9C6B7] text-[#5A4D3B] hover:bg-[#FAF6F0]"
              >
                <RefreshCw className={`h-3 w-3 ${loadingPatients ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          {loadingPatients && recentCases.length === 0 ? (
            <TableSkeleton rows={4} cols={5} />
          ) : recentCases.length === 0 ? (
            <EmptyState
              icon={Sparkles}
              title="No Active Cases in Queue"
              description="No clinical cases have been submitted yet. Ingest multimodal assets to trigger the orchestration pipeline."
              action={{
                label: "Create New Case",
                href: "/cases/new"
              }}
            />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-[#D9C6B7]">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-[#D9C6B7] bg-[#FAF6F0] text-[#5A4D3B] font-mono text-[11px]">
                  <tr>
                    <th className="py-2.5 px-3">CASE ID</th>
                    <th className="py-2.5 px-3">PATIENT</th>
                    <th className="py-2.5 px-3">PRIORITY</th>
                    <th className="py-2.5 px-3">REVIEW STATE</th>
                    <th className="py-2.5 px-3 text-right">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8DCD1] text-[#3B2A1C]">
                  {recentCases.map((c) => (
                    <tr key={c.id} className="hover:bg-[#FAF6F0] transition-colors">
                      <td className="py-2.5 px-3 font-mono font-medium text-[#8B6F5B]">
                        #{c.id.slice(0, 8)}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-[#3B2A1C]">
                        {c.patient_name || c.patient_id || 'Unknown Patient'}
                      </td>
                      <td className="py-2.5 px-3">
                        <PriorityBadge priority={c.priority} />
                      </td>
                      <td className="py-2.5 px-3">
                        <ReviewStateBadge state={c.review_state || c.status} />
                      </td>
                      <td className="py-2.5 px-3 text-right space-x-1.5">
                        <Link to={`/cases/${c.id}`}>
                          <Button size="sm" variant="ghost" className="h-7 text-xs text-[#8B6F5B] hover:bg-[#F2E4D5]/60 hover:text-[#3B2A1C]">
                            Workspace
                          </Button>
                        </Link>
                        <Link to={`/reports/${c.id}`}>
                          <Button size="sm" variant="ghost" className="h-7 text-xs text-emerald-800 hover:bg-emerald-50">
                            Report
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Patient Cohort Management Card */}
      <Card className="border-[#D9C6B7] bg-white shadow-sm">
        <CardHeader className="pb-3 border-b border-[#E8DCD1]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2 text-[#3B2A1C]">
                <Database className="h-4 w-4 text-[#8B6F5B]" />
                Patient Cohort Directory Preview ({patients.length})
              </CardTitle>
              <CardDescription className="text-xs text-[#5A4D3B]">
                Master cohort index with full Supabase Row Level Security enforcement.
              </CardDescription>
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleCreateTestPatient}
                disabled={creatingPatient}
                className="h-8 gap-1.5 text-xs bg-[#FAF6F0] hover:bg-[#F2E4D5] text-[#3B2A1C] border-[#D9C6B7]"
              >
                <Plus className="h-3.5 w-3.5" />
                {creatingPatient ? 'Writing...' : 'Write Test Patient'}
              </Button>
              <Link to="/patients">
                <Button size="sm" variant="outline" className="h-8 text-xs border-[#D9C6B7] text-[#8B6F5B] hover:text-[#5A4D3B] gap-1">
                  Full Directory
                  <ArrowRight className="w-3 h-3" />
                </Button>
              </Link>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-4 space-y-4">
          {actionSuccess && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-700" />
              <span>{actionSuccess}</span>
            </div>
          )}

          {patientError && (
            <ErrorState
              title="Patient Cohort Error"
              message={patientError}
              onRetry={fetchDashboardData}
            />
          )}

          {loadingPatients && patients.length === 0 ? (
            <TableSkeleton rows={4} cols={6} />
          ) : patients.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No Patients Registered"
              description="No patient records found in Supabase. Click 'Write Test Patient' or ingest via New Case."
              action={{
                label: "Write Test Patient",
                onClick: handleCreateTestPatient
              }}
            />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-[#D9C6B7]">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-[#D9C6B7] bg-[#FAF6F0] text-[#5A4D3B]">
                  <tr>
                    <th className="py-2.5 px-3 font-semibold">MRN</th>
                    <th className="py-2.5 px-3 font-semibold">Patient Name</th>
                    <th className="py-2.5 px-3 font-semibold">DOB</th>
                    <th className="py-2.5 px-3 font-semibold">Gender</th>
                    <th className="py-2.5 px-3 font-semibold">Blood Type</th>
                    <th className="py-2.5 px-3 font-semibold">Allergies</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8DCD1] text-[#3B2A1C]">
                  {patients.slice(0, 5).map((p) => (
                    <tr key={p.id} className="hover:bg-[#FAF6F0] transition-colors">
                      <td className="py-2.5 px-3 font-mono font-medium text-[#8B6F5B]">
                        <Link to={`/patients/${p.id}`} className="hover:underline">
                          {p.mrn}
                        </Link>
                      </td>
                      <td className="py-2.5 px-3 font-medium text-[#3B2A1C]">
                        <Link to={`/patients/${p.id}`} className="hover:text-[#8B6F5B]">
                          {p.first_name} {p.last_name}
                        </Link>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[#5A4D3B]">{p.date_of_birth}</td>
                      <td className="py-2.5 px-3 text-[#5A4D3B]">{p.gender}</td>
                      <td className="py-2.5 px-3 font-mono text-emerald-800 font-semibold">{p.blood_type || '—'}</td>
                      <td className="py-2.5 px-3 text-[#5A4D3B]">
                        {p.allergies && p.allergies.length > 0 ? p.allergies.join(', ') : 'None'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* System Telemetry & Clinical Safety Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <HealthStatus />
        </div>

        <div>
          <Card className="border-[#D9C6B7] bg-white h-full shadow-sm">
            <CardHeader className="pb-2 border-b border-[#E8DCD1]">
              <CardTitle className="text-sm flex items-center gap-2 text-[#3B2A1C]">
                <Shield className="h-4 w-4 text-[#8B6F5B]" />
                Workstation Safety Contracts
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs text-[#5A4D3B] pt-4">
              <p>
                This workstation operates strictly under clinical decision-support rules:
              </p>
              <ul className="space-y-2 text-[#5A4D3B]">
                <li className="flex items-start gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#8B6F5B] mt-1.5 shrink-0" />
                  <span><strong>Zero Medical Fabrication:</strong> Grounded strictly in canonical evidence.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#8B6F5B] mt-1.5 shrink-0" />
                  <span><strong>Evidence Separation:</strong> Model findings, patient records, and synthesis stay separate.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#8B6F5B] mt-1.5 shrink-0" />
                  <span><strong>Deterministic DAG:</strong> Specialized models chosen by deterministic selection rules.</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
