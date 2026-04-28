import { MarkdownBody } from '@/components/md/MarkdownBody';
import { WikiTimeline } from './WikiTimeline';
import { WikiCrossRefs } from './WikiCrossRefs';

type EntityInfo = { id: string; name: string; type: string; status: string };

type Section =
  | { kind: 'markdown'; content: string }
  | { kind: 'timeline'; entries: { stamp: string | null; note: string }[] }
  | { kind: 'crossref'; refs: { entityId: string; note: string | null }[] };

/**
 * Render a wiki entity body but visualize the conventional `## Timeline`
 * and `## Cross-references` sections instead of leaving them as plain
 * markdown bullets. Other sections render through MarkdownBody as before.
 */
export function WikiBodyRender({
  source,
  projectSlug,
  entityIds,
  entitiesById,
  typeLabelByKey,
}: {
  source: string;
  projectSlug: string;
  entityIds: string[];
  entitiesById: Map<string, EntityInfo>;
  typeLabelByKey: Map<string, string>;
}) {
  const sections = splitSections(source);
  return (
    <div className="space-y-6">
      {sections.map((s, i) => {
        if (s.kind === 'timeline') {
          return (
            <section key={i}>
              <h2 className="text-base font-semibold mb-3">Timeline</h2>
              <WikiTimeline entries={s.entries} projectSlug={projectSlug} />
            </section>
          );
        }
        if (s.kind === 'crossref') {
          return (
            <section key={i}>
              <h2 className="text-base font-semibold mb-3">Cross-references</h2>
              <WikiCrossRefs
                refs={s.refs}
                projectSlug={projectSlug}
                entitiesById={entitiesById}
                typeLabelByKey={typeLabelByKey}
              />
            </section>
          );
        }
        if (!s.content.trim()) return null;
        return (
          <MarkdownBody
            key={i}
            source={s.content}
            size="base"
            wikiSlug={projectSlug}
            wikiEntityIds={entityIds}
          />
        );
      })}
    </div>
  );
}

const TIMELINE_HEADING_RE = /^##\s+timeline\s*$/i;
const CROSSREF_HEADING_RE = /^##\s+(cross[-\s]?references|references|see\s+also)\s*$/i;
const PROGRESS_BULLET_RE = /^[-*]\s*\[progress:([^\]]+)\]\s*(.*)$/;
// Allow either `[entity:slug] — note` or `[entity:slug]` alone.
const ENTITY_BULLET_RE = /^[-*]\s*\[entity:([^\]]+)\](?:\s*[—\-:]\s*(.*))?$/;

function splitSections(body: string): Section[] {
  const lines = body.split('\n');
  const out: Section[] = [];
  let buffer: string[] = [];

  const flushMarkdown = () => {
    if (buffer.length) {
      out.push({ kind: 'markdown', content: buffer.join('\n') });
      buffer = [];
    }
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (TIMELINE_HEADING_RE.test(line.trim()) || CROSSREF_HEADING_RE.test(line.trim())) {
      flushMarkdown();
      const isTimeline = TIMELINE_HEADING_RE.test(line.trim());
      // Collect until the next `##` heading (or EOF).
      const sectionLines: string[] = [];
      i++;
      while (i < lines.length && !/^##\s+/.test(lines[i].trim())) {
        sectionLines.push(lines[i]);
        i++;
      }
      if (isTimeline) {
        out.push({ kind: 'timeline', entries: parseTimelineEntries(sectionLines) });
      } else {
        out.push({ kind: 'crossref', refs: parseCrossRefs(sectionLines) });
      }
      continue;
    }
    buffer.push(line);
    i++;
  }
  flushMarkdown();
  return out;
}

function parseTimelineEntries(lines: string[]): { stamp: string | null; note: string }[] {
  const entries: { stamp: string | null; note: string }[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const m = PROGRESS_BULLET_RE.exec(line);
    if (m) {
      entries.push({ stamp: m[1], note: m[2].trim() });
      continue;
    }
    if (line.startsWith('-') || line.startsWith('*')) {
      entries.push({ stamp: null, note: line.replace(/^[-*]\s*/, '').trim() });
    }
  }
  return entries;
}

function parseCrossRefs(lines: string[]): { entityId: string; note: string | null }[] {
  const refs: { entityId: string; note: string | null }[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const m = ENTITY_BULLET_RE.exec(line);
    if (m) {
      refs.push({ entityId: m[1].trim(), note: m[2] ? m[2].trim() : null });
    }
  }
  return refs;
}
