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
  onClose: () => void;
  onUpdate: (taskId: string, fields: Record<string, unknown>) => Promise<void>;
  onDelete?: (taskId: string) => Promise<void>;
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

export function TaskDetailModal({ task, onClose, onUpdate, onDelete }: Props) {
  const [editingText, setEditingText] = useState(false);
  const [editText, setEditText] = useState(task.text);
  const [editingDesc, setEditingDesc] = useState(false);
  const [editDesc, setEditDesc] = useState(task.description || "");
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

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 z-40" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-x-4 top-[10%] bottom-[10%] z-50 bg-[var(--surface)] border border-[var(--border)] rounded-[16px] flex flex-col overflow-hidden max-w-[560px] mx-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-2.5">
            {localTask.priority && (
              <span className="w-[10px] h-[10px] rounded-full" style={{ backgroundColor: PRIORITY_DOT[localTask.priority] }} />
            )}
            {localTask.task_code && (
              <span className="text-[12px] font-mono text-[var(--accent)]">{localTask.task_code}</span>
            )}
            <span className="text-[12px] text-[var(--text3)]">{localTask.project_key}</span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-[var(--card)] flex items-center justify-center text-[var(--text3)] transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Lock banner */}
          {isLocked && (
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-[8px] text-[12px] font-semibold"
              style={{ backgroundColor: `${SURFACE_DOT[localTask.surface!]}15`, color: SURFACE_DOT[localTask.surface!] }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0110 0v4" />
              </svg>
              Must be completed from {SURFACE_LABEL[localTask.surface!] || localTask.surface}
            </div>
          )}

          {/* Task text */}
          <div>
            {editingText ? (
              <input
                type="text"
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                onBlur={handleSaveText}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveText();
                  if (e.key === "Escape") { setEditText(localTask.text); setEditingText(false); }
                }}
                autoFocus
                disabled={saving}
                className="w-full text-[15px] text-[var(--text)] bg-[var(--bg)] border border-[var(--accent)] rounded-[8px] px-3 py-2 focus:outline-none"
              />
            ) : (
              <p
                className={`text-[15px] leading-[1.5] ${localTask.completed ? "text-[var(--text3)] line-through" : "text-[var(--text)]"} ${!isLocked ? "cursor-text hover:bg-[var(--card)] rounded px-1 py-0.5 -mx-1 transition-colors" : ""}`}
                onDoubleClick={() => { if (!isLocked) { setEditText(localTask.text); setEditingText(true); } }}
              >
                {localTask.text}
              </p>
            )}
            {!isLocked && !editingText && (
              <p className="text-[10px] text-[var(--text3)] opacity-50 mt-1">Double-click to edit</p>
            )}
          </div>

          {/* Description */}
          <div>
            <span className="text-[11px] text-[var(--text3)] mb-1.5 block">Description</span>
            {editingDesc ? (
              <textarea
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                onBlur={async () => {
                  if (editDesc.trim() !== (localTask.description || "")) {
                    await handleUpdate({ description: editDesc.trim() || null });
                  }
                  setEditingDesc(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Escape") { setEditDesc(localTask.description || ""); setEditingDesc(false); }
                }}
                autoFocus
                rows={3}
                className="w-full text-[13px] text-[var(--text)] bg-[var(--bg)] border border-[var(--accent)] rounded-[8px] px-3 py-2 focus:outline-none resize-none"
              />
            ) : (
              <p
                className="text-[13px] text-[var(--text2)] leading-[1.5] cursor-text hover:bg-[var(--card)] rounded px-1 py-0.5 -mx-1 transition-colors min-h-[24px] whitespace-pre-wrap"
                onClick={() => { setEditDesc(localTask.description || ""); setEditingDesc(true); }}
              >
                {localTask.description || <span className="text-[var(--text3)] opacity-50 italic">Add description...</span>}
              </p>
            )}
          </div>

          {/* Priority controls — ALWAYS editable */}
          <div>
            <span className="text-[11px] text-[var(--text3)] mb-1.5 block">Priority</span>
            <div className="flex items-center gap-1.5">
              {PRIORITIES.map((p) => (
                <button
                  key={p}
                  onClick={() => handleUpdate({ priority: p === localTask.priority ? null : p })}
                  disabled={saving}
                  className={`px-3 py-1.5 rounded-[8px] text-[12px] font-semibold transition-colors ${
                    localTask.priority === p ? "text-white" : "text-[var(--text3)] hover:text-[var(--text2)]"
                  }`}
                  style={localTask.priority === p ? { backgroundColor: PRIORITY_DOT[p] } : { backgroundColor: "var(--card)" }}
                >
                  {p}
                </button>
              ))}
              {localTask.priority && (
                <button
                  onClick={() => handleUpdate({ priority: null })}
                  disabled={saving}
                  className="text-[11px] text-[var(--text3)] hover:text-[var(--text2)] ml-1"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Bucket controls — ALWAYS editable */}
          <div>
            <span className="text-[11px] text-[var(--text3)] mb-1.5 block">Bucket</span>
            <div className="flex items-center gap-1.5">
              {BUCKETS.map((b) => (
                <button
                  key={b.key}
                  onClick={() => handleUpdate({ bucket: b.key })}
                  disabled={saving || localTask.bucket === b.key}
                  className={`px-3 py-1.5 rounded-[8px] text-[12px] font-semibold transition-colors ${
                    localTask.bucket === b.key
                      ? "bg-[var(--accent)] text-white"
                      : "bg-[var(--card)] text-[var(--text3)] hover:text-[var(--text2)]"
                  }`}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>

          {/* Metadata */}
          <div className="flex flex-wrap items-center gap-3 text-[11px]">
            {localTask.mission && (
              <span className="text-[var(--purple)]">Mission: {localTask.mission}</span>
            )}
            {localTask.version && (
              <span className="text-[var(--text3)]">v{localTask.version}</span>
            )}
            {localTask.surface && (
              <span className="inline-flex items-center gap-1">
                <span className="w-[5px] h-[5px] rounded-full" style={{ backgroundColor: SURFACE_DOT[localTask.surface] }} />
                <span className="text-[var(--text3)] uppercase">{localTask.surface}</span>
              </span>
            )}
            {localTask.is_owner_action && (
              <span className="text-[var(--cyan)] font-semibold">YOU</span>
            )}
          </div>

          {/* Progress */}
          {localTask.progress && progress && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[11px] text-[var(--text3)]">Progress</span>
                <span className="text-[12px] font-bold text-[var(--accent)] tabular-nums">{localTask.progress}</span>
              </div>
              <div className="flex gap-1">
                {Array.from({ length: progressTotal }, (_, i) => (
                  <div
                    key={i}
                    className={`flex-1 h-[8px] rounded-full ${
                      i < progressDone ? "bg-[var(--green)]" : i === progressDone ? "bg-[var(--accent)] animate-pulse" : "bg-[var(--border)]"
                    }`}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Log timeline */}
          {localTask.log && localTask.log.length > 0 && (
            <div>
              <span className="text-[11px] text-[var(--text3)] mb-1.5 block">Log</span>
              <div className="space-y-1.5 max-h-[150px] overflow-y-auto">
                {[...localTask.log].reverse().slice(0, 10).map((entry, i) => (
                  <div key={i} className="flex items-start gap-2 text-[11px]">
                    <span className="text-[var(--text3)] shrink-0 tabular-nums">{timeAgo(entry.timestamp)}</span>
                    <span className="text-[var(--text2)]">{entry.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 px-5 py-3 border-t border-[var(--border)] flex items-center justify-between">
          <span className="text-[10px] text-[var(--text3)] opacity-50">Updated {timeAgo(localTask.updated_at)}</span>
          {onDelete && (
            <button
              onClick={async () => {
                if (confirm("Delete this task?")) {
                  await onDelete(localTask.id);
                  onClose();
                }
              }}
              className="text-[11px] text-[#ff453a] hover:underline"
            >
              Delete task
            </button>
          )}
        </div>
      </div>
    </>
  );
}
