import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import type { EntityType, EntitySummary } from "@/lib/types";

interface ProjectRow {
  child_key: string;
  display_name: string;
  entity_type: EntityType | null;
  parent_key: string | null;
  brief: string | null;
  current_version: string | null;
  status: string | null;
  build_phase: string | null;
  last_session_date: string | null;
  updated_at: string | null;
}

interface TaskRow {
  project_key: string;
  completed: boolean;
}

export async function GET() {
  try {
    const [projectsRes, tasksRes] = await Promise.all([
      supabase
        .from("angelo_projects")
        .select("child_key, display_name, entity_type, parent_key, brief, current_version, status, build_phase, last_session_date, updated_at")
        .order("entity_type")
        .order("child_key"),
      supabase
        .from("angelo_tasks")
        .select("project_key, completed"),
    ]);

    if (projectsRes.error) throw projectsRes.error;
    if (tasksRes.error) throw tasksRes.error;

    const allProjects = (projectsRes.data || []) as ProjectRow[];
    const allTasks = (tasksRes.data || []) as TaskRow[];

    // Build parent → children map (one pass)
    const childrenByParent = new Map<string, ProjectRow[]>();
    for (const p of allProjects) {
      if (!p.parent_key) continue;
      const arr = childrenByParent.get(p.parent_key) || [];
      arr.push(p);
      childrenByParent.set(p.parent_key, arr);
    }

    // Recursive descendant key collection
    function descendantKeys(key: string): string[] {
      const out = [key];
      const queue = [key];
      while (queue.length) {
        const k = queue.shift()!;
        const kids = childrenByParent.get(k) || [];
        for (const kid of kids) {
          out.push(kid.child_key);
          queue.push(kid.child_key);
        }
      }
      return out;
    }

    // Build task counts by project_key (one pass)
    const tasksByKey = new Map<string, { open: number; total: number }>();
    for (const t of allTasks) {
      const c = tasksByKey.get(t.project_key) || { open: 0, total: 0 };
      c.total++;
      if (!t.completed) c.open++;
      tasksByKey.set(t.project_key, c);
    }

    // Folder-root parent_key values: rows whose parent is a non-entity folder bucket
    // (or null/root). These are the direct children we show on the list page.
    const FOLDER_ROOTS = new Set([
      'company',
      'app-development',
      'game-development',
      'website-development',
      'general',
      'group-strategy',
      'root',
    ]);

    // Build a set of entity child_keys (rows that have entity_type set)
    const entityKeys = new Set(allProjects.filter((p) => p.entity_type !== null).map((p) => p.child_key));

    // A project is "top-level" if its parent_key is null, a folder root, or not another entity
    function isTopLevel(p: ProjectRow): boolean {
      if (!p.parent_key) return true;
      if (FOLDER_ROOTS.has(p.parent_key)) return true;
      // If parent_key points to another entity row → it's a child entity, not top-level
      if (entityKeys.has(p.parent_key)) return false;
      // Parent is some unknown non-entity key (treat as folder root)
      return true;
    }

    const entities: EntitySummary[] = allProjects
      .filter((p) => p.entity_type !== null && p.status !== 'RETIRED' && isTopLevel(p))
      .map((p) => {
        const keys = descendantKeys(p.child_key);
        let tasksOpen = 0;
        let tasksTotal = 0;
        for (const k of keys) {
          const c = tasksByKey.get(k);
          if (c) {
            tasksOpen += c.open;
            tasksTotal += c.total;
          }
        }
        const direct = childrenByParent.get(p.child_key) || [];
        return {
          child_key: p.child_key,
          display_name: p.display_name,
          entity_type: p.entity_type!,
          parent_key: p.parent_key,
          brief: p.brief,
          current_version: p.current_version,
          status: p.status,
          build_phase: p.build_phase,
          last_session_date: p.last_session_date,
          children_count: direct.length,
          tasks_open: tasksOpen,
          tasks_total: tasksTotal,
          updated_at: p.updated_at,
        };
      });

    const ALL_ENTITY_TYPES = [
      'company', 'department', 'app', 'module', 'feature',
      'game', 'website', 'shell', 'meta', 'mission',
    ] as const;
    const byType = entities.reduce<Record<string, number>>(
      (acc, e) => {
        if (e.entity_type) acc[e.entity_type] = (acc[e.entity_type] ?? 0) + 1;
        return acc;
      },
      Object.fromEntries(ALL_ENTITY_TYPES.map((t) => [t, 0]))
    );

    return NextResponse.json({
      entities,
      total: entities.length,
      by_type: byType,
    });
  } catch (err) {
    console.error("Entities API error:", err);
    return NextResponse.json(
      { error: "Failed to load entities" },
      { status: 500 }
    );
  }
}
