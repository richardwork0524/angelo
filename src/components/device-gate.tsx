'use client';

import { useEffect, useRef, useState } from 'react';

const STORAGE_KEY = 'angelo_device_trusted';
const TRUST_TOKEN = '1';
const CORRECT_PASSWORD = '1262';

export function DeviceGate({ children }: { children: React.ReactNode }) {
  // null = still checking, true = trusted, false = show gate
  const [checked, setChecked] = useState<null | boolean>(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Check localStorage only after mount (SSR-safe)
  useEffect(() => {
    try {
      const trusted = localStorage.getItem(STORAGE_KEY) === TRUST_TOKEN;
      setChecked(trusted);
    } catch {
      // localStorage unavailable (private mode, SSR guard)
      setChecked(false);
    }
  }, []);

  // Focus input when gate appears
  useEffect(() => {
    if (checked === false) {
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [checked]);

  function handleUnlock() {
    if (password === CORRECT_PASSWORD) {
      try {
        localStorage.setItem(STORAGE_KEY, TRUST_TOKEN);
      } catch {
        // ignore — gate will re-prompt next visit, acceptable fallback
      }
      setChecked(true);
    } else {
      setError(true);
      setPassword('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  // Loading — blank slate, don't flash gate for trusted users
  if (checked === null) {
    return (
      <div
        style={{
          height: '100dvh',
          background: 'var(--bg, #0a0a0a)',
        }}
      />
    );
  }

  // Trusted — render app normally
  if (checked === true) {
    return <>{children}</>;
  }

  // Gate
  return (
    <div
      className="flex items-center justify-center"
      style={{
        height: '100dvh',
        background: 'var(--bg, #0a0a0a)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 360,
          margin: '0 20px',
          background: 'var(--card, #1c1c1e)',
          border: '1px solid var(--border, rgba(255,255,255,0.1))',
          borderRadius: 'var(--r-lg, 12px)',
          boxShadow: 'var(--sh-lg, 0 8px 40px rgba(0,0,0,0.5))',
          padding: '28px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
        }}
      >
        {/* Header */}
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              fontSize: 28,
              fontWeight: 700,
              color: 'var(--text, #f2f2f7)',
              letterSpacing: '-0.02em',
              marginBottom: 6,
            }}
          >
            Angelo
          </div>
          <div
            style={{
              fontSize: 'var(--t-sm, 13px)',
              color: 'var(--text3, rgba(255,255,255,0.4))',
            }}
          >
            Enter device password to continue
          </div>
        </div>

        {/* Password input */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input
            ref={inputRef}
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (error) setError(false);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleUnlock();
            }}
            placeholder="Password"
            autoComplete="current-password"
            style={{
              width: '100%',
              padding: '11px 14px',
              background: 'var(--bg, #0a0a0a)',
              border: `1px solid ${error ? 'var(--danger, #ff453a)' : 'var(--border, rgba(255,255,255,0.1))'}`,
              borderRadius: 'var(--r-sm, 8px)',
              fontSize: 'var(--t-base, 15px)',
              color: 'var(--text, #f2f2f7)',
              outline: 'none',
              boxSizing: 'border-box',
              transition: 'border-color 0.15s',
            }}
          />
          {error && (
            <div
              style={{
                fontSize: 'var(--t-tiny, 11px)',
                color: 'var(--danger, #ff453a)',
                textAlign: 'center',
              }}
            >
              Incorrect password
            </div>
          )}
        </div>

        {/* Unlock button */}
        <button
          onClick={handleUnlock}
          style={{
            width: '100%',
            padding: '12px 16px',
            background: 'var(--primary, #0a84ff)',
            border: '1px solid var(--primary, #0a84ff)',
            borderRadius: 'var(--r-sm, 8px)',
            color: '#fff',
            fontSize: 'var(--t-sm, 13px)',
            fontWeight: 600,
            cursor: 'pointer',
            letterSpacing: '0.01em',
          }}
        >
          Unlock
        </button>
      </div>
    </div>
  );
}
