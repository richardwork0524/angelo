import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    // Accept either UUID id or module_key
    const isUuid = /^[0-9a-f-]{36}$/i.test(id);
    const mq = supabase
      .from("angelo_modules")
      .select("id, module_key, app_id, display_name, description, rinoa_path, status, sort_order, created_at, updated_at")
      .limit(1);
    const { data: modRows, error: modErr } = await (isUuid ? mq.eq("id", id) : mq.eq("module_key", id));

    if (modErr || !modRows || modRows.length === 0) {
      return NextResponse.json(
        { error: { code: "404", message: "Module not found" } },
        { status: 404 }
      );
    }
    const mod = modRows[0];

    const { data: app } = await supabase
      .from("angelo_apps")
      .select("id, app_key, project_key, display_name, description, rinoa_path, code_path, git_repo, deployed_url, status")
      .eq("id", mod.app_id)
      .maybeSingle();

    const { data: features } = await supabase
      .from("angelo_features")
      .select("id, feature_key, display_name, description, status, entry_point, rinoa_path, sort_order, updated_at")
      .eq("module_id", mod.id)
      .order("sort_order");

    // Handoffs targeting this module (via scope_type + scope_name match)
    const { data: handoffs } = await supabase
      .from("angelo_handoffs")
      .select("id, handoff_code, project_key, scope_type, scope_name, entry_point, version, sections_completed, sections_total, status, purpose, is_mounted, updated_at")
      .eq("scope_type", "module")
      .ilike("scope_name", `%${mod.display_name}%`)
      .order("updated_at", { ascending: false })
      .limit(10);

    // Tasks tied to this module's project (best-effort match)
    let missionAgg: { mission: string; open: number; total: number; p0: number; p1: number; p2: number }[] = [];
    if (app?.project_key) {
      const { data: tasks } = await supabase
        .from("angelo_tasks")
        .select("id, mission, completed, priority")
        .eq("project_key", app.project_key)
        .not("mission", "is", null);
      const map = new Map<string, { mission: string; open: number; total: number; p0: number; p1: number; p2: number }>();
      for (const t of tasks || []) {
        const key = t.mission as string;
        const existing = map.get(key) || { mission: key, open: 0, total: 0, p0: 0, p1: 0, p2: 0 };
        existing.total++;
        if (!t.completed) existing.open++;
        if (t.priority === "P0") existing.p0++;
        if (t.priority === "P1") existing.p1++;
        if (t.priority === "P2") existing.p2++;
        map.set(key, existing);
      }
      missionAgg = Array.from(map.values()).sort((a, b) => b.open - a.open);
    }

    // Notes (scope to the app's project_key, optionally filter feature==module_key)
    const { data: notes } = await supabase
      .from("angelo_notes")
      .select("id, project_key, text, note_type, feature, resolved, created_at")
      .eq("project_key", app?.project_key || mod.module_key)
      .eq("resolved", false)
      .order("created_at", { ascending: false })
      .limit(12);

    return NextResponse.json({
      ...mod,
      app,
      features: features || [],
      handoffs: handoffs || [],
      missions: missionAgg,
      notes: notes || [],
    });
  } catch (err) {
    console.error("Module detail API error:", err);
    return NextResponse.json(
      { error: { code: "500", message: "Failed to load module" } },
      { status: 500 }
    );
  }
}
