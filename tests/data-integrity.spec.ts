import { test, expect } from '@playwright/test';
import {
  members, projects, papers, experiments, discussions, releases, events, venues,
  getProjectBySlug, getMemberByLogin, getPapersByProject, getRunsByProject,
  getReleasesByProject, getPinnedProjects,
} from '@/lib/mock';

test.describe('mock data integrity', () => {
  test('all IDs are unique within their collection', () => {
    const check = (name: string, ids: string[]) => {
      expect(new Set(ids).size, name).toBe(ids.length);
    };
    check('members', members.map(m => m.login));
    check('projects', projects.map(p => p.slug));
    check('papers', papers.map(p => p.id));
    check('experiments', experiments.map(e => e.id));
    check('discussions', discussions.map(d => d.id));
    check('releases', releases.map(r => r.id));
    check('events', events.map(e => e.id));
    check('venues', venues.map(v => v.id));
  });

  test('every projectSlug reference points to an existing project', () => {
    const slugs = new Set(projects.map(p => p.slug));
    for (const p of papers) expect(slugs.has(p.projectSlug), `paper ${p.id}`).toBe(true);
    for (const e of experiments) expect(slugs.has(e.projectSlug), `exp ${e.id}`).toBe(true);
    for (const r of releases) expect(slugs.has(r.projectSlug), `release ${r.id}`).toBe(true);
    for (const ev of events) if (ev.projectSlug) expect(slugs.has(ev.projectSlug), `event ${ev.id}`).toBe(true);
  });

  test('every login reference points to an existing member', () => {
    const logins = new Set(members.map(m => m.login));
    for (const p of projects) for (const l of p.memberLogins) expect(logins.has(l), `project ${p.slug}`).toBe(true);
    for (const p of papers) for (const l of p.authorLogins) expect(logins.has(l), `paper ${p.id}`).toBe(true);
    for (const e of experiments) expect(logins.has(e.triggeredByLogin), `exp ${e.id}`).toBe(true);
    for (const d of discussions) expect(logins.has(d.authorLogin), `discussion ${d.id}`).toBe(true);
    for (const ev of events) expect(logins.has(ev.actorLogin), `event ${ev.id}`).toBe(true);
  });

  test('helper queries return expected shapes', () => {
    expect(getProjectBySlug('reasoning-bench-v2')).toBeDefined();
    expect(getProjectBySlug('nonexistent')).toBeUndefined();
    expect(getMemberByLogin('dgu')?.role).toBe('PhD');
    expect(getPapersByProject('reasoning-bench-v2').length).toBeGreaterThan(0);
    expect(getRunsByProject('long-context-eval').length).toBeGreaterThan(0);
    expect(getReleasesByProject('claude-skill-suite').length).toBeGreaterThan(0);
    expect(getPinnedProjects().every(p => p.pinned)).toBe(true);
  });
});
