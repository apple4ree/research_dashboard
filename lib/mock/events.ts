import type { ActivityEvent } from '@/lib/types';

export const events: ActivityEvent[] = [
  { id: 'e-001', type: 'paper', actorLogin: 'jihoon', projectSlug: 'reasoning-bench-v2', createdAt: '2026-04-22T05:30:00Z', payload: { paperId: 'p-001', action: 'uploaded_draft', version: 3 } },
  { id: 'e-002', type: 'experiment', actorLogin: 'minji', projectSlug: 'long-context-eval', createdAt: '2026-04-22T05:30:00Z', payload: { runId: 'exp-1428', action: 'started' } },
  { id: 'e-003', type: 'release', actorLogin: 'jiwoo', projectSlug: 'KoLogicQA', createdAt: '2026-04-21T10:00:00Z', payload: { releaseId: 'r-005', action: 'published' } },
  { id: 'e-004', type: 'discussion', actorLogin: 'sungmin', createdAt: '2026-04-21T11:00:00Z', payload: { discussionId: 'd-004', action: 'opened' } },
  { id: 'e-005', type: 'experiment', actorLogin: 'junho', projectSlug: 'reasoning-bench-v2', createdAt: '2026-04-20T22:00:00Z', payload: { runId: 'exp-1425', action: 'failed' } },
  { id: 'e-006', type: 'paper', actorLogin: 'sungmin', projectSlug: 'alignment-probes', createdAt: '2026-04-20T18:00:00Z', payload: { paperId: 'p-008', action: 'created' } },
  { id: 'e-007', type: 'release', actorLogin: 'dgu', projectSlug: 'claude-skill-suite', createdAt: '2026-04-19T20:00:00Z', payload: { releaseId: 'r-008', action: 'published' } },
  { id: 'e-008', type: 'project', actorLogin: 'yeji', projectSlug: 'agentic-tool-use', createdAt: '2026-04-18T14:00:00Z', payload: { action: 'updated_readme' } },
  { id: 'e-009', type: 'discussion', actorLogin: 'haneul', createdAt: '2026-04-18T14:00:00Z', payload: { discussionId: 'd-002', action: 'opened' } },
  { id: 'e-010', type: 'experiment', actorLogin: 'minji', projectSlug: 'long-context-eval', createdAt: '2026-04-21T18:00:00Z', payload: { runId: 'exp-1427', action: 'succeeded' } },
  { id: 'e-011', type: 'paper', actorLogin: 'haneul', projectSlug: 'long-context-eval', createdAt: '2026-04-17T10:00:00Z', payload: { paperId: 'p-004', action: 'published' } },
  { id: 'e-012', type: 'release', actorLogin: 'dgu', projectSlug: 'claude-skill-suite', createdAt: '2026-04-15T10:00:00Z', payload: { releaseId: 'r-003', action: 'published' } },
];
