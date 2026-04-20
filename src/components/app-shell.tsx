'use client';

import { Suspense, useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from './sidebar';
import { Topbar } from './topbar';
import { NoteModal } from './note-modal';
import { QuickTaskModal } from './quick-task-modal';
import { CreateChooser } from './create-chooser';
import { CommandPalette } from './command-palette';
import { useLiveSession } from '@/hooks/use-live-session';
import { useCommandPalette } from '@/hooks/use-command-palette';
import { LiveRibbon } from './live-ribbon';
import { BottomNav } from './bottom-nav';

export function AppShell({ children }: { children: React.ReactNode }) {
  const [navOpen, setNavOpen] = useState(false);
  const pathname = usePathname();
  const { session } = useLiveSession();
  const { open: paletteOpen, closePalette } = useCommandPalette();

  // Auto-close drawer on route change
  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  // Escape closes drawer
  useEffect(() => {
    if (!navOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setNavOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navOpen]);

  // Lock body scroll when drawer open on mobile
  useEffect(() => {
    if (navOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [navOpen]);

  return (
    <div className="flex flex-col" style={{ height: '100dvh' }}>
      <Topbar onToggleNav={() => setNavOpen((v) => !v)} navOpen={navOpen} />
      <div
        className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[220px_1fr]"
        style={{ overflow: 'hidden' }}
      >
        {/* Mobile overlay — covers area below topbar */}
        <div
          onClick={() => setNavOpen(false)}
          className={`md:hidden fixed left-0 right-0 bottom-0 z-40 transition-opacity ${
            navOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
          style={{ top: 56, background: 'rgba(0,0,0,0.5)' }}
          aria-hidden="true"
        />

        {/* Sidebar: desktop = inline grid cell, mobile = fixed slide-in drawer */}
        <div
          className={`md:static md:translate-x-0 md:shadow-none flex fixed left-0 bottom-0 z-50 transition-transform duration-200 ease-out ${
            navOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
          }`}
          style={{ top: 56 }}
        >
          <Suspense
            fallback={
              <aside
                style={{
                  width: 220,
                  height: '100%',
                  background: 'var(--surface)',
                  borderRight: '1px solid var(--border)',
                  padding: 20,
                }}
              >
                <div className="h-4 w-20 rounded animate-pulse" style={{ background: 'var(--card-alt)' }} />
              </aside>
            }
          >
            <Sidebar onNavigate={() => setNavOpen(false)} />
          </Suspense>
        </div>

        <div className="flex flex-col flex-1 min-h-0" style={{ overflow: 'hidden' }}>
          <LiveRibbon session={session} />
          <main className="overflow-y-auto flex-1 min-h-0" style={{ background: 'var(--bg)', overscrollBehavior: 'none', overflowX: 'hidden' }}>
            {children}
          </main>
          <BottomNav />
        </div>
      </div>
      <NoteModal />
      <QuickTaskModal />
      <CreateChooser />
      <CommandPalette open={paletteOpen} onClose={closePalette} />
    </div>
  );
}
