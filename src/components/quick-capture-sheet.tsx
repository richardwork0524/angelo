'use client';

import { useState, useEffect, useRef } from 'react';
import { Toast } from './toast';

interface LeafProject {
  child_key: string;
  display_name: string;
}

interface QuickCaptureSheetProps {
  open: boolean;
  onClose: () => void;
  projects: LeafProject[];
  onSubmitted: () => void;
}

const BUCKETS = [
  { value: 'THIS_WEEK', label: 'Week' },
  { value: 'THIS_MONTH', label: 'Month' },
  { value: 'PARKED', label: 'Parked' },
] as const;

const PRIORITIES = [
  { value: 'P0', label: 'P0', color: 'var(--red)' },
  { value: 'P1', label: 'P1', color: 'var(--orange)' },
  { value: 'P2', label: 'P2', color: 'var(--yellow)' },
] as const;

export function QuickCaptureSheet({ open, onClose, projects, onSubmitted }: QuickCaptureSheetProps) {
  const [text, setText] = useState('');
  const [bucket, setBucket] = useState<string>('THIS_WEEK');
  const [projectKey, setProjectKey] = useState<string>(projects[0]?.child_key || '');
  const [priority, setPriority] = useState<string | null>(null);
  const [isOwnerAction, setIsOwnerAction] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  // Animate in/out
  useEffect(() => {
    if (open) {
      // Small delay to trigger CSS transition
      requestAnimationFrame(() => setVisible(true));
      inputRef.current?.focus();
    } else {
      setVisible(false);
    }
  }, [open]);

  // Reset form when opened
  useEffect(() => {
    if (open) {
      setText('');
      setBucket('THIS_WEEK');
      setPriority(null);
      setIsOwnerAction(false);
      if (projects.length > 0 && !projectKey) {
        setProjectKey(projects[0].child_key);
      }
    }
  }, [open, projects, projectKey]);

  async function handleSubmit() {
    if (!text.trim() || !projectKey) return;
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        text: text.trim(),
        bucket,
      };
      if (priority) body.priority = priority;
      if (isOwnerAction) body.is_owner_action = true;

      const res = await fetch(`/api/projects/${projectKey}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error('Failed');

      onSubmitted();
      onClose();
      setToast('Task added');
    } catch {
      setToast('Failed to add task. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!open && !visible) return toast ? <Toast message={toast} type="success" onDismiss={() => setToast(null)} /> : null;

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-50 transition-opacity duration-300 ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}
        style={{ backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        className={`fixed bottom-0 left-0 right-0 z-50 bg-[var(--surface)] rounded-t-2xl transition-transform duration-300 ease-out ${
          visible ? 'translate-y-0' : 'translate-y-full'
        }`}
        style={{ maxHeight: '90dvh', paddingBottom: 'var(--safe-b, 0px)' }}
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 rounded-full bg-[var(--border2)]" />
        </div>

        <div className="px-4 pb-4 space-y-4">
          {/* Text input */}
          <input
            ref={inputRef}
            type="text"
            placeholder="What needs to be done?"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && text.trim()) handleSubmit(); }}
            className="w-full px-3 py-3 rounded-[var(--r-sm)] bg-[var(--card)] border border-[var(--border)] text-[var(--text)] text-[15px] placeholder:text-[var(--text3)] focus:outline-none focus:border-[var(--accent)] min-h-[44px]"
          />

          {/* Bucket selector */}
          <div>
            <label className="text-[11px] font-semibold text-[var(--text3)] uppercase tracking-[0.07em] mb-1.5 block">Bucket</label>
            <div className="flex gap-2">
              {BUCKETS.map((b) => (
                <button
                  key={b.value}
                  onClick={() => setBucket(b.value)}
                  className={`flex-1 py-2 rounded-full text-[13px] font-medium transition-colors min-h-[44px] ${
                    bucket === b.value
                      ? 'bg-[var(--accent)] text-white'
                      : 'bg-[var(--card)] text-[var(--text2)] border border-[var(--border)]'
                  }`}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>

          {/* Project selector */}
          <div>
            <label className="text-[11px] font-semibold text-[var(--text3)] uppercase tracking-[0.07em] mb-1.5 block">Project</label>
            <select
              value={projectKey}
              onChange={(e) => setProjectKey(e.target.value)}
              className="w-full px-3 py-2.5 rounded-[var(--r-sm)] bg-[var(--card)] border border-[var(--border)] text-[var(--text)] text-[14px] focus:outline-none focus:border-[var(--accent)] min-h-[44px] appearance-none"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%23888' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 12px center',
              }}
            >
              {projects.map((p) => (
                <option key={p.child_key} value={p.child_key}>
                  {p.display_name}
                </option>
              ))}
            </select>
          </div>

          {/* Priority pills */}
          <div>
            <label className="text-[11px] font-semibold text-[var(--text3)] uppercase tracking-[0.07em] mb-1.5 block">Priority</label>
            <div className="flex gap-2">
              {PRIORITIES.map((p) => (
                <button
                  key={p.value}
                  onClick={() => setPriority(priority === p.value ? null : p.value)}
                  className={`px-4 py-2 rounded-full text-[13px] font-medium transition-colors min-h-[44px] ${
                    priority === p.value
                      ? 'text-white'
                      : 'bg-[var(--card)] text-[var(--text2)] border border-[var(--border)]'
                  }`}
                  style={priority === p.value ? { backgroundColor: p.color } : undefined}
                >
                  {p.label}
                </button>
              ))}
              <button
                onClick={() => setPriority(null)}
                className={`px-4 py-2 rounded-full text-[13px] font-medium transition-colors min-h-[44px] ${
                  priority === null
                    ? 'bg-[var(--accent-dim)] text-[var(--accent)]'
                    : 'bg-[var(--card)] text-[var(--text2)] border border-[var(--border)]'
                }`}
              >
                None
              </button>
            </div>
          </div>

          {/* Owner action toggle */}
          <button
            onClick={() => setIsOwnerAction(!isOwnerAction)}
            className={`flex items-center gap-2 px-3 py-2.5 rounded-[var(--r-sm)] text-[13px] font-medium transition-colors min-h-[44px] ${
              isOwnerAction
                ? 'bg-[var(--accent-dim)] text-[var(--accent)]'
                : 'bg-[var(--card)] text-[var(--text2)] border border-[var(--border)]'
            }`}
          >
            <span>&#9889;</span>
            Owner Action
          </button>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={!text.trim() || !projectKey || submitting}
            className="w-full py-3 rounded-[var(--r-sm)] bg-[var(--accent)] text-white text-[15px] font-semibold min-h-[44px] hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? 'Adding...' : 'Add Task'}
          </button>
        </div>
      </div>

      {toast && <Toast message={toast} type="success" onDismiss={() => setToast(null)} />}
    </>
  );
}
