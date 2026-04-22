import { CheckCircleFillIcon, XCircleFillIcon, DotFillIcon, StopIcon, ClockIcon } from '@primer/octicons-react';
import type { RunStatus } from '@/lib/types';
import { cn } from '@/lib/cn';

const config: Record<RunStatus, { icon: React.ComponentType<{ size?: number }>; label: string; cls: string }> = {
  success:     { icon: CheckCircleFillIcon, label: 'Success',     cls: 'text-success-fg' },
  failure:     { icon: XCircleFillIcon,     label: 'Failure',     cls: 'text-danger-fg' },
  in_progress: { icon: DotFillIcon,         label: 'In progress', cls: 'text-attention-fg animate-pulse' },
  queued:      { icon: ClockIcon,           label: 'Queued',      cls: 'text-fg-muted' },
  cancelled:   { icon: StopIcon,            label: 'Cancelled',   cls: 'text-fg-muted' },
};

export function StatusBadge({ status, showLabel = false, className }: { status: RunStatus; showLabel?: boolean; className?: string }) {
  const c = config[status];
  const Icon = c.icon;
  return (
    <span className={cn('inline-flex items-center gap-1', c.cls, className)} title={c.label}>
      <Icon size={14} />
      {showLabel && <span className="text-xs">{c.label}</span>}
    </span>
  );
}
