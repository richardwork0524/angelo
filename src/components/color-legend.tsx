'use client';

import { useState } from 'react';
import { PRIORITY_COLORS, SURFACE_COLORS } from '@/lib/constants';

const PRIORITY_LABELS: Record<string, string> = {
  P0: 'Critical',
  P1: 'High',
  P2: 'Normal',
};

const SURFACE_LABELS: Record<string, string> = {
  CODE: 'Code',
  CHAT: 'Chat',
  COWORK: 'Cowork',
  MOBILE: 'Mobile',
};

const STATUS_ITEMS = [
  { label: 'Active', color: 'var(--green)' },
  { label: 'Building', color: 'var(--accent)' },
  { label: 'Planning', color: 'var(--purple)' },
  { label: 'Testing', color: 'var(--yellow)' },
  { label: 'Blocked', color: 'var(--red)' },
];

export function ColorLegend() {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="w-[28px] h-[28px] rounded-[8px] bg-[var(--card)] border border-[var(--border)] hover:border-[var(--border2)] flex items-center justify-center transition-colors"
        title="Color legend"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <circle cx="4" cy="4" r="2.5" fill="var(--red)" />
          <circle cx="10" cy="4" r="2.5" fill="var(--accent)" />
          <circle cx="4" cy="10" r="2.5" fill="var(--green)" />
          <circle cx="10" cy="10" r="2.5" fill="var(--purple)" />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-[36px] z-50 w-[220px] bg-[var(--card)] border border-[var(--border)] rounded-[12px] shadow-lg p-3 space-y-3">
            {/* Priority */}
            <div>
              <h4 className="text-[10px] font-bold text-[var(--text3)] uppercase tracking-[0.08em] mb-1.5">Priority</h4>
              <div className="space-y-1">
                {Object.entries(PRIORITY_COLORS).map(([key, color]) => (
                  <div key={key} className="flex items-center gap-2">
                    <span className="w-[7px] h-[7px] rounded-full shrink-0" style={{ backgroundColor: color }} />
                    <span className="text-[11px] text-[var(--text2)]">{PRIORITY_LABELS[key] || key}</span>
                    <span className="text-[10px] text-[var(--text3)] ml-auto">{key}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Surface */}
            <div>
              <h4 className="text-[10px] font-bold text-[var(--text3)] uppercase tracking-[0.08em] mb-1.5">Surface</h4>
              <div className="space-y-1">
                {Object.entries(SURFACE_COLORS).map(([key, color]) => (
                  <div key={key} className="flex items-center gap-2">
                    <span className="w-[7px] h-[7px] rounded-full shrink-0" style={{ backgroundColor: color }} />
                    <span className="text-[11px] text-[var(--text2)]">{SURFACE_LABELS[key] || key}</span>
                    <span className="text-[10px] text-[var(--text3)] ml-auto">{key}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Status */}
            <div>
              <h4 className="text-[10px] font-bold text-[var(--text3)] uppercase tracking-[0.08em] mb-1.5">Status</h4>
              <div className="space-y-1">
                {STATUS_ITEMS.map((s) => (
                  <div key={s.label} className="flex items-center gap-2">
                    <span
                      className="px-1.5 py-[1px] rounded-[4px] text-[9px] font-semibold uppercase"
                      style={{ backgroundColor: `color-mix(in srgb, ${s.color} 12%, transparent)`, color: s.color }}
                    >
                      {s.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
