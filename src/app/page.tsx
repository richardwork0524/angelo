'use client';

import { useEffect, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { cachedFetch, invalidateCache, cacheSubscribe } from '@/lib/cache';
import { patchHandoff, patchTask, deleteTask, addSubtask } from '@/lib/mutate';
import { StatusBadge } from '@/components/status-badge';
import { TierLabel } from '@/components/hero-card';
import { HandoffPopup } from '@/components/popups/handoff-popup';
import type { Handoff } from '@/lib/types';
import type { DetailTask } from '@/components/task/task-detail';

const TaskDetail = dynamic(() => import('@/components/task/task-detail').then((m) => ({ default: m.TaskDetail })), { ssr: false });

const DAILY_COST_CAP = 6;

interface MountedHandoffRef {
  id: string;
  handoff_code: string | null;
  scope_name: string;
  project_key: string;
  is_mounted: boolean;
}

interface ActiveSession {
  id: string;
  session_code: string;
  project_key: string;
  mounted_handoff_id: string | null;
  surface: 'CODE' | 'CHAT' | 'COWORK';
  started_at: string;
  last_turn_at: string;
  turn_count: number;
  input_tokens_so_far: number;
  output_tokens_so_far: number;
  cost_usd_so_far: number;
  title: string | null;
  mounted_handoff: MountedHandoffRef | null;
}

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
  active_session: ActiveSession[];
}

interface TopTask {
  id: string;
  text: string;
  description: string | null;
  priority: string | null;
  project_key: string;
  bucket: string;
  mission: string | null;
  surface: string | null;
  task_code: string | null;
  is_owner_action: boolean | null;
  progress: string | null;
  version: string | null;
  log: { timestamp: string; type: string; message: string }[] | null;
  updated_at: string;
  created_at?: string;
  completed: boolean;
}

interface TasksApiResponse {
  tasks: TopTask[];
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

function splitScopeName(name: string): { main: string; sub: string | null } {
  const idx = name.search(/ [—–-]{1,2} /);
  if (idx === -1) return { main: name, sub: null };
  return { main: name.slice(0, idx), sub: name.slice(idx).replace(/^ [—–-]{1,2} /, '') };
}

export default function HomePage() {
  const router = useRouter();
  const [data, setData] = useState<HomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [topTasks, setTopTasks] = useState<TopTask[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [selectedHandoff, setSelectedHandoff] = useState<Handoff | null>(null);
  const [detailTask, setDetailTask] = useState<TopTask | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  const fetchHome = useCallback(async () => {
    try {
      const d = await cachedFetch<HomeData>('/api/home', 15000);
      setData(d);
    } catch {
      setData(null);
    }
    setLoading(false);
  }, []);

  // Fetch open tasks for latest-tasks section (sorted by created_at client-side)
  const fetchTopTasks = useCallback(async () => {
    try {
      const d = await cachedFetch<TasksApiResponse>('/api/tasks?completed=false', 30000);
      const tasks = (d?.tasks || []).filter((t) => !t.completed);
      setTopTasks(tasks);
    } catch {
      setTopTasks([]);
    }
  }, []);

  useEffect(() => { fetchHome(); fetchTopTasks(); }, [fetchHome, fetchTopTasks]);

  // React to /api/tasks cache invalidations (realtime + local mutations)
  useEffect(() => {
    return cacheSubscribe('/api/tasks?completed=false', () => {
      setTimeout(() => fetchTopTasks(), 50);
    });
  }, [fetchTopTasks]);

  // Task mutation helpers for the detail modal
  const taskSyncOpts = (msg: string) => ({
    onSuccess: () => { showToast(msg); fetchTopTasks(); },
    onError: () => { showToast('Sync failed'); fetchTopTasks(); },
  });

  function handleTaskUpdate(taskId: string, fields: Record<string, unknown>) {
    setTopTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, ...fields } as TopTask : t));
    setDetailTask((prev) => prev && prev.id === taskId ? { ...prev, ...fields } as TopTask : prev);
    const task = topTasks.find((t) => t.id === taskId);
    patchTask(taskId, task?.project_key || '', fields, taskSyncOpts('Updated'));
  }

  function handleTaskDelete(taskId: string) {
    setTopTasks((prev) => prev.filter((t) => t.id !== taskId));
    setDetailTask(null);
    const task = topTasks.find((t) => t.id === taskId);
    deleteTask(taskId, task?.project_key || '', taskSyncOpts('Task deleted'));
  }

  function handleAddSubtask(parentId: string, text: string) {
    const parent = topTasks.find((t) => t.id === parentId);
    if (!parent) return;
    addSubtask(parent.project_key, parentId, text, parent.bucket, taskSyncOpts('Subtask added'));
  }

  // Global RealtimeProvider handles Supabase subscriptions.
  // React to /api/home cache invalidations (from realtime or local mutations).
  useEffect(() => {
    return cacheSubscribe('/api/home', () => {
      setTimeout(() => fetchHome(), 50);
    });
  }, [fetchHome]);

  const mounted = data?.mounted_handoffs?.[0] || null;
  const recent = (data?.recent_handoffs || []).filter((h) => h.id !== mounted?.id).slice(0, 4);

  function handleUnmount() {
    if (!mounted) return;
    // Optimistic: clear from local home data immediately, show toast
    setData((prev) => prev ? { ...prev, mounted_handoffs: [] } : prev);
    showToast('Handoff unmounted');
    // patchHandoff (full-object form) handles cache-level optimism on /api/handoffs
    patchHandoff(mounted, { is_mounted: false }, {
      onSuccess: () => {
        invalidateCache(`/api/handoff/${mounted.id}`);
        window.dispatchEvent(new Event('handoffs-changed'));
        fetchHome();
      },
      onError: () => {
        // Restore local home state on failure
        setData((prev) => prev ? { ...prev, mounted_handoffs: [mounted] } : prev);
        showToast('Failed to unmount handoff');
      },
    });
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
    <div className="h-full overflow-y-auto" style={{ overscrollBehaviorY: 'contain', overflowX: 'hidden' }}>
      <div className="max-w-[1280px] mx-auto px-4 md:px-8 py-5 md:py-7 pb-8">
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

        {/* ═══ HERO ROW — Current Handoff + Active Session (side by side) ═══ */}
        <TierLabel>HERO · CURRENT HANDOFF + ACTIVE SESSION</TierLabel>
        <div className="grid gap-4 mb-6 grid-cols-1 md:grid-cols-2">
          {/* Current Handoff tile */}
          {mounted ? (
            <CompactHandoffTile
              handoff={mounted}
              onUnmount={handleUnmount}
              onOpenDetail={() => router.push(`/handoff/${mounted.id}`)}
            />
          ) : (
            <CompactEmptyHandoffTile onBrowse={() => router.push('/handoffs')} />
          )}

          {/* Active Session tile */}
          {(data.active_session?.length ?? 0) > 0 ? (
            <CompactActiveSessionTile session={data.active_session[0]} />
          ) : (
            <CompactEmptyActiveSessionTile />
          )}
        </div>

        {/* ═══ SUB — Latest Tasks: Featured (65%) + Chronological list (35%) ═══ */}
        <TierLabel>SUB · LATEST TASKS</TierLabel>
        {(() => {
          const openTasks = [...topTasks].sort((a, b) =>
            ((b.created_at || b.updated_at) || '').localeCompare((a.created_at || a.updated_at) || '')
          );
          const featured = openTasks[0] || null;
          const rest = openTasks.slice(1, 8);
          if (!featured) {
            return (
              <div
                className="text-center mb-6"
                style={{
                  padding: '48px 24px',
                  background: 'var(--card)',
                  border: '1px dashed var(--border)',
                  borderRadius: 'var(--r)',
                  color: 'var(--text3)',
                  fontSize: 'var(--t-sm)',
                }}
              >
                No open tasks — <button onClick={() => router.push('/tasks')} style={{ color: 'var(--primary-2)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 'inherit', fontWeight: 500 }}>add one →</button>
              </div>
            );
          }
          return (
            <div className="grid gap-4 mb-6 grid-cols-1 md:[grid-template-columns:minmax(0,2fr)_minmax(0,1fr)]">
              <FeaturedTaskTile task={featured} onOpen={() => setDetailTask(featured)} />
              <RecentTasksList
                tasks={rest}
                totalOpen={openTasks.length}
                onOpen={(t) => setDetailTask(t)}
                onSeeAll={() => router.push('/tasks')}
              />
            </div>
          );
        })()}

        {/* TERTIARY — Recent Handoffs + Today's Pulse */}
        <div className="grid gap-6 mt-6 grid-cols-1 md:[grid-template-columns:minmax(0,1.5fr)_minmax(280px,1fr)]">
          {/* Recent Handoffs */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <div>
                <TierLabel>TERTIARY · RECENT HANDOFFS</TierLabel>
                <h2 className="font-semibold" style={{ fontSize: 'var(--t-h3)' }}>
                  Recent Handoffs
                  <span className="ml-2 font-normal" style={{ color: 'var(--text3)', fontSize: 'var(--t-sm)' }}>
                    · last 7 days
                  </span>
                </h2>
              </div>
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
                  <HandoffRow key={h.id} handoff={h} onClick={() => setSelectedHandoff(h)} />
                ))}
              </div>
            )}
          </section>

          {/* Today's Pulse */}
          <section>
            <TierLabel>TERTIARY · TODAY&apos;S PULSE</TierLabel>
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

      {/* Toast */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: 80,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r)',
            padding: '8px 16px',
            fontSize: 'var(--t-sm)',
            color: 'var(--text)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            zIndex: 1000,
            whiteSpace: 'nowrap',
          }}
        >
          {toast}
        </div>
      )}

      {/* Handoff popup — opened by clicking a recent handoff row */}
      <HandoffPopup
        handoff={selectedHandoff}
        open={selectedHandoff !== null}
        onClose={() => setSelectedHandoff(null)}
        onUpdate={fetchHome}
      />

      {/* Task detail modal — opened by clicking featured task or a row */}
      {detailTask && (
        <TaskDetail
          task={detailTask as unknown as DetailTask}
          subtasks={[]}
          onClose={() => { setDetailTask(null); fetchTopTasks(); }}
          onUpdate={handleTaskUpdate}
          onDelete={handleTaskDelete}
          onAddSubtask={async (parentId, text) => handleAddSubtask(parentId, text)}
        />
      )}
    </div>
  );
}

/* ── Shared helpers ── */

const SURFACE_COLORS: Record<string, string> = {
  CODE: '#6366F1',
  CHAT: '#16A34A',
  COWORK: '#F59E0B',
};

const PRI_HEX: Record<string, string> = {
  P0: '#EF4444',
  P1: '#F59E0B',
  P2: '#6366F1',
};


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


/* ── HERO tile: Current Handoff (compact, paired with Active Session) ── */

function CompactHandoffTile({
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
  const { main, sub } = splitScopeName(handoff.scope_name);

  return (
    <div
      className="relative overflow-hidden flex flex-col gap-2 p-5"
      style={{
        background: 'linear-gradient(135deg, rgba(99,102,241,.10) 0%, rgba(99,102,241,.02) 60%), var(--card)',
        border: '1px solid var(--primary-hi)',
        borderRadius: 'var(--r-lg)',
        minHeight: 168,
      }}
    >
      <span style={{ position: 'absolute', top: 0, left: 0, width: 3, height: '100%', background: 'linear-gradient(180deg, var(--primary), var(--primary-2))' }} />

      <div className="flex items-center gap-2" style={{ fontSize: 'var(--t-tiny)', color: 'var(--primary-2)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 600 }}>
        <span className="angelo-pulse" style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--primary)' }} />
        Mounted Handoff
        {handoff.handoff_code && (
          <span style={{ marginLeft: 'auto', fontFamily: 'ui-monospace, monospace', color: 'var(--text3)', letterSpacing: 0, textTransform: 'none' }}>
            {handoff.handoff_code}
          </span>
        )}
      </div>

      <button onClick={onOpenDetail} className="text-left" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
        <div style={{ fontSize: 'var(--t-h3)', fontWeight: 600, letterSpacing: '-.01em', lineHeight: 1.3, color: 'var(--text)' }} className="line-clamp-2">
          {main}
        </div>
        {sub && (
          <div style={{ fontSize: 'var(--t-sm)', color: 'var(--text2)', marginTop: 2 }} className="line-clamp-1">
            {sub}
          </div>
        )}
      </button>

      <div className="flex items-center gap-1.5 flex-wrap" style={{ fontSize: 'var(--t-tiny)', color: 'var(--text3)' }}>
        <span style={{ color: 'var(--text2)', fontWeight: 500 }}>{handoff.project_key}</span>
        <span style={{ color: 'var(--text4)' }}>·</span>
        <StatusBadge status={handoff.status} />
        <span style={{ color: 'var(--text4)' }}>·</span>
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{handoff.sections_completed}/{handoff.sections_total} · {progress}%</span>
      </div>

      <div style={{ height: 4, borderRadius: 999, background: 'var(--card-alt)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg, var(--primary), var(--primary-2))', transition: 'width .3s ease' }} />
      </div>

      <div className="flex items-center gap-2 mt-auto pt-1">
        <button
          onClick={onOpenDetail}
          className="transition-opacity hover:opacity-90"
          style={{ padding: '6px 12px', background: 'var(--primary)', color: '#fff', border: '1px solid var(--primary)', borderRadius: 'var(--r-sm)', fontSize: 'var(--t-sm)', fontWeight: 500 }}
        >
          Open →
        </button>
        <button
          onClick={onUnmount}
          className="transition-colors"
          style={{ padding: '6px 12px', background: 'transparent', color: 'var(--text3)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', fontSize: 'var(--t-sm)', fontWeight: 500 }}
        >
          ⌀ Unmount
        </button>
      </div>
    </div>
  );
}

function CompactEmptyHandoffTile({ onBrowse }: { onBrowse: () => void }) {
  return (
    <div className="flex flex-col gap-2 p-5" style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', minHeight: 168 }}>
      <div style={{ fontSize: 'var(--t-tiny)', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 600 }}>
        Mounted Handoff
      </div>
      <div style={{ fontSize: 'var(--t-h3)', fontWeight: 600, color: 'var(--text)' }}>Queue is clear.</div>
      <p style={{ color: 'var(--text2)', fontSize: 'var(--t-sm)', lineHeight: 1.55 }}>
        No handoff mounted. Pick one to set the active context.
      </p>
      <button
        onClick={onBrowse}
        className="transition-opacity hover:opacity-90 mt-auto self-start"
        style={{ padding: '6px 12px', background: 'var(--primary)', color: '#fff', border: '1px solid var(--primary)', borderRadius: 'var(--r-sm)', fontSize: 'var(--t-sm)', fontWeight: 500 }}
      >
        Browse Handoffs →
      </button>
    </div>
  );
}

/* ── HERO tile: Active Session (compact, paired with Handoff) ── */

function CompactActiveSessionTile({ session }: { session: ActiveSession }) {
  const startMins = Math.floor((Date.now() - new Date(session.started_at).getTime()) / 60000);
  const startLabel = startMins < 1 ? 'just now' : startMins < 60 ? `${startMins}m ago` : `${Math.floor(startMins / 60)}h ago`;
  const surfaceColor = SURFACE_COLORS[session.surface] || 'var(--primary)';

  return (
    <div className="relative overflow-hidden flex flex-col gap-2 p-5" style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', borderLeft: `3px solid ${surfaceColor}`, minHeight: 168 }}>
      <div className="flex items-center gap-2" style={{ fontSize: 'var(--t-tiny)', color: surfaceColor, textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 600 }}>
        <span className="angelo-pulse" style={{ width: 6, height: 6, borderRadius: '50%', background: surfaceColor }} />
        Live · {session.surface}
        <span style={{ marginLeft: 'auto', color: 'var(--text3)', letterSpacing: 0, textTransform: 'none' }}>{startLabel}</span>
      </div>

      <div style={{ fontSize: 'var(--t-h3)', fontWeight: 600, letterSpacing: '-.01em', color: 'var(--text)', lineHeight: 1.3 }} className="line-clamp-2">
        {session.title || `${session.project_key} session`}
      </div>

      <div className="flex items-center gap-1.5 flex-wrap" style={{ fontSize: 'var(--t-tiny)', color: 'var(--text3)' }}>
        <span style={{ color: 'var(--text2)', fontWeight: 500 }}>{session.project_key}</span>
        <span style={{ color: 'var(--text4)' }}>·</span>
        <span>{session.turn_count} {session.turn_count === 1 ? 'turn' : 'turns'}</span>
        <span style={{ color: 'var(--text4)' }}>·</span>
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>
          {session.input_tokens_so_far.toLocaleString()} in / {session.output_tokens_so_far.toLocaleString()} out
        </span>
        {session.cost_usd_so_far > 0 && (
          <>
            <span style={{ color: 'var(--text4)' }}>·</span>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>${Number(session.cost_usd_so_far).toFixed(2)}</span>
          </>
        )}
      </div>

      {session.mounted_handoff && (
        <Link
          href={`/handoff/${session.mounted_handoff.id}`}
          style={{ padding: '3px 10px', borderRadius: 12, background: 'var(--primary-dim)', color: 'var(--primary-2)', fontSize: 'var(--t-tiny)', fontWeight: 600, whiteSpace: 'nowrap', textDecoration: 'none', alignSelf: 'flex-start' }}
        >
          mounted: {session.mounted_handoff.scope_name}
        </Link>
      )}
    </div>
  );
}

function CompactEmptyActiveSessionTile() {
  return (
    <div className="flex flex-col gap-2 p-5" style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', minHeight: 168 }}>
      <div style={{ fontSize: 'var(--t-tiny)', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 600 }}>
        Active Session
      </div>
      <div style={{ fontSize: 'var(--t-h3)', fontWeight: 600, color: 'var(--text)' }}>No live session.</div>
      <p style={{ color: 'var(--text2)', fontSize: 'var(--t-sm)', lineHeight: 1.55 }}>
        When a Claude session starts, it appears here with live token and turn counts.
      </p>
    </div>
  );
}

/* ── SUB tile: Featured latest task (title + summary) ── */

function FeaturedTaskTile({ task, onOpen }: { task: TopTask; onOpen: () => void }) {
  const accent = PRI_HEX[task.priority || 'P2'] ?? '#6366F1';
  const surfaceColor = task.surface ? SURFACE_COLORS[task.surface] : null;
  const ts = task.created_at || task.updated_at;
  const ageMs = Date.now() - new Date(ts).getTime();
  const ageH = Math.floor(ageMs / 3_600_000);
  const ageLabel = ageH < 1 ? 'just added' : ageH < 24 ? `${ageH}h ago` : `${Math.floor(ageH / 24)}d ago`;

  return (
    <button
      onClick={onOpen}
      className="relative overflow-hidden flex flex-col gap-3 p-5 text-left transition-all hover:-translate-y-[1px]"
      style={{ background: `linear-gradient(140deg, ${accent}14 0%, ${accent}03 60%), var(--card)`, border: `1px solid ${accent}59`, borderRadius: 'var(--r-lg)', minHeight: 188 }}
    >
      <div className="flex items-center gap-2 flex-wrap">
        {task.priority && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px 3px 5px', borderRadius: 6, background: 'var(--card)', border: '1px solid var(--border)', fontSize: 11, fontWeight: 700, color: accent }}>
            <span style={{ width: 4, height: 14, borderRadius: 2, background: accent, display: 'inline-block' }} />
            {task.priority}
          </span>
        )}
        {task.task_code && (
          <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, color: 'var(--primary-2)', fontWeight: 600 }}>{task.task_code}</span>
        )}
        <span style={{ fontSize: 11, color: 'var(--text2)', fontWeight: 500 }}>{task.project_key}</span>
        {task.mission && (
          <>
            <span style={{ color: 'var(--text4)' }}>›</span>
            <span style={{ fontSize: 11, color: 'var(--primary-2)' }} className="truncate max-w-[200px]">{task.mission}</span>
          </>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text3)' }}>{ageLabel}</span>
      </div>

      <div style={{ fontSize: 'var(--t-h3)', fontWeight: 600, letterSpacing: '-.01em', color: 'var(--text)', lineHeight: 1.3 }} className="line-clamp-2">
        {task.text}
      </div>

      {task.description && (
        <p style={{ fontSize: 'var(--t-sm)', color: 'var(--text2)', lineHeight: 1.55 }} className="line-clamp-3">
          {task.description}
        </p>
      )}

      <div className="flex items-center gap-2 mt-auto" style={{ fontSize: 'var(--t-tiny)', color: 'var(--text3)' }}>
        {surfaceColor && (
          <span className="inline-flex items-center gap-1">
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: surfaceColor }} />
            <span style={{ fontWeight: 600 }}>{task.surface}</span>
          </span>
        )}
        {task.progress && (
          <>
            <span style={{ color: 'var(--text4)' }}>·</span>
            <span style={{ color: 'var(--primary-2)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{task.progress}</span>
          </>
        )}
        {task.is_owner_action && (
          <>
            <span style={{ color: 'var(--text4)' }}>·</span>
            <span style={{ color: 'var(--primary-2)', fontWeight: 700 }}>YOU</span>
          </>
        )}
        <span style={{ marginLeft: 'auto', color: 'var(--primary-2)', fontWeight: 600 }}>Open detail →</span>
      </div>
    </button>
  );
}

/* ── SUB tile: Recent tasks list (chronological, titles only) ── */

function RecentTasksList({
  tasks,
  totalOpen,
  onOpen,
  onSeeAll,
}: {
  tasks: TopTask[];
  totalOpen: number;
  onOpen: (t: TopTask) => void;
  onSeeAll: () => void;
}) {
  return (
    <div className="flex flex-col overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', minHeight: 188 }}>
      <div className="flex items-center justify-between px-4 py-2.5 border-b" style={{ borderColor: 'var(--border)' }}>
        <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--text3)' }}>
          Recently Added
        </span>
        <span style={{ fontSize: 11, color: 'var(--text3)', fontVariantNumeric: 'tabular-nums' }}>{totalOpen} open</span>
      </div>
      {tasks.length === 0 ? (
        <div className="flex-1 flex items-center justify-center p-4" style={{ fontSize: 'var(--t-sm)', color: 'var(--text3)', fontStyle: 'italic' }}>
          Just the one above.
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {tasks.map((t, i) => {
            const accent = PRI_HEX[t.priority || 'P2'] ?? 'var(--text4)';
            return (
              <button
                key={t.id}
                onClick={() => onOpen(t)}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-left transition-colors hover:bg-[var(--card-alt)]"
                style={{ borderTop: i === 0 ? 'none' : '1px solid var(--border)' }}
              >
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: accent, flexShrink: 0 }} />
                <span className="flex-1 truncate" style={{ fontSize: 'var(--t-sm)', color: 'var(--text2)' }}>
                  {t.task_code && <span style={{ fontFamily: 'ui-monospace, monospace', color: 'var(--primary-2)', marginRight: 6, fontWeight: 600 }}>{t.task_code}</span>}
                  {t.text}
                </span>
              </button>
            );
          })}
        </div>
      )}
      <button
        onClick={onSeeAll}
        className="px-4 py-2 border-t text-center transition-colors hover:bg-[var(--card-alt)]"
        style={{ fontSize: 11, color: 'var(--primary-2)', fontWeight: 600, borderColor: 'var(--border)' }}
      >
        View all tasks →
      </button>
    </div>
  );
}
