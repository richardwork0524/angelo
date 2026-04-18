'use client';

import { useMemo, useState } from 'react';

type Pillar = 'angelo' | 'rinoa-os' | 'supabase' | 'code';

interface VaultRoot {
  id: string;
  name: string;
  pillar: Pillar;
  path: string;
  desc: string;
  href?: string;
  links: string[];
}

const VAULT_ROOT = '/Users/richard/My Drive/Rinoa-OS';
const SUPABASE_URL = 'https://supabase.com/dashboard/project/flxedkwpdbgofgeivntq';

const VAULTS: VaultRoot[] = [
  {
    id: 'VLT-042',
    name: 'Angelo mockups',
    pillar: 'angelo',
    path: 'development/app-development/angelo/mockups/',
    desc: '5 redesign mockups · current source of truth is redesign-focused-v4.html.',
    links: ['ANG'],
  },
  {
    id: 'VLT-041',
    name: 'Angelo app root',
    pillar: 'angelo',
    path: 'development/app-development/angelo/',
    desc: 'Summary, tasks, session logs. Code at /Users/richard/code/angelo/ (R29).',
    links: ['ANG'],
  },
  {
    id: 'VLT-CODE',
    name: 'Angelo code',
    pillar: 'code',
    path: '/Users/richard/code/angelo/',
    desc: 'Local git-managed working copy. Source for this app. GitHub: richardwork0524/angelo.',
    href: 'file:///Users/richard/code/angelo/',
    links: ['ANG'],
  },
  {
    id: 'VLT-084',
    name: 'Rubii Marketing',
    pillar: 'angelo',
    path: 'development/app-development/rubii-marketing-app/',
    desc: 'PRD, design review module spec, session logs.',
    links: ['RUB'],
  },
  {
    id: 'VLT-RMA',
    name: 'Rinoa command center',
    pillar: 'angelo',
    path: 'development/app-development/rinoa-command-center/',
    desc: 'RCC companion app — archived but vault preserved for reference.',
    links: ['RNA'],
  },
  {
    id: 'VLT-CID',
    name: 'Cid-OS shell',
    pillar: 'angelo',
    path: 'development/app-development/Cid/',
    desc: 'Cid-OS design docs, taxonomy migrations, version scopes, session logs.',
    links: ['CID'],
  },
  {
    id: 'VLT-001',
    name: 'Skills vault',
    pillar: 'rinoa-os',
    path: 'Skill/skills/',
    desc: 'Canonical skill source. Synced across Code / Chat / Cowork via skill-sync.',
    links: ['RNA'],
  },
  {
    id: 'VLT-002',
    name: 'Memory vault',
    pillar: 'rinoa-os',
    path: '.claude/projects/-Users-richard-My-Drive-Rinoa-OS/memory/',
    desc: '30+ memories · MEMORY.md index. Embedded into pgvector for semantic recall.',
    links: ['RNA'],
  },
  {
    id: 'VLT-003',
    name: 'GUIDE (hooks, taxonomy, protocols)',
    pillar: 'rinoa-os',
    path: 'GUIDE/',
    desc: '23 hooks. System protocols: build-session, taxonomy, deploy, feature-first.',
    links: ['RNA'],
  },
  {
    id: 'VLT-HOOKS',
    name: 'Claude hooks',
    pillar: 'rinoa-os',
    path: '.claude-home/hooks/',
    desc: 'Zero-token shell hooks. SessionStart / Stop / Edit / file-change triggers.',
    links: ['RNA'],
  },
  {
    id: 'VLT-SUPA',
    name: 'Supabase — Cid Mega',
    pillar: 'supabase',
    path: 'flxedkwpdbgofgeivntq.supabase.co',
    desc: 'Primary database. 16 angelo_* tables + 4 analytics views.',
    href: SUPABASE_URL,
    links: ['ANG', 'CID'],
  },
  {
    id: 'VLT-SUPA-RUB',
    name: 'Supabase — Rubii Campaign',
    pillar: 'supabase',
    path: 'dzfhjglkdafekkarqnjy.supabase.co',
    desc: 'Rubii Marketing App DB. 12 tables + 40 RLS policies.',
    href: 'https://supabase.com/dashboard/project/dzfhjglkdafekkarqnjy',
    links: ['RUB'],
  },
];

const PILLAR_LABEL: Record<Pillar, string> = {
  angelo:     'ANGELO VAULT',
  'rinoa-os': 'RINOA-OS',
  supabase:   'SUPABASE',
  code:       'CODE',
};

const PILLAR_COLOR: Record<Pillar, string> = {
  angelo:     'var(--primary-2)',
  'rinoa-os': 'var(--vault)',
  supabase:   'var(--success)',
  code:       'var(--info)',
};

type PillarFilter = 'all' | Pillar;

const FILTERS: { key: PillarFilter; label: string }[] = [
  { key: 'all',      label: 'All' },
  { key: 'angelo',   label: 'Angelo' },
  { key: 'rinoa-os', label: 'Rinoa-OS' },
  { key: 'code',     label: 'Code' },
  { key: 'supabase', label: 'Supabase' },
];

function hrefFor(v: VaultRoot): string {
  if (v.href) return v.href;
  if (v.pillar === 'supabase') return SUPABASE_URL;
  return `file://${VAULT_ROOT}/${v.path}`;
}

export default function VaultPage() {
  const [filter, setFilter] = useState<PillarFilter>('all');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return VAULTS.filter((v) => {
      if (filter !== 'all' && v.pillar !== filter) return false;
      if (q) {
        const hay = [v.name, v.path, v.desc, v.id].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [filter, search]);

  const counts = useMemo(() => {
    const base: Record<Pillar, number> = { angelo: 0, 'rinoa-os': 0, supabase: 0, code: 0 };
    for (const v of VAULTS) base[v.pillar] += 1;
    return base;
  }, []);

  return (
    <div className="h-full overflow-y-auto" data-testid="vault-page">
      <div className="max-w-[1280px] mx-auto px-8 py-7" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Page head */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h1 className="font-semibold tracking-tight" style={{ fontSize: 'var(--t-h2)' }}>
            Vault
            <span className="ml-2 font-normal" style={{ color: 'var(--text3)', fontSize: 'var(--t-body)' }}>
              {VAULTS.length} roots · Drive + Code + Supabase
            </span>
          </h1>
          <span
            style={{
              fontSize: 'var(--t-tiny)',
              color: 'var(--text3)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                background: 'var(--success)',
              }}
            />
            Drive path canonical: {VAULT_ROOT.split('/').slice(-2).join('/')}
          </span>
        </div>

        {/* Filter bar */}
        <div
          className="flex items-center gap-2 flex-wrap"
          style={{
            padding: '10px 12px',
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r)',
          }}
        >
          <div className="flex gap-1 flex-wrap items-center">
            {FILTERS.map((t) => (
              <FilterTab key={t.key} active={filter === t.key} onClick={() => setFilter(t.key)}>
                {t.label}
              </FilterTab>
            ))}
          </div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, path, or purpose…"
            style={{
              flex: 1,
              minWidth: 180,
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--r-sm)',
              padding: '6px 12px',
              color: 'var(--text)',
              fontSize: 'var(--t-sm)',
              outline: 'none',
            }}
          />
        </div>

        {/* Grid */}
        {filtered.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '48px 24px',
              background: 'var(--card)',
              border: '1px dashed var(--border)',
              borderRadius: 'var(--r)',
              color: 'var(--text3)',
              fontSize: 'var(--t-sm)',
            }}
          >
            No vault roots match the current filters
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
            {filtered.map((v) => (
              <VaultCard key={v.id} vault={v} />
            ))}
          </div>
        )}

        {/* Stats strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          <StatCell k="Angelo vault" v={String(counts.angelo)} tone="var(--primary-2)" />
          <StatCell k="Rinoa-OS" v={String(counts['rinoa-os'])} tone="var(--vault)" />
          <StatCell k="Code" v={String(counts.code)} tone="var(--info)" />
          <StatCell k="Supabase" v={String(counts.supabase)} tone="var(--success)" />
        </div>
      </div>
    </div>
  );
}

function VaultCard({ vault }: { vault: VaultRoot }) {
  const color = PILLAR_COLOR[vault.pillar];
  return (
    <a
      href={hrefFor(vault)}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        padding: 16,
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r-lg)',
        textDecoration: 'none',
        color: 'var(--text)',
        transition: 'all 120ms',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-1px)';
        e.currentTarget.style.boxShadow = 'var(--sh)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 'var(--t-h3)', fontWeight: 600 }}>{vault.name}</div>
          <div
            style={{
              fontFamily: 'ui-monospace, monospace',
              fontSize: 'var(--t-sm)',
              color: 'var(--vault)',
              lineHeight: 1.4,
              wordBreak: 'break-all',
              marginTop: 4,
            }}
          >
            {vault.path}
          </div>
        </div>
        <span
          style={{
            flex: 'none',
            padding: '2px 8px',
            borderRadius: 999,
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '.04em',
            background: color,
            color: '#fff',
          }}
        >
          {PILLAR_LABEL[vault.pillar]}
        </span>
      </div>
      <div style={{ fontSize: 'var(--t-sm)', color: 'var(--text2)', lineHeight: 1.5 }}>{vault.desc}</div>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 4,
          paddingTop: 8,
          borderTop: '1px solid var(--border)',
          marginTop: 'auto',
          alignItems: 'center',
          fontSize: 'var(--t-tiny)',
          color: 'var(--text3)',
        }}
      >
        <span>Linked:</span>
        {vault.links.map((l) => (
          <span
            key={l}
            style={{
              fontFamily: 'ui-monospace, monospace',
              padding: '1px 6px',
              background: 'var(--primary-dim)',
              color: 'var(--primary-2)',
              borderRadius: 'var(--r-sm)',
              fontWeight: 600,
            }}
          >
            {l}
          </span>
        ))}
        <span style={{ marginLeft: 'auto', color }}>Open ↗</span>
      </div>
    </a>
  );
}

function FilterTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px 12px',
        fontSize: 'var(--t-sm)',
        color: active ? 'var(--primary-2)' : 'var(--text3)',
        background: active ? 'var(--primary-dim)' : 'transparent',
        border: 'none',
        borderRadius: 'var(--r-sm)',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        fontWeight: active ? 500 : 400,
      }}
    >
      {children}
    </button>
  );
}

function StatCell({ k, v, tone }: { k: string; v: string; tone?: string }) {
  return (
    <div
      style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r)',
        padding: '12px 16px',
      }}
    >
      <div style={{ fontSize: 'var(--t-tiny)', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
        {k}
      </div>
      <div style={{ fontSize: 18, fontWeight: 600, fontVariantNumeric: 'tabular-nums', marginTop: 4, color: tone || 'var(--text)' }}>
        {v}
      </div>
    </div>
  );
}
