"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { StickyHeader } from "@/components/sticky-header";
import { PullToRefresh } from "@/components/pull-to-refresh";
import { ErrorBanner } from "@/components/error-banner";
import { EmptyState } from "@/components/empty-state";
import { Toast } from "@/components/toast";
import { TaskDetail, type DetailTask } from "@/components/task/task-detail";

interface MissionTask {
  id: string;
  text: string;
  description: string | null;
  project_key: string;
  bucket: string;
  priority: string | null;
  surface: string | null;
  is_owner_action: boolean;
  task_code: string | null;
  mission: string | null;
  version: string | null;
  updated_at: string;
  completed: boolean;
  progress: string | null;
  log: { timestamp: string; type: string; message: string }[] | null;
}

interface MissionDetail {
  mission: string;
  stats: { open: number; completed: number; p0: number; p1: number; p2: number };
  tasks: {
    this_week: MissionTask[];
    this_month: MissionTask[];
    parked: MissionTask[];
    completed: MissionTask[];
  };
}

const PRIORITY_COLORS: Record<string, string> = { P0: "var(--red)", P1: "var(--orange)", P2: "var(--yellow)" };

export default function MissionDetailPage() {
  const params = useParams();
  const missionName = decodeURIComponent(params.name as string);

  const [mission, setMission] = useState<MissionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [selectedTask, setSelectedTask] = useState<MissionTask | null>(null);

  const fetchMission = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch(`/api/missions/${encodeURIComponent(missionName)}`);
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setMission(data);
    } catch {
      setError("Failed to load mission.");
    } finally {
      setLoading(false);
    }
  }, [missionName]);

  useEffect(() => {
    fetchMission();
  }, [fetchMission]);

  async function handleTaskUpdate(taskId: string, fields: Record<string, unknown>) {
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      if (!res.ok) throw new Error("Failed");
      setToast("Updated");
      await fetchMission();
    } catch {
      setToast("Failed to update");
    }
  }

  async function handleTaskDelete(taskId: string) {
    try {
      const res = await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      setToast("Task deleted");
      setSelectedTask(null);
      await fetchMission();
    } catch {
      setToast("Failed to delete");
    }
  }

  return (
    <div className="flex flex-col h-full min-h-0 bg-[var(--bg)]">
      <StickyHeader title={missionName} showBack />

      {error && <ErrorBanner message={error} onRetry={fetchMission} />}

      <PullToRefresh onRefresh={fetchMission}>
        {loading ? (
          <div className="px-4 py-3 space-y-4 animate-pulse">
            <div className="rounded-[12px] bg-[var(--card)] p-4 space-y-3">
              <div className="h-5 w-40 bg-[var(--border)] rounded" />
              <div className="h-3 w-56 bg-[var(--border)] rounded" />
            </div>
            {[...Array(3)].map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="h-3 w-20 bg-[var(--border)] rounded" />
                {[...Array(2)].map((_, j) => (
                  <div key={j} className="h-10 bg-[var(--border)] rounded mx-2" />
                ))}
              </div>
            ))}
          </div>
        ) : !mission ? (
          <EmptyState message="Mission not found." />
        ) : (
          <>
            {/* Stats card */}
            <div className="px-4 pt-3">
              <div className="rounded-[12px] bg-[var(--card)] p-4">
                <div className="flex items-center gap-4 mb-2">
                  <span className="text-[24px] font-bold text-[var(--text)] tabular-nums">{mission.stats.open}</span>
                  <span className="text-[13px] text-[var(--text3)]">open tasks</span>
                </div>
                <div className="flex items-center gap-3">
                  {mission.stats.p0 > 0 && (
                    <div className="flex items-center gap-1.5">
                      <span className="w-[7px] h-[7px] rounded-full bg-[#ff453a]" />
                      <span className="text-[12px] text-[var(--text3)] tabular-nums">{mission.stats.p0} critical</span>
                    </div>
                  )}
                  {mission.stats.p1 > 0 && (
                    <div className="flex items-center gap-1.5">
                      <span className="w-[7px] h-[7px] rounded-full bg-[#ff9f0a]" />
                      <span className="text-[12px] text-[var(--text3)] tabular-nums">{mission.stats.p1} high</span>
                    </div>
                  )}
                  {mission.stats.p2 > 0 && (
                    <div className="flex items-center gap-1.5">
                      <span className="w-[7px] h-[7px] rounded-full bg-[#ffd60a]" />
                      <span className="text-[12px] text-[var(--text3)] tabular-nums">{mission.stats.p2} normal</span>
                    </div>
                  )}
                  {mission.stats.completed > 0 && (
                    <span className="text-[12px] text-[var(--text3)]">✓ {mission.stats.completed} done</span>
                  )}
                </div>
              </div>
            </div>

            {/* Task buckets */}
            {mission.stats.open === 0 && mission.stats.completed === 0 ? (
              <EmptyState message="No tasks in this mission yet." />
            ) : (
              <div className="px-4 py-3">
                <BucketSection title="THIS WEEK" tasks={mission.tasks.this_week} color="var(--accent)" onTaskClick={setSelectedTask} />
                <BucketSection title="THIS MONTH" tasks={mission.tasks.this_month} color="var(--purple)" onTaskClick={setSelectedTask} />
                <BucketSection title="PARKED" tasks={mission.tasks.parked} color="var(--text3)" onTaskClick={setSelectedTask} />

                {mission.tasks.completed.length > 0 && (
                  <div className="mt-4">
                    <button
                      onClick={() => setShowCompleted(!showCompleted)}
                      className="flex items-center gap-2 text-[12px] font-semibold text-[var(--text3)] uppercase tracking-[0.07em] mb-2 min-h-[44px]"
                    >
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className={`transition-transform ${showCompleted ? "rotate-90" : ""}`}>
                        <path d="M4 2L8 6L4 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                      <span style={{ color: "var(--green)" }}>✓</span>
                      Completed ({mission.tasks.completed.length})
                    </button>
                    {showCompleted && (
                      <div className="space-y-0.5">
                        {mission.tasks.completed.map((t) => (
                          <MissionTaskRow key={t.id} task={t} onClick={() => setSelectedTask(t)} />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </PullToRefresh>

      {/* Task detail modal */}
      {selectedTask && (
        <TaskDetail
          task={selectedTask as DetailTask}
          onClose={() => { setSelectedTask(null); fetchMission(); }}
          onUpdate={handleTaskUpdate}
          onDelete={handleTaskDelete}
        />
      )}

      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
    </div>
  );
}

/* ── Bucket Section ── */

function BucketSection({ title, tasks, color, onTaskClick }: { title: string; tasks: MissionTask[]; color: string; onTaskClick: (t: MissionTask) => void }) {
  if (tasks.length === 0) return null;
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.07em]" style={{ color }}>{title}</span>
        <span className="text-[11px] text-[var(--text3)]">{tasks.length}</span>
      </div>
      <div className="space-y-0.5">
        {tasks.map((t) => (
          <MissionTaskRow key={t.id} task={t} onClick={() => onTaskClick(t)} />
        ))}
      </div>
    </div>
  );
}

/* ── Task Row ── */

function MissionTaskRow({ task, onClick }: { task: MissionTask; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-start gap-2.5 px-3 py-[10px] rounded-[8px] hover:bg-[var(--card)] transition-colors min-h-[44px] text-left"
    >
      {task.priority && (
        <span
          className="w-[7px] h-[7px] rounded-full shrink-0 mt-1.5"
          style={{ backgroundColor: PRIORITY_COLORS[task.priority] || "var(--text3)" }}
        />
      )}
      {task.task_code && (
        <span className="text-[11px] font-mono text-[var(--accent)] shrink-0 mt-0.5">{task.task_code}</span>
      )}
      <span className={`flex-1 text-[14px] leading-snug ${task.completed ? "text-[var(--text3)] line-through" : "text-[var(--text)]"}`}>
        {task.text}
      </span>
      <div className="flex items-center gap-1.5 shrink-0">
        {task.is_owner_action && <span className="text-[11px]">⚡</span>}
        {task.surface && (
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-[var(--card)] text-[var(--text3)]">{task.surface}</span>
        )}
        <span className="text-[10px] text-[var(--text3)] opacity-60">{task.project_key}</span>
      </div>
    </button>
  );
}
