'use client';

import Link from 'next/link';

export interface BreadcrumbSegment {
  label: string;
  href: string;
}

interface BreadcrumbProps {
  segments: BreadcrumbSegment[];
}

export function Breadcrumb({ segments }: BreadcrumbProps) {
  if (segments.length === 0) return null;

  return (
    <nav className="flex items-center gap-1 px-4 py-2 overflow-x-auto scrollbar-none text-[13px]">
      {segments.map((seg, i) => {
        const isLast = i === segments.length - 1;
        return (
          <span key={seg.href} className="flex items-center gap-1 shrink-0">
            {i > 0 && (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-[var(--text3)]">
                <path d="M4.5 2.5L7.5 6L4.5 9.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
            {isLast ? (
              <span className="font-semibold text-[var(--text)] whitespace-nowrap">{seg.label}</span>
            ) : (
              <Link href={seg.href} className="text-[var(--text2)] hover:text-[var(--text)] whitespace-nowrap transition-colors">
                {seg.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
