import { AlertTriangle, RefreshCw } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from './button';

export interface ErrorStateProps {
  title?: string;
  message?: string;
  details?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title = 'Failed to load clinical data',
  message = 'An unexpected system error occurred while retrieving this record.',
  details,
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      className={cn(
        'p-5 rounded-xl border border-rose-200 bg-rose-50/80 shadow-xs space-y-3',
        className
      )}
    >
      <div className="flex items-start gap-3.5">
        <div className="p-2 rounded-lg bg-rose-100 text-rose-700 shrink-0 border border-rose-200">
          <AlertTriangle className="w-5 h-5 stroke-[2]" />
        </div>
        <div className="space-y-1 flex-1">
          <h4 className="text-sm font-semibold text-rose-900 tracking-tight">{title}</h4>
          <p className="text-xs text-rose-800 leading-relaxed">{message}</p>
          {details && (
            <pre className="mt-2 p-2.5 rounded bg-white border border-rose-200 text-[11px] font-mono text-rose-900 overflow-x-auto">
              {details}
            </pre>
          )}
        </div>
        {onRetry && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            className="border-rose-300 hover:bg-rose-100 text-rose-800 gap-1.5 shrink-0 bg-white"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Retry
          </Button>
        )}
      </div>
    </div>
  );
}
