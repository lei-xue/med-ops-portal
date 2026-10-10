"use client";

import "./globals.css";

/**
 * Last-resort boundary for errors thrown by the root layout itself (e.g. the
 * session lookup), which app/error.tsx can't catch. It replaces the layout,
 * so it renders its own <html> and <body>.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="grid min-h-screen place-items-center bg-canvas p-6 text-slate-900">
        <div className="max-w-md rounded-lg border border-slate-200 bg-white p-8 text-center shadow-card">
          <h1 className="font-semibold">MedOps is temporarily unavailable</h1>
          <p className="mt-1 text-sm text-slate-500">
            The app hit an unexpected error while loading. No data was changed.
          </p>
          {error.digest && (
            <p className="mt-2 font-mono text-xs text-slate-500">
              Reference: {error.digest}
            </p>
          )}
          <button
            type="button"
            onClick={reset}
            className="mt-5 rounded-md bg-brand-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
