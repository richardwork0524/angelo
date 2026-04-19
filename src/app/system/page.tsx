'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { cachedFetch } from '@/lib/cache';

type SystemKey = 'hook' | 'memory' | 'taxonomy' | 'naming' | 'skill' | 'deploy';

interface SystemResponse {
  hook: {
    distinct_24h: number;
    total_7d: number;
    recent: { hook_name: string; action: string; project_key: string | null; detail: string | null; created_at: string }[];
  };
  deploy: {
    total: number;
    last_deploy_date: string | null;
    recent: { project_key: string; module_code: string | null; module_slug: string | null; vercel_project: string | null; custom_domain: string | null; last_deploy: string | null }[];
  };
  skill: { total: number; drift: number; undeployed: number; last_updated: string | null };
  session: { last_at: string | null };
}

interface CardMeta {
  key: SystemKey;
  icon: string;
  name: string;
  tone: string;
  desc: string;
}

const CARDS: CardMeta[] = [
  { key: 'hook',     icon: '🎣', name: 'Hook system',     tone: 'var(--warn)',      desc: 'Zero-token shell scripts on Claude Code events. No tokens consumed unless EOS is verbose.' },
  { key: 'deploy',   icon: '🚀', name: 'Deploy system',   tone: 'var(--success)',   desc: 'Git-tracked code at /Users/richard/code/<project>/. Vercel auto-deploy from main.' },
  { key: 'skill',    icon: '🔧', name: 'Skill system',    tone: 'var(--primary-2)', desc: 'Reusable capability packages in Skill/skills/. Vault is source of truth; synced to Code / Chat / Cowork.' },
  { key: 'memory',   icon: '🧠', name: 'Memory system',   tone: 'var(--vault)',     desc: '3-layer: local MD files + Supabase angelo_memories + pgvector embeddings. Semantic recall with freshness decay.' },
  { key: 'taxonomy', icon: '🗂',  name: 'Taxonomy system', tone: 'var(--info)',      desc: 'Canonical enums (R27). Enforced via Supabase CHECK constraints. Changes versioned here.' },
  { key: 'naming',   icon: '🏷',  name: 'Naming system',   tone: 'var(--pink)',      desc: 'Hierarchical IDs. Format: {PROJECT}-{MODULE}-{TYPE}{NNN}[-T{NN}][-S{NN}]. project_key as Supabase FK root.' },
];

const TAXONOMY_ENUMS: Record<string, string[]> = {
  'Statuses (project lifecycle)': ['ACTIVE', 'BUILDING', 'PLANNING', 'TESTING', 'DEPLOYED', 'ARCHIVED', 'BLOCKED', 'IDEA'],
  'Task types':                   ['TASK', 'BUG', 'IDEA', 'BLOCKER', 'URGENT', 'OWNER_ACTION', 'MISSION', 'ROOT', 'VERSION', 'LOG'],
  'Priorities':                   ['P0', 'P1', 'P2'],
  'Cowork job statuses':          ['PENDING', 'RUNNING', 'REVIEW', 'DONE', 'PARTIAL', 'BLOCKED_HUMAN', 'CHAIN_CONTINUE'],
  'Note types':                   ['GAP', 'IDEA', 'OBSERVATION', 'REVISIT'],
  'Session event types':          ['decision', 'note', 'milestone', 'rollback', 'context_change', 'deploy', 'code_push', 'deploy_verify', 'webhook'],
  'Surfaces':                     ['CHAT (C)', 'CODE (X)', 'COWORK (W)', 'MOBILE (M)'],
  'Handoff purposes':             ['CREATE', 'DEBUG', 'UPDATE'],
};

const PROJECT_CODES: { code: string; name: string; type: string }[] = [
  { code: 'CID', name: 'Cid-OS',             type: 'shell' },
  { code: 'ANG', name: 'Angelo',             type: 'app' },
  { code: 'RUB', name: 'Rubii',              type: 'company' },
  { code: 'RNA', name: 'Rinoa-OS',           type: 'meta' },
  { code: 'IDR', name: 'Idle Ragnarok Pet',  type: 'game' },
  { code: 'YHG', name: 'Yhang.ai',           type: 'app' },
  { code: 'GHM', name: 'Golden Home',        type: 'company' },
  { code: 'HKA', name: 'Hookka',             type: 'company' },
  { code: 'CON', name: 'The Conts',          type: 'company' },
  { code: 'CAR', name: 'Carres',             type: 'company' },
];

const TYPE_CODES: { code: string; name: string; ex: string }[] = [
  { code: 'H',   name: 'Handoff',          ex: 'ANG-UI-H014' },
  { code: 'M',   name: 'Mission',          ex: 'ANG-UI-M019' },
  { code: 'T',   name: 'Task',             ex: 'ANG-UI-M019-T01' },
  { code: 'S',   name: 'Subtask',          ex: 'ANG-UI-M019-T01-S01' },
  { code: 'F',   name: 'Feature',          ex: 'CID-FR-F004' },
  { code: 'FN',  name: 'Function',         ex: 'CID-FR-F004-FN02' },
  { code: 'MEC', name: 'Game mechanic',    ex: 'IDR-MEC01' },
  { code: 'CSV', name: 'CSV schema',       ex: 'IDR-CSV01' },
  { code: 'SES', name: 'Session (global)', ex: 'SES-097' },
  { code: 'NOT', name: 'Note (global)',    ex: 'NOT-042' },
  { code: 'VLT', name: 'Vault (global)',   ex: 'VLT-042' },
];

function relativeTime(iso: string | null): string {
  if (!iso) return '—';
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function SystemPage() {
  const [data, setData] = useState<SystemResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [openKey, setOpenKey] = useState<SystemKey | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const d = await cachedFetch<SystemResponse>('/api/system', 20000);
      setData(d);
    } catch {
      setData(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  function statFor(key: SystemKey): { value: string; sub: string } {
    if (!data) return { value: '…', sub: '' };
    if (key === 'hook')     return { value: `${data.hook.distinct_24h}`, sub: `hooks active · ${data.hook.total_7d} events 7d` };
    if (key === 'deploy')   return { value: `${data.deploy.total}`, sub: `deployments · last ${data.deploy.last_deploy_date || '—'}` };
    if (key === 'skill')    return { value: `${data.skill.total}`, sub: `${data.skill.drift} drift · ${data.skill.undeployed} undeployed` };
    if (key === 'memory')   return { value: '30+', sub: 'memories · pgvector-embedded' };
    if (key === 'taxonomy') return { value: `${Object.keys(TAXONOMY_ENUMS).length}`, sub: 'enum groups · 50+ values' };
    if (key === 'naming')   return { value: `${PROJECT_CODES.length}+${TYPE_CODES.length}`, sub: 'project · type codes' };
    return { value: '—', sub: '' };
  }

  return (
    <div className="h-full overflow-y-auto" data-testid="system-page">
      <div className="max-w-[1280px] mx-auto px-4 md:px-8 py-5 md:py-7" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h1 className="font-semibold tracking-tight" style={{ fontSize: 'var(--t-h2)' }}>
            System
            <span className="ml-2 font-normal" style={{ color: 'var(--text3)', fontSize: 'var(--t-body)' }}>
              {CARDS.length} core layers · click a card to drill
            </span>
          </h1>
          {data?.session.last_at && (
            <div style={{ fontSize: 'var(--t-tiny)', color: 'var(--text3)' }}>
              Last session {relativeTime(data.session.last_at)}
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center" style={{ height: 180 }}>
            <div className="w-6 h-6 rounded-full border-2 border-[var(--primary)] border-t-transparent animate-spin" />
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
            {CARDS.map((c) => {
              const s = statFor(c.key);
              const isOpen = openKey === c.key;
              return (
                <button
                  key={c.key}
                  onClick={() => setOpenKey(isOpen ? null : c.key)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                    padding: 20,
                    background: 'var(--card)',
                    border: `1px solid ${isOpen ? c.tone : 'var(--border)'}`,
                    borderRadius: 'var(--r-lg)',
                    textAlign: 'left',
                    cursor: 'pointer',
                    boxShadow: isOpen ? 'var(--sh)' : 'none',
                    transition: 'all 140ms',
                    color: 'var(--text)',
                  }}
                  onMouseEnter={(e) => { if (!isOpen) e.currentTarget.style.transform = 'translateY(-1px)'; }}
                  onMouseLeave={(e) => { if (!isOpen) e.currentTarget.style.transform = 'translateY(0)'; }}
                >
                  <div style={{ fontSize: 28 }}>{c.icon}</div>
                  <div style={{ fontSize: 'var(--t-h3)', fontWeight: 600 }}>{c.name}</div>
                  <div style={{ fontSize: 'var(--t-sm)', color: 'var(--text2)', lineHeight: 1.5 }}>{c.desc}</div>
                  <div
                    style={{
                      display: 'flex',
                      gap: 10,
                      padding: '10px 0 0',
                      borderTop: '1px solid var(--border)',
                      marginTop: 'auto',
                      fontSize: 'var(--t-tiny)',
                      color: 'var(--text3)',
                      flexWrap: 'wrap',
                      alignItems: 'baseline',
                    }}
                  >
                    <span>
                      <span style={{ fontSize: 18, fontWeight: 600, color: c.tone, marginRight: 6 }}>{s.value}</span>
                      {s.sub}
                    </span>
                    <span style={{ marginLeft: 'auto', color: c.tone }}>{isOpen ? 'Hide ▴' : 'Drill →'}</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Inline detail */}
        {openKey && data && <SystemDetail systemKey={openKey} data={data} />}
      </div>
    </div>
  );
}

function SystemDetail({ systemKey, data }: { systemKey: SystemKey; data: SystemResponse }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        padding: 20,
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r-lg)',
      }}
    >
      {systemKey === 'hook' && <HookDetail data={data.hook} />}
      {systemKey === 'deploy' && <DeployDetail data={data.deploy} />}
      {systemKey === 'skill' && <SkillDetail data={data.skill} />}
      {systemKey === 'memory' && <MemoryDetail />}
      {systemKey === 'taxonomy' && <TaxonomyDetail />}
      {systemKey === 'naming' && <NamingDetail />}
    </div>
  );
}

function SectionTitle({ children, count }: { children: React.ReactNode; count?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
      <div style={{ fontSize: 'var(--t-tiny)', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 600 }}>
        {children}
      </div>
      {count != null && (
        <span style={{ fontSize: 'var(--t-tiny)', color: 'var(--text3)', fontVariantNumeric: 'tabular-nums' }}>
          {count}
        </span>
      )}
    </div>
  );
}

function HookDetail({ data }: { data: SystemResponse['hook'] }) {
  return (
    <>
      <SectionTitle count={data.recent.length}>Recent activity (24h)</SectionTitle>
      {data.recent.length === 0 ? (
        <div style={{ color: 'var(--text3)', fontSize: 'var(--t-sm)' }}>No hook events in the last 24 hours.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {data.recent.map((h, i) => (
            <div
              key={i}
              style={{
                display: 'grid',
                gridTemplateColumns: 'auto 1fr auto auto',
                gap: 12,
                padding: '8px 12px',
                background: 'var(--bg)',
                borderRadius: 'var(--r-sm)',
                alignItems: 'center',
                fontSize: 'var(--t-sm)',
              }}
            >
              <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 'var(--t-tiny)', color: 'var(--primary-2)', minWidth: 120 }}>
                {h.hook_name}
              </span>
              <span style={{ color: 'var(--text2)' }}>{h.action} {h.detail ? `· ${h.detail}` : ''}</span>
              <span style={{ color: 'var(--text3)', fontSize: 'var(--t-tiny)' }}>{h.project_key || '—'}</span>
              <span style={{ color: 'var(--text3)', fontSize: 'var(--t-tiny)' }}>{relativeTime(h.created_at)}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function DeployDetail({ data }: { data: SystemResponse['deploy'] }) {
  return (
    <>
      <SectionTitle count={data.recent.length}>Recent deployments</SectionTitle>
      {data.recent.length === 0 ? (
        <div style={{ color: 'var(--text3)', fontSize: 'var(--t-sm)' }}>No deployments recorded.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {data.recent.map((d, i) => (
            <div
              key={i}
              style={{
                display: 'grid',
                gridTemplateColumns: 'auto 1fr 1fr auto',
                gap: 12,
                padding: '8px 12px',
                background: 'var(--bg)',
                borderRadius: 'var(--r-sm)',
                alignItems: 'center',
                fontSize: 'var(--t-sm)',
              }}
            >
              <span style={{ fontSize: 'var(--t-tiny)', fontWeight: 600, color: 'var(--primary-2)', minWidth: 60 }}>
                {d.module_code || '—'}
              </span>
              <span style={{ color: 'var(--text)' }}>{d.module_slug || d.project_key}</span>
              <span style={{ color: 'var(--text3)', fontSize: 'var(--t-tiny)', fontFamily: 'ui-monospace' }}>
                {d.custom_domain || d.vercel_project || '—'}
              </span>
              <span style={{ color: 'var(--text3)', fontSize: 'var(--t-tiny)' }}>{d.last_deploy || '—'}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function SkillDetail({ data }: { data: SystemResponse['skill'] }) {
  return (
    <>
      <SectionTitle>Overview</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        <MiniStat label="Total" value={String(data.total)} />
        <MiniStat label="With drift" value={String(data.drift)} tone={data.drift > 0 ? 'var(--warn)' : 'var(--text)'} />
        <MiniStat label="Undeployed" value={String(data.undeployed)} tone={data.undeployed > 0 ? 'var(--danger)' : 'var(--text)'} />
        <MiniStat label="Last updated" value={data.last_updated ? relativeTime(data.last_updated) : '—'} />
      </div>
    </>
  );
}

function MemoryDetail() {
  return (
    <>
      <SectionTitle>About</SectionTitle>
      <p style={{ fontSize: 'var(--t-sm)', color: 'var(--text2)', lineHeight: 1.6, margin: 0 }}>
        3-layer memory: local markdown files in the vault, synced to Supabase <code>angelo_memories</code>,
        embedded into pgvector for semantic recall with freshness decay. Types: <b>user</b>, <b>feedback</b>,
        <b> project</b>, <b>reference</b>. Indexed by <code>MEMORY.md</code>.
      </p>
      <div
        style={{
          fontSize: 'var(--t-tiny)',
          color: 'var(--text3)',
          fontFamily: 'ui-monospace, monospace',
          background: 'var(--bg)',
          padding: '8px 12px',
          borderRadius: 'var(--r-sm)',
          overflow: 'auto',
        }}
      >
        .claude/projects/-Users-richard-My-Drive-Rinoa-OS/memory/
      </div>
    </>
  );
}

function TaxonomyDetail() {
  return (
    <>
      <SectionTitle count={Object.keys(TAXONOMY_ENUMS).length}>Canonical enums</SectionTitle>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {Object.entries(TAXONOMY_ENUMS).map(([title, vals]) => (
          <div key={title}>
            <div style={{ fontSize: 'var(--t-tiny)', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 600, marginBottom: 6 }}>
              {title}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 6 }}>
              {vals.map((v) => (
                <div
                  key={v}
                  style={{
                    background: 'var(--bg)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--r-sm)',
                    padding: '6px 10px',
                    fontSize: 'var(--t-tiny)',
                    fontFamily: 'ui-monospace, monospace',
                    color: 'var(--text)',
                  }}
                >
                  {v}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function NamingDetail() {
  return (
    <>
      <SectionTitle count={PROJECT_CODES.length}>Project codes</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 6 }}>
        {PROJECT_CODES.map((p) => (
          <div
            key={p.code}
            style={{
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--r-sm)',
              padding: '8px 10px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 600, color: 'var(--primary-2)' }}>
              {p.code}
            </span>
            <span style={{ fontSize: 'var(--t-tiny)', color: 'var(--text3)', textAlign: 'right' }}>
              {p.name} · {p.type}
            </span>
          </div>
        ))}
      </div>
      <SectionTitle count={TYPE_CODES.length}>Type codes</SectionTitle>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {TYPE_CODES.map((t) => (
          <div
            key={t.code}
            style={{
              display: 'grid',
              gridTemplateColumns: 'auto 1fr auto',
              gap: 12,
              padding: '8px 12px',
              background: 'var(--bg)',
              borderRadius: 'var(--r-sm)',
              alignItems: 'center',
              fontSize: 'var(--t-sm)',
            }}
          >
            <span
              style={{
                fontFamily: 'ui-monospace, monospace',
                fontSize: 'var(--t-tiny)',
                fontWeight: 600,
                color: 'var(--primary-2)',
                minWidth: 36,
              }}
            >
              {t.code}
            </span>
            <span style={{ color: 'var(--text)' }}>{t.name}</span>
            <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 'var(--t-tiny)', color: 'var(--text3)' }}>
              {t.ex}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div
      style={{
        background: 'var(--bg)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r-sm)',
        padding: '10px 12px',
      }}
    >
      <div style={{ fontSize: 'var(--t-tiny)', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
        {label}
      </div>
      <div
        style={{
          fontSize: 'var(--t-h3)',
          fontWeight: 600,
          fontVariantNumeric: 'tabular-nums',
          marginTop: 4,
          color: tone || 'var(--text)',
        }}
      >
        {value}
      </div>
    </div>
  );
}
