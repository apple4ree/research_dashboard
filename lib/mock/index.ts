import { members } from './members';
import { projects } from './projects';
import { papers } from './papers';
import { experiments } from './experiments';
import { discussions } from './discussions';
import { releases } from './releases';
import { events } from './events';
import { venues } from './venues';
import type { Slug, UserLogin } from '@/lib/types';

export { members, projects, papers, experiments, discussions, releases, events, venues };

export const CURRENT_USER: UserLogin = 'dgu';

export function getProjectBySlug(slug: Slug) {
  return projects.find(p => p.slug === slug);
}
export function getMemberByLogin(login: UserLogin) {
  return members.find(m => m.login === login);
}
export function getPinnedProjects() {
  return projects.filter(p => p.pinned);
}
export function getPapersByProject(slug: Slug) {
  return papers.filter(p => p.projectSlug === slug);
}
export function getRunsByProject(slug: Slug) {
  return experiments.filter(e => e.projectSlug === slug);
}
export function getReleasesByProject(slug: Slug) {
  return releases.filter(r => r.projectSlug === slug);
}
export function getMembersByProject(slug: Slug) {
  const proj = getProjectBySlug(slug);
  if (!proj) return [];
  return members.filter(m => proj.memberLogins.includes(m.login));
}
export function getUpcomingVenues(now = new Date()) {
  return venues
    .filter(v => new Date(v.deadline) >= now)
    .sort((a, b) => a.deadline.localeCompare(b.deadline));
}
export function getRecentEvents(limit = 20) {
  return [...events].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
}
export function getDiscussionById(id: string) {
  return discussions.find(d => d.id === id);
}
export function getRunById(id: string) {
  return experiments.find(e => e.id === id);
}
export function getReleaseById(id: string) {
  return releases.find(r => r.id === id);
}
export function getPaperById(id: string) {
  return papers.find(p => p.id === id);
}
