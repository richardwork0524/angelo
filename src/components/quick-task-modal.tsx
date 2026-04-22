'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { invalidateCache } from '@/lib/cache';
import { HierarchyPicker } from '@/components/hierarchy-picker';
import type { Project } from '@/lib/types';

interface QuickTaskDetail {
  project_key?: string | null;
  locked_project_key?: string | null;
  mission?: string | null;
  bucket?: string | null;
  priority?: string | null;
  attach_hint?: string | null;
  parent_task_id?: string | null;
}

const BUCKETS = [
  { value: 'THIS_WEEK', label: 'Week' },
  { value: 'THIS_MONTH', label: 'Month' },
  { value: 'PARKED', label: 'Parked' },
];

const PRIORITIES = [
  { value: 'P0', label: 'P0', color: 'var(--red)' },
  { value: 'P1', label: 'P1', color: 'var(--orange)' },
  { value: 'P2', label: 'P2', color: 'var(--yellow)' },
];

interface TaskOption {
  id: string;
  text: string;
  task_code: string | null;
  mission: string | null;
}

export function QuickTaskModal() {
  const [open, setOpen] = useState(false);
  const [prefill, setPrefill] = useState<QuickTaskDetail>({});
  const [lockedProjectKey, setLockedProjectKey] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectKey, setProjectKey] = useState('');
  const [text, setText] = useState('');
  const [bucket, setBucket] = useState('THIS_WEEK');
  const [priority, setPriority] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textRef = useRef<HTMLInputElement>(null);

  // Mission (managed by HierarchyPicker)
  const [mission, setMission] = useState('');

  // Parent task combobox
  const [parentTaskId, setParentTaskId] = useState<string | null>(null);
  const [parentTaskInput, setParentTaskInput] = useState('');
  const [parentOptions, setParentOptions] = useState<TaskOption[]>([]);
  const [parentOpen, setParentOpen] = useState(false);
  const parentRef = useRef<HTMLInputElement>(null);
  const parentDropRef = useRef<HTMLDivElement>(null);

  // Fetch open tasks for selected project (for parent task combobox)
  const fetchProjectTasks = useCallback(async (pk: string) => {
    if (!pk) { setParentOptions([]); return; }
    try {
      const res = await fetch(`/api/tasks?project=${encodeURIComponent(pk)}&completed=false`);
      if (!res.ok) return;
      const json = await res.json();
      if (Array.isArray(json.tasks)) setParentOptions(json.tasks);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    function onOpen(evt: Event) {
      const detail = ((evt as CustomEvent<QuickTaskDetail>).detail ?? {}) as QuickTaskDetail;
      setPrefill(detail);
      setText('');
      setBucket(detail.bucket || 'THIS_WEEK');
      setPriority(detail.priority || null);
      const m = detail.mission || '';
      setMission(m);
      // locked_project_key takes precedence over project_key
      const resolvedKey = detail.locked_project_key || detail.project_key || '';
      setLockedProjectKey(detail.locked_project_key || null);
      setProjectKey(resolvedKey);
      setParentTaskId(detail.parent_task_id || null);
      setParentTaskInput('');
      setParentOpen(false);
      setError(null);
      setOpen(true);
      setTimeout(() => textRef.current?.focus(), 80);
    }
    window.addEventListener('quick-task', onOpen);
    return () => window.removeEventListener('quick-task', onOpen);
  }, []);

  // Load parent task options when projectKey changes (and modal is open)
  useEffect(() => {
    if (!open || !projectKey) return;
    fetchProjectTasks(projectKey);
  }, [open, projectKey, fetchProjectTasks]);

  // Load projects list (for locked chip display_name)
  useEffect(() => {
    if (projects.length > 0) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/projects');
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled && Array.isArray(json.projects)) {
          setProjects(json.projects);
        }
      } catch { /* silent */ }
    })();
    return () => { cancelled = true; };
  }, [projects.length]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (parentOpen) { setParentOpen(false); return; }
        setOpen(false);
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, parentOpen]);

  // Close parent dropdown on outside click
  useEffect(() => {
    if (!parentOpen) return;
    function onClick(e: MouseEvent) {
      if (
        parentRef.current && !parentRef.current.contains(e.target as Node) &&
        parentDropRef.current && !parentDropRef.current.contains(e.target as Node)
      ) {
        setParentOpen(false);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [parentOpen]);

  function clearParent() {
    setParentTaskId(null);
    setParentTaskInput('');
  }

  function selectParent(t: TaskOption) {
    setParentTaskId(t.id);
    setParentTaskInput(t.task_code ? `${t.task_code} — ${t.text}` : t.text);
    setParentOpen(false);
  }

  const filteredParents = parentOptions.filter((t) => {
    const q = parentTaskInput.toLowerCase();
    return (
      t.text.toLowerCase().includes(q) ||
      (t.task_code && t.task_code.toLowerCase().includes(q)) ||
      (t.mission && t.mission.toLowerCase().includes(q))
    );
  }).slice(0, 30);

  async function onSave() {
    setError(null);
    const trimmed = text.trim();
    if (!trimmed) { setError('Task text required.'); textRef.current?.focus(); return; }
    if (!projectKey) { setError('Pick a project via the hierarchy.'); return; }
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = { text: trimmed, bucket };
      if (priority) body.priority = priority;
      const mTrimmed = mission.trim();
      if (mTrimmed) body.mission = mTrimmed;
      if (parentTaskId) body.parent_task_id = parentTaskId;

      const res = await fetch(`/api/projects/${projectKey}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || `HTTP ${res.status}`);
      }
      const payload = await res.json().catch(() => null);
      const createdTask = payload?.task ?? null;
      invalidateCache('/api/tasks');
      invalidateCache('/api/home');
      invalidateCache(`/api/projects/${projectKey}`);
      if (mTrimmed) invalidateCache(`/api/missions/${encodeURIComponent(mTrimmed)}`);
      window.dispatchEvent(new CustomEvent('tasks-changed', { detail: { action: 'added', task: createdTask } }));
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  const selectedParentLabel = parentTaskId
    ? (parentOptions.find((t) => t.id === parentTaskId)?.text ?? parentTaskInput)
    : null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={() => setOpen(false)}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.42)',
        backdropFilter: 'blur(2px)',
        WebkitBackdropFilter: 'blur(2px)',
        zIndex: 1100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 540,
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--r-lg)',
          boxShadow: 'var(--sh-lg)',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh',
        }}
      >
        {/* Header */}
        <div
          className="flex items-start gap-3"
          style={{ padding: '16px 18px', borderBottom: '1px solid var(--border)' }}
        >
          <div className="flex-1 min-w-0">
            <div style={{ fontSize: 'var(--t-tiny)', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
              Quick task · writes to angelo_tasks
            </div>
            <div style={{ fontSize: 'var(--t-h3)', fontWeight: 600, marginTop: 4 }}>
              New task
            </div>
            {prefill.attach_hint && (
              <div style={{ fontSize: 'var(--t-tiny)', color: 'var(--text3)', marginTop: 4 }}>
                Attaching to <span style={{ fontFamily: 'ui-monospace, monospace', color: 'var(--primary-2)' }}>{prefill.attach_hint}</span>
              </div>
            )}
          </div>
          <button
            onClick={() => setOpen(false)}
            aria-label="Close"
            style={{
              width: 28, height: 28,
              borderRadius: 'var(--r-sm)',
              background: 'transparent',
              border: '1px solid var(--border)',
              color: 'var(--text3)',
              fontSize: 14,
              lineHeight: 1,
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-4" style={{ padding: '16px 18px', overflowY: 'auto' }}>
          {/* Task text */}
          <div>
            <div style={{ fontSize: 'var(--t-tiny)', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>
              Task
            </div>
            <input
              ref={textRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && !submitting) onSave();
                if (e.key === 'Enter' && !submitting) onSave();
              }}
              placeholder="What needs doing?"
              style={{
                width: '100%',
                padding: 10,
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--r-sm)',
                fontSize: 'var(--t-sm)',
                color: 'var(--text)',
                outline: 'none',
              }}
            />
          </div>

          {/* Hierarchy picker — Project + Mission cascade (or locked chip) */}
          <div>
            <div style={{ fontSize: 'var(--t-tiny)', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>
              Project / Mission
            </div>
            <HierarchyPicker
              projectKey={projectKey}
              onProjectKeyChange={(key) => {
                setProjectKey(key);
                setParentTaskId(null);
                setParentTaskInput('');
              }}
              value={mission}
              onChange={setMission}
              lockedProjectKey={lockedProjectKey}
              projects={projects}
            />
          </div>

          {/* Bucket */}
          <div>
            <div style={{ fontSize: 'var(--t-tiny)', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>
              Bucket
            </div>
            <div className="flex gap-2">
              {BUCKETS.map((b) => {
                const active = bucket === b.value;
                return (
                  <button
                    key={b.value}
                    onClick={() => setBucket(b.value)}
                    className="flex-1"
                    style={{
                      padding: '8px 6px',
                      borderRadius: 'var(--r-sm)',
                      background: active ? 'var(--primary-dim)' : 'var(--bg)',
                      border: `1px solid ${active ? 'var(--primary-2)' : 'var(--border)'}`,
                      color: active ? 'var(--primary-2)' : 'var(--text3)',
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: '.06em',
                      cursor: 'pointer',
                      textTransform: 'uppercase',
                    }}
                  >
                    {b.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Priority */}
          <div>
            <div style={{ fontSize: 'var(--t-tiny)', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>
              Priority
            </div>
            <div className="flex gap-2">
              {PRIORITIES.map((p) => {
                const active = priority === p.value;
                return (
                  <button
                    key={p.value}
                    onClick={() => setPriority(active ? null : p.value)}
                    className="flex-1"
                    style={{
                      padding: '8px 6px',
                      borderRadius: 'var(--r-sm)',
                      background: active ? p.color : 'var(--bg)',
                      border: `1px solid ${active ? p.color : 'var(--border)'}`,
                      color: active ? '#fff' : 'var(--text3)',
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: '.06em',
                      cursor: 'pointer',
                    }}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Parent task combobox */}
          <div style={{ position: 'relative' }}>
            <div style={{ fontSize: 'var(--t-tiny)', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>
              Parent task (optional)
            </div>
            {selectedParentLabel && !parentOpen ? (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 10px',
                background: 'var(--primary-dim)',
                border: '1px solid var(--primary-2)',
                borderRadius: 'var(--r-sm)',
              }}>
                <span style={{ flex: 1, fontSize: 'var(--t-sm)', color: 'var(--primary-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {selectedParentLabel}
                </span>
                <button
                  onClick={clearParent}
                  style={{
                    background: 'transparent', border: 'none', color: 'var(--primary-2)',
                    cursor: 'pointer', fontSize: 12, lineHeight: 1, padding: 2, flexShrink: 0,
                  }}
                >
                  ✕
                </button>
                <button
                  onClick={() => { setParentTaskInput(''); setParentOpen(true); setTimeout(() => parentRef.current?.focus(), 50); }}
                  style={{
                    background: 'transparent', border: 'none', color: 'var(--primary-2)',
                    cursor: 'pointer', fontSize: 11, lineHeight: 1, padding: 2, flexShrink: 0, fontWeight: 600,
                  }}
                >
                  change
                </button>
              </div>
            ) : (
              <div style={{ position: 'relative' }}>
                <input
                  ref={parentRef}
                  value={parentTaskInput}
                  onChange={(e) => { setParentTaskInput(e.target.value); setParentOpen(true); }}
                  onFocus={() => setParentOpen(true)}
                  placeholder="Search tasks…"
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    background: 'var(--bg)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--r-sm)',
                    fontSize: 'var(--t-sm)',
                    color: 'var(--text)',
                    outline: 'none',
                  }}
                />
                {parentOpen && filteredParents.length > 0 && (
                  <div
                    ref={parentDropRef}
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      zIndex: 50,
                      background: 'var(--card)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--r-sm)',
                      boxShadow: 'var(--sh-lg)',
                      marginTop: 2,
                      maxHeight: 220,
                      overflowY: 'auto',
                    }}
                  >
                    {filteredParents.map((t) => (
                      <button
                        key={t.id}
                        onMouseDown={(e) => { e.preventDefault(); selectParent(t); }}
                        style={{
                          display: 'block',
                          width: '100%',
                          textAlign: 'left',
                          padding: '8px 12px',
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--text)',
                          fontSize: 'var(--t-sm)',
                          cursor: 'pointer',
                          borderBottom: '1px solid var(--border)',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--card-alt)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                      >
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {t.text}
                        </div>
                        {(t.task_code || t.mission) && (
                          <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2, fontFamily: 'ui-monospace, monospace' }}>
                            {[t.task_code, t.mission].filter(Boolean).join(' · ')}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
                {parentOpen && filteredParents.length === 0 && parentTaskInput.length > 0 && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      zIndex: 50,
                      background: 'var(--card)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--r-sm)',
                      padding: '10px 12px',
                      marginTop: 2,
                      fontSize: 'var(--t-sm)',
                      color: 'var(--text3)',
                    }}
                  >
                    No matching tasks
                  </div>
                )}
              </div>
            )}
          </div>

          {error && (
            <div style={{
              padding: '8px 10px',
              background: 'var(--danger-dim)',
              color: 'var(--danger)',
              border: '1px solid var(--danger)',
              borderRadius: 'var(--r-sm)',
              fontSize: 'var(--t-tiny)',
            }}>
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center gap-2"
          style={{ padding: '12px 18px', borderTop: '1px solid var(--border)', background: 'var(--card-alt)', borderBottomLeftRadius: 'var(--r-lg)', borderBottomRightRadius: 'var(--r-lg)' }}
        >
          <div className="flex-1" />
          <button
            onClick={() => setOpen(false)}
            disabled={submitting}
            style={{
              padding: '8px 14px',
              background: 'var(--card)',
              border: '1px solid var(--border)',
              color: 'var(--text2)',
              borderRadius: 'var(--r-sm)',
              fontSize: 'var(--t-sm)',
              cursor: submitting ? 'not-allowed' : 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={submitting}
            style={{
              padding: '8px 16px',
              background: 'var(--primary)',
              border: '1px solid var(--primary)',
              color: '#fff',
              borderRadius: 'var(--r-sm)',
              fontSize: 'var(--t-sm)',
              fontWeight: 500,
              cursor: submitting ? 'not-allowed' : 'pointer',
              opacity: submitting ? 0.6 : 1,
            }}
          >
            {submitting ? 'Saving…' : 'Save Task'}
          </button>
        </div>
      </div>
    </div>
  );
}
