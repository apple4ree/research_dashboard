'use client';

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  useTransition,
} from 'react';
import { AlertIcon, TrashIcon } from '@primer/octicons-react';
import type { Milestone, MilestoneStatus } from '@/lib/types';
import {
  createMilestoneAction,
  deleteMilestoneAction,
  updateMilestoneAction,
  type CreateMilestoneState,
} from '@/lib/actions/milestones';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/cn';

const STATUS_LABEL: Record<MilestoneStatus, string> = {
  past: 'Past',
  now: 'Now',
  future: 'Future',
};

const STATUS_TONE: Record<MilestoneStatus, string> = {
  past: 'bg-canvas-inset text-fg-default',
  now: 'bg-accent-emphasis text-white',
  future: 'bg-canvas-inset text-fg-muted',
};

export function TimelinePanel({
  milestones,
  projectSlug,
}: {
  milestones: Milestone[];
  projectSlug: string;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const boundCreate = createMilestoneAction.bind(null, projectSlug);
  const [state, formAction, pending] = useActionState<CreateMilestoneState, FormData>(
    boundCreate,
    null,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const prevPendingRef = useRef(false);

  useEffect(() => {
    if (prevPendingRef.current && !pending && !state?.error) {
      formRef.current?.reset();
      setShowAdd(false);
    }
    prevPendingRef.current = pending;
  }, [pending, state]);

  return (
    <TooltipProvider delayDuration={200}>
      <section
        className="bg-white border border-border-default rounded-md p-6"
        data-testid="timeline-panel"
      >
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
          <InlineTimeline milestones={milestones} projectSlug={projectSlug} />
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
    </TooltipProvider>
  );
}

function monthLabel(iso: string): string {
  return iso.slice(0, 7);
}

function formatFullDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function InlineTimeline({
  milestones,
  projectSlug,
}: {
  milestones: Milestone[];
  projectSlug: string;
}) {
  return (
    <div className="relative">
      <div className="absolute left-0 right-0 top-[7px] h-0.5 bg-border-muted" />
      <div
        className="relative grid gap-2"
        style={{ gridTemplateColumns: `repeat(${milestones.length}, minmax(0, 1fr))` }}
      >
        {milestones.map(m => (
          <MilestoneNode key={m.id} milestone={m} projectSlug={projectSlug} />
        ))}
      </div>
    </div>
  );
}

function MilestoneNode({
  milestone: m,
  projectSlug,
}: {
  milestone: Milestone;
  projectSlug: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative" data-milestone={m.id}>
      <Popover open={open} onOpenChange={setOpen}>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label={`Edit milestone: ${m.label}`}
                className="group w-full text-center cursor-pointer px-1 py-2 -mx-1 -my-2 focus-visible:outline-none"
              >
                <div
                  className={cn(
                    'w-4 h-4 rounded-full mx-auto relative transition-all group-hover:ring-4 group-hover:ring-fg-muted group-focus-visible:ring-4 group-focus-visible:ring-fg-muted',
                    m.status === 'past' && 'bg-fg-default',
                    m.status === 'now' && 'bg-accent-emphasis',
                    m.status === 'future' && 'bg-attention-emphasis',
                  )}
                />
                <div className="mt-3">
                  <div
                    className={cn(
                      'text-xs',
                      m.status === 'now'
                        ? 'font-semibold text-accent-fg'
                        : 'text-fg-muted',
                    )}
                  >
                    {m.status === 'now' ? `NOW · ${monthLabel(m.date)}` : monthLabel(m.date)}
                  </div>
                  <div className="text-sm font-medium text-fg-default mt-0.5 line-clamp-2">
                    {m.label}
                  </div>
                  {m.note && (
                    <div className="text-xs text-fg-muted mt-0.5 line-clamp-1">
                      {m.note}
                    </div>
                  )}
                </div>
              </button>
            </PopoverTrigger>
          </TooltipTrigger>
          {!open && (
            <TooltipContent
              side="top"
              align="center"
              sideOffset={4}
              className="px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
            >
              {STATUS_LABEL[m.status]}
            </TooltipContent>
          )}
        </Tooltip>
        <PopoverContent
          side="bottom"
          align="center"
          className="w-80"
          onOpenAutoFocus={e => e.preventDefault()}
        >
          <MilestoneEditPanel
            milestone={m}
            projectSlug={projectSlug}
            onClose={() => setOpen(false)}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

function MilestoneEditPanel({
  milestone,
  projectSlug,
  onClose,
}: {
  milestone: Milestone;
  projectSlug: string;
  onClose: () => void;
}) {
  const [savingPending, startSaving] = useTransition();
  const [deletingPending, startDeleting] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
    };
  }, []);

  const onSubmit = (formData: FormData) => {
    setError(null);
    startSaving(async () => {
      try {
        await updateMilestoneAction(projectSlug, milestone.id, formData);
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update milestone');
      }
    });
  };

  const onDelete = () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
      confirmTimer.current = setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
    setError(null);
    startDeleting(async () => {
      try {
        await deleteMilestoneAction(projectSlug, milestone.id);
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete milestone');
      }
    });
  };

  return (
    <form
      action={onSubmit}
      data-testid={`edit-milestone-form-${milestone.id}`}
      className="space-y-3"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Edit milestone</h3>
        <span
          className={cn(
            'text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded',
            STATUS_TONE[milestone.status],
          )}
        >
          {STATUS_LABEL[milestone.status]}
        </span>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-1.5 bg-danger-subtle border border-danger-subtle rounded-md p-2 text-xs text-danger-fg"
        >
          <AlertIcon size={12} className="mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-xs text-fg-muted">
          <span>Date</span>
          <input
            type="date"
            name="date"
            required
            defaultValue={milestone.date.slice(0, 10)}
            aria-label="Date"
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
      </div>

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
        <span>Note (optional)</span>
        <input
          type="text"
          name="note"
          defaultValue={milestone.note ?? ''}
          aria-label="Note"
          className="text-xs px-2 py-1 rounded-md border border-border-default focus:outline-none focus:border-accent-emphasis"
        />
      </label>

      <div className="flex items-center gap-2 pt-1">
        <button
          type="submit"
          disabled={savingPending || deletingPending}
          className="text-xs px-3 py-1.5 rounded-md bg-success-emphasis text-white font-medium hover:bg-success-fg disabled:opacity-50"
        >
          {savingPending ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={onClose}
          disabled={savingPending || deletingPending}
          className="text-xs px-3 py-1.5 rounded-md border border-border-default text-fg-muted hover:bg-canvas-subtle disabled:opacity-50"
        >
          Cancel
        </button>
        <div className="flex-1" />
        <button
          type="button"
          onClick={onDelete}
          disabled={savingPending || deletingPending}
          aria-label={confirmDelete ? 'Click again to confirm delete' : 'Delete milestone'}
          className={cn(
            'text-xs px-2 h-7 rounded-md inline-flex items-center gap-1 transition-colors disabled:opacity-50',
            confirmDelete
              ? 'bg-danger-emphasis text-white hover:bg-danger-fg'
              : 'text-danger-fg hover:bg-danger-subtle',
          )}
        >
          <TrashIcon size={12} />
          {confirmDelete ? 'Click again' : 'Delete'}
        </button>
      </div>
    </form>
  );
}
