'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { StatusBadge } from '@/components/status-badge';
import { PurposeChip, purposeFromEntry } from '@/components/handoff-card';
import { ReattributeStrip } from '@/components/reattribute-strip';
import { ReattributionToast } from '@/components/reattribution-toast';
import type { SessionLog, SessionEvent, Task, Handoff } from '@/lib/types';

interface SessionDetail extends SessionLog {
  task_ids?: string[] | null;
}

type TouchedTask = Pick<Task, 'id' | 'text' | 'task_code' | 'project_key' | 'bucket' | 'priority' | 'completed' | 'mission' | 'parent_task_id'>;

function fmtTokens(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

const SURFACE_STYLE: Record<string, { bg: string; fg: string }> = {
  CODE:   { bg: 'var(--primary-dim)', fg: 'var(--primary-2)' },
  CHAT:   { bg: 'var(--success-dim)', fg: 'var(--success)' },
  COWORK: { bg: 'var(--purple-dim)',  fg: 'var(--purple)' },
  MOBILE: { bg: 'var(--warn-dim)',    fg: 'var(--warn)' },
};

function buildHandoffText(session: SessionDetail, events: SessionEvent[], tasks: TouchedTask[]): string {
  const lines: string[] = [];
  lines.push(`## ${session.session_code || 'Session'} — ${session.title || 'Untitled'}`);
  lines.push(`> Project: ${session.project_key || '—'} | Surface: ${session.surface} | Date: ${session.session_date}`);
  lines.push('');
  if (session.summary) {
    lines.push('### What was done');
    lines.push(session.summary);
    lines.push('');
  }
  if (events.length > 0) {
    lines.push('### Key events');
    for (const e of events) {
      const label = e.event_type.replace(/_/g, ' ');
      lines.push(`- **${label}**: ${e.detail || '(no detail)'}`);
    }
    lines.push('');
  }
  if (tasks.length > 0) {
    lines.push('### Tasks touched');
    for (const t of tasks) {
      lines.push(`- ${t.task_code ? `[${t.task_code}] ` : ''}${t.text}${t.completed ? ' ✓' : ''}`);
    }
    lines.push('');
  }
  lines.push('### Metrics');
  lines.push(`- ${fmtTokens((session.input_tokens || 0) + (session.output_tokens || 0))} tokens · $${(Number(session.cost_usd) || 0).toFixed(2)}`);
  return lines.join('\n');
}

export default function SessionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [session, setSession] = useState<SessionDetail | null>(null);
  const [events, setEvents] = useState<SessionEvent[]>([]);
  const [touchedTasks, setTouchedTasks] = useState<TouchedTask[]>([]);
  const [emittedHandoffs, setEmittedHandoffs] = useState<Handoff[]>([]);
  const [mountedHandoffs, setMountedHandoffs] = useState<Handoff[]>([]);
  const [loading, setLoading] = useState(true);
  const [copyLabel, setCopyLabel] = useState('Copy Handoff');
  const [currentProjectKey, setCurrentProjectKey] = useState<string | null>(null);
  const [undoState, setUndoState] = useState<{ sessionId: string; newProjectKey: string; previousProjectKey: string | null } | null>(null);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const [{ data: sess }, { data: evts }, { data: createdHs }, { data: mountedHs }] = await Promise.all([
        supabase.from('angelo_session_logs').select('*').eq('id', id).single(),
        supabase.from('angelo_session_events').select('*').eq('session_log_id', id).order('created_at'),
        supabase.from('angelo_handoffs').select('*').eq('created_by_session_id', id),
        supabase.from('angelo_handoffs').select('*').eq('picked_up_by_session_id', id),
      ]);
      if (sess) {
        setSession(sess as SessionDetail);
        setCurrentProjectKey((sess as SessionDetail).project_key ?? null);
      }
      if (evts) setEvents(evts);
      setEmittedHandoffs(createdHs || []);
      setMountedHandoffs(mountedHs || []);

      const idSet = new Set<string>();
      const sessTyped = sess as SessionDetail | null;
      if (sessTyped?.task_ids) sessTyped.task_ids.forEach((t: string) => idSet.add(t));
      (evts || []).forEach((e: SessionEvent) => { if (e.task_id) idSet.add(e.task_id); });
      if (idSet.size > 0) {
        const { data: taskRows } = await supabase
          .from('angelo_tasks')
          .select('id, text, task_code, project_key, bucket, priority, completed, mission, parent_task_id')
          .in('id', Array.from(idSet));
        setTouchedTasks(taskRows || []);
      }
      setLoading(false);
    })();
  }, [id]);

  const handleCopy = useCallback(() => {
    if (!session) return;
    const text = buildHandoffText(session, events, touchedTasks);
    navigator.clipboard.writeText(text).then(() => {
      setCopyLabel('Copied!');
      setTimeout(() => setCopyLabel('Copy Handoff'), 2000);
    });
  }, [session, events, touchedTasks]);

  if (loading) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="max-w-[1280px] mx-auto px-4 md:px-8 py-5 md:py-7 flex items-center justify-center" style={{ height: 240 }}>
          <div className="w-6 h-6 rounded-full border-2 border-[var(--primary)] border-t-transparent animate-spin" />
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="max-w-[1280px] mx-auto px-4 md:px-8 py-5 md:py-7" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Link href="/sessions" style={{ color: 'var(--primary-2)', fontSize: 'var(--t-sm)' }}>← Sessions</Link>
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
            Session not found.
          </div>
        </div>
      </div>
    );
  }

  const surface = session.surface ? SURFACE_STYLE[session.surface] : null;
  const totalTokens = (session.input_tokens || 0) + (session.output_tokens || 0);
  const linkedHandoff = mountedHandoffs[0] ?? emittedHandoffs[0] ?? null;

  return (
    <div className="h-full overflow-y-auto" data-testid="session-detail-page">
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
              <Breadcrumb session={session} linkedHandoff={linkedHandoff} />
              <h1
                className="font-semibold tracking-tight"
                style={{ fontSize: 'var(--t-h1)', marginTop: 6, color: 'var(--text)' }}
              >
                {session.session_code || session.id.slice(0, 8)} — {session.title || 'Untitled'}
              </h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                {surface && (
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '.05em',
                      padding: '2px 8px',
                      borderRadius: 3,
                      background: surface.bg,
                      color: surface.fg,
                    }}
                  >
                    {session.surface}
                  </span>
                )}
                <span style={{ fontSize: 'var(--t-tiny)', color: 'var(--text3)' }}>
                  {session.session_date}
                </span>
                {session.entry_point && (
                  <code style={{ fontFamily: 'ui-monospace', fontSize: 10, color: 'var(--primary-2)' }}>{session.entry_point}</code>
                )}
                {session.mission && (
                  <Link href={`/mission/${encodeURIComponent(session.mission)}`} style={{ fontSize: 10, color: 'var(--success)', textDecoration: 'none' }}>
                    {session.mission}
                  </Link>
                )}
                {session.chain_id && (
                  <Link href={`/chain/${encodeURIComponent(session.chain_id)}`} style={{ fontSize: 10, color: 'var(--purple)', textDecoration: 'none' }}>
                    chain: {session.chain_id}
                  </Link>
                )}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <GhostButton onClick={handleCopy}>{copyLabel}</GhostButton>
            <GhostButton disabled>＋ Note</GhostButton>
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
            {/* Session stats */}
            <SectionCard>
              <SectionHead title="Session stats" />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0, borderRadius: 'var(--r-sm)', overflow: 'hidden', border: '1px solid var(--border)' }}>
                <StatCell label="Input" value={fmtTokens(session.input_tokens || 0)} color="var(--primary-2)" />
                <StatCell label="Output" value={fmtTokens(session.output_tokens || 0)} />
                <StatCell label="Cost" value={`$${(Number(session.cost_usd) || 0).toFixed(2)}`} color="var(--success)" />
                <StatCell label="Tokens" value={fmtTokens(totalTokens)} />
              </div>
            </SectionCard>

            {/* Summary */}
            {session.summary && (
              <SectionCard>
                <SectionHead title="Summary" />
                <p style={{ fontSize: 'var(--t-sm)', color: 'var(--text2)', lineHeight: 1.6, whiteSpace: 'pre-wrap', margin: 0 }}>
                  {session.summary}
                </p>
              </SectionCard>
            )}

            {/* Tasks touched */}
            {touchedTasks.length > 0 && (
              <SectionCard>
                <SectionHead title="Tasks touched" count={touchedTasks.length} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {touchedTasks.map((t) => (
                    <Link
                      key={t.id}
                      href={t.mission ? `/mission/${encodeURIComponent(t.mission)}` : `/project/${encodeURIComponent(t.project_key)}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '8px 10px',
                        background: 'var(--bg)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--r-sm)',
                        textDecoration: 'none',
                        color: 'inherit',
                      }}
                    >
                      <span
                        style={{
                          width: 14, height: 14,
                          borderRadius: 3,
                          border: '1px solid var(--border)',
                          background: t.completed ? 'var(--success)' : 'transparent',
                          color: '#fff',
                          fontSize: 9,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        {t.completed ? '✓' : ''}
                      </span>
                      {t.task_code && (
                        <span style={{ fontFamily: 'ui-monospace', fontSize: 10, color: 'var(--text4)' }}>{t.task_code}</span>
                      )}
                      <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--t-sm)', color: t.completed ? 'var(--text3)' : 'var(--text)', textDecoration: t.completed ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {t.text}
                      </span>
                      {t.mission && (
                        <span style={{ fontSize: 10, color: 'var(--success)' }}>{t.mission}</span>
                      )}
                      {t.priority && (
                        <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text3)' }}>{t.priority}</span>
                      )}
                    </Link>
                  ))}
                </div>
              </SectionCard>
            )}

            {/* Events */}
            {events.length > 0 && (
              <SectionCard>
                <SectionHead title="Events" count={events.length} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {events.map((e) => {
                    const color = eventColors[e.event_type] || 'var(--text3)';
                    return (
                      <div
                        key={e.id}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 10,
                          padding: '8px 10px',
                          background: 'var(--bg)',
                          border: '1px solid var(--border)',
                          borderRadius: 'var(--r-sm)',
                        }}
                      >
                        <span
                          style={{
                            width: 6, height: 6,
                            borderRadius: '50%',
                            background: color,
                            marginTop: 5,
                            flexShrink: 0,
                          }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <span
                            style={{
                              fontSize: 9,
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              letterSpacing: '.05em',
                              color,
                            }}
                          >
                            {e.event_type.replace(/_/g, ' ')}
                          </span>
                          {e.detail && (
                            <p style={{ fontSize: 'var(--t-sm)', color: 'var(--text)', margin: '2px 0 0', lineHeight: 1.5 }}>
                              {e.detail}
                            </p>
                          )}
                          <span style={{ fontSize: 'var(--t-tiny)', color: 'var(--text3)' }}>
                            {new Date(e.created_at).toLocaleTimeString()}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </SectionCard>
            )}

            {/* Handoff context (copy preview) */}
            {(session.summary || events.length > 0) && (
              <SectionCard>
                <SectionHead title="Handoff context (as captured on EOS)" />
                <pre
                  style={{
                    fontSize: 11,
                    lineHeight: 1.55,
                    color: 'var(--text2)',
                    background: 'var(--bg)',
                    padding: 12,
                    borderRadius: 'var(--r-sm)',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    overflow: 'auto',
                    maxHeight: 420,
                    border: '1px solid var(--border)',
                    fontFamily: "'SF Mono', SFMono-Regular, Menlo, monospace",
                    margin: 0,
                  }}
                >
                  {buildHandoffText(session, events, touchedTasks)}
                </pre>
              </SectionCard>
            )}
          </div>

          {/* Rail col */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Attribution */}
            <SectionCard>
              <SectionHead title="Attribution" />
              <ReattributeStrip
                sessionId={id}
                currentProjectKey={currentProjectKey}
                onReattributed={(newKey, prevKey) => {
                  setCurrentProjectKey(newKey);
                  setUndoState({ sessionId: id, newProjectKey: newKey, previousProjectKey: prevKey });
                }}
              />
            </SectionCard>

            {/* Linked handoff */}
            {linkedHandoff && (
              <SectionCard>
                <SectionHead title="Linked handoff" />
                <Link
                  href={`/handoff/${encodeURIComponent(linkedHandoff.id)}`}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    padding: '10px 12px',
                    background: 'var(--bg)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--r-sm)',
                    textDecoration: 'none',
                    color: 'inherit',
                  }}
                >
                  <div style={{ fontSize: 'var(--t-sm)', color: 'var(--text)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {linkedHandoff.scope_name}
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    <PurposeChip purpose={linkedHandoff.purpose ?? purposeFromEntry(linkedHandoff.entry_point)} />
                    <StatusBadge status={linkedHandoff.status} />
                    <span style={{ fontSize: 'var(--t-tiny)', color: 'var(--text3)' }}>
                      {linkedHandoff.sections_completed}/{linkedHandoff.sections_total}
                    </span>
                  </div>
                </Link>
                {emittedHandoffs.length > 0 && mountedHandoffs.length > 0 && emittedHandoffs[0].id !== mountedHandoffs[0].id && (
                  <div style={{ marginTop: 6, fontSize: 'var(--t-tiny)', color: 'var(--text3)' }}>
                    Also emitted: <Link href={`/handoff/${encodeURIComponent(emittedHandoffs[0].id)}`} style={{ color: 'var(--primary-2)' }}>{emittedHandoffs[0].scope_name}</Link>
                  </div>
                )}
              </SectionCard>
            )}

            {/* Details */}
            <SectionCard>
              <SectionHead title="Details" />
              <KvList>
                {session.project_key && (
                  <KvRow k="Project" v={
                    <Link href={`/project/${encodeURIComponent(session.project_key)}`} style={{ fontFamily: 'ui-monospace', fontSize: 11, color: 'var(--primary-2)', textDecoration: 'none' }}>
                      {session.project_key}
                    </Link>
                  } />
                )}
                {session.surface && (
                  <KvRow k="Surface" v={<code style={{ fontFamily: 'ui-monospace', fontSize: 11 }}>{session.surface}</code>} />
                )}
                {session.entry_point && (
                  <KvRow k="Entry" v={<code style={{ fontFamily: 'ui-monospace', fontSize: 11 }}>{session.entry_point}</code>} />
                )}
                {session.mission && (
                  <KvRow k="Mission" v={
                    <Link href={`/mission/${encodeURIComponent(session.mission)}`} style={{ color: 'var(--success)', fontSize: 11, textDecoration: 'none' }}>
                      {session.mission}
                    </Link>
                  } />
                )}
                {session.chain_id && (
                  <KvRow k="Chain" v={
                    <Link href={`/chain/${encodeURIComponent(session.chain_id)}`} style={{ color: 'var(--purple)', fontSize: 11, textDecoration: 'none' }}>
                      {session.chain_id}
                    </Link>
                  } />
                )}
                <KvRow k="Date" v={session.session_date} />
                {session.session_code && (
                  <KvRow k="Code" v={<code style={{ fontFamily: 'ui-monospace', fontSize: 11 }}>{session.session_code}</code>} />
                )}
              </KvList>
            </SectionCard>
          </div>
        </div>
      </div>

      {/* Undo toast for re-assign from detail page */}
      {undoState && (
        <ReattributionToast
          sessionId={undoState.sessionId}
          newProjectKey={undoState.newProjectKey}
          previousProjectKey={undoState.previousProjectKey}
          onUndo={async (sessionId, previousProjectKey) => {
            if (!previousProjectKey) return;
            const res = await fetch(`/api/sessions/${sessionId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ project_key: previousProjectKey }),
            });
            const result = await res.json();
            if (result.success) {
              setCurrentProjectKey(previousProjectKey);
            }
          }}
          onDismiss={() => setUndoState(null)}
        />
      )}
    </div>
  );
}

const eventColors: Record<string, string> = {
  task_completed: 'var(--success)',
  task_started: 'var(--primary-2)',
  decision_made: 'var(--purple)',
  blocker_found: 'var(--danger)',
  file_changed: 'var(--text2)',
  decision: 'var(--purple)',
};

function Breadcrumb({ session, linkedHandoff }: { session: SessionDetail; linkedHandoff: Handoff | null }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--t-tiny)', color: 'var(--text3)', flexWrap: 'wrap' }}>
      <Link href="/sessions" style={{ color: 'var(--text3)', textDecoration: 'none' }}>Sessions</Link>
      {session.project_key && (
        <>
          <span style={{ color: 'var(--text4)' }}>›</span>
          <Link
            href={`/entity/${encodeURIComponent(session.project_key)}`}
            style={{ fontFamily: 'ui-monospace', color: 'var(--text3)', textDecoration: 'none' }}
          >
            {session.project_key}
          </Link>
        </>
      )}
      {linkedHandoff && (
        <>
          <span style={{ color: 'var(--text4)' }}>›</span>
          <Link
            href={`/handoff/${encodeURIComponent(linkedHandoff.id)}`}
            style={{ fontFamily: 'ui-monospace', color: 'var(--primary-2)', textDecoration: 'none' }}
          >
            {linkedHandoff.handoff_code || linkedHandoff.id.slice(0, 8)}
          </Link>
        </>
      )}
      <span style={{ color: 'var(--text4)' }}>·</span>
      <span style={{ fontFamily: 'ui-monospace', color: 'var(--primary-2)', fontWeight: 600 }}>
        {session.session_code || session.id.slice(0, 8)}
      </span>
    </div>
  );
}

function StatCell({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ padding: '12px 8px', textAlign: 'center', background: 'var(--bg)', borderRight: '1px solid var(--border)' }}>
      <div style={{ fontSize: 17, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: color || 'var(--text)' }}>{value}</div>
      <div style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', color: 'var(--text3)', letterSpacing: '.04em', marginTop: 2 }}>{label}</div>
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
      title={disabled ? 'Coming in a later phase' : undefined}
    >
      {children}
    </button>
  );
}
