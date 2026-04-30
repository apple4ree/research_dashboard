const WEBHOOK_ENV = 'SLACK_NOTICE_WEBHOOK_URL';

function publicBaseUrl(): string | null {
  const raw = process.env.NOTICE_PUBLIC_BASE_URL || process.env.AUTH_URL;
  if (!raw) return null;
  return raw.replace(/\/+$/, '');
}

function noticeLink(id: string): string | null {
  const base = publicBaseUrl();
  return base ? `${base}/notices/${id}` : null;
}

function truncate(s: string, n: number): string {
  const collapsed = s.replace(/\s+/g, ' ').trim();
  return collapsed.length > n ? `${collapsed.slice(0, n - 1)}…` : collapsed;
}

function titleAsLink(noticeId: string, title: string): string {
  const link = noticeLink(noticeId);
  return link ? `<${link}|${title}>` : title;
}

async function send(text: string): Promise<void> {
  const url = process.env[WEBHOOK_ENV];
  if (!url) return;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text }),
    cache: 'no-store',
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error('[slack] webhook post failed', res.status, body);
  }
}

export type SlackNoticeCreatedPayload = {
  title: string;
  category: string;
  authorLogin: string;
  noticeId: string;
  bodyMarkdown?: string;
};

export async function postNoticeCreated(p: SlackNoticeCreatedPayload): Promise<void> {
  const preview = p.bodyMarkdown ? truncate(p.bodyMarkdown, 240) : '';
  const text =
    `:loudspeaker: *New ${p.category}* — ${titleAsLink(p.noticeId, p.title)}\n` +
    `_by ${p.authorLogin}_` +
    (preview ? `\n>${preview}` : '');
  await send(text);
}

export type SlackNoticeUpdatedPayload = {
  title: string;
  category: string;
  editorLogin: string;
  noticeId: string;
  titleChanged: boolean;
  previousTitle?: string;
};

export async function postNoticeUpdated(p: SlackNoticeUpdatedPayload): Promise<void> {
  const headline =
    p.titleChanged && p.previousTitle
      ? `${titleAsLink(p.noticeId, p.title)} _(was: ${p.previousTitle})_`
      : titleAsLink(p.noticeId, p.title);
  const text =
    `:pencil2: *Updated ${p.category}* — ${headline}\n` +
    `_edited by ${p.editorLogin}_`;
  await send(text);
}

export type SlackNoticeDeletedPayload = {
  title: string;
  category: string;
  noticeId: string;
  deleterLogin: string;
};

export async function postNoticeDeleted(p: SlackNoticeDeletedPayload): Promise<void> {
  const text =
    `:wastebasket: *Deleted ${p.category}* — ${p.title}\n` +
    `_removed by ${p.deleterLogin}_`;
  await send(text);
}

export type SlackNoticeCommentPayload = {
  noticeId: string;
  noticeTitle: string;
  commenterLogin: string;
  bodyMarkdown: string;
};

export async function postNoticeComment(p: SlackNoticeCommentPayload): Promise<void> {
  const preview = truncate(p.bodyMarkdown, 280);
  const text =
    `:speech_balloon: *New comment* on ${titleAsLink(p.noticeId, p.noticeTitle)}\n` +
    `_by ${p.commenterLogin}_\n` +
    `>${preview}`;
  await send(text);
}
