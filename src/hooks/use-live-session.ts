'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';

export type LiveSessionRow = {
  id: string;
  short_hash: string;
  entity_key: string | null;
  surface: string;
  tool: string | null;
  tokens: number;
  cost_usd: number;
  started_at: string;
  ended_at: string | null;
  jsonl_path: string | null;
  // Joined field — entity display name resolved from angelo_projects
  entity_name?: string | null;
};

type UseLiveSessionResult = {
  session: LiveSessionRow | null;
  isLoading: boolean;
};

/**
 * useLiveSession — single subscription for the active Claude Code session.
 * Mount once in AppShell only. Never mount per-page.
 *
 * Lifecycle:
 *  - Initial fetch: SELECT * FROM angelo_live_sessions WHERE ended_at IS NULL LIMIT 1
 *  - INSERT event → set session (ribbon mounts)
 *  - UPDATE where ended_at null → update fields in-place (token/cost animation handled in LiveRibbon)
 *  - UPDATE where ended_at set → clear session after 200ms fade delay (ribbon unmounts)
 */
export function useLiveSession(): UseLiveSessionResult {
  const [session, setSession] = useState<LiveSessionRow | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function resolveEntityName(entityKey: string | null): Promise<string | null> {
    if (!entityKey) return null;
    const { data } = await supabase
      .from('angelo_projects')
      .select('name')
      .eq('child_key', entityKey)
      .single();
    return data?.name ?? entityKey;
  }

  async function enrichSession(row: LiveSessionRow): Promise<LiveSessionRow> {
    const entity_name = await resolveEntityName(row.entity_key);
    return { ...row, entity_name };
  }

  useEffect(() => {
    let mounted = true;

    // Initial load
    async function loadInitial() {
      const { data } = await supabase
        .from('angelo_live_sessions')
        .select('*')
        .is('ended_at', null)
        .limit(1)
        .single();

      if (!mounted) return;
      if (data) {
        const enriched = await enrichSession(data as LiveSessionRow);
        if (mounted) setSession(enriched);
      }
      setIsLoading(false);
    }

    loadInitial();

    // Polling fallback — refetches every 5s to catch realtime misses (dev + reconnect resilience)
    const pollInterval = setInterval(async () => {
      if (!mounted) return;
      const { data } = await supabase
        .from('angelo_live_sessions')
        .select('*')
        .is('ended_at', null)
        .limit(1)
        .single();
      if (!mounted) return;
      if (data) {
        const enriched = await enrichSession(data as LiveSessionRow);
        if (mounted) setSession((prev) => {
          // Only update if something meaningful changed
          if (!prev || prev.short_hash !== enriched.short_hash ||
              prev.tokens !== enriched.tokens || prev.tool !== enriched.tool) {
            return enriched;
          }
          return prev;
        });
      } else {
        // No active row — clear if we had one
        if (mounted) setSession(null);
      }
    }, 5000);

    // Realtime subscription
    const channel = supabase
      .channel('live-session-ribbon')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'angelo_live_sessions' },
        async (payload) => {
          if (!mounted) return;

          if (payload.eventType === 'INSERT') {
            const row = payload.new as LiveSessionRow;
            const enriched = await enrichSession(row);
            if (mounted) setSession(enriched);
          } else if (payload.eventType === 'UPDATE') {
            const row = payload.new as LiveSessionRow;
            if (row.ended_at !== null) {
              // Session closed — clear after 200ms to allow fade-out animation
              if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
              fadeTimerRef.current = setTimeout(() => {
                if (mounted) setSession(null);
              }, 200);
            } else {
              // In-place update (tokens/cost/tool) — update without re-mounting
              setSession((prev) => {
                if (!prev || prev.short_hash !== row.short_hash) return prev;
                return { ...prev, ...row };
              });
            }
          } else if (payload.eventType === 'DELETE') {
            if (mounted) setSession(null);
          }
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
      clearInterval(pollInterval);
      supabase.removeChannel(channel);
    };
  }, []);

  return { session, isLoading };
}
