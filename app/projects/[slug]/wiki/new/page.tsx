import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { WikiEntityEditor } from '@/components/wiki/WikiEntityEditor';

export default async function WikiEntityNewPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const project = await prisma.project.findUnique({ where: { slug } });
  if (!project) notFound();

  const [types, allEntities] = await Promise.all([
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
  ]);

  if (types.length === 0) {
    return (
      <div className="max-w-3xl mx-auto py-2">
        <div className="text-xs text-fg-muted mb-4">New wiki entity</div>
        <p className="text-sm text-fg-muted">
          아직 wiki type이 없습니다.{' '}
          <Link href={`/projects/${slug}/wiki`} className="text-accent-fg hover:underline">
            Wiki 페이지에서 분류부터 정의
          </Link>
          한 뒤 다시 시도해 주세요.
        </p>
      </div>
    );
  }

  const emptyEntity = {
    id: '',
    type: types[0].key,
    name: '',
    status: 'active',
    summaryMarkdown: '',
    bodyMarkdown: '',
  };

  return (
    <div className="max-w-7xl mx-auto py-2">
      <div className="text-xs text-fg-muted mb-4">New wiki entity</div>
      <WikiEntityEditor
        slug={slug}
        entity={emptyEntity}
        types={types}
        entityIds={allEntities.map(e => e.id)}
        mode="create"
      />
    </div>
  );
}
