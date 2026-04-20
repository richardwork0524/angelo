'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';

// Nav pages (static — mirrors sidebar SECTIONS)
const NAV_PAGES = [
  { label: 'Home',      href: '/',         icon: '◉', group: 'Pages' },
  { label: 'Handoffs',  href: '/handoffs',  icon: '⇄', group: 'Pages' },
  { label: 'Tasks',     href: '/tasks',     icon: '✓', group: 'Pages' },
  { label: 'Entities',  href: '/entities',  icon: '◈', group: 'Pages' },
  { label: 'Notes',     href: '/notes',     icon: '✎', group: 'Pages' },
  { label: 'Vault',     href: '/vault',     icon: '◱', group: 'Pages' },
  { label: 'Sessions',  href: '/sessions',  icon: '◔', group: 'Pages' },
  { label: 'System',    href: '/system',    icon: '◊', group: 'Pages' },
];

interface TaskResult {
  id: string;
  text: string;
  project_key: string;
  bucket: string;
  priority: string | null;
}

interface SessionResult {
  id: string;
  title: string | null;
  session_code: string | null;
  project_key: string | null;
  surface: string | null;
}

interface ProjectResult {
  child_key: string;
  display_name: string;
  entity_type: string | null;
}

type ResultItem =
  | { type: 'page'; label: string; href: string; icon: string; group: string }
  | { type: 'task'; id: string; text: string; project_key: string; priority: string | null }
  | { type: 'session'; id: string; title: string; code: string | null; project_key: string | null; surface: string | null }
  | { type: 'project'; key: string; name: string; entity_type: string | null };

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [highlighted, setHighlighted] = useState(0);
  const [taskResults, setTaskResults] = useState<TaskResult[]>([]);
  const [sessionResults, setSessionResults] = useState<SessionResult[]>([]);
  const [projectResults, setProjectResults] = useState<ProjectResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  const debouncedQuery = useDebounce(query, 150);

  // SSR safety
  useEffect(() => setMounted(true), []);

  // Focus input on open
  useEffect(() => {
    if (open) {
      setQuery('');
      setHighlighted(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Load sessions + projects once on open (cached in module scope)
  const [cachedSessions, setCachedSessions] = useState<SessionResult[]>([]);
  const [cachedProjects, setCachedProjects] = useState<ProjectResult[]>([]);
  const didLoadRef = useRef(false);

  useEffect(() => {
    if (!open || didLoadRef.current) return;
    didLoadRef.current = true;
    (async () => {
      try {
        const [sessRes, projRes] = await Promise.all([
          fetch('/api/sessions?range=7d&limit=50').then((r) => r.json()),
          fetch('/api/projects').then((r) => r.json()),
        ]);
        setCachedSessions(sessRes?.sessions ?? []);
        setCachedProjects(projRes?.projects ?? []);
      } catch {
        // Graceful degradation
      }
    })();
  }, [open]);

  // Live task search + client-side filter of sessions/projects
  useEffect(() => {
    const q = debouncedQuery.trim();

    if (!q) {
      setTaskResults([]);
      setSessionResults(cachedSessions.slice(0, 5));
      setProjectResults(cachedProjects.slice(0, 5));
      setLoading(false);
      return;
    }

    const qLower = q.toLowerCase();

    // Client-side filter sessions + projects immediately
    setSessionResults(
      cachedSessions
        .filter((s) =>
          (s.title ?? '').toLowerCase().includes(qLower) ||
          (s.project_key ?? '').toLowerCase().includes(qLower) ||
          (s.session_code ?? '').toLowerCase().includes(qLower)
        )
        .slice(0, 5)
    );
    setProjectResults(
      cachedProjects
        .filter((p) =>
          p.display_name.toLowerCase().includes(qLower) ||
          p.child_key.toLowerCase().includes(qLower)
        )
        .slice(0, 5)
    );

    // Live task search
    setLoading(true);
    fetch(`/api/tasks?search=${encodeURIComponent(q)}&completed=false`)
      .then((r) => r.json())
      .then((data) => {
        setTaskResults((data?.tasks ?? []).slice(0, 5));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [debouncedQuery, cachedSessions, cachedProjects]);

  // Build flat result list for keyboard nav
  const q = query.trim().toLowerCase();
  const filteredPages = q
    ? NAV_PAGES.filter((p) => p.label.toLowerCase().includes(q))
    : NAV_PAGES;

  const items: ResultItem[] = [
    ...filteredPages.map((p) => ({ type: 'page' as const, ...p })),
    ...taskResults.map((t) => ({
      type: 'task' as const,
      id: t.id,
      text: t.text,
      project_key: t.project_key,
      priority: t.priority,
    })),
    ...sessionResults.map((s) => ({
      type: 'session' as const,
      id: s.id,
      title: s.title ?? 'Untitled session',
      code: s.session_code,
      project_key: s.project_key,
      surface: s.surface,
    })),
    ...projectResults.map((p) => ({
      type: 'project' as const,
      key: p.child_key,
      name: p.display_name,
      entity_type: p.entity_type,
    })),
  ];

  const execute = useCallback((item: ResultItem) => {
    if (item.type === 'page') router.push(item.href);
    else if (item.type === 'task') router.push(`/tasks?highlight=${item.id}`);
    else if (item.type === 'session') router.push(`/session/${item.id}`);
    else if (item.type === 'project') router.push(`/project/${item.key}`);
    onClose();
  }, [router, onClose]);

  // Keyboard navigation inside palette
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlighted((h) => Math.min(h + 1, items.length - 1));
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlighted((h) => Math.max(h - 1, 0));
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (items[highlighted]) execute(items[highlighted]);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, items, highlighted, execute, onClose]);

  // Reset highlight on query change
  useEffect(() => setHighlighted(0), [query]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector(`[data-idx="${highlighted}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [highlighted]);

  if (!mounted || !open) return null;

  const getSectionLabel = (item: ResultItem, idx: number): string | null => {
    if (idx === 0) {
      if (item.type === 'page') return 'Pages';
      if (item.type === 'task') return 'Tasks';
      if (item.type === 'session') return 'Sessions';
      if (item.type === 'project') return 'Projects';
    }
    const prev = items[idx - 1];
    if (prev.type !== item.type) {
      if (item.type === 'page') return 'Pages';
      if (item.type === 'task') return 'Tasks';
      if (item.type === 'session') return 'Sessions';
      if (item.type === 'project') return 'Projects';
    }
    return null;
  };

  const palette = (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9998,
          background: 'rgba(0,0,0,0.45)',
          backdropFilter: 'blur(2px)',
          animation: 'cmdk-fade-in 80ms ease',
        }}
      />

      {/* Modal */}
      <div
        role="dialog"
        aria-label="Command palette"
        aria-modal="true"
        style={{
          position: 'fixed',
          top: '20%',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 9999,
          width: '100%',
          maxWidth: 672,
          margin: '0 16px',
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--r-lg)',
          boxShadow: 'var(--sh-lg)',
          overflow: 'hidden',
          animation: 'cmdk-slide-in 100ms ease',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '60vh',
        }}
      >
        {/* Search input */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '12px 16px',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <span style={{ color: 'var(--text3)', fontSize: 16 }}>⌕</span>
          <input
            ref={inputRef}
            type="text"
            placeholder="Search tasks, sessions, projects, pages…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              fontSize: 'var(--t-body)',
              color: 'var(--text)',
            }}
            autoComplete="off"
            spellCheck={false}
          />
          {loading && (
            <span style={{ fontSize: 'var(--t-tiny)', color: 'var(--text4)' }}>
              Searching…
            </span>
          )}
          <kbd
            style={{
              padding: '2px 6px',
              background: 'var(--card-alt)',
              border: '1px solid var(--border)',
              borderRadius: 4,
              fontSize: 'var(--t-tiny)',
              color: 'var(--text3)',
              fontFamily: 'ui-monospace, monospace',
            }}
          >
            Esc
          </kbd>
        </div>

        {/* Results */}
        <div
          ref={listRef}
          style={{ overflowY: 'auto', flex: 1 }}
        >
          {items.length === 0 && !loading && (
            <div
              style={{
                padding: '32px 16px',
                textAlign: 'center',
                color: 'var(--text3)',
                fontSize: 'var(--t-sm)',
              }}
            >
              {query ? `No results for "${query}"` : 'Start typing to search…'}
            </div>
          )}

          {items.map((item, idx) => {
            const sectionLabel = getSectionLabel(item, idx);
            const isHighlighted = idx === highlighted;
            return (
              <div key={`${item.type}-${idx}`}>
                {sectionLabel && (
                  <div
                    style={{
                      padding: '8px 16px 4px',
                      fontSize: 'var(--t-tiny)',
                      textTransform: 'uppercase',
                      letterSpacing: '.08em',
                      color: 'var(--text4)',
                      fontWeight: 600,
                    }}
                  >
                    {sectionLabel}
                  </div>
                )}
                <button
                  data-idx={idx}
                  type="button"
                  onClick={() => execute(item)}
                  onMouseEnter={() => setHighlighted(idx)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    width: '100%',
                    padding: '9px 16px',
                    background: isHighlighted ? 'var(--primary-dim)' : 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                    color: isHighlighted ? 'var(--text)' : 'var(--text2)',
                    fontSize: 'var(--t-sm)',
                    transition: 'background 60ms',
                  }}
                >
                  {item.type === 'page' && (
                    <>
                      <span style={{ width: 20, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>{item.icon}</span>
                      <span style={{ flex: 1 }}>{item.label}</span>
                      <span style={{ fontSize: 'var(--t-tiny)', color: 'var(--text4)' }}>{item.href}</span>
                    </>
                  )}
                  {item.type === 'task' && (
                    <>
                      <span style={{ width: 20, textAlign: 'center', color: 'var(--text3)' }}>✓</span>
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.text}</span>
                      {item.priority && (
                        <span
                          style={{
                            fontSize: 'var(--t-tiny)',
                            color: item.priority === 'P0' ? 'var(--red)' : item.priority === 'P1' ? 'var(--warn)' : 'var(--text3)',
                            fontWeight: 600,
                          }}
                        >
                          {item.priority}
                        </span>
                      )}
                      <span style={{ fontSize: 'var(--t-tiny)', color: 'var(--text4)' }}>{item.project_key}</span>
                    </>
                  )}
                  {item.type === 'session' && (
                    <>
                      <span style={{ width: 20, textAlign: 'center', color: 'var(--text3)', fontSize: 12 }}>◔</span>
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</span>
                      {item.surface && (
                        <span style={{ fontSize: 'var(--t-tiny)', color: 'var(--text4)' }}>{item.surface}</span>
                      )}
                      {item.code && (
                        <span
                          style={{
                            fontSize: 'var(--t-tiny)',
                            color: 'var(--text4)',
                            fontFamily: 'ui-monospace, monospace',
                          }}
                        >
                          #{item.code.slice(0, 7)}
                        </span>
                      )}
                    </>
                  )}
                  {item.type === 'project' && (
                    <>
                      <span style={{ width: 20, textAlign: 'center', color: 'var(--text3)' }}>◈</span>
                      <span style={{ flex: 1 }}>{item.name}</span>
                      {item.entity_type && (
                        <span style={{ fontSize: 'var(--t-tiny)', color: 'var(--text4)' }}>{item.entity_type}</span>
                      )}
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {/* Footer hint */}
        <div
          style={{
            display: 'flex',
            gap: 12,
            padding: '8px 16px',
            borderTop: '1px solid var(--border)',
            fontSize: 'var(--t-tiny)',
            color: 'var(--text4)',
          }}
        >
          <span><kbd style={{ fontFamily: 'inherit' }}>↑↓</kbd> navigate</span>
          <span><kbd style={{ fontFamily: 'inherit' }}>↵</kbd> select</span>
          <span><kbd style={{ fontFamily: 'inherit' }}>Esc</kbd> close</span>
        </div>
      </div>

      <style>{`
        @keyframes cmdk-fade-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes cmdk-slide-in {
          from { opacity: 0; transform: translateX(-50%) translateY(-8px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
    </>
  );

  return createPortal(palette, document.body);
}
