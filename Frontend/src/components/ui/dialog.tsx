import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export const Dialog: React.FC<DialogProps> = ({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#3B2A1C]/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className={cn(
          'relative w-full max-w-lg rounded-2xl border border-[#D9C6B7] bg-white shadow-2xl p-6 text-[#3B2A1C] max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-150',
          className,
        )}
      >
        <button
          onClick={() => onOpenChange(false)}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-[#8B6F5B] hover:text-[#3B2A1C] hover:bg-[#F2E4D5]/60 transition-colors"
          aria-label="Close dialog"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mb-4">
          <h3 className="text-base sm:text-lg font-semibold tracking-tight text-[#3B2A1C]">{title}</h3>
          {description && <p className="text-xs text-[#6E5D4F] mt-1">{description}</p>}
        </div>

        <div>{children}</div>
      </div>
    </div>
  );
};
