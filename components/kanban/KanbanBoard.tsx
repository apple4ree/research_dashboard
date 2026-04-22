'use client';

import { useState } from 'react';
import { DndContext, DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import type { Paper, PaperStage } from '@/lib/types';
import { PAPER_STAGE_LABELS, PAPER_STAGE_ORDER } from '@/lib/labels';
import { KanbanColumn } from './KanbanColumn';

const COLUMNS: { stage: PaperStage; label: string }[] = PAPER_STAGE_ORDER.map(stage => ({
  stage,
  label: PAPER_STAGE_LABELS[stage],
}));

export function KanbanBoard({ initial }: { initial: Paper[] }) {
  const [items, setItems] = useState(initial);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  function onDragEnd(e: DragEndEvent) {
    const paperId = e.active.id as string;
    const stage = e.over?.id as PaperStage | undefined;
    if (!stage) return;
    setItems(prev => prev.map(p => p.id === paperId ? { ...p, stage } : p));
  }

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-4">
        {COLUMNS.map(c => (
          <KanbanColumn key={c.stage} stage={c.stage} label={c.label} papers={items.filter(p => p.stage === c.stage)} />
        ))}
      </div>
    </DndContext>
  );
}
