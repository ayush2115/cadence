"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient, supabaseConfigured } from "@/lib/supabase/client";

/** Header auth state: the user's email + a sign-out button when logged in, a
 *  "Sign in" link otherwise. Auth-configured check is in the initial state, so
 *  there's no setState-in-effect and no hydration mismatch. */
export function UserMenu() {
  const [email, setEmail] = useState<string | null | undefined>(
    supabaseConfigured ? undefined : null
  );

  useEffect(() => {
    if (!supabaseConfigured) return;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) =>
      setEmail(session?.user?.email ?? null)
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await createClient().auth.signOut();
    window.location.href = "/";
  };

  const linkCls =
    "rounded-lg px-2.5 py-2 text-[13px] font-medium text-muted transition-colors duration-150 hover:text-text";

  if (email === undefined) return <div className="h-9 w-14" aria-hidden />;
  if (!email)
    return (
      <Link href="/login" className={linkCls}>
        Sign in
      </Link>
    );

  return (
    <div className="flex items-center gap-1.5">
      <span className="hidden max-w-[150px] truncate text-[13px] text-muted sm:inline">
        {email}
      </span>
      <button onClick={signOut} className={`${linkCls} hover:bg-surface-2`}>
        Sign out
      </button>
    </div>
  );
}
