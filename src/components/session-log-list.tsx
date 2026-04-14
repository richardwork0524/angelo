'use client';

import { useState, useCallback } from 'react';

interface SessionLog {
  id: string;
  session_date: string;
  title: string | null;
  surface: string | null;
  summary: string | null;
}

const SURFACE_COLORS: Record<string, string> = {
  CODE: 'var(--accent)',
  CHAT: 'var(--green)',
  COWORK: 'var(--purple)',
  MOBILE: 'var(--orange)',
};

interface SessionLogListProps {
  logs: SessionLog[];
  childKey?: string;
}

export function SessionLogList({ logs: initialLogs, childKey }: SessionLogListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [logs, setLogs] = useState<SessionLog[]>(initialLogs);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(initialLogs.length >= 5);

  const loadMore = useCallback(async () => {
    if (!childKey || loading) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/sessions?parent=${childKey}&offset=${logs.length}&limit=10`);
      if (!res.ok) return;
      const data = await res.json();
      const newSessions = data.sessions || [];
      if (newSessions.length === 0) {
        setHasMore(false);
      } else {
        // Deduplicate by id
        const existingIds = new Set(logs.map((l) => l.id));
        const unique = newSessions.filter((s: SessionLog) => !existingIds.has(s.id));
        setLogs((prev) => [...prev, ...unique]);
        setHasMore(newSessions.length >= 10);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, [childKey, logs.length, loading]);

  if (logs.length === 0) return null;

  // Group logs by date
  const grouped: { date: string; sessions: SessionLog[] }[] = [];
  let currentDate = '';
  for (const log of logs) {
    if (log.session_date !== currentDate) {
      currentDate = log.session_date;
      grouped.push({ date: currentDate, sessions: [log] });
    } else {
      grouped[grouped.length - 1].sessions.push(log);
    }
  }

  return (
    <div className="mb-4">
      <h3 className="text-[12px] font-semibold text-[var(--text3)] uppercase tracking-[0.07em] mb-2 px-1">
        Recent Sessions
      </h3>

      <div className="space-y-3">
        {grouped.map((group) => (
          <div key={group.date}>
            <div className="flex items-center gap-2 mb-1 px-1">
              <span className="text-[11px] font-medium text-[var(--text3)]">{group.date}</span>
              {group.sessions.length > 1 && (
                <span className="text-[10px] text-[var(--text3)] opacity-60">{group.sessions.length} sessions</span>
              )}
            </div>
            <div className="space-y-1">
              {group.sessions.map((log) => {
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
                      <span className="text-[13px] text-[var(--text)] truncate flex-1">{log.title || 'Session'}</span>
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
        ))}
      </div>

      {hasMore && childKey && (
        <button
          onClick={loadMore}
          disabled={loading}
          className="w-full mt-2 py-2.5 text-[13px] font-medium text-[var(--accent)] hover:bg-[var(--card)] rounded-[var(--r-sm)] transition-colors min-h-[44px]"
        >
          {loading ? 'Loading...' : 'Load More Sessions'}
        </button>
      )}
    </div>
  );
}
