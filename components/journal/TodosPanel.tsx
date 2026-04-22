'use client';

import { useEffect, useRef, useState, useTransition, type FormEvent } from 'react';
import { AlertIcon, XIcon } from '@primer/octicons-react';
import type { TodoItem, TodoBucket } from '@/lib/types';
import { TODO_BUCKET_LABELS, TODO_BUCKET_ORDER } from '@/lib/labels';
import { cn } from '@/lib/cn';
import {
  toggleTodoAction,
  createTodoAction,
  deleteTodoAction,
  updateTodoTextAction,
} from '@/lib/actions/todos';

const bucketDot: Record<TodoBucket, string> = {
  short: 'bg-danger-emphasis',
  mid: 'bg-attention-emphasis',
  long: 'bg-accent-emphasis',
};

type Draft = {
  id: number;
  bucket: TodoBucket;
  text: string;
  done: boolean;
  position: number;
  pendingDelete?: boolean;
};

let tempIdCounter = -1;

export function TodosPanel({
  todos,
  projectSlug,
}: {
  todos: TodoItem[];
  projectSlug: string;
}) {
  const [items, setItems] = useState<Draft[]>(() => todos.map(t => ({ ...t })));
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const [bucketErrors, setBucketErrors] = useState<Partial<Record<TodoBucket, string>>>({});
  const [, startTransition] = useTransition();
  const editingRef = useRef<number | null>(null);
  const errorTimersRef = useRef<Partial<Record<TodoBucket, ReturnType<typeof setTimeout>>>>({});

  const showBucketError = (bucket: TodoBucket, message: string) => {
    setBucketErrors(prev => ({ ...prev, [bucket]: message }));
    const existing = errorTimersRef.current[bucket];
    if (existing) clearTimeout(existing);
    errorTimersRef.current[bucket] = setTimeout(() => {
      setBucketErrors(prev => {
        const next = { ...prev };
        delete next[bucket];
        return next;
      });
      delete errorTimersRef.current[bucket];
    }, 3000);
  };

  useEffect(() => {
    const timers = errorTimersRef.current;
    return () => {
      for (const t of Object.values(timers)) {
        if (t) clearTimeout(t);
      }
    };
  }, []);

  // Keep the ref in sync (effect runs after render, so no ref-in-render warning).
  useEffect(() => {
    editingRef.current = editingId;
  }, [editingId]);

  // Sync state when server-provided todos change (e.g. after revalidation).
  // Skip reset while the user is actively inline-editing.
  useEffect(() => {
    if (editingRef.current !== null) return;
    setItems(todos.map(t => ({ ...t })));
  }, [todos]);

  const byBucket = (b: TodoBucket) =>
    items
      .filter(t => t.bucket === b && !t.pendingDelete)
      .sort((a, b2) => a.position - b2.position);

  const handleToggle = (t: Draft) => {
    const nextDone = !t.done;
    setItems(prev => prev.map(it => (it.id === t.id ? { ...it, done: nextDone } : it)));
    startTransition(async () => {
      try {
        await toggleTodoAction(projectSlug, t.id, nextDone);
      } catch (err) {
        // rollback
        setItems(prev => prev.map(it => (it.id === t.id ? { ...it, done: t.done } : it)));
        showBucketError(
          t.bucket,
          err instanceof Error ? err.message : 'Failed to update todo.',
        );
      }
    });
  };

  const handleDelete = (t: Draft) => {
    setItems(prev => prev.map(it => (it.id === t.id ? { ...it, pendingDelete: true } : it)));
    startTransition(async () => {
      try {
        await deleteTodoAction(projectSlug, t.id);
        setItems(prev => prev.filter(it => it.id !== t.id));
      } catch (err) {
        setItems(prev =>
          prev.map(it => (it.id === t.id ? { ...it, pendingDelete: false } : it)),
        );
        showBucketError(
          t.bucket,
          err instanceof Error ? err.message : 'Failed to delete todo.',
        );
      }
    });
  };

  const handleAdd = async (bucket: TodoBucket, text: string, reset: () => void) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const tempId = tempIdCounter--;
    const maxPos = items
      .filter(i => i.bucket === bucket && !i.pendingDelete)
      .reduce((m, i) => Math.max(m, i.position), -1);
    setItems(prev => [
      ...prev,
      { id: tempId, bucket, text: trimmed, done: false, position: maxPos + 1 },
    ]);
    reset();
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set('text', trimmed);
        fd.set('bucket', bucket);
        await createTodoAction(projectSlug, fd);
        // revalidation will re-sync actual id; drop the temp row.
        setItems(prev => prev.filter(it => it.id !== tempId));
      } catch (err) {
        setItems(prev => prev.filter(it => it.id !== tempId));
        showBucketError(
          bucket,
          err instanceof Error ? err.message : 'Failed to add todo.',
        );
      }
    });
  };

  const startEdit = (t: Draft) => {
    setEditingId(t.id);
    setEditText(t.text);
  };

  const commitEdit = async (t: Draft) => {
    const trimmed = editText.trim();
    const originalId = t.id;
    setEditingId(null);
    if (!trimmed || trimmed === t.text) return;
    setItems(prev => prev.map(it => (it.id === t.id ? { ...it, text: trimmed } : it)));
    startTransition(async () => {
      try {
        await updateTodoTextAction(projectSlug, originalId, trimmed);
      } catch (err) {
        setItems(prev => prev.map(it => (it.id === originalId ? { ...it, text: t.text } : it)));
        showBucketError(
          t.bucket,
          err instanceof Error ? err.message : 'Failed to update todo.',
        );
      }
    });
  };

  return (
    <section className="grid md:grid-cols-3 gap-4" data-testid="todos-panel">
      {TODO_BUCKET_ORDER.map(bucket => {
        const bucketItems = byBucket(bucket);
        const done = bucketItems.filter(i => i.done).length;
        return (
          <div
            key={bucket}
            className="bg-white rounded-md border border-border-default p-5"
            data-testid={`todo-bucket-${bucket}`}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-fg-default flex items-center gap-2">
                <span className={cn('w-2 h-2 rounded-full', bucketDot[bucket])} />
                {TODO_BUCKET_LABELS[bucket]}
              </h3>
              <span className="text-xs text-fg-muted">
                {done} / {bucketItems.length}
              </span>
            </div>
            {bucketErrors[bucket] && (
              <div
                role="alert"
                data-testid={`todo-bucket-error-${bucket}`}
                className="flex items-start gap-1.5 bg-danger-subtle border border-danger-subtle rounded-md px-2 py-1.5 mb-2 text-xs text-danger-fg"
              >
                <AlertIcon size={12} className="mt-0.5 flex-shrink-0" />
                <span>{bucketErrors[bucket]}</span>
              </div>
            )}
            {bucketItems.length === 0 ? (
              <p className="text-xs text-fg-muted mb-3">—</p>
            ) : (
              <ul className="space-y-2 text-sm mb-3">
                {bucketItems.map(t => (
                  <li
                    key={t.id}
                    className="flex items-start gap-2 group"
                    data-testid="todo-row"
                  >
                    <input
                      type="checkbox"
                      checked={t.done}
                      onChange={() => handleToggle(t)}
                      disabled={t.id < 0}
                      className="mt-1 accent-fg-default cursor-pointer"
                      aria-label={t.text}
                    />
                    {editingId === t.id ? (
                      <input
                        autoFocus
                        value={editText}
                        onChange={e => setEditText(e.target.value)}
                        onBlur={() => void commitEdit(t)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            void commitEdit(t);
                          } else if (e.key === 'Escape') {
                            setEditingId(null);
                          }
                        }}
                        className="flex-1 text-sm px-1.5 py-0 -my-0.5 rounded border border-accent-emphasis focus:outline-none"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => startEdit(t)}
                        className={cn(
                          'flex-1 text-left',
                          t.done ? 'line-through text-fg-muted' : 'text-fg-default',
                        )}
                      >
                        {t.text}
                      </button>
                    )}
                    {t.id > 0 && editingId !== t.id && (
                      <button
                        type="button"
                        onClick={() => handleDelete(t)}
                        aria-label={`delete ${t.text}`}
                        className="opacity-0 group-hover:opacity-100 text-fg-muted hover:text-danger-fg transition-opacity mt-0.5"
                      >
                        <XIcon size={12} />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <AddTodoForm bucket={bucket} onAdd={handleAdd} />
          </div>
        );
      })}
    </section>
  );
}

function AddTodoForm({
  bucket,
  onAdd,
}: {
  bucket: TodoBucket;
  onAdd: (bucket: TodoBucket, text: string, reset: () => void) => void;
}) {
  const [text, setText] = useState('');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onAdd(bucket, text, () => setText(''));
  };

  return (
    <form onSubmit={submit} className="flex gap-1.5" data-testid={`add-todo-${bucket}`}>
      <input type="hidden" name="bucket" value={bucket} />
      <input
        type="text"
        name="text"
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="새 할 일..."
        className="flex-1 text-xs px-2 py-1 rounded-md border border-border-default focus:outline-none focus:border-accent-emphasis"
        aria-label={`add todo to ${bucket}`}
      />
      <button
        type="submit"
        disabled={!text.trim()}
        className="text-xs px-2.5 py-1 rounded-md border border-border-default text-fg-muted hover:bg-canvas-subtle disabled:opacity-40"
      >
        Add
      </button>
    </form>
  );
}
