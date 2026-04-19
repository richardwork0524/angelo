'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { cachedFetch } from '@/lib/cache';

interface MountedHandoff {
  id: string;
  handoff_code?: string | null;
  scope_name?: string | null;
  project_key?: string | null;
}

interface TokenSummary {
  today_cost: number;
  today_tokens: number;
}

export function Topbar({ onToggleNav, navOpen = false }: { onToggleNav?: () => void; navOpen?: boolean } = {}) {
  const [mounted, setMounted] = useState<MountedHandoff | null>(null);
  const [tokens, setTokens] = useState<TokenSummary | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const mountedPopupRef = useRef<HTMLDivElement>(null);
  const [mountedOpen, setMountedOpen] = useState(false);

  // Theme: read from localStorage or system preference
  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('angelo-theme') : null;
    const initial: 'light' | 'dark' = stored === 'dark' || stored === 'light'
      ? stored
      : (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    setTheme(initial);
    document.documentElement.classList.toggle('dark', initial === 'dark');
    document.documentElement.classList.toggle('light', initial === 'light');
  }, []);

  const toggleTheme = useCallback(() => {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    localStorage.setItem('angelo-theme', next);
    document.documentElement.classList.toggle('dark', next === 'dark');
    document.documentElement.classList.toggle('light', next === 'light');
  }, [theme]);

  // Fetch mounted handoff + today's token stats via /api/home
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await cachedFetch<{
          mounted_handoffs?: MountedHandoff[];
          stats_today?: { cost?: number; input_tokens?: number; output_tokens?: number; tokens?: number } | null;
        }>('/api/home', 15000);
        if (cancelled) return;
        setMounted(data.mounted_handoffs?.[0] || null);
        const s = data.stats_today;
        if (s) {
          setTokens({
            today_cost: s.cost || 0,
            today_tokens: s.tokens ?? ((s.input_tokens || 0) + (s.output_tokens || 0)),
          });
        }
      } catch {
        // Silent fail; topbar shows empty pills
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Click outside to dismiss mounted popup
  useEffect(() => {
    if (!mountedOpen) return;
    function onDocClick(e: MouseEvent) {
      if (mountedPopupRef.current && !mountedPopupRef.current.contains(e.target as Node)) {
        setMountedOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [mountedOpen]);

  const fmtK = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n);

  function openQuickNote() {
    const detail = mounted
      ? {
          project_key: mounted.project_key,
          attach_hint: mounted.handoff_code || mounted.scope_name || null,
        }
      : {};
    window.dispatchEvent(new CustomEvent('quick-note', { detail }));
  }

  return (
    <header
      className="flex items-center gap-2 md:gap-3 px-3 md:px-5 shrink-0"
      style={{
        height: 56,
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      {/* Hamburger — mobile only */}
      {onToggleNav && (
        <button
          onClick={onToggleNav}
          aria-label={navOpen ? 'Close navigation' : 'Open navigation'}
          className="md:hidden flex items-center justify-center transition-colors"
          style={{
            width: 34,
            height: 34,
            borderRadius: 'var(--r-sm)',
            background: navOpen ? 'var(--primary-dim)' : 'var(--card)',
            border: '1px solid var(--border)',
            color: navOpen ? 'var(--primary-2)' : 'var(--text2)',
            fontSize: 16,
            lineHeight: 1,
          }}
        >
          {navOpen ? '✕' : '☰'}
        </button>
      )}

      {/* Brand */}
      <Link href="/" className="flex items-center gap-2.5 font-semibold tracking-tight" style={{ fontSize: 'var(--t-h3)' }}>
        <span
          className="flex items-center justify-center text-white font-bold"
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            background: 'linear-gradient(135deg, var(--primary), var(--primary-2))',
            fontSize: 14,
            boxShadow: '0 4px 12px rgba(99,102,241,.35)',
          }}
        >
          A
        </span>
        Angelo
        <span style={{ color: 'var(--text3)', fontWeight: 400, fontSize: 'var(--t-sm)', marginLeft: 4 }}>v4</span>
      </Link>

      <div className="flex-1" />

      {/* Mount pill — desktop only (saves horizontal space on mobile) */}
      <div className="relative hidden md:block" ref={mountedPopupRef}>
        <button
          onClick={() => setMountedOpen((v) => !v)}
          className="flex items-center gap-2.5 transition-colors"
          style={{
            padding: '6px 12px 6px 8px',
            background: mounted ? 'var(--primary-dim)' : 'var(--card-alt)',
            border: `1px solid ${mounted ? 'var(--primary-hi)' : 'var(--border)'}`,
            borderRadius: 999,
            fontSize: 'var(--t-sm)',
            color: mounted ? 'var(--text)' : 'var(--text3)',
          }}
        >
          <span
            className={mounted ? 'angelo-pulse' : ''}
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: mounted ? 'var(--primary)' : 'var(--text4)',
              boxShadow: mounted ? '0 0 10px var(--primary)' : 'none',
            }}
          />
          <span style={{ color: 'var(--text2)', fontSize: 'var(--t-tiny)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
            Mounted
          </span>
          {mounted ? (
            <>
              <span style={{ color: 'var(--primary-2)', fontFamily: 'ui-monospace, monospace', fontWeight: 600, fontSize: 'var(--t-tiny)' }}>
                {mounted.handoff_code || mounted.id.slice(0, 8)}
              </span>
              <span className="max-w-[180px] truncate" style={{ color: 'var(--text)', fontWeight: 500 }}>
                {mounted.scope_name || 'Untitled'}
              </span>
            </>
          ) : (
            <span>None</span>
          )}
        </button>

        {mountedOpen && (
          <div
            className="absolute right-0 top-[calc(100%+8px)] w-[320px] z-50"
            style={{
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--r)',
              boxShadow: 'var(--sh-lg)',
              padding: 16,
            }}
          >
            {mounted ? (
              <>
                <div style={{ fontSize: 'var(--t-tiny)', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                  Currently Mounted
                </div>
                <div style={{ fontSize: 'var(--t-h3)', fontWeight: 600, marginTop: 6 }}>
                  {mounted.scope_name || 'Untitled'}
                </div>
                <div style={{ fontSize: 'var(--t-sm)', color: 'var(--text3)', fontFamily: 'ui-monospace, monospace', marginTop: 4 }}>
                  {mounted.handoff_code || mounted.id}
                </div>
                <div className="mt-3 flex gap-2">
                  <Link
                    href="/handoffs"
                    className="flex-1 text-center py-2 rounded-md transition-colors"
                    style={{
                      background: 'var(--primary)',
                      color: '#fff',
                      fontSize: 'var(--t-sm)',
                      fontWeight: 500,
                    }}
                    onClick={() => setMountedOpen(false)}
                  >
                    View Handoffs
                  </Link>
                </div>
              </>
            ) : (
              <div style={{ fontSize: 'var(--t-sm)', color: 'var(--text3)' }}>
                No handoff mounted. Pick one from Handoffs to focus on.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Token pill — desktop only */}
      <div
        className="hidden md:flex items-center gap-2"
        style={{
          padding: '6px 12px',
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 999,
          fontSize: 'var(--t-sm)',
          color: 'var(--text2)',
        }}
      >
        <span style={{ color: 'var(--text3)', fontSize: 'var(--t-tiny)' }}>Today</span>
        <span style={{ color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
          ${(tokens?.today_cost ?? 0).toFixed(2)}
        </span>
        <span style={{ color: 'var(--text3)' }}>·</span>
        <span style={{ color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
          {fmtK(tokens?.today_tokens ?? 0)}
        </span>
      </div>

      {/* FAB — quick note */}
      <button
        onClick={openQuickNote}
        title="Quick note"
        className="transition-colors flex items-center justify-center"
        style={{
          width: 34,
          height: 34,
          borderRadius: 'var(--r-sm)',
          background: 'var(--primary)',
          color: '#fff',
          border: '1px solid var(--primary)',
          boxShadow: '0 4px 12px rgba(99,102,241,.38)',
          fontSize: 18,
          lineHeight: 1,
        }}
      >
        +
      </button>

      {/* Theme toggle */}
      <button
        onClick={toggleTheme}
        title="Toggle theme"
        className="transition-colors flex items-center justify-center"
        style={{
          width: 34,
          height: 34,
          borderRadius: 'var(--r-sm)',
          background: 'var(--card)',
          border: '1px solid var(--border)',
          color: 'var(--text2)',
          fontSize: 14,
        }}
      >
        {theme === 'light' ? '☀' : '◐'}
      </button>

      {/* Avatar */}
      <div
        className="flex items-center justify-center text-white font-semibold"
        style={{
          width: 30,
          height: 30,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #A78BFA, var(--primary))',
          fontSize: 12,
        }}
        title="Richard · Mini"
      >
        RY
      </div>
    </header>
  );
}
