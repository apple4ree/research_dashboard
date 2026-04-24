'use client';

import Link from 'next/link';
import { useActionState, useEffect } from 'react';
import { ArrowLeftIcon, AlertIcon } from '@primer/octicons-react';
import {
  createRunAction,
  type CreateRunState,
} from '@/lib/actions/runs';
import type { Project, Member, RunStatus } from '@/lib/types';

const STATUS_OPTIONS: { value: RunStatus; label: string }[] = [
  { value: 'queued', label: 'Queued' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'success', label: 'Success' },
  { value: 'failure', label: 'Failure' },
  { value: 'cancelled', label: 'Cancelled' },
];

function nowLocalInput(): string {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

export function RunCreateForm({
  projects,
  members,
  defaultProjectSlug,
  scopedProjectSlug,
  onSuccess,
  onCancel,
}: {
  projects: Project[];
  members: Member[];
  defaultProjectSlug?: string;
  scopedProjectSlug?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}) {
  const [state, formAction, pending] = useActionState<CreateRunState, FormData>(
    createRunAction,
    null,
  );
  const scopedProject = scopedProjectSlug
    ? projects.find(p => p.slug === scopedProjectSlug)
    : undefined;
  const backHref = scopedProjectSlug
    ? `/projects/${scopedProjectSlug}/experiments`
    : '/experiments';
  const backLabel = scopedProject
    ? `Back to ${scopedProject.name} experiments`
    : 'Back to experiments';

  const inPanel = Boolean(onSuccess);

  useEffect(() => {
    if (state?.ok && onSuccess) onSuccess();
  }, [state, onSuccess]);

  return (
    <div className={inPanel ? '' : 'max-w-3xl'}>
      {!inPanel && (
        <>
          <Link
            href={backHref}
            className="inline-flex items-center gap-1 text-sm text-accent-fg hover:underline mb-4"
          >
            <ArrowLeftIcon size={14} /> {backLabel}
          </Link>
          <h1 className="text-lg font-semibold mb-4">New run</h1>
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
          <label className="block text-sm font-medium mb-1" htmlFor="name">
            Name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            placeholder="e.g., eval sweep v2"
            className="w-full border border-border-default rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-emphasis"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="projectSlug">
              Project
            </label>
            {scopedProjectSlug ? (
              <>
                <input type="hidden" name="projectSlug" value={scopedProjectSlug} />
                <div className="w-full border border-border-default rounded-md px-3 py-2 text-sm bg-canvas-subtle text-fg-muted">
                  {scopedProject?.name ?? scopedProjectSlug}
                </div>
              </>
            ) : (
              <select
                id="projectSlug"
                name="projectSlug"
                required
                defaultValue={defaultProjectSlug ?? projects[0]?.slug ?? ''}
                className="w-full border border-border-default rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-emphasis"
              >
                {projects.map(p => (
                  <option key={p.slug} value={p.slug}>
                    {p.name}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="status">
              Status
            </label>
            <select
              id="status"
              name="status"
              required
              defaultValue="success"
              className="w-full border border-border-default rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-emphasis"
            >
              {STATUS_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="triggeredByLogin">
              Triggered by
            </label>
            <select
              id="triggeredByLogin"
              name="triggeredByLogin"
              required
              defaultValue={members[0]?.login ?? ''}
              className="w-full border border-border-default rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-emphasis"
            >
              {members.map(m => (
                <option key={m.login} value={m.login}>
                  {m.displayName} (@{m.login})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="startedAt">
              Started at
            </label>
            <input
              id="startedAt"
              name="startedAt"
              type="datetime-local"
              required
              defaultValue={nowLocalInput()}
              className="w-full border border-border-default rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-emphasis"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="durationSec">
            Duration (seconds, optional)
          </label>
          <input
            id="durationSec"
            name="durationSec"
            type="number"
            min={0}
            placeholder="3600"
            className="w-full border border-border-default rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-emphasis"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="summary">
            Summary (optional)
          </label>
          <textarea
            id="summary"
            name="summary"
            rows={4}
            placeholder="What did this run do? Results?"
            className="w-full border border-border-default rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-emphasis resize-y"
          />
        </div>
        <div className="flex items-center gap-2 pt-2">
          <button
            type="submit"
            disabled={pending}
            className="px-3 h-8 rounded-md bg-success-emphasis text-white text-sm font-medium hover:bg-success-fg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {pending ? 'Creating…' : 'Create run'}
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
              href={backHref}
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
