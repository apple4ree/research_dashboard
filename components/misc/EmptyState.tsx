export function EmptyState({ title, body }: { title: string; body?: string }) {
  return (
    <div className="border border-dashed border-border-default rounded-md p-8 text-center">
      <p className="font-semibold text-fg-default">{title}</p>
      {body && <p className="text-fg-muted text-sm mt-1">{body}</p>}
    </div>
  );
}
