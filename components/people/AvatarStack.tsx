import { Avatar } from './Avatar';
import { cn } from '@/lib/cn';

export function AvatarStack({ logins, size = 20, max = 4, className }: { logins: string[]; size?: number; max?: number; className?: string }) {
  const visible = logins.slice(0, max);
  const overflow = logins.length - visible.length;
  return (
    <span className={cn('inline-flex items-center', className)}>
      {visible.map((l, i) => (
        <span key={l} className="rounded-full ring-1 ring-white" style={{ marginLeft: i === 0 ? 0 : -6 }}>
          <Avatar login={l} size={size} />
        </span>
      ))}
      {overflow > 0 && (
        <span className="ml-1 text-xs text-fg-muted">+{overflow}</span>
      )}
    </span>
  );
}
