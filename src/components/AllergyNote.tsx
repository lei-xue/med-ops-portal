import { TriangleAlert } from "lucide-react";

/** Allergies shown loudly; "not recorded" is not the same as "none". */
export function AllergyNote({ allergies }: { allergies: string | null }) {
  if (!allergies) {
    return <span className="text-slate-500">None recorded</span>;
  }
  return (
    <span className="inline-flex items-center gap-1.5 font-medium text-red-700">
      <TriangleAlert aria-hidden className="size-3.5" />
      {allergies}
    </span>
  );
}
