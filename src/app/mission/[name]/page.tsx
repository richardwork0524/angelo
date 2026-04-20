'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { StatusBadge } from '@/components/status-badge';
import { PurposeChip, purposeFromEntry } from '@/components/handoff-card';
import { TaskDetail, type DetailTask } from '@/components/task/task-detail';
import { Toast } from '@/components/toast';

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

interface MissionHandoff {
  id: string;
  handoff_code: string | null;
  project_key: string;
  scope_type: string;
  scope_name: string;
  entry_point: string | null;
  version: string | null;
  sections_completed: number;
  sections_total: number;
  status: string;
  purpose: 'create' | 'debug' | 'update';
  is_mounted: boolean;
  updated_at: string;
}

interface MissionNote {
  id: string;
  project_key: string;
  text: string;
  note_type: string;
  mission: string | null;
  resolved: boolean;
  created_at: string;
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
  project_keys: string[];
  handoffs: MissionHandoff[];
  notes: MissionNote[];
}

const PRIO_STYLE: Record<string, { bg: string; fg: string }> = {
  P0: { bg: 'var(--danger-dim)', fg: 'var(--danger)' },
  P1: { bg: 'var(--warn-dim)', fg: 'var(--warn)' },
  P2: { bg: 'var(--info-dim)', fg: 'var(--info)' },
};

const SURFACE_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  CODE:   { bg: 'var(--primary-dim)', fg: 'var(--primary-2)', label: 'X' },
  CHAT:   { bg: 'var(--success-dim)', fg: 'var(--success)', label: 'C' },
  COWORK: { bg: 'var(--purple-dim)',  fg: 'var(--purple)',  label: 'W' },
  MOBILE: { bg: 'var(--warn-dim)',    fg: 'var(--warn)',    label: 'M' },
};

export default function MissionDetailPage() {
  const params = useParams();
  const router = useRouter();
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
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setMission(data);
    } catch {
      setError('Failed to load mission.');
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
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      });
      if (!res.ok) throw new Error('Failed');
      setToast('Updated');
      await fetchMission();
    } catch {
      setToast('Failed to update');
    }
  }

  async function handleTaskDelete(taskId: string) {
    try {
      const res = await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed');
      setToast('Task deleted');
      setSelectedTask(null);
      await fetchMission();
    } catch {
      setToast('Failed to delete');
    }
  }

  if (loading) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="max-w-[1280px] mx-auto px-4 md:px-8 py-5 md:py-7 flex items-center justify-center" style={{ height: 240 }}>
          <div className="w-6 h-6 rounded-full border-2 border-[var(--primary)] border-t-transparent animate-spin" />
        </div>
      </div>
    );
  }

  if (error || !mission) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="max-w-[1280px] mx-auto px-4 md:px-8 py-5 md:py-7" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Link href="/" style={{ color: 'var(--primary-2)', fontSize: 'var(--t-sm)' }}>← Home</Link>
          <div
            style={{
              textAlign: 'center',
              padding: '48px 24px',
              background: 'var(--card)',
              border: '1px dashed var(--border)',
              borderRadius: 'var(--r)',
              color: 'var(--text3)',
              fontSize: 'var(--t-sm)',
            }}
          >
            {error || 'Mission not found.'}
          </div>
        </div>
      </div>
    );
  }

  const totalTasks = mission.stats.open + mission.stats.completed;
  const primaryProject = mission.project_keys[0];

  return (
    <div className="h-full overflow-y-auto" data-testid="mission-detail-page">
      <div className="max-w-[1280px] mx-auto px-4 md:px-8 py-5 md:py-7" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, minWidth: 0 }}>
            <button
              onClick={() => router.back()}
              style={{
                width: 32, height: 32,
                borderRadius: 'var(--r-sm)',
                background: 'var(--card)',
                border: '1px solid var(--border)',
                color: 'var(--text2)',
                cursor: 'pointer',
                fontSize: 16,
                flexShrink: 0,
              }}
              title="Back"
            >
              ←
            </button>
            <div style={{ minWidth: 0 }}>
              <Breadcrumb project={primaryProject} mission={missionName} />
              <h1
                className="font-semibold tracking-tight"
                style={{ fontSize: 'var(--t-h1)', marginTop: 6, color: 'var(--text)' }}
              >
                {missionName}
              </h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '.05em',
                    padding: '2px 6px',
                    borderRadius: 3,
                    background: 'var(--primary-dim)',
                    color: 'var(--primary-2)',
                  }}
                >
                  mission
                </span>
                <span style={{ fontSize: 'var(--t-tiny)', color: 'var(--text3)' }}>
                  {mission.stats.completed} / {totalTasks} tasks done
                </span>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <GhostButton
              onClick={() =>
                window.dispatchEvent(new CustomEvent('quick-note', {
                  detail: {
                    project_key: primaryProject,
                    mission: missionName,
                    attach_hint: missionName,
                  },
                }))
              }
            >
              ＋ Note
            </GhostButton>
            <PrimaryButton
              onClick={() =>
                window.dispatchEvent(new CustomEvent('quick-task', {
                  detail: {
                    project_key: primaryProject,
                    mission: missionName,
                    attach_hint: missionName,
                  },
                }))
              }
            >
              ＋ Task
            </PrimaryButton>
          </div>
        </div>

        {/* Two-col layout */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)',
            gap: 16,
            alignItems: 'start',
          }}
        >
          {/* Main col */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Explainer card */}
            <SectionCard>
              <div style={{ fontSize: 'var(--t-sm)', color: 'var(--text2)', lineHeight: 1.6 }}>
                Tasks live here at the Mission level. Each task is either <strong style={{ color: 'var(--text)' }}>user-done</strong> (offline / manual) or <strong style={{ color: 'var(--text)' }}>Claude-done</strong> (executed via
                <SurfaceTag surface="CHAT" inline /> chat,
                <SurfaceTag surface="CODE" inline /> code,
                <SurfaceTag surface="COWORK" inline /> cowork, or
                <SurfaceTag surface="MOBILE" inline /> mobile).
              </div>
            </SectionCard>

            {/* Tasks */}
            <SectionCard>
              <SectionHead title="Tasks" count={`${mission.stats.completed}/${totalTasks}`} />
              {totalTasks === 0 ? (
                <EmptyRow label="No tasks yet" />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <BucketBlock title="This week" tasks={mission.tasks.this_week} color="var(--primary-2)" onClick={setSelectedTask} />
                  <BucketBlock title="This month" tasks={mission.tasks.this_month} color="var(--purple)" onClick={setSelectedTask} />
                  <BucketBlock title="Parked" tasks={mission.tasks.parked} color="var(--text3)" onClick={setSelectedTask} />

                  {mission.tasks.completed.length > 0 && (
                    <div>
                      <button
                        onClick={() => setShowCompleted(!showCompleted)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          fontSize: 'var(--t-tiny)',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '.07em',
                          color: 'var(--text3)',
                          background: 'transparent',
                          border: 'none',
                          padding: '4px 0',
                          cursor: 'pointer',
                        }}
                      >
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ transform: showCompleted ? 'rotate(90deg)' : 'none', transition: 'transform 120ms' }}>
                          <path d="M3 1L7 5L3 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                        <span style={{ color: 'var(--success)' }}>✓</span>
                        Completed ({mission.tasks.completed.length})
                      </button>
                      {showCompleted && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 6 }}>
                          {mission.tasks.completed.map((t) => (
                            <TaskRow key={t.id} task={t} onClick={() => setSelectedTask(t)} />
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </SectionCard>

            {/* Handoffs working on this mission */}
            {mission.handoffs.length > 0 && (
              <SectionCard>
                <SectionHead title="Handoffs working on this mission" count={mission.handoffs.length} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {mission.handoffs.map((h) => (
                    <Link
                      key={h.id}
                      href={`/handoff/${encodeURIComponent(h.id)}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 10,
                        padding: '10px 12px',
                        background: 'var(--bg)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--r-sm)',
                        textDecoration: 'none',
                        color: 'inherit',
                      }}
                    >
                      <span style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 'var(--t-sm)', color: 'var(--text)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {h.scope_name}
                        </div>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4 }}>
                          <PurposeChip purpose={h.purpose ?? purposeFromEntry(h.entry_point)} />
                          <StatusBadge status={h.status} />
                          <span style={{ fontSize: 'var(--t-tiny)', color: 'var(--text3)' }}>
                            {h.sections_completed}/{h.sections_total}
                          </span>
                        </div>
                      </span>
                    </Link>
                  ))}
                </div>
              </SectionCard>
            )}
          </div>

          {/* Rail col */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Stats */}
            <SectionCard>
              <SectionHead title="Stats" />
              <KvList>
                {primaryProject && (
                  <KvRow k="Entity" v={
                    <Link href={`/entity/${encodeURIComponent(primaryProject)}`} style={{ fontFamily: 'ui-monospace', fontSize: 11, color: 'var(--primary-2)', textDecoration: 'none' }}>
                      {primaryProject}
                    </Link>
                  } />
                )}
                <KvRow k="Open" v={String(mission.stats.open)} />
                <KvRow k="Completed" v={String(mission.stats.completed)} />
                <KvRow k="Total" v={String(totalTasks)} />
                <KvRow k="P0" v={String(mission.stats.p0)} accent={mission.stats.p0 > 0 ? 'danger' : undefined} />
                <KvRow k="P1" v={String(mission.stats.p1)} />
                <KvRow k="P2" v={String(mission.stats.p2)} />
                <KvRow k="Handoffs" v={String(mission.handoffs.length)} />
              </KvList>
            </SectionCard>

            {/* Notes */}
            <SectionCard>
              <SectionHead title="Notes on this mission" count={mission.notes.length} />
              {mission.notes.length === 0 ? (
                <EmptyRow label="No unresolved notes" />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {mission.notes.slice(0, 6).map((n) => (
                    <div
                      key={n.id}
                      style={{
                        padding: '8px 10px',
                        background: 'var(--bg)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--r-sm)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <span
                          style={{
                            fontSize: 9,
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '.05em',
                            padding: '1px 5px',
                            borderRadius: 3,
                            background: 'var(--primary-dim)',
                            color: 'var(--primary-2)',
                          }}
                        >
                          {n.note_type}
                        </span>
                      </div>
                      <div style={{ fontSize: 'var(--t-tiny)', color: 'var(--text2)', lineHeight: 1.5 }}>
                        {n.text}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          </div>
        </div>
      </div>

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

function Breadcrumb({ project, mission }: { project?: string; mission: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--t-tiny)', color: 'var(--text3)', flexWrap: 'wrap' }}>
      <Link href="/" style={{ color: 'var(--text3)', textDecoration: 'none' }}>Home</Link>
      {project && (
        <>
          <span style={{ color: 'var(--text4)' }}>›</span>
          <Link
            href={`/entity/${encodeURIComponent(project)}`}
            style={{ fontFamily: 'ui-monospace', color: 'var(--text3)', textDecoration: 'none' }}
          >
            {project}
          </Link>
        </>
      )}
      <span style={{ color: 'var(--text4)' }}>›</span>
      <span style={{ fontFamily: 'ui-monospace', color: 'var(--primary-2)', fontWeight: 600 }}>{mission}</span>
    </div>
  );
}

function BucketBlock({ title, tasks, color, onClick }: { title: string; tasks: MissionTask[]; color: string; onClick: (t: MissionTask) => void }) {
  if (tasks.length === 0) return null;
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span style={{ fontSize: 'var(--t-tiny)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color }}>
          {title}
        </span>
        <span style={{ fontSize: 'var(--t-tiny)', color: 'var(--text3)' }}>{tasks.length}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {tasks.map((t) => (
          <TaskRow key={t.id} task={t} onClick={() => onClick(t)} />
        ))}
      </div>
    </div>
  );
}

function TaskRow({ task, onClick }: { task: MissionTask; onClick: () => void }) {
  const prio = task.priority ? PRIO_STYLE[task.priority] : null;
  const surface = task.surface ? SURFACE_STYLE[task.surface] : null;
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
        padding: '8px 10px',
        background: 'transparent',
        border: '1px solid transparent',
        borderRadius: 'var(--r-sm)',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'all 120ms',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--card-alt)';
        e.currentTarget.style.borderColor = 'var(--border)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent';
        e.currentTarget.style.borderColor = 'transparent';
      }}
    >
      <span
        style={{
          width: 14, height: 14,
          marginTop: 2,
          borderRadius: 3,
          border: '1px solid var(--border)',
          background: task.completed ? 'var(--success)' : 'transparent',
          color: '#fff',
          fontSize: 9,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {task.completed ? '✓' : ''}
      </span>
      <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--t-sm)', color: task.completed ? 'var(--text3)' : 'var(--text)', textDecoration: task.completed ? 'line-through' : 'none', lineHeight: 1.45 }}>
        {task.text}
      </span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, marginTop: 1 }}>
        {task.task_code && (
          <span style={{ fontFamily: 'ui-monospace', fontSize: 10, color: 'var(--text4)' }}>{task.task_code}</span>
        )}
        {surface && (
          <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              padding: '1px 5px',
              borderRadius: 3,
              background: surface.bg,
              color: surface.fg,
              minWidth: 14,
              textAlign: 'center',
            }}
          >
            {surface.label}
          </span>
        )}
        {prio && (
          <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              padding: '1px 5px',
              borderRadius: 3,
              background: prio.bg,
              color: prio.fg,
            }}
          >
            {task.priority}
          </span>
        )}
        {task.is_owner_action && <span style={{ fontSize: 10 }}>⚡</span>}
      </span>
    </button>
  );
}

function SurfaceTag({ surface, inline }: { surface: string; inline?: boolean }) {
  const s = SURFACE_STYLE[surface];
  if (!s) return null;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginInline: inline ? 4 : 0,
        fontSize: 9,
        fontWeight: 700,
        padding: '1px 5px',
        borderRadius: 3,
        background: s.bg,
        color: s.fg,
      }}
    >
      {s.label}
    </span>
  );
}

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r-lg)',
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      {children}
    </div>
  );
}

function SectionHead({ title, count }: { title: string; count?: string | number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ fontSize: 'var(--t-sm)', fontWeight: 600, color: 'var(--text)' }}>{title}</div>
      {count !== undefined && (
        <span
          style={{
            fontSize: 'var(--t-tiny)',
            color: 'var(--text3)',
            fontVariantNumeric: 'tabular-nums',
            padding: '1px 6px',
            background: 'var(--card-alt)',
            borderRadius: 999,
          }}
        >
          {count}
        </span>
      )}
    </div>
  );
}

function EmptyRow({ label }: { label: string }) {
  return <div style={{ fontSize: 'var(--t-sm)', color: 'var(--text4)', padding: '4px 2px' }}>{label}</div>;
}

function KvList({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{children}</div>;
}

function KvRow({ k, v, accent }: { k: string; v: React.ReactNode; accent?: 'danger' }) {
  const color = accent === 'danger' ? 'var(--danger)' : 'var(--text)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, fontSize: 'var(--t-sm)' }}>
      <span style={{ color: 'var(--text3)' }}>{k}</span>
      <span style={{ color, fontVariantNumeric: 'tabular-nums', fontWeight: 500, textAlign: 'right' }}>{v}</span>
    </div>
  );
}

function GhostButton({ children, disabled, onClick }: { children: React.ReactNode; disabled?: boolean; onClick?: () => void }) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      style={{
        padding: '8px 12px',
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r-sm)',
        fontSize: 'var(--t-sm)',
        color: 'var(--text2)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  );
}

function PrimaryButton({ children, disabled, onClick }: { children: React.ReactNode; disabled?: boolean; onClick?: () => void }) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      style={{
        padding: '8px 12px',
        background: 'var(--primary)',
        border: '1px solid var(--primary)',
        borderRadius: 'var(--r-sm)',
        fontSize: 'var(--t-sm)',
        color: '#fff',
        fontWeight: 500,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.7 : 1,
      }}
    >
      {children}
    </button>
  );
}
