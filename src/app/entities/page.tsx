'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { EntityCard, EtypeChip } from '@/components/entity-card';
import { cachedFetch } from '@/lib/cache';
import type { EntitySummary, EntityType } from '@/lib/types';

type EtypeFilter = 'all' | EntityType;

const ETYPE_TABS: { key: EtypeFilter; label: string }[] = [
  { key: 'all',     label: 'All' },
  { key: 'company', label: 'COMPANY' },
  { key: 'app',     label: 'APP' },
  { key: 'game',    label: 'GAME' },
  { key: 'shell',   label: 'SHELL' },
  { key: 'meta',    label: 'META' },
];

interface EntitiesResponse {
  entities: EntitySummary[];
  total: number;
  by_type: Record<EntityType, number>;
}

export default function EntitiesPage() {
  const [entities, setEntities] = useState<EntitySummary[]>([]);
  const [byType, setByType] = useState<Record<EntityType, number>>({ company: 0, app: 0, game: 0, shell: 0, meta: 0 });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<EtypeFilter>('all');
  const [search, setSearch] = useState('');

  const fetchEntities = useCallback(async () => {
    try {
      const data = await cachedFetch<EntitiesResponse>('/api/entities', 20000);
      setEntities(data.entities || []);
      setByType(data.by_type || { company: 0, app: 0, game: 0, shell: 0, meta: 0 });
    } catch {
      // silent
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchEntities();
  }, [fetchEntities]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entities.filter((e) => {
      if (filter !== 'all' && e.entity_type !== filter) return false;
      if (q) {
        const hay = [e.child_key, e.display_name, e.brief, e.entity_type].filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [entities, filter, search]);

  const typesWithRows = (Object.keys(byType) as EntityType[]).filter((t) => byType[t] > 0).length;

  return (
    <div className="h-full overflow-y-auto" data-testid="entities-page">
      <div className="max-w-[1280px] mx-auto px-4 md:px-8 py-5 md:py-7" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Page head */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h1 className="font-semibold tracking-tight" style={{ fontSize: 'var(--t-h2)' }}>
            Entities
            <span className="ml-2 font-normal" style={{ color: 'var(--text3)', fontSize: 'var(--t-body)' }}>
              {entities.length} total · {typesWithRows} types
            </span>
          </h1>
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
            {ETYPE_TABS.map((t) => (
              <FilterTab key={t.key} active={filter === t.key} onClick={() => setFilter(t.key)}>
                {t.key === 'all' ? (
                  t.label
                ) : (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <EtypeChip type={t.key} />
                  </span>
                )}
              </FilterTab>
            ))}
          </div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, key, or brief…"
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
            {entities.length === 0 ? 'No entities yet' : 'No entities match the current filters'}
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
              gap: 14,
              alignContent: 'start',
            }}
          >
            {filtered.map((e) => (
              <EntityCard key={e.child_key} entity={e} />
            ))}
          </div>
        )}

        {/* Stats strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          <StatCell k="Companies" v={String(byType.company ?? 0)} />
          <StatCell k="Apps" v={String(byType.app ?? 0)} tone="primary" />
          <StatCell k="Games" v={String(byType.game ?? 0)} tone="warn" />
          <StatCell k="Shells" v={String(byType.shell ?? 0)} tone="pink" />
          <StatCell k="Meta" v={String(byType.meta ?? 0)} tone="vault" />
        </div>
      </div>
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

function StatCell({ k, v, tone }: { k: string; v: string; tone?: 'primary' | 'warn' | 'success' | 'pink' | 'vault' }) {
  const color =
    tone === 'primary' ? 'var(--primary-2)' :
    tone === 'warn'    ? 'var(--warn)'    :
    tone === 'success' ? 'var(--success)' :
    tone === 'pink'    ? 'var(--pink)'    :
    tone === 'vault'   ? 'var(--vault)'   :
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
