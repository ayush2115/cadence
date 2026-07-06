"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import { useReducedMotion } from "motion/react";

/** Gentle Lenis smooth-scroll, scoped to the landing page. Disabled under
 *  reduced-motion, and intercepts in-page hash links for smooth anchoring. */
export function SmoothScroll() {
  const reduce = useReducedMotion();

  useEffect(() => {
    if (reduce) return;
    const lenis = new Lenis({ lerp: 0.11, wheelMultiplier: 1 });

    const onClick = (e: MouseEvent) => {
      const link = (e.target as HTMLElement)?.closest?.('a[href^="#"]');
      const href = link?.getAttribute("href");
      if (href && href.length > 1) {
        e.preventDefault();
        lenis.scrollTo(href, { offset: -80 });
      }
    };
    document.addEventListener("click", onClick);

    let raf = 0;
    const loop = (t: number) => {
      lenis.raf(t);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      document.removeEventListener("click", onClick);
      cancelAnimationFrame(raf);
      lenis.destroy();
    };
  }, [reduce]);

  return null;
}
