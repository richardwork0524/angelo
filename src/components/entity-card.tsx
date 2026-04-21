'use client';

import Link from 'next/link';
import type { EntitySummary, EntityType } from '@/lib/types';

const ETYPE_STYLE: Record<EntityType, { bg: string; text: string; tone: string }> = {
  company:    { bg: 'var(--success-dim)', text: 'var(--success)',   tone: 'success' },
  department: { bg: 'var(--success-dim)', text: 'var(--success)',   tone: 'success' },
  app:        { bg: 'var(--primary-dim)', text: 'var(--primary-2)', tone: 'primary' },
  module:     { bg: 'var(--primary-dim)', text: 'var(--primary-2)', tone: 'primary' },
  feature:    { bg: 'var(--primary-dim)', text: 'var(--primary-2)', tone: 'primary' },
  game:       { bg: 'var(--warn-dim)',    text: 'var(--warn)',      tone: 'warn' },
  website:    { bg: 'var(--warn-dim)',    text: 'var(--warn)',      tone: 'warn' },
  shell:      { bg: 'var(--pink-dim)',    text: 'var(--pink)',      tone: 'pink' },
  meta:       { bg: 'var(--vault-dim)',   text: 'var(--vault)',     tone: 'vault' },
  mission:    { bg: 'var(--purple-dim)',  text: 'var(--purple)',    tone: 'purple' },
};

const CHILD_LABEL: Record<EntityType, string> = {
  company:    'departments',
  department: 'missions',
  app:        'modules',
  module:     'features',
  feature:    'missions',
  game:       'missions',
  website:    'missions',
  shell:      'modules',
  meta:       'systems',
  mission:    'tasks',
};

export function EtypeChip({ type }: { type: EntityType }) {
  const s = ETYPE_STYLE[type];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 6px',
        borderRadius: 3,
        background: s.bg,
        color: s.text,
        fontSize: 10,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '.05em',
      }}
    >
      {type}
    </span>
  );
}

function timeAgo(date: string | null): string {
  if (!date) return '—';
  const then = new Date(date).getTime();
  const days = Math.floor((Date.now() - then) / 86400000);
  if (Number.isNaN(days)) return '—';
  if (days === 0) return 'today';
  if (days === 1) return '1d ago';
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

export function EntityCard({ entity }: { entity: EntitySummary }) {
  const s = ETYPE_STYLE[entity.entity_type];
  const icon = (entity.display_name || entity.child_key).trim().charAt(0).toUpperCase();
  const childLabel = CHILD_LABEL[entity.entity_type];
  const when = timeAgo(entity.last_session_date);

  return (
    <Link
      href={`/entity/${encodeURIComponent(entity.child_key)}`}
      className="transition-all hover:-translate-y-[1px]"
      style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r-lg)',
        padding: 18,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        cursor: 'pointer',
        color: 'inherit',
        textDecoration: 'none',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = 'var(--sh)'; e.currentTarget.style.borderColor = 'var(--border-hi)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = 'var(--border)'; }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 'var(--r-sm)',
              background: s.bg,
              color: s.text,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            {icon}
          </div>
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 'var(--t-h3)',
                fontWeight: 600,
                lineHeight: 1.2,
                color: 'var(--text)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {entity.display_name}
            </div>
            <div
              style={{
                marginTop: 4,
                fontSize: 10,
                color: 'var(--text3)',
                fontFamily: 'ui-monospace, SF Mono, monospace',
              }}
            >
              {entity.child_key}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end', flexShrink: 0 }}>
          <EtypeChip type={entity.entity_type} />
          {entity.current_version && (
            <span
              style={{
                fontFamily: 'ui-monospace, SF Mono, monospace',
                fontSize: 10,
                color: 'var(--text3)',
              }}
            >
              {entity.current_version}
            </span>
          )}
        </div>
      </div>

      {entity.brief && (
        <div
          style={{
            fontSize: 'var(--t-sm)',
            color: 'var(--text2)',
            lineHeight: 1.5,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {entity.brief}
        </div>
      )}

      <div
        style={{
          display: 'flex',
          gap: 12,
          paddingTop: 10,
          borderTop: '1px solid var(--border)',
          marginTop: 'auto',
          fontSize: 'var(--t-tiny)',
          color: 'var(--text3)',
          flexWrap: 'wrap',
        }}
      >
        <span style={{ display: 'flex', gap: 4 }}>
          <span style={{ color: 'var(--text)', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
            {entity.children_count}
          </span>
          {childLabel}
        </span>
        <span style={{ display: 'flex', gap: 4 }}>
          <span style={{ color: 'var(--text)', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
            {entity.tasks_open}
          </span>
          tasks
        </span>
        <span style={{ marginLeft: 'auto', color: when === 'today' ? 'var(--primary-2)' : undefined }}>
          {when}
        </span>
      </div>
    </Link>
  );
}
