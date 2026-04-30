import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PencilIcon, PlusIcon, StarFillIcon } from '@primer/octicons-react';
import { prisma } from '@/lib/db';
import { LabelChip } from '@/components/badges/LabelChip';
import { WikiEntityDeleteButton } from '@/components/wiki/WikiEntityDeleteButton';
import { WikiTypesManager } from '@/components/wiki/WikiTypesManager';
import { WikiStarButton } from '@/components/wiki/WikiStarButton';
import { WikiSearchBox } from '@/components/wiki/WikiSearchBox';
import { statusTone } from '@/lib/wiki-status';
import { getCurrentUserLogin } from '@/lib/session';

// "New!" badge fades linearly over 72h from the entity's createdAt
// (first ingest). Future-skewed timestamps are clamped to "just now".
function newnessFromDate(d: Date): number {
  const hours = Math.max(0, (Date.now() - d.getTime()) / (60 * 60 * 1000));
  if (hours >= 72) return 0;
  return 1 - hours / 72;
}

function snippet(md: string, max = 220): string {
  if (!md) return '';
  const plain = md
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_>#~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return plain.length > max ? plain.slice(0, max).trimEnd() + '…' : plain;
}

/** Pull a ~120 char excerpt around the first match of `q` in the text. */
function searchSnippet(text: string, q: string, around = 60): string | null {
  if (!text || !q) return null;
  const lower = text.toLowerCase();
  const idx = lower.indexOf(q.toLowerCase());
  if (idx < 0) return null;
  const start = Math.max(0, idx - around);
  const end = Math.min(text.length, idx + q.length + around);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < text.length ? '…' : '';
  return prefix + text.slice(start, end).replace(/\s+/g, ' ').trim() + suffix;
}

type Entity = {
  projectSlug: string;
  id: string;
  type: string;
  name: string;
  status: string;
  summaryMarkdown: string;
  bodyMarkdown: string;
  createdAt: Date;
  lastSyncedAt: Date;
};

export default async function ProjectWikiIndex({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const query = (sp.q ?? '').trim();
  const project = await prisma.project.findUnique({ where: { slug } });
  if (!project) notFound();

  const me = await getCurrentUserLogin();

  const [types, entities, myStarsRaw] = await Promise.all([
    prisma.wikiType.findMany({
      where: { projectSlug: slug },
      orderBy: { position: 'asc' },
    }),
    prisma.wikiEntity.findMany({
      where: query
        ? {
            projectSlug: slug,
            OR: [
              { name: { contains: query } },
              { summaryMarkdown: { contains: query } },
              { bodyMarkdown: { contains: query } },
              { id: { contains: query } },
            ],
          }
        : { projectSlug: slug },
      orderBy: [{ type: 'asc' }, { id: 'asc' }],
    }),
    me
      ? prisma.wikiEntityStar.findMany({
          where: { memberLogin: me, projectSlug: slug },
          select: { entityId: true },
        })
      : Promise.resolve([] as { entityId: string }[]),
  ]);

  const starredIds = new Set(myStarsRaw.map(s => s.entityId));

  const typeLabelByKey = new Map(types.map(t => [t.key, t.label] as const));

  if (types.length === 0) {
    return (
      <div className="max-w-5xl mx-auto py-2 space-y-6">
        <header>
          <h2 className="text-2xl font-semibold tracking-tight">Wiki</h2>
          <p className="text-sm text-fg-muted mt-1">
            아직 wiki type이 없습니다. 분류부터 정의해 주세요 (예: <code>attack</code>, <code>concept</code>).
            정의 후 <code>labhub-wiki-ingest {slug}</code>로 ingest.
          </p>
        </header>
        <WikiTypesManager slug={slug} types={[]} defaultOpen />
      </div>
    );
  }

  const lastSync = entities.reduce<Date | null>((acc, e) => {
    if (!acc || e.lastSyncedAt > acc) return e.lastSyncedAt;
    return acc;
  }, null);

  const renderCard = (e: Entity, opts: { showSearchSnippet?: boolean } = {}) => {
    const newness = newnessFromDate(e.createdAt);
    const isStarred = starredIds.has(e.id);
    const matchSnippet = opts.showSearchSnippet && query
      ? searchSnippet(e.bodyMarkdown, query) ?? searchSnippet(e.summaryMarkdown, query)
      : null;
    return (
      <li key={e.id} className="relative group">
        <Link
          href={`/projects/${slug}/wiki/${encodeURIComponent(e.id)}`}
          className="relative block bg-white rounded-md p-5 hover:bg-canvas-subtle transition-colors"
        >
          {newness > 0 && (
            <span
              className="absolute top-1 left-1 bg-danger-fg text-white text-[9px] font-semibold px-1 py-px rounded-full shadow-sm leading-none"
              style={{ opacity: newness }}
            >
              New!
            </span>
          )}
          <div className="flex items-center gap-2 mb-2 pr-24">
            <span className="font-mono text-base font-semibold text-fg-default">{e.name}</span>
            <LabelChip tone={statusTone(e.status)}>{e.status}</LabelChip>
            {opts.showSearchSnippet && (
              <span className="text-[10px] text-fg-muted uppercase tracking-wider">
                {typeLabelByKey.get(e.type) ?? e.type}
              </span>
            )}
          </div>
          {matchSnippet ? (
            <p className="text-sm text-fg-muted leading-relaxed line-clamp-3">
              {matchSnippet}
            </p>
          ) : e.summaryMarkdown ? (
            <p className="text-sm text-fg-muted leading-relaxed line-clamp-3">
              {snippet(e.summaryMarkdown)}
            </p>
          ) : null}
        </Link>
        <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5">
          <span
            className={`${
              isStarred
                ? 'opacity-100'
                : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100'
            } transition-opacity bg-white rounded shadow-sm border border-border-muted px-1.5 py-1`}
          >
            <WikiStarButton slug={slug} entityId={e.id} starred={isStarred} size={14} />
          </span>
          <span className="opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity flex items-center gap-1">
            <Link
              href={`/projects/${slug}/wiki/${encodeURIComponent(e.id)}/edit`}
              aria-label={`Edit ${e.name}`}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs text-fg-muted hover:text-accent-fg bg-white rounded shadow-sm border border-border-muted hover:border-accent-fg"
            >
              <PencilIcon size={12} /> 편집
            </Link>
            <WikiEntityDeleteButton slug={slug} id={e.id} />
          </span>
        </div>
      </li>
    );
  };

  // ── Search-result mode ──────────────────────────────────────────────
  if (query) {
    return (
      <div className="max-w-5xl mx-auto py-2 space-y-6">
        <header>
          <h2 className="text-2xl font-semibold tracking-tight">Wiki</h2>
          <p className="text-sm text-fg-muted mt-1">
            검색 결과 — <strong>“{query}”</strong> · {entities.length}건
          </p>
        </header>
        <WikiSearchBox slug={slug} defaultQuery={query} />
        {entities.length === 0 ? (
          <div className="text-sm text-fg-muted italic">일치하는 항목이 없습니다.</div>
        ) : (
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 list-none pl-0">
            {entities.map(e => renderCard(e, { showSearchSnippet: true }))}
          </ul>
        )}
      </div>
    );
  }

  // ── Normal mode ─────────────────────────────────────────────────────
  const starred = entities.filter(e => starredIds.has(e.id));
  const byType = new Map<string, Entity[]>();
  for (const t of types) byType.set(t.key, []);
  for (const e of entities) byType.get(e.type)?.push(e);

  return (
    <div className="max-w-5xl mx-auto py-2 space-y-10">
      <header className="space-y-3">
        <div className="flex items-start gap-4">
          <div className="flex-1">
            <h2 className="text-2xl font-semibold tracking-tight">Wiki</h2>
            <p className="text-sm text-fg-muted mt-1">
              {entities.length} entities · {types.length} types
              {lastSync && ` · last synced ${lastSync.toLocaleString('ko-KR')}`}
            </p>
          </div>
          <Link
            href={`/projects/${slug}/wiki/new`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-accent-fg text-white rounded hover:opacity-90 shrink-0"
          >
            <PlusIcon size={14} /> New entry
          </Link>
        </div>
        <WikiSearchBox slug={slug} defaultQuery="" />
      </header>

      <WikiTypesManager slug={slug} types={types} />

      {starred.length > 0 && (
        <section>
          <div className="flex items-baseline gap-2 mb-4">
            <h3 className="text-lg font-semibold inline-flex items-center gap-1.5">
              <span className="text-attention-fg">
                <StarFillIcon size={16} />
              </span>
              즐겨찾기
            </h3>
            <span className="text-sm text-fg-muted">{starred.length}</span>
          </div>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 list-none pl-0">
            {starred.map(e => renderCard(e))}
          </ul>
        </section>
      )}

      {types.map(t => {
        const list = byType.get(t.key) ?? [];
        return (
          <section key={t.key}>
            <div className="flex items-baseline gap-2 mb-4">
              <h3 className="text-lg font-semibold">{t.label}</h3>
              <span className="text-sm text-fg-muted">{list.length}</span>
            </div>
            {list.length === 0 ? (
              <div className="text-sm text-fg-muted italic">none yet</div>
            ) : (
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 list-none pl-0">
                {list.map(e => renderCard(e))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
