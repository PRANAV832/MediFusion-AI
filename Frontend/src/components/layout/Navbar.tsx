import React from 'react';
import { HealthStatus } from '../health/HealthStatus';
import { Button } from '../ui/button';
import {
  ShieldAlert,
  Search,
  Menu,
  Plus,
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface NavbarProps {
  onOpenMobileMenu?: () => void;
  onOpenCommandPalette?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenMobileMenu,
  onOpenCommandPalette,
}) => {
  return (
    <header className="sticky top-0 z-20 w-full border-b border-[#D9C6B7] bg-white/95 backdrop-blur-xs shadow-2xs">
      <div className="flex h-15 items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Left Section: Mobile Menu Toggle & Search Bar */}
        <div className="flex items-center gap-3">
          {/* Mobile hamburger menu toggle */}
          <button
            type="button"
            aria-label="Open clinical navigation menu"
            onClick={onOpenMobileMenu}
            className="lg:hidden p-2 rounded-lg text-[#5A4D3B] hover:text-[#3B2A1C] hover:bg-[#F2E4D5]/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B6F5B]"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Quick Command Search Trigger */}
          <button
            type="button"
            onClick={onOpenCommandPalette}
            aria-label="Open clinical workstation search and commands (Ctrl+K)"
            className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg border border-[#D9C6B7] bg-[#FAF6F0] hover:bg-[#F2E4D5]/50 text-[#5A4D3B] text-xs transition-all shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B6F5B]"
          >
            <Search className="w-3.5 h-3.5 text-[#8B6F5B]" />
            <span className="font-medium text-[#5A4D3B]">Search screens & cases...</span>
            <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded bg-white px-1.5 py-0.5 text-[10px] font-mono text-[#8B6F5B] border border-[#D9C6B7]">
              Ctrl K
            </kbd>
          </button>
        </div>

        {/* Right Section: Health Status, Clinical Safety Badge, & Quick Action */}
        <div className="flex items-center gap-3">
          {/* Health Status Indicator */}
          <HealthStatus compact />

          {/* Clinical Prototype Badge (Persistent) */}
          <div className="hidden md:flex items-center gap-1.5 rounded-md border border-[#D9C6B7] bg-[#F2E4D5] px-2.5 py-1 text-[11px] text-[#5A4D3B] font-medium select-none shadow-2xs">
            <ShieldAlert className="h-3.5 w-3.5 text-[#8B6F5B] shrink-0" />
            <span>Decision Support Only</span>
          </div>

          {/* New Case Quick Action */}
          <Link to="/cases/new">
            <Button
              size="sm"
              variant="default"
              className="gap-1.5 text-xs h-8 bg-[#8B6F5B] hover:bg-[#5A4D3B] text-white shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">New Case</span>
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
};
