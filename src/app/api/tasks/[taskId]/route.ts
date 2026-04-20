import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await params;

  try {
    // Cascade-delete subtasks first — the FK on angelo_tasks.parent_task_id
    // is NO ACTION, so deleting a parent with subtasks would error out
    // (and the UI saw the task "re-appear" after the first delete attempt).
    const { error: subErr } = await supabase
      .from("angelo_tasks")
      .delete()
      .eq("parent_task_id", taskId);
    if (subErr) throw subErr;

    const { error } = await supabase
      .from("angelo_tasks")
      .delete()
      .eq("id", taskId);

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Task delete error:", err);
    return NextResponse.json({ error: "Failed to delete task" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await params;
  const body = await request.json();

  const update: Record<string, unknown> = {};

  // Handle status toggle (completed/open)
  if (body.status !== undefined) {
    if (!["open", "completed"].includes(body.status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    update.completed = body.status === "completed";
  }

  // Handle log_entry (append-only)
  if (body.log_entry) {
    const { type: entryType, message: entryMsg, section } = body.log_entry;
    if (entryType && entryMsg) {
      const { data: current } = await supabase.from("angelo_tasks").select("log").eq("id", taskId).single();
      const existingLog = Array.isArray(current?.log) ? current.log : [];
      update.log = [...existingLog, { timestamp: new Date().toISOString(), type: entryType, message: entryMsg, ...(section !== undefined ? { section } : {}) }];
    }
  }

  if (body.priority !== undefined) {
    const valid = ["P0", "P1", "P2", null];
    if (!valid.includes(body.priority)) {
      return NextResponse.json({ error: "Invalid priority" }, { status: 400 });
    }
    update.priority = body.priority;
  }

  if (body.bucket !== undefined) {
    const valid = ["THIS_WEEK", "THIS_MONTH", "PARKED"];
    if (!valid.includes(body.bucket)) {
      return NextResponse.json({ error: "Invalid bucket" }, { status: 400 });
    }
    update.bucket = body.bucket;
  }

  if (body.text !== undefined) {
    if (typeof body.text !== "string" || !body.text.trim()) {
      return NextResponse.json({ error: "Text cannot be empty" }, { status: 400 });
    }
    update.text = body.text.trim();
  }

  if (body.description !== undefined) {
    update.description = typeof body.description === "string" ? body.description.trim() || null : null;
  }

  if (body.mission !== undefined) {
    update.mission = typeof body.mission === "string" ? body.mission.trim() || null : null;
  }

  if (body.progress !== undefined) {
    if (body.progress === null) {
      update.progress = null;
    } else {
      const match = String(body.progress).match(/^(\d+)\/(\d+)$/);
      if (!match || parseInt(match[1]) > parseInt(match[2])) {
        return NextResponse.json({ error: "Progress must be N/M format" }, { status: 400 });
      }
      update.progress = body.progress;
    }
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No valid fields" }, { status: 400 });
  }

  try {
    const { data, error } = await supabase
      .from("angelo_tasks")
      .update(update)
      .eq("id", taskId)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ task: data });
  } catch (err) {
    console.error("Task update error:", err);
    return NextResponse.json({ error: "Failed to update task" }, { status: 500 });
  }
}
