'use client';

import { useEffect, useState, useCallback, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { StatusBadge } from '@/components/status-badge';
import { PurposeChip, purposeFromEntry } from '@/components/handoff-card';
import { cachedFetch } from '@/lib/cache';

interface Feature {
  id: string;
  feature_key: string;
  display_name: string;
  description: string | null;
  status: string;
  entry_point: string | null;
  rinoa_path: string | null;
  sort_order: number;
  updated_at: string;
}

interface ModuleHandoff {
  id: string;
  handoff_code: string | null;
  project_key: string;
  scope_type: string;
  scope_name: string;
  entry_point: string | null;
  version: string | null;
  sections_completed: number;
  sections_total: number;
  status: string;
  purpose: 'create' | 'debug' | 'update';
  is_mounted: boolean;
  updated_at: string;
}

interface MissionAgg {
  mission: string;
  open: number;
  total: number;
  p0: number;
  p1: number;
  p2: number;
}

interface ModuleApp {
  id: string;
  app_key: string;
  project_key: string | null;
  display_name: string;
  description: string | null;
  rinoa_path: string;
  code_path: string | null;
  git_repo: string | null;
  deployed_url: string | null;
  status: string;
}

interface ModuleNote {
  id: string;
  project_key: string;
  text: string;
  note_type: string;
  feature: string | null;
  resolved: boolean;
  created_at: string;
}

interface ModuleDetail {
  id: string;
  module_key: string;
  app_id: string;
  display_name: string;
  description: string | null;
  rinoa_path: string | null;
  status: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
  app: ModuleApp | null;
  features: Feature[];
  handoffs: ModuleHandoff[];
  missions: MissionAgg[];
  notes: ModuleNote[];
}

export default function ModuleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [mod, setMod] = useState<ModuleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const fetchModule = useCallback(async () => {
    setLoading(true);
    setNotFound(false);
    try {
      const data = await cachedFetch<ModuleDetail>(`/api/module/${encodeURIComponent(id)}`, 15000);
      setMod(data);
    } catch {
      setNotFound(true);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchModule();
  }, [fetchModule]);

  if (loading) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="max-w-[1280px] mx-auto px-8 py-7 flex items-center justify-center" style={{ height: 240 }}>
          <div className="w-6 h-6 rounded-full border-2 border-[var(--primary)] border-t-transparent animate-spin" />
        </div>
      </div>
    );
  }

  if (notFound || !mod) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="max-w-[1280px] mx-auto px-8 py-7" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Link href="/entities" style={{ color: 'var(--primary-2)', fontSize: 'var(--t-sm)' }}>← Entities</Link>
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
            Module <code style={{ fontFamily: 'ui-monospace' }}>{id}</code> not found.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto" data-testid="module-detail-page">
      <div className="max-w-[1280px] mx-auto px-8 py-7" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, minWidth: 0 }}>
            <button
              onClick={() => router.back()}
              style={{
                width: 32, height: 32,
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
              <Breadcrumb mod={mod} />
              <h1
                className="font-semibold tracking-tight"
                style={{ fontSize: 'var(--t-h1)', marginTop: 6, color: 'var(--text)' }}
              >
                {mod.display_name}
              </h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '.05em',
                    padding: '2px 6px',
                    borderRadius: 3,
                    background: 'var(--primary-dim)',
                    color: 'var(--primary-2)',
                  }}
                >
                  module
                </span>
                <StatusBadge status={mod.status} />
                <span style={{ fontSize: 'var(--t-tiny)', color: 'var(--text3)' }}>
                  {mod.features.length} features · {mod.missions.length} missions
                </span>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <GhostButton disabled>＋ Note</GhostButton>
            <PrimaryButton disabled>＋ Feature</PrimaryButton>
          </div>
        </div>

        {/* Description */}
        {mod.description && (
          <SectionCard>
            <div style={{ fontSize: 'var(--t-sm)', color: 'var(--text2)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
              {mod.description}
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
            {/* Features */}
            <SectionCard>
              <SectionHead title="Features" count={mod.features.length} />
              {mod.features.length === 0 ? (
                <EmptyRow label="No features yet" />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {mod.features.map((f) => (
                    <div
                      key={f.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 10,
                        padding: '10px 12px',
                        background: 'var(--bg)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--r-sm)',
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                        <span
                          style={{
                            width: 14,
                            height: 14,
                            borderRadius: 3,
                            border: '1px solid var(--border)',
                            background: f.status === 'LIVE' ? 'var(--success)' : 'transparent',
                            color: '#fff',
                            fontSize: 9,
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          {f.status === 'LIVE' ? '✓' : ''}
                        </span>
                        <span style={{ fontSize: 'var(--t-sm)', color: 'var(--text)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {f.display_name}
                        </span>
                        <span style={{ fontFamily: 'ui-monospace', fontSize: 10, color: 'var(--text4)' }}>
                          {f.feature_key}
                        </span>
                      </span>
                      <span style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                        {f.entry_point && (
                          <span style={{ fontSize: 10, color: 'var(--primary-2)', fontFamily: 'ui-monospace' }}>{f.entry_point}</span>
                        )}
                        <StatusBadge status={f.status} />
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>

            {/* Missions */}
            {mod.missions.length > 0 && (
              <SectionCard>
                <SectionHead title="Missions tied to this app" count={mod.missions.length} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {mod.missions.slice(0, 10).map((m) => (
                    <Link
                      key={m.mission}
                      href={`/mission/${encodeURIComponent(m.mission)}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 10,
                        padding: '8px 12px',
                        background: 'var(--bg)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--r-sm)',
                        textDecoration: 'none',
                        color: 'inherit',
                      }}
                    >
                      <span style={{ fontSize: 'var(--t-sm)', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
                        {m.mission}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                        {m.p0 > 0 && <Dot color="var(--red)" title={`${m.p0} P0`} />}
                        {m.p1 > 0 && <Dot color="var(--orange)" title={`${m.p1} P1`} />}
                        <span style={{ fontSize: 'var(--t-tiny)', color: 'var(--text3)' }}>
                          <span style={{ color: 'var(--text)', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{m.open}</span> / {m.total}
                        </span>
                      </span>
                    </Link>
                  ))}
                </div>
              </SectionCard>
            )}

            {/* Handoffs targeting module */}
            <SectionCard>
              <SectionHead title="Handoffs targeting this module" count={mod.handoffs.length} />
              {mod.handoffs.length === 0 ? (
                <EmptyRow label="None" />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {mod.handoffs.map((h) => (
                    <Link
                      key={h.id}
                      href={`/handoff/${encodeURIComponent(h.id)}`}
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
                      }}
                    >
                      <span style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 'var(--t-sm)', color: 'var(--text)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {h.scope_name}
                        </div>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4 }}>
                          <PurposeChip purpose={h.purpose ?? purposeFromEntry(h.entry_point)} />
                          <StatusBadge status={h.status} />
                        </div>
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
                {mod.app && (
                  <KvRow k="App" v={
                    <Link href={`/entity/${encodeURIComponent(mod.app.project_key || mod.app.app_key)}`} style={{ fontFamily: 'ui-monospace', fontSize: 11, color: 'var(--primary-2)', textDecoration: 'none' }}>
                      {mod.app.app_key}
                    </Link>
                  } />
                )}
                <KvRow k="Status" v={<StatusBadge status={mod.status} />} />
                <KvRow k="Features" v={String(mod.features.length)} />
                <KvRow k="Missions" v={String(mod.missions.length)} />
                <KvRow k="Handoffs" v={String(mod.handoffs.length)} />
                <KvRow k="Notes" v={String(mod.notes.length)} />
              </KvList>
            </SectionCard>

            {/* Linked */}
            <SectionCard>
              <SectionHead title="Linked" />
              <KvList>
                <KvRow k="Key" v={<code style={{ fontFamily: 'ui-monospace', fontSize: 11 }}>{mod.module_key}</code>} />
                {mod.rinoa_path && (
                  <KvRow k="Vault" v={
                    <span style={{ fontFamily: 'ui-monospace', fontSize: 10, color: 'var(--text3)', wordBreak: 'break-all' }}>
                      {mod.rinoa_path}
                    </span>
                  } />
                )}
                {mod.app?.deployed_url && (
                  <KvRow k="URL" v={
                    <a href={mod.app.deployed_url} target="_blank" rel="noreferrer" style={{ fontFamily: 'ui-monospace', fontSize: 10, color: 'var(--primary-2)' }}>
                      {mod.app.deployed_url.replace(/^https?:\/\//, '')}
                    </a>
                  } />
                )}
              </KvList>
            </SectionCard>

            {/* Notes */}
            <SectionCard>
              <SectionHead title="Notes on this module" count={mod.notes.length} />
              {mod.notes.length === 0 ? (
                <EmptyRow label="No unresolved notes" />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {mod.notes.slice(0, 6).map((n) => (
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
                        {n.feature && (
                          <span style={{ fontSize: 9, color: 'var(--text3)' }}>{n.feature}</span>
                        )}
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

function Breadcrumb({ mod }: { mod: ModuleDetail }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--t-tiny)', color: 'var(--text3)', flexWrap: 'wrap' }}>
      <Link href="/entities" style={{ color: 'var(--text3)', textDecoration: 'none' }}>Entities</Link>
      {mod.app && (
        <>
          <span style={{ color: 'var(--text4)' }}>›</span>
          <Link
            href={`/entity/${encodeURIComponent(mod.app.project_key || mod.app.app_key)}`}
            style={{ fontFamily: 'ui-monospace', color: 'var(--text3)', textDecoration: 'none' }}
          >
            {mod.app.app_key}
          </Link>
        </>
      )}
      <span style={{ color: 'var(--text4)' }}>›</span>
      <span style={{ fontFamily: 'ui-monospace', color: 'var(--primary-2)', fontWeight: 600 }}>
        {mod.module_key}
      </span>
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

function KvRow({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, fontSize: 'var(--t-sm)' }}>
      <span style={{ color: 'var(--text3)' }}>{k}</span>
      <span style={{ color: 'var(--text)', fontVariantNumeric: 'tabular-nums', fontWeight: 500, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{v}</span>
    </div>
  );
}

function Dot({ color, title }: { color: string; title?: string }) {
  return <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, display: 'inline-block' }} title={title} />;
}

function GhostButton({ children, disabled }: { children: React.ReactNode; disabled?: boolean }) {
  return (
    <button
      disabled={disabled}
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
