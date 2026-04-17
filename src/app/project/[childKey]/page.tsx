"use client";

import { useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { useParams, useRouter } from "next/navigation";
import { StickyHeader } from "@/components/sticky-header";
import { TaskAddBar } from "@/components/task-add-bar";
import { PullToRefresh } from "@/components/pull-to-refresh";
import { ErrorBanner } from "@/components/error-banner";
import { EmptyState } from "@/components/empty-state";
import { useToast } from "@/components/toast";
import { ProjectCard } from "@/components/project-card";
import { ProjectModules } from "@/components/modules/project-modules";
import { SessionLogList } from "@/components/session-log-list";
import { type DetailTask } from "@/components/task/task-detail";
import { Fab } from "@/components/fab";
import { IdBadge } from "@/components/id-badge";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import { cachedFetch, invalidateCache } from "@/lib/cache";
import { useRealtimeRefresh } from "@/hooks/useRealtimeRefresh";
import { bgMutate, patchTask, deleteTask } from "@/lib/mutate";

// Lazy-load heavy components
const QuickCaptureSheet = dynamic(() => import("@/components/quick-capture-sheet").then((m) => ({ default: m.QuickCaptureSheet })), { ssr: false });

const TaskDetail = dynamic(() => import("@/components/task/task-detail").then((m) => ({ default: m.TaskDetail })), { ssr: false });

interface NestedTask {
  id: string;
  text: string;
  description: string | null;
  completed: boolean;
  bucket: string;
  priority: string | null;
  is_owner_action: boolean;
  parent_task_id: string | null;
  task_code: string | null;
  mission: string | null;
  version: string | null;
  surface: string | null;
  progress: string | null;
  log: { timestamp: string; type: string; message: string }[] | null;
  updated_at: string;
  project_key: string;
  sub_tasks: NestedTask[];
}

interface SessionLog {
  id: string;
  session_date: string;
  title: string | null;
  surface: string | null;
  summary: string | null;
}

interface MissionInfo {
  mission: string;
  task_count: number;
  p0: number;
  p1: number;
  p2: number;
  tasks: { id: string; text: string; priority: string | null; task_code: string | null; project_key: string; bucket: string; completed: boolean; updated_at: string }[];
}

interface ChildInfo {
  child_key: string;
  display_name: string;
  status: string | null;
  open_tasks: number;
}

interface ModuleData {
  id: string;
  module_type: string;
  title: string;
  body: string | null;
  metadata: Record<string, unknown>;
}

interface DeploymentRow {
  id: string;
  project_key: string;
  module_code: string | null;
  module_slug: string | null;
  git_repo: string | null;
  vercel_project: string | null;
  custom_domain: string | null;
  last_deploy: string | null;
}

interface ProjectDetail {
  child_key: string;
  display_name: string;
  brief: string | null;
  status: string | null;
  build_phase: string | null;
  current_version: string | null;
  surface: string | null;
  last_session_date: string | null;
  next_action: string | null;
  is_leaf: boolean;
  tasks: {
    this_week: NestedTask[];
    this_month: NestedTask[];
    parked: NestedTask[];
    completed: NestedTask[];
  };
  missions: MissionInfo[];
  children_info: ChildInfo[];
  session_logs: SessionLog[];
  modules: ModuleData[];
  deployments: DeploymentRow[];
}

interface NoteItem {
  id: string;
  project_key: string;
  text: string;
  note_type: string;
  feature: string | null;
  mission: string | null;
  version: string | null;
  resolved: boolean;
  created_at: string;
}

const NOTE_ICONS: Record<string, { icon: string; bg: string; color: string }> = {
  GAP: { icon: '!', bg: 'var(--red-dim)', color: 'var(--red)' },
  IDEA: { icon: '✦', bg: 'var(--purple-dim)', color: 'var(--purple)' },
  OBSERVATION: { icon: '◉', bg: 'var(--cyan-dim)', color: 'var(--cyan)' },
  REVISIT: { icon: '↻', bg: 'var(--yellow-dim)', color: 'var(--yellow)' },
};

const PRIORITY_MISSION: Record<string, string> = { P0: "var(--red)", P1: "var(--orange)", P2: "var(--yellow)" };

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const childKey = params.childKey as string;
  const isDesktop = useBreakpoint(768);

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [moveSheet, setMoveSheet] = useState<{ taskId: string; currentBucket: string } | null>(null);
  const [selectedTask, setSelectedTask] = useState<NestedTask | null>(null);
  const [expandedMission, setExpandedMission] = useState<string | null>(null);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [activeBucket, setActiveBucket] = useState<"THIS_WEEK" | "THIS_MONTH" | "PARKED">("THIS_WEEK");
  const [activeTab, setActiveTab] = useState<"tasks" | "notes" | "timeline">("tasks");
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [notesLoaded, setNotesLoaded] = useState(false);
  const { showToast, ToastContainer } = useToast();

  const fetchProject = useCallback(async (skipCache = false) => {
    try {
      setError(null);
      const url = `/api/projects/${childKey}`;
      let proj;
      if (skipCache) {
        invalidateCache(url);
        const res = await fetch(url);
        if (res.status === 404) { setError("Project not found."); return; }
        if (!res.ok) throw new Error("Failed");
        proj = await res.json();
      } else {
        proj = await cachedFetch<ProjectDetail>(url, 20000);
      }
      setProject(proj);
      // Auto-select first non-empty bucket if current bucket is empty
      if (proj.tasks) {
        const bucketMap: Record<string, string[]> = {
          THIS_WEEK: proj.tasks.this_week,
          THIS_MONTH: proj.tasks.this_month,
          PARKED: proj.tasks.parked,
        };
        const currentBucketTasks = bucketMap[activeBucket];
        if (!currentBucketTasks || currentBucketTasks.length === 0) {
          if (proj.tasks.this_week.length > 0) setActiveBucket("THIS_WEEK");
          else if (proj.tasks.this_month.length > 0) setActiveBucket("THIS_MONTH");
          else if (proj.tasks.parked.length > 0) setActiveBucket("PARKED");
        }
      }
    } catch {
      setError("Failed to load tasks. Pull to retry.");
    } finally {
      setLoading(false);
    }
  }, [childKey, activeBucket]);

  useEffect(() => { fetchProject(); }, [fetchProject]);

  // Realtime: auto-refresh when tasks change for this project
  useRealtimeRefresh({
    table: 'angelo_tasks',
    cachePrefix: `/api/projects/${childKey}`,
    onRefresh: () => fetchProject(true),
    filterColumn: 'project_key',
    filterValue: childKey,
  });

  // Realtime: auto-refresh notes when they change
  useRealtimeRefresh({
    table: 'angelo_notes',
    cachePrefix: `/api/notes`,
    onRefresh: async () => {
      try {
        const res = await fetch(`/api/notes?project_key=${childKey}`);
        if (res.ok) {
          const data = await res.json();
          setNotes(data.notes || []);
        }
      } catch { /* ignore */ }
    },
    filterColumn: 'project_key',
    filterValue: childKey,
  });

  // Fetch notes when Notes tab is first selected
  useEffect(() => {
    if (activeTab !== 'notes' || notesLoaded) return;
    (async () => {
      try {
        const res = await fetch(`/api/notes?project_key=${childKey}`);
        if (res.ok) {
          const data = await res.json();
          setNotes(data.notes || []);
        }
      } catch { /* ignore */ }
      setNotesLoaded(true);
    })();
  }, [activeTab, notesLoaded, childKey]);

  // Listen for quick-capture event from BottomNav
  useEffect(() => {
    const open = () => setCaptureOpen(true);
    window.addEventListener('quick-capture', open);
    return () => window.removeEventListener('quick-capture', open);
  }, []);

  // ── Helper: optimistically update a task in local state ──
  function updateTaskInState(taskId: string, updater: (t: NestedTask) => NestedTask | null) {
    setProject((prev) => {
      if (!prev) return prev;
      function walkTasks(tasks: NestedTask[]): NestedTask[] {
        return tasks.reduce<NestedTask[]>((acc, t) => {
          if (t.id === taskId) {
            const updated = updater(t);
            if (updated) acc.push({ ...updated, sub_tasks: walkTasks(updated.sub_tasks) });
            // null = deleted
          } else {
            acc.push({ ...t, sub_tasks: walkTasks(t.sub_tasks) });
          }
          return acc;
        }, []);
      }
      return {
        ...prev,
        tasks: {
          this_week: walkTasks(prev.tasks.this_week),
          this_month: walkTasks(prev.tasks.this_month),
          parked: walkTasks(prev.tasks.parked),
          completed: walkTasks(prev.tasks.completed),
        },
      };
    });
  }

  // ── Background sync helper ──
  const syncOpts = (successMsg: string) => ({
    onSuccess: () => { showToast(successMsg); invalidateCache(`/api/projects/${childKey}`); fetchProject(true); },
    onError: () => { showToast("Sync failed — retrying...", "error"); fetchProject(true); },
  });

  function handleToggleTask(taskId: string, currentCompleted: boolean) {
    const newCompleted = !currentCompleted;
    // Optimistic: move task between buckets
    setProject((prev) => {
      if (!prev) return prev;
      function findAndRemove(tasks: NestedTask[]): { found: NestedTask | null; remaining: NestedTask[] } {
        let found: NestedTask | null = null;
        const remaining = tasks.filter((t) => {
          if (t.id === taskId) { found = t; return false; }
          return true;
        });
        return { found, remaining };
      }
      const bucketKeys = ["this_week", "this_month", "parked", "completed"] as const;
      let foundTask: NestedTask | null = null;
      const newTasks = { ...prev.tasks };
      for (const bk of bucketKeys) {
        const { found, remaining } = findAndRemove(newTasks[bk]);
        if (found) { foundTask = found; newTasks[bk] = remaining; break; }
      }
      if (foundTask) {
        const updated = { ...foundTask, completed: newCompleted };
        if (newCompleted) {
          newTasks.completed = [updated, ...newTasks.completed];
        } else {
          const bucket = (foundTask.bucket === "THIS_WEEK" ? "this_week" : foundTask.bucket === "THIS_MONTH" ? "this_month" : "parked") as keyof typeof newTasks;
          newTasks[bucket] = [...newTasks[bucket], updated];
        }
      }
      return { ...prev, tasks: newTasks };
    });
    patchTask(taskId, childKey, { status: newCompleted ? "completed" : "open" },
      syncOpts(newCompleted ? "Task completed" : "Task reopened"));
  }

  function handleUpdateText(taskId: string, text: string) {
    updateTaskInState(taskId, (t) => ({ ...t, text }));
    patchTask(taskId, childKey, { text }, syncOpts("Saved"));
  }

  function handleMoveTask(taskId: string, targetBucket: string) {
    setMoveSheet(null);
    // Optimistic: move between bucket lists
    setProject((prev) => {
      if (!prev) return prev;
      const bucketMap: Record<string, keyof ProjectDetail["tasks"]> = {
        THIS_WEEK: "this_week", THIS_MONTH: "this_month", PARKED: "parked",
      };
      let foundTask: NestedTask | null = null;
      const newTasks = { ...prev.tasks };
      for (const bk of ["this_week", "this_month", "parked"] as const) {
        const idx = newTasks[bk].findIndex((t) => t.id === taskId);
        if (idx >= 0) {
          foundTask = newTasks[bk][idx];
          newTasks[bk] = [...newTasks[bk].slice(0, idx), ...newTasks[bk].slice(idx + 1)];
          break;
        }
      }
      if (foundTask) {
        const target = bucketMap[targetBucket] || "parked";
        newTasks[target] = [...newTasks[target], { ...foundTask, bucket: targetBucket }];
      }
      return { ...prev, tasks: newTasks };
    });
    bgMutate({
      request: () => fetch(`/api/projects/${childKey}/tasks/${taskId}/move`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_bucket: targetBucket }),
      }),
      cacheKeys: [`/api/dashboard`, `/api/projects/${childKey}`],
      ...syncOpts("Moved"),
    });
  }

  function handleModalUpdate(taskId: string, fields: Record<string, unknown>) {
    updateTaskInState(taskId, (t) => ({ ...t, ...fields } as NestedTask));
    patchTask(taskId, childKey, fields, syncOpts("Updated"));
  }

  function handleModalDelete(taskId: string) {
    updateTaskInState(taskId, () => null);
    setSelectedTask(null);
    deleteTask(taskId, childKey, syncOpts("Task deleted"));
  }

  function handleAddTask(text: string, bucket: string) {
    // Optimistic: add placeholder
    const tempId = `temp-${Date.now()}`;
    const newTask: NestedTask = {
      id: tempId, text, description: null, completed: false, bucket,
      priority: null, is_owner_action: false, parent_task_id: null,
      task_code: null, mission: null, version: null, surface: null,
      progress: null, log: null, updated_at: new Date().toISOString(),
      project_key: childKey, sub_tasks: [],
    };
    setProject((prev) => {
      if (!prev) return prev;
      const bk = (bucket === "THIS_WEEK" ? "this_week" : bucket === "THIS_MONTH" ? "this_month" : "parked") as keyof ProjectDetail["tasks"];
      return { ...prev, tasks: { ...prev.tasks, [bk]: [...prev.tasks[bk], newTask] } };
    });
    bgMutate({
      request: () => fetch(`/api/projects/${childKey}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, bucket }),
      }),
      cacheKeys: [`/api/dashboard`, `/api/projects/${childKey}`],
      ...syncOpts("Task added"),
    });
  }

  const totalOpen = project
    ? project.tasks.this_week.length + project.tasks.this_month.length + project.tasks.parked.length
    : 0;
  const totalDone = project ? project.tasks.completed.length : 0;
  const totalAll = totalOpen + totalDone;

  return (
    <div className="flex flex-col h-full min-h-0 bg-[var(--bg)]">
      <StickyHeader title={project?.display_name || "Loading..."} showBack />

      {error && <ErrorBanner message={error} onRetry={fetchProject} />}

      <PullToRefresh onRefresh={fetchProject}>
        {loading ? (
          <div className="px-4 py-3 space-y-4 animate-pulse">
            {/* Header card skeleton */}
            <div className="rounded-[var(--r)] bg-[var(--card)] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="h-5 w-40 bg-[var(--border)] rounded" />
                <div className="h-5 w-16 bg-[var(--border)] rounded-full" />
              </div>
              <div className="h-3 w-56 bg-[var(--border)] rounded" />
              <div className="h-3 w-32 bg-[var(--border)] rounded" />
            </div>
            {/* Bucket section skeletons (3 buckets) */}
            {[...Array(3)].map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="h-3 w-20 bg-[var(--border)] rounded" />
                {[...Array(3)].map((_, j) => (
                  <div key={j} className="flex items-center gap-3 px-3 py-2.5">
                    <div className="w-[18px] h-[18px] rounded border-2 border-[var(--border)] shrink-0" />
                    <div className="h-3 flex-1 bg-[var(--border)] rounded" style={{ maxWidth: `${60 + j * 15}%` }} />
                  </div>
                ))}
              </div>
            ))}
          </div>
        ) : !project && !error ? (
          <EmptyState message="Project not found." />
        ) : project ? (
          <>
            {/* ID + vault path strip — pain #4 (IDs visible everywhere) */}
            <div className="px-4 pt-3 flex items-center gap-1.5 flex-wrap">
              <IdBadge value={project.child_key} label="project_key" kind="key" />
              {project.current_version && <IdBadge value={project.current_version} label="version" kind="code" />}
              {project.build_phase && (
                <span className="text-[9px] font-bold uppercase tracking-[0.05em] px-1.5 py-[1px] rounded-[4px] bg-[var(--purple-dim)] text-[var(--purple)]">
                  {project.build_phase}
                </span>
              )}
              <span className="text-[10px] text-[var(--text3)]">entity</span>
            </div>

            {/* Detailed project header card */}
            <div className="px-4 pt-3">
              <ProjectCard
                project={{
                  child_key: project.child_key,
                  display_name: project.display_name,
                  status: project.status || undefined,
                  build_phase: project.build_phase || undefined,
                  current_version: project.current_version,
                  brief: project.brief,
                  next_action: project.next_action,
                  last_session_date: project.last_session_date,
                  surface: project.surface,
                  is_leaf: true,
                  task_counts: {
                    this_week: project.tasks.this_week.length,
                    this_month: project.tasks.this_month.length,
                    parked: project.tasks.parked.length,
                  },
                  children_task_total: 0,
                  descendant_task_total: 0,
                  completed_count: totalDone,
                }}
                variant="detailed"
              />
            </div>

            {/* Project modules (context-specific sections) */}
            {(project.modules?.length > 0 || project.deployments?.length > 0) && (
              <ProjectModules modules={project.modules || []} deployments={project.deployments || []} />
            )}

            {/* Children entities (non-leaf) */}
            {project.children_info && project.children_info.length > 0 && (
              <div className="px-4 pt-3">
                <h2 className="text-[11px] font-bold text-[var(--text3)] uppercase tracking-[0.07em] mb-2">Sub-projects</h2>
                <div className="grid grid-cols-2 gap-2">
                  {project.children_info.map((child) => (
                    <button
                      key={child.child_key}
                      onClick={() => router.push(`/project/${child.child_key}`)}
                      className="text-left px-3 py-2.5 rounded-[var(--r-sm)] bg-[var(--card)] border border-[var(--border)] hover:border-[var(--border2)] transition-all"
                    >
                      <span className="text-[13px] font-semibold text-[var(--accent)] block truncate">{child.display_name}</span>
                      <span className="text-[11px] text-[var(--text3)]">{child.open_tasks} open tasks</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Missions — expand to show full task + subtask tree (pain #2) */}
            {project.missions && project.missions.length > 0 && (
              <div className="px-4 pt-3">
                <h2 className="text-[11px] font-bold text-[var(--text3)] uppercase tracking-[0.07em] mb-2">
                  Missions <span className="text-[var(--text3)] font-normal normal-case">· entity → mission → task → subtask</span>
                </h2>
                <div className="space-y-1.5">
                  {project.missions.map((m) => {
                    const isExp = expandedMission === m.mission;
                    // Pull nested tasks (with subtasks) from the full project tree by mission name
                    const nestedForMission = [
                      ...project.tasks.this_week,
                      ...project.tasks.this_month,
                      ...project.tasks.parked,
                    ].filter((t) => t.mission === m.mission);
                    const subtaskCount = nestedForMission.reduce((n, t) => n + countSubtree(t.sub_tasks), 0);
                    return (
                      <div key={m.mission}>
                        <button
                          onClick={() => setExpandedMission(isExp ? null : m.mission)}
                          className="w-full text-left px-3 py-2.5 rounded-[10px] bg-[var(--card)] border border-[var(--border)] hover:border-[var(--border2)] transition-all"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className={`transition-transform shrink-0 ${isExp ? "rotate-90" : ""}`}>
                                <path d="M3 1L7 5L3 9" stroke="var(--text3)" strokeWidth="1.5" strokeLinecap="round" />
                              </svg>
                              <span className="text-[13px] font-semibold text-[var(--text)] truncate">{m.mission}</span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {m.p0 > 0 && <span className="w-[6px] h-[6px] rounded-full" style={{ backgroundColor: PRIORITY_MISSION.P0 }} title={`${m.p0} P0`} />}
                              {m.p1 > 0 && <span className="w-[6px] h-[6px] rounded-full" style={{ backgroundColor: PRIORITY_MISSION.P1 }} title={`${m.p1} P1`} />}
                              <span className="text-[11px] text-[var(--text3)] tabular-nums">
                                {m.task_count} task{m.task_count === 1 ? '' : 's'}{subtaskCount > 0 && ` · ${subtaskCount} sub`}
                              </span>
                            </div>
                          </div>
                        </button>
                        {isExp && (
                          <div className="mt-1 ml-3 pl-3 border-l border-[var(--border)] space-y-0.5 py-1">
                            {nestedForMission.length === 0 ? (
                              <p className="text-[11px] text-[var(--text3)] px-2 py-1">No open tasks in this mission.</p>
                            ) : (
                              nestedForMission.map((t) => (
                                <MissionTaskRow
                                  key={t.id}
                                  task={t}
                                  depth={0}
                                  onOpen={() => setSelectedTask(t)}
                                  onToggle={handleToggleTask}
                                />
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Tab bar: Tasks / Notes / Timeline */}
            <div className="px-4 pt-3">
              <div className="flex gap-1 border-b border-[var(--border)]">
                {([
                  { key: 'tasks' as const, label: `Tasks (${totalOpen})` },
                  { key: 'notes' as const, label: `Notes (${notes.length})` },
                  { key: 'timeline' as const, label: 'Timeline' },
                ]).map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className="px-3.5 py-2 text-[12px] font-medium -mb-px transition-colors"
                    style={{
                      color: activeTab === tab.key ? 'var(--accent)' : 'var(--text3)',
                      borderBottom: activeTab === tab.key ? '2px solid var(--accent)' : '2px solid transparent',
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Notes tab */}
            {activeTab === 'notes' && (
              <div className="px-4 py-3">
                {!notesLoaded ? (
                  <p className="text-[13px] text-[var(--text3)]">Loading notes...</p>
                ) : notes.length === 0 ? (
                  <p className="text-[13px] text-[var(--text3)]">No notes yet. Add notes via CLI: task note add --project {childKey}</p>
                ) : (
                  <div className="space-y-2">
                    {notes.map((n) => {
                      const style = NOTE_ICONS[n.note_type] || NOTE_ICONS.OBSERVATION;
                      return (
                        <div key={n.id} className="flex items-start gap-2.5 p-3 bg-[var(--card)] rounded-[10px]" style={{ opacity: n.resolved ? 0.5 : 1 }}>
                          <div className="w-[26px] h-[26px] rounded-[6px] flex items-center justify-center text-[11px] font-bold shrink-0" style={{ background: style.bg, color: style.color }}>
                            {style.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-medium" style={{ textDecoration: n.resolved ? 'line-through' : 'none' }}>{n.text}</p>
                            <p className="text-[10px] text-[var(--text3)] mt-0.5 flex items-center gap-1 flex-wrap">
                              <span className="font-semibold" style={{ color: style.color }}>{n.note_type}</span>
                              {n.version && <><span>&middot;</span><span style={{ color: 'var(--orange)' }}>{n.version}</span></>}
                              {n.mission && <><span>&middot;</span><span>{n.mission}</span></>}
                              {n.resolved && <><span>&middot;</span><span style={{ color: 'var(--green)' }}>RESOLVED</span></>}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Timeline tab */}
            {activeTab === 'timeline' && (
              <div className="px-4 py-3">
                {project.session_logs && project.session_logs.length > 0 ? (
                  <div className="relative pl-7">
                    <div className="absolute left-[9px] top-[6px] bottom-[6px] w-[2px] bg-[var(--border)] rounded-sm" />
                    {project.session_logs.map((s, i) => (
                      <div key={s.id} className="relative pb-4 last:pb-0">
                        <div
                          className="absolute -left-7 top-[2px] w-[18px] h-[18px] rounded-full flex items-center justify-center text-[8px] font-bold text-white z-[1]"
                          style={{
                            background: i === 0 ? 'var(--accent)' : s.surface === 'CODE' ? 'var(--accent)' : s.surface === 'CHAT' ? 'var(--green)' : 'var(--purple)',
                            boxShadow: i === 0 ? '0 0 6px var(--accent)' : 'none',
                          }}
                        >
                          {s.surface?.[0] || 'S'}
                        </div>
                        <div>
                          <p className="text-[12px] font-semibold">{s.title || 'Untitled'}</p>
                          <p className="text-[10px] text-[var(--text3)] mt-0.5">
                            {s.session_date}
                            {s.surface && <> &middot; <span style={{ color: s.surface === 'CODE' ? 'var(--accent)' : s.surface === 'CHAT' ? 'var(--green)' : 'var(--purple)' }}>{s.surface}</span></>}
                          </p>
                          {s.summary && <p className="text-[11px] text-[var(--text2)] mt-1 line-clamp-2">{s.summary}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[13px] text-[var(--text3)]">No sessions recorded for this project yet.</p>
                )}
              </div>
            )}

            {/* Tasks tab content */}
            {activeTab === 'tasks' && (totalAll === 0 ? (
              <EmptyState message="No tasks yet. Add your first task below." />
            ) : (
              <div>
                {/* Bucket filter tabs — sticky below header */}
                <div className="sticky top-0 z-10 bg-[var(--bg)] px-4 pt-3 pb-2">
                  <div className="flex gap-2">
                    {([
                      { key: "THIS_WEEK" as const, label: "Week", count: project.tasks.this_week.length, color: "var(--accent)" },
                      { key: "THIS_MONTH" as const, label: "Month", count: project.tasks.this_month.length, color: "var(--purple)" },
                      { key: "PARKED" as const, label: "Parked", count: project.tasks.parked.length, color: "var(--text3)" },
                    ]).map((tab) => (
                      <button
                        key={tab.key}
                        onClick={() => setActiveBucket(tab.key)}
                        className={`flex-1 py-2 rounded-full text-[13px] font-medium transition-colors min-h-[44px] ${
                          activeBucket === tab.key
                            ? "text-white"
                            : "bg-[var(--card)] text-[var(--text2)] border border-[var(--border)]"
                        }`}
                        style={activeBucket === tab.key ? { backgroundColor: tab.color } : undefined}
                      >
                        {tab.label} ({tab.count})
                      </button>
                    ))}
                  </div>
                </div>

                {/* Active bucket content */}
                <div className="px-4 pb-3">
                {activeBucket === "THIS_WEEK" && (
                  <BucketSection
                    title="THIS WEEK"
                    tasks={project.tasks.this_week}
                    totalInBucket={project.tasks.this_week.length}
                    colorVar="var(--accent)"
                    onToggle={handleToggleTask}
                    onLongPress={(id) => setMoveSheet({ taskId: id, currentBucket: "THIS_WEEK" })}
                    onUpdateText={handleUpdateText}
                    onOpen={(task) => setSelectedTask(task)}
                  />
                )}
                {activeBucket === "THIS_MONTH" && (
                  <BucketSection
                    title="THIS MONTH"
                    tasks={project.tasks.this_month}
                    totalInBucket={project.tasks.this_month.length}
                    colorVar="var(--purple)"
                    onToggle={handleToggleTask}
                    onLongPress={(id) => setMoveSheet({ taskId: id, currentBucket: "THIS_MONTH" })}
                    onUpdateText={handleUpdateText}
                    onOpen={(task) => setSelectedTask(task)}
                  />
                )}
                {activeBucket === "PARKED" && (
                  <BucketSection
                    title="PARKED"
                    tasks={project.tasks.parked}
                    totalInBucket={project.tasks.parked.length}
                    colorVar="var(--text3)"
                    onToggle={handleToggleTask}
                    onLongPress={(id) => setMoveSheet({ taskId: id, currentBucket: "PARKED" })}
                    onUpdateText={handleUpdateText}
                    onOpen={(task) => setSelectedTask(task)}
                  />
                )}

                {project.tasks.completed.length > 0 && (
                  <div className="mt-4">
                    <button
                      onClick={() => setShowCompleted(!showCompleted)}
                      className="flex items-center gap-2 text-[12px] font-semibold text-[var(--text3)] uppercase tracking-[0.07em] mb-2 min-h-[44px]"
                    >
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className={`transition-transform ${showCompleted ? "rotate-90" : ""}`}>
                        <path d="M4 2L8 6L4 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                      <span style={{ color: 'var(--green)' }}>&#10003;</span>
                      Completed ({project.tasks.completed.length})
                    </button>
                    {showCompleted && (
                      <div className="space-y-0.5">
                        {project.tasks.completed.map((task) => (
                          <TaskRow key={task.id} task={task} onToggle={handleToggleTask} onUpdateText={handleUpdateText} />
                        ))}
                      </div>
                    )}
                  </div>
                )}
                </div>
              </div>
            ))}
          </>
        ) : null}
      </PullToRefresh>

      {project && <TaskAddBar onSubmit={handleAddTask} position="bottom" />}

      {moveSheet && (
        <BucketMoveSheet
          currentBucket={moveSheet.currentBucket}
          onSelect={(bucket) => handleMoveTask(moveSheet.taskId, bucket)}
          onClose={() => setMoveSheet(null)}
        />
      )}

      {selectedTask && (
        <TaskDetail
          task={selectedTask as unknown as DetailTask}
          subtasks={(selectedTask.sub_tasks || []).map((st) => ({
            id: st.id,
            text: st.text,
            description: st.description || null,
            project_key: st.project_key,
            bucket: st.bucket,
            priority: st.priority,
            surface: st.surface,
            is_owner_action: st.is_owner_action,
            mission: st.mission,
            version: st.version,
            task_code: st.task_code,
            progress: st.progress,
            log: st.log as DetailTask["log"],
            updated_at: st.updated_at,
            completed: st.completed,
          } as DetailTask))}
          onClose={() => { setSelectedTask(null); fetchProject(); }}
          onUpdate={handleModalUpdate}
          onDelete={handleModalDelete}
          onAddSubtask={async (parentId, text) => {
            const res = await fetch(`/api/projects/${childKey}/tasks`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ text, bucket: selectedTask.bucket || "THIS_WEEK", parent_task_id: parentId }),
            });
            if (!res.ok) { showToast("Failed to add subtask", "error"); return; }
            showToast("Subtask added");
            // Refresh project data and update selectedTask with new subtasks
            const projRes = await fetch(`/api/projects/${childKey}`);
            if (projRes.ok) {
              const freshProject = await projRes.json();
              setProject(freshProject);
              // Find updated task with its subtasks
              const allBuckets = [...freshProject.tasks.this_week, ...freshProject.tasks.this_month, ...freshProject.tasks.parked, ...freshProject.tasks.completed];
              const updated = allBuckets.find((t: NestedTask) => t.id === parentId);
              if (updated) setSelectedTask(updated);
            }
          }}
        />
      )}

      {isDesktop && <Fab onPress={() => setCaptureOpen(true)} />}
      <QuickCaptureSheet
        open={captureOpen}
        onClose={() => setCaptureOpen(false)}
        projects={project ? [{ child_key: project.child_key, display_name: project.display_name }] : []}
        onSubmitted={() => { fetchProject(); showToast("Task added"); }}
      />

      <ToastContainer />
    </div>
  );
}

/* ── Bucket Section ── */

const BUCKET_PAGE_SIZE = 30;

function BucketSection({
  title,
  tasks,
  totalInBucket,
  colorVar,
  onToggle,
  onLongPress,
  onUpdateText,
  onOpen,
}: {
  title: string;
  tasks: NestedTask[];
  totalInBucket: number;
  colorVar: string;
  onToggle: (id: string, completed: boolean) => void;
  onLongPress: (id: string) => void;
  onUpdateText: (id: string, text: string) => void;
  onOpen: (task: NestedTask) => void;
}) {
  const [visibleCount, setVisibleCount] = useState(BUCKET_PAGE_SIZE);

  if (tasks.length === 0) return null;

  // Count done sub-tasks recursively
  function countDone(taskList: NestedTask[]): number {
    let count = 0;
    for (const t of taskList) {
      if (t.completed) count++;
      count += countDone(t.sub_tasks);
    }
    return count;
  }
  const doneCount = countDone(tasks);
  const visibleTasks = tasks.slice(0, visibleCount);
  const hasMore = tasks.length > visibleCount;

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.07em]" style={{ color: colorVar }}>
          {title}
        </span>
        <span className="text-[11px] text-[var(--text3)]">
          {doneCount}/{totalInBucket} done
        </span>
      </div>
      <div className="space-y-0.5">
        {visibleTasks.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            onToggle={onToggle}
            onLongPress={() => onLongPress(task.id)}
            onUpdateText={onUpdateText}
            onOpen={() => onOpen(task)}
          />
        ))}
      </div>
      {hasMore && (
        <button
          onClick={() => setVisibleCount((c) => c + BUCKET_PAGE_SIZE)}
          className="w-full mt-2 py-2 text-[13px] font-medium text-[var(--accent)] hover:bg-[var(--card)] rounded-[var(--r-sm)] transition-colors min-h-[44px]"
        >
          Show More ({tasks.length - visibleCount} remaining)
        </button>
      )}
    </div>
  );
}

/* ── Priority indicator ── */

const PRIORITY_COLORS: Record<string, string> = {
  P0: 'var(--red)',
  P1: 'var(--orange)',
  P2: 'var(--yellow)',
};

/* ── Tree helpers ── */

function countSubtree(subs: NestedTask[]): number {
  let n = 0;
  for (const s of subs) { n += 1 + countSubtree(s.sub_tasks); }
  return n;
}

function MissionTaskRow({ task, depth, onOpen, onToggle }: {
  task: NestedTask;
  depth: number;
  onOpen: () => void;
  onToggle: (id: string, currentCompleted: boolean) => void;
}) {
  const [expanded, setExpanded] = useState(depth < 1);
  const hasSubs = task.sub_tasks.length > 0;
  return (
    <>
      <div
        className="flex items-center gap-2 py-1.5 px-2 rounded-[6px] hover:bg-[var(--card)] transition-colors group"
        style={{ paddingLeft: `${8 + depth * 18}px` }}
      >
        {hasSubs ? (
          <button onClick={() => setExpanded(!expanded)} className="w-4 h-4 flex items-center justify-center text-[var(--text3)] shrink-0">
            <svg width="8" height="8" viewBox="0 0 10 10" fill="none" className={`transition-transform ${expanded ? 'rotate-90' : ''}`}>
              <path d="M3 1L7 5L3 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        ) : (
          <span className="w-4 shrink-0" />
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onToggle(task.id, task.completed); }}
          className={`w-[14px] h-[14px] rounded border flex items-center justify-center shrink-0 ${
            task.completed ? 'border-[var(--green)] bg-[var(--green)]' : 'border-[var(--border2)]'
          }`}
        >
          {task.completed && (
            <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
              <path d="M2 5L4 7L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>
        {task.priority && (
          <span className="w-[6px] h-[6px] rounded-full shrink-0" style={{ backgroundColor: PRIORITY_COLORS[task.priority] || 'var(--text3)' }} />
        )}
        {task.task_code && <IdBadge value={task.task_code} label="task_code" kind="code" size="xs" />}
        <button onClick={onOpen}
          className={`text-[12px] text-left flex-1 min-w-0 truncate ${task.completed ? 'text-[var(--text3)] line-through' : 'text-[var(--text2)] hover:text-[var(--text)]'}`}>
          {task.text}
        </button>
        <span className="text-[9px] text-[var(--text3)] px-1.5 py-[1px] rounded bg-[var(--bg)] shrink-0">
          {task.bucket === 'THIS_WEEK' ? 'W' : task.bucket === 'THIS_MONTH' ? 'M' : 'P'}
        </span>
      </div>
      {expanded && hasSubs && task.sub_tasks.map((sub) => (
        <MissionTaskRow key={sub.id} task={sub} depth={depth + 1} onOpen={onOpen} onToggle={onToggle} />
      ))}
    </>
  );
}

/* ── Task Row ── */

function TaskRow({
  task,
  onToggle,
  onLongPress,
  onUpdateText,
  onOpen,
  depth = 0,
}: {
  task: NestedTask;
  onToggle: (id: string, completed: boolean) => void;
  onLongPress?: () => void;
  onUpdateText: (id: string, text: string) => void;
  onOpen?: () => void;
  depth?: number;
}) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(task.text);
  const [expanded, setExpanded] = useState(true);
  let longPressTimer: ReturnType<typeof setTimeout> | null = null;

  function handleSave() {
    if (editText.trim() && editText.trim() !== task.text) {
      onUpdateText(task.id, editText.trim());
    }
    setEditing(false);
  }

  return (
    <>
      <div
        className="flex items-start gap-3 px-3 py-[10px] rounded-[var(--r-sm)] hover:bg-[var(--card)]/50 transition-colors min-h-[44px]"
        style={{ paddingLeft: `${12 + depth * 20}px` }}
        onTouchStart={() => { if (onLongPress) longPressTimer = setTimeout(onLongPress, 500); }}
        onTouchEnd={() => { if (longPressTimer) clearTimeout(longPressTimer); }}
        onTouchCancel={() => { if (longPressTimer) clearTimeout(longPressTimer); }}
        onContextMenu={(e) => { e.preventDefault(); onLongPress?.(); }}
      >
        {/* Sub-task expand toggle (or spacer for alignment) */}
        {task.sub_tasks.length > 0 ? (
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-1 text-[var(--text3)] shrink-0 w-[18px] h-[18px] flex items-center justify-center"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className={`transition-transform ${expanded ? 'rotate-90' : ''}`}>
              <path d="M3 1L7 5L3 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        ) : depth > 0 ? (
          <span className="shrink-0 w-[18px]" />
        ) : null}

        {/* Checkbox */}
        <button
          onClick={() => onToggle(task.id, task.completed)}
          className={`mt-0.5 w-[18px] h-[18px] rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
            task.completed
              ? "border-[var(--green)] bg-[var(--green)]"
              : "border-[var(--border2)] hover:border-[var(--accent)]"
          }`}
        >
          {task.completed && (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M2 5L4 7L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>

        {/* Priority dot */}
        {task.priority && (
          <span
            className="w-[7px] h-[7px] rounded-full shrink-0 mt-1.5"
            style={{ backgroundColor: PRIORITY_COLORS[task.priority] || 'var(--text3)' }}
            title={task.priority}
          />
        )}

        {/* Owner action badge */}
        {task.is_owner_action && (
          <span className="text-[11px] shrink-0 mt-0.5" title="Owner action">&#9889;</span>
        )}

        {/* Task text / inline edit */}
        {editing ? (
          <input
            type="text"
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onBlur={handleSave}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave();
              if (e.key === 'Escape') { setEditText(task.text); setEditing(false); }
            }}
            autoFocus
            className="flex-1 text-[14px] leading-snug text-[var(--text)] bg-[var(--card)] border border-[var(--border2)] rounded px-2 py-0.5 focus:outline-none focus:border-[var(--accent)]"
          />
        ) : (
          <span
            className={`flex-1 text-[14px] leading-snug cursor-pointer ${
              task.completed ? "text-[var(--text3)] line-through" : "text-[var(--text)]"
            }`}
            onClick={() => onOpen?.()}
            onDoubleClick={(e) => { e.stopPropagation(); if (!task.completed) { setEditText(task.text); setEditing(true); } }}
          >
            {task.text}
          </span>
        )}
      </div>

      {/* Sub-tasks */}
      {expanded && task.sub_tasks.length > 0 && (
        <div className="space-y-0.5">
          {task.sub_tasks.map((sub) => (
            <TaskRow
              key={sub.id}
              task={sub}
              onToggle={onToggle}
              onUpdateText={onUpdateText}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </>
  );
}

/* ── Bucket Move Sheet ── */

function BucketMoveSheet({
  currentBucket,
  onSelect,
  onClose,
}: {
  currentBucket: string;
  onSelect: (bucket: string) => void;
  onClose: () => void;
}) {
  const buckets = [
    { value: "THIS_WEEK", label: "This Week", color: "var(--accent)" },
    { value: "THIS_MONTH", label: "This Month", color: "var(--purple)" },
    { value: "PARKED", label: "Parked", color: "var(--text3)" },
  ];
  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-[var(--surface)] border-t border-[var(--border)] rounded-t-xl p-4 pb-8">
        <div className="w-10 h-1 rounded-full bg-[var(--border2)] mx-auto mb-4" />
        <p className="text-[13px] text-[var(--text3)] mb-3 text-center">Move to</p>
        <div className="space-y-1">
          {buckets.map((b) => {
            const disabled = b.value === currentBucket;
            return (
              <button
                key={b.value}
                onClick={() => !disabled && onSelect(b.value)}
                disabled={disabled}
                className={`w-full text-left px-4 py-3 rounded-[var(--r-sm)] text-[14px] font-medium transition-colors min-h-[44px] ${
                  disabled ? "text-[var(--text3)] opacity-40 cursor-not-allowed" : "hover:bg-[var(--card)]"
                }`}
                style={disabled ? undefined : { color: b.color }}
              >
                {b.label}
                {disabled && " (current)"}
              </button>
            );
          })}
        </div>
        <button
          onClick={onClose}
          className="w-full mt-3 px-4 py-3 rounded-[var(--r-sm)] text-[14px] text-[var(--text3)] hover:bg-[var(--card)] transition-colors text-center min-h-[44px]"
        >
          Cancel
        </button>
      </div>
    </>
  );
}

