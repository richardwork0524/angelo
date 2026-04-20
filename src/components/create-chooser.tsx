'use client';

import { useEffect, useState } from 'react';

/**
 * Small bottom-sheet chooser that lets the user pick between adding a Note or
 * a Task when they tap the center FAB in the bottom nav.
 *
 * Listens for the `create-chooser` window event (fired by BottomNav) and on
 * pick, dispatches either `quick-note` (handled by NoteModal) or `quick-task`
 * (handled by AppShell → QuickTaskModal).
 */
export function CreateChooser() {
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function onOpen() {
      setOpen(true);
      requestAnimationFrame(() => setVisible(true));
    }
    window.addEventListener('create-chooser', onOpen);
    return () => window.removeEventListener('create-chooser', onOpen);
  }, []);

  function close() {
    setVisible(false);
    setTimeout(() => setOpen(false), 180);
  }

  function pick(kind: 'note' | 'task') {
    close();
    setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent(kind === 'note' ? 'quick-note' : 'quick-task', { detail: {} })
      );
    }, 190);
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={close}
      style={{
        position: 'fixed',
        inset: 0,
        background: visible ? 'rgba(0,0,0,0.42)' : 'rgba(0,0,0,0)',
        backdropFilter: visible ? 'blur(2px)' : 'blur(0)',
        WebkitBackdropFilter: visible ? 'blur(2px)' : 'blur(0)',
        zIndex: 1200,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        transition: 'background 180ms, backdrop-filter 180ms',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 440,
          background: 'var(--surface)',
          borderTopLeftRadius: 18,
          borderTopRightRadius: 18,
          boxShadow: '0 -12px 40px rgba(0,0,0,.25)',
          paddingBottom: 'calc(20px + env(safe-area-inset-bottom))',
          transform: visible ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 200ms cubic-bezier(.25,.8,.4,1)',
        }}
      >
        <div
          style={{
            height: 4,
            width: 38,
            borderRadius: 2,
            background: 'var(--border-hi)',
            margin: '10px auto 8px',
          }}
        />
        <div
          style={{
            padding: '6px 20px 10px',
            fontSize: 'var(--t-tiny)',
            color: 'var(--text3)',
            textTransform: 'uppercase',
            letterSpacing: '.08em',
            fontWeight: 600,
          }}
        >
          Quick capture
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '4px 16px 16px' }}>
          <ChoiceButton
            icon="✎"
            iconBg="var(--primary-dim)"
            iconColor="var(--primary-2)"
            title="New note"
            subtitle="Capture an idea, gap, or observation"
            onClick={() => pick('note')}
          />
          <ChoiceButton
            icon="✓"
            iconBg="var(--green-dim)"
            iconColor="var(--green)"
            title="New task"
            subtitle="Something you (or Claude) need to do"
            onClick={() => pick('task')}
          />
        </div>
      </div>
    </div>
  );
}

function ChoiceButton({
  icon,
  iconBg,
  iconColor,
  title,
  subtitle,
  onClick,
}: {
  icon: string;
  iconBg: string;
  iconColor: string;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="active:scale-[0.99] transition-transform"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        width: '100%',
        padding: '14px 14px',
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r)',
        textAlign: 'left',
        cursor: 'pointer',
      }}
    >
      <span
        style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          background: iconBg,
          color: iconColor,
          fontSize: 18,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          fontWeight: 700,
        }}
      >
        {icon}
      </span>
      <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <span style={{ fontSize: 'var(--t-body)', fontWeight: 600, color: 'var(--text)' }}>
          {title}
        </span>
        <span style={{ fontSize: 'var(--t-tiny)', color: 'var(--text3)', marginTop: 2 }}>
          {subtitle}
        </span>
      </span>
    </button>
  );
}
