import { cn } from '@/lib/cn';

export type KpiTone = 'accent' | 'success' | 'attention' | 'done';

export interface KpiStat {
  label: string;
  value: string | number;
  tone?: KpiTone;
}

const toneClasses: Record<KpiTone, string> = {
  accent: 'text-accent-fg',
  success: 'text-success-fg',
  attention: 'text-attention-fg',
  done: 'text-done-fg',
};

export function KpiBar({ stats }: { stats: KpiStat[] }) {
  return (
    <div className="flex flex-wrap gap-6">
      {stats.map(s => (
        <div key={s.label} className="text-center min-w-[72px]">
          <div
            className={cn(
              'text-2xl font-bold leading-tight',
              s.tone ? toneClasses[s.tone] : 'text-fg-default',
            )}
          >
            {s.value}
          </div>
          <div className="text-xs text-fg-muted mt-0.5">{s.label}</div>
        </div>
      ))}
    </div>
  );
}
