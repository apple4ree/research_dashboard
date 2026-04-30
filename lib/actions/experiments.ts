'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { getCurrentUserLogin } from '@/lib/session';
import { writeAttachmentFile, deleteArtifactFile } from '@/lib/uploads';

export type ExperimentActionState = { error?: string } | null;

const STATUSES = new Set(['planned', 'running', 'completed', 'archived']);
const RESULT_KINDS = new Set(['checkpoint', 'benchmark', 'figure-bundle', 'report', 'tool']);

function s(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === 'string' ? v : '';
}

// ---------------------------- Experiment CRUD ----------------------------

export async function createExperimentAction(
  projectSlug: string,
  _prev: ExperimentActionState,
  fd: FormData,
): Promise<ExperimentActionState> {
  const title = s(fd, 'title').trim();
  const status = s(fd, 'status').trim() || 'planned';
  const hypothesis = s(fd, 'hypothesis');
  const bodyMarkdown = s(fd, 'bodyMarkdown');
  const sourceWikiSlug = s(fd, 'sourceWikiSlug').trim() || null;
  const sourceWikiEntityId = s(fd, 'sourceWikiEntityId').trim() || null;

  if (!title) return { error: 'Title is required.' };
  if (!STATUSES.has(status)) return { error: `Invalid status "${status}".` };

  const author = await getCurrentUserLogin();
  if (!author) return { error: 'Not signed in.' };

  const project = await prisma.project.findUnique({ where: { slug: projectSlug }, select: { slug: true } });
  if (!project) return { error: `Project "${projectSlug}" not found.` };

  const created = await prisma.experiment.create({
    data: {
      projectSlug,
      title,
      status,
      hypothesis,
      bodyMarkdown,
      sourceWikiSlug,
      sourceWikiEntityId,
      createdByLogin: author,
    },
    select: { id: true },
  });

  revalidatePath(`/projects/${projectSlug}/experiments`);
  redirect(`/projects/${projectSlug}/experiments/${created.id}`);
}

export async function updateExperimentAction(
  projectSlug: string,
  id: string,
  _prev: ExperimentActionState,
  fd: FormData,
): Promise<ExperimentActionState> {
  const existing = await prisma.experiment.findUnique({ where: { id } });
  if (!existing) return { error: `Experiment "${id}" not found.` };

  const title = s(fd, 'title').trim();
  const status = s(fd, 'status').trim();
  const hypothesis = s(fd, 'hypothesis');
  const bodyMarkdown = s(fd, 'bodyMarkdown');

  if (!title) return { error: 'Title is required.' };
  if (!STATUSES.has(status)) return { error: `Invalid status "${status}".` };

  await prisma.experiment.update({
    where: { id },
    data: { title, status, hypothesis, bodyMarkdown },
  });

  revalidatePath(`/projects/${projectSlug}/experiments`);
  revalidatePath(`/projects/${projectSlug}/experiments/${id}`);
  redirect(`/projects/${projectSlug}/experiments/${id}`);
}

export async function deleteExperimentAction(projectSlug: string, id: string): Promise<void> {
  // Cascade: removes its results (and their attachment files), runs lose
  // their group pointer (SetNull). Wipe attachment files manually first.
  const results = await prisma.experimentResult.findMany({
    where: { experimentId: id },
    select: { attachments: { select: { storedPath: true } } },
  });
  for (const r of results) {
    for (const a of r.attachments) {
      if (a.storedPath) await deleteArtifactFile(a.storedPath);
    }
  }
  await prisma.experiment.delete({ where: { id } });
  revalidatePath(`/projects/${projectSlug}/experiments`);
  revalidatePath(`/projects/${projectSlug}/results`);
  redirect(`/projects/${projectSlug}/experiments`);
}

// ----------------------- Wiki entity → Experiment 복사 -----------------------

export async function copyWikiEntityToExperimentAction(
  projectSlug: string,
  wikiEntityId: string,
): Promise<void> {
  const author = await getCurrentUserLogin();
  if (!author) throw new Error('Not signed in');

  const entity = await prisma.wikiEntity.findUnique({
    where: { projectSlug_id: { projectSlug, id: wikiEntityId } },
  });
  if (!entity) throw new Error(`Wiki entity "${wikiEntityId}" not found`);

  const created = await prisma.experiment.create({
    data: {
      projectSlug,
      title: entity.name,
      status: 'planned',
      hypothesis: entity.summaryMarkdown,
      bodyMarkdown: entity.bodyMarkdown,
      sourceWikiSlug: projectSlug,
      sourceWikiEntityId: wikiEntityId,
      createdByLogin: author,
    },
    select: { id: true },
  });

  revalidatePath(`/projects/${projectSlug}/experiments`);
  redirect(`/projects/${projectSlug}/experiments/${created.id}`);
}

// ------------------------------ Result CRUD ------------------------------

export async function createResultAction(
  projectSlug: string,
  experimentId: string,
  _prev: ExperimentActionState,
  fd: FormData,
): Promise<ExperimentActionState> {
  const exp = await prisma.experiment.findUnique({ where: { id: experimentId }, select: { id: true } });
  if (!exp) return { error: `Experiment "${experimentId}" not found.` };

  const title = s(fd, 'title').trim();
  const summary = s(fd, 'summary');
  const kind = s(fd, 'kind').trim() || 'benchmark';
  const metricsRaw = s(fd, 'metricsJson');

  if (!title) return { error: 'Title is required.' };
  if (!RESULT_KINDS.has(kind)) return { error: `Invalid kind "${kind}".` };

  let metricsJson = '[]';
  if (metricsRaw.trim()) {
    try {
      const parsed = JSON.parse(metricsRaw);
      if (!Array.isArray(parsed)) throw new Error('metrics must be an array');
      metricsJson = JSON.stringify(
        parsed.map((m: unknown) => {
          const obj = m as { label?: unknown; value?: unknown };
          return {
            label: String(obj.label ?? '').trim(),
            value: String(obj.value ?? '').trim(),
          };
        }).filter(m => m.label),
      );
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Invalid metrics JSON.' };
    }
  }

  await prisma.experimentResult.create({
    data: { experimentId, title, summary, metricsJson, kind },
  });

  revalidatePath(`/projects/${projectSlug}/experiments/${experimentId}`);
  revalidatePath(`/projects/${projectSlug}/results`);
  redirect(`/projects/${projectSlug}/experiments/${experimentId}`);
}

export async function updateResultAction(
  projectSlug: string,
  resultId: string,
  _prev: ExperimentActionState,
  fd: FormData,
): Promise<ExperimentActionState> {
  const existing = await prisma.experimentResult.findUnique({ where: { id: resultId } });
  if (!existing) return { error: `Result "${resultId}" not found.` };

  const title = s(fd, 'title').trim();
  const summary = s(fd, 'summary');
  const kind = s(fd, 'kind').trim() || existing.kind;
  const metricsRaw = s(fd, 'metricsJson');

  if (!title) return { error: 'Title is required.' };
  if (!RESULT_KINDS.has(kind)) return { error: `Invalid kind "${kind}".` };

  let metricsJson = existing.metricsJson;
  if (metricsRaw.trim()) {
    try {
      const parsed = JSON.parse(metricsRaw);
      if (!Array.isArray(parsed)) throw new Error('metrics must be an array');
      metricsJson = JSON.stringify(
        parsed.map((m: unknown) => {
          const obj = m as { label?: unknown; value?: unknown };
          return {
            label: String(obj.label ?? '').trim(),
            value: String(obj.value ?? '').trim(),
          };
        }).filter(m => m.label),
      );
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Invalid metrics JSON.' };
    }
  }

  await prisma.experimentResult.update({
    where: { id: resultId },
    data: { title, summary, metricsJson, kind },
  });

  revalidatePath(`/projects/${projectSlug}/experiments/${existing.experimentId}`);
  revalidatePath(`/projects/${projectSlug}/results`);
  redirect(`/projects/${projectSlug}/experiments/${existing.experimentId}`);
}

export async function deleteResultAction(projectSlug: string, resultId: string): Promise<void> {
  const r = await prisma.experimentResult.findUnique({
    where: { id: resultId },
    select: { experimentId: true, attachments: { select: { storedPath: true } } },
  });
  if (!r) return;
  for (const a of r.attachments) {
    if (a.storedPath) await deleteArtifactFile(a.storedPath);
  }
  await prisma.experimentResult.delete({ where: { id: resultId } });
  revalidatePath(`/projects/${projectSlug}/experiments/${r.experimentId}`);
  revalidatePath(`/projects/${projectSlug}/results`);
}

// ---- Attaching a file to a Result (UI form-action) ----

export async function uploadResultAttachmentAction(
  projectSlug: string,
  resultId: string,
  fd: FormData,
): Promise<void> {
  const fileRaw = fd.get('file');
  if (!(fileRaw instanceof File) || fileRaw.size === 0) return;

  const result = await prisma.experimentResult.findUnique({
    where: { id: resultId },
    select: { id: true, experimentId: true },
  });
  if (!result) return;

  const lastPos = await prisma.experimentResultAttachment.findFirst({
    where: { resultId },
    orderBy: { position: 'desc' },
    select: { position: true },
  });
  const position = (lastPos?.position ?? -1) + 1;

  const titleRaw = fd.get('title');
  const title =
    typeof titleRaw === 'string' && titleRaw.trim() ? titleRaw.trim() : fileRaw.name || 'attachment';

  const created = await prisma.experimentResultAttachment.create({
    data: { resultId, title, storedPath: '', position },
  });

  try {
    const written = await writeAttachmentFile({
      subdir: 'experiment-results',
      scopeSegments: [resultId],
      attachmentId: created.id,
      file: fileRaw,
    });
    await prisma.experimentResultAttachment.update({
      where: { id: created.id },
      data: {
        storedPath: written.storedPath,
        sizeBytes: written.sizeBytes,
        originalFilename: fileRaw.name,
        mimeType: fileRaw.type || 'application/octet-stream',
      },
    });
  } catch {
    await prisma.experimentResultAttachment.delete({ where: { id: created.id } }).catch(() => {});
    return;
  }

  revalidatePath(`/projects/${projectSlug}/experiments/${result.experimentId}`);
}

export async function deleteResultAttachmentAction(
  projectSlug: string,
  attachmentId: number,
): Promise<void> {
  const att = await prisma.experimentResultAttachment.findUnique({
    where: { id: attachmentId },
    select: { storedPath: true, result: { select: { experimentId: true } } },
  });
  if (!att) return;
  if (att.storedPath) await deleteArtifactFile(att.storedPath);
  await prisma.experimentResultAttachment.delete({ where: { id: attachmentId } });
  if (att.result) {
    revalidatePath(`/projects/${projectSlug}/experiments/${att.result.experimentId}`);
  }
}
