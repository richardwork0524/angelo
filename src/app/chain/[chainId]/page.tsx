'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { StickyHeader } from '@/components/sticky-header';
import { cachedFetch } from '@/lib/cache';

interface ChainSession {
  id: string;
  session_date: string;
  title: string | null;
  surface: string | null;
  summary: string | null;
  project_key: string;
  entry_point: string | null;
  chain_id: string;
  mission: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  cost_usd: number | null;
  sequence: number;
  cumulative_cost: number;
}

interface ChainDetail {
  chain_id: string;
  project_key: string;
  latest_title: string;
  session_count: number;
  total_cost: number;
  total_input: number;
  total_output: number;
  timeline: ChainSession[];
}

function fmtTokens(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(0)}K` : String(n);
}

export default function ChainDetailPage() {
  const { chainId } = useParams<{ chainId: string }>();
  const router = useRouter();
  const [data, setData] = useState<ChainDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [copyLabel, setCopyLabel] = useState('Copy Chain Handoff');

  const fetchChain = useCallback(async () => {
    try {
      const d = await cachedFetch<ChainDetail>(`/api/chains/${chainId}`, 15000);
      setData(d);
    } catch {
      setData(null);
    }
    setLoading(false);
  }, [chainId]);

  useEffect(() => { fetchChain(); }, [fetchChain]);

  function handleCopy() {
    if (!data) return;
    const text = [
      `# Chain: ${data.chain_id}`,
      `Project: ${data.project_key} | Sessions: ${data.session_count} | Cost: $${data.total_cost.toFixed(2)}`,
      `Tokens: ${fmtTokens(data.total_input)} in / ${fmtTokens(data.total_output)} out`,
      '',
      '## Timeline',
      ...data.timeline.map((s) =>
        `${s.sequence}. [${s.session_date}] ${s.title || 'Untitled'} — $${(Number(s.cost_usd) || 0).toFixed(2)}`
      ),
    ].join('\n');
    navigator.clipboard.writeText(text).then(() => {
      setCopyLabel('Copied!');
      setTimeout(() => setCopyLabel('Copy Chain Handoff'), 2000);
    });
  }

  if (loading) {
    return (
      <div className="flex flex-col h-full min-h-0 bg-[var(--bg)]">
        <StickyHeader title="Chain" showBack />
        <main className="max-w-[720px] mx-auto px-4 py-6 text-[var(--text3)]">Loading...</main>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col h-full min-h-0 bg-[var(--bg)]">
        <StickyHeader title="Chain" showBack />
        <main className="max-w-[720px] mx-auto px-4 py-6">
          <p className="text-[var(--text3)] text-[13px]">Chain not found.</p>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0 bg-[var(--bg)]">
      <StickyHeader title={data.chain_id} showBack />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-[720px] mx-auto px-4 py-5 w-full">
          <h1 className="text-[20px] font-bold mb-1">{data.chain_id}</h1>
          <p className="text-[12px] text-[var(--text2)] mb-4">
            {data.latest_title} &middot; {data.project_key}
          </p>

          {/* Stat Bar */}
          <div className="flex bg-[var(--card)] rounded-[16px] overflow-hidden mb-5" style={{ boxShadow: '0 2px 12px rgba(0,0,0,.1)' }}>
            <StatCell label="Sessions" value={`${data.session_count}`} color="var(--accent)" />
            <StatCell label="Total Cost" value={`$${data.total_cost.toFixed(2)}`} color="var(--green)" />
            <StatCell label="Input" value={fmtTokens(data.total_input)} />
            <StatCell label="Output" value={fmtTokens(data.total_output)} />
          </div>

          {/* Copy button */}
          <div className="mb-5">
            <button
              onClick={handleCopy}
              className="px-4 py-2 rounded-[10px] text-[12px] font-semibold transition-all bg-[var(--green-dim)] text-[var(--green)] hover:opacity-80"
            >
              {copyLabel}
            </button>
          </div>

          {/* Timeline */}
          <section>
            <h2 className="text-[11px] font-bold uppercase tracking-[0.05em] text-[var(--text3)] mb-3">Timeline</h2>
            <div className="relative pl-7">
              <div className="absolute left-[9px] top-[6px] bottom-[6px] w-[2px] bg-[var(--border)] rounded-sm" />
              {data.timeline.map((s, i) => {
                const isLast = i === data.timeline.length - 1;
                const dotColor = isLast ? 'var(--accent)' : 'var(--green)';
                const dotShadow = isLast ? '0 0 8px var(--accent)' : 'none';
                return (
                  <div key={s.id} className="relative pb-4 last:pb-0">
                    <div
                      className="absolute -left-7 top-[2px] w-[18px] h-[18px] rounded-full flex items-center justify-center text-[8px] font-bold text-white z-[1]"
                      style={{ background: dotColor, boxShadow: dotShadow }}
                    >
                      {isLast ? s.sequence : '✓'}
                    </div>
                    <div
                      className="cursor-pointer hover:bg-[var(--card2)] -mx-2 px-2 py-1 rounded-[8px] transition-colors"
                      onClick={() => router.push(`/session/${s.id}`)}
                    >
                      <p className="text-[12px] font-semibold" style={{ color: isLast ? 'var(--text)' : 'var(--text)' }}>
                        S{s.sequence}: {s.title || 'Untitled'}
                      </p>
                      <p className="text-[10px] text-[var(--text3)] mt-0.5">
                        {s.session_date}
                        {s.surface && <> &middot; <span style={{ color: s.surface === 'CODE' ? 'var(--accent)' : s.surface === 'CHAT' ? 'var(--green)' : 'var(--purple)' }}>{s.surface}</span></>}
                        &middot; {fmtTokens((s.input_tokens || 0) + (s.output_tokens || 0))}
                        &middot; <span style={{ color: 'var(--green)' }}>${(Number(s.cost_usd) || 0).toFixed(2)}</span>
                        &middot; cumulative: ${s.cumulative_cost.toFixed(2)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

function StatCell({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex-1 text-center py-3.5 px-2" style={{ borderRight: '1px solid var(--border)' }}>
      <div className="text-[17px] font-bold tabular-nums" style={{ color: color || 'var(--text)' }}>{value}</div>
      <div className="text-[9px] font-semibold uppercase text-[var(--text3)] tracking-[0.03em] mt-0.5">{label}</div>
    </div>
  );
}
