'use client';

import { useEffect, useRef, useState } from 'react';
import type { LiveSessionRow } from '@/hooks/use-live-session';

type Props = {
  session: LiveSessionRow | null;
};

const SURFACE_COLOR: Record<string, string> = {
  CODE: 'var(--accent)',
  CHAT: 'var(--green)',
  COWORK: 'var(--purple)',
  MOBILE: 'var(--orange)',
};

const SURFACE_BG: Record<string, string> = {
  CODE: 'var(--accent-dim)',
  CHAT: 'var(--green-dim)',
  COWORK: 'var(--purple-dim)',
  MOBILE: 'var(--orange-dim)',
};

function formatTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function formatCost(n: number): string {
  return `$${n.toFixed(3)}`;
}

/**
 * LiveRibbon — 40px persistent bar showing the active Claude session.
 * Returns null when session is null (zero layout shift — no reserved space).
 * Mounts inside AppShell at both desktop and mobile mount points.
 *
 * Token/cost change animation: 200ms opacity fade + 1px accent border flash
 * via CSS class toggled by useEffect on token/cost values. No re-mount.
 */
export function LiveRibbon({ session }: Props) {
  const [flash, setFlash] = useState(false);
  const prevTokensRef = useRef<number | null>(null);

  // Flash animation on token/cost change
  useEffect(() => {
    if (!session) return;
    if (
      prevTokensRef.current !== null &&
      prevTokensRef.current !== session.tokens
    ) {
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 200);
      return () => clearTimeout(t);
    }
    prevTokensRef.current = session.tokens;
  }, [session?.tokens]);

  if (!session) return null;

  const surfaceColor = SURFACE_COLOR[session.surface] ?? 'var(--text3)';
  const surfaceBg = SURFACE_BG[session.surface] ?? 'transparent';
  const displayHash = `#${session.short_hash}`;
  const displayEntity = session.entity_name ?? session.entity_key ?? '—';
  const displayTool = session.tool ?? '—';

  return (
    <div
      role="status"
      aria-label="Active Claude session"
      style={{
        height: 40,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '0 16px',
        fontSize: 12,
        background: flash
          ? 'linear-gradient(180deg, rgba(48,209,88,0.10), rgba(48,209,88,0.05))'
          : 'linear-gradient(180deg, rgba(48,209,88,0.06), rgba(48,209,88,0.02))',
        borderBottom: flash
          ? '1px solid var(--green)'
          : '1px solid var(--border)',
        position: 'relative',
        transition: 'background 200ms, border-color 200ms',
      }}
    >
      {/* Left accent stripe */}
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 2,
          background: 'var(--green)',
          borderRadius: '0 1px 1px 0',
        }}
      />

      {/* Pulse dot */}
      <span
        aria-hidden="true"
        style={{
          width: 6,
          height: 6,
          borderRadius: 999,
          background: 'var(--green)',
          flexShrink: 0,
          animation: 'live-ribbon-pulse 2s infinite',
        }}
      />

      {/* LIVE label */}
      <span
        style={{
          color: 'var(--green)',
          fontWeight: 590,
          fontSize: 11,
          letterSpacing: '0.04em',
          flexShrink: 0,
        }}
      >
        LIVE
      </span>

      {/* Short hash */}
      <span
        style={{
          fontFamily: 'var(--mono)',
          color: 'var(--text2)',
          fontSize: 11,
          flexShrink: 0,
        }}
      >
        {displayHash}
      </span>

      <span style={{ color: 'var(--text3)', flexShrink: 0 }}>·</span>

      {/* Entity name */}
      <span
        style={{
          color: 'var(--text)',
          fontWeight: 510,
          flexShrink: 0,
          maxWidth: 120,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {displayEntity}
      </span>

      <span style={{ color: 'var(--text3)', flexShrink: 0 }}>·</span>

      {/* Tool label — flex-1 truncates */}
      <span
        style={{
          color: 'var(--text2)',
          flex: 1,
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {displayTool}
      </span>

      {/* Surface pill */}
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          padding: '2px 8px',
          borderRadius: 999,
          fontSize: 10,
          fontWeight: 590,
          letterSpacing: '0.02em',
          border: `1px solid ${surfaceColor}`,
          background: surfaceBg,
          color: surfaceColor,
          flexShrink: 0,
          whiteSpace: 'nowrap',
        }}
      >
        {session.surface}
      </span>

      {/* Token count */}
      <span
        style={{
          fontFamily: 'var(--mono)',
          color: 'var(--text2)',
          fontSize: 11,
          flexShrink: 0,
        }}
      >
        {formatTokens(session.tokens)}
      </span>

      {/* Cost */}
      <span
        style={{
          fontFamily: 'var(--mono)',
          color: 'var(--green)',
          fontSize: 11,
          fontWeight: 590,
          flexShrink: 0,
        }}
      >
        {formatCost(Number(session.cost_usd))}
      </span>

      {/* Pulse keyframes — injected inline to avoid global CSS dependency */}
      <style>{`
        @keyframes live-ribbon-pulse {
          0%   { box-shadow: 0 0 0 0 rgba(48,209,88,0.45); }
          70%  { box-shadow: 0 0 0 6px rgba(48,209,88,0); }
          100% { box-shadow: 0 0 0 0 rgba(48,209,88,0); }
        }
      `}</style>
    </div>
  );
}
