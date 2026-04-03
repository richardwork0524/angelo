'use client';

const SURFACE_STYLES: Record<string, { bg: string; text: string }> = {
  CHAT:    { bg: 'var(--purple-dim)', text: 'var(--purple)' },
  CODE:    { bg: 'var(--green-dim)',  text: 'var(--green)' },
  COWORK:  { bg: 'var(--accent-dim)', text: 'var(--accent)' },
  MOBILE:  { bg: 'var(--orange-dim)', text: 'var(--orange)' },
};

interface SurfaceBadgeProps {
  surface: string;
}

export function SurfaceBadge({ surface }: SurfaceBadgeProps) {
  const normalized = surface.toUpperCase();
  const style = SURFACE_STYLES[normalized] || { bg: 'var(--card2)', text: 'var(--text3)' };

  return (
    <span
      className="inline-flex items-center px-2 py-[3px] rounded-[6px] text-[11px] font-semibold uppercase tracking-wide"
      style={{ backgroundColor: style.bg, color: style.text }}
    >
      {surface}
    </span>
  );
}
