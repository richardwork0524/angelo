'use client';

import { useState } from 'react';

interface SessionLog {
  id: string;
  session_date: string;
  title: string | null;
  surface: string | null;
  summary: string | null;
}

const SURFACE_COLORS: Record<string, string> = {
  CHAT: 'var(--purple)',
  CODE: 'var(--green)',
  COWORK: 'var(--accent)',
  MOBILE: 'var(--orange)',
};

interface SessionLogListProps {
  logs: SessionLog[];
}

export function SessionLogList({ logs }: SessionLogListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (logs.length === 0) return null;

  return (
    <div className="mb-4">
      <h3 className="text-[12px] font-semibold text-[var(--text3)] uppercase tracking-[0.07em] mb-2 px-1">
        Recent Sessions
      </h3>
      <div className="space-y-1">
        {logs.map((log) => {
          const surfaceColor = log.surface ? SURFACE_COLORS[log.surface.toUpperCase()] || 'var(--text3)' : 'var(--text3)';
          const isExpanded = expandedId === log.id;

          return (
            <button
              key={log.id}
              onClick={() => setExpandedId(isExpanded ? null : log.id)}
              className="w-full text-left bg-[var(--card)] border border-[var(--border)] rounded-[var(--r-sm)] p-3 transition-colors hover:border-[var(--border2)] min-h-[44px]"
            >
              <div className="flex items-center gap-2">
                <span
                  className="w-[7px] h-[7px] rounded-full shrink-0"
                  style={{ backgroundColor: surfaceColor }}
                />
                <span className="text-[12px] text-[var(--text3)] shrink-0">{log.session_date}</span>
                <span className="text-[13px] text-[var(--text)] truncate">{log.title || 'Session'}</span>
              </div>
              {isExpanded && log.summary && (
                <p className="mt-2 text-[13px] text-[var(--text2)] leading-relaxed pl-[15px]">
                  {log.summary}
                </p>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
