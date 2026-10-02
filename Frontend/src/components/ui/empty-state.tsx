import * as React from 'react';
import type { LucideIcon } from 'lucide-react';
import { Inbox } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from './button';

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick?: () => void;
    href?: string;
  };
  className?: string;
  children?: React.ReactNode;
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
  children,
}: EmptyStateProps) {
  return (
    <div
      role="region"
      aria-label={title}
      className={cn(
        'flex flex-col items-center justify-center text-center p-8 rounded-xl border border-dashed border-[#D9C6B7] bg-[#FAF6F0]/70',
        className
      )}
    >
      <div className="w-12 h-12 rounded-xl bg-[#F2E4D5] border border-[#D9C6B7] flex items-center justify-center text-[#8B6F5B] mb-3.5 shadow-2xs">
        <Icon className="w-6 h-6 stroke-[1.5]" />
      </div>
      <h3 className="text-sm sm:text-base font-semibold text-[#3B2A1C] tracking-tight">{title}</h3>
      {description && (
        <p className="text-xs sm:text-sm text-[#6E5D4F] max-w-sm mt-1.5 leading-relaxed">
          {description}
        </p>
      )}
      {children && <div className="mt-4">{children}</div>}
      {action && (
        <div className="mt-5">
          {action.href ? (
            <a
              href={action.href}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-medium rounded-lg bg-[#8B6F5B] hover:bg-[#5A4D3B] text-white shadow-xs transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B6F5B]"
            >
              {action.label}
            </a>
          ) : (
            <Button
              variant="default"
              size="sm"
              onClick={action.onClick}
              className="bg-[#8B6F5B] hover:bg-[#5A4D3B] text-white shadow-xs text-xs"
            >
              {action.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
