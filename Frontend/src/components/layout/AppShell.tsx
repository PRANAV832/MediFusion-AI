import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';
import { CommandPalette } from './CommandPalette';
import { HeartPulse, ShieldCheck, Terminal, Command } from 'lucide-react';

export const AppShell: React.FC = () => {
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Global Ctrl+K / Cmd+K listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="min-h-screen bg-[#FAF6F0] text-[#3B2A1C] flex font-sans selection:bg-[#D9C6B7] selection:text-[#3B2A1C]">
      {/* Accessible Skip Link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-[#8B6F5B] focus:text-white focus:rounded-md focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-[#D9C6B7]"
      >
        Skip to main clinical content
      </a>

      {/* Refined Clinical Sidebar (Desktop persistent, Mobile drawer) */}
      <Sidebar
        isMobileOpen={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />

      {/* Main Clinical Workstation Viewport */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header Bar */}
        <Navbar
          onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
          onOpenCommandPalette={() => setIsCommandOpen(true)}
        />

        {/* Main Content Area */}
        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 focus:outline-none"
        >
          <Outlet />
        </main>

        {/* Global Command Palette */}
        <CommandPalette isOpen={isCommandOpen} onClose={() => setIsCommandOpen(false)} />

        {/* Clinical Workstation Footer */}
        <footer className="border-t border-[#D9C6B7] bg-white py-4 text-xs text-[#6E5D4F] select-none">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-2">
              <HeartPulse className="h-4 w-4 text-[#8B6F5B]" />
              <span className="font-medium text-[#3B2A1C]">
                MediFusion AI Platform — Multimodal Clinical Workstation
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-4 text-[11px] text-[#6E5D4F]">
              <span className="flex items-center gap-1.5 text-[#5A4D3B]">
                <ShieldCheck className="h-3.5 w-3.5 text-[#8B6F5B]" />
                Non-Autonomous Screening System • Requires Credentialed Review
              </span>
              <span className="hidden md:flex items-center gap-1 font-mono text-[#8B6F5B]">
                <Command className="h-3 w-3" />
                Ctrl+K command search
              </span>
              <span className="flex items-center gap-1 font-mono text-[#8B6F5B]">
                <Terminal className="h-3 w-3" />
                v1.17 Clinical Suite
              </span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};
