'use client';

const STEPS = ['S1', 'S2', 'S3', 'S4', 'S5', 'S5.5', 'S6', 'S7', 'S8', 'TEST'];

type StepState = 'done' | 'current' | 'todo';

interface BuildChainProps {
  /** The current build phase string, e.g. "S3" or "S5.5" */
  currentPhase: string;
}

function getStepState(step: string, currentPhase: string): StepState {
  const currentIdx = STEPS.indexOf(currentPhase);
  const stepIdx = STEPS.indexOf(step);

  if (currentIdx === -1) return 'todo';
  if (stepIdx < currentIdx) return 'done';
  if (stepIdx === currentIdx) return 'current';
  return 'todo';
}

export function BuildChain({ currentPhase }: BuildChainProps) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
      {STEPS.map((step) => {
        const state = getStepState(step, currentPhase);
        let bgClass: string;
        let textClass: string;
        let extraStyle: React.CSSProperties = {};

        if (state === 'done') {
          bgClass = 'bg-[var(--green)]';
          textClass = 'text-white';
        } else if (state === 'current') {
          bgClass = 'bg-[var(--accent)]';
          textClass = 'text-white';
          extraStyle = { boxShadow: '0 0 8px var(--accent)' };
        } else {
          bgClass = 'bg-[var(--surface)]';
          textClass = 'text-[var(--text3)]';
        }

        return (
          <div
            key={step}
            className={`flex items-center justify-center w-[28px] h-[28px] rounded-[4px] text-[9px] font-bold shrink-0 ${bgClass} ${textClass}`}
            style={extraStyle}
            title={`${step}: ${state}`}
          >
            {step}
          </div>
        );
      })}
    </div>
  );
}
