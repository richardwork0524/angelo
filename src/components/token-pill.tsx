'use client';

import { useState, useEffect, useRef } from 'react';

interface TokenStats {
  today: { input: number; output: number; cost: number; sessions: number };
  week: { input: number; output: number; cost: number; sessions: number; avg_daily: number };
  daily_costs: { date: string; cost: number }[];
}

export function TokenPill({ stats }: { stats: TokenStats | null }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  if (!stats) return null;

  const maxCost = Math.max(...stats.daily_costs.map((d) => d.cost), 0.01);
  const fmt = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(0)}K` : String(n);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--card)] border border-[var(--border)] hover:border-[var(--accent)] transition-colors text-[12px] font-semibold tabular-nums"
      >
        <span className="w-[6px] h-[6px] rounded-full bg-[var(--green)]" />
        <span style={{ color: 'var(--green)' }}>${stats.today.cost.toFixed(2)}</span>
        <span className="text-[var(--text3)]">&middot;</span>
        <span>{fmt(stats.today.input + stats.today.output)}</span>
        <svg
          width="8" height="8" viewBox="0 0 8 8" fill="none"
          className={`transition-transform ${open ? 'rotate-180' : ''}`}
        >
          <path d="M1 3L4 6L7 3" stroke="var(--text3)" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+8px)] w-[280px] bg-[var(--card)] border border-[var(--border)] rounded-[16px] shadow-lg z-50 p-4">
          <div className="space-y-2">
            <Row label="Input tokens" value={stats.today.input.toLocaleString()} color="var(--accent)" />
            <Row label="Output tokens" value={stats.today.output.toLocaleString()} />
            <Row label="Today cost" value={`$${stats.today.cost.toFixed(2)}`} color="var(--green)" />
            <Row label="7-day total" value={`$${stats.week.cost.toFixed(2)}`} />
            <Row label="Sessions today" value={String(stats.today.sessions)} />
          </div>
          {/* 7-day trend bars */}
          <div className="flex gap-[2px] items-end h-6 mt-3">
            {stats.daily_costs.map((d, i) => (
              <div
                key={d.date}
                className="flex-1 rounded-[2px] min-h-[2px]"
                style={{
                  height: `${Math.max((d.cost / maxCost) * 100, 8)}%`,
                  background: i >= 5 ? 'var(--accent)' : 'var(--accent-dim)',
                }}
              />
            ))}
          </div>
          <p className="text-[10px] text-[var(--text3)] text-center mt-2">
            7-day trend &middot; Avg ${stats.week.avg_daily.toFixed(2)}/day
          </p>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-[var(--border)] last:border-b-0">
      <span className="text-[11px] text-[var(--text3)]">{label}</span>
      <span className="text-[13px] font-semibold tabular-nums" style={color ? { color } : undefined}>{value}</span>
    </div>
  );
}
