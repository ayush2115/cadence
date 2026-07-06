"use client";

import { Sun, Moon } from "@phosphor-icons/react";

/** Flips <html data-theme> and persists it. The visible icon is driven purely
 *  by CSS (see globals.css .theme-sun/.theme-moon), so there's no React state
 *  and no hydration mismatch. */
export function ThemeToggle() {
  const toggle = () => {
    const root = document.documentElement;
    const next = root.dataset.theme === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    try {
      localStorage.setItem("theme", next);
    } catch {}
  };

  return (
    <button
      onClick={toggle}
      aria-label="Toggle light and dark mode"
      title="Toggle theme"
      className="grid h-9 w-9 place-items-center rounded-lg text-muted transition-colors duration-150 [transition-timing-function:var(--ease-out)] hover:bg-surface-2 hover:text-text"
    >
      <Moon size={17} weight="bold" className="theme-moon" />
      <Sun size={17} weight="bold" className="theme-sun" />
    </button>
  );
}
