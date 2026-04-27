'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { logActivity } from '@/lib/actions/events';
import { getCurrentUserLogin } from '@/lib/session';

const ALLOWED_STATUSES = new Set(['active', 'deprecated', 'superseded']);

function s(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === 'string' ? v : '';
}

export async function updateWikiEntityAction(fd: FormData) {
  const slug = s(fd, 'projectSlug');
  const id = s(fd, 'id');
  const name = s(fd, 'name').trim();
  const type = s(fd, 'type').trim();
  const status = s(fd, 'status').trim();
  const summaryMarkdown = s(fd, 'summaryMarkdown');
  const bodyMarkdown = s(fd, 'bodyMarkdown');
  const redirectTo = s(fd, 'redirectTo');

  if (!slug || !id || !name) return;

  const existing = await prisma.wikiEntity.findUnique({
    where: { projectSlug_id: { projectSlug: slug, id } },
    select: { id: true },
  });
  if (!existing) return;

  const validTypes = await prisma.wikiType.findMany({
    where: { projectSlug: slug },
    select: { key: true },
  });
  const keys = validTypes.map(t => t.key);
  if (!keys.includes(type)) return;

  if (!ALLOWED_STATUSES.has(status)) return;

  await prisma.wikiEntity.update({
    where: { projectSlug_id: { projectSlug: slug, id } },
    data: {
      name,
      type,
      status,
      summaryMarkdown,
      bodyMarkdown,
      lastSyncedAt: new Date(),
    },
  });

  const actor = await getCurrentUserLogin();
  if (actor) {
    await logActivity({
      type: 'wiki_entity',
      actorLogin: actor,
      projectSlug: slug,
      payload: { entityId: id, action: 'updated' },
    });
  }

  revalidatePath(`/projects/${slug}/wiki`);
  revalidatePath(`/projects/${slug}/wiki/${id}`);

  if (redirectTo) redirect(redirectTo);
}

export async function deleteWikiEntityAction(fd: FormData) {
  const slug = s(fd, 'projectSlug');
  const id = s(fd, 'id');
  const redirectTo = s(fd, 'redirectTo');
  if (!slug || !id) return;

  const existing = await prisma.wikiEntity.findUnique({
    where: { projectSlug_id: { projectSlug: slug, id } },
    select: { id: true },
  });
  if (!existing) return;

  await prisma.wikiEntity.delete({
    where: { projectSlug_id: { projectSlug: slug, id } },
  });

  const actor = await getCurrentUserLogin();
  if (actor) {
    await logActivity({
      type: 'wiki_entity',
      actorLogin: actor,
      projectSlug: slug,
      payload: { entityId: id, action: 'deleted' },
    });
  }

  revalidatePath(`/projects/${slug}/wiki`);

  if (redirectTo) redirect(redirectTo);
}
