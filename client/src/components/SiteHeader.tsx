'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { IconClose, IconMenu, IconWheat } from './icons';

const NAV_LINKS = [
  { href: '/booking', label: 'Book a Slot' },
  { href: '/queue', label: 'Live Queue' },
  { href: '/status', label: 'My Status' },
  { href: '/admin', label: 'Admin' },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-neutral-200/80 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <a href="/" className="flex items-center gap-2 text-neutral-900">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white">
            <IconWheat className="h-5 w-5" />
          </span>
          <span className="text-sm font-bold leading-tight sm:text-base">
            Procurement Queue
            <span className="block text-[10px] font-medium text-neutral-400">SIH 2026 · PS26032</span>
          </span>
        </a>

        <nav className="hidden items-center gap-1 sm:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                pathname === link.href ? 'bg-brand-50 text-brand-700' : 'text-neutral-600 hover:bg-neutral-100'
              }`}
            >
              {link.label}
            </a>
          ))}
        </nav>

        <button
          onClick={() => setOpen((v) => !v)}
          className="rounded-lg p-2 text-neutral-600 hover:bg-neutral-100 sm:hidden"
          aria-label="Toggle navigation"
        >
          {open ? <IconClose /> : <IconMenu />}
        </button>
      </div>

      {open && (
        <nav className="border-t border-neutral-200 bg-white px-4 py-2 sm:hidden">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className={`block rounded-lg px-3 py-2.5 text-sm font-medium ${
                pathname === link.href ? 'bg-brand-50 text-brand-700' : 'text-neutral-600 hover:bg-neutral-100'
              }`}
            >
              {link.label}
            </a>
          ))}
        </nav>
      )}
    </header>
  );
}
