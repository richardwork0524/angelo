"use client";

import { useEffect, useState } from "react";

interface ToastProps {
  message: string;
  type?: "error" | "success" | "info";
  onDismiss: () => void;
  persistent?: boolean;
  duration?: number;
}

export function Toast({ message, type = "success", onDismiss, persistent, duration = 2500 }: ToastProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (!persistent) {
      const fadeTimer = setTimeout(() => setVisible(false), duration);
      const removeTimer = setTimeout(onDismiss, duration + 300);
      return () => { clearTimeout(fadeTimer); clearTimeout(removeTimer); };
    }
  }, [onDismiss, persistent, duration]);

  const bgColor = type === "error" ? "bg-[var(--red)]" : type === "info" ? "bg-[var(--card)]" : "bg-[#1c1c1e]";
  const borderColor = type === "error" ? "border-[var(--red)]" : type === "info" ? "border-[var(--border2)]" : "border-[var(--green)]";

  return (
    <div
      className={`fixed top-4 right-4 z-[100] ${bgColor} border ${borderColor} text-white px-4 py-2.5 rounded-[12px] shadow-lg flex items-center gap-2.5 max-w-sm transition-all duration-300 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"
      }`}
    >
      {type === "success" && (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="7" stroke="var(--green)" strokeWidth="1.5" />
          <path d="M5 8L7 10L11 6" stroke="var(--green)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      {type === "error" && (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="7" stroke="white" strokeWidth="1.5" opacity="0.7" />
          <path d="M6 6L10 10M10 6L6 10" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      )}
      <p className="text-[13px] flex-1">{message}</p>
      {persistent && (
        <button onClick={onDismiss} className="text-white/70 hover:text-white text-lg leading-none">&times;</button>
      )}
    </div>
  );
}

/* ── Toast Manager for queued toasts ── */

interface ToastItem {
  id: number;
  message: string;
  type: "error" | "success" | "info";
}

let toastId = 0;

export function useToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  function showToast(message: string, type: "error" | "success" | "info" = "success") {
    const id = ++toastId;
    setToasts((prev) => [...prev.slice(-2), { id, message, type }]); // Keep max 3
  }

  function dismiss(id: number) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  function ToastContainer() {
    return (
      <>
        {toasts.map((t, i) => (
          <div key={t.id} style={{ position: "fixed", top: `${16 + i * 52}px`, right: "16px", zIndex: 100 }}>
            <Toast message={t.message} type={t.type} onDismiss={() => dismiss(t.id)} />
          </div>
        ))}
      </>
    );
  }

  return { showToast, ToastContainer };
}
