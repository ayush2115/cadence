/** Resolves a user-supplied `next` param to a same-origin path, or "/plan".
 *  Guards the auth callback against open redirects such as "@evil.com"
 *  (`${origin}@evil.com` makes evil.com the host) or "//evil.com". */
export function safeNextPath(next: string | null, origin: string): string {
  if (!next) return "/plan";
  try {
    const url = new URL(next, origin);
    if (url.origin === origin) return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    // unparseable — fall through to the default
  }
  return "/plan";
}
