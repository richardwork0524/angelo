import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

interface SessionRow {
  id: string;
  session_code: string | null;
  session_date: string;
  title: string | null;
  surface: string | null;
  summary: string | null;
  cost_usd: number | null;
  input_tokens: number | null;
  output_tokens: number | null;
  created_at: string;
  role: 'created' | 'picked_up';
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const { data: handoff, error } = await supabase
      .from("angelo_handoffs")
      .select(
        `id, handoff_code, created_by_session_id, project_key, scope_type, scope_name, entry_point, version, sections_total, sections_completed, sections_remaining, source, status, picked_up_by_session_id, notes, vault_path, purpose, is_mounted, created_at, updated_at,
        mission:angelo_projects!mission_id(display_name)`
      )
      .eq("id", id)
      .single();

    if (error || !handoff) {
      return NextResponse.json(
        { error: { code: "404", message: "Handoff not found" } },
        { status: 404 }
      );
    }

    // Parent project lookup (for breadcrumb)
    const { data: project } = await supabase
      .from("angelo_projects")
      .select("child_key, display_name, parent_key, entity_type")
      .eq("child_key", handoff.project_key)
      .maybeSingle();

    // Pull sessions that either created or picked-up this handoff
    const sessionIds = [handoff.created_by_session_id, handoff.picked_up_by_session_id].filter(Boolean) as string[];
    let sessions: SessionRow[] = [];
    if (sessionIds.length > 0) {
      const { data: sess } = await supabase
        .from("angelo_session_logs")
        .select("id, session_code, session_date, title, surface, summary, cost_usd, input_tokens, output_tokens, created_at")
        .in("id", sessionIds)
        .order("session_date", { ascending: false });
      sessions = (sess || []).map((s) => ({
        ...s,
        role: s.id === handoff.created_by_session_id ? 'created' : 'picked_up',
      })) as SessionRow[];
    }

    // Notes whose session_log_id is in this handoff's session set OR project-level notes
    const { data: notes } = await supabase
      .from("angelo_notes")
      .select("id, project_key, text, note_type, resolved, created_at, session_log_id")
      .eq("project_key", handoff.project_key)
      .eq("resolved", false)
      .order("created_at", { ascending: false })
      .limit(12);

    // Aggregate token/cost totals across linked sessions
    const tokens_total = sessions.reduce((a, s) => a + (s.input_tokens || 0) + (s.output_tokens || 0), 0);
    const cost_total = sessions.reduce((a, s) => a + (Number(s.cost_usd) || 0), 0);

    // Flatten the mission join
    const { mission: missionJoin, ...handoffBase } = handoff as typeof handoff & {
      mission?: { display_name: string } | null;
    };
    const mission_display_name: string | null = missionJoin?.display_name ?? null;

    return NextResponse.json({
      ...handoffBase,
      mission_display_name,
      project,
      sessions,
      attached_notes: notes || [],
      tokens_total,
      cost_total,
    });
  } catch (err) {
    console.error("Handoff detail API error:", err);
    return NextResponse.json(
      { error: { code: "500", message: "Failed to load handoff" } },
      { status: 500 }
    );
  }
}
