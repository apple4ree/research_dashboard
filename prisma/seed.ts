import 'dotenv/config';
import path from 'node:path';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../lib/generated/prisma/client';
import { members } from '../lib/mock/members';
import { projects } from '../lib/mock/projects';
import { papers } from '../lib/mock/papers';
import { experiments } from '../lib/mock/experiments';
import { discussions } from '../lib/mock/discussions';
import { releases } from '../lib/mock/releases';
import { events } from '../lib/mock/events';
import { venues } from '../lib/mock/venues';
import {
  JOURNAL_PROJECT_SLUG,
  journalEntries,
  journalMilestones,
  journalTodos,
} from '../lib/mock/journal';

function resolveDatabaseUrl(): string {
  // Prisma 7 resolves `file:./path` relative to cwd.
  const raw = process.env.DATABASE_URL ?? 'file:./dev.db';
  const filePath = raw.startsWith('file:') ? raw.slice('file:'.length) : raw;
  if (path.isAbsolute(filePath)) return filePath;
  return path.resolve(process.cwd(), filePath);
}

const adapter = new PrismaBetterSqlite3({ url: `file:${resolveDatabaseUrl()}` });
const prisma = new PrismaClient({ adapter });

async function main() {
  // Wipe in dependency-safe order for idempotency.
  await prisma.reply.deleteMany();
  await prisma.discussion.deleteMany();
  await prisma.activityEvent.deleteMany();
  await prisma.experimentRun.deleteMany();
  await prisma.paperAuthor.deleteMany();
  await prisma.paper.deleteMany();
  await prisma.release.deleteMany();
  await prisma.entryArtifact.deleteMany();
  await prisma.entrySlide.deleteMany();
  await prisma.researchEntry.deleteMany();
  await prisma.milestone.deleteMany();
  await prisma.todoItem.deleteMany();
  await prisma.projectRepo.deleteMany();
  await prisma.projectMember.deleteMany();
  await prisma.project.deleteMany();
  await prisma.member.deleteMany();
  await prisma.venue.deleteMany();

  // Members
  for (const m of members) {
    await prisma.member.create({
      data: {
        login: m.login,
        displayName: m.displayName,
        role: m.role,
        avatarUrl: m.avatarUrl ?? null,
        bio: m.bio ?? null,
        pinnedProjectSlugs: JSON.stringify(m.pinnedProjectSlugs),
      },
    });
  }

  // Projects + M:N members + repos
  for (const p of projects) {
    await prisma.project.create({
      data: {
        slug: p.slug,
        name: p.name,
        description: p.description,
        tags: JSON.stringify(p.tags),
        pinned: p.pinned,
        createdAt: new Date(p.createdAt),
        updatedAt: new Date(p.updatedAt),
        members: {
          create: p.memberLogins.map(login => ({
            member: { connect: { login } },
          })),
        },
        repos: {
          create: p.repos.map(r => ({
            label: r.label,
            url: r.url,
          })),
        },
      },
    });
  }

  // LLDM Unlearning — dedicated journal project
  await prisma.project.create({
    data: {
      slug: JOURNAL_PROJECT_SLUG,
      name: 'LLDM Unlearning',
      description: 'Diffusion LLM에서 특정 지식을 제거하는 연구 — 2025 Fall 부터 진행 중',
      tags: JSON.stringify(['LLM', 'unlearning', 'diffusion', 'safety']),
      pinned: true,
      createdAt: new Date('2025-11-01T00:00:00Z'),
      updatedAt: new Date('2026-04-21T00:00:00Z'),
      members: {
        create: [
          { member: { connect: { login: 'sooyoung' } } },
          { member: { connect: { login: 'jihoon' } } },
          { member: { connect: { login: 'yeji' } } },
          { member: { connect: { login: 'sungmin' } } },
        ],
      },
      repos: {
        create: [
          { label: 'GitHub', url: 'https://github.com/example/lldm-unlearning' },
        ],
      },
    },
  });

  // Journal entries (+ nested slides + artifacts)
  for (const e of journalEntries) {
    await prisma.researchEntry.create({
      data: {
        id: e.id,
        projectSlug: e.projectSlug,
        date: new Date(e.date),
        type: e.type,
        authorLogin: e.authorLogin,
        title: e.title,
        summary: e.summary,
        tags: JSON.stringify(e.tags),
        bodyMarkdown: e.bodyMarkdown,
        artifacts: {
          create: e.artifacts.map((a, i) => ({
            type: a.type,
            title: a.title,
            href: a.href,
            position: i,
          })),
        },
        slides: {
          create: e.slides.map((s, i) => ({
            position: i,
            kind: s.kind,
            title: s.title,
            body: s.body,
            chip: s.chip ?? null,
            metricsJson: s.metrics ? JSON.stringify(s.metrics) : null,
            code: s.code ?? null,
          })),
        },
      },
    });
  }

  // Milestones
  for (const m of journalMilestones) {
    await prisma.milestone.create({
      data: {
        projectSlug: JOURNAL_PROJECT_SLUG,
        date: new Date(m.date),
        label: m.label,
        note: m.note ?? null,
        status: m.status,
        position: m.position,
      },
    });
  }

  // Todos
  for (const t of journalTodos) {
    await prisma.todoItem.create({
      data: {
        projectSlug: JOURNAL_PROJECT_SLUG,
        bucket: t.bucket,
        text: t.text,
        done: t.done,
        position: t.position,
      },
    });
  }

  // Papers + PaperAuthor
  for (const pp of papers) {
    await prisma.paper.create({
      data: {
        id: pp.id,
        title: pp.title,
        projectSlug: pp.projectSlug,
        stage: pp.stage,
        venue: pp.venue ?? null,
        deadline: pp.deadline ? new Date(pp.deadline) : null,
        draftUrl: pp.draftUrl ?? null,
        pdfUrl: pp.pdfUrl ?? null,
        authors: {
          create: pp.authorLogins.map((login, i) => ({
            position: i,
            author: { connect: { login } },
          })),
        },
      },
    });
  }

  // Releases
  for (const r of releases) {
    await prisma.release.create({
      data: {
        id: r.id,
        name: r.name,
        kind: r.kind,
        projectSlug: r.projectSlug,
        version: r.version,
        publishedAt: new Date(r.publishedAt),
        description: r.description ?? null,
        downloadUrl: r.downloadUrl ?? null,
      },
    });
  }

  // Experiment runs
  for (const e of experiments) {
    await prisma.experimentRun.create({
      data: {
        id: e.id,
        name: e.name,
        projectSlug: e.projectSlug,
        status: e.status,
        startedAt: new Date(e.startedAt),
        durationSec: e.durationSec ?? null,
        triggeredByLogin: e.triggeredByLogin,
        summary: e.summary ?? null,
        stepsJson: e.stepsMock ? JSON.stringify(e.stepsMock) : null,
      },
    });
  }

  // Activity events
  for (const ev of events) {
    await prisma.activityEvent.create({
      data: {
        id: ev.id,
        type: ev.type,
        actorLogin: ev.actorLogin,
        projectSlug: ev.projectSlug ?? null,
        payload: JSON.stringify(ev.payload),
        createdAt: new Date(ev.createdAt),
      },
    });
  }

  // Venues
  for (const v of venues) {
    await prisma.venue.create({
      data: {
        id: v.id,
        name: v.name,
        deadline: new Date(v.deadline),
        kind: v.kind,
      },
    });
  }

  // Discussions + Replies
  for (const d of discussions) {
    await prisma.discussion.create({
      data: {
        id: d.id,
        category: d.category,
        title: d.title,
        authorLogin: d.authorLogin,
        createdAt: new Date(d.createdAt),
        lastActivityAt: new Date(d.lastActivityAt),
        replyCount: d.replyCount,
        bodyMarkdown: d.bodyMarkdown,
        replies: {
          create: d.replies.map((r, i) => ({
            authorLogin: r.authorLogin,
            createdAt: new Date(r.createdAt),
            bodyMarkdown: r.bodyMarkdown,
            position: i,
          })),
        },
      },
    });
  }

  const counts = {
    members: await prisma.member.count(),
    projects: await prisma.project.count(),
    papers: await prisma.paper.count(),
    runs: await prisma.experimentRun.count(),
    discussions: await prisma.discussion.count(),
    replies: await prisma.reply.count(),
    releases: await prisma.release.count(),
    events: await prisma.activityEvent.count(),
    venues: await prisma.venue.count(),
    researchEntries: await prisma.researchEntry.count(),
    entrySlides: await prisma.entrySlide.count(),
    entryArtifacts: await prisma.entryArtifact.count(),
    milestones: await prisma.milestone.count(),
    todos: await prisma.todoItem.count(),
  };
  console.log('Seeded:', counts);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
