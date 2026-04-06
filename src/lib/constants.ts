/* ── Shared constants — single source of truth for Angelo UI ── */

export const PRIORITY_COLORS: Record<string, string> = {
  P0: "var(--red)",
  P1: "var(--orange)",
  P2: "var(--yellow)",
};

export const SURFACE_COLORS: Record<string, string> = {
  CODE: "var(--accent)",
  CHAT: "var(--green)",
  COWORK: "var(--purple)",
  MOBILE: "var(--orange)",
};

export const SURFACE_DIM_COLORS: Record<string, string> = {
  CODE: "var(--accent-dim)",
  CHAT: "var(--green-dim)",
  COWORK: "var(--purple-dim)",
  MOBILE: "var(--orange-dim)",
};

export const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  ACTIVE:   { bg: "var(--green-dim)",   text: "var(--green)" },
  DEPLOYED: { bg: "var(--green-dim)",   text: "var(--green)" },
  BUILDING: { bg: "var(--accent-dim)",  text: "var(--accent)" },
  PLANNING: { bg: "var(--purple-dim)",  text: "var(--purple)" },
  TESTING:  { bg: "var(--yellow-dim)",  text: "var(--yellow)" },
  BLOCKED:  { bg: "var(--red-dim)",     text: "var(--red)" },
  ARCHIVED: { bg: "var(--card2)",       text: "var(--text3)" },
};

export const SURFACE_LABELS: Record<string, string> = {
  CODE: "Claude Code",
  CHAT: "Claude Chat",
  COWORK: "Claude Cowork",
};

export const PRIORITIES = ["P0", "P1", "P2"] as const;

export const BUCKETS = [
  { key: "THIS_WEEK", label: "Week" },
  { key: "THIS_MONTH", label: "Month" },
  { key: "PARKED", label: "Parked" },
] as const;

export function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}
