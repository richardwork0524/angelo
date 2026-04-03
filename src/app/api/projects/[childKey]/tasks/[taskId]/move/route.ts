import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ childKey: string; taskId: string }> }
) {
  const { taskId } = await params;
  const body = await request.json();
  const { target_bucket } = body;

  const validBuckets = ["THIS_WEEK", "THIS_MONTH", "PARKED"];
  if (!target_bucket || !validBuckets.includes(target_bucket)) {
    return NextResponse.json(
      { error: { code: "400", type: "validation_error", message: "Invalid target bucket" } },
      { status: 400 }
    );
  }

  try {
    const { data, error } = await supabase
      .from("angelo_tasks")
      .update({ bucket: target_bucket })
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
    console.error("Move task error:", err);
    return NextResponse.json(
      { error: { code: "500", type: "internal_error", message: "Failed to move task" } },
      { status: 500 }
    );
  }
}
