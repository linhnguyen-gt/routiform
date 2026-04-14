"use client";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ApiManagerErrorBannerProps {
  error: string | null;
  onDismiss: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/** Dismissible error banner shown at the top of the API Manager page. */
export function ApiManagerErrorBanner({ error, onDismiss }: ApiManagerErrorBannerProps) {
  if (!error) return null;

  return (
    <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
      <span className="material-symbols-outlined text-red-500">error</span>
      <p className="text-sm text-red-700 dark:text-red-300 flex-1">{error}</p>
      <button onClick={onDismiss} className="text-red-500 hover:text-red-700 transition-colors">
        <span className="material-symbols-outlined">close</span>
      </button>
    </div>
  );
}
