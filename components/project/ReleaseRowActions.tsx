'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { PencilIcon, TrashIcon } from '@primer/octicons-react';
import { deleteReleaseAction } from '@/lib/actions/releases';

export function ReleaseRowActions({
  projectSlug,
  releaseId,
}: {
  projectSlug: string;
  releaseId: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const handleDelete = () => {
    if (!confirming) {
      setConfirming(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setConfirming(false), 3000);
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    startTransition(async () => {
      await deleteReleaseAction(releaseId);
    });
  };

  return (
    <div className="flex items-center gap-1 text-xs">
      <Link
        href={`/projects/${projectSlug}/data/${releaseId}/edit`}
        aria-label="Edit release"
        className="inline-flex items-center gap-1 px-2 h-7 border border-border-default rounded-md bg-canvas-subtle hover:bg-canvas-inset"
      >
        <PencilIcon size={14} />
      </Link>
      <button
        type="button"
        onClick={handleDelete}
        disabled={pending}
        aria-label={confirming ? 'Click again to confirm' : 'Delete release'}
        className={`inline-flex items-center gap-1 px-2 h-7 border rounded-md transition-colors disabled:opacity-50 ${
          confirming
            ? 'border-danger-emphasis bg-danger-emphasis text-white hover:bg-danger-fg'
            : 'border-border-default bg-canvas-subtle hover:bg-canvas-inset'
        }`}
      >
        <TrashIcon size={14} />
        {confirming && <span className="ml-1">Click again</span>}
      </button>
    </div>
  );
}
