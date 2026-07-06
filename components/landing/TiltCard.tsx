"use client";

import { useRef } from "react";
import {
  motion,
  useMotionValue,
  useMotionTemplate,
  useSpring,
  useTransform,
  useReducedMotion,
} from "motion/react";

/** Mouse-tracked 3D parallax tilt with a moving light glare. Spring-smoothed
 *  motion values (never useState) so it stays 60fps and doesn't re-render.
 *
 *  Hydration-safe: the rendered structure/style does NOT depend on
 *  reduced-motion (only the pointer handlers do, and handlers aren't part of
 *  SSR HTML), so server and client always render the same tree. Under reduced
 *  motion the handlers are omitted, so the card just stays still. */
export function TiltCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);

  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const spring = { stiffness: 150, damping: 18, mass: 0.4 };
  const rotateX = useSpring(useTransform(py, [0, 1], [7, -7]), spring);
  const rotateY = useSpring(useTransform(px, [0, 1], [-9, 9]), spring);

  const glareX = useTransform(px, (v) => `${v * 100}%`);
  const glareY = useTransform(py, (v) => `${v * 100}%`);
  const glare = useMotionTemplate`radial-gradient(600px circle at ${glareX} ${glareY}, rgba(255,255,255,0.16), transparent 42%)`;

  const onMove = (e: React.PointerEvent) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    px.set((e.clientX - r.left) / r.width);
    py.set((e.clientY - r.top) / r.height);
  };
  const reset = () => {
    px.set(0.5);
    py.set(0.5);
  };

  return (
    <motion.div
      ref={ref}
      onPointerMove={reduce ? undefined : onMove}
      onPointerLeave={reduce ? undefined : reset}
      style={{
        rotateX,
        rotateY,
        transformPerspective: 1100,
        transformStyle: "preserve-3d",
      }}
      className={`relative ${className}`}
    >
      {children}
      <motion.div
        aria-hidden
        style={{ background: glare }}
        className="pointer-events-none absolute inset-0 z-10 rounded-[inherit] mix-blend-soft-light"
      />
    </motion.div>
  );
}
