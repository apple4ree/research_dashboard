'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, useTransition } from 'react';
import {
  XIcon,
  LinkExternalIcon,
  PencilIcon,
  TrashIcon,
  DownloadIcon,
} from '@primer/octicons-react';
import type { ResearchEntry, ArtifactType } from '@/lib/types';
import { ENTRY_TYPE_LABELS, ENTRY_TYPE_TONE } from '@/lib/labels';
import { LabelChip } from '@/components/badges/LabelChip';
import { MarkdownBody } from '@/components/md/MarkdownBody';
import { cn } from '@/lib/cn';
import { deleteEntryAction } from '@/lib/actions/entries';


const ARTIFACT_ICON: Record<ArtifactType, string> = {
  notebook: '📓',
  figure: '🖼',
  sheet: '📊',
  csv: '📄',
  doc: '📝',
  slide: '🎞',
};

/**
 * Decide whether clicking an artifact should open the file in a new tab
 * for viewing (vs always downloading). Stored uploads with viewable
 * mime/extension get the inline preview treatment; external URL artifacts
 * always just open the URL.
 */
function isInlineViewable(a: {
  storedPath?: string | null;
  mimeType?: string | null;
  originalFilename?: string | null;
}): boolean {
  if (!a.storedPath) return true; // external URL — let the browser do whatever.
  const mt = (a.mimeType ?? '').toLowerCase();
  if (mt.startsWith('text/')) return true;
  if (mt.startsWith('image/')) return true;
  if (mt === 'application/pdf') return true;
  if (mt === 'application/json') return true;
  const name = (a.originalFilename ?? '').toLowerCase();
  return /\.(md|html?|txt|json|csv|tsv|log|pdf|png|jpe?g|gif|webp|svg)$/.test(name);
}

export function EntryModal({
  entry,
  projectSlug,
  onClose,
}: {
  entry: ResearchEntry | null;
  projectSlug: string;
  onClose: () => void;
}) {
  if (!entry) return null;
  return (
    <EntryModalBody
      key={entry.id}
      entry={entry}
      projectSlug={projectSlug}
      onClose={onClose}
    />
  );
}

function EntryModalBody({
  entry,
  projectSlug,
  onClose,
}: {
  entry: ResearchEntry;
  projectSlug: string;
  onClose: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [deletePending, startDeleteTransition] = useTransition();
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
    };
  }, []);

  const handleDelete = () => {
    if (!confirming) {
      setConfirming(true);
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
      confirmTimer.current = setTimeout(() => setConfirming(false), 3000);
      return;
    }
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
    startDeleteTransition(async () => {
      await deleteEntryAction(projectSlug, entry.id);
      onClose();
    });
  };

  // Close on Escape
  useEffect(() => {
    const handler = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const tone = ENTRY_TYPE_TONE[entry.type];

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />
      <div className="relative max-w-[1400px] h-[92vh] mx-auto mt-[4vh] bg-canvas-subtle rounded-md shadow-md overflow-hidden flex flex-col border border-border-default">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 bg-white border-b border-border-default gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <LabelChip tone={tone}>{ENTRY_TYPE_LABELS[entry.type]}</LabelChip>
            <h2 className="font-semibold text-fg-default truncate">{entry.title}</h2>
            <span className="text-xs text-fg-muted whitespace-nowrap">
              {entry.date.slice(0, 10)} · {entry.authorLogin}
            </span>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Link
              href={`/projects/${projectSlug}/entries/${entry.id}/edit`}
              className="inline-flex items-center gap-1 px-2 h-7 rounded-md border border-border-default text-xs text-fg-default hover:bg-canvas-subtle"
            >
              <PencilIcon size={12} /> Edit
            </Link>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deletePending}
              className={cn(
                'inline-flex items-center gap-1 px-2 h-7 rounded-md border text-xs transition-colors disabled:opacity-50',
                confirming
                  ? 'border-danger-emphasis bg-danger-emphasis text-white hover:bg-danger-fg'
                  : 'border-border-default text-danger-fg hover:bg-danger-subtle',
              )}
            >
              <TrashIcon size={12} />
              {confirming ? 'Click again to confirm' : 'Delete'}
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="close"
              className="w-8 h-8 rounded-md hover:bg-canvas-inset flex items-center justify-center text-fg-muted"
            >
              <XIcon size={16} />
            </button>
          </div>
        </div>
        {/* 3-panel grid */}
        <div className="flex-1 grid grid-cols-12 gap-0 min-h-0">
          {/* Markdown body */}
          <div className="col-span-12 md:col-span-8 bg-white md:border-r border-border-default flex flex-col min-h-0">
            <div className="px-5 py-2 border-b border-border-default text-xs text-fg-muted">
              <span>📄 보고 문서 (</span>
              <span className="font-mono">{`journal/${entry.date.slice(0, 10)}-${entry.type}.md`}</span>
              <span>)</span>
            </div>
            <div className="overflow-y-auto px-6 py-5 flex-1">
              <MarkdownBody source={entry.bodyMarkdown} />
            </div>
          </div>
          {/* Artifacts */}
          <div className="col-span-12 md:col-span-4 bg-white flex flex-col min-h-0">
            <div className="px-5 py-2 border-b border-border-default text-xs text-fg-muted">
              📊 분석 결과 & 아티팩트
            </div>
            <div className="overflow-y-auto px-4 py-4 flex-1 space-y-2">
              {entry.artifacts.length === 0 && (
                <p className="text-xs text-fg-muted">—</p>
              )}
              {entry.artifacts.map((a, i) => {
                const stored = !!a.storedPath;
                const inlineable = isInlineViewable(a);
                // For stored uploads: inline=1 disposition for preview;
                // download URL is the bare /api/uploads/<id> (default
                // Content-Disposition: attachment).
                const previewHref = stored && a.id
                  ? `/api/uploads/${a.id}?inline=1`
                  : a.href;
                const downloadHref = stored && a.id
                  ? `/api/uploads/${a.id}`
                  : a.href;
                return (
                  <div
                    key={i}
                    className="flex items-stretch border border-border-default rounded-md hover:bg-canvas-subtle transition-colors overflow-hidden"
                  >
                    <a
                      href={previewHref}
                      target={inlineable ? '_blank' : undefined}
                      rel={inlineable ? 'noopener noreferrer' : undefined}
                      className="flex-1 min-w-0 p-3 flex items-start gap-2"
                    >
                      <div className="text-xl shrink-0">{ARTIFACT_ICON[a.type]}</div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-fg-default truncate">
                          {a.title}
                        </div>
                        <div className="text-xs text-fg-muted">
                          {a.type}
                          {a.originalFilename ? ` · ${a.originalFilename}` : ''}
                        </div>
                      </div>
                      <div className="text-fg-muted shrink-0 self-start mt-1">
                        <LinkExternalIcon size={12} />
                      </div>
                    </a>
                    {stored && (
                      <a
                        href={downloadHref}
                        download={a.originalFilename ?? ''}
                        aria-label={`Download ${a.title}`}
                        title="Download"
                        className="shrink-0 px-3 flex items-center border-l border-border-default text-fg-muted hover:text-accent-fg hover:bg-canvas-default"
                      >
                        <DownloadIcon size={14} />
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
