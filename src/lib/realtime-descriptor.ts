/**
 * Declarative realtime descriptors.
 *
 * Each descriptor maps a Supabase table to a set of CacheActions that should
 * be dispatched when a postgres_changes event arrives.  The hook reads these
 * at runtime instead of using a hand-rolled switch statement.
 *
 * listPath semantics:
 *   undefined / '' → cache response IS the array (top-level)
 *   'handoffs'     → cache response is { handoffs: [...] }
 *   'tasks'        → cache response is { tasks: [...] }
 *   'notes'        → cache response is { notes: [...] }
 */

export type CacheAction =
  | { kind: 'upsert'; key: string; listPath?: string; idKey?: string }
  | { kind: 'remove'; key: string; listPath?: string; idKey?: string }
  | { kind: 'invalidate'; key: string };

export interface TableDescriptor {
  table: string;
  actions: (
    evt: 'INSERT' | 'UPDATE' | 'DELETE',
    row: Record<string, unknown>
  ) => CacheAction[];
}

export const DESCRIPTORS: TableDescriptor[] = [
  {
    // /api/handoffs returns { handoffs: [...], total, offset, limit }
    table: 'angelo_handoffs',
    actions: (evt, row) => [
      evt === 'DELETE'
        ? { kind: 'remove', key: '/api/handoffs', listPath: 'handoffs' }
        : { kind: 'upsert', key: '/api/handoffs', listPath: 'handoffs' },
      { kind: 'invalidate', key: '/api/home' },
      // Per-handoff detail cache (used by /handoff/[id] page)
      ...(row.id ? [{ kind: 'invalidate' as const, key: `/api/handoff/${row.id}` }] : []),
    ],
  },
  {
    // /api/tasks returns { tasks: [...], projects, missions, stats, filters }
    // High write frequency — invalidate rather than upsert to avoid stale stats
    table: 'angelo_tasks',
    actions: (evt, row) => [
      { kind: 'invalidate', key: '/api/dashboard' },
      { kind: 'invalidate', key: '/api/home' },
      // Per-project task cache if project_key present
      ...(row.project_key
        ? [{ kind: 'invalidate' as const, key: `/api/projects/${row.project_key}/tasks` }]
        : []
      ),
    ],
  },
  {
    // /api/projects returns { projects: [...] }
    table: 'angelo_projects',
    actions: () => [
      { kind: 'invalidate', key: '/api/projects' },
      { kind: 'invalidate', key: '/api/entities' },
      { kind: 'invalidate', key: '/api/dashboard' },
    ],
  },
  {
    // /api/sessions returns { sessions: [...], total, offset, limit, stats }
    table: 'angelo_session_logs',
    actions: () => [
      { kind: 'invalidate', key: '/api/sessions' },
      { kind: 'invalidate', key: '/api/home' },
    ],
  },
  {
    // High-frequency — only invalidate the specific session detail cache
    table: 'angelo_session_events',
    actions: (_evt, row) => [
      ...(row.session_id
        ? [{ kind: 'invalidate' as const, key: `/api/sessions/${row.session_id}` }]
        : []
      ),
    ],
  },
  {
    // /api/notes returns { notes: [...], total, offset, limit, stats }
    table: 'angelo_notes',
    actions: (evt, row) => [
      evt === 'DELETE'
        ? { kind: 'remove', key: '/api/notes', listPath: 'notes' }
        : { kind: 'upsert', key: '/api/notes', listPath: 'notes' },
      { kind: 'invalidate', key: '/api/home' },
    ],
  },
];
