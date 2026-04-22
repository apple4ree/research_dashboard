import type { EntrySlide as EntrySlideType, EntryType, ResearchEntry } from '@/lib/types';
import {
  SLIDE_KIND_LABEL,
  SLIDE_KIND_ICON,
  SLIDE_KIND_STRIP_BG,
  ENTRY_TYPE_LABELS,
  ENTRY_TYPE_STRIP_BG,
  ENTRY_TYPE_TONE,
} from '@/lib/labels';
import { LabelChip } from '@/components/badges/LabelChip';
import { cn } from '@/lib/cn';

function slideBaseBg(kind: EntrySlideType['kind']): string {
  switch (kind) {
    case 'discovery':
      return 'bg-accent-subtle';
    case 'failure':
      return 'bg-danger-subtle';
    case 'implement':
      return 'bg-success-subtle';
    case 'question':
      return 'bg-attention-subtle';
    case 'next':
      return 'bg-canvas-subtle';
    case 'metric':
      return 'bg-done-subtle';
  }
}

function entryTypeBg(type: EntryType): string {
  switch (type) {
    case 'meeting':
      return 'bg-attention-subtle';
    case 'report':
      return 'bg-accent-subtle';
    case 'experiment':
      return 'bg-success-subtle';
    case 'review':
      return 'bg-done-subtle';
  }
}

/** A single narrative slide. */
export function NarrativeSlide({ slide }: { slide: EntrySlideType }) {
  return (
    <div className={cn('flex-shrink-0 w-full h-full flex flex-col', slideBaseBg(slide.kind))}>
      <div className={cn('h-1 w-full', SLIDE_KIND_STRIP_BG[slide.kind])} />
      <div className="flex-1 flex flex-col px-5 py-4 min-h-0">
        <div className="flex items-center gap-1 text-[10px] tracking-[0.14em] font-bold text-fg-muted uppercase">
          <span>{SLIDE_KIND_ICON[slide.kind]}</span>
          <span>{SLIDE_KIND_LABEL[slide.kind]}</span>
        </div>
        <h4 className="mt-2 text-base font-bold leading-tight text-fg-default">
          {slide.title}
        </h4>
        <div className="mt-2 text-sm leading-relaxed text-fg-default">{slide.body}</div>
        {slide.chip && (
          <div className="mt-2">
            <LabelChip tone="neutral">#{slide.chip}</LabelChip>
          </div>
        )}
        {slide.metrics && slide.metrics.length > 0 && (
          <div className="mt-auto pt-3 grid grid-cols-2 gap-2">
            {slide.metrics.map((m, i) => (
              <div
                key={i}
                className="bg-white border border-border-default rounded-md px-3 py-2"
              >
                <div className="text-sm font-bold text-fg-default">{m.b}</div>
                <div className="text-[10px] text-fg-muted">{m.s}</div>
              </div>
            ))}
          </div>
        )}
        {slide.code && (
          <pre className="mt-2 bg-canvas-inset text-fg-default text-xs p-2 rounded-md overflow-auto">
            <code>{slide.code}</code>
          </pre>
        )}
      </div>
    </div>
  );
}

/** The auto-generated summary slide (slide 0 in each carousel). */
export function SummarySlide({ entry }: { entry: ResearchEntry }) {
  const typeLabel = ENTRY_TYPE_LABELS[entry.type];
  const tone = ENTRY_TYPE_TONE[entry.type];
  return (
    <div className={cn('flex-shrink-0 w-full h-full flex flex-col', entryTypeBg(entry.type))}>
      <div className={cn('h-1 w-full', ENTRY_TYPE_STRIP_BG[entry.type])} />
      <div className="flex-1 flex flex-col px-5 py-4 min-h-0">
        <div className="text-[10px] tracking-[0.14em] font-bold text-fg-muted uppercase">
          {typeLabel}
        </div>
        <div className="text-xs text-fg-muted mt-1">
          {entry.date.slice(0, 10)} · {entry.authorLogin}
        </div>
        <h4 className="mt-3 text-lg font-bold leading-tight text-fg-default">
          {entry.title}
        </h4>
        <div className="mt-2 text-sm leading-relaxed text-fg-default">{entry.summary}</div>
        <div className="mt-auto pt-3">
          <div className="flex flex-wrap gap-1">
            {entry.tags.map(t => (
              <LabelChip key={t} tone={tone}>
                #{t}
              </LabelChip>
            ))}
          </div>
          <div className="mt-3 text-xs text-fg-muted">
            → 오른쪽으로 넘겨보세요 ({entry.slides.length}장)
          </div>
        </div>
      </div>
    </div>
  );
}
