'use client';

import Link from 'next/link';
import { useActionState, useEffect } from 'react';
import { ArrowLeftIcon, AlertIcon } from '@primer/octicons-react';
import { createPaper, type CreatePaperState } from '@/lib/actions/papers';
import { PAPER_STAGE_LABELS, PAPER_STAGE_ORDER } from '@/lib/labels';
import type { Member } from '@/lib/types';

export function PaperCreateForm({
  projectSlug,
  projectName,
  projectDescription,
  members,
  onSuccess,
  onCancel,
}: {
  projectSlug: string;
  projectName: string;
  projectDescription: string;
  members: Member[];
  onSuccess?: () => void;
  onCancel?: () => void;
}) {
  const bound = createPaper.bind(null, projectSlug);
  const [state, formAction, pending] = useActionState<CreatePaperState, FormData>(
    bound,
    null,
  );

  const inPanel = Boolean(onSuccess);

  useEffect(() => {
    if (state?.ok && onSuccess) onSuccess();
  }, [state, onSuccess]);

  return (
    <div className={inPanel ? '' : 'max-w-3xl'}>
      {!inPanel && (
        <>
          <Link
            href={`/projects/${projectSlug}/papers`}
            className="inline-flex items-center gap-1 text-sm text-accent-fg hover:underline mb-4"
          >
            <ArrowLeftIcon size={14} /> Back to papers
          </Link>
          <h1 className="text-lg font-semibold mb-1">New paper in {projectName}</h1>
          <p className="text-sm text-fg-muted mb-4">{projectDescription}</p>
        </>
      )}
      <form
        action={formAction}
        className={
          inPanel
            ? 'space-y-4'
            : 'space-y-4 bg-white border border-border-default rounded-md p-6'
        }
      >
        {inPanel && <input type="hidden" name="__noRedirect" value="1" />}
        {state?.error && (
          <div
            role="alert"
            className="flex items-start gap-2 bg-danger-subtle border border-danger-subtle rounded-md p-3 text-sm text-danger-fg"
          >
            <AlertIcon size={16} className="mt-0.5 flex-shrink-0" />
            <span>{state.error}</span>
          </div>
        )}
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="title">Title</label>
          <input
            id="title"
            name="title"
            type="text"
            required
            className="w-full border border-border-default rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-emphasis"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="stage">Stage</label>
            <select
              id="stage"
              name="stage"
              required
              defaultValue="idea"
              className="w-full border border-border-default rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-emphasis"
            >
              {PAPER_STAGE_ORDER.map(s => (
                <option key={s} value={s}>{PAPER_STAGE_LABELS[s]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="venue">Venue</label>
            <input
              id="venue"
              name="venue"
              type="text"
              placeholder="e.g., NeurIPS 2026"
              className="w-full border border-border-default rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-emphasis"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="deadline">Deadline (optional)</label>
          <input
            id="deadline"
            name="deadline"
            type="date"
            className="w-full border border-border-default rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-emphasis"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="authors">
            Authors <span className="text-fg-muted font-normal">(Cmd/Ctrl-click to select multiple)</span>
          </label>
          <select
            id="authors"
            name="authors"
            required
            multiple
            size={Math.min(8, Math.max(members.length, 2))}
            className="w-full border border-border-default rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-emphasis"
          >
            {members.map(m => (
              <option key={m.login} value={m.login}>
                {m.displayName} (@{m.login}) — {m.role}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="draftUrl">Draft URL (optional)</label>
          <input
            id="draftUrl"
            name="draftUrl"
            type="url"
            placeholder="https://…"
            className="w-full border border-border-default rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-emphasis"
          />
        </div>
        <div className="flex items-center gap-2 pt-2">
          <button
            type="submit"
            disabled={pending}
            className="px-3 h-8 rounded-md bg-success-emphasis text-white text-sm font-medium hover:bg-success-fg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {pending ? 'Creating…' : 'Create paper'}
          </button>
          {onCancel ? (
            <button
              type="button"
              onClick={onCancel}
              className="px-3 h-8 inline-flex items-center rounded-md border border-border-default text-sm hover:bg-canvas-subtle"
            >
              Cancel
            </button>
          ) : (
            <Link
              href={`/projects/${projectSlug}/papers`}
              className="px-3 h-8 inline-flex items-center rounded-md border border-border-default text-sm hover:bg-canvas-subtle"
            >
              Cancel
            </Link>
          )}
        </div>
      </form>
    </div>
  );
}
