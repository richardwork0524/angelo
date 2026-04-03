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
