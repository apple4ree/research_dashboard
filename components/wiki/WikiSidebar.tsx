import Link from 'next/link';
import { ChevronLeftIcon } from '@primer/octicons-react';
import { cn } from '@/lib/cn';

export type WikiSidebarType = { key: string; label: string };
export type WikiSidebarEntity = { id: string; type: string; name: string; status: string };

export function WikiSidebar({
  slug,
  types,
  entities,
  activeId,
}: {
  slug: string;
  types: readonly WikiSidebarType[];
  entities: readonly WikiSidebarEntity[];
  activeId?: string;
}) {
  const byType = new Map<string, WikiSidebarEntity[]>();
  for (const t of types) byType.set(t.key, []);
  for (const e of entities) byType.get(e.type)?.push(e);

  return (
    <nav className="text-sm">
      <Link
        href={`/projects/${slug}/wiki`}
        className="inline-flex items-center gap-1 text-xs text-fg-muted hover:text-accent-fg mb-4"
      >
        <ChevronLeftIcon size={14} /> Wiki index
      </Link>
      <div className="space-y-5">
        {types.map(t => {
          const list = byType.get(t.key) ?? [];
          if (list.length === 0) return null;
          return (
            <div key={t.key}>
              <div className="text-[11px] uppercase tracking-wider text-fg-muted font-semibold mb-1.5 px-2">
                {t.label}
              </div>
              <ul className="list-none pl-0 space-y-px">
                {list.map(e => (
                  <li key={e.id}>
                    <Link
                      href={`/projects/${slug}/wiki/${encodeURIComponent(e.id)}`}
                      className={cn(
                        'block px-2 py-1 rounded font-mono text-xs truncate',
                        e.id === activeId
                          ? 'bg-canvas-inset text-fg-default font-semibold'
                          : 'text-fg-muted hover:bg-canvas-subtle hover:text-fg-default',
                        e.status !== 'active' && 'italic',
                      )}
                      title={e.name}
                    >
                      {e.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </nav>
  );
}
