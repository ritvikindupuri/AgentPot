'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { Menu, Search } from 'lucide-react';
import { LiveChip } from '../ui/LiveChip';
import { Input } from '../ui/Input';
import { useDashboardData } from './DashboardContext';

interface TopBarProps {
  onOpenMobile: () => void;
}

export function TopBar({ onOpenMobile }: TopBarProps) {
  const pathname = usePathname();
  const { lastPollFailed, searchTerm, setSearchTerm } = useDashboardData();

  let title = 'Overview';
  const showSearch = pathname.includes('/events') || pathname.includes('/sessions');

  if (pathname.includes('/events')) {
    title = 'Events';
  } else if (pathname.includes('/sessions')) {
    title = 'Sessions';
  } else if (pathname.includes('/canaries')) {
    title = 'Canaries';
  }

  const searchPlaceholder = pathname.includes('/events')
    ? 'Search IP, agent, endpoint…'
    : 'Search sessions…';

  return (
    <header className="h-12 border-b border-border bg-bg px-4 sm:px-6 flex items-center justify-between sticky top-0 z-20">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenMobile}
          aria-label="Open navigation menu"
          className="sm:hidden text-text-muted hover:text-text p-1 -ml-1"
        >
          <Menu size={16} strokeWidth={1.5} />
        </button>
        <h1 className="text-sm font-semibold text-text leading-5 select-none">
          {title}
        </h1>
      </div>

      <div className="flex items-center gap-3">
        <LiveChip isLive={!lastPollFailed} />
        {showSearch && (
          <div className="w-48 sm:w-64">
            <Input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={searchPlaceholder}
              icon={<Search size={14} strokeWidth={1.5} />}
            />
          </div>
        )}
      </div>
    </header>
  );
}
