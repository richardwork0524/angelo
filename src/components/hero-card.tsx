'use client';

import type { ReactNode } from 'react';

interface HeroCardProps {
  /** Hex color string used to build the gradient and border tint, e.g. "#6366F1" */
  accentHex?: string;
  /** Override the entire background gradient string */
  gradient?: string;
  className?: string;
  children: ReactNode;
}

/**
 * HeroCard — gradient tint card used as the top Hero zone on Dashboard,
 * Tasks, Sessions, and Project detail pages.
 *
 * Accent color at ~8% opacity creates a visible tint in both light and dark themes.
 * Border uses the same color at 35% opacity for subtle delineation.
 */
export function HeroCard({ accentHex = '#6366F1', gradient, className = '', children }: HeroCardProps) {
  const bg = gradient ?? `linear-gradient(140deg, ${accentHex}14 0%, ${accentHex}03 60%)`;
  const border = `1px solid ${accentHex}59`; // 35% opacity hex ≈ 59

  return (
    <div
      className={className}
      style={{
        background: bg,
        border,
        borderRadius: 'var(--r)',
        padding: '20px',
      }}
    >
      {children}
    </div>
  );
}

/** Small uppercase tier label shown above each hero/sub/tertiary section */
export function TierLabel({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: '0.05em',
        color: 'var(--text3)',
        textTransform: 'uppercase',
        marginBottom: 8,
      }}
    >
      {children}
    </div>
  );
}
