'use client';

import { useEffect, useMemo, useState, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { EntityCard, EtypeChip } from '@/components/entity-card';
import { cachedFetch } from '@/lib/cache';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { SectionPager, type Section } from '@/components/section-pager';
import type { EntitySummary, EntityType } from '@/lib/types';

/** Primary category tabs */
type PrimaryCategory = 'companies' | 'development' | 'meta' | 'group-strategy';

/** Development sub-toggle */
type DevSubCategory = 'all' | 'app' | 'game' | 'website';

interface EntitiesResponse {
  entities: EntitySummary[];
  total: number;
  by_type: Record<string, number>;
}

/**
 * Determine the primary category for an entity by walking parent_key to root.
 * Roots observed in DB:
 *   parent_key='company'           → Companies
 *   parent_key='app-development'   → Development / App
 *   parent_key='game-development'  → Development / Game
 *   parent_key='website-development' → Development / Website
 *   parent_key=null + entity_type='game' → Development / Game (loose games)
 *   parent_key='general'           → Meta
 *   parent_key='root'/'group-strategy' entity → Group Strategy
 */
function deriveCategory(
  entity: EntitySummary,
  allByKey: Map<string, EntitySummary>
): { primary: PrimaryCategory; dev?: DevSubCategory } {
  // Walk up the parent chain to find the root-level folder
  let current: EntitySummary | null = entity;
  let rootKey: string | null = null;

  for (let depth = 0; depth < 10; depth++) {
    if (!current) break;
    const pk = current.parent_key;
    if (!pk || pk === 'root') {
      rootKey = current.child_key;
      break;
    }
    // Check if parent is a known root bucket
    if (['company', 'app-development', 'game-development', 'website-development', 'general'].includes(pk)) {
      rootKey = pk;
      break;
    }
    // Walk up
    const parent = allByKey.get(pk);
    if (!parent) {
      // parent not in entities list (might be a non-entity folder row)
      rootKey = pk;
      break;
    }
    current = parent;
  }

  // Map root to category
  if (rootKey === 'company') return { primary: 'companies' };
  if (rootKey === 'app-development') return { primary: 'development', dev: 'app' };
  if (rootKey === 'game-development') return { primary: 'development', dev: 'game' };
  if (rootKey === 'website-development') return { primary: 'development', dev: 'website' };
  if (rootKey === 'general') return { primary: 'meta' };
  if (rootKey === 'group-strategy' || entity.child_key === 'group-strategy') return { primary: 'group-strategy' };

  // Fallback: loose games (no parent or unknown parent but entity_type game)
  if (entity.entity_type === 'game') return { primary: 'development', dev: 'game' };
  if (entity.entity_type === 'app') return { primary: 'development', dev: 'app' };
  if (entity.entity_type === 'website') return { primary: 'development', dev: 'website' };
  if (entity.entity_type === 'meta') return { primary: 'meta' };
  if (entity.entity_type === 'company') return { primary: 'companies' };

  return { primary: 'meta' };
}

const PRIMARY_TABS: { key: PrimaryCategory; label: string }[] = [
  { key: 'companies',      label: 'Companies' },
  { key: 'development',    label: 'Development' },
  { key: 'meta',           label: 'Meta' },
  { key: 'group-strategy', label: 'Group Strategy' },
];

const DEV_SUBTABS: { key: DevSubCategory; label: string }[] = [
  { key: 'all',     label: 'All' },
  { key: 'app',     label: 'App' },
  { key: 'game',    label: 'Game' },
  { key: 'website', label: 'Website' },
];

const VALID_PRIMARY: PrimaryCategory[] = ['companies', 'development', 'meta', 'group-strategy'];

function parseCategoryParam(raw: string | null): { primary: PrimaryCategory; dev: DevSubCategory } {
  if (raw === 'development') return { primary: 'development', dev: 'all' };
  if (raw && VALID_PRIMARY.includes(raw as PrimaryCategory)) return { primary: raw as PrimaryCategory, dev: 'all' };
  return { primary: 'companies', dev: 'all' };
}

function EntitiesPageInner() {
  const searchParams = useSearchParams();
  const isDesktop = useBreakpoint(768);
  const categoryParam = searchParams.get('category');
  const { primary: initPrimary, dev: initDev } = parseCategoryParam(categoryParam);

  const [entities, setEntities] = useState<EntitySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [primaryCategory, setPrimaryCategory] = useState<PrimaryCategory>(initPrimary);
  const [devSub, setDevSub] = useState<DevSubCategory>(initDev);
  const [search, setSearch] = useState('');

  // Sync if ?category= changes via navigation (e.g. sidebar link)
  useEffect(() => {
    const { primary, dev } = parseCategoryParam(searchParams.get('category'));
    setPrimaryCategory(primary);
    setDevSub(dev);
  }, [searchParams]);

  const fetchEntities = useCallback(async () => {
    try {
      const data = await cachedFetch<EntitiesResponse>('/api/entities', 20000);
      setEntities(data.entities || []);
    } catch {
      // silent
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchEntities();
  }, [fetchEntities]);

  // Build a lookup map by child_key (for parent walking)
  const allByKey = useMemo(() => {
    const m = new Map<string, EntitySummary>();
    for (const e of entities) m.set(e.child_key, e);
    return m;
  }, [entities]);

  // Categorise all entities once
  const categorised = useMemo(() => {
    return entities.map((e) => ({
      entity: e,
      ...deriveCategory(e, allByKey),
    }));
  }, [entities, allByKey]);

  // Filter by search query (used for both desktop and mobile)
  const searchFilter = useCallback((e: EntitySummary) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    const hay = [e.child_key, e.display_name, e.brief, e.entity_type]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return hay.includes(q);
  }, [search]);

  // Filtered by primary category + dev sub + search (desktop)
  const filtered = useMemo(() => {
    return categorised
      .filter(({ primary, dev }) => {
        if (primary !== primaryCategory) return false;
        if (primaryCategory === 'development' && devSub !== 'all' && dev !== devSub) return false;
        return true;
      })
      .map(({ entity }) => entity)
      .filter(searchFilter);
  }, [categorised, primaryCategory, devSub, searchFilter]);

  // Group categorised entities by primary category (mobile pager)
  const byCategory = useMemo(() => {
    const groups: Record<PrimaryCategory, { entity: EntitySummary; dev?: DevSubCategory }[]> = {
      companies: [], development: [], meta: [], 'group-strategy': [],
    };
    for (const c of categorised) {
      groups[c.primary].push({ entity: c.entity, dev: c.dev });
    }
    return groups;
  }, [categorised]);

  // Category counts for tab hints
  const counts = useMemo(() => {
    const out: Record<PrimaryCategory, number> = {
      companies: 0,
      development: 0,
      meta: 0,
      'group-strategy': 0,
    };
    for (const { primary } of categorised) out[primary]++;
    return out;
  }, [categorised]);

  // Dev sub-counts
  const devCounts = useMemo(() => {
    const out: Record<DevSubCategory, number> = { all: 0, app: 0, game: 0, website: 0 };
    for (const { primary, dev } of categorised) {
      if (primary !== 'development') continue;
      out.all++;
      if (dev) out[dev] = (out[dev] || 0) + 1;
    }
    return out;
  }, [categorised]);

  // Mobile layout — swipe between primary categories, each with its grid
  if (!isDesktop) {
    const sections: Section[] = PRIMARY_TABS.map((t) => {
      const all = byCategory[t.key].map(({ entity }) => entity).filter(searchFilter);
      const devFilteredAll = byCategory[t.key];
      return {
        key: t.key,
        label: t.label,
        badge: counts[t.key] || null,
        content: (
          <div className="px-4 pt-3" style={{ paddingBottom: 'calc(36px + var(--safe-b))' }}>
            {t.key === 'development' && (
              <div className="flex gap-1 mb-3 flex-wrap">
                {DEV_SUBTABS.map((sub) => {
                  const active = devSub === sub.key;
                  return (
                    <button
                      key={sub.key}
                      onClick={() => setDevSub(sub.key)}
                      style={{
                        padding: '4px 10px',
                        fontSize: 12,
                        fontWeight: active ? 600 : 500,
                        color: active ? '#fff' : 'var(--text3)',
                        background: active ? 'var(--primary)' : 'var(--card)',
                        border: `1px solid ${active ? 'var(--primary)' : 'var(--border)'}`,
                        borderRadius: 6,
                      }}
                    >
                      {sub.label}
                      {devCounts[sub.key] > 0 && (
                        <span style={{ marginLeft: 4, opacity: .8 }}>{devCounts[sub.key]}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
            {(() => {
              const filteredCat = t.key === 'development'
                ? devFilteredAll
                    .filter(({ dev }) => devSub === 'all' || dev === devSub)
                    .map(({ entity }) => entity)
                    .filter(searchFilter)
                : all;
              if (filteredCat.length === 0) {
                return (
                  <div
                    style={{
                      textAlign: 'center',
                      padding: '36px 24px',
                      background: 'var(--card)',
                      border: '1px dashed var(--border)',
                      borderRadius: 'var(--r)',
                      color: 'var(--text3)',
                      fontSize: 'var(--t-sm)',
                    }}
                  >
                    {search ? 'No matches' : `No ${t.label.toLowerCase()} yet`}
                  </div>
                );
              }
              return (
                <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
                  {filteredCat.map((e) => (
                    <EntityCard key={e.child_key} entity={e} />
                  ))}
                </div>
              );
            })()}
          </div>
        ),
      };
    });

    return (
      <div className="h-full flex flex-col" data-testid="entities-page">
        <div className="shrink-0 px-4 pt-4 pb-2">
          <div className="flex items-baseline justify-between mb-2">
            <h1 className="font-semibold tracking-tight" style={{ fontSize: 'var(--t-h2)' }}>
              Entities
              <span className="ml-2 font-normal" style={{ color: 'var(--text3)', fontSize: 'var(--t-body)' }}>
                {entities.length}
              </span>
            </h1>
          </div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            className="w-full"
            style={{
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--r-sm)',
              padding: '7px 10px',
              color: 'var(--text)',
              fontSize: 'var(--t-sm)',
              outline: 'none',
            }}
          />
        </div>
        {loading ? (
          <div className="flex items-center justify-center" style={{ height: 180 }}>
            <div className="w-6 h-6 rounded-full border-2 border-[var(--primary)] border-t-transparent animate-spin" />
          </div>
        ) : (
          <SectionPager
            sections={sections}
            initialIndex={PRIMARY_TABS.findIndex((t) => t.key === primaryCategory)}
            onIndexChange={(i) => setPrimaryCategory(PRIMARY_TABS[i].key)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto" data-testid="entities-page">
      <div
        className="max-w-[1280px] mx-auto px-4 md:px-8 py-5 md:py-7"
        style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
      >
        {/* Page head */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h1 className="font-semibold tracking-tight" style={{ fontSize: 'var(--t-h2)' }}>
            Entities
            <span
              className="ml-2 font-normal"
              style={{ color: 'var(--text3)', fontSize: 'var(--t-body)' }}
            >
              {entities.length} total
            </span>
          </h1>
        </div>

        {/* Primary category toggle */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '6px 8px',
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r)',
            flexWrap: 'wrap',
          }}
        >
          {PRIMARY_TABS.map((t) => (
            <CategoryTab
              key={t.key}
              active={primaryCategory === t.key}
              count={counts[t.key]}
              onClick={() => {
                setPrimaryCategory(t.key);
                setDevSub('all');
              }}
            >
              {t.label}
            </CategoryTab>
          ))}
          <div style={{ flex: 1 }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            style={{
              minWidth: 160,
              maxWidth: 260,
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--r-sm)',
              padding: '5px 10px',
              color: 'var(--text)',
              fontSize: 'var(--t-sm)',
              outline: 'none',
            }}
          />
        </div>

        {/* Dev sub-toggle — only when Development is selected */}
        {primaryCategory === 'development' && (
          <div
            style={{
              display: 'flex',
              gap: 4,
              padding: '4px 6px',
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--r-sm)',
              width: 'fit-content',
            }}
          >
            {DEV_SUBTABS.map((t) => (
              <SubTab
                key={t.key}
                active={devSub === t.key}
                count={devCounts[t.key]}
                onClick={() => setDevSub(t.key)}
              >
                {t.label}
              </SubTab>
            ))}
          </div>
        )}

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
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCell k="Companies"  v={String(counts['companies'])}      tone="success" />
          <StatCell k="Development" v={String(counts['development'])}   tone="primary" />
          <StatCell k="Meta"        v={String(counts['meta'])}          tone="vault" />
          <StatCell k="Group Strategy" v={String(counts['group-strategy'])} />
        </div>
      </div>
    </div>
  );
}

function CategoryTab({
  active,
  count,
  onClick,
  children,
}: {
  active: boolean;
  count: number;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '7px 14px',
        fontSize: 'var(--t-sm)',
        fontWeight: active ? 600 : 400,
        color: active ? 'var(--primary-2)' : 'var(--text3)',
        background: active ? 'var(--primary-dim)' : 'transparent',
        border: 'none',
        borderRadius: 'var(--r-sm)',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        transition: 'all 120ms',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
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
      {count > 0 && (
        <span
          style={{
            fontSize: 'var(--t-tiny)',
            color: active ? 'var(--primary-2)' : 'var(--text4)',
            fontVariantNumeric: 'tabular-nums',
            fontWeight: 500,
          }}
        >
          {count}
        </span>
      )}
    </button>
  );
}

function SubTab({
  active,
  count,
  onClick,
  children,
}: {
  active: boolean;
  count: number;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '4px 10px',
        fontSize: 'var(--t-sm)',
        fontWeight: active ? 600 : 400,
        color: active ? 'var(--text)' : 'var(--text3)',
        background: active ? 'var(--card)' : 'transparent',
        border: active ? '1px solid var(--border)' : '1px solid transparent',
        borderRadius: 'var(--r-sm)',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        transition: 'all 120ms',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
      }}
    >
      {children}
      {count > 0 && (
        <span
          style={{
            fontSize: 10,
            color: 'var(--text4)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {count}
        </span>
      )}
    </button>
  );
}

function StatCell({
  k,
  v,
  tone,
}: {
  k: string;
  v: string;
  tone?: 'primary' | 'warn' | 'success' | 'pink' | 'vault';
}) {
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

// Wrap with Suspense so useSearchParams doesn't cause build-time static render issues
export default function EntitiesPage() {
  return (
    <Suspense fallback={
      <div className="h-full flex items-center justify-center">
        <div className="w-6 h-6 rounded-full border-2 border-[var(--primary)] border-t-transparent animate-spin" />
      </div>
    }>
      <EntitiesPageInner />
    </Suspense>
  );
}

// Keep EtypeChip import used by EntityCard — re-exported for potential external use
export { EtypeChip };
