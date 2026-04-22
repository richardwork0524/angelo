'use client';

import { invalidateCache, upsertInCache, removeFromCache, getCachedData, cacheSet, cacheSubscribe as _cacheSubscribe } from '@/lib/cache';
import type { Handoff } from '@/lib/types';

/**
 * Restore a cache entry to its snapshot value and notify subscribers.
 * If snapshot is undefined (was not cached before), just invalidate.
 * If snapshot has data, write it back via cacheSet then invalidate — the
 * invalidate fires notifySubscribers so React components re-render, and
 * the next cachedFetch will hit the network for the confirmed server state.
 * This is a deliberate "invalidate after restore" — slightly conservative
 * (forces a refetch) but guarantees correctness after rollback.
 */
function restoreEntry(cacheKey: string, snapshot: unknown): void {
  if (snapshot !== undefined) {
    // Write old data back so any synchronous reads get the pre-mutation value
    cacheSet(cacheKey, snapshot);
  }
  // Invalidate (clears memory + IDB + notifies subscribers → triggers refetch)
  invalidateCache(cacheKey);
}

// ---------------------------------------------------------------------------
// mutateOptimistic
// ---------------------------------------------------------------------------

interface UpsertSpec {
  key: string;
  row: Record<string, unknown>;
  listPath?: string;
  idKey?: string;
}

interface RemoveSpec {
  key: string;
  rowId: string | number;
  listPath?: string;
  idKey?: string;
}

export interface OptimisticOpts {
  request: () => Promise<Response>;
  upserts?: UpsertSpec[];
  removes?: RemoveSpec[];
  invalidateOnSuccess?: string[];
  invalidateOnError?: string[];
  onSuccess?: () => void;
  onError?: (err: Error) => void;
}

export async function mutateOptimistic(opts: OptimisticOpts): Promise<void> {
  const {
    request,
    upserts = [],
    removes = [],
    invalidateOnSuccess = [],
    invalidateOnError = [],
    onSuccess,
    onError,
  } = opts;

  // 1. Snapshot current cache state for each upsert/remove key
  const snapshots = new Map<string, unknown>();
  const allKeys = [
    ...upserts.map((u) => u.key),
    ...removes.map((r) => r.key),
  ];
  // Deduplicate
  for (const key of allKeys) {
    if (!snapshots.has(key)) {
      snapshots.set(key, getCachedData(key));
    }
  }

  // 2. Apply optimistic mutations immediately
  for (const u of upserts) {
    upsertInCache(u.key, u.row, { listPath: u.listPath, idKey: u.idKey });
  }
  for (const r of removes) {
    removeFromCache(r.key, r.rowId, { listPath: r.listPath, idKey: r.idKey });
  }

  // 3. Fire network request
  try {
    const res = await request();
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    // 4a. Success: invalidate secondary keys, call onSuccess
    for (const key of invalidateOnSuccess) {
      invalidateCache(key);
    }
    onSuccess?.();
  } catch (err) {
    // 4b. Failure: restore all snapshots
    for (const [key, snapshot] of snapshots) {
      restoreEntry(key, snapshot);
    }
    for (const key of invalidateOnError) {
      invalidateCache(key);
    }
    const error = err instanceof Error ? err : new Error(String(err));
    onError?.(error);
  }
}

// ---------------------------------------------------------------------------
// bgMutate — kept as deprecated fallback for callers that manage their own
// optimistic state (tasks/page.tsx, project/[childKey]/page.tsx).
// NOTE: keeps *-changed CustomEvent dispatches because sidebar.tsx and
// tasks/page.tsx still listen to them.
// ---------------------------------------------------------------------------

interface MutateOptions {
  request: () => Promise<Response>;
  cacheKeys?: string[];
  onSuccess?: () => void;
  onError?: () => void;
}

export function bgMutate({ request, cacheKeys, onSuccess, onError }: MutateOptions) {
  request()
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      if (cacheKeys) cacheKeys.forEach((k) => invalidateCache(k));
      onSuccess?.();
    })
    .catch(() => {
      if (cacheKeys) cacheKeys.forEach((k) => invalidateCache(k));
      onError?.();
    });
}

// ---------------------------------------------------------------------------
// patchHandoff — optimistic: upserts into /api/handoffs list immediately,
// invalidates /api/home on success, rolls back + invalidates both on error.
//
// Two call forms:
//   patchHandoff(current: Handoff, patch, opts?)  — preferred, enables optimism
//   patchHandoff(handoffId: string, patch, opts?) — legacy, no optimistic upsert
// ---------------------------------------------------------------------------

export function patchHandoff(
  currentOrId: Handoff | string,
  patch: string | Partial<Handoff>,
  opts: { onSuccess?: () => void; onError?: (e: Error) => void } = {}
): Promise<void> {
  const isObj = typeof currentOrId === 'object' && currentOrId !== null;
  const handoffId = isObj ? (currentOrId as Handoff).id : (currentOrId as string);
  const patchObj: Partial<Handoff> = typeof patch === 'string'
    ? { status: patch as Handoff['status'] }
    : patch;

  const body = { id: handoffId, ...patchObj };

  if (isObj) {
    const current = currentOrId as Handoff;
    const optimisticRow: Handoff = {
      ...current,
      ...patchObj,
      updated_at: new Date().toISOString(),
    };
    return mutateOptimistic({
      request: () =>
        fetch('/api/handoffs', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }),
      upserts: [{ key: '/api/handoffs', row: optimisticRow as unknown as Record<string, unknown>, listPath: 'handoffs' }],
      invalidateOnSuccess: ['/api/home'],
      invalidateOnError: ['/api/handoffs', '/api/home'],
      onSuccess: opts.onSuccess,
      onError: opts.onError,
    });
  }

  // Legacy string-id path: no optimistic upsert, just invalidate
  return mutateOptimistic({
    request: () =>
      fetch('/api/handoffs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    invalidateOnSuccess: ['/api/home', '/api/handoffs'],
    invalidateOnError: ['/api/handoffs', '/api/home'],
    onSuccess: opts.onSuccess,
    onError: opts.onError,
  });
}

// ---------------------------------------------------------------------------
// deleteHandoff — optimistic: removes row from /api/handoffs list immediately.
// ---------------------------------------------------------------------------

export function deleteHandoff(
  handoffId: string,
  opts: { onSuccess?: () => void; onError?: (e: Error) => void } = {}
): Promise<void> {
  return mutateOptimistic({
    request: () =>
      fetch('/api/handoffs', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: handoffId }),
      }),
    removes: [{ key: '/api/handoffs', rowId: handoffId, listPath: 'handoffs' }],
    invalidateOnSuccess: ['/api/home'],
    invalidateOnError: ['/api/handoffs', '/api/home'],
    onSuccess: opts.onSuccess,
    onError: opts.onError,
  });
}

// ---------------------------------------------------------------------------
// patchTask — /api/tasks is invalidate-only (stats desync risk).
// No optimistic upsert at the cache level; callers manage their own local
// state optimism (tasks/page.tsx, project/[childKey]/page.tsx).
// ---------------------------------------------------------------------------

export function patchTask(
  taskId: string,
  projectKey: string,
  fields: Record<string, unknown>,
  opts: { onSuccess?: () => void; onError?: () => void } = {}
): Promise<void> {
  return mutateOptimistic({
    request: () =>
      fetch(`/api/projects/${projectKey}/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      }),
    invalidateOnSuccess: [`/api/dashboard`, `/api/projects/${projectKey}`],
    invalidateOnError: [`/api/dashboard`, `/api/projects/${projectKey}`],
    onSuccess: opts.onSuccess,
    onError: opts.onError ? () => opts.onError!() : undefined,
  });
}

// ---------------------------------------------------------------------------
// deleteTask — /api/tasks is invalidate-only.
// Callers manage optimistic removal in local state.
// ---------------------------------------------------------------------------

export function deleteTask(
  taskId: string,
  projectKey: string,
  opts: { onSuccess?: () => void; onError?: () => void } = {}
): Promise<void> {
  return mutateOptimistic({
    request: () => fetch(`/api/tasks/${taskId}`, { method: 'DELETE' }),
    invalidateOnSuccess: [`/api/dashboard`, `/api/projects/${projectKey}`],
    invalidateOnError: [`/api/dashboard`, `/api/projects/${projectKey}`],
    onSuccess: opts.onSuccess,
    onError: opts.onError ? () => opts.onError!() : undefined,
  });
}

// ---------------------------------------------------------------------------
// addSubtask — skips optimism (creates a new row; server assigns final ID).
// Invalidate-only: let realtime echo hydrate with the real row.
// ---------------------------------------------------------------------------

export function addSubtask(
  projectKey: string,
  parentId: string,
  text: string,
  bucket: string,
  opts: { onSuccess?: () => void; onError?: () => void } = {}
): Promise<void> {
  return mutateOptimistic({
    request: () =>
      fetch(`/api/projects/${projectKey}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, bucket, parent_task_id: parentId }),
      }),
    invalidateOnSuccess: [`/api/dashboard`, `/api/projects/${projectKey}`],
    invalidateOnError: [`/api/dashboard`, `/api/projects/${projectKey}`],
    onSuccess: opts.onSuccess,
    onError: opts.onError ? () => opts.onError!() : undefined,
  });
}
