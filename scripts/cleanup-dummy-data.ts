import { prisma } from '@/lib/db';

const KEEP_MEMBER = 'dgu';

async function counts() {
  const [project, member, paper, run, release, discussion, reply, entry, milestone, todo, event, venue, user, account, session] = await Promise.all([
    prisma.project.count(),
    prisma.member.count(),
    prisma.paper.count(),
    prisma.experimentRun.count(),
    prisma.release.count(),
    prisma.discussion.count(),
    prisma.reply.count(),
    prisma.researchEntry.count(),
    prisma.milestone.count(),
    prisma.todoItem.count(),
    prisma.activityEvent.count(),
    prisma.venue.count(),
    prisma.user.count(),
    prisma.account.count(),
    prisma.session.count(),
  ]);
  return { project, member, paper, run, release, discussion, reply, entry, milestone, todo, event, venue, user, account, session };
}

async function main() {
  console.log('Counts before:');
  console.table(await counts());

  console.log('\nDeleting in FK-safe order...');

  const events = await prisma.activityEvent.deleteMany({});
  console.log(`  events deleted: ${events.count}`);

  const replies = await prisma.reply.deleteMany({});
  console.log(`  replies deleted: ${replies.count}`);

  const discussions = await prisma.discussion.deleteMany({});
  console.log(`  discussions deleted: ${discussions.count}`);

  const runs = await prisma.experimentRun.deleteMany({});
  console.log(`  runs deleted: ${runs.count}`);

  const slides = await prisma.entrySlide.deleteMany({});
  console.log(`  slides deleted: ${slides.count}`);

  const artifacts = await prisma.entryArtifact.deleteMany({});
  console.log(`  artifacts deleted: ${artifacts.count}`);

  const entries = await prisma.researchEntry.deleteMany({});
  console.log(`  entries deleted: ${entries.count}`);

  const paperAuthors = await prisma.paperAuthor.deleteMany({});
  console.log(`  paperAuthors deleted: ${paperAuthors.count}`);

  const papers = await prisma.paper.deleteMany({});
  console.log(`  papers deleted: ${papers.count}`);

  const releases = await prisma.release.deleteMany({});
  console.log(`  releases deleted: ${releases.count}`);

  const milestones = await prisma.milestone.deleteMany({});
  console.log(`  milestones deleted: ${milestones.count}`);

  const todos = await prisma.todoItem.deleteMany({});
  console.log(`  todos deleted: ${todos.count}`);

  const projectMembers = await prisma.projectMember.deleteMany({});
  console.log(`  projectMembers deleted: ${projectMembers.count}`);

  const projectRepos = await prisma.projectRepo.deleteMany({});
  console.log(`  projectRepos deleted: ${projectRepos.count}`);

  const projects = await prisma.project.deleteMany({});
  console.log(`  projects deleted: ${projects.count}`);

  const members = await prisma.member.deleteMany({
    where: { login: { not: KEEP_MEMBER } },
  });
  console.log(`  members deleted (kept ${KEEP_MEMBER}): ${members.count}`);

  const dgu = await prisma.member.findUnique({ where: { login: KEEP_MEMBER } });
  if (dgu) {
    await prisma.member.update({
      where: { login: KEEP_MEMBER },
      data: {
        pinnedProjectSlugs: '[]',
        ...(dgu.bio === 'Claude Code skills, research tooling.' ? { bio: null } : {}),
      },
    });
    console.log(`  reset Member.${KEEP_MEMBER} pinnedProjectSlugs/bio`);
  } else {
    console.log(`  WARNING: Member.${KEEP_MEMBER} not found`);
  }

  console.log('\nCounts after:');
  console.table(await counts());
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
