'use client';

import { Suspense, useCallback } from 'react';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { BottomNav } from './bottom-nav';
import { Sidebar } from './sidebar';

export function AppShell({ children }: { children: React.ReactNode }) {
  const isDesktop = useBreakpoint(768);

  const handleCapture = useCallback(() => {
    window.dispatchEvent(new Event('quick-capture'));
  }, []);

  if (isDesktop) {
    return (
      <div className="flex h-screen overflow-hidden bg-[var(--bg)]">
        <Suspense fallback={
          <aside className="w-[280px] shrink-0 h-screen bg-[var(--surface)] border-r border-[var(--border)]">
            <div className="px-5 py-5">
              <div className="h-5 w-24 bg-[var(--card)] animate-pulse rounded" />
              <div className="h-3 w-32 bg-[var(--card)] animate-pulse rounded mt-2" />
            </div>
          </aside>
        }>
          <Sidebar />
        </Suspense>
        <main className="flex-1 h-screen overflow-hidden">{children}</main>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[100dvh] overflow-hidden bg-[var(--bg)]">
      <main className="flex-1 overflow-y-auto min-h-0" style={{ paddingBottom: 'calc(60px + var(--safe-b))' }}>
        {children}
      </main>
      <BottomNav onCapture={handleCapture} />
    </div>
  );
}
