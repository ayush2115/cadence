import Link from "next/link";
import { NotePencil, CalendarDots, Scales, GithubLogo } from "@phosphor-icons/react/dist/ssr";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SmoothScroll } from "@/components/landing/SmoothScroll";
import { Reveal } from "@/components/landing/Reveal";
import { HeroPreview } from "@/components/landing/HeroPreview";

const STEPS = [
  {
    Icon: NotePencil,
    title: "Brain-dump",
    body: "Type everything in plain English. An LLM turns durations, deadlines, and priorities into structured tasks you can edit.",
  },
  {
    Icon: CalendarDots,
    title: "Auto-schedule",
    body: "A real constraint solver packs your day around fixed blocks and focus windows: earliest-deadline-first, with a knapsack for overcommitted days.",
  },
  {
    Icon: Scales,
    title: "Honest overflow",
    body: "It does the time math you avoid, and tells you exactly what won't fit today so the important work doesn't quietly slip.",
  },
];

export default function Landing() {
  return (
    <div className="flex min-h-full flex-col">
      <SmoothScroll />

      <header className="sticky top-0 z-30 border-b border-transparent bg-bg/70 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5 lg:px-8">
          <Logo />
          <nav className="flex items-center gap-1.5">
            <ThemeToggle />
            <a
              href="https://github.com/ayush2115/cadence"
              target="_blank"
              rel="noreferrer"
              className="hidden items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-medium text-muted transition-colors duration-150 hover:text-text sm:inline-flex"
            >
              <GithubLogo size={16} weight="fill" />
              GitHub
            </a>
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
        </div>
      </header>

      <main className="flex-1">
        {/* hero — asymmetric split */}
        <section className="mx-auto grid w-full max-w-6xl items-center gap-14 px-5 pb-20 pt-12 lg:grid-cols-[1fr_1.05fr] lg:px-8 lg:pt-20">
          <div>
            <Reveal>
              <span className="text-[12px] font-semibold uppercase tracking-[0.16em] text-accent">
                AI day planner
              </span>
            </Reveal>
            <Reveal delay={0.06}>
              <h1 className="mt-4 text-balance text-[2.6rem] font-semibold leading-[1.06] tracking-tight text-text sm:text-6xl">
                Dump your tasks.
                <br />
                Get a real plan.
              </h1>
            </Reveal>
            <Reveal delay={0.12}>
              <p className="mt-5 max-w-md text-[15px] leading-relaxed text-muted">
                Turn a plain-English brain dump into a realistic, timeboxed day.
                Scheduled by priority and deadline, honest about what won&apos;t fit.
              </p>
            </Reveal>
            <Reveal delay={0.18}>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link href="/plan">
                  <Button>Plan your day</Button>
                </Link>
                <Link href="#how">
                  <Button variant="secondary">See how it works</Button>
                </Link>
              </div>
            </Reveal>
          </div>

          <Reveal delay={0.1} className="[perspective:1200px]">
            <HeroPreview />
          </Reveal>
        </section>

        {/* how it works — 3-step sequence */}
        <section id="how" className="scroll-mt-20 border-t border-border py-20 sm:py-28">
          <div className="mx-auto w-full max-w-6xl px-5 lg:px-8">
            <Reveal>
              <h2 className="max-w-xl text-balance text-3xl font-semibold tracking-tight text-text">
                Three steps from a messy list to a doable day.
              </h2>
            </Reveal>
            <div className="mt-12 grid gap-x-8 gap-y-10 sm:grid-cols-3">
              {STEPS.map((s, i) => (
                <Reveal key={s.title} delay={i * 0.08}>
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent-subtle text-accent">
                    <s.Icon size={20} weight="duotone" />
                  </div>
                  <h3 className="mt-4 text-[15px] font-semibold text-text">{s.title}</h3>
                  <p className="mt-2 text-[14px] leading-relaxed text-muted">{s.body}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* closing CTA */}
        <section className="border-t border-border bg-surface/40 py-20 sm:py-28">
          <div className="mx-auto w-full max-w-2xl px-5 text-center lg:px-8">
            <Reveal>
              <h2 className="text-balance text-3xl font-semibold tracking-tight text-text">
                Stop deciding what to do next.
              </h2>
            </Reveal>
            <Reveal delay={0.08}>
              <p className="mx-auto mt-4 max-w-md text-[15px] leading-relaxed text-muted">
                Dump your tasks and let Cadence build a realistic day around your
                time, priorities, and focus.
              </p>
            </Reveal>
            <Reveal delay={0.14}>
              <div className="mt-8">
                <Link href="/plan">
                  <Button>Plan your day</Button>
                </Link>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-8 text-[13px] text-subtle lg:px-8">
        <span>Cadence, an AI day planner.</span>
        <a
          href="https://github.com/ayush2115/cadence"
          className="flex items-center gap-1.5 transition-colors duration-150 hover:text-text"
          target="_blank"
          rel="noreferrer"
        >
          <GithubLogo size={15} weight="fill" />
          Source on GitHub
        </a>
      </footer>
    </div>
  );
}
