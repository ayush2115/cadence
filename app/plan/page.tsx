import Link from "next/link";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { PlannerApp } from "@/components/planner/PlannerApp";

export default function PlanPage() {
  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-10 border-b border-border bg-bg/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-5 lg:px-8">
          <Logo />
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <Link
              href="/login"
              className="rounded-lg px-2.5 py-2 text-[13px] font-medium text-muted transition-colors duration-150 hover:text-text"
            >
              Sign in
            </Link>
          </div>
        </div>
      </header>
      <main className="flex-1">
        <PlannerApp />
      </main>
    </div>
  );
}
