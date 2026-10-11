import { LogOut } from "lucide-react";

/**
 * A plain form post rather than a client handler, so signing out works even
 * before the page's JavaScript has loaded. The route redirects to /login.
 */
export default function LogoutButton() {
  return (
    <form method="post" action="/api/auth/logout" className="contents">
      <button
        type="submit"
        title="Sign out"
        aria-label="Sign out"
        className="grid size-8 place-items-center rounded-md text-slate-400 transition-colors hover:bg-nav-700 hover:text-white"
      >
        <LogOut aria-hidden className="size-4" />
      </button>
    </form>
  );
}
