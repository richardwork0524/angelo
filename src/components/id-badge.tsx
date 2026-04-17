'use client';

import { useState } from 'react';

/**
 * Small pill showing an ID/key with click-to-copy.
 * Use for: task_code, handoff_code, app_key, module_key, feature_key, rinoa_path.
 */
export function IdBadge({
  value,
  label,
  kind = 'key',
  size = 'sm',
}: {
  value: string | null | undefined;
  label?: string;
  kind?: 'key' | 'path' | 'uuid' | 'code';
  size?: 'xs' | 'sm';
}) {
  const [copied, setCopied] = useState(false);
  if (!value) return null;

  const palette = {
    key: { bg: 'var(--accent-dim)', fg: 'var(--accent)' },
    path: { bg: 'var(--green-dim)', fg: 'var(--green)' },
    uuid: { bg: 'var(--card2, var(--card))', fg: 'var(--text3)' },
    code: { bg: 'var(--purple-dim)', fg: 'var(--purple)' },
  }[kind];

  const fontSize = size === 'xs' ? 9 : 10;
  const pad = size === 'xs' ? '1px 5px' : '2px 6px';

  // Abbreviate long paths + uuids
  const display = kind === 'uuid' && value.length > 8 ? value.slice(0, 8) : value;

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(value).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        });
      }}
      title={`${label ? label + ': ' : ''}${value}${copied ? ' (copied)' : ' — click to copy'}`}
      className="font-mono font-semibold rounded-[4px] transition-opacity hover:opacity-80 cursor-pointer"
      style={{
        fontSize,
        padding: pad,
        background: copied ? 'var(--green-dim)' : palette.bg,
        color: copied ? 'var(--green)' : palette.fg,
        lineHeight: 1.4,
      }}
    >
      {copied ? '✓ copied' : display}
    </button>
  );
}
