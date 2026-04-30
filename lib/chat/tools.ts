import { prisma } from '@/lib/db';

export const TOOL_SCHEMAS = [
  {
    type: 'function',
    function: {
      name: 'search_wiki',
      description:
        'Search this project\'s wiki for entities matching a keyword (matches name, summary, body, id). Returns up to N matches with id, name, type, status, and a short summary. Use BEFORE answering any question about specific concepts, methods, or topics — do not guess.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Korean or English search term' },
          limit: { type: 'integer', description: 'Max results (default 8, max 20)' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_wiki_entity',
      description:
        'Fetch the full body of one wiki entity by its id. Use after search_wiki to read the actual content. Returns name, type, status, summary, and full bodyMarkdown.',
      parameters: {
        type: 'object',
        properties: {
          entityId: { type: 'string', description: 'Wiki entity id (slug-style)' },
        },
        required: ['entityId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_recent_entries',
      description:
        'List recent research-journal entries (most recent first). Each entry has type (meeting/report/experiment/review), title, summary, date, author. Body not included to save tokens — call get_entry for that.',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'integer', description: 'Max entries (default 10, max 30)' },
          type: {
            type: 'string',
            description: 'Optional filter: meeting | report | experiment | review',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_entry',
      description: 'Fetch full bodyMarkdown of a single research-journal entry by id.',
      parameters: {
        type: 'object',
        properties: { entryId: { type: 'string' } },
        required: ['entryId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_experiments',
      description:
        'List all experiments in this project with status, hypothesis, and result count. Body not included — call get_experiment for one entry.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_experiment',
      description:
        'Fetch one experiment with its full hypothesis, body, and ALL of its results (title, summary, metrics).',
      parameters: {
        type: 'object',
        properties: { experimentId: { type: 'string' } },
        required: ['experimentId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_runs',
      description:
        'List recent experiment runs (LabHub-logged) with status, started time, duration, and one-line summary.',
      parameters: {
        type: 'object',
        properties: { limit: { type: 'integer', description: 'Default 10, max 30' } },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_papers',
      description:
        'List papers attached to this project with stage (draft/submitted/etc), venue, and deadline.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_open_todos',
      description: 'List currently-open (done=false) TodoItems for this project, grouped by bucket.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_upcoming_milestones',
      description: 'Milestones with status now/future for this project, ordered chronologically.',
      parameters: { type: 'object', properties: {} },
    },
  },
] as const;

const MAX_BODY_CHARS = 30_000;

function truncate(s: string, n = MAX_BODY_CHARS): string {
  if (typeof s !== 'string') return '';
  return s.length > n ? s.slice(0, n) + '\n…[truncated]' : s;
}

export type ToolResult = unknown;

export async function executeTool(
  slug: string,
  name: string,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  switch (name) {
    case 'search_wiki': {
      const q = String(args.query ?? '').trim();
      const limit = Math.min(Math.max(Number(args.limit ?? 8) | 0, 1), 20);
      if (!q) return { error: 'query is required' };
      const rows = await prisma.wikiEntity.findMany({
        where: {
          projectSlug: slug,
          OR: [
            { name: { contains: q } },
            { summaryMarkdown: { contains: q } },
            { bodyMarkdown: { contains: q } },
            { id: { contains: q } },
          ],
        },
        take: limit,
        orderBy: [{ type: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          name: true,
          type: true,
          status: true,
          summaryMarkdown: true,
        },
      });
      return rows.map(r => ({
        ...r,
        summaryMarkdown: truncate(r.summaryMarkdown, 600),
      }));
    }

    case 'get_wiki_entity': {
      const id = String(args.entityId ?? '').trim();
      if (!id) return { error: 'entityId is required' };
      const row = await prisma.wikiEntity.findUnique({
        where: { projectSlug_id: { projectSlug: slug, id } },
        select: {
          id: true,
          name: true,
          type: true,
          status: true,
          summaryMarkdown: true,
          bodyMarkdown: true,
          lastSyncedAt: true,
        },
      });
      if (!row) return { error: `wiki entity '${id}' not found` };
      return { ...row, bodyMarkdown: truncate(row.bodyMarkdown) };
    }

    case 'list_recent_entries': {
      const limit = Math.min(Math.max(Number(args.limit ?? 10) | 0, 1), 30);
      const type = typeof args.type === 'string' ? args.type : undefined;
      const rows = await prisma.researchEntry.findMany({
        where: { projectSlug: slug, ...(type ? { type } : {}) },
        orderBy: { date: 'desc' },
        take: limit,
        select: {
          id: true,
          date: true,
          type: true,
          title: true,
          summary: true,
          authorLogin: true,
        },
      });
      return rows;
    }

    case 'get_entry': {
      const id = String(args.entryId ?? '').trim();
      if (!id) return { error: 'entryId is required' };
      const row = await prisma.researchEntry.findUnique({
        where: { id },
        select: {
          id: true,
          projectSlug: true,
          date: true,
          type: true,
          title: true,
          summary: true,
          tags: true,
          bodyMarkdown: true,
          authorLogin: true,
        },
      });
      if (!row || row.projectSlug !== slug) return { error: `entry '${id}' not found in this project` };
      return { ...row, bodyMarkdown: truncate(row.bodyMarkdown) };
    }

    case 'list_experiments': {
      const rows = await prisma.experiment.findMany({
        where: { projectSlug: slug },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          title: true,
          status: true,
          hypothesis: true,
          createdAt: true,
          createdByLogin: true,
          _count: { select: { results: true } },
        },
      });
      return rows.map(r => ({
        id: r.id,
        title: r.title,
        status: r.status,
        hypothesis: truncate(r.hypothesis, 400),
        createdAt: r.createdAt,
        createdBy: r.createdByLogin,
        resultCount: r._count.results,
      }));
    }

    case 'get_experiment': {
      const id = String(args.experimentId ?? '').trim();
      if (!id) return { error: 'experimentId is required' };
      const row = await prisma.experiment.findUnique({
        where: { id },
        select: {
          id: true,
          projectSlug: true,
          title: true,
          status: true,
          hypothesis: true,
          bodyMarkdown: true,
          createdAt: true,
          createdByLogin: true,
          results: {
            orderBy: { publishedAt: 'desc' },
            select: {
              id: true,
              title: true,
              summary: true,
              kind: true,
              metricsJson: true,
              publishedAt: true,
            },
          },
        },
      });
      if (!row || row.projectSlug !== slug) {
        return { error: `experiment '${id}' not found in this project` };
      }
      return {
        ...row,
        hypothesis: truncate(row.hypothesis),
        bodyMarkdown: truncate(row.bodyMarkdown),
        results: row.results.map(r => ({ ...r, summary: truncate(r.summary, 800) })),
      };
    }

    case 'list_runs': {
      const limit = Math.min(Math.max(Number(args.limit ?? 10) | 0, 1), 30);
      const rows = await prisma.experimentRun.findMany({
        where: { projectSlug: slug },
        orderBy: { startedAt: 'desc' },
        take: limit,
        select: {
          id: true,
          name: true,
          status: true,
          startedAt: true,
          durationSec: true,
          triggeredByLogin: true,
          summary: true,
        },
      });
      return rows;
    }

    case 'list_papers': {
      const rows = await prisma.paper.findMany({
        where: { projectSlug: slug },
        orderBy: [{ deadline: 'asc' }, { stage: 'asc' }],
        select: {
          id: true,
          title: true,
          stage: true,
          venue: true,
          deadline: true,
        },
      });
      return rows;
    }

    case 'list_open_todos': {
      const rows = await prisma.todoItem.findMany({
        where: { projectSlug: slug, done: false },
        orderBy: [{ bucket: 'asc' }, { position: 'asc' }],
        select: {
          id: true,
          bucket: true,
          text: true,
          goal: true,
          status: true,
        },
      });
      return rows;
    }

    case 'list_upcoming_milestones': {
      const rows = await prisma.milestone.findMany({
        where: { projectSlug: slug, status: { in: ['now', 'future'] } },
        orderBy: { date: 'asc' },
        select: {
          id: true,
          date: true,
          label: true,
          note: true,
          status: true,
        },
      });
      return rows;
    }

    default:
      return { error: `unknown tool: ${name}` };
  }
}
