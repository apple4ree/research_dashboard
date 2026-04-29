// Server-safe helpers + types used by both the page (server) and the
// TaskKanbanLive client component. No 'use client' here — pure utilities.

import type { FlowEvent, TaskBucket, TaskStatus } from '@/lib/types/flow';

export type LiveTask = {
  id: number;
  bucket: TaskBucket;
  title: string;
  goal: string | null;
  group: string | null;
  subtasks: string[];
  status: TaskStatus;
  newness: number;             // 0..1 — fade-in/out for "New!" badge
  latestDate: string;
  eventCount: number;
};

export type EventLink = {
  id: number;
  flowEventId: number;
  todoId: number;
  source: string; // 'llm' | 'manual'
};

export type EventComment = {
  id: number;
  flowEventId: number;
  authorLogin: string | null;
  body: string;
  createdAt: Date;
};

// "New!" 배지 fade 윈도우: 0h = 1.0 (방금 = 풀 색상), 72h = 0 (사라짐).
// 그 사이는 선형 보간.
//
// FlowEvent.date 는 'YYYY-MM-DD HH:mm' (KST 벽시계) 형식 — timezone suffix
// 가 없어서 Node가 server local time(UTC)로 파싱하면 KST 22:45 → UTC 22:45
// 로 해석돼 9시간 미래로 보이는 버그가 있었음. 명시적으로 +09:00 을 붙여
// 항상 KST 로 해석.
const NEW_FADE_HOURS = 72;
const KST_OFFSET = '+09:00';

function ageHoursFromString(eventDate: string): number {
  // Already has timezone? (e.g. ISO with Z or +HH:MM) — use as-is.
  const hasTz = /[zZ]|[+-]\d{2}:?\d{2}$/.test(eventDate);
  const normalized = hasTz
    ? eventDate.replace(' ', 'T')
    : eventDate.replace(' ', 'T') + KST_OFFSET;
  const d = new Date(normalized);
  if (isNaN(d.getTime())) return Infinity;
  return (Date.now() - d.getTime()) / (60 * 60 * 1000);
}

function ageHoursFromDate(d: Date): number {
  return (Date.now() - d.getTime()) / (60 * 60 * 1000);
}

/**
 * 0 (oldest, hide) ~ 1 (just now). Linear over NEW_FADE_HOURS.
 * Future-dated inputs (clock skew, ahead-of-server timestamp) are clamped
 * to "just now" so the badge fades naturally instead of sticking forever.
 */
export function newnessFromString(eventDate: string): number {
  const h = Math.max(0, ageHoursFromString(eventDate));
  if (h >= NEW_FADE_HOURS) return 0;
  return 1 - h / NEW_FADE_HOURS;
}

/** Same but for Date objects. */
export function newnessFromDate(d: Date): number {
  const h = Math.max(0, ageHoursFromDate(d));
  if (h >= NEW_FADE_HOURS) return 0;
  return 1 - h / NEW_FADE_HOURS;
}

function parseSubtasks(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    if (Array.isArray(v)) return v.map(String);
  } catch {
    /* ignore */
  }
  return [];
}

export function buildLiveTasks(
  rawTasks: { id: number; bucket: string; text: string; goal: string | null; group: string | null; subtasks: string | null; status: string }[],
  links: EventLink[],
  events: FlowEvent[],
): LiveTask[] {
  const linksByTask = new Map<number, number[]>();
  for (const l of links) {
    if (!linksByTask.has(l.todoId)) linksByTask.set(l.todoId, []);
    linksByTask.get(l.todoId)!.push(l.flowEventId);
  }
  const eventById = new Map<number, FlowEvent>();
  for (const e of events) if (e.id !== undefined) eventById.set(e.id, e);

  return rawTasks.map(t => {
    const eventIds = linksByTask.get(t.id) ?? [];
    const taskEvents = eventIds.map(id => eventById.get(id)).filter(Boolean) as FlowEvent[];
    const latestDate = taskEvents.reduce<string>((a, e) => (e.date > a ? e.date : a), '');
    return {
      id: t.id,
      bucket: t.bucket as TaskBucket,
      title: t.text,
      goal: t.goal,
      group: t.group,
      subtasks: parseSubtasks(t.subtasks),
      status: (t.status as TaskStatus) ?? 'in_progress',
      newness: latestDate ? newnessFromString(latestDate) : 0,
      latestDate,
      eventCount: taskEvents.length,
    };
  });
}
