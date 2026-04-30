'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import {
  parseRepo,
  fetchRepo,
  fetchReadme,
  fetchReleases,
} from '@/lib/github/client';

export type ConnectGitHubState = { error?: string; ok?: boolean } | null;

function sanitizeRepo(raw: string): string | null {
  const parsed = parseRepo(raw);
  if (!parsed) return null;
  return `${parsed.owner}/${parsed.repo}`;
}

export async function connectGitHubRepoAction(
  slug: string,
  _prev: ConnectGitHubState,
  formData: FormData,
): Promise<ConnectGitHubState> {
  const raw = String(formData.get('githubRepo') ?? '').trim();
  if (!raw) return { error: 'Repository is required. Format: owner/repo' };
  const clean = sanitizeRepo(raw);
  if (!clean) {
    return {
      error: 'Invalid repo format. Use "owner/repo" or a github.com URL.',
    };
  }
  try {
    await fetchRepo(clean); // verify it exists and is reachable
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Failed to reach GitHub.',
    };
  }
  await prisma.project.update({
    where: { slug },
    data: { githubRepo: clean },
  });
  revalidatePath(`/projects/${slug}`);
  revalidatePath(`/projects/${slug}/edit`);
  return { ok: true };
}

export async function disconnectGitHubRepoAction(slug: string): Promise<void> {
  // Clear the repo linkage and README. We intentionally keep existing
  // release rows (including their externalId) so history stays traceable
  // even after disconnect; new syncs can pick them up again by externalId
  // if the project is reconnected to the same repo.
  await prisma.project.update({
    where: { slug },
    data: { githubRepo: null, readmeMarkdown: null },
  });
  revalidatePath(`/projects/${slug}`);
  revalidatePath(`/projects/${slug}/edit`);
}

export interface SyncResult {
  ok: boolean;
  error?: string;
  releasesUpserted?: number;
  releasesSkipped?: number;
  syncedAt?: string;
}

export async function syncProjectFromGitHubAction(
  slug: string,
): Promise<SyncResult> {
  const project = await prisma.project.findUnique({ where: { slug } });
  if (!project) return { ok: false, error: 'Project not found.' };
  if (!project.githubRepo) {
    return { ok: false, error: 'Project is not connected to a GitHub repo.' };
  }

  try {
    const [repo, readme, releases] = await Promise.all([
      fetchRepo(project.githubRepo),
      fetchReadme(project.githubRepo),
      fetchReleases(project.githubRepo, 30),
    ]);

    const now = new Date();

    // Merge repo topics into the existing project tags (deduplicated).
    const existingTags = (JSON.parse(project.tags) as string[]).map(t => t.trim()).filter(Boolean);
    const mergedTags = Array.from(new Set([...existingTags, ...(repo.topics ?? [])]));

    await prisma.project.update({
      where: { slug },
      data: {
        description: repo.description ?? project.description,
        tags: JSON.stringify(mergedTags),
        readmeMarkdown: readme ?? project.readmeMarkdown,
        lastSyncedAt: now,
        updatedAt: now,
      },
    });

    let upserted = 0;
    let skipped = 0;
    for (const rel of releases) {
      const externalId = `gh:${project.githubRepo}/releases/${rel.id}`;
      try {
        await prisma.release.upsert({
          where: { externalId },
          update: {
            name: rel.name || rel.tag_name,
            version: rel.tag_name,
            publishedAt: rel.published_at ? new Date(rel.published_at) : now,
            description: rel.body || null,
            downloadUrl: rel.html_url,
            source: 'github',
            lastSyncedAt: now,
          },
          create: {
            id: `r-gh-${rel.id}`,
            name: rel.name || rel.tag_name,
            kind: 'tool',
            projectSlug: slug,
            version: rel.tag_name,
            publishedAt: rel.published_at ? new Date(rel.published_at) : now,
            description: rel.body || null,
            downloadUrl: rel.html_url,
            source: 'github',
            externalId,
            lastSyncedAt: now,
          },
        });
        upserted++;
      } catch {
        skipped++;
      }
    }

    revalidatePath(`/projects/${slug}`);
    revalidatePath(`/projects/${slug}/results`);
    revalidatePath(`/projects/${slug}/edit`);
    return {
      ok: true,
      releasesUpserted: upserted,
      releasesSkipped: skipped,
      syncedAt: now.toISOString(),
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Sync failed.',
    };
  }
}
