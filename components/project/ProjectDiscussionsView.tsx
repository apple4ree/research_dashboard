'use client';

import { useState } from 'react';
import { PlusIcon } from '@primer/octicons-react';
import { useRouter } from 'next/navigation';
import { SlideOver } from '@/components/ui/slide-over';
import { DiscussionRow } from '@/components/discussions/DiscussionRow';
import { DiscussionForm } from '@/components/discussions/DiscussionForm';
import { EmptyState } from '@/components/misc/EmptyState';
import type { Discussion, Project } from '@/lib/types';

export function ProjectDiscussionsView({
  projectSlug,
  discussions,
  projects,
  now,
}: {
  projectSlug: string;
  discussions: Discussion[];
  projects: Project[];
  now: number;
}) {
  const [creating, setCreating] = useState(false);
  const router = useRouter();

  function close() {
    setCreating(false);
  }
  function onFormSuccess() {
    close();
    router.refresh();
  }

  const newButton = (
    <div className="mb-3 flex justify-end">
      <button
        type="button"
        onClick={() => setCreating(true)}
        className="px-3 h-8 inline-flex items-center gap-1 rounded-md border border-border-default text-sm hover:bg-canvas-subtle"
      >
        <PlusIcon size={14} /> New discussion
      </button>
    </div>
  );

  return (
    <div>
      {newButton}
      {discussions.length === 0 ? (
        <EmptyState
          title="No discussions yet"
          body="Announcements, journal club notes, Q&A, and ideas scoped to this project will appear here."
        />
      ) : (
        <ul className="bg-white border border-border-default rounded-md">
          {discussions.map(d => (
            <DiscussionRow key={d.id} discussion={d} now={now} hideProject />
          ))}
        </ul>
      )}

      <SlideOver
        open={creating}
        onOpenChange={o => !o && close()}
        title="New discussion"
        widthClass="max-w-2xl"
      >
        {creating && (
          <DiscussionForm
            mode="create"
            projects={projects}
            scopedProjectSlug={projectSlug}
            onSuccess={onFormSuccess}
            onCancel={close}
          />
        )}
      </SlideOver>
    </div>
  );
}
