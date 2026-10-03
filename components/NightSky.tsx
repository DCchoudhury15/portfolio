"use client";

import { useEffect, useRef } from "react";
import sky from "@/lib/sky.json";

type Body = { name: string; az: number; alt: number; mag: number };
const DEG = Math.PI / 180;

// Star colour from its B-V index: blue-white for hot stars, amber for cool ones.
function starColour(bv: number): [number, number, number] {
  const t = Math.max(0, Math.min(1, (bv + 0.3) / 2.0));
  const stops: [number, [number, number, number]][] = [
    [0, [170, 191, 255]], [0.25, [235, 238, 255]], [0.45, [255, 244, 230]], [0.7, [255, 214, 165]], [1, [255, 176, 120]],
  ];
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i][0]) {
      const [t0, a] = stops[i - 1], [t1, b] = stops[i], k = (t - t0) / (t1 - t0);
      return [0, 1, 2].map((j) => Math.round(a[j] + (b[j] - a[j]) * k)) as [number, number, number];
    }
  }
  return stops[stops.length - 1][1];
}

/**
 * The real sky over Jabalpur on the night I was born, drawn as a fixed background.
 * Stereographic projection of the dome from the zenith: north at the top, east on the left,
 * as if lying on your back looking up. Bright stars twinkle gently.
 */
export default function NightSky() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const base = document.createElement("canvas");
    const bctx = base.getContext("2d")!;
    let w = 0, h = 0, dpr = 1, cx = 0, cy = 0, R = 0;
    let twinklers: { x: number; y: number; r: number; c: string; a: number; f: number; p: number }[] = [];

    const project = (az: number, alt: number) => {
      const r = R * Math.tan(((90 - alt) * DEG) / 2);
      return [cx - r * Math.sin(az * DEG), cy - r * Math.cos(az * DEG)];
    };

    const drawMoon = (g: CanvasRenderingContext2D, x: number, y: number, r: number) => {
      const lit = sky.moon.lit;
      const sun = (sky.bodies as Body[]).find((b) => b.name === "Sun");
      // Point the lit limb at the Sun, which on this evening sat below the western horizon.
      const [sx, sy] = sun ? project(sun.az, Math.max(sun.alt, -60)) : [x + 1, y];
      const angle = Math.atan2(sy - y, sx - x);
      g.save();
      g.translate(x, y);
      g.rotate(angle);
      g.fillStyle = "rgba(236,228,214,0.08)";
      g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill();
      const glow = g.createRadialGradient(0, 0, r * 0.5, 0, 0, r * 5);
      glow.addColorStop(0, "rgba(236,228,214,0.10)"); glow.addColorStop(1, "rgba(236,228,214,0)");
      g.fillStyle = glow; g.beginPath(); g.arc(0, 0, r * 5, 0, Math.PI * 2); g.fill();
      g.fillStyle = "rgba(240,233,220,0.85)";
      g.beginPath();
      g.arc(0, 0, r, -Math.PI / 2, Math.PI / 2);
      g.ellipse(0, 0, r * Math.abs(1 - 2 * lit), r, 0, Math.PI / 2, -Math.PI / 2, lit < 0.5);
      g.fill();
      g.restore();
    };

    const layout = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth; h = window.innerHeight;
      for (const c of [canvas, base]) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
      canvas.style.width = w + "px"; canvas.style.height = h + "px";
      cx = w / 2; cy = h * 0.5;
      R = Math.max(w, h) * 0.62;

      const g = bctx;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, w, h);

      // Constellation figures, very faint.
      g.strokeStyle = "rgba(207,162,74,0.09)";
      g.lineWidth = 1;
      for (const line of sky.lines as [number, number][][]) {
        g.beginPath();
        line.forEach(([az, alt], i) => { const [x, y] = project(az, alt); if (i) g.lineTo(x, y); else g.moveTo(x, y); });
        g.stroke();
      }

      twinklers = [];
      for (const [az, alt, mag, bv] of sky.stars as [number, number, number, number][]) {
        const [x, y] = project(az, alt);
        if (x < -10 || y < -10 || x > w + 10 || y > h + 10) continue;
        const r = Math.max(0.35, (6.3 - mag) * 0.32);
        const a = Math.min(0.9, 0.18 + (6 - mag) * 0.12);
        const [cr, cg, cb] = starColour(bv);
        const c = `${cr},${cg},${cb}`;
        if (mag < 3.2 && !reduced) {
          twinklers.push({ x, y, r, c, a, f: 0.4 + Math.random() * 0.9, p: Math.random() * Math.PI * 2 });
        } else {
          g.fillStyle = `rgba(${c},${a})`;
          g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
        }
      }

      // Moon and planets, with small quiet labels.
      const uiFont = getComputedStyle(document.documentElement).getPropertyValue("--font-ui").trim() || "sans-serif";
      g.font = `500 11px ${uiFont}`;
      for (const b of sky.bodies as Body[]) {
        if (b.alt < 0 || b.name === "Sun") continue;
        const [x, y] = project(b.az, b.alt);
        if (b.name === "Moon") { drawMoon(g, x, y, Math.max(7, w * 0.008)); continue; }
        const r = Math.max(1.4, (2 - b.mag) * 0.9);
        const glow = g.createRadialGradient(x, y, 0, x, y, r * 4);
        glow.addColorStop(0, "rgba(255,236,200,0.9)"); glow.addColorStop(0.25, "rgba(255,236,200,0.35)"); glow.addColorStop(1, "rgba(255,236,200,0)");
        g.fillStyle = glow; g.beginPath(); g.arc(x, y, r * 4, 0, Math.PI * 2); g.fill();
        g.fillStyle = "rgba(154,145,159,0.55)";
        g.fillText(b.name, x + r * 3, y - r * 2);
      }
    };

    const draw = (ms: number) => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(base, 0, 0);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const t = ms / 1000;
      for (const s of twinklers) {
        const tw = 0.78 + 0.22 * Math.sin(t * s.f * Math.PI * 2 + s.p);
        ctx.fillStyle = `rgba(${s.c},${s.a * tw})`;
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
        if (s.r > 1.2) {
          ctx.fillStyle = `rgba(${s.c},${0.08 * tw})`;
          ctx.beginPath(); ctx.arc(s.x, s.y, s.r * 3.2, 0, Math.PI * 2); ctx.fill();
        }
      }
    };

    layout();
    draw(0);

    // Twinkle at about 20 frames a second; that is plenty and keeps the page light.
    let raf = 0, last = 0;
    const loop = (ms: number) => { if (ms - last > 50) { draw(ms); last = ms; } raf = requestAnimationFrame(loop); };
    if (!reduced) raf = requestAnimationFrame(loop);

    let timer: ReturnType<typeof setTimeout>;
    const onResize = () => { clearTimeout(timer); timer = setTimeout(() => { layout(); draw(performance.now()); }, 150); };
    window.addEventListener("resize", onResize);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", onResize); };
  }, []);

  return <canvas ref={ref} className="night-sky" aria-hidden="true" />;
}
