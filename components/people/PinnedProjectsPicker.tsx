'use client';

import { useState, useMemo } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  arrayMove,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GrabberIcon, XIcon, PlusIcon, RepoIcon } from '@primer/octicons-react';
import type { Project } from '@/lib/types';

export function PinnedProjectsPicker({
  allProjects,
  defaultPinned = [],
}: {
  allProjects: Project[];
  defaultPinned?: string[];
}) {
  // Only keep slugs that actually exist in allProjects — silently drop
  // dangling references from seed data.
  const validInitial = defaultPinned.filter(s => allProjects.some(p => p.slug === s));
  const [pinned, setPinned] = useState<string[]>(validInitial);
  const [picker, setPicker] = useState<string>('');

  const slugToProject = useMemo(
    () => new Map(allProjects.map(p => [p.slug, p] as const)),
    [allProjects],
  );

  const unpinned = useMemo(
    () => allProjects.filter(p => !pinned.includes(p.slug)),
    [allProjects, pinned],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = pinned.indexOf(String(active.id));
    const newIndex = pinned.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    setPinned(prev => arrayMove(prev, oldIndex, newIndex));
  }

  function handleAdd() {
    if (!picker || pinned.includes(picker)) return;
    if (!slugToProject.has(picker)) return;
    setPinned(prev => [...prev, picker]);
    setPicker('');
  }

  function handleRemove(slug: string) {
    setPinned(prev => prev.filter(s => s !== slug));
  }

  return (
    <div>
      <label className="block text-sm font-medium mb-1">Pinned projects</label>
      <p className="text-xs text-fg-muted mb-2">
        Drag chips to reorder. Order here determines how they appear on the dashboard.
      </p>

      {/* Hidden inputs drive the form submission in stable pinned order. */}
      {pinned.map(slug => (
        <input key={slug} type="hidden" name="pinnedProjectSlugs" value={slug} />
      ))}

      <div className="bg-canvas-subtle border border-border-default rounded-md p-2 min-h-[52px]">
        {pinned.length === 0 ? (
          <p className="text-xs text-fg-muted px-1 py-2">No pinned projects yet. Add one below.</p>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={pinned} strategy={horizontalListSortingStrategy}>
              <ul className="flex flex-wrap gap-1.5">
                {pinned.map((slug, index) => {
                  const p = slugToProject.get(slug);
                  if (!p) return null;
                  return (
                    <SortableChip
                      key={slug}
                      slug={slug}
                      label={p.name}
                      position={index + 1}
                      onRemove={() => handleRemove(slug)}
                    />
                  );
                })}
              </ul>
            </SortableContext>
          </DndContext>
        )}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <select
          value={picker}
          onChange={e => setPicker(e.target.value)}
          disabled={unpinned.length === 0}
          className="flex-1 border border-border-default rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent-emphasis disabled:opacity-50"
        >
          <option value="">
            {unpinned.length === 0 ? 'All projects pinned' : 'Add a project…'}
          </option>
          {unpinned.map(p => (
            <option key={p.slug} value={p.slug}>
              {p.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={handleAdd}
          disabled={!picker}
          className="inline-flex items-center gap-1 px-3 h-8 rounded-md border border-border-default text-sm hover:bg-canvas-subtle disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <PlusIcon size={14} /> Add
        </button>
      </div>
    </div>
  );
}

function SortableChip({
  slug,
  label,
  position,
  onRemove,
}: {
  slug: string;
  label: string;
  position: number;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: slug,
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="inline-flex items-center gap-1 bg-white border border-border-default rounded-full pl-1.5 pr-1 py-0.5 text-xs shadow-sm"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Drag ${label}`}
        className="text-fg-muted hover:text-fg-default cursor-grab active:cursor-grabbing px-0.5"
      >
        <GrabberIcon size={12} />
      </button>
      <span className="text-fg-muted tabular-nums">{position}.</span>
      <RepoIcon size={10} className="text-fg-muted" />
      <span className="font-medium">{label}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Unpin ${label}`}
        className="ml-1 text-fg-muted hover:text-danger-fg px-0.5"
      >
        <XIcon size={12} />
      </button>
    </li>
  );
}
