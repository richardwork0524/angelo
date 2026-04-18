"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { StickyHeader } from "@/components/sticky-header";
import { SurfaceBadge } from "@/components/surface-badge";
import { IdBadge } from "@/components/id-badge";
import type { SessionLog, SessionEvent, Project, Task, Handoff } from "@/lib/types";

/**
 * Session detail with attribution (pain #5):
 * explicit tasks touched + handoff(s) emitted this session.
 */
interface SessionDetail extends SessionLog {
  task_ids?: string[] | null;
}

interface HandoffData {
  project: Project | null;
  openTasks: Task[];
  recentSessions: SessionLog[];
}

function buildHandoffText(
  session: SessionLog,
  events: SessionEvent[],
  hd: HandoffData
): string {
  const lines: string[] = [];
  lines.push(`## Session Handoff — ${session.title || "Untitled"}`);
  lines.push(`> Project: ${session.project_key || "—"} | Surface: ${session.surface} | Date: ${session.session_date}`);
  lines.push("");

  if (session.summary) {
    lines.push("### What was done");
    lines.push(session.summary);
    lines.push("");
  }

  if (events.length > 0) {
    lines.push("### Key events");
    for (const e of events) {
      const label = e.event_type.replace(/_/g, " ");
      lines.push(`- **${label}**: ${e.detail || "(no detail)"}`);
    }
    lines.push("");
  }

  if (hd.project) {
    lines.push("### Project context");
    if (hd.project.brief) lines.push(`- **Brief:** ${hd.project.brief}`);
    if (hd.project.status) lines.push(`- **Status:** ${hd.project.status}`);
    if (hd.project.build_phase) lines.push(`- **Build phase:** ${hd.project.build_phase}`);
    if (hd.project.current_version) lines.push(`- **Version:** ${hd.project.current_version}`);
    if (hd.project.next_action) lines.push(`- **Next action:** ${hd.project.next_action}`);
    lines.push("");
  }

  if (hd.openTasks.length > 0) {
    lines.push("### Open tasks");
    const grouped: Record<string, Task[]> = {};
    for (const t of hd.openTasks) {
      const b = t.bucket || "PARKED";
      (grouped[b] ??= []).push(t);
    }
    for (const bucket of ["THIS_WEEK", "THIS_MONTH", "PARKED"]) {
      const tasks = grouped[bucket];
      if (!tasks?.length) continue;
      lines.push(`**${bucket.replace("_", " ")}**`);
      for (const t of tasks.slice(0, 10)) {
        const pri = t.priority ? ` [${t.priority}]` : "";
        const mis = t.mission ? ` (${t.mission})` : "";
        lines.push(`- ${t.text}${pri}${mis}`);
      }
      if (tasks.length > 10) lines.push(`- ... +${tasks.length - 10} more`);
    }
    lines.push("");
  }

  if (hd.recentSessions.length > 0) {
    lines.push("### Recent sessions (for continuity)");
    for (const s of hd.recentSessions) {
      const summ = s.summary ? ` — ${s.summary.slice(0, 80)}${s.summary.length > 80 ? "…" : ""}` : "";
      lines.push(`- ${s.session_date} [${s.surface}] ${s.title || "Untitled"}${summ}`);
    }
    lines.push("");
  }

  lines.push("---");
  lines.push("*Paste this at the start of your next session for continuity.*");
  return lines.join("\n");
}

export default function SessionPage() {
  const { id } = useParams<{ id: string }>();
  const [session, setSession] = useState<SessionDetail | null>(null);
  const [events, setEvents] = useState<SessionEvent[]>([]);
  const [touchedTasks, setTouchedTasks] = useState<Pick<Task, 'id' | 'text' | 'task_code' | 'project_key' | 'bucket' | 'priority' | 'completed' | 'mission' | 'parent_task_id'>[]>([]);
  const [emittedHandoffs, setEmittedHandoffs] = useState<Handoff[]>([]);
  const [mountedHandoffs, setMountedHandoffs] = useState<Handoff[]>([]);
  const [loading, setLoading] = useState(true);
  const [handoff, setHandoff] = useState<HandoffData | null>(null);
  const [handoffOpen, setHandoffOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const [{ data: sess }, { data: evts }, { data: createdHs }, { data: mountedHs }] = await Promise.all([
        supabase.from("angelo_session_logs").select("*").eq("id", id).single(),
        supabase.from("angelo_session_events").select("*").eq("session_log_id", id).order("created_at"),
        supabase.from("angelo_handoffs").select("*").eq("created_by_session_id", id),
        supabase.from("angelo_handoffs").select("*").eq("picked_up_by_session_id", id),
      ]);
      if (sess) setSession(sess as SessionDetail);
      if (evts) setEvents(evts);
      setEmittedHandoffs(createdHs || []);
      setMountedHandoffs(mountedHs || []);

      // Fetch touched tasks via (a) session_logs.task_ids[] and (b) session_events.task_id
      const idSet = new Set<string>();
      const sessTyped = sess as SessionDetail | null;
      if (sessTyped?.task_ids) sessTyped.task_ids.forEach((t) => idSet.add(t));
      (evts || []).forEach((e: SessionEvent) => { if (e.task_id) idSet.add(e.task_id); });
      if (idSet.size > 0) {
        const { data: taskRows } = await supabase
          .from("angelo_tasks")
          .select("id, text, task_code, project_key, bucket, priority, completed, mission, parent_task_id")
          .in("id", Array.from(idSet));
        setTouchedTasks(taskRows || []);
      }
      setLoading(false);
    })();
  }, [id]);

  const loadHandoff = useCallback(async () => {
    if (!session?.project_key) { setHandoffOpen(true); setHandoff({ project: null, openTasks: [], recentSessions: [] }); return; }
    const [{ data: proj }, { data: tasks }, { data: sessions }] = await Promise.all([
      supabase.from("angelo_projects").select("*").eq("child_key", session.project_key).single(),
      supabase.from("angelo_tasks").select("*").eq("project_key", session.project_key).eq("completed", false).order("priority").order("created_at"),
      supabase.from("angelo_session_logs").select("*").eq("project_key", session.project_key).order("session_date", { ascending: false }).limit(5),
    ]);
    setHandoff({ project: proj, openTasks: tasks || [], recentSessions: (sessions || []).filter((s: SessionLog) => s.id !== id) });
    setHandoffOpen(true);
  }, [session, id]);

  const copyHandoff = useCallback(() => {
    if (!session || !handoff) return;
    const text = buildHandoffText(session, events, handoff);
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }, [session, events, handoff]);

  if (loading) {
    return (
      <div className="flex flex-col h-full min-h-0 bg-[var(--bg)]">
        <StickyHeader title="Session" showBack />
        <main style={{ maxWidth: 960, margin: "0 auto", padding: "24px 16px", color: "var(--text3)" }}>
          Loading...
        </main>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex flex-col h-full min-h-0 bg-[var(--bg)]">
        <StickyHeader title="Session" showBack />
        <main style={{ maxWidth: 960, margin: "0 auto", padding: "24px 16px" }}>
          <p style={{ color: "var(--text3)" }}>Session not found.</p>
        </main>
      </div>
    );
  }

  const eventColors: Record<string, string> = {
    task_completed: "var(--green)",
    task_started: "var(--accent)",
    decision_made: "var(--purple)",
    blocker_found: "var(--red)",
    file_changed: "var(--text2)",
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-[var(--bg)]">
      <StickyHeader title={session.title || "Session"} showBack />
      <main style={{ maxWidth: 960, margin: "0 auto", padding: "24px 16px", width: "100%" }}>
        <div className="flex items-center gap-2 mb-1">
          <Link href="/dashboard" className="text-[12px] text-[var(--text3)] no-underline">
            Dashboard
          </Link>
          {session.project_key && (
            <>
              <span className="text-[var(--text3)]">/</span>
              <Link
                href={`/project/${session.project_key}`}
                className="text-[12px] text-[var(--text3)] no-underline"
              >
                {session.project_key}
              </Link>
            </>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "16px 0 4px", flexWrap: "wrap" }}>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>{session.title}</h1>
          <SurfaceBadge surface={session.surface} />
          <IdBadge value={session.session_code} label="session_code" kind="code" />
          {session.project_key && <IdBadge value={session.project_key} label="project_key" kind="key" size="xs" />}
        </div>
        <div style={{ fontSize: 12, color: "var(--text2)", marginBottom: 8, display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <span>{session.session_date}</span>
          {session.project_key && <><span>&middot;</span><span style={{ color: "var(--accent)" }}>{session.project_key}</span></>}
          {session.chain_id && <><span>&middot;</span><span style={{ color: "var(--purple)" }}>chain: {session.chain_id}</span></>}
        </div>
        <div style={{ display: "flex", gap: 4, marginBottom: 16, flexWrap: "wrap" }}>
          {session.surface && <Tag bg="var(--accent-dim)" color="var(--accent)">{session.surface}</Tag>}
          {session.entry_point && <Tag bg="var(--purple-dim)" color="var(--purple)">{session.entry_point}</Tag>}
          {session.mission && <Tag bg="var(--green-dim)" color="var(--green)">{session.mission}</Tag>}
          {session.chain_id && <Tag bg="var(--green-dim)" color="var(--green)">Chain</Tag>}
        </div>

        {/* Stat Bar */}
        <div style={{ display: "flex", background: "var(--card)", borderRadius: "var(--r)", overflow: "hidden", marginBottom: 20, boxShadow: "0 2px 12px rgba(0,0,0,.1)" }}>
          <StatCell label="Input" value={fmtTokens(session.input_tokens || 0)} color="var(--accent)" />
          <StatCell label="Output" value={fmtTokens(session.output_tokens || 0)} />
          <StatCell label="Cost" value={`$${(Number(session.cost_usd) || 0).toFixed(2)}`} color="var(--green)" />
          <StatCell label="Tokens" value={fmtTokens((session.input_tokens || 0) + (session.output_tokens || 0))} color="var(--text2)" />
        </div>

        {session.summary && (
          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 14, fontWeight: 600, color: "var(--text2)", marginBottom: 8 }}>Summary</h2>
            <p style={{ fontSize: 14, color: "var(--text)", lineHeight: 1.6, background: "var(--card)", padding: 16, borderRadius: "var(--r)" }}>
              {session.summary}
            </p>
          </section>
        )}

        {/* Attribution: handoffs mounted + emitted, tasks touched (pain #5) */}
        {(mountedHandoffs.length > 0 || emittedHandoffs.length > 0 || touchedTasks.length > 0) && (
          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 14, fontWeight: 600, color: "var(--text2)", marginBottom: 10 }}>Attribution</h2>
            {mountedHandoffs.length > 0 && (
              <AttrRow label="Mounted handoff(s)" accent="var(--accent)">
                {mountedHandoffs.map((h) => (
                  <span key={h.id} className="inline-flex items-center gap-1.5 mr-2 mb-1">
                    <IdBadge value={h.handoff_code} label="handoff_code" kind="code" />
                    <span className="text-[12px] text-[var(--text)]">{h.scope_name}</span>
                    <span className="text-[10px] text-[var(--text3)]">({h.sections_completed}/{h.sections_total})</span>
                  </span>
                ))}
              </AttrRow>
            )}
            {emittedHandoffs.length > 0 && (
              <AttrRow label="Emitted handoff(s)" accent="var(--green)">
                {emittedHandoffs.map((h) => (
                  <span key={h.id} className="inline-flex items-center gap-1.5 mr-2 mb-1">
                    <IdBadge value={h.handoff_code} label="handoff_code" kind="code" />
                    <span className="text-[12px] text-[var(--text)]">{h.scope_name}</span>
                    <span className="text-[10px] px-1.5 py-[1px] rounded bg-[var(--card)] text-[var(--text3)]">{h.status}</span>
                  </span>
                ))}
              </AttrRow>
            )}
            {touchedTasks.length > 0 && (
              <AttrRow label={`Tasks touched (${touchedTasks.length})`} accent="var(--purple)">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mt-1">
                  {touchedTasks.map((t) => (
                    <Link
                      key={t.id}
                      href={`/project/${t.project_key}`}
                      className="flex items-center gap-2 px-2.5 py-1.5 rounded-[6px] bg-[var(--card)] hover:bg-[var(--card2,var(--card))] border border-[var(--border)] no-underline"
                    >
                      {t.priority && (
                        <span className="w-[6px] h-[6px] rounded-full shrink-0"
                              style={{ background: t.priority === 'P0' ? 'var(--red)' : t.priority === 'P1' ? 'var(--orange)' : 'var(--yellow)' }} />
                      )}
                      <IdBadge value={t.task_code} label="task_code" kind="code" size="xs" />
                      <span className={`text-[12px] flex-1 min-w-0 truncate ${t.completed ? 'line-through text-[var(--text3)]' : 'text-[var(--text2)]'}`}>
                        {t.text}
                      </span>
                      {t.mission && <span className="text-[9px] text-[var(--green)] shrink-0">{t.mission}</span>}
                    </Link>
                  ))}
                </div>
              </AttrRow>
            )}
          </section>
        )}

        {events.length > 0 && (
          <section>
            <h2 style={{ fontSize: 14, fontWeight: 600, color: "var(--text2)", marginBottom: 12 }}>
              Events ({events.length})
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {events.map((e) => (
                <div
                  key={e.id}
                  style={{
                    display: "flex", alignItems: "flex-start", gap: 10,
                    padding: "10px 14px", background: "var(--card)", borderRadius: "var(--r-sm)",
                  }}
                >
                  <span
                    style={{
                      width: 8, height: 8, borderRadius: "50%", marginTop: 5, flexShrink: 0,
                      background: eventColors[e.event_type] || "var(--text3)",
                    }}
                  />
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: eventColors[e.event_type] || "var(--text3)" }}>
                      {e.event_type.replace("_", " ")}
                    </span>
                    {e.detail && (
                      <p style={{ fontSize: 13, color: "var(--text)", margin: "4px 0 0" }}>{e.detail}</p>
                    )}
                    <span style={{ fontSize: 11, color: "var(--text3)" }}>
                      {new Date(e.created_at).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {events.length === 0 && (
          <p style={{ color: "var(--text3)", fontSize: 13 }}>
            No events logged for this session yet. Events are recorded as tasks complete during a session.
          </p>
        )}

        {/* ── Handoff Section ── */}
        <section style={{ marginTop: 32, borderTop: "1px solid var(--border)", paddingTop: 24 }}>
          {!handoffOpen ? (
            <button
              onClick={loadHandoff}
              style={{
                width: "100%", padding: "12px 16px", background: "var(--card)",
                border: "1px solid var(--border)", borderRadius: "var(--r)",
                color: "var(--accent)", fontSize: 14, fontWeight: 600, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}
            >
              <span style={{ fontSize: 16 }}>&#x21AA;</span>
              Generate Handoff
            </button>
          ) : (
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <h2 style={{ fontSize: 14, fontWeight: 600, color: "var(--text2)" }}>Handoff</h2>
                <button
                  onClick={copyHandoff}
                  style={{
                    padding: "6px 14px", background: copied ? "var(--green-dim)" : "var(--accent-dim)",
                    color: copied ? "var(--green)" : "var(--accent)",
                    border: "none", borderRadius: "var(--r-sm)", fontSize: 12, fontWeight: 600, cursor: "pointer",
                  }}
                >
                  {copied ? "Copied!" : "Copy to CC"}
                </button>
              </div>
              {handoff ? (
                <pre
                  style={{
                    fontSize: 12, lineHeight: 1.6, color: "var(--text)",
                    background: "var(--card)", padding: 16, borderRadius: "var(--r)",
                    whiteSpace: "pre-wrap", wordBreak: "break-word", overflow: "auto",
                    maxHeight: 480, border: "1px solid var(--border)",
                    fontFamily: "'SF Mono', SFMono-Regular, Menlo, monospace",
                  }}
                >
                  {buildHandoffText(session, events, handoff)}
                </pre>
              ) : (
                <p style={{ color: "var(--text3)", fontSize: 13 }}>Loading handoff data...</p>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

/* ── Helpers ── */

function fmtTokens(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(0)}K` : String(n);
}

function StatCell({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ flex: 1, textAlign: "center", padding: "14px 8px", borderRight: "1px solid var(--border)" }}>
      <div style={{ fontSize: 17, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: color || "var(--text)" }}>{value}</div>
      <div style={{ fontSize: 9, fontWeight: 600, textTransform: "uppercase", color: "var(--text3)", letterSpacing: "0.03em", marginTop: 2 }}>{label}</div>
    </div>
  );
}

function Tag({ bg, color, children }: { bg: string; color: string; children: React.ReactNode }) {
  return (
    <span style={{ fontSize: 9, fontWeight: 600, padding: "2px 6px", borderRadius: 4, background: bg, color }}>{children}</span>
  );
}

function AttrRow({ label, accent, children }: { label: string; accent: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 10, paddingLeft: 10, borderLeft: `2px solid ${accent}` }}>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: accent, marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 13, color: "var(--text)" }}>{children}</div>
    </div>
  );
}
