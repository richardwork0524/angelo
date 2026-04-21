import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("angelo_active_sessions")
      .select(`
        *,
        mounted_handoff:angelo_handoffs!mounted_handoff_id(id, handoff_code, scope_name, project_key, is_mounted)
      `)
      .order("started_at", { ascending: false });

    if (error) {
      console.error("active-session API error:", error);
      return NextResponse.json({ error: "Failed to load active sessions" }, { status: 500 });
    }

    return NextResponse.json({ active_sessions: data || [] });
  } catch (err) {
    console.error("active-session API error:", err);
    return NextResponse.json({ error: "Failed to load active sessions" }, { status: 500 });
  }
}
