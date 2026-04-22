'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { HandoffCard, purposeFromEntry, PurposeChip } from '@/components/handoff-card';
import type { HandoffPurpose } from '@/lib/types';
import { cachedFetch, cacheSubscribe } from '@/lib/cache';
import { useToast } from '@/components/toast';
import type { Handoff } from '@/lib/types';

type StatusFilter = 'all' | 'active' | 'mounted' | 'done' | 'blocked';
type PurposeFilter = 'all' | HandoffPurpose;

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: 'active',  label: 'Active' },
  { key: 'mounted', label: 'Mounted' },
  { key: 'done',    label: 'Done' },
  { key: 'blocked', label: 'Blocked' },
  { key: 'all',     label: 'All' },
];

const PURPOSE_TABS: { key: HandoffPurpose; label: string }[] = [
  { key: 'create', label: 'CREATE' },
  { key: 'debug',  label: 'DEBUG' },
  { key: 'update', label: 'UPDATE' },
];

function isActive(h: Handoff): boolean {
  return h.status === 'open' || h.status === 'picked_up';
}
function isMounted(h: Handoff): boolean {
  return h.is_mounted === true;
}
function isDone(h: Handoff): boolean {
  return h.status === 'completed';
}
function isBlocked(h: Handoff): boolean {
  return h.status === 'blocked';
}
function purposeOf(h: Handoff): HandoffPurpose {
  return h.purpose ?? purposeFromEntry(h.entry_point);
}

export default function HandoffsPage() {
  const [handoffs, setHandoffs] = useState<Handoff[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');
  const [purposeFilter, setPurposeFilter] = useState<PurposeFilter>('all');
  const [search, setSearch] = useState('');
  const { showToast, ToastContainer } = useToast();

  const fetchHandoffs = useCallback(async (skipCache = false) => {
    try {
      const data: { handoffs: Handoff[]; total: number } = skipCache
        ? await fetch('/api/handoffs').then((r) => r.json())
        : await cachedFetch('/api/handoffs', 15000);
      setHandoffs(data.handoffs);
      setTotal(data.total);
    } catch {
      // silent
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchHandoffs();
  }, [fetchHandoffs]);

  // Global RealtimeProvider handles Supabase subscriptions.
  // React to /api/handoffs cache invalidations (realtime upsert/remove + local mutations).
  useEffect(() => {
    return cacheSubscribe('/api/handoffs', () => {
      // Small delay to let cache settle before refetching
      setTimeout(() => fetchHandoffs(true), 50);
    });
  }, [fetchHandoffs]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return handoffs.filter((h) => {
      if (statusFilter === 'active'  && !isActive(h))  return false;
      if (statusFilter === 'mounted' && !isMounted(h)) return false;
      if (statusFilter === 'done'    && !isDone(h))    return false;
      if (statusFilter === 'blocked' && !isBlocked(h)) return false;
      if (purposeFilter !== 'all' && purposeOf(h) !== purposeFilter) return false;
      if (q) {
        const hay = [
          h.scope_name, h.project_key, h.handoff_code, h.id,
          h.entry_point, h.scope_type, h.notes, h.vault_path,
        ].filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [handoffs, statusFilter, purposeFilter, search]);

  const counts = useMemo(() => {
    const mountedCount = handoffs.filter(isMounted).length;
    const activeCount  = handoffs.filter(isActive).length;
    const sevenDaysAgo = Date.now() - 7 * 86400000;
    const weekCount = handoffs.filter((h) => h.updated_at && new Date(h.updated_at).getTime() >= sevenDaysAgo).length;
    return { total, mountedCount, activeCount, weekCount };
  }, [handoffs, total]);

  function handleAddHandoff() {
    showToast('Handoffs are generated in Claude Code (vault → Supabase)', 'info');
  }
  function handleExport() {
    const rows = [
      ['handoff_code','project_key','scope_type','scope_name','entry_point','status','version','sections_completed','sections_total','updated_at','vault_path'],
      ...filtered.map((h) => [
        h.handoff_code ?? '',
        h.project_key,
        h.scope_type,
        h.scope_name.replace(/"/g, '""'),
        h.entry_point ?? '',
        h.status,
        h.version ?? '',
        String(h.sections_completed),
        String(h.sections_total),
        h.updated_at ?? '',
        h.vault_path ?? '',
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => /[,"\n]/.test(c) ? `"${c}"` : c).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `handoffs-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Exported ${filtered.length} handoffs`);
  }

  return (
    <div className="h-full overflow-y-auto" data-testid="handoffs-page">
      <div className="max-w-[1280px] mx-auto px-4 md:px-8 py-5 md:py-7" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Hero head */}
        <div
          style={{
            padding: '20px 22px',
            background: 'linear-gradient(135deg, var(--primary-dim) 0%, transparent 70%)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r-lg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 'var(--t-tiny)',
                color: 'var(--text3)',
                textTransform: 'uppercase',
                letterSpacing: '.08em',
                marginBottom: 8,
                fontWeight: 600,
              }}
            >
              Handoffs
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
              <span
                style={{
                  fontSize: 42,
                  fontWeight: 700,
                  color: counts.activeCount === 0 ? 'var(--text3)' : 'var(--primary-2)',
                  fontVariantNumeric: 'tabular-nums',
                  lineHeight: 1,
                }}
              >
                {counts.activeCount}
              </span>
              <span style={{ fontSize: 'var(--t-body)', color: 'var(--text2)' }}>
                active {counts.activeCount === 1 ? 'handoff' : 'handoffs'}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 10, fontSize: 'var(--t-sm)', color: 'var(--text3)', flexWrap: 'wrap' }}>
              <span>{counts.mountedCount} mounted</span>
              <span style={{ color: 'var(--text4)' }}>·</span>
              <span>{counts.total} total</span>
              <span style={{ color: 'var(--text4)' }}>·</span>
              <span>{counts.weekCount} updated this week</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button
              onClick={handleExport}
              className="transition-colors"
              style={{
                padding: '8px 16px',
                background: 'var(--card)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--r-sm)',
                fontSize: 'var(--t-sm)',
                color: 'var(--text2)',
                fontWeight: 500,
              }}
            >
              Export
            </button>
            <button
              onClick={handleAddHandoff}
              className="transition-opacity hover:opacity-90"
              style={{
                padding: '8px 16px',
                background: 'var(--primary)',
                border: '1px solid var(--primary)',
                borderRadius: 'var(--r-sm)',
                fontSize: 'var(--t-sm)',
                color: '#fff',
                fontWeight: 500,
                boxShadow: '0 2px 8px rgba(99,102,241,.28)',
              }}
            >
              ＋ Handoff
            </button>
          </div>
        </div>

        {/* Filter bar */}
        <div
          className="flex items-center gap-2 flex-wrap"
          style={{
            padding: '10px 12px',
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r)',
          }}
        >
          <div className="flex gap-1 flex-wrap items-center">
            {STATUS_TABS.map((t) => (
              <FilterTab
                key={t.key}
                active={statusFilter === t.key}
                onClick={() => setStatusFilter(t.key)}
              >
                {t.label}
              </FilterTab>
            ))}

            <span style={{ width: 1, alignSelf: 'stretch', background: 'var(--border)', margin: '0 6px' }} />

            {PURPOSE_TABS.map((t) => (
              <FilterTab
                key={t.key}
                active={purposeFilter === t.key}
                onClick={() => setPurposeFilter(purposeFilter === t.key ? 'all' : t.key)}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <PurposeChip purpose={t.key} />
                </span>
              </FilterTab>
            ))}
          </div>

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title, entity, or ID…"
            style={{
              flex: 1,
              minWidth: 180,
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

        {/* Grid */}
        {loading ? (
          <div className="flex items-center justify-center" style={{ height: 180 }}>
            <div className="w-6 h-6 rounded-full border-2 border-[var(--primary)] border-t-transparent animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
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
            {handoffs.length === 0 ? 'No handoffs yet' : 'No handoffs match the current filters'}
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: 14,
              alignContent: 'start',
            }}
          >
            {filtered.map((h) => (
              <HandoffCard key={h.id} handoff={h} onUpdate={() => fetchHandoffs(true)} />
            ))}
          </div>
        )}

      </div>
      <ToastContainer />
    </div>
  );
}

function FilterTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px 12px',
        fontSize: 'var(--t-sm)',
        color: active ? 'var(--primary-2)' : 'var(--text3)',
        background: active ? 'var(--primary-dim)' : 'transparent',
        border: 'none',
        borderRadius: 'var(--r-sm)',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        fontWeight: active ? 500 : 400,
        transition: 'all 120ms',
      }}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.background = 'var(--card-alt)';
          e.currentTarget.style.color = 'var(--text2)';
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.color = 'var(--text3)';
        }
      }}
    >
      {children}
    </button>
  );
}

