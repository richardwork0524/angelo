import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import type { App, AppModule, Feature, AppWithChildren } from "@/lib/types";

export async function GET() {
  try {
    const [appsRes, modulesRes, featuresRes] = await Promise.all([
      supabase.from("angelo_apps").select("*").order("sort_order").order("display_name"),
      supabase.from("angelo_modules").select("*").order("sort_order").order("display_name"),
      supabase.from("angelo_features").select("*").order("sort_order").order("display_name"),
    ]);

    if (appsRes.error) throw appsRes.error;

    const apps = (appsRes.data || []) as App[];
    const modules = (modulesRes.data || []) as AppModule[];
    const features = (featuresRes.data || []) as Feature[];

    const tree: AppWithChildren[] = apps.map((app) => ({
      ...app,
      modules: modules
        .filter((m) => m.app_id === app.id)
        .map((m) => ({
          ...m,
          features: features.filter((f) => f.module_id === m.id),
        })),
    }));

    return NextResponse.json({ apps: tree });
  } catch (err) {
    console.error("Apps GET error:", err);
    return NextResponse.json({ error: "Failed to load apps" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { kind } = body;

    if (kind === "app") {
      const { app_key, display_name, description, rinoa_path, code_path, git_repo, deployed_url, project_key } = body;
      if (!app_key || !display_name || !rinoa_path) {
        return NextResponse.json({ error: "app_key, display_name, rinoa_path required" }, { status: 400 });
      }
      const { data, error } = await supabase
        .from("angelo_apps")
        .insert({ app_key, display_name, description, rinoa_path, code_path, git_repo, deployed_url, project_key })
        .select()
        .single();
      if (error) throw error;
      return NextResponse.json({ app: data });
    }

    if (kind === "module") {
      const { module_key, app_id, display_name, description, rinoa_path } = body;
      if (!module_key || !app_id || !display_name) {
        return NextResponse.json({ error: "module_key, app_id, display_name required" }, { status: 400 });
      }
      const { data, error } = await supabase
        .from("angelo_modules")
        .insert({ module_key, app_id, display_name, description, rinoa_path })
        .select()
        .single();
      if (error) throw error;
      return NextResponse.json({ module: data });
    }

    if (kind === "feature") {
      const { feature_key, module_id, display_name, description, status, entry_point, rinoa_path } = body;
      if (!feature_key || !module_id || !display_name) {
        return NextResponse.json({ error: "feature_key, module_id, display_name required" }, { status: 400 });
      }
      const { data, error } = await supabase
        .from("angelo_features")
        .insert({ feature_key, module_id, display_name, description, status, entry_point, rinoa_path })
        .select()
        .single();
      if (error) throw error;
      return NextResponse.json({ feature: data });
    }

    return NextResponse.json({ error: "unknown kind" }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Insert failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { kind, id, ...fields } = body;
    if (!kind || !id) return NextResponse.json({ error: "kind + id required" }, { status: 400 });

    const table = kind === "app" ? "angelo_apps" : kind === "module" ? "angelo_modules" : kind === "feature" ? "angelo_features" : null;
    if (!table) return NextResponse.json({ error: "invalid kind" }, { status: 400 });

    const { data, error } = await supabase.from(table).update(fields).eq("id", id).select().single();
    if (error) throw error;
    return NextResponse.json({ [kind]: data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Update failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const { kind, id } = body;
    const table = kind === "app" ? "angelo_apps" : kind === "module" ? "angelo_modules" : kind === "feature" ? "angelo_features" : null;
    if (!table || !id) return NextResponse.json({ error: "kind + id required" }, { status: 400 });

    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Delete failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
