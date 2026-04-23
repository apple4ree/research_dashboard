import { ProjectHeader } from '@/components/project/ProjectHeader';
import { TabBar } from '@/components/project/TabBar';
import { loadProject } from '@/lib/mock/loaders';
import { prisma } from '@/lib/db';
import { auth } from '@/auth';

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug, project } = await loadProject(params);
  const [row, session] = await Promise.all([
    prisma.project.findUnique({ where: { slug }, select: { source: true } }),
    auth(),
  ]);

  // Is this project pinned on the current user's profile?
  let isPinned = false;
  const memberLogin = (session as { memberLogin?: string } | null)?.memberLogin;
  if (memberLogin) {
    const me = await prisma.member.findUnique({
      where: { login: memberLogin },
      select: { pinnedProjectSlugs: true },
    });
    if (me) {
      try {
        const pinned: unknown = JSON.parse(me.pinnedProjectSlugs);
        isPinned = Array.isArray(pinned) && pinned.includes(slug);
      } catch {
        isPinned = false;
      }
    }
  }

  return (
    <div className="space-y-4">
      <ProjectHeader
        project={project}
        source={row?.source ?? 'internal'}
        isPinned={isPinned}
      />
      <TabBar slug={slug} />
      {children}
    </div>
  );
}
