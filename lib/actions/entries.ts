'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/db';
import { getCurrentUserLogin } from '@/lib/session';
import {
  deleteArtifactFile,
  writeArtifactFile,
  MAX_UPLOAD_BYTES,
} from '@/lib/uploads';
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
  /** db row id when this is a kept existing artifact; absent for new rows */
  id?: number;
  type: ArtifactType;
  title: string;
  /** for url-mode: the external URL; for file-mode: '' (server fills in /api/uploads/<id>) */
  href: string;
  /** 'url' | 'file' — file-mode artifacts must have a corresponding artifact_<index>_file FormData entry */
  mode: 'url' | 'file';
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
    const mode = a.mode === 'file' ? 'file' : 'url';
    const href = typeof a.href === 'string' ? a.href.trim() : '';
    if (mode === 'url' && !href) throw new Error(`Artifact ${i}: URL required for url-mode artifact`);
    const id = typeof a.id === 'number' && Number.isFinite(a.id) ? a.id : undefined;
    return { id, type: a.type, title: a.title.trim(), href, mode };
  });
}

/** Return File entry for a given artifact index, or null if absent. */
function readArtifactFile(formData: FormData, index: number): File | null {
  const v = formData.get(`artifact_${index}_file`);
  return v instanceof File && v.size > 0 ? v : null;
}

/** Persist a single file-mode artifact: insert row, write disk, update href/storedPath. */
async function persistFileArtifact(
  entryId: string,
  position: number,
  artifact: ArtifactInput,
  file: File,
): Promise<void> {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(
      `Artifact "${artifact.title}": file too large (${file.size} bytes; max ${MAX_UPLOAD_BYTES})`,
    );
  }
  const created = await prisma.entryArtifact.create({
    data: {
      entryId,
      type: artifact.type,
      title: artifact.title,
      href: '',
      position,
    },
  });
  const { storedPath, sizeBytes } = await writeArtifactFile(entryId, created.id, file);
  await prisma.entryArtifact.update({
    where: { id: created.id },
    data: {
      storedPath,
      sizeBytes,
      originalFilename: file.name,
      mimeType: file.type || 'application/octet-stream',
      href: `/api/uploads/${created.id}`,
    },
  });
}

export async function createEntryAction(
  projectSlug: string,
  _prev: EntryActionState,
  formData: FormData,
): Promise<EntryActionState> {
  const dateStr = String(formData.get('date') ?? '').trim();
  const type = String(formData.get('type') ?? '') as EntryType;
  const authorLoginRaw = String(formData.get('authorLogin') ?? '').trim();
  const authorLogin = authorLoginRaw || (await getCurrentUserLogin());
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

  // Pre-flight check: every file-mode artifact has a corresponding File.
  for (let i = 0; i < artifacts.length; i++) {
    if (artifacts[i].mode === 'file' && !readArtifactFile(formData, i)) {
      return { error: `Artifact "${artifacts[i].title}": file is missing from the form submission.` };
    }
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
      slides: {
        create: slides.map((s, i) => ({ position: i + 1, ...s })),
      },
    },
  });

  // Insert artifacts: URL-mode in createMany, file-mode one-by-one (needs id-then-write).
  for (let i = 0; i < artifacts.length; i++) {
    const a = artifacts[i];
    if (a.mode === 'file') {
      const file = readArtifactFile(formData, i)!;
      try {
        await persistFileArtifact(id, i, a, file);
      } catch (err) {
        return { error: err instanceof Error ? err.message : `Artifact ${i}: write failed.` };
      }
    } else {
      await prisma.entryArtifact.create({
        data: { entryId: id, type: a.type, title: a.title, href: a.href, position: i },
      });
    }
  }

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
  const authorLoginRaw = String(formData.get('authorLogin') ?? '').trim();
  const authorLogin = authorLoginRaw || (await getCurrentUserLogin());
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

  for (let i = 0; i < artifacts.length; i++) {
    if (artifacts[i].mode === 'file' && artifacts[i].id === undefined && !readArtifactFile(formData, i)) {
      return { error: `Artifact "${artifacts[i].title}": file is missing from the form submission.` };
    }
  }

  const tags = tagsRaw.split(',').map(t => t.trim()).filter(Boolean);

  // Compute artifact diff: kept ids (from form, with id present), newly added (no id),
  // and removed (existing rows whose id is no longer in the form).
  const existingArtifacts = await prisma.entryArtifact.findMany({
    where: { entryId },
    select: { id: true, storedPath: true },
  });
  const keptIds = new Set(
    artifacts.map(a => a.id).filter((x): x is number => typeof x === 'number'),
  );
  const removed = existingArtifacts.filter(a => !keptIds.has(a.id));

  // Slides: still wholesale replace (cheap, no files).
  await prisma.$transaction([
    prisma.entrySlide.deleteMany({ where: { entryId } }),
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
  ]);

  // Delete removed artifacts and their files.
  for (const r of removed) {
    if (r.storedPath) await deleteArtifactFile(r.storedPath);
    await prisma.entryArtifact.delete({ where: { id: r.id } });
  }

  // Walk artifacts in form order. Position = index.
  for (let i = 0; i < artifacts.length; i++) {
    const a = artifacts[i];
    if (a.id !== undefined) {
      // Kept artifact — update title/type/position/href (when url-mode).
      const data: Record<string, unknown> = {
        type: a.type,
        title: a.title,
        position: i,
      };
      if (a.mode === 'url') data.href = a.href;
      await prisma.entryArtifact.update({ where: { id: a.id }, data });
    } else if (a.mode === 'file') {
      const file = readArtifactFile(formData, i)!;
      try {
        await persistFileArtifact(entryId, i, a, file);
      } catch (err) {
        return { error: err instanceof Error ? err.message : `Artifact ${i}: write failed.` };
      }
    } else {
      await prisma.entryArtifact.create({
        data: { entryId, type: a.type, title: a.title, href: a.href, position: i },
      });
    }
  }

  revalidatePath(`/projects/${projectSlug}`);
  revalidatePath('/');
  redirect(`/projects/${projectSlug}`);
}

export async function deleteEntryAction(
  projectSlug: string,
  entryId: string,
): Promise<void> {
  // Clean up any stored files before the cascading row delete.
  const artifacts = await prisma.entryArtifact.findMany({
    where: { entryId },
    select: { storedPath: true },
  });
  for (const a of artifacts) {
    if (a.storedPath) await deleteArtifactFile(a.storedPath);
  }
  await prisma.researchEntry.delete({ where: { id: entryId } });
  revalidatePath(`/projects/${projectSlug}`);
  revalidatePath('/');
}
