import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  Activity,
  LayoutDashboard,
  Users,
  PlusCircle,
  GitGraph,
  Cpu,
  FileCheck2,
  Settings,
  Calendar,
  Layers,
  LogOut,
  User,
  ShieldAlert,
  X,
} from 'lucide-react';

interface SidebarProps {
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isMobileOpen, onCloseMobile }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { session, user, profile, signOut } = useAuth();

  const navLinks = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Patient Directory', path: '/patients', icon: Users },
    { name: 'New Case Intake', path: '/cases/new', icon: PlusCircle },
    { name: 'Live Orchestration', path: '/orchestration', icon: Activity },
    { name: 'Evidence Graph', path: '/evidence-graph', icon: GitGraph },
    { name: 'Screening Reports', path: '/reports', icon: FileCheck2 },
    { name: 'Model Registry', path: '/registry', icon: Cpu },
    { name: 'Resource Scheduler', path: '/scheduler', icon: Calendar },
    { name: 'Capabilities', path: '/capabilities', icon: Layers },
    { name: 'Settings', path: '/settings', icon: Settings },
  ];

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const content = (
    <div className="flex flex-col h-full bg-[#3B2A1C] text-[#F2E4D5] select-none">
      {/* Brand Header */}
      <div className="p-5 border-b border-[#5A4D3B]/60 flex items-center justify-between">
        <Link
          to="/"
          onClick={onCloseMobile}
          className="flex items-center gap-3 group focus-visible:outline-none"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#8B6F5B] text-white shadow-md shadow-[#3B2A1C]/50 group-hover:bg-[#B89A7D] transition-colors">
            <Activity className="h-5 w-5 font-bold" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold tracking-tight text-white text-base">
                MediFusion <span className="text-[#D9C6B7]">AI</span>
              </span>
              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-[#5A4D3B] text-[#F2E4D5] border border-[#8B6F5B]/50 uppercase">
                Workstation
              </span>
            </div>
            <p className="text-[11px] text-[#D9C6B7] leading-tight mt-0.5">
              Clinical Intelligence Suite
            </p>
          </div>
        </Link>

        {/* Mobile close button */}
        {onCloseMobile && (
          <button
            onClick={onCloseMobile}
            className="lg:hidden p-1.5 rounded-lg text-[#D9C6B7] hover:text-white hover:bg-[#5A4D3B] focus-visible:outline-none"
            aria-label="Close navigation sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Safety Notice in Sidebar */}
      <div className="mx-3 mt-3.5 p-2.5 rounded-lg bg-[#5A4D3B]/50 border border-[#8B6F5B]/40 text-[#D9C6B7] text-[11px] leading-snug flex items-center gap-2">
        <ShieldAlert className="w-4 h-4 text-[#D9C6B7] shrink-0" />
        <span>Decision Support Workstation • Non-Autonomous</span>
      </div>

      {/* Primary Navigation Links */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1" aria-label="Clinical Navigation">
        {navLinks.map((link) => {
          const Icon = link.icon;
          const isActive =
            link.path === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(link.path);

          return (
            <Link
              key={link.name}
              to={link.path}
              onClick={onCloseMobile}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9C6B7] ${
                isActive
                  ? 'bg-[#5A4D3B] text-white font-semibold border-l-4 border-[#B89A7D] shadow-inner'
                  : 'text-[#D9C6B7] hover:bg-[#5A4D3B]/50 hover:text-white'
              }`}
            >
              <Icon
                className={`w-4 h-4 transition-colors ${
                  isActive ? 'text-[#F2E4D5]' : 'text-[#B89A7D]'
                }`}
              />
              <span className="truncate">{link.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* Clinician Profile Footer */}
      <div className="p-3 border-t border-[#5A4D3B]/60 bg-[#352518]">
        {session ? (
          <div className="flex items-center justify-between p-2 rounded-lg bg-[#5A4D3B]/40 border border-[#5A4D3B]/60">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-[#8B6F5B] flex items-center justify-center text-white shrink-0 text-xs font-semibold">
                <User className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-white truncate">
                  {profile?.full_name || user?.email?.split('@')[0]}
                </div>
                <div className="text-[10px] text-[#D9C6B7] truncate uppercase tracking-wider">
                  {profile?.role || 'Clinician'}
                </div>
              </div>
            </div>

            <button
              onClick={handleSignOut}
              title="Sign Out"
              aria-label="Sign out of workstation"
              className="p-1.5 rounded-md text-[#D9C6B7] hover:text-rose-300 hover:bg-rose-950/40 transition-colors ml-1 focus-visible:outline-none"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <Link
            to="/login"
            onClick={onCloseMobile}
            className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-[#8B6F5B] hover:bg-[#5A4D3B] text-white text-xs font-medium shadow-sm transition-colors"
          >
            <span>Clinician Sign In</span>
          </Link>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar (hidden on mobile, lg:flex) */}
      <aside className="hidden lg:flex flex-col w-64 shrink-0 border-r border-[#5A4D3B]/40 sticky top-0 h-screen z-30 shadow-md">
        {content}
      </aside>

      {/* Mobile Drawer (visible when isMobileOpen is true) */}
      {isMobileOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Mobile Navigation"
          className="fixed inset-0 z-50 lg:hidden flex"
        >
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-[#3B2A1C]/70 backdrop-blur-xs transition-opacity animate-in fade-in"
            onClick={onCloseMobile}
          />
          {/* Drawer container */}
          <div className="relative flex flex-col w-72 max-w-[85vw] h-full shadow-2xl z-10 animate-in slide-in-from-left duration-200">
            {content}
          </div>
        </div>
      )}
    </>
  );
};
