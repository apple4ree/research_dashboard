'use client';

import { useEffect, useRef, useState } from 'react';
import { LabelChip } from '@/components/badges/LabelChip';
import { MarkdownBody } from '@/components/md/MarkdownBody';
import { cn } from '@/lib/cn';

type ChatMessage = { who: 'user' | 'ai'; text: string };

const PRESET_QUESTIONS = ['이번 주 TODO?', '진행 중 실험은?', '논문 진행 상황?'] as const;

export function ProjectChatbot({ slug }: { slug: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    { who: 'ai', text: '이 프로젝트에 대해 자유롭게 물어보세요.' },
  ]);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [messages]);

  const send = async (text?: string) => {
    const value = (text ?? input).trim();
    if (!value || pending) return;

    const userMsg: ChatMessage = { who: 'user', text: value };
    setMessages(m => [...m, userMsg, { who: 'ai', text: '' }]);
    setInput('');
    setPending(true);

    const history = [...messages, userMsg]
      .filter(m => m.text)
      .map(m => ({ role: m.who === 'user' ? 'user' : 'assistant', content: m.text }));

    try {
      const res = await fetch(`/api/projects/${slug}/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messages: history }),
      });

      if (!res.ok || !res.body) {
        const errText = await res.text().catch(() => '');
        replaceLastAi(`(에러 ${res.status}) ${errText.slice(0, 200)}`);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = '';
      while (true) {
        const { value: chunk, done } = await reader.read();
        if (done) break;
        acc += decoder.decode(chunk, { stream: true });
        replaceLastAi(acc);
      }
    } catch (err) {
      replaceLastAi(`(에러) ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setPending(false);
    }
  };

  const replaceLastAi = (next: string) => {
    setMessages(m => {
      const copy = [...m];
      for (let i = copy.length - 1; i >= 0; i--) {
        if (copy[i].who === 'ai') {
          copy[i] = { who: 'ai', text: next };
          return copy;
        }
      }
      return copy;
    });
  };

  return (
    <div
      data-project-slug={slug}
      className="flex flex-col bg-white border border-border-default rounded-md overflow-hidden h-[calc(100vh-7rem)]"
    >
      <div className="px-4 py-2 border-b border-border-default text-xs text-fg-muted flex items-center gap-2">
        <span>🤖 프로젝트 어시스턴트</span>
        <LabelChip tone={pending ? 'attention' : 'success'} className="ml-auto">
          {pending ? 'thinking…' : 'connected'}
        </LabelChip>
      </div>
      <div
        ref={logRef}
        className="flex-1 overflow-y-auto px-3 py-3 space-y-2 text-sm"
      >
        {messages.map((m, i) => (
          <div
            key={i}
            className={cn(
              'p-2.5 rounded-md',
              m.who === 'user'
                ? 'bg-accent-subtle text-fg-default ml-6 whitespace-pre-wrap'
                : 'bg-canvas-subtle text-fg-default border border-border-default mr-6',
            )}
          >
            {m.who === 'ai' ? (
              m.text ? (
                <MarkdownBody source={m.text} size="sm" className="chatbot-md" />
              ) : (
                <span className="text-fg-muted">{pending ? '…' : ''}</span>
              )
            ) : (
              m.text
            )}
          </div>
        ))}
      </div>
      <div className="border-t border-border-default px-3 py-2">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            disabled={pending}
            className="flex-1 text-sm px-3 py-1.5 rounded-md border border-border-default focus:outline-none focus:border-accent-emphasis disabled:bg-canvas-subtle"
            placeholder="프로젝트 관련 질문..."
            aria-label="chat input"
          />
          <button
            type="button"
            onClick={() => send()}
            disabled={pending}
            className="px-3 py-1.5 text-sm rounded-md bg-fg-default text-white disabled:opacity-50"
          >
            →
          </button>
        </div>
        <div className="flex gap-1 mt-1.5 flex-wrap">
          {PRESET_QUESTIONS.map(q => (
            <button
              key={q}
              type="button"
              onClick={() => send(q)}
              disabled={pending}
              className="text-[10px] px-2 py-0.5 rounded-full border border-border-default text-fg-muted hover:bg-canvas-subtle disabled:opacity-50"
            >
              {q}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
