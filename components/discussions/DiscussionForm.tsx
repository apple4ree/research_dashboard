'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { ArrowLeftIcon, AlertIcon } from '@primer/octicons-react';
import {
  createDiscussion,
  updateDiscussionAction,
  type CreateDiscussionState,
  type UpdateDiscussionState,
} from '@/lib/actions/discussions';
import {
  DISCUSSION_CATEGORY_LABELS,
  DISCUSSION_CATEGORY_ICONS,
  DISCUSSION_CATEGORY_ORDER,
} from '@/lib/labels';
import type { Discussion } from '@/lib/types';

type FormState = CreateDiscussionState | UpdateDiscussionState;

export function DiscussionForm(
  props:
    | { mode: 'create' }
    | { mode: 'edit'; initial: Discussion },
) {
  const { mode } = props;
  const initial = mode === 'edit' ? props.initial : undefined;

  const bound =
    mode === 'create'
      ? createDiscussion
      : updateDiscussionAction.bind(null, initial!.id);

  const [state, formAction, pending] = useActionState<FormState, FormData>(
    bound,
    null,
  );

  const backHref = mode === 'edit' ? `/discussions/${initial!.id}` : '/discussions';
  const backLabel = mode === 'edit' ? 'Back to discussion' : 'Back to discussions';

  return (
    <div className="max-w-3xl">
      <Link
        href={backHref}
        className="inline-flex items-center gap-1 text-sm text-accent-fg hover:underline mb-4"
      >
        <ArrowLeftIcon size={14} /> {backLabel}
      </Link>
      <h1 className="text-lg font-semibold mb-4">
        {mode === 'create' ? 'New discussion' : 'Edit discussion'}
      </h1>
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
          <label className="block text-sm font-medium mb-1" htmlFor="category">
            Category
          </label>
          <select
            id="category"
            name="category"
            required
            defaultValue={initial?.category ?? 'qa'}
            className="w-full border border-border-default rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-emphasis"
          >
            {DISCUSSION_CATEGORY_ORDER.map(cat => (
              <option key={cat} value={cat}>
                {DISCUSSION_CATEGORY_ICONS[cat]} {DISCUSSION_CATEGORY_LABELS[cat]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="title">
            Title
          </label>
          <input
            id="title"
            name="title"
            type="text"
            required
            defaultValue={initial?.title ?? ''}
            placeholder="What's on your mind?"
            className="w-full border border-border-default rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-emphasis"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="body">
            Body <span className="text-fg-muted font-normal">(Markdown)</span>
          </label>
          <textarea
            id="body"
            name="body"
            required
            rows={8}
            defaultValue={initial?.bodyMarkdown ?? ''}
            placeholder="Write in Markdown…"
            className="w-full border border-border-default rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-accent-emphasis resize-y"
          />
        </div>
        <div className="flex items-center gap-2 pt-2">
          <button
            type="submit"
            disabled={pending}
            className="px-3 h-8 rounded-md bg-success-emphasis text-white text-sm font-medium hover:bg-success-fg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {mode === 'create'
              ? pending
                ? 'Creating…'
                : 'Create discussion'
              : pending
                ? 'Saving…'
                : 'Save changes'}
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
