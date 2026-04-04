'use client';

import { TaskRow, type TaskItem } from './task-row';

interface TaskSectionProps {
  title: string;
  color: string;
  tasks: TaskItem[];
  subtaskMap: Map<string, TaskItem[]>;
  showProject?: boolean;
  onTaskTap: (task: TaskItem) => void;
  onToggleComplete?: (taskId: string) => void;
}

export function TaskSection({ title, color, tasks, subtaskMap, showProject = true, onTaskTap, onToggleComplete }: TaskSectionProps) {
  if (tasks.length === 0) return null;

  const completedCount = tasks.filter((t) => t.completed).length;

  return (
    <div className="mb-4">
      {/* Section header */}
      <div className="flex items-center justify-between px-1 mb-2">
        <div className="flex items-center gap-2">
          <span
            className="w-[3px] h-[14px] rounded-full"
            style={{ backgroundColor: color }}
          />
          <span className="text-[11px] font-bold uppercase tracking-[0.08em]" style={{ color }}>
            {title}
          </span>
        </div>
        <span className="text-[10px] text-[var(--text3)] tabular-nums">
          {completedCount}/{tasks.length}
        </span>
      </div>

      {/* Task rows */}
      <div className="space-y-1">
        {tasks.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            subtasks={subtaskMap.get(task.id)}
            showProject={showProject}
            onTap={onTaskTap}
            onToggleComplete={onToggleComplete}
          />
        ))}
      </div>
    </div>
  );
}
