'use client';

import { useEffect, useState, useCallback, useMemo, } from 'react';
import dynamic from 'next/dynamic';
import { StickyHeader } from '@/components/sticky-header';
import { useToast } from '@/components/toast';
import { type DetailTask } from '@/components/task/task-detail';

const TaskDetail = dynamic(() => import('@/components/task/task-detail').then((m) => ({ default: m.TaskDetail })), { ssr: false });

interface Task {
  id: string;
  text: string;
  project_key: string;
  bucket: string;
  priority: string | null;
  surface: string | null;
  is_owner_action: boolean;
  mission: string | null;
  version: string | null;
  updated_at: string;
  progress: string | null;
  log: { timestamp: string; type: string; message: string }[] | null;
  parent_task_id: string | null;
  completed: boolean;
  task_code: string | null;
}

const PRIORITY_COLORS: Record<string, string> = { P0: 'var(--red)', P1: 'var(--orange)', P2: 'var(--yellow)' };
const SURFACE_COLORS: Record<string, string> = { CODE: 'var(--accent)', CHAT: 'var(--green)', COWORK: 'var(--purple)' };

const FILTER_TABS = [
  { key: 'ALL', label: 'All' },
  { key: 'P0', label: 'Critical', color: 'var(--red)' },
  { key: 'P1', label: 'High', color: 'var(--orange)' },
  { key: 'P2', label: 'Normal', color: 'var(--yellow)' },
];

export default function TasksPage() {
  const [data, setData] = useState<{ tasks_by_priority: Record<string, Task[]> } | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');
  const [detailTask, setDetailTask] = useState<{ task: DetailTask; subtasks: DetailTask[] } | null>(null);
  const { showToast, ToastContainer } = useToast();

  const fetchTasks = useCallback(async () => {
    try {
      // Fetch all roots in parallel to get all tasks across entire portfolio
      const roots = ['general', 'group-strategy', 'company', 'development'];
      const results = await Promise.all(
        roots.map((r) => fetch(`/api/dashboard?parent=${r}`).then((res) => res.json()))
      );
      // Merge tasks from all roots
      const allTasks: Task[] = [];
      const seen = new Set<string>();
      for (const d of results) {
        for (const t of d.tasks_by_priority?.ALL || []) {
          if (!seen.has(t.id)) { seen.add(t.id); allTasks.push(t); }
        }
      }
      setData({
        tasks_by_priority: {
          ALL: allTasks,
          P0: allTasks.filter((t) => t.priority === 'P0'),
          P1: allTasks.filter((t) => t.priority === 'P1'),
          P2: allTasks.filter((t) => t.priority === 'P2'),
        },
      });
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const filteredTasks = useMemo(() => {
    if (!data) return [];
    const pool = filter === 'ALL'
      ? data.tasks_by_priority.ALL
      : (data.tasks_by_priority[filter] || []);
    return pool.filter((t) => !t.parent_task_id && !t.completed);
  }, [data, filter]);

  const subtaskMap = useMemo(() => {
    const map = new Map<string, Task[]>();
    if (!data) return map;
    for (const t of data.tasks_by_priority.ALL) {
      if (t.parent_task_id) {
        if (!map.has(t.parent_task_id)) map.set(t.parent_task_id, []);
        map.get(t.parent_task_id)!.push(t);
      }
    }
    return map;
  }, [data]);

  // Keep detailTask subtasks synced when data refreshes
  useEffect(() => {
    if (!detailTask || !data) return;
    const freshSubs = subtaskMap.get(detailTask.task.id) || [];
    if (freshSubs.length !== detailTask.subtasks.length) {
      setDetailTask((prev) => prev ? { ...prev, subtasks: freshSubs as unknown as DetailTask[] } : prev);
    }
  }, [data, subtaskMap, detailTask]);

  // Group by bucket
  const byBucket = useMemo(() => ({
    THIS_WEEK: filteredTasks.filter((t) => t.bucket === 'THIS_WEEK'),
    THIS_MONTH: filteredTasks.filter((t) => t.bucket === 'THIS_MONTH'),
    PARKED: filteredTasks.filter((t) => t.bucket === 'PARKED'),
  }), [filteredTasks]);

  function handleUpdate(taskId: string, fields: Record<string, unknown>) {
    const task = data?.tasks_by_priority.ALL.find((t) => t.id === taskId);
    if (!task) return;
    fetch(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields),
    }).then(() => { showToast('Updated'); fetchTasks(); });
  }

  function handleDelete(taskId: string) {
    setDetailTask(null);
    fetch(`/api/tasks/${taskId}`, { method: 'DELETE' }).then(() => { showToast('Deleted'); fetchTasks(); });
  }

  function renderBucket(title: string, color: string, tasks: Task[]) {
    if (tasks.length === 0) return null;
    return (
      <div className="mb-5">
        <div className="flex items-center gap-2 px-1 mb-2">
          <span className="w-[3px] h-[14px] rounded-full" style={{ backgroundColor: color }} />
          <span className="text-[11px] font-bold uppercase tracking-[0.08em]" style={{ color }}>{title}</span>
          <span className="text-[10px] text-[var(--text3)] tabular-nums">{tasks.length}</span>
        </div>
        <div className="space-y-1.5">
          {tasks.map((t) => {
            const subs = subtaskMap.get(t.id) || [];
            const progress = t.progress?.match(/^(\d+)\/(\d+)$/);
            return (
              <button
                key={t.id}
                onClick={() => setDetailTask({
                  task: t as unknown as DetailTask,
                  subtasks: subs as unknown as DetailTask[],
                })}
                className="w-full flex items-start gap-2.5 px-3 py-2.5 rounded-[10px] bg-[var(--card)] border border-[var(--border)] hover:border-[var(--border2)] transition-all text-left min-h-[48px] active:scale-[0.98]"
              >
                <span
                  className="w-[7px] h-[7px] rounded-full shrink-0 mt-[7px]"
                  style={{ backgroundColor: PRIORITY_COLORS[t.priority || ''] || 'var(--border2)' }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] leading-[1.4] text-[var(--text)]">
                    {t.task_code && <span className="text-[var(--accent)] font-mono text-[10px] mr-1">{t.task_code}</span>}
                    {t.text}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    <span className="text-[10px] text-[var(--text3)]">{t.project_key}</span>
                    {t.mission && <span className="text-[10px] text-[var(--purple)] truncate max-w-[120px]">{t.mission}</span>}
                    {t.surface && (
                      <span className="inline-flex items-center gap-0.5">
                        <span className="w-[4px] h-[4px] rounded-full" style={{ backgroundColor: SURFACE_COLORS[t.surface] }} />
                        <span className="text-[10px] text-[var(--text3)]">{t.surface}</span>
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                  {progress && <span className="text-[10px] font-bold text-[var(--accent)] tabular-nums">{t.progress}</span>}
                  {t.is_owner_action && <span className="text-[10px] font-bold text-[var(--cyan)]">YOU</span>}
                  {subs.length > 0 && <span className="text-[10px] text-[var(--text3)] tabular-nums">{subs.filter((s) => s.completed).length}/{subs.length}</span>}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <StickyHeader title="Tasks" />

      {/* Filter tabs */}
      <div className="flex items-center gap-1 px-4 py-2 overflow-x-auto">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-[12px] font-semibold transition-all shrink-0 ${
              filter === tab.key ? 'bg-[var(--accent)] text-white' : 'bg-[var(--card)] text-[var(--text3)]'
            }`}
          >
            {tab.color && filter !== tab.key && <span className="w-[6px] h-[6px] rounded-full" style={{ backgroundColor: tab.color }} />}
            {tab.label}
          </button>
        ))}
        <span className="text-[11px] text-[var(--text3)] tabular-nums ml-auto shrink-0">{filteredTasks.length} tasks</span>
      </div>

      {/* Task list by bucket */}
      <div className="px-4 py-2">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin" />
          </div>
        ) : (
          <>
            {renderBucket('This Week', 'var(--accent)', byBucket.THIS_WEEK)}
            {renderBucket('This Month', 'var(--purple)', byBucket.THIS_MONTH)}
            {renderBucket('Parked', 'var(--text3)', byBucket.PARKED)}
            {filteredTasks.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16">
                <p className="text-[14px] text-[var(--text3)]">No tasks</p>
              </div>
            )}
          </>
        )}
      </div>

      {detailTask && (
        <TaskDetail
          task={detailTask.task}
          subtasks={detailTask.subtasks}
          onClose={() => { setDetailTask(null); fetchTasks(); }}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
          onAddSubtask={async (parentId, text) => {
            const parent = data?.tasks_by_priority.ALL.find((t) => t.id === parentId);
            if (!parent) return;
            await fetch(`/api/projects/${parent.project_key}/tasks`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text, bucket: parent.bucket, parent_task_id: parentId }),
            });
            showToast('Subtask added');
            fetchTasks();
          }}
        />
      )}

      <ToastContainer />
    </div>
  );
}
