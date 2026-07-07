"use client";

import { useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui";
import { ThemeToggle } from "@/components/ThemeToggle";
import { createClient, supabaseConfigured } from "@/lib/supabase/client";

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden>
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.47.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}

export default function LoginPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const inputCls =
    "h-10 w-full rounded-lg border border-border bg-bg px-3 text-sm text-text outline-none " +
    "transition-colors duration-150 placeholder:text-subtle focus:border-accent";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabaseConfigured) {
      setNote("Auth isn't configured in this build. You can still try the planner.");
      return;
    }
    setPending(true);
    setNote(null);
    const supabase = createClient();

    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setPending(false);
      if (error) return setNote(error.message);
      window.location.href = "/plan";
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${location.origin}/auth/callback` },
    });
    setPending(false);
    if (error) return setNote(error.message);
    if (data.session) {
      window.location.href = "/plan";
      return;
    }
    setNote("Check your email to confirm your account, then sign in.");
  }

  async function signInWithGoogle() {
    if (!supabaseConfigured) {
      setNote("Google sign-in isn't configured in this build.");
      return;
    }
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${location.origin}/auth/callback` },
    });
  }

  return (
    <div className="flex min-h-full flex-col">
      <header className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-5">
        <Logo />
        <ThemeToggle />
      </header>

      <main className="flex flex-1 items-center justify-center px-5 py-10">
        <div className="w-full max-w-[380px]">
          <h1 className="text-center text-xl font-semibold tracking-tight text-text">
            {mode === "signin" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="mt-1.5 text-center text-[13px] text-muted">
            {mode === "signin"
              ? "Sign in to save and sync your plans."
              : "Save your plans and pick up where you left off."}
          </p>

          <div className="mt-7 rounded-2xl border border-border bg-surface p-6 shadow-[var(--shadow-sm)]">
            <div className="mb-5 grid grid-cols-2 gap-1 rounded-lg bg-surface-2 p-1">
              {(["signin", "signup"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => {
                    setMode(m);
                    setNote(null);
                  }}
                  className={`h-8 rounded-md text-[13px] font-medium transition-colors duration-150 [transition-timing-function:var(--ease-out)] ${
                    mode === m
                      ? "bg-surface text-text shadow-[var(--shadow-sm)]"
                      : "text-muted hover:text-text"
                  }`}
                >
                  {m === "signin" ? "Sign in" : "Create account"}
                </button>
              ))}
            </div>

            <Button
              variant="secondary"
              className="w-full"
              type="button"
              onClick={signInWithGoogle}
            >
              <GoogleIcon />
              Continue with Google
            </Button>

            <div className="my-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-[11px] uppercase tracking-wide text-subtle">or</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <form onSubmit={onSubmit} className="flex flex-col gap-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-[13px] font-medium text-muted">Email</span>
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className={inputCls}
                  required
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[13px] font-medium text-muted">Password</span>
                <input
                  type="password"
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={inputCls}
                  required
                  minLength={6}
                />
              </label>
              <Button type="submit" className="mt-1 w-full" disabled={pending}>
                {mode === "signin" ? "Sign in" : "Create account"}
              </Button>
            </form>

            {note && (
              <p className="mt-3 text-center text-[12px] text-muted">{note}</p>
            )}
          </div>

          <p className="mt-5 text-center text-[13px]">
            <Link href="/plan" className="text-subtle underline-offset-2 hover:text-text hover:underline">
              Just try the planner instead
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
