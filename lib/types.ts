export type Slug = string;
export type UserLogin = string;

export type PaperStage = 'idea' | 'experiments' | 'writing' | 'review' | 'published';
export type RunStatus = 'success' | 'failure' | 'in_progress' | 'queued' | 'cancelled';
export type MemberRole = 'PI' | 'Postdoc' | 'PhD' | 'MS' | 'Intern' | 'Alumni';
export type DiscussionCategory = 'announcements' | 'journal_club' | 'qa' | 'ideas';
export type ReleaseKind = 'dataset' | 'tool' | 'skill' | 'model';
export type VenueKind = 'abstract' | 'full' | 'camera_ready' | 'rebuttal';

export interface Project {
  slug: Slug;
  name: string;
  description: string;
  tags: string[];
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
  memberLogins: UserLogin[];
  repos: { label: string; url: string }[];
  paperIds: string[];
  releaseIds: string[];
}

export interface Paper {
  id: string;
  title: string;
  authorLogins: UserLogin[];
  projectSlug: Slug;
  stage: PaperStage;
  venue?: string;
  deadline?: string;
  draftUrl?: string;
  pdfUrl?: string;
}

export interface ExperimentRun {
  id: string;
  name: string;
  projectSlug: Slug;
  status: RunStatus;
  startedAt: string;
  durationSec?: number;
  triggeredByLogin: UserLogin;
  summary?: string;
  stepsMock?: { name: string; status: RunStatus; logSnippet?: string }[];
}

export interface Member {
  login: UserLogin;
  displayName: string;
  role: MemberRole;
  avatarUrl?: string;
  bio?: string;
  pinnedProjectSlugs: Slug[];
}

export interface Discussion {
  id: string;
  category: DiscussionCategory;
  title: string;
  authorLogin: UserLogin;
  createdAt: string;
  lastActivityAt: string;
  replyCount: number;
  bodyMarkdown: string;
  replies: { authorLogin: UserLogin; createdAt: string; bodyMarkdown: string }[];
}

export interface Release {
  id: string;
  name: string;
  kind: ReleaseKind;
  projectSlug: Slug;
  version: string;
  publishedAt: string;
  description?: string;
  downloadUrl?: string;
}

interface BaseEvent {
  id: string;
  actorLogin: UserLogin;
  projectSlug?: Slug;
  createdAt: string;
}

export type PaperEventAction = 'created' | 'uploaded_draft' | 'published';
export type ExperimentEventAction = 'started' | 'succeeded' | 'failed' | 'cancelled';
export type ReleaseEventAction = 'published';
export type DiscussionEventAction = 'opened' | 'replied';
export type ProjectEventAction = 'updated_readme' | 'created' | 'archived';

export interface PaperEvent extends BaseEvent {
  type: 'paper';
  payload: { paperId: string; action: PaperEventAction; version?: number };
}
export interface ExperimentEvent extends BaseEvent {
  type: 'experiment';
  payload: { runId: string; action: ExperimentEventAction };
}
export interface ReleaseEvent extends BaseEvent {
  type: 'release';
  payload: { releaseId: string; action: ReleaseEventAction };
}
export interface DiscussionEvent extends BaseEvent {
  type: 'discussion';
  payload: { discussionId: string; action: DiscussionEventAction };
}
export interface ProjectEvent extends BaseEvent {
  type: 'project';
  payload: { action: ProjectEventAction };
}

export type ActivityEvent = PaperEvent | ExperimentEvent | ReleaseEvent | DiscussionEvent | ProjectEvent;
export type EventType = ActivityEvent['type'];

export interface Venue {
  id: string;
  name: string;
  deadline: string;
  kind: VenueKind;
}
