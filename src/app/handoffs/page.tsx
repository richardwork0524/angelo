'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { HandoffCard, purposeFromEntry, PurposeChip } from '@/components/handoff-card';
import type { HandoffPurpose } from '@/lib/types';
import { cachedFetch } from '@/lib/cache';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { useToast } from '@/components/toast';
import type { Handoff } from '@/lib/types';

type StatusFilter = 'all' | 'active' | 'mounted' | 'done' | 'blocked';
type PurposeFilter = 'all' | HandoffPurpose;

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: 'all',     label: 'All' },
  { key: 'active',  label: 'Active' },
  { key: 'mounted', label: 'Mounted' },
  { key: 'done',    label: 'Done' },
  { key: 'blocked', label: 'Blocked' },
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
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
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

  useRealtimeRefresh({
    table: 'angelo_handoffs',
    cachePrefix: '/api/handoffs',
    onRefresh: () => fetchHandoffs(true),
  });

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
    showToast('Create flow coming in a later phase', 'info');
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
      <div className="max-w-[1280px] mx-auto px-8 py-7" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Page head */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h1 className="font-semibold tracking-tight" style={{ fontSize: 'var(--t-h2)' }}>
            Handoffs
            <span className="ml-2 font-normal" style={{ color: 'var(--text3)', fontSize: 'var(--t-body)' }}>
              {counts.total} total · {counts.mountedCount} mounted
            </span>
          </h1>
          <div className="flex gap-2">
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

        {/* Stats strip */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 12,
          }}
        >
          <StatCell k="Total" v={String(counts.total)} />
          <StatCell k="Active" v={String(counts.activeCount)} tone="primary" />
          <StatCell k="Mounted" v={String(counts.mountedCount)} tone="primary" />
          <StatCell k="This week" v={String(counts.weekCount)} tone="success" />
        </div>
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

function StatCell({ k, v, tone }: { k: string; v: string; tone?: 'primary' | 'success' }) {
  const color = tone === 'primary' ? 'var(--primary-2)' : tone === 'success' ? 'var(--success)' : 'var(--text)';
  return (
    <div
      style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r)',
        padding: '12px 16px',
      }}
    >
      <div
        style={{
          fontSize: 'var(--t-tiny)',
          color: 'var(--text3)',
          textTransform: 'uppercase',
          letterSpacing: '.06em',
        }}
      >
        {k}
      </div>
      <div
        style={{
          fontSize: 18,
          fontWeight: 600,
          fontVariantNumeric: 'tabular-nums',
          marginTop: 4,
          color,
        }}
      >
        {v}
      </div>
    </div>
  );
}
