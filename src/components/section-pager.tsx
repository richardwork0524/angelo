'use client';

import { useEffect, useRef, useState, useCallback, type ReactNode } from 'react';

export interface Section {
  key: string;
  label: string;
  content: ReactNode;
  badge?: string | number | null;
}

interface Props {
  sections: Section[];
  initialIndex?: number;
  onIndexChange?: (i: number) => void;
  className?: string;
  sticky?: boolean;
}

/**
 * Horizontal swipe pager for mobile. Each section is a full-width page.
 * Touch drag + click tabs + dot indicators. No external library.
 * On desktop (>= 768px) sections render as tabs with vertical content
 * to match existing panel-style UX.
 */
export function SectionPager({ sections, initialIndex = 0, onIndexChange, className = '', sticky = true }: Props) {
  const [index, setIndex] = useState(Math.min(initialIndex, sections.length - 1));
  const trackRef = useRef<HTMLDivElement>(null);
  const dragStartX = useRef<number | null>(null);
  const dragStartY = useRef<number | null>(null);
  const dragDX = useRef(0);
  const draggingRef = useRef(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [animating, setAnimating] = useState(false);

  const goTo = useCallback((i: number) => {
    const clamped = Math.max(0, Math.min(sections.length - 1, i));
    setIndex(clamped);
    setAnimating(true);
    setDragOffset(0);
    onIndexChange?.(clamped);
  }, [sections.length, onIndexChange]);

  useEffect(() => {
    if (!animating) return;
    const t = setTimeout(() => setAnimating(false), 260);
    return () => clearTimeout(t);
  }, [animating]);

  const onTouchStart = (e: React.TouchEvent) => {
    if (sections.length <= 1) return;
    dragStartX.current = e.touches[0].clientX;
    dragStartY.current = e.touches[0].clientY;
    dragDX.current = 0;
    draggingRef.current = false;
    setAnimating(false);
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (dragStartX.current === null || dragStartY.current === null) return;
    const dx = e.touches[0].clientX - dragStartX.current;
    const dy = e.touches[0].clientY - dragStartY.current;
    if (!draggingRef.current) {
      if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.2) {
        draggingRef.current = true;
      } else if (Math.abs(dy) > 10) {
        dragStartX.current = null;
        return;
      } else {
        return;
      }
    }
    dragDX.current = dx;
    setDragOffset(dx);
  };
  const onTouchEnd = () => {
    if (dragStartX.current === null) return;
    const width = trackRef.current?.clientWidth ?? 300;
    const threshold = Math.max(48, width * 0.22);
    if (dragDX.current < -threshold && index < sections.length - 1) {
      goTo(index + 1);
    } else if (dragDX.current > threshold && index > 0) {
      goTo(index - 1);
    } else {
      setAnimating(true);
      setDragOffset(0);
    }
    dragStartX.current = null;
    dragStartY.current = null;
    dragDX.current = 0;
    draggingRef.current = false;
  };

  // Arrow keys for keyboard users
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target && (e.target as HTMLElement).closest('input, textarea, [contenteditable]')) return;
      if (e.key === 'ArrowRight' && index < sections.length - 1) goTo(index + 1);
      if (e.key === 'ArrowLeft' && index > 0) goTo(index - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, sections.length, goTo]);

  const slidePct = 100 / sections.length;
  const translateX = `calc(${-index * slidePct}% + ${dragOffset}px)`;

  return (
    <div className={`flex flex-col min-h-0 flex-1 ${className}`}>
      {/* Tab strip */}
      <div
        className="shrink-0 flex items-center gap-1 px-3 pt-2 pb-2 overflow-x-auto no-scrollbar"
        style={{
          background: sticky ? 'var(--surface)' : 'transparent',
          borderBottom: sticky ? '1px solid var(--border)' : undefined,
          position: sticky ? 'sticky' : undefined,
          top: 0,
          zIndex: 10,
        }}
        role="tablist"
      >
        {sections.map((s, i) => {
          const active = i === index;
          return (
            <button
              key={s.key}
              role="tab"
              aria-selected={active}
              onClick={() => goTo(i)}
              className="shrink-0 transition-colors"
              style={{
                padding: '6px 12px',
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: '.02em',
                background: active ? 'var(--primary)' : 'var(--card)',
                color: active ? '#fff' : 'var(--text3)',
                border: `1px solid ${active ? 'var(--primary)' : 'var(--border)'}`,
                whiteSpace: 'nowrap',
              }}
            >
              {s.label}
              {s.badge !== undefined && s.badge !== null && s.badge !== '' && (
                <span
                  style={{
                    marginLeft: 6,
                    padding: '0 6px',
                    fontSize: 10,
                    borderRadius: 999,
                    background: active ? 'rgba(255,255,255,.22)' : 'var(--card-alt)',
                    color: active ? '#fff' : 'var(--text3)',
                    fontWeight: 700,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {s.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Track */}
      <div
        ref={trackRef}
        className="flex-1 min-h-0 overflow-hidden relative"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
      >
        <div
          className="flex h-full"
          style={{
            transform: `translateX(${translateX})`,
            transition: animating ? 'transform 240ms cubic-bezier(.22,.61,.36,1)' : 'none',
            width: `${sections.length * 100}%`,
          }}
        >
          {sections.map((s, i) => (
            <div
              key={s.key}
              role="tabpanel"
              aria-hidden={i !== index}
              className="flex-shrink-0 h-full overflow-y-auto"
              style={{
                width: `${100 / sections.length}%`,
                overscrollBehavior: 'contain',
                WebkitOverflowScrolling: 'touch',
              }}
            >
              {s.content}
            </div>
          ))}
        </div>
      </div>

      {/* Dots */}
      {sections.length > 1 && (
        <div className="shrink-0 flex items-center justify-center gap-1.5 py-2" style={{ background: 'var(--surface)' }}>
          {sections.map((s, i) => (
            <button
              key={s.key}
              aria-label={`Go to ${s.label}`}
              onClick={() => goTo(i)}
              className="transition-all"
              style={{
                width: i === index ? 18 : 6,
                height: 6,
                borderRadius: 999,
                background: i === index ? 'var(--primary)' : 'var(--border-hi)',
                border: 'none',
                padding: 0,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
