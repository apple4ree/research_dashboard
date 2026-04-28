import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { NoticeForm } from '@/components/notices/NoticeForm';
import type { NoticeCategory } from '@/lib/labels';

export default async function EditNoticePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const n = await prisma.notice.findUnique({ where: { id } });
  if (!n) notFound();

  return (
    <NoticeForm
      mode="edit"
      initial={{
        id: n.id,
        title: n.title,
        bodyMarkdown: n.bodyMarkdown,
        category: n.category as NoticeCategory,
        pinned: n.pinned,
      }}
    />
  );
}
