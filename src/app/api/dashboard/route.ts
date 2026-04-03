import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const parentKey = request.nextUrl.searchParams.get("parent") || "company";
  const limit = parseInt(request.nextUrl.searchParams.get("session_limit") || "3");

  try {
    // 1. All projects
    const { data: allProjects, error: projErr } = await supabase
      .from("angelo_projects")
      .select("child_key, parent_key, display_name, status, build_phase, brief, last_session_date, current_version")
      .neq("status", "ARCHIVED");
    if (projErr) throw projErr;

    // 2. Collect descendant leaf keys for the selected root tab
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

    // 3. All open tasks for these leaves (with priority)
    const { data: tasks } = await supabase
      .from("angelo_tasks")
      .select("id, text, project_key, bucket, priority, surface, is_owner_action, task_type, mission, root, version, updated_at")
      .in("project_key", leafKeys)
      .eq("completed", false)
      .order("updated_at", { ascending: false });

    // 4. Sessions (recent N + total count)
    const { data: sessions, count: sessionCount } = await supabase
      .from("angelo_session_logs")
      .select("id, project_key, session_date, title, surface, summary", { count: "exact" })
      .in("project_key", leafKeys)
      .order("created_at", { ascending: false })
      .limit(limit);

    // 5. Task counts per project + priority grouping
    const tasksByProject = new Map<string, typeof tasks>();
    const tasksByPriority: Record<string, typeof tasks> = { P0: [], P1: [], P2: [], NONE: [] };
    for (const t of tasks || []) {
      if (!tasksByProject.has(t.project_key)) tasksByProject.set(t.project_key, []);
      tasksByProject.get(t.project_key)!.push(t);
      const p = t.priority || "NONE";
      if (tasksByPriority[p]) tasksByPriority[p]!.push(t);
      else tasksByPriority.NONE!.push(t);
    }

    // 6. Build project cards with inline task counts
    const directChildren = (allProjects || []).filter((p) => p.parent_key === parentKey);
    const cards = directChildren.map((p) => {
      const childLeaves = getDescendantLeaves(p.child_key);
      let openCount = 0;
      let p0 = 0, p1 = 0, p2 = 0;
      for (const lk of childLeaves) {
        const lt = tasksByProject.get(lk) || [];
        openCount += lt.length;
        for (const t of lt) {
          if (t.priority === "P0") p0++;
          else if (t.priority === "P1") p1++;
          else if (t.priority === "P2") p2++;
        }
      }
      return {
        child_key: p.child_key,
        display_name: p.display_name,
        status: p.status,
        build_phase: p.build_phase,
        brief: p.brief,
        last_session_date: p.last_session_date,
        current_version: p.current_version,
        open_tasks: openCount,
        p0,
        p1,
        p2,
        is_leaf: !directChildren.some((c) => c.parent_key === p.child_key) &&
          !(allProjects || []).some((c) => c.parent_key === p.child_key),
      };
    });

    // 7. Global stats
    const totalOpen = (tasks || []).length;
    const p0Total = tasksByPriority.P0?.length || 0;
    const p1Total = tasksByPriority.P1?.length || 0;
    const p2Total = tasksByPriority.P2?.length || 0;

    return NextResponse.json({
      parent_key: parentKey,
      stats: { open: totalOpen, p0: p0Total, p1: p1Total, p2: p2Total },
      cards: cards.sort((a, b) => b.open_tasks - a.open_tasks),
      tasks_by_priority: {
        P0: tasksByPriority.P0 || [],
        P1: tasksByPriority.P1 || [],
        P2: tasksByPriority.P2 || [],
        ALL: tasks || [],
      },
      sessions: sessions || [],
      session_total: sessionCount || 0,
    });
  } catch (err) {
    console.error("Dashboard API error:", err);
    return NextResponse.json({ error: "Failed to load dashboard" }, { status: 500 });
  }
}
