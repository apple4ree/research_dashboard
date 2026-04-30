import { prisma } from '@/lib/db';

export type ProjectChatContext = {
  slug: string;
  name: string;
  description: string;
  targetVenue: string | null;
  githubRepo: string | null;
  kpi: {
    entries: number;
    wikiEntities: number;
    papers: number;
    runs: number;
    experiments: number;
    openTodos: number;
    upcomingMilestones: number;
  };
  lastActivityAt: Date | null;
};

export async function loadProjectChatContext(slug: string): Promise<ProjectChatContext | null> {
  const project = await prisma.project.findUnique({
    where: { slug },
    select: {
      slug: true,
      name: true,
      description: true,
      targetVenue: true,
      githubRepo: true,
      updatedAt: true,
    },
  });
  if (!project) return null;

  const [entries, wikiEntities, papers, runs, experiments, openTodos, upcomingMilestones, lastActivity] =
    await Promise.all([
      prisma.researchEntry.count({ where: { projectSlug: slug } }),
      prisma.wikiEntity.count({ where: { projectSlug: slug } }),
      prisma.paper.count({ where: { projectSlug: slug } }),
      prisma.experimentRun.count({ where: { projectSlug: slug } }),
      prisma.experiment.count({ where: { projectSlug: slug } }),
      prisma.todoItem.count({ where: { projectSlug: slug, done: false } }),
      prisma.milestone.count({
        where: { projectSlug: slug, status: { in: ['now', 'future'] } },
      }),
      prisma.activityEvent.findFirst({
        where: { projectSlug: slug },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
    ]);

  return {
    slug: project.slug,
    name: project.name,
    description: project.description,
    targetVenue: project.targetVenue,
    githubRepo: project.githubRepo,
    kpi: {
      entries,
      wikiEntities,
      papers,
      runs,
      experiments,
      openTodos,
      upcomingMilestones,
    },
    lastActivityAt: lastActivity?.createdAt ?? project.updatedAt,
  };
}

export function renderSystemPrompt(ctx: ProjectChatContext): string {
  const lines = [
    `You are the LabHub research assistant for the project "${ctx.name}" (slug: ${ctx.slug}).`,
    `Every answer you give must be grounded in this specific project — its data, history, and conventions — not in generic knowledge unless the user explicitly asks about a general topic.`,
    ``,
    `# Tools`,
    `You have read-only tools that fetch real data from this project's database.`,
    `**Use them aggressively.** Before answering any question that touches specific entities, recent activity, todos, milestones, papers, experiments, or wiki content, call the relevant tool first. Never guess what the project contains — look it up.`,
    `Typical patterns:`,
    `- "What's in the wiki about X?" → search_wiki(X) → get_wiki_entity(top hit)`,
    `- "What did we work on recently?" → list_recent_entries(10)`,
    `- "Status of experiment Y" → list_experiments → get_experiment(matching id)`,
    `- "What's left to do?" → list_open_todos + list_upcoming_milestones`,
    `Multiple tool calls per turn are encouraged. Stop when you have enough data to answer accurately.`,
    ``,
    `# Style`,
    `Respond in Korean unless the user writes in English. Be concise — short paragraphs and bullets, not prose. If a tool call returned no matches or you do not know a project-specific fact even after looking, say so plainly. Do not fabricate.`,
    ``,
    `# Project facts`,
    `- name: ${ctx.name}`,
    `- slug: ${ctx.slug}`,
    `- description: ${ctx.description || '(none)'}`,
  ];
  if (ctx.targetVenue) lines.push(`- target venue: ${ctx.targetVenue}`);
  if (ctx.githubRepo) lines.push(`- GitHub repo: ${ctx.githubRepo}`);
  lines.push(
    `- last activity: ${ctx.lastActivityAt ? ctx.lastActivityAt.toISOString() : 'unknown'}`,
    ``,
    `# Project size (current counts)`,
    `- research entries: ${ctx.kpi.entries}`,
    `- wiki entities: ${ctx.kpi.wikiEntities}`,
    `- papers: ${ctx.kpi.papers}`,
    `- experiments: ${ctx.kpi.experiments}`,
    `- runs (logged): ${ctx.kpi.runs}`,
    `- open todos: ${ctx.kpi.openTodos}`,
    `- upcoming milestones: ${ctx.kpi.upcomingMilestones}`,
  );
  return lines.join('\n');
}
