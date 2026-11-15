'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutGrid, Activity, Users, Flag, LogOut, X } from 'lucide-react';
import { Logo } from '../ui/Logo';

interface SidebarProps {
  mobileOpen: boolean;
  onCloseMobile: () => void;
  userEmail?: string | null;
}

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Overview', icon: LayoutGrid, exact: true },
  { href: '/dashboard/events', label: 'Events', icon: Activity, exact: false },
  { href: '/dashboard/sessions', label: 'Sessions', icon: Users, exact: false },
  { href: '/dashboard/canaries', label: 'Canaries', icon: Flag, exact: false },
];

export function Sidebar({ mobileOpen, onCloseMobile, userEmail }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const handleSignOut = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Ignore network errors on logout
    }
    router.push('/');
    router.refresh();
  };

  const navContent = (
    <div className="flex flex-col h-full bg-bg-subtle border-r border-border select-none">
      {/* Top Logo */}
      <div className="h-12 px-4 flex items-center justify-between border-b border-border">
        <Link href="/dashboard" className="flex items-center">
          <Logo size={20} className="hidden lg:flex" />
          <Logo size={20} markOnly className="flex lg:hidden" />
        </Link>
        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Close sidebar menu"
          className="sm:hidden text-text-muted hover:text-text p-1"
        >
          <X size={16} strokeWidth={1.5} />
        </button>
      </div>

      {/* Nav items */}
      <nav className="flex-1 py-3 px-2 space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onCloseMobile}
              className={`relative flex items-center gap-3 h-8 px-2.5 rounded-md text-[13px] font-medium transition-colors duration-120 group ${
                isActive
                  ? 'bg-accent-bg text-text'
                  : 'text-text-muted hover:bg-surface-hover hover:text-text'
              }`}
            >
              {isActive && (
                <span
                  className="absolute left-0 top-1 bottom-1 w-[2px] bg-accent rounded-r"
                  aria-hidden="true"
                />
              )}
              <Icon
                size={16}
                strokeWidth={1.5}
                className={`shrink-0 ${
                  isActive ? 'text-text' : 'text-text-faint group-hover:text-text'
                }`}
              />
              <span className="truncate hidden lg:inline">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom: user + sign out */}
      <div className="p-2 border-t border-border space-y-1">
        {userEmail && (
          <div
            className="hidden lg:block px-2.5 py-1.5 text-[12px] text-text-muted truncate"
            title={userEmail}
          >
            {userEmail}
          </div>
        )}
        <button
          type="button"
          onClick={handleSignOut}
          className="flex items-center gap-3 w-full h-8 px-2.5 rounded-md text-[13px] font-medium text-text-muted hover:bg-surface-hover hover:text-text transition-colors duration-120 group"
        >
          <LogOut
            size={16}
            strokeWidth={1.5}
            className="shrink-0 text-text-faint group-hover:text-text"
          />
          <span className="truncate hidden lg:inline">Sign out</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop / Tablet Sidebar */}
      <aside className="hidden sm:block shrink-0 w-12 lg:w-[220px] h-screen sticky top-0 z-30">
        {navContent}
      </aside>

      {/* Mobile Drawer Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex sm:hidden">
          <div
            className="fixed inset-0 bg-black/40"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative w-64 max-w-[80vw] h-full shadow-2xl">
            {navContent}
          </div>
        </div>
      )}
    </>
  );
}
