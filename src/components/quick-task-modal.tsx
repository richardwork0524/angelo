'use client';

import { useEffect, useRef, useState } from 'react';
import { invalidateCache } from '@/lib/cache';
import type { Project } from '@/lib/types';

interface QuickTaskDetail {
  project_key?: string | null;
  mission?: string | null;
  bucket?: string | null;
  priority?: string | null;
  attach_hint?: string | null;
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

export function QuickTaskModal() {
  const [open, setOpen] = useState(false);
  const [prefill, setPrefill] = useState<QuickTaskDetail>({});
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectKey, setProjectKey] = useState('');
  const [text, setText] = useState('');
  const [bucket, setBucket] = useState('THIS_WEEK');
  const [priority, setPriority] = useState<string | null>(null);
  const [mission, setMission] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onOpen(evt: Event) {
      const detail = ((evt as CustomEvent<QuickTaskDetail>).detail ?? {}) as QuickTaskDetail;
      setPrefill(detail);
      setText('');
      setBucket(detail.bucket || 'THIS_WEEK');
      setPriority(detail.priority || null);
      setMission(detail.mission || '');
      setProjectKey(detail.project_key || 'rinoa-os');
      setError(null);
      setOpen(true);
      setTimeout(() => textRef.current?.focus(), 80);
    }
    window.addEventListener('quick-task', onOpen);
    return () => window.removeEventListener('quick-task', onOpen);
  }, []);

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
      } catch {
        // silent
      }
    })();
    return () => { cancelled = true; };
  }, [projects.length]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  async function onSave() {
    setError(null);
    const trimmed = text.trim();
    if (!trimmed) { setError('Task text required.'); textRef.current?.focus(); return; }
    if (!projectKey) { setError('Pick a project.'); return; }
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        text: trimmed,
        bucket,
      };
      if (priority) body.priority = priority;
      if (mission.trim()) body.mission = mission.trim();
      const res = await fetch(`/api/projects/${projectKey}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || `HTTP ${res.status}`);
      }
      invalidateCache('/api/tasks');
      invalidateCache('/api/home');
      invalidateCache(`/api/projects/${projectKey}`);
      if (mission.trim()) invalidateCache(`/api/missions/${encodeURIComponent(mission.trim())}`);
      window.dispatchEvent(new Event('tasks-changed'));
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

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
          maxWidth: 520,
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--r-lg)',
          boxShadow: 'var(--sh-lg)',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh',
        }}
      >
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

          <div>
            <div style={{ fontSize: 'var(--t-tiny)', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>
              Project
            </div>
            <select
              value={projectKey}
              onChange={(e) => setProjectKey(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 10px',
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--r-sm)',
                fontSize: 'var(--t-sm)',
                color: 'var(--text)',
                fontFamily: 'ui-monospace, monospace',
                outline: 'none',
              }}
            >
              {projects.length === 0 && <option value="">Loading…</option>}
              {projects.map((p) => (
                <option key={p.child_key} value={p.child_key}>
                  {p.display_name} · {p.child_key}
                </option>
              ))}
            </select>
          </div>

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

          <div>
            <div style={{ fontSize: 'var(--t-tiny)', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>
              Mission (optional)
            </div>
            <input
              value={mission}
              onChange={(e) => setMission(e.target.value)}
              placeholder="e.g. memory-hygiene"
              style={{
                width: '100%',
                padding: '8px 10px',
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--r-sm)',
                fontSize: 'var(--t-sm)',
                color: 'var(--text)',
                fontFamily: 'ui-monospace, monospace',
                outline: 'none',
              }}
            />
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
