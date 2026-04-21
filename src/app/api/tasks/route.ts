import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface TaskRow {
  id: string;
  project_key: string;
  text: string;
  description: string | null;
  bucket: string;
  priority: string | null;
  surface: string | null;
  is_owner_action: boolean | null;
  mission: string | null;
  version: string | null;
  task_code: string | null;
  progress: string | null;
  parent_task_id: string | null;
  completed: boolean;
  log: { timestamp: string; type: string; message: string }[] | null;
  sort_order: number | null;
  updated_at: string;
  created_at: string;
}

const PRIORITY_RANK: Record<string, number> = { P0: 0, P1: 1, P2: 2 };
const BUCKET_RANK: Record<string, number> = { THIS_WEEK: 0, THIS_MONTH: 1, PARKED: 2 };

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const project = searchParams.get("project");
  const bucket = searchParams.get("bucket");
  const priority = searchParams.get("priority");
  const mission = searchParams.get("mission");
  const completedParam = searchParams.get("completed") ?? "false";
  const search = searchParams.get("search");
  const includeSubtasks = searchParams.get("include_subtasks") !== "false";

  try {
    const taskCols =
      "id, project_key, text, description, bucket, priority, surface, is_owner_action, " +
      "mission, version, task_code, progress, parent_task_id, completed, log, sort_order, " +
      "updated_at, created_at";

    // Primary query: filtered tasks
    let q = supabase.from("angelo_tasks").select(taskCols);
    if (project) q = q.eq("project_key", project);
    if (bucket) q = q.eq("bucket", bucket);
    if (priority) q = q.eq("priority", priority);
    if (mission) q = q.eq("mission", mission);
    if (completedParam === "true") q = q.eq("completed", true);
    else if (completedParam !== "all") q = q.eq("completed", false);

    const [tasksRes, projectsRes, missionsMetaRes] = await Promise.all([
      q.order("updated_at", { ascending: false }),
      supabase
        .from("angelo_projects")
        .select("child_key, display_name, entity_type")
        .order("display_name"),
      // Missions across all tasks (unfiltered) for autocomplete sources
      supabase
        .from("angelo_tasks")
        .select("mission, project_key")
        .not("mission", "is", null),
    ]);

    if (tasksRes.error) throw tasksRes.error;
    if (projectsRes.error) throw projectsRes.error;

    let tasks = (tasksRes.data || []) as unknown as TaskRow[];

    // If filters hide parents but keep subtasks, pull missing parents so the tree renders
    if (includeSubtasks) {
      const parentIdsNeeded = new Set(
        tasks.filter((t) => t.parent_task_id).map((t) => t.parent_task_id as string)
      );
      const haveIds = new Set(tasks.map((t) => t.id));
      const missingParents = [...parentIdsNeeded].filter((id) => !haveIds.has(id));
      if (missingParents.length) {
        const { data: parents } = await supabase
          .from("angelo_tasks")
          .select(taskCols)
          .in("id", missingParents);
        if (parents) tasks = [...tasks, ...(parents as unknown as TaskRow[])];
      }

      // Conversely, if a parent is in the filtered set, pull any children that might
      // have been excluded (e.g. different bucket) so the tree stays coherent.
      const parentIdsInSet = tasks.filter((t) => !t.parent_task_id).map((t) => t.id);
      if (parentIdsInSet.length) {
        const { data: children } = await supabase
          .from("angelo_tasks")
          .select(taskCols)
          .in("parent_task_id", parentIdsInSet)
          .eq("completed", completedParam === "true");
        if (children) {
          const seen = new Set(tasks.map((t) => t.id));
          for (const c of children as unknown as TaskRow[]) {
            if (!seen.has(c.id)) tasks.push(c);
          }
        }
      }
    }

    // Text search across task text / mission / project_key / task_code
    if (search?.trim()) {
      const needle = search.trim().toLowerCase();
      tasks = tasks.filter((t) => {
        const hay = [t.text, t.description, t.mission, t.project_key, t.task_code]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(needle);
      });
    }

    // Stable sort: bucket asc, priority asc (P0 first), updated_at desc
    tasks.sort((a, b) => {
      const ab = BUCKET_RANK[a.bucket] ?? 99;
      const bb = BUCKET_RANK[b.bucket] ?? 99;
      if (ab !== bb) return ab - bb;
      const ap = a.priority ? PRIORITY_RANK[a.priority] ?? 9 : 9;
      const bp = b.priority ? PRIORITY_RANK[b.priority] ?? 9 : 9;
      if (ap !== bp) return ap - bp;
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });

    // Missions per project (autocomplete) + flat list
    const allMissions = new Set<string>();
    const missionsByProject: Record<string, Set<string>> = {};
    for (const row of missionsMetaRes.data || []) {
      if (!row.mission) continue;
      allMissions.add(row.mission);
      const key = row.project_key;
      if (!missionsByProject[key]) missionsByProject[key] = new Set();
      missionsByProject[key].add(row.mission);
    }
    const missionsByProjectArr: Record<string, string[]> = {};
    for (const [k, set] of Object.entries(missionsByProject)) {
      missionsByProjectArr[k] = [...set].sort();
    }

    // Stats reflect the open subset after all filters (subtask pulls included)
    const openTasks = tasks.filter((t) => !t.completed);
    const stats = {
      total: tasks.length,
      open: openTasks.length,
      completed: tasks.length - openTasks.length,
      p0: openTasks.filter((t) => t.priority === "P0").length,
      p1: openTasks.filter((t) => t.priority === "P1").length,
      p2: openTasks.filter((t) => t.priority === "P2").length,
      this_week: openTasks.filter((t) => t.bucket === "THIS_WEEK").length,
      this_month: openTasks.filter((t) => t.bucket === "THIS_MONTH").length,
      parked: openTasks.filter((t) => t.bucket === "PARKED").length,
    };

    return NextResponse.json({
      tasks,
      projects: projectsRes.data || [],
      missions: {
        all: [...allMissions].sort(),
        by_project: missionsByProjectArr,
      },
      stats,
      filters: { project, bucket, priority, mission, completed: completedParam, search },
    });
  } catch (err) {
    console.error("GET /api/tasks error:", err);
    return NextResponse.json(
      { error: { code: "500", message: "Failed to load tasks" } },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { project_key, text, bucket, priority, mission, parent_task_id, is_owner_action } = body;

  if (!project_key || typeof project_key !== "string" || !project_key.trim()) {
    return NextResponse.json({ error: "project_key is required" }, { status: 400 });
  }
  if (!text || typeof text !== "string" || !text.trim()) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }
  const validBuckets = ["THIS_WEEK", "THIS_MONTH", "PARKED"];
  if (!bucket || !validBuckets.includes(bucket)) {
    return NextResponse.json(
      { error: "bucket must be THIS_WEEK | THIS_MONTH | PARKED" },
      { status: 400 }
    );
  }
  if (priority && !["P0", "P1", "P2"].includes(priority)) {
    return NextResponse.json({ error: "priority must be P0 | P1 | P2" }, { status: 400 });
  }

  const insert: Record<string, unknown> = {
    project_key: project_key.trim(),
    text: text.trim(),
    bucket,
  };
  if (priority) insert.priority = priority;
  if (mission && typeof mission === "string" && mission.trim()) insert.mission = mission.trim();
  if (parent_task_id && typeof parent_task_id === "string") insert.parent_task_id = parent_task_id;
  if (is_owner_action === true) insert.is_owner_action = true;

  try {
    const { data, error } = await supabase
      .from("angelo_tasks")
      .insert(insert)
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ task: data }, { status: 201 });
  } catch (err) {
    console.error("POST /api/tasks error:", err);
    return NextResponse.json(
      { error: { code: "500", message: "Failed to create task" } },
      { status: 500 }
    );
  }
}
