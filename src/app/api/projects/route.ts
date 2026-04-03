import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  try {
    const { data: projects, error: projError } = await supabase
      .from("angelo_projects")
      .select("*")
      .order("display_name");

    if (projError) throw projError;

    // Get task counts per project (open + completed)
    const { data: taskCounts, error: taskError } = await supabase
      .from("angelo_tasks")
      .select("project_key, bucket, completed");

    if (taskError) throw taskError;

    // Build count maps
    const openCountMap = new Map<string, { this_week: number; this_month: number; parked: number }>();
    const completedCountMap = new Map<string, number>();

    for (const t of taskCounts || []) {
      if (t.completed) {
        completedCountMap.set(t.project_key, (completedCountMap.get(t.project_key) || 0) + 1);
        continue;
      }
      if (!openCountMap.has(t.project_key)) {
        openCountMap.set(t.project_key, { this_week: 0, this_month: 0, parked: 0 });
      }
      const c = openCountMap.get(t.project_key)!;
      if (t.bucket === "THIS_WEEK") c.this_week++;
      else if (t.bucket === "THIS_MONTH") c.this_month++;
      else if (t.bucket === "PARKED") c.parked++;
    }

    // Determine leaf nodes and child counts
    const allProjects = projects || [];
    const childCountMap = new Map<string, number>();
    for (const p of allProjects) {
      if (p.parent_key) {
        childCountMap.set(p.parent_key, (childCountMap.get(p.parent_key) || 0) + 1);
      }
    }

    // Build parent-children map for recursive rollup
    const childrenMap = new Map<string, string[]>();
    for (const p of allProjects) {
      if (p.parent_key) {
        if (!childrenMap.has(p.parent_key)) childrenMap.set(p.parent_key, []);
        childrenMap.get(p.parent_key)!.push(p.child_key);
      }
    }

    // Recursive descendant task total
    function getDescendantTotal(key: string): number {
      const ownCounts = openCountMap.get(key);
      let total = ownCounts ? ownCounts.this_week + ownCounts.this_month + ownCounts.parked : 0;
      const children = childrenMap.get(key) || [];
      for (const childKey of children) {
        total += getDescendantTotal(childKey);
      }
      return total;
    }

    const result = allProjects.map((p) => {
      const isLeaf = !childCountMap.has(p.child_key) || (childCountMap.get(p.child_key) || 0) === 0;
      const tc = openCountMap.get(p.child_key) || { this_week: 0, this_month: 0, parked: 0 };

      // Direct children task total (one level)
      let childrenTaskTotal = 0;
      if (!isLeaf) {
        const directChildren = allProjects.filter((c) => c.parent_key === p.child_key);
        for (const child of directChildren) {
          const cc = openCountMap.get(child.child_key);
          if (cc) childrenTaskTotal += cc.this_week + cc.this_month + cc.parked;
        }
      }

      // Recursive descendant total (all levels, including own)
      const descendantTaskTotal = getDescendantTotal(p.child_key);

      return {
        ...p,
        status: p.status || null,
        build_phase: p.build_phase || null,
        is_leaf: isLeaf,
        task_counts: tc,
        children_task_total: childrenTaskTotal,
        descendant_task_total: descendantTaskTotal,
        child_count: childCountMap.get(p.child_key) || 0,
        completed_count: completedCountMap.get(p.child_key) || 0,
      };
    });

    return NextResponse.json({ projects: result });
  } catch (err) {
    console.error("Projects API error:", err);
    return NextResponse.json(
      { error: { code: "500", type: "internal_error", message: "Failed to load projects" } },
      { status: 500 }
    );
  }
}
