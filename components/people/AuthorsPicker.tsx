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
import { GrabberIcon, XIcon, PlusIcon } from '@primer/octicons-react';
import { Avatar } from '@/components/people/Avatar';
import type { Member } from '@/lib/types';

/**
 * Ordered picker for paper authors. Authors render as draggable chips with
 * avatar + display name, a grab handle for reorder, and × to remove. A
 * dropdown at the bottom lists remaining members to add. The resulting
 * order is emitted as one hidden <input name="authors"> per selected login,
 * in DOM order, so the server action's formData.getAll('authors') reads
 * them in the user's chosen order.
 */
export function AuthorsPicker({
  allMembers,
  defaultAuthors = [],
  required = false,
}: {
  allMembers: Member[];
  defaultAuthors?: string[];
  /** When true, show an asterisk and rely on the browser/submit-time guard to block empty list. */
  required?: boolean;
}) {
  // Drop any dangling logins so the UI never renders a broken chip.
  const validInitial = defaultAuthors.filter(l => allMembers.some(m => m.login === l));
  const [authors, setAuthors] = useState<string[]>(validInitial);
  const [picker, setPicker] = useState<string>('');

  const loginToMember = useMemo(
    () => new Map(allMembers.map(m => [m.login, m] as const)),
    [allMembers],
  );

  const unselected = useMemo(
    () => allMembers.filter(m => !authors.includes(m.login)),
    [allMembers, authors],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = authors.indexOf(String(active.id));
    const newIndex = authors.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    setAuthors(prev => arrayMove(prev, oldIndex, newIndex));
  }

  function handleAdd() {
    if (!picker || authors.includes(picker)) return;
    if (!loginToMember.has(picker)) return;
    setAuthors(prev => [...prev, picker]);
    setPicker('');
  }

  function handleRemove(login: string) {
    setAuthors(prev => prev.filter(l => l !== login));
  }

  return (
    <div>
      <label className="block text-sm font-medium mb-1">
        Authors {required && <span className="text-danger-fg">*</span>}
      </label>
      <p className="text-xs text-fg-muted mb-2">
        Drag chips to reorder. Order here is preserved on the paper (first author, second author, …).
      </p>

      {/* Hidden inputs drive the form submission in stable author order. */}
      {authors.map(login => (
        <input key={login} type="hidden" name="authors" value={login} />
      ))}

      <div className="bg-canvas-subtle border border-border-default rounded-md p-2 min-h-[52px]">
        {authors.length === 0 ? (
          <p className="text-xs text-fg-muted px-1 py-2">
            No authors yet. Add one below.
          </p>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={authors} strategy={horizontalListSortingStrategy}>
              <ul className="flex flex-wrap gap-1.5">
                {authors.map((login, index) => {
                  const m = loginToMember.get(login);
                  if (!m) return null;
                  return (
                    <SortableAuthorChip
                      key={login}
                      login={login}
                      displayName={m.displayName}
                      position={index + 1}
                      onRemove={() => handleRemove(login)}
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
          disabled={unselected.length === 0}
          className="flex-1 border border-border-default rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent-emphasis disabled:opacity-50"
        >
          <option value="">
            {unselected.length === 0 ? 'All members added' : 'Add an author…'}
          </option>
          {unselected.map(m => (
            <option key={m.login} value={m.login}>
              {m.displayName} (@{m.login}) — {m.role}
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

function SortableAuthorChip({
  login,
  displayName,
  position,
  onRemove,
}: {
  login: string;
  displayName: string;
  position: number;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: login,
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
        aria-label={`Drag ${displayName}`}
        className="text-fg-muted hover:text-fg-default cursor-grab active:cursor-grabbing px-0.5"
      >
        <GrabberIcon size={12} />
      </button>
      <span className="text-fg-muted tabular-nums">{position}.</span>
      <Avatar login={login} size={14} />
      <span className="font-medium">{displayName}</span>
      <span className="text-fg-muted">@{login}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${displayName}`}
        className="ml-1 text-fg-muted hover:text-danger-fg px-0.5"
      >
        <XIcon size={12} />
      </button>
    </li>
  );
}
