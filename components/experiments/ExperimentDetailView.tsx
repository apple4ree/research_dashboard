import Link from 'next/link';
import { ArrowLeftIcon, PencilIcon, PlusIcon } from '@primer/octicons-react';
import { prisma } from '@/lib/db';
import { LabelChip, type LabelTone } from '@/components/badges/LabelChip';
import { StatusBadge } from '@/components/badges/StatusBadge';
import type { RunStatus } from '@/lib/types';
import { Avatar } from '@/components/people/Avatar';
import { MarkdownBody } from '@/components/md/MarkdownBody';
import { ExperimentDeleteButton } from '@/components/experiments/ExperimentDeleteButton';
import { ResultDeleteButton } from '@/components/experiments/ResultDeleteButton';
import { ResultAttachmentList } from '@/components/experiments/ResultAttachmentList';
import { relTime, requestNow } from '@/lib/time';

const STATUS_TONE: Record<string, LabelTone> = {
  planned: 'neutral',
  running: 'attention',
  completed: 'success',
  archived: 'done',
};
const STATUS_LABEL: Record<string, string> = {
  planned: '계획',
  running: '진행 중',
  completed: '완료',
  archived: '보관',
};
const KIND_LABEL: Record<string, string> = {
  checkpoint: 'Checkpoint',
  benchmark: 'Benchmark',
  'figure-bundle': 'Figures',
  report: 'Report',
  tool: 'Tool',
};

export async function ExperimentDetailView({ slug, experimentId }: { slug: string; experimentId: string }) {
  const exp = await prisma.experiment.findUnique({
    where: { id: experimentId },
    include: {
      createdBy: { select: { displayName: true, login: true } },
      runs: { orderBy: { startedAt: 'desc' } },
      results: {
        orderBy: { publishedAt: 'desc' },
        include: { attachments: { orderBy: { position: 'asc' } } },
      },
    },
  });
  if (!exp || exp.projectSlug !== slug) return null;

  const now = requestNow();

  return (
    <div className="space-y-6">
      <Link
        href={`/projects/${slug}/experiments`}
        className="inline-flex items-center gap-1 text-sm text-accent-fg hover:underline"
      >
        <ArrowLeftIcon size={14} /> Back to experiments
      </Link>

      <header className="space-y-3 pb-3 border-b border-border-muted">
        <div className="flex items-start gap-3 flex-wrap">
          <LabelChip tone={STATUS_TONE[exp.status] ?? 'neutral'}>
            {STATUS_LABEL[exp.status] ?? exp.status}
          </LabelChip>
          <h1 className="text-2xl font-semibold tracking-tight flex-1 min-w-0">{exp.title}</h1>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href={`/projects/${slug}/experiments/${exp.id}/edit`}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-border-default text-xs text-fg-muted hover:text-accent-fg hover:border-accent-fg"
            >
              <PencilIcon size={12} /> 편집
            </Link>
            <ExperimentDeleteButton slug={slug} id={exp.id} />
          </div>
        </div>
        <div className="text-xs text-fg-muted flex items-center gap-2 flex-wrap">
          <Avatar login={exp.createdByLogin} size={14} />
          <span>{exp.createdBy?.displayName ?? exp.createdByLogin}</span>
          <span>· {relTime(exp.createdAt.toISOString(), now)}</span>
          {exp.sourceWikiEntityId && (
            <>
              <span>·</span>
              <Link
                href={`/projects/${slug}/wiki/${encodeURIComponent(exp.sourceWikiEntityId)}`}
                className="text-accent-fg hover:underline"
              >
                wiki:{exp.sourceWikiEntityId}에서 복사
              </Link>
            </>
          )}
        </div>
      </header>

      {exp.hypothesis && (
        <section>
          <h2 className="text-xs uppercase tracking-wider text-fg-muted font-semibold mb-2">Hypothesis</h2>
          <div className="bg-white border border-border-default rounded-md p-4">
            <MarkdownBody source={exp.hypothesis} size="base" />
          </div>
        </section>
      )}

      {exp.bodyMarkdown && (
        <section>
          <h2 className="text-xs uppercase tracking-wider text-fg-muted font-semibold mb-2">Plan / Notes</h2>
          <div className="bg-white border border-border-default rounded-md p-4">
            <MarkdownBody source={exp.bodyMarkdown} size="base" />
          </div>
        </section>
      )}

      <section>
        <div className="flex items-baseline gap-2 mb-2">
          <h2 className="text-xs uppercase tracking-wider text-fg-muted font-semibold">Runs</h2>
          <span className="text-xs text-fg-muted">{exp.runs.length}</span>
        </div>
        {exp.runs.length === 0 ? (
          <div className="bg-canvas-subtle border border-dashed border-border-default rounded-md p-4 text-sm text-fg-muted">
            이 실험에 묶인 run이 없습니다. <Link href={`/projects/${slug}/experiments`} className="text-accent-fg hover:underline">전체 run 목록</Link>에서 연결하거나 새로 만들 때 이 실험을 선택하세요.
          </div>
        ) : (
          <ul className="bg-white border border-border-default rounded-md list-none pl-0">
            {exp.runs.map(r => (
              <li key={r.id} className="px-4 py-2 flex items-center gap-3 border-b border-border-muted last:border-0">
                <StatusBadge status={r.status as RunStatus} />
                <Link
                  href={`/projects/${slug}/experiments/${r.id}`}
                  className="font-medium text-sm hover:text-accent-fg flex-1 min-w-0 truncate"
                >
                  {r.name}
                </Link>
                <span className="text-xs text-fg-muted shrink-0">
                  {relTime(r.startedAt.toISOString(), now)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <div className="flex items-baseline gap-2 mb-3">
          <h2 className="text-xs uppercase tracking-wider text-fg-muted font-semibold">Results</h2>
          <span className="text-xs text-fg-muted">{exp.results.length}</span>
          <Link
            href={`/projects/${slug}/experiments/${exp.id}/results/new`}
            className="ml-auto inline-flex items-center gap-1 px-3 h-7 rounded-md border border-border-default bg-canvas-subtle hover:bg-canvas-inset text-xs"
          >
            <PlusIcon size={12} /> 결과 추가
          </Link>
        </div>

        {exp.results.length === 0 ? (
          <div className="bg-canvas-subtle border border-dashed border-border-default rounded-md p-4 text-sm text-fg-muted">
            아직 등록된 결과가 없습니다.
          </div>
        ) : (
          <ul className="space-y-3 list-none pl-0">
            {exp.results.map(r => {
              const metrics = parseMetrics(r.metricsJson);
              return (
                <li key={r.id} className="bg-white border border-border-default rounded-md p-4 space-y-2">
                  <div className="flex items-start gap-2 flex-wrap">
                    <LabelChip tone="accent">{KIND_LABEL[r.kind] ?? r.kind}</LabelChip>
                    <h3 className="font-semibold text-sm flex-1">{r.title}</h3>
                    <div className="text-xs text-fg-muted shrink-0 inline-flex items-center gap-2">
                      <Link
                        href={`/projects/${slug}/experiments/${exp.id}/results/${r.id}/edit`}
                        className="hover:text-accent-fg"
                        title="Edit"
                      >
                        <PencilIcon size={12} />
                      </Link>
                      <ResultDeleteButton slug={slug} resultId={r.id} />
                    </div>
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
                  <ResultAttachmentList
                    slug={slug}
                    resultId={r.id}
                    attachments={r.attachments.map(a => ({
                      id: a.id,
                      title: a.title,
                      originalFilename: a.originalFilename,
                      mimeType: a.mimeType,
                      sizeBytes: a.sizeBytes,
                    }))}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function parseMetrics(json: string): { label: string; value: string }[] {
  try {
    const v = JSON.parse(json);
    if (!Array.isArray(v)) return [];
    return v.map(m => ({
      label: String((m as { label?: string }).label ?? ''),
      value: String((m as { value?: string }).value ?? ''),
    })).filter(m => m.label);
  } catch {
    return [];
  }
}
