"use client";

import { useSyncExternalStore } from "react";

// Cloudflare rewrites email addresses in server HTML, which desynchronises
// hydration (React #418). Render the contact link only in the browser, so the
// address never appears in the server-rendered markup.
const EMAIL = "hi@leixue.dev";
const subscribe = () => () => {};

export default function ContactEmail({ className }: { className: string }) {
  const inBrowser = useSyncExternalStore(subscribe, () => true, () => false);
  if (!inBrowser) return null;

  return (
    <a href={`mailto:${EMAIL}`} className={className}>
      {EMAIL}
    </a>
  );
}
