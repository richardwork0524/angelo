import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const parentKey = request.nextUrl.searchParams.get("parent");
  const limit = parseInt(request.nextUrl.searchParams.get("limit") || "50");
  const offset = parseInt(request.nextUrl.searchParams.get("offset") || "0");

  try {
    let query = supabase
      .from("angelo_session_logs")
      .select("id, project_key, session_date, title, surface, summary, created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (parentKey) {
      // Get all descendant leaf keys
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

      const leafKeys = getDescendantLeaves(parentKey);
      query = query.in("project_key", leafKeys);
    }

    const { data: sessions, count } = await query;

    return NextResponse.json({
      sessions: sessions || [],
      total: count || 0,
      offset,
      limit,
    });
  } catch (err) {
    console.error("Sessions API error:", err);
    return NextResponse.json({ error: "Failed to load sessions" }, { status: 500 });
  }
}
