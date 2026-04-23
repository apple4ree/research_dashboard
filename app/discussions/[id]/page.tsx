import Link from 'next/link';
import { notFound } from 'next/navigation';
import { RepoIcon } from '@primer/octicons-react';
import { MarkdownBody } from '@/components/md/MarkdownBody';
import { Avatar } from '@/components/people/Avatar';
import { EmptyState } from '@/components/misc/EmptyState';
import { ReplyForm } from '@/components/discussions/ReplyForm';
import { DiscussionActions } from '@/components/discussions/DiscussionActions';
import { ReplyItem } from '@/components/discussions/ReplyItem';
import { getDiscussionById, getAllMembers, getProjectBySlug } from '@/lib/queries';

export default async function DiscussionDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = await getDiscussionById(id);
  if (!d) notFound();

  const allMembers = await getAllMembers();
  const memberMap = new Map(allMembers.map(m => [m.login, m]));
  const author = memberMap.get(d.authorLogin);
  const project = d.projectSlug ? await getProjectBySlug(d.projectSlug) : undefined;

  return (
    <article className="max-w-3xl space-y-6">
      <header className="pb-3 border-b border-border-muted">
        <div className="flex items-start gap-3">
          <h1 className="text-xl font-semibold flex-1">{d.title}</h1>
          <DiscussionActions discussionId={d.id} />
        </div>
        <div className="text-xs text-fg-muted mt-2 flex items-center gap-2 flex-wrap">
          <Avatar login={d.authorLogin} size={18} /> <b>{author?.displayName ?? d.authorLogin}</b>
          · {new Date(d.createdAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
          {project && (
            <>
              <span>·</span>
              <Link
                href={`/projects/${project.slug}/discussions`}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border border-border-default hover:bg-canvas-subtle"
              >
                <RepoIcon size={10} /> {project.name}
              </Link>
            </>
          )}
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
          d.replies.map(r => {
            const m = memberMap.get(r.authorLogin);
            return (
              <ReplyItem
                key={r.id}
                discussionId={d.id}
                replyId={r.id}
                authorLogin={r.authorLogin}
                authorName={m?.displayName ?? r.authorLogin}
                createdAt={r.createdAt}
                bodyMarkdown={r.bodyMarkdown}
              />
            );
          })
        )}
        <ReplyForm discussionId={d.id} />
      </section>
    </article>
  );
}
