'use client';

import { useMemo, useState } from 'react';
import type { ResearchEntry, EntryType } from '@/lib/types';
import {
  ENTRY_TYPE_LABELS,
  ENTRY_TYPE_ORDER,
  ENTRY_TYPE_STRIP_BG,
} from '@/lib/labels';
import { cn } from '@/lib/cn';
import { EntryCard } from './EntryCard';
import { EntryModal } from './EntryModal';

type FilterValue = 'all' | EntryType;

export function JournalView({ entries }: { entries: ResearchEntry[] }) {
  const [filter, setFilter] = useState<FilterValue>('all');
  const [openId, setOpenId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (filter === 'all') return entries;
    return entries.filter(e => e.type === filter);
  }, [entries, filter]);

  const open = useMemo(
    () => (openId ? entries.find(e => e.id === openId) ?? null : null),
    [openId, entries],
  );

  return (
    <>
      <section className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-sm font-semibold text-fg-default">날짜별 기록</h2>
          <p className="text-xs text-fg-muted mt-0.5">
            카드를 좌우로 넘겨 그날의 발견/실패/구현/고민을 한눈에 보세요.
          </p>
        </div>
        <div className="flex gap-1.5 text-xs">
          <FilterChip
            active={filter === 'all'}
            onClick={() => setFilter('all')}
            label="All"
          />
          {ENTRY_TYPE_ORDER.map(t => (
            <FilterChip
              key={t}
              active={filter === t}
              onClick={() => setFilter(t)}
              label={ENTRY_TYPE_LABELS[t]}
              dotClass={ENTRY_TYPE_STRIP_BG[t]}
            />
          ))}
        </div>
      </section>
      <section className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {filtered.map(entry => (
          <EntryCard key={entry.id} entry={entry} onOpen={setOpenId} />
        ))}
      </section>
      <EntryModal entry={open} onClose={() => setOpenId(null)} />
    </>
  );
}

function FilterChip({
  active,
  onClick,
  label,
  dotClass,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  dotClass?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border transition-colors',
        active
          ? 'bg-fg-default text-white border-fg-default'
          : 'bg-white border-border-default text-fg-muted hover:bg-canvas-subtle',
      )}
    >
      {dotClass && <span className={cn('inline-block w-2 h-2 rounded-full', dotClass)} />}
      {label}
    </button>
  );
}
