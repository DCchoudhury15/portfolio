"use client";

import { useEffect, useRef, useState } from "react";
import { animateSleeve, LOOKS } from "@/lib/lightshow";

/** An LP sleeve with moving shader-painted art and catalogue details printed on it. */
export default function Sleeve({ id, cat, year, title }: { id: string; cat: string; year: string; title: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [painted, setPainted] = useState(true);
  const look = LOOKS[id];

  useEffect(() => {
    if (!ref.current || !look) return;
    const stop = animateSleeve(ref.current, look);
    if (!stop) { setPainted(false); return; }
    return stop;
  }, [look]);

  const fallback = look && !painted ? { background: `conic-gradient(from 30deg, ${look.pal.join(", ")}, ${look.pal[0]})` } : undefined;

  return (
    <div className="sleeve" style={fallback}>
      <canvas ref={ref} width={512} height={512} aria-hidden="true" />
      <span className="cat">{cat}</span>
      <span className="rpm">{year}</span>
      <span className="st">{title}</span>
    </div>
  );
}
