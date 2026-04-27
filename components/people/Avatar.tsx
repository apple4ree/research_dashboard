'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';

interface Props {
  login: string;
  /**
   * Optional uploaded avatar URL. When the parent already knows it
   * (e.g. server component rendering a list with `Member.avatarUrl` in
   * scope), pass it explicitly to skip the client-side lookup. When
   * undefined, the Avatar self-fetches via /api/members/:login/avatar-url
   * and renders the initials tile until the response arrives.
   */
  avatarUrl?: string | null;
  size?: number;
  className?: string;
}

// Module-scope caches so multiple Avatars for the same login share one
// fetch and survive across re-renders within a session.
const urlCache = new Map<string, string | null>();
const inflight = new Map<string, Promise<string | null>>();

function fetchAvatarUrl(login: string): Promise<string | null> {
  if (urlCache.has(login)) return Promise.resolve(urlCache.get(login) ?? null);
  let p = inflight.get(login);
  if (p) return p;
  p = fetch(`/api/members/${encodeURIComponent(login)}/avatar-url`, { credentials: 'same-origin' })
    .then(r => (r.ok ? r.json() : null))
    .then((b: { avatarUrl?: string | null } | null) => b?.avatarUrl ?? null)
    .catch(() => null)
    .then(v => {
      urlCache.set(login, v);
      inflight.delete(login);
      return v;
    });
  inflight.set(login, p);
  return p;
}

function hashColor(s: string) {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const hue = h % 360;
  return `hsl(${hue}, 55%, 60%)`;
}

export function Avatar({ login, avatarUrl, size = 20, className }: Props) {
  // The explicit prop wins synchronously (no fetch needed). When the
  // parent doesn't know, we fall back to the module-scope cache to avoid
  // a network round-trip across re-renders, and only kick off a fetch
  // when nothing is known yet.
  const [fetched, setFetched] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    if (avatarUrl !== undefined) return;
    if (urlCache.has(login)) return; // already memoized, render reads it directly
    let cancelled = false;
    fetchAvatarUrl(login).then(v => {
      if (!cancelled) setFetched(v);
    });
    return () => {
      cancelled = true;
    };
  }, [login, avatarUrl]);

  const finalUrl =
    avatarUrl !== undefined ? avatarUrl : urlCache.get(login) ?? fetched ?? null;

  if (finalUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={finalUrl}
        alt={login}
        width={size}
        height={size}
        className={cn('inline-block rounded-full object-cover', className)}
        style={{ width: size, height: size }}
      />
    );
  }
  const initials = login.slice(0, 2).toUpperCase();
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-full text-[10px] font-semibold text-white select-none',
        className,
      )}
      style={{ width: size, height: size, background: hashColor(login) }}
      aria-label={login}
      title={login}
    >
      {initials}
    </span>
  );
}
