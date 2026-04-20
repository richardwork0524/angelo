'use client';

type NodeState = 'done' | 'current' | 'future';

interface ChainNode {
  key: string;
  label: string;
  phaseValues: string[];
}

const NODES: ChainNode[] = [
  { key: 'PRD',   label: 'PRD',   phaseValues: ['S1', 'S1.5'] },
  { key: 'Scope', label: 'Scope', phaseValues: ['S2', 'S3', 'S4', 'S5'] },
  { key: 'Build', label: 'Build', phaseValues: ['S5.5', 'S6'] },
  { key: 'QA',    label: 'QA',    phaseValues: ['S7'] },
  { key: 'Ship',  label: 'Ship',  phaseValues: ['S8', 'TEST', 'DEPLOYED'] },
];

function getNodeState(nodeIndex: number, currentNodeIndex: number): NodeState {
  if (currentNodeIndex === -1) return 'future';
  if (nodeIndex < currentNodeIndex) return 'done';
  if (nodeIndex === currentNodeIndex) return 'current';
  return 'future';
}

function getCurrentNodeIndex(buildPhase: string | null | undefined): number {
  if (!buildPhase) return -1;
  const normalized = buildPhase.trim().toUpperCase();
  return NODES.findIndex((n) =>
    n.phaseValues.some((v) => v.toUpperCase() === normalized)
  );
}

// SVG icons inline — no external dep
function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M2 6L5 9L10 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PulseDot() {
  return (
    <span
      style={{
        display: 'inline-block',
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: 'currentColor',
        animation: 'pulse-dot 1.4s ease-in-out infinite',
      }}
    />
  );
}

function ChevronIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
      <path d="M3 2L7 5L3 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

interface SpecChainVisualProps {
  buildPhase: string | null | undefined;
  className?: string;
}

export function SpecChainVisual({ buildPhase, className = '' }: SpecChainVisualProps) {
  const currentNodeIndex = getCurrentNodeIndex(buildPhase);

  return (
    <>
      {/* Pulse animation keyframes */}
      <style>{`
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.8); }
        }
      `}</style>
      <div
        className={className}
        style={{ display: 'flex', alignItems: 'center', gap: 0 }}
      >
        {NODES.map((node, i) => {
          const state = getNodeState(i, currentNodeIndex);

          // Colors per state
          const circleBg =
            state === 'done'    ? 'var(--green-dim)'  :
            state === 'current' ? 'var(--accent-dim)' :
            'var(--card2)';
          const circleBorder =
            state === 'done'    ? '1.5px solid var(--green)'  :
            state === 'current' ? '1.5px solid var(--accent)' :
            '1.5px solid var(--border2)';
          const circleColor =
            state === 'done'    ? 'var(--green)'  :
            state === 'current' ? 'var(--accent)' :
            'var(--text3)';
          const labelColor =
            state === 'future' ? 'var(--text3)' : 'var(--text)';
          const subLabel =
            state === 'current' ? (buildPhase || '…') :
            state === 'done'    ? '✓' :
            '—';

          return (
            <div key={node.key} style={{ display: 'flex', alignItems: 'center', flex: i < NODES.length - 1 ? '0 0 auto' : '0 0 auto' }}>
              {/* Node */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 52 }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: circleBg,
                    border: circleBorder,
                    color: circleColor,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {state === 'done'    ? <CheckIcon /> :
                   state === 'current' ? <PulseDot /> :
                   <ChevronIcon />}
                </div>
                <div style={{ fontSize: 12, fontWeight: 510, color: labelColor, textAlign: 'center', lineHeight: 1.2 }}>
                  {node.label}
                </div>
                <div style={{ fontSize: 10, fontFamily: 'ui-monospace, monospace', color: 'var(--text3)', textAlign: 'center', lineHeight: 1 }}>
                  {subLabel}
                </div>
              </div>

              {/* Connector line between nodes */}
              {i < NODES.length - 1 && (
                <div style={{ flex: 1, height: 1, background: 'var(--border)', minWidth: 12, margin: '0 2px', marginBottom: 28 }} />
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
