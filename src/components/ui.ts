// Shared class strings so every page draws buttons, fields and panels the
// same way. Square corners throughout — the UI borrows from printed labels.

export const btnPrimary =
  "focus-ink inline-flex items-center justify-center gap-1.5 bg-ink px-3 py-1.5 text-sm font-semibold text-on-ink transition-opacity hover:opacity-85 disabled:opacity-40";

export const btnPrimarySm =
  "focus-ink inline-flex min-w-20 items-center justify-center gap-1.5 bg-ink px-2.5 py-1 text-xs font-semibold text-on-ink transition-opacity hover:opacity-85 disabled:opacity-40";

export const btnSecondary =
  "focus-ink inline-flex items-center justify-center gap-1.5 border border-rule bg-card px-3 py-1.5 text-sm font-medium text-ink hover:border-ink disabled:opacity-40";

export const btnSecondarySm =
  "focus-ink inline-flex items-center justify-center border border-rule bg-card px-2.5 py-1.5 text-xs font-semibold text-ink hover:border-ink disabled:opacity-40";

export const btnQuiet =
  "focus-ink inline-flex items-center px-1 py-1 text-xs font-medium text-ink-3 underline decoration-rule underline-offset-4 hover:text-ink hover:decoration-ink disabled:opacity-40";

const fieldBase =
  "focus-ink border border-rule bg-card text-sm text-ink placeholder:text-ink-3 focus:border-ink";

/** Full-width form field. */
export const field = `${fieldBase} w-full px-3 py-2`;

/** Compact field for toolbars and inline edits; set the width yourself. */
export const fieldSm = `${fieldBase} px-2.5 py-1.5`;

export const panel = "border border-rule bg-card";

export const th = "label-mono px-4 py-2.5 font-medium whitespace-nowrap text-ink-3";

export const td = "px-4 py-3";
