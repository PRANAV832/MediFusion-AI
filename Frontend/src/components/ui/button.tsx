import * as React from 'react';
import { cn } from '../../lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    const baseStyles =
      'inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B6F5B] focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer';

    const variants = {
      default:
        'bg-[#8B6F5B] text-white shadow-sm hover:bg-[#5A4D3B] active:bg-[#3B2A1C] border border-[#8B6F5B]/80 font-medium',
      destructive:
        'bg-rose-700 text-white shadow-sm hover:bg-rose-800 active:bg-rose-900 border border-rose-800',
      outline:
        'border border-[#D9C6B7] bg-white text-[#5A4D3B] hover:bg-[#FAF6F0] hover:text-[#3B2A1C] hover:border-[#B89A7D] shadow-xs',
      secondary:
        'bg-[#F2E4D5] text-[#3B2A1C] border border-[#D9C6B7] hover:bg-[#E8DCD1] hover:border-[#B89A7D] shadow-xs font-medium',
      ghost:
        'text-[#5A4D3B] hover:bg-[#F2E4D5]/60 hover:text-[#3B2A1C]',
      link:
        'text-[#8B6F5B] underline-offset-4 hover:underline hover:text-[#5A4D3B] p-0 h-auto',
    };

    const sizes = {
      default: 'h-9 px-4 py-2',
      sm: 'h-8 rounded-md px-3 text-xs',
      lg: 'h-10 rounded-lg px-8 text-base',
      icon: 'h-9 w-9',
    };

    return (
      <button
        ref={ref}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      />
    );
  },
);

Button.displayName = 'Button';
