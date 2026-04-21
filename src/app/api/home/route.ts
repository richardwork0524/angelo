import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  try {
    const todayStr = new Date().toISOString().split("T")[0];
    const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split("T")[0];
    const sevenDaysAgoStr = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];
    const thirtyDaysAgoStr = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];
    const dayAgoIso = new Date(Date.now() - 86400000).toISOString();

    const [
      sessionsRes,
      chainsRes,
      tokenStatsRes,
      hookLogsRes,
      routineRes,
      handoffsRes,
      handoffsActiveCountRes,
      notesUnresolvedCountRes,
      sessionsMonthCountRes,
      entitiesCountRes,
      hookErrorsCountRes,
      tasksOpenCountRes,
      activeSessionsRes,
    ] = await Promise.all([
      // Recent sessions (latest 5)
      supabase
        .from("angelo_session_logs")
        .select("id, session_code, project_key, session_date, title, surface, summary, chain_id, entry_point, input_tokens, output_tokens, cost_usd, tags, mission, handoff_context, structured_summary, project_keys_seen, task_ids")
        .order("created_at", { ascending: false })
        .limit(5),

      // Active chains
      supabase
        .from("angelo_session_logs")
        .select("id, project_key, title, surface, chain_id, entry_point, cost_usd, session_date, created_at")
        .not("chain_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(50),

      // Token stats — last 7 days aggregate
      supabase
        .from("angelo_session_logs")
        .select("session_date, input_tokens, output_tokens, cost_usd")
        .gte("session_date", sevenDaysAgoStr)
        .order("session_date", { ascending: true }),

      // Hook logs — last 5 for system health
      supabase
        .from("angelo_hook_logs")
        .select("hook_name, action, project_key, detail, created_at, status")
        .order("created_at", { ascending: false })
        .limit(5),

      // Routine — open tasks tagged routine / LOG
      supabase
        .from("angelo_tasks")
        .select("id, project_key, text, priority, bucket, mission, task_type, completed")
        .eq("completed", false)
        .or("mission.ilike.%routine%,task_type.eq.LOG")
        .order("priority", { ascending: true })
        .limit(5),

      // Handoffs — last 20 by updated_at; filtered client-side for hero / recent / mount
      supabase
        .from("angelo_handoffs")
        .select("id, handoff_code, created_by_session_id, project_key, scope_type, scope_name, entry_point, version, sections_total, sections_completed, sections_remaining, source, status, picked_up_by_session_id, notes, vault_path, purpose, is_mounted, created_at, updated_at")
        .order("updated_at", { ascending: false })
        .limit(20),

      // Sidebar count: active handoffs
      supabase
        .from("angelo_handoffs")
        .select("id", { count: "exact", head: true })
        .in("status", ["open", "picked_up"]),

      // Sidebar count: unresolved notes
      supabase
        .from("angelo_notes")
        .select("id", { count: "exact", head: true })
        .eq("resolved", false),

      // Sidebar count: sessions in last 30 days
      supabase
        .from("angelo_session_logs")
        .select("id", { count: "exact", head: true })
        .gte("session_date", thirtyDaysAgoStr),

      // Sidebar count: entities (rows with entity_type IS NOT NULL — excludes folder rows)
      supabase
        .from("angelo_projects")
        .select("id", { count: "exact", head: true })
        .not("entity_type", "is", null),

      // Sidebar count: hook errors in last 24h
      supabase
        .from("angelo_hook_logs")
        .select("id", { count: "exact", head: true })
        .eq("status", "error")
        .gte("created_at", dayAgoIso),

      // Sidebar count: open tasks across all projects
      supabase
        .from("angelo_tasks")
        .select("id", { count: "exact", head: true })
        .eq("completed", false),

      // Active sessions (live breadcrumb)
      supabase
        .from("angelo_active_sessions")
        .select(`
          *,
          mounted_handoff:angelo_handoffs!mounted_handoff_id(id, handoff_code, scope_name, project_key, is_mounted)
        `)
        .order("started_at", { ascending: false }),
    ]);

    const sessions = sessionsRes.data || [];
    const chainSessions = chainsRes.data || [];
    const tokenDays = tokenStatsRes.data || [];
    const hookLogs = hookLogsRes.data || [];
    const routineTasks = routineRes.data || [];
    const handoffs = handoffsRes.data || [];

    const openHandoffs = handoffs.filter((h) => h.status === "open" || h.status === "picked_up");
    // mounted is now a canonical column; is_mounted === true is the source of truth.
    const mountedHandoffs = handoffs.filter((h) => h.is_mounted === true);
    // Recent = open/picked_up OR updated in last 7 days
    const recentHandoffs = handoffs.filter(
      (h) => h.status === "open" || h.status === "picked_up" || (h.updated_at && h.updated_at >= sevenDaysAgoStr)
    );

    const mountedHandoff = mountedHandoffs[0] || null;
    const latestHandoff = mountedHandoff || openHandoffs[0] || null;
    const hero = sessions[0] || null;

    // Active chains
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

    // Token stats — aggregate by day + today/yesterday for trends
    let todayInput = 0, todayOutput = 0, todayCost = 0, todaySessions = 0;
    let yesterdayInput = 0, yesterdayOutput = 0, yesterdayCost = 0, yesterdaySessions = 0;
    let weekInput = 0, weekOutput = 0, weekCost = 0, weekSessions = 0;
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
      if (d.session_date === todayStr) {
        todayInput += inp;
        todayOutput += out;
        todayCost += cost;
        todaySessions++;
      } else if (d.session_date === yesterdayStr) {
        yesterdayInput += inp;
        yesterdayOutput += out;
        yesterdayCost += cost;
        yesterdaySessions++;
      }
    }

    const dailyCosts: { date: string; cost: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000).toISOString().split("T")[0];
      dailyCosts.push({ date: d, cost: dayMap.get(d) || 0 });
    }

    // System health
    const recentErrors = hookLogs.filter((l) => l.status === "error" || l.action?.includes("fail"));
    const systemHealth = recentErrors.length === 0 ? "healthy" : "degraded";

    const statsToday = {
      cost: todayCost,
      input_tokens: todayInput,
      output_tokens: todayOutput,
      tokens: todayInput + todayOutput,
      sessions: todaySessions,
    };
    const statsYesterday = {
      cost: yesterdayCost,
      input_tokens: yesterdayInput,
      output_tokens: yesterdayOutput,
      tokens: yesterdayInput + yesterdayOutput,
      sessions: yesterdaySessions,
    };

    const activeSessions = activeSessionsRes.data || [];

    return NextResponse.json({
      // New canonical shape (Topbar, Sidebar, new Home)
      active_session: activeSessions,
      mounted_handoffs: mountedHandoffs,
      recent_handoffs: recentHandoffs,
      stats_today: statsToday,
      stats_yesterday: statsYesterday,
      handoffs_active: handoffsActiveCountRes.count ?? 0,
      notes_unresolved: notesUnresolvedCountRes.count ?? 0,
      sessions_total: sessionsMonthCountRes.count ?? 0,
      entities_total: entitiesCountRes.count ?? 0,
      system_issues: hookErrorsCountRes.count ?? 0,
      tasks_open: tasksOpenCountRes.count ?? 0,

      // Kept for back-compat with older code paths
      hero,
      latest_handoff: latestHandoff,
      open_handoffs: openHandoffs,
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
