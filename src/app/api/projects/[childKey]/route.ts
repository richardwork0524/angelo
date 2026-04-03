import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

interface TaskRow {
  id: string;
  text: string;
  completed: boolean;
  bucket: string;
  priority: string | null;
  is_owner_action: boolean | null;
  parent_task_id: string | null;
  sort_order: number | null;
  created_at: string;
}

interface NestedTask {
  id: string;
  text: string;
  completed: boolean;
  bucket: string;
  priority: string | null;
  is_owner_action: boolean;
  parent_task_id: string | null;
  sub_tasks: NestedTask[];
}

function nestTasks(tasks: TaskRow[]): NestedTask[] {
  const taskMap = new Map<string, NestedTask>();
  const roots: NestedTask[] = [];

  // Initialize all tasks
  for (const t of tasks) {
    taskMap.set(t.id, {
      id: t.id,
      text: t.text,
      completed: t.completed,
      bucket: t.bucket,
      priority: t.priority || null,
      is_owner_action: t.is_owner_action || false,
      parent_task_id: t.parent_task_id || null,
      sub_tasks: [],
    });
  }

  // Wire parent-child
  for (const t of tasks) {
    const node = taskMap.get(t.id)!;
    if (t.parent_task_id && taskMap.has(t.parent_task_id)) {
      taskMap.get(t.parent_task_id)!.sub_tasks.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ childKey: string }> }
) {
  const { childKey } = await params;

  try {
    const { data: project, error: projError } = await supabase
      .from("angelo_projects")
      .select("*")
      .eq("child_key", childKey)
      .single();

    if (projError || !project) {
      return NextResponse.json(
        { error: { code: "404", type: "not_found", message: "Project not found" } },
        { status: 404 }
      );
    }

    const { data: tasks, error: taskError } = await supabase
      .from("angelo_tasks")
      .select("*")
      .eq("project_key", childKey)
      .order("sort_order")
      .order("created_at");

    if (taskError) throw taskError;

    const allTasks = (tasks || []) as TaskRow[];
    const nested = nestTasks(allTasks);

    const grouped = {
      this_week: nested.filter((t) => t.bucket === "THIS_WEEK" && !t.completed),
      this_month: nested.filter((t) => t.bucket === "THIS_MONTH" && !t.completed),
      parked: nested.filter((t) => t.bucket === "PARKED" && !t.completed),
      completed: nested.filter((t) => t.completed),
    };

    // Fetch last 3 session logs
    let session_logs: { id: string; session_date: string; title: string | null; surface: string | null; summary: string | null }[] = [];
    try {
      const { data: logs } = await supabase
        .from("angelo_session_logs")
        .select("id, session_date, title, surface, summary")
        .eq("project_key", childKey)
        .order("session_date", { ascending: false })
        .limit(3);
      if (logs) session_logs = logs;
    } catch {
      // Session logs table may not exist yet — gracefully skip
    }

    return NextResponse.json({
      child_key: project.child_key,
      display_name: project.display_name,
      brief: project.brief,
      status: project.status || null,
      build_phase: project.build_phase || null,
      surface: project.surface || null,
      last_session_date: project.last_session_date,
      next_action: project.next_action || null,
      tasks: grouped,
      session_logs,
    });
  } catch (err) {
    console.error("Project detail error:", err);
    return NextResponse.json(
      { error: { code: "500", type: "internal_error", message: "Failed to load project" } },
      { status: 500 }
    );
  }
}
