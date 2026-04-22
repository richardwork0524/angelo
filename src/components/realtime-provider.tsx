'use client';

/**
 * RealtimeProvider — mounts one Supabase Realtime subscription per descriptor.
 *
 * Hook-in-loop safety: DESCRIPTORS is a module-level constant (frozen at
 * import time), so the array length and order never change across renders.
 * React's rules-of-hooks only prohibit dynamic loop lengths; a stable constant
 * satisfies the requirement. ESLint's react-hooks/rules-of-hooks will NOT warn
 * on a stable for-of over a module constant because the number of hook calls
 * is always the same.
 *
 * Mount this once at the app-shell level so all pages share the same set of
 * Supabase channels — no per-page setup needed.
 */

import { DESCRIPTORS } from '@/lib/realtime-descriptor';
import { useRealtimeSync } from '@/hooks/useRealtimeCache';

function RealtimeSyncMount({ table }: { table: string }) {
  useRealtimeSync({ table });
  return null;
}

export function RealtimeProvider() {
  return (
    <>
      {DESCRIPTORS.map((d) => (
        <RealtimeSyncMount key={d.table} table={d.table} />
      ))}
    </>
  );
}
