import { promises as fs } from 'node:fs';
import path from 'node:path';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { type FlowEvent, type TaskBucket } from '@/lib/types/flow';
import { TaskKanbanLive } from '@/components/flow/TaskKanbanLive';
import { buildLiveTasks, type EventLink, type EventComment } from '@/components/flow/task-kanban-helpers';

const PROGRESS_ROOT_FALLBACK = '/home/dami/wj/Research/StealthyIPIAttack/progress/ys';

async function enrichWithSource(events: FlowEvent[], localPath: string | null): Promise<FlowEvent[]> {
  // Try multiple researcher subdirs under <localPath>/progress/<researcher>/
  const root = localPath ? path.join(localPath, 'progress') : PROGRESS_ROOT_FALLBACK;
  return Promise.all(
    events.map(async e => {
      // Try direct path first, then walk researcher subdirs.
      try {
        const direct = path.join(root, e.source);
        const content = await fs.readFile(direct, 'utf8');
        return { ...e, sourceContent: content };
      } catch {
        try {
          const subs = await fs.readdir(root);
          for (const s of subs) {
            const sub = path.join(root, s, e.source);
            try {
              const content = await fs.readFile(sub, 'utf8');
              return { ...e, sourceContent: content };
            } catch { /* keep looking */ }
          }
        } catch { /* root missing */ }
        return e;
      }
    }),
  );
}

export default async function ProjectFlowPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ task?: string; addTask?: string; editTask?: string; editEvent?: string; edit?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;

  const project = await prisma.project.findUnique({ where: { slug } });
  if (!project) notFound();

  const [rawTasks, rawLinks, rawEvents, rawComments] = await Promise.all([
    prisma.todoItem.findMany({
      where: { projectSlug: slug },
      orderBy: [{ bucket: 'asc' }, { position: 'asc' }],
      select: { id: true, bucket: true, text: true, goal: true, group: true, subtasks: true, status: true },
    }),
    prisma.flowEventTaskLink.findMany({
      where: { projectSlug: slug },
      select: { id: true, flowEventId: true, todoId: true, source: true },
    }),
    prisma.flowEvent.findMany({
      where: { projectSlug: slug },
      orderBy: [{ date: 'desc' }, { position: 'desc' }],
    }),
    prisma.flowEventComment.findMany({
      where: { flowEvent: { projectSlug: slug } },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  const commentsByEventId: Record<number, EventComment[]> = {};
  for (const c of rawComments) {
    if (!commentsByEventId[c.flowEventId]) commentsByEventId[c.flowEventId] = [];
    commentsByEventId[c.flowEventId].push(c);
  }

  const links: EventLink[] = rawLinks;
  const dbEvents: FlowEvent[] = rawEvents.map(r => ({
    id: r.id,
    date: r.date,
    source: r.source,
    title: r.title,
    summary: r.summary,
    tone: r.tone as FlowEvent['tone'],
    bullets: r.bullets ? JSON.parse(r.bullets) : undefined,
    numbers: r.numbers ? JSON.parse(r.numbers) : undefined,
    tags: r.tags ? JSON.parse(r.tags) : undefined,
  }));
  const enrichedEvents = await enrichWithSource(dbEvents, project.localPath);
  const eventIdBySource: Record<string, number> = {};
  for (const r of rawEvents) eventIdBySource[r.source] = r.id;
  const liveTasks = buildLiveTasks(rawTasks, links, enrichedEvents);

  const selectedTaskId = sp.task ? Number(sp.task) : undefined;
  const addTaskBucket = (sp.addTask === 'short' || sp.addTask === 'mid' || sp.addTask === 'long')
    ? (sp.addTask as TaskBucket) : undefined;
  const editTaskId = sp.editTask ? Number(sp.editTask) : undefined;
  const editEventId = sp.editEvent ? Number(sp.editEvent) : undefined;
  const editMode = sp.edit === '1' || Boolean(addTaskBucket) || Boolean(editTaskId) || Boolean(editEventId);

  // Empty state — no tasks AND no events yet for this project.
  if (rawTasks.length === 0 && rawEvents.length === 0) {
    return (
      <div className="max-w-3xl mx-auto py-10 text-center space-y-4">
        <p className="text-sm text-fg-muted">
          이 프로젝트에 아직 task 도 event 도 없습니다.
        </p>
        <p className="text-sm text-fg-muted">
          Claude Code 에서 <code className="bg-canvas-subtle px-1.5 py-0.5 rounded">labhub-flow-ingest {slug}</code> 또는
          {' '}<code className="bg-canvas-subtle px-1.5 py-0.5 rounded">{slug} 의 progress 정리해줘</code> 라고 말해서 ingest 시작.
        </p>
        <p className="text-xs text-fg-muted">
          또는 수동으로 task 를 만들려면 우상단 <Link href={`/projects/${slug}/flow?edit=1`} className="text-accent-fg hover:underline">수정 모드</Link>.
        </p>
      </div>
    );
  }

  return (
    <TaskKanbanLive
      slug={slug}
      tasks={liveTasks}
      links={links}
      events={enrichedEvents}
      eventIdBySource={eventIdBySource}
      commentsByEventId={commentsByEventId}
      selectedTaskId={Number.isFinite(selectedTaskId) ? selectedTaskId : undefined}
      addTaskBucket={addTaskBucket}
      editTaskId={Number.isFinite(editTaskId) ? editTaskId : undefined}
      editEventId={Number.isFinite(editEventId) ? editEventId : undefined}
      editMode={editMode}
    />
  );
}
