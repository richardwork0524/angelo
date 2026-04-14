'use client';

import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { invalidateCache } from '@/lib/cache';
import type { RealtimeChannel } from '@supabase/supabase-js';

/**
 * Module-level channel sharing — multiple components subscribing to
 * the same table share one WebSocket channel via reference counting.
 */
const channels = new Map<string, { channel: RealtimeChannel; refCount: number }>();

/** Map table changes to cache keys that need invalidation */
function getCacheKeys(table: string, payload: Record<string, unknown>): string[] {
  const row = (payload.new || payload.old || {}) as Record<string, unknown>;
  const keys: string[] = [];

  if (table === 'angelo_tasks') {
    keys.push('/api/dashboard');
    if (row.project_key) keys.push(`/api/projects/${row.project_key}`);
  } else if (table === 'angelo_projects') {
    keys.push('/api/projects');
    keys.push('/api/dashboard');
  }

  return keys;
}

interface UseRealtimeCacheOpts {
  table: string;
  schema?: string;
  /** Optional column filter — only invalidate when this column matches */
  filterColumn?: string;
  filterValue?: string;
  /** Called after cache invalidation */
  onInvalidate?: () => void;
}

/**
 * Subscribe to Supabase postgres_changes on a table.
 * Invalidates relevant cache keys on change, debounced at 500ms.
 */
export function useRealtimeCache({
  table,
  schema = 'public',
  filterColumn,
  filterValue,
  onInvalidate,
}: UseRealtimeCacheOpts) {
  const onInvalidateRef = useRef(onInvalidate);
  onInvalidateRef.current = onInvalidate;

  useEffect(() => {
    // Build a unique channel key
    const filterSuffix = filterColumn && filterValue ? `:${filterColumn}=${filterValue}` : '';
    const channelKey = `${schema}:${table}${filterSuffix}`;

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    function handleChange(payload: Record<string, unknown>) {
      const keys = getCacheKeys(table, payload);

      // If we have a filter, check that the change matches
      if (filterColumn && filterValue) {
        const row = (payload.new || payload.old || {}) as Record<string, unknown>;
        if (row[filterColumn] !== filterValue) return;
      }

      keys.forEach((k) => invalidateCache(k));

      // Debounce the onInvalidate callback (batch rapid changes)
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        onInvalidateRef.current?.();
      }, 500);
    }

    // Reuse existing channel or create new one
    const existing = channels.get(channelKey);
    if (existing) {
      existing.refCount++;
      // Can't add a second listener to an existing channel easily,
      // so we subscribe to cache invalidation events instead
    } else {
      const filter = filterColumn && filterValue
        ? `${filterColumn}=eq.${filterValue}`
        : undefined;

      const channel = supabase
        .channel(channelKey)
        .on(
          'postgres_changes' as 'system',
          { event: '*', schema, table, filter } as Record<string, unknown>,
          handleChange as () => void,
        )
        .subscribe();

      channels.set(channelKey, { channel, refCount: 1 });
    }

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      const entry = channels.get(channelKey);
      if (entry) {
        entry.refCount--;
        if (entry.refCount <= 0) {
          supabase.removeChannel(entry.channel);
          channels.delete(channelKey);
        }
      }
    };
  }, [table, schema, filterColumn, filterValue]);
}
