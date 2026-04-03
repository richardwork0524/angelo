"use client";

import { useState } from "react";

interface TaskAddBarProps {
  projects?: { child_key: string; display_name: string }[];
  selectedProject?: string;
  onSubmit: (text: string, bucket: string, projectKey?: string) => Promise<void>;
  position?: "top" | "bottom";
}

const BUCKETS = [
  { value: "THIS_WEEK", label: "Week" },
  { value: "THIS_MONTH", label: "Month" },
  { value: "PARKED", label: "Parked" },
];

export function TaskAddBar({ projects, selectedProject, onSubmit, position = "top" }: TaskAddBarProps) {
  const [text, setText] = useState("");
  const [bucket, setBucket] = useState("THIS_WEEK");
  const [projectKey, setProjectKey] = useState(selectedProject || projects?.[0]?.child_key || "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) {
      setError("Task text required");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit(text.trim(), bucket, projects ? projectKey : undefined);
      setText("");
    } catch {
      setError("Failed to add task. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const positionClass = position === "bottom"
    ? "fixed bottom-0 left-0 right-0 z-10 border-t"
    : "sticky top-14 z-10 border-b";

  return (
    <div className={`${positionClass} bg-[var(--surface)] border-[var(--border)] px-4 py-3`}>
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        {projects && projects.length > 0 && (
          <select
            value={projectKey}
            onChange={(e) => setProjectKey(e.target.value)}
            className="h-9 px-2 rounded-md bg-[var(--card)] border border-[var(--border2)] text-[13px] text-[var(--text2)] focus:outline-none focus:border-[var(--accent)] max-w-[100px] truncate"
          >
            {projects.map((p) => (
              <option key={p.child_key} value={p.child_key}>
                {p.display_name}
              </option>
            ))}
          </select>
        )}
        <select
          value={bucket}
          onChange={(e) => setBucket(e.target.value)}
          className="h-9 px-2 rounded-md bg-[var(--card)] border border-[var(--border2)] text-[13px] text-[var(--text2)] focus:outline-none focus:border-[var(--accent)]"
        >
          {BUCKETS.map((b) => (
            <option key={b.value} value={b.value}>
              {b.label}
            </option>
          ))}
        </select>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add task..."
          className="flex-1 h-9 px-3 rounded-md bg-[var(--card)] border border-[var(--border2)] text-[14px] text-[var(--text)] placeholder:text-[var(--text3)] focus:outline-none focus:border-[var(--accent)]"
        />
        <button
          type="submit"
          disabled={submitting}
          className="h-9 px-4 rounded-md bg-[var(--accent)] text-white text-[13px] font-semibold hover:opacity-90 disabled:opacity-40 transition-colors"
        >
          {submitting ? "..." : "+"}
        </button>
      </form>
      {error && <p className="text-[12px] text-[var(--red)] mt-1">{error}</p>}
    </div>
  );
}
