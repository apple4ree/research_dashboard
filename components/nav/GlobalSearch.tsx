'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  SearchIcon,
  RepoIcon,
  FileIcon,
  PersonIcon,
  PlayIcon,
  CommentIcon,
  DatabaseIcon,
  BookIcon,
} from '@primer/octicons-react';
import Fuse from 'fuse.js';
import type { SearchItem } from '@/app/api/search-index/route';

const TYPE_ICON: Record<SearchItem['type'], React.ComponentType<{ size?: number }>> = {
  project: RepoIcon,
  paper: FileIcon,
  member: PersonIcon,
  run: PlayIcon,
  discussion: CommentIcon,
  release: DatabaseIcon,
  entry: BookIcon,
};

const TYPE_LABEL: Record<SearchItem['type'], string> = {
  project: 'Projects',
  paper: 'Papers',
  member: 'Members',
  run: 'Experiments',
  discussion: 'Discussions',
  release: 'Releases',
  entry: 'Journal',
};

export function GlobalSearch() {
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<SearchItem[] | null>(null);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Fetch index once
  useEffect(() => {
    fetch('/api/search-index')
      .then((r) => r.json())
      .then((d) => setItems(d.items as SearchItem[]))
      .catch(() => setItems([]));
  }, []);

  // Global / key focuses the input
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (
        e.key === '/' &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const fuse = useMemo(() => {
    if (!items) return null;
    return new Fuse(items, {
      keys: [
        { name: 'title', weight: 0.6 },
        { name: 'keywords', weight: 0.4 },
      ],
      threshold: 0.4,
      ignoreLocation: true,
      minMatchCharLength: 2,
    });
  }, [items]);

  const results = useMemo(() => {
    if (!fuse || !query.trim()) return [];
    return fuse.search(query.trim()).slice(0, 8).map((r) => r.item);
  }, [fuse, query]);

  const grouped = useMemo(() => {
    const g: Record<string, SearchItem[]> = {};
    for (const r of results) {
      if (!g[r.type]) g[r.type] = [];
      g[r.type]!.push(r);
    }
    return g;
  }, [results]);

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      setOpen(false);
      inputRef.current?.blur();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, results.length - 1));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
      return;
    }
    if (e.key === 'Enter' && results[highlight]) {
      e.preventDefault();
      router.push(results[highlight].href);
      setOpen(false);
      setQuery('');
    }
  }

  return (
    <div
      className="relative flex-none w-[280px]"
      onBlur={() => setTimeout(() => setOpen(false), 150)}
    >
      <SearchIcon size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-white/60" />
      <input
        ref={inputRef}
        type="search"
        aria-label="Search"
        placeholder="Search projects, papers, people… (/)"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setHighlight(0);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        className="w-full h-7 pl-7 pr-2 rounded-md bg-white/10 text-[12px] text-white placeholder:text-white/60 outline-none focus:ring-2 focus:ring-accent-emphasis"
      />
      {open && query.trim() && (
        <div className="absolute top-full left-0 mt-1 w-[420px] bg-white text-fg-default border border-border-default rounded-md shadow-md max-h-[70vh] overflow-y-auto z-50">
          {results.length === 0 ? (
            <div className="p-3 text-sm text-fg-muted">No matches for &ldquo;{query}&rdquo;</div>
          ) : (
            <div className="py-1">
              {Object.entries(grouped).map(([type, xs]) => {
                const Icon = TYPE_ICON[type as SearchItem['type']];
                return (
                  <div key={type} className="py-1">
                    <div className="px-3 py-1 text-xs uppercase tracking-wide text-fg-muted font-semibold">
                      {TYPE_LABEL[type as SearchItem['type']]}
                    </div>
                    <ul>
                      {xs.map((r) => {
                        const idx = results.findIndex((x) => x === r);
                        const active = idx === highlight;
                        return (
                          <li key={r.href + r.title}>
                            <Link
                              href={r.href}
                              onClick={() => {
                                setOpen(false);
                                setQuery('');
                              }}
                              onMouseEnter={() => setHighlight(idx)}
                              className={`flex items-start gap-2 px-3 py-1.5 text-sm ${
                                active ? 'bg-accent-subtle' : 'hover:bg-canvas-subtle'
                              }`}
                            >
                              <Icon size={14} />
                              <div className="flex-1 min-w-0">
                                <div className="truncate">{r.title}</div>
                                {r.subtitle && (
                                  <div className="text-xs text-fg-muted truncate">{r.subtitle}</div>
                                )}
                              </div>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
