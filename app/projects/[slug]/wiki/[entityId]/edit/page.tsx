import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { WikiEntityEditor } from '@/components/wiki/WikiEntityEditor';

export default async function WikiEntityEditPage({
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
      select: { id: true },
    }),
    prisma.wikiEntity.findUnique({
      where: { projectSlug_id: { projectSlug: slug, id } },
      select: {
        id: true,
        type: true,
        name: true,
        status: true,
        summaryMarkdown: true,
        bodyMarkdown: true,
      },
    }),
  ]);

  if (!entity) notFound();

  return (
    <div className="max-w-7xl mx-auto py-2">
      <div className="text-xs text-fg-muted mb-4">Edit wiki entity</div>
      <WikiEntityEditor
        slug={slug}
        entity={entity}
        types={types}
        entityIds={allEntities.map(e => e.id)}
      />
    </div>
  );
}
