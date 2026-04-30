'use client';

import Link from 'next/link';
import { useActionState, useEffect } from 'react';
import { ArrowLeftIcon, AlertIcon } from '@primer/octicons-react';
import {
  createReleaseAction,
  updateReleaseAction,
  type CreateReleaseState,
  type UpdateReleaseState,
} from '@/lib/actions/releases';
import type { Release, ReleaseKind } from '@/lib/types';

const KIND_OPTIONS: { value: ReleaseKind; label: string }[] = [
  { value: 'dataset', label: 'Dataset' },
  { value: 'tool', label: 'Tool' },
  { value: 'skill', label: 'Skill' },
  { value: 'model', label: 'Model' },
];

type FormState = CreateReleaseState | UpdateReleaseState;

export function ReleaseForm(
  props:
    | {
        mode: 'create';
        projectSlug: string;
        onSuccess?: () => void;
        onCancel?: () => void;
      }
    | {
        mode: 'edit';
        projectSlug: string;
        initial: Release;
        onSuccess?: () => void;
        onCancel?: () => void;
      },
) {
  const { mode, projectSlug, onSuccess, onCancel } = props;
  const initial = mode === 'edit' ? props.initial : undefined;

  const bound =
    mode === 'create'
      ? createReleaseAction.bind(null, projectSlug)
      : updateReleaseAction.bind(null, initial!.id);

  const [state, formAction, pending] = useActionState<FormState, FormData>(
    bound,
    null,
  );

  const publishedDefault = initial?.publishedAt
    ? initial.publishedAt.slice(0, 10)
    : '';

  const inPanel = Boolean(onSuccess);

  useEffect(() => {
    if (state?.ok && onSuccess) onSuccess();
  }, [state, onSuccess]);

  return (
    <div className={inPanel ? '' : 'max-w-3xl'}>
      {!inPanel && (
        <>
          <Link
            href={`/projects/${projectSlug}/results`}
            className="inline-flex items-center gap-1 text-sm text-accent-fg hover:underline mb-4"
          >
            <ArrowLeftIcon size={14} /> Back to results
          </Link>
          <h1 className="text-lg font-semibold mb-4">
            {mode === 'create' ? 'New release' : 'Edit release'}
          </h1>
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
            defaultValue={initial?.name ?? ''}
            className="w-full border border-border-default rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-emphasis"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="kind">
              Kind
            </label>
            <select
              id="kind"
              name="kind"
              required
              defaultValue={initial?.kind ?? 'dataset'}
              className="w-full border border-border-default rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-emphasis"
            >
              {KIND_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="version">
              Version
            </label>
            <input
              id="version"
              name="version"
              type="text"
              required
              placeholder="e.g., v1.2.0"
              defaultValue={initial?.version ?? ''}
              className="w-full border border-border-default rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-emphasis"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="publishedAt">
            Published date
          </label>
          <input
            id="publishedAt"
            name="publishedAt"
            type="date"
            required
            defaultValue={publishedDefault}
            className="w-full border border-border-default rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-emphasis"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="description">
            Description
          </label>
          <textarea
            id="description"
            name="description"
            rows={4}
            defaultValue={initial?.description ?? ''}
            className="w-full border border-border-default rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-emphasis"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="downloadUrl">
            Download URL (optional)
          </label>
          <input
            id="downloadUrl"
            name="downloadUrl"
            type="url"
            placeholder="https://…"
            defaultValue={initial?.downloadUrl ?? ''}
            className="w-full border border-border-default rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-emphasis"
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
                : 'Create release'
              : pending
                ? 'Saving…'
                : 'Save changes'}
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
              href={`/projects/${projectSlug}/results`}
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
