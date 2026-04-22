'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { ArrowLeftIcon, AlertIcon } from '@primer/octicons-react';
import { createProject, type CreateProjectState } from '@/lib/actions/projects';

export default function NewProjectPage() {
  const [state, formAction, pending] = useActionState<CreateProjectState, FormData>(createProject, null);

  return (
    <div className="max-w-2xl">
      <Link href="/projects" className="inline-flex items-center gap-1 text-sm text-accent-fg hover:underline mb-4">
        <ArrowLeftIcon size={14} /> Back to projects
      </Link>
      <h1 className="text-lg font-semibold mb-4">New project</h1>
      <form action={formAction} className="space-y-4 bg-white border border-border-default rounded-md p-6">
        {state?.error && (
          <div role="alert" className="flex items-start gap-2 bg-danger-subtle border border-danger-subtle rounded-md p-3 text-sm text-danger-fg">
            <AlertIcon size={16} className="mt-0.5 flex-shrink-0" />
            <span>{state.error}</span>
          </div>
        )}
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="name">Name</label>
          <input
            id="name"
            name="name"
            type="text"
            required
            placeholder="예: 추론 벤치마크 v3 or reasoning-bench-v3"
            className="w-full border border-border-default rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-emphasis"
          />
          <p className="text-xs text-fg-muted mt-1">Display name (any language).</p>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="slug">
            Slug <span className="text-fg-muted font-normal">(URL identifier)</span>
          </label>
          <input
            id="slug"
            name="slug"
            type="text"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            pattern="[a-z0-9]([a-z0-9-]*[a-z0-9])?"
            title="Lowercase English letters (a-z), digits (0-9), and hyphens. Cannot start or end with a hyphen."
            placeholder="reasoning-bench-v3"
            className="w-full border border-border-default rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-accent-emphasis"
          />
          <p className="text-xs text-fg-muted mt-1">
            Lowercase English letters, digits, hyphens only. URL becomes <code>/projects/&lt;slug&gt;</code>. Required if Name contains non-ASCII characters.
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="description">Description</label>
          <textarea
            id="description"
            name="description"
            required
            rows={3}
            placeholder="One-line summary of the project"
            className="w-full border border-border-default rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-emphasis resize-y"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="tags">Tags</label>
          <input
            id="tags"
            name="tags"
            type="text"
            placeholder="LLM, benchmark, reasoning (comma-separated)"
            className="w-full border border-border-default rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-emphasis"
          />
        </div>
        <div className="flex items-center gap-2">
          <input id="pinned" name="pinned" type="checkbox" className="accent-accent-emphasis" />
          <label htmlFor="pinned" className="text-sm">Pin on dashboard</label>
        </div>
        <div className="flex items-center gap-2 pt-2">
          <button
            type="submit"
            disabled={pending}
            className="px-3 h-8 rounded-md bg-success-emphasis text-white text-sm font-medium hover:bg-success-fg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {pending ? 'Creating…' : 'Create project'}
          </button>
          <Link
            href="/projects"
            className="px-3 h-8 inline-flex items-center rounded-md border border-border-default text-sm hover:bg-canvas-subtle"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
