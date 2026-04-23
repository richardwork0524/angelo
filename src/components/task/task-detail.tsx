'use client';

import { useState, useEffect } from 'react';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { PRIORITY_COLORS, SURFACE_COLORS, SURFACE_LABELS, PRIORITIES, BUCKETS, timeAgo } from '@/lib/constants';
import { SectionPager, type Section } from '@/components/section-pager';
import { MissionPicker } from '@/components/mission-picker';

/* ── Types (re-exported for consumers) ── */

export interface DetailTask {
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
  task: DetailTask;
  subtasks?: DetailTask[];
  onClose: () => void;
  onUpdate: (taskId: string, fields: Record<string, unknown>) => void | Promise<void>;
  onDelete?: (taskId: string) => void | Promise<void>;
  onAddSubtask?: (parentId: string, text: string) => void | Promise<void>;
}

/* ── Component ── */

export function TaskDetail({ task, subtasks = [], onClose, onUpdate, onDelete, onAddSubtask }: Props) {
  const isDesktop = useBreakpoint(640);
  const [visible, setVisible] = useState(true);
  const [localTask, setLocalTask] = useState(task);
  const [saving, setSaving] = useState(false);

  // Sync localTask when parent passes updated task prop (e.g. after data refresh)
  useEffect(() => {
    setLocalTask((prev) => {
      if (prev.id !== task.id || prev.updated_at !== task.updated_at) return task;
      return prev;
    });
  }, [task]);

  // Editing states
  const [editingText, setEditingText] = useState(false);
  const [editText, setEditText] = useState(task.text);
  const [editingDesc, setEditingDesc] = useState(false);
  const [editDesc, setEditDesc] = useState(task.description || '');
  const [missionPickerOpen, setMissionPickerOpen] = useState(false);
  const [showSplit, setShowSplit] = useState(false);
  const [splitCount, setSplitCount] = useState('3');
  const [addingSubtask, setAddingSubtask] = useState(false);
  const [subtaskText, setSubtaskText] = useState('');
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [completeLog, setCompleteLog] = useState('');
  const [showLog, setShowLog] = useState(false);

  const isLocked = !!localTask.surface;
  const progress = localTask.progress?.match(/^(\d+)\/(\d+)$/);
  const progressDone = progress ? parseInt(progress[1]) : 0;
  const progressTotal = progress ? parseInt(progress[2]) : 0;

  function handleClose() {
    setVisible(false);
    setTimeout(onClose, 200);
  }

  async function handleUpdate(fields: Record<string, unknown>) {
    setSaving(true);
    await onUpdate(localTask.id, fields);
    setLocalTask((prev) => ({ ...prev, ...fields } as DetailTask));
    setSaving(false);
  }

  async function handleSaveText() {
    if (editText.trim() && editText.trim() !== localTask.text) {
      await handleUpdate({ text: editText.trim() });
    }
    setEditingText(false);
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
    const payload: Record<string, unknown> = { progress: next };
    if (progressDone + 1 >= progressTotal) {
      payload.status = 'completed';
      payload.log_entry = { type: 'completion', message: `All ${progressTotal} sections completed` };
    } else {
      payload.log_entry = { type: 'section_complete', message: `Completed section ${progressDone + 1}/${progressTotal}`, section: progressDone + 1 };
    }
    await handleUpdate(payload);
  }

  async function handleAddSubtask() {
    if (!subtaskText.trim() || !onAddSubtask) return;
    setSaving(true);
    await onAddSubtask(localTask.id, subtaskText.trim());
    setSaving(false);
    setSubtaskText('');
    setAddingSubtask(false);
  }

  async function handleComplete() {
    if (!completeLog.trim()) return;
    await handleUpdate({
      status: 'completed',
      log_entry: { type: 'completion', message: completeLog.trim() },
    });
    handleClose();
  }

  /* ── Section content builders ── */

  const overviewSection = (
    <div className="px-4 py-4 space-y-4">
      {/* Surface lock banner */}
      {isLocked && (
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-[8px] text-[12px] font-semibold"
          style={{ backgroundColor: `color-mix(in srgb, ${SURFACE_COLORS[localTask.surface!]} 12%, transparent)`, color: SURFACE_COLORS[localTask.surface!] }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0110 0v4" />
          </svg>
          Locked to {SURFACE_LABELS[localTask.surface!] || localTask.surface} session
        </div>
      )}

      {/* Title — editable */}
      <div className="flex items-start gap-3">
        <button
          onClick={() => !localTask.completed && setCompleting(true)}
          className={`w-6 h-6 rounded-full border-2 shrink-0 mt-1 flex items-center justify-center transition-all ${
            localTask.completed ? 'bg-[var(--green)] border-[var(--green)]' : 'border-[var(--border2)] hover:border-[var(--accent)]'
          }`}
        >
          {localTask.completed && (
            <svg width="12" height="12" viewBox="0 0 10 10" fill="none">
              <path d="M2 5L4 7L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>

        {editingText ? (
          <textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onBlur={handleSaveText}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSaveText(); }
              if (e.key === 'Escape') { setEditText(localTask.text); setEditingText(false); }
            }}
            autoFocus
            rows={2}
            disabled={saving}
            className="flex-1 text-[18px] font-semibold text-[var(--text)] bg-transparent border-b-2 border-[var(--accent)] focus:outline-none pb-1 resize-none"
          />
        ) : (
          <p
            className={`flex-1 text-[18px] font-semibold leading-[1.3] ${localTask.completed ? 'text-[var(--text3)] line-through' : 'text-[var(--text)]'} cursor-text`}
            onClick={() => { setEditText(localTask.text); setEditingText(true); }}
          >
            {localTask.text}
          </p>
        )}
      </div>

      {/* Bucket tabs */}
      <div>
        <div className="text-[11px] font-bold text-[var(--text3)] uppercase tracking-[0.08em] mb-1.5">Bucket</div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {BUCKETS.map((b) => (
            <button
              key={b.key}
              onClick={() => handleUpdate({ bucket: b.key })}
              disabled={saving || localTask.bucket === b.key || isLocked}
              className={`px-3 py-1.5 rounded-[8px] text-[12px] font-semibold transition-all ${
                localTask.bucket === b.key
                  ? 'bg-[var(--accent)] text-white'
                  : 'bg-[var(--card)] text-[var(--text3)] hover:text-[var(--text2)]'
              } ${isLocked ? 'opacity-50' : ''}`}
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>

      {/* Priority */}
      <div>
        <div className="text-[11px] font-bold text-[var(--text3)] uppercase tracking-[0.08em] mb-1.5">Priority</div>
        <div className="flex items-center gap-1.5">
          {PRIORITIES.map((p) => (
            <button
              key={p}
              onClick={() => handleUpdate({ priority: p === localTask.priority ? null : p })}
              disabled={saving || isLocked}
              className={`px-3 py-1.5 rounded-[8px] text-[12px] font-bold transition-all ${
                localTask.priority === p ? 'text-white' : 'text-[var(--text3)] bg-[var(--card)]'
              } ${isLocked ? 'opacity-50' : ''}`}
              style={localTask.priority === p ? { backgroundColor: PRIORITY_COLORS[p] } : undefined}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Mission (picker) */}
      <div>
        <div className="text-[11px] font-bold text-[var(--text3)] uppercase tracking-[0.08em] mb-1.5">Mission</div>
        <button
          onClick={() => setMissionPickerOpen(true)}
          className="w-full flex items-center justify-between px-3 py-2 rounded-[8px] text-left transition-colors hover:bg-[var(--card-alt)]"
          style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
        >
          <span className={`text-[13px] ${localTask.mission ? 'text-[var(--purple)] font-medium' : 'text-[var(--text3)]'}`}>
            {localTask.mission || 'Pick or create a mission…'}
          </span>
          <span style={{ color: 'var(--text3)', fontSize: 12 }}>▸</span>
        </button>
      </div>

      {/* Progress / Split */}
      {localTask.progress && progress ? (
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <div className="text-[11px] font-bold text-[var(--text3)] uppercase tracking-[0.08em]">Progress</div>
            <span className="text-[13px] font-bold text-[var(--accent)] tabular-nums">{localTask.progress}</span>
          </div>
          <div className="flex gap-1">
            {Array.from({ length: progressTotal }, (_, i) => (
              <button
                key={i}
                onClick={() => i === progressDone && !isLocked ? handleSectionComplete() : undefined}
                disabled={i !== progressDone || saving || isLocked}
                className={`flex-1 h-[8px] rounded-full transition-colors ${
                  i < progressDone ? 'bg-[var(--green)]' : i === progressDone ? 'bg-[var(--accent)] animate-pulse cursor-pointer' : 'bg-[var(--border)]'
                }`}
              />
            ))}
          </div>
        </div>
      ) : !localTask.progress && !isLocked ? (
        showSplit ? (
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-[var(--text2)]">Split into</span>
            <div className="flex items-center gap-2">
              <input
                type="number" min="2" max="20" value={splitCount} onChange={(e) => setSplitCount(e.target.value)}
                className="w-[44px] text-[13px] text-[var(--text)] bg-[var(--card)] border border-[var(--border)] rounded-[6px] px-2 py-1 text-center"
              />
              <button onClick={handleSplit} disabled={saving} className="text-[12px] text-[var(--accent)] font-semibold">Save</button>
              <button onClick={() => setShowSplit(false)} className="text-[12px] text-[var(--text3)]">Cancel</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setShowSplit(true)} className="text-[13px] text-[var(--accent)]">
            + Split into sections
          </button>
        )
      ) : null}
    </div>
  );

  const stepsSection = (
    <div className="px-4 py-4">
      <div className="text-[11px] font-bold text-[var(--text3)] uppercase tracking-[0.08em] mb-2">
        Steps {subtasks.length > 0 && `(${subtasks.filter((s) => s.completed).length}/${subtasks.length})`}
      </div>
      {subtasks.length === 0 && !addingSubtask && (
        <div className="text-[13px] text-[var(--text3)] italic mb-3">No steps yet.</div>
      )}
      {subtasks.length > 0 && (
        <div className="space-y-1 mb-2">
          {subtasks.map((st) => (
            <div key={st.id} className="flex items-center gap-2.5 py-2 px-2 rounded-[8px] hover:bg-[var(--card-alt)] transition-colors">
              <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                st.completed ? 'bg-[var(--green)] border-[var(--green)]' : 'border-[var(--border2)]'
              }`}>
                {st.completed && (
                  <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
                    <path d="M2 5L4 7L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </span>
              <span className={`flex-1 text-[13px] ${st.completed ? 'text-[var(--text3)] line-through' : 'text-[var(--text)]'}`}>
                {st.text}
              </span>
              {st.surface && (
                <span className="inline-flex items-center gap-0.5 shrink-0">
                  <span className="w-[4px] h-[4px] rounded-full" style={{ backgroundColor: SURFACE_COLORS[st.surface] }} />
                  <span className="text-[9px] text-[var(--text3)]">{st.surface}</span>
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {!isLocked && onAddSubtask && (
        addingSubtask ? (
          <div className="flex items-center gap-2 px-2">
            <span className="w-4 h-4 rounded-full border-2 border-[var(--border2)] shrink-0" />
            <input
              type="text" value={subtaskText} onChange={(e) => setSubtaskText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddSubtask(); if (e.key === 'Escape') { setSubtaskText(''); setAddingSubtask(false); } }}
              placeholder="Add a step..." autoFocus
              className="flex-1 text-[13px] text-[var(--text)] bg-transparent focus:outline-none border-b border-[var(--border)] pb-1"
            />
            <button onClick={handleAddSubtask} disabled={saving || !subtaskText.trim()} className="text-[12px] text-[var(--accent)] font-semibold">Add</button>
          </div>
        ) : (
          <button onClick={() => setAddingSubtask(true)} className="flex items-center gap-2.5 px-2 py-2 text-[13px] text-[var(--accent)] hover:bg-[var(--card)] rounded-[8px] transition-colors w-full text-left">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <line x1="7" y1="2" x2="7" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="2" y1="7" x2="12" y2="7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            Add Step
          </button>
        )
      )}
    </div>
  );

  const notesSection = (
    <div className="px-4 py-4">
      <div className="text-[11px] font-bold text-[var(--text3)] uppercase tracking-[0.08em] mb-2">Notes</div>
      {editingDesc ? (
        <textarea
          value={editDesc} onChange={(e) => setEditDesc(e.target.value)}
          onBlur={async () => {
            if (editDesc.trim() !== (localTask.description || '')) {
              await handleUpdate({ description: editDesc.trim() || null });
            }
            setEditingDesc(false);
          }}
          onKeyDown={(e) => { if (e.key === 'Escape') { setEditDesc(localTask.description || ''); setEditingDesc(false); } }}
          autoFocus rows={10}
          className="w-full text-[14px] text-[var(--text)] bg-[var(--card)] border border-[var(--border)] rounded-[8px] px-3 py-2 focus:outline-none focus:border-[var(--accent)] resize-none"
        />
      ) : (
        <button
          onClick={() => { setEditDesc(localTask.description || ''); setEditingDesc(true); }}
          className="w-full text-left text-[14px] leading-[1.55] px-3 py-3 rounded-[8px] bg-[var(--card)] min-h-[120px] whitespace-pre-wrap border border-[var(--border)]"
        >
          <span className={localTask.description ? 'text-[var(--text2)]' : 'text-[var(--text3)] italic'}>
            {localTask.description || 'Tap to add notes…'}
          </span>
        </button>
      )}
    </div>
  );

  const detailsSection = (
    <div className="px-4 py-4 space-y-3">
      <div className="text-[11px] font-bold text-[var(--text3)] uppercase tracking-[0.08em]">Details</div>

      {localTask.surface && (
        <Row label="Surface">
          <span className="inline-flex items-center gap-1.5 text-[13px]" style={{ color: SURFACE_COLORS[localTask.surface] }}>
            <span className="w-[6px] h-[6px] rounded-full" style={{ backgroundColor: SURFACE_COLORS[localTask.surface] }} />
            {localTask.surface}
          </span>
        </Row>
      )}

      {localTask.version && (
        <Row label="Version">
          <span className="text-[13px] text-[var(--text)]">v{localTask.version}</span>
        </Row>
      )}

      {localTask.is_owner_action && (
        <Row label="Owner Action">
          <span className="text-[12px] font-bold text-[var(--cyan)] bg-[var(--cyan-dim)] px-2 py-0.5 rounded-[6px]">YOU</span>
        </Row>
      )}

      <Row label="Updated">
        <span className="text-[13px] text-[var(--text3)]">{timeAgo(localTask.updated_at)}</span>
      </Row>

      <Row label="Project">
        <span className="text-[13px] text-[var(--text)]">{localTask.project_key}</span>
      </Row>

      {localTask.task_code && (
        <Row label="Code">
          <span className="text-[13px] font-mono text-[var(--accent)] font-bold">{localTask.task_code}</span>
        </Row>
      )}

      {/* Log */}
      {localTask.log && localTask.log.length > 0 && (
        <div className="pt-2" style={{ borderTop: '1px solid var(--border)' }}>
          <button
            onClick={() => setShowLog(!showLog)}
            className="flex items-center gap-2 text-[11px] font-bold text-[var(--text3)] uppercase tracking-[0.08em] mb-2"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className={`transition-transform ${showLog ? 'rotate-90' : ''}`}>
              <path d="M3 1L7 5L3 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            Log ({localTask.log.length})
          </button>
          {showLog && (
            <div className="space-y-1.5 max-h-[240px] overflow-y-auto">
              {[...localTask.log].reverse().slice(0, 20).map((entry, i) => (
                <div key={i} className="flex items-start gap-2 text-[12px]">
                  <span className="text-[var(--text3)] shrink-0 tabular-nums w-[56px]">{timeAgo(entry.timestamp)}</span>
                  <span className="text-[var(--text2)]">{entry.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );

  const sections: Section[] = [
    { key: 'overview', label: 'Overview', content: overviewSection },
    { key: 'steps', label: 'Steps', content: stepsSection, badge: subtasks.length > 0 ? `${subtasks.filter((s) => s.completed).length}/${subtasks.length}` : null },
    { key: 'notes', label: 'Notes', content: notesSection, badge: localTask.description ? '•' : null },
    { key: 'details', label: 'Details', content: detailsSection },
  ];

  /* ── Shared panel ── */

  const panelContent = (
    <div className={`flex flex-col h-full bg-[var(--surface)] ${isDesktop ? 'border-l border-[var(--border)]' : ''}`}>
      {/* Header — respects safe-area top */}
      <div
        className="shrink-0 px-4 pb-2 border-b border-[var(--border)]"
        style={{ paddingTop: isDesktop ? 12 : 'calc(12px + var(--safe-t))' }}
      >
        <div className="flex items-center justify-between mb-1.5">
          <button onClick={handleClose} className="flex items-center gap-1 text-[var(--accent)] text-[14px] font-medium">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 4L6 8L10 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Back
          </button>
          <button onClick={handleClose} aria-label="Close" className="w-8 h-8 rounded-full hover:bg-[var(--card)] flex items-center justify-center text-[var(--text3)]">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="flex items-center gap-1 flex-wrap" style={{ fontSize: 11, color: 'var(--text3)' }}>
          <span style={{ fontWeight: 600, color: 'var(--text2)' }}>{localTask.project_key}</span>
          {localTask.mission && (
            <>
              <span>›</span>
              <span style={{ color: 'var(--purple)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {localTask.mission}
              </span>
            </>
          )}
          {localTask.task_code && (
            <>
              <span>·</span>
              <span style={{ fontFamily: 'ui-monospace, monospace', color: 'var(--accent)', fontWeight: 600 }}>
                {localTask.task_code}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Swipe pager */}
      <SectionPager sections={sections} />

      {/* Action bar */}
      <div
        className="shrink-0 px-4 py-3 border-t border-[var(--border)] bg-[var(--surface)]"
        style={{ paddingBottom: isDesktop ? 12 : 'calc(12px + var(--safe-b))' }}
      >
        {completing ? (
          <div className="flex items-center gap-2">
            <input
              type="text" value={completeLog} onChange={(e) => setCompleteLog(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleComplete(); if (e.key === 'Escape') { setCompleteLog(''); setCompleting(false); } }}
              placeholder="Completion note…" autoFocus
              className="flex-1 text-[13px] text-[var(--text)] bg-[var(--card)] border border-[var(--accent)] rounded-[8px] px-3 py-2 focus:outline-none"
            />
            <button onClick={handleComplete} disabled={!completeLog.trim()} className="px-4 py-2 bg-[var(--green)] text-white rounded-[8px] text-[13px] font-semibold disabled:opacity-50">
              Done
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2">
            {onDelete && (
              confirmingDelete ? (
                <div className="flex items-center gap-2">
                  <span className="text-[13px] text-[var(--text2)]">Delete?</span>
                  <button
                    onClick={async () => { await onDelete(localTask.id); handleClose(); }}
                    className="text-[13px] text-[var(--red)] font-semibold hover:underline"
                  >
                    Yes
                  </button>
                  <button
                    onClick={() => setConfirmingDelete(false)}
                    className="text-[13px] text-[var(--text3)] hover:underline"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmingDelete(true)}
                  className="flex items-center gap-1.5 text-[13px] text-[var(--red)]"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                  </svg>
                  Delete
                </button>
              )
            )}
            {!localTask.completed && (
              <button
                onClick={() => setCompleting(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-[var(--green)] text-white rounded-[8px] text-[13px] font-semibold ml-auto"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M3 7L6 10L11 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Mark Complete
              </button>
            )}
          </div>
        )}
      </div>

      {/* Mission picker */}
      <MissionPicker
        open={missionPickerOpen}
        currentValue={localTask.mission}
        preferParent={localTask.project_key}
        onClose={() => setMissionPickerOpen(false)}
        onSelect={(value) => handleUpdate({ mission: value })}
      />
    </div>
  );

  /* ── Render: Mobile = full-screen overlay, Desktop = side panel ── */

  if (isDesktop) {
    return (
      <>
        <div
          className={`fixed inset-0 bg-black/40 z-40 transition-opacity duration-200 ${visible ? 'opacity-100' : 'opacity-0'}`}
          onClick={handleClose}
        />
        <div
          className={`fixed top-0 right-0 bottom-0 z-50 shadow-2xl transition-transform duration-200 w-[clamp(380px,38vw,480px)] lg:w-[clamp(420px,34vw,520px)] xl:w-[min(560px,32vw)] ${
            visible ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          {panelContent}
        </div>
      </>
    );
  }

  return (
    <>
      <div className={`fixed inset-0 bg-black/50 z-40 transition-opacity duration-200 ${visible ? 'opacity-100' : 'opacity-0'}`} onClick={handleClose} />
      <div
        className={`fixed inset-0 z-50 transition-transform duration-200 ${
          visible ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        {panelContent}
      </div>
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[13px] text-[var(--text2)]">{label}</span>
      {children}
    </div>
  );
}
