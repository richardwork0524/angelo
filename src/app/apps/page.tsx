'use client';

import { useCallback, useEffect, useState } from 'react';
import { StickyHeader } from '@/components/sticky-header';
import { IdBadge } from '@/components/id-badge';
import { useToast } from '@/components/toast';
import { cachedFetch, invalidateCache } from '@/lib/cache';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import type { App, AppModule, Feature, AppWithChildren } from '@/lib/types';

const FEATURE_STATUS_COLOR: Record<string, { bg: string; fg: string }> = {
  LIVE:        { bg: 'var(--green-dim)',  fg: 'var(--green)' },
  IN_PROGRESS: { bg: 'var(--accent-dim)', fg: 'var(--accent)' },
  PLANNED:     { bg: 'var(--yellow-dim)', fg: 'var(--yellow)' },
  DEPRECATED:  { bg: 'var(--red-dim)',    fg: 'var(--red)' },
};

const APP_STATUS_COLOR: Record<string, { bg: string; fg: string }> = {
  ACTIVE:   { bg: 'var(--green-dim)',  fg: 'var(--green)' },
  PAUSED:   { bg: 'var(--yellow-dim)', fg: 'var(--yellow)' },
  ARCHIVED: { bg: 'var(--card)',       fg: 'var(--text3)' },
  PLANNED:  { bg: 'var(--accent-dim)', fg: 'var(--accent)' },
};

type Kind = 'app' | 'module' | 'feature';

interface EditState {
  kind: Kind;
  id?: string;
  parentId?: string;
  initial?: Partial<App> | Partial<AppModule> | Partial<Feature>;
}

export default function AppsPage() {
  const [apps, setApps] = useState<AppWithChildren[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedApps, setExpandedApps] = useState<Set<string>>(new Set());
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<EditState | null>(null);
  const [confirmDel, setConfirmDel] = useState<{ kind: Kind; id: string; name: string } | null>(null);
  const { showToast, ToastContainer } = useToast();

  const fetchApps = useCallback(async (skip = false) => {
    try {
      if (skip) invalidateCache('/api/apps');
      const data = await cachedFetch<{ apps: AppWithChildren[] }>('/api/apps', 15000);
      setApps(data.apps || []);
      if (expandedApps.size === 0 && data.apps.length > 0) {
        setExpandedApps(new Set([data.apps[0].id]));
      }
    } catch {
      setApps([]);
    }
    setLoading(false);
  }, [expandedApps.size]);

  useEffect(() => { fetchApps(); }, [fetchApps]);

  useRealtimeRefresh({ table: 'angelo_apps',     cachePrefix: '/api/apps', onRefresh: () => fetchApps(true) });
  useRealtimeRefresh({ table: 'angelo_modules',  cachePrefix: '/api/apps', onRefresh: () => fetchApps(true) });
  useRealtimeRefresh({ table: 'angelo_features', cachePrefix: '/api/apps', onRefresh: () => fetchApps(true) });

  function toggle(set: Set<string>, id: string, setter: (s: Set<string>) => void) {
    const next = new Set(set);
    if (next.has(id)) next.delete(id); else next.add(id);
    setter(next);
  }

  async function handleSave(fields: Record<string, unknown>) {
    if (!editing) return;
    const { kind, id } = editing;
    const isEdit = !!id;
    try {
      const res = await fetch('/api/apps', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isEdit ? { kind, id, ...fields } : { kind, ...fields }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Failed');
      showToast(`${kind} ${isEdit ? 'updated' : 'created'}`);
      setEditing(null);
      fetchApps(true);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Save failed', 'error');
    }
  }

  async function handleDelete() {
    if (!confirmDel) return;
    try {
      const res = await fetch('/api/apps', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: confirmDel.kind, id: confirmDel.id }),
      });
      if (!res.ok) throw new Error('Delete failed');
      showToast(`${confirmDel.kind} deleted`);
      setConfirmDel(null);
      fetchApps(true);
    } catch {
      showToast('Delete failed', 'error');
    }
  }

  const totalModules = apps.reduce((n, a) => n + a.modules.length, 0);
  const totalFeatures = apps.reduce((n, a) => n + a.modules.reduce((mn, m) => mn + m.features.length, 0), 0);

  return (
    <div className="flex flex-col h-full min-h-0 bg-[var(--bg)]">
      <StickyHeader title="Apps" />

      {/* Summary strip */}
      <div className="px-5 pt-4 pb-2 flex items-center gap-4 flex-wrap">
        <Stat label="Apps" value={apps.length} color="var(--accent)" />
        <Stat label="Modules" value={totalModules} color="var(--purple)" />
        <Stat label="Features" value={totalFeatures} color="var(--green)" />
        <div className="flex-1" />
        <button
          onClick={() => setEditing({ kind: 'app' })}
          className="px-3 py-2 rounded-[8px] bg-[var(--accent)] text-white text-[12px] font-semibold hover:opacity-90"
        >
          + New App
        </button>
      </div>

      <p className="px-5 pb-3 text-[11px] text-[var(--text3)] leading-[1.5]">
        App → Module → Feature hierarchy. Every row carries its <code className="text-[var(--accent)]">key</code> (click to copy) and its vault folder path.
        This is the canonical source for app / module / feature IDs; tasks, handoffs, and sessions reference these.
      </p>

      <div className="flex-1 overflow-y-auto px-5 pb-8">
        {loading ? (
          <p className="text-[13px] text-[var(--text3)]">Loading...</p>
        ) : apps.length === 0 ? (
          <EmptyState onCreate={() => setEditing({ kind: 'app' })} />
        ) : (
          <div className="space-y-2">
            {apps.map((app) => {
              const isOpen = expandedApps.has(app.id);
              const appColor = APP_STATUS_COLOR[app.status] || APP_STATUS_COLOR.ACTIVE;
              return (
                <div key={app.id} className="rounded-[12px] border border-[var(--border)] bg-[var(--card)] overflow-hidden">
                  {/* App header */}
                  <div className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--card2,var(--card))]">
                    <button
                      onClick={() => toggle(expandedApps, app.id, setExpandedApps)}
                      className="w-5 h-5 flex items-center justify-center text-[var(--text3)] shrink-0"
                    >
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className={`transition-transform ${isOpen ? 'rotate-90' : ''}`}>
                        <path d="M3 1L7 5L3 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[15px] font-bold">{app.display_name}</span>
                        <IdBadge value={app.app_key} label="app_key" kind="key" />
                        <span className="text-[9px] font-bold uppercase tracking-[0.05em] px-1.5 py-[1px] rounded-[4px]"
                              style={{ background: appColor.bg, color: appColor.fg }}>{app.status}</span>
                        {app.deployed_url && (
                          <a href={app.deployed_url} target="_blank" rel="noreferrer" className="text-[10px] text-[var(--accent)] hover:underline">
                            {new URL(app.deployed_url).hostname}
                          </a>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <IdBadge value={app.rinoa_path} label="vault" kind="path" size="xs" />
                        {app.code_path && <IdBadge value={app.code_path} label="code" kind="path" size="xs" />}
                        {app.project_key && <IdBadge value={app.project_key} label="project_key" kind="key" size="xs" />}
                        <span className="text-[10px] text-[var(--text3)]">
                          {app.modules.length} mod · {app.modules.reduce((n, m) => n + m.features.length, 0)} feat
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => setEditing({ kind: 'app', id: app.id, initial: app })}
                              className="text-[10px] px-2 py-1 rounded-[6px] hover:bg-[var(--border)] text-[var(--text2)]">Edit</button>
                      <button onClick={() => setConfirmDel({ kind: 'app', id: app.id, name: app.display_name })}
                              className="text-[10px] px-2 py-1 rounded-[6px] hover:bg-[var(--red-dim)] text-[var(--red)]">Del</button>
                    </div>
                  </div>

                  {/* Modules */}
                  {isOpen && (
                    <div className="border-t border-[var(--border)] pl-6 pr-3 py-2 space-y-1">
                      {app.modules.length === 0 && (
                        <p className="text-[11px] text-[var(--text3)] py-1">No modules yet.</p>
                      )}
                      {app.modules.map((mod) => {
                        const mOpen = expandedModules.has(mod.id);
                        return (
                          <div key={mod.id} className="rounded-[8px] hover:bg-[var(--bg)]">
                            <div className="flex items-center gap-2 py-1.5">
                              <button onClick={() => toggle(expandedModules, mod.id, setExpandedModules)}
                                      className="w-4 h-4 flex items-center justify-center text-[var(--text3)]">
                                <svg width="8" height="8" viewBox="0 0 10 10" fill="none" className={`transition-transform ${mOpen ? 'rotate-90' : ''}`}>
                                  <path d="M3 1L7 5L3 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                                </svg>
                              </button>
                              <span className="w-[6px] h-[6px] rounded-full shrink-0"
                                    style={{ background: mod.status === 'ACTIVE' ? 'var(--purple)' : 'var(--text3)' }} />
                              <span className="text-[13px] font-semibold">{mod.display_name}</span>
                              <IdBadge value={mod.module_key} label="module_key" kind="key" size="xs" />
                              {mod.rinoa_path && <IdBadge value={mod.rinoa_path} label="vault" kind="path" size="xs" />}
                              <span className="text-[10px] text-[var(--text3)]">{mod.features.length} feat</span>
                              <div className="flex-1" />
                              <button onClick={() => setEditing({ kind: 'feature', parentId: mod.id })}
                                      className="text-[10px] px-1.5 py-0.5 rounded-[4px] text-[var(--accent)] hover:bg-[var(--accent-dim)]">+ feature</button>
                              <button onClick={() => setEditing({ kind: 'module', id: mod.id, initial: mod })}
                                      className="text-[10px] px-1.5 py-0.5 rounded-[4px] text-[var(--text2)] hover:bg-[var(--border)]">Edit</button>
                              <button onClick={() => setConfirmDel({ kind: 'module', id: mod.id, name: mod.display_name })}
                                      className="text-[10px] px-1.5 py-0.5 rounded-[4px] text-[var(--red)] hover:bg-[var(--red-dim)]">Del</button>
                            </div>

                            {/* Features */}
                            {mOpen && (
                              <div className="pl-6 pb-2 space-y-0.5">
                                {mod.features.length === 0 && (
                                  <p className="text-[11px] text-[var(--text3)] py-1">No features.</p>
                                )}
                                {mod.features.map((f) => {
                                  const color = FEATURE_STATUS_COLOR[f.status] || FEATURE_STATUS_COLOR.PLANNED;
                                  return (
                                    <div key={f.id} className="flex items-start gap-2 py-1 group">
                                      <span className="w-[6px] h-[6px] rounded-full shrink-0 mt-[7px]" style={{ background: color.fg }} />
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          <span className="text-[12px] font-medium">{f.display_name}</span>
                                          <IdBadge value={f.feature_key} label="feature_key" kind="key" size="xs" />
                                          <span className="text-[9px] font-bold uppercase tracking-[0.05em] px-1.5 py-[1px] rounded-[4px]"
                                                style={{ background: color.bg, color: color.fg }}>{f.status}</span>
                                          {f.entry_point && <span className="text-[9px] font-bold text-[var(--purple)] px-1.5 py-[1px] rounded-[4px] bg-[var(--purple-dim)]">{f.entry_point}</span>}
                                        </div>
                                        {f.description && <p className="text-[10px] text-[var(--text3)] mt-0.5 leading-[1.4]">{f.description}</p>}
                                      </div>
                                      <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                        <button onClick={() => setEditing({ kind: 'feature', id: f.id, initial: f })}
                                                className="text-[10px] px-1.5 py-0.5 rounded-[4px] text-[var(--text2)] hover:bg-[var(--border)]">Edit</button>
                                        <button onClick={() => setConfirmDel({ kind: 'feature', id: f.id, name: f.display_name })}
                                                className="text-[10px] px-1.5 py-0.5 rounded-[4px] text-[var(--red)] hover:bg-[var(--red-dim)]">Del</button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      <button onClick={() => setEditing({ kind: 'module', parentId: app.id })}
                              className="text-[11px] px-2 py-1 rounded-[6px] text-[var(--accent)] hover:bg-[var(--accent-dim)] font-semibold">
                        + Module
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {editing && (
        <EditSheet
          state={editing}
          apps={apps}
          onClose={() => setEditing(null)}
          onSave={handleSave}
        />
      )}
      {confirmDel && (
        <ConfirmDialog
          title={`Delete ${confirmDel.kind}?`}
          message={`"${confirmDel.name}" will be removed${confirmDel.kind !== 'feature' ? ' along with its children' : ''}. This cannot be undone.`}
          onCancel={() => setConfirmDel(null)}
          onConfirm={handleDelete}
        />
      )}
      <ToastContainer />
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-[20px] font-bold tabular-nums" style={{ color }}>{value}</span>
      <span className="text-[11px] font-semibold text-[var(--text3)] uppercase tracking-[0.05em]">{label}</span>
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="py-16 flex flex-col items-center gap-3 text-center">
      <div className="w-12 h-12 rounded-[12px] bg-[var(--accent-dim)] flex items-center justify-center text-[var(--accent)] text-[20px]">+</div>
      <p className="text-[14px] font-semibold">No apps yet</p>
      <p className="text-[12px] text-[var(--text3)] max-w-[280px]">Create your first app to start tracking modules and features here.</p>
      <button onClick={onCreate} className="mt-2 px-4 py-2 rounded-[8px] bg-[var(--accent)] text-white text-[13px] font-semibold">Create App</button>
    </div>
  );
}

/* ── Edit / Create sheet ── */

function EditSheet({ state, apps, onClose, onSave }: {
  state: EditState;
  apps: AppWithChildren[];
  onClose: () => void;
  onSave: (fields: Record<string, unknown>) => void;
}) {
  const { kind, id, parentId, initial } = state;
  const isEdit = !!id;

  const [form, setForm] = useState<Record<string, string>>(() => {
    const base: Record<string, string> = {};
    if (initial) {
      Object.entries(initial).forEach(([k, v]) => {
        if (v != null) base[k] = String(v);
      });
    }
    if (!isEdit && kind === 'module' && parentId) base.app_id = parentId;
    if (!isEdit && kind === 'feature' && parentId) base.module_id = parentId;
    return base;
  });

  function set(k: string, v: string) { setForm((f) => ({ ...f, [k]: v })); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(form)) {
      if (v === '' || v === undefined) continue;
      payload[k] = v;
    }
    onSave(payload);
  }

  const title = `${isEdit ? 'Edit' : 'New'} ${kind}`;

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-40" onClick={onClose} />
      <div className="fixed top-0 right-0 bottom-0 w-full sm:w-[440px] z-50 bg-[var(--surface)] border-l border-[var(--border)] overflow-y-auto">
        <div className="sticky top-0 bg-[var(--surface)] px-5 py-4 border-b border-[var(--border)] flex items-center justify-between">
          <h2 className="text-[15px] font-bold">{title}</h2>
          <button onClick={onClose} className="text-[18px] text-[var(--text3)] hover:text-[var(--text)]">×</button>
        </div>
        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          {kind === 'app' && (
            <>
              <Field label="app_key" required hint="kebab-case, globally unique, e.g. 'angelo'"><input className={inputCls} value={form.app_key || ''} onChange={(e) => set('app_key', e.target.value)} placeholder="angelo" required /></Field>
              <Field label="Display name" required><input className={inputCls} value={form.display_name || ''} onChange={(e) => set('display_name', e.target.value)} required /></Field>
              <Field label="rinoa_path" required hint="vault folder relative to Rinoa-OS root"><input className={inputCls} value={form.rinoa_path || ''} onChange={(e) => set('rinoa_path', e.target.value)} placeholder="development/app-development/angelo" required /></Field>
              <Field label="code_path" hint="local git working copy"><input className={inputCls} value={form.code_path || ''} onChange={(e) => set('code_path', e.target.value)} placeholder="/Users/richard/code/angelo" /></Field>
              <Field label="git_repo"><input className={inputCls} value={form.git_repo || ''} onChange={(e) => set('git_repo', e.target.value)} placeholder="https://github.com/..." /></Field>
              <Field label="deployed_url"><input className={inputCls} value={form.deployed_url || ''} onChange={(e) => set('deployed_url', e.target.value)} placeholder="https://angelo.yhang.ai" /></Field>
              <Field label="project_key" hint="link to angelo_projects.child_key (optional)"><input className={inputCls} value={form.project_key || ''} onChange={(e) => set('project_key', e.target.value)} /></Field>
              <Field label="description"><textarea className={inputCls} rows={3} value={form.description || ''} onChange={(e) => set('description', e.target.value)} /></Field>
              <Field label="Status"><select className={inputCls} value={form.status || 'ACTIVE'} onChange={(e) => set('status', e.target.value)}>
                <option value="ACTIVE">ACTIVE</option><option value="PAUSED">PAUSED</option><option value="ARCHIVED">ARCHIVED</option>
              </select></Field>
            </>
          )}
          {kind === 'module' && (
            <>
              <Field label="App" required><select className={inputCls} value={form.app_id || ''} onChange={(e) => set('app_id', e.target.value)} required>
                <option value="">Select app...</option>
                {apps.map((a) => <option key={a.id} value={a.id}>{a.display_name} · {a.app_key}</option>)}
              </select></Field>
              <Field label="module_key" required hint="e.g. 'angelo.dashboard'"><input className={inputCls} value={form.module_key || ''} onChange={(e) => set('module_key', e.target.value)} required /></Field>
              <Field label="Display name" required><input className={inputCls} value={form.display_name || ''} onChange={(e) => set('display_name', e.target.value)} required /></Field>
              <Field label="rinoa_path"><input className={inputCls} value={form.rinoa_path || ''} onChange={(e) => set('rinoa_path', e.target.value)} /></Field>
              <Field label="description"><textarea className={inputCls} rows={3} value={form.description || ''} onChange={(e) => set('description', e.target.value)} /></Field>
              <Field label="Status"><select className={inputCls} value={form.status || 'ACTIVE'} onChange={(e) => set('status', e.target.value)}>
                <option value="ACTIVE">ACTIVE</option><option value="PLANNED">PLANNED</option><option value="ARCHIVED">ARCHIVED</option>
              </select></Field>
            </>
          )}
          {kind === 'feature' && (
            <>
              <Field label="Module" required>
                <select className={inputCls} value={form.module_id || ''} onChange={(e) => set('module_id', e.target.value)} required>
                  <option value="">Select module...</option>
                  {apps.flatMap((a) => a.modules.map((m) => (
                    <option key={m.id} value={m.id}>{a.display_name} › {m.display_name} · {m.module_key}</option>
                  )))}
                </select>
              </Field>
              <Field label="feature_key" required hint="e.g. 'angelo.home.mount_handoff'"><input className={inputCls} value={form.feature_key || ''} onChange={(e) => set('feature_key', e.target.value)} required /></Field>
              <Field label="Display name" required><input className={inputCls} value={form.display_name || ''} onChange={(e) => set('display_name', e.target.value)} required /></Field>
              <Field label="description"><textarea className={inputCls} rows={3} value={form.description || ''} onChange={(e) => set('description', e.target.value)} /></Field>
              <Field label="Status"><select className={inputCls} value={form.status || 'PLANNED'} onChange={(e) => set('status', e.target.value)}>
                <option value="PLANNED">PLANNED</option><option value="IN_PROGRESS">IN_PROGRESS</option><option value="LIVE">LIVE</option><option value="DEPRECATED">DEPRECATED</option>
              </select></Field>
              <Field label="entry_point"><select className={inputCls} value={form.entry_point || ''} onChange={(e) => set('entry_point', e.target.value)}>
                <option value="">—</option><option value="A1">A1</option><option value="A2">A2</option><option value="A3">A3</option><option value="A4">A4</option><option value="A5">A5</option>
              </select></Field>
              <Field label="rinoa_path"><input className={inputCls} value={form.rinoa_path || ''} onChange={(e) => set('rinoa_path', e.target.value)} /></Field>
            </>
          )}

          <div className="flex gap-2 pt-4">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-[8px] text-[13px] font-semibold text-[var(--text2)] border border-[var(--border)]">Cancel</button>
            <button type="submit" className="flex-1 py-2.5 rounded-[8px] text-[13px] font-semibold text-white bg-[var(--accent)]">{isEdit ? 'Save' : 'Create'}</button>
          </div>
        </form>
      </div>
    </>
  );
}

const inputCls = 'w-full px-3 py-2 rounded-[8px] bg-[var(--card)] border border-[var(--border)] text-[13px] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]';

function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold text-[var(--text2)] block mb-1">
        {label}{required && <span className="text-[var(--red)] ml-0.5">*</span>}
      </span>
      {children}
      {hint && <span className="text-[10px] text-[var(--text3)] block mt-1">{hint}</span>}
    </label>
  );
}

function ConfirmDialog({ title, message, onCancel, onConfirm }: { title: string; message: string; onCancel: () => void; onConfirm: () => void }) {
  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-50" onClick={onCancel} />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[min(400px,90vw)] bg-[var(--surface)] border border-[var(--border)] rounded-[14px] p-5">
        <h3 className="text-[15px] font-bold mb-2">{title}</h3>
        <p className="text-[13px] text-[var(--text2)] mb-4">{message}</p>
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-[8px] text-[13px] font-semibold text-[var(--text2)] border border-[var(--border)]">Cancel</button>
          <button onClick={onConfirm} className="flex-1 py-2.5 rounded-[8px] text-[13px] font-semibold text-white bg-[var(--red)]">Delete</button>
        </div>
      </div>
    </>
  );
}
