'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  DragOverlay,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { PRIORITY_COLORS } from '@/lib/constants';
import type { TaskItem } from './task-row';

/* ── Types ── */

interface Column {
  id: string;
  label: string;
  color: string;
  headerColor: string;
}

const COLUMNS: Column[] = [
  { id: 'THIS_WEEK',  label: 'Now',   color: 'var(--primary)',  headerColor: 'var(--primary)' },
  { id: 'THIS_MONTH', label: 'Next',  color: 'var(--purple)',   headerColor: 'var(--purple)' },
  { id: 'PARKED',     label: 'Later', color: 'var(--text3)',    headerColor: 'var(--text3)' },
  { id: 'DONE',       label: 'Done',  color: 'var(--green)',    headerColor: 'var(--green)' },
];

interface TaskKanbanProps {
  tasks: TaskItem[];
  showProject?: boolean;
  onTaskTap: (task: TaskItem) => void;
  onBucketChange: (taskId: string, newBucket: string) => void;
  onComplete: (taskId: string, completed: boolean) => void;
  onReorder: (taskId: string, newSortOrder: number) => void;
}

/* ── Sortable card ── */

interface KanbanCardProps {
  task: TaskItem;
  onTap: (task: TaskItem) => void;
  onComplete: (taskId: string, completed: boolean) => void;
  showProject: boolean;
  isDragging?: boolean;
}

function KanbanCard({ task, onTap, onComplete, showProject, isDragging = false }: KanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: task.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSortableDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-[8px] border transition-all cursor-pointer select-none ${
        isDragging
          ? 'bg-[var(--card2)] border-[var(--primary)] shadow-[0_8px_24px_rgba(0,0,0,0.4),0_0_0_2px_rgba(99,102,241,0.3)]'
          : 'bg-[var(--card)] border-[var(--border)] hover:border-[var(--border2)]'
      }`}
    >
      {/* Drag handle row */}
      <div className="flex items-start gap-2 px-3 pt-2.5 pb-1">
        <div
          {...attributes}
          {...listeners}
          className="flex flex-col gap-[3px] cursor-grab active:cursor-grabbing shrink-0 mt-1 touch-none"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="block w-[12px] h-[1.5px] rounded bg-[var(--text4)]" />
          <span className="block w-[12px] h-[1.5px] rounded bg-[var(--text4)]" />
          <span className="block w-[12px] h-[1.5px] rounded bg-[var(--text4)]" />
        </div>

        {/* Checkbox */}
        <button
          onClick={(e) => { e.stopPropagation(); onComplete(task.id, !task.completed); }}
          className={`w-4 h-4 rounded-full border-2 shrink-0 mt-0.5 flex items-center justify-center transition-all ${
            task.completed
              ? 'bg-[var(--green)] border-[var(--green)]'
              : 'border-[var(--border2)] hover:border-[var(--accent)]'
          }`}
        >
          {task.completed && (
            <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
              <path d="M2 5L4 7L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>

        {/* Priority dot */}
        <span
          className="w-[6px] h-[6px] rounded-full shrink-0 mt-[5px]"
          style={{ backgroundColor: PRIORITY_COLORS[task.priority || ''] || 'var(--border2)' }}
        />

        {/* Open detail on click */}
        <div
          className="flex-1 min-w-0"
          onClick={() => onTap(task)}
        >
          <p className={`text-[12px] leading-[1.4] ${task.completed ? 'line-through text-[var(--text3)]' : 'text-[var(--text)]'}`}>
            {task.task_code && (
              <span className="text-[var(--accent)] font-mono text-[9px] mr-1">{task.task_code}</span>
            )}
            {task.text}
          </p>
        </div>
      </div>

      {/* Meta row */}
      <div className="flex items-center gap-1.5 px-3 pb-2.5 flex-wrap">
        {task.priority && (
          <span
            className="text-[9px] font-bold px-1.5 py-[1px] rounded"
            style={{
              color: PRIORITY_COLORS[task.priority] || 'var(--text3)',
              background: 'var(--card2)',
              border: `1px solid ${PRIORITY_COLORS[task.priority] || 'var(--border)'}`,
            }}
          >
            {task.priority}
          </span>
        )}
        {showProject && (
          <span className="text-[9px] text-[var(--text3)] truncate max-w-[80px]">{task.project_key}</span>
        )}
        {task.mission && (
          <span className="text-[9px] text-[var(--purple)] truncate max-w-[100px]">{task.mission}</span>
        )}
      </div>
    </div>
  );
}

/* ── Droppable column ── */

function KanbanColumn({
  column,
  tasks,
  showProject,
  onTaskTap,
  onComplete,
  activeId,
}: {
  column: Column;
  tasks: TaskItem[];
  showProject: boolean;
  onTaskTap: (task: TaskItem) => void;
  onComplete: (taskId: string, completed: boolean) => void;
  activeId: string | null;
}) {
  const taskIds = useMemo(() => tasks.map((t) => t.id), [tasks]);

  return (
    <div
      className="flex flex-col min-h-0 rounded-[10px] border bg-[var(--surface)]"
      style={{ borderColor: 'var(--border)', borderTop: `2px solid ${column.color}` }}
    >
      {/* Column header */}
      <div className="flex items-center gap-2 px-3 py-2.5 shrink-0">
        <span
          className="w-2 h-2 rounded-[2px]"
          style={{ background: column.color }}
        />
        <span className="text-[12px] font-semibold" style={{ color: 'var(--text)' }}>
          {column.label}
        </span>
        <span className="text-[10px] tabular-nums" style={{ color: 'var(--text3)' }}>
          {tasks.length}
        </span>
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto px-2 pb-2 flex flex-col gap-1.5 min-h-[80px]">
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <KanbanCard
              key={task.id}
              task={task}
              onTap={onTaskTap}
              onComplete={onComplete}
              showProject={showProject}
              isDragging={task.id === activeId}
            />
          ))}
        </SortableContext>

        {tasks.length === 0 && (
          <div
            className="flex items-center justify-center rounded-[8px] border border-dashed"
            style={{
              height: 48,
              borderColor: 'var(--border)',
              color: 'var(--text4)',
              fontSize: 11,
            }}
          >
            Drop here
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Main Kanban board ── */

export function TaskKanban({
  tasks,
  showProject = true,
  onTaskTap,
  onBucketChange,
  onComplete,
  onReorder,
}: TaskKanbanProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  // Local column order state for optimistic reorder
  const [localTasks, setLocalTasks] = useState<TaskItem[]>(tasks);

  // Sync local tasks when prop changes (e.g. after fetch refresh)
  useMemo(() => { setLocalTasks(tasks); }, [tasks]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
  );

  const getColumnForTask = useCallback((task: TaskItem): string => {
    if (task.completed) return 'DONE';
    return task.bucket;
  }, []);

  const tasksByColumn = useMemo(() => {
    const map: Record<string, TaskItem[]> = {
      THIS_WEEK: [],
      THIS_MONTH: [],
      PARKED: [],
      DONE: [],
    };
    for (const t of localTasks) {
      if (t.parent_task_id) continue; // skip subtasks in kanban
      const col = getColumnForTask(t);
      if (map[col]) map[col].push(t);
    }
    // Sort by sort_order within each column
    for (const col of Object.keys(map)) {
      map[col].sort((a, b) => (a as TaskItem & { sort_order?: number }).sort_order ?? 0 - ((b as TaskItem & { sort_order?: number }).sort_order ?? 0));
    }
    return map;
  }, [localTasks, getColumnForTask]);

  const activeTask = useMemo(
    () => localTasks.find((t) => t.id === activeId) || null,
    [localTasks, activeId]
  );

  function handleDragStart({ active }: DragStartEvent) {
    setActiveId(active.id as string);
  }

  function handleDragOver({ active, over }: DragOverEvent) {
    if (!over || active.id === over.id) return;

    const activeTask = localTasks.find((t) => t.id === active.id);
    if (!activeTask) return;

    // Check if over a column (drop target) or another card
    const overIsColumn = COLUMNS.some((c) => c.id === over.id);
    const overTask = localTasks.find((t) => t.id === over.id);

    const targetColId = overIsColumn
      ? (over.id as string)
      : overTask
      ? getColumnForTask(overTask)
      : null;

    if (!targetColId) return;

    const currentColId = getColumnForTask(activeTask);
    if (targetColId === currentColId) return;

    // Optimistic move to new column
    setLocalTasks((prev) =>
      prev.map((t) => {
        if (t.id !== active.id) return t;
        if (targetColId === 'DONE') return { ...t, completed: true };
        return { ...t, bucket: targetColId, completed: false };
      })
    );
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);
    if (!over) return;

    const activeTask = localTasks.find((t) => t.id === active.id);
    if (!activeTask) return;

    const overIsColumn = COLUMNS.some((c) => c.id === over.id);
    const overTask = localTasks.find((t) => t.id === over.id);

    const targetColId = overIsColumn
      ? (over.id as string)
      : overTask
      ? getColumnForTask(overTask)
      : null;

    if (!targetColId) return;

    const originalColId = tasks.find((t) => t.id === active.id)
      ? getColumnForTask(tasks.find((t) => t.id === active.id)!)
      : null;

    // Cross-column move
    if (originalColId !== targetColId) {
      if (targetColId === 'DONE') {
        onComplete(active.id as string, true);
      } else {
        onBucketChange(active.id as string, targetColId);
      }
      return;
    }

    // Same-column reorder
    if (!overIsColumn && overTask && active.id !== over.id) {
      const colTasks = tasksByColumn[targetColId] || [];
      const oldIndex = colTasks.findIndex((t) => t.id === active.id);
      const newIndex = colTasks.findIndex((t) => t.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = arrayMove(colTasks, oldIndex, newIndex);
      // Update local state
      setLocalTasks((prev) => {
        const nonCol = prev.filter((t) => getColumnForTask(t) !== targetColId || t.parent_task_id);
        return [...nonCol, ...reordered];
      });
      // Persist new sort_order for moved item (use index * 100 spacing)
      onReorder(active.id as string, newIndex * 100);
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div
        className="grid gap-3 h-full"
        style={{ gridTemplateColumns: 'repeat(4, 1fr)', minHeight: 0 }}
      >
        {COLUMNS.map((col) => (
          <KanbanColumn
            key={col.id}
            column={col}
            tasks={tasksByColumn[col.id] || []}
            showProject={showProject}
            onTaskTap={onTaskTap}
            onComplete={onComplete}
            activeId={activeId}
          />
        ))}
      </div>

      {/* Drag overlay — floating ghost card */}
      <DragOverlay>
        {activeTask ? (
          <div
            className="rounded-[8px] border bg-[var(--card2)] shadow-[0_12px_32px_rgba(0,0,0,0.5)] border-[var(--primary)] rotate-[-1deg] opacity-95"
            style={{ width: 200 }}
          >
            <div className="px-3 pt-2.5 pb-2">
              <p className="text-[12px] leading-[1.4] text-[var(--text)]">{activeTask.text}</p>
              {activeTask.priority && (
                <span
                  className="inline-block text-[9px] font-bold px-1.5 py-[1px] rounded mt-1"
                  style={{
                    color: PRIORITY_COLORS[activeTask.priority] || 'var(--text3)',
                    background: 'var(--card)',
                    border: `1px solid ${PRIORITY_COLORS[activeTask.priority] || 'var(--border)'}`,
                  }}
                >
                  {activeTask.priority}
                </span>
              )}
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
