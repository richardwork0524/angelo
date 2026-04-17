import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

export async function GET(_req: Request, { params }: { params: Promise<{ chainId: string }> }) {
  const { chainId } = await params;

  // Get all sessions in this chain, ordered by date
  const { data: sessions, error } = await supabase
    .from('angelo_session_logs')
    .select('id, session_date, title, surface, summary, project_key, entry_point, chain_id, mission, input_tokens, output_tokens, cost_usd')
    .eq('chain_id', chainId)
    .order('session_date', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!sessions || sessions.length === 0) {
    return NextResponse.json({ error: 'Chain not found' }, { status: 404 });
  }

  // Aggregate stats
  const totalCost = sessions.reduce((sum, s) => sum + (Number(s.cost_usd) || 0), 0);
  const totalInput = sessions.reduce((sum, s) => sum + (s.input_tokens || 0), 0);
  const totalOutput = sessions.reduce((sum, s) => sum + (s.output_tokens || 0), 0);
  const projectKey = sessions[0].project_key;
  const latestTitle = sessions[sessions.length - 1].title || 'Untitled';

  // Build cumulative cost timeline
  let cumCost = 0;
  const timeline = sessions.map((s, i) => {
    cumCost += Number(s.cost_usd) || 0;
    return {
      ...s,
      sequence: i + 1,
      cumulative_cost: cumCost,
    };
  });

  return NextResponse.json({
    chain_id: chainId,
    project_key: projectKey,
    latest_title: latestTitle,
    session_count: sessions.length,
    total_cost: totalCost,
    total_input: totalInput,
    total_output: totalOutput,
    timeline,
  });
}
