import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const projectFilter = request.nextUrl.searchParams.get("project");
  const statusFilter = request.nextUrl.searchParams.get("status");
  const limit = parseInt(request.nextUrl.searchParams.get("limit") || "50");
  const offset = parseInt(request.nextUrl.searchParams.get("offset") || "0");

  try {
    let query = supabase
      .from("angelo_handoffs")
      .select(
        "id, handoff_code, created_by_session_id, project_key, scope_type, scope_name, entry_point, version, sections_total, sections_completed, sections_remaining, source, status, picked_up_by_session_id, notes, vault_path, created_at, updated_at",
        { count: "exact" }
      )
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (statusFilter) {
      query = query.eq("status", statusFilter);
    }

    if (projectFilter) {
      // Support filtering by parent (include all descendants)
      const { data: allProjects } = await supabase
        .from("angelo_projects")
        .select("child_key, parent_key")
        .neq("status", "ARCHIVED");

      function getDescendantLeaves(key: string): string[] {
        const children = (allProjects || []).filter((p) => p.parent_key === key);
        if (children.length === 0) return [key];
        const leaves: string[] = [];
        for (const child of children) {
          leaves.push(...getDescendantLeaves(child.child_key));
        }
        return leaves;
      }

      const leafKeys = getDescendantLeaves(projectFilter);
      query = query.in("project_key", leafKeys);
    }

    const { data: handoffs, count } = await query;

    return NextResponse.json({
      handoffs: handoffs || [],
      total: count || 0,
      offset,
      limit,
    });
  } catch (err) {
    console.error("Handoffs API error:", err);
    return NextResponse.json({ error: "Failed to load handoffs" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, status } = body;

    if (!id || !status) {
      return NextResponse.json({ error: "id and status required" }, { status: 400 });
    }

    const { error } = await supabase
      .from("angelo_handoffs")
      .update({ status })
      .eq("id", id);

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Handoffs PATCH error:", err);
    return NextResponse.json({ error: "Failed to update handoff" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }

    // Read handoff to get vault_path before deleting
    const { data: handoff } = await supabase
      .from("angelo_handoffs")
      .select("id, vault_path, project_key, scope_name")
      .eq("id", id)
      .single();

    if (!handoff) {
      return NextResponse.json({ error: "Handoff not found" }, { status: 404 });
    }

    // Queue vault file archive if vault_path exists
    if (handoff.vault_path) {
      await supabase.from("pending_sync_actions").insert({
        action_type: "archive_handoff",
        project_key: handoff.project_key,
        payload: {
          vault_path: handoff.vault_path,
          scope_name: handoff.scope_name,
          handoff_id: handoff.id,
        },
      });
    }

    // Delete from DB
    const { error } = await supabase
      .from("angelo_handoffs")
      .delete()
      .eq("id", id);

    if (error) throw error;

    return NextResponse.json({ ok: true, archived: !!handoff.vault_path });
  } catch (err) {
    console.error("Handoffs DELETE error:", err);
    return NextResponse.json({ error: "Failed to delete handoff" }, { status: 500 });
  }
}
