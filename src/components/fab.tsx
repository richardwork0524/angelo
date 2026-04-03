'use client';

interface FabProps {
  onPress: () => void;
}

export function Fab({ onPress }: FabProps) {
  return (
    <button
      onClick={onPress}
      aria-label="Quick capture"
      className="md:hidden fixed z-40 w-12 h-12 rounded-full bg-[var(--accent)] text-white shadow-[0_4px_12px_rgba(0,0,0,0.3)] flex items-center justify-center active:scale-95 transition-transform"
      style={{ bottom: 'calc(60px + var(--safe-b, 0px) + 16px)', right: '16px' }}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
    </button>
  );
}
