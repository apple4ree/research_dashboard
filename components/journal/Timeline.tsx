import type { Milestone } from '@/lib/types';
import { cn } from '@/lib/cn';

function monthLabel(iso: string): string {
  return iso.slice(0, 7);
}

export function Timeline({ milestones }: { milestones: Milestone[] }) {
  if (milestones.length === 0) {
    return (
      <section className="bg-white border border-border-default rounded-md p-6">
        <h2 className="text-sm font-semibold mb-4">연구 흐름</h2>
        <p className="text-xs text-fg-muted">No milestones yet.</p>
      </section>
    );
  }

  return (
    <section className="bg-white border border-border-default rounded-md p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold">연구 흐름</h2>
      </div>
      <div className="relative">
        {/* Horizontal line behind the dots. Dot is 16px (h-4). Offset = 7px. */}
        <div className="absolute left-0 right-0 top-[7px] h-0.5 bg-border-muted" />
        <div
          className="relative grid gap-2"
          style={{ gridTemplateColumns: `repeat(${milestones.length}, minmax(0, 1fr))` }}
        >
          {milestones.map(m => (
            <div key={m.position}>
              <div
                className={cn(
                  'w-4 h-4 rounded-full mx-auto relative',
                  m.status === 'past' && 'bg-fg-default',
                  m.status === 'now' && 'bg-accent-emphasis ring-4 ring-accent-subtle',
                  m.status === 'future' && 'bg-border-default',
                )}
              />
              <div className="mt-3 text-center">
                <div
                  className={cn(
                    'text-xs',
                    m.status === 'now' ? 'font-semibold text-accent-fg' : 'text-fg-muted',
                  )}
                >
                  {m.status === 'now' ? `NOW · ${monthLabel(m.date)}` : monthLabel(m.date)}
                </div>
                <div className="text-sm font-medium text-fg-default mt-0.5">{m.label}</div>
                {m.note && <div className="text-xs text-fg-muted mt-0.5">{m.note}</div>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
