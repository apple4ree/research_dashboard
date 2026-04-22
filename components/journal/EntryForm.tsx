'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { PlusIcon, XIcon, ArrowLeftIcon, AlertIcon } from '@primer/octicons-react';
import {
  createEntryAction,
  updateEntryAction,
  type EntryActionState,
} from '@/lib/actions/entries';
import {
  ENTRY_TYPE_LABELS,
  ENTRY_TYPE_ORDER,
  SLIDE_KIND_LABEL,
} from '@/lib/labels';
import type {
  ResearchEntry,
  Member,
  SlideKind,
  EntrySlide,
  ArtifactType,
  EntryArtifact,
} from '@/lib/types';

const SLIDE_KINDS: SlideKind[] = ['discovery', 'failure', 'implement', 'question', 'next', 'metric'];
const ARTIFACT_TYPES: ArtifactType[] = ['notebook', 'figure', 'sheet', 'csv', 'doc', 'slide'];

interface EntryFormProps {
  projectSlug: string;
  mode: 'create' | 'edit';
  initial?: ResearchEntry;
  members: Member[];
}

export function EntryForm({ projectSlug, mode, initial, members }: EntryFormProps) {
  const bound =
    mode === 'create'
      ? createEntryAction.bind(null, projectSlug)
      : updateEntryAction.bind(null, projectSlug, initial!.id);
  const [state, formAction, pending] = useActionState<EntryActionState, FormData>(bound, null);

  const [slides, setSlides] = useState<EntrySlide[]>(initial?.slides ?? []);
  const [artifacts, setArtifacts] = useState<EntryArtifact[]>(initial?.artifacts ?? []);

  const addSlide = () =>
    setSlides(prev => [...prev, { kind: 'discovery', title: '', body: '' }]);
  const removeSlide = (i: number) =>
    setSlides(prev => prev.filter((_, idx) => idx !== i));
  const updateSlide = (i: number, patch: Partial<EntrySlide>) =>
    setSlides(prev => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));

  const addArtifact = () =>
    setArtifacts(prev => [...prev, { type: 'notebook', title: '', href: '' }]);
  const removeArtifact = (i: number) =>
    setArtifacts(prev => prev.filter((_, idx) => idx !== i));
  const updateArtifact = (i: number, patch: Partial<EntryArtifact>) =>
    setArtifacts(prev => prev.map((a, idx) => (idx === i ? { ...a, ...patch } : a)));

  const defaultDate =
    initial?.date?.slice(0, 10) ?? new Date().toISOString().slice(0, 10);

  // Serialize slides to the shape the server expects. metrics[] round-trips
  // via metricsJson, so we stringify when present.
  const slidesJson = JSON.stringify(
    slides.map(s => ({
      kind: s.kind,
      title: s.title,
      body: s.body,
      ...(s.chip ? { chip: s.chip } : {}),
      ...(s.metrics ? { metricsJson: JSON.stringify(s.metrics) } : {}),
      ...(s.code ? { code: s.code } : {}),
    })),
  );
  const artifactsJson = JSON.stringify(
    artifacts.map(a => ({ type: a.type, title: a.title, href: a.href })),
  );

  return (
    <div className="max-w-4xl">
      <Link
        href={`/projects/${projectSlug}`}
        className="inline-flex items-center gap-1 text-sm text-accent-fg hover:underline mb-4"
      >
        <ArrowLeftIcon size={14} /> Back to project
      </Link>
      <h1 className="text-lg font-semibold mb-4">
        {mode === 'create' ? 'New journal entry' : 'Edit journal entry'}
      </h1>
      <form
        action={formAction}
        className="space-y-4 bg-white border border-border-default rounded-md p-6"
      >
        {state?.error && (
          <div
            role="alert"
            className="flex items-start gap-2 bg-danger-subtle border border-danger-subtle rounded-md p-3 text-sm text-danger-fg"
          >
            <AlertIcon size={16} className="mt-0.5 flex-shrink-0" />
            <span>{state.error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="date">
              Date
            </label>
            <input
              id="date"
              name="date"
              type="date"
              required
              defaultValue={defaultDate}
              className="w-full border border-border-default rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-emphasis"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="type">
              Type
            </label>
            <select
              id="type"
              name="type"
              required
              defaultValue={initial?.type ?? 'meeting'}
              className="w-full border border-border-default rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-emphasis"
            >
              {ENTRY_TYPE_ORDER.map(t => (
                <option key={t} value={t}>
                  {ENTRY_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="authorLogin">
              Author
            </label>
            <select
              id="authorLogin"
              name="authorLogin"
              required
              defaultValue={initial?.authorLogin ?? members[0]?.login}
              className="w-full border border-border-default rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-emphasis"
            >
              {members.map(m => (
                <option key={m.login} value={m.login}>
                  {m.displayName} (@{m.login})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="title">
            Title
          </label>
          <input
            id="title"
            name="title"
            type="text"
            required
            defaultValue={initial?.title ?? ''}
            className="w-full border border-border-default rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-emphasis"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="summary">
            Summary{' '}
            <span className="text-fg-muted font-normal">
              (one or two lines for card front)
            </span>
          </label>
          <textarea
            id="summary"
            name="summary"
            required
            rows={2}
            defaultValue={initial?.summary ?? ''}
            className="w-full border border-border-default rounded-md px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-accent-emphasis"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="tags">
            Tags{' '}
            <span className="text-fg-muted font-normal">(comma-separated)</span>
          </label>
          <input
            id="tags"
            name="tags"
            type="text"
            defaultValue={initial?.tags?.join(', ') ?? ''}
            placeholder="meeting, planner, decision"
            className="w-full border border-border-default rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-emphasis"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="bodyMarkdown">
            Body{' '}
            <span className="text-fg-muted font-normal">
              (Markdown — shown in modal)
            </span>
          </label>
          <textarea
            id="bodyMarkdown"
            name="bodyMarkdown"
            rows={12}
            defaultValue={initial?.bodyMarkdown ?? ''}
            className="w-full border border-border-default rounded-md px-3 py-2 text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-accent-emphasis"
          />
        </div>

        <section data-section="slides">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold">
              Slides{' '}
              <span className="text-fg-muted font-normal">({slides.length})</span>
            </h2>
            <button
              type="button"
              onClick={addSlide}
              className="inline-flex items-center gap-1 text-xs px-2 h-7 rounded-md border border-border-default hover:bg-canvas-subtle"
            >
              <PlusIcon size={12} /> Add slide
            </button>
          </div>
          <div className="space-y-2">
            {slides.map((s, i) => (
              <div
                key={i}
                className="border border-border-default rounded-md p-3 bg-canvas-subtle space-y-2"
              >
                <div className="flex items-center gap-2">
                  <select
                    value={s.kind}
                    onChange={e => updateSlide(i, { kind: e.target.value as SlideKind })}
                    aria-label={`slide ${i + 1} kind`}
                    className="text-xs border border-border-default rounded px-2 py-1 bg-white"
                  >
                    {SLIDE_KINDS.map(k => (
                      <option key={k} value={k}>
                        {SLIDE_KIND_LABEL[k]}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={s.title}
                    onChange={e => updateSlide(i, { title: e.target.value })}
                    placeholder="Slide title"
                    className="flex-1 text-sm border border-border-default rounded px-2 py-1"
                  />
                  <input
                    type="text"
                    value={s.chip ?? ''}
                    onChange={e =>
                      updateSlide(i, { chip: e.target.value || undefined })
                    }
                    placeholder="chip"
                    className="w-24 text-xs border border-border-default rounded px-2 py-1"
                  />
                  <button
                    type="button"
                    onClick={() => removeSlide(i)}
                    className="text-fg-muted hover:text-danger-fg p-1"
                    aria-label={`Remove slide ${i + 1}`}
                  >
                    <XIcon size={14} />
                  </button>
                </div>
                <textarea
                  value={s.body}
                  onChange={e => updateSlide(i, { body: e.target.value })}
                  rows={2}
                  placeholder="Slide body"
                  className="w-full text-sm border border-border-default rounded px-2 py-1 resize-y bg-white"
                />
              </div>
            ))}
          </div>
        </section>

        <section data-section="artifacts">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold">
              Artifacts{' '}
              <span className="text-fg-muted font-normal">({artifacts.length})</span>
            </h2>
            <button
              type="button"
              onClick={addArtifact}
              className="inline-flex items-center gap-1 text-xs px-2 h-7 rounded-md border border-border-default hover:bg-canvas-subtle"
            >
              <PlusIcon size={12} /> Add artifact
            </button>
          </div>
          <div className="space-y-2">
            {artifacts.map((a, i) => (
              <div key={i} className="flex items-center gap-2">
                <select
                  value={a.type}
                  onChange={e =>
                    updateArtifact(i, { type: e.target.value as ArtifactType })
                  }
                  aria-label={`artifact ${i + 1} type`}
                  className="text-xs border border-border-default rounded px-2 py-1 w-28 bg-white"
                >
                  {ARTIFACT_TYPES.map(t => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={a.title}
                  onChange={e => updateArtifact(i, { title: e.target.value })}
                  placeholder="Artifact title"
                  className="flex-1 text-sm border border-border-default rounded px-2 py-1"
                />
                <input
                  type="text"
                  value={a.href}
                  onChange={e => updateArtifact(i, { href: e.target.value })}
                  placeholder="URL"
                  className="flex-1 text-sm border border-border-default rounded px-2 py-1 font-mono"
                />
                <button
                  type="button"
                  onClick={() => removeArtifact(i)}
                  className="text-fg-muted hover:text-danger-fg p-1"
                  aria-label={`Remove artifact ${i + 1}`}
                >
                  <XIcon size={14} />
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Hidden serialization passed to the server action via FormData. */}
        <input type="hidden" name="slidesJson" value={slidesJson} />
        <input type="hidden" name="artifactsJson" value={artifactsJson} />

        <div className="flex items-center gap-2 pt-2">
          <button
            type="submit"
            disabled={pending}
            className="px-3 h-8 rounded-md bg-success-emphasis text-white text-sm font-medium hover:bg-success-fg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {pending ? 'Saving…' : mode === 'create' ? 'Create entry' : 'Save changes'}
          </button>
          <Link
            href={`/projects/${projectSlug}`}
            className="px-3 h-8 inline-flex items-center rounded-md border border-border-default text-sm hover:bg-canvas-subtle"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
