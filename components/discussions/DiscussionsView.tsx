'use client';

import { useState } from 'react';
import Link from 'next/link';
import { PlusIcon } from '@primer/octicons-react';
import { DiscussionRow } from '@/components/discussions/DiscussionRow';
import type { Discussion, DiscussionCategory } from '@/lib/types';
import {
  DISCUSSION_CATEGORY_LABELS,
  DISCUSSION_CATEGORY_ICONS,
  DISCUSSION_CATEGORY_ORDER,
} from '@/lib/labels';

export function DiscussionsView({
  discussions,
  now,
}: {
  discussions: Discussion[];
  now: number;
}) {
  const [selected, setSelected] = useState<DiscussionCategory | 'all'>('all');

  const filtered =
    selected === 'all' ? discussions : discussions.filter(d => d.category === selected);

  const totals: Record<DiscussionCategory | 'all', number> = {
    all: discussions.length,
    announcements: discussions.filter(d => d.category === 'announcements').length,
    journal_club: discussions.filter(d => d.category === 'journal_club').length,
    qa: discussions.filter(d => d.category === 'qa').length,
    ideas: discussions.filter(d => d.category === 'ideas').length,
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-6">
      <aside className="bg-white border border-border-default rounded-md p-3 h-fit">
        <h3 className="text-xs uppercase tracking-wide text-fg-muted font-semibold mb-2">Categories</h3>
        <ul className="space-y-1 text-sm">
          <li>
            <button
              type="button"
              onClick={() => setSelected('all')}
              className={`w-full flex items-center justify-between px-2 py-1 rounded text-left hover:bg-canvas-subtle ${
                selected === 'all' ? 'bg-accent-subtle text-accent-fg font-medium' : ''
              }`}
            >
              <span>All</span>
              <span className="text-xs text-fg-muted">{totals.all}</span>
            </button>
          </li>
          {DISCUSSION_CATEGORY_ORDER.map(cat => (
            <li key={cat}>
              <button
                type="button"
                onClick={() => setSelected(cat)}
                className={`w-full flex items-center justify-between px-2 py-1 rounded text-left hover:bg-canvas-subtle ${
                  selected === cat ? 'bg-accent-subtle text-accent-fg font-medium' : ''
                }`}
              >
                <span>
                  {DISCUSSION_CATEGORY_ICONS[cat]} {DISCUSSION_CATEGORY_LABELS[cat]}
                </span>
                <span className="text-xs text-fg-muted">{totals[cat]}</span>
              </button>
            </li>
          ))}
        </ul>
      </aside>
      <section>
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-lg font-semibold">Discussions</h1>
          <Link
            href="/discussions/new"
            className="px-3 h-8 inline-flex items-center gap-1 rounded-md border border-border-default text-sm hover:bg-canvas-subtle"
          >
            <PlusIcon size={14} /> New discussion
          </Link>
        </div>
        {filtered.length === 0 ? (
          <div className="bg-white border border-dashed border-border-default rounded-md p-8 text-center text-sm text-fg-muted">
            No discussions in this category yet.
          </div>
        ) : (
          <ul className="bg-white border border-border-default rounded-md">
            {filtered.map(d => <DiscussionRow key={d.id} discussion={d} now={now} />)}
          </ul>
        )}
      </section>
    </div>
  );
}
