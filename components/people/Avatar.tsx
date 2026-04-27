import { cn } from '@/lib/cn';

interface Props {
  login: string;
  /** Optional uploaded avatar URL (e.g. /api/uploads/avatars/<login>.png?v=…). Falls back to initials when missing. */
  avatarUrl?: string | null;
  size?: number;
  className?: string;
}

function hashColor(s: string) {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const hue = h % 360;
  return `hsl(${hue}, 55%, 60%)`;
}

export function Avatar({ login, avatarUrl, size = 20, className }: Props) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
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
