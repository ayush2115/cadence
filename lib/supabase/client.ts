import { createBrowserClient } from "@supabase/ssr";

/** Browser Supabase client (uses the public anon key + the user's session cookie). */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

/** True when the public Supabase env is present. Lets the app run in demo mode
 *  (no auth/persistence) when it isn't configured. */
export const supabaseConfigured =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
  !process.env.NEXT_PUBLIC_SUPABASE_URL.includes("placeholder");
