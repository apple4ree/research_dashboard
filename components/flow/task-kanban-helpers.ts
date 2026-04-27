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
// 그 사이는 선형 보간. event date 가 'YYYY-MM-DD HH:mm' (KST local) 형식이라
// 'T' 로 교체해서 Date 로 파싱.
const NEW_FADE_HOURS = 72;

function ageHoursFromString(eventDate: string): number {
  const d = new Date(eventDate.replace(' ', 'T'));
  if (isNaN(d.getTime())) return Infinity;
  return (Date.now() - d.getTime()) / (60 * 60 * 1000);
}

function ageHoursFromDate(d: Date): number {
  return (Date.now() - d.getTime()) / (60 * 60 * 1000);
}

/** 0 (oldest, hide) ~ 1 (just now). Linear over NEW_FADE_HOURS. */
export function newnessFromString(eventDate: string): number {
  const h = ageHoursFromString(eventDate);
  if (h < 0) return 1;
  if (h >= NEW_FADE_HOURS) return 0;
  return 1 - h / NEW_FADE_HOURS;
}

/** Same but for Date objects (e.g. WikiEntity.lastSyncedAt). */
export function newnessFromDate(d: Date): number {
  const h = ageHoursFromDate(d);
  if (h < 0) return 1;
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
