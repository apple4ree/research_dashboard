// Helpers + TimelineCard for the Flow J view (event timeline). Renders a
// single FlowEvent as a card with date/tone/title/summary/bullets/numbers
// and an optional collapsible source preview.

import { LabelChip, type LabelTone } from '@/components/badges/LabelChip';
import { MarkdownBody } from '@/components/md/MarkdownBody';
import { newnessFromString } from '@/components/flow/task-kanban-helpers';
import {
  type FlowEvent,
  type FlowEventTone,
  type TaskBucket,
  type TaskStatus,
} from '@/lib/types/flow';

// =====================================================================
// Shared helpers
// =====================================================================

export function eventTone(tone: FlowEventTone): { ring: string; chip: LabelTone; label: string } {
  switch (tone) {
    case 'milestone':  return { ring: 'border-accent-fg',     chip: 'accent',    label: '마일스톤' };
    case 'pivot':      return { ring: 'border-attention-fg',  chip: 'attention', label: '피벗' };
    case 'result':     return { ring: 'border-success-fg',    chip: 'success',   label: '결과' };
    case 'incident':   return { ring: 'border-danger-fg',     chip: 'danger',    label: '인시던트' };
    case 'design':     return { ring: 'border-done-fg',       chip: 'done',      label: '설계' };
    case 'deprecated': return { ring: 'border-fg-muted',      chip: 'neutral',   label: '폐기' };
  }
}

export function taskStatusTone(s: TaskStatus): LabelTone {
  switch (s) {
    case 'pending':     return 'neutral';
    case 'in_progress': return 'attention';
    case 'done':        return 'success';
  }
}

export function taskStatusLabel(s: TaskStatus): string {
  switch (s) {
    case 'pending':     return 'Pending';
    case 'in_progress': return 'In progress';
    case 'done':        return 'Done';
  }
}

export function bucketLabel(b: TaskBucket): string {
  switch (b) {
    case 'short': return '단기 (이번 라운드)';
    case 'mid':   return '중기 (이번 달)';
    case 'long':  return '장기 (분기 / 제출)';
  }
}

/**
 * Escape angle-bracketed tokens that look like HTML tags but aren't valid HTML —
 * markdown/HTML parsers silently strip these, breaking surrounding text.
 *
 * Patterns handled:
 *   <|im_end|>, <|im_start|>     — chat template
 *   <INFORMATION>, <TOOL_RETURNED_DATA>  — framework markers (uppercase tags)
 *   <unknown>                    — literal placeholder seen in IPIGuard etc.
 *
 * Inline code (`<...>`) and fenced code blocks are protected first.
 */
export function escapeFrameworkTokens(md: string): string {
  // Walk through, splitting on fenced code blocks so we don't escape within them.
  const parts = md.split(/(```[\s\S]*?```)/g);
  return parts
    .map((part, i) => {
      if (i % 2 === 1) return part; // inside fenced code, leave as-is
      // Protect inline code spans next
      const inline = part.split(/(`[^`\n]+`)/g);
      return inline
        .map((seg, j) => {
          if (j % 2 === 1) return seg; // inside inline code
          return seg
            .replace(/<\|/g, '&lt;|')
            .replace(/\|>/g, '|&gt;')
            .replace(/<([A-Z][A-Z_0-9]*)>/g, '&lt;$1&gt;')
            .replace(/<unknown>/g, '&lt;unknown&gt;');
        })
        .join('');
    })
    .join('');
}

// =====================================================================
// TimelineCard
// =====================================================================

export function TimelineCard({ event }: { event: FlowEvent }) {
  const tone = eventTone(event.tone);
  const newness = newnessFromString(event.date);
  return (
    <div className="relative bg-white border border-border-default rounded-md p-4 pr-10">
      {newness > 0 && (
        <span
          className="absolute top-1 left-1 bg-danger-fg text-white text-[9px] font-semibold px-1 py-px rounded-full shadow-sm leading-none z-10"
          style={{ opacity: newness }}
        >
          New!
        </span>
      )}
      <div className="flex items-center gap-2 text-xs text-fg-muted mb-1 flex-wrap">
        <span className="font-mono">{event.date}</span>
        <LabelChip tone={tone.chip}>{tone.label}</LabelChip>
        <span className="font-mono opacity-70 break-all">{event.source}</span>
      </div>
      <h3 className="text-base font-semibold mb-2">{event.title}</h3>
      <p className="text-sm text-fg-default leading-relaxed mb-2">{event.summary}</p>
      {event.bullets && (
        <ul className="text-sm text-fg-muted list-disc pl-5 space-y-0.5 mb-2">
          {event.bullets.map((b, i) => <li key={i}>{b}</li>)}
        </ul>
      )}
      {event.numbers && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {event.numbers.map((n, i) => (
            <span key={i} className="text-[11px] font-mono bg-canvas-subtle px-2 py-0.5 rounded">
              {n.label}: <span className="font-semibold text-fg-default">{n.value}</span>
            </span>
          ))}
        </div>
      )}
      {event.sourceContent && (
        <details className="mt-3 border-t border-border-muted pt-2 group">
          <summary className="text-xs text-fg-muted cursor-pointer hover:text-accent-fg select-none list-none flex items-center gap-1">
            <span className="inline-block transition-transform group-open:rotate-90">▶</span>
            <span>원본 progress.md 보기 ({event.source})</span>
          </summary>
          <div className="mt-3 max-h-[600px] overflow-y-auto bg-canvas-subtle rounded p-4">
            <MarkdownBody source={escapeFrameworkTokens(event.sourceContent)} size="sm" />
          </div>
        </details>
      )}
    </div>
  );
}
