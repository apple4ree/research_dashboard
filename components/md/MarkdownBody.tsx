'use client';

import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/cn';

export function MarkdownBody({
  source,
  className,
  size = 'sm',
  wikiSlug,
  wikiEntityIds,
}: {
  source: string;
  className?: string;
  /**
   * 'sm' = compact (project README, journal cards). 'base' = roomier reading
   * pace, used for wiki entity bodies. 'lg' = fully Notion-style page.
   */
  size?: 'sm' | 'base' | 'lg';
  /**
   * When both are set, links matching `(prefix/)?<id>.md` are rewritten to
   * `/projects/<wikiSlug>/wiki/<id>` if id ∈ wikiEntityIds. External links
   * and unknown targets pass through unchanged.
   */
  wikiSlug?: string;
  wikiEntityIds?: readonly string[];
}) {
  const proseSize =
    size === 'lg' ? 'prose-lg' : size === 'base' ? 'prose-base' : 'prose-sm';

  const wikiSet =
    wikiSlug && wikiEntityIds && wikiEntityIds.length > 0
      ? new Set(wikiEntityIds)
      : null;

  const components: Components | undefined = wikiSet
    ? {
        a({ href, children, ...rest }) {
          const m = typeof href === 'string' ? href.match(/(?:^|\/)([\w.\-]+)\.md(?:#.*)?$/) : null;
          if (m && wikiSet.has(m[1])) {
            const hash = href!.includes('#') ? href!.slice(href!.indexOf('#')) : '';
            return (
              <a href={`/projects/${wikiSlug}/wiki/${encodeURIComponent(m[1])}${hash}`} {...rest}>
                {children}
              </a>
            );
          }
          return (
            <a href={href} {...rest}>
              {children}
            </a>
          );
        },
      }
    : undefined;

  return (
    <div
      className={cn(
        'prose max-w-none text-fg-default',
        proseSize,
        '[&_h1]:mt-0 [&_h2]:mt-8 [&_h2]:mb-3 [&_h3]:mt-6 [&_h3]:mb-2',
        '[&_h1]:font-semibold [&_h2]:font-semibold [&_h3]:font-semibold',
        '[&_p]:leading-relaxed [&_li]:leading-relaxed',
        '[&_a]:text-accent-fg [&_a]:no-underline hover:[&_a]:underline',
        '[&_code]:bg-canvas-inset [&_code]:text-fg-default [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:font-normal [&_code]:text-[0.9em] [&_code]:before:content-none [&_code]:after:content-none',
        '[&_pre]:bg-canvas-subtle [&_pre]:border [&_pre]:border-border-muted [&_pre]:p-4 [&_pre]:rounded-md',
        '[&_table]:w-auto [&_table]:border-collapse [&_table]:my-4',
        '[&_thead]:bg-canvas-subtle',
        '[&_th]:px-3 [&_th]:py-1.5 [&_th]:text-left [&_th]:font-semibold [&_th]:border [&_th]:border-border-default',
        '[&_td]:px-3 [&_td]:py-1.5 [&_td]:border [&_td]:border-border-default [&_td]:align-top',
        '[&_blockquote]:not-italic [&_blockquote]:border-l-4 [&_blockquote]:border-border-default [&_blockquote]:bg-canvas-subtle [&_blockquote]:py-2 [&_blockquote]:px-4 [&_blockquote]:rounded-r-md',
        '[&_ul]:my-3 [&_ol]:my-3',
        '[&_hr]:border-border-muted [&_hr]:my-6',
        className,
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>{source}</ReactMarkdown>
    </div>
  );
}
