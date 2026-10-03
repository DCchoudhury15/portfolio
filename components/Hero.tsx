"use client";

import { useEffect, useRef } from "react";
import { createLightShow, LOOKS } from "@/lib/lightshow";

/** Full-bleed liquid light show behind the hero. */
export default function HeroLightShow() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let draw: ReturnType<typeof createLightShow> = null;
    try { draw = createLightShow(canvas); } catch { draw = null; }
    if (!draw) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fit = () => {
      const box = canvas.getBoundingClientRect();
      const scale = Math.min(1, 1400 / Math.max(box.width, 1));
      canvas.width = Math.max(2, Math.round(box.width * scale));
      canvas.height = Math.max(2, Math.round(box.height * scale));
    };
    fit();
    draw(LOOKS.hero, 20, 0);

    let visible = true;
    const io = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; });
    io.observe(canvas);

    // With reduced motion the show stays as a still frame.
    let raf = 0;
    const frame = (ms: number) => {
      if (visible) draw!(LOOKS.hero, ms / 1000 + 20, 0);
      raf = requestAnimationFrame(frame);
    };
    if (!reduced) raf = requestAnimationFrame(frame);

    let t: ReturnType<typeof setTimeout>;
    const onResize = () => { clearTimeout(t); t = setTimeout(() => { fit(); draw!(LOOKS.hero, performance.now() / 1000 + 20, 0); }, 150); };
    window.addEventListener("resize", onResize);

    return () => { cancelAnimationFrame(raf); io.disconnect(); window.removeEventListener("resize", onResize); };
  }, []);

  return <canvas ref={ref} aria-hidden="true" />;
}
