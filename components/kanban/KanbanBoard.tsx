'use client';

import { useState } from 'react';
import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import type { Paper, PaperStage } from '@/lib/types';
import { PAPER_STAGE_LABELS, PAPER_STAGE_ORDER } from '@/lib/labels';
import { KanbanColumn } from './KanbanColumn';

const COLUMNS: { stage: PaperStage; label: string }[] = PAPER_STAGE_ORDER.map(stage => ({
  stage,
  label: PAPER_STAGE_LABELS[stage],
}));

// TODO: keyboard accessibility — add @dnd-kit KeyboardSensor + coordinate getter for a11y (post-MVP).
// TODO: if `initial` ever becomes dynamic (router.refresh, router-driven data), useState(initial) will silently freeze — remount board or sync via effect.
export function KanbanBoard({ initial }: { initial: Paper[] }) {
  const [items, setItems] = useState(initial);
  const [now] = useState(() => Date.now());
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  function onDragEnd(e: DragEndEvent) {
    const paperId = e.active.id;
    const targetId = e.over?.id;
    if (typeof targetId !== 'string') return;
    if (!PAPER_STAGE_ORDER.includes(targetId as PaperStage)) return;
    const stage = targetId as PaperStage;
    if (typeof paperId !== 'string') return;
    setItems(prev => prev.map(p => p.id === paperId ? { ...p, stage } : p));
  }

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-4">
        {COLUMNS.map(c => (
          <KanbanColumn key={c.stage} stage={c.stage} label={c.label} papers={items.filter(p => p.stage === c.stage)} now={now} />
        ))}
      </div>
    </DndContext>
  );
}
