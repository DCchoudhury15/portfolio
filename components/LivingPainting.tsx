"use client";

import { useEffect, useRef, useState } from "react";
import { flowPainting } from "@/lib/livingPainting";
import type { Painting } from "@/lib/paintings";

/**
 * A painting whose paint moves along its own brush strokes. The plain image shows first (and stays if
 * the canvas is unavailable); once the flowing version is drawn it takes over.
 */
export default function LivingPainting({ p, className, alt, speed = 1, eager = false }: { p: Painting; className?: string; alt: string; speed?: number; eager?: boolean }) {
  const img = useRef<HTMLImageElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [live, setLive] = useState(false);

  useEffect(() => {
    const im = img.current, cv = canvas.current;
    if (!im || !cv) return;
    const [fx, fy] = p.focus.split(" ").map((v) => parseFloat(v) / 100);
    let stop: (() => void) | null = null;
    const start = () => { stop = flowPainting(cv, im, [fx, fy], speed, () => setLive(true), p.strokes); };
    if (im.complete && im.naturalWidth) start(); else im.addEventListener("load", start, { once: true });
    return () => { im.removeEventListener("load", start); stop?.(); };
  }, [p, speed]);

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img ref={img} className={className} src={p.src} alt={alt} title={alt ? `${p.title}, ${p.artist}, ${p.year}` : undefined}
        loading={eager ? "eager" : "lazy"} decoding="async" style={{ objectPosition: p.focus, visibility: live ? "hidden" : undefined }} />
      <canvas ref={canvas} className={className} aria-hidden="true" style={{ visibility: live ? undefined : "hidden" }} />
    </>
  );
}
