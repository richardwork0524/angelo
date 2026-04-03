"use client";

import { useState, useRef, useEffect } from "react";

/* ── Types ── */

interface LogEntry {
  timestamp: string;
  type: string;
  message: string;
  section?: number;
}

export interface DashboardTask {
  id: string;
  text: string;
  project_key: string;
  bucket: string;
  priority: string | null;
  surface: string | null;
  is_owner_action: boolean;
  mission: string | null;
  version: string | null;
  progress: string | null;
  log: LogEntry[] | null;
  parent_task_id: string | null;
  completed: boolean;
  updated_at: string;
  task_code: string | null;
}

interface Props {
  task: DashboardTask;
  subtasks: DashboardTask[];
  expanded: boolean;
  onToggleExpand: () => void;
  onUpdate: (taskId: string, fields: Record<string, unknown>) => Promise<void>;
  onComplete: (taskId: string, logMessage: string) => Promise<void>;
  onSectionComplete: (taskId: string, currentProgress: string) => Promise<void>;
  onAddSubtask: (parentId: string, text: string) => Promise<void>;
}

/* ── Constants ── */

const PRIORITY_DOT: Record<string, string> = { P0: "#ff453a", P1: "#ff9f0a", P2: "#ffd60a" };
const SURFACE_DOT: Record<string, string> = { CODE: "#0a84ff", CHAT: "#30d158", COWORK: "#bf5af2" };
const SURFACE_LABEL: Record<string, string> = { CODE: "Claude Code", CHAT: "Claude Chat", COWORK: "Claude Cowork" };
const PRIORITIES = ["P0", "P1", "P2"];
const BUCKETS = [
  { key: "THIS_WEEK", label: "Week" },
  { key: "THIS_MONTH", label: "Month" },
  { key: "PARKED", label: "Parked" },
];

/* ── Helpers ── */

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

/* ── Mission Field (editable if blank) ── */

function MissionField({ mission, version, taskCode, locked, onSave }: {
  mission: string | null;
  version: string | null;
  taskCode: string | null;
  locked: boolean;
  onSave: (mission: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(mission || "");

  async function handleSave() {
    if (value.trim() && value.trim() !== mission) {
      await onSave(value.trim());
    }
    setEditing(false);
  }

  return (
    <div className="flex items-center gap-3 flex-wrap text-[11px]">
      {taskCode && (
        <span className="font-mono text-[var(--accent)] bg-[var(--accent-dim)] px-1.5 py-[1px] rounded">{taskCode}</span>
      )}
      {version && <span className="text-[var(--text3)]">{version}</span>}
      {mission ? (
        <span className="text-[var(--purple)]">Mission: {mission}</span>
      ) : !locked ? (
        editing ? (
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={handleSave}
            onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") setEditing(false); }}
            placeholder="e.g. reducing token consumption"
            autoFocus
            className="text-[11px] text-[var(--text)] bg-[var(--bg)] border border-[var(--purple)] rounded px-2 py-0.5 w-[200px] focus:outline-none"
          />
        ) : (
          <button onClick={() => setEditing(true)} className="text-[var(--text3)] hover:text-[var(--purple)]">
            + Set mission
          </button>
        )
      ) : null}
    </div>
  );
}

/* ── Component ── */

export function ExpandableTaskRow({ task, subtasks, expanded, onToggleExpand, onUpdate, onComplete, onSectionComplete, onAddSubtask }: Props) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(task.text);
  const [completing, setCompleting] = useState(false);
  const [logMsg, setLogMsg] = useState("");
  const [addingSubtask, setAddingSubtask] = useState(false);
  const [subtaskText, setSubtaskText] = useState("");
  const [saving, setSaving] = useState(false);
  const [showSplit, setShowSplit] = useState(false);
  const [splitCount, setSplitCount] = useState("3");
  const rowRef = useRef<HTMLDivElement>(null);

  const isLocked = !!task.surface;
  const progress = task.progress?.match(/^(\d+)\/(\d+)$/);
  const progressDone = progress ? parseInt(progress[1]) : 0;
  const progressTotal = progress ? parseInt(progress[2]) : 0;

  useEffect(() => {
    if (expanded && rowRef.current) {
      setTimeout(() => rowRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 100);
    }
  }, [expanded]);

  async function handleSaveText() {
    if (editText.trim() && editText.trim() !== task.text) {
      setSaving(true);
      await onUpdate(task.id, { text: editText.trim() });
      setSaving(false);
    }
    setEditing(false);
  }

  async function handlePriorityChange(p: string | null) {
    if (isLocked) return;
    await onUpdate(task.id, { priority: p === task.priority ? null : p });
  }

  async function handleBucketChange(b: string) {
    if (isLocked || b === task.bucket) return;
    await onUpdate(task.id, { bucket: b });
  }

  async function handleComplete() {
    if (!logMsg.trim()) return;
    setSaving(true);
    await onComplete(task.id, logMsg.trim());
    setSaving(false);
    setCompleting(false);
    setLogMsg("");
  }

  async function handleSectionComplete() {
    if (!task.progress) return;
    setSaving(true);
    await onSectionComplete(task.id, task.progress);
    setSaving(false);
  }

  async function handleAddSubtask() {
    if (!subtaskText.trim()) return;
    setSaving(true);
    await onAddSubtask(task.id, subtaskText.trim());
    setSaving(false);
    setSubtaskText("");
    setAddingSubtask(false);
  }

  async function handleSplit() {
    const n = parseInt(splitCount);
    if (isNaN(n) || n < 2 || n > 20) return;
    setSaving(true);
    await onUpdate(task.id, { progress: `0/${n}` });
    setSaving(false);
    setShowSplit(false);
  }

  return (
    <div ref={rowRef} className="rounded-[8px] bg-[var(--card)] border border-[var(--border)] hover:border-[var(--border2)] transition-all overflow-hidden">
      {/* ── Collapsed row ── */}
      <button
        onClick={onToggleExpand}
        className="w-full flex items-start gap-3 px-4 py-3 text-left"
      >
        {/* Chevron */}
        <svg
          width="12" height="12" viewBox="0 0 12 12" fill="none"
          className={`shrink-0 mt-[4px] text-[var(--text3)] transition-transform ${expanded ? "rotate-90" : ""}`}
        >
          <path d="M4 2L8 6L4 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>

        {/* Priority dot */}
        <span
          className="w-[8px] h-[8px] rounded-full shrink-0 mt-[5px]"
          style={{ backgroundColor: PRIORITY_DOT[task.priority || ""] || "var(--border2)" }}
        />

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className={`text-[13px] leading-[1.4] ${task.completed ? "text-[var(--text3)] line-through" : "text-[var(--text)]"}`}>
            {task.task_code && <span className="text-[var(--accent)] font-mono text-[11px] mr-1.5">{task.task_code}</span>}
            {task.text}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[11px] text-[var(--text3)]">{task.project_key}</span>
            {task.mission && <span className="text-[11px] text-[var(--purple)] truncate max-w-[140px]">{task.mission}</span>}
            {task.surface && (
              <span className="inline-flex items-center gap-1">
                <span className="w-[5px] h-[5px] rounded-full" style={{ backgroundColor: SURFACE_DOT[task.surface] }} />
                <span className="text-[11px] text-[var(--text3)] uppercase">{task.surface}</span>
              </span>
            )}
            {task.bucket !== "THIS_WEEK" && (
              <span className="text-[11px] text-[var(--text3)] px-1.5 py-[1px] rounded bg-[var(--card2)]">
                {task.bucket === "THIS_MONTH" ? "Month" : task.bucket === "PARKED" ? "Parked" : task.bucket}
              </span>
            )}
          </div>
        </div>

        {/* Right badges */}
        <div className="flex items-center gap-2 shrink-0">
          {task.progress && (
            <span className="text-[11px] font-bold text-[var(--accent)] bg-[var(--accent-dim)] px-2 py-[2px] rounded-full tabular-nums">
              {task.progress}
            </span>
          )}
          {task.is_owner_action && (
            <span className="text-[11px] font-bold text-[var(--cyan)] bg-[var(--cyan-dim)] px-1.5 py-[2px] rounded">YOU</span>
          )}
          {subtasks.length > 0 && (
            <span className="text-[11px] text-[var(--text3)] tabular-nums">{subtasks.filter((s) => s.completed).length}/{subtasks.length}</span>
          )}
        </div>
      </button>

      {/* ── Expanded panel ── */}
      {expanded && (
        <div className="border-t border-[var(--border)] px-4 py-3 space-y-3">
          {/* Claude lock banner */}
          {isLocked && (
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-[8px] text-[12px] font-semibold"
              style={{ backgroundColor: `${SURFACE_DOT[task.surface!]}15`, color: SURFACE_DOT[task.surface!] }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0110 0v4" />
              </svg>
              This task must be completed from {SURFACE_LABEL[task.surface!] || task.surface}
            </div>
          )}

          {/* Text edit */}
          <div className={isLocked ? "opacity-40 pointer-events-none" : ""}>
            {editing ? (
              <input
                type="text"
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                onBlur={handleSaveText}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveText();
                  if (e.key === "Escape") { setEditText(task.text); setEditing(false); }
                }}
                autoFocus
                disabled={saving}
                className="w-full text-[13px] text-[var(--text)] bg-[var(--bg)] border border-[var(--accent)] rounded-[6px] px-3 py-2 focus:outline-none"
              />
            ) : (
              <p
                className="text-[13px] text-[var(--text)] cursor-text hover:bg-[var(--card2)] rounded px-1 py-0.5 -mx-1 transition-colors"
                onDoubleClick={() => { setEditText(task.text); setEditing(true); }}
              >
                {task.text}
              </p>
            )}
          </div>

          {/* Priority + Bucket controls */}
          <div className={`flex items-center gap-4 ${isLocked ? "opacity-40 pointer-events-none" : ""}`}>
            <div className="flex items-center gap-1">
              <span className="text-[11px] text-[var(--text3)] mr-1">Priority</span>
              {PRIORITIES.map((p) => (
                <button
                  key={p}
                  onClick={() => handlePriorityChange(p)}
                  className={`px-2 py-1 rounded-[6px] text-[11px] font-semibold transition-colors ${
                    task.priority === p ? "text-white" : "text-[var(--text3)] hover:text-[var(--text2)]"
                  }`}
                  style={task.priority === p ? { backgroundColor: PRIORITY_DOT[p] } : { backgroundColor: "var(--card2)" }}
                >
                  {p}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[11px] text-[var(--text3)] mr-1">Bucket</span>
              {BUCKETS.map((b) => (
                <button
                  key={b.key}
                  onClick={() => handleBucketChange(b.key)}
                  className={`px-2 py-1 rounded-[6px] text-[11px] font-semibold transition-colors ${
                    task.bucket === b.key
                      ? "bg-[var(--accent)] text-white"
                      : "bg-[var(--card2)] text-[var(--text3)] hover:text-[var(--text2)]"
                  }`}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>

          {/* Task code + Mission / Meta */}
          <MissionField
            mission={task.mission}
            version={task.version}
            taskCode={task.task_code}
            locked={isLocked}
            onSave={async (m) => { await onUpdate(task.id, { mission: m }); }}
          />

          {/* Progress sections */}
          {task.progress && progress ? (
            <div className={isLocked ? "opacity-40 pointer-events-none" : ""}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[11px] text-[var(--text3)]">Progress</span>
                <span className="text-[12px] font-bold text-[var(--accent)] tabular-nums">{task.progress}</span>
              </div>
              <div className="flex gap-1">
                {Array.from({ length: progressTotal }, (_, i) => (
                  <button
                    key={i}
                    onClick={() => i === progressDone ? handleSectionComplete() : undefined}
                    disabled={i !== progressDone || saving}
                    className={`flex-1 h-[8px] rounded-full transition-colors ${
                      i < progressDone
                        ? "bg-[var(--green)]"
                        : i === progressDone
                        ? "bg-[var(--accent)] animate-pulse cursor-pointer"
                        : "bg-[var(--border)]"
                    }`}
                    title={i === progressDone ? "Click to complete this section" : i < progressDone ? "Completed" : "Pending"}
                  />
                ))}
              </div>
            </div>
          ) : !task.progress && !isLocked ? (
            <div>
              {showSplit ? (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-[var(--text3)]">Split into</span>
                  <input
                    type="number"
                    min="2"
                    max="20"
                    value={splitCount}
                    onChange={(e) => setSplitCount(e.target.value)}
                    className="w-[48px] text-[12px] text-[var(--text)] bg-[var(--bg)] border border-[var(--border)] rounded px-2 py-1 text-center"
                  />
                  <span className="text-[11px] text-[var(--text3)]">sections</span>
                  <button onClick={handleSplit} disabled={saving} className="text-[11px] text-[var(--accent)] font-semibold">Save</button>
                  <button onClick={() => setShowSplit(false)} className="text-[11px] text-[var(--text3)]">Cancel</button>
                </div>
              ) : (
                <button onClick={() => setShowSplit(true)} className="text-[11px] text-[var(--text3)] hover:text-[var(--accent)]">
                  + Split into sections
                </button>
              )}
            </div>
          ) : null}

          {/* Subtasks */}
          {(subtasks.length > 0 || !isLocked) && (
            <div>
              <span className="text-[11px] text-[var(--text3)] mb-1.5 block">
                Subtasks {subtasks.length > 0 && `(${subtasks.filter((s) => s.completed).length}/${subtasks.length})`}
              </span>
              {subtasks.map((st) => (
                <div key={st.id} className="flex items-center gap-2 py-1 pl-2">
                  <span className={`w-[6px] h-[6px] rounded-full ${st.completed ? "bg-[var(--green)]" : "bg-[var(--border)]"}`} />
                  <span className={`text-[12px] ${st.completed ? "text-[var(--text3)] line-through" : "text-[var(--text2)]"}`}>
                    {st.text}
                  </span>
                </div>
              ))}
              {!isLocked && (
                addingSubtask ? (
                  <div className="flex items-center gap-2 mt-1 pl-2">
                    <input
                      type="text"
                      value={subtaskText}
                      onChange={(e) => setSubtaskText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleAddSubtask();
                        if (e.key === "Escape") { setSubtaskText(""); setAddingSubtask(false); }
                      }}
                      placeholder="Subtask text..."
                      autoFocus
                      className="flex-1 text-[12px] text-[var(--text)] bg-[var(--bg)] border border-[var(--border)] rounded px-2 py-1 focus:outline-none focus:border-[var(--accent)]"
                    />
                    <button onClick={handleAddSubtask} disabled={saving} className="text-[11px] text-[var(--accent)] font-semibold">Add</button>
                  </div>
                ) : (
                  <button onClick={() => setAddingSubtask(true)} className="text-[11px] text-[var(--text3)] hover:text-[var(--accent)] mt-1 pl-2">
                    + Add subtask
                  </button>
                )
              )}
            </div>
          )}

          {/* Log timeline */}
          {task.log && task.log.length > 0 && (
            <div>
              <span className="text-[11px] text-[var(--text3)] mb-1.5 block">Log</span>
              <div className="space-y-1 max-h-[100px] overflow-y-auto">
                {[...task.log].reverse().slice(0, 5).map((entry, i) => (
                  <div key={i} className="flex items-start gap-2 text-[11px]">
                    <span className="text-[var(--text3)] shrink-0 tabular-nums">{timeAgo(entry.timestamp)}</span>
                    <span className="text-[var(--text2)]">{entry.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Complete action */}
          {!task.completed && !isLocked && (
            <div className="pt-1">
              {completing ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={logMsg}
                    onChange={(e) => setLogMsg(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleComplete(); if (e.key === "Escape") setCompleting(false); }}
                    placeholder="Log what was done..."
                    autoFocus
                    className="flex-1 text-[12px] text-[var(--text)] bg-[var(--bg)] border border-[var(--border)] rounded-[6px] px-3 py-2 focus:outline-none focus:border-[var(--green)]"
                  />
                  <button
                    onClick={handleComplete}
                    disabled={!logMsg.trim() || saving}
                    className="px-3 py-2 rounded-[6px] bg-[var(--green)] text-white text-[12px] font-semibold disabled:opacity-40"
                  >
                    Done
                  </button>
                  <button onClick={() => setCompleting(false)} className="text-[11px] text-[var(--text3)]">Cancel</button>
                </div>
              ) : (
                <button
                  onClick={() => setCompleting(true)}
                  className="flex items-center gap-1.5 text-[12px] text-[var(--green)] font-semibold hover:underline"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                  Mark Complete
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
