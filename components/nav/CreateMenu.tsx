'use client';

import Link from 'next/link';
import { PlusIcon, ChevronDownIcon } from '@primer/octicons-react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';

export function CreateMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-1 hover:opacity-80" aria-label="Create new">
        <PlusIcon size={16} /><ChevronDownIcon size={12} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="text-fg-default">
        <DropdownMenuItem asChild>
          <Link href="/projects/new">New project</Link>
        </DropdownMenuItem>
        <DropdownMenuItem disabled>New paper (select a project)</DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/experiments/new">New experiment</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/discussions/new">New discussion</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/members/new">New member</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
