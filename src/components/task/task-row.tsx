'use client';

import { useState } from 'react';
import { PRIORITY_COLORS, SURFACE_COLORS } from '@/lib/constants';

/* ── Types ── */

export interface TaskItem {
  id: string;
  text: string;
  project_key: string;
  bucket: string;
  priority: string | null;
  surface: string | null;
  is_owner_action: boolean;
  mission: string | null;
  version: string | null;
  progress: string | null;
  parent_task_id: string | null;
  completed: boolean;
  updated_at: string;
  task_code: string | null;
}

interface TaskRowProps {
  task: TaskItem;
  subtasks?: TaskItem[];
  depth?: number;
  showProject?: boolean;
  onTap: (task: TaskItem) => void;
  onToggleComplete?: (taskId: string) => void;
}

/* ── Component ── */

export function TaskRow({ task, subtasks = [], depth = 0, showProject = true, onTap, onToggleComplete }: TaskRowProps) {
  const [expanded, setExpanded] = useState(true);
  const hasSubtasks = subtasks.length > 0;
  const completedSubs = subtasks.filter((s) => s.completed).length;
  const progress = task.progress?.match(/^(\d+)\/(\d+)$/);

  return (
    <div>
      <button
        onClick={() => onTap(task)}
        className="w-full flex items-start gap-2.5 px-3 py-2.5 rounded-[10px] bg-[var(--card)] border border-[var(--border)] hover:border-[var(--border2)] transition-all text-left min-h-[48px] active:scale-[0.98]"
        style={{ marginLeft: depth * 20 }}
      >
        {/* Expand chevron */}
        {hasSubtasks && (
          <button
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
            className="w-5 h-5 flex items-center justify-center shrink-0 mt-0.5"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className={`transition-transform ${expanded ? 'rotate-90' : ''}`}>
              <path d="M3 1L7 5L3 9" stroke="var(--text3)" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        )}

        {/* Checkbox */}
        <button
          onClick={(e) => { e.stopPropagation(); onToggleComplete?.(task.id); }}
          className={`w-5 h-5 rounded-full border-2 shrink-0 mt-0.5 flex items-center justify-center transition-all ${
            task.completed
              ? 'bg-[var(--green)] border-[var(--green)]'
              : 'border-[var(--border2)] hover:border-[var(--accent)]'
          }`}
        >
          {task.completed && (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M2 5L4 7L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>

        {/* Priority dot */}
        <span
          className="w-[7px] h-[7px] rounded-full shrink-0 mt-[7px]"
          style={{ backgroundColor: PRIORITY_COLORS[task.priority || ''] || 'var(--border2)' }}
        />

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className={`text-[13px] leading-[1.4] ${task.completed ? 'line-through text-[var(--text3)]' : 'text-[var(--text)]'}`}>
            {task.task_code && (
              <span className="text-[var(--accent)] font-mono text-[10px] mr-1">{task.task_code}</span>
            )}
            {task.text}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            {showProject && (
              <span className="text-[10px] text-[var(--text3)]">{task.project_key}</span>
            )}
            {task.mission && (
              <span className="text-[10px] text-[var(--purple)] truncate max-w-[120px]">{task.mission}</span>
            )}
            {task.surface && (
              <span className="inline-flex items-center gap-0.5">
                <span className="w-[4px] h-[4px] rounded-full" style={{ backgroundColor: SURFACE_COLORS[task.surface] }} />
                <span className="text-[10px] text-[var(--text3)]">{task.surface}</span>
              </span>
            )}
            {task.bucket !== 'THIS_WEEK' && (
              <span className="text-[10px] text-[var(--text3)] px-1 py-[0.5px] rounded bg-[var(--card2)]">
                {task.bucket === 'THIS_MONTH' ? 'Month' : task.bucket === 'PARKED' ? 'Parked' : task.bucket}
              </span>
            )}
          </div>
        </div>

        {/* Right badges */}
        <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
          {progress && (
            <span className="text-[10px] font-bold text-[var(--accent)] tabular-nums">{task.progress}</span>
          )}
          {task.is_owner_action && (
            <span className="text-[10px] font-bold text-[var(--cyan)]">YOU</span>
          )}
          {hasSubtasks && (
            <span className="text-[10px] text-[var(--text3)] tabular-nums">{completedSubs}/{subtasks.length}</span>
          )}
        </div>
      </button>

      {/* Nested subtasks */}
      {hasSubtasks && expanded && (
        <div className="mt-1 space-y-1">
          {subtasks.map((sub) => (
            <TaskRow
              key={sub.id}
              task={sub}
              depth={depth + 1}
              showProject={false}
              onTap={onTap}
              onToggleComplete={onToggleComplete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
