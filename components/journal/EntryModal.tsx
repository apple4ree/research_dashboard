'use client';

import { useEffect, useRef, useState } from 'react';
import { XIcon, LinkExternalIcon } from '@primer/octicons-react';
import type { ResearchEntry, ArtifactType } from '@/lib/types';
import { ENTRY_TYPE_LABELS, ENTRY_TYPE_TONE } from '@/lib/labels';
import { LabelChip } from '@/components/badges/LabelChip';
import { MarkdownBody } from '@/components/md/MarkdownBody';
import { cn } from '@/lib/cn';

const ARTIFACT_ICON: Record<ArtifactType, string> = {
  notebook: '📓',
  figure: '🖼',
  sheet: '📊',
  csv: '📄',
  doc: '📝',
  slide: '🎞',
};

type ChatMessage = { who: 'user' | 'ai'; text: string };

function mockAnswer(q: string): string {
  if (/todo|할 일|남/i.test(q)) return '이번 주 남은 것: planner 초안 PR, 세미나 슬라이드.';
  if (/baseline|비교/i.test(q))
    return 'KLASS = KL filter, Hierarchy = masking, PAPL = planner.';
  if (/icml|d-|데드라인/i.test(q)) return 'ICML 2026: 2026-02-04 제출.';
  return '(mock) 실제로는 프로젝트 문서를 RAG로 연결해 답합니다.';
}

export function EntryModal({
  entry,
  onClose,
}: {
  entry: ResearchEntry | null;
  onClose: () => void;
}) {
  if (!entry) return null;
  return <EntryModalBody key={entry.id} entry={entry} onClose={onClose} />;
}

function EntryModalBody({
  entry,
  onClose,
}: {
  entry: ResearchEntry;
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    { who: 'ai', text: '이 보고서와 프로젝트에 대해 자유롭게 물어보세요.' },
  ]);
  const [input, setInput] = useState('');
  const logRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    const handler = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Auto-scroll chat
  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [messages]);

  const tone = ENTRY_TYPE_TONE[entry.type];

  const send = (text?: string) => {
    const value = (text ?? input).trim();
    if (!value) return;
    setMessages(m => [...m, { who: 'user', text: value }]);
    setInput('');
    // Simulate async reply
    setTimeout(() => {
      setMessages(m => [...m, { who: 'ai', text: mockAnswer(value) }]);
    }, 300);
  };

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />
      <div className="relative max-w-[1400px] h-[92vh] mx-auto mt-[4vh] bg-canvas-subtle rounded-md shadow-md overflow-hidden flex flex-col border border-border-default">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 bg-white border-b border-border-default">
          <div className="flex items-center gap-3 min-w-0">
            <LabelChip tone={tone}>{ENTRY_TYPE_LABELS[entry.type]}</LabelChip>
            <h2 className="font-semibold text-fg-default truncate">{entry.title}</h2>
            <span className="text-xs text-fg-muted whitespace-nowrap">
              {entry.date.slice(0, 10)} · {entry.authorLogin}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="close"
            className="w-8 h-8 rounded-md hover:bg-canvas-inset flex items-center justify-center text-fg-muted"
          >
            <XIcon size={16} />
          </button>
        </div>
        {/* 3-panel grid */}
        <div className="flex-1 grid grid-cols-12 gap-0 min-h-0">
          {/* Markdown body */}
          <div className="col-span-12 md:col-span-6 bg-white md:border-r border-border-default flex flex-col min-h-0">
            <div className="px-5 py-2 border-b border-border-default text-xs text-fg-muted">
              <span>📄 보고 문서 (</span>
              <span className="font-mono">{`journal/${entry.date.slice(0, 10)}-${entry.type}.md`}</span>
              <span>)</span>
            </div>
            <div className="overflow-y-auto px-6 py-5 flex-1">
              <MarkdownBody source={entry.bodyMarkdown} />
            </div>
          </div>
          {/* Artifacts */}
          <div className="col-span-12 md:col-span-3 bg-white md:border-r border-border-default flex flex-col min-h-0">
            <div className="px-5 py-2 border-b border-border-default text-xs text-fg-muted">
              📊 분석 결과 & 아티팩트
            </div>
            <div className="overflow-y-auto px-4 py-4 flex-1 space-y-2">
              {entry.artifacts.length === 0 && (
                <p className="text-xs text-fg-muted">—</p>
              )}
              {entry.artifacts.map((a, i) => (
                <a
                  key={i}
                  href={a.href}
                  className="block border border-border-default rounded-md p-3 hover:bg-canvas-subtle transition-colors"
                >
                  <div className="flex items-start gap-2">
                    <div className="text-xl">{ARTIFACT_ICON[a.type]}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-fg-default truncate">
                        {a.title}
                      </div>
                      <div className="text-xs text-fg-muted">{a.type}</div>
                    </div>
                    <div className="text-fg-muted">
                      <LinkExternalIcon size={12} />
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </div>
          {/* Chatbot */}
          <div className="col-span-12 md:col-span-3 bg-white flex flex-col min-h-0">
            <div className="px-5 py-2 border-b border-border-default text-xs text-fg-muted flex items-center gap-2">
              <span>🤖 프로젝트 어시스턴트</span>
              <LabelChip tone="success" className="ml-auto">
                connected
              </LabelChip>
            </div>
            <div
              ref={logRef}
              className="flex-1 overflow-y-auto px-4 py-4 space-y-2 text-sm"
            >
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={cn(
                    'p-2.5 rounded-md',
                    m.who === 'user'
                      ? 'bg-accent-subtle text-fg-default ml-6'
                      : 'bg-canvas-subtle text-fg-default border border-border-default mr-6',
                  )}
                >
                  {m.text}
                </div>
              ))}
            </div>
            <div className="border-t border-border-default px-3 py-2">
              <div className="flex gap-2">
                <input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      send();
                    }
                  }}
                  className="flex-1 text-sm px-3 py-1.5 rounded-md border border-border-default focus:outline-none focus:border-accent-emphasis"
                  placeholder="프로젝트 관련 질문..."
                  aria-label="chat input"
                />
                <button
                  type="button"
                  onClick={() => send()}
                  className="px-3 py-1.5 text-sm rounded-md bg-fg-default text-white"
                >
                  →
                </button>
              </div>
              <div className="flex gap-1 mt-1.5 flex-wrap">
                {['이번 주 TODO?', 'baseline 비교', 'ICML D-?'].map(q => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => send(q)}
                    className="text-[10px] px-2 py-0.5 rounded-full border border-border-default text-fg-muted hover:bg-canvas-subtle"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
