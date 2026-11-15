'use client';

import React, { useState } from 'react';
import { DashboardDataProvider } from './DashboardContext';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { SessionDrawer } from './SessionDrawer';

export function DashboardShell({ children, userEmail }: { children: React.ReactNode; userEmail?: string | null }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <DashboardDataProvider>
      <div className="min-h-screen bg-bg flex">
        <Sidebar
          mobileOpen={mobileMenuOpen}
          onCloseMobile={() => setMobileMenuOpen(false)}
          userEmail={userEmail}
        />
        <div className="flex-1 flex flex-col min-w-0">
          <TopBar onOpenMobile={() => setMobileMenuOpen(true)} />
          <main className="flex-1 p-6">{children}</main>
        </div>
        <SessionDrawer />
      </div>
    </DashboardDataProvider>
  );
}
