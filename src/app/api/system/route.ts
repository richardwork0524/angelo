import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  try {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [
      hookRecentRes,
      hookTotalRes,
      deployCountRes,
      deployRecentRes,
      skillsRes,
      sessionsLastRes,
    ] = await Promise.all([
      supabase
        .from('angelo_hook_logs')
        .select('hook_name, action, project_key, detail, created_at')
        .gte('created_at', since24h)
        .order('created_at', { ascending: false })
        .limit(80),
      supabase
        .from('angelo_hook_logs')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', since7d),
      supabase
        .from('angelo_deployments')
        .select('id', { count: 'exact', head: true }),
      supabase
        .from('angelo_deployments')
        .select('project_key, module_code, module_slug, vercel_project, custom_domain, last_deploy')
        .order('last_deploy', { ascending: false })
        .limit(8),
      supabase
        .from('angelo_skill_inventory')
        .select('skill_name, vault_version, chat_version, cowork_version, code_version, skill_type, updated_at'),
      supabase
        .from('angelo_session_logs')
        .select('created_at')
        .order('created_at', { ascending: false })
        .limit(1),
    ]);

    const hookRecent = hookRecentRes.data || [];
    const distinctHooks = Array.from(new Set(hookRecent.map((h) => h.hook_name))).length;

    const skills = skillsRes.data || [];
    const hasDrift = (s: typeof skills[number]) => {
      const v = s.vault_version;
      if (!v) return false;
      return (
        (s.chat_version && s.chat_version !== v) ||
        (s.cowork_version && s.cowork_version !== v) ||
        (s.code_version && s.code_version !== v)
      );
    };
    const driftCount = skills.filter(hasDrift).length;
    const undeployedCount = skills.filter((s) => !s.chat_version && !s.cowork_version && !s.code_version).length;
    const lastSkillUpdate = skills.map((s) => s.updated_at).sort().pop() || null;

    const deployments = deployRecentRes.data || [];
    const lastDeployDate = deployments[0]?.last_deploy || null;

    const lastSessionAt = sessionsLastRes.data?.[0]?.created_at || null;

    return NextResponse.json({
      hook: {
        distinct_24h: distinctHooks,
        total_7d: hookTotalRes.count || 0,
        recent: hookRecent.slice(0, 20),
      },
      deploy: {
        total: deployCountRes.count || 0,
        last_deploy_date: lastDeployDate,
        recent: deployments,
      },
      skill: {
        total: skills.length,
        drift: driftCount,
        undeployed: undeployedCount,
        last_updated: lastSkillUpdate,
      },
      session: {
        last_at: lastSessionAt,
      },
    });
  } catch (err) {
    console.error('System API error:', err);
    return NextResponse.json({ error: 'Failed to load system data' }, { status: 500 });
  }
}
