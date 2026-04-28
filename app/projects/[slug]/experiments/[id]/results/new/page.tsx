import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { ResultForm } from '@/components/experiments/ResultForm';

export default async function NewResultPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const exp = await prisma.experiment.findUnique({ where: { id }, select: { id: true, projectSlug: true } });
  if (!exp || exp.projectSlug !== slug) notFound();
  return <ResultForm mode="create" slug={slug} experimentId={id} />;
}
