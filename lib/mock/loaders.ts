import { notFound } from 'next/navigation';
import { getProjectBySlug } from './index';
import type { Project } from '@/lib/types';

export async function loadProject(params: Promise<{ slug: string }>): Promise<{ slug: string; project: Project }> {
  const { slug } = await params;
  const project = getProjectBySlug(slug);
  if (!project) notFound();
  return { slug, project };
}
