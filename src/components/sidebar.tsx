'use client';

import { useEffect, useState, useCallback } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { buildTree, type TreeNode } from '@/lib/tree';
import type { ProjectNode } from '@/lib/tree';
import { cachedFetch } from '@/lib/cache';

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [projects, setProjects] = useState<ProjectNode[]>([]);
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const fetchProjects = useCallback(async () => {
    try {
      const data = await cachedFetch<{ projects: ProjectNode[] }>('/api/projects', 30000);
      setProjects(data.projects);
      setTree(buildTree(data.projects));
    } catch {
      // Silent fail for sidebar
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // Auto-expand ancestors of active item
  useEffect(() => {
    if (projects.length === 0) return;

    let activeKey: string | null = null;
    if (pathname?.startsWith('/project/')) {
      activeKey = pathname.split('/project/')[1];
    } else if (pathname === '/dashboard') {
      activeKey = searchParams.get('parent');
    }

    if (activeKey && activeKey !== 'root') {
      // Find all ancestors and expand them
      const newExpanded = new Set(expanded);
      let current = activeKey;
      const projectMap = new Map(projects.map((p) => [p.child_key, p]));
      while (current) {
        const proj = projectMap.get(current);
        if (proj?.parent_key) {
          newExpanded.add(proj.parent_key);
          current = proj.parent_key;
        } else {
          break;
        }
      }
      setExpanded(newExpanded);
    }
    // Only run when projects load or route changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects, pathname, searchParams]);

  function toggleExpand(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function isActive(node: TreeNode): boolean {
    if (node.is_leaf && pathname === `/project/${node.child_key}`) return true;
    if (!node.is_leaf && pathname === '/dashboard' && searchParams.get('parent') === node.child_key) return true;
    return false;
  }

  function getTaskTotal(node: TreeNode): number {
    const tc = node.task_counts;
    const own = tc.this_week + tc.this_month + tc.parked;
    if (node.is_leaf) return own;
    return node.descendant_task_total || own;
  }

  function handleNodeClick(node: TreeNode) {
    if (node.is_leaf) {
      router.push(`/project/${node.child_key}`);
    } else {
      router.push(`/dashboard?parent=${node.child_key}`);
    }
  }

  function renderNode(node: TreeNode, depth: number = 0) {
    const hasChildren = node.children.length > 0;
    const isExp = expanded.has(node.child_key);
    const active = isActive(node);
    const taskCount = getTaskTotal(node);
    const isRoot = depth === 0;

    return (
      <div key={node.child_key} className={isRoot ? 'mt-3 first:mt-0' : ''}>
        <div
          className={`flex items-center gap-1.5 pr-3 rounded-[var(--r-sm)] cursor-pointer transition-colors group ${
            isRoot
              ? `py-2 min-h-[40px] ${active ? 'bg-[var(--accent-dim)] border-l-2 border-[var(--accent)]' : 'hover:bg-[var(--card)] border-l-2 border-transparent'}`
              : `py-1.5 min-h-[36px] ${active ? 'bg-[var(--accent-dim)] border-l-2 border-[var(--accent)]' : 'hover:bg-[var(--card)] border-l-2 border-transparent'}`
          }`}
          style={{ paddingLeft: `${12 + depth * 16}px` }}
        >
          {/* Expand chevron */}
          {hasChildren ? (
            <button
              onClick={(e) => { e.stopPropagation(); toggleExpand(node.child_key); }}
              className="w-[20px] h-[20px] flex items-center justify-center shrink-0 text-[var(--text3)] hover:text-[var(--text)]"
            >
              <svg
                width="10"
                height="10"
                viewBox="0 0 10 10"
                fill="none"
                className={`transition-transform ${isExp ? 'rotate-90' : ''}`}
              >
                <path d="M3 1L7 5L3 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          ) : (
            <span className="w-[20px] shrink-0" />
          )}

          {/* Name + badge */}
          <button
            onClick={() => handleNodeClick(node)}
            className={`flex-1 text-left truncate min-h-[28px] flex items-center ${
              isRoot
                ? `text-[11px] font-bold uppercase tracking-[0.06em] ${active ? 'text-[var(--accent)]' : 'text-[var(--text3)] group-hover:text-[var(--text2)]'}`
                : `text-[13px] font-medium ${active ? 'text-[var(--accent)]' : 'text-[var(--text2)] group-hover:text-[var(--text)]'}`
            }`}
          >
            {node.display_name}
          </button>

          {taskCount > 0 && (
            <span className={`text-[11px] tabular-nums shrink-0 ${
              active ? 'text-[var(--accent)]' : 'text-[var(--text3)]'
            }`}>
              {taskCount}
            </span>
          )}
        </div>

        {/* Children */}
        {hasChildren && isExp && (
          <div>
            {node.children.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  }

  return (
    <aside className="w-[280px] shrink-0 h-screen sticky top-0 bg-[var(--surface)] border-r border-[var(--border)] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-5 py-5">
        <p className="text-[13px] font-semibold text-[var(--text2)] tracking-wide uppercase">Rinoa-OS</p>
      </div>

      {/* Navigation links */}
      <div className="px-3 mb-2">
        <button
          onClick={() => router.push('/dashboard')}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-[var(--r-sm)] text-[14px] font-medium transition-colors min-h-[44px] ${
            pathname === '/dashboard' && !searchParams.get('parent')
              ? 'bg-[var(--accent-dim)] text-[var(--accent)]'
              : 'text-[var(--text2)] hover:bg-[var(--card)] hover:text-[var(--text)]'
          }`}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" rx="1.5" />
            <rect x="14" y="3" width="7" height="7" rx="1.5" />
            <rect x="3" y="14" width="7" height="7" rx="1.5" />
            <rect x="14" y="14" width="7" height="7" rx="1.5" />
          </svg>
          All Projects
        </button>
        <button
          onClick={() => router.push('/skills')}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-[var(--r-sm)] text-[14px] font-medium transition-colors min-h-[44px] ${
            pathname === '/skills'
              ? 'bg-[var(--accent-dim)] text-[var(--accent)]'
              : 'text-[var(--text2)] hover:bg-[var(--card)] hover:text-[var(--text)]'
          }`}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
          </svg>
          Skills
        </button>
        <button
          onClick={() => router.push('/deployments')}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-[var(--r-sm)] text-[14px] font-medium transition-colors min-h-[44px] ${
            pathname === '/deployments'
              ? 'bg-[var(--accent-dim)] text-[var(--accent)]'
              : 'text-[var(--text2)] hover:bg-[var(--card)] hover:text-[var(--text)]'
          }`}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
          Deployments
        </button>
      </div>

      {/* Project tree */}
      <div className="flex-1 overflow-y-auto px-3 pb-3">
        {tree.length > 0 ? (
          <div className="space-y-0.5">
            {tree.map((node) => renderNode(node))}
          </div>
        ) : (
          <p className="text-[12px] text-[var(--text3)] px-3 py-2">Loading...</p>
        )}
      </div>

      {/* Bottom quick add */}
      <div className="px-5 py-4 border-t border-[var(--border)]">
        <button
          onClick={() => window.dispatchEvent(new Event('quick-capture'))}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-[var(--r-sm)] bg-[var(--accent)] text-white text-[13px] font-semibold min-h-[44px] hover:opacity-90 transition-opacity"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Quick Add
        </button>
      </div>
    </aside>
  );
}
