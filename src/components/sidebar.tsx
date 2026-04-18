'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cachedFetch } from '@/lib/cache';

interface NavItem {
  key: string;
  label: string;
  href: string;
  icon: string;
  countKey?: 'handoffs' | 'notes' | 'entities' | 'vault' | 'sessions' | 'system';
}

const SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: 'Workspace',
    items: [
      { key: 'home',     label: 'Home',     href: '/',         icon: '◉' },
      { key: 'handoffs', label: 'Handoffs', href: '/handoffs', icon: '⇄', countKey: 'handoffs' },
    ],
  },
  {
    title: 'Work',
    items: [
      { key: 'entities', label: 'Entities', href: '/entities', icon: '◈', countKey: 'entities' },
      { key: 'notes',    label: 'Notes',    href: '/notes',    icon: '✎', countKey: 'notes' },
    ],
  },
  {
    title: 'Meta',
    items: [
      { key: 'vault',    label: 'Vault',    href: '/vault',    icon: '◱', countKey: 'vault' },
      { key: 'sessions', label: 'Sessions', href: '/sessions', icon: '◔', countKey: 'sessions' },
      { key: 'system',   label: 'System',   href: '/system',   icon: '◊', countKey: 'system' },
    ],
  },
];

interface SidebarCounts {
  handoffs?: number;
  notes?: number;
  entities?: number;
  vault?: number;
  sessions?: number;
  system?: number;
}

export function Sidebar() {
  const pathname = usePathname();
  const [counts, setCounts] = useState<SidebarCounts>({});

  // Best-effort counts via /api/home — silently degrades if shape doesn't match
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await cachedFetch<{
          handoffs_active?: number;
          notes_unresolved?: number;
          sessions_total?: number;
          entities_total?: number;
          system_issues?: number;
          vault_files?: number;
        }>('/api/home', 30000);
        if (cancelled) return;
        setCounts({
          handoffs: data.handoffs_active,
          notes: data.notes_unresolved,
          sessions: data.sessions_total,
          entities: data.entities_total,
          system: data.system_issues,
          vault: data.vault_files,
        });
      } catch {
        // Silent
      }
    })();
    return () => { cancelled = true; };
  }, []);

  function isActive(item: NavItem): boolean {
    if (item.href === '/') return pathname === '/';
    return pathname?.startsWith(item.href) ?? false;
  }

  return (
    <aside
      className="shrink-0 flex flex-col overflow-y-auto"
      style={{
        width: 220,
        background: 'var(--surface)',
        borderRight: '1px solid var(--border)',
        padding: '20px 12px',
        gap: 4,
      }}
    >
      {SECTIONS.map((section) => (
        <div key={section.title}>
          <div
            style={{
              fontSize: 'var(--t-tiny)',
              textTransform: 'uppercase',
              letterSpacing: '.08em',
              color: 'var(--text4)',
              padding: '16px 10px 6px',
              fontWeight: 600,
            }}
          >
            {section.title}
          </div>
          {section.items.map((item) => {
            const active = isActive(item);
            const count = item.countKey ? counts[item.countKey] : undefined;
            return (
              <Link
                key={item.key}
                href={item.href}
                className="flex items-center gap-3 transition-colors"
                style={{
                  padding: '9px 10px',
                  borderRadius: 'var(--r-sm)',
                  fontSize: 'var(--t-body)',
                  color: active ? 'var(--primary-2)' : 'var(--text2)',
                  background: active ? 'var(--primary-dim)' : 'transparent',
                  fontWeight: active ? 500 : 400,
                  userSelect: 'none',
                }}
                onMouseEnter={(e) => {
                  if (!active) {
                    e.currentTarget.style.background = 'var(--card-alt)';
                    e.currentTarget.style.color = 'var(--text)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = 'var(--text2)';
                  }
                }}
              >
                <span
                  style={{
                    width: 20,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 14,
                    flexShrink: 0,
                  }}
                >
                  {item.icon}
                </span>
                <span className="flex-1">{item.label}</span>
                {count !== undefined && count > 0 && (
                  <span
                    style={{
                      fontSize: 'var(--t-tiny)',
                      color: active ? 'var(--primary-2)' : 'var(--text4)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {count}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      ))}

      <div className="flex-1" />

      {/* Footer — user */}
      <div
        style={{
          padding: '12px 10px',
          borderTop: '1px solid var(--border)',
          marginTop: 12,
        }}
      >
        <div className="flex items-center gap-2.5" style={{ fontSize: 'var(--t-sm)' }}>
          <div
            className="flex items-center justify-center text-white font-semibold"
            style={{
              width: 30,
              height: 30,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #A78BFA, var(--primary))',
              fontSize: 12,
            }}
          >
            RY
          </div>
          <div>
            <div>Richard</div>
            <div style={{ color: 'var(--text3)', fontSize: 'var(--t-tiny)' }}>Mini · primary</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
