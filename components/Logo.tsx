import Link from "next/link";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/"
      className={`inline-flex items-center gap-2 text-[15px] font-semibold tracking-tight text-text ${className}`}
    >
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
        <rect x="2" y="8" width="3.2" height="8" rx="1.6" fill="var(--accent)" opacity="0.55" />
        <rect x="7" y="4" width="3.2" height="12" rx="1.6" fill="var(--accent)" />
        <rect x="12" y="10" width="3.2" height="6" rx="1.6" fill="var(--accent)" opacity="0.7" />
      </svg>
      Cadence
    </Link>
  );
}
