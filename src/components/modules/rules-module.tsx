'use client';

interface RulesModuleProps {
  title: string;
  body: string | null;
  metadata: {
    rule_count?: number;
    categories?: string[];
    recent_changes?: string[];
  };
}

export function RulesModule({ title, body, metadata }: RulesModuleProps) {
  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-[var(--r)] p-4">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-[13px] font-semibold text-[var(--text)]">{title}</h3>
        {metadata.rule_count && (
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-[var(--purple-dim)] text-[var(--purple)] font-semibold">
            {metadata.rule_count} rules
          </span>
        )}
      </div>
      {body && <p className="text-[12px] text-[var(--text3)] mb-3">{body}</p>}

      {metadata.categories && metadata.categories.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {metadata.categories.map((cat) => (
            <span
              key={cat}
              className="text-[10px] px-2 py-1 rounded-[6px] bg-[var(--card2)] text-[var(--text2)] font-medium"
            >
              {cat}
            </span>
          ))}
        </div>
      )}

      {metadata.recent_changes && metadata.recent_changes.length > 0 && (
        <div className="space-y-1">
          <span className="text-[10px] font-semibold text-[var(--text3)] uppercase tracking-wide">Recent</span>
          {metadata.recent_changes.map((change, i) => (
            <p key={i} className="text-[11px] text-[var(--text2)] leading-snug">{change}</p>
          ))}
        </div>
      )}
    </div>
  );
}
