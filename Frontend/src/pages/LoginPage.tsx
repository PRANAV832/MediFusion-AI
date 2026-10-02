import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Activity, Lock, Mail, User, Shield, AlertCircle, RefreshCw } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const [isSignUp, setIsSignUp] = useState<boolean>(false);
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [fullName, setFullName] = useState<string>('');
  const [role, setRole] = useState<string>('clinician');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setLocalError(null);

    try {
      if (isSignUp) {
        if (!fullName.trim()) {
          throw new Error('Please provide your full clinician name');
        }
        await signUp(email, password, fullName, role);
      } else {
        await signIn(email, password);
      }
      navigate(from, { replace: true });
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-[75vh] items-center justify-center px-4 py-8">
      <Card className="w-full max-w-md border-[#D9C6B7] bg-white shadow-xl">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-[#F2E4D5] border border-[#D9C6B7] text-[#8B6F5B] shadow-sm">
            <Activity className="h-6 w-6 font-bold" />
          </div>
          <div className="flex items-center justify-center gap-2">
            <CardTitle className="text-xl font-bold tracking-tight text-[#3B2A1C]">
              MediFusion <span className="text-[#8B6F5B]">AI</span>
            </CardTitle>
            <Badge variant="outline" className="text-[10px] text-[#5A4D3B] bg-[#F2E4D5] border-[#D9C6B7]">
              Phase 1
            </Badge>
          </div>
          <CardDescription className="text-xs text-[#6E5D4F] mt-1">
            {isSignUp
              ? 'Register credentials for clinical workstation access'
              : 'Sign in to access multimodal screening and patient cases'}
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {localError && (
              <div className="flex items-start gap-2.5 rounded-lg border border-rose-300 bg-rose-50 p-3 text-xs text-rose-800">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-700 mt-0.5" />
                <span>{localError}</span>
              </div>
            )}

            {isSignUp && (
              <>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[#5A4D3B]">Full Name</label>
                  <div className="relative">
                    <User className="absolute left-3 top-2.5 h-4 w-4 text-[#6E5D4F]" />
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Dr. Sarah Chen, MD"
                      className="w-full rounded-md border border-[#D9C6B7] bg-[#FAF6F0] py-2 pl-9 pr-3 text-xs text-[#3B2A1C] placeholder-[#6E5D4F] focus:border-[#8B6F5B] focus:outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[#5A4D3B]">Clinical Specialty</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full rounded-md border border-[#D9C6B7] bg-[#FAF6F0] py-2 px-3 text-xs text-[#3B2A1C] focus:border-[#8B6F5B] focus:outline-none"
                  >
                    <option value="clinician">General Clinician / Internist</option>
                    <option value="radiologist">Radiologist (MRI / CT / X-Ray)</option>
                    <option value="cardiologist">Cardiologist (ECG)</option>
                    <option value="dermatologist">Dermatologist (Skin Lesions)</option>
                    <option value="admin">Clinical Administrator</option>
                  </select>
                </div>
              </>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#5A4D3B]">Clinician Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-[#6E5D4F]" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="clinician@hospital.org"
                  className="w-full rounded-md border border-[#D9C6B7] bg-[#FAF6F0] py-2 pl-9 pr-3 text-xs text-[#3B2A1C] placeholder-[#6E5D4F] focus:border-[#8B6F5B] focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#5A4D3B]">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-[#6E5D4F]" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-md border border-[#D9C6B7] bg-[#FAF6F0] py-2 pl-9 pr-3 text-xs text-[#3B2A1C] placeholder-[#6E5D4F] focus:border-[#8B6F5B] focus:outline-none"
                />
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-3">
            <Button
              type="submit"
              disabled={submitting}
              className="w-full gap-2 text-xs font-semibold bg-[#8B6F5B] hover:bg-[#5A4D3B] text-white shadow-sm"
            >
              {submitting ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  {isSignUp ? 'Creating Profile...' : 'Authenticating...'}
                </>
              ) : isSignUp ? (
                'Register Clinician Account'
              ) : (
                'Sign In to Workstation'
              )}
            </Button>

            <div className="flex items-center justify-between w-full text-xs text-[#6E5D4F] pt-2 border-t border-[#D9C6B7]">
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setLocalError(null);
                }}
                className="text-[#8B6F5B] hover:text-[#5A4D3B] font-medium transition-colors"
              >
                {isSignUp
                  ? 'Already have an account? Sign in'
                  : "Don't have an account? Register"}
              </button>

              <div className="flex items-center gap-1 text-[11px] text-[#6E5D4F]">
                <Shield className="h-3 w-3 text-[#8B6F5B]" />
                <span>Supabase Auth</span>
              </div>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};

