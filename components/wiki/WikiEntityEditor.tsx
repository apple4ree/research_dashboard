'use client';

import { useState, useEffect, useRef, useTransition } from 'react';
import Link from 'next/link';
import { TrashIcon } from '@primer/octicons-react';
import { MarkdownBody } from '@/components/md/MarkdownBody';
import { LabelChip } from '@/components/badges/LabelChip';
import { statusTone } from '@/lib/wiki-status';
import {
  createWikiEntityAction,
  updateWikiEntityAction,
  deleteWikiEntityAction,
} from '@/lib/actions/wiki';

type WikiType = { key: string; label: string };

export function WikiEntityEditor({
  slug,
  entity,
  types,
  entityIds,
  mode = 'edit',
}: {
  slug: string;
  entity: {
    id: string;
    type: string;
    name: string;
    status: string;
    summaryMarkdown: string;
    bodyMarkdown: string;
  };
  types: WikiType[];
  entityIds: string[];
  mode?: 'edit' | 'create';
}) {
  const [id, setId] = useState(entity.id);
  const [name, setName] = useState(entity.name);
  const [type, setType] = useState(entity.type || types[0]?.key || '');
  const [status, setStatus] = useState(entity.status || 'active');
  const [summary, setSummary] = useState(entity.summaryMarkdown);
  const [body, setBody] = useState(entity.bodyMarkdown);

  const isCreate = mode === 'create';
  const detailHref = isCreate
    ? `/projects/${slug}/wiki`
    : `/projects/${slug}/wiki/${encodeURIComponent(entity.id)}`;
  const indexHref = `/projects/${slug}/wiki`;
  const action = isCreate ? createWikiEntityAction : updateWikiEntityAction;

  return (
    <form
      action={action}
      className="grid grid-cols-1 lg:grid-cols-2 gap-6"
    >
      <input type="hidden" name="projectSlug" value={slug} />
      {!isCreate && <input type="hidden" name="id" value={entity.id} />}
      {!isCreate && <input type="hidden" name="redirectTo" value={detailHref} />}

      <div className="space-y-4">
        {isCreate && (
          <div>
            <label className="block text-[11px] uppercase tracking-wider text-fg-muted font-semibold mb-1">
              ID <span className="text-fg-muted normal-case font-normal">(영소문자/숫자/<code>_</code>/<code>-</code>, 예: <code>my_concept</code>)</span>
            </label>
            <input
              name="id"
              value={id}
              onChange={e => setId(e.target.value)}
              required
              pattern="[a-z0-9_-]+"
              placeholder="slug-style-id"
              className="w-full bg-white border border-border-default rounded px-3 py-2 text-sm font-mono"
            />
          </div>
        )}
        <div>
          <label className="block text-[11px] uppercase tracking-wider text-fg-muted font-semibold mb-1">
            Name
          </label>
          <input
            name="name"
            value={name}
            onChange={e => setName(e.target.value)}
            required
            className="w-full bg-white border border-border-default rounded px-3 py-2 text-base font-mono"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] uppercase tracking-wider text-fg-muted font-semibold mb-1">
              Type
            </label>
            <select
              name="type"
              value={type}
              onChange={e => setType(e.target.value)}
              className="w-full bg-white border border-border-default rounded px-2 py-2 text-sm"
            >
              {types.map(t => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] uppercase tracking-wider text-fg-muted font-semibold mb-1">
              Status
            </label>
            <select
              name="status"
              value={status}
              onChange={e => setStatus(e.target.value)}
              className="w-full bg-white border border-border-default rounded px-2 py-2 text-sm"
            >
              <option value="active">active</option>
              <option value="deprecated">deprecated</option>
              <option value="superseded">superseded</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-[11px] uppercase tracking-wider text-fg-muted font-semibold mb-1">
            Summary (markdown)
          </label>
          <textarea
            name="summaryMarkdown"
            value={summary}
            onChange={e => setSummary(e.target.value)}
            rows={4}
            className="w-full bg-white border border-border-default rounded px-3 py-2 text-sm font-mono"
          />
        </div>

        <div>
          <label className="block text-[11px] uppercase tracking-wider text-fg-muted font-semibold mb-1">
            Body (markdown)
          </label>
          <textarea
            name="bodyMarkdown"
            value={body}
            onChange={e => setBody(e.target.value)}
            rows={28}
            className="w-full bg-white border border-border-default rounded px-3 py-2 text-sm font-mono"
          />
        </div>

        <div className="flex items-center gap-2 pt-2 border-t border-border-muted">
          {!isCreate && <DeleteEntityButton slug={slug} id={entity.id} redirectTo={indexHref} />}
          <div className="flex-1" />
          <Link
            href={isCreate ? indexHref : detailHref}
            className="px-3 py-1.5 text-sm border border-border-default rounded hover:bg-canvas-subtle"
          >
            취소
          </Link>
          <button
            type="submit"
            className="px-3 py-1.5 text-sm bg-accent-fg text-white rounded hover:opacity-90"
          >
            {isCreate ? '생성' : '저장'}
          </button>
        </div>
      </div>

      <aside className="lg:sticky lg:top-4 lg:self-start lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto bg-canvas-subtle rounded-md p-5">
        <div className="text-[10px] uppercase tracking-wider text-fg-muted font-semibold mb-3">
          Preview
        </div>
        <div className="flex items-center gap-2 mb-2">
          <LabelChip tone="neutral">
            {types.find(t => t.key === type)?.label ?? type}
          </LabelChip>
          <LabelChip tone={statusTone(status)}>{status}</LabelChip>
        </div>
        <h2 className="font-mono text-2xl font-semibold mb-4">{name}</h2>
        {summary && (
          <div className="bg-white rounded p-3 mb-4">
            <div className="text-[11px] uppercase tracking-wider text-fg-muted font-semibold mb-2">
              Summary
            </div>
            <MarkdownBody source={summary} size="sm" wikiSlug={slug} wikiEntityIds={entityIds} />
          </div>
        )}
        <div className="bg-white rounded p-3">
          <MarkdownBody source={body} size="sm" wikiSlug={slug} wikiEntityIds={entityIds} />
        </div>
      </aside>
    </form>
  );
}

function DeleteEntityButton({
  slug,
  id,
  redirectTo,
}: {
  slug: string;
  id: string;
  redirectTo: string;
}) {
  const [armed, setArmed] = useState(false);
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const onClick = () => {
    if (!armed) {
      setArmed(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setArmed(false), 4000);
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    const fd = new FormData();
    fd.set('projectSlug', slug);
    fd.set('id', id);
    fd.set('redirectTo', redirectTo);
    startTransition(() => deleteWikiEntityAction(fd));
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className={`inline-flex items-center gap-1 px-3 py-1.5 rounded border text-sm transition-colors disabled:opacity-50 ${
        armed
          ? 'border-danger-emphasis bg-danger-emphasis text-white'
          : 'border-danger-subtle text-danger-fg hover:bg-danger-subtle'
      }`}
    >
      <TrashIcon size={14} />
      {armed ? '한 번 더 클릭하면 삭제' : '삭제'}
    </button>
  );
}
