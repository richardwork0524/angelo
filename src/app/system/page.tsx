import { PhasePlaceholder } from '@/components/phase-placeholder';

export default function SystemPage() {
  return (
    <PhasePlaceholder
      title="System"
      subtitle="hooks · errors · warnings"
      phase={6}
      note="System health dashboard. Ships in Phase 6."
    />
  );
}
