import { LabelChip } from '@/components/badges/LabelChip';
import { Avatar } from '@/components/people/Avatar';
import { EmptyState } from '@/components/misc/EmptyState';
import { getPapersByProject } from '@/lib/mock';
import { loadProject } from '@/lib/mock/loaders';
import { PAPER_STAGE_LABELS, PAPER_STAGE_ORDER, PAPER_STAGE_TONE } from '@/lib/labels';

export default async function PapersTab({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await loadProject(params);
  const papers = getPapersByProject(slug);
  if (papers.length === 0) return <EmptyState title="No papers yet" body="When you add papers to this project, they'll appear here." />;

  return (
    <div className="space-y-6">
      {PAPER_STAGE_ORDER.map(stage => {
        const group = papers.filter(p => p.stage === stage);
        if (group.length === 0) return null;
        return (
          <section key={stage}>
            <h3 className="text-xs uppercase tracking-wide text-fg-muted font-semibold mb-2">{PAPER_STAGE_LABELS[stage]}</h3>
            <ul className="bg-white border border-border-default rounded-md divide-y divide-border-muted">
              {group.map(p => (
                <li key={p.id} className="px-4 py-3 flex items-start gap-3">
                  <LabelChip tone={PAPER_STAGE_TONE[stage]}>{PAPER_STAGE_LABELS[stage]}</LabelChip>
                  <div className="flex-1">
                    <div className="font-medium">{p.title}</div>
                    <div className="text-xs text-fg-muted mt-1 flex items-center gap-2">
                      <span className="flex items-center gap-1">
                        {p.authorLogins.map(l => <Avatar key={l} login={l} size={14} />)}
                      </span>
                      {p.venue && <span>· {p.venue}</span>}
                      {p.deadline && <span>· due {new Date(p.deadline).toDateString()}</span>}
                    </div>
                  </div>
                  {(() => {
                    const href = p.pdfUrl ?? p.draftUrl;
                    if (!href) return null;
                    const kind = p.pdfUrl ? 'PDF' : 'Draft';
                    return (
                      <a href={href} target="_blank" rel="noopener noreferrer" className="text-accent-fg text-xs hover:underline">
                        {kind}
                      </a>
                    );
                  })()}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
