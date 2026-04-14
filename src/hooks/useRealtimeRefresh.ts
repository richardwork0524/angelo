'use client';

import { useEffect, useRef } from 'react';
import { useRealtimeCache } from './useRealtimeCache';
import { cacheSubscribe } from '@/lib/cache';

/**
 * Thin wrapper: subscribes to Supabase Realtime for a table,
 * and auto-calls a refetch function when cache is invalidated.
 *
 * Usage:
 *   useRealtimeRefresh({
 *     table: 'angelo_tasks',
 *     cachePrefix: '/api/dashboard',
 *     onRefresh: fetchDashboard,
 *   });
 */

interface UseRealtimeRefreshOpts {
  table: string;
  cachePrefix: string;
  onRefresh: () => void;
  /** Optional: only listen for changes where this column matches */
  filterColumn?: string;
  filterValue?: string;
}

export function useRealtimeRefresh({
  table,
  cachePrefix,
  onRefresh,
  filterColumn,
  filterValue,
}: UseRealtimeRefreshOpts) {
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  // Layer 1: Supabase Realtime → invalidates cache → triggers onInvalidate
  useRealtimeCache({
    table,
    filterColumn,
    filterValue,
    onInvalidate: () => onRefreshRef.current(),
  });

  // Layer 2: Also listen for cache invalidation from other sources
  // (e.g., local mutations calling invalidateCache directly)
  useEffect(() => {
    return cacheSubscribe(cachePrefix, () => {
      // Small delay to let cache clear before refetching
      setTimeout(() => onRefreshRef.current(), 50);
    });
  }, [cachePrefix]);
}
