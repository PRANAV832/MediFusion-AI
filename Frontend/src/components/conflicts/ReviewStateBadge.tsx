import React from 'react';
import type { ReviewState } from '../../types/api';
import {
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  AlertOctagon,
  ImageOff,
} from 'lucide-react';
import { Badge } from '../ui/badge';

interface ReviewStateBadgeProps {
  state: ReviewState;
  showIcon?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const getReviewStateMeta = (state: ReviewState) => {
  switch (state) {
    case 'CLEAR':
      return {
        label: 'CLEAR',
        subtitle: 'Concordant Evidence • No Discrepancies',
        icon: CheckCircle2,
        bg: 'bg-emerald-950/80',
        border: 'border-emerald-600',
        text: 'text-emerald-300',
        colorClass: 'emerald',
      };
    case 'REVIEW_REQUIRED':
      return {
        label: 'REVIEW_REQUIRED',
        subtitle: 'Human Review Required • Discrepancy Flagged',
        icon: AlertTriangle,
        bg: 'bg-amber-950/90',
        border: 'border-amber-600',
        text: 'text-amber-300',
        colorClass: 'amber',
      };
    case 'INSUFFICIENT_EVIDENCE':
      return {
        label: 'INSUFFICIENT_EVIDENCE',
        subtitle: 'Critical Evidence / Modality Missing',
        icon: HelpCircle,
        bg: 'bg-purple-950/90',
        border: 'border-purple-600',
        text: 'text-purple-300',
        colorClass: 'purple',
      };
    case 'MODEL_DISAGREEMENT':
      return {
        label: 'MODEL_DISAGREEMENT',
        subtitle: 'Conflicting AI Predictions on Same Study',
        icon: AlertOctagon,
        bg: 'bg-rose-950/90',
        border: 'border-rose-600',
        text: 'text-rose-300',
        colorClass: 'rose',
      };
    case 'INPUT_QUALITY_ISSUE':
      return {
        label: 'INPUT_QUALITY_ISSUE',
        subtitle: 'Sub-Diagnostic Asset Resolution / Payload',
        icon: ImageOff,
        bg: 'bg-orange-950/90',
        border: 'border-orange-600',
        text: 'text-orange-300',
        colorClass: 'orange',
      };
  }
};

export const ReviewStateBadge: React.FC<ReviewStateBadgeProps> = ({
  state,
  showIcon = true,
  size = 'md',
}) => {
  const meta = getReviewStateMeta(state);
  const Icon = meta.icon;

  const sizeClasses = {
    sm: 'text-[10px] px-2 py-0.5',
    md: 'text-xs px-2.5 py-1',
    lg: 'text-sm px-3.5 py-1.5 font-bold',
  }[size];

  return (
    <Badge
      className={`${meta.bg} ${meta.border} ${meta.text} border font-mono tracking-wider flex items-center gap-1.5 ${sizeClasses}`}
    >
      {showIcon && <Icon className={size === 'lg' ? 'w-4 h-4' : 'w-3.5 h-3.5'} />}
      <span>{meta.label}</span>
    </Badge>
  );
};
