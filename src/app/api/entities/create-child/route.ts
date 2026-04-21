import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { isValidChild } from "@/lib/hierarchy-rules";
import type { EntityType } from "@/lib/hierarchy-rules";

interface CreateChildBody {
  parent_key: string;
  child_key: string;
  display_name: string;
  entity_type: string;
}

export async function POST(req: NextRequest) {
  let body: CreateChildBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { parent_key, child_key, display_name, entity_type } = body;

  if (!parent_key || !child_key || !display_name || !entity_type) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // 1. Look up parent
  const { data: parent, error: parentError } = await supabase
    .from("angelo_projects")
    .select("id, child_key, display_name, entity_type")
    .eq("child_key", parent_key)
    .maybeSingle();

  if (parentError || !parent) {
    return NextResponse.json({ error: "Parent not found" }, { status: 404 });
  }

  // 2. Validate child type
  if (!isValidChild(parent.entity_type as EntityType, entity_type as EntityType | "task")) {
    return NextResponse.json(
      { error: "Invalid child type for this parent" },
      { status: 400 }
    );
  }

  // 3. Insert into angelo_tasks if entity_type === 'task'
  if (entity_type === "task") {
    const { data: newTask, error: insertError } = await supabase
      .from("angelo_tasks")
      .insert({
        text: display_name,
        project_key: parent.child_key,
        mission_id: parent.id,
        bucket: "THIS_WEEK",
        completed: false,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Task insert error:", insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json(newTask);
  }

  // 4. Otherwise insert into angelo_projects
  const { data: newEntity, error: insertError } = await supabase
    .from("angelo_projects")
    .insert({
      child_key,
      display_name,
      entity_type,
      parent_key,
    })
    .select()
    .single();

  if (insertError) {
    // 5. UNIQUE constraint violation on child_key
    if (insertError.code === "23505") {
      return NextResponse.json({ error: "child_key already exists" }, { status: 409 });
    }
    console.error("Entity insert error:", insertError);
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json(newEntity);
}
