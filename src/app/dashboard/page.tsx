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

function DashboardSkeleton() {
  return (
    <div className="flex flex-col min-h-screen bg-[var(--bg)]">
      <StickyHeader title="Angelo" />
      <div className="px-4 py-3 space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-[var(--r)] bg-[var(--card)] p-4 space-y-3 animate-pulse">
            <div className="flex items-center justify-between">
              <div className="h-4 w-32 bg-[var(--border)] rounded" />
              <div className="h-4 w-12 bg-[var(--border)] rounded" />
            </div>
            <div className="h-3 w-48 bg-[var(--border)] rounded" />
            <div className="flex gap-3">
              <div className="h-3 w-16 bg-[var(--border)] rounded" />
              <div className="h-3 w-16 bg-[var(--border)] rounded" />
              <div className="h-3 w-16 bg-[var(--border)] rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

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

  const [projects, setProjects] = useState<ProjectNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [captureOpen, setCaptureOpen] = useState(false);

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

  // Build tree for breadcrumb navigation
  const tree = useMemo(() => buildTree(projects), [projects]);

  // Get children of current parent
  const visibleProjects = useMemo(() => {
    return getChildren(projects, parentKey);
  }, [projects, parentKey]);

  // Build breadcrumb segments
  const breadcrumbs = useMemo((): BreadcrumbSegment[] => {
    const segments: BreadcrumbSegment[] = [{ label: "Root", href: "/dashboard?parent=root" }];
    if (parentKey !== "root") {
      const ancestors = getAncestors(tree, parentKey);
      for (const ancestor of ancestors) {
        segments.push({
          label: ancestor.display_name,
          href: `/dashboard?parent=${ancestor.child_key}`,
        });
      }
    }
    return segments;
  }, [tree, parentKey]);

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
      <StickyHeader title="Angelo" />

      {leafProjects.length > 0 && (
        <TaskAddBar
          projects={leafProjects.map((p) => ({ child_key: p.child_key, display_name: p.display_name }))}
          onSubmit={handleAddTask}
        />
      )}

      {parentKey !== "root" && <Breadcrumb segments={breadcrumbs} />}

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
                <div className="flex gap-3">
                  <div className="h-3 w-16 bg-[var(--border)] rounded" />
                  <div className="h-3 w-16 bg-[var(--border)] rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : visibleProjects.length === 0 && !error ? (
          <EmptyState message="No projects found. Run the seed script to import from Rinoa-OS." />
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
          setToast('Task added');
        }}
      />
    </div>
  );
}
