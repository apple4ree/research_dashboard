'use client';

import Link from 'next/link';
import { useDraggable } from '@dnd-kit/core';
import type { Paper } from '@/lib/types';
import { AvatarStack } from '@/components/people/AvatarStack';
import { LabelChip } from '@/components/badges/LabelChip';
import { getProjectBySlug } from '@/lib/mock';
import { relDeadline } from '@/lib/time';

export function KanbanCard({ paper, now }: { paper: Paper; now: number }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: paper.id });
  const proj = getProjectBySlug(paper.projectSlug);
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`bg-white border border-border-default rounded-md p-3 cursor-grab select-none shadow-sm ${isDragging ? 'opacity-40' : ''}`}
    >
      <div className="font-medium text-sm leading-tight">{paper.title}</div>
      <div className="mt-2 flex items-center justify-between gap-2 text-xs">
        {paper.venue ? <LabelChip tone="accent">{paper.venue}</LabelChip> : <span />}
        {paper.deadline && <span className="text-fg-muted">{relDeadline(paper.deadline, now)}</span>}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <AvatarStack logins={paper.authorLogins} size={18} />
        {proj && <Link href={`/projects/${proj.slug}`} className="text-xs text-fg-muted hover:text-accent-fg">{proj.name}</Link>}
      </div>
    </div>
  );
}
