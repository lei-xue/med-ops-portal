import { card } from "@/components/ui";

/** Skeleton shown while a page's server data loads. */
export default function Loading() {
  return (
    <div aria-busy="true" aria-live="polite" className="animate-pulse">
      <span className="sr-only">Loading…</span>
      <div className="mb-6 space-y-2">
        <div className="h-3 w-40 rounded bg-slate-200" />
        <div className="h-7 w-72 rounded bg-slate-200" />
      </div>
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={`${card} h-28`} />
        ))}
      </div>
      <div className={`${card} mt-6 h-72`} />
    </div>
  );
}
