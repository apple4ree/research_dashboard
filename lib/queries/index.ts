import { prisma } from '@/lib/db';
import type {
  Project,
  Paper,
  ExperimentRun,
  Member,
  Discussion,
  Release,
  ActivityEvent,
  Venue,
  UserLogin,
  Slug,
  PaperStage,
  RunStatus,
  MemberRole,
  DiscussionCategory,
  ReleaseKind,
  VenueKind,
  EventType,
  ResearchEntry,
  EntryType,
  EntrySlide,
  EntryArtifact,
  ArtifactType,
  SlideKind,
  EntryMetric,
  Milestone,
  MilestoneStatus,
  TodoItem,
  TodoBucket,
} from '@/lib/types';

export { CURRENT_USER } from './constants';

// ============================================================================
// Row -> domain mappers
// ============================================================================

type MemberRow = {
  login: string;
  displayName: string;
  role: string;
  avatarUrl: string | null;
  bio: string | null;
  pinnedProjectSlugs: string;
};

function mapMember(row: MemberRow): Member {
  const member: Member = {
    login: row.login,
    displayName: row.displayName,
    role: row.role as MemberRole,
    pinnedProjectSlugs: JSON.parse(row.pinnedProjectSlugs) as Slug[],
  };
  if (row.avatarUrl != null) member.avatarUrl = row.avatarUrl;
  if (row.bio != null) member.bio = row.bio;
  return member;
}

type ProjectRow = {
  slug: string;
  name: string;
  description: string;
  tags: string;
  pinned: boolean;
  createdAt: Date;
  updatedAt: Date;
  members?: { memberLogin: string }[];
  repos?: { label: string; url: string }[];
  papers?: { id: string }[];
  releases?: { id: string }[];
};

function mapProject(row: ProjectRow): Project {
  return {
    slug: row.slug,
    name: row.name,
    description: row.description,
    tags: JSON.parse(row.tags) as string[],
    pinned: row.pinned,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    memberLogins: (row.members ?? []).map(m => m.memberLogin),
    repos: (row.repos ?? []).map(r => ({ label: r.label, url: r.url })),
    paperIds: (row.papers ?? []).map(p => p.id),
    releaseIds: (row.releases ?? []).map(r => r.id),
  };
}

type PaperRow = {
  id: string;
  title: string;
  projectSlug: string;
  stage: string;
  venue: string | null;
  deadline: Date | null;
  draftUrl: string | null;
  pdfUrl: string | null;
  authors?: { authorLogin: string; position: number }[];
};

function mapPaper(row: PaperRow): Paper {
  const sortedAuthors = [...(row.authors ?? [])].sort((a, b) => a.position - b.position);
  const paper: Paper = {
    id: row.id,
    title: row.title,
    authorLogins: sortedAuthors.map(a => a.authorLogin),
    projectSlug: row.projectSlug,
    stage: row.stage as PaperStage,
  };
  if (row.venue != null) paper.venue = row.venue;
  if (row.deadline != null) paper.deadline = row.deadline.toISOString();
  if (row.draftUrl != null) paper.draftUrl = row.draftUrl;
  if (row.pdfUrl != null) paper.pdfUrl = row.pdfUrl;
  return paper;
}

type RunRow = {
  id: string;
  name: string;
  projectSlug: string;
  status: string;
  startedAt: Date;
  durationSec: number | null;
  triggeredByLogin: string;
  summary: string | null;
  stepsJson: string | null;
};

function mapRun(row: RunRow): ExperimentRun {
  const run: ExperimentRun = {
    id: row.id,
    name: row.name,
    projectSlug: row.projectSlug,
    status: row.status as RunStatus,
    startedAt: row.startedAt.toISOString(),
    triggeredByLogin: row.triggeredByLogin,
  };
  if (row.durationSec != null) run.durationSec = row.durationSec;
  if (row.summary != null) run.summary = row.summary;
  if (row.stepsJson != null) run.stepsMock = JSON.parse(row.stepsJson);
  return run;
}

type DiscussionRow = {
  id: string;
  category: string;
  title: string;
  authorLogin: string;
  createdAt: Date;
  lastActivityAt: Date;
  replyCount: number;
  bodyMarkdown: string;
  replies?: { id: string; authorLogin: string; createdAt: Date; bodyMarkdown: string; position: number }[];
};

function mapDiscussion(row: DiscussionRow): Discussion {
  const sortedReplies = [...(row.replies ?? [])].sort((a, b) => a.position - b.position);
  return {
    id: row.id,
    category: row.category as DiscussionCategory,
    title: row.title,
    authorLogin: row.authorLogin,
    createdAt: row.createdAt.toISOString(),
    lastActivityAt: row.lastActivityAt.toISOString(),
    replyCount: row.replyCount,
    bodyMarkdown: row.bodyMarkdown,
    replies: sortedReplies.map(r => ({
      id: r.id,
      authorLogin: r.authorLogin,
      createdAt: r.createdAt.toISOString(),
      bodyMarkdown: r.bodyMarkdown,
    })),
  };
}

type ReleaseRow = {
  id: string;
  name: string;
  kind: string;
  projectSlug: string;
  version: string;
  publishedAt: Date;
  description: string | null;
  downloadUrl: string | null;
};

function mapRelease(row: ReleaseRow): Release {
  const rel: Release = {
    id: row.id,
    name: row.name,
    kind: row.kind as ReleaseKind,
    projectSlug: row.projectSlug,
    version: row.version,
    publishedAt: row.publishedAt.toISOString(),
  };
  if (row.description != null) rel.description = row.description;
  if (row.downloadUrl != null) rel.downloadUrl = row.downloadUrl;
  return rel;
}

type EventRow = {
  id: string;
  type: string;
  actorLogin: string;
  projectSlug: string | null;
  payload: string;
  createdAt: Date;
};

function mapEvent(row: EventRow): ActivityEvent {
  const payload = JSON.parse(row.payload);
  const base = {
    id: row.id,
    actorLogin: row.actorLogin,
    createdAt: row.createdAt.toISOString(),
    ...(row.projectSlug != null ? { projectSlug: row.projectSlug } : {}),
  };
  return { ...base, type: row.type as EventType, payload } as ActivityEvent;
}

type VenueRow = {
  id: string;
  name: string;
  deadline: Date;
  kind: string;
};

function mapVenue(row: VenueRow): Venue {
  return {
    id: row.id,
    name: row.name,
    deadline: row.deadline.toISOString(),
    kind: row.kind as VenueKind,
  };
}

// ============================================================================
// Query helpers (mirror lib/mock/index.ts signatures, now async)
// ============================================================================

export async function getProjectBySlug(slug: Slug): Promise<Project | undefined> {
  const row = await prisma.project.findUnique({
    where: { slug },
    include: { members: true, repos: true, papers: true, releases: true },
  });
  return row ? mapProject(row) : undefined;
}

export async function getMemberByLogin(login: UserLogin): Promise<Member | undefined> {
  const row = await prisma.member.findUnique({ where: { login } });
  return row ? mapMember(row) : undefined;
}

export async function getPinnedProjects(): Promise<Project[]> {
  const rows = await prisma.project.findMany({
    where: { pinned: true },
    include: { members: true, repos: true, papers: true, releases: true },
  });
  return rows.map(mapProject);
}

export async function getPapersByProject(slug: Slug): Promise<Paper[]> {
  const rows = await prisma.paper.findMany({
    where: { projectSlug: slug },
    include: { authors: true },
  });
  return rows.map(mapPaper);
}

export async function getRunsByProject(slug: Slug): Promise<ExperimentRun[]> {
  const rows = await prisma.experimentRun.findMany({ where: { projectSlug: slug } });
  return rows.map(mapRun);
}

export async function getReleasesByProject(slug: Slug): Promise<Release[]> {
  const rows = await prisma.release.findMany({ where: { projectSlug: slug } });
  return rows.map(mapRelease);
}

export async function getMembersByProject(slug: Slug): Promise<Member[]> {
  const rows = await prisma.member.findMany({
    where: { memberProjects: { some: { projectSlug: slug } } },
  });
  return rows.map(mapMember);
}

export async function getUpcomingVenues(now: Date = new Date()): Promise<Venue[]> {
  const rows = await prisma.venue.findMany({
    where: { deadline: { gte: now } },
    orderBy: { deadline: 'asc' },
  });
  return rows.map(mapVenue);
}

export async function getRecentEvents(limit: number = 20): Promise<ActivityEvent[]> {
  const rows = await prisma.activityEvent.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  return rows.map(mapEvent);
}

export async function getDiscussionById(id: string): Promise<Discussion | undefined> {
  const row = await prisma.discussion.findUnique({
    where: { id },
    include: { replies: true },
  });
  return row ? mapDiscussion(row) : undefined;
}

export async function getRunById(id: string): Promise<ExperimentRun | undefined> {
  const row = await prisma.experimentRun.findUnique({ where: { id } });
  return row ? mapRun(row) : undefined;
}

export async function getReleaseById(id: string): Promise<Release | undefined> {
  const row = await prisma.release.findUnique({ where: { id } });
  return row ? mapRelease(row) : undefined;
}

export async function getPaperById(id: string): Promise<Paper | undefined> {
  const row = await prisma.paper.findUnique({
    where: { id },
    include: { authors: true },
  });
  return row ? mapPaper(row) : undefined;
}

// ============================================================================
// Full-collection getters (replacing the raw-array exports from lib/mock)
// ============================================================================

export async function getAllProjects(): Promise<Project[]> {
  const rows = await prisma.project.findMany({
    include: { members: true, repos: true, papers: true, releases: true },
  });
  return rows.map(mapProject);
}

export async function getAllMembers(): Promise<Member[]> {
  const rows = await prisma.member.findMany();
  return rows.map(mapMember);
}

export async function getAllPapers(): Promise<Paper[]> {
  const rows = await prisma.paper.findMany({ include: { authors: true } });
  return rows.map(mapPaper);
}

export async function getAllRuns(): Promise<ExperimentRun[]> {
  const rows = await prisma.experimentRun.findMany();
  return rows.map(mapRun);
}

export async function getAllDiscussions(): Promise<Discussion[]> {
  const rows = await prisma.discussion.findMany({ include: { replies: true } });
  return rows.map(mapDiscussion);
}

export async function getAllReleases(): Promise<Release[]> {
  const rows = await prisma.release.findMany();
  return rows.map(mapRelease);
}

export async function getAllEvents(): Promise<ActivityEvent[]> {
  const rows = await prisma.activityEvent.findMany();
  return rows.map(mapEvent);
}

export async function getAllVenues(): Promise<Venue[]> {
  const rows = await prisma.venue.findMany();
  return rows.map(mapVenue);
}

// ============================================================================
// Research Journal
// ============================================================================

type EntryArtifactRow = {
  type: string;
  title: string;
  href: string;
  position: number;
};

type EntrySlideRow = {
  position: number;
  kind: string;
  title: string;
  body: string;
  chip: string | null;
  metricsJson: string | null;
  code: string | null;
};

type ResearchEntryRow = {
  id: string;
  projectSlug: string;
  date: Date;
  type: string;
  authorLogin: string;
  title: string;
  summary: string;
  tags: string;
  bodyMarkdown: string;
  artifacts?: EntryArtifactRow[];
  slides?: EntrySlideRow[];
};

function mapArtifact(row: EntryArtifactRow): EntryArtifact {
  return {
    type: row.type as ArtifactType,
    title: row.title,
    href: row.href,
  };
}

function mapSlide(row: EntrySlideRow): EntrySlide {
  const slide: EntrySlide = {
    kind: row.kind as SlideKind,
    title: row.title,
    body: row.body,
  };
  if (row.chip != null) slide.chip = row.chip;
  if (row.metricsJson != null) slide.metrics = JSON.parse(row.metricsJson) as EntryMetric[];
  if (row.code != null) slide.code = row.code;
  return slide;
}

function mapEntry(row: ResearchEntryRow): ResearchEntry {
  const sortedArtifacts = [...(row.artifacts ?? [])].sort((a, b) => a.position - b.position);
  const sortedSlides = [...(row.slides ?? [])].sort((a, b) => a.position - b.position);
  return {
    id: row.id,
    projectSlug: row.projectSlug,
    date: row.date.toISOString(),
    type: row.type as EntryType,
    authorLogin: row.authorLogin,
    title: row.title,
    summary: row.summary,
    tags: JSON.parse(row.tags) as string[],
    bodyMarkdown: row.bodyMarkdown,
    artifacts: sortedArtifacts.map(mapArtifact),
    slides: sortedSlides.map(mapSlide),
  };
}

type MilestoneRow = {
  id: number;
  date: Date;
  label: string;
  note: string | null;
  status: string;
  position: number;
};

function mapMilestone(row: MilestoneRow): Milestone {
  const m: Milestone = {
    id: row.id,
    date: row.date.toISOString(),
    label: row.label,
    status: row.status as MilestoneStatus,
    position: row.position,
  };
  if (row.note != null) m.note = row.note;
  return m;
}

type TodoItemRow = {
  id: number;
  bucket: string;
  text: string;
  done: boolean;
  position: number;
};

function mapTodo(row: TodoItemRow): TodoItem {
  return {
    id: row.id,
    bucket: row.bucket as TodoBucket,
    text: row.text,
    done: row.done,
    position: row.position,
  };
}

export async function getEntriesByProject(slug: Slug): Promise<ResearchEntry[]> {
  const rows = await prisma.researchEntry.findMany({
    where: { projectSlug: slug },
    include: { artifacts: true, slides: true },
    orderBy: { date: 'desc' },
  });
  return rows.map(mapEntry);
}

export async function getEntryById(id: string): Promise<ResearchEntry | undefined> {
  const row = await prisma.researchEntry.findUnique({
    where: { id },
    include: { artifacts: true, slides: true },
  });
  return row ? mapEntry(row) : undefined;
}

export async function getMilestonesByProject(slug: Slug): Promise<Milestone[]> {
  const rows = await prisma.milestone.findMany({
    where: { projectSlug: slug },
    orderBy: { position: 'asc' },
  });
  return rows.map(mapMilestone);
}

export async function getTodosByProject(slug: Slug): Promise<TodoItem[]> {
  const rows = await prisma.todoItem.findMany({
    where: { projectSlug: slug },
    orderBy: [{ bucket: 'asc' }, { position: 'asc' }],
  });
  return rows.map(mapTodo);
}
