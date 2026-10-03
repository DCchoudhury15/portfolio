"use client";

import { useEffect, useRef } from "react";
import sky from "@/lib/sky.json";

/**
 * The real sky over Jabalpur at 9 pm on the night I was born, drawn like a long-exposure photo
 * looking south-east, where the core of the Milky Way was rising over Scorpius.
 *
 * The scene is rendered once into a canvas larger than the screen. Scrolling tilts the view from
 * high overhead down to the horizon, and the pointer (or tilting a phone) moves it slightly.
 * Hovering a star makes it swell and sparkle.
 */

type Body = { name: string; az: number; alt: number; mag: number };
type Vec = [number, number, number]; // east, north, up

const D = Math.PI / 180;
const VIEW_AZ = 150; // facing south-south-east
const VIEW_ALT = 30;
const H_FOV = 92; // degrees across the screen
const EXTRA_W = 1.22; // scene is wider than the screen for pointer parallax
const EXTRA_H = 1.7; // and taller, so scrolling can tilt the view

// J2000 equatorial to galactic rotation.
const GAL = [
  [-0.0548755604, -0.8734370902, -0.4838350155],
  [0.4941094279, -0.44482963, 0.7469822445],
  [-0.867666149, -0.1980763734, 0.4559837762],
];

const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec, b: Vec): Vec => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: Vec): Vec => { const l = Math.hypot(...a); return [a[0] / l, a[1] / l, a[2] / l]; };
const dir = (az: number, alt: number): Vec => [Math.cos(alt * D) * Math.sin(az * D), Math.cos(alt * D) * Math.cos(az * D), Math.sin(alt * D)];

// Small deterministic noise, used for dust lanes, faint stars and the hills.
function rng(seed: number) { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }
function hash(x: number, y: number) { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }
function noise(x: number, y: number) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x: number, y: number) { let s = 0, a = 0.5; for (let i = 0; i < 4; i++) { s += a * noise(x, y); x *= 2.03; y *= 2.03; a *= 0.5; } return s; }

/** Milky Way surface brightness at galactic longitude l and latitude b (degrees), 0..~1.3. */
function milkyWay(l: number, b: number) {
  if (l > 180) l -= 360;
  const core = Math.exp(-((l / 32) ** 2));
  const width = 3.5 + 6 * core;
  let i = (0.22 + 0.78 * Math.exp(-((l / 70) ** 2))) * Math.exp(-(((b + 0.5) / width) ** 2));
  i += 0.65 * Math.exp(-(l * l + (b * 1.4) ** 2) / (2 * 7 * 7)); // the bulge
  // The Great Rift and the patchy dust that splits the band.
  const rift = Math.exp(-(((b - 1.3 + 1.5 * Math.sin(l * 0.06)) / 2.1) ** 2)) * (l > -25 && l < 75 ? 1 : 0.35);
  i *= 1 - 0.6 * rift * (0.6 + 0.6 * fbm(l * 0.09, b * 0.2));
  i *= 1 - 0.55 * Math.exp(-(((l + 59) / 4) ** 2 + ((b + 1) / 3) ** 2)); // the Coalsack, beside the Southern Cross
  i *= 0.55 + 0.9 * fbm(l * 0.22 + 10, b * 0.45);
  return Math.max(0, i);
}

function starColour(bv: number): [number, number, number] {
  const t = Math.max(0, Math.min(1, (bv + 0.3) / 2));
  const stops: [number, Vec][] = [[0, [165, 188, 255]], [0.25, [232, 236, 255]], [0.45, [255, 246, 232]], [0.7, [255, 216, 168]], [1, [255, 178, 122]]];
  for (let k = 1; k < stops.length; k++) {
    if (t <= stops[k][0]) {
      const [t0, a] = stops[k - 1], [t1, c] = stops[k], f = (t - t0) / (t1 - t0);
      return [0, 1, 2].map((j) => Math.round(a[j] + (c[j] - a[j]) * f)) as Vec;
    }
  }
  return stops[stops.length - 1][1];
}

// Atmosphere: stars fade and redden as they sink towards the horizon.
// True when the pointer is over open sky rather than over text, cards or the hero.
const OPEN_TAGS = new Set(["HTML", "BODY", "MAIN"]);
const OPEN_CLASSES = ["block", "contact", "wrap", "head", "records", "sessions", "rig", "notes", "onrepeat", "sky-note"];
const overOpenSky = (el: Element | null) =>
  !!el && !el.closest(".hero, .nav") && (OPEN_TAGS.has(el.tagName) || OPEN_CLASSES.some((c) => el.classList.contains(c)));

const extinction = (alt: number) => Math.pow(10, -0.4 * 0.25 * (1 / Math.max(Math.sin(Math.max(alt, 0.5) * D), 0.05) - 1));

export default function NightSky() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Phones and tablets: lighter drawing, snappier tilt response, tap instead of hover.
    const touch = window.matchMedia("(pointer: coarse)").matches;
    const scene = document.createElement("canvas");
    const sctx = scene.getContext("2d")!;
    const f = dir(VIEW_AZ, VIEW_ALT);
    const right = norm(cross(f, [0, 0, 1]));
    const up = cross(right, f);
    const lat = sky.lat * D, lst = sky.lst;

    let w = 0, h = 0, W = 0, H = 0, dpr = 1, s = 1, ox = 0, oy = 0;
    let twinklers: { x: number; y: number; r: number; c: string; a: number; f: number; p: number; amp: number }[] = [];
    // Every visible star, bucketed into a coarse grid so hover lookups stay cheap.
    type Pt = { x: number; y: number; r: number; c: string; a: number; p: number };
    let pts: Pt[] = [];
    let grid = new Map<string, number[]>();
    const CELL = 40;
    const addPt = (pt: Pt) => {
      const k = `${Math.floor(pt.x / CELL)},${Math.floor(pt.y / CELL)}`;
      const list = grid.get(k);
      if (list) list.push(pts.length); else grid.set(k, [pts.length]);
      pts.push(pt);
    };

    const project = (az: number, alt: number): [number, number] | null => {
      const v = dir(az, alt);
      const Z = dot(v, f);
      if (Z < -0.3) return null;
      const k = 2 / (1 + Z);
      return [ox + s * k * dot(v, right), oy - s * k * dot(v, up)];
    };
    const unproject = (px: number, py: number) => {
      const kx = (px - ox) / s, ky = (oy - py) / s, r2 = kx * kx + ky * ky;
      const Z = (4 - r2) / (4 + r2), X = (kx * (1 + Z)) / 2, Y = (ky * (1 + Z)) / 2;
      const v: Vec = [X * right[0] + Y * up[0] + Z * f[0], X * right[1] + Y * up[1] + Z * f[1], X * right[2] + Y * up[2] + Z * f[2]];
      return { alt: Math.asin(Math.max(-1, Math.min(1, v[2]))) / D, az: (Math.atan2(v[0], v[1]) / D + 360) % 360 };
    };
    const galactic = (az: number, alt: number) => {
      const sa = Math.sin(alt * D), ca = Math.cos(alt * D), sz = Math.sin(az * D), cz = Math.cos(az * D);
      const dec = Math.asin(Math.sin(lat) * sa + Math.cos(lat) * ca * cz);
      const ha = Math.atan2(-sz * ca, sa * Math.cos(lat) - ca * cz * Math.sin(lat));
      const ra = lst * D - ha;
      const e: Vec = [Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec)];
      const g = GAL.map((row) => row[0] * e[0] + row[1] * e[1] + row[2] * e[2]);
      return { l: (Math.atan2(g[1], g[0]) / D + 360) % 360, b: Math.asin(g[2]) / D };
    };
    const hills = (az: number) => 0.6 + 2.2 * fbm(az * 0.045, 3.7) + 0.6 * fbm(az * 0.3, 9.1);

    const render = () => {
      dpr = Math.min(window.devicePixelRatio || 1, touch ? 1.25 : 1.5);
      w = window.innerWidth; h = window.innerHeight;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      canvas.style.width = w + "px"; canvas.style.height = h + "px";
      W = Math.round(w * EXTRA_W); H = Math.round(h * EXTRA_H);
      scene.width = Math.round(W * dpr); scene.height = Math.round(H * dpr);
      s = (Math.max(w, h * 0.9) / 2) / (2 * Math.tan((H_FOV / 4) * D));
      // Place the scene so the horizon sits near the bottom of the screen at the end of the page.
      ox = W / 2;
      oy = H - h * 0.16 - 2 * s * Math.tan((VIEW_ALT / 2) * D);
      const g = sctx;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Sky glow: darkest overhead, a little lighter and warmer towards the horizon,
      // with a faint wash of moonlight from the west (on the right).
      const STEP = touch ? 6 : 4, cw = Math.ceil(W / STEP), ch = Math.ceil(H / STEP);
      const img = g.createImageData(cw, ch);
      const px = img.data;
      for (let y = 0; y < ch; y++) {
        for (let x = 0; x < cw; x++) {
          const { az, alt } = unproject(x * STEP, y * STEP);
          let r = 6, gr = 8, b = 16;
          const o = (y * cw + x) * 4;
          if (alt > -1) {
            const low = Math.exp(-Math.max(alt, 0) / 14);
            r += 22 * low + 10 * low * low; gr += 20 * low + 6 * low * low; b += 22 * low;
            const moon = Math.max(0, Math.cos((az - 275) * D)) * (1 - Math.min(alt, 60) / 90);
            r += 6 * moon; gr += 9 * moon; b += 16 * moon;
            const { l, b: gb } = galactic(az, alt);
            const mw = 1.8 * milkyWay(l, gb) * Math.min(1, Math.sqrt(extinction(alt)) * 1.5) * (alt < 4 ? Math.max(0, alt + 1) / 5 : 1);
            const warm = Math.exp(-(((l > 180 ? l - 360 : l) / 25) ** 2));
            r += mw * (52 + 22 * warm); gr += mw * (54 + 12 * warm); b += mw * (66 - 6 * warm);
            r += (hash(x, y) - 0.5) * 2; gr += (hash(y, x) - 0.5) * 2; b += (hash(x + 7, y) - 0.5) * 2;
          }
          px[o] = r; px[o + 1] = gr; px[o + 2] = b; px[o + 3] = 255;
        }
      }
      const low = document.createElement("canvas");
      low.width = cw; low.height = ch;
      low.getContext("2d")!.putImageData(img, 0, 0);
      g.imageSmoothingEnabled = true;
      g.filter = "blur(3px)";
      g.drawImage(low, -STEP, -STEP, W + STEP * 2, H + STEP * 2);
      g.filter = "none";

      // Thousands of stars too faint to name, crowding towards the Milky Way.
      const rand = rng(1505);
      const faint = Math.round((W * H) / 220);
      for (let n = 0; n < faint; n++) {
        const x = rand() * W, y = rand() * H;
        const { az, alt } = unproject(x, y);
        if (alt < hills(az) + 0.5) continue;
        const { l, b } = galactic(az, alt);
        const density = 0.18 + 1.4 * Math.min(1, milkyWay(l, b));
        if (rand() > density) continue;
        const a = (0.12 + rand() * 0.35) * extinction(alt);
        const tint = rand();
        g.fillStyle = tint < 0.2 ? `rgba(255,220,190,${a})` : tint < 0.4 ? `rgba(200,215,255,${a})` : `rgba(235,235,245,${a})`;
        const sz = rand() < 0.8 ? 1.1 : 1.8;
        g.fillRect(x, y, sz, sz);
      }

      // The catalogue stars, with a soft glow around the bright ones.
      twinklers = [];
      pts = [];
      grid = new Map();
      for (const [az, alt, mag, bv] of sky.stars as [number, number, number, number][]) {
        if (alt < hills(az)) continue;
        const p = project(az, alt);
        if (!p || p[0] < -20 || p[1] < -20 || p[0] > W + 20 || p[1] > H + 20) continue;
        const ext = extinction(alt);
        const flux = Math.pow(10, -0.4 * (mag - 1)) * ext;
        const [cr, cg, cb] = starColour(bv + (1 - ext) * 0.8);
        const c = `${cr},${cg},${cb}`;
        const r = Math.max(0.7, Math.min(4.6, 0.85 + 1.6 * Math.pow(flux, 0.33)));
        const a = Math.min(1, 0.25 + 0.55 * Math.pow(flux, 0.4));
        if (flux > 0.15) {
          const halo = g.createRadialGradient(p[0], p[1], 0, p[0], p[1], r * 7);
          halo.addColorStop(0, `rgba(${c},${0.22 * Math.min(1, flux)})`);
          halo.addColorStop(1, `rgba(${c},0)`);
          g.fillStyle = halo; g.beginPath(); g.arc(p[0], p[1], r * 7, 0, Math.PI * 2); g.fill();
        }
        addPt({ x: p[0], y: p[1], r, c, a, p: Math.random() * 6.28 });
        if (mag < 3.4 && !reduced) {
          twinklers.push({ x: p[0], y: p[1], r, c, a, f: 0.5 + Math.random() * 1.6, p: Math.random() * 6.28, amp: 0.12 + 0.35 * (1 - Math.sin(Math.max(alt, 1) * D)) });
        } else {
          g.fillStyle = `rgba(${c},${a})`; g.beginPath(); g.arc(p[0], p[1], r, 0, Math.PI * 2); g.fill();
        }
      }

      // Planets shine steadily and do not twinkle.
      for (const b of sky.bodies as Body[]) {
        if (b.alt < 1 || b.name === "Sun" || b.name === "Moon") continue;
        const p = project(b.az, b.alt);
        if (!p) continue;
        const flux = Math.pow(10, -0.4 * (b.mag - 1)) * extinction(b.alt);
        const r = Math.min(5, 1.4 + 1.6 * Math.pow(flux, 0.33));
        const halo = g.createRadialGradient(p[0], p[1], 0, p[0], p[1], r * 9);
        halo.addColorStop(0, "rgba(255,240,214,0.35)"); halo.addColorStop(1, "rgba(255,240,214,0)");
        g.fillStyle = halo; g.beginPath(); g.arc(p[0], p[1], r * 9, 0, Math.PI * 2); g.fill();
        g.fillStyle = "rgba(255,246,228,0.98)"; g.beginPath(); g.arc(p[0], p[1], r, 0, Math.PI * 2); g.fill();
        addPt({ x: p[0], y: p[1], r, c: "255,246,228", a: 0.98, p: 0 });
      }

      // Low hills in silhouette, with the faint orange glow of a town behind them.
      const ridge: [number, number][] = [];
      for (let az = VIEW_AZ - 130; az <= VIEW_AZ + 130; az += 0.4) {
        const p = project((az + 360) % 360, hills((az + 360) % 360));
        if (p) ridge.push(p);
      }
      if (ridge.length > 2) {
        // Only the part of the ridge actually on screen decides where the glow sits; the glow
        // runs down behind the hills so it never ends in a hard edge.
        const onScreen = ridge.filter(([x]) => x >= 0 && x <= W).map((q) => q[1]);
        const top = onScreen.length ? Math.min(...onScreen) : H;
        const glowTop = top - Math.min(H * 0.08, 90);
        const glow = g.createLinearGradient(0, glowTop, 0, top + 40);
        glow.addColorStop(0, "rgba(255,150,80,0)"); glow.addColorStop(1, "rgba(255,150,80,0.06)");
        g.fillStyle = glow; g.fillRect(0, glowTop, W, H - glowTop);
        g.fillStyle = "#050507";
        g.beginPath();
        g.moveTo(ridge[0][0], H + 10);
        ridge.forEach(([x, y]) => g.lineTo(x, y));
        g.lineTo(ridge[ridge.length - 1][0], H + 10);
        g.closePath();
        g.fill();
      }
    };

    // ---- motion: scroll tilts the view, pointer and phone tilt nudge it ----
    let tx = 0, ty = 0, cx = 0, cy = 0, scroll = 0;
    const range = () => ({ x: (W - w) / 2, y: H - h });
    const readScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      scroll = max > 0 ? Math.min(1, window.scrollY / max) : 0;
    };
    // Hover: find the star nearest the pointer, favouring brighter ones.
    let hover = -1;
    const hot = new Map<number, number>(); // star index -> how lit up it is, 0..1
    const nearestStar = (clientX: number, clientY: number, reach: number) => {
      if (isNaN(lastX)) return -1;
      const sx = clientX + lastX, sy = clientY + lastY;
      const gx = Math.floor(sx / CELL), gy = Math.floor(sy / CELL);
      let best = reach, found = -1;
      for (let i = gx - 1; i <= gx + 1; i++) for (let j = gy - 1; j <= gy + 1; j++) {
        for (const n of grid.get(`${i},${j}`) ?? []) {
          const d = Math.hypot(pts[n].x - sx, pts[n].y - sy) - pts[n].r * 2.5;
          if (d < best) { best = d; found = n; }
        }
      }
      return found;
    };
    const onPointer = (e: PointerEvent) => {
      if (e.pointerType === "touch") return; // fingers tap stars instead; tilt moves the sky
      tx = (e.clientX / w - 0.5) * 2; ty = (e.clientY / h - 0.5) * 2;
      hover = overOpenSky(e.target as Element) ? nearestStar(e.clientX, e.clientY, 22) : -1;
    };
    // On a phone, tapping open sky lights up the nearest star for a moment.
    let tapTimer: ReturnType<typeof setTimeout> | undefined;
    const onTap = (e: PointerEvent) => {
      if (e.pointerType !== "touch" || !overOpenSky(e.target as Element)) return;
      const n = nearestStar(e.clientX, e.clientY, 36);
      if (n < 0) return;
      hover = n;
      clearTimeout(tapTimer);
      tapTimer = setTimeout(() => { if (hover === n) hover = -1; }, 1600);
    };
    const drawHot = (st: Pt, e: number, t: number, offX: number, offY: number) => {
      const x = st.x - offX, y = st.y - offY;
      const tw = 0.65 + 0.35 * Math.sin(t * 9 + st.p) * Math.sin(t * 5.3 + st.p * 2);
      const r = st.r * (1 + 2.4 * e);
      const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 6);
      glow.addColorStop(0, `rgba(${st.c},${0.45 * e * tw})`);
      glow.addColorStop(1, `rgba(${st.c},0)`);
      ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(x, y, r * 6, 0, Math.PI * 2); ctx.fill();
      // Four soft spikes, like a star seen through a lens.
      const len = r * (5 + 4 * tw) * e;
      for (const [dx, dy] of [[1, 0], [0, 1]]) {
        const spike = ctx.createLinearGradient(x - dx * len, y - dy * len, x + dx * len, y + dy * len);
        spike.addColorStop(0, `rgba(${st.c},0)`); spike.addColorStop(0.5, `rgba(${st.c},${0.7 * e * tw})`); spike.addColorStop(1, `rgba(${st.c},0)`);
        ctx.strokeStyle = spike; ctx.lineWidth = Math.max(1, r * 0.35);
        ctx.beginPath(); ctx.moveTo(x - dx * len, y - dy * len); ctx.lineTo(x + dx * len, y + dy * len); ctx.stroke();
      }
      ctx.fillStyle = `rgba(${st.c},${Math.min(1, st.a + 0.5 * e) * (0.75 + 0.25 * tw)})`;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    };
    const onTilt = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return;
      tx = Math.max(-1, Math.min(1, e.gamma / 25));
      ty = Math.max(-1, Math.min(1, (e.beta - 45) / 25));
    };
    // iOS only shares tilt after asking, and only from a tap.
    const askTilt = () => {
      const DOE = window.DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> };
      if (typeof DOE?.requestPermission === "function") DOE.requestPermission().catch(() => {});
    };

    let last = 0, raf = 0, lastX = NaN, lastY = NaN, lastFrame = 0;
    const frame = (ms: number) => {
      const rg = range();
      // Everything eases by elapsed time, so it feels the same at any frame rate.
      const dt = Math.min(100, ms - (lastFrame || ms)) / 16.7;
      lastFrame = ms;
      const follow = 1 - Math.pow(touch ? 0.8 : 0.94, dt);
      cx += (tx - cx) * follow; cy += (ty - cy) * follow;
      // Keep the mouse drift small so a star does not slide away from the pointer reaching for it;
      // tilting a phone moves the sky a little further.
      const offX = rg.x + cx * Math.min(touch ? 34 : 20, rg.x);
      const offY = scroll * rg.y + cy * Math.min(touch ? 34 : 30, rg.y * 0.05);
      const moved = Math.abs(offX - lastX) > 0.1 || Math.abs(offY - lastY) > 0.1;
      if (hover >= 0) { const e = hot.get(hover) ?? 0; hot.set(hover, e + (1 - e) * (1 - Math.pow(0.82, dt))); }
      hot.forEach((e, n) => { if (n !== hover) { e *= Math.pow(0.9, dt); if (e < 0.02) hot.delete(n); else hot.set(n, e); } });
      if (moved || hot.size > 0 || ms - last > 60) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.drawImage(scene, Math.round(offX * dpr), Math.round(offY * dpr), canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const t = ms / 1000;
        for (const st of twinklers) {
          const x = st.x - offX, y = st.y - offY;
          if (x < -10 || y < -10 || x > w + 10 || y > h + 10) continue;
          const tw = 1 - st.amp + st.amp * Math.sin(t * st.f * 6.28 + st.p);
          ctx.fillStyle = `rgba(${st.c},${st.a * tw})`;
          ctx.beginPath(); ctx.arc(x, y, st.r, 0, Math.PI * 2); ctx.fill();
        }
        hot.forEach((e, n) => drawHot(pts[n], e, t, offX, offY));
        last = ms; lastX = offX; lastY = offY;
      }
      raf = requestAnimationFrame(frame);
    };
    const still = () => {
      readScroll();
      const rg = range();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(scene, Math.round(rg.x * dpr), Math.round(scroll * rg.y * dpr), canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      for (const st of twinklers) { ctx.fillStyle = `rgba(${st.c},${st.a})`; ctx.beginPath(); ctx.arc(st.x - rg.x, st.y - scroll * rg.y, st.r, 0, Math.PI * 2); ctx.fill(); }
    };

    render();
    readScroll();
    if (reduced) still(); else raf = requestAnimationFrame(frame);

    const onScroll = () => { hover = -1; readScroll(); if (reduced) still(); };
    const onLeaveWindow = (e: MouseEvent) => { if (!e.relatedTarget) hover = -1; };
    window.addEventListener("scroll", onScroll, { passive: true });
    if (!reduced) {
      window.addEventListener("pointermove", onPointer, { passive: true });
      document.addEventListener("mouseout", onLeaveWindow);
      window.addEventListener("deviceorientation", onTilt);
      window.addEventListener("pointerdown", askTilt, { once: true });
      window.addEventListener("pointerdown", onTap, { passive: true });
    }
    let timer: ReturnType<typeof setTimeout>;
    const onResize = () => { clearTimeout(timer); timer = setTimeout(() => { hot.clear(); hover = -1; render(); readScroll(); lastX = NaN; if (reduced) still(); }, 200); };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pointermove", onPointer);
      document.removeEventListener("mouseout", onLeaveWindow);
      window.removeEventListener("deviceorientation", onTilt);
      window.removeEventListener("pointerdown", askTilt);
      window.removeEventListener("pointerdown", onTap);
      clearTimeout(tapTimer);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return <canvas ref={ref} className="night-sky" aria-hidden="true" />;
}
