import type { ElementType } from "react";

/** Load-time reveal: a pure CSS entrance that always runs on mount, so content
 *  can never ship blank (no scroll/JS gating). Reduced-motion disables it and
 *  leaves content visible. Stagger via `delay`. */
export function Reveal({
  children,
  delay = 0,
  className = "",
  as = "div",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  as?: "div" | "li" | "section";
}) {
  const Tag = as as ElementType;
  return (
    <Tag
      className={`animate-reveal ${className}`}
      style={{ animationDelay: `${delay}s` }}
    >
      {children}
    </Tag>
  );
}
