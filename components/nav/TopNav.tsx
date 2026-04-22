'use client';

import Link from 'next/link';
import { MarkGithubIcon, SearchIcon, PlusIcon, ChevronDownIcon } from '@primer/octicons-react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Avatar } from '@/components/people/Avatar';
import { CURRENT_USER } from '@/lib/mock';

export function TopNav() {
  return (
    <header role="banner" className="bg-[#24292f] text-white border-b border-black/20">
      <div className="max-w-screen-2xl mx-auto flex items-center gap-4 px-4 h-12">
        <Link href="/" className="flex items-center gap-2 font-semibold hover:opacity-80">
          <MarkGithubIcon size={22} />
          <span>LabHub</span>
        </Link>
        <div className="relative flex-none w-[280px]">
          <SearchIcon size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-white/60" />
          <input
            type="search"
            placeholder="Search projects, papers, people…"
            className="w-full h-7 pl-7 pr-2 rounded-md bg-white/10 text-[12px] text-white placeholder:text-white/60 outline-none focus:ring-2 focus:ring-accent-emphasis"
          />
        </div>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/experiments" className="hover:opacity-80">Experiments</Link>
          <Link href="/pipeline"    className="hover:opacity-80">Pipeline</Link>
          <Link href="/discussions" className="hover:opacity-80">Discussions</Link>
        </nav>
        <div className="flex-1" />
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-1 hover:opacity-80" aria-label="Create new">
            <PlusIcon size={16} /><ChevronDownIcon size={12} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="text-fg-default">
            <DropdownMenuItem onSelect={() => { /* placeholder */ }}>New project</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => { /* placeholder */ }}>New paper</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => { /* placeholder */ }}>New experiment</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => { /* placeholder */ }}>New discussion</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger aria-label="Account menu" className="rounded-full">
            <Avatar login={CURRENT_USER} size={24} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="text-fg-default">
            <DropdownMenuItem asChild>
              <Link href={`/members/${CURRENT_USER}`}>Profile</Link>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => { /* placeholder */ }}>Settings</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
