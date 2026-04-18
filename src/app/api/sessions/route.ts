import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

type Range = 'today' | '7d' | '30d' | 'all';

function rangeCutoffISO(range: Range): string | null {
  const now = new Date();
  if (range === 'today') {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }
  if (range === '7d') {
    const d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return d.toISOString();
  }
  if (range === '30d') {
    const d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    return d.toISOString();
  }
  return null;
}

export async function GET(request: NextRequest) {
  const rangeParam = (request.nextUrl.searchParams.get('range') || '7d') as Range;
  const range: Range = ['today', '7d', '30d', 'all'].includes(rangeParam) ? rangeParam : '7d';
  const parentKey = request.nextUrl.searchParams.get('parent');
  const limit = parseInt(request.nextUrl.searchParams.get('limit') || '100');
  const offset = parseInt(request.nextUrl.searchParams.get('offset') || '0');

  const cutoff = rangeCutoffISO(range);

  try {
    let query = supabase
      .from('angelo_session_logs')
      .select(
        'id, session_code, project_key, session_date, title, surface, summary, mission, chain_id, entry_point, input_tokens, output_tokens, cost_usd, created_at',
        { count: 'exact' },
      )
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (cutoff) {
      query = query.gte('created_at', cutoff);
    }

    if (parentKey) {
      const { data: allProjects } = await supabase
        .from('angelo_projects')
        .select('child_key, parent_key')
        .neq('status', 'ARCHIVED');

      function getDescendantLeaves(key: string): string[] {
        const children = (allProjects || []).filter((p) => p.parent_key === key);
        if (children.length === 0) return [key];
        const leaves: string[] = [];
        for (const child of children) {
          leaves.push(...getDescendantLeaves(child.child_key));
        }
        return leaves;
      }

      const leafKeys = getDescendantLeaves(parentKey);
      query = query.in('project_key', leafKeys);
    }

    const { data: sessions, count } = await query;
    const rows = sessions || [];

    // Stats over the selected range
    let totalTokens = 0;
    let totalCost = 0;
    let sessionsWithMetrics = 0;
    for (const s of rows) {
      const tok = (s.input_tokens || 0) + (s.output_tokens || 0);
      if (tok > 0) sessionsWithMetrics += 1;
      totalTokens += tok;
      totalCost += Number(s.cost_usd || 0);
    }

    // Daily buckets for last 7 days (sessions, tokens, cost)
    const daily: { date: string; sessions: number; tokens: number; cost: number }[] = [];
    const nowDay = new Date();
    nowDay.setHours(0, 0, 0, 0);
    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date(nowDay.getTime() - i * 24 * 60 * 60 * 1000);
      const iso = d.toISOString().slice(0, 10);
      daily.push({ date: iso, sessions: 0, tokens: 0, cost: 0 });
    }
    const idx: Record<string, number> = {};
    daily.forEach((b, i) => { idx[b.date] = i; });

    // For the daily chart, fetch 7-day sessions regardless of filter range
    const weekCutoff = rangeCutoffISO('7d');
    if (weekCutoff) {
      const { data: weekRows } = await supabase
        .from('angelo_session_logs')
        .select('session_date, input_tokens, output_tokens, cost_usd')
        .gte('created_at', weekCutoff)
        .limit(5000);
      for (const r of weekRows || []) {
        const d = (r.session_date || '').slice(0, 10);
        if (d in idx) {
          const b = daily[idx[d]];
          b.sessions += 1;
          b.tokens += (r.input_tokens || 0) + (r.output_tokens || 0);
          b.cost += Number(r.cost_usd || 0);
        }
      }
    }

    const weeklyTotals = daily.reduce(
      (acc, d) => ({ sessions: acc.sessions + d.sessions, tokens: acc.tokens + d.tokens, cost: acc.cost + d.cost }),
      { sessions: 0, tokens: 0, cost: 0 },
    );

    const avgTokens = weeklyTotals.sessions > 0 ? Math.round(weeklyTotals.tokens / weeklyTotals.sessions) : 0;
    const avgCost = weeklyTotals.sessions > 0 ? weeklyTotals.cost / weeklyTotals.sessions : 0;
    const efficiency = weeklyTotals.cost > 0 ? Math.round(weeklyTotals.tokens / weeklyTotals.cost) : 0;

    return NextResponse.json({
      sessions: rows,
      total: count || 0,
      offset,
      limit,
      range,
      stats: {
        range_total: rows.length,
        range_tokens: totalTokens,
        range_cost: totalCost,
        range_with_metrics: sessionsWithMetrics,
        week: {
          daily,
          total_sessions: weeklyTotals.sessions,
          total_tokens: weeklyTotals.tokens,
          total_cost: weeklyTotals.cost,
          avg_tokens: avgTokens,
          avg_cost: avgCost,
          efficiency_tokens_per_dollar: efficiency,
        },
      },
    });
  } catch (err) {
    console.error('Sessions API error:', err);
    return NextResponse.json({ error: 'Failed to load sessions' }, { status: 500 });
  }
}
