"use client";

interface ErrorBannerProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorBanner({ message, onRetry }: ErrorBannerProps) {
  return (
    <div className="mx-4 mt-3 px-4 py-3 rounded-[var(--r)] bg-[var(--red-dim)] border border-[var(--red)]/30 flex items-center justify-between gap-3">
      <p className="text-[13px] text-[var(--red)]">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="text-[13px] font-semibold text-[var(--red)] hover:opacity-80 shrink-0"
        >
          Retry
        </button>
      )}
    </div>
  );
}
