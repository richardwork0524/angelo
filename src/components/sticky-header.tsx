"use client";

import { useRouter } from "next/navigation";

interface StickyHeaderProps {
  title: string;
  showBack?: boolean;
  rightAction?: React.ReactNode;
}

export function StickyHeader({ title, showBack, rightAction }: StickyHeaderProps) {
  const router = useRouter();

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between h-14 px-4 bg-[var(--surface)] border-b border-[var(--border)]">
      <div className="flex items-center gap-3">
        {showBack && (
          <button
            onClick={() => router.back()}
            className="flex items-center justify-center w-9 h-9 rounded-md text-[var(--text2)] hover:text-[var(--text)] hover:bg-[var(--card)] transition-colors"
            aria-label="Go back"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
        <h1 className="text-[20px] font-bold text-[var(--text)] truncate">{title}</h1>
      </div>
      {rightAction && <div>{rightAction}</div>}
    </header>
  );
}
