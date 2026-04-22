import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

/**
 * POST /api/missions
 * Create a mission row in angelo_projects.
 * Body: { name: string, parent_key: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, parent_key } = body as { name?: string; parent_key?: string };

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }
    if (!parent_key || typeof parent_key !== "string") {
      return NextResponse.json({ error: "parent_key is required" }, { status: 400 });
    }

    const trimmedName = name.trim();
    // Generate child_key from name: lowercase, spaces → dashes, strip special chars
    const child_key = trimmedName
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .slice(0, 80);

    const { data, error } = await supabase
      .from("angelo_projects")
      .insert({
        child_key,
        display_name: trimmedName,
        entity_type: "mission",
        parent_key,
        status: "ACTIVE",
      })
      .select("child_key, display_name, entity_type, parent_key, status")
      .single();

    if (error) {
      // If duplicate child_key, append timestamp
      if (error.code === "23505") {
        const unique_key = `${child_key}-${Date.now().toString(36)}`;
        const { data: data2, error: error2 } = await supabase
          .from("angelo_projects")
          .insert({
            child_key: unique_key,
            display_name: trimmedName,
            entity_type: "mission",
            parent_key,
            status: "ACTIVE",
          })
          .select("child_key, display_name, entity_type, parent_key, status")
          .single();
        if (error2) throw error2;
        return NextResponse.json({ mission: data2 }, { status: 201 });
      }
      throw error;
    }

    return NextResponse.json({ mission: data }, { status: 201 });
  } catch (err) {
    console.error("Mission POST error:", err);
    return NextResponse.json({ error: "Failed to create mission" }, { status: 500 });
  }
}
