'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { ArrowLeftIcon, AlertIcon } from '@primer/octicons-react';
import {
  updateProjectAction,
  type UpdateProjectState,
} from '@/lib/actions/projects';
import type { Project } from '@/lib/types';
import { ProjectDeleteButton } from '@/components/project/ProjectDeleteButton';

export function ProjectEditForm({ project }: { project: Project }) {
  const bound = updateProjectAction.bind(null, project.slug);
  const [state, formAction, pending] = useActionState<UpdateProjectState, FormData>(
    bound,
    null,
  );

  return (
    <div className="max-w-2xl">
      <Link
        href={`/projects/${project.slug}`}
        className="inline-flex items-center gap-1 text-sm text-accent-fg hover:underline mb-4"
      >
        <ArrowLeftIcon size={14} /> Back to project
      </Link>
      <h1 className="text-lg font-semibold mb-4">Edit project</h1>
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
            defaultValue={project.name}
            className="w-full border border-border-default rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-emphasis"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="slug">
            Slug{' '}
            <span className="text-fg-muted font-normal">(read-only)</span>
          </label>
          <input
            id="slug"
            type="text"
            value={project.slug}
            disabled
            readOnly
            className="w-full border border-border-default rounded-md px-3 py-2 text-sm font-mono bg-canvas-subtle text-fg-muted cursor-not-allowed"
          />
          <p className="text-xs text-fg-muted mt-1">
            Slug is the permanent URL identifier and cannot be changed after creation.
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="description">
            Description
          </label>
          <textarea
            id="description"
            name="description"
            required
            rows={3}
            defaultValue={project.description}
            className="w-full border border-border-default rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-emphasis resize-y"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="tags">
            Tags
          </label>
          <input
            id="tags"
            name="tags"
            type="text"
            defaultValue={project.tags.join(', ')}
            placeholder="LLM, benchmark, reasoning (comma-separated)"
            className="w-full border border-border-default rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-emphasis"
          />
        </div>
        <div className="flex items-center gap-2">
          <input
            id="pinned"
            name="pinned"
            type="checkbox"
            defaultChecked={project.pinned}
            className="accent-accent-emphasis"
          />
          <label htmlFor="pinned" className="text-sm">
            Pin on dashboard
          </label>
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
            href={`/projects/${project.slug}`}
            className="px-3 h-8 inline-flex items-center rounded-md border border-border-default text-sm hover:bg-canvas-subtle"
          >
            Cancel
          </Link>
        </div>
      </form>

      <section className="mt-8 border-t border-danger-subtle pt-6">
        <h2 className="text-sm font-semibold text-danger-fg mb-2">Danger zone</h2>
        <p className="text-xs text-fg-muted mb-3">
          Deleting this project also removes all its papers, releases, experiment runs, events, journal entries, milestones, and todos. This cannot be undone.
        </p>
        <ProjectDeleteButton slug={project.slug} />
      </section>
    </div>
  );
}
