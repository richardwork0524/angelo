'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavTab {
  href: string;
  label: string;
  icon: React.ReactNode;
  match: (path: string) => boolean;
}

const HomeIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" />
    <path d="M9 21V12h6v9" />
  </svg>
);

const TasksIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 11l3 3L22 4" />
    <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
  </svg>
);

const SessionsIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 3" />
  </svg>
);

const EntitiesIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
  </svg>
);

const PlusIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const TABS: NavTab[] = [
  {
    href: '/',
    label: 'Home',
    icon: <HomeIcon />,
    match: (p) => p === '/',
  },
  {
    href: '/tasks',
    label: 'Tasks',
    icon: <TasksIcon />,
    match: (p) => p.startsWith('/tasks'),
  },
  // FAB slot — handled separately
  {
    href: '/sessions',
    label: 'Sessions',
    icon: <SessionsIcon />,
    match: (p) => p.startsWith('/sessions') || p.startsWith('/session'),
  },
  {
    href: '/entities',
    label: 'Entities',
    icon: <EntitiesIcon />,
    match: (p) => p.startsWith('/entities') || p.startsWith('/entity'),
  },
];

export function BottomNav() {
  const pathname = usePathname();

  function openQuickCapture() {
    window.dispatchEvent(new CustomEvent('quick-note', { detail: {} }));
  }

  return (
    <nav
      className="md:hidden shrink-0 flex items-stretch"
      style={{
        background: 'var(--surface)',
        borderTop: '1px solid var(--border)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        height: 'calc(56px + env(safe-area-inset-bottom))',
        position: 'relative',
        zIndex: 30,
      }}
      aria-label="Bottom navigation"
    >
      {/* Left two tabs */}
      {TABS.slice(0, 2).map((tab) => {
        const active = tab.match(pathname);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors"
            style={{
              color: active ? 'var(--primary)' : 'var(--text3)',
              minWidth: 0,
            }}
            aria-current={active ? 'page' : undefined}
          >
            <span style={{ opacity: active ? 1 : 0.7 }}>{tab.icon}</span>
            <span
              className="font-medium"
              style={{
                fontSize: 10,
                letterSpacing: '0.03em',
                color: active ? 'var(--primary)' : 'var(--text3)',
              }}
            >
              {tab.label}
            </span>
          </Link>
        );
      })}

      {/* FAB center slot */}
      <div className="flex-1 flex items-center justify-center" style={{ position: 'relative' }}>
        <button
          onClick={openQuickCapture}
          aria-label="Quick capture"
          className="flex items-center justify-center text-white active:scale-95 transition-transform"
          style={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            background: 'var(--primary)',
            boxShadow: '0 4px 14px rgba(99,102,241,0.45)',
            position: 'absolute',
            top: '50%',
            transform: 'translateY(-58%)',
          }}
        >
          <PlusIcon />
        </button>
      </div>

      {/* Right two tabs */}
      {TABS.slice(2).map((tab) => {
        const active = tab.match(pathname);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors"
            style={{
              color: active ? 'var(--primary)' : 'var(--text3)',
              minWidth: 0,
            }}
            aria-current={active ? 'page' : undefined}
          >
            <span style={{ opacity: active ? 1 : 0.7 }}>{tab.icon}</span>
            <span
              className="font-medium"
              style={{
                fontSize: 10,
                letterSpacing: '0.03em',
                color: active ? 'var(--primary)' : 'var(--text3)',
              }}
            >
              {tab.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
