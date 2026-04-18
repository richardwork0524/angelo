import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

const VALID_NOTE_TYPES = ["GAP", "IDEA", "OBSERVATION", "REVISIT"] as const;

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const projectKey = sp.get("project");
  const noteType = sp.get("type");
  const resolved = sp.get("resolved");
  const feature = sp.get("feature");
  const mission = sp.get("mission");
  const q = sp.get("q");
  const sessionLogId = sp.get("session_log_id");
  const limit = parseInt(sp.get("limit") || "200");
  const offset = parseInt(sp.get("offset") || "0");

  try {
    let query = supabase
      .from("angelo_notes")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (projectKey && projectKey !== "all") query = query.eq("project_key", projectKey);
    if (noteType && noteType !== "all") query = query.eq("note_type", noteType.toUpperCase());
    if (resolved && resolved !== "all") query = query.eq("resolved", resolved === "true");
    if (feature && feature !== "all") query = query.eq("feature", feature);
    if (mission && mission !== "all") query = query.eq("mission", mission);
    if (sessionLogId) query = query.eq("session_log_id", sessionLogId);
    if (q && q.trim()) {
      const term = q.trim().replace(/[%_]/g, "");
      query = query.ilike("text", `%${term}%`);
    }

    const { data: notes, count, error } = await query;
    if (error) throw error;

    const byTypeRes = await supabase
      .from("angelo_notes")
      .select("note_type,resolved");

    const by_type = { GAP: 0, IDEA: 0, OBSERVATION: 0, REVISIT: 0 } as Record<string, number>;
    let unresolved_total = 0;
    let total_all = 0;
    if (byTypeRes.data) {
      const rows = byTypeRes.data as { note_type: string; resolved: boolean }[];
      total_all = rows.length;
      for (const row of rows) {
        if (!row.resolved && row.note_type in by_type) {
          by_type[row.note_type] = (by_type[row.note_type] ?? 0) + 1;
          unresolved_total += 1;
        }
      }
    }

    return NextResponse.json({
      notes: notes || [],
      total: count || 0,
      offset,
      limit,
      stats: {
        unresolved_total,
        total_all,
        by_type,
      },
    });
  } catch (err) {
    console.error("Notes GET error:", err);
    return NextResponse.json({ error: "Failed to load notes" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  const { project_key, text, note_type, feature, mission, version, session_log_id } = body;

  if (!project_key || typeof project_key !== "string") {
    return NextResponse.json({ error: "project_key is required" }, { status: 400 });
  }
  if (!text || typeof text !== "string" || !text.trim()) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }
  if (!note_type || !VALID_NOTE_TYPES.includes(note_type.toUpperCase())) {
    return NextResponse.json(
      { error: `note_type must be one of: ${VALID_NOTE_TYPES.join(", ")}` },
      { status: 400 }
    );
  }

  try {
    const insert: Record<string, unknown> = {
      project_key,
      text: text.trim(),
      note_type: note_type.toUpperCase(),
    };
    if (feature) insert.feature = feature;
    if (mission) insert.mission = mission;
    if (version) insert.version = version;
    if (session_log_id) insert.session_log_id = session_log_id;

    const { data, error } = await supabase
      .from("angelo_notes")
      .insert(insert)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ note: data }, { status: 201 });
  } catch (err) {
    console.error("Notes POST error:", err);
    return NextResponse.json({ error: "Failed to create note" }, { status: 500 });
  }
}
