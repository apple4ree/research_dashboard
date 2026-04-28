import Link from 'next/link';
import { PlusIcon } from '@primer/octicons-react';
import { prisma } from '@/lib/db';
import { LabelChip, type LabelTone } from '@/components/badges/LabelChip';
import { Avatar } from '@/components/people/Avatar';
import { getRunsByProject, getAllMembers, getAllProjects } from '@/lib/queries';
import { resolveRunContext } from '@/lib/queries/resolve';
import { loadProject } from '@/lib/mock/loaders';
import { requestNow, relTime } from '@/lib/time';
import { ProjectExperimentsView } from '@/components/runs/ProjectExperimentsView';

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

export default async function ProjectExperiments({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await loadProject(params);
  const [experiments, runs, members, projects] = await Promise.all([
    prisma.experiment.findMany({
      where: { projectSlug: slug },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      include: {
        createdBy: { select: { displayName: true, login: true } },
        _count: { select: { runs: true, results: true } },
      },
    }),
    getRunsByProject(slug),
    getAllMembers(),
    getAllProjects(),
  ]);
  const sorted = runs.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const ctx = await resolveRunContext(sorted);
  const now = requestNow();

  return (
    <div className="space-y-8">
      <section>
        <header className="flex items-baseline gap-2 mb-3">
          <h2 className="text-lg font-semibold tracking-tight">Experiments</h2>
          <span className="text-sm text-fg-muted">{experiments.length}</span>
          <Link
            href={`/projects/${slug}/experiments/new`}
            className="ml-auto inline-flex items-center gap-1 px-3 h-8 rounded-md border border-border-default bg-canvas-subtle hover:bg-canvas-inset text-sm"
          >
            <PlusIcon size={14} /> New experiment
          </Link>
        </header>

        {experiments.length === 0 ? (
          <div className="bg-canvas-subtle border border-dashed border-border-default rounded-md p-6 text-sm text-fg-muted">
            아직 등록된 실험 묶음이 없습니다. <Link href={`/projects/${slug}/experiments/new`} className="text-accent-fg hover:underline">새 실험 만들기</Link>를 누르거나, Wiki 항목 페이지에서 <strong>Experiment로 복사</strong> 버튼으로 wiki 내용을 옮길 수 있어요.
          </div>
        ) : (
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 list-none pl-0">
            {experiments.map(e => (
              <li key={e.id}>
                <Link
                  href={`/projects/${slug}/experiments/${e.id}`}
                  className="block bg-white border border-border-default rounded-md p-4 hover:bg-canvas-subtle transition-colors"
                >
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <LabelChip tone={STATUS_TONE[e.status] ?? 'neutral'}>
                      {STATUS_LABEL[e.status] ?? e.status}
                    </LabelChip>
                    <span className="font-semibold text-sm flex-1 truncate">{e.title}</span>
                  </div>
                  <div className="text-xs text-fg-muted flex items-center gap-2 flex-wrap mt-2">
                    <Avatar login={e.createdByLogin} size={14} />
                    <span>{e.createdBy?.displayName ?? e.createdByLogin}</span>
                    <span>· {relTime(e.createdAt.toISOString(), now)}</span>
                    <span className="ml-auto">
                      runs {e._count.runs} · results {e._count.results}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <header className="flex items-baseline gap-2 mb-3">
          <h2 className="text-lg font-semibold tracking-tight">Runs</h2>
          <span className="text-sm text-fg-muted">{runs.length}</span>
          <span className="text-xs text-fg-muted ml-2">
            한 실험에 묶인 / 묶이지 않은 run 모두
          </span>
        </header>
        <ProjectExperimentsView
          projectSlug={slug}
          runs={sorted}
          ctx={ctx}
          members={members}
          projects={projects}
          now={now}
        />
      </section>
    </div>
  );
}
