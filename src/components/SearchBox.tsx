import { Search } from "lucide-react";

import { btnSecondary, fieldSm } from "@/components/ui";

/** GET form that puts `q` in the URL, so searches are linkable. */
export function SearchBox({
  action,
  q,
  placeholder,
  hidden = {},
}: {
  action: string;
  q: string;
  placeholder: string;
  hidden?: Record<string, string | undefined>;
}) {
  return (
    <form action={action} className="relative flex w-full gap-2 sm:w-auto">
      {Object.entries(hidden).map(([name, value]) =>
        value ? <input key={name} type="hidden" name={name} value={value} /> : null,
      )}
      <Search
        aria-hidden
        className="pointer-events-none absolute top-2.5 left-3 size-4 text-slate-400"
      />
      <input
        type="search"
        name="q"
        defaultValue={q}
        aria-label={placeholder}
        placeholder={placeholder}
        className={`${fieldSm} w-full pl-9 sm:w-80`}
      />
      <button type="submit" className={btnSecondary}>
        Search
      </button>
    </form>
  );
}
