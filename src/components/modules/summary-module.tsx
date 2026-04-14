'use client';

interface SummaryModuleProps {
  title: string;
  body: string | null;
}

export function SummaryModule({ title, body }: SummaryModuleProps) {
  if (!body) return null;

  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-[var(--r)] p-4">
      <h3 className="text-[13px] font-semibold text-[var(--text)] mb-2">{title}</h3>
      <p className="text-[13px] text-[var(--text2)] leading-relaxed">{body}</p>
    </div>
  );
}
