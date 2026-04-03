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
      .select("id, text, project_key, bucket, priority, surface, is_owner_action, task_type, mission, root, version, updated_at, progress, log, parent_task_id, completed, task_code")
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

    // 6. Build project cards with inline task counts + previews
    const directChildren = (allProjects || []).filter((p) => p.parent_key === parentKey);
    const cards = directChildren.map((p) => {
      const childLeaves = getDescendantLeaves(p.child_key);
      let openCount = 0;
      let p0 = 0, p1 = 0, p2 = 0;
      let thisWeek = 0, thisMonth = 0;
      const cardTasks: typeof tasks = [];
      for (const lk of childLeaves) {
        const lt = tasksByProject.get(lk) || [];
        openCount += lt.length;
        for (const t of lt) {
          cardTasks.push(t);
          if (t.priority === "P0") p0++;
          else if (t.priority === "P1") p1++;
          else if (t.priority === "P2") p2++;
          if (t.bucket === "THIS_WEEK") thisWeek++;
          else if (t.bucket === "THIS_MONTH") thisMonth++;
        }
      }
      // Top 3 task previews (prioritize P0 > P1 > P2)
      const sorted = cardTasks.sort((a, b) => {
        const pOrder: Record<string, number> = { P0: 0, P1: 1, P2: 2 };
        return (pOrder[a.priority || ""] ?? 3) - (pOrder[b.priority || ""] ?? 3);
      });
      const previews = sorted.slice(0, 3).map((t) => ({
        id: t.id,
        text: t.text,
        priority: t.priority,
        mission: t.mission,
        progress: t.progress,
        task_code: t.task_code,
        surface: t.surface,
        is_owner_action: t.is_owner_action,
        bucket: t.bucket,
        project_key: t.project_key,
        updated_at: t.updated_at,
      }));

      return {
        child_key: p.child_key,
        display_name: p.display_name,
        status: p.status,
        brief: p.brief,
        open_tasks: openCount,
        this_week: thisWeek,
        this_month: thisMonth,
        p0,
        p1,
        p2,
        previews,
        is_leaf: !(allProjects || []).some((c) => c.parent_key === p.child_key),
      };
    });

    // 7. Missions — group tasks by mission field with task previews
    const missionMap = new Map<string, {
      mission: string;
      task_count: number;
      latest_task: string;
      latest_at: string;
      p0: number;
      p1: number;
      p2: number;
      tasks: { id: string; text: string; priority: string | null; task_code: string | null; project_key: string; bucket: string; surface: string | null; is_owner_action: boolean; updated_at: string }[];
    }>();
    for (const t of tasks || []) {
      if (!t.mission) continue;
      const existing = missionMap.get(t.mission);
      const taskPreview = { id: t.id, text: t.text, priority: t.priority, task_code: t.task_code, project_key: t.project_key, bucket: t.bucket, surface: t.surface, is_owner_action: t.is_owner_action, updated_at: t.updated_at };
      if (!existing) {
        missionMap.set(t.mission, {
          mission: t.mission,
          task_count: 1,
          latest_task: t.text,
          latest_at: t.updated_at,
          p0: t.priority === "P0" ? 1 : 0,
          p1: t.priority === "P1" ? 1 : 0,
          p2: t.priority === "P2" ? 1 : 0,
          tasks: [taskPreview],
        });
      } else {
        existing.task_count++;
        if (t.priority === "P0") existing.p0++;
        if (t.priority === "P1") existing.p1++;
        if (t.priority === "P2") existing.p2++;
        existing.tasks.push(taskPreview);
        if (t.updated_at > existing.latest_at) {
          existing.latest_task = t.text;
          existing.latest_at = t.updated_at;
        }
      }
    }
    const missions = Array.from(missionMap.values()).sort((a, b) => b.latest_at.localeCompare(a.latest_at));

    // 8. Recent hook actions (last 3)
    const { data: hookLogs } = await supabase
      .from("angelo_hook_logs")
      .select("hook_name, action, project_key, detail, created_at")
      .order("created_at", { ascending: false })
      .limit(3);

    // 9. Global stats
    const totalOpen = (tasks || []).length;
    const p0Total = tasksByPriority.P0?.length || 0;
    const p1Total = tasksByPriority.P1?.length || 0;
    const p2Total = tasksByPriority.P2?.length || 0;
    const weekTotal = (tasks || []).filter((t) => t.bucket === "THIS_WEEK").length;
    const monthTotal = (tasks || []).filter((t) => t.bucket === "THIS_MONTH").length;

    return NextResponse.json({
      parent_key: parentKey,
      stats: { open: totalOpen, p0: p0Total, p1: p1Total, p2: p2Total, this_week: weekTotal, this_month: monthTotal },
      cards: cards.sort((a, b) => b.open_tasks - a.open_tasks),
      tasks_by_priority: {
        P0: tasksByPriority.P0 || [],
        P1: tasksByPriority.P1 || [],
        P2: tasksByPriority.P2 || [],
        ALL: tasks || [],
      },
      missions,
      hook_logs: hookLogs || [],
      sessions: sessions || [],
      session_total: sessionCount || 0,
    });
  } catch (err) {
    console.error("Dashboard API error:", err);
    return NextResponse.json({ error: "Failed to load dashboard" }, { status: 500 });
  }
}
