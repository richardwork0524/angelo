import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const parentKey = request.nextUrl.searchParams.get("parent");
  if (!parentKey) {
    return NextResponse.json({ error: "parent param required" }, { status: 400 });
  }

  try {
    // Get all projects to find descendants
    const { data: allProjects, error: projErr } = await supabase
      .from("angelo_projects")
      .select("child_key, parent_key, display_name")
      .neq("status", "ARCHIVED");

    if (projErr) throw projErr;

    // Collect all descendant leaf keys recursively
    function getDescendantLeaves(key: string): string[] {
      const children = (allProjects || []).filter((p) => p.parent_key === key);
      if (children.length === 0) return [key]; // leaf
      const leaves: string[] = [];
      for (const child of children) {
        leaves.push(...getDescendantLeaves(child.child_key));
      }
      return leaves;
    }

    const leafKeys = getDescendantLeaves(parentKey);

    // Fetch recent tasks across all descendant leaves
    const { data: recentTasks } = await supabase
      .from("angelo_tasks")
      .select("id, text, project_key, bucket, completed, priority, is_owner_action, surface, updated_at")
      .in("project_key", leafKeys)
      .eq("completed", false)
      .order("updated_at", { ascending: false })
      .limit(8);

    // Fetch recent sessions across all descendant leaves
    const { data: recentSessions } = await supabase
      .from("angelo_session_logs")
      .select("id, project_key, session_date, title, surface, summary")
      .in("project_key", leafKeys)
      .order("session_date", { ascending: false })
      .limit(5);

    // Aggregate task counts
    const { data: taskCounts } = await supabase
      .from("angelo_tasks")
      .select("bucket, completed")
      .in("project_key", leafKeys);

    let openCount = 0;
    let completedCount = 0;
    const buckets = { this_week: 0, this_month: 0, parked: 0 };
    for (const t of taskCounts || []) {
      if (t.completed) {
        completedCount++;
      } else {
        openCount++;
        if (t.bucket === "THIS_WEEK") buckets.this_week++;
        else if (t.bucket === "THIS_MONTH") buckets.this_month++;
        else if (t.bucket === "PARKED") buckets.parked++;
      }
    }

    return NextResponse.json({
      parent_key: parentKey,
      leaf_count: leafKeys.length,
      stats: { open: openCount, completed: completedCount, buckets },
      recent_tasks: recentTasks || [],
      recent_sessions: recentSessions || [],
    });
  } catch (err) {
    console.error("Overview API error:", err);
    return NextResponse.json({ error: "Failed to load overview" }, { status: 500 });
  }
}
