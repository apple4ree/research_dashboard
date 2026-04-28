import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { ResultForm } from '@/components/experiments/ResultForm';

export default async function EditResultPage({
  params,
}: {
  params: Promise<{ slug: string; id: string; resultId: string }>;
}) {
  const { slug, id, resultId } = await params;
  const result = await prisma.experimentResult.findUnique({
    where: { id: resultId },
    include: { experiment: { select: { id: true, projectSlug: true } } },
  });
  if (!result || result.experiment.id !== id || result.experiment.projectSlug !== slug) notFound();

  let metrics: { label: string; value: string }[] = [];
  try {
    const v = JSON.parse(result.metricsJson);
    if (Array.isArray(v)) {
      metrics = v.map(m => ({
        label: String((m as { label?: string }).label ?? ''),
        value: String((m as { value?: string }).value ?? ''),
      }));
    }
  } catch { /* keep empty */ }

  return (
    <ResultForm
      mode="edit"
      slug={slug}
      experimentId={id}
      initial={{
        id: result.id,
        title: result.title,
        summary: result.summary,
        kind: result.kind,
        metrics,
      }}
    />
  );
}
