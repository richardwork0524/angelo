'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { cachedFetch, invalidateCache } from '@/lib/cache';
import { bgMutate } from '@/lib/mutate';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { TaskList } from '@/components/task/task-list';
import { HeroCard, TierLabel } from '@/components/hero-card';
import { TaskKanban } from '@/components/task/task-kanban';
import type { TaskItem } from '@/components/task/task-row';
import type { DetailTask } from '@/components/task/task-detail';
import { ShortcutPill } from '@/components/shortcut-pill';
import { useCommandPalette } from '@/hooks/use-command-palette';

const TaskDetail = dynamic(
  () => import('@/components/task/task-detail').then((m) => ({ default: m.TaskDetail })),
  { ssr: false }
);

interface ProjectOption {
  child_key: string;
  display_name: string;
  entity_type: string | null;
}

interface TasksApiTask {
  id: string;
  project_key: string;
  text: string;
  description: string | null;
  bucket: string;
  priority: string | null;
  surface: string | null;
  is_owner_action: boolean | null;
  mission: string | null;
  version: string | null;
  task_code: string | null;
  progress: string | null;
  parent_task_id: string | null;
  completed: boolean;
  log: { timestamp: string; type: string; message: string }[] | null;
  sort_order: number | null;
  updated_at: string;
  created_at: string;
}

interface TasksApiResponse {
  tasks: TasksApiTask[];
  projects: ProjectOption[];
  missions: { all: string[]; by_project: Record<string, string[]> };
  stats: {
    total: number;
    open: number;
    completed: number;
    p0: number;
    p1: number;
    p2: number;
    this_week: number;
    this_month: number;
    parked: number;
  };
}

const BUCKET_OPTS = [
  { value: '', label: 'All weeks' },
  { value: 'THIS_WEEK', label: 'Week' },
  { value: 'THIS_MONTH', label: 'Month' },
  { value: 'PARKED', label: 'Parked' },
];
const PRIORITY_OPTS = [
  { value: '', label: 'All priorities' },
  { value: 'P0', label: 'P0' },
  { value: 'P1', label: 'P1' },
  { value: 'P2', label: 'P2' },
];

function toTaskItem(t: TasksApiTask): TaskItem {
  return {
    id: t.id,
    text: t.text,
    project_key: t.project_key,
    bucket: t.bucket,
    priority: t.priority,
    surface: t.surface,
    is_owner_action: !!t.is_owner_action,
    mission: t.mission,
    version: t.version,
    progress: t.progress,
    parent_task_id: t.parent_task_id,
    completed: t.completed,
    updated_at: t.updated_at,
    task_code: t.task_code,
  };
}

function toDetailTask(t: TasksApiTask): DetailTask {
  return {
    id: t.id,
    text: t.text,
    description: t.description,
    project_key: t.project_key,
    bucket: t.bucket,
    priority: t.priority,
    surface: t.surface,
    is_owner_action: !!t.is_owner_action,
    mission: t.mission,
    version: t.version,
    task_code: t.task_code,
    progress: t.progress,
    log: t.log,
    updated_at: t.updated_at,
    completed: t.completed,
  };
}

export default function TasksPage() {
  return (
    <Suspense fallback={<TasksPageFallback />}>
      <TasksPageInner />
    </Suspense>
  );
}

function TasksPageFallback() {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="w-6 h-6 rounded-full border-2 border-[var(--primary)] border-t-transparent animate-spin" />
    </div>
  );
}

function TasksPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isDesktop = useBreakpoint(768);
  const { openPalette } = useCommandPalette();

  // Pre-fill project from URL (context-aware from /entity/[key])
  const initialProject = searchParams.get('project') || '';

  const [project, setProject] = useState<string>(initialProject);
  const [bucket, setBucket] = useState<string>('');
  const [priority, setPriority] = useState<string>('');
  const [mission, setMission] = useState<string>('');
  const [showCompleted, setShowCompleted] = useState(false);
  const [search, setSearch] = useState('');
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [filterType, setFilterType] = useState<string>('');

  const [data, setData] = useState<TasksApiResponse | null>(null);

  // Derived: distinct entity types for hierarchical filter
  const entityTypes = useMemo(() => {
    if (!data) return [];
    const types = new Set(data.projects.map((p) => p.entity_type).filter(Boolean) as string[]);
    return Array.from(types).sort();
  }, [data]);

  // Derived: projects filtered by selected type
  const filteredProjects = useMemo(() => {
    if (!data) return [];
    if (!filterType) return data.projects;
    return data.projects.filter((p) => p.entity_type === filterType);
  }, [data, filterType]);
  const [loading, setLoading] = useState(true);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Build API URL from filters
  const apiUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (project) params.set('project', project);
    if (bucket) params.set('bucket', bucket);
    if (priority) params.set('priority', priority);
    if (mission) params.set('mission', mission);
    params.set('completed', showCompleted ? 'all' : 'false');
    if (search.trim()) params.set('search', search.trim());
    return `/api/tasks?${params.toString()}`;
  }, [project, bucket, priority, mission, showCompleted, search]);

  const fetchTasks = useCallback(async (force = false) => {
    setLoading(true);
    try {
      if (force) invalidateCache('/api/tasks');
      const d = await cachedFetch<TasksApiResponse>(apiUrl, 5000);
      setData(d);
    } catch {
      setData(null);
    }
    setLoading(false);
  }, [apiUrl]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  // Sync URL with project filter (so deep-linking works and /entity/X → /tasks?project=X persists)
  useEffect(() => {
    const current = searchParams.get('project') || '';
    if (current === project) return;
    const params = new URLSearchParams(searchParams.toString());
    if (project) params.set('project', project);
    else params.delete('project');
    router.replace(`/tasks${params.toString() ? `?${params.toString()}` : ''}`, { scroll: false });
  }, [project, router, searchParams]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  };

  const tasksAsItems = useMemo<TaskItem[]>(
    () => (data?.tasks || []).map(toTaskItem),
    [data]
  );

  const selectedTask = useMemo<DetailTask | null>(() => {
    if (!selectedTaskId || !data) return null;
    const raw = data.tasks.find((t) => t.id === selectedTaskId);
    return raw ? toDetailTask(raw) : null;
  }, [selectedTaskId, data]);

  const selectedSubtasks = useMemo<DetailTask[]>(() => {
    if (!selectedTaskId || !data) return [];
    return data.tasks.filter((t) => t.parent_task_id === selectedTaskId).map(toDetailTask);
  }, [selectedTaskId, data]);

  // Mission options for autocomplete (per selected project, or all)
  const missionOptions = useMemo(() => {
    if (!data) return [];
    return project ? (data.missions.by_project[project] || []) : data.missions.all;
  }, [data, project]);

  // ── Mutations ──
  const optimisticUpdate = (taskId: string, fields: Partial<TasksApiTask>) => {
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        tasks: prev.tasks.map((t) => (t.id === taskId ? { ...t, ...fields } : t)),
      };
    });
  };

  const optimisticRemove = (taskId: string) => {
    setData((prev) => {
      if (!prev) return prev;
      // Remove the task AND any of its subtasks from the list
      const removed = new Set<string>();
      removed.add(taskId);
      prev.tasks.forEach((t) => { if (t.parent_task_id === taskId) removed.add(t.id); });
      const remaining = prev.tasks.filter((t) => !removed.has(t.id));
      // Recompute stats so the header count reflects the removal immediately
      const openTasks = remaining.filter((t) => !t.completed);
      const stats = {
        ...prev.stats,
        total: remaining.length,
        open: openTasks.length,
        completed: remaining.length - openTasks.length,
        p0: openTasks.filter((t) => t.priority === 'P0').length,
        p1: openTasks.filter((t) => t.priority === 'P1').length,
        p2: openTasks.filter((t) => t.priority === 'P2').length,
        this_week: openTasks.filter((t) => t.bucket === 'THIS_WEEK').length,
        this_month: openTasks.filter((t) => t.bucket === 'THIS_MONTH').length,
        parked: openTasks.filter((t) => t.bucket === 'PARKED').length,
      };
      return { ...prev, tasks: remaining, stats };
    });
  };

  const syncOpts = (msg: string) => ({
    onSuccess: () => {
      showToast(msg);
      invalidateCache('/api/tasks');
      invalidateCache('/api/home');
      fetchTasks(true);
    },
    onError: () => {
      showToast('Sync failed — retrying');
      fetchTasks(true);
    },
  });

  function handleToggle(taskId: string) {
    const task = data?.tasks.find((t) => t.id === taskId);
    if (!task) return;
    const newCompleted = !task.completed;
    if (!showCompleted && newCompleted) {
      optimisticRemove(taskId);
    } else {
      optimisticUpdate(taskId, { completed: newCompleted });
    }
    bgMutate({
      request: () =>
        fetch(`/api/tasks/${taskId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newCompleted ? 'completed' : 'open' }),
        }),
      ...syncOpts(newCompleted ? 'Task completed' : 'Task reopened'),
    });
  }

  function handleUpdate(taskId: string, fields: Record<string, unknown>) {
    optimisticUpdate(taskId, fields as Partial<TasksApiTask>);
    bgMutate({
      request: () =>
        fetch(`/api/tasks/${taskId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(fields),
        }),
      ...syncOpts('Saved'),
    });
  }

  function handleDelete(taskId: string) {
    optimisticRemove(taskId);
    setSelectedTaskId(null);
    bgMutate({
      request: () => fetch(`/api/tasks/${taskId}`, { method: 'DELETE' }),
      onSuccess: () => {
        showToast('Task deleted');
        invalidateCache('/api/tasks');
        invalidateCache('/api/home');
        // Refetch to flush stale IndexedDB cache — without this, a page refresh
        // serves the old IDB entry (which still contains the deleted task) before
        // the background revalidation completes, making the task "reappear".
        fetchTasks(true);
      },
      onError: () => {
        showToast('Delete failed — restoring');
        fetchTasks(true);
      },
    });
  }

  function handleBucketChange(taskId: string, newBucket: string) {
    optimisticUpdate(taskId, { bucket: newBucket, completed: false });
    bgMutate({
      request: () =>
        fetch(`/api/tasks/${taskId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bucket: newBucket }),
        }),
      ...syncOpts('Moved'),
    });
  }

  function handleReorder(taskId: string, newSortOrder: number) {
    optimisticUpdate(taskId, { sort_order: newSortOrder });
    bgMutate({
      request: () =>
        fetch(`/api/tasks/${taskId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sort_order: newSortOrder }),
        }),
      ...syncOpts('Reordered'),
    });
  }

  function handleCompleteFromKanban(taskId: string, completed: boolean) {
    if (!showCompleted && completed) {
      optimisticRemove(taskId);
    } else {
      optimisticUpdate(taskId, { completed });
    }
    bgMutate({
      request: () =>
        fetch(`/api/tasks/${taskId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: completed ? 'completed' : 'open' }),
        }),
      ...syncOpts(completed ? 'Task completed' : 'Task reopened'),
    });
  }

  async function handleAddSubtask(parentId: string, text: string) {
    const parent = data?.tasks.find((t) => t.id === parentId);
    if (!parent) return;
    bgMutate({
      request: () =>
        fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            project_key: parent.project_key,
            text,
            bucket: parent.bucket || 'THIS_WEEK',
            parent_task_id: parentId,
          }),
        }),
      ...syncOpts('Subtask added'),
    });
  }

  function clearFilters() {
    setProject('');
    setFilterType('');
    setBucket('');
    setPriority('');
    setMission('');
    setSearch('');
    setShowCompleted(false);
  }

  const activeFilterCount =
    (filterType ? 1 : 0) +
    (project ? 1 : 0) +
    (bucket ? 1 : 0) +
    (priority ? 1 : 0) +
    (mission ? 1 : 0) +
    (search.trim() ? 1 : 0) +
    (showCompleted ? 1 : 0);

  // Hero: top open task — P0+now first, then P0, then P1, then any open
  const heroTask = !showCompleted
    ? (tasksAsItems.find((t) => !t.completed && t.priority === 'P0' && t.bucket === 'THIS_WEEK') ||
       tasksAsItems.find((t) => !t.completed && t.priority === 'P0') ||
       tasksAsItems.find((t) => !t.completed && t.priority === 'P1') ||
       tasksAsItems.find((t) => !t.completed) ||
       null)
    : null;

  // Priority hex for hero card accent
  const TASK_PRI_HEX: Record<string, string> = { P0: '#EF4444', P1: '#F59E0B', P2: '#6366F1' };
  const heroAccent = TASK_PRI_HEX[heroTask?.priority || 'P2'] ?? '#6366F1';

  return (
    <div className="h-full overflow-y-auto" data-testid="tasks-page" style={{ overscrollBehaviorY: 'contain', overflowX: 'hidden' }}>
      <div
        className="mx-auto"
        style={{
          maxWidth: 1280,
          padding: isDesktop ? '28px 32px' : '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h1 className="font-semibold tracking-tight" style={{ fontSize: 'var(--t-h2)' }}>
            Tasks
            <span className="ml-2 font-normal" style={{ color: 'var(--text3)', fontSize: 'var(--t-body)' }}>
              {data ? `${data.stats.open} open` : '—'}
              {data && data.stats.open > 0 && (
                <>
                  {' · '}
                  {data.stats.this_week}w / {data.stats.this_month}m / {data.stats.parked}p
                </>
              )}
            </span>
          </h1>
          {!isDesktop && (
            <button
              onClick={() => setShowMobileFilters((v) => !v)}
              style={{
                padding: '6px 12px',
                fontSize: 'var(--t-sm)',
                background: activeFilterCount > 0 ? 'var(--primary-dim)' : 'var(--card)',
                color: activeFilterCount > 0 ? 'var(--primary-2)' : 'var(--text2)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--r-sm)',
                cursor: 'pointer',
              }}
            >
              Filters {activeFilterCount > 0 && `(${activeFilterCount})`}
            </button>
          )}
        </div>

        {/* Filter bar (desktop: always visible; mobile: togglable) */}
        {(isDesktop || showMobileFilters) && (
          <div
            style={{
              padding: '10px 12px',
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--r)',
              display: 'flex',
              flexDirection: isDesktop ? 'row' : 'column',
              flexWrap: isDesktop ? 'wrap' : 'nowrap',
              gap: 8,
              alignItems: isDesktop ? 'center' : 'stretch',
            }}
          >
            <select
              value={filterType}
              onChange={(e) => { setFilterType(e.target.value); setProject(''); }}
              style={selectStyle}
              aria-label="Type filter"
            >
              <option value="">All types</option>
              {entityTypes.map((t) => (
                <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
              ))}
            </select>
            <select
              value={project}
              onChange={(e) => setProject(e.target.value)}
              style={selectStyle}
              aria-label="Project filter"
            >
              <option value="">All {filterType || 'projects'}</option>
              {filteredProjects.map((p) => (
                <option key={p.child_key} value={p.child_key}>
                  {p.display_name}
                </option>
              ))}
            </select>
            <select
              value={bucket}
              onChange={(e) => setBucket(e.target.value)}
              style={selectStyle}
              aria-label="Bucket filter"
            >
              {BUCKET_OPTS.map((b) => (
                <option key={b.value} value={b.value}>
                  {b.label}
                </option>
              ))}
            </select>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              style={selectStyle}
              aria-label="Priority filter"
            >
              {PRIORITY_OPTS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
            <input
              list="mission-options"
              value={mission}
              onChange={(e) => setMission(e.target.value)}
              placeholder="Mission…"
              style={{ ...selectStyle, minWidth: 140 }}
              aria-label="Mission filter"
            />
            <datalist id="mission-options">
              {missionOptions.map((m) => <option key={m} value={m} />)}
            </datalist>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search text, mission, code…"
              style={{ ...selectStyle, flex: 1, minWidth: 160 }}
              aria-label="Search"
            />
            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 'var(--t-sm)',
                color: 'var(--text2)',
                cursor: 'pointer',
                userSelect: 'none',
              }}
            >
              <input
                type="checkbox"
                checked={showCompleted}
                onChange={(e) => setShowCompleted(e.target.checked)}
              />
              Show completed
            </label>
            {activeFilterCount > 0 && (
              <button
                onClick={clearFilters}
                style={{
                  fontSize: 'var(--t-sm)',
                  color: 'var(--text3)',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '6px 8px',
                  textDecoration: 'underline',
                }}
              >
                Clear
              </button>
            )}
            {/* ⌘K palette shortcut pill — desktop only */}
            <div className="flex-1 hidden md:flex justify-end">
              <ShortcutPill label="⌘K command palette" onClick={openPalette} />
            </div>
          </div>
        )}

        {/* Task list / Kanban */}
        {loading && !data ? (
          <div className="flex items-center justify-center" style={{ height: 180 }}>
            <div className="w-6 h-6 rounded-full border-2 border-[var(--primary)] border-t-transparent animate-spin" />
          </div>
        ) : !data || tasksAsItems.filter((t) => !t.parent_task_id).length === 0 ? (
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
            {activeFilterCount > 0 ? 'No tasks match these filters' : 'No open tasks'}
          </div>
        ) : isDesktop ? (
          /* Desktop: Kanban */
          <div style={{ height: 'calc(100vh - 280px)', minHeight: 400 }}>
            <TaskKanban
              tasks={tasksAsItems}
              showProject={!project}
              onTaskTap={(t) => setSelectedTaskId(t.id)}
              onBucketChange={handleBucketChange}
              onComplete={handleCompleteFromKanban}
              onReorder={handleReorder}
            />
          </div>
        ) : (
          /* Mobile: list */
          <div>
            <TaskList
              tasks={tasksAsItems}
              showProject={!project}
              onTaskTap={(t) => setSelectedTaskId(t.id)}
              onToggleComplete={(id) => handleToggle(id)}
            />
          </div>
        )}
      </div>

      {/* Task detail panel / modal */}
      {selectedTask && (
        <TaskDetail
          task={selectedTask}
          subtasks={selectedSubtasks}
          onClose={() => setSelectedTaskId(null)}
          onUpdate={(id, fields) => { handleUpdate(id, fields); }}
          onDelete={(id) => { handleDelete(id); }}
          onAddSubtask={(parentId, text) => { handleAddSubtask(parentId, text); }}
        />
      )}

      {/* Toast */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r)',
            padding: '8px 16px',
            fontSize: 'var(--t-sm)',
            color: 'var(--text)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            zIndex: 1000,
          }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  padding: '6px 10px',
  fontSize: 'var(--t-sm)',
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--r-sm)',
  color: 'var(--text)',
  outline: 'none',
  height: 32,
};
