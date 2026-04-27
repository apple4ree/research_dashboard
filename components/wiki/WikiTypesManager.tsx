'use client';

import { useState, useTransition } from 'react';
import { XIcon, ChevronDownIcon, ChevronRightIcon } from '@primer/octicons-react';
import {
  addWikiTypeAction,
  deleteWikiTypeAction,
} from '@/lib/actions/wiki-types';

type WikiType = {
  key: string;
  label: string;
  description: string | null;
};

export function WikiTypesManager({
  slug,
  types,
  defaultOpen = false,
}: {
  slug: string;
  types: WikiType[];
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen || types.length === 0);

  return (
    <section className="bg-canvas-subtle rounded-md border border-border-muted">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-canvas-default transition-colors"
      >
        <span className="inline-flex items-center gap-2 font-semibold">
          {open ? <ChevronDownIcon size={14} /> : <ChevronRightIcon size={14} />}
          Wiki types ({types.length})
        </span>
        <span className="text-xs text-fg-muted">
          {types.length === 0 ? '분류부터 정의하세요' : 'add / remove'}
        </span>
      </button>

      {open && (
        <div className="px-4 pb-4 pt-1 space-y-3 border-t border-border-muted">
          {types.length > 0 && (
            <ul className="flex flex-wrap gap-2 list-none pl-0 m-0">
              {types.map(t => (
                <TypeChip key={t.key} slug={slug} type={t} />
              ))}
            </ul>
          )}
          <AddTypeForm slug={slug} />
          <p className="text-[11px] text-fg-muted">
            Key는 소문자/숫자/<code>-</code>/<code>_</code>만. Entity가 이미 사용 중인 type은 삭제 안 됨.
          </p>
        </div>
      )}
    </section>
  );
}

function TypeChip({ slug, type }: { slug: string; type: WikiType }) {
  const [pending, startTransition] = useTransition();
  const onDelete = () => {
    const fd = new FormData();
    fd.set('projectSlug', slug);
    fd.set('key', type.key);
    startTransition(() => deleteWikiTypeAction(fd));
  };
  return (
    <li className="inline-flex items-center gap-1.5 bg-white border border-border-default rounded-md pl-3 pr-1 py-1 text-xs">
      <span className="font-mono text-fg-muted">{type.key}</span>
      <span className="font-medium">{type.label}</span>
      <button
        type="button"
        onClick={onDelete}
        disabled={pending}
        aria-label={`Delete type ${type.key}`}
        className="text-fg-muted hover:text-danger-fg p-0.5 rounded disabled:opacity-50"
      >
        <XIcon size={12} />
      </button>
    </li>
  );
}

function AddTypeForm({ slug }: { slug: string }) {
  const [key, setKey] = useState('');
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');

  return (
    <form
      action={async (fd: FormData) => {
        await addWikiTypeAction(fd);
        setKey('');
        setLabel('');
        setDescription('');
      }}
      className="flex flex-wrap items-end gap-2"
    >
      <input type="hidden" name="projectSlug" value={slug} />
      <div className="flex-1 min-w-[110px]">
        <label className="block text-[10px] uppercase tracking-wider text-fg-muted font-semibold mb-1">
          Key
        </label>
        <input
          name="key"
          required
          value={key}
          onChange={e => setKey(e.target.value)}
          placeholder="attack"
          pattern="[a-z0-9_-]+"
          className="w-full bg-white border border-border-default rounded px-2 py-1.5 text-sm font-mono"
        />
      </div>
      <div className="flex-1 min-w-[150px]">
        <label className="block text-[10px] uppercase tracking-wider text-fg-muted font-semibold mb-1">
          Label
        </label>
        <input
          name="label"
          required
          value={label}
          onChange={e => setLabel(e.target.value)}
          placeholder="Attacks"
          className="w-full bg-white border border-border-default rounded px-2 py-1.5 text-sm"
        />
      </div>
      <div className="flex-[2] min-w-[180px]">
        <label className="block text-[10px] uppercase tracking-wider text-fg-muted font-semibold mb-1">
          Description (optional)
        </label>
        <input
          name="description"
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="짧은 설명"
          className="w-full bg-white border border-border-default rounded px-2 py-1.5 text-sm"
        />
      </div>
      <button
        type="submit"
        className="px-3 py-1.5 text-sm bg-accent-fg text-white rounded hover:opacity-90"
      >
        추가
      </button>
    </form>
  );
}
