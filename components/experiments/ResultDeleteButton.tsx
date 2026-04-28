'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { TrashIcon } from '@primer/octicons-react';
import { deleteResultAction } from '@/lib/actions/experiments';

export function ResultDeleteButton({ slug, resultId }: { slug: string; resultId: string }) {
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
    startTransition(() => deleteResultAction(slug, resultId));
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      title={armed ? '한 번 더 클릭하면 삭제' : '결과 삭제'}
      className={`transition-colors disabled:opacity-50 ${
        armed ? 'text-danger-emphasis' : 'hover:text-danger-fg'
      }`}
    >
      <TrashIcon size={12} />
    </button>
  );
}
