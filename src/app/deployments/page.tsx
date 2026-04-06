"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { StickyHeader } from "@/components/sticky-header";
import type { Deployment } from "@/lib/types";

export default function DeploymentsPage() {
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("angelo_deployments")
        .select("*")
        .order("last_deploy", { ascending: false });
      if (data) setDeployments(data);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="flex flex-col h-full min-h-0 bg-[var(--bg)]">
      <StickyHeader title="Deployments" showBack />
      <main style={{ maxWidth: 960, margin: "0 auto", padding: "24px 16px", width: "100%" }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Deployments</h1>
        <p style={{ fontSize: 13, color: "var(--text2)", marginBottom: 24 }}>
          {deployments.length} modules deployed
        </p>

        {loading ? (
          <div style={{ color: "var(--text3)", padding: 40, textAlign: "center" }}>Loading...</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  {["Module", "Code", "Git Repo", "Vercel", "Last Deploy"].map((h) => (
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
                {deployments.map((d) => (
                  <tr key={d.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "10px 12px", fontWeight: 600 }}>{d.module_slug}</td>
                    <td style={{ padding: "10px 12px" }}>
                      <span
                        style={{
                          display: "inline-block", padding: "2px 6px",
                          background: "var(--accent-dim)", color: "var(--accent)",
                          borderRadius: 4, fontSize: 11, fontWeight: 600,
                        }}
                      >
                        {d.module_code}
                      </span>
                    </td>
                    <td style={{ padding: "10px 12px", color: "var(--text2)" }}>
                      {d.git_repo}
                    </td>
                    <td style={{ padding: "10px 12px", color: "var(--text2)" }}>
                      {d.vercel_project}
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      {d.last_deploy ? (
                        <span
                          style={{
                            color: isRecent(d.last_deploy) ? "var(--green)" : "var(--text3)",
                          }}
                        >
                          {d.last_deploy}
                        </span>
                      ) : (
                        <span style={{ color: "var(--text3)" }}>Never</span>
                      )}
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

function isRecent(date: string): boolean {
  const d = new Date(date);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  return diff < 7 * 24 * 60 * 60 * 1000; // within 7 days
}
