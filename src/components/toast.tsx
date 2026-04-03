"use client";

import { useEffect } from "react";

interface ToastProps {
  message: string;
  type?: "error" | "success";
  onDismiss: () => void;
  persistent?: boolean;
}

export function Toast({ message, type = "error", onDismiss, persistent }: ToastProps) {
  useEffect(() => {
    if (!persistent) {
      const timer = setTimeout(onDismiss, 5000);
      return () => clearTimeout(timer);
    }
  }, [onDismiss, persistent]);

  const bgColor = type === "error" ? "bg-[var(--red)]" : "bg-[var(--green)]";

  return (
    <div className={`fixed top-4 right-4 z-50 ${bgColor} text-white px-4 py-3 rounded-[var(--r)] shadow-lg flex items-center gap-3 max-w-sm`}>
      <p className="text-[13px] flex-1">{message}</p>
      <button onClick={onDismiss} className="text-white/70 hover:text-white text-lg leading-none">&times;</button>
    </div>
  );
}
