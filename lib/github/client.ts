// Minimal GitHub REST API wrapper. Uses native fetch.
// If GITHUB_TOKEN env var is set, requests include an Authorization header
// (5000/hr authenticated limit). Otherwise unauthenticated (60/hr).

const GITHUB_API = 'https://api.github.com';

function headers(): Record<string, string> {
  const h: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  const token = process.env.GITHUB_TOKEN;
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

export class GitHubError extends Error {
  code: number;
  constructor(message: string, code: number) {
    super(message);
    this.name = 'GitHubError';
    this.code = code;
  }
}

async function githubFetch(path: string): Promise<unknown> {
  const res = await fetch(`${GITHUB_API}${path}`, {
    headers: headers(),
    // Next.js caching: revalidate every 10 min for most endpoints.
    next: { revalidate: 600 },
  });
  if (res.status === 404) {
    throw new GitHubError('Repository not found on GitHub.', 404);
  }
  if (res.status === 403) {
    // eslint-disable-next-line no-console
    console.warn('[github] Rate limit or forbidden response for', path);
    throw new GitHubError(
      'GitHub rate limit exceeded. Set GITHUB_TOKEN to increase the limit from 60/hr to 5000/hr.',
      403,
    );
  }
  if (!res.ok) {
    throw new GitHubError(`GitHub API error: ${res.status} ${res.statusText}`, res.status);
  }
  return res.json();
}

export interface GitHubRepo {
  full_name: string;
  description: string | null;
  topics: string[];
  default_branch: string;
  updated_at: string;
  stargazers_count: number;
  html_url: string;
}

export interface GitHubRelease {
  id: number;
  tag_name: string;
  name: string | null;
  body: string | null;
  published_at: string | null;
  html_url: string;
  tarball_url: string;
  zipball_url: string;
}

export function parseRepo(input: string): { owner: string; repo: string } | null {
  const trimmed = input
    .trim()
    .replace(/^https?:\/\/github\.com\//i, '')
    .replace(/\.git$/i, '')
    .replace(/\/$/, '');
  const parts = trimmed.split('/').filter(Boolean);
  if (parts.length < 2) return null;
  const [owner, repo] = parts.slice(-2);
  if (!owner || !repo) return null;
  const segment = /^[A-Za-z0-9_.-]+$/;
  if (!segment.test(owner)) return null;
  if (!segment.test(repo)) return null;
  return { owner, repo };
}

export async function fetchRepo(ownerRepo: string): Promise<GitHubRepo> {
  const parsed = parseRepo(ownerRepo);
  if (!parsed) throw new GitHubError('Invalid repo format. Use "owner/repo".', 400);
  return (await githubFetch(`/repos/${parsed.owner}/${parsed.repo}`)) as GitHubRepo;
}

export async function fetchReadme(ownerRepo: string): Promise<string | null> {
  const parsed = parseRepo(ownerRepo);
  if (!parsed) return null;
  try {
    const res = await fetch(
      `${GITHUB_API}/repos/${parsed.owner}/${parsed.repo}/readme`,
      {
        headers: { ...headers(), Accept: 'application/vnd.github.raw' },
        next: { revalidate: 600 },
      },
    );
    if (res.ok) return await res.text();
    return null;
  } catch {
    return null;
  }
}

export async function fetchReleases(
  ownerRepo: string,
  limit = 30,
): Promise<GitHubRelease[]> {
  const parsed = parseRepo(ownerRepo);
  if (!parsed) throw new GitHubError('Invalid repo format.', 400);
  const perPage = Math.min(Math.max(1, limit), 100);
  return (await githubFetch(
    `/repos/${parsed.owner}/${parsed.repo}/releases?per_page=${perPage}`,
  )) as GitHubRelease[];
}
