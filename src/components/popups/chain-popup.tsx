'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PreviewPopup, PopupHead, PopupStats, PopupFooter, PopupBtn } from '@/components/preview-popup';

interface Chain {
  chain_id: string;
  project_key: string;
  title: string;
  entry_point: string | null;
  session_count: number;
  total_cost: number;
  latest_date: string;
  latest_title: string;
}

export function ChainPopup({ chain, open, onClose }: { chain: Chain | null; open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [copyLabel, setCopyLabel] = useState('Copy Chain Handoff');

  if (!chain) return null;

  function handleCopy() {
    const text = [
      `# Chain: ${chain!.chain_id}`,
      `Project: ${chain!.project_key} | Sessions: ${chain!.session_count}`,
      `Total cost: $${chain!.total_cost.toFixed(2)}`,
      '',
      `Latest: ${chain!.latest_title} (${chain!.latest_date})`,
    ].join('\n');
    navigator.clipboard.writeText(text).then(() => {
      setCopyLabel('Copied!');
      setTimeout(() => setCopyLabel('Copy Chain Handoff'), 2000);
    });
  }

  return (
    <PreviewPopup open={open} onClose={onClose}>
      <PopupHead
        icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>}
        iconBg="var(--purple-dim)" iconColor="var(--purple)"
        title={chain.chain_id}
        meta={
          <>
            <span>{chain.latest_title}</span>
            <span>&middot;</span>
            <span>{chain.session_count} sessions</span>
          </>
        }
        onClose={onClose}
      />
      <div className="px-5 py-3.5">
        <PopupStats stats={[
          { label: 'Sessions', value: String(chain.session_count), color: 'var(--accent)' },
          { label: 'Total Cost', value: `$${chain.total_cost.toFixed(2)}`, color: 'var(--green)' },
          { label: 'Project', value: chain.project_key },
        ]} />
        {chain.entry_point && (
          <div className="flex gap-1 flex-wrap mb-2.5">
            <span className="text-[9px] font-semibold px-1.5 py-[1px] rounded-[4px]" style={{ background: 'var(--purple-dim)', color: 'var(--purple)' }}>
              {chain.entry_point}
            </span>
          </div>
        )}
        <div className="text-[12px] text-[var(--text2)] leading-[1.5] mb-3">
          Latest session: <span className="text-[var(--text)]">{chain.latest_title}</span>
          <span className="text-[var(--text3)]"> &middot; {chain.latest_date}</span>
        </div>
      </div>
      <PopupFooter>
        <PopupBtn variant="copy" onClick={handleCopy}>{copyLabel}</PopupBtn>
        <PopupBtn variant="primary" onClick={() => { onClose(); router.push(`/chain/${chain!.chain_id}`); }}>
          Open Full Chain &rarr;
        </PopupBtn>
      </PopupFooter>
    </PreviewPopup>
  );
}
