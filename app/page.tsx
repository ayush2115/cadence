import Link from "next/link";
import { Logo } from "@/components/Logo";
import { Button, Dot, priorityColor } from "@/components/ui";

export default function Landing() {
  return (
    <div className="flex min-h-full flex-col">
      <header className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-5">
        <Logo />
        <nav className="flex items-center gap-1.5">
          <Link
            href="/login"
            className="rounded-lg px-3 py-2 text-[13px] font-medium text-muted transition-colors duration-150 hover:text-text"
          >
            Sign in
          </Link>
          <Link href="/plan">
            <Button size="sm">Plan your day</Button>
          </Link>
        </nav>
      </header>

      <main className="flex-1">
        {/* hero */}
        <section className="mx-auto grid w-full max-w-5xl items-center gap-12 px-5 pb-16 pt-10 lg:grid-cols-[1.05fr_1fr] lg:pt-20">
          <div>
            <span className="text-[12px] font-semibold uppercase tracking-[0.14em] text-accent">
              AI day planner
            </span>
            <h1 className="mt-4 text-4xl font-semibold leading-[1.08] tracking-tight text-text sm:text-5xl">
              Dump your tasks.
              <br />
              Get a real plan.
            </h1>
            <p className="mt-5 max-w-md text-[15px] leading-relaxed text-muted">
              Cadence turns a plain-English brain-dump into a realistic, timeboxed
              day — auto-scheduled by priority, deadline, and your focus windows. And
              it&apos;s honest about what won&apos;t fit.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/plan">
                <Button>Plan your day →</Button>
              </Link>
              <Link href="#how">
                <Button variant="secondary">See how it works</Button>
              </Link>
            </div>
            <p className="mt-4 text-[13px] text-subtle">
              Free · no signup needed to try.
            </p>
          </div>

          <HeroPreview />
        </section>

        {/* how it works */}
        <section
          id="how"
          className="border-t border-border bg-surface/40 py-16 sm:py-20"
        >
          <div className="mx-auto w-full max-w-5xl px-5">
            <h2 className="text-2xl font-semibold tracking-tight text-text">
              How it works
            </h2>
            <div className="mt-8 grid gap-6 sm:grid-cols-3">
              <Step
                n="1"
                title="Brain-dump"
                body="Type everything in plain English — durations, deadlines, priorities. An LLM turns the mess into structured tasks."
              />
              <Step
                n="2"
                title="Auto-schedule"
                body="A real constraint solver — earliest-deadline-first, focus windows, a knapsack for overcommitted days — packs your day around fixed blocks."
              />
              <Step
                n="3"
                title="Honest overflow"
                body="It does the time math you avoid: 5.5h free vs 7h of tasks, and tells you exactly what moves to tomorrow."
              />
            </div>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-8 text-[13px] text-subtle">
        <span>Cadence — an AI day planner.</span>
        <a
          href="https://github.com/ayush2115/cadence"
          className="transition-colors duration-150 hover:text-text"
          target="_blank"
          rel="noreferrer"
        >
          Source on GitHub
        </a>
      </footer>
    </div>
  );
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div>
      <div className="grid h-8 w-8 place-items-center rounded-lg bg-accent-subtle font-mono text-[13px] font-semibold text-accent">
        {n}
      </div>
      <h3 className="mt-3.5 text-[15px] font-semibold text-text">{title}</h3>
      <p className="mt-1.5 text-[14px] leading-relaxed text-muted">{body}</p>
    </div>
  );
}

/** A static, self-contained preview of a planned day (mirrors the real timeline). */
function HeroPreview() {
  const items = [
    { title: "Review PR", time: "9:00–9:30", prio: "high" as const, focus: true },
    { title: "DSA graph sheet", time: "9:35–12:35", prio: "med" as const, focus: false },
    { title: "Gym", time: "2:00–3:00", prio: "med" as const, focus: false },
  ];
  return (
    <div className="rounded-2xl border border-border bg-surface p-4 shadow-[var(--shadow-md)]">
      <div className="mb-3 flex items-baseline justify-between">
        <span className="text-[13px] font-semibold text-text">Your day</span>
        <span className="font-mono text-[11px] text-subtle">Mon, Jul 7</span>
      </div>
      <div className="rounded-lg bg-surface-2 px-3 py-2 text-[12px]">
        <span className="font-semibold text-accent">5.5h free</span>
        <span className="text-muted"> vs 6.25h of tasks — 1 won&apos;t fit today.</span>
      </div>
      <div className="mt-3 flex flex-col gap-2">
        {items.map((it) => (
          <div
            key={it.title}
            className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
            style={{
              background: it.focus
                ? "color-mix(in oklab, var(--accent) 8%, var(--surface))"
                : "var(--surface)",
            }}
          >
            <span className="flex items-center gap-2 text-[13px] font-medium text-text">
              <Dot color={priorityColor[it.prio]} />
              {it.title}
            </span>
            <span className="font-mono text-[11px] text-subtle">{it.time}</span>
          </div>
        ))}
        <div className="flex items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-[12px] text-subtle">
          <span style={{ color: "var(--overflow)" }}>Didn&apos;t fit:</span>
          read system design · 45m
        </div>
      </div>
    </div>
  );
}
