import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { LabelChip } from '@/components/badges/LabelChip';
import { statusTone } from '@/lib/wiki-status';

// "New!" badge fades linearly over 72h from lastSyncedAt → returns 0..1.
function newnessFromDate(d: Date): number {
  const hours = (Date.now() - d.getTime()) / (60 * 60 * 1000);
  if (hours < 0) return 1;
  if (hours >= 72) return 0;
  return 1 - hours / 72;
}

function snippet(md: string, max = 220): string {
  if (!md) return '';
  // Strip markdown chars lightly so the preview doesn't show **stars** etc.
  const plain = md
    .replace(/```[\s\S]*?```/g, '')           // fenced code
    .replace(/`([^`]+)`/g, '$1')              // inline code
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')     // images
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')  // links
    .replace(/[*_>#~]/g, '')                  // emphasis / quote / heading
    .replace(/\s+/g, ' ')                     // collapse whitespace
    .trim();
  return plain.length > max ? plain.slice(0, max).trimEnd() + '…' : plain;
}

export default async function ProjectWikiIndex({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const project = await prisma.project.findUnique({ where: { slug } });
  if (!project) notFound();

  const [types, entities] = await Promise.all([
    prisma.wikiType.findMany({
      where: { projectSlug: slug },
      orderBy: { position: 'asc' },
    }),
    prisma.wikiEntity.findMany({
      where: { projectSlug: slug },
      orderBy: [{ type: 'asc' }, { id: 'asc' }],
    }),
  ]);

  if (types.length === 0) {
    return (
      <div className="max-w-3xl mx-auto py-6 text-sm text-fg-muted">
        No wiki types configured for this project. Define wiki types in project settings to start.
      </div>
    );
  }

  const byType = new Map<string, typeof entities>();
  for (const t of types) byType.set(t.key, []);
  for (const e of entities) byType.get(e.type)?.push(e);

  const lastSync = entities.reduce<Date | null>((acc, e) => {
    if (!acc || e.lastSyncedAt > acc) return e.lastSyncedAt;
    return acc;
  }, null);

  return (
    <div className="max-w-5xl mx-auto py-2 space-y-10">
      <header>
        <h2 className="text-2xl font-semibold tracking-tight">Wiki</h2>
        <p className="text-sm text-fg-muted mt-1">
          {entities.length} entities · {types.length} types
          {lastSync && ` · last synced ${lastSync.toLocaleString('ko-KR')}`}
        </p>
      </header>

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
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 list-none">
                {list.map(e => {
                  const newness = newnessFromDate(e.lastSyncedAt);
                  return (
                  <li key={e.id}>
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
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-mono text-base font-semibold text-fg-default">{e.name}</span>
                        <LabelChip tone={statusTone(e.status)}>{e.status}</LabelChip>
                      </div>
                      {e.summaryMarkdown && (
                        <p className="text-sm text-fg-muted leading-relaxed line-clamp-3">
                          {snippet(e.summaryMarkdown)}
                        </p>
                      )}
                    </Link>
                  </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
