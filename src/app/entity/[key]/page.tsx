'use client';

import { useEffect, useState, useCallback, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { EtypeChip } from '@/components/entity-card';
import { StatusBadge } from '@/components/status-badge';
import { cachedFetch } from '@/lib/cache';
import type { EntityType } from '@/lib/types';

interface SubItem {
  child_key: string;
  display_name: string;
  entity_type: EntityType | null;
  status: string | null;
  current_version: string | null;
  build_phase: string | null;
  tasks_open: number;
  tasks_total: number;
}

interface MissionAgg {
  mission: string;
  task_count: number;
  p0: number; p1: number; p2: number;
  open: number;
}

interface RecentSession {
  id: string;
  session_code: string | null;
  session_date: string;
  title: string | null;
  surface: string | null;
  summary: string | null;
  cost_usd: number | null;
  input_tokens: number | null;
  output_tokens: number | null;
  project_key: string | null;
}

interface Note {
  id: string;
  project_key: string;
  text: string;
  note_type: string;
  resolved: boolean;
  created_at: string;
}

interface EntityDetail {
  child_key: string;
  display_name: string;
  entity_type: EntityType;
  parent_key: string | null;
  rinoa_path: string | null;
  brief: string | null;
  current_version: string | null;
  next_action: string | null;
  status: string | null;
  build_phase: string | null;
  last_session_date: string | null;
  updated_at: string | null;
  tasks_open: number;
  tasks_done: number;
  tasks_by_bucket: { this_week: number; this_month: number; parked: number };
  sub_items: SubItem[];
  missions: MissionAgg[];
  recent_sessions: RecentSession[];
  notes: Note[];
}

const CHILD_LABEL: Record<EntityType, string> = {
  company: 'Missions',
  app:     'Modules / features',
  game:    'Features',
  shell:   'Modules',
  meta:    'Sub-items',
};

const ADD_LABEL: Record<EntityType, string> = {
  company: '＋ Mission',
  app:     '＋ Feature',
  game:    '＋ Feature',
  shell:   '＋ Module',
  meta:    '＋ Item',
};

export default function EntityDetailPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = use(params);
  const router = useRouter();
  const [entity, setEntity] = useState<EntityDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const fetchEntity = useCallback(async () => {
    setLoading(true);
    setNotFound(false);
    try {
      const data = await cachedFetch<EntityDetail>(`/api/entity/${encodeURIComponent(key)}`, 15000);
      setEntity(data);
    } catch {
      setNotFound(true);
    }
    setLoading(false);
  }, [key]);

  useEffect(() => {
    fetchEntity();
  }, [fetchEntity]);

  if (loading) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="max-w-[1280px] mx-auto px-4 md:px-8 py-5 md:py-7 flex items-center justify-center" style={{ height: 240 }}>
          <div className="w-6 h-6 rounded-full border-2 border-[var(--primary)] border-t-transparent animate-spin" />
        </div>
      </div>
    );
  }

  if (notFound || !entity) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="max-w-[1280px] mx-auto px-4 md:px-8 py-5 md:py-7" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Link href="/entities" style={{ color: 'var(--primary-2)', fontSize: 'var(--t-sm)' }}>
            ← Entities
          </Link>
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
            Entity <code style={{ fontFamily: 'ui-monospace' }}>{key}</code> not found or not classified as an entity.
          </div>
        </div>
      </div>
    );
  }

  const childLabel = CHILD_LABEL[entity.entity_type];
  const addLabel = ADD_LABEL[entity.entity_type];

  return (
    <div className="h-full overflow-y-auto" data-testid="entity-detail-page">
      <div className="max-w-[1280px] mx-auto px-4 md:px-8 py-5 md:py-7" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, minWidth: 0 }}>
            <button
              onClick={() => router.back()}
              style={{
                width: 32,
                height: 32,
                borderRadius: 'var(--r-sm)',
                background: 'var(--card)',
                border: '1px solid var(--border)',
                color: 'var(--text2)',
                cursor: 'pointer',
                fontSize: 16,
                flexShrink: 0,
              }}
              title="Back"
            >
              ←
            </button>
            <div style={{ minWidth: 0 }}>
              <Breadcrumb entity={entity} />
              <h1
                className="font-semibold tracking-tight"
                style={{ fontSize: 'var(--t-h1)', marginTop: 6, color: 'var(--text)' }}
              >
                {entity.display_name}
              </h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                <EtypeChip type={entity.entity_type} />
                {entity.current_version && (
                  <span style={{ fontFamily: 'ui-monospace', fontSize: 10, color: 'var(--text3)' }}>
                    {entity.current_version}
                  </span>
                )}
                {entity.status && <StatusBadge status={entity.status} />}
                {entity.build_phase && (
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '.05em',
                      padding: '2px 6px',
                      borderRadius: 3,
                      background: 'var(--purple-dim)',
                      color: 'var(--purple)',
                    }}
                  >
                    {entity.build_phase}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <GhostButton
              onClick={() =>
                window.dispatchEvent(new CustomEvent('quick-note', {
                  detail: { project_key: entity.child_key },
                }))
              }
            >
              ＋ Note
            </GhostButton>
            <GhostButton disabled>Vault →</GhostButton>
            <PrimaryButton disabled>{addLabel}</PrimaryButton>
          </div>
        </div>

        {/* Brief */}
        {entity.brief && (
          <SectionCard>
            <div style={{ fontSize: 'var(--t-sm)', color: 'var(--text2)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
              {entity.brief}
            </div>
          </SectionCard>
        )}

        {/* Two-col layout */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)',
            gap: 16,
            alignItems: 'start',
          }}
        >
          {/* Main col */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Sub-items */}
            <SectionCard>
              <SectionHead title={childLabel} count={entity.sub_items.length} />
              {entity.sub_items.length === 0 ? (
                <EmptyRow label={`No ${childLabel.toLowerCase()} yet`} />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {entity.sub_items.map((s) => (
                    <Link
                      key={s.child_key}
                      href={s.entity_type ? `/entity/${encodeURIComponent(s.child_key)}` : `/project/${encodeURIComponent(s.child_key)}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 10,
                        padding: '10px 12px',
                        background: 'var(--bg)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--r-sm)',
                        textDecoration: 'none',
                        color: 'inherit',
                        transition: 'all 120ms',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--border-hi)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                        <span style={{ fontSize: 'var(--t-sm)', color: 'var(--text)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {s.display_name}
                        </span>
                        <span style={{ fontFamily: 'ui-monospace', fontSize: 10, color: 'var(--text4)' }}>
                          {s.child_key}
                        </span>
                      </span>
                      <span style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                        {s.current_version && (
                          <span style={{ fontFamily: 'ui-monospace', fontSize: 10, color: 'var(--text3)' }}>{s.current_version}</span>
                        )}
                        {s.tasks_open > 0 && (
                          <span style={{ fontSize: 'var(--t-tiny)', color: 'var(--text3)' }}>
                            <span style={{ color: 'var(--text)', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{s.tasks_open}</span> open
                          </span>
                        )}
                        {s.status && <StatusBadge status={s.status} />}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </SectionCard>

            {/* Missions */}
            {entity.missions.length > 0 && (
              <SectionCard>
                <SectionHead title="Missions" count={entity.missions.length} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {entity.missions.slice(0, 10).map((m) => (
                    <div
                      key={m.mission}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 10,
                        padding: '8px 12px',
                        background: 'var(--bg)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--r-sm)',
                      }}
                    >
                      <span style={{ fontSize: 'var(--t-sm)', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
                        {m.mission}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                        {m.p0 > 0 && <Dot color="var(--red)" title={`${m.p0} P0`} />}
                        {m.p1 > 0 && <Dot color="var(--orange)" title={`${m.p1} P1`} />}
                        <span style={{ fontSize: 'var(--t-tiny)', color: 'var(--text3)' }}>
                          <span style={{ color: 'var(--text)', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{m.open}</span> / {m.task_count}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}

            {/* Recent sessions */}
            <SectionCard>
              <SectionHead title="Recent sessions" count={entity.recent_sessions.length} />
              {entity.recent_sessions.length === 0 ? (
                <EmptyRow label="No sessions yet" />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {entity.recent_sessions.map((s) => (
                    <Link
                      key={s.id}
                      href={`/session/${encodeURIComponent(s.id)}`}
                      style={{
                        display: 'flex',
                        gap: 10,
                        alignItems: 'center',
                        padding: '8px 12px',
                        background: 'var(--bg)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--r-sm)',
                        textDecoration: 'none',
                        color: 'inherit',
                      }}
                    >
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 'var(--t-sm)', color: 'var(--text)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {s.title || 'Untitled'}
                        </div>
                        <div style={{ fontSize: 'var(--t-tiny)', color: 'var(--text3)', marginTop: 2 }}>
                          {s.session_date}{s.surface ? ` · ${s.surface}` : ''}{s.project_key ? ` · ${s.project_key}` : ''}
                        </div>
                      </span>
                      <span style={{ fontSize: 'var(--t-tiny)', color: 'var(--text3)', flexShrink: 0, textAlign: 'right' }}>
                        {s.cost_usd != null && <div>${Number(s.cost_usd).toFixed(2)}</div>}
                        {(s.input_tokens != null || s.output_tokens != null) && (
                          <div>{(((s.input_tokens ?? 0) + (s.output_tokens ?? 0)) / 1000).toFixed(1)}k</div>
                        )}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </SectionCard>
          </div>

          {/* Rail col */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Stats */}
            <SectionCard>
              <SectionHead title="Stats" />
              <KvList>
                <KvRow k="Type" v={<EtypeChip type={entity.entity_type} />} />
                <KvRow k={childLabel} v={String(entity.sub_items.length)} />
                <KvRow k="Open tasks" v={String(entity.tasks_open)} />
                <KvRow k="Completed" v={String(entity.tasks_done)} />
                <KvRow k="Sessions (10)" v={String(entity.recent_sessions.length)} />
                {entity.current_version && (
                  <KvRow k="Version" v={<code style={{ fontFamily: 'ui-monospace', fontSize: 11 }}>{entity.current_version}</code>} />
                )}
                <KvRow k="Last session" v={entity.last_session_date ?? '—'} />
              </KvList>
            </SectionCard>

            {/* Task buckets */}
            {(entity.tasks_by_bucket.this_week + entity.tasks_by_bucket.this_month + entity.tasks_by_bucket.parked) > 0 && (
              <SectionCard>
                <SectionHead title="Open by bucket" />
                <KvList>
                  <KvRow k="This week" v={String(entity.tasks_by_bucket.this_week)} accent="primary" />
                  <KvRow k="This month" v={String(entity.tasks_by_bucket.this_month)} accent="purple" />
                  <KvRow k="Parked" v={String(entity.tasks_by_bucket.parked)} />
                </KvList>
              </SectionCard>
            )}

            {/* Linked */}
            <SectionCard>
              <SectionHead title="Linked" />
              <KvList>
                {entity.rinoa_path && (
                  <KvRow
                    k="Vault"
                    v={
                      <span style={{ fontFamily: 'ui-monospace', fontSize: 10, color: 'var(--text3)', wordBreak: 'break-all' }}>
                        {entity.rinoa_path}
                      </span>
                    }
                  />
                )}
                {entity.parent_key && (
                  <KvRow
                    k="Parent"
                    v={<code style={{ fontFamily: 'ui-monospace', fontSize: 11 }}>{entity.parent_key}</code>}
                  />
                )}
                <KvRow k="Key" v={<code style={{ fontFamily: 'ui-monospace', fontSize: 11 }}>{entity.child_key}</code>} />
              </KvList>
            </SectionCard>

            {/* Entity-level notes */}
            <SectionCard>
              <SectionHead title="Notes" count={entity.notes.length} />
              {entity.notes.length === 0 ? (
                <EmptyRow label="No unresolved notes" />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {entity.notes.slice(0, 6).map((n) => (
                    <div
                      key={n.id}
                      style={{
                        padding: '8px 10px',
                        background: 'var(--bg)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--r-sm)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <span
                          style={{
                            fontSize: 9,
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '.05em',
                            padding: '1px 5px',
                            borderRadius: 3,
                            background: 'var(--primary-dim)',
                            color: 'var(--primary-2)',
                          }}
                        >
                          {n.note_type}
                        </span>
                      </div>
                      <div style={{ fontSize: 'var(--t-tiny)', color: 'var(--text2)', lineHeight: 1.5 }}>
                        {n.text}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          </div>
        </div>
      </div>
    </div>
  );
}

function Breadcrumb({ entity }: { entity: EntityDetail }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--t-tiny)', color: 'var(--text3)' }}>
      <Link href="/entities" style={{ color: 'var(--text3)', textDecoration: 'none' }}>Entities</Link>
      {entity.parent_key && (
        <>
          <span style={{ color: 'var(--text4)' }}>›</span>
          <span style={{ fontFamily: 'ui-monospace' }}>{entity.parent_key}</span>
        </>
      )}
      <span style={{ color: 'var(--text4)' }}>›</span>
      <span style={{ fontFamily: 'ui-monospace', color: 'var(--primary-2)', fontWeight: 600 }}>{entity.child_key}</span>
    </div>
  );
}

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r-lg)',
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      {children}
    </div>
  );
}

function SectionHead({ title, count }: { title: string; count?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ fontSize: 'var(--t-sm)', fontWeight: 600, color: 'var(--text)' }}>{title}</div>
      {count !== undefined && (
        <span
          style={{
            fontSize: 'var(--t-tiny)',
            color: 'var(--text3)',
            fontVariantNumeric: 'tabular-nums',
            padding: '1px 6px',
            background: 'var(--card-alt)',
            borderRadius: 999,
          }}
        >
          {count}
        </span>
      )}
    </div>
  );
}

function EmptyRow({ label }: { label: string }) {
  return <div style={{ fontSize: 'var(--t-sm)', color: 'var(--text4)', padding: '4px 2px' }}>{label}</div>;
}

function KvList({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{children}</div>;
}

function KvRow({ k, v, accent }: { k: string; v: React.ReactNode; accent?: 'primary' | 'purple' }) {
  const color = accent === 'primary' ? 'var(--primary-2)' : accent === 'purple' ? 'var(--purple)' : 'var(--text)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, fontSize: 'var(--t-sm)' }}>
      <span style={{ color: 'var(--text3)' }}>{k}</span>
      <span style={{ color, fontVariantNumeric: 'tabular-nums', fontWeight: 500, textAlign: 'right' }}>{v}</span>
    </div>
  );
}

function Dot({ color, title }: { color: string; title?: string }) {
  return <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, display: 'inline-block' }} title={title} />;
}

function GhostButton({ children, disabled, onClick }: { children: React.ReactNode; disabled?: boolean; onClick?: () => void }) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      style={{
        padding: '8px 12px',
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r-sm)',
        fontSize: 'var(--t-sm)',
        color: 'var(--text2)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
      }}
      title={disabled ? 'Coming in a later phase' : undefined}
    >
      {children}
    </button>
  );
}

function PrimaryButton({ children, disabled }: { children: React.ReactNode; disabled?: boolean }) {
  return (
    <button
      disabled={disabled}
      style={{
        padding: '8px 12px',
        background: 'var(--primary)',
        border: '1px solid var(--primary)',
        borderRadius: 'var(--r-sm)',
        fontSize: 'var(--t-sm)',
        color: '#fff',
        fontWeight: 500,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.7 : 1,
      }}
      title={disabled ? 'Coming in a later phase' : undefined}
    >
      {children}
    </button>
  );
}
