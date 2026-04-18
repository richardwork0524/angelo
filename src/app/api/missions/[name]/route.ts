import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  const missionName = decodeURIComponent(name);

  try {
    const { data: tasks, error } = await supabase
      .from("angelo_tasks")
      .select("id, text, description, project_key, bucket, priority, surface, is_owner_action, task_type, mission, version, updated_at, progress, log, parent_task_id, completed, task_code")
      .eq("mission", missionName)
      .order("updated_at", { ascending: false });

    if (error) throw error;

    const allTasks = tasks || [];
    const open = allTasks.filter((t) => !t.completed);
    const completed = allTasks.filter((t) => t.completed);

    const grouped = {
      this_week: open.filter((t) => t.bucket === "THIS_WEEK"),
      this_month: open.filter((t) => t.bucket === "THIS_MONTH"),
      parked: open.filter((t) => t.bucket === "PARKED"),
      completed,
    };

    const stats = {
      open: open.length,
      completed: completed.length,
      p0: open.filter((t) => t.priority === "P0").length,
      p1: open.filter((t) => t.priority === "P1").length,
      p2: open.filter((t) => t.priority === "P2").length,
    };

    // Project keys touched by this mission (for scoping handoffs + notes)
    const projectKeys = Array.from(new Set(allTasks.map((t) => t.project_key).filter(Boolean)));

    const [handoffsRes, notesRes] = await Promise.all([
      projectKeys.length > 0
        ? supabase
            .from("angelo_handoffs")
            .select("id, handoff_code, project_key, scope_type, scope_name, entry_point, version, sections_completed, sections_total, status, purpose, is_mounted, updated_at")
            .in("project_key", projectKeys)
            .ilike("scope_name", `%${missionName}%`)
            .order("updated_at", { ascending: false })
            .limit(8)
        : Promise.resolve({ data: [] }),
      projectKeys.length > 0
        ? supabase
            .from("angelo_notes")
            .select("id, project_key, text, note_type, mission, resolved, created_at")
            .eq("mission", missionName)
            .eq("resolved", false)
            .order("created_at", { ascending: false })
            .limit(8)
        : Promise.resolve({ data: [] }),
    ]);

    return NextResponse.json({
      mission: missionName,
      stats,
      tasks: grouped,
      project_keys: projectKeys,
      handoffs: handoffsRes.data || [],
      notes: notesRes.data || [],
    });
  } catch (err) {
    console.error("Mission detail error:", err);
    return NextResponse.json(
      { error: "Failed to load mission" },
      { status: 500 }
    );
  }
}
