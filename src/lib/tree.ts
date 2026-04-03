export interface ProjectNode {
  child_key: string;
  display_name: string;
  parent_key: string | null;
  is_leaf: boolean;
  status?: string;
  build_phase?: string;
  brief?: string | null;
  next_action?: string | null;
  last_session_date?: string | null;
  surface?: string | null;
  task_counts: { this_week: number; this_month: number; parked: number };
  children_task_total: number;
  child_count: number;
  descendant_task_total: number;
  children?: ProjectNode[];
}

export interface TreeNode extends ProjectNode {
  children: TreeNode[];
}

/**
 * Build a tree structure from a flat array of projects with parent_key/child_key relationships.
 */
export function buildTree(projects: ProjectNode[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];

  // Initialize all nodes
  for (const p of projects) {
    map.set(p.child_key, { ...p, children: [] });
  }

  // Wire parent-child relationships
  for (const p of projects) {
    const node = map.get(p.child_key)!;
    if (p.parent_key && map.has(p.parent_key)) {
      map.get(p.parent_key)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

/**
 * Get the ancestor path from root to a given node (for breadcrumb).
 */
export function getAncestors(tree: TreeNode[], childKey: string): ProjectNode[] {
  const path: ProjectNode[] = [];

  function walk(nodes: TreeNode[], trail: ProjectNode[]): boolean {
    for (const node of nodes) {
      const currentTrail = [...trail, node];
      if (node.child_key === childKey) {
        path.push(...currentTrail);
        return true;
      }
      if (walk(node.children, currentTrail)) return true;
    }
    return false;
  }

  walk(tree, []);
  return path;
}

/**
 * Get direct children of a parent key from a flat project list.
 */
export function getChildren(projects: ProjectNode[], parentKey: string | null): ProjectNode[] {
  if (parentKey === null || parentKey === 'root') {
    return projects.filter((p) => !p.parent_key || !projects.some((other) => other.child_key === p.parent_key));
  }
  return projects.filter((p) => p.parent_key === parentKey);
}

/**
 * Recursively compute descendant task count sum for a node.
 */
export function computeRollup(
  tree: TreeNode[],
  node: TreeNode,
  taskCounts: Map<string, { this_week: number; this_month: number; parked: number }>
): number {
  const own = taskCounts.get(node.child_key);
  let total = own ? own.this_week + own.this_month + own.parked : 0;

  for (const child of node.children) {
    total += computeRollup(tree, child, taskCounts);
  }

  return total;
}
