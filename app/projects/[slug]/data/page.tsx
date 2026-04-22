import type { ReleaseKind } from '@/lib/types';
import { LabelChip } from '@/components/badges/LabelChip';
import { EmptyState } from '@/components/misc/EmptyState';
import { getReleasesByProject } from '@/lib/mock';
import { loadProject } from '@/lib/mock/loaders';

const KIND_TONE: Record<ReleaseKind, 'neutral' | 'accent' | 'done' | 'success'> = {
  dataset: 'accent', tool: 'neutral', skill: 'done', model: 'success',
};

export default async function DataTab({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await loadProject(params);
  const releases = getReleasesByProject(slug).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  if (releases.length === 0) return <EmptyState title="No releases" body="Datasets, tools, and Claude Code skills released by this project show here." />;

  return (
    <ul className="bg-white border border-border-default rounded-md divide-y divide-border-muted">
      {releases.map(r => (
        <li key={r.id} className="px-4 py-3 flex items-start gap-3">
          <LabelChip tone={KIND_TONE[r.kind]}>{r.kind}</LabelChip>
          <div className="flex-1">
            <div className="font-medium">{r.name} <span className="text-fg-muted text-xs">{r.version}</span></div>
            {r.description && <p className="text-xs text-fg-muted mt-1">{r.description}</p>}
            <div className="text-xs text-fg-muted mt-1">Published {new Date(r.publishedAt).toDateString()}</div>
          </div>
          {r.downloadUrl && (
            <a href={r.downloadUrl} target="_blank" rel="noopener noreferrer" className="text-accent-fg text-xs hover:underline">Download</a>
          )}
        </li>
      ))}
    </ul>
  );
}
