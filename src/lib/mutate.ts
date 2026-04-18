'use client';

import { invalidateCache } from '@/lib/cache';

/**
 * Shared optimistic mutation pattern.
 * 1. Run optimistic updater immediately
 * 2. Fire network request in background
 * 3. On success: invalidate cache + callback
 * 4. On failure: rollback + callback
 */

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

/** Convenience: PATCH a task with optimistic update */
export function patchTask(
  taskId: string,
  projectKey: string,
  fields: Record<string, unknown>,
  opts: { onSuccess?: () => void; onError?: () => void } = {}
) {
  bgMutate({
    request: () =>
      fetch(`/api/projects/${projectKey}/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      }),
    cacheKeys: [`/api/dashboard`, `/api/projects/${projectKey}`],
    ...opts,
  });
}

/** Convenience: DELETE a task */
export function deleteTask(
  taskId: string,
  projectKey: string,
  opts: { onSuccess?: () => void; onError?: () => void } = {}
) {
  bgMutate({
    request: () => fetch(`/api/tasks/${taskId}`, { method: 'DELETE' }),
    cacheKeys: [`/api/dashboard`, `/api/projects/${projectKey}`],
    ...opts,
  });
}

/**
 * Convenience: PATCH a handoff. Overload for legacy `patchHandoff(id, status)`
 * call sites; preferred form is `patchHandoff(id, { status, purpose, is_mounted })`.
 */
export function patchHandoff(
  handoffId: string,
  patch: string | { status?: string; purpose?: string; is_mounted?: boolean },
  opts: { onSuccess?: () => void; onError?: () => void } = {}
) {
  const body = typeof patch === 'string'
    ? { id: handoffId, status: patch }
    : { id: handoffId, ...patch };
  bgMutate({
    request: () =>
      fetch('/api/handoffs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    cacheKeys: ['/api/handoffs', '/api/home'],
    ...opts,
  });
}

/** Convenience: DELETE a handoff (DB delete + queue vault archive) */
export function deleteHandoff(
  handoffId: string,
  opts: { onSuccess?: () => void; onError?: () => void } = {}
) {
  bgMutate({
    request: () =>
      fetch('/api/handoffs', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: handoffId }),
      }),
    cacheKeys: ['/api/handoffs', '/api/home'],
    ...opts,
  });
}

/** Convenience: POST a new subtask */
export function addSubtask(
  projectKey: string,
  parentId: string,
  text: string,
  bucket: string,
  opts: { onSuccess?: () => void; onError?: () => void } = {}
) {
  bgMutate({
    request: () =>
      fetch(`/api/projects/${projectKey}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, bucket, parent_task_id: parentId }),
      }),
    cacheKeys: [`/api/dashboard`, `/api/projects/${projectKey}`],
    ...opts,
  });
}
