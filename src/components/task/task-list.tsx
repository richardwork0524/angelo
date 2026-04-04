'use client';

import { useState, useMemo } from 'react';
import { TaskSection } from './task-section';
import type { TaskItem } from './task-row';

interface TaskListProps {
  tasks: TaskItem[];
  showProject?: boolean;
  onTaskTap: (task: TaskItem) => void;
  onToggleComplete?: (taskId: string) => void;
}

export function TaskList({ tasks, showProject = true, onTaskTap, onToggleComplete }: TaskListProps) {
  const [showCompleted, setShowCompleted] = useState(false);

  // Build subtask map and separate root tasks
  const { rootTasks, subtaskMap, completedTasks } = useMemo(() => {
    const sMap = new Map<string, TaskItem[]>();
    const roots: TaskItem[] = [];
    const completed: TaskItem[] = [];

    for (const t of tasks) {
      if (t.parent_task_id) {
        if (!sMap.has(t.parent_task_id)) sMap.set(t.parent_task_id, []);
        sMap.get(t.parent_task_id)!.push(t);
      } else if (t.completed) {
        completed.push(t);
      } else {
        roots.push(t);
      }
    }

    return { rootTasks: roots, subtaskMap: sMap, completedTasks: completed };
  }, [tasks]);

  // Group by bucket
  const byBucket = useMemo(() => ({
    THIS_WEEK: rootTasks.filter((t) => t.bucket === 'THIS_WEEK'),
    THIS_MONTH: rootTasks.filter((t) => t.bucket === 'THIS_MONTH'),
    PARKED: rootTasks.filter((t) => t.bucket === 'PARKED'),
  }), [rootTasks]);

  if (rootTasks.length === 0 && completedTasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="w-12 h-12 rounded-full bg-[var(--card)] flex items-center justify-center mb-3">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" strokeWidth="1.5">
            <path d="M9 11l3 3L22 4" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <p className="text-[14px] text-[var(--text3)]">No tasks</p>
      </div>
    );
  }

  return (
    <div>
      <TaskSection
        title="This Week"
        color="var(--accent)"
        tasks={byBucket.THIS_WEEK}
        subtaskMap={subtaskMap}
        showProject={showProject}
        onTaskTap={onTaskTap}
        onToggleComplete={onToggleComplete}
      />
      <TaskSection
        title="This Month"
        color="var(--purple)"
        tasks={byBucket.THIS_MONTH}
        subtaskMap={subtaskMap}
        showProject={showProject}
        onTaskTap={onTaskTap}
        onToggleComplete={onToggleComplete}
      />
      <TaskSection
        title="Parked"
        color="var(--text3)"
        tasks={byBucket.PARKED}
        subtaskMap={subtaskMap}
        showProject={showProject}
        onTaskTap={onTaskTap}
        onToggleComplete={onToggleComplete}
      />

      {/* Completed section (collapsed by default) */}
      {completedTasks.length > 0 && (
        <div className="mt-2">
          <button
            onClick={() => setShowCompleted(!showCompleted)}
            className="flex items-center gap-2 text-[11px] font-bold text-[var(--text3)] uppercase tracking-[0.08em] px-1 py-2 min-h-[44px]"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className={`transition-transform ${showCompleted ? 'rotate-90' : ''}`}>
              <path d="M3 1L7 5L3 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <span style={{ color: 'var(--green)' }}>✓</span>
            Completed ({completedTasks.length})
          </button>
          {showCompleted && (
            <div className="space-y-1">
              {completedTasks.map((task) => (
                <TaskSection
                  key={task.id}
                  title=""
                  color="var(--green)"
                  tasks={[task]}
                  subtaskMap={subtaskMap}
                  showProject={showProject}
                  onTaskTap={onTaskTap}
                  onToggleComplete={onToggleComplete}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
