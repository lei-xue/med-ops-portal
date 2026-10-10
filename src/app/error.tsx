"use client";

import { TriangleAlert } from "lucide-react";
import { useEffect } from "react";

import { btnPrimary, card } from "@/components/ui";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className={`${card} mx-auto mt-10 max-w-md px-6 py-10 text-center`}>
      <span className="mx-auto grid size-10 place-items-center rounded-full bg-red-50 text-red-600">
        <TriangleAlert aria-hidden className="size-5" />
      </span>
      <h1 className="mt-3 font-semibold">This page couldn&apos;t be loaded</h1>
      <p className="mt-1 text-sm text-slate-500">
        Something went wrong on our side, possibly a database hiccup. Your
        data was not changed.
      </p>
      {error.digest && (
        <p className="mt-2 font-mono text-xs text-slate-500">
          Reference: {error.digest}
        </p>
      )}
      <button type="button" onClick={reset} className={`${btnPrimary} mt-5`}>
        Try again
      </button>
    </div>
  );
}
