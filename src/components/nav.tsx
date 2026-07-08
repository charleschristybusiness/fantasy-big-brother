'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/', label: 'Dashboard' },
  { href: '/leaderboard', label: 'Leaderboard' },
  { href: '/houseguests', label: 'Houseguests' },
  { href: '/trends', label: 'Trends' },
  { href: '/compare', label: 'Compare' },
  { href: '/forecast', label: 'Forecast' },
];

function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  if (href === '/leaderboard') return pathname.startsWith('/leaderboard') || pathname.startsWith('/team');
  return pathname.startsWith(href);
}

export default function Nav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-edge bg-canvas/85 backdrop-blur-md">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2.5" onClick={() => setOpen(false)}>
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gold text-sm font-black tracking-tight text-black">
            BB
          </span>
          <span className="hidden text-[15px] font-semibold tracking-tight text-ink sm:inline">
            Fantasy Big Brother
          </span>
        </Link>

        {/* Desktop links */}
        <div className="hidden items-center gap-1 md:flex">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                isActive(pathname, link.href)
                  ? 'bg-raised text-ink'
                  : 'text-ink-mid hover:text-ink'
              }`}
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/submit"
            className="ml-2 rounded-full bg-gold px-4 py-1.5 text-sm font-semibold text-black transition-colors hover:bg-gold-bright"
          >
            Submit bracket
          </Link>
        </div>

        {/* Mobile menu button */}
        <button
          onClick={() => setOpen(!open)}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-mid transition-colors hover:text-ink md:hidden"
          aria-expanded={open}
          aria-label={open ? 'Close menu' : 'Open menu'}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
            {open ? (
              <>
                <path d="M5 5l10 10" />
                <path d="M15 5L5 15" />
              </>
            ) : (
              <>
                <path d="M3 6h14" />
                <path d="M3 10h14" />
                <path d="M3 14h14" />
              </>
            )}
          </svg>
        </button>
      </nav>

      {/* Mobile panel */}
      {open && (
        <div className="border-t border-edge bg-canvas px-4 pb-4 pt-2 md:hidden">
          <div className="flex flex-col gap-1">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className={`rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive(pathname, link.href)
                    ? 'bg-raised text-ink'
                    : 'text-ink-mid hover:text-ink'
                }`}
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/submit"
              onClick={() => setOpen(false)}
              className="mt-2 rounded-lg bg-gold px-3 py-2.5 text-center text-sm font-semibold text-black transition-colors hover:bg-gold-bright"
            >
              Submit bracket
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
