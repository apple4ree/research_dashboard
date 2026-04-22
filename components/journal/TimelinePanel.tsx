'use client';

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  useTransition,
} from 'react';
import { AlertIcon, PencilIcon, XIcon } from '@primer/octicons-react';
import type { Milestone } from '@/lib/types';
import {
  createMilestoneAction,
  deleteMilestoneAction,
  updateMilestoneAction,
  type CreateMilestoneState,
} from '@/lib/actions/milestones';

export function TimelinePanel({
  milestones,
  projectSlug,
}: {
  milestones: Milestone[];
  projectSlug: string;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const boundCreate = createMilestoneAction.bind(null, projectSlug);
  const [state, formAction, pending] = useActionState<CreateMilestoneState, FormData>(
    boundCreate,
    null,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const prevPendingRef = useRef(false);

  // Reset and hide the form on successful create (pending→idle with no error).
  useEffect(() => {
    if (prevPendingRef.current && !pending && !state?.error) {
      formRef.current?.reset();
      setShowAdd(false);
    }
    prevPendingRef.current = pending;
  }, [pending, state]);

  return (
    <section className="bg-white border border-border-default rounded-md p-6" data-testid="timeline-panel">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold">연구 흐름</h2>
        <button
          type="button"
          onClick={() => setShowAdd(v => !v)}
          className="text-xs px-2.5 py-1 rounded-md border border-border-default text-fg-muted hover:bg-canvas-subtle"
        >
          {showAdd ? '취소' : '+ 마일스톤 추가'}
        </button>
      </div>

      {milestones.length === 0 ? (
        <p className="text-xs text-fg-muted">No milestones yet.</p>
      ) : (
        <InlineTimeline
          milestones={milestones}
          projectSlug={projectSlug}
          editingId={editingId}
          setEditingId={setEditingId}
        />
      )}

      {showAdd && (
        <form
          ref={formRef}
          action={formAction}
          className="mt-5 grid grid-cols-1 md:grid-cols-6 gap-2 items-end border-t border-border-muted pt-4"
          data-testid="add-milestone-form"
        >
          {state?.error && (
            <div
              role="alert"
              className="col-span-full flex items-start gap-2 bg-danger-subtle border border-danger-subtle rounded-md p-2 text-xs text-danger-fg"
            >
              <AlertIcon size={14} className="mt-0.5 flex-shrink-0" />
              <span>{state.error}</span>
            </div>
          )}
          <label className="col-span-1 flex flex-col gap-1 text-xs text-fg-muted">
            <span>Date</span>
            <input
              type="date"
              name="date"
              required
              aria-label="Date"
              className="text-xs px-2 py-1 rounded-md border border-border-default focus:outline-none focus:border-accent-emphasis"
            />
          </label>
          <label className="col-span-2 flex flex-col gap-1 text-xs text-fg-muted">
            <span>Label</span>
            <input
              type="text"
              name="label"
              required
              aria-label="Label"
              placeholder="milestone label"
              className="text-xs px-2 py-1 rounded-md border border-border-default focus:outline-none focus:border-accent-emphasis"
            />
          </label>
          <label className="col-span-1 flex flex-col gap-1 text-xs text-fg-muted">
            <span>Status</span>
            <select
              name="status"
              required
              defaultValue="future"
              aria-label="Status"
              className="text-xs px-2 py-1 rounded-md border border-border-default focus:outline-none focus:border-accent-emphasis"
            >
              <option value="past">past</option>
              <option value="now">now</option>
              <option value="future">future</option>
            </select>
          </label>
          <label className="col-span-1 flex flex-col gap-1 text-xs text-fg-muted">
            <span>Position</span>
            <input
              type="number"
              name="position"
              min={0}
              placeholder="(end)"
              aria-label="Position"
              className="text-xs px-2 py-1 rounded-md border border-border-default focus:outline-none focus:border-accent-emphasis"
            />
          </label>
          <label className="col-span-1 md:col-span-5 flex flex-col gap-1 text-xs text-fg-muted">
            <span>Note (optional)</span>
            <input
              type="text"
              name="note"
              aria-label="Note"
              placeholder="short note"
              className="text-xs px-2 py-1 rounded-md border border-border-default focus:outline-none focus:border-accent-emphasis"
            />
          </label>
          <div className="col-span-1 flex justify-end">
            <button
              type="submit"
              disabled={pending}
              className="text-xs px-3 py-1.5 rounded-md bg-fg-default text-white disabled:opacity-50"
            >
              {pending ? '...' : '추가'}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

function monthLabel(iso: string): string {
  return iso.slice(0, 7);
}

function InlineTimeline({
  milestones,
  projectSlug,
  editingId,
  setEditingId,
}: {
  milestones: Milestone[];
  projectSlug: string;
  editingId: number | null;
  setEditingId: (id: number | null) => void;
}) {
  const [pending, startTransition] = useTransition();

  const onDelete = (id: number) => {
    startTransition(async () => {
      await deleteMilestoneAction(projectSlug, id);
    });
  };

  return (
    <div className="relative">
      <div className="absolute left-0 right-0 top-[7px] h-0.5 bg-border-muted" />
      <div
        className="relative grid gap-2"
        style={{ gridTemplateColumns: `repeat(${milestones.length}, minmax(0, 1fr))` }}
      >
        {milestones.map(m => (
          <div key={m.id} className="group relative" data-milestone={m.id}>
            <div className="absolute top-0 right-0 z-10 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                type="button"
                onClick={() => setEditingId(editingId === m.id ? null : m.id)}
                aria-label="Edit milestone"
                className="text-fg-muted hover:text-accent-fg"
              >
                <PencilIcon size={12} />
              </button>
              <button
                type="button"
                onClick={() => onDelete(m.id)}
                disabled={pending}
                aria-label="Delete milestone"
                className="text-fg-muted hover:text-danger-fg disabled:opacity-30"
              >
                <XIcon size={12} />
              </button>
            </div>
            <div
              className={
                'w-4 h-4 rounded-full mx-auto relative ' +
                (m.status === 'past'
                  ? 'bg-fg-default'
                  : m.status === 'now'
                    ? 'bg-accent-emphasis ring-4 ring-accent-subtle'
                    : 'bg-border-default')
              }
            />
            <div className="mt-3 text-center">
              <div
                className={
                  'text-xs ' +
                  (m.status === 'now' ? 'font-semibold text-accent-fg' : 'text-fg-muted')
                }
              >
                {m.status === 'now' ? `NOW · ${monthLabel(m.date)}` : monthLabel(m.date)}
              </div>
              <div className="text-sm font-medium text-fg-default mt-0.5">{m.label}</div>
              {m.note && <div className="text-xs text-fg-muted mt-0.5">{m.note}</div>}
            </div>
            {editingId === m.id && (
              <MilestoneEditForm
                milestone={m}
                projectSlug={projectSlug}
                onDone={() => setEditingId(null)}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function MilestoneEditForm({
  milestone,
  projectSlug,
  onDone,
}: {
  milestone: Milestone;
  projectSlug: string;
  onDone: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onSubmit = (formData: FormData) => {
    setError(null);
    startTransition(async () => {
      try {
        await updateMilestoneAction(projectSlug, milestone.id, formData);
        onDone();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update milestone');
      }
    });
  };

  const dateDefault = milestone.date.slice(0, 10);

  return (
    <form
      action={onSubmit}
      data-testid={`edit-milestone-form-${milestone.id}`}
      className="mt-3 col-span-full text-left space-y-2 bg-canvas-subtle border border-border-muted rounded-md p-3"
      onClick={e => e.stopPropagation()}
    >
      {error && (
        <div
          role="alert"
          className="flex items-start gap-1.5 bg-danger-subtle border border-danger-subtle rounded-md p-2 text-xs text-danger-fg"
        >
          <AlertIcon size={12} className="mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
      <label className="flex flex-col gap-1 text-xs text-fg-muted">
        <span>Date</span>
        <input
          type="date"
          name="date"
          required
          defaultValue={dateDefault}
          aria-label="Date"
          className="text-xs px-2 py-1 rounded-md border border-border-default focus:outline-none focus:border-accent-emphasis"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-fg-muted">
        <span>Label</span>
        <input
          type="text"
          name="label"
          required
          defaultValue={milestone.label}
          aria-label="Label"
          className="text-xs px-2 py-1 rounded-md border border-border-default focus:outline-none focus:border-accent-emphasis"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-fg-muted">
        <span>Status</span>
        <select
          name="status"
          required
          defaultValue={milestone.status}
          aria-label="Status"
          className="text-xs px-2 py-1 rounded-md border border-border-default focus:outline-none focus:border-accent-emphasis"
        >
          <option value="past">past</option>
          <option value="now">now</option>
          <option value="future">future</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-fg-muted">
        <span>Note (optional)</span>
        <input
          type="text"
          name="note"
          defaultValue={milestone.note ?? ''}
          aria-label="Note"
          className="text-xs px-2 py-1 rounded-md border border-border-default focus:outline-none focus:border-accent-emphasis"
        />
      </label>
      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={isPending}
          className="text-xs px-3 py-1.5 rounded-md bg-success-emphasis text-white disabled:opacity-50"
        >
          {isPending ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="text-xs px-3 py-1.5 rounded-md border border-border-default text-fg-muted hover:bg-white"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
