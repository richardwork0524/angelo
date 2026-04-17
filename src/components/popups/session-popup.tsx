'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PreviewPopup, PopupHead, PopupStats, PopupFooter, PopupBtn } from '@/components/preview-popup';

interface Session {
  id: string;
  project_key: string;
  session_date: string;
  title: string;
  surface: string | null;
  summary: string | null;
  chain_id: string | null;
  entry_point: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  cost_usd: number | null;
  mission: string | null;
}

function fmtTokens(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(0)}K` : String(n);
}

export function SessionPopup({ session, open, onClose }: { session: Session | null; open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [copyLabel, setCopyLabel] = useState('Copy Handoff');

  if (!session) return null;

  const input = session.input_tokens || 0;
  const output = session.output_tokens || 0;
  const cost = session.cost_usd ? Number(session.cost_usd) : 0;

  function handleCopy() {
    const text = [
      `# ${session!.title}`,
      `Project: ${session!.project_key} | Surface: ${session!.surface} | Date: ${session!.session_date}`,
      session!.chain_id ? `Chain: ${session!.chain_id}` : null,
      session!.entry_point ? `Entry: ${session!.entry_point}` : null,
      cost ? `Cost: $${cost.toFixed(2)}` : null,
      '',
      session!.summary || '(no summary)',
    ].filter(Boolean).join('\n');
    navigator.clipboard.writeText(text).then(() => {
      setCopyLabel('Copied!');
      setTimeout(() => setCopyLabel('Copy Handoff'), 2000);
    });
  }

  return (
    <PreviewPopup open={open} onClose={onClose}>
      <PopupHead
        icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>}
        iconBg="var(--accent-dim)" iconColor="var(--accent)"
        title={session.title}
        meta={
          <>
            <span style={{ color: 'var(--accent)' }}>{session.project_key}</span>
            <span>&middot;</span>
            <span>{session.session_date}</span>
            {session.chain_id && <><span>&middot;</span><span>chain: {session.chain_id}</span></>}
          </>
        }
        onClose={onClose}
      />
      <div className="px-5 py-3.5">
        <PopupStats stats={[
          { label: 'Input', value: fmtTokens(input), color: 'var(--accent)' },
          { label: 'Output', value: fmtTokens(output) },
          { label: 'Cost', value: `$${cost.toFixed(2)}`, color: 'var(--green)' },
          { label: 'Tokens', value: fmtTokens(input + output), color: 'var(--text2)' },
        ]} />
        <div className="flex gap-1 flex-wrap mb-2.5">
          {session.surface && <Tag bg="var(--accent-dim)" color="var(--accent)">{session.surface}</Tag>}
          {session.entry_point && <Tag bg="var(--purple-dim)" color="var(--purple)">{session.entry_point}</Tag>}
          {session.mission && <Tag bg="var(--green-dim)" color="var(--green)">{session.mission}</Tag>}
          {session.chain_id && <Tag bg="var(--green-dim)" color="var(--green)">Chain</Tag>}
        </div>
        {session.summary && (
          <p className="text-[12px] text-[var(--text2)] leading-[1.5] line-clamp-3 mb-3">{session.summary}</p>
        )}
      </div>
      <PopupFooter>
        <PopupBtn variant="copy" onClick={handleCopy}>{copyLabel}</PopupBtn>
        <PopupBtn variant="primary" onClick={() => { onClose(); router.push(`/session/${session.id}`); }}>
          Open Full Session &rarr;
        </PopupBtn>
      </PopupFooter>
    </PreviewPopup>
  );
}

function Tag({ bg, color, children }: { bg: string; color: string; children: React.ReactNode }) {
  return (
    <span className="text-[9px] font-semibold px-1.5 py-[1px] rounded-[4px]" style={{ background: bg, color }}>
      {children}
    </span>
  );
}
