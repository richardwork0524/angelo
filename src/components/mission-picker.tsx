'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

export interface MissionOption {
  child_key: string;
  display_name: string;
  parent_key: string | null;
  status?: string | null;
}

interface Props {
  open: boolean;
  currentValue: string | null;
  /** When set, picker preselects missions under this entity but still allows "All". */
  preferParent?: string | null;
  onClose: () => void;
  /** value = mission display_name (free-text storage). Null to clear. */
  onSelect: (value: string | null, option: MissionOption | null) => void;
}

/**
 * Bottom-sheet mission picker. Fetches /api/missions once per open.
 * Supports search, clear, and create-new (POST) when preferParent is set.
 */
export function MissionPicker({ open, currentValue, preferParent, onClose, onSelect }: Props) {
  const [missions, setMissions] = useState<MissionOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');
  const [scope, setScope] = useState<'parent' | 'all'>(preferParent ? 'parent' : 'all');
  const [creating, setCreating] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setQ('');
    setScope(preferParent ? 'parent' : 'all');
  }, [open, preferParent]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const url = scope === 'parent' && preferParent
      ? `/api/missions?parent=${encodeURIComponent(preferParent)}&limit=200`
      : `/api/missions?limit=200`;
    fetch(url)
      .then((r) => r.json())
      .then((d) => setMissions(d.missions || []))
      .catch(() => setMissions([]))
      .finally(() => setLoading(false));
  }, [open, scope, preferParent]);

  const filtered = useMemo(() => {
    if (!q.trim()) return missions;
    const needle = q.trim().toLowerCase();
    return missions.filter((m) =>
      m.display_name.toLowerCase().includes(needle) ||
      m.child_key.toLowerCase().includes(needle)
    );
  }, [q, missions]);

  const exactMatch = filtered.some((m) => m.display_name.toLowerCase() === q.trim().toLowerCase());
  const canCreate = !!preferParent && !!q.trim() && !exactMatch;

  async function handleCreate() {
    if (!preferParent || !q.trim()) return;
    setCreating(true);
    try {
      const r = await fetch('/api/missions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: q.trim(), parent_key: preferParent }),
      });
      const d = await r.json();
      if (d.mission) {
        onSelect(d.mission.display_name, d.mission);
        onClose();
      }
    } finally {
      setCreating(false);
    }
  }

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[60] bg-black/50"
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={sheetRef}
        className="fixed inset-x-0 bottom-0 z-[61] flex flex-col"
        style={{
          background: 'var(--surface)',
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          maxHeight: '80vh',
          paddingBottom: 'var(--safe-b)',
          boxShadow: '0 -10px 40px rgba(0,0,0,.25)',
        }}
        role="dialog"
        aria-label="Select mission"
      >
        {/* Grab handle */}
        <div className="flex justify-center pt-2">
          <span style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border-hi)' }} />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>Mission</div>
          <button onClick={onClose} className="text-[13px] text-[var(--text3)]">Close</button>
        </div>

        {/* Scope toggle */}
        {preferParent && (
          <div className="px-4 pb-2 flex gap-1">
            <button
              onClick={() => setScope('parent')}
              className="transition-colors"
              style={{
                padding: '5px 10px',
                borderRadius: 6,
                fontSize: 11,
                fontWeight: 600,
                background: scope === 'parent' ? 'var(--primary)' : 'var(--card)',
                color: scope === 'parent' ? '#fff' : 'var(--text3)',
                border: `1px solid ${scope === 'parent' ? 'var(--primary)' : 'var(--border)'}`,
              }}
            >
              This entity
            </button>
            <button
              onClick={() => setScope('all')}
              className="transition-colors"
              style={{
                padding: '5px 10px',
                borderRadius: 6,
                fontSize: 11,
                fontWeight: 600,
                background: scope === 'all' ? 'var(--primary)' : 'var(--card)',
                color: scope === 'all' ? '#fff' : 'var(--text3)',
                border: `1px solid ${scope === 'all' ? 'var(--primary)' : 'var(--border)'}`,
              }}
            >
              All missions
            </button>
          </div>
        )}

        {/* Search */}
        <div className="px-4 pb-2">
          <input
            type="text"
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search missions…"
            className="w-full text-[14px]"
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              background: 'var(--card)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
              outline: 'none',
            }}
          />
        </div>

        {/* Clear option */}
        <button
          onClick={() => { onSelect(null, null); onClose(); }}
          className="flex items-center gap-2 px-4 py-2.5 text-left"
          style={{ borderTop: '1px solid var(--border)', fontSize: 13, color: 'var(--text3)' }}
        >
          <span>✕</span>
          <span>Clear mission</span>
          {currentValue === null && (
            <span style={{ marginLeft: 'auto', color: 'var(--primary)', fontWeight: 600, fontSize: 11 }}>Current</span>
          )}
        </button>

        {/* List */}
        <div className="flex-1 overflow-y-auto" style={{ overscrollBehavior: 'contain', borderTop: '1px solid var(--border)' }}>
          {loading ? (
            <div className="px-4 py-6 text-center text-[13px] text-[var(--text3)]">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="px-4 py-6 text-center text-[13px] text-[var(--text3)]">
              {q ? 'No matches' : 'No missions'}
            </div>
          ) : (
            filtered.map((m) => {
              const active = currentValue === m.display_name;
              return (
                <button
                  key={m.child_key}
                  onClick={() => { onSelect(m.display_name, m); onClose(); }}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-left transition-colors hover:bg-[var(--card-alt)]"
                  style={{ borderBottom: '1px solid var(--border)' }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="truncate" style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>
                      {m.display_name}
                    </div>
                    <div className="truncate flex items-center gap-1.5" style={{ fontSize: 11, color: 'var(--text3)', marginTop: 1 }}>
                      <span style={{ fontFamily: 'ui-monospace, monospace' }}>{m.child_key}</span>
                      {m.parent_key && (
                        <>
                          <span>·</span>
                          <span>{m.parent_key}</span>
                        </>
                      )}
                    </div>
                  </div>
                  {active && (
                    <span style={{ color: 'var(--primary)', fontSize: 12, fontWeight: 600 }}>Current</span>
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Create new */}
        {canCreate && (
          <div style={{ borderTop: '1px solid var(--border)' }}>
            <button
              onClick={handleCreate}
              disabled={creating}
              className="w-full flex items-center gap-2 px-4 py-3 text-left transition-colors hover:bg-[var(--primary-dim)]"
              style={{ fontSize: 13, color: 'var(--primary)' }}
            >
              <span>＋</span>
              <span>
                {creating ? 'Creating…' : <>Create mission <strong>"{q.trim()}"</strong> under {preferParent}</>}
              </span>
            </button>
          </div>
        )}
      </div>
    </>
  );
}
