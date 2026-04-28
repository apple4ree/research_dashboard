'use client';

import { useTransition } from 'react';
import { BeakerIcon } from '@primer/octicons-react';
import { copyWikiEntityToExperimentAction } from '@/lib/actions/experiments';

export function CopyToExperimentButton({ slug, entityId }: { slug: string; entityId: string }) {
  const [pending, startTransition] = useTransition();

  const onClick = () => {
    startTransition(() => copyWikiEntityToExperimentAction(slug, entityId));
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      title="이 wiki 항목 내용을 새 Experiment로 복사합니다"
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-border-default text-xs text-fg-muted hover:text-accent-fg hover:border-accent-fg transition-colors disabled:opacity-50"
    >
      <BeakerIcon size={12} />
      {pending ? '복사 중…' : 'Experiment로 복사'}
    </button>
  );
}
