'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { ArrowLeftIcon, AlertIcon } from '@primer/octicons-react';
import {
  updateRunAction,
  type UpdateRunState,
} from '@/lib/actions/runs';
import type { ExperimentRun } from '@/lib/types';

export function RunEditForm({ run, projectSlug }: { run: ExperimentRun; projectSlug?: string }) {
  const slug = projectSlug ?? run.projectSlug;
  const backHref = `/projects/${slug}/experiments/${run.id}`;
  const bound = updateRunAction.bind(null, run.id);
  const [state, formAction, pending] = useActionState<UpdateRunState, FormData>(
    bound,
    null,
  );

  return (
    <div className="max-w-2xl">
      <Link
        href={backHref}
        className="inline-flex items-center gap-1 text-sm text-accent-fg hover:underline mb-4"
      >
        <ArrowLeftIcon size={14} /> Back to run
      </Link>
      <h1 className="text-lg font-semibold mb-4">Edit run</h1>
      <form
        action={formAction}
        className="space-y-4 bg-white border border-border-default rounded-md p-6"
      >
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
            defaultValue={run.name}
            className="w-full border border-border-default rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-emphasis"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="summary">
            Summary
          </label>
          <textarea
            id="summary"
            name="summary"
            rows={4}
            defaultValue={run.summary ?? ''}
            className="w-full border border-border-default rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-emphasis resize-y"
          />
        </div>
        <div className="flex items-center gap-2 pt-2">
          <button
            type="submit"
            disabled={pending}
            className="px-3 h-8 rounded-md bg-success-emphasis text-white text-sm font-medium hover:bg-success-fg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {pending ? 'Saving…' : 'Save changes'}
          </button>
          <Link
            href={backHref}
            className="px-3 h-8 inline-flex items-center rounded-md border border-border-default text-sm hover:bg-canvas-subtle"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
