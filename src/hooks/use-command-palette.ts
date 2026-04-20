'use client';

import { useEffect, useState, useCallback } from 'react';

// Module-level singleton so all consumers share one open/close state
// without a context provider. Uses a simple event-bus pattern.
type Listener = (open: boolean) => void;
const listeners = new Set<Listener>();
let _open = false;

function notify(next: boolean) {
  _open = next;
  listeners.forEach((fn) => fn(next));
}

export function useCommandPalette() {
  const [open, setOpen] = useState(_open);

  useEffect(() => {
    const fn: Listener = (v) => setOpen(v);
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  }, []);

  const openPalette = useCallback(() => notify(true), []);
  const closePalette = useCallback(() => notify(false), []);
  const togglePalette = useCallback(() => notify(!_open), []);

  // Global ⌘K / Ctrl+K listener — registered once per mount
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const isMac = navigator.platform.toUpperCase().includes('MAC');
      const triggered = isMac
        ? e.metaKey && e.key === 'k'
        : e.ctrlKey && e.key === 'k';

      if (!triggered) return;

      // Guard: don't open when typing in text inputs
      const tag = (e.target as HTMLElement)?.tagName;
      const isEditable = (e.target as HTMLElement)?.isContentEditable;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || isEditable) return;

      e.preventDefault(); // Prevent browser default (Chrome bookmarks etc.)
      notify(!_open);
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return { open, openPalette, closePalette, togglePalette };
}
