"use client";

import { Suspense, useEffect, useState, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { StickyHeader } from "@/components/sticky-header";
import { TaskAddBar } from "@/components/task-add-bar";
import { PullToRefresh } from "@/components/pull-to-refresh";
import { ErrorBanner } from "@/components/error-banner";
import { EmptyState } from "@/components/empty-state";
import { Toast } from "@/components/toast";
import { Breadcrumb, BreadcrumbSegment } from "@/components/breadcrumb";
import { ProjectCard, ProjectCardData } from "@/components/project-card";
import { Fab } from "@/components/fab";
import { QuickCaptureSheet } from "@/components/quick-capture-sheet";
import { buildTree, getAncestors, getChildren } from "@/lib/tree";
import type { ProjectNode } from "@/lib/tree";

/* ── Types ── */

interface OverviewData {
  stats: { open: number; completed: number; buckets: { this_week: number; this_month: number; parked: number } };
  recent_tasks: { id: string; text: string; project_key: string; bucket: string; priority: string | null; surface: string | null }[];
  recent_sessions: { id: string; project_key: string; session_date: string; title: string; surface: string | null }[];
}

/* ── Skeleton ── */

function DashboardSkeleton() {
  return (
    <div className="flex flex-col min-h-screen bg-[var(--bg)]">
      <div className="px-4 py-3 space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-[var(--r)] bg-[var(--card)] p-4 space-y-3 animate-pulse">
            <div className="flex items-center justify-between">
              <div className="h-4 w-32 bg-[var(--border)] rounded" />
              <div className="h-4 w-12 bg-[var(--border)] rounded" />
            </div>
            <div className="h-3 w-48 bg-[var(--border)] rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Root Tabs ── */

const ROOT_TABS = [
  { key: "company", label: "Company", color: "var(--accent)" },
  { key: "development", label: "Development", color: "var(--purple)" },
  { key: "general", label: "General", color: "var(--green)" },
  { key: "group-strategy", label: "Strategy", color: "var(--orange)" },
];

const PRIORITY_COLORS: Record<string, string> = { P0: "var(--red)", P1: "var(--orange)", P2: "var(--yellow)" };
const SURFACE_COLORS: Record<string, string> = { CODE: "var(--accent)", CHAT: "var(--green)", COWORK: "var(--purple)" };

function HeroSection({ activeTab, onTabChange, projects, onCardClick }: {
  activeTab: string;
  onTabChange: (key: string) => void;
  projects: ProjectNode[];
  onCardClick: (p: ProjectNode) => void;
}) {
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/overview?parent=${activeTab}`)
      .then((r) => r.json())
      .then((d) => setOverview(d))
      .catch(() => setOverview(null))
      .finally(() => setLoading(false));
  }, [activeTab]);

  const children = useMemo(() => getChildren(projects, activeTab), [projects, activeTab]);

  return (
    <div className="px-4 pt-3">
      {/* Tab bar */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {ROOT_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
            className={`px-3 py-1.5 rounded-full text-[13px] font-semibold whitespace-nowrap transition-colors ${
              activeTab === tab.key
                ? "text-white"
                : "text-[var(--text3)] bg-[var(--card)] hover:text-[var(--text2)]"
            }`}
            style={activeTab === tab.key ? { background: tab.color } : undefined}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Stats row */}
      {!loading && overview && (
        <div className="flex gap-3 mb-4">
          <div className="flex-1 rounded-[var(--r-sm)] bg-[var(--card)] p-3 text-center">
            <div className="text-[20px] font-bold text-[var(--text)]">{overview.stats.open}</div>
            <div className="text-[11px] text-[var(--text3)] uppercase">Open</div>
          </div>
          <div className="flex-1 rounded-[var(--r-sm)] bg-[var(--card)] p-3 text-center">
            <div className="text-[20px] font-bold text-[var(--accent)]">{overview.stats.buckets.this_week}</div>
            <div className="text-[11px] text-[var(--text3)] uppercase">This Week</div>
          </div>
          <div className="flex-1 rounded-[var(--r-sm)] bg-[var(--card)] p-3 text-center">
            <div className="text-[20px] font-bold text-[var(--green)]">{overview.stats.completed}</div>
            <div className="text-[11px] text-[var(--text3)] uppercase">Done</div>
          </div>
        </div>
      )}

      {/* Recent tasks */}
      {!loading && overview && overview.recent_tasks.length > 0 && (
        <div className="mb-4">
          <h3 className="text-[12px] font-semibold text-[var(--text3)] uppercase tracking-wide mb-2">Recent Tasks</h3>
          <div className="rounded-[var(--r)] bg-[var(--card)] divide-y divide-[var(--border)]">
            {overview.recent_tasks.map((t) => (
              <div key={t.id} className="flex items-start gap-2 px-3 py-2.5">
                {t.priority && (
                  <span className="w-[7px] h-[7px] rounded-full shrink-0 mt-1.5" style={{ backgroundColor: PRIORITY_COLORS[t.priority] || "var(--text3)" }} />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-[var(--text)] truncate">{t.text}</p>
                  <span className="text-[11px] text-[var(--text3)]">{t.project_key}</span>
                </div>
                {t.surface && (
                  <span className="text-[10px] font-semibold uppercase shrink-0" style={{ color: SURFACE_COLORS[t.surface] || "var(--text3)" }}>
                    {t.surface}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent sessions */}
      {!loading && overview && overview.recent_sessions.length > 0 && (
        <div className="mb-4">
          <h3 className="text-[12px] font-semibold text-[var(--text3)] uppercase tracking-wide mb-2">Recent Sessions</h3>
          <div className="rounded-[var(--r)] bg-[var(--card)] divide-y divide-[var(--border)]">
            {overview.recent_sessions.map((s) => (
              <div key={s.id} className="flex items-center gap-2 px-3 py-2.5">
                {s.surface && (
                  <span className="w-[6px] h-[6px] rounded-full shrink-0" style={{ backgroundColor: SURFACE_COLORS[s.surface] || "var(--text3)" }} />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-[var(--text)] truncate">{s.title}</p>
                  <span className="text-[11px] text-[var(--text3)]">{s.project_key} &middot; {s.session_date}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading && (
        <div className="space-y-3 mb-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="rounded-[var(--r)] bg-[var(--card)] p-4 animate-pulse">
              <div className="h-3 w-48 bg-[var(--border)] rounded" />
            </div>
          ))}
        </div>
      )}

      {/* Child projects */}
      {children.length > 0 && (
        <div>
          <h3 className="text-[12px] font-semibold text-[var(--text3)] uppercase tracking-wide mb-2">Projects</h3>
          <div className="space-y-2 pb-3">
            {children.map((project) => (
              <ProjectCard
                key={project.child_key}
                project={project as ProjectCardData}
                variant="simple"
                onClick={() => onCardClick(project)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Main ── */

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent />
    </Suspense>
  );
}

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const parentKey = searchParams.get("parent") || "root";
  const isRoot = parentKey === "root";

  const [projects, setProjects] = useState<ProjectNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("company");

  const fetchProjects = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch("/api/projects");
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setProjects(data.projects);
    } catch {
      setError("Failed to load projects. Pull to retry.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const tree = useMemo(() => buildTree(projects), [projects]);

  const visibleProjects = useMemo(() => {
    return getChildren(projects, parentKey);
  }, [projects, parentKey]);

  // Derive header title from current parent
  const headerTitle = useMemo(() => {
    if (isRoot) return "Dashboard";
    const proj = projects.find((p) => p.child_key === parentKey);
    return proj?.display_name || parentKey;
  }, [isRoot, parentKey, projects]);

  const breadcrumbs = useMemo((): BreadcrumbSegment[] => {
    const segments: BreadcrumbSegment[] = [{ label: "Dashboard", href: "/dashboard?parent=root" }];
    if (!isRoot) {
      const ancestors = getAncestors(tree, parentKey);
      for (const ancestor of ancestors) {
        segments.push({
          label: ancestor.display_name,
          href: `/dashboard?parent=${ancestor.child_key}`,
        });
      }
    }
    return segments;
  }, [tree, parentKey, isRoot]);

  async function handleAddTask(text: string, bucket: string, projectKey?: string) {
    if (!projectKey) throw new Error("No project selected");
    const res = await fetch(`/api/projects/${projectKey}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, bucket }),
    });
    if (!res.ok) throw new Error("Failed");
    await fetchProjects();
  }

  const leafProjects = projects.filter((p) => p.is_leaf);

  function handleCardClick(project: ProjectNode) {
    if (project.is_leaf) {
      router.push(`/project/${project.child_key}`);
    } else {
      router.push(`/dashboard?parent=${project.child_key}`);
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-[var(--bg)]">
      <StickyHeader title={headerTitle} showBack={!isRoot} />

      {!isRoot && leafProjects.length > 0 && (
        <TaskAddBar
          projects={leafProjects.map((p) => ({ child_key: p.child_key, display_name: p.display_name }))}
          onSubmit={handleAddTask}
        />
      )}

      {!isRoot && <Breadcrumb segments={breadcrumbs} />}

      {error && <ErrorBanner message={error} onRetry={fetchProjects} />}

      <PullToRefresh onRefresh={fetchProjects}>
        {loading ? (
          <div className="px-4 py-3 space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="rounded-[var(--r)] bg-[var(--card)] p-4 space-y-3 animate-pulse">
                <div className="flex items-center justify-between">
                  <div className="h-4 w-32 bg-[var(--border)] rounded" />
                  <div className="h-4 w-12 bg-[var(--border)] rounded" />
                </div>
                <div className="h-3 w-48 bg-[var(--border)] rounded" />
              </div>
            ))}
          </div>
        ) : isRoot ? (
          <HeroSection
            activeTab={activeTab}
            onTabChange={setActiveTab}
            projects={projects}
            onCardClick={handleCardClick}
          />
        ) : visibleProjects.length === 0 && !error ? (
          <EmptyState message="No projects here yet." />
        ) : (
          <div className="px-4 py-3 space-y-2">
            {visibleProjects.map((project) => (
              <ProjectCard
                key={project.child_key}
                project={project as ProjectCardData}
                variant="simple"
                onClick={() => handleCardClick(project)}
              />
            ))}
          </div>
        )}
      </PullToRefresh>

      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}

      <Fab onPress={() => setCaptureOpen(true)} />

      <QuickCaptureSheet
        open={captureOpen}
        onClose={() => setCaptureOpen(false)}
        projects={leafProjects.map((p) => ({ child_key: p.child_key, display_name: p.display_name }))}
        onSubmitted={() => {
          fetchProjects();
          setToast("Task added");
        }}
      />
    </div>
  );
}
