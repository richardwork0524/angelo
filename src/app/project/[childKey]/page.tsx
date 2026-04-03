"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { StickyHeader } from "@/components/sticky-header";
import { TaskAddBar } from "@/components/task-add-bar";
import { PullToRefresh } from "@/components/pull-to-refresh";
import { ErrorBanner } from "@/components/error-banner";
import { EmptyState } from "@/components/empty-state";
import { Toast } from "@/components/toast";
import { ProjectCard } from "@/components/project-card";
import { SessionLogList } from "@/components/session-log-list";

interface NestedTask {
  id: string;
  text: string;
  completed: boolean;
  bucket: string;
  priority: string | null;
  is_owner_action: boolean;
  parent_task_id: string | null;
  sub_tasks: NestedTask[];
}

interface SessionLog {
  id: string;
  session_date: string;
  title: string | null;
  surface: string | null;
  summary: string | null;
}

interface ProjectDetail {
  child_key: string;
  display_name: string;
  brief: string | null;
  status: string | null;
  build_phase: string | null;
  surface: string | null;
  last_session_date: string | null;
  next_action: string | null;
  tasks: {
    this_week: NestedTask[];
    this_month: NestedTask[];
    parked: NestedTask[];
    completed: NestedTask[];
  };
  session_logs: SessionLog[];
}

export default function ProjectDetailPage() {
  const params = useParams();
  const childKey = params.childKey as string;

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [moveSheet, setMoveSheet] = useState<{ taskId: string; currentBucket: string } | null>(null);

  const fetchProject = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch(`/api/projects/${childKey}`);
      if (res.status === 404) {
        setError("Project not found.");
        return;
      }
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setProject(data);
    } catch {
      setError("Failed to load tasks. Pull to retry.");
    } finally {
      setLoading(false);
    }
  }, [childKey]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  async function handleToggleTask(taskId: string, currentCompleted: boolean) {
    const newStatus = currentCompleted ? "open" : "completed";
    try {
      const res = await fetch(`/api/projects/${childKey}/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Failed");
      await fetchProject();
    } catch {
      setToast("Failed to update task. Try again.");
    }
  }

  async function handleUpdateText(taskId: string, text: string) {
    try {
      const res = await fetch(`/api/projects/${childKey}/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error("Failed");
      await fetchProject();
    } catch {
      setToast("Failed to update task. Try again.");
    }
  }

  async function handleMoveTask(taskId: string, targetBucket: string) {
    setMoveSheet(null);
    try {
      const res = await fetch(`/api/projects/${childKey}/tasks/${taskId}/move`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_bucket: targetBucket }),
      });
      if (!res.ok) throw new Error("Failed");
      await fetchProject();
    } catch {
      setToast("Failed to move task. Try again.");
    }
  }

  async function handleAddTask(text: string, bucket: string) {
    const res = await fetch(`/api/projects/${childKey}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, bucket }),
    });
    if (!res.ok) throw new Error("Failed");
    await fetchProject();
  }

  const totalOpen = project
    ? project.tasks.this_week.length + project.tasks.this_month.length + project.tasks.parked.length
    : 0;
  const totalDone = project ? project.tasks.completed.length : 0;
  const totalAll = totalOpen + totalDone;

  return (
    <div className="flex flex-col min-h-screen bg-[var(--bg)] pb-16">
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
            {/* Detailed project header card */}
            <div className="px-4 pt-3">
              <ProjectCard
                project={{
                  child_key: project.child_key,
                  display_name: project.display_name,
                  status: project.status || undefined,
                  build_phase: project.build_phase || undefined,
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

            {/* Session logs */}
            {project.session_logs && project.session_logs.length > 0 && (
              <div className="px-4 pt-3">
                <SessionLogList logs={project.session_logs} />
              </div>
            )}

            {/* Tasks section */}
            {totalAll === 0 ? (
              <EmptyState message="No tasks yet. Add your first task below." />
            ) : (
              <div className="px-4 py-3">
                <BucketSection
                  title="THIS WEEK"
                  tasks={project.tasks.this_week}
                  totalInBucket={project.tasks.this_week.length}
                  colorVar="var(--accent)"
                  onToggle={handleToggleTask}
                  onLongPress={(id) => setMoveSheet({ taskId: id, currentBucket: "THIS_WEEK" })}
                  onUpdateText={handleUpdateText}
                />
                <BucketSection
                  title="THIS MONTH"
                  tasks={project.tasks.this_month}
                  totalInBucket={project.tasks.this_month.length}
                  colorVar="var(--purple)"
                  onToggle={handleToggleTask}
                  onLongPress={(id) => setMoveSheet({ taskId: id, currentBucket: "THIS_MONTH" })}
                  onUpdateText={handleUpdateText}
                />
                <BucketSection
                  title="PARKED"
                  tasks={project.tasks.parked}
                  totalInBucket={project.tasks.parked.length}
                  colorVar="var(--text3)"
                  onToggle={handleToggleTask}
                  onLongPress={(id) => setMoveSheet({ taskId: id, currentBucket: "PARKED" })}
                  onUpdateText={handleUpdateText}
                />

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
            )}
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

      {toast && <Toast message={toast} onDismiss={() => setToast(null)} persistent />}
    </div>
  );
}

/* ── Bucket Section ── */

function BucketSection({
  title,
  tasks,
  totalInBucket,
  colorVar,
  onToggle,
  onLongPress,
  onUpdateText,
}: {
  title: string;
  tasks: NestedTask[];
  totalInBucket: number;
  colorVar: string;
  onToggle: (id: string, completed: boolean) => void;
  onLongPress: (id: string) => void;
  onUpdateText: (id: string, text: string) => void;
}) {
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
        {tasks.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            onToggle={onToggle}
            onLongPress={() => onLongPress(task.id)}
            onUpdateText={onUpdateText}
          />
        ))}
      </div>
    </div>
  );
}

/* ── Priority indicator ── */

const PRIORITY_COLORS: Record<string, string> = {
  P0: 'var(--red)',
  P1: 'var(--orange)',
  P2: 'var(--yellow)',
};

/* ── Task Row ── */

function TaskRow({
  task,
  onToggle,
  onLongPress,
  onUpdateText,
  depth = 0,
}: {
  task: NestedTask;
  onToggle: (id: string, completed: boolean) => void;
  onLongPress?: () => void;
  onUpdateText: (id: string, text: string) => void;
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
        {/* Sub-task expand toggle */}
        {task.sub_tasks.length > 0 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-1 text-[var(--text3)] shrink-0 w-[18px] h-[18px] flex items-center justify-center"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className={`transition-transform ${expanded ? 'rotate-90' : ''}`}>
              <path d="M3 1L7 5L3 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        )}

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
            className={`flex-1 text-[14px] leading-snug cursor-text ${
              task.completed ? "text-[var(--text3)] line-through" : "text-[var(--text)]"
            }`}
            onDoubleClick={() => { if (!task.completed) { setEditText(task.text); setEditing(true); } }}
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

