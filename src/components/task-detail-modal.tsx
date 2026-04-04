"use client";

import { useState } from "react";

/* ── Types ── */

export interface ModalTask {
  id: string;
  text: string;
  description: string | null;
  project_key: string;
  bucket: string;
  priority: string | null;
  surface: string | null;
  is_owner_action: boolean;
  mission: string | null;
  version: string | null;
  task_code: string | null;
  progress: string | null;
  log: { timestamp: string; type: string; message: string }[] | null;
  updated_at: string;
  completed: boolean;
}

interface Props {
  task: ModalTask;
  subtasks?: ModalTask[];
  onClose: () => void;
  onUpdate: (taskId: string, fields: Record<string, unknown>) => void | Promise<void>;
  onDelete?: (taskId: string) => void | Promise<void>;
  onAddSubtask?: (parentId: string, text: string) => void | Promise<void>;
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

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

/* ── Component ── */

export function TaskDetailModal({ task, subtasks = [], onClose, onUpdate, onDelete, onAddSubtask }: Props) {
  const [editingText, setEditingText] = useState(false);
  const [editText, setEditText] = useState(task.text);
  const [editingDesc, setEditingDesc] = useState(false);
  const [editDesc, setEditDesc] = useState(task.description || "");
  const [editingMission, setEditingMission] = useState(false);
  const [editMission, setEditMission] = useState(task.mission || "");
  const [showSplit, setShowSplit] = useState(false);
  const [splitCount, setSplitCount] = useState("3");
  const [addingSubtask, setAddingSubtask] = useState(false);
  const [subtaskText, setSubtaskText] = useState("");
  const [saving, setSaving] = useState(false);
  const [localTask, setLocalTask] = useState(task);

  const isLocked = !!localTask.surface;
  const progress = localTask.progress?.match(/^(\d+)\/(\d+)$/);
  const progressDone = progress ? parseInt(progress[1]) : 0;
  const progressTotal = progress ? parseInt(progress[2]) : 0;

  async function handleUpdate(fields: Record<string, unknown>) {
    setSaving(true);
    await onUpdate(localTask.id, fields);
    setLocalTask((prev) => ({ ...prev, ...fields } as ModalTask));
    setSaving(false);
  }

  async function handleSaveText() {
    if (editText.trim() && editText.trim() !== localTask.text) {
      await handleUpdate({ text: editText.trim() });
    }
    setEditingText(false);
  }

  async function handleSaveMission() {
    const val = editMission.trim() || null;
    if (val !== localTask.mission) {
      await handleUpdate({ mission: val });
    }
    setEditingMission(false);
  }

  async function handleSplit() {
    const n = parseInt(splitCount);
    if (isNaN(n) || n < 2 || n > 20) return;
    await handleUpdate({ progress: `0/${n}` });
    setShowSplit(false);
  }

  async function handleSectionComplete() {
    if (!localTask.progress) return;
    const next = `${progressDone + 1}/${progressTotal}`;
    await handleUpdate({ progress: next });
  }

  async function handleAddSubtask() {
    if (!subtaskText.trim() || !onAddSubtask) return;
    setSaving(true);
    await onAddSubtask(localTask.id, subtaskText.trim());
    setSaving(false);
    setSubtaskText("");
    setAddingSubtask(false);
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-40" onClick={onClose} />

      <div className="fixed inset-x-3 top-[8%] bottom-[8%] z-50 bg-[var(--surface)] border border-[var(--border)] rounded-[14px] flex flex-col overflow-hidden max-w-[520px] mx-auto shadow-2xl">
        {/* Header — compact */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--border)]">
          <div className="flex items-center gap-2">
            {localTask.priority && (
              <span className="w-[8px] h-[8px] rounded-full" style={{ backgroundColor: PRIORITY_DOT[localTask.priority] }} />
            )}
            {localTask.task_code && (
              <span className="text-[11px] font-mono text-[var(--accent)]">{localTask.task_code}</span>
            )}
            <span className="text-[11px] text-[var(--text3)]">{localTask.project_key}</span>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-full hover:bg-[var(--card)] flex items-center justify-center text-[var(--text3)]">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Body — compact spacing */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {/* Lock banner */}
          {isLocked && (
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-[6px] text-[11px] font-semibold"
              style={{ backgroundColor: `${SURFACE_DOT[localTask.surface!]}15`, color: SURFACE_DOT[localTask.surface!] }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0110 0v4" />
              </svg>
              {SURFACE_LABEL[localTask.surface!] || localTask.surface}
            </div>
          )}

          {/* Task text */}
          {editingText ? (
            <input
              type="text" value={editText} onChange={(e) => setEditText(e.target.value)}
              onBlur={handleSaveText}
              onKeyDown={(e) => { if (e.key === "Enter") handleSaveText(); if (e.key === "Escape") { setEditText(localTask.text); setEditingText(false); } }}
              autoFocus disabled={saving}
              className="w-full text-[14px] text-[var(--text)] bg-[var(--bg)] border border-[var(--accent)] rounded-[6px] px-3 py-1.5 focus:outline-none"
            />
          ) : (
            <p
              className={`text-[14px] leading-[1.4] ${localTask.completed ? "text-[var(--text3)] line-through" : "text-[var(--text)]"} ${!isLocked ? "cursor-text hover:bg-[var(--card)] rounded px-1 py-0.5 -mx-1" : ""}`}
              onDoubleClick={() => { if (!isLocked) { setEditText(localTask.text); setEditingText(true); } }}
            >
              {localTask.text}
            </p>
          )}

          {/* Description */}
          {editingDesc ? (
            <textarea
              value={editDesc} onChange={(e) => setEditDesc(e.target.value)}
              onBlur={async () => { if (editDesc.trim() !== (localTask.description || "")) { await handleUpdate({ description: editDesc.trim() || null }); } setEditingDesc(false); }}
              onKeyDown={(e) => { if (e.key === "Escape") { setEditDesc(localTask.description || ""); setEditingDesc(false); } }}
              autoFocus rows={2}
              className="w-full text-[12px] text-[var(--text)] bg-[var(--bg)] border border-[var(--accent)] rounded-[6px] px-3 py-1.5 focus:outline-none resize-none"
            />
          ) : (
            <p
              className="text-[12px] text-[var(--text2)] leading-[1.4] cursor-text hover:bg-[var(--card)] rounded px-1 py-0.5 -mx-1 min-h-[20px] whitespace-pre-wrap"
              onClick={() => { setEditDesc(localTask.description || ""); setEditingDesc(true); }}
            >
              {localTask.description || <span className="text-[var(--text3)] opacity-50 italic">Add description...</span>}
            </p>
          )}

          {/* Priority + Bucket — inline row */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-[var(--text3)] mr-0.5">Priority</span>
              {PRIORITIES.map((p) => (
                <button key={p} onClick={() => handleUpdate({ priority: p === localTask.priority ? null : p })} disabled={saving}
                  className={`px-2 py-1 rounded-[6px] text-[11px] font-semibold ${localTask.priority === p ? "text-white" : "text-[var(--text3)] hover:text-[var(--text2)]"}`}
                  style={localTask.priority === p ? { backgroundColor: PRIORITY_DOT[p] } : { backgroundColor: "var(--card)" }}
                >{p}</button>
              ))}
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-[var(--text3)] mr-0.5">Bucket</span>
              {BUCKETS.map((b) => (
                <button key={b.key} onClick={() => handleUpdate({ bucket: b.key })} disabled={saving || localTask.bucket === b.key}
                  className={`px-2 py-1 rounded-[6px] text-[11px] font-semibold ${localTask.bucket === b.key ? "bg-[var(--accent)] text-white" : "bg-[var(--card)] text-[var(--text3)] hover:text-[var(--text2)]"}`}
                >{b.label}</button>
              ))}
            </div>
          </div>

          {/* Mission — editable */}
          <div className="flex items-center gap-2 text-[11px]">
            <span className="text-[var(--text3)]">Mission:</span>
            {editingMission ? (
              <input
                type="text" value={editMission} onChange={(e) => setEditMission(e.target.value)}
                onBlur={handleSaveMission}
                onKeyDown={(e) => { if (e.key === "Enter") handleSaveMission(); if (e.key === "Escape") { setEditMission(localTask.mission || ""); setEditingMission(false); } }}
                autoFocus placeholder="e.g. reducing token consumption"
                className="flex-1 text-[11px] text-[var(--text)] bg-[var(--bg)] border border-[var(--purple)] rounded px-2 py-0.5 focus:outline-none"
              />
            ) : (
              <button onClick={() => { setEditMission(localTask.mission || ""); setEditingMission(true); }}
                className={localTask.mission ? "text-[var(--purple)]" : "text-[var(--text3)] opacity-50 hover:text-[var(--purple)]"}
              >
                {localTask.mission || "+ Set mission"}
              </button>
            )}
          </div>

          {/* Progress / Section Split */}
          {localTask.progress && progress ? (
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[10px] text-[var(--text3)]">Progress</span>
                <span className="text-[11px] font-bold text-[var(--accent)] tabular-nums">{localTask.progress}</span>
              </div>
              <div className="flex gap-1">
                {Array.from({ length: progressTotal }, (_, i) => (
                  <button
                    key={i}
                    onClick={() => i === progressDone && !isLocked ? handleSectionComplete() : undefined}
                    disabled={i !== progressDone || saving || isLocked}
                    className={`flex-1 h-[7px] rounded-full transition-colors ${
                      i < progressDone ? "bg-[var(--green)]" : i === progressDone ? "bg-[var(--accent)] animate-pulse cursor-pointer" : "bg-[var(--border)]"
                    }`}
                  />
                ))}
              </div>
            </div>
          ) : !localTask.progress && !isLocked ? (
            showSplit ? (
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-[var(--text3)]">Split into</span>
                <input type="number" min="2" max="20" value={splitCount} onChange={(e) => setSplitCount(e.target.value)}
                  className="w-[40px] text-[11px] text-[var(--text)] bg-[var(--bg)] border border-[var(--border)] rounded px-1.5 py-0.5 text-center"
                />
                <span className="text-[10px] text-[var(--text3)]">sections</span>
                <button onClick={handleSplit} disabled={saving} className="text-[10px] text-[var(--accent)] font-semibold">Save</button>
                <button onClick={() => setShowSplit(false)} className="text-[10px] text-[var(--text3)]">Cancel</button>
              </div>
            ) : (
              <button onClick={() => setShowSplit(true)} className="text-[10px] text-[var(--text3)] hover:text-[var(--accent)]">
                + Split into sections
              </button>
            )
          ) : null}

          {/* Subtasks */}
          {(subtasks.length > 0 || (!isLocked && onAddSubtask)) && (
            <div>
              <span className="text-[10px] text-[var(--text3)] mb-1 block">
                Subtasks {subtasks.length > 0 && `(${subtasks.filter((s) => s.completed).length}/${subtasks.length})`}
              </span>
              {subtasks.map((st) => (
                <div key={st.id} className="flex items-center gap-2 py-0.5 pl-1">
                  <span className={`w-[5px] h-[5px] rounded-full ${st.completed ? "bg-[var(--green)]" : "bg-[var(--border)]"}`} />
                  <span className={`text-[11px] ${st.completed ? "text-[var(--text3)] line-through" : "text-[var(--text2)]"}`}>{st.text}</span>
                </div>
              ))}
              {!isLocked && onAddSubtask && (
                addingSubtask ? (
                  <div className="flex items-center gap-2 mt-1 pl-1">
                    <input type="text" value={subtaskText} onChange={(e) => setSubtaskText(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleAddSubtask(); if (e.key === "Escape") { setSubtaskText(""); setAddingSubtask(false); } }}
                      placeholder="Subtask..." autoFocus
                      className="flex-1 text-[11px] text-[var(--text)] bg-[var(--bg)] border border-[var(--border)] rounded px-2 py-0.5 focus:outline-none focus:border-[var(--accent)]"
                    />
                    <button onClick={handleAddSubtask} disabled={saving} className="text-[10px] text-[var(--accent)] font-semibold">Add</button>
                  </div>
                ) : (
                  <button onClick={() => setAddingSubtask(true)} className="text-[10px] text-[var(--text3)] hover:text-[var(--accent)] mt-0.5 pl-1">+ Add subtask</button>
                )
              )}
            </div>
          )}

          {/* Log timeline */}
          {localTask.log && localTask.log.length > 0 && (
            <div>
              <span className="text-[10px] text-[var(--text3)] mb-1 block">Log</span>
              <div className="space-y-1 max-h-[100px] overflow-y-auto">
                {[...localTask.log].reverse().slice(0, 8).map((entry, i) => (
                  <div key={i} className="flex items-start gap-2 text-[10px]">
                    <span className="text-[var(--text3)] shrink-0 tabular-nums">{timeAgo(entry.timestamp)}</span>
                    <span className="text-[var(--text2)]">{entry.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Metadata row */}
          <div className="flex flex-wrap items-center gap-2 text-[10px] text-[var(--text3)] opacity-60">
            {localTask.surface && (
              <span className="inline-flex items-center gap-1">
                <span className="w-[4px] h-[4px] rounded-full" style={{ backgroundColor: SURFACE_DOT[localTask.surface] }} />
                <span className="uppercase">{localTask.surface}</span>
              </span>
            )}
            {localTask.version && <span>v{localTask.version}</span>}
            {localTask.is_owner_action && <span className="text-[var(--cyan)] font-semibold opacity-100">YOU</span>}
            <span>Updated {timeAgo(localTask.updated_at)}</span>
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 px-4 py-2 border-t border-[var(--border)] flex items-center justify-end">
          {onDelete && (
            <button
              onClick={async () => { if (confirm("Delete this task?")) { await onDelete(localTask.id); onClose(); } }}
              className="text-[10px] text-[#ff453a] hover:underline"
            >
              Delete task
            </button>
          )}
        </div>
      </div>
    </>
  );
}
