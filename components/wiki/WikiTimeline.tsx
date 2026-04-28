import Link from 'next/link';

/**
 * Render a vertical timeline from `[progress:YYYYMMDD_HHMM] note...` bullets.
 * Each entry becomes a dot + formatted date + content. The progress stamp is
 * surfaced as a small chip that links to the project's flow page (filtered
 * by the source filename, when possible).
 */
export function WikiTimeline({
  entries,
  projectSlug,
}: {
  entries: { stamp: string | null; note: string }[];
  projectSlug: string;
}) {
  if (entries.length === 0) return null;

  return (
    <ol className="relative border-l-2 border-border-default pl-5 list-none space-y-3 ml-1">
      {entries.map((e, i) => (
        <li key={i} className="relative">
          <span className="absolute -left-[26px] top-1.5 w-3 h-3 rounded-full bg-accent-fg ring-4 ring-canvas-default" />
          <div className="flex flex-wrap items-baseline gap-2">
            <time className="text-xs font-mono text-fg-muted shrink-0">
              {e.stamp ? formatStamp(e.stamp) : '—'}
            </time>
            {e.stamp && (
              <Link
                href={`/projects/${projectSlug}/flow?progress=${encodeURIComponent(e.stamp)}`}
                title={`progress_${e.stamp}.md`}
                className="text-[10px] font-mono px-1.5 py-px rounded bg-canvas-subtle text-fg-muted hover:bg-canvas-default hover:text-accent-fg"
              >
                progress
              </Link>
            )}
            <span className="text-sm text-fg-default flex-1 min-w-[200px]">{e.note}</span>
          </div>
        </li>
      ))}
    </ol>
  );
}

/** "20260427_0100" → "2026-04-27 01:00" */
function formatStamp(stamp: string): string {
  const m = stamp.match(/^(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})$/);
  if (!m) return stamp;
  return `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]}`;
}
