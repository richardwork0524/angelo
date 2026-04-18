'use client';

import { useEffect, useState, useCallback, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { StatusBadge } from '@/components/status-badge';
import { PurposeChip, purposeFromEntry } from '@/components/handoff-card';
import { cachedFetch, invalidateCache } from '@/lib/cache';
import { patchHandoff } from '@/lib/mutate';
import type { Handoff } from '@/lib/types';

interface HandoffSession {
  id: string;
  session_code: string | null;
  session_date: string;
  title: string | null;
  surface: string | null;
  summary: string | null;
  cost_usd: number | null;
  input_tokens: number | null;
  output_tokens: number | null;
  created_at: string;
  role: 'created' | 'picked_up';
}

interface HandoffNote {
  id: string;
  project_key: string;
  text: string;
  note_type: string;
  resolved: boolean;
  created_at: string;
  session_log_id: string | null;
}

interface HandoffProject {
  child_key: string;
  display_name: string;
  parent_key: string | null;
  entity_type: string | null;
}

interface HandoffDetail extends Omit<Handoff, 'notes'> {
  notes: string | null;
  project: HandoffProject | null;
  sessions: HandoffSession[];
  attached_notes: HandoffNote[];
  tokens_total: number;
  cost_total: number;
}

function fmtTokens(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

function timeAgo(date: string): string {
  const mins = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function HandoffDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [handoff, setHandoff] = useState<HandoffDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [copyLabel, setCopyLabel] = useState('Copy to CC');
  const [acting, setActing] = useState(false);

  const fetchHandoff = useCallback(async () => {
    setLoading(true);
    setNotFound(false);
    try {
      const data = await cachedFetch<HandoffDetail>(`/api/handoff/${encodeURIComponent(id)}`, 15000);
      setHandoff(data);
    } catch {
      setNotFound(true);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchHandoff();
  }, [fetchHandoff]);

  const refresh = useCallback(() => {
    invalidateCache(`/api/handoff/${id}`);
    invalidateCache('/api/handoffs');
    invalidateCache('/api/home');
    fetchHandoff();
  }, [id, fetchHandoff]);

  function handleToggleMount() {
    if (!handoff || acting) return;
    setActing(true);
    patchHandoff(handoff.id, { is_mounted: !handoff.is_mounted }, {
      onSuccess: () => { setActing(false); refresh(); },
      onError: () => { setActing(false); },
    });
  }

  function handleStatus(newStatus: string) {
    if (!handoff || acting) return;
    setActing(true);
    patchHandoff(handoff.id, newStatus, {
      onSuccess: () => { setActing(false); refresh(); },
      onError: () => { setActing(false); },
    });
  }

  function handleCopy() {
    if (!handoff) return;
    const remaining = (handoff.sections_remaining || [])
      .map((s, i) => `${i + 1}. [${s.status === 'done' ? 'x' : ' '}] ${s.name}`)
      .join('\n');
    const text = [
      `# ${handoff.scope_name}`,
      handoff.handoff_code ? `Code: ${handoff.handoff_code}` : null,
      `Project: ${handoff.project_key} | Type: ${handoff.scope_type} | Purpose: ${handoff.purpose} | Status: ${handoff.status}`,
      `Progress: ${handoff.sections_completed}/${handoff.sections_total}`,
      handoff.vault_path ? `Vault: ${handoff.vault_path}` : null,
      '',
      '## Sections',
      remaining || '(none)',
      '',
      handoff.notes ? `## Notes\n${handoff.notes}` : null,
    ].filter(Boolean).join('\n');
    navigator.clipboard.writeText(text).then(() => {
      setCopyLabel('Copied!');
      setTimeout(() => setCopyLabel('Copy to CC'), 2000);
    });
  }

  if (loading) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="max-w-[1280px] mx-auto px-8 py-7 flex items-center justify-center" style={{ height: 240 }}>
          <div className="w-6 h-6 rounded-full border-2 border-[var(--primary)] border-t-transparent animate-spin" />
        </div>
      </div>
    );
  }

  if (notFound || !handoff) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="max-w-[1280px] mx-auto px-8 py-7" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Link href="/handoffs" style={{ color: 'var(--primary-2)', fontSize: 'var(--t-sm)' }}>← Handoffs</Link>
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
            Handoff <code style={{ fontFamily: 'ui-monospace' }}>{id}</code> not found.
          </div>
        </div>
      </div>
    );
  }

  const purpose = handoff.purpose ?? purposeFromEntry(handoff.entry_point);
  const progress = handoff.sections_total > 0
    ? Math.round((handoff.sections_completed / handoff.sections_total) * 100)
    : 0;
  const shortId = handoff.handoff_code || handoff.id.slice(0, 8);

  return (
    <div className="h-full overflow-y-auto" data-testid="handoff-detail-page">
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
              <Breadcrumb handoff={handoff} shortId={shortId} />
              <h1
                className="font-semibold tracking-tight"
                style={{ fontSize: 'var(--t-h1)', marginTop: 6, color: 'var(--text)' }}
              >
                {handoff.scope_name}
              </h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                <PurposeChip purpose={purpose} />
                <StatusBadge status={handoff.status} />
                {handoff.version && (
                  <span style={{ fontFamily: 'ui-monospace', fontSize: 10, color: 'var(--text3)' }}>
                    {handoff.version}
                  </span>
                )}
                {handoff.is_mounted && (
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 700,
                      letterSpacing: '.08em',
                      padding: '2px 8px',
                      borderRadius: 4,
                      background: 'var(--primary)',
                      color: '#fff',
                    }}
                  >
                    MOUNTED
                  </span>
                )}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <GhostButton onClick={handleCopy}>{copyLabel}</GhostButton>
            {handoff.status !== 'completed' && (
              <GhostButton onClick={handleToggleMount} disabled={acting}>
                {handoff.is_mounted ? '⌀ Unmount' : 'Mount'}
              </GhostButton>
            )}
            {handoff.status === 'open' && (
              <PrimaryButton onClick={() => handleStatus('picked_up')} disabled={acting}>Pick up →</PrimaryButton>
            )}
            {handoff.status === 'picked_up' && (
              <PrimaryButton onClick={() => handleStatus('completed')} disabled={acting}>Mark complete</PrimaryButton>
            )}
            {handoff.status === 'completed' && (
              <GhostButton onClick={() => handleStatus('open')} disabled={acting}>Reopen</GhostButton>
            )}
          </div>
        </div>

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
            {/* Progression */}
            <SectionCard>
              <SectionHead title="Progression" rightText={`${handoff.sections_completed}/${handoff.sections_total} · ${progress}%`} />
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
              {(handoff.sections_remaining || []).length > 0 && (
                <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {(handoff.sections_remaining || []).map((s, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--t-sm)' }}>
                      <span
                        style={{
                          width: 14,
                          height: 14,
                          borderRadius: 3,
                          border: '1px solid var(--border)',
                          background: s.status === 'done' ? 'var(--success)' : 'transparent',
                          color: '#fff',
                          fontSize: 9,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        {s.status === 'done' ? '✓' : ''}
                      </span>
                      <span style={{ color: s.status === 'done' ? 'var(--text3)' : 'var(--text)', textDecoration: s.status === 'done' ? 'line-through' : 'none' }}>
                        {s.name}
                      </span>
                      {s.notes && (
                        <span style={{ fontSize: 'var(--t-tiny)', color: 'var(--text4)', marginLeft: 'auto' }}>
                          {s.notes}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>

            {/* Summary / Notes body */}
            {handoff.notes && (
              <SectionCard>
                <SectionHead title="Summary" />
                <p
                  style={{
                    fontSize: 'var(--t-sm)',
                    color: 'var(--text2)',
                    lineHeight: 1.6,
                    whiteSpace: 'pre-wrap',
                    margin: 0,
                  }}
                >
                  {handoff.notes}
                </p>
              </SectionCard>
            )}

            {/* Sessions */}
            <SectionCard>
              <SectionHead title="Sessions" count={handoff.sessions.length} rightText="newest first · click to drill" />
              {handoff.sessions.length === 0 ? (
                <EmptyRow label="No sessions linked yet" />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {handoff.sessions.map((s) => {
                    const tokens = (s.input_tokens || 0) + (s.output_tokens || 0);
                    return (
                      <Link
                        key={s.id}
                        href={`/session/${encodeURIComponent(s.id)}`}
                        style={{
                          display: 'flex',
                          gap: 12,
                          alignItems: 'flex-start',
                          padding: '12px 10px',
                          borderBottom: '1px solid var(--border)',
                          textDecoration: 'none',
                          color: 'inherit',
                        }}
                      >
                        <span
                          style={{
                            width: 10, height: 10,
                            borderRadius: '50%',
                            background: s.role === 'picked_up' ? 'var(--primary)' : 'var(--success)',
                            marginTop: 6,
                            flexShrink: 0,
                          }}
                        />
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 'var(--t-sm)', color: 'var(--text)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {s.session_code || s.id.slice(0, 8)} — {s.title || 'Untitled'}
                          </div>
                          <div style={{ fontSize: 'var(--t-tiny)', color: 'var(--text3)', marginTop: 2, display: 'flex', gap: 6, alignItems: 'center' }}>
                            {s.surface && <SurfacePill surface={s.surface} />}
                            <span>{s.session_date}</span>
                            <span style={{ color: 'var(--text4)' }}>·</span>
                            <span>{s.role === 'picked_up' ? 'picked up' : 'created'}</span>
                          </div>
                        </span>
                        <span style={{ fontSize: 'var(--t-tiny)', color: 'var(--text3)', textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ color: 'var(--text)', fontWeight: 600 }}>{fmtTokens(tokens)}</div>
                          <div>${(Number(s.cost_usd) || 0).toFixed(2)}</div>
                        </span>
                      </Link>
                    );
                  })}
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
                <KvRow k="Purpose" v={<PurposeChip purpose={purpose} />} />
                <KvRow k="Status" v={<StatusBadge status={handoff.status} />} />
                {handoff.version && (
                  <KvRow k="Version" v={<code style={{ fontFamily: 'ui-monospace', fontSize: 11 }}>{handoff.version}</code>} />
                )}
                <KvRow k="Sessions" v={String(handoff.sessions.length)} />
                <KvRow k="Tokens" v={fmtTokens(handoff.tokens_total)} />
                <KvRow k="Cost" v={`$${handoff.cost_total.toFixed(2)}`} />
                <KvRow k="Progress" v={`${handoff.sections_completed} / ${handoff.sections_total}`} />
                <KvRow k="Updated" v={timeAgo(handoff.updated_at)} />
              </KvList>
            </SectionCard>

            {/* Linked */}
            <SectionCard>
              <SectionHead title="Linked" />
              <KvList>
                <KvRow k="Project" v={
                  <Link href={handoff.project?.entity_type ? `/entity/${encodeURIComponent(handoff.project_key)}` : `/project/${encodeURIComponent(handoff.project_key)}`}
                    style={{ fontFamily: 'ui-monospace', fontSize: 11, color: 'var(--primary-2)', textDecoration: 'none' }}>
                    {handoff.project_key}
                  </Link>
                } />
                <KvRow k="Scope" v={<span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--text2)' }}>{handoff.scope_type}</span>} />
                {handoff.entry_point && (
                  <KvRow k="Entry" v={<code style={{ fontFamily: 'ui-monospace', fontSize: 11 }}>{handoff.entry_point}</code>} />
                )}
                {handoff.vault_path && (
                  <KvRow k="Vault" v={
                    <span style={{ fontFamily: 'ui-monospace', fontSize: 10, color: 'var(--text3)', wordBreak: 'break-all' }}>
                      {handoff.vault_path}
                    </span>
                  } />
                )}
                <KvRow k="Code" v={<code style={{ fontFamily: 'ui-monospace', fontSize: 11 }}>{shortId}</code>} />
                <KvRow k="Source" v={<span style={{ fontSize: 10, color: 'var(--text3)' }}>{handoff.source}</span>} />
              </KvList>
            </SectionCard>

            {/* Notes */}
            <SectionCard>
              <SectionHead title="Notes" count={handoff.attached_notes.length} />
              {handoff.attached_notes.length === 0 ? (
                <EmptyRow label="No unresolved notes" />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {handoff.attached_notes.slice(0, 6).map((n) => (
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

function Breadcrumb({ handoff, shortId }: { handoff: HandoffDetail; shortId: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--t-tiny)', color: 'var(--text3)', flexWrap: 'wrap' }}>
      <Link href="/handoffs" style={{ color: 'var(--text3)', textDecoration: 'none' }}>Handoffs</Link>
      <span style={{ color: 'var(--text4)' }}>›</span>
      <Link
        href={handoff.project?.entity_type ? `/entity/${encodeURIComponent(handoff.project_key)}` : `/project/${encodeURIComponent(handoff.project_key)}`}
        style={{ fontFamily: 'ui-monospace', color: 'var(--text3)', textDecoration: 'none' }}
      >
        {handoff.project_key}
      </Link>
      <span style={{ color: 'var(--text4)' }}>›</span>
      <span style={{ textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--text3)' }}>
        {handoff.scope_type}
      </span>
      <span style={{ color: 'var(--text4)' }}>·</span>
      <span style={{ fontFamily: 'ui-monospace', color: 'var(--primary-2)', fontWeight: 600 }}>{shortId}</span>
    </div>
  );
}

function SurfacePill({ surface }: { surface: string }) {
  const COLORS: Record<string, { bg: string; fg: string }> = {
    CODE:   { bg: 'var(--primary-dim)', fg: 'var(--primary-2)' },
    CHAT:   { bg: 'var(--success-dim)', fg: 'var(--success)' },
    COWORK: { bg: 'var(--purple-dim)',  fg: 'var(--purple)' },
    MOBILE: { bg: 'var(--warn-dim)',    fg: 'var(--warn)' },
  };
  const c = COLORS[surface] || { bg: 'var(--card-alt)', fg: 'var(--text3)' };
  return (
    <span style={{
      fontSize: 9,
      fontWeight: 700,
      padding: '1px 5px',
      borderRadius: 3,
      background: c.bg,
      color: c.fg,
      textTransform: 'uppercase',
      letterSpacing: '.04em',
    }}>
      {surface}
    </span>
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

function SectionHead({ title, count, rightText }: { title: string; count?: number; rightText?: string }) {
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
      {rightText && (
        <span style={{ marginLeft: 'auto', fontSize: 'var(--t-tiny)', color: 'var(--text3)' }}>
          {rightText}
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
      <span style={{ color: 'var(--text)', fontVariantNumeric: 'tabular-nums', fontWeight: 500, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v}</span>
    </div>
  );
}

function GhostButton({ children, onClick, disabled }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
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
    >
      {children}
    </button>
  );
}

function PrimaryButton({ children, onClick, disabled }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
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
    >
      {children}
    </button>
  );
}
