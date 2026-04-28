'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { ArrowLeftIcon, AlertIcon, PlusIcon, XIcon } from '@primer/octicons-react';
import {
  createResultAction,
  updateResultAction,
  type ExperimentActionState,
} from '@/lib/actions/experiments';

const KINDS = ['benchmark', 'checkpoint', 'figure-bundle', 'report', 'tool'] as const;
const KIND_LABEL: Record<string, string> = {
  benchmark: 'Benchmark (정량 결과)',
  checkpoint: 'Checkpoint (모델 가중치)',
  'figure-bundle': 'Figures (그림 모음)',
  report: 'Report (서술형 결과)',
  tool: 'Tool (산출물)',
};

type Initial = {
  id: string;
  title: string;
  summary: string;
  kind: string;
  metrics: { label: string; value: string }[];
};

export function ResultForm(
  props:
    | { mode: 'create'; slug: string; experimentId: string }
    | { mode: 'edit'; slug: string; experimentId: string; initial: Initial },
) {
  const initial = props.mode === 'edit' ? props.initial : undefined;
  const bound =
    props.mode === 'create'
      ? createResultAction.bind(null, props.slug, props.experimentId)
      : updateResultAction.bind(null, props.slug, props.initial.id);
  const [state, formAction, pending] = useActionState<ExperimentActionState, FormData>(bound, null);

  const [metrics, setMetrics] = useState<{ label: string; value: string }[]>(
    initial?.metrics ?? [{ label: '', value: '' }],
  );

  const addMetric = () => setMetrics(prev => [...prev, { label: '', value: '' }]);
  const removeMetric = (i: number) => setMetrics(prev => prev.filter((_, idx) => idx !== i));
  const updateMetric = (i: number, patch: Partial<{ label: string; value: string }>) =>
    setMetrics(prev => prev.map((m, idx) => (idx === i ? { ...m, ...patch } : m)));

  const metricsJson = JSON.stringify(metrics.filter(m => m.label.trim()));

  const backHref = `/projects/${props.slug}/experiments/${props.experimentId}`;

  return (
    <div className="max-w-3xl">
      <Link href={backHref} className="inline-flex items-center gap-1 text-sm text-accent-fg hover:underline mb-4">
        <ArrowLeftIcon size={14} /> Back to experiment
      </Link>
      <h1 className="text-lg font-semibold mb-4">
        {props.mode === 'create' ? 'New result' : 'Edit result'}
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
            placeholder="예: v4 fresh @ iter25 — trigger×MELON 0.305"
            className="w-full border border-border-default rounded-md px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="kind">Kind</label>
          <select
            id="kind"
            name="kind"
            defaultValue={initial?.kind ?? 'benchmark'}
            className="w-full border border-border-default rounded-md px-3 py-2 text-sm"
          >
            {KINDS.map(k => (
              <option key={k} value={k}>{KIND_LABEL[k]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="summary">Summary (markdown, 선택)</label>
          <textarea
            id="summary"
            name="summary"
            rows={4}
            defaultValue={initial?.summary ?? ''}
            placeholder="간단한 결과 요약"
            className="w-full border border-border-default rounded-md px-3 py-2 text-sm"
          />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-sm font-medium">Metrics</label>
            <button
              type="button"
              onClick={addMetric}
              className="inline-flex items-center gap-1 text-xs px-2 h-7 rounded-md border border-border-default hover:bg-canvas-subtle"
            >
              <PlusIcon size={12} /> Add metric
            </button>
          </div>
          <div className="space-y-2">
            {metrics.map((m, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="text"
                  value={m.label}
                  onChange={e => updateMetric(i, { label: e.target.value })}
                  placeholder="label (예: trigger×MELON)"
                  className="flex-1 text-sm border border-border-default rounded px-2 py-1 font-mono"
                />
                <input
                  type="text"
                  value={m.value}
                  onChange={e => updateMetric(i, { value: e.target.value })}
                  placeholder="value (예: 0.305)"
                  className="flex-1 text-sm border border-border-default rounded px-2 py-1 font-mono"
                />
                <button
                  type="button"
                  onClick={() => removeMetric(i)}
                  className="text-fg-muted hover:text-danger-fg p-1"
                  aria-label="Remove metric"
                >
                  <XIcon size={14} />
                </button>
              </div>
            ))}
          </div>
          <p className="text-xs text-fg-muted mt-1">label이 비어있는 줄은 저장되지 않습니다.</p>
        </div>
        <input type="hidden" name="metricsJson" value={metricsJson} />
        <div className="flex items-center gap-2 pt-2">
          <button
            type="submit"
            disabled={pending}
            className="px-3 h-8 rounded-md bg-success-emphasis text-white text-sm font-medium hover:bg-success-fg disabled:opacity-50"
          >
            {props.mode === 'create' ? (pending ? 'Saving…' : 'Save result') : (pending ? 'Saving…' : 'Save changes')}
          </button>
          <Link href={backHref} className="px-3 h-8 inline-flex items-center rounded-md border border-border-default text-sm hover:bg-canvas-subtle">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
