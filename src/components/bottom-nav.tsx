'use client';

import { usePathname, useRouter } from 'next/navigation';

const LEFT_TABS = [
  {
    label: 'Home',
    href: '/dashboard',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    label: 'Tasks',
    href: '/tasks',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 11l3 3L22 4" />
        <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
      </svg>
    ),
  },
];

const RIGHT_TABS = [
  {
    label: 'Board',
    href: '/board',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    label: 'More',
    href: '/more',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="1" />
        <circle cx="12" cy="5" r="1" />
        <circle cx="12" cy="19" r="1" />
      </svg>
    ),
  },
];

interface BottomNavProps {
  onCapture?: () => void;
}

export function BottomNav({ onCapture }: BottomNavProps) {
  const pathname = usePathname();
  const router = useRouter();

  function isActive(href: string) {
    if (href === '/dashboard') return pathname === '/dashboard' || pathname === '/';
    return pathname?.startsWith(href);
  }

  function renderTab(tab: { label: string; href: string; icon: React.ReactNode }) {
    const active = isActive(tab.href);
    return (
      <button
        key={tab.label}
        onClick={() => router.push(tab.href)}
        className={`flex flex-col items-center justify-center flex-1 min-h-[52px] py-2 transition-colors ${
          active ? 'text-[var(--accent)]' : 'text-[var(--text3)]'
        }`}
      >
        {tab.icon}
        <span className="text-[10px] font-medium mt-1">{tab.label}</span>
      </button>
    );
  }

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-around bg-[var(--surface)]/95 backdrop-blur-[20px] border-t border-[var(--border)]"
      style={{ paddingBottom: 'var(--safe-b)' }}
    >
      {/* Left tabs */}
      {LEFT_TABS.map(renderTab)}

      {/* Center FAB */}
      <div className="flex items-center justify-center" style={{ width: 60 }}>
        <button
          onClick={() => onCapture?.()}
          className="w-[48px] h-[48px] rounded-full bg-[var(--accent)] flex items-center justify-center shadow-lg -mt-4 active:scale-95 transition-transform"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>

      {/* Right tabs */}
      {RIGHT_TABS.map(renderTab)}
    </nav>
  );
}
