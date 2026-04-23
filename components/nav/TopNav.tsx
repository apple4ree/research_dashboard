import Link from 'next/link';
import { MarkGithubIcon } from '@primer/octicons-react';
import { CreateMenu } from './CreateMenu';
import { AccountMenu } from './AccountMenu';
import { GlobalSearch } from './GlobalSearch';

export function TopNav() {
  return (
    <header role="banner" className="bg-[#24292f] text-white border-b border-black/20">
      <div className="max-w-screen-2xl mx-auto flex items-center gap-4 px-4 h-12">
        <Link href="/" className="flex items-center gap-2 font-semibold hover:opacity-80">
          <MarkGithubIcon size={22} />
          <span>LabHub</span>
        </Link>
        <GlobalSearch />
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/experiments" className="hover:opacity-80">Experiments</Link>
          <Link href="/pipeline"    className="hover:opacity-80">Pipeline</Link>
          <Link href="/discussions" className="hover:opacity-80">Discussions</Link>
        </nav>
        <div className="flex-1" />
        <CreateMenu />
        <AccountMenu />
      </div>
    </header>
  );
}
