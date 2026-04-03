'use client';

import { usePathname, useRouter } from 'next/navigation';

const tabs = [
  {
    label: 'Projects',
    href: '/dashboard',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </svg>
    ),
  },
  {
    label: 'Capture',
    href: '#capture',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
    ),
    isCapture: true,
  },
  {
    label: 'Skills',
    href: '/skills',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
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

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-around bg-[rgba(20,20,20,.95)] backdrop-blur-[20px] border-t border-[var(--border)]"
      style={{ paddingBottom: 'var(--safe-b)' }}
    >
      {tabs.map((tab) => {
        const isActive = tab.href !== '#capture' && pathname?.startsWith(tab.href);
        const isCapture = tab.isCapture;

        return (
          <button
            key={tab.label}
            onClick={() => {
              if (isCapture) {
                onCapture?.();
              } else {
                router.push(tab.href);
              }
            }}
            className={`flex flex-col items-center justify-center min-w-[64px] min-h-[52px] py-2 transition-colors ${
              isCapture
                ? 'text-[var(--accent)]'
                : isActive
                ? 'text-[var(--accent)]'
                : 'text-[var(--text3)]'
            }`}
          >
            {tab.icon}
            <span className="text-[10px] font-medium mt-1">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
