import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

interface TaskRow {
  id: string;
  text: string;
  description: string | null;
  completed: boolean;
  bucket: string;
  priority: string | null;
  is_owner_action: boolean | null;
  parent_task_id: string | null;
  sort_order: number | null;
  created_at: string;
  task_code: string | null;
  mission: string | null;
  version: string | null;
  surface: string | null;
  progress: string | null;
  log: unknown[] | null;
  updated_at: string;
  project_key: string;
}

interface NestedTask {
  id: string;
  text: string;
  description: string | null;
  completed: boolean;
  bucket: string;
  priority: string | null;
  is_owner_action: boolean;
  parent_task_id: string | null;
  task_code: string | null;
  mission: string | null;
  version: string | null;
  surface: string | null;
  progress: string | null;
  log: unknown[] | null;
  updated_at: string;
  project_key: string;
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
      description: t.description || null,
      completed: t.completed,
      bucket: t.bucket,
      priority: t.priority || null,
      is_owner_action: t.is_owner_action || false,
      parent_task_id: t.parent_task_id || null,
      task_code: t.task_code || null,
      mission: t.mission || null,
      version: t.version || null,
      surface: t.surface || null,
      progress: t.progress || null,
      log: t.log || null,
      updated_at: t.updated_at,
      project_key: t.project_key,
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
    // Fetch project + all projects (for child detection)
    const [projectResult, allProjectsResult] = await Promise.all([
      supabase.from("angelo_projects").select("*").eq("child_key", childKey).single(),
      supabase.from("angelo_projects").select("child_key, parent_key, display_name, status").neq("status", "ARCHIVED"),
    ]);

    const project = projectResult.data;
    if (projectResult.error || !project) {
      return NextResponse.json(
        { error: { code: "404", type: "not_found", message: "Project not found" } },
        { status: 404 }
      );
    }

    const allProjects = allProjectsResult.data || [];
    const directChildren = allProjects.filter((p) => p.parent_key === childKey);
    const is_leaf = directChildren.length === 0;

    // Collect all descendant keys (for non-leaf: include self + all descendants)
    function getDescendantKeys(key: string): string[] {
      const children = allProjects.filter((p) => p.parent_key === key);
      if (children.length === 0) return [key];
      const keys: string[] = [key];
      for (const child of children) {
        keys.push(...getDescendantKeys(child.child_key));
      }
      return keys;
    }
    const allKeys = is_leaf ? [childKey] : getDescendantKeys(childKey);

    // Parallel: tasks + session logs
    const [tasksResult, sessionsResult] = await Promise.all([
      supabase
        .from("angelo_tasks")
        .select("*")
        .in("project_key", allKeys)
        .order("sort_order")
        .order("created_at"),
      supabase
        .from("angelo_session_logs")
        .select("id, session_date, title, surface, summary, project_key")
        .in("project_key", allKeys)
        .order("session_date", { ascending: false })
        .limit(5),
    ]);

    if (tasksResult.error) throw tasksResult.error;

    const allTasks = (tasksResult.data || []) as TaskRow[];
    const nested = nestTasks(allTasks);

    const grouped = {
      this_week: nested.filter((t) => t.bucket === "THIS_WEEK" && !t.completed),
      this_month: nested.filter((t) => t.bucket === "THIS_MONTH" && !t.completed),
      parked: nested.filter((t) => t.bucket === "PARKED" && !t.completed),
      completed: nested.filter((t) => t.completed),
    };

    // Missions: group tasks by mission field
    const missionMap = new Map<string, {
      mission: string;
      task_count: number;
      p0: number; p1: number; p2: number;
      tasks: { id: string; text: string; priority: string | null; task_code: string | null; project_key: string; bucket: string; completed: boolean; updated_at: string }[];
    }>();
    for (const t of allTasks) {
      if (!t.mission || t.completed) continue;
      const existing = missionMap.get(t.mission);
      const preview = { id: t.id, text: t.text, priority: t.priority, task_code: t.task_code, project_key: t.project_key, bucket: t.bucket, completed: t.completed, updated_at: t.updated_at };
      if (!existing) {
        missionMap.set(t.mission, {
          mission: t.mission, task_count: 1,
          p0: t.priority === "P0" ? 1 : 0, p1: t.priority === "P1" ? 1 : 0, p2: t.priority === "P2" ? 1 : 0,
          tasks: [preview],
        });
      } else {
        existing.task_count++;
        if (t.priority === "P0") existing.p0++;
        if (t.priority === "P1") existing.p1++;
        if (t.priority === "P2") existing.p2++;
        existing.tasks.push(preview);
      }
    }
    const missions = Array.from(missionMap.values()).sort((a, b) => b.task_count - a.task_count);

    // Children info for non-leaf entities
    const children_info = directChildren.map((c) => {
      const cTasks = allTasks.filter((t) => t.project_key === c.child_key && !t.completed);
      return { child_key: c.child_key, display_name: c.display_name, status: c.status, open_tasks: cTasks.length };
    });

    return NextResponse.json({
      child_key: project.child_key,
      display_name: project.display_name,
      brief: project.brief,
      status: project.status || null,
      build_phase: project.build_phase || null,
      surface: project.surface || null,
      last_session_date: project.last_session_date,
      next_action: project.next_action || null,
      is_leaf,
      tasks: grouped,
      missions,
      children_info,
      session_logs: sessionsResult.data || [],
    });
  } catch (err) {
    console.error("Project detail error:", err);
    return NextResponse.json(
      { error: { code: "500", type: "internal_error", message: "Failed to load project" } },
      { status: 500 }
    );
  }
}
