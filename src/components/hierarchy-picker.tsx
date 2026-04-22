'use client';

/**
 * HierarchyPicker — cascading category → entity → sub-entity (optional) → mission (optional)
 *
 * Props:
 *   value           — selected mission string (or null)
 *   onChange        — called with mission string | null
 *   lockedProjectKey — if set, renders a locked chip and skips the cascade
 *   projectKey      — the chosen entity/project key to scope missions
 *   onProjectKeyChange — called when entity selection changes
 *
 * Internal state:
 *   step 1: category (companies / development / general / group-strategy)
 *   step 2: entity (top-level entity in category)
 *   step 3: sub-entity (optional — child entities of selected entity)
 *   step 4: mission (optional — missions whose parent_key = selected entity/sub-entity)
 */

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import type { EntitySummary } from '@/lib/types';

type Category = 'companies' | 'development' | 'general' | 'group-strategy';

const CATEGORY_LABELS: Record<Category, string> = {
  companies: 'Companies',
  development: 'Development',
  general: 'General',
  'group-strategy': 'Group Strategy',
};

const FOLDER_ROOTS_BY_CATEGORY: Record<Category, string[]> = {
  companies: ['company'],
  development: ['app-development', 'game-development', 'website-development'],
  general: ['general'],
  'group-strategy': ['group-strategy', 'root'],
};

interface MissionRow {
  child_key: string;
  display_name: string;
  parent_key: string | null;
}

interface HierarchyPickerProps {
  /** Currently chosen project key (entity or sub-entity) */
  projectKey: string;
  onProjectKeyChange: (key: string) => void;
  /** Currently chosen mission string */
  value: string;
  onChange: (mission: string) => void;
  /** If set, skip the cascade and show a locked chip */
  lockedProjectKey?: string | null;
  /** Pass projects list so we can display display_name for the locked chip */
  projects?: { child_key: string; display_name: string }[];
}

/** Derive category from an entity's parent_key */
function categoryOfEntity(parentKey: string | null): Category {
  if (!parentKey) return 'general';
  if (parentKey === 'company') return 'companies';
  if (['app-development', 'game-development', 'website-development'].includes(parentKey)) return 'development';
  if (parentKey === 'general') return 'general';
  if (['group-strategy', 'root'].includes(parentKey)) return 'group-strategy';
  return 'general';
}

export function HierarchyPicker({
  projectKey,
  onProjectKeyChange,
  value,
  onChange,
  lockedProjectKey,
  projects = [],
}: HierarchyPickerProps) {
  // All entities from the /api/entities endpoint (cached in module-level var)
  const [entities, setEntities] = useState<EntitySummary[]>([]);
  const [missions, setMissions] = useState<MissionRow[]>([]);
  const [loadingEntities, setLoadingEntities] = useState(false);
  const [creatingMission, setCreatingMission] = useState(false);
  const [newMissionName, setNewMissionName] = useState('');
  const [showNewMission, setShowNewMission] = useState(false);
  const [missionInput, setMissionInput] = useState(value);
  const [missionOpen, setMissionOpen] = useState(false);
  const missionInputRef = useRef<HTMLInputElement>(null);
  const missionDropRef = useRef<HTMLDivElement>(null);

  // Derived selections
  const [category, setCategory] = useState<Category | null>(null);
  const [entityKey, setEntityKey] = useState<string>(''); // top-level entity
  const [subEntityKey, setSubEntityKey] = useState<string>(''); // sub-entity (optional)

  // Fetch all entities once
  useEffect(() => {
    let cancelled = false;
    setLoadingEntities(true);
    fetch('/api/entities')
      .then((r) => r.ok ? r.json() : null)
      .then((j) => {
        if (!cancelled && j?.entities) setEntities(j.entities as EntitySummary[]);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoadingEntities(false); });
    return () => { cancelled = true; };
  }, []);

  // Fetch missions for a given parent key
  const fetchMissions = useCallback(async (parentKey: string) => {
    if (!parentKey) { setMissions([]); return; }
    try {
      // We do a targeted SQL-free approach: just fetch /api/entities and filter client-side
      // Missions are in angelo_projects with entity_type='mission' and parent_key=parentKey
      // We'll use /api/projects since it returns all rows
      const res = await fetch('/api/projects');
      if (!res.ok) return;
      const json = await res.json();
      const allProjects: Array<{ child_key: string; display_name: string; entity_type: string | null; parent_key: string | null }> = json.projects || [];
      const rows: MissionRow[] = allProjects
        .filter((p) => p.entity_type === 'mission' && p.parent_key === parentKey)
        .map((p) => ({ child_key: p.child_key, display_name: p.display_name, parent_key: p.parent_key }));
      setMissions(rows);
    } catch { /* silent */ }
  }, []);

  // When projectKey changes externally (e.g. from prefill), try to derive category+entity
  useEffect(() => {
    if (!projectKey || !entities.length) return;
    // Find entity in list
    const found = entities.find((e) => e.child_key === projectKey);
    if (found) {
      const cat = categoryOfEntity(found.parent_key);
      setCategory(cat);
      setEntityKey(projectKey);
      setSubEntityKey('');
    } else {
      // projectKey might be a sub-entity — find its parent
      // We need to also check projects list
      const proj = projects.find((p) => p.child_key === projectKey);
      if (proj) {
        // It's a project but might not be in entities (could be child)
        // Try to find parent in entities
        // For simplicity, just set entityKey to projectKey and let cascade work
        setEntityKey(projectKey);
      }
    }
  }, [projectKey, entities, projects]);

  // Sync mission input with value prop
  useEffect(() => {
    setMissionInput(value);
  }, [value]);

  // When entityKey or subEntityKey changes, fetch missions
  const activeParentKey = subEntityKey || entityKey;
  useEffect(() => {
    if (activeParentKey) fetchMissions(activeParentKey);
    else setMissions([]);
  }, [activeParentKey, fetchMissions]);

  // Entities in selected category
  const categoryEntities = useMemo(() => {
    if (!category) return [];
    const roots = FOLDER_ROOTS_BY_CATEGORY[category];
    return entities.filter((e) => {
      if (!e.parent_key) return category === 'general';
      return roots.includes(e.parent_key);
    });
  }, [entities, category]);

  // Sub-entities of selected entity
  const subEntities = useMemo(() => {
    if (!entityKey) return [];
    return entities.filter((e) => e.parent_key === entityKey);
  }, [entities, entityKey]);

  // Missions filtered by input
  const filteredMissions = useMemo(() => {
    const q = missionInput.toLowerCase().trim();
    if (!q) return missions;
    return missions.filter(
      (m) => m.display_name.toLowerCase().includes(q) || m.child_key.toLowerCase().includes(q)
    );
  }, [missions, missionInput]);

  const showCreateOption = missionInput.trim() !== '' &&
    !missions.some((m) => m.display_name.toLowerCase() === missionInput.toLowerCase().trim() || m.child_key.toLowerCase() === missionInput.toLowerCase().trim());

  // Close mission dropdown on outside click
  useEffect(() => {
    if (!missionOpen) return;
    function onClick(e: MouseEvent) {
      if (
        missionInputRef.current && !missionInputRef.current.contains(e.target as Node) &&
        missionDropRef.current && !missionDropRef.current.contains(e.target as Node)
      ) {
        setMissionOpen(false);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [missionOpen]);

  function selectEntity(key: string) {
    setEntityKey(key);
    setSubEntityKey('');
    onProjectKeyChange(key);
    onChange('');
    setMissionInput('');
  }

  function selectSubEntity(key: string) {
    setSubEntityKey(key);
    onProjectKeyChange(key);
    onChange('');
    setMissionInput('');
  }

  function selectMission(name: string) {
    onChange(name);
    setMissionInput(name);
    setMissionOpen(false);
    missionInputRef.current?.blur();
  }

  async function createNewMission() {
    const name = newMissionName.trim() || missionInput.trim();
    if (!name || !activeParentKey) return;
    setCreatingMission(true);
    try {
      // Optimistically set
      onChange(name);
      setMissionInput(name);
      setMissions((prev) => [...prev, { child_key: name.toLowerCase().replace(/\s+/g, '-'), display_name: name, parent_key: activeParentKey }]);
      setShowNewMission(false);
      setNewMissionName('');
      setMissionOpen(false);

      // POST to create the mission row
      await fetch('/api/missions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          parent_key: activeParentKey,
          entity_type: 'mission',
        }),
      });

      // Reconcile after 200ms
      setTimeout(() => fetchMissions(activeParentKey), 200);
    } catch { /* silent */ }
    finally { setCreatingMission(false); }
  }

  const fieldStyle: React.CSSProperties = {
    width: '100%',
    padding: '7px 10px',
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--r-sm)',
    fontSize: 'var(--t-sm)',
    color: 'var(--text)',
    outline: 'none',
    fontFamily: 'ui-monospace, monospace',
    cursor: 'pointer',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 'var(--t-tiny)',
    color: 'var(--text3)',
    textTransform: 'uppercase',
    letterSpacing: '.06em',
    marginBottom: 5,
  };

  // ── Locked chip ──
  if (lockedProjectKey) {
    const proj = projects.find((p) => p.child_key === lockedProjectKey);
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 10px',
          background: 'var(--primary-dim)',
          border: '1px solid var(--primary-2)',
          borderRadius: 'var(--r-sm)',
          fontSize: 'var(--t-sm)',
          fontFamily: 'ui-monospace, monospace',
        }}
      >
        <span style={{ flex: 1, color: 'var(--primary-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {proj ? `${proj.display_name} · ${lockedProjectKey}` : lockedProjectKey}
        </span>
        <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--primary-2)', opacity: 0.7 }}>
          locked
        </span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

      {/* Step 1 — Category */}
      <div>
        <div style={labelStyle}>Category</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(Object.keys(CATEGORY_LABELS) as Category[]).map((cat) => {
            const active = category === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => {
                  setCategory(cat);
                  setEntityKey('');
                  setSubEntityKey('');
                  onProjectKeyChange('');
                  onChange('');
                  setMissionInput('');
                }}
                style={{
                  padding: '6px 10px',
                  borderRadius: 'var(--r-sm)',
                  background: active ? 'var(--primary-dim)' : 'var(--bg)',
                  border: `1px solid ${active ? 'var(--primary-2)' : 'var(--border)'}`,
                  color: active ? 'var(--primary-2)' : 'var(--text3)',
                  fontSize: 11,
                  fontWeight: active ? 700 : 500,
                  cursor: 'pointer',
                  letterSpacing: '.04em',
                }}
              >
                {CATEGORY_LABELS[cat]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Step 2 — Entity */}
      {category && (
        <div>
          <div style={labelStyle}>Entity</div>
          {loadingEntities ? (
            <div style={{ fontSize: 'var(--t-sm)', color: 'var(--text3)', padding: '6px 0' }}>Loading…</div>
          ) : categoryEntities.length === 0 ? (
            <div style={{ fontSize: 'var(--t-sm)', color: 'var(--text3)', padding: '6px 0' }}>No entities</div>
          ) : (
            <select
              value={entityKey}
              onChange={(e) => selectEntity(e.target.value)}
              style={fieldStyle}
            >
              <option value="">— pick entity —</option>
              {categoryEntities.map((e) => (
                <option key={e.child_key} value={e.child_key}>
                  {e.display_name} · {e.child_key}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* Step 3 — Sub-entity (only if entity has children) */}
      {entityKey && subEntities.length > 0 && (
        <div>
          <div style={labelStyle}>Sub-entity (optional)</div>
          <select
            value={subEntityKey}
            onChange={(e) => {
              if (e.target.value) {
                selectSubEntity(e.target.value);
              } else {
                setSubEntityKey('');
                onProjectKeyChange(entityKey);
                onChange('');
                setMissionInput('');
              }
            }}
            style={fieldStyle}
          >
            <option value="">— top level —</option>
            {subEntities.map((s) => (
              <option key={s.child_key} value={s.child_key}>
                {s.display_name} · {s.child_key}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Step 4 — Mission (optional) */}
      {activeParentKey && (
        <div style={{ position: 'relative' }}>
          <div style={labelStyle}>Mission (optional)</div>
          <div style={{ position: 'relative' }}>
            <input
              ref={missionInputRef}
              value={missionInput}
              onChange={(e) => {
                setMissionInput(e.target.value);
                onChange(e.target.value);
                setMissionOpen(true);
              }}
              onFocus={() => setMissionOpen(true)}
              placeholder="Search or create mission…"
              style={{
                width: '100%',
                padding: '7px 32px 7px 10px',
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--r-sm)',
                fontSize: 'var(--t-sm)',
                color: 'var(--text)',
                fontFamily: 'ui-monospace, monospace',
                outline: 'none',
              }}
            />
            {missionInput && (
              <button
                type="button"
                onClick={() => { onChange(''); setMissionInput(''); setMissionOpen(false); }}
                style={{
                  position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                  background: 'transparent', border: 'none', color: 'var(--text3)',
                  cursor: 'pointer', fontSize: 12, lineHeight: 1, padding: 2,
                }}
              >
                ✕
              </button>
            )}
          </div>

          {missionOpen && (filteredMissions.length > 0 || showCreateOption) && (
            <div
              ref={missionDropRef}
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                zIndex: 60,
                background: 'var(--card)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--r-sm)',
                boxShadow: 'var(--sh-lg)',
                marginTop: 2,
                maxHeight: 180,
                overflowY: 'auto',
              }}
            >
              {filteredMissions.map((m) => (
                <button
                  key={m.child_key}
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); selectMission(m.display_name); }}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '7px 12px',
                    background: 'transparent', border: 'none',
                    color: 'var(--text)', fontSize: 'var(--t-sm)',
                    fontFamily: 'ui-monospace, monospace', cursor: 'pointer',
                    borderBottom: '1px solid var(--border)',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--card-alt)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  {m.display_name}
                </button>
              ))}
              {showCreateOption && (
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setNewMissionName(missionInput.trim());
                    setShowNewMission(true);
                    setMissionOpen(false);
                  }}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '7px 12px',
                    background: 'transparent', border: 'none',
                    color: 'var(--primary-2)', fontSize: 'var(--t-sm)',
                    fontFamily: 'ui-monospace, monospace', cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--card-alt)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  ＋ Create new mission: &ldquo;{missionInput.trim()}&rdquo;
                </button>
              )}
            </div>
          )}

          {/* Inline new-mission confirm */}
          {showNewMission && (
            <div
              style={{
                marginTop: 6,
                padding: '10px 12px',
                background: 'var(--primary-dim)',
                border: '1px solid var(--primary-2)',
                borderRadius: 'var(--r-sm)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <input
                autoFocus
                value={newMissionName}
                onChange={(e) => setNewMissionName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') createNewMission(); if (e.key === 'Escape') { setShowNewMission(false); } }}
                placeholder="Mission name"
                style={{
                  flex: 1,
                  padding: '5px 8px',
                  background: 'var(--bg)',
                  border: '1px solid var(--primary-2)',
                  borderRadius: 'var(--r-sm)',
                  fontSize: 'var(--t-sm)',
                  color: 'var(--text)',
                  fontFamily: 'ui-monospace, monospace',
                  outline: 'none',
                }}
              />
              <button
                type="button"
                onClick={createNewMission}
                disabled={creatingMission || !newMissionName.trim()}
                style={{
                  padding: '5px 10px',
                  background: 'var(--primary)',
                  border: 'none',
                  borderRadius: 'var(--r-sm)',
                  color: '#fff',
                  fontSize: 'var(--t-sm)',
                  fontWeight: 600,
                  cursor: creatingMission || !newMissionName.trim() ? 'not-allowed' : 'pointer',
                  opacity: creatingMission || !newMissionName.trim() ? 0.6 : 1,
                }}
              >
                {creatingMission ? '…' : 'Create'}
              </button>
              <button
                type="button"
                onClick={() => { setShowNewMission(false); setNewMissionName(''); }}
                style={{
                  padding: '5px 8px',
                  background: 'transparent',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--r-sm)',
                  color: 'var(--text3)',
                  fontSize: 'var(--t-sm)',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
