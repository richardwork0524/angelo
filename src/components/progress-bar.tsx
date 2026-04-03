'use client';

interface ProgressBarProps {
  /** 0-100 percentage */
  value: number;
}

export function ProgressBar({ value }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, value));

  let color: string;
  if (clamped >= 100) color = 'var(--green)';
  else if (clamped >= 50) color = 'var(--accent)';
  else if (clamped >= 20) color = 'var(--yellow)';
  else color = 'var(--red)';

  return (
    <div className="w-full h-[4px] rounded-full bg-[var(--card2)] overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-300"
        style={{ width: `${clamped}%`, backgroundColor: color }}
      />
    </div>
  );
}
