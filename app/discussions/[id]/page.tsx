import { notFound } from 'next/navigation';
import { MarkdownBody } from '@/components/md/MarkdownBody';
import { Avatar } from '@/components/people/Avatar';
import { EmptyState } from '@/components/misc/EmptyState';
import { getDiscussionById, getMemberByLogin } from '@/lib/mock';

export default async function DiscussionDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = getDiscussionById(id);
  if (!d) notFound();
  const author = getMemberByLogin(d.authorLogin);

  return (
    <article className="max-w-3xl space-y-6">
      <header className="pb-3 border-b border-border-muted">
        <h1 className="text-xl font-semibold">{d.title}</h1>
        <div className="text-xs text-fg-muted mt-2 flex items-center gap-2">
          <Avatar login={d.authorLogin} size={18} /> <b>{author?.displayName ?? d.authorLogin}</b>
          · {new Date(d.createdAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
        </div>
      </header>

      <div className="bg-white border border-border-default rounded-md p-4">
        <MarkdownBody source={d.bodyMarkdown} />
      </div>

      <section className="space-y-3">
        <h2 className="text-xs uppercase tracking-wide text-fg-muted font-semibold">
          {d.replies.length === 0 ? 'No replies yet' : `${d.replies.length} replies`}
        </h2>
        {d.replies.length === 0 ? (
          <EmptyState title="Start the thread" body="Be the first to reply." />
        ) : (
          d.replies.map((r, i) => {
            const m = getMemberByLogin(r.authorLogin);
            return (
              <div key={i} className="bg-white border border-border-default rounded-md p-4">
                <div className="text-xs text-fg-muted mb-2 flex items-center gap-2">
                  <Avatar login={r.authorLogin} size={16} /> <b>{m?.displayName ?? r.authorLogin}</b> · {new Date(r.createdAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
                </div>
                <MarkdownBody source={r.bodyMarkdown} />
              </div>
            );
          })
        )}
      </section>
    </article>
  );
}
