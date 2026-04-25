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
  mission_display_name?: string | null;
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
    patchHandoff(handoff, { is_mounted: !handoff.is_mounted }, {
      onSuccess: () => { setActing(false); refresh(); },
      onError: () => { setActing(false); },
    });
  }

  function handleStatus(newStatus: string) {
    if (!handoff || acting) return;
    setActing(true);
    patchHandoff(handoff, newStatus, {
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
        <div className="max-w-[1280px] mx-auto px-4 md:px-8 py-5 md:py-7 flex items-center justify-center" style={{ height: 240 }}>
          <div className="w-6 h-6 rounded-full border-2 border-[var(--primary)] border-t-transparent animate-spin" />
        </div>
      </div>
    );
  }

  if (notFound || !handoff) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="max-w-[1280px] mx-auto px-4 md:px-8 py-5 md:py-7" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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
      <div className="max-w-[1280px] mx-auto px-4 md:px-8 py-5 md:py-7" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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
              <Breadcrumb handoff={handoff} />
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

            {/* Summary timeline */}
            {handoff.notes && (() => {
              const sections = parseSummarySections(handoff.notes);
              if (sections.length === 0) return null;
              return (
                <SectionCard>
                  <SectionHead title="Summary" count={sections.length} rightText="click to expand" />
                  <SummaryTimeline sections={sections} />
                </SectionCard>
              );
            })()}

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

interface ParsedSection {
  title: string;
  body: string;
  status: 'done' | 'in-progress' | 'todo';
  date: string | null;
  sessionRefs: string[];
}

function parseSummarySections(notes: string): ParsedSection[] {
  const lines = notes.split('\n');
  const sections: { title: string; bodyLines: string[] }[] = [];
  let current: { title: string; bodyLines: string[] } | null = null;
  const intro: string[] = [];

  for (const line of lines) {
    const m = line.match(/^#{2,3}\s+(.+?)\s*$/);
    if (m) {
      if (current) sections.push(current);
      current = { title: m[1], bodyLines: [] };
    } else if (current) {
      current.bodyLines.push(line);
    } else {
      intro.push(line);
    }
  }
  if (current) sections.push(current);

  if (sections.length === 0) {
    const body = intro.join('\n').trim();
    if (!body) return [];
    return [{ title: 'Summary', body, status: deriveStatus(body), date: extractDate(body), sessionRefs: extractSessionRefs(body) }];
  }
  if (intro.some((l) => l.trim())) {
    sections.unshift({ title: 'Overview', bodyLines: intro });
  }

  return sections.map((s) => {
    const body = s.bodyLines.join('\n').trim();
    return {
      title: s.title,
      body,
      status: deriveStatus(body),
      date: extractDate(body),
      sessionRefs: extractSessionRefs(body),
    };
  });
}

function deriveStatus(body: string): 'done' | 'in-progress' | 'todo' {
  // Tier 1: GFM checkboxes — most explicit signal.
  const checkboxes = [...body.matchAll(/^\s*[-*\d.]+\s*\[([ xX])\]/gm)];
  if (checkboxes.length > 0) {
    const done = checkboxes.filter((c) => c[1].toLowerCase() === 'x').length;
    if (done === checkboxes.length) return 'done';
    if (done > 0) return 'in-progress';
    return 'todo';
  }

  // Tier 2: emoji status markers (✅ / ❌ / ⏳ / 🚧 / ⚠️).
  // Counted at line-start OR at the start of bold/list segments — these are bullet status, not prose.
  const emojiHits = [...body.matchAll(/(?:^|^[-*\d.]+\s*|\*\*\s*)(✅|❌|⏳|🚧|⚠️)/gmu)];
  // Tier 3: keyword markers — DONE / DEFERRED / BLOCKED / PENDING / IN PROGRESS / USER ACTION / TODO.
  const doneKw = (body.match(/\b(DONE|COMPLETED|SHIPPED)\b/g) || []).length;
  const pendingKw = (body.match(/\b(DEFERRED|BLOCKED|PENDING|TODO|USER ACTION|IN[-\s]PROGRESS|WIP)\b/g) || []).length;

  const doneEmoji = emojiHits.filter((m) => m[1] === '✅').length;
  const pendingEmoji = emojiHits.filter((m) => m[1] !== '✅').length;

  const doneTotal = doneEmoji + doneKw;
  const pendingTotal = pendingEmoji + pendingKw;

  if (doneTotal === 0 && pendingTotal === 0) return 'todo'; // No signal → conservative default for handoff doc.
  if (pendingTotal === 0) return 'done';
  if (doneTotal === 0) return 'todo';
  return 'in-progress';
}

function extractDate(body: string): string | null {
  const m = body.match(/\b(20\d\d-\d\d-\d\d)\b/);
  return m ? m[1] : null;
}

function extractSessionRefs(body: string): string[] {
  const refs = new Set<string>();
  const re = /session[\s:_-]+([a-z0-9-]{6,})/gi;
  let m;
  while ((m = re.exec(body)) !== null) refs.add(m[1]);
  return Array.from(refs);
}

function SummaryTimeline({ sections }: { sections: ParsedSection[] }) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  return (
    <div style={{ position: 'relative', paddingLeft: 22 }}>
      {sections.length > 1 && (
        <div
          style={{
            position: 'absolute',
            left: 5,
            top: 10,
            bottom: 10,
            width: 0,
            borderLeft: '1px dashed var(--border)',
          }}
        />
      )}
      {sections.map((s, i) => {
        const color = s.status === 'done' ? 'var(--success)' : s.status === 'in-progress' ? 'var(--primary-2)' : 'var(--text4)';
        const expanded = expandedIdx === i;
        return (
          <div key={i} style={{ position: 'relative', marginBottom: i === sections.length - 1 ? 0 : 14 }}>
            <span
              style={{
                position: 'absolute',
                left: -22,
                top: 5,
                width: 11,
                height: 11,
                borderRadius: '50%',
                background: s.status === 'todo' ? 'var(--bg)' : color,
                border: `2px solid ${color}`,
                boxSizing: 'border-box',
              }}
            />
            <div
              onClick={() => setExpandedIdx(expanded ? null : i)}
              style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 4 }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 'var(--t-sm)', color: 'var(--text)', fontWeight: 500 }}>{s.title}</span>
                <TimelineStatusPill status={s.status} />
                {s.date && (
                  <span style={{ fontFamily: 'ui-monospace', fontSize: 'var(--t-tiny)', color: 'var(--text3)' }}>
                    {s.date}
                  </span>
                )}
                {s.sessionRefs.length > 0 && (
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {s.sessionRefs.slice(0, 3).map((ref) => (
                      <Link
                        key={ref}
                        href={`/session/${encodeURIComponent(ref)}`}
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          fontFamily: 'ui-monospace',
                          fontSize: 9,
                          padding: '1px 6px',
                          borderRadius: 3,
                          background: 'var(--primary-dim)',
                          color: 'var(--primary-2)',
                          textDecoration: 'none',
                        }}
                      >
                        {ref.slice(0, 8)}
                      </Link>
                    ))}
                    {s.sessionRefs.length > 3 && (
                      <span style={{ fontSize: 9, color: 'var(--text3)' }}>+{s.sessionRefs.length - 3}</span>
                    )}
                  </div>
                )}
                <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text4)' }}>{expanded ? '▾' : '▸'}</span>
              </div>
            </div>
            {expanded && s.body && (
              <div style={{ marginTop: 8 }}>
                <RichBody body={s.body} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function TimelineStatusPill({ status }: { status: 'done' | 'in-progress' | 'todo' }) {
  const config = {
    'done': { label: 'done', bg: 'var(--success-dim)', fg: 'var(--success)' },
    'in-progress': { label: 'in progress', bg: 'var(--primary-dim)', fg: 'var(--primary-2)' },
    'todo': { label: 'todo', bg: 'var(--card-alt)', fg: 'var(--text3)' },
  }[status];
  return (
    <span
      style={{
        fontSize: 9,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '.06em',
        padding: '1px 6px',
        borderRadius: 3,
        background: config.bg,
        color: config.fg,
      }}
    >
      {config.label}
    </span>
  );
}

// ============================================================
// RichBody — structured renderer for handoff timeline expansion
// Splits on bold-prefixed sub-blocks (**Build —**, **Test —**),
// renders bullets/numbered lists, surfaces ✅/⏳/❌ as status dots,
// pills out status keywords (DONE, DEFERRED, BLOCKER, USER ACTION),
// styles `code` and **bold** inline, and turns URLs into links.
// ============================================================

interface SubBlock {
  heading: string | null;
  status: 'done' | 'in-progress' | 'todo' | null;
  bodyLines: string[];
}

function splitSubBlocks(body: string): SubBlock[] {
  const lines = body.split('\n');
  const blocks: SubBlock[] = [];
  let current: SubBlock = { heading: null, bodyLines: [], status: null };

  for (const line of lines) {
    // Match either "### Heading" / "**Heading**" / "**Build — ✅ DONE 2026-04-25**"
    const md = line.match(/^#{3,4}\s+(.+?)\s*$/);
    const bold = line.match(/^\*\*([^*]+?)\*\*\s*$/);
    const m = md || bold;
    if (m) {
      if (current.heading || current.bodyLines.length > 0) blocks.push(current);
      const raw = m[1].trim();
      // Strip emoji + status keywords from heading; the status pill carries that info.
      const cleanHeading = raw
        .replace(/(✅|❌|⏳|🚧|⚠️)\s*/g, '')
        .replace(/\b(DONE|COMPLETED|SHIPPED|DEFERRED|BLOCKED|BLOCKER|PENDING|TODO|USER ACTION|IN[-\s]PROGRESS|WIP)(?:\s+(?:to\s+)?20\d\d-\d\d-\d\d)?\b\s*/gi, '')
        .replace(/\s{2,}/g, ' ')
        .replace(/\s*[—-]\s*$/, '')
        .trim();
      current = { heading: cleanHeading, bodyLines: [], status: null };
      // Stash heading raw on the block so we can fold its status signal into the block status later.
      current.bodyLines.push(`__HEADING_STATUS__:${raw}`);
    } else {
      current.bodyLines.push(line);
    }
  }
  if (current.heading || current.bodyLines.length > 0) blocks.push(current);

  // Resolve each block's status from heading + body combined.
  for (const b of blocks) {
    const headingStatusLine = b.bodyLines.find((l) => l.startsWith('__HEADING_STATUS__:'));
    const headingRaw = headingStatusLine ? headingStatusLine.replace('__HEADING_STATUS__:', '') : '';
    b.bodyLines = b.bodyLines.filter((l) => !l.startsWith('__HEADING_STATUS__:'));
    b.status = deriveStatus(`${headingRaw}\n${b.bodyLines.join('\n')}`);
  }
  return blocks;
}

interface ParsedLine {
  kind: 'bullet' | 'number' | 'prose' | 'code-fence' | 'blank';
  text: string;
  number?: string;
  marker?: '✅' | '❌' | '⏳' | '🚧' | '⚠️' | null;
  fenceLang?: string;
}

function parseLines(bodyLines: string[]): ParsedLine[] {
  const out: ParsedLine[] = [];
  let inFence = false;
  let fenceBuf: string[] = [];
  let fenceLang = '';

  for (const raw of bodyLines) {
    const fence = raw.match(/^\s*```(\w*)\s*$/);
    if (fence) {
      if (inFence) {
        out.push({ kind: 'code-fence', text: fenceBuf.join('\n'), fenceLang });
        fenceBuf = [];
        fenceLang = '';
        inFence = false;
      } else {
        inFence = true;
        fenceLang = fence[1] || '';
      }
      continue;
    }
    if (inFence) {
      fenceBuf.push(raw);
      continue;
    }

    if (!raw.trim()) {
      out.push({ kind: 'blank', text: '' });
      continue;
    }

    const numMatch = raw.match(/^\s*(\d+)\.\s+(.*)$/);
    const bulMatch = raw.match(/^\s*[-*]\s+(.*)$/);
    if (numMatch) {
      const { marker, rest } = extractMarker(numMatch[2]);
      out.push({ kind: 'number', number: numMatch[1], text: rest, marker });
    } else if (bulMatch) {
      const { marker, rest } = extractMarker(bulMatch[1]);
      out.push({ kind: 'bullet', text: rest, marker });
    } else {
      out.push({ kind: 'prose', text: raw, marker: null });
    }
  }
  if (inFence && fenceBuf.length > 0) {
    out.push({ kind: 'code-fence', text: fenceBuf.join('\n'), fenceLang });
  }
  return out;
}

function extractMarker(text: string): { marker: ParsedLine['marker']; rest: string } {
  const m = text.match(/^(✅|❌|⏳|🚧|⚠️)\s*(.*)$/u);
  if (m) return { marker: m[1] as ParsedLine['marker'], rest: m[2] };
  return { marker: null, rest: text };
}

const KEYWORD_PILLS: Array<{ re: RegExp; label: string; tone: 'done' | 'pending' | 'block' | 'info' }> = [
  { re: /\bDONE(?:\s+20\d\d-\d\d-\d\d)?\b/, label: 'DONE', tone: 'done' },
  { re: /\bCOMPLETED\b/, label: 'DONE', tone: 'done' },
  { re: /\bSHIPPED\b/, label: 'SHIPPED', tone: 'done' },
  { re: /\bDEFERRED(?:\s+to\s+20\d\d-\d\d-\d\d)?\b/, label: 'DEFERRED', tone: 'pending' },
  { re: /\bBLOCKED\b|\bBLOCKER\b/, label: 'BLOCKED', tone: 'block' },
  { re: /\bUSER ACTION\b/, label: 'USER ACTION', tone: 'pending' },
  { re: /\bPENDING\b/, label: 'PENDING', tone: 'pending' },
  { re: /\bIN[-\s]PROGRESS\b|\bWIP\b/, label: 'IN PROGRESS', tone: 'pending' },
  { re: /\bTODO\b/, label: 'TODO', tone: 'pending' },
];

function pillStyles(tone: 'done' | 'pending' | 'block' | 'info'): { bg: string; fg: string } {
  if (tone === 'done') return { bg: 'var(--success-dim)', fg: 'var(--success)' };
  if (tone === 'pending') return { bg: 'var(--primary-dim)', fg: 'var(--primary-2)' };
  if (tone === 'block') return { bg: 'var(--warn-dim)', fg: 'var(--warn)' };
  return { bg: 'var(--card-alt)', fg: 'var(--text2)' };
}

function StatusKeywordPill({ label, tone }: { label: string; tone: 'done' | 'pending' | 'block' | 'info' }) {
  const c = pillStyles(tone);
  return (
    <span
      style={{
        display: 'inline-block',
        fontSize: 9,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '.06em',
        padding: '1px 6px',
        borderRadius: 3,
        background: c.bg,
        color: c.fg,
        verticalAlign: 'middle',
      }}
    >
      {label}
    </span>
  );
}

function MarkerDot({ marker }: { marker: NonNullable<ParsedLine['marker']> }) {
  const config: Record<string, { bg: string; fg: string; symbol: string }> = {
    '✅': { bg: 'var(--success)',  fg: '#fff', symbol: '✓' },
    '❌': { bg: 'var(--warn)',     fg: '#fff', symbol: '×' },
    '⏳': { bg: 'var(--primary)',  fg: '#fff', symbol: '⏳' },
    '🚧': { bg: 'var(--warn-dim)', fg: 'var(--warn)', symbol: '!' },
    '⚠️': { bg: 'var(--warn-dim)', fg: 'var(--warn)', symbol: '!' },
  };
  const c = config[marker] || config['⏳'];
  return (
    <span
      style={{
        width: 16,
        height: 16,
        borderRadius: '50%',
        background: c.bg,
        color: c.fg,
        fontSize: 10,
        fontWeight: 700,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        lineHeight: 1,
      }}
    >
      {c.symbol}
    </span>
  );
}

function renderInline(text: string, keyPrefix: string): React.ReactNode {
  // Strip leading status keywords — we'll prepend them as pills.
  const pills: Array<{ label: string; tone: 'done' | 'pending' | 'block' | 'info' }> = [];
  let working = text;

  // Pull bold-wrapped status keywords (e.g. "**DONE 2026-04-25**") to pills.
  working = working.replace(/\*\*([^*]+)\*\*/g, (_full, inner) => {
    const trimmed = inner.trim();
    for (const k of KEYWORD_PILLS) {
      if (k.re.test(trimmed) && trimmed.length < 40) {
        pills.push({ label: trimmed.toUpperCase(), tone: k.tone });
        return '';
      }
    }
    return `${inner}`; // placeholder for bold-not-pill
  });

  working = working.replace(/^\s*[—-]\s*/, '').trim();

  // Tokenize: code spans `…`, bold placeholders, links, raw URLs, plain text.
  const parts: React.ReactNode[] = [];
  const tokenRe = /(`[^`]+`)|(\[[^\]]+\]\([^)]+\))|(https?:\/\/[^\s)]+)/g;
  let lastIdx = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = tokenRe.exec(working)) !== null) {
    if (m.index > lastIdx) parts.push(working.slice(lastIdx, m.index));
    const tok = m[0];
    if (tok.startsWith('`')) {
      parts.push(
        <code
          key={`${keyPrefix}-c-${i++}`}
          style={{
            fontFamily: 'ui-monospace, SFMono-Regular, monospace',
            fontSize: '0.92em',
            padding: '1px 5px',
            background: 'var(--card-alt)',
            border: '1px solid var(--border)',
            borderRadius: 3,
            color: 'var(--text)',
          }}
        >
          {tok.slice(1, -1)}
        </code>,
      );
    } else if (tok.startsWith('[')) {
      const lm = tok.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (lm) {
        parts.push(
          <a
            key={`${keyPrefix}-l-${i++}`}
            href={lm[2]}
            target="_blank"
            rel="noreferrer noopener"
            style={{ color: 'var(--primary-2)', textDecoration: 'underline' }}
          >
            {lm[1]}
          </a>,
        );
      }
    } else {
      // Bare URL.
      parts.push(
        <a
          key={`${keyPrefix}-u-${i++}`}
          href={tok}
          target="_blank"
          rel="noreferrer noopener"
          style={{ color: 'var(--primary-2)', textDecoration: 'underline', wordBreak: 'break-all' }}
        >
          {tok.replace(/^https?:\/\//, '')}
        </a>,
      );
    }
    lastIdx = m.index + tok.length;
  }
  if (lastIdx < working.length) parts.push(working.slice(lastIdx));

  return (
    <>
      {pills.map((p, idx) => (
        <span key={`${keyPrefix}-p-${idx}`} style={{ marginRight: 6 }}>
          <StatusKeywordPill label={p.label} tone={p.tone} />
        </span>
      ))}
      {parts}
    </>
  );
}

function RichBody({ body }: { body: string }) {
  const blocks = splitSubBlocks(body);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {blocks.map((b, bi) => (
        <SubBlockCard key={bi} block={b} keyPrefix={`b${bi}`} />
      ))}
    </div>
  );
}

function SubBlockCard({ block, keyPrefix }: { block: SubBlock; keyPrefix: string }) {
  const lines = parseLines(block.bodyLines);
  // Skip leading/trailing blank lines.
  while (lines.length && lines[0].kind === 'blank') lines.shift();
  while (lines.length && lines[lines.length - 1].kind === 'blank') lines.pop();
  if (!block.heading && lines.length === 0) return null;

  const accent =
    block.status === 'done' ? 'var(--success)' :
    block.status === 'in-progress' ? 'var(--primary-2)' :
    block.status === 'todo' ? 'var(--text4)' :
    'var(--border)';

  return (
    <div
      style={{
        background: 'var(--bg)',
        border: '1px solid var(--border)',
        borderLeft: `3px solid ${accent}`,
        borderRadius: 'var(--r-sm)',
        padding: '10px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      {block.heading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 'var(--t-sm)', fontWeight: 600, color: 'var(--text)' }}>
            {block.heading}
          </span>
          {block.status && <TimelineStatusPill status={block.status} />}
        </div>
      )}
      {lines.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {lines.map((ln, li) => (
            <RenderedLine key={li} line={ln} keyPrefix={`${keyPrefix}-${li}`} />
          ))}
        </div>
      )}
    </div>
  );
}

function RenderedLine({ line, keyPrefix }: { line: ParsedLine; keyPrefix: string }) {
  if (line.kind === 'blank') return <div style={{ height: 4 }} />;

  if (line.kind === 'code-fence') {
    return (
      <pre
        style={{
          margin: '4px 0',
          padding: '8px 10px',
          background: 'var(--card-alt)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--r-sm)',
          fontFamily: 'ui-monospace, SFMono-Regular, monospace',
          fontSize: 11,
          color: 'var(--text)',
          overflowX: 'auto',
          lineHeight: 1.5,
        }}
      >
        {line.text}
      </pre>
    );
  }

  if (line.kind === 'prose') {
    return (
      <div
        style={{
          fontSize: 'var(--t-sm)',
          color: 'var(--text2)',
          lineHeight: 1.6,
        }}
      >
        {renderInline(line.text, keyPrefix)}
      </div>
    );
  }

  // Bullet/number rows: marker dot replaces the bullet glyph when present (no double indent).
  // Numbered rows always show the number, even when marked, so list ordering stays readable.
  const showGlyph = line.kind === 'number' || !line.marker;
  const glyph = line.kind === 'number' ? `${line.number}.` : '•';

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: showGlyph && line.marker ? 'auto auto 1fr'
          : showGlyph ? 'auto 1fr'
          : line.marker ? 'auto 1fr'
          : '1fr',
        gap: 8,
        alignItems: 'baseline',
        fontSize: 'var(--t-sm)',
        color: 'var(--text2)',
        lineHeight: 1.6,
      }}
    >
      {showGlyph && (
        <span
          style={{
            color: 'var(--text4)',
            fontVariantNumeric: 'tabular-nums',
            fontFamily: line.kind === 'number' ? 'ui-monospace, SFMono-Regular, monospace' : 'inherit',
            fontSize: line.kind === 'number' ? 11 : 'var(--t-sm)',
            minWidth: line.kind === 'number' ? 18 : 12,
          }}
        >
          {glyph}
        </span>
      )}
      {line.marker && (
        <span style={{ alignSelf: 'center' }}>
          <MarkerDot marker={line.marker} />
        </span>
      )}
      <span>{renderInline(line.text, keyPrefix)}</span>
    </div>
  );
}

function Breadcrumb({ handoff }: { handoff: HandoffDetail }) {
  const missionName = (handoff as HandoffDetail & { mission_display_name?: string | null }).mission_display_name;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--t-tiny)', color: 'var(--text3)', flexWrap: 'wrap' }}>
      <Link href="/handoffs" style={{ color: 'var(--text3)', textDecoration: 'none' }}>Handoffs</Link>
      <span style={{ color: 'var(--text4)' }}>›</span>
      <Link
        href={handoff.project?.entity_type ? `/entity/${encodeURIComponent(handoff.project_key)}` : `/project/${encodeURIComponent(handoff.project_key)}`}
        style={{ fontFamily: 'ui-monospace', color: 'var(--text3)', textDecoration: 'none' }}
      >
        {handoff.project?.display_name || handoff.project_key}
      </Link>
      {missionName && (
        <>
          <span style={{ color: 'var(--text4)' }}>›</span>
          <span style={{ color: 'var(--text3)' }}>{missionName}</span>
        </>
      )}
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
