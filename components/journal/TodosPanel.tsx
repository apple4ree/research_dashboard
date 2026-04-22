import type { TodoItem, TodoBucket } from '@/lib/types';
import { TODO_BUCKET_LABELS, TODO_BUCKET_ORDER } from '@/lib/labels';
import { cn } from '@/lib/cn';

const bucketDot: Record<TodoBucket, string> = {
  short: 'bg-danger-emphasis',
  mid: 'bg-attention-emphasis',
  long: 'bg-accent-emphasis',
};

export function TodosPanel({ todos }: { todos: TodoItem[] }) {
  const byBucket = (b: TodoBucket) =>
    [...todos.filter(t => t.bucket === b)].sort((a, b2) => a.position - b2.position);

  return (
    <section className="grid md:grid-cols-3 gap-4">
      {TODO_BUCKET_ORDER.map(bucket => {
        const items = byBucket(bucket);
        const done = items.filter(i => i.done).length;
        return (
          <div
            key={bucket}
            className="bg-white rounded-md border border-border-default p-5"
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-fg-default flex items-center gap-2">
                <span className={cn('w-2 h-2 rounded-full', bucketDot[bucket])} />
                {TODO_BUCKET_LABELS[bucket]}
              </h3>
              <span className="text-xs text-fg-muted">
                {done} / {items.length}
              </span>
            </div>
            {items.length === 0 ? (
              <p className="text-xs text-fg-muted">—</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {items.map(t => (
                  <li key={t.id} className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={t.done}
                      disabled
                      readOnly
                      className="mt-1 accent-fg-default"
                      aria-label={t.text}
                    />
                    <span className={t.done ? 'line-through text-fg-muted' : 'text-fg-default'}>
                      {t.text}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </section>
  );
}
