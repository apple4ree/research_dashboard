'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { ArrowLeftIcon, AlertIcon } from '@primer/octicons-react';
import {
  createNoticeAction,
  updateNoticeAction,
  type NoticeActionState,
} from '@/lib/actions/notices';
import {
  NOTICE_CATEGORY_LABELS,
  NOTICE_CATEGORY_ORDER,
  type NoticeCategory,
} from '@/lib/labels';

type Initial = {
  id: string;
  title: string;
  bodyMarkdown: string;
  category: NoticeCategory;
  pinned: boolean;
};

export function NoticeForm(
  props:
    | { mode: 'create' }
    | { mode: 'edit'; initial: Initial },
) {
  const bound =
    props.mode === 'create'
      ? createNoticeAction
      : updateNoticeAction.bind(null, props.initial.id);
  const [state, formAction, pending] = useActionState<NoticeActionState, FormData>(bound, null);

  const initial = props.mode === 'edit' ? props.initial : undefined;
  const backHref = props.mode === 'edit' ? `/notices/${props.initial.id}` : '/notices';

  return (
    <div className="max-w-3xl">
      <Link
        href={backHref}
        className="inline-flex items-center gap-1 text-sm text-accent-fg hover:underline mb-4"
      >
        <ArrowLeftIcon size={14} /> Back
      </Link>
      <h1 className="text-lg font-semibold mb-4">
        {props.mode === 'create' ? 'New notice' : 'Edit notice'}
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
          <label className="block text-sm font-medium mb-1" htmlFor="title">
            Title
          </label>
          <input
            id="title"
            name="title"
            type="text"
            required
            defaultValue={initial?.title ?? ''}
            className="w-full border border-border-default rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-emphasis"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-4 items-end">
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="category">
              Category
            </label>
            <select
              id="category"
              name="category"
              defaultValue={initial?.category ?? 'update'}
              className="w-full border border-border-default rounded-md px-3 py-2 text-sm"
            >
              {NOTICE_CATEGORY_ORDER.map(c => (
                <option key={c} value={c}>
                  {NOTICE_CATEGORY_LABELS[c]} ({c})
                </option>
              ))}
            </select>
          </div>
          <label className="inline-flex items-center gap-2 text-sm pb-2">
            <input
              type="checkbox"
              name="pinned"
              value="1"
              defaultChecked={initial?.pinned ?? false}
              className="h-4 w-4"
            />
            상단 고정
          </label>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="bodyMarkdown">
            Body (markdown)
          </label>
          <textarea
            id="bodyMarkdown"
            name="bodyMarkdown"
            required
            rows={14}
            defaultValue={initial?.bodyMarkdown ?? ''}
            className="w-full border border-border-default rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-accent-emphasis"
          />
        </div>
        <div className="flex items-center gap-2 pt-2">
          <button
            type="submit"
            disabled={pending}
            className="px-3 h-8 rounded-md bg-success-emphasis text-white text-sm font-medium hover:bg-success-fg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {props.mode === 'create'
              ? pending ? 'Posting…' : 'Post notice'
              : pending ? 'Saving…' : 'Save changes'}
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
