import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../services/apiClient';
import type { PatientRecord } from '../types/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Dialog } from '../components/ui/dialog';
import { CardSkeleton } from '../components/ui/skeleton';
import { EmptyState } from '../components/ui/empty-state';
import { ErrorState } from '../components/ui/error-state';
import { MedicalSafetyBanner } from '../components/ui/clinical-badges';
import {
  Users,
  Search,
  Filter,
  UserPlus,
  RefreshCw,
  ArrowRight,
  Edit2,
  Trash2,
  Activity,
  HeartPulse,
  Droplet,
} from 'lucide-react';

export const PatientsPage: React.FC = () => {
  const navigate = useNavigate();
  const [patients, setPatients] = useState<PatientRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [genderFilter, setGenderFilter] = useState<string>('');
  const [bloodTypeFilter, setBloodTypeFilter] = useState<string>('');

  // Modals state
  const [createOpen, setCreateOpen] = useState<boolean>(false);
  const [editOpen, setEditOpen] = useState<boolean>(false);
  const [selectedPatient, setSelectedPatient] = useState<PatientRecord | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    mrn: '',
    first_name: '',
    last_name: '',
    date_of_birth: '',
    gender: 'Female',
    blood_type: 'O+',
    allergies: '',
    chronic_conditions: '',
  });

  const fetchPatients = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.getPatients({
        search: searchTerm || undefined,
        gender: genderFilter || undefined,
        blood_type: bloodTypeFilter || undefined,
      });
      setPatients(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load patients');
    } finally {
      setLoading(false);
    }
  }, [searchTerm, genderFilter, bloodTypeFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchPatients();
    }, 250);
    return () => clearTimeout(timer);
  }, [fetchPatients]);

  const handleOpenCreate = () => {
    const randomDigits = Math.floor(1000 + Math.random() * 9000);
    setFormData({
      mrn: `MRN-${randomDigits}`,
      first_name: '',
      last_name: '',
      date_of_birth: '1985-05-15',
      gender: 'Female',
      blood_type: 'O+',
      allergies: '',
      chronic_conditions: '',
    });
    setFormError(null);
    setCreateOpen(true);
  };

  const handleOpenEdit = (p: PatientRecord, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedPatient(p);
    setFormData({
      mrn: p.mrn,
      first_name: p.first_name,
      last_name: p.last_name,
      date_of_birth: p.date_of_birth,
      gender: p.gender,
      blood_type: p.blood_type || 'O+',
      allergies: (p.allergies || []).join(', '),
      chronic_conditions: (p.chronic_conditions || []).join(', '),
    });
    setFormError(null);
    setEditOpen(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);

    try {
      const payload: Partial<PatientRecord> = {
        mrn: formData.mrn,
        first_name: formData.first_name,
        last_name: formData.last_name,
        date_of_birth: formData.date_of_birth,
        gender: formData.gender,
        blood_type: formData.blood_type,
        allergies: formData.allergies
          ? formData.allergies.split(',').map((s) => s.trim()).filter(Boolean)
          : [],
        chronic_conditions: formData.chronic_conditions
          ? formData.chronic_conditions.split(',').map((s) => s.trim()).filter(Boolean)
          : [],
      };

      await apiClient.createPatient(payload);
      setCreateOpen(false);
      await fetchPatients();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create patient');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient) return;
    setSubmitting(true);
    setFormError(null);

    try {
      const payload: Partial<PatientRecord> = {
        first_name: formData.first_name,
        last_name: formData.last_name,
        date_of_birth: formData.date_of_birth,
        gender: formData.gender,
        blood_type: formData.blood_type,
        allergies: formData.allergies
          ? formData.allergies.split(',').map((s) => s.trim()).filter(Boolean)
          : [],
        chronic_conditions: formData.chronic_conditions
          ? formData.chronic_conditions.split(',').map((s) => s.trim()).filter(Boolean)
          : [],
      };

      await apiClient.updatePatient(selectedPatient.id, payload);
      setEditOpen(false);
      await fetchPatients();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to update patient');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (patientId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this patient record? Associated cases and events will be deleted.')) {
      return;
    }

    try {
      await apiClient.deletePatient(patientId);
      await fetchPatients();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete patient');
    }
  };

  const calculateAge = (dobString: string): number => {
    const dob = new Date(dobString);
    const diffMs = Date.now() - dob.getTime();
    const ageDt = new Date(diffMs);
    return Math.abs(ageDt.getUTCFullYear() - 1970);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Safety Notice */}
      <MedicalSafetyBanner />

      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#D9C6B7] pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#8B6F5B]">
              Clinical Directory
            </span>
            <Badge variant="outline" className="text-[10px] text-[#5A4D3B] border-[#D9C6B7] bg-white">
              Phase 2 Active
            </Badge>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#3B2A1C] flex items-center gap-2.5">
            <Users className="h-7 w-7 text-[#8B6F5B]" />
            Patient Directory
          </h1>
          <p className="mt-1 text-xs text-[#5A4D3B]">
            Database-backed clinical directory with longitudinal records, search, and multimodal case history.
          </p>
        </div>

        <Button onClick={handleOpenCreate} className="gap-2 bg-[#8B6F5B] hover:bg-[#5A4D3B] text-white shadow-xs">
          <UserPlus className="h-4 w-4" />
          <span>Register New Patient</span>
        </Button>
      </div>

      {/* Search and Filters Bar */}
      <Card className="border-[#D9C6B7] bg-white p-4 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#8B6F5B]" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by patient name, MRN..."
              className="w-full rounded-md border border-[#D9C6B7] bg-[#FAF6F0] py-2 pl-9 pr-3 text-xs text-[#3B2A1C] placeholder-[#8B6F5B] focus:border-[#8B6F5B] focus:outline-none focus:ring-1 focus:ring-[#8B6F5B]"
            />
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-[#5A4D3B]">
              <Filter className="h-3.5 w-3.5 text-[#8B6F5B]" />
              <span>Filters:</span>
            </div>

            <select
              value={genderFilter}
              onChange={(e) => setGenderFilter(e.target.value)}
              className="rounded-md border border-[#D9C6B7] bg-[#FAF6F0] py-1.5 px-2.5 text-xs text-[#3B2A1C] focus:border-[#8B6F5B] focus:outline-none"
            >
              <option value="">All Genders</option>
              <option value="Female">Female</option>
              <option value="Male">Male</option>
              <option value="Other">Other</option>
            </select>

            <select
              value={bloodTypeFilter}
              onChange={(e) => setBloodTypeFilter(e.target.value)}
              className="rounded-md border border-[#D9C6B7] bg-[#FAF6F0] py-1.5 px-2.5 text-xs text-[#3B2A1C] focus:border-[#8B6F5B] focus:outline-none"
            >
              <option value="">All Blood Types</option>
              <option value="A+">A+</option>
              <option value="A-">A-</option>
              <option value="B+">B+</option>
              <option value="B-">B-</option>
              <option value="AB+">AB+</option>
              <option value="AB-">AB-</option>
              <option value="O+">O+</option>
              <option value="O-">O-</option>
            </select>

            <Button
              variant="outline"
              size="sm"
              onClick={fetchPatients}
              disabled={loading}
              className="h-8 gap-1 text-xs border-[#D9C6B7] text-[#5A4D3B] hover:bg-[#FAF6F0]"
              title="Refresh list"
            >
              <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </Button>
          </div>
        </div>
      </Card>

      {/* Main Content Area */}
      {loading && patients.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" role="status" aria-label="Loading patient records">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : error ? (
        <ErrorState
          title="Clinical Directory Error"
          message={error}
          onRetry={fetchPatients}
        />
      ) : patients.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No Patients Found"
          description={
            searchTerm || genderFilter || bloodTypeFilter
              ? 'No patient records match the applied search criteria or filters.'
              : 'The clinical directory is empty. Register your first patient to begin tracking.'
          }
          action={{
            label: 'Register Patient',
            onClick: handleOpenCreate,
          }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {patients.map((p) => {
            const age = calculateAge(p.date_of_birth);
            return (
              <Card
                key={p.id}
                onClick={() => navigate(`/patients/${p.id}`)}
                className="group border-[#D9C6B7] bg-white hover:border-[#B89A7D] hover:shadow-md transition-all cursor-pointer shadow-xs"
              >
                <CardHeader className="pb-3 border-b border-[#E8DCD1]">
                  <div className="flex items-start justify-between">
                    <div>
                      <Badge variant="outline" className="font-mono text-[10px] text-[#5A4D3B] border-[#D9C6B7] bg-[#FAF6F0]">
                        {p.mrn}
                      </Badge>
                      <CardTitle className="text-base font-bold text-[#3B2A1C] mt-1 group-hover:text-[#8B6F5B] transition-colors">
                        {p.first_name} {p.last_name}
                      </CardTitle>
                      <CardDescription className="text-xs text-[#5A4D3B] flex items-center gap-2 mt-0.5">
                        <span>{p.gender}</span>
                        <span>•</span>
                        <span>{age} yrs (DOB: {p.date_of_birth})</span>
                      </CardDescription>
                    </div>

                    {p.blood_type && (
                      <Badge variant="secondary" className="font-mono text-[11px] text-emerald-800 bg-emerald-50 border border-emerald-200">
                        <Droplet className="h-3 w-3 mr-1 text-emerald-700" />
                        {p.blood_type}
                      </Badge>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="space-y-3 pt-0 text-xs">
                  {/* Chronic Conditions & Allergies */}
                  <div className="space-y-1.5 border-t border-[#D9C6B7]/60 pt-2.5">
                    <div className="flex items-center gap-1.5 text-[#6E5D4F]">
                      <HeartPulse className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                      <span className="font-medium text-[#3B2A1C]">Conditions:</span>
                      <span className="truncate text-[#5A4D3B]">
                        {p.chronic_conditions && p.chronic_conditions.length > 0
                          ? p.chronic_conditions.join(', ')
                          : 'None reported'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-[#6E5D4F]">
                      <Activity className="h-3.5 w-3.5 text-rose-600 shrink-0" />
                      <span className="font-medium text-[#3B2A1C]">Allergies:</span>
                      <span className="truncate text-[#5A4D3B]">
                        {p.allergies && p.allergies.length > 0
                          ? p.allergies.join(', ')
                          : 'None known'}
                      </span>
                    </div>
                  </div>

                  {/* Card Footer Actions */}
                  <div className="flex items-center justify-between border-t border-[#D9C6B7]/60 pt-2.5">
                    <span className="text-[11px] text-[#8B6F5B] font-semibold flex items-center gap-1 group-hover:translate-x-1 group-hover:text-[#5A4D3B] transition-transform">
                      Open Patient 360
                      <ArrowRight className="h-3.5 w-3.5" />
                    </span>

                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={(e) => handleOpenEdit(p, e)}
                        className="h-7 w-7 text-[#6E5D4F] hover:text-[#3B2A1C] hover:bg-[#F2E4D5]"
                        title="Edit Patient"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>

                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={(e) => handleDelete(p.id, e)}
                        className="h-7 w-7 text-[#6E5D4F] hover:text-rose-600 hover:bg-rose-50"
                        title="Delete Patient"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* CREATE PATIENT DIALOG */}
      <Dialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Register New Clinical Patient"
        description="Add a new patient record with verified demographics, medical record number, and baseline risks."
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
          {formError && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-rose-700 font-medium">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[#3B2A1C] font-semibold">First Name</label>
              <input
                type="text"
                required
                value={formData.first_name}
                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                placeholder="Eleanor"
                className="w-full rounded-md border border-[#D9C6B7] bg-[#FAF6F0] p-2 text-[#3B2A1C] placeholder-[#8B6F5B]/50 focus:border-[#8B6F5B] focus:bg-white focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[#3B2A1C] font-semibold">Last Name</label>
              <input
                type="text"
                required
                value={formData.last_name}
                onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                placeholder="Vance"
                className="w-full rounded-md border border-[#D9C6B7] bg-[#FAF6F0] p-2 text-[#3B2A1C] placeholder-[#8B6F5B]/50 focus:border-[#8B6F5B] focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[#3B2A1C] font-semibold">MRN (Medical Record Number)</label>
              <input
                type="text"
                required
                value={formData.mrn}
                onChange={(e) => setFormData({ ...formData, mrn: e.target.value })}
                className="w-full rounded-md border border-[#D9C6B7] bg-[#FAF6F0] p-2 font-mono text-[#5A4D3B] font-medium focus:border-[#8B6F5B] focus:bg-white focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[#3B2A1C] font-semibold">Date of Birth</label>
              <input
                type="date"
                required
                value={formData.date_of_birth}
                onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                className="w-full rounded-md border border-[#D9C6B7] bg-[#FAF6F0] p-2 text-[#3B2A1C] focus:border-[#8B6F5B] focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[#3B2A1C] font-semibold">Gender</label>
              <select
                value={formData.gender}
                onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                className="w-full rounded-md border border-[#D9C6B7] bg-[#FAF6F0] p-2 text-[#3B2A1C] focus:border-[#8B6F5B] focus:bg-white focus:outline-none"
              >
                <option value="Female">Female</option>
                <option value="Male">Male</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[#3B2A1C] font-semibold">Blood Type</label>
              <select
                value={formData.blood_type}
                onChange={(e) => setFormData({ ...formData, blood_type: e.target.value })}
                className="w-full rounded-md border border-[#D9C6B7] bg-[#FAF6F0] p-2 text-[#3B2A1C] focus:border-[#8B6F5B] focus:bg-white focus:outline-none"
              >
                <option value="A+">A+</option>
                <option value="A-">A-</option>
                <option value="B+">B+</option>
                <option value="B-">B-</option>
                <option value="AB+">AB+</option>
                <option value="AB-">AB-</option>
                <option value="O+">O+</option>
                <option value="O-">O-</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[#3B2A1C] font-semibold">Known Allergies (comma-separated)</label>
            <input
              type="text"
              value={formData.allergies}
              onChange={(e) => setFormData({ ...formData, allergies: e.target.value })}
              placeholder="Penicillin, Sulfa drugs, Peanuts"
              className="w-full rounded-md border border-[#D9C6B7] bg-[#FAF6F0] p-2 text-[#3B2A1C] placeholder-[#8B6F5B]/50 focus:border-[#8B6F5B] focus:bg-white focus:outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[#3B2A1C] font-semibold">Chronic Conditions (comma-separated)</label>
            <input
              type="text"
              value={formData.chronic_conditions}
              onChange={(e) => setFormData({ ...formData, chronic_conditions: e.target.value })}
              placeholder="Hypertension, Asthma, Type 2 Diabetes"
              className="w-full rounded-md border border-[#D9C6B7] bg-[#FAF6F0] p-2 text-[#3B2A1C] placeholder-[#8B6F5B]/50 focus:border-[#8B6F5B] focus:bg-white focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[#D9C6B7]">
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Registering...' : 'Register Patient'}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* EDIT PATIENT DIALOG */}
      <Dialog
        open={editOpen}
        onOpenChange={setEditOpen}
        title={`Edit Patient: ${selectedPatient?.first_name} ${selectedPatient?.last_name}`}
        description="Modify demographics, blood type, and clinical baseline markers."
      >
        <form onSubmit={handleEditSubmit} className="space-y-4 text-xs">
          {formError && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-rose-700 font-medium">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[#3B2A1C] font-semibold">First Name</label>
              <input
                type="text"
                required
                value={formData.first_name}
                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                className="w-full rounded-md border border-[#D9C6B7] bg-[#FAF6F0] p-2 text-[#3B2A1C] focus:border-[#8B6F5B] focus:bg-white focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[#3B2A1C] font-semibold">Last Name</label>
              <input
                type="text"
                required
                value={formData.last_name}
                onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                className="w-full rounded-md border border-[#D9C6B7] bg-[#FAF6F0] p-2 text-[#3B2A1C] focus:border-[#8B6F5B] focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[#3B2A1C] font-semibold">Date of Birth</label>
              <input
                type="date"
                required
                value={formData.date_of_birth}
                onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                className="w-full rounded-md border border-[#D9C6B7] bg-[#FAF6F0] p-2 text-[#3B2A1C] focus:border-[#8B6F5B] focus:bg-white focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[#3B2A1C] font-semibold">Blood Type</label>
              <select
                value={formData.blood_type}
                onChange={(e) => setFormData({ ...formData, blood_type: e.target.value })}
                className="w-full rounded-md border border-[#D9C6B7] bg-[#FAF6F0] p-2 text-[#3B2A1C] focus:border-[#8B6F5B] focus:bg-white focus:outline-none"
              >
                <option value="A+">A+</option>
                <option value="A-">A-</option>
                <option value="B+">B+</option>
                <option value="B-">B-</option>
                <option value="AB+">AB+</option>
                <option value="AB-">AB-</option>
                <option value="O+">O+</option>
                <option value="O-">O-</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[#3B2A1C] font-semibold">Known Allergies (comma-separated)</label>
            <input
              type="text"
              value={formData.allergies}
              onChange={(e) => setFormData({ ...formData, allergies: e.target.value })}
              className="w-full rounded-md border border-[#D9C6B7] bg-[#FAF6F0] p-2 text-[#3B2A1C] focus:border-[#8B6F5B] focus:bg-white focus:outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[#3B2A1C] font-semibold">Chronic Conditions (comma-separated)</label>
            <input
              type="text"
              value={formData.chronic_conditions}
              onChange={(e) => setFormData({ ...formData, chronic_conditions: e.target.value })}
              className="w-full rounded-md border border-[#D9C6B7] bg-[#FAF6F0] p-2 text-[#3B2A1C] focus:border-[#8B6F5B] focus:bg-white focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[#D9C6B7]">
            <Button type="button" variant="outline" onClick={() => setEditOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
};
