import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ childKey: string; taskId: string }> }
) {
  const { taskId } = await params;
  const body = await request.json();

  // Build dynamic update object
  const update: Record<string, unknown> = {};

  // Handle status toggle (existing)
  if (body.status) {
    if (!["open", "completed"].includes(body.status)) {
      return NextResponse.json(
        { error: { code: "400", type: "validation_error", message: "Invalid status value" } },
        { status: 400 }
      );
    }
    update.completed = body.status === "completed";
  }

  // Handle text update
  if (body.text !== undefined) {
    if (typeof body.text !== "string" || !body.text.trim()) {
      return NextResponse.json(
        { error: { code: "400", type: "validation_error", message: "Task text cannot be empty" } },
        { status: 400 }
      );
    }
    update.text = body.text.trim();
  }

  // Handle priority
  if (body.priority !== undefined) {
    const validPriorities = ["P0", "P1", "P2", null];
    if (!validPriorities.includes(body.priority)) {
      return NextResponse.json(
        { error: { code: "400", type: "validation_error", message: "Invalid priority value" } },
        { status: 400 }
      );
    }
    update.priority = body.priority;
  }

  // Handle is_owner_action
  if (body.is_owner_action !== undefined) {
    if (typeof body.is_owner_action !== "boolean") {
      return NextResponse.json(
        { error: { code: "400", type: "validation_error", message: "is_owner_action must be boolean" } },
        { status: 400 }
      );
    }
    update.is_owner_action = body.is_owner_action;
  }

  // Handle mission
  if (body.mission !== undefined) {
    update.mission = typeof body.mission === "string" ? body.mission.trim() || null : null;
  }

  // Handle progress (format: "N/M" where N <= M)
  if (body.progress !== undefined) {
    if (body.progress === null) {
      update.progress = null;
    } else {
      const match = String(body.progress).match(/^(\d+)\/(\d+)$/);
      if (!match || parseInt(match[1]) > parseInt(match[2])) {
        return NextResponse.json(
          { error: { code: "400", type: "validation_error", message: "Progress must be in N/M format where N <= M" } },
          { status: 400 }
        );
      }
      update.progress = body.progress;
    }
  }

  // Handle bucket move (inline, no separate endpoint needed)
  if (body.bucket !== undefined) {
    const validBuckets = ["THIS_WEEK", "THIS_MONTH", "PARKED"];
    if (!validBuckets.includes(body.bucket)) {
      return NextResponse.json(
        { error: { code: "400", type: "validation_error", message: "Invalid bucket" } },
        { status: 400 }
      );
    }
    update.bucket = body.bucket;
  }

  // Handle log_entry (append-only)
  if (body.log_entry) {
    const { type: entryType, message: entryMsg, section } = body.log_entry;
    if (!entryType || !entryMsg) {
      return NextResponse.json(
        { error: { code: "400", type: "validation_error", message: "log_entry requires type and message" } },
        { status: 400 }
      );
    }
    // Read current log to append
    const { data: current } = await supabase.from("angelo_tasks").select("log").eq("id", taskId).single();
    const existingLog = Array.isArray(current?.log) ? current.log : [];
    update.log = [...existingLog, { timestamp: new Date().toISOString(), type: entryType, message: entryMsg, ...(section !== undefined ? { section } : {}) }];
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json(
      { error: { code: "400", type: "validation_error", message: "No valid fields to update" } },
      { status: 400 }
    );
  }

  try {
    const { data, error } = await supabase
      .from("angelo_tasks")
      .update(update)
      .eq("id", taskId)
      .select()
      .single();

    if (error) throw error;
    if (!data) {
      return NextResponse.json(
        { error: { code: "404", type: "not_found", message: "Task not found" } },
        { status: 404 }
      );
    }

    return NextResponse.json({ task: data });
  } catch (err) {
    console.error("Update task error:", err);
    return NextResponse.json(
      { error: { code: "500", type: "internal_error", message: "Failed to update task" } },
      { status: 500 }
    );
  }
}
