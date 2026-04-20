'use client';

import { useEffect, useRef, type ReactNode } from 'react';

interface PreviewPopupProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}

export function PreviewPopup({ open, onClose, children }: PreviewPopupProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center sm:p-6"
      style={{ background: 'rgba(0,0,0,.45)' }}
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div
        className="bg-[var(--surface)] rounded-t-[16px] sm:rounded-[16px] w-full max-w-[480px] flex flex-col max-h-[85vh]"
        style={{
          boxShadow: '0 8px 40px rgba(0,0,0,.4), 0 2px 12px rgba(0,0,0,.2)',
          animation: 'popIn .2s ease',
        }}
      >
        {/* Mobile handle */}
        <div className="sm:hidden flex justify-center pt-2 pb-1 shrink-0">
          <div className="w-8 h-1 rounded-full bg-[var(--border2)]" />
        </div>
        {children}
      </div>
      <style>{`@keyframes popIn{from{opacity:0;transform:scale(.95)translateY(20px)}to{opacity:1;transform:scale(1)translateY(0)}}@media(min-width:640px){@keyframes popIn{from{opacity:0;transform:scale(.95)}to{opacity:1;transform:scale(1)}}}`}</style>
    </div>
  );
}

/* Shared popup subcomponents */

export function PopupHead({ icon, iconBg, iconColor, title, subtitle, meta, onClose }: {
  icon: ReactNode;
  iconBg: string;
  iconColor: string;
  title: string;
  subtitle?: string;
  meta: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="flex items-start gap-2.5 px-5 pt-4 shrink-0">
      <div className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0" style={{ background: iconBg, color: iconColor }}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-[15px] font-bold leading-tight">{title}</h3>
        {subtitle && <p className="text-[12px] text-[var(--text2)] mt-0.5">{subtitle}</p>}
        <div className="text-[11px] text-[var(--text2)] flex gap-1.5 items-center flex-wrap mt-1">{meta}</div>
      </div>
      <button onClick={onClose} className="w-7 h-7 rounded-[6px] flex items-center justify-center text-[var(--text3)] hover:bg-[var(--card)] hover:text-[var(--text)] transition-colors shrink-0 text-[18px]">
        &times;
      </button>
    </div>
  );
}

export function PopupBody({ children }: { children: ReactNode }) {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      {children}
    </div>
  );
}

export function PopupStats({ stats }: { stats: { label: string; value: string; color?: string }[] }) {
  return (
    <div className="flex bg-[var(--card)] rounded-[10px] overflow-hidden mb-3">
      {stats.map((s, i) => (
        <div key={i} className="flex-1 text-center py-2.5 px-1.5" style={{ borderRight: i < stats.length - 1 ? '1px solid var(--border)' : 'none' }}>
          <div className="text-[15px] font-bold tabular-nums" style={{ color: s.color || 'var(--text)' }}>{s.value}</div>
          <div className="text-[8px] font-semibold uppercase text-[var(--text3)] tracking-[0.03em] mt-0.5">{s.label}</div>
        </div>
      ))}
    </div>
  );
}

export function PopupFooter({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-2 px-5 py-3 justify-end shrink-0 border-t border-[var(--border)] flex-wrap">
      {children}
    </div>
  );
}

export function PopupBtn({ variant, onClick, children }: {
  variant: 'primary' | 'ghost' | 'copy';
  onClick: () => void;
  children: ReactNode;
}) {
  const base = 'px-4 py-2 rounded-[10px] text-[12px] font-semibold transition-all';
  const styles = {
    primary: 'bg-[var(--accent)] text-white hover:opacity-90',
    ghost: 'bg-[var(--accent-dim)] text-[var(--accent)] hover:bg-[var(--card2)]',
    copy: 'bg-[var(--green-dim)] text-[var(--green)] hover:opacity-80',
  };
  return <button onClick={onClick} className={`${base} ${styles[variant]}`}>{children}</button>;
}
