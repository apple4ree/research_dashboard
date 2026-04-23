'use client';

import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { Avatar } from '@/components/people/Avatar';

export function AccountMenu() {
  const { data: session, status } = useSession();
  const memberLogin = (session as { memberLogin?: string } | null)?.memberLogin;
  const image = session?.user?.image ?? null;
  const name = session?.user?.name ?? memberLogin ?? null;

  if (status === 'loading') {
    return <div aria-hidden className="w-6 h-6 rounded-full bg-white/10" />;
  }
  if (!session || !memberLogin) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label="Account menu" className="rounded-full">
        {image ? (
          // Plain <img>: avoids next/image remote-pattern config for avatar URLs.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt={name ?? memberLogin}
            width={24}
            height={24}
            className="rounded-full"
          />
        ) : (
          <Avatar login={memberLogin} size={24} />
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="text-fg-default">
        <DropdownMenuItem asChild>
          <Link href={`/members/${memberLogin}`}>Profile</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={`/members/${memberLogin}/edit`}>Settings</Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => signOut({ redirectTo: '/auth/signin' })}>
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
