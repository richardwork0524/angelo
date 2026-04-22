# CLAUDE.md — Angelo repo

## 2-step optimistic CRUD pattern (angelo standard)

All in-app CRUD mutations must:
1. Apply the optimistic state change IMMEDIATELY (update local `data` state).
2. Dispatch relevant `*-changed` events so sidebars/counters update in the same frame.
3. Fire the background mutation (via `bgMutate` or raw `fetch`).
4. Wait ~200ms before the reconciling refetch (`fetchTasks(true)` / `cachedFetch` with `force=true`).

This gives the UI a seamless transition instead of a snap. Applies to create, update, toggle, and delete across tasks, notes, handoffs, and any new CRUD surface. Reference: ANG-014 (2026-04-22).

### selectedTask derivation guard

When `selectedTask` resolves to null (because the task was removed from `data.tasks` by an optimistic-remove or post-mutation refetch), use `setTimeout(() => setSelectedTaskId(null), 0)` inside the `useMemo` to clear the stale ID on the next tick. This prevents the detail panel from going blank while still selected (T3/T5/T7 fix).

### Subtask optimistic append

Use a `tmp_${Date.now()}` id for newly created subtasks. Append the tmp row immediately to `data.tasks`, track its id in `optimisticAddsRef`, then swap the tmp row for the real DB row on `onSuccess` response payload. On failure, remove the tmp row and show an error toast.
