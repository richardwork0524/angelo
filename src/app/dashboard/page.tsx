"use client";

import { Suspense, useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Fab } from "@/components/fab";
import { QuickCaptureSheet } from "@/components/quick-capture-sheet";
import { Toast } from "@/components/toast";

/* ── Types ── */

interface Card {
  child_key: string;
  display_name: string;
  status: string | null;
  build_phase: string | null;
  brief: string | null;
  last_session_date: string | null;
  current_version: string | null;
  open_tasks: number;
  p0: number;
  p1: number;
  p2: number;
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
  stats: { open: number; p0: number; p1: number; p2: number };
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
        <span className="text-[13px] text-[var(--text3)]">Loading dashboard...</span>
      </div>
    </div>
  );
}

/* ── Stat Pill ── */

function StatPill({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-[8px] bg-[var(--card)]">
      <span className="text-[16px] font-bold tabular-nums" style={{ color }}>{value}</span>
      <span className="text-[11px] text-[var(--text3)] uppercase tracking-wide">{label}</span>
    </div>
  );
}

/* ── Session Row ── */

function SessionRow({ s }: { s: Session }) {
  const router = useRouter();
  return (
    <button
      onClick={() => router.push(`/session/${s.id}`)}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[8px] hover:bg-[var(--card)] transition-colors text-left group"
    >
      <div className="w-[8px] h-[8px] rounded-full shrink-0" style={{ backgroundColor: SURFACE_DOT[s.surface || ""] || "var(--text3)" }} />
      <div className="flex-1 min-w-0">
        <p className="text-[13px] text-[var(--text)] truncate group-hover:text-[var(--accent)] transition-colors">{s.title}</p>
        <p className="text-[11px] text-[var(--text3)]">{s.project_key} · {s.session_date}</p>
      </div>
    </button>
  );
}

/* ── Project Card (task manager style) ── */

function ProjectCard({ card, selected, onClick }: { card: Card; selected: boolean; onClick: () => void }) {
  const total = card.open_tasks;
  const hasUrgent = card.p0 > 0;

  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-[12px] border transition-all p-4 ${
        selected
          ? "bg-[var(--accent-dim)] border-[var(--accent)] scale-[1.01]"
          : "bg-[var(--card)] border-[var(--border)] hover:border-[var(--border2)] hover:bg-[var(--card2)]"
      }`}
    >
      {/* Row 1: Name + count */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0">
          {hasUrgent && <span className="w-[8px] h-[8px] rounded-full bg-[#ff453a] shrink-0 animate-pulse" />}
          <span className="text-[14px] font-semibold text-[var(--text)] truncate">{card.display_name}</span>
        </div>
        <span className={`text-[20px] font-bold tabular-nums ${total > 0 ? "text-[var(--text)]" : "text-[var(--text3)]"}`}>
          {total}
        </span>
      </div>

      {/* Row 2: Priority breakdown bar */}
      {total > 0 ? (
        <div className="flex items-center gap-1 h-[6px] rounded-full overflow-hidden bg-[var(--border)]">
          {card.p0 > 0 && <div className="h-full rounded-full" style={{ width: `${(card.p0 / total) * 100}%`, backgroundColor: "#ff453a" }} />}
          {card.p1 > 0 && <div className="h-full rounded-full" style={{ width: `${(card.p1 / total) * 100}%`, backgroundColor: "#ff9f0a" }} />}
          {card.p2 > 0 && <div className="h-full rounded-full" style={{ width: `${(card.p2 / total) * 100}%`, backgroundColor: "#ffd60a" }} />}
          {total - card.p0 - card.p1 - card.p2 > 0 && (
            <div className="h-full rounded-full" style={{ width: `${((total - card.p0 - card.p1 - card.p2) / total) * 100}%`, backgroundColor: "var(--text3)" }} />
          )}
        </div>
      ) : (
        <p className="text-[11px] text-[var(--text3)]">No open tasks</p>
      )}

      {/* Row 3: Meta */}
      <div className="flex items-center gap-2 mt-2">
        {card.p0 > 0 && <span className="text-[10px] font-bold text-[#ff453a]">{card.p0} critical</span>}
        {card.p1 > 0 && <span className="text-[10px] font-bold text-[#ff9f0a]">{card.p1} high</span>}
        {card.current_version && <span className="text-[10px] text-[var(--text3)] ml-auto">{card.current_version}</span>}
      </div>
    </button>
  );
}

/* ── Task Row ── */

function TaskRow({ t }: { t: Task }) {
  return (
    <div className="flex items-start gap-3 px-4 py-3 rounded-[8px] bg-[var(--card)] border border-[var(--border)] hover:border-[var(--border2)] transition-colors">
      {/* Priority dot */}
      <span
        className="w-[8px] h-[8px] rounded-full shrink-0 mt-[5px]"
        style={{ backgroundColor: PRIORITY_DOT[t.priority || ""] || "var(--border2)" }}
      />

      {/* Content */}
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

      {/* Owner badge */}
      {t.is_owner_action && (
        <span className="text-[9px] font-bold text-[var(--cyan)] bg-[var(--cyan-dim)] px-1.5 py-[2px] rounded shrink-0">
          YOU
        </span>
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

  useEffect(() => {
    fetchDashboard(activeRoot);
  }, [activeRoot, fetchDashboard]);

  function handleTabChange(key: string) {
    setActiveRoot(key);
    setSelectedCard(null);
    setUrgencyTab("ALL");
    setSessionsExpanded(false);
  }

  async function loadAllSessions() {
    if (allSessions.length > 0) {
      setSessionsExpanded(!sessionsExpanded);
      return;
    }
    try {
      const res = await fetch(`/api/sessions?parent=${activeRoot}&limit=50`);
      const d = await res.json();
      setAllSessions(d.sessions || []);
      setSessionsExpanded(true);
    } catch {
      setSessionsExpanded(!sessionsExpanded);
    }
  }

  // Filter tasks by selected card + urgency
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

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[var(--bg)]">
      {/* ═══ TOP BAR ═══ */}
      <header className="shrink-0 border-b border-[var(--border)]">
        {/* Row 1: Title + Stats */}
        <div className="flex items-center justify-between px-6 pt-4 pb-2">
          <h1 className="text-[20px] font-bold text-[var(--text)]">Angelo</h1>
          {data && (
            <div className="flex items-center gap-2">
              <StatPill value={data.stats.p0} label="critical" color="#ff453a" />
              <StatPill value={data.stats.p1} label="high" color="#ff9f0a" />
              <StatPill value={data.stats.open} label="open" color="var(--text2)" />
            </div>
          )}
        </div>

        {/* Row 2: Root tabs */}
        <div className="flex items-center gap-1 px-6 pb-3">
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
          <div className="text-center">
            <p className="text-[14px] text-[var(--text3)] mb-2">Failed to load dashboard</p>
            <button onClick={() => fetchDashboard(activeRoot)} className="text-[13px] text-[var(--accent)]">
              Retry
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* ── LEFT PANEL: Cards + Sessions ── */}
          <div className="w-[340px] shrink-0 flex flex-col border-r border-[var(--border)] overflow-hidden">
            {/* Sessions section */}
            <div className={`shrink-0 ${sessionsExpanded ? "flex-1 overflow-hidden flex flex-col" : ""}`}>
              <div className="flex items-center justify-between px-4 py-3">
                <h2 className="text-[11px] font-bold text-[var(--text3)] uppercase tracking-[0.08em]">
                  Recent Sessions
                </h2>
                <button onClick={loadAllSessions} className="text-[11px] text-[var(--accent)] hover:underline">
                  {sessionsExpanded ? "Collapse" : `View All (${data.session_total})`}
                </button>
              </div>
              <div className={`px-2 ${sessionsExpanded ? "overflow-y-auto flex-1" : ""}`}>
                {displayedSessions.map((s) => <SessionRow key={s.id} s={s} />)}
                {displayedSessions.length === 0 && (
                  <p className="text-[12px] text-[var(--text3)] text-center py-4">No sessions</p>
                )}
              </div>
            </div>

            {/* Divider */}
            {!sessionsExpanded && <div className="h-px bg-[var(--border)] mx-4" />}

            {/* Project cards */}
            {!sessionsExpanded && (
              <div className="flex-1 overflow-y-auto px-4 py-3 min-h-0">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-[11px] font-bold text-[var(--text3)] uppercase tracking-[0.08em]">
                    {ROOT_TABS.find((t) => t.key === activeRoot)?.label || "Projects"}
                  </h2>
                  {selectedCard && (
                    <button
                      onClick={() => setSelectedCard(null)}
                      className="text-[11px] text-[var(--accent)] hover:underline"
                    >
                      Show All
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  {data.cards.map((card) => (
                    <ProjectCard
                      key={card.child_key}
                      card={card}
                      selected={selectedCard === card.child_key}
                      onClick={() => {
                        if (selectedCard === card.child_key) {
                          // Double-click: navigate to project detail
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

          {/* ── RIGHT PANEL: Tasks ── */}
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {/* Urgency tabs */}
            <div className="shrink-0 flex items-center gap-1 px-6 py-3 border-b border-[var(--border)]">
              {URGENCY_TABS.map((tab) => {
                const count = tab.key === "ALL"
                  ? filteredTasks.length
                  : filteredTasks.filter((t) => t.priority === tab.key).length;
                const isActive = urgencyTab === tab.key;

                // For ALL tab, use the full filtered count
                const displayCount = tab.key === "ALL"
                  ? filteredTasks.length
                  : (data?.tasks_by_priority[tab.key as keyof Data["tasks_by_priority"]] || []).length;

                return (
                  <button
                    key={tab.key}
                    onClick={() => setUrgencyTab(tab.key)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-[8px] text-[13px] font-semibold transition-all ${
                      isActive
                        ? "bg-[var(--card)] text-[var(--text)] shadow-sm"
                        : "text-[var(--text3)] hover:text-[var(--text2)]"
                    }`}
                  >
                    {tab.color && <span className="w-[8px] h-[8px] rounded-full" style={{ backgroundColor: tab.color }} />}
                    {tab.label}
                    <span className={`text-[11px] tabular-nums ${isActive ? "text-[var(--text2)]" : "text-[var(--text3)]"}`}>
                      {displayCount}
                    </span>
                  </button>
                );
              })}

              {selectedCard && (
                <span className="ml-auto text-[12px] text-[var(--accent)] bg-[var(--accent-dim)] px-3 py-1 rounded-full">
                  {data?.cards.find((c) => c.child_key === selectedCard)?.display_name}
                </span>
              )}
            </div>

            {/* Task list */}
            <div className="flex-1 overflow-y-auto px-6 py-3">
              {filteredTasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <div className="w-12 h-12 rounded-full bg-[var(--card)] flex items-center justify-center mb-3">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" strokeWidth="1.5">
                      <path d="M9 11l3 3L22 4" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <p className="text-[14px] text-[var(--text3)]">
                    {selectedCard ? "No tasks for this project" : "No tasks in this category"}
                  </p>
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
        onSubmitted={() => {
          fetchDashboard(activeRoot);
          setToast("Task added");
        }}
      />
    </div>
  );
}
