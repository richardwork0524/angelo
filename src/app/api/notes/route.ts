import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

const VALID_NOTE_TYPES = ["GAP", "IDEA", "OBSERVATION", "REVISIT"] as const;

export async function GET(request: NextRequest) {
  const projectKey = request.nextUrl.searchParams.get("project");
  const noteType = request.nextUrl.searchParams.get("type");
  const resolved = request.nextUrl.searchParams.get("resolved");
  const sessionLogId = request.nextUrl.searchParams.get("session_log_id");
  const limit = parseInt(request.nextUrl.searchParams.get("limit") || "50");
  const offset = parseInt(request.nextUrl.searchParams.get("offset") || "0");

  try {
    let query = supabase
      .from("angelo_notes")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (projectKey) query = query.eq("project_key", projectKey);
    if (noteType) query = query.eq("note_type", noteType.toUpperCase());
    if (resolved !== null && resolved !== undefined) {
      query = query.eq("resolved", resolved === "true");
    }
    if (sessionLogId) query = query.eq("session_log_id", sessionLogId);

    const { data: notes, count, error } = await query;
    if (error) throw error;

    return NextResponse.json({
      notes: notes || [],
      total: count || 0,
      offset,
      limit,
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
