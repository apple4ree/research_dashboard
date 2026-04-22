import { cn } from '@/lib/cn';

export function LabelChip({ children, tone = 'neutral', className }: { children: React.ReactNode; tone?: 'neutral' | 'accent' | 'success' | 'attention' | 'danger' | 'done'; className?: string }) {
  const tones: Record<string, string> = {
    neutral:   'bg-canvas-inset text-fg-muted border-border-default',
    accent:    'bg-accent-subtle text-accent-fg border-accent-subtle',
    success:   'bg-success-subtle text-success-fg border-success-subtle',
    attention: 'bg-attention-subtle text-attention-fg border-attention-subtle',
    danger:    'bg-danger-subtle text-danger-fg border-danger-subtle',
    done:      'bg-done-subtle text-done-fg border-done-subtle',
  };
  return (
    <span className={cn('inline-flex items-center px-1.5 py-0.5 rounded-full text-xs border', tones[tone], className)}>
      {children}
    </span>
  );
}
