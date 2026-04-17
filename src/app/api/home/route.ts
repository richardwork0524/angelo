import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  try {
    // Parallel fetch: latest sessions, chain data, token stats, hook logs
    const [sessionsRes, chainsRes, tokenStatsRes, hookLogsRes, routineRes] = await Promise.all([
      // 1. Recent sessions (latest 5)
      supabase
        .from("angelo_session_logs")
        .select("id, project_key, session_date, title, surface, summary, chain_id, entry_point, input_tokens, output_tokens, cost_usd, tags, mission, handoff_context")
        .order("created_at", { ascending: false })
        .limit(5),

      // 2. Active chains — sessions with chain_id, grouped client-side
      supabase
        .from("angelo_session_logs")
        .select("id, project_key, title, surface, chain_id, entry_point, cost_usd, session_date, created_at")
        .not("chain_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(50),

      // 3. Token stats — last 7 days aggregate
      supabase
        .from("angelo_session_logs")
        .select("session_date, input_tokens, output_tokens, cost_usd")
        .gte("session_date", new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0])
        .order("session_date", { ascending: true }),

      // 4. Hook logs — last 5 for system health
      supabase
        .from("angelo_hook_logs")
        .select("hook_name, action, project_key, detail, created_at, status")
        .order("created_at", { ascending: false })
        .limit(5),

      // 5. Routine — open tasks with mission containing "routine" or task_type LOG
      supabase
        .from("angelo_tasks")
        .select("id, project_key, text, priority, bucket, mission, task_type, completed")
        .eq("completed", false)
        .or("mission.ilike.%routine%,task_type.eq.LOG")
        .order("priority", { ascending: true })
        .limit(5),
    ]);

    const sessions = sessionsRes.data || [];
    const chainSessions = chainsRes.data || [];
    const tokenDays = tokenStatsRes.data || [];
    const hookLogs = hookLogsRes.data || [];
    const routineTasks = routineRes.data || [];

    // Hero: latest session
    const hero = sessions[0] || null;

    // Active chains: group by chain_id, compute totals
    const chainMap = new Map<string, {
      chain_id: string;
      project_key: string;
      title: string;
      entry_point: string | null;
      session_count: number;
      total_cost: number;
      latest_date: string;
      latest_title: string;
    }>();
    for (const s of chainSessions) {
      if (!s.chain_id) continue;
      const existing = chainMap.get(s.chain_id);
      if (!existing) {
        chainMap.set(s.chain_id, {
          chain_id: s.chain_id,
          project_key: s.project_key,
          title: s.title,
          entry_point: s.entry_point,
          session_count: 1,
          total_cost: Number(s.cost_usd) || 0,
          latest_date: s.session_date,
          latest_title: s.title,
        });
      } else {
        existing.session_count++;
        existing.total_cost += Number(s.cost_usd) || 0;
      }
    }
    const chains = Array.from(chainMap.values())
      .sort((a, b) => b.latest_date.localeCompare(a.latest_date))
      .slice(0, 5);

    // Token stats: aggregate by day + totals
    const today = new Date().toISOString().split("T")[0];
    let todayInput = 0, todayOutput = 0, todayCost = 0, todaySessions = 0;
    let weekInput = 0, weekOutput = 0, weekCost = 0, weekSessions = 0;
    const dailyCosts: { date: string; cost: number }[] = [];
    const dayMap = new Map<string, number>();

    for (const d of tokenDays) {
      const cost = Number(d.cost_usd) || 0;
      const inp = d.input_tokens || 0;
      const out = d.output_tokens || 0;
      weekInput += inp;
      weekOutput += out;
      weekCost += cost;
      weekSessions++;
      dayMap.set(d.session_date, (dayMap.get(d.session_date) || 0) + cost);
      if (d.session_date === today) {
        todayInput += inp;
        todayOutput += out;
        todayCost += cost;
        todaySessions++;
      }
    }

    // Fill 7 days for trend
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000).toISOString().split("T")[0];
      dailyCosts.push({ date: d, cost: dayMap.get(d) || 0 });
    }

    // System health
    const recentErrors = hookLogs.filter((l) => l.status === "error" || l.action?.includes("fail"));
    const systemHealth = recentErrors.length === 0 ? "healthy" : "degraded";

    return NextResponse.json({
      hero,
      recent_sessions: sessions.slice(1, 5),
      chains,
      token_stats: {
        today: { input: todayInput, output: todayOutput, cost: todayCost, sessions: todaySessions },
        week: { input: weekInput, output: weekOutput, cost: weekCost, sessions: weekSessions, avg_daily: weekCost / 7 },
        daily_costs: dailyCosts,
      },
      routine: routineTasks,
      system: {
        health: systemHealth,
        recent_hooks: hookLogs,
        error_count: recentErrors.length,
      },
    });
  } catch (err) {
    console.error("Home API error:", err);
    return NextResponse.json({ error: "Failed to load home" }, { status: 500 });
  }
}
