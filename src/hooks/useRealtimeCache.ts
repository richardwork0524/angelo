'use client';

import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { invalidateCache, upsertInCache, removeFromCache } from '@/lib/cache';
import { DESCRIPTORS } from '@/lib/realtime-descriptor';
import type { CacheAction } from '@/lib/realtime-descriptor';
import type { RealtimeChannel } from '@supabase/supabase-js';

/**
 * Module-level channel sharing — multiple components subscribing to
 * the same table share one WebSocket channel via reference counting.
 */
const channels = new Map<string, { channel: RealtimeChannel; refCount: number }>();

/**
 * Per-key debounce timers for onInvalidate callbacks.
 * Keyed by channelKey so a burst on angelo_handoffs doesn't delay
 * a concurrent angelo_session_events notification.
 */
const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

function dispatchAction(action: CacheAction, row: Record<string, unknown>): void {
  if (action.kind === 'upsert') {
    upsertInCache(action.key, row, {
      listPath: action.listPath,
      idKey: action.idKey,
    });
  } else if (action.kind === 'remove') {
    const idKey = action.idKey ?? 'id';
    const rowId = (row[idKey] ?? row.id) as string | number;
    if (rowId != null) {
      removeFromCache(action.key, rowId, {
        listPath: action.listPath,
        idKey: action.idKey,
      });
    }
  } else {
    // kind === 'invalidate'
    invalidateCache(action.key);
  }
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
 * Uses DESCRIPTORS to determine which cache keys to update on change.
 * Debounce is per-key so concurrent table bursts don't interfere.
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

    function handleChange(payload: Record<string, unknown>) {
      // If we have a filter, check that the change matches
      if (filterColumn && filterValue) {
        const row = (payload.new || payload.old || {}) as Record<string, unknown>;
        if (row[filterColumn] !== filterValue) return;
      }

      const eventType = payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE';
      const row = (payload.new ?? payload.old ?? {}) as Record<string, unknown>;

      // Look up descriptor for this table
      const descriptor = DESCRIPTORS.find((d) => d.table === table);
      if (descriptor) {
        const actions = descriptor.actions(eventType, row);
        actions.forEach((action) => dispatchAction(action, row));
      } else {
        // No descriptor — fall back to full cache invalidation (safe default)
        invalidateCache();
      }

      // Per-key debounce for the onInvalidate callback
      const existing = debounceTimers.get(channelKey);
      if (existing) clearTimeout(existing);
      const timer = setTimeout(() => {
        debounceTimers.delete(channelKey);
        onInvalidateRef.current?.();
      }, 500);
      debounceTimers.set(channelKey, timer);
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
      const timer = debounceTimers.get(channelKey);
      if (timer) {
        clearTimeout(timer);
        debounceTimers.delete(channelKey);
      }
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

/**
 * Alias used by RealtimeProvider — minimal opts form.
 * Identical to useRealtimeCache but named for clarity at the call site.
 */
export function useRealtimeSync({ table }: { table: string }) {
  return useRealtimeCache({ table });
}
