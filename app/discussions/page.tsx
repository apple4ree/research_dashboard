import { DiscussionsView } from '@/components/discussions/DiscussionsView';
import { getAllDiscussions } from '@/lib/queries';
import { requestNow } from '@/lib/time';

export default async function DiscussionsIndex() {
  const now = requestNow();
  const discussions = (await getAllDiscussions()).sort((a, b) =>
    b.lastActivityAt.localeCompare(a.lastActivityAt),
  );
  return <DiscussionsView discussions={discussions} now={now} />;
}
