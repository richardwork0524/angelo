'use client';

interface Spec {
  id: string;
  name: string;
  status: string;
}

interface SpecChainModuleProps {
  title: string;
  body: string | null;
  specs: Spec[];
}

export function SpecChainModule({ title, body, specs }: SpecChainModuleProps) {
  if (!specs || specs.length === 0) return null;

  const doneCount = specs.filter((s) => s.status === 'complete').length;

  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-[var(--r)] p-4">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-[13px] font-semibold text-[var(--text)]">{title}</h3>
        <span className="text-[11px] text-[var(--text3)]">
          {doneCount}/{specs.length}
        </span>
      </div>
      {body && <p className="text-[12px] text-[var(--text3)] mb-3">{body}</p>}

      <div className="flex items-center gap-1 overflow-x-auto scrollbar-none pb-1">
        {specs.map((spec) => {
          let bg: string;
          let text: string;
          let glow: React.CSSProperties = {};

          if (spec.status === 'complete') {
            bg = 'var(--green)';
            text = '#fff';
          } else if (spec.status === 'in_progress') {
            bg = 'var(--accent)';
            text = '#fff';
            glow = { boxShadow: '0 0 8px var(--accent)' };
          } else {
            bg = 'var(--surface)';
            text = 'var(--text3)';
          }

          return (
            <div
              key={spec.id}
              className="flex items-center justify-center min-w-[28px] h-[28px] px-1.5 rounded-[4px] text-[9px] font-bold shrink-0"
              style={{ backgroundColor: bg, color: text, ...glow }}
              title={`${spec.id} ${spec.name}: ${spec.status}`}
            >
              {spec.id}
            </div>
          );
        })}
      </div>
    </div>
  );
}
