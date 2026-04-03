import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  const missionName = decodeURIComponent(name);

  try {
    // Fetch all tasks for this mission (open + completed)
    const { data: tasks, error } = await supabase
      .from("angelo_tasks")
      .select("id, text, project_key, bucket, priority, surface, is_owner_action, task_type, mission, version, updated_at, progress, log, parent_task_id, completed, task_code")
      .eq("mission", missionName)
      .order("updated_at", { ascending: false });

    if (error) throw error;

    const allTasks = tasks || [];
    const open = allTasks.filter((t) => !t.completed);
    const completed = allTasks.filter((t) => t.completed);

    // Group open tasks by bucket
    const grouped = {
      this_week: open.filter((t) => t.bucket === "THIS_WEEK"),
      this_month: open.filter((t) => t.bucket === "THIS_MONTH"),
      parked: open.filter((t) => t.bucket === "PARKED"),
      completed,
    };

    // Stats
    const stats = {
      open: open.length,
      completed: completed.length,
      p0: open.filter((t) => t.priority === "P0").length,
      p1: open.filter((t) => t.priority === "P1").length,
      p2: open.filter((t) => t.priority === "P2").length,
    };

    return NextResponse.json({
      mission: missionName,
      stats,
      tasks: grouped,
    });
  } catch (err) {
    console.error("Mission detail error:", err);
    return NextResponse.json(
      { error: "Failed to load mission" },
      { status: 500 }
    );
  }
}
