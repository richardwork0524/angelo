'use client';

import { useEffect, useRef } from 'react';

// Parses a key descriptor like "Enter+meta", "e", " ", "r", "j"
// into a matcher function.
function makesMatcher(descriptor: string): (e: KeyboardEvent) => boolean {
  const parts = descriptor.toLowerCase().split('+');
  const key = parts.find((p) => !['meta', 'ctrl', 'shift', 'alt'].includes(p));
  const needsMeta = parts.includes('meta');
  const needsCtrl = parts.includes('ctrl');
  const needsShift = parts.includes('shift');
  const needsAlt = parts.includes('alt');

  return (e: KeyboardEvent) => {
    // Normalize: space bar
    const eKey = e.key === ' ' ? ' ' : e.key.toLowerCase();
    if (key && eKey !== key) return false;
    if (needsMeta && !e.metaKey) return false;
    if (needsCtrl && !e.ctrlKey) return false;
    if (needsShift && !e.shiftKey) return false;
    if (needsAlt && !e.altKey) return false;
    return true;
  };
}

type HotkeyMap = Record<string, (e: KeyboardEvent) => void>;

interface UseHotkeysOptions {
  /** Disable all hotkeys (e.g. when palette is open, or on mobile) */
  enabled?: boolean;
  /** Additional element to attach listener to (defaults to window) */
  target?: EventTarget | null;
}

/**
 * Register per-component keyboard shortcuts.
 * Guards applied automatically:
 *  - Skips when focus is in INPUT / TEXTAREA / contenteditable
 *  - Skips on mobile (< 1024px viewport width)
 *  - Respects the `enabled` option (e.g. disable when command palette open)
 */
export function useHotkeys(
  keyMap: HotkeyMap,
  deps: React.DependencyList = [],
  options: UseHotkeysOptions = {}
): void {
  const { enabled = true, target } = options;
  // Store keyMap in a ref so we can update it without re-attaching the listener
  const mapRef = useRef(keyMap);
  useEffect(() => { mapRef.current = keyMap; }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!enabled) return;

    const el = target ?? window;

    function onKeyDown(e: KeyboardEvent) {
      // Guard: mobile
      if (typeof window !== 'undefined' && window.innerWidth < 1024) return;

      // Guard: focus in text input
      const tag = (e.target as HTMLElement)?.tagName;
      const isEditable = (e.target as HTMLElement)?.isContentEditable;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || isEditable) return;

      for (const [descriptor, handler] of Object.entries(mapRef.current)) {
        if (makesMatcher(descriptor)(e)) {
          handler(e);
          break;
        }
      }
    }

    el.addEventListener('keydown', onKeyDown as EventListener);
    return () => el.removeEventListener('keydown', onKeyDown as EventListener);
  }, [enabled, target]); // eslint-disable-line react-hooks/exhaustive-deps
}
