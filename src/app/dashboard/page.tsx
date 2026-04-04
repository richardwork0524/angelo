"use client";

import { Suspense, useEffect, useState, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { Fab } from "@/components/fab";
import { useToast } from "@/components/toast";
import { type DashboardTask } from "@/components/expandable-task-row";
import { type DetailTask } from "@/components/task/task-detail";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import { cachedFetch, invalidateCache } from "@/lib/cache";

// Lazy-load heavy components (not needed until user interaction)
const TaskDetail = dynamic(() => import("@/components/task/task-detail").then((m) => ({ default: m.TaskDetail })), { ssr: false });
const QuickCaptureSheet = dynamic(() => import("@/components/quick-capture-sheet").then((m) => ({ default: m.QuickCaptureSheet })), { ssr: false });

/* ── Types ── */

interface TaskPreview {
  id: string;
  text: string;
  priority: string | null;
  mission: string | null;
  progress: string | null;
  task_code: string | null;
  surface: string | null;
  is_owner_action: boolean;
  bucket: string;
  project_key: string;
  updated_at: string;
}

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
  version: string | null;
  updated_at: string;
  progress: string | null;
  log: { timestamp: string; type: string; message: string; section?: number }[] | null;
  parent_task_id: string | null;
  completed: boolean;
  task_code: string | null;
}

interface Session {
  id: string;
  project_key: string;
  session_date: string;
  title: string;
  surface: string | null;
  summary: string | null;
}

interface HookLog {
  hook_name: string;
  action: string;
  project_key: string | null;
  detail: string | null;
  created_at: string;
}

interface MissionTaskPreview {
  id: string;
  text: string;
  priority: string | null;
  task_code: string | null;
  project_key: string;
  bucket: string;
  surface: string | null;
  is_owner_action: boolean;
  updated_at: string;
}

interface Mission {
  mission: string;
  task_count: number;
  latest_task: string;
  latest_at: string;
  p0: number;
  p1: number;
  p2: number;
  tasks: MissionTaskPreview[];
}

interface EntityMissions {
  entity_key: string;
  entity_name: string;
  missions: Mission[];
  total_mission_tasks: number;
}

interface Data {
  stats: { open: number; p0: number; p1: number; p2: number; this_week: number; this_month: number };
  cards: Card[];
  tasks_by_priority: { P0: Task[]; P1: Task[]; P2: Task[]; ALL: Task[] };
  missions: Mission[];
  missions_by_entity: EntityMissions[];
  hook_logs: HookLog[];
  sessions: Session[];
  session_total: number;
}

/* ── Constants ── */

const ROOT_TABS = [
  { key: "general", label: "General", color: "var(--green)" },
  { key: "group-strategy", label: "Strategy", color: "var(--orange)" },
  { key: "company", label: "Company", color: "var(--accent)" },
  { key: "development", label: "Dev", color: "var(--purple)" },
];

const URGENCY_TABS = [
  { key: "ALL", label: "All" },
  { key: "P0", label: "Critical", color: "var(--red)" },
  { key: "P1", label: "High", color: "var(--orange)" },
  { key: "P2", label: "Normal", color: "var(--yellow)" },
];

const PRIORITY_DOT: Record<string, string> = { P0: "var(--red)", P1: "var(--orange)", P2: "var(--yellow)" };
const SURFACE_DOT: Record<string, string> = { CODE: "var(--accent)", CHAT: "var(--green)", COWORK: "var(--purple)" };

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

/* ── KPI Pill Row (clickable filters) ── */

type KpiFilter = "P0" | "THIS_WEEK" | "THIS_MONTH" | "ALL" | null;

function KpiRow({ stats, activeFilter, onFilter }: { stats: Data["stats"]; activeFilter: KpiFilter; onFilter: (f: KpiFilter) => void }) {
  const items: { key: KpiFilter; value: number; label: string; color: string; bg: string }[] = [
    { key: "P0", value: stats.p0, label: "Critical", color: "var(--red)", bg: "var(--red-dim)" },
    { key: "THIS_WEEK", value: stats.this_week, label: "This Week", color: "var(--accent)", bg: "var(--accent-dim)" },
    { key: "THIS_MONTH", value: stats.this_month, label: "This Month", color: "var(--purple)", bg: "var(--purple-dim)" },
    { key: "ALL", value: stats.open, label: "Open", color: "var(--text2)", bg: "var(--card)" },
  ];
  return (
    <div className="flex gap-2 px-6 py-3">
      {items.map((item) => (
        <button
          key={item.label}
          onClick={() => onFilter(activeFilter === item.key ? null : item.key)}
          className={`flex-1 flex flex-col items-center py-2.5 rounded-[12px] border transition-all ${
            activeFilter === item.key ? "border-current ring-1 ring-current scale-[1.02]" : "border-[var(--border)] hover:border-[var(--border2)]"
          }`}
          style={{ backgroundColor: item.bg, color: activeFilter === item.key ? item.color : undefined }}
        >
          <span className="text-[20px] font-bold tabular-nums" style={{ color: item.color }}>
            {item.value}
          </span>
          <span className="text-[11px] text-[var(--text3)] uppercase tracking-wide mt-0.5">
            {item.label}
          </span>
        </button>
      ))}
    </div>
  );
}

/* ── Company Card (reference-style: 2-col grid with task previews) ── */

function CompanyCard({ card, onClick, onFilterClick, onTaskClick }: { card: Card; onClick: () => void; onFilterClick: (e: React.MouseEvent) => void; onTaskClick: (t: TaskPreview) => void }) {
  const hasP0 = card.p0 > 0;

  return (
    <div
      onClick={onClick}
      className="rounded-[16px] bg-[var(--card)] border border-[var(--border)] hover:border-[var(--border2)] transition-all h-[180px] flex flex-col overflow-hidden cursor-pointer"
    >
      {/* Header: name + task count (count acts as filter toggle) */}
      <div className="flex items-center justify-between px-4 pt-3 pb-1 text-left w-full">
        <span className="text-[14px] font-bold truncate" style={{ color: hasP0 ? "var(--red)" : "var(--accent)" }}>
          {card.display_name}
        </span>
        <button onClick={onFilterClick} className="text-[12px] text-[var(--text3)] tabular-nums shrink-0 ml-2 hover:text-[var(--accent)] transition-colors">{card.open_tasks} open</button>
      </div>

      {/* Task previews — clickable to open modal */}
      <div className="flex-1 px-3 pb-2 overflow-hidden">
        {card.previews.length > 0 ? (
          <div className="space-y-0.5">
            {card.previews.map((t) => (
              <button
                key={t.id}
                onClick={(e) => { e.stopPropagation(); onTaskClick(t); }}
                className="w-full flex items-center gap-1.5 px-1.5 py-1 rounded-[6px] hover:bg-[var(--card2)] transition-colors text-left"
              >
                <span
                  className="w-[6px] h-[6px] rounded-full shrink-0"
                  style={{ backgroundColor: PRIORITY_DOT[t.priority || ""] || "var(--border2)" }}
                />
                <span className="flex-1 text-[11px] text-[var(--text2)] truncate">
                  {t.mission ? <span className="text-[var(--purple)]">{t.mission}</span> : null}
                  {t.mission ? " — " : ""}
                  {t.text}
                </span>
                {t.surface && (
                  <span className="inline-flex items-center gap-0.5 shrink-0">
                    <span className="w-[4px] h-[4px] rounded-full" style={{ backgroundColor: SURFACE_DOT[t.surface] }} />
                    <span className="text-[9px] text-[var(--text3)]">{t.surface}</span>
                  </span>
                )}
                {t.progress && (
                  <span className="text-[9px] font-bold text-[var(--accent)] tabular-nums shrink-0">{t.progress}</span>
                )}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-[var(--text3)] px-1.5 py-1">No open tasks</p>
        )}
      </div>

      {/* Footer: priority summary */}
      <div className="flex items-center gap-2 px-4 pb-2.5 shrink-0">
        {card.p0 > 0 && <span className="text-[10px] font-bold" style={{ color: "var(--red)" }}>{card.p0} critical</span>}
        {card.p1 > 0 && <span className="text-[10px]" style={{ color: "var(--orange)" }}>{card.p1} high</span>}
        {card.p0 === 0 && card.p1 === 0 && card.open_tasks > 0 && (
          <span className="text-[10px] text-[var(--text3)]">{card.open_tasks} tasks</span>
        )}
      </div>
    </div>
  );
}

/* ── Session Row (expandable with detail) ── */

function SessionRow({ s, expanded, onToggle }: { s: Session; expanded: boolean; onToggle: () => void }) {
  const router = useRouter();
  return (
    <div className="rounded-[8px] hover:bg-[var(--card)] transition-colors">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-3 py-2.5 text-left"
      >
        <div className="w-[8px] h-[8px] rounded-full shrink-0" style={{ backgroundColor: SURFACE_DOT[s.surface || ""] || "var(--text3)" }} />
        <div className="flex-1 min-w-0">
          <p className="text-[13px] text-[var(--text)] truncate">{s.title}</p>
          <p className="text-[11px] text-[var(--text3)]">{s.project_key} · {s.session_date}</p>
        </div>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className={`shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`}>
          <path d="M3 4.5L6 7.5L9 4.5" stroke="var(--text3)" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
      {expanded && (
        <div className="px-3 pb-3 pl-[32px]">
          {s.summary ? (
            <p className="text-[12px] text-[var(--text2)] leading-[1.5] mb-2 whitespace-pre-line line-clamp-6">{s.summary}</p>
          ) : (
            <p className="text-[12px] text-[var(--text3)] italic mb-2">No summary available</p>
          )}
          <button
            onClick={() => router.push(`/session/${s.id}`)}
            className="text-[11px] text-[var(--accent)] hover:underline"
          >
            View full session →
          </button>
        </div>
      )}
    </div>
  );
}

/* ── (TaskRow removed — replaced by ExpandableTaskRow component) ── */

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

  const isDesktop = useBreakpoint(768);
  const parentParam = searchParams.get("parent") || "general";
  const [activeRoot, setActiveRoot] = useState(parentParam);
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionsExpanded, setSessionsExpanded] = useState(false);
  const [allSessions, setAllSessions] = useState<Session[]>([]);
  const [urgencyTab, setUrgencyTab] = useState("ALL");
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [captureOpen, setCaptureOpen] = useState(false);
  const { showToast, ToastContainer } = useToast();

  // Listen for quick-capture event from bottom nav FAB
  useEffect(() => {
    const handler = () => setCaptureOpen(true);
    window.addEventListener('quick-capture', handler);
    return () => window.removeEventListener('quick-capture', handler);
  }, []);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [kpiFilter, setKpiFilter] = useState<KpiFilter>(null);
  const [expandedMission, setExpandedMission] = useState<string | null>(null);
  const [detailTask, setDetailTask] = useState<{ task: DetailTask; subtasks: DetailTask[] } | null>(null);
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);

  // Sync activeRoot when URL ?parent= changes (e.g. sidebar navigation)
  // Reset all view state so right panel reflects the new category
  useEffect(() => {
    setActiveRoot(parentParam);
    setSelectedCard(null);
    setUrgencyTab("ALL");
    setSessionsExpanded(false);
    setAllSessions([]);
    setKpiFilter(null);
    setExpandedMission(null);
  }, [parentParam]);

  const fetchDashboard = useCallback(async (tab: string, useCache = true) => {
    try {
      const url = `/api/dashboard?parent=${tab}`;
      const d = useCache
        ? await cachedFetch<Data & { error?: string }>(url, 15000)
        : await fetch(url).then((r) => r.json());
      if (d.error) throw new Error(d.error);
      setData(d);
    } catch {
      setData(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchDashboard(activeRoot); }, [activeRoot, fetchDashboard]);

  // Dynamic content update: auto-refresh every 30s when tab is visible
  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    function startPolling() {
      timer = setInterval(() => {
        if (!document.hidden) {
          invalidateCache(`/api/dashboard`);
          fetchDashboard(activeRoot, false);
        }
      }, 30000);
    }
    startPolling();
    return () => clearInterval(timer);
  }, [activeRoot, fetchDashboard]);

  function handleTabChange(key: string) {
    router.push(`/dashboard?parent=${key}`, { scroll: false });
    setActiveRoot(key);
    setSelectedCard(null);
    setUrgencyTab("ALL");
    setSessionsExpanded(false);
    setKpiFilter(null);
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
    let pool = urgencyTab === "ALL"
      ? data.tasks_by_priority.ALL
      : (data.tasks_by_priority[urgencyTab as keyof Data["tasks_by_priority"]] || []);
    // KPI pill filter
    if (kpiFilter === "P0") pool = pool.filter((t) => t.priority === "P0");
    else if (kpiFilter === "THIS_WEEK") pool = pool.filter((t) => t.bucket === "THIS_WEEK");
    else if (kpiFilter === "THIS_MONTH") pool = pool.filter((t) => t.bucket === "THIS_MONTH");
    // Card filter
    if (selectedCard) pool = pool.filter((t) => t.project_key === selectedCard);
    return pool;
  }, [data, urgencyTab, selectedCard, kpiFilter]);

  const displayedSessions = useMemo(() => {
    if (!data) return [];
    if (sessionsExpanded && allSessions.length > 0) return allSessions;
    return data.sessions.slice(0, 3);
  }, [data, sessionsExpanded, allSessions]);

  const leafProjects = useMemo(() => {
    if (!data?.cards) return [];
    return data.cards.map((c) => ({ child_key: c.child_key, display_name: c.display_name }));
  }, [data]);

  // Group subtasks by parent_task_id
  const subtaskMap = useMemo(() => {
    const map = new Map<string, DashboardTask[]>();
    if (!data) return map;
    for (const t of data.tasks_by_priority.ALL) {
      if (t.parent_task_id) {
        if (!map.has(t.parent_task_id)) map.set(t.parent_task_id, []);
        map.get(t.parent_task_id)!.push(t as DashboardTask);
      }
    }
    return map;
  }, [data]);

  // Keep detailTask subtasks in sync when data refreshes (e.g. after adding subtask)
  useEffect(() => {
    if (!detailTask || !data) return;
    const freshSubs = subtaskMap.get(detailTask.task.id) || [];
    const freshTask = data.tasks_by_priority.ALL.find((t) => t.id === detailTask.task.id);
    if (freshTask || freshSubs.length !== detailTask.subtasks.length) {
      setDetailTask((prev) => {
        if (!prev) return prev;
        return {
          task: freshTask ? (freshTask as unknown as DetailTask) : prev.task,
          subtasks: freshSubs as unknown as DetailTask[],
        };
      });
    }
  }, [data, subtaskMap, detailTask]);

  // Filter out subtasks from main list (they render inside parents)
  const mainTasks = useMemo(() => {
    return filteredTasks.filter((t) => !t.parent_task_id);
  }, [filteredTasks]);

  // ── Background sync helper ──
  function bgSync(promise: Promise<Response>, successMsg: string) {
    promise.then((res) => {
      if (!res.ok) throw new Error("Failed");
      showToast(successMsg);
      fetchDashboard(activeRoot);
    }).catch(() => {
      showToast("Sync failed", "error");
      fetchDashboard(activeRoot);
    });
  }

  // ── Optimistic task updater ──
  function updateTaskOptimistic(taskId: string, updater: (t: Task) => Task | null) {
    setData((prev) => {
      if (!prev) return prev;
      function walk(tasks: Task[]): Task[] {
        return tasks.reduce<Task[]>((acc, t) => {
          if (t.id === taskId) { const u = updater(t); if (u) acc.push(u); }
          else acc.push(t);
          return acc;
        }, []);
      }
      return {
        ...prev,
        tasks_by_priority: {
          P0: walk(prev.tasks_by_priority.P0),
          P1: walk(prev.tasks_by_priority.P1),
          P2: walk(prev.tasks_by_priority.P2),
          ALL: walk(prev.tasks_by_priority.ALL),
        },
      };
    });
  }

  // ── Handlers (optimistic + background sync) ──

  function handleModalUpdate(taskId: string, fields: Record<string, unknown>) {
    updateTaskOptimistic(taskId, (t) => ({ ...t, ...fields } as Task));
    bgSync(
      fetch(`/api/tasks/${taskId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(fields) }),
      "Updated"
    );
  }

  function handleModalDelete(taskId: string) {
    updateTaskOptimistic(taskId, () => null);
    setDetailTask(null);
    bgSync(fetch(`/api/tasks/${taskId}`, { method: "DELETE" }), "Task deleted");
  }

  function handleTaskUpdate(taskId: string, fields: Record<string, unknown>) {
    const task = data?.tasks_by_priority.ALL.find((t) => t.id === taskId);
    if (!task) return;
    updateTaskOptimistic(taskId, (t) => ({ ...t, ...fields } as Task));
    bgSync(
      fetch(`/api/projects/${task.project_key}/tasks/${taskId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(fields) }),
      "Saved"
    );
  }

  function handleTaskComplete(taskId: string, logMessage: string) {
    const task = data?.tasks_by_priority.ALL.find((t) => t.id === taskId);
    if (!task) return;
    updateTaskOptimistic(taskId, (t) => ({ ...t, completed: true }));
    setExpandedTaskId(null);
    bgSync(
      fetch(`/api/projects/${task.project_key}/tasks/${taskId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed", log_entry: { type: "completion", message: logMessage } }),
      }),
      "Task completed"
    );
  }

  function handleSectionComplete(taskId: string, currentProgress: string) {
    const match = currentProgress.match(/^(\d+)\/(\d+)$/);
    if (!match) return;
    const done = parseInt(match[1]) + 1;
    const total = parseInt(match[2]);
    const newProgress = `${done}/${total}`;
    const task = data?.tasks_by_priority.ALL.find((t) => t.id === taskId);
    if (!task) return;
    const payload: Record<string, unknown> = {
      progress: newProgress,
      log_entry: { type: "section_complete", message: `Completed section ${done}/${total}`, section: done },
    };
    if (done >= total) {
      payload.status = "completed";
      payload.log_entry = { type: "completion", message: `All ${total} sections completed` };
    }
    updateTaskOptimistic(taskId, (t) => ({ ...t, progress: newProgress, completed: done >= total }));
    if (done >= total) setExpandedTaskId(null);
    bgSync(
      fetch(`/api/projects/${task.project_key}/tasks/${taskId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      }),
      done >= total ? "All sections completed" : `Section ${done}/${total} done`
    );
  }

  function handleAddSubtask(parentId: string, text: string) {
    const parent = data?.tasks_by_priority.ALL.find((t) => t.id === parentId);
    if (!parent) return;
    bgSync(
      fetch(`/api/projects/${parent.project_key}/tasks`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, bucket: parent.bucket, parent_task_id: parentId }),
      }),
      "Subtask added"
    );
  }

  return (
    <div className={`flex flex-col bg-[var(--bg)] ${isDesktop ? "h-full overflow-hidden" : ""}`}>
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
        {data && <KpiRow stats={data.stats} activeFilter={kpiFilter} onFilter={setKpiFilter} />}

        {/* Latest session card + hook ticker */}
        {data && (data.sessions.length > 0 || data.hook_logs.length > 0) && (
          <div className="px-6 py-2 space-y-2">
            {/* Latest session/EOS card */}
            {data.sessions.length > 0 && (() => {
              const latest = data.sessions[0];
              const ago = (() => {
                const mins = Math.floor((Date.now() - new Date(latest.session_date + "T00:00:00").getTime()) / 60000);
                if (mins < 60) return "just now";
                const hrs = Math.floor(mins / 60);
                if (hrs < 24) return `${hrs}h ago`;
                return `${Math.floor(hrs / 24)}d ago`;
              })();
              return (
                <button
                  onClick={() => router.push(`/session/${latest.id}`)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[12px] bg-[var(--card)] border border-[var(--border)] hover:border-[var(--border2)] transition-all text-left"
                >
                  <div className="w-[8px] h-[8px] rounded-full shrink-0" style={{ backgroundColor: SURFACE_DOT[latest.surface || ""] || "var(--text3)" }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] text-[var(--text)] font-medium truncate">{latest.title}</p>
                    <p className="text-[11px] text-[var(--text3)]">{latest.project_key} · {ago}</p>
                  </div>
                  <span className="text-[10px] text-[var(--accent)] font-semibold shrink-0">Latest EOS</span>
                </button>
              );
            })()}

            {/* Hook activity ticker */}
            {data.hook_logs.length > 0 && (
              <div className="flex items-center gap-3 overflow-x-auto">
                {data.hook_logs.map((log, i) => {
                  const HOOK_COLORS: Record<string, string> = {
                    "task-sync": "var(--green)",
                    "skill-sync": "var(--purple)",
                    "auto-eos": "var(--orange)",
                  };
                  const ago = (() => {
                    const mins = Math.floor((Date.now() - new Date(log.created_at).getTime()) / 60000);
                    if (mins < 1) return "now";
                    if (mins < 60) return `${mins}m`;
                    const hrs = Math.floor(mins / 60);
                    if (hrs < 24) return `${hrs}h`;
                    return `${Math.floor(hrs / 24)}d`;
                  })();
                  return (
                    <div key={i} className="flex items-center gap-1.5 shrink-0">
                      <span className="w-[6px] h-[6px] rounded-full" style={{ backgroundColor: HOOK_COLORS[log.hook_name] || "var(--text3)" }} />
                      <span className="text-[10px] text-[var(--text3)] font-medium">{log.hook_name}</span>
                      <span className="text-[10px] text-[var(--text3)] opacity-60">{log.detail}</span>
                      <span className="text-[10px] text-[var(--text3)] opacity-40">{ago}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Root tabs — mobile only (sidebar handles this on desktop) */}
        {!isDesktop && (
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
        )}
        {isDesktop && <div className="border-b border-[var(--border)]" />}
      </header>

      {/* ═══ BODY ═══ */}
      {loading ? (
        <Skeleton />
      ) : !data ? (
        <div className="flex-1 flex items-center justify-center">
          <button onClick={() => fetchDashboard(activeRoot)} className="text-[13px] text-[var(--accent)]">Retry</button>
        </div>
      ) : (
        <div className={`flex-1 ${isDesktop ? "flex min-h-0 overflow-hidden" : ""}`}>
          {/* ── LEFT: Card grid + Sessions ── */}
          <div className={`${isDesktop ? "w-[420px] shrink-0 border-r border-[var(--border)] overflow-hidden" : ""} flex flex-col`}>
            {/* Sessions (collapsible) */}
            <div className={sessionsExpanded ? "flex-1 flex flex-col overflow-hidden" : "shrink-0"}>
              <div className="flex items-center justify-between px-4 py-2.5">
                <h2 className="text-[11px] font-bold text-[var(--text3)] uppercase tracking-[0.08em]">Sessions</h2>
                <button onClick={loadAllSessions} className="text-[11px] text-[var(--accent)] hover:underline">
                  {sessionsExpanded ? "Collapse" : `All (${data.session_total})`}
                </button>
              </div>
              <div className={`px-2 ${sessionsExpanded ? "overflow-y-auto flex-1" : ""}`}>
                {displayedSessions.map((s) => (
                  <SessionRow
                    key={s.id}
                    s={s}
                    expanded={expandedSessionId === s.id}
                    onToggle={() => setExpandedSessionId(expandedSessionId === s.id ? null : s.id)}
                  />
                ))}
                {!sessionsExpanded && data.session_total > 3 && (
                  <div className="flex justify-end px-3 py-1.5">
                    <button onClick={loadAllSessions} className="text-[11px] text-[var(--accent)] hover:underline">
                      View all ({data.session_total}) →
                    </button>
                  </div>
                )}
              </div>
            </div>

            {!sessionsExpanded && <div className="h-px bg-[var(--border)] mx-4" />}

            {/* Missions grouped by entity */}
            {!sessionsExpanded && data.missions_by_entity?.length > 0 && (
              <div className="shrink-0">
                <div className="flex items-center justify-between px-4 py-2.5">
                  <h2 className="text-[11px] font-bold text-[var(--text3)] uppercase tracking-[0.08em]">Missions</h2>
                  <span className="text-[11px] text-[var(--text3)]">{data.missions.length}</span>
                </div>
                <div className="px-2 space-y-2 pb-2">
                  {data.missions_by_entity.map((entity) => (
                    <div key={entity.entity_key}>
                      {/* Entity header */}
                      <div className="flex items-center justify-between px-3 py-1.5">
                        <span className="text-[11px] font-semibold text-[var(--accent)] uppercase tracking-[0.04em]">{entity.entity_name}</span>
                        <span className="text-[10px] text-[var(--text3)] tabular-nums">{entity.total_mission_tasks} tasks</span>
                      </div>
                      {/* Missions under this entity */}
                      <div className="space-y-1">
                        {entity.missions.map((m) => {
                          const isExpanded = expandedMission === m.mission;
                          return (
                            <div key={m.mission}>
                              <button
                                onClick={() => setExpandedMission(isExpanded ? null : m.mission)}
                                className="w-full text-left px-3 py-2 rounded-[10px] bg-[var(--card)] transition-all hover:bg-[var(--card)]/80 ml-1"
                                style={{ width: "calc(100% - 4px)" }}
                              >
                                <div className="flex items-center justify-between mb-0.5">
                                  <div className="flex items-center gap-1.5">
                                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className={`transition-transform shrink-0 ${isExpanded ? "rotate-90" : ""}`}>
                                      <path d="M3 1L7 5L3 9" stroke="var(--text3)" strokeWidth="1.5" strokeLinecap="round" />
                                    </svg>
                                    <span className="text-[13px] font-semibold text-[var(--text)]">{m.mission}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {m.p0 > 0 && <span className="w-[6px] h-[6px] rounded-full" style={{ backgroundColor: "var(--red)" }} />}
                                    <span className="text-[11px] text-[var(--text3)] tabular-nums">{m.task_count}</span>
                                  </div>
                                </div>
                                {!isExpanded && (
                                  <>
                                    <p className="text-[11px] text-[var(--text3)] line-clamp-1 pl-[18px]">{m.latest_task}</p>
                                    <p className="text-[10px] text-[var(--text3)] mt-0.5 opacity-60 pl-[18px]">
                                      {new Date(m.latest_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                      {" · "}
                                      {new Date(m.latest_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                                    </p>
                                  </>
                                )}
                              </button>
                              {isExpanded && (
                                <div className="mt-1 space-y-0.5 pl-3">
                                  {m.tasks.slice(0, 5).map((t) => {
                                    const taskFull = data.tasks_by_priority.ALL.find((ft) => ft.id === t.id);
                                    const subs = (subtaskMap.get(t.id) || []) as unknown as DetailTask[];
                                    return (
                                      <button
                                        key={t.id}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (taskFull) {
                                            setDetailTask({ task: taskFull as unknown as DetailTask, subtasks: subs });
                                          } else {
                                            setDetailTask({ task: { ...t, description: null, version: null, completed: false, log: null, bucket: t.bucket || "THIS_WEEK", project_key: t.project_key, is_owner_action: t.is_owner_action, parent_task_id: null, mission: m.mission } as unknown as DetailTask, subtasks: subs });
                                          }
                                        }}
                                        className="w-full flex items-center gap-2 px-3 py-1.5 rounded-[8px] hover:bg-[var(--card2)] transition-colors text-left"
                                      >
                                        {t.priority && (
                                          <span className="w-[6px] h-[6px] rounded-full shrink-0" style={{ backgroundColor: PRIORITY_DOT[t.priority] || "var(--border2)" }} />
                                        )}
                                        {t.task_code && <span className="text-[10px] font-mono text-[var(--accent)] shrink-0">{t.task_code}</span>}
                                        <span className="text-[12px] text-[var(--text2)] line-clamp-1 flex-1">{t.text}</span>
                                        {t.surface && (
                                          <span className="inline-flex items-center gap-0.5 shrink-0">
                                            <span className="w-[4px] h-[4px] rounded-full" style={{ backgroundColor: SURFACE_DOT[t.surface] }} />
                                            <span className="text-[9px] text-[var(--text3)]">{t.surface}</span>
                                          </span>
                                        )}
                                      </button>
                                    );
                                  })}
                                  {m.task_count > 5 && (
                                    <p className="text-[10px] text-[var(--text3)] opacity-60 px-3 py-1">+{m.task_count - 5} more</p>
                                  )}
                                  <button
                                    onClick={() => router.push(`/mission/${encodeURIComponent(m.mission)}`)}
                                    className="text-[11px] text-[var(--accent)] hover:underline px-3 py-1.5"
                                  >
                                    View all →
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="h-px bg-[var(--border)] mx-4" />
              </div>
            )}

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
                        // Single click: navigate to entity project page
                        router.push(`/project/${card.child_key}`);
                      }}
                      onFilterClick={(e) => {
                        e.stopPropagation();
                        if (selectedCard === card.child_key) setSelectedCard(null);
                        else setSelectedCard(card.child_key);
                      }}
                      onTaskClick={(t) => {
                        const subs = (subtaskMap.get(t.id) || []) as unknown as DetailTask[];
                        setDetailTask({ task: { ...t, description: null, version: null, completed: false, log: null } as DetailTask, subtasks: subs });
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── RIGHT: Task list ── */}
          <div className={`flex-1 flex flex-col ${isDesktop ? "min-h-0 overflow-hidden" : "mt-2 border-t border-[var(--border)]"}`}>
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
            <div className={`px-6 py-3 ${isDesktop ? "flex-1 overflow-y-auto" : ""}`}>
              {mainTasks.length === 0 ? (
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
                <div className="space-y-1">
                  {mainTasks.map((t) => {
                    const subs = subtaskMap.get(t.id) || [];
                    const progress = t.progress?.match(/^(\d+)\/(\d+)$/);
                    return (
                      <button
                        key={t.id}
                        onClick={() => setDetailTask({
                          task: t as unknown as DetailTask,
                          subtasks: subs as unknown as DetailTask[],
                        })}
                        className="w-full flex items-start gap-2.5 px-3 py-2.5 rounded-[8px] bg-[var(--card)] border border-[var(--border)] hover:border-[var(--border2)] transition-all text-left"
                      >
                        <span
                          className="w-[7px] h-[7px] rounded-full shrink-0 mt-[5px]"
                          style={{ backgroundColor: PRIORITY_DOT[t.priority || ""] || "var(--border2)" }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] leading-[1.3] text-[var(--text)]">
                            {t.task_code && <span className="text-[var(--accent)] font-mono text-[10px] mr-1">{t.task_code}</span>}
                            {t.text}
                          </p>
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            <span className="text-[10px] text-[var(--text3)]">{t.project_key}</span>
                            {t.mission && <span className="text-[10px] text-[var(--purple)] truncate max-w-[120px]">{t.mission}</span>}
                            {t.surface && (
                              <span className="inline-flex items-center gap-0.5">
                                <span className="w-[4px] h-[4px] rounded-full" style={{ backgroundColor: SURFACE_DOT[t.surface] }} />
                                <span className="text-[10px] text-[var(--text3)] uppercase">{t.surface}</span>
                              </span>
                            )}
                            {t.bucket !== "THIS_WEEK" && (
                              <span className="text-[10px] text-[var(--text3)] px-1 py-[0.5px] rounded bg-[var(--card2)]">
                                {t.bucket === "THIS_MONTH" ? "Month" : t.bucket === "PARKED" ? "Parked" : t.bucket}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {progress && (
                            <span className="text-[10px] font-bold text-[var(--accent)] tabular-nums">{t.progress}</span>
                          )}
                          {t.is_owner_action && (
                            <span className="text-[10px] font-bold text-[var(--cyan)]">YOU</span>
                          )}
                          {subs.length > 0 && (
                            <span className="text-[10px] text-[var(--text3)] tabular-nums">{subs.filter((s) => s.completed).length}/{subs.length}</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Task detail modal (from card/mission clicks) */}
      {detailTask && (
        <TaskDetail
          task={detailTask.task}
          subtasks={detailTask.subtasks}
          onClose={() => { setDetailTask(null); fetchDashboard(activeRoot); }}
          onUpdate={handleModalUpdate}
          onDelete={handleModalDelete}
          onAddSubtask={async (parentId, text) => {
            const parentTask = data?.tasks_by_priority.ALL.find((t) => t.id === parentId);
            if (!parentTask) return;
            bgSync(
              fetch(`/api/projects/${parentTask.project_key}/tasks`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text, bucket: parentTask.bucket, parent_task_id: parentId }),
              }),
              "Subtask added"
            );
          }}
        />
      )}

      <ToastContainer />
      {isDesktop && <Fab onPress={() => setCaptureOpen(true)} />}
      <QuickCaptureSheet
        open={captureOpen}
        onClose={() => setCaptureOpen(false)}
        projects={leafProjects}
        onSubmitted={() => { fetchDashboard(activeRoot); showToast("Task added"); }}
      />
    </div>
  );
}
