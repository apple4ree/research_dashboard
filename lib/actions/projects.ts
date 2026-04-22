'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { CURRENT_USER } from '@/lib/queries/constants';

export type CreateProjectState = { error?: string } | null;

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/(^-|-$)/g, '');
}

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/;

export async function createProject(
  _prevState: CreateProjectState,
  formData: FormData,
): Promise<CreateProjectState> {
  const name = String(formData.get('name') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();
  const tagsRaw = String(formData.get('tags') ?? '');
  const pinned = formData.get('pinned') === 'on';
  const slugRaw = String(formData.get('slug') ?? '').trim().toLowerCase();

  if (!name) return { error: 'Name is required.' };
  if (!description) return { error: 'Description is required.' };

  const slug = slugRaw || slugify(name);
  if (!slug) {
    return {
      error:
        'Please fill the Slug field. The Name contains no ASCII letters or digits, so a URL slug could not be derived automatically. Example: "my-new-project".',
    };
  }
  if (!SLUG_PATTERN.test(slug)) {
    return {
      error: `Slug "${slug}" is invalid. Use lowercase English letters (a-z), digits (0-9), and hyphens only. Example: "reasoning-bench-v3".`,
    };
  }

  const existing = await prisma.project.findUnique({ where: { slug } });
  if (existing) {
    return { error: `A project with slug "${slug}" already exists. Pick a different slug.` };
  }

  const tags = tagsRaw.split(',').map(t => t.trim()).filter(Boolean);
  const now = new Date();

  await prisma.project.create({
    data: {
      slug,
      name,
      description,
      tags: JSON.stringify(tags),
      pinned,
      createdAt: now,
      updatedAt: now,
      members: {
        create: [{ memberLogin: CURRENT_USER }],
      },
    },
  });

  revalidatePath('/');
  revalidatePath('/projects');
  redirect(`/projects/${slug}`);
}

export type UpdateProjectState = { error?: string } | null;

export async function updateProjectAction(
  slug: string,
  _prev: UpdateProjectState,
  formData: FormData,
): Promise<UpdateProjectState> {
  const existing = await prisma.project.findUnique({ where: { slug } });
  if (!existing) return { error: `Project "${slug}" not found.` };

  const name = String(formData.get('name') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();
  const tagsRaw = String(formData.get('tags') ?? '');
  const pinned = formData.get('pinned') === 'on';

  if (!name) return { error: 'Name is required.' };
  if (!description) return { error: 'Description is required.' };

  const tags = tagsRaw.split(',').map(t => t.trim()).filter(Boolean);

  await prisma.project.update({
    where: { slug },
    data: {
      name,
      description,
      tags: JSON.stringify(tags),
      pinned,
      updatedAt: new Date(),
    },
  });

  revalidatePath('/');
  revalidatePath('/projects');
  revalidatePath(`/projects/${slug}`);
  redirect(`/projects/${slug}`);
}

export async function deleteProjectAction(slug: string): Promise<void> {
  await prisma.project.delete({ where: { slug } });
  revalidatePath('/');
  revalidatePath('/projects');
  redirect('/projects');
}
