'use client';

import { StickyHeader } from '@/components/sticky-header';
import { EmptyState } from '@/components/empty-state';

export default function BoardPage() {
  return (
    <div>
      <StickyHeader title="Board" />
      <EmptyState message="Kanban and timeline views coming soon." />
    </div>
  );
}
