'use client';

import { useRouter } from 'next/navigation';
import { StickyHeader } from '@/components/sticky-header';

const links = [
  {
    label: 'Skills',
    description: 'Skill inventory and drift detection',
    href: '/skills',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
      </svg>
    ),
  },
  {
    label: 'Deployments',
    description: 'Module deployment history',
    href: '/deployments',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2L2 7l10 5 10-5-10-5z" />
        <path d="M2 17l10 5 10-5" />
        <path d="M2 12l10 5 10-5" />
      </svg>
    ),
  },
];

export default function MorePage() {
  const router = useRouter();

  return (
    <div>
      <StickyHeader title="More" />
      <div className="px-4 py-3 space-y-1">
        {links.map((link) => (
          <button
            key={link.href}
            onClick={() => router.push(link.href)}
            className="w-full flex items-center gap-3 px-4 py-3.5 rounded-[12px] bg-[var(--card)] border border-[var(--border)] hover:border-[var(--border2)] transition-all text-left active:scale-[0.98]"
          >
            <div className="w-10 h-10 rounded-[10px] bg-[var(--card2)] flex items-center justify-center text-[var(--accent)] shrink-0">
              {link.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-semibold text-[var(--text)]">{link.label}</p>
              <p className="text-[12px] text-[var(--text3)]">{link.description}</p>
            </div>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-[var(--text3)] shrink-0">
              <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        ))}
      </div>

      <div className="px-4 mt-6">
        <p className="text-[11px] text-[var(--text3)] text-center">Angelo v0.1 — Rinoa-OS</p>
      </div>
    </div>
  );
}
