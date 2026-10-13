"use client";

import { useEffect, useRef } from "react";
import sky from "@/lib/sky.json";

/**
 * The real sky over Jabalpur at 9 pm on the night I was born, drawn like a long-exposure photo
 * looking south-east, where the core of the Milky Way was rising over Scorpius.
 *
 * The sky turns the way the real one does, sped up like a time-lapse video: stars glide from left
 * to right over the hills, and now and then a shooting star crosses.
 * The sky glow, the Milky Way and the faint stars are drawn by a WebGL shader; the named stars,
 * planets and hills go on a 2D canvas above it. Scrolling tilts the view from high overhead down
 * to the horizon, and the pointer (or tilting a phone) moves it slightly. Hovering a star makes
 * it swell and sparkle.
 */

type Body = { name: string; az: number; alt: number; mag: number };
type Vec = [number, number, number]; // east, north, up

const D = Math.PI / 180;
const VIEW_AZ = 150; // facing south-south-east
const VIEW_ALT = 30;
const H_FOV = 92; // degrees across the screen
const EXTRA_W = 1.22; // scene is wider than the screen for pointer parallax
const EXTRA_H = 1.7; // and taller, so scrolling can tilt the view
const SPIN = 1 * D; // how far the sky turns each second, about the pace of a night-sky time-lapse video

const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec, b: Vec): Vec => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: Vec): Vec => { const l = Math.hypot(...a); return [a[0] / l, a[1] / l, a[2] / l]; };
const dir = (az: number, alt: number): Vec => [Math.cos(alt * D) * Math.sin(az * D), Math.cos(alt * D) * Math.cos(az * D), Math.sin(alt * D)];

// Small deterministic noise, used for the hills.
function hash(x: number, y: number) { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }
function noise(x: number, y: number) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x: number, y: number) { let s = 0, a = 0.5; for (let i = 0; i < 4; i++) { s += a * noise(x, y); x *= 2.03; y *= 2.03; a *= 0.5; } return s; }
const hills = (az: number) => 0.6 + 2.2 * fbm(az * 0.045, 3.7) + 0.6 * fbm(az * 0.3, 9.1);

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

// True when the pointer is over open sky: anywhere except text, links, buttons and pictures.
const SOLID_TAGS = new Set(["P", "H1", "H2", "H3", "H4", "LI", "SPAN", "CODE", "SMALL", "B", "EM", "DT", "DD", "IMG", "svg", "path"]);
const overOpenSky = (el: Element | null) =>
  !!el && !SOLID_TAGS.has(el.tagName) && !el.closest(".nav, a, button, input, .sleeve, .menu");

// Atmosphere: stars fade and redden as they sink towards the horizon.
const extinction = (alt: number) => Math.pow(10, -0.4 * 0.25 * (1 / Math.max(Math.sin(Math.max(alt, 0.5) * D), 0.05) - 1));

// Each star is kept as its declination and hour angle at that moment, so turning the sky by an
// angle is only a rotation of the hour angle. A = cos(dec) cos(ha), B = cos(dec) sin(ha).
const sinLat = Math.sin(sky.lat * D), cosLat = Math.cos(sky.lat * D);
type Star = { sd: number; A: number; B: number; mag: number; bv: number; c: string; planet: boolean };
const polar = (az: number, alt: number) => {
  const [e, n, u] = dir(az, alt);
  return { sd: n * cosLat + u * sinLat, A: u * cosLat - n * sinLat, B: -e };
};
const STARS: Star[] = [
  ...(sky.stars as [number, number, number, number][]).map(([az, alt, mag, bv]) =>
    ({ ...polar(az, alt), mag, bv, c: starColour(bv).join(","), planet: false })),
  // Planets shine steadily and do not twinkle.
  ...(sky.bodies as Body[]).filter((b) => b.name !== "Sun" && b.name !== "Moon").map((b) =>
    ({ ...polar(b.az, b.alt), mag: b.mag, bv: 0, c: "255,246,228", planet: true })),
];
const MOON = (() => { const m = (sky.bodies as Body[]).find((b) => b.name === "Moon")!; return polar(m.az, m.alt); })();
// Where a star is after the sky has turned by an angle with cosine ct and sine st.
const turned = (p: { sd: number; A: number; B: number }, ct: number, st: number): Vec => {
  const ch = p.A * ct - p.B * st, sh = p.B * ct + p.A * st;
  return [-sh, p.sd * cosLat - ch * sinLat, p.sd * sinLat + ch * cosLat];
};

const VERT = `attribute vec2 aPos; void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }`;

const FRAG = `
precision highp float;
uniform vec2 uOrigin; uniform float uS; uniform float uDpr; uniform float uH;
uniform vec3 uF; uniform vec3 uR; uniform vec3 uUp;
uniform vec2 uLat; uniform float uLst; uniform vec2 uCell; uniform vec3 uMoon;
const float D = 0.0174532925;
const float TAU = 6.2831853;
// J2000 equatorial to galactic rotation.
const vec3 G0 = vec3(-0.0548755604, -0.8734370902, -0.4838350155);
const vec3 G1 = vec3(0.4941094279, -0.44482963, 0.7469822445);
const vec3 G2 = vec3(-0.867666149, -0.1980763734, 0.4559837762);
float hash(vec2 p){ vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p), u = f*f*(3.0-2.0*f);
  return mix(mix(hash(i), hash(i+vec2(1.0,0.0)), u.x), mix(hash(i+vec2(0.0,1.0)), hash(i+vec2(1.0,1.0)), u.x), u.y); }
float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++){ s += a*noise(p); p *= 2.03; a *= 0.5; } return s; }
float sq(float x){ return x*x; }
// Milky Way surface brightness at galactic longitude l and latitude b (degrees), 0..~1.3.
float milkyWay(float l, float b){
  if (l > 180.0) l -= 360.0;
  float core = exp(-sq(l/32.0));
  float width = 3.5 + 6.0*core;
  float i = (0.22 + 0.78*exp(-sq(l/70.0))) * exp(-sq((b + 0.5)/width));
  i += 0.65*exp(-(l*l + sq(b*1.4))/98.0); // the bulge
  // The Great Rift and the patchy dust that splits the band.
  float rift = exp(-sq((b - 1.3 + 1.5*sin(l*0.06))/2.1)) * (0.35 + 0.65*smoothstep(-35.0, -15.0, l)*(1.0 - smoothstep(65.0, 85.0, l)));
  i *= 1.0 - 0.6*rift*(0.6 + 0.6*fbm(vec2(l*0.09, b*0.2)));
  i *= 1.0 - 0.55*exp(-(sq((l + 59.0)/4.0) + sq((b + 1.0)/3.0))); // the Coalsack, beside the Southern Cross
  i *= 0.55 + 0.9*fbm(vec2(l*0.22 + 10.0, b*0.45));
  return max(0.0, i);
}
float extinction(float alt){ return pow(10.0, -0.1*(1.0/max(sin(max(alt, 0.5)*D), 0.05) - 1.0)); }
void main(){
  // Back from the screen to a direction in the sky (inverse stereographic projection).
  vec2 p = vec2(gl_FragCoord.x, uH - gl_FragCoord.y) / uDpr;
  float kx = (p.x - uOrigin.x)/uS, ky = (uOrigin.y - p.y)/uS, r2 = kx*kx + ky*ky;
  float Z = (4.0 - r2)/(4.0 + r2);
  vec3 v = 0.5*(1.0 + Z)*(kx*uR + ky*uUp) + Z*uF;
  float alt = asin(clamp(v.z, -1.0, 1.0))/D;
  vec3 col = vec3(6.0, 8.0, 16.0);
  if (alt > -1.0) {
    // Sky glow: darkest overhead, a little lighter and warmer towards the horizon,
    // with a faint wash of light on the side where the Moon is.
    float low = exp(-max(alt, 0.0)/14.0);
    col += vec3(22.0*low + 10.0*low*low, 20.0*low + 6.0*low*low, 22.0*low);
    float moon = max(0.0, dot(normalize(v.xy + 1e-6), normalize(uMoon.xy + 1e-6))) * (1.0 - min(alt, 60.0)/90.0) * smoothstep(-0.1, 0.15, uMoon.z);
    col += vec3(6.0, 9.0, 16.0)*moon;
    // Where this pixel points among the stars, as far as the sky has turned.
    float sd = v.y*uLat.y + v.z*uLat.x;
    float cd = sqrt(max(0.0, 1.0 - sd*sd));
    float ra = uLst - atan(-v.x, v.z*uLat.y - v.y*uLat.x);
    vec3 e = vec3(cd*cos(ra), cd*sin(ra), sd);
    vec3 g = vec3(dot(G0, e), dot(G1, e), dot(G2, e));
    float l = mod(atan(g.y, g.x)/D + 360.0, 360.0), b = asin(clamp(g.z, -1.0, 1.0))/D;
    float m = milkyWay(l, b), ext = extinction(alt);
    float mw = 2.0*m*min(1.0, sqrt(ext)*1.5)*(alt < 4.0 ? max(0.0, alt + 1.0)/5.0 : 1.0);
    float warm = exp(-sq((l > 180.0 ? l - 360.0 : l)/25.0));
    // Violet along the band and a warm, golden core, as the Milky Way looks in long exposures.
    col += mw*mix(vec3(56.0, 50.0, 80.0), vec3(98.0, 82.0, 60.0), warm);
    // Thousands of stars too faint to name, crowding towards the Milky Way. Each cell of an
    // equal-area grid on the celestial sphere holds at most one, so they turn with the sky.
    vec2 cell = vec2(floor(fract(ra/TAU)*uCell.x), floor((sd + 1.0)/uCell.y));
    if (hash(cell) < 0.18 + 1.4*min(1.0, m)) {
      float sra = (cell.x + 0.2 + 0.6*hash(cell + 17.3))/uCell.x*TAU;
      float ssd = (cell.y + 0.2 + 0.6*hash(cell + 41.9))*uCell.y - 1.0;
      float scd = sqrt(max(0.0, 1.0 - ssd*ssd));
      float d = length(e - vec3(scd*cos(sra), scd*sin(sra), ssd))*uS*2.0/(1.0 + Z);
      float rad = hash(cell + 5.1) < 0.8 ? 0.55 : 0.9;
      float a = (0.12 + 0.35*hash(cell + 63.7))*ext*clamp(rad + 0.5 - d, 0.0, 1.0);
      float tint = hash(cell + 88.1);
      col = mix(col, tint < 0.2 ? vec3(255.0, 220.0, 190.0) : tint < 0.4 ? vec3(200.0, 215.0, 255.0) : vec3(235.0, 235.0, 245.0), a);
    }
    col += vec3(hash(gl_FragCoord.xy), hash(gl_FragCoord.yx + 7.0), hash(gl_FragCoord.xy + 13.0))*2.0 - 1.0;
  }
  gl_FragColor = vec4(col/255.0, 1.0);
}`;

type SkyView = { ox: number; oy: number; s: number; dpr: number; lst: number; cell: [number, number]; moon: Vec };

function createSkyShader(canvas: HTMLCanvasElement, f: Vec, right: Vec, up: Vec) {
  const gl = canvas.getContext("webgl", { antialias: false, alpha: false, depth: false });
  if (!gl) return null;
  const prog = gl.createProgram()!;
  for (const [type, src] of [[gl.VERTEX_SHADER, VERT], [gl.FRAGMENT_SHADER, FRAG]] as const) {
    const sh = gl.createShader(type)!;
    gl.shaderSource(sh, src); gl.compileShader(sh); gl.attachShader(prog, sh);
  }
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  gl.useProgram(prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, "aPos");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
  const u = Object.fromEntries(["uOrigin", "uS", "uDpr", "uH", "uF", "uR", "uUp", "uLat", "uLst", "uCell", "uMoon"]
    .map((n) => [n, gl.getUniformLocation(prog, n)]));
  gl.uniform3fv(u.uF, f); gl.uniform3fv(u.uR, right); gl.uniform3fv(u.uUp, up);
  gl.uniform2f(u.uLat, sinLat, cosLat);
  return (v: SkyView) => {
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(u.uOrigin, v.ox, v.oy);
    gl.uniform1f(u.uS, v.s); gl.uniform1f(u.uDpr, v.dpr); gl.uniform1f(u.uH, canvas.height);
    gl.uniform1f(u.uLst, v.lst);
    gl.uniform2f(u.uCell, v.cell[0], v.cell[1]);
    gl.uniform3fv(u.uMoon, v.moon);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
}

export default function NightSky() {
  const glRef = useRef<HTMLCanvasElement>(null);
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current, glCanvas = glRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !glCanvas || !ctx) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Phones and tablets: lighter drawing, snappier tilt response, tap instead of hover.
    const touch = window.matchMedia("(pointer: coarse)").matches;
    const f = dir(VIEW_AZ, VIEW_ALT);
    const right = norm(cross(f, [0, 0, 1]));
    const up = cross(right, f);
    const shader = createSkyShader(glCanvas, f, right, up);

    let w = 0, h = 0, W = 0, H = 0, dpr = 1, s = 1, ox = 0, oy = 0;
    let cell: [number, number] = [1, 1];
    let ridge: Path2D | null = null, glowTop = 0;
    // Where each star sits on screen this frame (NaN when hidden), for hovering and lighting up.
    const N = STARS.length;
    const sx = new Float32Array(N), sy = new Float32Array(N), sr = new Float32Array(N), sa = new Float32Array(N);
    const sc: string[] = new Array(N);
    const tf = Float32Array.from(STARS, () => 0.5 + Math.random() * 1.6); // twinkle speed
    const tp = Float32Array.from(STARS, () => Math.random() * 6.28); // and phase
    let shown: number[] = [];

    const project = (v: Vec): [number, number] | null => {
      const Z = dot(v, f);
      if (Z < -0.3) return null;
      const k = 2 / (1 + Z);
      return [ox + s * k * dot(v, right), oy - s * k * dot(v, up)];
    };

    const render = () => {
      dpr = Math.min(window.devicePixelRatio || 1, touch ? 1.25 : 1.5);
      w = window.innerWidth; h = window.innerHeight;
      for (const c of [canvas, glCanvas]) {
        c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
        c.style.width = w + "px"; c.style.height = h + "px";
      }
      W = Math.round(w * EXTRA_W); H = Math.round(h * EXTRA_H);
      s = (Math.max(w, h * 0.9) / 2) / (2 * Math.tan((H_FOV / 4) * D));
      // Place the scene so the horizon sits near the bottom of the screen at the end of the page.
      ox = W / 2;
      oy = H - h * 0.16 - 2 * s * Math.tan((VIEW_ALT / 2) * D);
      // About one faint star for every 220 square pixels, as many as the screen can hold.
      const size = Math.sqrt(220) / s;
      cell = [Math.round((2 * Math.PI) / size), size];

      // Low hills in silhouette. They stand still while the sky turns behind them.
      const pts: [number, number][] = [];
      for (let az = VIEW_AZ - 130; az <= VIEW_AZ + 130; az += 0.4) {
        const p = project(dir((az + 360) % 360, hills((az + 360) % 360)));
        if (p) pts.push(p);
      }
      ridge = null;
      if (pts.length > 2) {
        // Only the part of the ridge actually on screen decides where the town glow sits.
        const onScreen = pts.filter(([x]) => x >= 0 && x <= W).map((q) => q[1]);
        glowTop = onScreen.length ? Math.min(...onScreen) : H;
        ridge = new Path2D();
        ridge.moveTo(pts[0][0], H + 10);
        pts.forEach(([x, y]) => ridge!.lineTo(x, y));
        ridge.lineTo(pts[pts.length - 1][0], H + 10);
        ridge.closePath();
      }
    };

    const draw = (ms: number, offX: number, offY: number, angle: number, twinkle: boolean) => {
      const ct = Math.cos(angle), st = Math.sin(angle);
      if (shader) {
        const lst = (((sky.lst * D + angle) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
        shader({ ox: ox - offX, oy: oy - offY, s, dpr, lst, cell, moon: turned(MOON, ct, st) });
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      if (!shader) { ctx.fillStyle = "#06080f"; ctx.fillRect(0, 0, w, h); }

      // The catalogue stars, with a soft glow around the bright ones.
      const t = ms / 1000;
      shown = [];
      for (let i = 0; i < N; i++) {
        sx[i] = NaN;
        const star = STARS[i];
        const v = turned(star, ct, st);
        if (v[2] < 0.0104) continue; // below even the lowest hills
        const alt = Math.asin(Math.min(1, v[2])) / D;
        if (alt < 3.5 && alt < hills((Math.atan2(v[0], v[1]) / D + 360) % 360)) continue;
        const Z = dot(v, f);
        if (Z < -0.3) continue;
        const k = (2 * s) / (1 + Z);
        const x = ox - offX + k * dot(v, right), y = oy - offY - k * dot(v, up);
        if (x < -40 || y < -40 || x > w + 40 || y > h + 40) continue;
        const ext = extinction(alt);
        const flux = Math.pow(10, -0.4 * (star.mag - 1)) * ext;
        let r: number, a: number, c: string;
        if (star.planet) {
          r = Math.min(5, 1.4 + 1.6 * Math.pow(flux, 0.33)); a = 0.98; c = star.c;
          const halo = ctx.createRadialGradient(x, y, 0, x, y, r * 9);
          halo.addColorStop(0, "rgba(255,240,214,0.35)"); halo.addColorStop(1, "rgba(255,240,214,0)");
          ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(x, y, r * 9, 0, Math.PI * 2); ctx.fill();
        } else {
          c = ext > 0.97 ? star.c : starColour(star.bv + (1 - ext) * 0.8).join(",");
          r = Math.max(0.7, Math.min(4.6, 0.85 + 1.6 * Math.pow(flux, 0.33)));
          a = Math.min(1, 0.25 + 0.55 * Math.pow(flux, 0.4));
          if (flux > 0.15) {
            const halo = ctx.createRadialGradient(x, y, 0, x, y, r * 7);
            halo.addColorStop(0, `rgba(${c},${0.22 * Math.min(1, flux)})`);
            halo.addColorStop(1, `rgba(${c},0)`);
            ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(x, y, r * 7, 0, Math.PI * 2); ctx.fill();
          }
        }
        let shine = a;
        if (twinkle && !star.planet && star.mag < 3.4) {
          const amp = 0.12 + 0.35 * (1 - Math.sin(Math.max(alt, 1) * D));
          shine = a * (1 - amp + amp * Math.sin(t * tf[i] * 6.28 + tp[i]));
        }
        ctx.fillStyle = `rgba(${c},${shine})`;
        if (r < 1) ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
        else { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
        sx[i] = x; sy[i] = y; sr[i] = r; sa[i] = a; sc[i] = c;
        shown.push(i);
      }

      // Shooting stars: a bright head with a fading tail, crossing in under a second.
      for (const m of meteors) {
        const life = (ms - m.t0) / m.dur;
        if (life < 0 || life > 1) continue;
        const fade = Math.sin(Math.PI * life);
        const hx = m.x + m.dx * m.len * life * 1.6, hy = m.y + m.dy * m.len * life * 1.6;
        const tx2 = hx - m.dx * m.len * fade, ty2 = hy - m.dy * m.len * fade;
        const tail = ctx.createLinearGradient(tx2, ty2, hx, hy);
        tail.addColorStop(0, "rgba(220,230,255,0)"); tail.addColorStop(1, `rgba(240,244,255,${0.85 * fade})`);
        ctx.strokeStyle = tail; ctx.lineWidth = 1.6; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(tx2, ty2); ctx.lineTo(hx, hy); ctx.stroke();
      }

      // The hills, with the faint orange glow of a town behind them. The glow runs down behind
      // the hills so it never ends in a hard edge.
      if (ridge) {
        ctx.setTransform(dpr, 0, 0, dpr, -offX * dpr, -offY * dpr);
        const top = glowTop - Math.min(H * 0.08, 90);
        const glow = ctx.createLinearGradient(0, top, 0, glowTop + 40);
        glow.addColorStop(0, "rgba(255,150,80,0)"); glow.addColorStop(1, "rgba(255,150,80,0.06)");
        ctx.fillStyle = glow; ctx.fillRect(0, top, W, H - top);
        ctx.fillStyle = "#050507";
        ctx.fill(ridge);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      hot.forEach((e, n) => { if (!isNaN(sx[n])) drawHot(n, e, t); });
    };

    // ---- motion: the sky turns, scroll tilts the view, pointer and phone tilt nudge it ----
    let tx = 0, ty = 0, cx = 0, cy = 0, scroll = 0;
    const range = () => ({ x: (W - w) / 2, y: H - h });
    const readScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      scroll = max > 0 ? Math.min(1, window.scrollY / max) : 0;
    };
    // Hover: find the star nearest the pointer, favouring brighter ones.
    let hover = -1;
    // Where the mouse rests. The sky keeps turning under it, so the star beneath is picked every frame.
    let aimX = 0, aimY = 0, aimOn = false, aimSeen = false;
    const hot = new Map<number, number>(); // star index -> how lit up it is, 0..1
    const nearestStar = (px: number, py: number, reach: number) => {
      let best = reach, found = -1;
      for (const n of shown) {
        const d = Math.hypot(sx[n] - px, sy[n] - py) - sr[n] * 2.5;
        if (d < best) { best = d; found = n; }
      }
      return found;
    };
    const onPointer = (e: PointerEvent) => {
      if (e.pointerType === "touch") return; // fingers tap stars instead; tilt moves the sky
      tx = (e.clientX / w - 0.5) * 2; ty = (e.clientY / h - 0.5) * 2;
      aimX = e.clientX; aimY = e.clientY; aimSeen = true; aimOn = overOpenSky(e.target as Element);
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
    const drawHot = (n: number, e: number, t: number) => {
      const x = sx[n], y = sy[n], c = sc[n];
      const tw = 0.65 + 0.35 * Math.sin(t * 9 + tp[n]) * Math.sin(t * 5.3 + tp[n] * 2);
      const r = sr[n] * (1 + 2.4 * e);
      const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 6);
      glow.addColorStop(0, `rgba(${c},${0.45 * e * tw})`);
      glow.addColorStop(1, `rgba(${c},0)`);
      ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(x, y, r * 6, 0, Math.PI * 2); ctx.fill();
      // Four soft spikes, like a star seen through a lens.
      const len = r * (5 + 4 * tw) * e;
      for (const [dx, dy] of [[1, 0], [0, 1]]) {
        const spike = ctx.createLinearGradient(x - dx * len, y - dy * len, x + dx * len, y + dy * len);
        spike.addColorStop(0, `rgba(${c},0)`); spike.addColorStop(0.5, `rgba(${c},${0.7 * e * tw})`); spike.addColorStop(1, `rgba(${c},0)`);
        ctx.strokeStyle = spike; ctx.lineWidth = Math.max(1, r * 0.35);
        ctx.beginPath(); ctx.moveTo(x - dx * len, y - dy * len); ctx.lineTo(x + dx * len, y + dy * len); ctx.stroke();
      }
      ctx.fillStyle = `rgba(${c},${Math.min(1, sa[n] + 0.5 * e) * (0.75 + 0.25 * tw)})`;
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

    let raf = 0, lastFrame = 0, start = NaN;
    // Shooting stars, in screen coordinates; a new one every few seconds.
    let meteors: { x: number; y: number; dx: number; dy: number; len: number; t0: number; dur: number }[] = [];
    let nextMeteor = 2500;
    const frame = (ms: number) => {
      if (isNaN(start)) start = ms;
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
      if (aimOn) hover = nearestStar(aimX, aimY, 30);
      if (hover >= 0) { const e = hot.get(hover) ?? 0; hot.set(hover, e + (1 - e) * (1 - Math.pow(0.82, dt))); }
      hot.forEach((e, n) => { if (n !== hover) { e *= Math.pow(0.9, dt); if (e < 0.02) hot.delete(n); else hot.set(n, e); } });
      if (ms - start > nextMeteor) {
        const a = (20 + Math.random() * 40) * D * (Math.random() < 0.5 ? 1 : -1);
        meteors = meteors.filter((m) => ms - m.t0 < m.dur);
        meteors.push({ x: w * (0.1 + 0.8 * Math.random()), y: h * (0.05 + 0.45 * Math.random()), dx: Math.sin(a), dy: Math.cos(a) * 0.6, len: 90 + Math.random() * 160, t0: ms, dur: 500 + Math.random() * 600 });
        nextMeteor = ms - start + 3000 + Math.random() * 7000;
      }
      draw(ms, offX, offY, ((ms - start) / 1000) * SPIN, true);
      raf = requestAnimationFrame(frame);
    };
    // With reduced motion the sky stays as it was that night.
    const still = () => {
      readScroll();
      const rg = range();
      draw(0, rg.x, scroll * rg.y, 0, false);
    };

    render();
    readScroll();
    if (reduced) still(); else raf = requestAnimationFrame(frame);

    const onScroll = () => {
      hover = -1; readScroll();
      if (aimSeen) aimOn = overOpenSky(document.elementFromPoint(aimX, aimY));
      if (reduced) still();
    };
    const onLeaveWindow = (e: MouseEvent) => { if (!e.relatedTarget) { hover = -1; aimOn = aimSeen = false; } };
    window.addEventListener("scroll", onScroll, { passive: true });
    if (!reduced) {
      window.addEventListener("pointermove", onPointer, { passive: true });
      document.addEventListener("mouseout", onLeaveWindow);
      window.addEventListener("deviceorientation", onTilt);
      window.addEventListener("pointerdown", askTilt, { once: true });
      window.addEventListener("pointerdown", onTap, { passive: true });
    }
    let timer: ReturnType<typeof setTimeout>;
    const onResize = () => { clearTimeout(timer); timer = setTimeout(() => { hot.clear(); hover = -1; render(); readScroll(); if (reduced) still(); }, 200); };
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

  return (
    <>
      <canvas ref={glRef} className="night-sky" aria-hidden="true" />
      <canvas ref={ref} className="night-sky" aria-hidden="true" />
    </>
  );
}
