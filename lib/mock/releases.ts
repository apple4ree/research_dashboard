import type { Release } from '@/lib/types';

export const releases: Release[] = [
  { id: 'r-001', name: 'reasoning-bench', kind: 'dataset', projectSlug: 'reasoning-bench-v2', version: 'v2.0', publishedAt: '2026-03-15T00:00:00Z', description: '8,400 multi-step reasoning items with human-verified rationales.' },
  { id: 'r-002', name: 'claude-skill-suite', kind: 'tool', projectSlug: 'claude-skill-suite', version: 'v0.4.0', publishedAt: '2026-04-10T00:00:00Z', description: 'Suite of Claude Code skills for research workflows.' },
  { id: 'r-003', name: 'paper-search', kind: 'skill', projectSlug: 'claude-skill-suite', version: 'v0.2.1', publishedAt: '2026-04-15T00:00:00Z', description: 'Claude Code skill for cross-venue paper search.' },
  { id: 'r-004', name: 'long-context-eval', kind: 'dataset', projectSlug: 'long-context-eval', version: 'v1.0', publishedAt: '2026-04-01T00:00:00Z', description: '1M-token recall benchmark with 600 needles.' },
  { id: 'r-005', name: 'KoLogicQA', kind: 'dataset', projectSlug: 'KoLogicQA', version: 'v1.2', publishedAt: '2026-04-21T00:00:00Z', description: '12k Korean logical reasoning items.' },
  { id: 'r-006', name: 'KoLogicQA-eval', kind: 'tool', projectSlug: 'KoLogicQA', version: 'v0.3.0', publishedAt: '2026-04-05T00:00:00Z', description: 'Evaluation harness for KoLogicQA.' },
  { id: 'r-007', name: 'agentic-tool-eval', kind: 'tool', projectSlug: 'agentic-tool-use', version: 'v0.1.0', publishedAt: '2026-04-18T00:00:00Z', description: 'Framework for evaluating agentic tool selection.' },
  { id: 'r-008', name: 'reasoning-probe-kit', kind: 'skill', projectSlug: 'claude-skill-suite', version: 'v0.1.0', publishedAt: '2026-04-19T00:00:00Z', description: 'Claude Code skill for interactive model reasoning probes.' },
];
