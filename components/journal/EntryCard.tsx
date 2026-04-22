'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from '@primer/octicons-react';
import type { ResearchEntry } from '@/lib/types';
import {
  ENTRY_TYPE_LABELS,
  ENTRY_TYPE_STRIP_BG,
  ENTRY_TYPE_TONE,
} from '@/lib/labels';
import { LabelChip } from '@/components/badges/LabelChip';
import { cn } from '@/lib/cn';
import { NarrativeSlide, SummarySlide } from './EntrySlide';

export function EntryCard({
  entry,
  onOpen,
}: {
  entry: ResearchEntry;
  onOpen: (entryId: string) => void;
}) {
  const total = 1 + entry.slides.length; // summary + narratives
  const [idx, setIdx] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  const goto = useCallback(
    (i: number) => {
      setIdx(Math.max(0, Math.min(total - 1, i)));
    },
    [total],
  );

  // Keyboard: arrow keys navigate when hovering this card.
  useEffect(() => {
    const handler = (ev: KeyboardEvent) => {
      const el = rootRef.current;
      if (!el) return;
      if (!el.matches(':hover')) return;
      if (ev.key === 'ArrowRight') {
        ev.preventDefault();
        setIdx(i => Math.min(total - 1, i + 1));
      } else if (ev.key === 'ArrowLeft') {
        ev.preventDefault();
        setIdx(i => Math.max(0, i - 1));
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [total]);

  const typeTone = ENTRY_TYPE_TONE[entry.type];

  return (
    <div
      ref={rootRef}
      data-entry-card
      data-entry-id={entry.id}
      className="group bg-white rounded-md border border-border-default overflow-hidden flex flex-col transition-shadow hover:shadow-md"
    >
      {/* Top 2-3px colored strip per entry type */}
      <div className={cn('h-[3px] w-full', ENTRY_TYPE_STRIP_BG[entry.type])} />
      {/* Carousel */}
      <div className="relative aspect-[4/5] overflow-hidden">
        {/* Progress dots at top-left */}
        <div className="absolute top-2 left-3 right-3 flex gap-1 z-20 pointer-events-none">
          {Array.from({ length: total }).map((_, k) => (
            <span
              key={k}
              className={cn(
                'flex-1 h-[3px] rounded-full',
                k < idx && 'bg-border-default',
                k === idx && 'bg-fg-default',
                k > idx && 'bg-border-muted',
              )}
            />
          ))}
        </div>
        {/* Slides container */}
        <div
          className="flex h-full transition-transform duration-[350ms] ease-out"
          style={{ transform: `translateX(-${idx * 100}%)` }}
        >
          <SummarySlide entry={entry} />
          {entry.slides.map((s, i) => (
            <NarrativeSlide key={i} slide={s} />
          ))}
        </div>
        {/* Click zones */}
        <button
          type="button"
          aria-label="previous slide"
          onClick={() => goto(idx - 1)}
          className="absolute top-0 bottom-0 left-0 w-[35%] z-10 cursor-pointer"
          tabIndex={-1}
        />
        <button
          type="button"
          aria-label="next slide"
          onClick={() => goto(idx + 1)}
          className="absolute top-0 bottom-0 right-0 w-[35%] z-10 cursor-pointer"
          tabIndex={-1}
        />
        {/* Arrows — hidden until hover */}
        {idx > 0 && (
          <div className="absolute top-1/2 left-2 -translate-y-1/2 z-20 pointer-events-none text-fg-muted group-hover:text-fg-default opacity-0 group-hover:opacity-100 transition-opacity">
            <ChevronLeftIcon size={20} />
          </div>
        )}
        {idx < total - 1 && (
          <div className="absolute top-1/2 right-2 -translate-y-1/2 z-20 pointer-events-none text-fg-muted group-hover:text-fg-default opacity-0 group-hover:opacity-100 transition-opacity">
            <ChevronRightIcon size={20} />
          </div>
        )}
      </div>
      {/* Bottom bar */}
      <div className="px-4 py-3 flex items-center justify-between bg-white border-t border-border-muted">
        <div className="flex items-center gap-2">
          <LabelChip tone={typeTone}>{ENTRY_TYPE_LABELS[entry.type]}</LabelChip>
          <span className="text-xs text-fg-muted">{entry.date.slice(0, 10)}</span>
        </div>
        <button
          type="button"
          onClick={() => onOpen(entry.id)}
          className="text-xs text-accent-fg hover:underline font-medium"
        >
          더보기 →
        </button>
      </div>
    </div>
  );
}
