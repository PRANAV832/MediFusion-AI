import * as React from 'react';
import { cn } from '../../lib/utils';

export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'animate-pulse rounded-md bg-[#EAE1D7] border border-[#D9C6B7]/40',
        className
      )}
      {...props}
    />
  );
}

export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div
      role="status"
      aria-label="Loading content..."
      className={cn(
        'p-5 rounded-xl border border-[#D9C6B7] bg-white space-y-4 animate-pulse shadow-xs',
        className
      )}
    >
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-1/3" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <Skeleton className="h-4 w-4/5" />
      <Skeleton className="h-12 w-full rounded-lg" />
      <div className="flex gap-2 pt-2">
        <Skeleton className="h-8 w-24 rounded-md" />
        <Skeleton className="h-8 w-24 rounded-md" />
      </div>
      <span className="sr-only">Loading card data...</span>
    </div>
  );
}

export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div role="status" aria-label="Loading table..." className="w-full space-y-3">
      {/* Header skeleton */}
      <div className="flex gap-4 p-3 bg-[#FAF6F0] border-b border-[#D9C6B7] rounded-t-lg">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={`th-${i}`} className="h-4 flex-1" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, r) => (
        <div key={`tr-${r}`} className="flex gap-4 p-3 border-b border-[#E8DCD1] bg-white">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={`td-${r}-${c}`} className="h-4 flex-1" />
          ))}
        </div>
      ))}
      <span className="sr-only">Loading table records...</span>
    </div>
  );
}
