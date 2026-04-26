// Shared types for the Flow J view (event timeline + task kanban).
// Pure types — no runtime logic, safe to import from server or client.

export type FlowEventTone = 'milestone' | 'pivot' | 'result' | 'incident' | 'design' | 'deprecated';

export type TaskBucket = 'short' | 'mid' | 'long';
export type TaskStatus = 'pending' | 'in_progress' | 'done';

export type FlowEvent = {
  id?: number;             // FlowEvent.id from DB (undefined for in-memory only)
  date: string;            // 'YYYY-MM-DD HH:mm KST'
  source: string;          // progress filename
  title: string;
  tone: FlowEventTone;
  summary: string;
  bullets?: string[];
  numbers?: { label: string; value: string }[];
  tags?: string[];
  sourceContent?: string;  // optional full file body, filled at request time
};
