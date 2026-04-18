import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import type { EntityType } from "@/lib/types";

interface ProjectRow {
  child_key: string;
  display_name: string;
  entity_type: EntityType | null;
  parent_key: string | null;
  rinoa_path: string | null;
  brief: string | null;
  current_version: string | null;
  next_action: string | null;
  status: string | null;
  build_phase: string | null;
  last_session_date: string | null;
  updated_at: string | null;
}

interface TaskRow {
  id: string;
  project_key: string;
  text: string;
  bucket: string;
  completed: boolean;
  priority: string | null;
  mission: string | null;
  task_code: string | null;
  updated_at: string;
}

interface SessionRow {
  id: string;
  session_code: string | null;
  session_date: string;
  title: string | null;
  surface: string | null;
  summary: string | null;
  cost_usd: number | null;
  input_tokens: number | null;
  output_tokens: number | null;
  project_key: string | null;
}

interface NoteRow {
  id: string;
  project_key: string;
  text: string;
  note_type: string;
  resolved: boolean;
  created_at: string;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  const { key } = await params;

  try {
    const entityRes = await supabase
      .from("angelo_projects")
      .select("child_key, display_name, entity_type, parent_key, rinoa_path, brief, current_version, next_action, status, build_phase, last_session_date, updated_at")
      .eq("child_key", key)
      .single();

    if (entityRes.error || !entityRes.data) {
      return NextResponse.json(
        { error: { code: "404", message: "Entity not found" } },
        { status: 404 }
      );
    }

    const entity = entityRes.data as ProjectRow;
    if (!entity.entity_type) {
      return NextResponse.json(
        { error: { code: "400", message: "Not an entity (entity_type is null)" } },
        { status: 400 }
      );
    }

    // Build full hierarchy to collect descendants
    const allProjectsRes = await supabase
      .from("angelo_projects")
      .select("child_key, display_name, entity_type, parent_key, status, current_version, build_phase");

    const allProjects = (allProjectsRes.data || []) as ProjectRow[];
    const childrenByParent = new Map<string, ProjectRow[]>();
    for (const p of allProjects) {
      if (!p.parent_key) continue;
      const arr = childrenByParent.get(p.parent_key) || [];
      arr.push(p);
      childrenByParent.set(p.parent_key, arr);
    }
    function descendantKeys(k: string): string[] {
      const out = [k];
      const queue = [k];
      while (queue.length) {
        const x = queue.shift()!;
        const kids = childrenByParent.get(x) || [];
        for (const kid of kids) {
          out.push(kid.child_key);
          queue.push(kid.child_key);
        }
      }
      return out;
    }
    const allKeys = descendantKeys(key);

    // Parallel: direct children + tasks + sessions + notes (over entity + descendants)
    const [tasksRes, sessionsRes, notesRes] = await Promise.all([
      supabase
        .from("angelo_tasks")
        .select("id, project_key, text, bucket, completed, priority, mission, task_code, updated_at")
        .in("project_key", allKeys),
      supabase
        .from("angelo_session_logs")
        .select("id, session_code, session_date, title, surface, summary, cost_usd, input_tokens, output_tokens, project_key")
        .in("project_key", allKeys)
        .order("session_date", { ascending: false })
        .limit(10),
      supabase
        .from("angelo_notes")
        .select("id, project_key, text, note_type, resolved, created_at")
        .eq("project_key", key)
        .eq("resolved", false)
        .order("created_at", { ascending: false })
        .limit(8),
    ]);

    const tasks = (tasksRes.data || []) as TaskRow[];
    const sessions = (sessionsRes.data || []) as SessionRow[];
    const notes = (notesRes.data || []) as NoteRow[];

    const tasksOpen = tasks.filter((t) => !t.completed).length;
    const tasksDone = tasks.filter((t) => t.completed).length;
    const tasksByBucket = {
      this_week: tasks.filter((t) => t.bucket === "THIS_WEEK" && !t.completed).length,
      this_month: tasks.filter((t) => t.bucket === "THIS_MONTH" && !t.completed).length,
      parked: tasks.filter((t) => t.bucket === "PARKED" && !t.completed).length,
    };

    // Task counts per direct child key for sub-item cards
    const directChildren = childrenByParent.get(key) || [];
    const sub_items = directChildren.map((c) => {
      const childKeys = descendantKeys(c.child_key);
      const childTasks = tasks.filter((t) => childKeys.includes(t.project_key));
      return {
        child_key: c.child_key,
        display_name: c.display_name,
        entity_type: c.entity_type,
        status: c.status,
        current_version: c.current_version,
        build_phase: c.build_phase,
        tasks_open: childTasks.filter((t) => !t.completed).length,
        tasks_total: childTasks.length,
      };
    });

    // Missions aggregated from tasks
    const missionMap = new Map<string, { mission: string; task_count: number; p0: number; p1: number; p2: number; open: number }>();
    for (const t of tasks) {
      if (!t.mission) continue;
      const existing = missionMap.get(t.mission);
      if (!existing) {
        missionMap.set(t.mission, {
          mission: t.mission,
          task_count: 1,
          p0: t.priority === "P0" ? 1 : 0,
          p1: t.priority === "P1" ? 1 : 0,
          p2: t.priority === "P2" ? 1 : 0,
          open: t.completed ? 0 : 1,
        });
      } else {
        existing.task_count++;
        if (t.priority === "P0") existing.p0++;
        if (t.priority === "P1") existing.p1++;
        if (t.priority === "P2") existing.p2++;
        if (!t.completed) existing.open++;
      }
    }
    const missions = Array.from(missionMap.values()).sort((a, b) => b.open - a.open || b.task_count - a.task_count);

    return NextResponse.json({
      child_key: entity.child_key,
      display_name: entity.display_name,
      entity_type: entity.entity_type,
      parent_key: entity.parent_key,
      rinoa_path: entity.rinoa_path,
      brief: entity.brief,
      current_version: entity.current_version,
      next_action: entity.next_action,
      status: entity.status,
      build_phase: entity.build_phase,
      last_session_date: entity.last_session_date,
      updated_at: entity.updated_at,
      tasks_open: tasksOpen,
      tasks_done: tasksDone,
      tasks_by_bucket: tasksByBucket,
      sub_items,
      missions,
      recent_sessions: sessions,
      notes,
    });
  } catch (err) {
    console.error("Entity detail API error:", err);
    return NextResponse.json(
      { error: { code: "500", message: "Failed to load entity" } },
      { status: 500 }
    );
  }
}
