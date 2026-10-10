// Shared class strings so every page draws buttons, fields and cards the
// same way.

const btnBase =
  "inline-flex items-center justify-center gap-1.5 rounded-md font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:pointer-events-none disabled:opacity-50";

export const btnPrimary = `${btnBase} h-9 bg-brand-600 px-3.5 text-sm text-white shadow-card hover:bg-brand-700`;

export const btnPrimarySm = `${btnBase} h-8 bg-brand-600 px-3 text-xs text-white hover:bg-brand-700`;

export const btnSecondary = `${btnBase} h-9 border border-slate-300 bg-white px-3.5 text-sm text-slate-700 shadow-card hover:bg-slate-50`;

export const btnSecondarySm = `${btnBase} h-8 border border-slate-300 bg-white px-3 text-xs text-slate-700 hover:bg-slate-50`;

/** Low-emphasis destructive action, e.g. cancelling an order. */
export const btnGhostDanger = `${btnBase} h-8 px-2.5 text-xs text-slate-500 hover:bg-red-50 hover:text-red-700`;

const fieldBase =
  "rounded-md border border-slate-300 bg-white text-sm text-slate-900 shadow-card placeholder:text-slate-400 focus:border-brand-500 focus:ring-3 focus:ring-brand-100 focus:outline-none";

/** Full-width form field. */
export const field = `${fieldBase} h-10 w-full px-3`;

/** Compact field for toolbars and inline edits; set the width yourself. */
export const fieldSm = `${fieldBase} h-9 px-3`;

export const card = "rounded-lg border border-slate-200 bg-white shadow-card";

export const cardHeader =
  "flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-3.5";

export const th =
  "px-4 py-2.5 text-xs font-medium whitespace-nowrap text-slate-500";

export const td = "px-4 py-3";
