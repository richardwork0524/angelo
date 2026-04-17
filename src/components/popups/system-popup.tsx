'use client';

import { PreviewPopup, PopupHead, PopupStats, PopupFooter, PopupBtn } from '@/components/preview-popup';

interface HookLog {
  hook_name: string;
  action: string;
  project_key: string | null;
  detail: string | null;
  created_at: string;
  status: string | null;
}

interface SystemData {
  health: string;
  recent_hooks: HookLog[];
  error_count: number;
}

function timeAgo(ts: string): string {
  const mins = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
  if (mins < 60) return mins <= 0 ? 'just now' : `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function SystemPopup({ system, open, onClose }: { system: SystemData | null; open: boolean; onClose: () => void }) {
  if (!system) return null;

  const healthy = system.recent_hooks.filter(h => h.status !== 'error').length;
  const errors = system.error_count;
  const warnings = system.recent_hooks.filter(h => h.status === 'warning').length;
  const isHealthy = system.health === 'healthy';

  return (
    <PreviewPopup open={open} onClose={onClose}>
      <PopupHead
        icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>}
        iconBg={isHealthy ? 'var(--green-dim)' : 'var(--red-dim)'}
        iconColor={isHealthy ? 'var(--green)' : 'var(--red)'}
        title="System Health"
        meta={
          <>
            <span style={{ color: isHealthy ? 'var(--green)' : 'var(--red)' }}>
              {isHealthy ? 'All systems healthy' : `${errors} error(s)`}
            </span>
            <span>&middot;</span>
            <span>{system.recent_hooks.length} hooks tracked</span>
          </>
        }
        onClose={onClose}
      />
      <div className="px-5 py-3.5">
        <PopupStats stats={[
          { label: 'Healthy', value: String(healthy), color: 'var(--green)' },
          { label: 'Errors', value: String(errors), color: errors > 0 ? 'var(--red)' : 'var(--text3)' },
          { label: 'Warnings', value: String(warnings), color: warnings > 0 ? 'var(--yellow)' : 'var(--text3)' },
        ]} />
        <div className="mb-3">
          {system.recent_hooks.slice(0, 5).map((h, i) => (
            <div key={i} className="flex items-center gap-2.5 py-2 border-b border-[var(--border)] last:border-b-0">
              <span className="w-[7px] h-[7px] rounded-full shrink-0" style={{ background: h.status === 'error' ? 'var(--red)' : h.status === 'warning' ? 'var(--yellow)' : 'var(--green)' }} />
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-medium truncate">{h.hook_name}</p>
                <p className="text-[10px] text-[var(--text3)] mt-0.5">{h.detail || h.action} &middot; {timeAgo(h.created_at)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
      <PopupFooter>
        <PopupBtn variant="ghost" onClick={onClose}>Close</PopupBtn>
      </PopupFooter>
    </PreviewPopup>
  );
}
