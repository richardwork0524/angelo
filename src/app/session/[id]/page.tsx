"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { StickyHeader } from "@/components/sticky-header";
import { SurfaceBadge } from "@/components/surface-badge";
import type { SessionLog, SessionEvent, Project, Task } from "@/lib/types";

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
  const [session, setSession] = useState<SessionLog | null>(null);
  const [events, setEvents] = useState<SessionEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [handoff, setHandoff] = useState<HandoffData | null>(null);
  const [handoffOpen, setHandoffOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const [{ data: sess }, { data: evts }] = await Promise.all([
        supabase.from("angelo_session_logs").select("*").eq("id", id).single(),
        supabase.from("angelo_session_events").select("*").eq("session_log_id", id).order("created_at"),
      ]);
      if (sess) setSession(sess);
      if (evts) setEvents(evts);
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

        <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "16px 0 8px" }}>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>{session.title}</h1>
          <SurfaceBadge surface={session.surface} />
        </div>
        <p style={{ fontSize: 13, color: "var(--text2)", marginBottom: 24 }}>
          {session.session_date}
          {session.project_key && ` \u00B7 ${session.project_key}`}
        </p>

        {session.summary && (
          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 14, fontWeight: 600, color: "var(--text2)", marginBottom: 8 }}>Summary</h2>
            <p style={{ fontSize: 14, color: "var(--text)", lineHeight: 1.6, background: "var(--card)", padding: 16, borderRadius: "var(--r)" }}>
              {session.summary}
            </p>
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
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
              {handoff ? (
                <pre
                  style={{
                    fontSize: 12, lineHeight: 1.6, color: "var(--text)",
                    background: "var(--card)", padding: 16, borderRadius: "var(--r)",
                    whiteSpace: "pre-wrap", wordBreak: "break-word", overflow: "auto",
                    maxHeight: 480, border: "1px solid var(--border)",
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
