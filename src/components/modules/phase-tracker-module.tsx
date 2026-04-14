'use client';

interface Phase {
  name: string;
  status: string;
}

interface PhaseTrackerModuleProps {
  title: string;
  body: string | null;
  phases: Phase[];
}

export function PhaseTrackerModule({ title, body, phases }: PhaseTrackerModuleProps) {
  if (!phases || phases.length === 0) return null;

  const doneCount = phases.filter((p) => p.status === 'complete').length;

  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-[var(--r)] p-4">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-[13px] font-semibold text-[var(--text)]">{title}</h3>
        <span className="text-[11px] text-[var(--text3)]">
          {doneCount}/{phases.length}
        </span>
      </div>
      {body && <p className="text-[12px] text-[var(--text3)] mb-3">{body}</p>}

      <div className="flex items-center gap-1 overflow-x-auto scrollbar-none pb-1">
        {phases.map((phase, i) => {
          let bg: string;
          let text: string;
          let glow: React.CSSProperties = {};

          if (phase.status === 'complete') {
            bg = 'var(--green)';
            text = '#fff';
          } else if (
            phase.status === 'current' ||
            (phase.status === 'pending' && i > 0 && phases[i - 1].status === 'complete')
          ) {
            bg = 'var(--accent)';
            text = '#fff';
            glow = { boxShadow: '0 0 8px var(--accent)' };
          } else {
            bg = 'var(--surface)';
            text = 'var(--text3)';
          }

          // Derive a short label: take first word or abbreviation
          const shortLabel = phase.name.length <= 6
            ? phase.name
            : phase.name.match(/^(v[\d.]+|S[\d.]+|Phase \d+)/)?.[1] || phase.name.split(/[\s:–—-]+/)[0];

          return (
            <div
              key={i}
              className="flex items-center justify-center min-w-[28px] h-[28px] px-1.5 rounded-[4px] text-[9px] font-bold shrink-0"
              style={{ backgroundColor: bg, color: text, ...glow }}
              title={`${phase.name}: ${phase.status}`}
            >
              {shortLabel}
            </div>
          );
        })}
      </div>
    </div>
  );
}
