import * as React from 'react';
import { cn } from '../../lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning';
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  const variants = {
    default: 'bg-[#F2E4D5] text-[#5A4D3B] border border-[#D9C6B7]',
    secondary: 'bg-[#FAF6F0] text-[#8B6F5B] border border-[#E8DCD1]',
    outline: 'bg-white text-[#5A4D3B] border border-[#D9C6B7]',
    destructive: 'bg-rose-50 text-rose-800 border border-rose-200',
    success: 'bg-emerald-50 text-emerald-800 border border-emerald-200',
    warning: 'bg-amber-50 text-amber-900 border border-amber-200',
  };

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-wide transition-colors focus:outline-none select-none',
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
