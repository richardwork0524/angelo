'use client';

interface GameStatsModuleProps {
  title: string;
  body: string | null;
  metadata: Record<string, unknown>;
}

const STAT_LABELS: Record<string, string> = {
  biomes: 'Biomes',
  skills: 'Skills',
  classes: 'Classes',
  monsters: 'Monsters',
  level_cap: 'Level Cap',
  status_effects: 'Status FX',
  versions_planned: 'Versions',
};

export function GameStatsModule({ title, body, metadata }: GameStatsModuleProps) {
  // Extract numeric stats from metadata
  const stats = Object.entries(metadata)
    .filter(([, v]) => typeof v === 'number')
    .map(([key, value]) => ({
      key,
      label: STAT_LABELS[key] || key.replace(/_/g, ' '),
      value: value as number,
    }));

  if (stats.length === 0) return null;

  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-[var(--r)] p-4">
      <h3 className="text-[13px] font-semibold text-[var(--text)] mb-1">{title}</h3>
      {body && <p className="text-[12px] text-[var(--text3)] mb-3">{body}</p>}

      <div className="grid grid-cols-3 gap-2">
        {stats.map((stat) => (
          <div
            key={stat.key}
            className="text-center py-2 px-1 rounded-[var(--r-sm)] bg-[var(--card2)]"
          >
            <div className="text-[18px] font-bold text-[var(--accent)] tabular-nums">
              {stat.value.toLocaleString()}
            </div>
            <div className="text-[10px] text-[var(--text3)] font-medium uppercase tracking-wide mt-0.5">
              {stat.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
