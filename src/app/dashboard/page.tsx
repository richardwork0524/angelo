"use client";

import { Suspense, useEffect, useState, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Fab } from "@/components/fab";
import { QuickCaptureSheet } from "@/components/quick-capture-sheet";
import { Toast } from "@/components/toast";

/* ── Types ── */

interface TaskPreview { id: string; text: string; priority: string | null }

interface Card {
  child_key: string;
  display_name: string;
  status: string | null;
  brief: string | null;
  open_tasks: number;
  this_week: number;
  this_month: number;
  p0: number;
  p1: number;
  p2: number;
  previews: TaskPreview[];
  is_leaf: boolean;
}

interface Task {
  id: string;
  text: string;
  project_key: string;
  bucket: string;
  priority: string | null;
  surface: string | null;
  is_owner_action: boolean;
  mission: string | null;
  updated_at: string;
}

interface Session {
  id: string;
  project_key: string;
  session_date: string;
  title: string;
  surface: string | null;
  summary: string | null;
}

interface Data {
  stats: { open: number; p0: number; p1: number; p2: number; this_week: number; this_month: number };
  cards: Card[];
  tasks_by_priority: { P0: Task[]; P1: Task[]; P2: Task[]; ALL: Task[] };
  sessions: Session[];
  session_total: number;
}

/* ── Constants ── */

const ROOT_TABS = [
  { key: "company", label: "Company", color: "#0a84ff" },
  { key: "development", label: "Dev", color: "#bf5af2" },
  { key: "general", label: "General", color: "#30d158" },
  { key: "group-strategy", label: "Strategy", color: "#ff9f0a" },
];

const URGENCY_TABS = [
  { key: "ALL", label: "All" },
  { key: "P0", label: "Critical", color: "#ff453a" },
  { key: "P1", label: "High", color: "#ff9f0a" },
  { key: "P2", label: "Normal", color: "#ffd60a" },
];

const SURFACE_DOT: Record<string, string> = { CODE: "#0a84ff", CHAT: "#30d158", COWORK: "#bf5af2" };
const PRIORITY_DOT: Record<string, string> = { P0: "#ff453a", P1: "#ff9f0a", P2: "#ffd60a" };

/* ── Skeleton ── */

function Skeleton() {
  return (
    <div className="h-full flex items-center justify-center bg-[var(--bg)]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin" />
        <span className="text-[13px] text-[var(--text3)]">Loading...</span>
      </div>
    </div>
  );
}

/* ── KPI Pill Row (inspired by reference) ── */

function KpiRow({ stats }: { stats: Data["stats"] }) {
  const items = [
    { value: stats.p0, label: "Critical", color: "#ff453a", bg: "var(--red-dim)" },
    { value: stats.this_week, label: "This Week", color: "#0a84ff", bg: "var(--accent-dim)" },
    { value: stats.this_month, label: "This Month", color: "#bf5af2", bg: "var(--purple-dim)" },
    { value: stats.open, label: "Open", color: "var(--text2)", bg: "var(--card)" },
  ];
  return (
    <div className="flex gap-2 px-6 py-3">
      {items.map((item) => (
        <div
          key={item.label}
          className="flex-1 flex flex-col items-center py-2.5 rounded-[12px] border border-[var(--border)]"
          style={{ backgroundColor: item.bg }}
        >
          <span className="text-[20px] font-bold tabular-nums" style={{ color: item.color }}>
            {item.value}
          </span>
          <span className="text-[10px] text-[var(--text3)] uppercase tracking-wide mt-0.5">
            {item.label}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ── Company Card (reference-style: 2-col grid with task previews) ── */

function CompanyCard({ card, onClick }: { card: Card; onClick: () => void }) {
  const hasP0 = card.p0 > 0;

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-[16px] bg-[var(--card)] border border-[var(--border)] p-4 hover:border-[var(--border2)] hover:bg-[var(--card2)] transition-all active:scale-[0.98]"
    >
      {/* Header: name + open count */}
      <div className="flex items-start justify-between mb-1">
        <span className={`text-[15px] font-bold ${hasP0 ? "text-[#ff453a]" : "text-[var(--accent)]"}`}>
          {card.display_name}
        </span>
      </div>

      {/* Subtitle: brief or status */}
      <p className="text-[11px] text-[var(--text3)] mb-3 truncate">
        {card.brief || (card.status ? card.status : `${card.open_tasks} open`)}
      </p>

      {/* Task previews */}
      {card.previews.length > 0 ? (
        <div className="space-y-1.5 mb-3">
          {card.previews.map((t) => (
            <div key={t.id} className="flex items-center gap-2">
              <span
                className="w-[7px] h-[7px] rounded-full shrink-0"
                style={{ backgroundColor: PRIORITY_DOT[t.priority || ""] || "var(--border2)" }}
              />
              <span className="text-[12px] text-[var(--text2)] truncate">{t.text}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[12px] text-[var(--text3)] mb-3">No open tasks</p>
      )}

      {/* Footer: critical count */}
      {card.p0 > 0 && (
        <span className="text-[11px] font-bold text-[#ff453a]">{card.p0} critical</span>
      )}
    </button>
  );
}

/* ── Session Row ── */

function SessionRow({ s }: { s: Session }) {
  const router = useRouter();
  return (
    <button
      onClick={() => router.push(`/session/${s.id}`)}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[8px] hover:bg-[var(--card)] transition-colors text-left"
    >
      <div className="w-[8px] h-[8px] rounded-full shrink-0" style={{ backgroundColor: SURFACE_DOT[s.surface || ""] || "var(--text3)" }} />
      <div className="flex-1 min-w-0">
        <p className="text-[13px] text-[var(--text)] truncate">{s.title}</p>
        <p className="text-[11px] text-[var(--text3)]">{s.project_key} · {s.session_date}</p>
      </div>
    </button>
  );
}

/* ── Task Row ── */

function TaskRow({ t }: { t: Task }) {
  return (
    <div className="flex items-start gap-3 px-4 py-3 rounded-[8px] bg-[var(--card)] border border-[var(--border)] hover:border-[var(--border2)] transition-colors">
      <span
        className="w-[8px] h-[8px] rounded-full shrink-0 mt-[5px]"
        style={{ backgroundColor: PRIORITY_DOT[t.priority || ""] || "var(--border2)" }}
      />
      <div className="flex-1 min-w-0">
        <p className="text-[13px] text-[var(--text)] leading-[1.4]">{t.text}</p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[11px] text-[var(--text3)]">{t.project_key}</span>
          {t.surface && (
            <span className="inline-flex items-center gap-1">
              <span className="w-[5px] h-[5px] rounded-full" style={{ backgroundColor: SURFACE_DOT[t.surface] || "var(--text3)" }} />
              <span className="text-[10px] text-[var(--text3)] uppercase">{t.surface}</span>
            </span>
          )}
          {t.bucket !== "THIS_WEEK" && (
            <span className="text-[10px] text-[var(--text3)] px-1.5 py-[1px] rounded bg-[var(--card2)]">
              {t.bucket === "THIS_MONTH" ? "Month" : t.bucket === "PARKED" ? "Parked" : t.bucket}
            </span>
          )}
          {t.mission && (
            <span className="text-[10px] text-[var(--purple)] truncate max-w-[100px]">{t.mission}</span>
          )}
        </div>
      </div>
      {t.is_owner_action && (
        <span className="text-[9px] font-bold text-[var(--cyan)] bg-[var(--cyan-dim)] px-1.5 py-[2px] rounded shrink-0">YOU</span>
      )}
    </div>
  );
}

/* ── Main ── */

export default function DashboardPage() {
  return (
    <Suspense fallback={<Skeleton />}>
      <DashboardContent />
    </Suspense>
  );
}

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [activeRoot, setActiveRoot] = useState(searchParams.get("tab") || "company");
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionsExpanded, setSessionsExpanded] = useState(false);
  const [allSessions, setAllSessions] = useState<Session[]>([]);
  const [urgencyTab, setUrgencyTab] = useState("ALL");
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const fetchDashboard = useCallback(async (tab: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/dashboard?parent=${tab}`);
      const d = await res.json();
      if (d.error) throw new Error(d.error);
      setData(d);
    } catch {
      setData(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchDashboard(activeRoot); }, [activeRoot, fetchDashboard]);

  function handleTabChange(key: string) {
    setActiveRoot(key);
    setSelectedCard(null);
    setUrgencyTab("ALL");
    setSessionsExpanded(false);
  }

  async function loadAllSessions() {
    if (allSessions.length > 0) { setSessionsExpanded(!sessionsExpanded); return; }
    try {
      const res = await fetch(`/api/sessions?parent=${activeRoot}&limit=50`);
      const d = await res.json();
      setAllSessions(d.sessions || []);
      setSessionsExpanded(true);
    } catch { setSessionsExpanded(!sessionsExpanded); }
  }

  const filteredTasks = useMemo(() => {
    if (!data) return [];
    const pool = urgencyTab === "ALL"
      ? data.tasks_by_priority.ALL
      : (data.tasks_by_priority[urgencyTab as keyof Data["tasks_by_priority"]] || []);
    if (!selectedCard) return pool;
    return pool.filter((t) => t.project_key === selectedCard);
  }, [data, urgencyTab, selectedCard]);

  const displayedSessions = useMemo(() => {
    if (!data) return [];
    if (sessionsExpanded && allSessions.length > 0) return allSessions;
    return data.sessions.slice(0, 3);
  }, [data, sessionsExpanded, allSessions]);

  const leafProjects = useMemo(() => {
    if (!data?.cards) return [];
    return data.cards.map((c) => ({ child_key: c.child_key, display_name: c.display_name }));
  }, [data]);

  // View mode: "cards" (grid overview) or "tasks" (filtered task list)
  const viewMode = selectedCard ? "tasks" : "cards";

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[var(--bg)]">
      {/* ═══ HEADER ═══ */}
      <header className="shrink-0">
        {/* Title row */}
        <div className="flex items-center justify-between px-6 pt-4 pb-1">
          <h1 className="text-[24px] font-bold text-[var(--text)]">
            {ROOT_TABS.find((t) => t.key === activeRoot)?.label || "Angelo"}
          </h1>
          <div className="w-[36px] h-[36px] rounded-full bg-[var(--accent)] flex items-center justify-center text-white text-[14px] font-bold">
            R
          </div>
        </div>

        {/* KPI pills */}
        {data && <KpiRow stats={data.stats} />}

        {/* Root tabs */}
        <div className="flex items-center gap-1 px-6 pb-3 border-b border-[var(--border)]">
          {ROOT_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              className={`px-4 py-2 rounded-[8px] text-[13px] font-semibold transition-all ${
                activeRoot === tab.key
                  ? "text-white shadow-lg"
                  : "text-[var(--text3)] hover:text-[var(--text2)] hover:bg-[var(--card)]"
              }`}
              style={activeRoot === tab.key ? { backgroundColor: tab.color } : undefined}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      {/* ═══ BODY ═══ */}
      {loading ? (
        <Skeleton />
      ) : !data ? (
        <div className="flex-1 flex items-center justify-center">
          <button onClick={() => fetchDashboard(activeRoot)} className="text-[13px] text-[var(--accent)]">Retry</button>
        </div>
      ) : (
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* ── LEFT: Card grid + Sessions ── */}
          <div className="w-[420px] shrink-0 flex flex-col border-r border-[var(--border)] overflow-hidden">
            {/* Sessions (collapsible) */}
            <div className={sessionsExpanded ? "flex-1 flex flex-col overflow-hidden" : "shrink-0"}>
              <div className="flex items-center justify-between px-4 py-2.5">
                <h2 className="text-[11px] font-bold text-[var(--text3)] uppercase tracking-[0.08em]">Sessions</h2>
                <button onClick={loadAllSessions} className="text-[11px] text-[var(--accent)] hover:underline">
                  {sessionsExpanded ? "Collapse" : `All (${data.session_total})`}
                </button>
              </div>
              <div className={`px-2 ${sessionsExpanded ? "overflow-y-auto flex-1" : ""}`}>
                {displayedSessions.map((s) => <SessionRow key={s.id} s={s} />)}
              </div>
            </div>

            {!sessionsExpanded && <div className="h-px bg-[var(--border)] mx-4" />}

            {/* 2-column card grid (reference-inspired) */}
            {!sessionsExpanded && (
              <div className="flex-1 overflow-y-auto px-4 py-3 min-h-0">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-[11px] font-bold text-[var(--text3)] uppercase tracking-[0.08em]">
                    {ROOT_TABS.find((t) => t.key === activeRoot)?.label}
                  </h2>
                  {selectedCard && (
                    <button onClick={() => setSelectedCard(null)} className="text-[11px] text-[var(--accent)]">
                      Show All
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {data.cards.map((card) => (
                    <CompanyCard
                      key={card.child_key}
                      card={card}
                      onClick={() => {
                        if (selectedCard === card.child_key) {
                          if (card.is_leaf) router.push(`/project/${card.child_key}`);
                          else setSelectedCard(null);
                        } else {
                          setSelectedCard(card.child_key);
                        }
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── RIGHT: Task list ── */}
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {/* Urgency tabs */}
            <div className="shrink-0 flex items-center gap-1 px-6 py-3 border-b border-[var(--border)]">
              {URGENCY_TABS.map((tab) => {
                const count = tab.key === "ALL"
                  ? filteredTasks.length
                  : (data.tasks_by_priority[tab.key as keyof Data["tasks_by_priority"]] || []).length;
                const isActive = urgencyTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setUrgencyTab(tab.key)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-[8px] text-[13px] font-semibold transition-all ${
                      isActive ? "bg-[var(--card)] text-[var(--text)] shadow-sm" : "text-[var(--text3)] hover:text-[var(--text2)]"
                    }`}
                  >
                    {tab.color && <span className="w-[8px] h-[8px] rounded-full" style={{ backgroundColor: tab.color }} />}
                    {tab.label}
                    <span className={`text-[11px] tabular-nums ${isActive ? "text-[var(--text2)]" : "text-[var(--text3)]"}`}>{count}</span>
                  </button>
                );
              })}
              {selectedCard && (
                <span className="ml-auto text-[12px] text-[var(--accent)] bg-[var(--accent-dim)] px-3 py-1 rounded-full">
                  {data.cards.find((c) => c.child_key === selectedCard)?.display_name}
                </span>
              )}
            </div>

            {/* Task list */}
            <div className="flex-1 overflow-y-auto px-6 py-3">
              {filteredTasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full">
                  <div className="w-12 h-12 rounded-full bg-[var(--card)] flex items-center justify-center mb-3">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" strokeWidth="1.5">
                      <path d="M9 11l3 3L22 4" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <p className="text-[14px] text-[var(--text3)]">No tasks</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredTasks.map((t) => <TaskRow key={t.id} t={t} />)}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
      <Fab onPress={() => setCaptureOpen(true)} />
      <QuickCaptureSheet
        open={captureOpen}
        onClose={() => setCaptureOpen(false)}
        projects={leafProjects}
        onSubmitted={() => { fetchDashboard(activeRoot); setToast("Task added"); }}
      />
    </div>
  );
}
