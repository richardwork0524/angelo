export interface ProjectEntry {
  parent: string;
  child_key: string;
  rinoa_path: string;
  display_name: string;
  belongs_to: string;
}

export interface ProjectWithCounts extends ProjectEntry {
  is_leaf: boolean;
  task_counts: { this_week: number; this_month: number; parked: number };
  next_action: string | null;
  last_session_date: string | null;
  is_stale: boolean;
  children_task_total: number;
}

export interface TaskItem {
  text: string;
  completed: boolean;
  index: number;
}

export interface ParsedTasks {
  this_week: TaskItem[];
  this_month: TaskItem[];
  parked: TaskItem[];
  completed: TaskItem[];
}

export function parseHierarchy(csv: string): ProjectEntry[] {
  const lines = csv.trim().split("\n");
  if (lines.length < 2) return [];
  return lines.slice(1).filter(Boolean).map((line) => {
    const [parent, child, rinoa_path, display_name, belongs_to] = line.split(",").map((s) => s.trim());
    return { parent, child_key: child, rinoa_path, display_name, belongs_to: belongs_to || "" };
  });
}

export function parseSummary(md: string): {
  brief: string | null;
  last_session_date: string | null;
  next_action: string | null;
  task_counts: { this_week: number; this_month: number; parked: number };
} {
  const brief = extractSection(md, "Brief") || extractSection(md, "## Brief");
  const nextAction = extractField(md, "Next action") || extractField(md, "## Next action");
  const lastSessionDate = extractLastSessionDate(md);

  // Count tasks from "Active tasks" section
  const taskCounts = { this_week: 0, this_month: 0, parked: 0 };

  return { brief, last_session_date: lastSessionDate, next_action: nextAction, task_counts: taskCounts };
}

export function parseTasks(md: string): ParsedTasks {
  const result: ParsedTasks = { this_week: [], this_month: [], parked: [], completed: [] };
  let currentBucket: keyof ParsedTasks | null = null;
  let globalIndex = 0;

  for (const line of md.split("\n")) {
    const trimmed = line.trim();

    if (/^##\s*THIS WEEK/i.test(trimmed)) {
      currentBucket = "this_week";
      continue;
    }
    if (/^##\s*THIS MONTH/i.test(trimmed)) {
      currentBucket = "this_month";
      continue;
    }
    if (/^##\s*PARKED/i.test(trimmed)) {
      currentBucket = "parked";
      continue;
    }
    if (/^##\s*COMPLETED/i.test(trimmed) || /^##\s*DONE/i.test(trimmed)) {
      currentBucket = "completed";
      continue;
    }
    // Skip non-bucket headers
    if (/^#/.test(trimmed)) {
      if (currentBucket) continue; // sub-headers within a bucket
      continue;
    }

    if (!currentBucket) continue;

    const taskMatch = trimmed.match(/^-\s*\[([ xX])\]\s*(.+)/);
    if (taskMatch) {
      const completed = taskMatch[1].toLowerCase() === "x";
      const text = taskMatch[2].trim();
      const item: TaskItem = { text, completed, index: globalIndex++ };

      if (completed && currentBucket !== "completed") {
        result.completed.push({ ...item, index: item.index });
      } else {
        result[currentBucket].push(item);
      }
    }
  }

  return result;
}

export function serializeTasks(tasks: ParsedTasks, originalHeader?: string): string {
  const lines: string[] = [];
  const header = originalHeader || "# Tasks";
  lines.push(header);
  lines.push("");

  lines.push("## THIS WEEK");
  for (const t of tasks.this_week) {
    lines.push(`- [${t.completed ? "x" : " "}] ${t.text}`);
  }
  lines.push("");

  lines.push("## THIS MONTH");
  for (const t of tasks.this_month) {
    lines.push(`- [${t.completed ? "x" : " "}] ${t.text}`);
  }
  lines.push("");

  lines.push("## PARKED");
  for (const t of tasks.parked) {
    lines.push(`- [${t.completed ? "x" : " "}] ${t.text}`);
  }
  lines.push("");

  if (tasks.completed.length > 0) {
    lines.push("## COMPLETED");
    for (const t of tasks.completed) {
      lines.push(`- [x] ${t.text}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

function extractSection(md: string, heading: string): string | null {
  const headingClean = heading.replace(/^#+\s*/, "");
  const regex = new RegExp(`^##?\\s*${escapeRegex(headingClean)}\\s*$`, "im");
  const match = md.match(regex);
  if (!match) return null;

  const startIdx = match.index! + match[0].length;
  const rest = md.slice(startIdx);
  const nextHeading = rest.match(/^##?\s/m);
  const section = nextHeading ? rest.slice(0, nextHeading.index) : rest;
  const trimmed = section.trim();
  return trimmed || null;
}

function extractField(md: string, label: string): string | null {
  const labelClean = label.replace(/^#+\s*/, "");
  const regex = new RegExp(`^##?\\s*${escapeRegex(labelClean)}\\s*$`, "im");
  const match = md.match(regex);
  if (!match) return null;

  const startIdx = match.index! + match[0].length;
  const rest = md.slice(startIdx);
  const nextHeading = rest.match(/^##?\s/m);
  const section = nextHeading ? rest.slice(0, nextHeading.index) : rest;
  const firstLine = section.trim().split("\n")[0]?.trim();
  return firstLine || null;
}

function extractLastSessionDate(md: string): string | null {
  // Look for pattern like [Mar 29 | Chat] or similar date patterns in session lines
  const sessionMatch = md.match(/\[([A-Z][a-z]{2}\s+\d{1,2})\s*\|/);
  if (sessionMatch) {
    const dateStr = sessionMatch[1];
    const year = new Date().getFullYear();
    const parsed = new Date(`${dateStr} ${year}`);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split("T")[0];
    }
  }
  return null;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function countTasks(tasks: ParsedTasks): { this_week: number; this_month: number; parked: number } {
  return {
    this_week: tasks.this_week.filter((t) => !t.completed).length,
    this_month: tasks.this_month.filter((t) => !t.completed).length,
    parked: tasks.parked.filter((t) => !t.completed).length,
  };
}
