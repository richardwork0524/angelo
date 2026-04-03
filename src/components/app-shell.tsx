'use client';

import { Suspense } from 'react';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { BottomNav } from './bottom-nav';
import { Sidebar } from './sidebar';

export function AppShell({ children }: { children: React.ReactNode }) {
  const isDesktop = useBreakpoint(768);

  if (isDesktop) {
    return (
      <div className="flex min-h-screen bg-[var(--bg)]">
        <Suspense fallback={
          <aside className="w-[280px] shrink-0 h-screen sticky top-0 bg-[var(--surface)] border-r border-[var(--border)]">
            <div className="px-5 py-5">
              <div className="h-5 w-24 bg-[var(--card)] animate-pulse rounded" />
              <div className="h-3 w-32 bg-[var(--card)] animate-pulse rounded mt-2" />
            </div>
          </aside>
        }>
          <Sidebar />
        </Suspense>
        <main className="flex-1 min-h-screen">{children}</main>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-[var(--bg)]">
      <main className="flex-1 pb-[60px]">{children}</main>
      <BottomNav />
    </div>
  );
}
