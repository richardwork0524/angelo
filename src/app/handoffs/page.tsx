'use client';

import { useEffect, useState, useCallback } from 'react';
import { StickyHeader } from '@/components/sticky-header';
import { cachedFetch } from '@/lib/cache';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { patchHandoff, deleteHandoff } from '@/lib/mutate';
import { useToast } from '@/components/toast';
import type { Handoff } from '@/lib/types';


const STATUS_TABS: { key: string | null; label: string; color?: string }[] = [
  { key: null, label: 'All' },
  { key: 'open', label: 'Open', color: 'var(--orange)' },
  { key: 'picked_up', label: 'Picked Up', color: 'var(--accent)' },
  { key: 'completed', label: 'Completed', color: 'var(--green)' },
];

const SCOPE_COLORS: Record<string, string> = {
  app: 'var(--purple)',
  module: 'var(--accent)',
  feature: 'var(--cyan)',
  mission: 'var(--green)',
};

const STATUS_COLORS: Record<string, { text: string; bg: string }> = {
  open: { text: 'var(--orange)', bg: 'var(--orange-dim)' },
  picked_up: { text: 'var(--accent)', bg: 'var(--accent-dim)' },
  completed: { text: 'var(--green)', bg: 'var(--green-dim)' },
};

function timeAgo(date: string): string {
  const mins = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function HandoffsPage() {
  const [handoffs, setHandoffs] = useState<Handoff[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const { showToast, ToastContainer } = useToast();

  const fetchHandoffs = useCallback(async (skipCache = false) => {
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      const url = `/api/handoffs${params.toString() ? '?' + params.toString() : ''}`;
      const data: { handoffs: Handoff[]; total: number } = skipCache
        ? await fetch(url).then((r) => r.json())
        : await cachedFetch(url, 15000);
      setHandoffs(data.handoffs);
      setTotal(data.total);
    } catch {
      // Silent fail
    }
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => {
    setLoading(true);
    fetchHandoffs();
  }, [fetchHandoffs]);

  useRealtimeRefresh({
    table: 'angelo_handoffs',
    cachePrefix: '/api/handoffs',
    onRefresh: fetchHandoffs,
  });

  function handleStatusChange(id: string, newStatus: string) {
    // Optimistic update
    setHandoffs((prev) =>
      prev.map((h) => (h.id === id ? { ...h, status: newStatus as Handoff['status'] } : h))
    );
    patchHandoff(id, newStatus, {
      onSuccess: () => {
        showToast(`Marked ${newStatus.replace('_', ' ')}`);
        fetchHandoffs(true);
      },
      onError: () => {
        showToast('Update failed', 'error');
        fetchHandoffs(true);
      },
    });
  }

  function handleDelete(id: string) {
    setHandoffs((prev) => prev.filter((h) => h.id !== id));
    setTotal((prev) => prev - 1);
    setConfirmDeleteId(null);
    setExpandedId(null);
    deleteHandoff(id, {
      onSuccess: () => {
        showToast('Handoff deleted');
        fetchHandoffs(true);
      },
      onError: () => {
        showToast('Delete failed', 'error');
        fetchHandoffs(true);
      },
    });
  }

  const statusCounts = handoffs.reduce(
    (acc, h) => {
      acc[h.status] = (acc[h.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <div className="flex flex-col h-full">
      <StickyHeader title="Handoffs" />

      {/* Status filter tabs */}
      <div className="shrink-0 flex items-center gap-1 px-4 py-2.5 border-b border-[var(--border)] overflow-x-auto">
        {STATUS_TABS.map((tab) => {
          const count = tab.key ? statusCounts[tab.key] || 0 : total;
          const isActive = statusFilter === tab.key;
          return (
            <button
              key={tab.key ?? 'all'}
              onClick={() => setStatusFilter(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-[12px] font-semibold transition-all shrink-0 ${
                isActive ? 'bg-[var(--accent)] text-white' : 'bg-[var(--card)] text-[var(--text3)]'
              }`}
            >
              {tab.color && !isActive && (
                <span className="w-[6px] h-[6px] rounded-full" style={{ backgroundColor: tab.color }} />
              )}
              {tab.label}
              <span className={`text-[10px] tabular-nums ${isActive ? 'text-white/70' : 'text-[var(--text3)]'}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Handoff list */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-6 h-6 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin" />
          </div>
        ) : handoffs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32">
            <p className="text-[14px] text-[var(--text3)]">No handoffs</p>
          </div>
        ) : (
          <div className="space-y-2">
            {handoffs.map((h) => {
              const isExpanded = expandedId === h.id;
              const pct = h.sections_total > 0 ? Math.round((h.sections_completed / h.sections_total) * 100) : 0;
              const statusColor = STATUS_COLORS[h.status] || STATUS_COLORS.open;
              const scopeColor = SCOPE_COLORS[h.scope_type] || 'var(--text3)';

              return (
                <div
                  key={h.id}
                  className="rounded-[16px] bg-[var(--card)] border border-[var(--border)] hover:border-[var(--border2)] transition-all overflow-hidden"
                >
                  {/* Card header — clickable */}
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : h.id)}
                    className="w-full text-left px-4 pt-3 pb-2.5"
                  >
                    {/* Row 1: scope badge + scope name + status */}
                    <div className="flex items-center gap-2 mb-1.5">
                      <span
                        className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-[4px]"
                        style={{ color: scopeColor, backgroundColor: `color-mix(in srgb, ${scopeColor} 15%, transparent)` }}
                      >
                        {h.scope_type}
                      </span>
                      <span className="flex-1 text-[14px] font-semibold text-[var(--text)] truncate">
                        {h.scope_name}
                      </span>
                      <span
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0"
                        style={{ color: statusColor.text, backgroundColor: statusColor.bg }}
                      >
                        {h.status.replace('_', ' ')}
                      </span>
                    </div>

                    {/* Row 2: progress bar */}
                    {h.sections_total > 0 && (
                      <div className="flex items-center gap-2 mb-1.5">
                        <div className="flex-1 h-[4px] rounded-full bg-[var(--card2)] overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${pct}%`,
                              backgroundColor: pct === 100 ? 'var(--green)' : 'var(--accent)',
                            }}
                          />
                        </div>
                        <span className="text-[11px] text-[var(--text3)] tabular-nums shrink-0">
                          {h.sections_completed}/{h.sections_total}
                        </span>
                      </div>
                    )}

                    {/* Row 3: meta line */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[11px] text-[var(--text3)]">{h.project_key}</span>
                      {h.entry_point && (
                        <>
                          <span className="text-[11px] text-[var(--text3)] opacity-40">·</span>
                          <span className="text-[11px] text-[var(--accent)] font-medium">{h.entry_point}</span>
                        </>
                      )}
                      {h.version && (
                        <>
                          <span className="text-[11px] text-[var(--text3)] opacity-40">·</span>
                          <span className="text-[11px] text-[var(--text3)]">{h.version}</span>
                        </>
                      )}
                      <span className="text-[11px] text-[var(--text3)] opacity-40">·</span>
                      <span
                        className="text-[10px] font-medium px-1.5 py-0.5 rounded-[4px]"
                        style={{
                          color: h.source === 'auto' ? 'var(--orange)' : 'var(--accent)',
                          backgroundColor: h.source === 'auto' ? 'var(--orange-dim)' : 'var(--accent-dim)',
                        }}
                      >
                        {h.source}
                      </span>
                      <span className="text-[11px] text-[var(--text3)] opacity-40">·</span>
                      <span className="text-[11px] text-[var(--text3)] opacity-60">{timeAgo(h.created_at)}</span>
                    </div>
                  </button>

                  {/* Expanded section */}
                  {isExpanded && (
                    <div className="px-4 pb-3 border-t border-[var(--border)] mt-0.5 pt-2.5">
                      {/* Sections remaining */}
                      {h.sections_remaining.length > 0 && (
                        <div className="mb-2.5">
                          <p className="text-[11px] font-bold text-[var(--text3)] uppercase tracking-[0.06em] mb-1.5">
                            Remaining ({h.sections_remaining.length})
                          </p>
                          <div className="space-y-1">
                            {h.sections_remaining.map((s, i) => (
                              <div key={i} className="flex items-start gap-2 px-2 py-1.5 rounded-[8px] bg-[var(--card2)]">
                                <span className="w-[6px] h-[6px] rounded-full mt-[5px] shrink-0 bg-[var(--orange)]" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-[12px] text-[var(--text)]">{s.name}</p>
                                  {s.notes && (
                                    <p className="text-[11px] text-[var(--text3)] mt-0.5">{s.notes}</p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Notes */}
                      {h.notes && (
                        <p className="text-[12px] text-[var(--text2)] bg-[var(--card2)] rounded-[8px] px-3 py-2 mb-2.5 whitespace-pre-line">
                          {h.notes}
                        </p>
                      )}

                      {/* Action buttons */}
                      <div className="flex items-center gap-2">
                        {h.status === 'open' && (
                          <button
                            onClick={() => handleStatusChange(h.id, 'picked_up')}
                            className="text-[12px] font-semibold text-[var(--accent)] px-3 py-1.5 rounded-[8px] bg-[var(--accent-dim)] hover:opacity-80 transition-opacity"
                          >
                            Pick Up
                          </button>
                        )}
                        {h.status === 'picked_up' && (
                          <button
                            onClick={() => handleStatusChange(h.id, 'completed')}
                            className="text-[12px] font-semibold text-[var(--green)] px-3 py-1.5 rounded-[8px] bg-[var(--green-dim)] hover:opacity-80 transition-opacity"
                          >
                            Mark Completed
                          </button>
                        )}
                        {h.status === 'completed' && (
                          <button
                            onClick={() => handleStatusChange(h.id, 'open')}
                            className="text-[12px] font-semibold text-[var(--text3)] px-3 py-1.5 rounded-[8px] bg-[var(--card2)] hover:opacity-80 transition-opacity"
                          >
                            Reopen
                          </button>
                        )}

                        {/* Delete with inline confirmation */}
                        <div className="ml-auto">
                          {confirmDeleteId === h.id ? (
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] text-[var(--red)]">Archive vault file?</span>
                              <button
                                onClick={() => handleDelete(h.id)}
                                className="text-[11px] font-semibold text-white px-2 py-1 rounded-[6px] bg-[var(--red)] hover:opacity-80 transition-opacity"
                              >
                                Yes, delete
                              </button>
                              <button
                                onClick={() => setConfirmDeleteId(null)}
                                className="text-[11px] font-semibold text-[var(--text3)] px-2 py-1 rounded-[6px] bg-[var(--card2)] hover:opacity-80 transition-opacity"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmDeleteId(h.id)}
                              className="text-[11px] text-[var(--text3)] hover:text-[var(--red)] px-2 py-1 rounded-[6px] hover:bg-[var(--red-dim)] transition-all"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      <ToastContainer />
    </div>
  );
}
