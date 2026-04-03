'use client';

import { StatusBadge } from './status-badge';
import { ProgressBar } from './progress-bar';
import { SurfaceBadge } from './surface-badge';
import { BuildChain } from './build-chain';

interface TaskCounts {
  this_week: number;
  this_month: number;
  parked: number;
}

export interface ProjectCardData {
  child_key: string;
  display_name: string;
  status?: string;
  build_phase?: string;
  brief?: string | null;
  next_action?: string | null;
  last_session_date?: string | null;
  surface?: string | null;
  is_leaf: boolean;
  task_counts: TaskCounts;
  children_task_total: number;
  descendant_task_total: number;
  completed_count?: number;
}

interface ProjectCardProps {
  project: ProjectCardData;
  variant: 'simple' | 'detailed';
  onClick?: () => void;
}

export function ProjectCard({ project, variant, onClick }: ProjectCardProps) {
  const totalOpen = project.task_counts.this_week + project.task_counts.this_month + project.task_counts.parked;
  const totalAll = totalOpen + (project.completed_count || 0);
  const progress = totalAll > 0 ? Math.round(((project.completed_count || 0) / totalAll) * 100) : 0;

  const cardContent = (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-[var(--r)] p-[14px_16px]">
      {/* Header row */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[15px] font-semibold text-[var(--text)] truncate">{project.display_name}</span>
          {project.status && <StatusBadge status={project.status} />}
        </div>
        {onClick && (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-[var(--text3)] shrink-0">
            <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>

      {/* Task count pills */}
      <div className="flex items-center gap-2 flex-wrap mb-2">
        {project.task_counts.this_week > 0 && (
          <span className="inline-flex items-center px-2 py-[3px] rounded-[6px] text-[11px] font-semibold" style={{ backgroundColor: 'var(--accent-dim)', color: 'var(--accent)' }}>
            {project.task_counts.this_week} Week
          </span>
        )}
        {project.task_counts.this_month > 0 && (
          <span className="inline-flex items-center px-2 py-[3px] rounded-[6px] text-[11px] font-semibold" style={{ backgroundColor: 'var(--purple-dim)', color: 'var(--purple)' }}>
            {project.task_counts.this_month} Month
          </span>
        )}
        {project.task_counts.parked > 0 && (
          <span className="inline-flex items-center px-2 py-[3px] rounded-[6px] text-[11px] font-semibold" style={{ backgroundColor: 'var(--card2)', color: 'var(--text3)' }}>
            {project.task_counts.parked} Parked
          </span>
        )}
        {!project.is_leaf && project.children_task_total > 0 && (
          <span className="text-[11px] text-[var(--text3)] ml-1">
            +{project.children_task_total} in children
          </span>
        )}
        {totalOpen === 0 && project.children_task_total === 0 && (
          <span className="text-[11px] text-[var(--text3)]">No tasks</span>
        )}
      </div>

      {/* Progress bar */}
      <ProgressBar value={progress} />

      {/* Detailed variant extras */}
      {variant === 'detailed' && (
        <div className="mt-3 space-y-2">
          {project.brief && (
            <p className="text-[13px] text-[var(--text2)] line-clamp-2">{project.brief}</p>
          )}

          {project.next_action && (
            <div className="flex items-start gap-2">
              <span className="text-[11px] text-[var(--text3)] shrink-0 mt-0.5">Next:</span>
              <p className="text-[13px] text-[var(--text)] truncate">{project.next_action}</p>
            </div>
          )}

          <div className="flex items-center gap-3 flex-wrap">
            {project.last_session_date && (
              <span className="text-[12px] text-[var(--text3)]">
                Last: {project.last_session_date}
              </span>
            )}
            {project.surface && <SurfaceBadge surface={project.surface} />}
          </div>

          {project.build_phase && (
            <BuildChain currentPhase={project.build_phase} />
          )}
        </div>
      )}
    </div>
  );

  if (onClick) {
    return (
      <button onClick={onClick} className="w-full text-left transition-transform active:scale-[0.98]">
        {cardContent}
      </button>
    );
  }

  return cardContent;
}
