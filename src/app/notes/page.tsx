'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import type { Note, NoteType, Project } from '@/lib/types';
import type { QuickNoteDetail } from '@/components/note-modal';

type TypeFilter = 'all' | NoteType;
type ResolvedFilter = 'unresolved' | 'resolved' | 'all';

const TYPE_TABS: { key: TypeFilter; label: string }[] = [
  { key: 'all', label: 'All types' },
  { key: 'GAP', label: 'GAP' },
  { key: 'IDEA', label: 'IDEA' },
  { key: 'OBSERVATION', label: 'OBS' },
  { key: 'REVISIT', label: 'REVISIT' },
];

const RESOLVED_TABS: { key: ResolvedFilter; label: string }[] = [
  { key: 'unresolved', label: 'Unresolved' },
  { key: 'resolved', label: 'Resolved' },
  { key: 'all', label: 'All' },
];

interface NotesApiResponse {
  notes: Note[];
  total: number;
  stats: {
    unresolved_total: number;
    total_all: number;
    by_type: Record<NoteType, number>;
  };
}

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [stats, setStats] = useState<NotesApiResponse['stats'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [resolvedFilter, setResolvedFilter] = useState<ResolvedFilter>('unresolved');
  const [search, setSearch] = useState('');
  const [entityFilter, setEntityFilter] = useState<string>('all');
  const [featureFilter, setFeatureFilter] = useState<string>('all');
  const [missionFilter, setMissionFilter] = useState<string>('all');
  const [projects, setProjects] = useState<Project[]>([]);

  const fetchNotes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/notes?limit=500');
      if (!res.ok) throw new Error();
      const json: NotesApiResponse = await res.json();
      setNotes(json.notes || []);
      setStats(json.stats || null);
    } catch {
      setNotes([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchNotes();
    fetch('/api/projects')
      .then((r) => r.ok ? r.json() : null)
      .then((j) => { if (j?.projects) setProjects(j.projects); })
      .catch(() => {});
  }, [fetchNotes]);

  useEffect(() => {
    function onChanged() { fetchNotes(); }
    window.addEventListener('notes-changed', onChanged);
    return () => window.removeEventListener('notes-changed', onChanged);
  }, [fetchNotes]);

  // Per-entity note counts (N1) — computed client-side from all loaded notes
  const entityCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const n of notes) {
      if (!n.resolved || resolvedFilter !== 'unresolved') {
        counts[n.project_key] = (counts[n.project_key] ?? 0) + 1;
      }
    }
    return counts;
  }, [notes, resolvedFilter]);

  // Unresolved entity counts (always shown in sidebar)
  const unresolvedEntityCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const n of notes) {
      if (!n.resolved) {
        counts[n.project_key] = (counts[n.project_key] ?? 0) + 1;
      }
    }
    return counts;
  }, [notes]);

  const entities = useMemo(() => {
    const keys = Array.from(new Set(notes.map((n) => n.project_key))).sort();
    return keys.map((key) => {
      const p = projects.find((x) => x.child_key === key);
      return { key, label: p ? `${p.display_name}` : key };
    });
  }, [notes, projects]);

  const features = useMemo(() => {
    const scope = entityFilter === 'all' ? notes : notes.filter((n) => n.project_key === entityFilter);
    return Array.from(new Set(scope.map((n) => n.feature).filter((v): v is string => !!v))).sort();
  }, [notes, entityFilter]);

  const missions = useMemo(() => {
    const scope = notes.filter((n) => {
      if (entityFilter !== 'all' && n.project_key !== entityFilter) return false;
      if (featureFilter !== 'all' && n.feature !== featureFilter) return false;
      return true;
    });
    return Array.from(new Set(scope.map((n) => n.mission).filter((v): v is string => !!v))).sort();
  }, [notes, entityFilter, featureFilter]);

  useEffect(() => { setFeatureFilter('all'); setMissionFilter('all'); }, [entityFilter]);
  useEffect(() => { setMissionFilter('all'); }, [featureFilter]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return notes.filter((n) => {
      if (typeFilter !== 'all' && n.note_type !== typeFilter) return false;
      if (resolvedFilter === 'unresolved' && n.resolved) return false;
      if (resolvedFilter === 'resolved' && !n.resolved) return false;
      if (entityFilter !== 'all' && n.project_key !== entityFilter) return false;
      if (featureFilter !== 'all' && n.feature !== featureFilter) return false;
      if (missionFilter !== 'all' && n.mission !== missionFilter) return false;
      if (q && !n.text.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [notes, typeFilter, resolvedFilter, entityFilter, featureFilter, missionFilter, search]);

  const unresolvedCount = stats?.unresolved_total ?? notes.filter((n) => !n.resolved).length;
  const totalCount = stats?.total_all ?? notes.length;
  const byType = stats?.by_type;

  function openNew() {
    const detail: QuickNoteDetail = {};
    if (entityFilter !== 'all') detail.project_key = entityFilter;
    if (featureFilter !== 'all') detail.feature = featureFilter;
    if (missionFilter !== 'all') detail.mission = missionFilter;
    if (typeFilter !== 'all') detail.default_type = typeFilter;
    window.dispatchEvent(new CustomEvent('quick-note', { detail }));
  }

  function openEdit(note: Note) {
    const detail: QuickNoteDetail = { edit_note: note };
    window.dispatchEvent(new CustomEvent('quick-note', { detail }));
  }

  return (
    <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Page head */}
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <div style={{ fontSize: 'var(--t-h2)', fontWeight: 600, letterSpacing: '-.01em' }}>
            Notes{' '}
            <span style={{ fontSize: 'var(--t-sm)', color: 'var(--text3)', fontWeight: 400, marginLeft: 4 }}>
              {unresolvedCount} unresolved · {totalCount} total
            </span>
          </div>
        </div>
        <button
          onClick={openNew}
          style={{
            padding: '9px 14px',
            background: 'var(--primary)',
            color: '#fff',
            border: '1px solid var(--primary)',
            borderRadius: 'var(--r-sm)',
            fontSize: 'var(--t-sm)',
            fontWeight: 500,
            boxShadow: '0 4px 12px rgba(99,102,241,.32)',
            cursor: 'pointer',
          }}
        >
          ＋ Note
        </button>
      </div>

      {/* Filter bar */}
      <div
        className="flex items-center gap-2 flex-wrap"
        style={{
          padding: 6,
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--r)',
        }}
      >
        <div className="flex items-center gap-1 flex-wrap">
          {TYPE_TABS.map((t) => (
            <FilterTab
              key={t.key}
              active={typeFilter === t.key}
              onClick={() => setTypeFilter(t.key)}
              color={t.key === 'all' ? null : typeTone(t.key)}
            >
              {t.label}
            </FilterTab>
          ))}
          <span style={{ width: 1, alignSelf: 'stretch', background: 'var(--border)', margin: '0 4px' }} />
          {RESOLVED_TABS.map((t) => (
            <FilterTab key={t.key} active={resolvedFilter === t.key} onClick={() => setResolvedFilter(t.key)}>
              {t.label}
            </FilterTab>
          ))}
        </div>
        <div className="flex-1" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search notes…"
          style={{
            padding: '6px 10px',
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r-sm)',
            fontSize: 'var(--t-sm)',
            color: 'var(--text)',
            outline: 'none',
            minWidth: 220,
          }}
        />
      </div>

      {/* Main content: sidebar + grid */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>

        {/* N1 — Per-entity sidebar */}
        <div
          style={{
            width: 200,
            flexShrink: 0,
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r)',
            padding: '8px 0',
            fontSize: 'var(--t-sm)',
          }}
        >
          <div
            style={{
              padding: '4px 12px 8px',
              fontSize: 'var(--t-tiny)',
              color: 'var(--text3)',
              textTransform: 'uppercase',
              letterSpacing: '.06em',
              borderBottom: '1px solid var(--border)',
              marginBottom: 4,
            }}
          >
            By entity
          </div>

          {/* All */}
          <button
            onClick={() => setEntityFilter('all')}
            style={{
              display: 'flex',
              width: '100%',
              alignItems: 'center',
              padding: '5px 12px',
              background: entityFilter === 'all' ? 'var(--primary-dim)' : 'transparent',
              border: 'none',
              color: entityFilter === 'all' ? 'var(--primary-2)' : 'var(--text2)',
              fontSize: 'var(--t-sm)',
              cursor: 'pointer',
              fontWeight: entityFilter === 'all' ? 600 : 400,
              textAlign: 'left',
              gap: 6,
            }}
          >
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              All entities
            </span>
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: entityFilter === 'all' ? 'var(--primary-2)' : 'var(--text4)',
                fontVariantNumeric: 'tabular-nums',
                background: entityFilter === 'all' ? 'var(--primary-dim)' : 'var(--bg)',
                border: `1px solid ${entityFilter === 'all' ? 'var(--primary-2)' : 'var(--border)'}`,
                borderRadius: 3,
                padding: '1px 5px',
                flexShrink: 0,
              }}
            >
              {unresolvedCount}
            </span>
          </button>

          {entities.map((e) => {
            const active = entityFilter === e.key;
            const count = unresolvedEntityCounts[e.key] ?? 0;
            return (
              <button
                key={e.key}
                onClick={() => setEntityFilter(e.key)}
                style={{
                  display: 'flex',
                  width: '100%',
                  alignItems: 'center',
                  padding: '5px 12px',
                  background: active ? 'var(--primary-dim)' : 'transparent',
                  border: 'none',
                  color: active ? 'var(--primary-2)' : 'var(--text2)',
                  fontSize: 'var(--t-sm)',
                  cursor: 'pointer',
                  fontWeight: active ? 600 : 400,
                  textAlign: 'left',
                  gap: 6,
                }}
                onMouseEnter={(el) => { if (!active) el.currentTarget.style.background = 'var(--card-alt)'; }}
                onMouseLeave={(el) => { if (!active) el.currentTarget.style.background = 'transparent'; }}
              >
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {e.label}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: active ? 'var(--primary-2)' : (count > 0 ? 'var(--text3)' : 'var(--text4)'),
                    background: active ? 'var(--primary-dim)' : 'var(--bg)',
                    border: `1px solid ${active ? 'var(--primary-2)' : 'var(--border)'}`,
                    borderRadius: 3,
                    padding: '1px 5px',
                    flexShrink: 0,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {count}
                </span>
              </button>
            );
          })}

          {entities.length === 0 && !loading && (
            <div style={{ padding: '8px 12px', color: 'var(--text4)', fontSize: 'var(--t-sm)' }}>
              No entities
            </div>
          )}
        </div>

        {/* Right column: scope row + grid */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Hierarchy scope (feature + mission drill-down) */}
          {entityFilter !== 'all' && (
            <div
              className="flex items-center gap-2 flex-wrap"
              style={{
                padding: '6px 12px',
                background: 'var(--card)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--r)',
                fontSize: 'var(--t-sm)',
              }}
            >
              <span style={{ fontSize: 'var(--t-tiny)', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.06em', marginRight: 4 }}>
                Scope
              </span>
              <ScopeSelect value={featureFilter} onChange={setFeatureFilter} disabled={false} placeholder="All features">
                {features.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </ScopeSelect>
              <span style={{ color: 'var(--text4)', fontFamily: 'ui-monospace, monospace' }}>›</span>
              <ScopeSelect value={missionFilter} onChange={setMissionFilter} disabled={featureFilter === 'all'} placeholder="All missions">
                {missions.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </ScopeSelect>
              <span style={{ marginLeft: 'auto', fontSize: 'var(--t-tiny)', color: 'var(--text4)' }}>
                Drill down narrows results
              </span>
            </div>
          )}

          {/* Grid */}
          {loading ? (
            <div style={{ padding: 48, textAlign: 'center', color: 'var(--text3)', fontSize: 'var(--t-sm)' }}>
              Loading notes…
            </div>
          ) : filtered.length === 0 ? (
            <div
              style={{
                padding: '48px 24px',
                textAlign: 'center',
                color: 'var(--text3)',
                fontSize: 'var(--t-sm)',
                background: 'var(--card)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--r)',
              }}
            >
              {notes.length === 0
                ? 'No notes yet. Use the ＋ in the topbar or button above to capture one.'
                : 'No notes match current filters.'}
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: 12,
                alignContent: 'start',
              }}
            >
              {filtered.map((n) => (
                <NoteCard key={n.id} note={n} project={projects.find((p) => p.child_key === n.project_key)} onClick={() => openEdit(n)} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Stats strip */}
      <div
        className="flex items-center gap-3 flex-wrap"
        style={{
          padding: '12px 16px',
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--r)',
        }}
      >
        <StatCell label="Total" value={totalCount} />
        <StatCell label="Gap" value={byType?.GAP ?? 0} color="var(--warn)" />
        <StatCell label="Idea" value={byType?.IDEA ?? 0} color="var(--primary-2)" />
        <StatCell label="Observation" value={byType?.OBSERVATION ?? 0} color="var(--info)" />
        <StatCell label="Revisit" value={byType?.REVISIT ?? 0} color="var(--danger)" />
      </div>
    </div>
  );
}

function typeTone(t: NoteType): string {
  return t === 'GAP' ? 'var(--warn)'
    : t === 'IDEA' ? 'var(--primary-2)'
    : t === 'OBSERVATION' ? 'var(--info)'
    : 'var(--danger)';
}

function FilterTab({ active, onClick, children, color }: { active: boolean; onClick: () => void; children: React.ReactNode; color?: string | null }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px 12px',
        background: active ? 'var(--primary-dim)' : 'transparent',
        border: 'none',
        borderRadius: 'var(--r-sm)',
        fontSize: 'var(--t-sm)',
        color: active ? 'var(--primary-2)' : (color || 'var(--text3)'),
        fontWeight: active ? 600 : 500,
        cursor: 'pointer',
        letterSpacing: color ? '.06em' : 'normal',
        textTransform: color ? 'uppercase' : 'none',
      }}
    >
      {children}
    </button>
  );
}

function ScopeSelect({ value, onChange, disabled, placeholder, children }: { value: string; onChange: (v: string) => void; disabled?: boolean; placeholder: string; children: React.ReactNode }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      style={{
        background: 'var(--bg)',
        border: '1px solid var(--border)',
        outline: 'none',
        color: 'var(--text)',
        fontSize: 'var(--t-sm)',
        padding: '4px 22px 4px 8px',
        borderRadius: 'var(--r-sm)',
        fontFamily: 'ui-monospace, monospace',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <option value="all">{placeholder}</option>
      {children}
    </select>
  );
}

function StatCell({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="flex-1" style={{ minWidth: 100 }}>
      <div style={{ fontSize: 'var(--t-tiny)', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
        {label}
      </div>
      <div style={{ fontSize: 'var(--t-h2)', fontWeight: 600, color: color || 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </div>
    </div>
  );
}

function NoteCard({ note, project, onClick }: { note: Note; project?: Project; onClick: () => void }) {
  const tone = typeTone(note.note_type);
  return (
    <button
      onClick={onClick}
      style={{
        textAlign: 'left',
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderLeft: `3px solid ${tone}`,
        borderRadius: 'var(--r)',
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        cursor: 'pointer',
        transition: 'all 140ms',
        opacity: note.resolved ? 0.55 : 1,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--border-hi)';
        e.currentTarget.style.boxShadow = 'var(--sh-sm)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--border)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      <div className="flex items-center gap-2 flex-wrap">
        <span
          style={{
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: '.08em',
            textTransform: 'uppercase',
            padding: '2px 6px',
            borderRadius: 3,
            background: toneDim(note.note_type),
            color: tone,
          }}
        >
          {note.note_type === 'OBSERVATION' ? 'OBS' : note.note_type}
        </span>
        {note.resolved && (
          <span style={{ color: 'var(--success)', fontSize: 9, fontWeight: 700 }}>✓ RESOLVED</span>
        )}
      </div>
      <div style={{ fontSize: 'var(--t-sm)', color: 'var(--text2)', lineHeight: 1.55 }}>
        {note.text}
      </div>
      <div className="flex items-center gap-1.5 flex-wrap" style={{ fontSize: 'var(--t-tiny)', color: 'var(--text3)', marginTop: 'auto' }}>
        <span style={{ fontFamily: 'ui-monospace, monospace' }}>
          {project?.display_name || note.project_key}
        </span>
        {note.feature && (
          <>
            <span style={{ color: 'var(--text4)' }}>›</span>
            <span style={{ fontFamily: 'ui-monospace, monospace' }}>{note.feature}</span>
          </>
        )}
        {note.mission && (
          <>
            <span style={{ color: 'var(--text4)' }}>›</span>
            <span style={{ fontFamily: 'ui-monospace, monospace' }}>{note.mission}</span>
          </>
        )}
        {note.revisit_version && (
          <span style={{ color: 'var(--danger)', fontFamily: 'ui-monospace, monospace' }}>@ {note.revisit_version}</span>
        )}
        <span style={{ marginLeft: 'auto' }}>{formatWhen(note.created_at)}</span>
      </div>
    </button>
  );
}

function toneDim(t: NoteType): string {
  return t === 'GAP' ? 'var(--warn-dim)'
    : t === 'IDEA' ? 'var(--primary-dim)'
    : t === 'OBSERVATION' ? 'var(--info-dim)'
    : 'var(--danger-dim)';
}

function formatWhen(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return 'now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const dd = Math.floor(h / 24);
  if (dd < 7) return `${dd}d`;
  return d.toLocaleDateString();
}
