'use client';

import { Suspense } from 'react';
import { Sidebar } from './sidebar';
import { Topbar } from './topbar';

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col" style={{ height: '100vh' }}>
      <Topbar />
      <div
        className="flex-1 min-h-0"
        style={{
          display: 'grid',
          gridTemplateColumns: '220px 1fr',
          overflow: 'hidden',
        }}
      >
        <Suspense
          fallback={
            <aside
              style={{
                width: 220,
                background: 'var(--surface)',
                borderRight: '1px solid var(--border)',
                padding: 20,
              }}
            >
              <div className="h-4 w-20 rounded animate-pulse" style={{ background: 'var(--card-alt)' }} />
            </aside>
          }
        >
          <Sidebar />
        </Suspense>
        <main className="overflow-y-auto min-h-0" style={{ background: 'var(--bg)' }}>
          {children}
        </main>
      </div>
    </div>
  );
}
