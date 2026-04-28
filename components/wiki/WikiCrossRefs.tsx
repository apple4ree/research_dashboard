import Link from 'next/link';
import { LabelChip, type LabelTone } from '@/components/badges/LabelChip';

type Ref = { entityId: string; note: string | null };
type EntityInfo = { id: string; name: string; type: string; status: string };

const STATUS_TONE: Record<string, LabelTone> = {
  active: 'success',
  deprecated: 'neutral',
  superseded: 'attention',
};

/**
 * Render `[entity:slug] — note` cross-references as clickable cards.
 * Links missing entities are shown disabled with a "(없음)" hint so the
 * user notices a stale ref instead of clicking into a 404.
 */
export function WikiCrossRefs({
  refs,
  projectSlug,
  entitiesById,
  typeLabelByKey,
}: {
  refs: Ref[];
  projectSlug: string;
  entitiesById: Map<string, EntityInfo>;
  typeLabelByKey: Map<string, string>;
}) {
  if (refs.length === 0) return null;

  return (
    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 list-none pl-0">
      {refs.map((r, i) => {
        const target = entitiesById.get(r.entityId);
        if (!target) {
          return (
            <li
              key={i}
              className="block border border-dashed border-border-muted rounded-md p-3 bg-canvas-subtle/40"
            >
              <div className="flex items-center gap-2 text-sm">
                <span className="font-mono text-fg-muted">{r.entityId}</span>
                <span className="text-xs text-danger-fg">(찾을 수 없음)</span>
              </div>
              {r.note && <div className="text-xs text-fg-muted mt-1">{r.note}</div>}
            </li>
          );
        }
        const typeLabel = typeLabelByKey.get(target.type) ?? target.type;
        return (
          <li key={i}>
            <Link
              href={`/projects/${projectSlug}/wiki/${encodeURIComponent(target.id)}`}
              className="block border border-border-default rounded-md p-3 bg-white hover:bg-canvas-subtle transition-colors"
            >
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="font-mono font-semibold text-sm">{target.name}</span>
                <span className="text-[10px] uppercase tracking-wider text-fg-muted">{typeLabel}</span>
                {target.status !== 'active' && (
                  <LabelChip tone={STATUS_TONE[target.status] ?? 'neutral'}>{target.status}</LabelChip>
                )}
              </div>
              {r.note && <div className="text-xs text-fg-muted">{r.note}</div>}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
