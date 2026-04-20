'use client';

import { useState, useCallback } from 'react';

interface ReattributeStripProps {
  sessionId: string;
  currentProjectKey: string | null;
  onReattributed?: (newProjectKey: string, previousProjectKey: string | null) => void;
}

interface EntityOption {
  child_key: string;
  display_name: string;
  entity_type: string | null;
  status: string | null;
}

export function ReattributeStrip({ sessionId, currentProjectKey, onReattributed }: ReattributeStripProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [entities, setEntities] = useState<EntityOption[]>([]);
  const [loadingEntities, setLoadingEntities] = useState(false);
  const [search, setSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const openDrawer = useCallback(async () => {
    setDrawerOpen(true);
    if (entities.length > 0) return;
    setLoadingEntities(true);
    try {
      const res = await fetch('/api/projects');
      if (res.ok) {
        const data = await res.json();
        const projects = (data.projects || data || []) as EntityOption[];
        setEntities(projects.filter((p) => p.status !== 'ARCHIVED'));
      }
    } catch {
      // silent
    }
    setLoadingEntities(false);
  }, [entities.length]);

  const handleSelect = useCallback(async (entityKey: string) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_key: entityKey }),
      });
      const data = await res.json();
      if (data.success) {
        onReattributed?.(entityKey, data.previous_project_key ?? currentProjectKey);
        setDrawerOpen(false);
        setSearch('');
      }
    } catch {
      // silent — parent handles toast
    }
    setSubmitting(false);
  }, [sessionId, currentProjectKey, onReattributed, submitting]);

  const filtered = entities.filter((e) =>
    !search || e.display_name.toLowerCase().includes(search.toLowerCase()) || e.child_key.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      {/* Attribution strip */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 12px',
          background: 'var(--card2, var(--card))',
          borderRadius: 10,
          border: '1px dashed var(--border2, var(--border))',
        }}
      >
        <span style={{ color: 'var(--text3)', fontSize: 14, flexShrink: 0 }}>⠿</span>
        <span style={{ fontSize: 12, color: 'var(--text2)' }}>Attributed to</span>
        {currentProjectKey ? (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '2px 8px',
              background: 'var(--primary-dim)',
              border: '1px solid rgba(10,132,255,0.3)',
              borderRadius: 999,
              fontSize: 11,
              color: 'var(--primary-2)',
              fontFamily: 'ui-monospace, monospace',
            }}
          >
            {currentProjectKey}
          </span>
        ) : (
          <span style={{ fontSize: 12, color: 'var(--text3)', fontStyle: 'italic' }}>unassigned</span>
        )}
        <button
          onClick={openDrawer}
          style={{
            marginLeft: 'auto',
            fontSize: 11,
            color: 'var(--primary-2)',
            fontWeight: 510,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '2px 0',
            flexShrink: 0,
          }}
        >
          Re-assign →
        </button>
      </div>

      {/* Entity picker drawer/popover */}
      {drawerOpen && (
        <>
          {/* Backdrop */}
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 40 }}
            onClick={() => { setDrawerOpen(false); setSearch(''); }}
          />
          {/* Drawer panel — bottom sheet on mobile, popover-style on desktop */}
          <div
            style={{
              position: 'fixed',
              bottom: 0,
              left: 0,
              right: 0,
              zIndex: 50,
              background: 'var(--surface)',
              borderTop: '1px solid var(--border)',
              borderRadius: '16px 16px 0 0',
              padding: '16px 16px 32px',
              maxHeight: '70vh',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              boxShadow: '0 -8px 40px rgba(0,0,0,0.4)',
            }}
          >
            {/* Handle */}
            <div style={{ width: 40, height: 4, background: 'var(--border2)', borderRadius: 999, margin: '0 auto 6px' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 15, fontWeight: 590, color: 'var(--text)' }}>Re-assign to entity</span>
              <button
                onClick={() => { setDrawerOpen(false); setSearch(''); }}
                style={{ color: 'var(--text3)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}
              >
                ✕
              </button>
            </div>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search entities…"
              autoFocus
              style={{
                width: '100%',
                padding: '8px 12px',
                background: 'var(--card)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--r-sm)',
                color: 'var(--text)',
                fontSize: 13,
                outline: 'none',
              }}
            />
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {loadingEntities ? (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>Loading…</div>
              ) : filtered.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>No entities found</div>
              ) : (
                filtered.map((e) => (
                  <button
                    key={e.child_key}
                    onClick={() => handleSelect(e.child_key)}
                    disabled={submitting || e.child_key === currentProjectKey}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '10px 12px',
                      background: e.child_key === currentProjectKey ? 'var(--primary-dim)' : 'var(--card)',
                      border: e.child_key === currentProjectKey ? '1px solid rgba(10,132,255,0.3)' : '1px solid var(--border)',
                      borderRadius: 8,
                      cursor: e.child_key === currentProjectKey ? 'default' : 'pointer',
                      textAlign: 'left',
                      opacity: submitting ? 0.6 : 1,
                    }}
                  >
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--primary)', flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 13, color: 'var(--text)', fontWeight: e.child_key === currentProjectKey ? 500 : 400 }}>
                      {e.display_name}
                    </span>
                    <span style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'ui-monospace, monospace' }}>
                      {e.child_key}
                    </span>
                    {e.child_key === currentProjectKey && (
                      <span style={{ fontSize: 10, color: 'var(--primary-2)' }}>current</span>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
