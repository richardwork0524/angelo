'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { invalidateCache } from '@/lib/cache';
import type { Note, NoteType, Project } from '@/lib/types';

export interface QuickNoteDetail {
  project_key?: string | null;
  locked_project_key?: string | null;
  feature?: string | null;
  mission?: string | null;
  version?: string | null;
  session_log_id?: string | null;
  attach_hint?: string | null;
  edit_note?: Note | null;
  default_type?: NoteType;
}

type ModalState =
  | { mode: 'closed' }
  | { mode: 'create'; prefill: QuickNoteDetail }
  | { mode: 'edit'; note: Note };

const TYPE_ORDER: NoteType[] = ['GAP', 'IDEA', 'OBSERVATION', 'REVISIT'];
const TYPE_LABEL: Record<NoteType, string> = {
  GAP: 'GAP',
  IDEA: 'IDEA',
  OBSERVATION: 'OBS',
  REVISIT: 'REVISIT',
};
const TYPE_COLOR: Record<NoteType, { bg: string; fg: string }> = {
  GAP: { bg: 'var(--warn-dim)', fg: 'var(--warn)' },
  IDEA: { bg: 'var(--primary-dim)', fg: 'var(--primary-2)' },
  OBSERVATION: { bg: 'var(--info-dim)', fg: 'var(--info)' },
  REVISIT: { bg: 'var(--danger-dim)', fg: 'var(--danger)' },
};

export function NoteModal() {
  const [state, setState] = useState<ModalState>({ mode: 'closed' });
  const [projects, setProjects] = useState<Project[]>([]);
  const [noteType, setNoteType] = useState<NoteType>('GAP');
  const [text, setText] = useState('');
  const [projectKey, setProjectKey] = useState<string>('');
  const [lockedProjectKey, setLockedProjectKey] = useState<string | null>(null);
  const [feature, setFeature] = useState('');
  const [version, setVersion] = useState('');
  const [sessionLogId, setSessionLogId] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  // Mission combobox
  const [mission, setMission] = useState('');
  const [missionInput, setMissionInput] = useState('');
  const [missionOptions, setMissionOptions] = useState<string[]>([]);
  const [missionOpen, setMissionOpen] = useState(false);
  const missionRef = useRef<HTMLInputElement>(null);
  const missionDropRef = useRef<HTMLDivElement>(null);

  const isOpen = state.mode !== 'closed';

  const resetForm = useCallback(() => {
    setNoteType('GAP');
    setText('');
    setProjectKey('');
    setLockedProjectKey(null);
    setFeature('');
    setMission('');
    setMissionInput('');
    setMissionOptions([]);
    setVersion('');
    setSessionLogId(null);
    setShowAdvanced(false);
    setMissionOpen(false);
    setError(null);
  }, []);

  const close = useCallback(() => {
    setState({ mode: 'closed' });
    resetForm();
  }, [resetForm]);

  // Fetch missions for project
  const fetchMissions = useCallback(async (pk: string) => {
    if (!pk) { setMissionOptions([]); return; }
    try {
      const res = await fetch(`/api/tasks?project=${encodeURIComponent(pk)}&completed=false`);
      if (!res.ok) return;
      const json = await res.json();
      const byProject = json.missions?.by_project as Record<string, string[]> | undefined;
      setMissionOptions(byProject?.[pk] ?? []);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    function onQuickNote(evt: Event) {
      const detail = (evt as CustomEvent<QuickNoteDetail>).detail || {};
      if (detail.edit_note) {
        setState({ mode: 'edit', note: detail.edit_note });
      } else {
        setState({ mode: 'create', prefill: detail });
      }
    }
    window.addEventListener('quick-note', onQuickNote as EventListener);
    return () => window.removeEventListener('quick-note', onQuickNote as EventListener);
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
      } catch { /* silent */ }
    })();
    return () => { cancelled = true; };
  }, [projects.length]);

  useEffect(() => {
    if (state.mode === 'closed') return;
    if (state.mode === 'create') {
      const p = state.prefill;
      setNoteType(p.default_type || 'GAP');
      setText('');
      // locked_project_key takes precedence
      const resolvedKey = p.locked_project_key || p.project_key || 'rinoa-os';
      setLockedProjectKey(p.locked_project_key || null);
      setProjectKey(resolvedKey);
      setFeature(p.feature || '');
      const m = p.mission || '';
      setMission(m);
      setMissionInput(m);
      setVersion(p.version || '');
      setSessionLogId(p.session_log_id ?? null);
      setShowAdvanced(!!(p.feature || p.version));
      setMissionOpen(false);
      setError(null);
    } else if (state.mode === 'edit') {
      const n = state.note;
      setNoteType(n.note_type);
      setText(n.text);
      setProjectKey(n.project_key);
      setFeature(n.feature || '');
      const m = n.mission || '';
      setMission(m);
      setMissionInput(m);
      setVersion(n.version || '');
      setSessionLogId(n.session_log_id);
      setShowAdvanced(!!(n.feature || n.version));
      setMissionOpen(false);
      setError(null);
    }
    const t = setTimeout(() => textRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, [state]);

  // Load missions when projectKey changes
  useEffect(() => {
    if (!isOpen || !projectKey) return;
    fetchMissions(projectKey);
  }, [isOpen, projectKey, fetchMissions]);

  useEffect(() => {
    if (!isOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (missionOpen) { setMissionOpen(false); return; }
        close();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, close, missionOpen]);

  // Close mission dropdown on outside click
  useEffect(() => {
    if (!missionOpen) return;
    function onClick(e: MouseEvent) {
      if (
        missionRef.current && !missionRef.current.contains(e.target as Node) &&
        missionDropRef.current && !missionDropRef.current.contains(e.target as Node)
      ) {
        setMissionOpen(false);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [missionOpen]);

  function selectMission(m: string) {
    setMission(m);
    setMissionInput(m);
    setMissionOpen(false);
    missionRef.current?.blur();
  }

  const filteredMissions = missionOptions.filter((m) =>
    m.toLowerCase().includes(missionInput.toLowerCase())
  );

  const showNewMissionOption =
    missionInput.trim() !== '' &&
    !missionOptions.some((m) => m.toLowerCase() === missionInput.toLowerCase().trim());

  async function onSave() {
    setError(null);
    const trimmed = text.trim();
    if (!trimmed) { setError('Text required.'); textRef.current?.focus(); return; }
    if (!projectKey) { setError('Pick a project.'); return; }
    setSubmitting(true);
    try {
      if (state.mode === 'edit') {
        const res = await fetch(`/api/notes/${state.note.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: trimmed,
            note_type: noteType,
            feature: feature.trim() || null,
            mission: mission.trim() || null,
            version: version.trim() || null,
          }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      } else {
        const res = await fetch('/api/notes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            project_key: projectKey,
            text: trimmed,
            note_type: noteType,
            feature: feature.trim() || undefined,
            mission: mission.trim() || undefined,
            version: version.trim() || undefined,
            session_log_id: sessionLogId || undefined,
          }),
        });
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          throw new Error(json?.error || `HTTP ${res.status}`);
        }
      }
      invalidateCache('/api/notes');
      invalidateCache('/api/home');
      window.dispatchEvent(new Event('notes-changed'));
      close();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSubmitting(false);
    }
  }

  async function onDelete() {
    if (state.mode !== 'edit') return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/notes/${state.note.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      invalidateCache('/api/notes');
      invalidateCache('/api/home');
      window.dispatchEvent(new Event('notes-changed'));
      close();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete');
    } finally {
      setSubmitting(false);
    }
  }

  async function onToggleResolve() {
    if (state.mode !== 'edit') return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/notes/${state.note.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolved: !state.note.resolved }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      invalidateCache('/api/notes');
      invalidateCache('/api/home');
      window.dispatchEvent(new Event('notes-changed'));
      close();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSubmitting(false);
    }
  }

  if (!isOpen) return null;

  const isEdit = state.mode === 'edit';
  const attachHint = state.mode === 'create' ? state.prefill.attach_hint : null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={close}
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
        {/* Header */}
        <div
          className="flex items-start gap-3"
          style={{ padding: '16px 18px', borderBottom: '1px solid var(--border)' }}
        >
          <div className="flex-1 min-w-0">
            <div style={{ fontSize: 'var(--t-tiny)', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
              {isEdit ? 'Edit note · updates angelo_notes' : 'Quick note · writes to angelo_notes'}
            </div>
            <div style={{ fontSize: 'var(--t-h3)', fontWeight: 600, marginTop: 4 }}>
              {isEdit ? 'Edit note' : 'New note'}
            </div>
            {attachHint && (
              <div style={{ fontSize: 'var(--t-tiny)', color: 'var(--text3)', marginTop: 4 }}>
                Attaching to <span style={{ fontFamily: 'ui-monospace, monospace', color: 'var(--primary-2)' }}>{attachHint}</span>
              </div>
            )}
          </div>
          <button
            onClick={close}
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
          {/* Type picker */}
          <div>
            <div style={{ fontSize: 'var(--t-tiny)', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>
              Type
            </div>
            <div className="flex gap-2">
              {TYPE_ORDER.map((t) => {
                const active = noteType === t;
                const color = TYPE_COLOR[t];
                return (
                  <button
                    key={t}
                    onClick={() => setNoteType(t)}
                    className="flex-1 transition-colors"
                    style={{
                      padding: '8px 6px',
                      borderRadius: 'var(--r-sm)',
                      background: active ? color.bg : 'var(--bg)',
                      border: `1px solid ${active ? color.fg : 'var(--border)'}`,
                      color: active ? color.fg : 'var(--text3)',
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: '.08em',
                      cursor: 'pointer',
                    }}
                  >
                    {TYPE_LABEL[t]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Text */}
          <div>
            <div style={{ fontSize: 'var(--t-tiny)', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>
              Text
            </div>
            <textarea
              ref={textRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && !submitting) onSave();
              }}
              placeholder="What's the note?"
              style={{
                width: '100%',
                minHeight: 110,
                padding: 10,
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--r-sm)',
                fontSize: 'var(--t-sm)',
                color: 'var(--text)',
                resize: 'vertical',
                outline: 'none',
                fontFamily: 'inherit',
              }}
            />
          </div>

          {/* Project selector */}
          <div>
            <div style={{ fontSize: 'var(--t-tiny)', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>
              Project
            </div>
            {lockedProjectKey && !isEdit ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 10px',
                  background: 'var(--primary-dim)',
                  border: '1px solid var(--primary-2)',
                  borderRadius: 'var(--r-sm)',
                  fontSize: 'var(--t-sm)',
                  fontFamily: 'ui-monospace, monospace',
                }}
              >
                <span style={{ flex: 1, color: 'var(--primary-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {projects.find((p) => p.child_key === lockedProjectKey)?.display_name
                    ? `${projects.find((p) => p.child_key === lockedProjectKey)!.display_name} · ${lockedProjectKey}`
                    : lockedProjectKey}
                </span>
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '.06em',
                    color: 'var(--primary-2)',
                    opacity: 0.7,
                  }}
                >
                  locked
                </span>
              </div>
            ) : (
              <select
                value={projectKey}
                onChange={(e) => {
                  setProjectKey(e.target.value);
                  setMission('');
                  setMissionInput('');
                }}
                disabled={isEdit}
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
                  opacity: isEdit ? 0.6 : 1,
                }}
              >
                {projects.length === 0 && <option value="">Loading…</option>}
                {projects.map((p) => (
                  <option key={p.child_key} value={p.child_key}>
                    {p.display_name} · {p.child_key}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Mission combobox — first-class field */}
          <div style={{ position: 'relative' }}>
            <div style={{ fontSize: 'var(--t-tiny)', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>
              Mission (optional)
            </div>
            <div style={{ position: 'relative' }}>
              <input
                ref={missionRef}
                value={missionInput}
                onChange={(e) => {
                  setMissionInput(e.target.value);
                  setMission(e.target.value);
                  setMissionOpen(true);
                }}
                onFocus={() => setMissionOpen(true)}
                placeholder="e.g. ANG-UI-M019"
                style={{
                  width: '100%',
                  padding: '8px 32px 8px 10px',
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--r-sm)',
                  fontSize: 'var(--t-sm)',
                  color: 'var(--text)',
                  fontFamily: 'ui-monospace, monospace',
                  outline: 'none',
                }}
              />
              {missionInput && (
                <button
                  onClick={() => { setMission(''); setMissionInput(''); setMissionOpen(false); }}
                  style={{
                    position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                    background: 'transparent', border: 'none', color: 'var(--text3)',
                    cursor: 'pointer', fontSize: 12, lineHeight: 1, padding: 2,
                  }}
                >
                  ✕
                </button>
              )}
            </div>
            {missionOpen && (filteredMissions.length > 0 || showNewMissionOption) && (
              <div
                ref={missionDropRef}
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
                  maxHeight: 200,
                  overflowY: 'auto',
                }}
              >
                {filteredMissions.map((m) => (
                  <button
                    key={m}
                    onMouseDown={(e) => { e.preventDefault(); selectMission(m); }}
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      padding: '8px 12px',
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text)',
                      fontSize: 'var(--t-sm)',
                      fontFamily: 'ui-monospace, monospace',
                      cursor: 'pointer',
                      borderBottom: '1px solid var(--border)',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--card-alt)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    {m}
                  </button>
                ))}
                {showNewMissionOption && (
                  <button
                    onMouseDown={(e) => { e.preventDefault(); selectMission(missionInput.trim()); }}
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      padding: '8px 12px',
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--primary-2)',
                      fontSize: 'var(--t-sm)',
                      fontFamily: 'ui-monospace, monospace',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--card-alt)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    ＋ New mission: &ldquo;{missionInput.trim()}&rdquo;
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Advanced toggle — feature + version only now */}
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            style={{
              alignSelf: 'flex-start',
              background: 'transparent',
              border: 'none',
              color: 'var(--text3)',
              fontSize: 'var(--t-tiny)',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            {showAdvanced ? '▾' : '▸'} {showAdvanced ? 'Hide' : 'Show'} feature / version
          </button>

          {showAdvanced && (
            <div className="flex flex-col gap-3">
              <LabeledInput label="Feature" value={feature} onChange={setFeature} placeholder="e.g. redesign" />
              <LabeledInput label="Version" value={version} onChange={setVersion} placeholder="e.g. v0.3" />
            </div>
          )}

          {error && (
            <div
              style={{
                padding: '8px 10px',
                background: 'var(--danger-dim)',
                color: 'var(--danger)',
                border: '1px solid var(--danger)',
                borderRadius: 'var(--r-sm)',
                fontSize: 'var(--t-tiny)',
              }}
            >
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center gap-2"
          style={{ padding: '12px 18px', borderTop: '1px solid var(--border)', background: 'var(--card-alt)', borderBottomLeftRadius: 'var(--r-lg)', borderBottomRightRadius: 'var(--r-lg)' }}
        >
          {isEdit && (
            <>
              {confirmingDelete ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 'var(--t-sm)', color: 'var(--text2)' }}>Delete note?</span>
                  <button
                    onClick={onDelete}
                    disabled={submitting}
                    style={{
                      padding: '8px 12px',
                      background: 'transparent',
                      border: '1px solid var(--danger)',
                      color: 'var(--danger)',
                      borderRadius: 'var(--r-sm)',
                      fontSize: 'var(--t-sm)',
                      fontWeight: 600,
                      cursor: submitting ? 'not-allowed' : 'pointer',
                      opacity: submitting ? 0.6 : 1,
                    }}
                  >
                    Yes
                  </button>
                  <button
                    onClick={() => setConfirmingDelete(false)}
                    disabled={submitting}
                    style={{
                      padding: '8px 12px',
                      background: 'transparent',
                      border: '1px solid var(--border)',
                      color: 'var(--text3)',
                      borderRadius: 'var(--r-sm)',
                      fontSize: 'var(--t-sm)',
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmingDelete(true)}
                  disabled={submitting}
                  style={{
                    padding: '8px 12px',
                    background: 'transparent',
                    border: '1px solid var(--danger)',
                    color: 'var(--danger)',
                    borderRadius: 'var(--r-sm)',
                    fontSize: 'var(--t-sm)',
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    opacity: submitting ? 0.6 : 1,
                  }}
                >
                  Delete
                </button>
              )}
              <button
                onClick={onToggleResolve}
                disabled={submitting}
                style={{
                  padding: '8px 12px',
                  background: 'var(--card)',
                  border: '1px solid var(--border)',
                  color: 'var(--text2)',
                  borderRadius: 'var(--r-sm)',
                  fontSize: 'var(--t-sm)',
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  opacity: submitting ? 0.6 : 1,
                }}
              >
                {state.mode === 'edit' && state.note.resolved ? '↺ Unresolve' : '✓ Resolve'}
              </button>
            </>
          )}
          <div className="flex-1" />
          <button
            onClick={close}
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
            {submitting ? 'Saving…' : isEdit ? 'Update' : 'Save Note'}
          </button>
        </div>
      </div>
    </div>
  );
}

function LabeledInput({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <div style={{ fontSize: 'var(--t-tiny)', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>
        {label}
      </div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%',
          padding: '7px 10px',
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
  );
}
