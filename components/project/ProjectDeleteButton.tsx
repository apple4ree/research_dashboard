'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { TrashIcon } from '@primer/octicons-react';
import { deleteProjectAction } from '@/lib/actions/projects';

export function ProjectDeleteButton({ slug }: { slug: string }) {
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
      await deleteProjectAction(slug);
    });
  };

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={pending}
      className={`inline-flex items-center gap-1 px-3 h-8 rounded-md border text-sm transition-colors disabled:opacity-50 ${
        confirming
          ? 'border-danger-emphasis bg-danger-emphasis text-white hover:bg-danger-fg'
          : 'border-danger-subtle text-danger-fg hover:bg-danger-subtle'
      }`}
    >
      <TrashIcon size={14} />
      {confirming ? 'Click again to confirm' : 'Delete project'}
    </button>
  );
}
