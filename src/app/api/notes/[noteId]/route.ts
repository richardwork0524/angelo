import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

const VALID_NOTE_TYPES = ["GAP", "IDEA", "OBSERVATION", "REVISIT"] as const;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ noteId: string }> }
) {
  const { noteId } = await params;

  try {
    const { data, error } = await supabase
      .from("angelo_notes")
      .select("*")
      .eq("id", noteId)
      .single();

    if (error) throw error;
    return NextResponse.json({ note: data });
  } catch (err) {
    console.error("Note GET error:", err);
    return NextResponse.json({ error: "Note not found" }, { status: 404 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ noteId: string }> }
) {
  const { noteId } = await params;
  const body = await request.json();

  const update: Record<string, unknown> = {};

  if (body.text !== undefined) {
    if (typeof body.text !== "string" || !body.text.trim()) {
      return NextResponse.json({ error: "text cannot be empty" }, { status: 400 });
    }
    update.text = body.text.trim();
  }

  if (body.note_type !== undefined) {
    const upper = String(body.note_type).toUpperCase();
    if (!VALID_NOTE_TYPES.includes(upper as typeof VALID_NOTE_TYPES[number])) {
      return NextResponse.json(
        { error: `note_type must be one of: ${VALID_NOTE_TYPES.join(", ")}` },
        { status: 400 }
      );
    }
    update.note_type = upper;
  }

  if (body.resolved !== undefined) {
    update.resolved = Boolean(body.resolved);
  }

  if (body.feature !== undefined) update.feature = body.feature || null;
  if (body.mission !== undefined) update.mission = body.mission || null;
  if (body.version !== undefined) update.version = body.version || null;
  if (body.revisit_version !== undefined) update.revisit_version = body.revisit_version || null;
  if (body.session_log_id !== undefined) update.session_log_id = body.session_log_id || null;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No valid fields" }, { status: 400 });
  }

  try {
    const { data, error } = await supabase
      .from("angelo_notes")
      .update(update)
      .eq("id", noteId)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ note: data });
  } catch (err) {
    console.error("Note PATCH error:", err);
    return NextResponse.json({ error: "Failed to update note" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ noteId: string }> }
) {
  const { noteId } = await params;

  try {
    const { error } = await supabase
      .from("angelo_notes")
      .delete()
      .eq("id", noteId);

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Note DELETE error:", err);
    return NextResponse.json({ error: "Failed to delete note" }, { status: 500 });
  }
}
