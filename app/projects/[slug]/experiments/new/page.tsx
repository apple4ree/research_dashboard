import { ExperimentForm } from '@/components/experiments/ExperimentForm';

export default async function NewExperimentPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <ExperimentForm mode="create" slug={slug} />;
}
