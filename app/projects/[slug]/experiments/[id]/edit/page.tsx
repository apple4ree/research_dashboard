import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { getRunById } from '@/lib/queries';
import { loadProject } from '@/lib/mock/loaders';
import { ExperimentForm } from '@/components/experiments/ExperimentForm';
import { RunEditForm } from '@/components/runs/RunEditForm';

export default async function EditExperimentOrRunPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  await loadProject(Promise.resolve({ slug }));

  // Try Experiment first; fall back to ExperimentRun (legacy).
  const exp = await prisma.experiment.findUnique({ where: { id } });
  if (exp && exp.projectSlug === slug) {
    return (
      <ExperimentForm
        mode="edit"
        slug={slug}
        initial={{
          id: exp.id,
          title: exp.title,
          status: exp.status,
          hypothesis: exp.hypothesis,
          bodyMarkdown: exp.bodyMarkdown,
        }}
      />
    );
  }

  const run = await getRunById(id);
  if (!run || run.projectSlug !== slug) notFound();
  return <RunEditForm run={run} projectSlug={slug} />;
}
