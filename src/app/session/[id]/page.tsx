"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { StickyHeader } from "@/components/sticky-header";
import { SurfaceBadge } from "@/components/surface-badge";
import type { SessionLog, SessionEvent } from "@/lib/types";

export default function SessionPage() {
  const { id } = useParams<{ id: string }>();
  const [session, setSession] = useState<SessionLog | null>(null);
  const [events, setEvents] = useState<SessionEvent[]>([]);
  const [loading, setLoading] = useState(true);

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

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen bg-[var(--bg)]">
        <StickyHeader title="Session" showBack />
        <main style={{ maxWidth: 960, margin: "0 auto", padding: "24px 16px", color: "var(--text3)" }}>
          Loading...
        </main>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex flex-col min-h-screen bg-[var(--bg)]">
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
    <div className="flex flex-col min-h-screen bg-[var(--bg)]">
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
      </main>
    </div>
  );
}
