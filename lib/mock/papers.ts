import type { Paper } from '@/lib/types';

export const papers: Paper[] = [
  { id: 'p-001', title: 'Probing Reasoning Depth in Frontier LLMs', authorLogins: ['jihoon','sooyoung','junho'], projectSlug: 'reasoning-bench-v2', stage: 'writing', venue: 'NeurIPS 2026', deadline: '2026-05-04T23:59:00Z', draftUrl: 'https://example.com/drafts/p-001.pdf' },
  { id: 'p-002', title: 'A Benchmark for Multi-Hop Arithmetic Reasoning', authorLogins: ['junho','sooyoung'], projectSlug: 'reasoning-bench-v2', stage: 'review', venue: 'ICML 2026', draftUrl: 'https://example.com/drafts/p-002.pdf' },
  { id: 'p-003', title: 'Diagnostic Probes for Alignment Failures', authorLogins: ['sungmin','sooyoung'], projectSlug: 'alignment-probes', stage: 'experiments', venue: 'ICLR 2027' },
  { id: 'p-004', title: '1M-Token Coherence: A Long-Context Benchmark', authorLogins: ['haneul','minji'], projectSlug: 'long-context-eval', stage: 'published', venue: 'COLM 2026', pdfUrl: 'https://example.com/papers/p-004.pdf' },
  { id: 'p-005', title: 'KoLogicQA: Korean Logical Reasoning at Scale', authorLogins: ['jiwoo','nari'], projectSlug: 'KoLogicQA', stage: 'writing', venue: 'EMNLP 2026', deadline: '2026-06-15T23:59:00Z' },
  { id: 'p-006', title: 'Agentic Tool Use: An Evaluation Framework', authorLogins: ['yeji','taehyun','eunseo'], projectSlug: 'agentic-tool-use', stage: 'idea' },
  { id: 'p-007', title: 'When Chains Break: Reasoning Error Taxonomy', authorLogins: ['jihoon'], projectSlug: 'reasoning-bench-v2', stage: 'idea' },
  { id: 'p-008', title: 'Refusal Patterns in Aligned Models', authorLogins: ['sungmin'], projectSlug: 'alignment-probes', stage: 'writing', venue: 'NeurIPS 2026', deadline: '2026-05-04T23:59:00Z' },
  { id: 'p-009', title: 'Ultra-Long Retrieval Without Fine-tuning', authorLogins: ['haneul'], projectSlug: 'long-context-eval', stage: 'review', venue: 'ACL 2026' },
  { id: 'p-010', title: 'Skills as Primitives for Research Agents', authorLogins: ['yeji','dgu'], projectSlug: 'claude-skill-suite', stage: 'writing', venue: 'NeurIPS 2026 Workshop' },
  { id: 'p-011', title: 'Cross-Lingual Reasoning Transfer', authorLogins: ['jiwoo','sooyoung'], projectSlug: 'KoLogicQA', stage: 'experiments' },
  { id: 'p-012', title: 'Tool Selection Policies for LLM Agents', authorLogins: ['taehyun','yeji'], projectSlug: 'agentic-tool-use', stage: 'experiments' },
  { id: 'p-013', title: 'Failure-Mode Taxonomy for Aligned LLMs', authorLogins: ['sungmin','sooyoung'], projectSlug: 'alignment-probes', stage: 'published', venue: 'TMLR 2026', pdfUrl: 'https://example.com/papers/p-013.pdf' },
  { id: 'p-014', title: 'Context-Scaling Laws for Recall', authorLogins: ['minji','haneul'], projectSlug: 'long-context-eval', stage: 'writing', venue: 'ICLR 2027' },
  { id: 'p-015', title: 'Evaluation Harness for Claude Skills', authorLogins: ['dgu'], projectSlug: 'claude-skill-suite', stage: 'idea' },
];
