'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { TrashIcon } from '@primer/octicons-react';
import { deleteExperimentAction } from '@/lib/actions/experiments';

export function ExperimentDeleteButton({ slug, id }: { slug: string; id: string }) {
  const [armed, setArmed] = useState(false);
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const onClick = () => {
    if (!armed) {
      setArmed(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setArmed(false), 4000);
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    startTransition(() => deleteExperimentAction(slug, id));
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md border text-xs transition-colors disabled:opacity-50 ${
        armed
          ? 'border-danger-emphasis bg-danger-emphasis text-white'
          : 'border-danger-subtle text-danger-fg hover:bg-danger-subtle'
      }`}
    >
      <TrashIcon size={12} />
      {armed ? '한 번 더' : '삭제'}
    </button>
  );
}
