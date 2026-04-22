'use client';

import { useDroppable } from '@dnd-kit/core';
import type { Paper, PaperStage } from '@/lib/types';
import { KanbanCard } from './KanbanCard';

export function KanbanColumn({ stage, label, papers, now }: { stage: PaperStage; label: string; papers: Paper[]; now: number }) {
  const { isOver, setNodeRef } = useDroppable({ id: stage });
  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col gap-2 bg-canvas-inset rounded-md p-3 min-w-[260px] ${isOver ? 'ring-2 ring-accent-fg' : ''}`}
    >
      <div className="flex items-center justify-between text-xs uppercase tracking-wide text-fg-muted font-semibold">
        <span>{label}</span>
        <span className="bg-white border border-border-default rounded-full px-1.5 py-0.5 text-[10px]">{papers.length}</span>
      </div>
      {papers.map(p => <KanbanCard key={p.id} paper={p} now={now} />)}
    </div>
  );
}
