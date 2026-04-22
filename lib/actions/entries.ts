'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/db';
import { CURRENT_USER } from '@/lib/queries/constants';
import type { EntryType, SlideKind, ArtifactType } from '@/lib/types';

export type EntryActionState = { error?: string } | null;

const ENTRY_TYPES: readonly EntryType[] = ['meeting', 'report', 'experiment', 'review'];
const SLIDE_KINDS: readonly SlideKind[] = ['discovery', 'failure', 'implement', 'question', 'next', 'metric'];
const ARTIFACT_TYPES: readonly ArtifactType[] = ['notebook', 'figure', 'sheet', 'csv', 'doc', 'slide'];

interface SlideInput {
  kind: SlideKind;
  title: string;
  body: string;
  chip?: string;
  metricsJson?: string;
  code?: string;
}

interface ArtifactInput {
  type: ArtifactType;
  title: string;
  href: string;
}

function parseSlides(raw: string): SlideInput[] {
  if (!raw.trim()) return [];
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error('Slides must be an array');
  return parsed.map((s, i) => {
    if (!SLIDE_KINDS.includes(s.kind)) throw new Error(`Slide ${i}: invalid kind "${s.kind}"`);
    if (typeof s.title !== 'string' || !s.title.trim()) throw new Error(`Slide ${i}: title required`);
    if (typeof s.body !== 'string') throw new Error(`Slide ${i}: body required`);
    const out: SlideInput = { kind: s.kind, title: s.title.trim(), body: s.body };
    if (s.chip) out.chip = String(s.chip);
    if (s.metricsJson) out.metricsJson = String(s.metricsJson);
    if (s.code) out.code = String(s.code);
    return out;
  });
}

function parseArtifacts(raw: string): ArtifactInput[] {
  if (!raw.trim()) return [];
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error('Artifacts must be an array');
  return parsed.map((a, i) => {
    if (!ARTIFACT_TYPES.includes(a.type)) throw new Error(`Artifact ${i}: invalid type "${a.type}"`);
    if (typeof a.title !== 'string' || !a.title.trim()) throw new Error(`Artifact ${i}: title required`);
    if (typeof a.href !== 'string') throw new Error(`Artifact ${i}: href required`);
    return { type: a.type, title: a.title.trim(), href: a.href.trim() };
  });
}

export async function createEntryAction(
  projectSlug: string,
  _prev: EntryActionState,
  formData: FormData,
): Promise<EntryActionState> {
  const dateStr = String(formData.get('date') ?? '').trim();
  const type = String(formData.get('type') ?? '') as EntryType;
  const authorLogin = String(formData.get('authorLogin') ?? '').trim() || CURRENT_USER;
  const title = String(formData.get('title') ?? '').trim();
  const summary = String(formData.get('summary') ?? '').trim();
  const tagsRaw = String(formData.get('tags') ?? '');
  const bodyMarkdown = String(formData.get('bodyMarkdown') ?? '');
  const slidesRaw = String(formData.get('slidesJson') ?? '');
  const artifactsRaw = String(formData.get('artifactsJson') ?? '');

  if (!dateStr) return { error: 'Date is required.' };
  if (!ENTRY_TYPES.includes(type)) return { error: `Invalid type "${type}".` };
  if (!title) return { error: 'Title is required.' };
  if (!summary) return { error: 'Summary is required.' };

  const parsedDate = new Date(dateStr);
  if (Number.isNaN(parsedDate.getTime())) return { error: `Invalid date "${dateStr}".` };

  const project = await prisma.project.findUnique({ where: { slug: projectSlug } });
  if (!project) return { error: `Project "${projectSlug}" not found.` };
  const author = await prisma.member.findUnique({ where: { login: authorLogin } });
  if (!author) return { error: `Author "${authorLogin}" not found.` };

  let slides: SlideInput[];
  let artifacts: ArtifactInput[];
  try {
    slides = parseSlides(slidesRaw);
    artifacts = parseArtifacts(artifactsRaw);
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Invalid slides/artifacts JSON.' };
  }

  const tags = tagsRaw.split(',').map(t => t.trim()).filter(Boolean);
  const id = `e-${randomUUID().slice(0, 8)}`;

  await prisma.researchEntry.create({
    data: {
      id,
      projectSlug,
      date: parsedDate,
      type,
      authorLogin,
      title,
      summary,
      tags: JSON.stringify(tags),
      bodyMarkdown,
      // position 0 is the implicit summary slide; narrative slides start at 1.
      slides: {
        create: slides.map((s, i) => ({ position: i + 1, ...s })),
      },
      artifacts: {
        create: artifacts.map((a, i) => ({ position: i, ...a })),
      },
    },
  });

  revalidatePath(`/projects/${projectSlug}`);
  revalidatePath('/');
  redirect(`/projects/${projectSlug}`);
}

export async function updateEntryAction(
  projectSlug: string,
  entryId: string,
  _prev: EntryActionState,
  formData: FormData,
): Promise<EntryActionState> {
  const existing = await prisma.researchEntry.findUnique({ where: { id: entryId } });
  if (!existing) return { error: `Entry "${entryId}" not found.` };

  const dateStr = String(formData.get('date') ?? '').trim();
  const type = String(formData.get('type') ?? '') as EntryType;
  const authorLogin = String(formData.get('authorLogin') ?? '').trim() || CURRENT_USER;
  const title = String(formData.get('title') ?? '').trim();
  const summary = String(formData.get('summary') ?? '').trim();
  const tagsRaw = String(formData.get('tags') ?? '');
  const bodyMarkdown = String(formData.get('bodyMarkdown') ?? '');
  const slidesRaw = String(formData.get('slidesJson') ?? '');
  const artifactsRaw = String(formData.get('artifactsJson') ?? '');

  if (!dateStr) return { error: 'Date is required.' };
  if (!ENTRY_TYPES.includes(type)) return { error: `Invalid type "${type}".` };
  if (!title) return { error: 'Title is required.' };
  if (!summary) return { error: 'Summary is required.' };

  const parsedDate = new Date(dateStr);
  if (Number.isNaN(parsedDate.getTime())) return { error: `Invalid date "${dateStr}".` };

  const author = await prisma.member.findUnique({ where: { login: authorLogin } });
  if (!author) return { error: `Author "${authorLogin}" not found.` };

  let slides: SlideInput[];
  let artifacts: ArtifactInput[];
  try {
    slides = parseSlides(slidesRaw);
    artifacts = parseArtifacts(artifactsRaw);
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Invalid slides/artifacts JSON.' };
  }

  const tags = tagsRaw.split(',').map(t => t.trim()).filter(Boolean);

  await prisma.$transaction([
    prisma.entrySlide.deleteMany({ where: { entryId } }),
    prisma.entryArtifact.deleteMany({ where: { entryId } }),
    prisma.researchEntry.update({
      where: { id: entryId },
      data: {
        date: parsedDate,
        type,
        authorLogin,
        title,
        summary,
        tags: JSON.stringify(tags),
        bodyMarkdown,
      },
    }),
    prisma.entrySlide.createMany({
      data: slides.map((s, i) => ({ entryId, position: i + 1, ...s })),
    }),
    prisma.entryArtifact.createMany({
      data: artifacts.map((a, i) => ({ entryId, position: i, ...a })),
    }),
  ]);

  revalidatePath(`/projects/${projectSlug}`);
  revalidatePath('/');
  redirect(`/projects/${projectSlug}`);
}

export async function deleteEntryAction(
  projectSlug: string,
  entryId: string,
): Promise<void> {
  await prisma.researchEntry.delete({ where: { id: entryId } });
  revalidatePath(`/projects/${projectSlug}`);
  revalidatePath('/');
}
