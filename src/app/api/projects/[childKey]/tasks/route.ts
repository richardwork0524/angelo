import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ childKey: string }> }
) {
  const { childKey } = await params;
  const body = await request.json();
  const { text, bucket, priority, is_owner_action, parent_task_id } = body;

  if (!text || typeof text !== "string" || !text.trim()) {
    return NextResponse.json(
      { error: { code: "400", type: "validation_error", message: "Task text is required" } },
      { status: 400 }
    );
  }

  const validBuckets = ["THIS_WEEK", "THIS_MONTH", "PARKED"];
  if (!bucket || !validBuckets.includes(bucket)) {
    return NextResponse.json(
      { error: { code: "400", type: "validation_error", message: "Invalid bucket value" } },
      { status: 400 }
    );
  }

  // Validate optional priority
  if (priority !== undefined && priority !== null) {
    const validPriorities = ["P0", "P1", "P2"];
    if (!validPriorities.includes(priority)) {
      return NextResponse.json(
        { error: { code: "400", type: "validation_error", message: "Invalid priority value" } },
        { status: 400 }
      );
    }
  }

  try {
    const insertData: Record<string, unknown> = {
      project_key: childKey,
      text: text.trim(),
      bucket,
    };

    if (priority) insertData.priority = priority;
    if (is_owner_action === true) insertData.is_owner_action = true;
    if (parent_task_id) insertData.parent_task_id = parent_task_id;

    const { data, error } = await supabase
      .from("angelo_tasks")
      .insert(insertData)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ task: data }, { status: 201 });
  } catch (err) {
    console.error("Add task error:", err);
    return NextResponse.json(
      { error: { code: "500", type: "internal_error", message: "Failed to add task" } },
      { status: 500 }
    );
  }
}
