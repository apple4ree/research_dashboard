import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeftIcon, LockIcon, LinkExternalIcon, MarkGithubIcon } from '@primer/octicons-react';
import { getProjectBySlug, getReleaseById } from '@/lib/queries';
import { ReleaseForm } from '@/components/project/ReleaseForm';

export default async function EditReleasePage({
  params,
}: {
  params: Promise<{ slug: string; releaseId: string }>;
}) {
  const { slug, releaseId } = await params;
  const project = await getProjectBySlug(slug);
  if (!project) notFound();

  const release = await getReleaseById(releaseId);
  if (!release || release.projectSlug !== slug) notFound();

  if (release.source === 'github') {
    return (
      <div className="max-w-2xl">
        <Link
          href={`/projects/${slug}/results`}
          className="inline-flex items-center gap-1 text-sm text-accent-fg hover:underline mb-4"
        >
          <ArrowLeftIcon size={14} /> Back to releases
        </Link>
        <h1 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <LockIcon size={16} /> Release is locked
        </h1>
        <div className="bg-white border border-border-default rounded-md p-6 space-y-3">
          <p className="text-sm text-fg-muted">
            This release was synced from GitHub and cannot be edited here.
            Manage it on GitHub instead and re-sync the project to pick up changes.
          </p>
          <div className="flex items-center gap-2 text-sm">
            <MarkGithubIcon size={14} className="text-fg-muted" />
            <span className="font-medium">{release.name}</span>
            <span className="text-xs text-fg-muted">{release.version}</span>
          </div>
          {release.downloadUrl && (
            <a
              href={release.downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-accent-fg text-sm hover:underline"
            >
              View on GitHub <LinkExternalIcon size={12} />
            </a>
          )}
        </div>
      </div>
    );
  }

  return <ReleaseForm mode="edit" projectSlug={slug} initial={release} />;
}
