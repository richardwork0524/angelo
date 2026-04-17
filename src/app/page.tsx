'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { TokenPill } from '@/components/token-pill';
import { ColorLegend } from '@/components/color-legend';
import { SessionPopup } from '@/components/popups/session-popup';
import { ChainPopup } from '@/components/popups/chain-popup';
import { SystemPopup } from '@/components/popups/system-popup';
import { HandoffCard } from '@/components/handoff-card';
import { StepTracker } from '@/components/step-tracker';
import { patchHandoff } from '@/lib/mutate';
import { SURFACE_COLORS } from '@/lib/constants';
import { cachedFetch } from '@/lib/cache';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import type { Handoff } from '@/lib/types';

/* ── Types ── */

interface Session {
  id: string;
  project_key: string;
  session_date: string;
  title: string;
  surface: string | null;
  summary: string | null;
  chain_id: string | null;
  entry_point: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  cost_usd: number | null;
  tags: string[] | null;
  mission: string | null;
  handoff_context: Record<string, unknown> | null;
}

interface Chain {
  chain_id: string;
  project_key: string;
  title: string;
  entry_point: string | null;
  session_count: number;
  total_cost: number;
  latest_date: string;
  latest_title: string;
}

interface TokenStats {
  today: { input: number; output: number; cost: number; sessions: number };
  week: { input: number; output: number; cost: number; sessions: number; avg_daily: number };
  daily_costs: { date: string; cost: number }[];
}

interface RoutineTask {
  id: string;
  project_key: string;
  text: string;
  priority: string | null;
  bucket: string;
  mission: string | null;
  task_type: string | null;
}

interface HookLog {
  hook_name: string;
  action: string;
  project_key: string | null;
  detail: string | null;
  created_at: string;
  status: string | null;
}

interface HomeData {
  hero: Session | null;
  latest_handoff: Handoff | null;
  open_handoffs: Handoff[];
  recent_sessions: Session[];
  chains: Chain[];
  token_stats: TokenStats;
  routine: RoutineTask[];
  system: {
    health: string;
    recent_hooks: HookLog[];
    error_count: number;
  };
}

/* ── Helpers ── */

function timeAgo(ts: string): string {
  const mins = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
  if (mins < 60) return mins <= 0 ? 'just now' : `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function fmtTokens(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(0)}K` : String(n);
}

/* ── Homepage ── */

export default function HomePage() {
  const router = useRouter();
  const isDesktop = useBreakpoint(768);
  const [data, setData] = useState<HomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copyLabel, setCopyLabel] = useState('Copy Handoff');
  const [popupSession, setPopupSession] = useState<Session | null>(null);
  const [popupChain, setPopupChain] = useState<Chain | null>(null);
  const [showSystemPopup, setShowSystemPopup] = useState(false);

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

  function handleCopyHandoff() {
    if (!data?.hero) return;
    const h = data.hero;
    const text = [
      `# ${h.title}`,
      `Project: ${h.project_key} | Surface: ${h.surface} | Date: ${h.session_date}`,
      h.chain_id ? `Chain: ${h.chain_id}` : null,
      h.entry_point ? `Entry: ${h.entry_point}` : null,
      h.cost_usd ? `Cost: $${Number(h.cost_usd).toFixed(2)}` : null,
      '',
      h.summary || '(no summary)',
    ].filter(Boolean).join('\n');
    navigator.clipboard.writeText(text).then(() => {
      setCopyLabel('Copied!');
      setTimeout(() => setCopyLabel('Copy Handoff'), 2000);
    });
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-[var(--bg)]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin" />
          <span className="text-[13px] text-[var(--text3)]">Loading...</span>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="h-full flex items-center justify-center">
        <button onClick={fetchHome} className="text-[13px] text-[var(--accent)]">Retry</button>
      </div>
    );
  }

  const hero = data.hero;
  const mounted = data.latest_handoff;

  // Build all steps for mounted handoff hero
  const heroSteps = mounted ? [
    ...Array.from({ length: mounted.sections_completed }, (_, i) => ({
      name: `Done ${i + 1}`,
      status: 'done',
    })),
    ...(mounted.sections_remaining || []),
  ] : [];

  function handleMount(handoff: Handoff) {
    patchHandoff(handoff.id, 'picked_up', { onSuccess: () => fetchHome() });
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[var(--bg)]">
      {/* Topbar */}
      <div className="flex items-center px-6 py-3 border-b border-[var(--border)] shrink-0 gap-3">
        <span className="text-[16px] font-semibold flex-1">Home</span>
        <TokenPill stats={data.token_stats} />
        <ColorLegend />
        <div className="w-[28px] h-[28px] rounded-full bg-[var(--accent)] flex items-center justify-center text-white text-[11px] font-semibold">R</div>
      </div>

      {/* Legend bar */}
      <div className="flex gap-2.5 px-6 py-2 border-b border-[var(--border)] shrink-0 flex-wrap items-center">
        <LegendItem color="var(--red)" label="P0" />
        <LegendItem color="var(--orange)" label="P1" />
        <LegendItem color="var(--yellow)" label="P2" />
        <div className="w-px h-3 bg-[var(--border)]" />
        <LegendItem color="var(--accent)" label="Code" />
        <LegendItem color="var(--green)" label="Chat" />
        <LegendItem color="var(--purple)" label="Cowork" />
      </div>

      {/* Content: Hero + 2x2 */}
      <div className={`flex-1 flex flex-col gap-4 min-h-0 ${isDesktop ? 'p-5 overflow-hidden' : 'p-3 overflow-y-auto'}`}>

        {/* Hero: Mounted handoff OR last session fallback */}
        {mounted ? (
          /* ── Mounted Handoff Hero ── */
          <div className="shrink-0 rounded-[16px] border border-[var(--accent)] bg-[var(--card)] shadow-lg"
               style={{ boxShadow: '0 0 0 1px var(--accent-dim), 0 2px 12px rgba(0,0,0,.3)' }}>
            <div className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.05em] text-[var(--accent)]">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  {mounted.status === 'picked_up' ? 'Mounted' : 'Active Handoff'}
                </div>
                {mounted.handoff_code && (
                  <span className="text-[9px] font-mono font-bold px-1.5 py-[1px] rounded-[4px] bg-[var(--accent-dim)] text-[var(--accent)]">
                    {mounted.handoff_code}
                  </span>
                )}
                <span className="text-[10px] text-[var(--text3)]">{mounted.project_key} &middot; {mounted.scope_type}</span>
              </div>
              <h2 className="text-[17px] font-bold mb-3 truncate">{mounted.scope_name}</h2>

              {/* Step tracker */}
              <div className="mb-3">
                <StepTracker steps={heroSteps} completed={mounted.sections_completed} />
              </div>

              {/* Notes */}
              {mounted.notes && (
                <p className="text-[12px] text-[var(--text3)] leading-[1.5] line-clamp-2 mb-3">{mounted.notes}</p>
              )}

              <div className="flex gap-1 flex-wrap">
                {mounted.entry_point && <Tag bg="var(--purple-dim)" color="var(--purple)">{mounted.entry_point}</Tag>}
                {mounted.version && <Tag bg="var(--accent-dim)" color="var(--accent)">{mounted.version}</Tag>}
                <Tag bg="var(--green-dim)" color="var(--green)">{mounted.sections_completed}/{mounted.sections_total}</Tag>
              </div>
            </div>
          </div>
        ) : hero ? (
          /* ── Session Fallback Hero ── */
          <div className="shrink-0 rounded-[16px] border border-[var(--accent)] bg-[var(--card)] shadow-lg"
               style={{ boxShadow: '0 0 0 1px var(--accent-dim), 0 2px 12px rgba(0,0,0,.3)' }}>
            <div className={`${isDesktop ? 'flex gap-5' : 'flex flex-col gap-3'} p-5`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.05em] text-[var(--accent)] mb-1.5">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                  Continue from last session
                </div>
                <h2 className="text-[17px] font-bold mb-1 truncate">{hero.title}</h2>
                <div className="flex items-center gap-2 text-[11px] text-[var(--text2)] mb-2 flex-wrap">
                  <span style={{ color: 'var(--accent)' }}>{hero.project_key}</span>
                  <span>&middot;</span>
                  <span>{hero.session_date}</span>
                  {hero.cost_usd && (
                    <>
                      <span>&middot;</span>
                      <span style={{ color: 'var(--green)' }}>
                        {fmtTokens((hero.input_tokens || 0) + (hero.output_tokens || 0))} &middot; ${Number(hero.cost_usd).toFixed(2)}
                      </span>
                    </>
                  )}
                </div>
                {hero.summary && (
                  <p className="text-[12px] text-[var(--text3)] leading-[1.5] line-clamp-2">{hero.summary}</p>
                )}
                <div className="flex gap-1 mt-2 flex-wrap">
                  {hero.surface && <Tag bg="var(--accent-dim)" color="var(--accent)">{hero.surface}</Tag>}
                  {hero.entry_point && <Tag bg="var(--purple-dim)" color="var(--purple)">{hero.entry_point}</Tag>}
                </div>
              </div>
              <div className={`flex ${isDesktop ? 'flex-col items-end justify-center' : 'flex-row items-center'} gap-2 shrink-0`}>
                <button onClick={handleCopyHandoff} className="px-4 py-2 rounded-[10px] bg-[var(--accent)] text-white text-[12px] font-semibold hover:opacity-90 transition-opacity">
                  {copyLabel}
                </button>
                <button onClick={() => setPopupSession(hero)} className="px-4 py-2 rounded-[10px] bg-[var(--accent-dim)] text-[var(--accent)] text-[12px] font-semibold hover:bg-[var(--accent)] hover:text-white transition-colors">
                  View Session &rarr;
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {/* 2x2 Grid: Handoffs TL, Sessions TR, Chains BL, Routine+System BR */}
        <div className={`flex-1 grid gap-3 min-h-0 ${isDesktop ? 'grid-cols-2 grid-rows-2 overflow-hidden' : 'grid-cols-1 auto-rows-min'}`}>
          {/* TL: Handoffs */}
          <SecCard
            icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>}
            iconBg="var(--orange-dim)" iconColor="var(--orange)"
            title="Handoffs" count={(data.open_handoffs || []).length}
            countColor="var(--orange)"
            footer={<button onClick={() => router.push('/handoffs')} className="text-[11px] font-semibold text-[var(--accent)] hover:opacity-80">All &rarr;</button>}
          >
            {(data.open_handoffs || []).length === 0 ? (
              <Empty>No open handoffs</Empty>
            ) : (
              (data.open_handoffs || []).slice(0, 3).map((h) => (
                <ListItem key={h.id}
                  dot={h.status === 'picked_up' ? 'var(--accent)' : 'var(--orange)'}
                  title={h.scope_name}
                  sub={<>{h.handoff_code} <span>&middot;</span> {h.project_key} <span>&middot;</span> {h.sections_completed}/{h.sections_total}</>}
                  right={h.status === 'open' ? (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleMount(h); }}
                      className="text-[9px] font-bold px-2 py-0.5 rounded-[4px] bg-[var(--accent)] text-white hover:opacity-80 transition-opacity"
                    >
                      Mount
                    </button>
                  ) : (
                    <Tag bg="var(--accent-dim)" color="var(--accent)">Mounted</Tag>
                  )}
                />
              ))
            )}
          </SecCard>

          {/* TR: Recent Sessions */}
          <SecCard
            icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>}
            iconBg="var(--green-dim)" iconColor="var(--green)"
            title="Recent Sessions" count={data.recent_sessions.length + (data.hero ? 1 : 0)}
            footer={<button onClick={() => router.push('/dashboard')} className="text-[11px] font-semibold text-[var(--accent)] hover:opacity-80">All &rarr;</button>}
          >
            <ExpandableList items={data.recent_sessions} max={3} emptyMsg="No recent sessions" renderItem={(s) => (
              <ListItem key={s.id}
                dot={SURFACE_COLORS[s.surface || ''] || 'var(--text3)'}
                title={s.title}
                sub={<>{s.session_date} <span>&middot;</span> {s.project_key}{s.input_tokens ? <> <span>&middot;</span> <span style={{ color: 'var(--accent)' }}>{fmtTokens(s.input_tokens)}</span></> : null}</>}
                onClick={() => setPopupSession(s)}
              />
            )} />
          </SecCard>

          {/* BL: Active Chains */}
          <SecCard
            icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>}
            iconBg="var(--purple-dim)" iconColor="var(--purple)"
            title="Active Chains" count={data.chains.length}
            countColor="var(--purple)"
          >
            {data.chains.slice(0, 3).map((c) => (
              <ListItem key={c.chain_id} dot={c.session_count > 2 ? 'var(--accent)' : 'var(--orange)'}
                title={c.chain_id}
                sub={<>{c.latest_title} <span>&middot;</span> <span style={{ color: 'var(--green)' }}>${c.total_cost.toFixed(2)}</span></>}
                right={<Tag bg="var(--accent-dim)" color="var(--accent)">{c.session_count}/??</Tag>}
                onClick={() => setPopupChain(c)}
              />
            ))}
            {data.chains.length === 0 && <Empty>No active chains</Empty>}
          </SecCard>

          {/* BR: Routine + System */}
          <SecCard
            icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>}
            iconBg={data.system.health === 'healthy' ? 'var(--green-dim)' : 'var(--red-dim)'}
            iconColor={data.system.health === 'healthy' ? 'var(--green)' : 'var(--red)'}
            title="Routine & System"
            count={data.routine.length + data.system.error_count}
            countColor={data.system.error_count > 0 ? 'var(--red)' : 'var(--text)'}
            onHeaderClick={() => setShowSystemPopup(true)}
          >
            {/* System health badge */}
            <div className="flex items-center gap-2 mb-2">
              <span className="w-[7px] h-[7px] rounded-full" style={{ background: data.system.health === 'healthy' ? 'var(--green)' : 'var(--red)' }} />
              <span className="text-[12px] font-semibold" style={{ color: data.system.health === 'healthy' ? 'var(--green)' : 'var(--red)' }}>
                {data.system.health === 'healthy' ? 'All systems healthy' : `${data.system.error_count} error(s)`}
              </span>
            </div>
            {/* Routine tasks */}
            {data.routine.slice(0, 2).map((t) => (
              <ListItem key={t.id}
                dot={t.priority === 'P0' ? 'var(--red)' : t.priority === 'P1' ? 'var(--orange)' : 'var(--cyan)'}
                title={t.text}
                sub={<>{t.project_key}{t.mission ? <> <span>&middot;</span> {t.mission}</> : null}</>}
              />
            ))}
            {/* Recent hooks */}
            {data.system.recent_hooks.slice(0, 2).map((h, i) => (
              <ListItem key={`hook-${i}`}
                dot={h.status === 'error' ? 'var(--red)' : 'var(--green)'}
                title={h.hook_name}
                sub={<>{h.detail || h.action} <span>&middot;</span> {timeAgo(h.created_at)}</>}
              />
            ))}
          </SecCard>
        </div>
      </div>

      {/* Popup Layer */}
      <SessionPopup session={popupSession} open={!!popupSession} onClose={() => setPopupSession(null)} />
      <ChainPopup chain={popupChain} open={!!popupChain} onClose={() => setPopupChain(null)} />
      <SystemPopup system={showSystemPopup ? data.system : null} open={showSystemPopup} onClose={() => setShowSystemPopup(false)} />
    </div>
  );
}

/* ── Subcomponents ── */

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1">
      <span className="w-[6px] h-[6px] rounded-full" style={{ background: color }} />
      <span className="text-[9px] font-semibold text-[var(--text3)] uppercase tracking-[0.03em]">{label}</span>
    </div>
  );
}

function Tag({ bg, color, children }: { bg: string; color: string; children: React.ReactNode }) {
  return (
    <span className="text-[9px] font-semibold px-1.5 py-[1px] rounded-[4px]" style={{ background: bg, color }}>
      {children}
    </span>
  );
}

function SecCard({ icon, iconBg, iconColor, title, count, countColor, footer, onHeaderClick, children }: {
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  title: string;
  count: number;
  countColor?: string;
  footer?: React.ReactNode;
  onHeaderClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col rounded-[16px] bg-[var(--card)] shadow-lg overflow-hidden">
      <div className={`flex items-center gap-2.5 px-4 pt-3.5 pb-0 ${onHeaderClick ? 'cursor-pointer hover:bg-[var(--card2)] rounded-t-[16px] transition-colors' : ''}`} onClick={onHeaderClick}>
        <div className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0" style={{ background: iconBg, color: iconColor }}>
          {icon}
        </div>
        <span className="text-[13px] font-semibold flex-1">{title}</span>
        <span className="text-[20px] font-bold tabular-nums" style={{ color: countColor || 'var(--text)' }}>{count}</span>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-2 min-h-0">
        {children}
      </div>
      {footer && (
        <div className="flex items-center justify-between px-4 pb-3 shrink-0">
          {footer}
        </div>
      )}
    </div>
  );
}

function ListItem({ dot, title, sub, right, onClick }: {
  dot: string;
  title: string;
  sub: React.ReactNode;
  right?: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <div className={`flex items-center gap-2.5 py-2 border-b border-[var(--border)] last:border-b-0 ${onClick ? 'cursor-pointer hover:bg-[var(--card2)] -mx-1 px-1 rounded-[6px]' : ''}`} onClick={onClick}>
      <span className="w-[8px] h-[8px] rounded-full shrink-0" style={{ background: dot }} />
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-medium truncate">{title}</p>
        <p className="text-[10px] text-[var(--text3)] mt-0.5 flex items-center gap-1">{sub}</p>
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] text-[var(--text3)] py-2">{children}</p>;
}

function ExpandableList<T>({ items, max, emptyMsg, renderItem }: {
  items: T[];
  max: number;
  emptyMsg: string;
  renderItem: (item: T, index: number) => React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  if (items.length === 0) return <Empty>{emptyMsg}</Empty>;
  const visible = expanded ? items : items.slice(0, max);
  const remaining = items.length - max;
  return (
    <>
      {visible.map((item, i) => renderItem(item, i))}
      {remaining > 0 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-[10px] font-semibold text-[var(--accent)] pt-1 hover:opacity-80"
        >
          <span className="inline-block transition-transform" style={{ transform: expanded ? 'rotate(180deg)' : 'none', fontSize: 8 }}>&#x25BC;</span>
          {expanded ? 'Show less' : `Show ${remaining} more`}
        </button>
      )}
    </>
  );
}
