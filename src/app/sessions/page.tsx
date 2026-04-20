'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { cachedFetch, invalidateCache } from '@/lib/cache';
import { HeroCard, TierLabel } from '@/components/hero-card';
import { DraggableSessionRow, type DraggableSessionData } from '@/components/draggable-session-row';
import { EntityDropTarget } from '@/components/entity-drop-target';
import { ReattributionToast } from '@/components/reattribution-toast';
import { ShortcutPill } from '@/components/shortcut-pill';
import { useCommandPalette } from '@/hooks/use-command-palette';

type Range = 'today' | '7d' | '30d' | 'all';

interface SessionRow {
  id: string;
  session_code: string | null;
  project_key: string | null;
  session_date: string;
  title: string;
  surface: string | null;
  summary: string | null;
  mission: string | null;
  chain_id: string | null;
  entry_point: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  cost_usd: number | null;
  created_at: string;
}

interface SessionsResponse {
  sessions: SessionRow[];
  total: number;
  range: Range;
  stats: {
    range_total: number;
    range_tokens: number;
    range_cost: number;
    range_with_metrics: number;
    week: {
      daily: { date: string; sessions: number; tokens: number; cost: number }[];
      total_sessions: number;
      total_tokens: number;
      total_cost: number;
      avg_tokens: number;
      avg_cost: number;
      efficiency_tokens_per_dollar: number;
    };
  };
}

const RANGE_TABS: { key: Range; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: '7d',    label: '7 days' },
  { key: '30d',   label: '30 days' },
  { key: 'all',   label: 'All' },
];

const SURFACE_COLOR: Record<string, string> = {
  CODE: 'var(--primary)',
  CHAT: 'var(--success)',
  COWORK: 'var(--vault)',
  MOBILE: 'var(--info)',
};

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w ago`;
  return new Date(iso).toLocaleDateString();
}

function fmtTokens(n: number): string {
  if (!n) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function fmtCost(n: number): string {
  if (!n) return '$0.00';
  return `$${n.toFixed(2)}`;
}

interface EntityOption {
  child_key: string;
  display_name: string;
  entity_type: string | null;
  status: string | null;
}

interface UndoState {
  sessionId: string;
  newProjectKey: string;
  previousProjectKey: string | null;
}

export default function SessionsPage() {
  const [range, setRange] = useState<Range>('7d');
  const [data, setData] = useState<SessionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const { openPalette } = useCommandPalette();

  // ── Drag / re-attribution state ──
  const [activeDragSessionId, setActiveDragSessionId] = useState<string | null>(null);
  const [entities, setEntities] = useState<EntityOption[]>([]);
  const [entitiesLoaded, setEntitiesLoaded] = useState(false);
  const [undoState, setUndoState] = useState<UndoState | null>(null);
  // optimistic overrides: sessionId → project_key
  const [optimisticKeys, setOptimisticKeys] = useState<Record<string, string>>({});
  // tracks which session IDs have been merged away (remove from list)
  const [mergedAway, setMergedAway] = useState<Set<string>>(new Set());

  const fetchSessions = useCallback(async (r: Range) => {
    setLoading(true);
    try {
      const d = await cachedFetch<SessionsResponse>(`/api/sessions?range=${r}&limit=200`, 10000);
      setData(d);
    } catch {
      setData(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchSessions(range);
  }, [range, fetchSessions]);

  // Load entities once for drop targets
  useEffect(() => {
    if (entitiesLoaded) return;
    (async () => {
      try {
        const res = await fetch('/api/projects');
        if (res.ok) {
          const d = await res.json();
          setEntities((d.projects || d || []) as EntityOption[]);
        }
      } catch { /* silent */ }
      setEntitiesLoaded(true);
    })();
  }, [entitiesLoaded]);

  // ── Re-attribute handler ──
  const handleReattribute = useCallback(async (
    sessionId: string,
    newProjectKey: string,
  ): Promise<{ previousProjectKey: string | null }> => {
    const res = await fetch(`/api/sessions/${sessionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_key: newProjectKey }),
    });
    const result = await res.json();
    if (result.success) {
      const prev = result.previous_project_key ?? null;
      // Optimistic update
      setOptimisticKeys((prev2) => ({ ...prev2, [sessionId]: newProjectKey }));
      // Show undo toast
      setUndoState({ sessionId, newProjectKey, previousProjectKey: prev });
      invalidateCache('sessions');
      return { previousProjectKey: prev };
    }
    // Surface error via console; parent toast omitted to keep scope tight
    console.error('reattribute failed:', result.error);
    return { previousProjectKey: null };
  }, []);

  // ── Merge handler ──
  const handleMerge = useCallback(async (sourceId: string, targetId: string): Promise<void> => {
    const res = await fetch(`/api/sessions/${sourceId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ merge_into_session_id: targetId }),
    });
    const result = await res.json();
    if (result.success) {
      setMergedAway((prev) => new Set(prev).add(sourceId));
      invalidateCache('sessions');
    } else {
      console.error('merge failed:', result.error);
    }
  }, []);

  // ── Undo handler ──
  const handleUndo = useCallback(async (sessionId: string, previousProjectKey: string | null) => {
    if (!previousProjectKey) return;
    const res = await fetch(`/api/sessions/${sessionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_key: previousProjectKey }),
    });
    const result = await res.json();
    if (result.success) {
      setOptimisticKeys((prev) => ({ ...prev, [sessionId]: previousProjectKey }));
      invalidateCache('sessions');
    }
  }, []);

  const sessions = data?.sessions || [];
  const week = data?.stats.week;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const visible = sessions.filter((s) => !mergedAway.has(s.id));
    if (!q) return visible;
    return visible.filter((s) => {
      const hay = [s.title, s.project_key, s.mission, s.summary, s.session_code].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [sessions, search, mergedAway]);

  const maxDailyTokens = useMemo(() => Math.max(1, ...(week?.daily.map((d) => d.tokens) || [1])), [week]);
  const maxDailyCost = useMemo(() => Math.max(0.01, ...(week?.daily.map((d) => d.cost) || [0.01])), [week]);
  const maxDailyEff = useMemo(() => {
    const effs = (week?.daily || []).map((d) => (d.cost > 0 ? d.tokens / d.cost : 0));
    return Math.max(1, ...effs);
  }, [week]);

  // Surface mix — computed from the current filtered session window
  const surfaceMix = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of sessions) {
      const surf = s.surface || 'OTHER';
      counts[surf] = (counts[surf] || 0) + 1;
    }
    const total = sessions.length || 1;
    return Object.entries(counts)
      .map(([surface, count]) => ({ surface, count, pct: Math.round((count / total) * 100) }))
      .sort((a, b) => b.count - a.count);
  }, [sessions]);

  const todayIso = new Date().toISOString().slice(0, 10);

  // Group sessions into today / this-week / older for hero hierarchy
  const todaySessions = useMemo(
    () => filtered.filter((s) => s.session_date === todayIso),
    [filtered, todayIso]
  );
  const weekSessions = useMemo(
    () => filtered.filter((s) => s.session_date < todayIso && s.session_date >= new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)),
    [filtered, todayIso]
  );
  const olderSessions = useMemo(
    () => filtered.filter((s) => s.session_date < new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)),
    [filtered]
  );

  return (
    <div className="h-full overflow-y-auto" data-testid="sessions-page">
      <div className="max-w-[1280px] mx-auto px-4 md:px-8 py-5 md:py-7" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Page head */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h1 className="flex items-center gap-3 font-semibold tracking-tight" style={{ fontSize: 'var(--t-h2)' }}>
            Sessions
            <span className="font-normal" style={{ color: 'var(--text3)', fontSize: 'var(--t-body)' }}>
              {data ? `${data.total} total` : '—'}
              {week ? ` · ${week.total_sessions} in last 7d` : ''}
            </span>
            {/* Desktop shortcut pills */}
            <ShortcutPill label="⌘K Search" onClick={openPalette} />
          </h1>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 3,
              padding: 3,
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--r)',
            }}
          >
            {RANGE_TABS.map((t) => (
              <RangeTab key={t.key} active={range === t.key} onClick={() => setRange(t.key)}>
                {t.label}
              </RangeTab>
            ))}
          </div>
        </div>

        {/* 7-day bar charts */}
        {week && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            <ChartCard
              label="Tokens / day (7d)"
              daily={week.daily}
              value={(d) => d.tokens}
              max={maxDailyTokens}
              color="var(--primary)"
              subtitle={
                <>
                  <span style={{ fontWeight: 600 }}>{fmtTokens(week.total_tokens)}</span>
                  <span style={{ color: 'var(--text3)' }}> / week · avg {fmtTokens(week.avg_tokens)}/session</span>
                </>
              }
              todayIso={todayIso}
            />
            <ChartCard
              label="Cost / day (7d)"
              daily={week.daily}
              value={(d) => d.cost}
              max={maxDailyCost}
              color="var(--success)"
              subtitle={
                <>
                  <span style={{ fontWeight: 600 }}>{fmtCost(week.total_cost)}</span>
                  <span style={{ color: 'var(--text3)' }}> / week · {fmtCost(week.avg_cost)}/session</span>
                </>
              }
              todayIso={todayIso}
            />
            <ChartCard
              label="Efficiency (tok/$)"
              daily={week.daily}
              value={(d) => (d.cost > 0 ? d.tokens / d.cost : 0)}
              max={maxDailyEff}
              color="var(--info)"
              subtitle={
                <>
                  <span style={{ fontWeight: 600 }}>{week.efficiency_tokens_per_dollar.toLocaleString()}</span>
                  <span style={{ color: 'var(--text3)' }}> tok/$ weekly</span>
                </>
              }
              todayIso={todayIso}
            />
          </div>
        )}

        {/* Surface mix bar — 7d */}
        {sessions.length > 0 && (
          <SurfaceMixBar surfaceMix={surfaceMix} />
        )}

        {/* Search */}
        <div
          style={{
            padding: '10px 12px',
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r)',
          }}
        >
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title, project, mission, or summary…"
            style={{
              width: '100%',
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--r-sm)',
              padding: '6px 12px',
              color: 'var(--text)',
              fontSize: 'var(--t-sm)',
              outline: 'none',
            }}
          />
        </div>

        {/* HERO — Today's sessions */}
        <div>
          <TierLabel>HERO · TODAY</TierLabel>
          {loading ? (
            <div className="flex items-center justify-center" style={{ height: 80 }}>
              <div className="w-5 h-5 rounded-full border-2 border-[var(--primary)] border-t-transparent animate-spin" />
            </div>
          ) : todaySessions.length === 0 ? (
            <HeroCard accentHex="#10B981">
              <div style={{ color: 'var(--text3)', fontSize: 'var(--t-sm)', textAlign: 'center', padding: '4px 0' }}>
                No sessions today yet
              </div>
            </HeroCard>
          ) : (
            <HeroCard accentHex="#10B981">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, margin: '-4px 0' }}>
                {todaySessions.map((s) => (
                  <SessionRowItem
                    key={s.id}
                    s={s}
                    expanded={expanded === s.id}
                    onToggle={() => setExpanded(expanded === s.id ? null : s.id)}
                    heroStyle
                  />
                ))}
              </div>
            </HeroCard>
          )}
        </div>

        {/* SUB — This week */}
        {!loading && weekSessions.length > 0 && (
          <div>
            <TierLabel>SUB · THIS WEEK</TierLabel>
            <div
              style={{
                background: 'var(--card)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--r)',
                overflow: 'hidden',
              }}
            >
              {weekSessions.map((s) => (
                <SessionRowItem
                  key={s.id}
                  s={s}
                  expanded={expanded === s.id}
                  onToggle={() => setExpanded(expanded === s.id ? null : s.id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* TERTIARY — Older sessions */}
        {!loading && olderSessions.length > 0 && (
          <div>
            <TierLabel>TERTIARY · OLDER</TierLabel>
            <div
              style={{
                background: 'var(--card)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--r)',
                overflow: 'hidden',
              }}
            >
              {olderSessions.slice(0, 10).map((s) => (
                <SessionRowItem
                  key={s.id}
                  s={s}
                  expanded={expanded === s.id}
                  onToggle={() => setExpanded(expanded === s.id ? null : s.id)}
                  compact
                />
              ))}
              {olderSessions.length > 10 && (
                <div style={{ padding: '10px 16px', textAlign: 'center' }}>
                  <button
                    onClick={() => setRange('all')}
                    style={{ fontSize: 'var(--t-sm)', color: 'var(--primary-2)', background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    Load {olderSessions.length - 10} more →
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Fallback: no sessions at all */}
        {!loading && filtered.length === 0 && (
          <div
            style={{
              textAlign: 'center',
              padding: '48px 24px',
              background: 'var(--card)',
              border: '1px dashed var(--border)',
              borderRadius: 'var(--r)',
              color: 'var(--text3)',
              fontSize: 'var(--t-sm)',
            }}
          >
            No sessions match the current filters
          </div>
        )}

        {/* Entity drop target panel — slides up from bottom during drag on mobile */}
        {activeDragSessionId && entities.length > 0 && (
          <>
            {/* Backdrop hint text */}
            <div
              style={{
                position: 'fixed',
                bottom: 80,
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 30,
                fontSize: 12,
                color: 'var(--text3)',
                pointerEvents: 'none',
              }}
            >
              Drop on an entity below to re-assign
            </div>
            {/* Mobile entity drawer overlay */}
            <div
              style={{
                position: 'fixed',
                bottom: 0,
                left: 0,
                right: 0,
                zIndex: 35,
                background: 'var(--surface)',
                borderTop: '1px solid var(--border)',
                padding: '12px 16px 24px',
                display: 'flex',
                gap: 8,
                overflowX: 'auto',
                boxShadow: '0 -8px 32px rgba(0,0,0,0.3)',
              }}
            >
              {entities
                .filter((e) => e.status !== 'ARCHIVED')
                .map((e) => (
                  <EntityDropTarget
                    key={e.child_key}
                    entityKey={e.child_key}
                    displayName={e.display_name}
                    isArchived={false}
                    isDragActive={!!activeDragSessionId}
                    onDrop={(entityKey) => {
                      if (activeDragSessionId) {
                        handleReattribute(activeDragSessionId, entityKey);
                        setActiveDragSessionId(null);
                      }
                    }}
                  >
                    <div
                      style={{
                        padding: '8px 12px',
                        background: 'var(--card)',
                        border: '1px solid var(--border)',
                        borderRadius: 8,
                        fontSize: 12,
                        color: 'var(--text)',
                        whiteSpace: 'nowrap',
                        cursor: 'copy',
                        userSelect: 'none',
                      }}
                    >
                      {e.display_name}
                    </div>
                  </EntityDropTarget>
                ))}
            </div>
          </>
        )}

        {/* Stats strip */}
        {data && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: activeDragSessionId ? 120 : 0 }}>
            <StatCell k={`Sessions (${range})`} v={String(data.stats.range_total)} />
            <StatCell k="7d sessions" v={String(week?.total_sessions ?? 0)} tone="primary" />
            <StatCell k="7d tokens" v={fmtTokens(week?.total_tokens ?? 0)} tone="primary" />
            <StatCell k="7d cost" v={fmtCost(week?.total_cost ?? 0)} tone="success" />
          </div>
        )}
      </div>

      {/* Undo toast */}
      {undoState && (
        <ReattributionToast
          sessionId={undoState.sessionId}
          newProjectKey={undoState.newProjectKey}
          previousProjectKey={undoState.previousProjectKey}
          onUndo={handleUndo}
          onDismiss={() => setUndoState(null)}
        />
      )}
    </div>
  );
}

function RangeTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '5px 12px',
        fontSize: 'var(--t-sm)',
        color: active ? 'var(--primary-2)' : 'var(--text3)',
        background: active ? 'var(--primary-dim)' : 'transparent',
        border: 'none',
        borderRadius: 'var(--r-sm)',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        fontWeight: active ? 500 : 400,
      }}
    >
      {children}
    </button>
  );
}

function ChartCard({
  label, daily, value, max, color, subtitle, todayIso,
}: {
  label: string;
  daily: { date: string; sessions: number; tokens: number; cost: number }[];
  value: (d: { date: string; sessions: number; tokens: number; cost: number }) => number;
  max: number;
  color: string;
  subtitle: React.ReactNode;
  todayIso: string;
}) {
  return (
    <div
      style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r)',
        padding: 16,
      }}
    >
      <div
        style={{
          fontSize: 'var(--t-tiny)',
          color: 'var(--text3)',
          textTransform: 'uppercase',
          letterSpacing: '.06em',
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 72 }}>
        {daily.map((d) => {
          const v = value(d);
          const heightPct = max > 0 ? Math.max(4, (v / max) * 100) : 4;
          const isToday = d.date === todayIso;
          return (
            <div
              key={d.date}
              title={`${d.date}: ${d.sessions} sessions`}
              style={{
                flex: 1,
                height: `${heightPct}%`,
                background: color,
                borderRadius: '3px 3px 0 0',
                opacity: isToday ? 1 : 0.6,
                transition: 'opacity 120ms',
              }}
            />
          );
        })}
      </div>
      <div style={{ fontSize: 'var(--t-sm)', marginTop: 8 }}>{subtitle}</div>
    </div>
  );
}

function SessionRowItem({
  s,
  expanded,
  onToggle,
  heroStyle = false,
  compact = false,
}: {
  s: SessionRow;
  expanded: boolean;
  onToggle: () => void;
  heroStyle?: boolean;
  compact?: boolean;
}) {
  const totalTokens = (s.input_tokens || 0) + (s.output_tokens || 0);
  const surfaceColor = SURFACE_COLOR[s.surface || ''] || 'var(--text3)';
  const when = relativeTime(s.created_at);

  // Compact (tertiary) row — no expand panel, minimal data
  if (compact) {
    return (
      <Link
        href={`/session/${s.id}`}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '10px 16px',
          borderBottom: '1px solid var(--border)',
          textDecoration: 'none',
          color: 'var(--text)',
        }}
      >
        <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, color: 'var(--text3)', minWidth: 54 }}>
          {s.session_code ? `#${s.session_code.slice(-6)}` : s.id.slice(0, 8)}
        </span>
        <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--t-sm)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text2)' }}>
          {s.title}
        </span>
        <span style={{ fontSize: 'var(--t-tiny)', color: 'var(--text3)', whiteSpace: 'nowrap' }}>{when}</span>
      </Link>
    );
  }

  return (
    <div
      style={{
        background: heroStyle ? 'transparent' : 'var(--card)',
        border: heroStyle ? 'none' : '1px solid var(--border)',
        borderRadius: heroStyle ? 0 : 'var(--r)',
        overflow: 'hidden',
        borderBottom: heroStyle ? '1px solid rgba(255,255,255,0.08)' : undefined,
      }}
    >
      <button
        onClick={onToggle}
        style={{
          display: 'grid',
          gridTemplateColumns: 'auto 2fr 1fr 1fr auto',
          gap: 16,
          padding: '12px 16px',
          alignItems: 'center',
          background: 'transparent',
          border: 'none',
          width: '100%',
          cursor: 'pointer',
          textAlign: 'left',
          color: 'var(--text)',
        }}
      >
        <div
          style={{
            fontFamily: 'ui-monospace, monospace',
            fontSize: 'var(--t-tiny)',
            color: 'var(--text3)',
            minWidth: 64,
          }}
        >
          {s.session_code || s.id.slice(0, 8)}
        </div>
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 'var(--t-sm)',
              fontWeight: 500,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {s.title}
            {s.mission && (
              <span style={{ color: 'var(--text3)', fontWeight: 400, marginLeft: 8 }}>· {s.mission}</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4 }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '1px 8px',
                borderRadius: 999,
                background: surfaceColor,
                color: '#fff',
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: '.04em',
              }}
            >
              {s.surface || '—'}
            </span>
            {s.project_key && (
              <span style={{ fontSize: 'var(--t-tiny)', color: 'var(--text3)' }}>{s.project_key}</span>
            )}
            {s.entry_point && (
              <span
                style={{
                  fontSize: 'var(--t-tiny)',
                  color: 'var(--text3)',
                  padding: '1px 6px',
                  border: '1px solid var(--border)',
                  borderRadius: 999,
                }}
              >
                {s.entry_point}
              </span>
            )}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 'var(--t-sm)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
            {totalTokens > 0 ? fmtTokens(totalTokens) : '—'}
          </div>
          <div style={{ fontSize: 'var(--t-tiny)', color: 'var(--text3)' }}>tokens</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 'var(--t-sm)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
            {s.cost_usd ? fmtCost(Number(s.cost_usd)) : '—'}
          </div>
          <div style={{ fontSize: 'var(--t-tiny)', color: 'var(--text3)' }}>cost</div>
        </div>
        <div style={{ fontSize: 'var(--t-tiny)', color: 'var(--text3)', whiteSpace: 'nowrap' }}>{when}</div>
      </button>
      {expanded && (
        <div
          style={{
            padding: '0 16px 14px',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            paddingTop: 12,
          }}
        >
          {s.summary ? (
            <p
              style={{
                fontSize: 'var(--t-sm)',
                color: 'var(--text2)',
                lineHeight: 1.55,
                whiteSpace: 'pre-line',
                margin: 0,
              }}
            >
              {s.summary.length > 600 ? `${s.summary.slice(0, 600)}…` : s.summary}
            </p>
          ) : (
            <p style={{ fontSize: 'var(--t-sm)', color: 'var(--text3)', fontStyle: 'italic', margin: 0 }}>
              No summary
            </p>
          )}
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <Link
              href={`/session/${s.id}`}
              style={{
                fontSize: 'var(--t-tiny)',
                color: 'var(--primary-2)',
                textDecoration: 'none',
                fontWeight: 500,
              }}
            >
              View full session →
            </Link>
            {s.chain_id && (
              <Link
                href={`/chain/${s.chain_id}`}
                style={{
                  fontSize: 'var(--t-tiny)',
                  color: 'var(--text3)',
                  textDecoration: 'none',
                }}
              >
                Chain {s.chain_id.slice(0, 12)} →
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const SURFACE_BAR_COLOR: Record<string, string> = {
  CODE:   'var(--accent, #0a84ff)',
  CHAT:   'var(--green, #30d158)',
  COWORK: 'var(--purple, #bf5af2)',
  MOBILE: 'var(--orange, #ff9f0a)',
  OTHER:  'var(--text3)',
};

function SurfaceMixBar({ surfaceMix }: { surfaceMix: { surface: string; count: number; pct: number }[] }) {
  if (surfaceMix.length === 0) return null;
  return (
    <div
      style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r)',
        padding: 16,
      }}
    >
      <div
        style={{
          fontSize: 'var(--t-tiny)',
          color: 'var(--text3)',
          textTransform: 'uppercase',
          letterSpacing: '.06em',
          marginBottom: 10,
          fontWeight: 700,
        }}
      >
        Surface Mix · Current View
      </div>
      {/* Stacked bar */}
      <div
        style={{
          display: 'flex',
          gap: 2,
          height: 8,
          borderRadius: 4,
          overflow: 'hidden',
          marginBottom: 12,
        }}
      >
        {surfaceMix.map(({ surface, pct }) => (
          <div
            key={surface}
            style={{
              flex: pct,
              background: SURFACE_BAR_COLOR[surface] || 'var(--text3)',
              minWidth: pct > 0 ? 2 : 0,
            }}
            title={`${surface}: ${pct}%`}
          />
        ))}
      </div>
      {/* Legend */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
          gap: '6px 12px',
        }}
      >
        {surfaceMix.map(({ surface, pct }) => (
          <div key={surface} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: SURFACE_BAR_COLOR[surface] || 'var(--text3)',
                flexShrink: 0,
              }}
            />
            <span style={{ color: 'var(--text2)', flex: 1 }}>{surface}</span>
            <span style={{ fontFamily: 'ui-monospace, monospace', color: 'var(--text3)' }}>{pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatCell({ k, v, tone }: { k: string; v: string; tone?: 'primary' | 'success' | 'warn' | 'info' }) {
  const color =
    tone === 'primary' ? 'var(--primary-2)' :
    tone === 'success' ? 'var(--success)' :
    tone === 'warn'    ? 'var(--warn)'    :
    tone === 'info'    ? 'var(--info)'    :
    'var(--text)';
  return (
    <div
      style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r)',
        padding: '12px 16px',
      }}
    >
      <div style={{ fontSize: 'var(--t-tiny)', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
        {k}
      </div>
      <div style={{ fontSize: 18, fontWeight: 600, fontVariantNumeric: 'tabular-nums', marginTop: 4, color }}>
        {v}
      </div>
    </div>
  );
}
