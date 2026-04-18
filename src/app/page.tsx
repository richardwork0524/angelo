'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { cachedFetch } from '@/lib/cache';
import { patchHandoff } from '@/lib/mutate';
import { StatusBadge } from '@/components/status-badge';
import type { Handoff } from '@/lib/types';

const DAILY_COST_CAP = 6;

interface Stats {
  cost: number;
  input_tokens: number;
  output_tokens: number;
  tokens: number;
  sessions: number;
}

interface HomeData {
  mounted_handoffs: Handoff[];
  recent_handoffs: Handoff[];
  stats_today: Stats;
  stats_yesterday: Stats;
}

function fmtDate(): string {
  return new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function fmtK(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}k`;
  return String(n);
}

function fmtTokens(n: number): string {
  return n.toLocaleString('en-US');
}

function timeAgo(ts: string): string {
  const mins = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function pctDelta(today: number, yesterday: number): { label: string; dir: 'up' | 'down' | 'flat' } {
  if (yesterday === 0 && today === 0) return { label: '—', dir: 'flat' };
  if (yesterday === 0) return { label: 'new', dir: 'up' };
  const delta = ((today - yesterday) / yesterday) * 100;
  const rounded = Math.round(delta);
  if (rounded === 0) return { label: '0%', dir: 'flat' };
  return { label: `${Math.abs(rounded)}%`, dir: rounded > 0 ? 'up' : 'down' };
}

function absDelta(today: number, yesterday: number): { label: string; dir: 'up' | 'down' | 'flat' } {
  const delta = today - yesterday;
  if (delta === 0) return { label: '0', dir: 'flat' };
  return { label: String(Math.abs(delta)), dir: delta > 0 ? 'up' : 'down' };
}

export default function HomePage() {
  const router = useRouter();
  const [data, setData] = useState<HomeData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchHome = useCallback(async () => {
    try {
      const d = await cachedFetch<HomeData>('/api/home', 15000);
      setData(d);
    } catch {
      setData(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchHome(); }, [fetchHome]);

  const mounted = data?.mounted_handoffs?.[0] || null;
  const recent = (data?.recent_handoffs || []).filter((h) => h.id !== mounted?.id).slice(0, 4);

  function handleUnmount() {
    if (!mounted) return;
    patchHandoff(mounted.id, { is_mounted: false }, { onSuccess: () => fetchHome() });
  }

  function handleNewNote() {
    const detail = mounted
      ? {
          project_key: mounted.project_key,
          attach_hint: mounted.handoff_code || mounted.scope_name || null,
        }
      : {};
    window.dispatchEvent(new CustomEvent('quick-note', { detail }));
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-[var(--primary)] border-t-transparent animate-spin" />
          <span className="text-[13px] text-[var(--text3)]">Loading...</span>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="h-full flex items-center justify-center">
        <button onClick={fetchHome} className="text-[13px] text-[var(--primary)]">Retry</button>
      </div>
    );
  }

  const today: Stats = data.stats_today || { cost: 0, input_tokens: 0, output_tokens: 0, tokens: 0, sessions: 0 };
  const yesterday: Stats = data.stats_yesterday || { cost: 0, input_tokens: 0, output_tokens: 0, tokens: 0, sessions: 0 };
  const sessionsDelta = absDelta(today.sessions, yesterday.sessions);
  const tokensDelta = pctDelta(today.tokens, yesterday.tokens);
  const costDelta = pctDelta(today.cost, yesterday.cost);

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-[1280px] mx-auto px-8 py-7">
        {/* Page head */}
        <div className="flex items-end justify-between mb-6 gap-4 flex-wrap">
          <div>
            <h1 className="font-semibold tracking-tight" style={{ fontSize: 'var(--t-h1)' }}>
              Home
              <span className="ml-3 font-normal" style={{ color: 'var(--text3)', fontSize: 'var(--t-body)' }}>
                {fmtDate()}
              </span>
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleNewNote}
              className="transition-colors"
              style={{
                padding: '8px 14px',
                background: 'var(--card)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--r-sm)',
                fontSize: 'var(--t-sm)',
                color: 'var(--text2)',
                fontWeight: 500,
              }}
            >
              ＋ Note
            </button>
            <button
              onClick={() => router.push('/handoffs')}
              className="transition-opacity hover:opacity-90"
              style={{
                padding: '8px 14px',
                background: 'var(--primary)',
                border: '1px solid var(--primary)',
                borderRadius: 'var(--r-sm)',
                fontSize: 'var(--t-sm)',
                color: '#fff',
                fontWeight: 500,
              }}
            >
              ＋ Handoff
            </button>
          </div>
        </div>

        {/* Hero — mounted handoff focus */}
        {mounted ? (
          <MountedHero handoff={mounted} onUnmount={handleUnmount} onOpenDetail={() => router.push('/handoffs')} />
        ) : (
          <EmptyHero onBrowse={() => router.push('/handoffs')} />
        )}

        {/* Sub-grid: Recent Handoffs + Today's Pulse */}
        <div className="grid gap-6 mt-6" style={{ gridTemplateColumns: 'minmax(0, 1.5fr) minmax(280px, 1fr)' }}>
          {/* Recent Handoffs */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold" style={{ fontSize: 'var(--t-h3)' }}>
                Recent Handoffs
                <span className="ml-2 font-normal" style={{ color: 'var(--text3)', fontSize: 'var(--t-sm)' }}>
                  · last 7 days
                </span>
              </h2>
              <Link
                href="/handoffs"
                className="transition-colors hover:opacity-80"
                style={{ fontSize: 'var(--t-sm)', color: 'var(--primary-2)' }}
              >
                View all →
              </Link>
            </div>
            {recent.length === 0 ? (
              <div
                className="text-center"
                style={{
                  padding: '48px 24px',
                  background: 'var(--card)',
                  border: '1px dashed var(--border)',
                  borderRadius: 'var(--r)',
                  color: 'var(--text3)',
                  fontSize: 'var(--t-sm)',
                }}
              >
                No recent handoffs in the last 7 days.
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {recent.map((h) => (
                  <HandoffRow key={h.id} handoff={h} onClick={() => router.push('/handoffs')} />
                ))}
              </div>
            )}
          </section>

          {/* Today's Pulse */}
          <section>
            <h2 className="font-semibold mb-3" style={{ fontSize: 'var(--t-h3)' }}>Today&apos;s Pulse</h2>
            <div className="flex flex-col gap-2.5">
              <PulseStat
                k="Sessions"
                v={String(today.sessions)}
                sub={`${today.sessions} today · ${yesterday.sessions} yesterday`}
                delta={sessionsDelta}
              />
              <PulseStat
                k="Tokens"
                v={fmtTokens(today.tokens)}
                sub={`${fmtK(today.input_tokens)} in · ${fmtK(today.output_tokens)} out`}
                delta={tokensDelta}
              />
              <PulseStat
                k="Cost"
                v={`$${today.cost.toFixed(2)}`}
                sub={`of $${DAILY_COST_CAP.toFixed(0)} daily cap`}
                delta={costDelta}
              />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

/* ── Hero: mounted handoff ── */

function MountedHero({
  handoff,
  onUnmount,
  onOpenDetail,
}: {
  handoff: Handoff;
  onUnmount: () => void;
  onOpenDetail: () => void;
}) {
  const progress = handoff.sections_total > 0
    ? Math.round((handoff.sections_completed / handoff.sections_total) * 100)
    : 0;

  return (
    <div
      className="relative overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, rgba(99,102,241,.10) 0%, rgba(99,102,241,.02) 60%), var(--card)',
        border: '1px solid var(--primary-hi)',
        borderRadius: 'var(--r-lg)',
        padding: '24px 28px',
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        gap: 24,
        alignItems: 'center',
        boxShadow: 'var(--sh)',
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: 4,
          height: '100%',
          background: 'linear-gradient(180deg, var(--primary), var(--primary-2))',
        }}
      />

      <div style={{ minWidth: 0 }}>
        <div
          className="flex items-center gap-2 mb-1.5"
          style={{
            fontSize: 'var(--t-tiny)',
            color: 'var(--primary-2)',
            textTransform: 'uppercase',
            letterSpacing: '.08em',
            fontWeight: 600,
          }}
        >
          <span
            className="angelo-pulse"
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: 'var(--primary)',
            }}
          />
          Currently Working On
        </div>

        <div
          className="truncate"
          style={{
            fontSize: 'var(--t-h1)',
            fontWeight: 600,
            letterSpacing: '-.01em',
            marginBottom: 6,
          }}
        >
          {handoff.scope_name}
        </div>

        <div
          className="flex items-center gap-1.5 flex-wrap mb-2"
          style={{ fontSize: 'var(--t-sm)', color: 'var(--text3)' }}
        >
          <span style={{ color: 'var(--text2)', fontWeight: 500 }}>{handoff.project_key}</span>
          <span style={{ color: 'var(--text4)' }}>›</span>
          <span style={{ textTransform: 'uppercase', letterSpacing: '.04em', fontSize: 'var(--t-tiny)', fontWeight: 600 }}>
            {handoff.scope_type}
          </span>
          <span style={{ color: 'var(--text4)' }}>·</span>
          <span style={{ fontFamily: 'ui-monospace, monospace' }}>{handoff.handoff_code || handoff.id.slice(0, 8)}</span>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap mb-3">
          {handoff.entry_point && (
            <span
              style={{
                fontSize: 'var(--t-tiny)',
                fontWeight: 600,
                padding: '3px 8px',
                borderRadius: 'var(--r-sm)',
                background: 'var(--primary-dim)',
                color: 'var(--primary-2)',
                letterSpacing: '.04em',
              }}
            >
              {handoff.entry_point}
            </span>
          )}
          <StatusBadge status={handoff.status} />
          {handoff.version && (
            <span
              style={{
                fontFamily: 'ui-monospace, monospace',
                fontSize: 'var(--t-tiny)',
                color: 'var(--text3)',
              }}
            >
              {handoff.version}
            </span>
          )}
        </div>

        {handoff.notes && (
          <p
            className="line-clamp-2"
            style={{
              color: 'var(--text2)',
              fontSize: 'var(--t-sm)',
              maxWidth: '64ch',
              lineHeight: 1.55,
              marginBottom: 14,
            }}
          >
            {handoff.notes}
          </p>
        )}

        {/* Progress bar */}
        <div style={{ maxWidth: 520 }}>
          <div className="flex items-center justify-between mb-1.5">
            <span style={{ fontSize: 'var(--t-tiny)', color: 'var(--text3)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.06em' }}>
              Progress
            </span>
            <span style={{ fontSize: 'var(--t-tiny)', color: 'var(--text2)', fontVariantNumeric: 'tabular-nums' }}>
              {handoff.sections_completed}/{handoff.sections_total} · {progress}%
            </span>
          </div>
          <div
            style={{
              height: 6,
              borderRadius: 999,
              background: 'var(--card-alt)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${progress}%`,
                background: 'linear-gradient(90deg, var(--primary), var(--primary-2))',
                transition: 'width .3s ease',
              }}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2" style={{ minWidth: 180 }}>
        <button
          onClick={onOpenDetail}
          className="transition-opacity hover:opacity-90"
          style={{
            padding: '9px 14px',
            background: 'var(--primary)',
            color: '#fff',
            border: '1px solid var(--primary)',
            borderRadius: 'var(--r-sm)',
            fontSize: 'var(--t-sm)',
            fontWeight: 500,
          }}
        >
          Open Full Detail →
        </button>
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('quick-note', {
            detail: {
              project_key: handoff.project_key,
              attach_hint: handoff.handoff_code || handoff.scope_name || null,
            },
          }))}
          className="transition-colors hover:bg-[var(--card-alt)]"
          style={{
            padding: '9px 14px',
            background: 'var(--card)',
            color: 'var(--text2)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r-sm)',
            fontSize: 'var(--t-sm)',
            fontWeight: 500,
          }}
        >
          ＋ Note on this
        </button>
        <button
          onClick={onUnmount}
          className="transition-colors"
          style={{
            padding: '9px 14px',
            background: 'transparent',
            color: 'var(--danger, #DC2626)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r-sm)',
            fontSize: 'var(--t-sm)',
            fontWeight: 500,
          }}
        >
          ⌀ Unmount
        </button>
      </div>
    </div>
  );
}

/* ── Empty hero ── */

function EmptyHero({ onBrowse }: { onBrowse: () => void }) {
  return (
    <div
      style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r-lg)',
        padding: '32px 28px',
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        gap: 24,
        alignItems: 'center',
      }}
    >
      <div>
        <div
          style={{
            fontSize: 'var(--t-tiny)',
            color: 'var(--text3)',
            textTransform: 'uppercase',
            letterSpacing: '.08em',
            fontWeight: 600,
            marginBottom: 6,
          }}
        >
          No handoff mounted
        </div>
        <div style={{ fontSize: 'var(--t-h1)', fontWeight: 600, letterSpacing: '-.01em', marginBottom: 6 }}>
          Pick a handoff to focus on
        </div>
        <p style={{ color: 'var(--text2)', fontSize: 'var(--t-sm)', maxWidth: '56ch', lineHeight: 1.55 }}>
          Mount a handoff to make it the active context. It appears here and in the top bar until you unmount.
        </p>
      </div>
      <div className="flex flex-col gap-2" style={{ minWidth: 180 }}>
        <button
          onClick={onBrowse}
          className="transition-opacity hover:opacity-90"
          style={{
            padding: '9px 14px',
            background: 'var(--primary)',
            color: '#fff',
            border: '1px solid var(--primary)',
            borderRadius: 'var(--r-sm)',
            fontSize: 'var(--t-sm)',
            fontWeight: 500,
          }}
        >
          Browse Handoffs →
        </button>
      </div>
    </div>
  );
}

/* ── Handoff row (recent list) ── */

function HandoffRow({ handoff, onClick }: { handoff: Handoff; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className="transition-all cursor-pointer hover:-translate-y-[1px]"
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        gap: 16,
        alignItems: 'center',
        padding: '12px 16px',
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r)',
        boxShadow: 'var(--sh, 0 1px 2px rgba(0,0,0,.04))',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--primary-hi)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
    >
      <div style={{ minWidth: 0 }}>
        <div className="truncate" style={{ fontSize: 'var(--t-body)', fontWeight: 500, color: 'var(--text)' }}>
          {handoff.scope_name}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap mt-1" style={{ fontSize: 'var(--t-tiny)' }}>
          <span style={{ color: 'var(--text2)', fontWeight: 500 }}>{handoff.project_key}</span>
          <span style={{ color: 'var(--text4)' }}>›</span>
          <span style={{ color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.04em', fontWeight: 600 }}>
            {handoff.scope_type}
          </span>
          {handoff.entry_point && (
            <>
              <span style={{ color: 'var(--text4)' }}>·</span>
              <span
                style={{
                  padding: '1px 6px',
                  borderRadius: 4,
                  background: 'var(--primary-dim)',
                  color: 'var(--primary-2)',
                  fontWeight: 600,
                }}
              >
                {handoff.entry_point}
              </span>
            </>
          )}
          <StatusBadge status={handoff.status} />
          <span style={{ color: 'var(--text4)' }}>·</span>
          <span style={{ color: 'var(--text3)', fontVariantNumeric: 'tabular-nums' }}>
            {handoff.sections_completed}/{handoff.sections_total}
          </span>
        </div>
      </div>
      <div style={{ fontSize: 'var(--t-tiny)', color: 'var(--text3)', whiteSpace: 'nowrap' }}>
        {timeAgo(handoff.updated_at)}
      </div>
    </div>
  );
}

/* ── Pulse stat tile ── */

function PulseStat({
  k,
  v,
  sub,
  delta,
}: {
  k: string;
  v: string;
  sub: string;
  delta: { label: string; dir: 'up' | 'down' | 'flat' };
}) {
  const trendColor = delta.dir === 'up'
    ? 'var(--success, #16A34A)'
    : delta.dir === 'down'
    ? 'var(--danger, #DC2626)'
    : 'var(--text3)';
  const trendArrow = delta.dir === 'up' ? '▲' : delta.dir === 'down' ? '▼' : '–';

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        gap: 8,
        padding: '14px 16px',
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r)',
        alignItems: 'center',
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 'var(--t-tiny)',
            color: 'var(--text3)',
            textTransform: 'uppercase',
            letterSpacing: '.06em',
            fontWeight: 500,
          }}
        >
          {k}
        </div>
        <div
          className="truncate"
          style={{
            fontSize: 18,
            fontWeight: 600,
            fontVariantNumeric: 'tabular-nums',
            color: 'var(--text)',
          }}
        >
          {v}
        </div>
        <div
          className="truncate"
          style={{ fontSize: 'var(--t-tiny)', color: 'var(--text3)', marginTop: 2 }}
        >
          {sub}
        </div>
      </div>
      <div
        className="flex items-center gap-1"
        style={{ fontSize: 'var(--t-tiny)', fontWeight: 600, color: trendColor, whiteSpace: 'nowrap' }}
      >
        <span>{trendArrow}</span>
        <span>{delta.label}</span>
      </div>
    </div>
  );
}
