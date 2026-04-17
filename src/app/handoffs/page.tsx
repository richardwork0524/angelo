'use client';

import { useEffect, useState, useCallback } from 'react';
import { StickyHeader } from '@/components/sticky-header';
import { HandoffCard } from '@/components/handoff-card';
import { cachedFetch } from '@/lib/cache';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { useToast } from '@/components/toast';
import type { Handoff } from '@/lib/types';


const STATUS_TABS: { key: string | null; label: string; color?: string }[] = [
  { key: null, label: 'All' },
  { key: 'open', label: 'Open', color: 'var(--orange)' },
  { key: 'picked_up', label: 'Picked Up', color: 'var(--accent)' },
  { key: 'completed', label: 'Completed', color: 'var(--green)' },
];


export default function HandoffsPage() {
  const [handoffs, setHandoffs] = useState<Handoff[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
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

  async function handleDelete(id: string) {
    setConfirmDeleteId(null);

    try {
      const res = await fetch('/api/handoffs', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error('Failed');
      showToast('Handoff deleted');
      // Fetch fresh list from server (skip cache entirely)
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      const freshUrl = `/api/handoffs${params.toString() ? '?' + params.toString() : ''}`;
      const data = await fetch(freshUrl).then((r) => r.json());
      setHandoffs(data.handoffs);
      setTotal(data.total);
    } catch {
      showToast('Delete failed', 'error');
      fetchHandoffs(true);
    }
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
            {handoffs.map((h) => (
              <div key={h.id} className="relative group">
                <HandoffCard handoff={h} onUpdate={() => fetchHandoffs(true)} />
                {/* Delete button — shows on hover */}
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  {confirmDeleteId === h.id ? (
                    <div className="flex items-center gap-1.5 bg-[var(--surface)] rounded-[8px] px-2 py-1.5 border border-[var(--border)]" style={{ boxShadow: '0 2px 8px rgba(0,0,0,.2)' }}>
                      <span className="text-[11px] text-[var(--red)]">Delete?</span>
                      <button
                        onClick={() => handleDelete(h.id)}
                        className="text-[10px] font-semibold text-white px-2 py-0.5 rounded-[4px] bg-[var(--red)] hover:opacity-80"
                      >
                        Yes
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="text-[10px] font-semibold text-[var(--text3)] px-2 py-0.5 rounded-[4px] bg-[var(--card)] hover:opacity-80"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(h.id); }}
                      className="w-6 h-6 rounded-[6px] flex items-center justify-center text-[var(--text3)] hover:text-[var(--red)] hover:bg-[var(--red-dim)] transition-all"
                      title="Delete"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/></svg>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <ToastContainer />
    </div>
  );
}
