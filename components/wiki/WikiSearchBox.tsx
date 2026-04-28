'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { SearchIcon, XIcon } from '@primer/octicons-react';

export function WikiSearchBox({
  slug,
  defaultQuery,
}: {
  slug: string;
  defaultQuery: string;
}) {
  const router = useRouter();
  const [q, setQ] = useState(defaultQuery);

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = q.trim();
    const target = trimmed
      ? `/projects/${slug}/wiki?q=${encodeURIComponent(trimmed)}`
      : `/projects/${slug}/wiki`;
    router.push(target);
  };

  const clear = () => {
    setQ('');
    router.push(`/projects/${slug}/wiki`);
  };

  return (
    <form onSubmit={submit} className="relative w-full sm:max-w-md">
      <SearchIcon
        size={14}
        className="absolute top-1/2 -translate-y-1/2 left-2.5 text-fg-muted pointer-events-none"
      />
      <input
        type="search"
        value={q}
        onChange={e => setQ(e.target.value)}
        placeholder="Wiki 검색 — 제목·요약·본문에서 찾기"
        className="w-full pl-7 pr-8 py-1.5 text-sm border border-border-default rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-accent-emphasis"
      />
      {q && (
        <button
          type="button"
          onClick={clear}
          aria-label="Clear search"
          className="absolute top-1/2 -translate-y-1/2 right-2 text-fg-muted hover:text-fg-default"
        >
          <XIcon size={12} />
        </button>
      )}
    </form>
  );
}
