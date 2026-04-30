import Link from 'next/link';
import { notFound } from 'next/navigation';
import { LinkExternalIcon } from '@primer/octicons-react';
import { prisma } from '@/lib/db';
import { LabelChip } from '@/components/badges/LabelChip';
import { MarkdownBody } from '@/components/md/MarkdownBody';
import { loadProject } from '@/lib/mock/loaders';
import { relTime, requestNow } from '@/lib/time';

const KIND_LABEL: Record<string, string> = {
  benchmark: 'Benchmark',
  checkpoint: 'Checkpoint',
  'figure-bundle': 'Figures',
  report: 'Report',
  tool: 'Tool',
};

export default async function ResultsTab({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await loadProject(params);
  if (!slug) notFound();

  const results = await prisma.experimentResult.findMany({
    where: { experiment: { projectSlug: slug } },
    orderBy: { publishedAt: 'desc' },
    include: {
      experiment: { select: { id: true, title: true, status: true } },
      attachments: {
        orderBy: { position: 'asc' },
        select: { id: true, title: true, mimeType: true, originalFilename: true },
      },
    },
  });

  const now = requestNow();

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-2xl font-semibold tracking-tight">Results</h2>
        <p className="text-sm text-fg-muted mt-1">
          이 프로젝트의 모든 실험 결과 모음. 각 카드는 하나의 Experiment에 속한 결과 단위입니다.
        </p>
      </header>

      {results.length === 0 ? (
        <div className="bg-canvas-subtle border border-dashed border-border-default rounded-md p-10 text-center text-sm text-fg-muted">
          아직 등록된 결과가 없습니다.{' '}
          <Link href={`/projects/${slug}/experiments`} className="text-accent-fg hover:underline">
            Experiments
          </Link>{' '}
          페이지에서 실험을 만들고 그 안에 결과를 추가하세요.
        </div>
      ) : (
        <ul className="space-y-3 list-none pl-0">
          {results.map(r => {
            const metrics = parseMetrics(r.metricsJson);
            return (
              <li key={r.id} className="bg-white border border-border-default rounded-md p-4 space-y-2">
                <div className="flex items-start gap-2 flex-wrap">
                  <LabelChip tone="accent">{KIND_LABEL[r.kind] ?? r.kind}</LabelChip>
                  <h3 className="font-semibold text-sm flex-1 min-w-0">{r.title}</h3>
                  <Link
                    href={`/projects/${slug}/experiments/${r.experiment.id}`}
                    className="text-xs text-fg-muted hover:text-accent-fg inline-flex items-center gap-1 shrink-0"
                  >
                    <LinkExternalIcon size={12} />
                    {r.experiment.title}
                  </Link>
                </div>
                {r.summary && (
                  <div className="text-sm">
                    <MarkdownBody source={r.summary} size="sm" />
                  </div>
                )}
                {metrics.length > 0 && (
                  <table className="text-xs border border-border-muted rounded-md overflow-hidden">
                    <tbody>
                      {metrics.map((m, i) => (
                        <tr key={i} className="border-b border-border-muted last:border-0">
                          <th className="text-left bg-canvas-subtle px-2 py-1 font-mono font-normal text-fg-muted">
                            {m.label}
                          </th>
                          <td className="px-3 py-1 font-mono">{m.value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {r.attachments.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {r.attachments.map(a => {
                      const mime = (a.mimeType ?? '').toLowerCase();
                      const isImage = mime.startsWith('image/');
                      const inlineable =
                        isImage ||
                        mime.startsWith('text/') ||
                        mime === 'application/pdf' ||
                        /\.(md|html?|txt|json|csv|tsv|log|pdf|png|jpe?g|gif|webp|svg)$/i.test(
                          a.originalFilename ?? '',
                        );
                      const href = `/api/uploads/result-attachments/${a.id}${inlineable ? '?inline=1' : ''}`;
                      return (
                        <a
                          key={a.id}
                          href={href}
                          target={inlineable ? '_blank' : undefined}
                          rel={inlineable ? 'noopener noreferrer' : undefined}
                          className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-canvas-subtle hover:bg-canvas-default border border-border-muted rounded"
                          title={a.originalFilename ?? a.title}
                        >
                          <span className="text-sm">{isImage ? '🖼' : '📎'}</span>
                          <span className="truncate max-w-[20ch]">{a.title}</span>
                        </a>
                      );
                    })}
                  </div>
                )}
                <div className="text-xs text-fg-muted pt-1">
                  {relTime(r.publishedAt.toISOString(), now)}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function parseMetrics(json: string): { label: string; value: string }[] {
  try {
    const v = JSON.parse(json);
    if (!Array.isArray(v)) return [];
    return v
      .map(m => ({
        label: String((m as { label?: string }).label ?? ''),
        value: String((m as { value?: string }).value ?? ''),
      }))
      .filter(m => m.label);
  } catch {
    return [];
  }
}
