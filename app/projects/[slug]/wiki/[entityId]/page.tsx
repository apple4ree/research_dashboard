import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PencilIcon } from '@primer/octicons-react';
import { prisma } from '@/lib/db';
import { LabelChip } from '@/components/badges/LabelChip';
import { MarkdownBody } from '@/components/md/MarkdownBody';
import { WikiSidebar } from '@/components/wiki/WikiSidebar';
import { WikiEntityDeleteButton } from '@/components/wiki/WikiEntityDeleteButton';
import { statusTone } from '@/lib/wiki-status';

export default async function WikiEntityPage({
  params,
}: {
  params: Promise<{ slug: string; entityId: string }>;
}) {
  const { slug, entityId } = await params;
  const id = decodeURIComponent(entityId);

  const [types, allEntities, entity] = await Promise.all([
    prisma.wikiType.findMany({
      where: { projectSlug: slug },
      orderBy: { position: 'asc' },
      select: { key: true, label: true },
    }),
    prisma.wikiEntity.findMany({
      where: { projectSlug: slug },
      orderBy: [{ type: 'asc' }, { id: 'asc' }],
      select: { id: true, type: true, name: true, status: true },
    }),
    prisma.wikiEntity.findUnique({
      where: { projectSlug_id: { projectSlug: slug, id } },
    }),
  ]);

  if (!entity) notFound();
  const type = types.find(t => t.key === entity.type);

  let sourceFiles: string[] = [];
  try {
    const parsed = JSON.parse(entity.sourceFiles);
    if (Array.isArray(parsed)) sourceFiles = parsed.map(String);
  } catch {
    sourceFiles = [];
  }

  const entityIds = allEntities.map(e => e.id);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)] gap-8">
      <aside className="lg:sticky lg:top-4 lg:self-start lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
        <WikiSidebar
          slug={slug}
          types={types}
          entities={allEntities}
          activeId={entity.id}
        />
      </aside>

      <article className="max-w-3xl py-2">
        <div className="flex items-center justify-between mb-6">
          <div className="text-xs text-fg-muted">
            {type?.label ?? entity.type} · last synced {entity.lastSyncedAt.toLocaleString('ko-KR')}
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/projects/${slug}/wiki/${encodeURIComponent(entity.id)}/edit`}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-border-default text-xs text-fg-muted hover:border-accent-fg hover:text-accent-fg transition-colors"
            >
              <PencilIcon size={12} /> 편집
            </Link>
            <WikiEntityDeleteButton slug={slug} id={entity.id} />
          </div>
        </div>

        <header className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <LabelChip tone="neutral">{type?.label ?? entity.type}</LabelChip>
            <LabelChip tone={statusTone(entity.status)}>{entity.status}</LabelChip>
          </div>
          <h1 className="font-mono text-3xl font-semibold tracking-tight">{entity.name}</h1>
        </header>

        {entity.summaryMarkdown && (
          <section className="bg-canvas-subtle rounded-md p-5 mb-8">
            <div className="text-[11px] uppercase tracking-wider text-fg-muted font-semibold mb-2">Summary</div>
            <MarkdownBody
              source={entity.summaryMarkdown}
              size="base"
              wikiSlug={slug}
              wikiEntityIds={entityIds}
            />
          </section>
        )}

        <section className="bg-white rounded-md py-2">
          <MarkdownBody
            source={entity.bodyMarkdown}
            size="base"
            wikiSlug={slug}
            wikiEntityIds={entityIds}
          />
        </section>

        {sourceFiles.length > 0 && (
          <section className="text-xs text-fg-muted mt-10 pt-4 border-t border-border-muted">
            <div className="uppercase tracking-wider font-semibold mb-2">Sources</div>
            <ul className="list-none pl-0 space-y-1">
              {sourceFiles.map(f => (
                <li key={f} className="font-mono">{f}</li>
              ))}
            </ul>
          </section>
        )}
      </article>
    </div>
  );
}
