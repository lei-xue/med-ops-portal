const PLACEHOLDER_ORIGIN = "http://placeholder.invalid";

/**
 * Turn a user-supplied `callbackUrl` into a same-origin path, or "/".
 *
 * `startsWith("/")` alone is not enough: `//evil.com` and `/\evil.com` are
 * protocol-relative, and the URL parser strips tabs/newlines, so "/\t/evil.com"
 * becomes "//evil.com". Resolving against a fixed origin and comparing the
 * result catches all of these.
 */
export function safeCallbackPath(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith("/")) return "/";
  try {
    const url = new URL(raw, PLACEHOLDER_ORIGIN);
    if (url.origin !== PLACEHOLDER_ORIGIN) return "/";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}
