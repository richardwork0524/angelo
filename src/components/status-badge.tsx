'use client';

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  ACTIVE:   { bg: 'var(--green-dim)',   text: 'var(--green)' },
  DEPLOYED: { bg: 'var(--green-dim)',   text: 'var(--green)' },
  BUILDING: { bg: 'var(--accent-dim)',  text: 'var(--accent)' },
  PLANNING: { bg: 'var(--purple-dim)',  text: 'var(--purple)' },
  TESTING:  { bg: 'var(--yellow-dim)',  text: 'var(--yellow)' },
  BLOCKED:  { bg: 'var(--red-dim)',     text: 'var(--red)' },
  ARCHIVED: { bg: 'var(--card2)',       text: 'var(--text3)' },
};

interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const normalized = status.toUpperCase();
  const style = STATUS_STYLES[normalized] || STATUS_STYLES.ARCHIVED;

  return (
    <span
      className="inline-flex items-center px-2 py-[3px] rounded-[6px] text-[11px] font-semibold uppercase tracking-wide"
      style={{ backgroundColor: style.bg, color: style.text }}
    >
      {status}
    </span>
  );
}
