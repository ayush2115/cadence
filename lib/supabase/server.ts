import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/** Server Supabase client for Server Components and Route Handlers. Reads/writes
 *  the session via Next's cookie store. */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // called from a Server Component render — safe to ignore; the
            // middleware refreshes the session cookie.
          }
        },
      },
    }
  );
}

/** The signed-in user's id, or null for guests. Fails closed: returns null when
 *  Supabase isn't configured (demo mode) or the session can't be verified, so
 *  callers gating paid APIs never open up because of missing config. Uses
 *  getUser() (verified against Supabase Auth), not getSession() (cookie only). */
export async function getSignedInUserId(): Promise<string | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || url.includes("placeholder")) return null;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    if (error) return null;
    return data.user?.id ?? null;
  } catch {
    return null;
  }
}
