import { Avatar } from './Avatar';
import { getAvatarUrl } from '@/lib/avatar-lookup';

/**
 * Server-component wrapper around Avatar that resolves the uploaded
 * profile image (Member.avatarUrl) by login, with per-request caching
 * via lib/avatar-lookup. Use this in server components anywhere a bare
 * `<Avatar login={x}/>` would otherwise miss the uploaded image.
 *
 * Client components cannot import this; have their parent (a server
 * component) fetch the avatarUrl and pass it as a prop to <Avatar/>.
 */
export async function AvatarByLogin({
  login,
  size,
  className,
}: {
  login: string;
  size?: number;
  className?: string;
}) {
  const avatarUrl = await getAvatarUrl(login);
  return <Avatar login={login} avatarUrl={avatarUrl} size={size} className={className} />;
}
