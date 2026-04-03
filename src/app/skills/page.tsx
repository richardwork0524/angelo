"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { StickyHeader } from "@/components/sticky-header";
import type { SkillInventory } from "@/lib/types";

export default function SkillsPage() {
  const [skills, setSkills] = useState<SkillInventory[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "drift" | "undeployed">("all");

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("angelo_skill_inventory")
        .select("*")
        .order("skill_name");
      if (data) setSkills(data);
      setLoading(false);
    })();
  }, []);

  const hasDrift = (s: SkillInventory) => {
    const v = s.vault_version;
    if (!v) return false;
    return (
      (s.chat_version && s.chat_version !== v) ||
      (s.cowork_version && s.cowork_version !== v) ||
      (s.code_version && s.code_version !== v)
    );
  };

  const isUndeployed = (s: SkillInventory) => {
    return !s.chat_version && !s.cowork_version && !s.code_version;
  };

  const filtered = skills.filter((s) => {
    if (filter === "drift") return hasDrift(s);
    if (filter === "undeployed") return isUndeployed(s);
    return true;
  });

  const driftCount = skills.filter(hasDrift).length;
  const undeployedCount = skills.filter(isUndeployed).length;

  return (
    <div className="flex flex-col min-h-screen bg-[var(--bg)]">
      <StickyHeader title="Skills" showBack />
      <main style={{ maxWidth: 960, margin: "0 auto", padding: "24px 16px", width: "100%" }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Skills</h1>
        <p style={{ fontSize: 13, color: "var(--text2)", marginBottom: 16 }}>
          {skills.length} skills &middot; {driftCount} with drift &middot; {undeployedCount} undeployed
        </p>

        {/* Filters */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {([
            ["all", `All (${skills.length})`],
            ["drift", `Drift (${driftCount})`],
            ["undeployed", `Undeployed (${undeployedCount})`],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              style={{
                padding: "4px 12px", borderRadius: "var(--r-sm)", border: "none",
                fontSize: 12, fontWeight: 500, cursor: "pointer",
                background: filter === key ? "var(--accent-dim)" : "var(--card)",
                color: filter === key ? "var(--accent)" : "var(--text2)",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ color: "var(--text3)", padding: 40, textAlign: "center" }}>Loading...</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  {["Skill", "Vault", "Chat", "Cowork", "Code", "Notes"].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: "left", padding: "8px 12px", fontWeight: 600,
                        color: "var(--text2)", fontSize: 12, textTransform: "uppercase",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "10px 12px", fontWeight: 600 }}>{s.skill_name}</td>
                    <td style={{ padding: "10px 12px" }}>
                      <VersionCell version={s.vault_version} isVault />
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <VersionCell version={s.chat_version} vault={s.vault_version} />
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <VersionCell version={s.cowork_version} vault={s.vault_version} />
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <VersionCell version={s.code_version} vault={s.vault_version} />
                    </td>
                    <td style={{ padding: "10px 12px", color: "var(--text3)", fontSize: 12 }}>
                      {s.notes}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}

function VersionCell({
  version,
  vault,
  isVault,
}: {
  version: string | null;
  vault?: string | null;
  isVault?: boolean;
}) {
  if (!version) {
    return <span style={{ color: "var(--text3)", fontSize: 12 }}>&mdash;</span>;
  }

  const isDrift = !isVault && vault && version !== vault;

  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 6px",
        borderRadius: 4,
        fontSize: 11,
        fontWeight: 600,
        background: isDrift ? "var(--orange-dim)" : isVault ? "var(--green-dim)" : "var(--card2)",
        color: isDrift ? "var(--orange)" : isVault ? "var(--green)" : "var(--text2)",
      }}
    >
      {version}
    </span>
  );
}
