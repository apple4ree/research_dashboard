import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { loadProject } from '@/lib/mock/loaders';
import { ExperimentDetailView } from '@/components/experiments/ExperimentDetailView';
import { RunDetailView } from '@/components/runs/RunDetailView';

export default async function ProjectExperimentOrRunDetail({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const { project } = await loadProject(Promise.resolve({ slug }));

  // Same URL surface serves two kinds of details: the new Experiment
  // group (cuid) or a legacy ExperimentRun (e.g. "exp-1404"). Look up
  // the cheaper one first; fall through to the run renderer.
  const experiment = await prisma.experiment.findUnique({ where: { id }, select: { id: true, projectSlug: true } });
  if (experiment && experiment.projectSlug === slug) {
    return <ExperimentDetailView slug={slug} experimentId={id} />;
  }

  const view = await RunDetailView({ slug, id, projectName: project.name });
  if (!view) notFound();
  return view;
}
