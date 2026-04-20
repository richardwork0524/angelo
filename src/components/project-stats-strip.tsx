'use client';

interface ProjectStatsStripProps {
  openTasks: number;
  blockers: number;
  sessions7d: number;
  tokens7d: number;
  cost7d?: number;
}

function fmtTokens(n: number): string {
  if (!n) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(n);
}

function fmtCost(n: number): string {
  if (!n) return '$0';
  if (n < 0.01) return '<$0.01';
  return `$${n.toFixed(2)}`;
}

const CELLS: {
  key: keyof ProjectStatsStripProps;
  label: string;
  color: string;
  fmt?: (v: number) => string;
}[] = [
  { key: 'openTasks',   label: 'OPEN TASKS',   color: 'var(--text)' },
  { key: 'blockers',    label: 'BLOCKERS',      color: 'var(--red)' },
  { key: 'sessions7d',  label: 'SESSIONS 7D',  color: 'var(--text)' },
  { key: 'cost7d',      label: 'COST 7D',       color: 'var(--green)', fmt: fmtCost },
];

export function ProjectStatsStrip({ openTasks, blockers, sessions7d, tokens7d, cost7d }: ProjectStatsStripProps) {
  // Determine whether we have real cost data; fall back to tokens
  const hasCost = cost7d !== undefined && cost7d > 0;
  const cells = CELLS.map((c) => {
    if (c.key === 'cost7d') {
      return hasCost
        ? { ...c, label: 'COST 7D', value: cost7d!, fmt: fmtCost }
        : { ...c, label: 'TOKENS 7D', value: tokens7d, fmt: fmtTokens };
    }
    const rawVal = { openTasks, blockers, sessions7d, tokens7d, cost7d }[c.key] ?? 0;
    return { ...c, value: rawVal as number };
  });

  return (
    <div
      className="bg-[var(--card)] border border-[var(--border)] rounded-b-[var(--r)] border-t-0 overflow-hidden"
      style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)' }}
    >
      {cells.map((cell, i) => (
        <div
          key={cell.key}
          style={{
            padding: '14px 16px',
            borderRight: i < 3 ? '1px solid var(--border)' : 'none',
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.07em',
              color: 'var(--text3)',
              marginBottom: 4,
            }}
          >
            {cell.label}
          </div>
          <div
            className="mono"
            style={{
              fontSize: 20,
              fontWeight: 590,
              color: cell.color,
              fontFamily: 'ui-monospace, monospace',
              lineHeight: 1.2,
            }}
          >
            {cell.fmt ? cell.fmt(cell.value) : String(cell.value)}
          </div>
        </div>
      ))}
    </div>
  );
}
