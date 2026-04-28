'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { ArrowLeftIcon, AlertIcon } from '@primer/octicons-react';
import {
  createExperimentAction,
  updateExperimentAction,
  type ExperimentActionState,
} from '@/lib/actions/experiments';

const STATUSES = ['planned', 'running', 'completed', 'archived'] as const;
const STATUS_LABEL: Record<string, string> = {
  planned: '계획',
  running: '진행 중',
  completed: '완료',
  archived: '보관',
};

type Initial = {
  id: string;
  title: string;
  status: string;
  hypothesis: string;
  bodyMarkdown: string;
};

export function ExperimentForm(
  props:
    | { mode: 'create'; slug: string; sourceWiki?: { entityId: string } }
    | { mode: 'edit'; slug: string; initial: Initial },
) {
  const bound =
    props.mode === 'create'
      ? createExperimentAction.bind(null, props.slug)
      : updateExperimentAction.bind(null, props.slug, props.initial.id);
  const [state, formAction, pending] = useActionState<ExperimentActionState, FormData>(bound, null);

  const initial = props.mode === 'edit' ? props.initial : undefined;
  const backHref =
    props.mode === 'edit'
      ? `/projects/${props.slug}/experiments/${props.initial.id}`
      : `/projects/${props.slug}/experiments`;

  return (
    <div className="max-w-3xl">
      <Link
        href={backHref}
        className="inline-flex items-center gap-1 text-sm text-accent-fg hover:underline mb-4"
      >
        <ArrowLeftIcon size={14} /> Back
      </Link>
      <h1 className="text-lg font-semibold mb-4">
        {props.mode === 'create' ? 'New experiment' : 'Edit experiment'}
      </h1>
      <form action={formAction} className="space-y-4 bg-white border border-border-default rounded-md p-6">
        {state?.error && (
          <div role="alert" className="flex items-start gap-2 bg-danger-subtle border border-danger-subtle rounded-md p-3 text-sm text-danger-fg">
            <AlertIcon size={16} className="mt-0.5 flex-shrink-0" />
            <span>{state.error}</span>
          </div>
        )}
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="title">Title</label>
          <input
            id="title"
            name="title"
            type="text"
            required
            defaultValue={initial?.title ?? ''}
            placeholder="예: trigger ablation v4"
            className="w-full border border-border-default rounded-md px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="status">Status</label>
          <select
            id="status"
            name="status"
            defaultValue={initial?.status ?? 'planned'}
            className="w-full border border-border-default rounded-md px-3 py-2 text-sm"
          >
            {STATUSES.map(s => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]} ({s})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="hypothesis">Hypothesis (선택)</label>
          <textarea
            id="hypothesis"
            name="hypothesis"
            rows={3}
            defaultValue={initial?.hypothesis ?? ''}
            placeholder="이 실험에서 검증하려는 가설을 한두 문단으로"
            className="w-full border border-border-default rounded-md px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="bodyMarkdown">Plan / Notes (markdown)</label>
          <textarea
            id="bodyMarkdown"
            name="bodyMarkdown"
            rows={14}
            defaultValue={initial?.bodyMarkdown ?? ''}
            placeholder="실험 설정, 변수, 진행 메모 등"
            className="w-full border border-border-default rounded-md px-3 py-2 text-sm font-mono"
          />
        </div>
        {props.mode === 'create' && props.sourceWiki && (
          <>
            <input type="hidden" name="sourceWikiSlug" value={props.slug} />
            <input type="hidden" name="sourceWikiEntityId" value={props.sourceWiki.entityId} />
            <p className="text-xs text-fg-muted">
              Wiki 항목 <code>{props.sourceWiki.entityId}</code>에서 복사된 내용입니다.
            </p>
          </>
        )}
        <div className="flex items-center gap-2 pt-2">
          <button
            type="submit"
            disabled={pending}
            className="px-3 h-8 rounded-md bg-success-emphasis text-white text-sm font-medium hover:bg-success-fg disabled:opacity-50"
          >
            {props.mode === 'create' ? (pending ? 'Creating…' : 'Create experiment') : (pending ? 'Saving…' : 'Save changes')}
          </button>
          <Link href={backHref} className="px-3 h-8 inline-flex items-center rounded-md border border-border-default text-sm hover:bg-canvas-subtle">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
