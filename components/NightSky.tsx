"use client";

import { useEffect, useRef } from "react";
import sky from "@/lib/sky.json";

/**
 * The real sky over Jabalpur at 9 pm on the night I was born, drawn like a long-exposure photo
 * looking south-east, where the core of the Milky Way was rising over Scorpius.
 *
 * The sky turns the way the real one does, sped up like a time-lapse video: stars glide from left
 * to right over the mountains, and now and then a shooting star crosses.
 * The sky glow, the Milky Way, the faint stars and every named star and planet are drawn on the
 * GPU, and so are the mountains in front; a 2D canvas above holds only shooting stars and lit-up stars, redrawn
 * only when one of them changes. Scrolling tilts the view from high overhead down
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

// Small deterministic noise, the same as in the shaders, so the page knows exactly where the
// mountains are (to hide stars behind them when hovering).
const frac = (v: number) => v - Math.floor(v);
function hash(x: number, y: number) {
  const a = frac(x * 0.1031), b = frac(y * 0.1031), c = a;
  const d = a * (b + 33.33) + b * (c + 33.33) + c * (a + 33.33);
  return frac((a + d + b + d) * (c + d));
}
function noise(x: number, y: number) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x: number, y: number) { let s = 0, a = 0.5; for (let i = 0; i < 4; i++) { s += a * noise(x, y); x *= 2.03; y *= 2.03; a *= 0.5; } return s; }
function ridged(x: number, y: number) { let s = 0, a = 0.55; for (let i = 0; i < 5; i++) { const n = 1 - Math.abs(2 * noise(x, y) - 1); s += a * n * n; x *= 2.1; y *= 2.1; a *= 0.45; } return s; }
// The landscape, as height above the horizon (degrees) at each compass direction: a far range of
// sharp peaks, a lower middle range, and near foothills with a pine treeline.
const farH = (az: number) => { const r = ridged(az * 0.05, 5.3); return 1.5 + 10 * Math.pow(r, 1.5) + 1.3 * ridged(az * 0.32, 8.7) * r; };
const midH = (az: number) => 0.8 + 4.5 * Math.pow(ridged(az * 0.08 + 3.1, 1.7), 1.3) + 0.6 * fbm(az * 0.5, 4.4);
const trees = (az: number) => {
  const c = Math.floor(az / 0.3), t = frac(az / 0.3);
  const forest = Math.min(1, Math.max(0, (fbm(az * 0.08, 1.1) - 0.35) / 0.25));
  return hash(c, 7.7) > 0.2 ? forest * (0.45 + 0.8 * hash(c, 3.3)) * (1 - Math.abs(2 * t - 1)) : 0;
};
const nearH = (az: number) => 0.3 + 1.6 * fbm(az * 0.045, 3.7) + 0.35 * fbm(az * 0.3, 9.1) + trees(az);
const skyline = (az: number) => Math.max(farH(az), midH(az), nearH(az));

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
    float mw = 1.1*m*min(1.0, sqrt(ext)*1.5)*(alt < 4.0 ? max(0.0, alt + 1.0)/5.0 : 1.0);
    float warm = exp(-sq((l > 180.0 ? l - 360.0 : l)/25.0));
    // Violet along the band and a warm, golden core, as the Milky Way looks in long exposures.
    col += mw*mix(vec3(46.0, 42.0, 66.0), vec3(70.0, 60.0, 46.0), warm);
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

// The named stars and planets, drawn by the GPU as soft points. Each star's place is turned with
// the sky and projected in the vertex shader, so the page's own code does almost nothing per frame.
const STAR_VERT = `
precision highp float;
attribute vec3 aPolar; attribute vec4 aLook; // sd, A, B | magnitude, colour index, planet, twinkle phase
uniform vec2 uTurn; uniform vec2 uLat; uniform vec3 uF; uniform vec3 uR; uniform vec3 uUp;
uniform vec2 uOrigin; uniform float uS; uniform float uDpr; uniform vec2 uSize; uniform float uTime; uniform float uTwinkle;
varying vec3 vCol; varying vec3 vHaloCol; varying float vA; varying float vR; varying float vHalo; varying float vSize;
const float D = 0.0174532925;
vec3 starColour(float bv){
  float t = clamp((bv + 0.3)/2.0, 0.0, 1.0);
  vec3 c0 = vec3(165.0,188.0,255.0), c1 = vec3(232.0,236.0,255.0), c2 = vec3(255.0,246.0,232.0), c3 = vec3(255.0,216.0,168.0), c4 = vec3(255.0,178.0,122.0);
  vec3 c = t < 0.25 ? mix(c0, c1, t/0.25) : t < 0.45 ? mix(c1, c2, (t-0.25)/0.2) : t < 0.7 ? mix(c2, c3, (t-0.45)/0.25) : mix(c3, c4, (t-0.7)/0.3);
  return c/255.0;
}
void main(){
  float ch = aPolar.y*uTurn.x - aPolar.z*uTurn.y, sh = aPolar.z*uTurn.x + aPolar.y*uTurn.y;
  vec3 v = vec3(-sh, aPolar.x*uLat.y - ch*uLat.x, aPolar.x*uLat.x + ch*uLat.y);
  float Z = dot(v, uF);
  if (v.z < 0.0 || Z < -0.3) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; return; }
  float alt = asin(min(v.z, 1.0))/D;
  float k = 2.0*uS/(1.0 + Z);
  vec2 p = vec2(uOrigin.x + k*dot(v, uR), uOrigin.y - k*dot(v, uUp));
  // Atmosphere: stars fade and redden as they sink towards the horizon.
  float ext = pow(10.0, -0.1*(1.0/max(sin(max(alt, 0.5)*D), 0.05) - 1.0));
  float flux = pow(10.0, -0.4*(aLook.x - 1.0))*ext;
  float r, a, halo, haloR;
  if (aLook.z > 0.5) { // a planet: steady, with a warm glow
    r = min(5.0, 1.4 + 1.6*pow(flux, 0.33)); a = 0.98; halo = 0.35; haloR = r*9.0;
    vCol = vec3(1.0, 0.965, 0.894); vHaloCol = vec3(1.0, 0.94, 0.84);
  } else {
    r = clamp(0.85 + 1.6*pow(flux, 0.33), 0.7, 4.6); a = min(1.0, 0.25 + 0.55*pow(flux, 0.4));
    halo = flux > 0.15 ? 0.22*min(1.0, flux) : 0.0; haloR = r*7.0;
    vCol = starColour(aLook.y + (1.0 - ext)*0.8); vHaloCol = vCol;
    if (uTwinkle > 0.5 && aLook.x < 3.4) {
      float amp = 0.12 + 0.35*(1.0 - sin(max(alt, 1.0)*D));
      a *= 1.0 - amp + amp*sin(uTime*(0.5 + fract(aLook.w*7.13)*1.6)*6.28 + aLook.w);
    }
  }
  vA = a; vR = r; vHalo = halo;
  vSize = halo > 0.0 ? haloR : r + 1.0;
  gl_PointSize = 2.0*vSize*uDpr;
  gl_Position = vec4(p.x/uSize.x*2.0 - 1.0, 1.0 - p.y/uSize.y*2.0, 0.0, 1.0);
}`;

const STAR_FRAG = `
precision mediump float;
varying vec3 vCol; varying vec3 vHaloCol; varying float vA; varying float vR; varying float vHalo; varying float vSize;
void main(){
  float d = length(gl_PointCoord*2.0 - 1.0)*vSize; // distance from the centre in CSS pixels
  float core = vA*clamp(vR + 0.5 - d, 0.0, 1.0);
  float glow = vHalo*max(0.0, 1.0 - d/vSize);
  float alpha = core + glow*(1.0 - core);
  if (alpha < 0.003) discard;
  gl_FragColor = vec4((vCol*core + vHaloCol*glow*(1.0 - core)), alpha);
}`;

// The mountains, drawn over the sky and stars a pixel at a time: three ranges with depth, rock
// lit on the side facing the Moon, a little snow in the gullies near the highest summits, and
// mist lying low between the ranges.
const MOUNT_FRAG = `
precision highp float;
uniform vec2 uOrigin; uniform float uS; uniform float uDpr; uniform float uH;
uniform vec3 uF; uniform vec3 uR; uniform vec3 uUp; uniform vec3 uMoon; uniform float uSnow;
const float D = 0.0174532925;
float hash(vec2 p){ vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p), u = f*f*(3.0-2.0*f);
  return mix(mix(hash(i), hash(i+vec2(1.0,0.0)), u.x), mix(hash(i+vec2(0.0,1.0)), hash(i+vec2(1.0,1.0)), u.x), u.y); }
float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++){ s += a*noise(p); p *= 2.03; a *= 0.5; } return s; }
float ridged(vec2 p){ float s = 0.0, a = 0.55; for (int i = 0; i < 5; i++){ float n = 1.0 - abs(2.0*noise(p) - 1.0); s += a*n*n; p *= 2.1; a *= 0.45; } return s; }
float farH(float az){ float r = ridged(vec2(az*0.05, 5.3)); return 1.5 + 10.0*pow(r, 1.5) + 1.3*ridged(vec2(az*0.32, 8.7))*r; }
float midH(float az){ return 0.8 + 4.5*pow(ridged(vec2(az*0.08 + 3.1, 1.7)), 1.3) + 0.6*fbm(vec2(az*0.5, 4.4)); }
// The broad shape of each range, without its fine detail: lighting follows this, so faces are smooth.
float farShape(float az){ return 10.0*pow(ridged(vec2(az*0.05, 5.3)), 1.5); }
float midShape(float az){ return 4.5*pow(ridged(vec2(az*0.08 + 3.1, 1.7)), 1.3); }
float trees(float az){
  float c = floor(az/0.3), t = fract(az/0.3);
  float forest = clamp((fbm(vec2(az*0.08, 1.1)) - 0.35)/0.25, 0.0, 1.0);
  return hash(vec2(c, 7.7)) > 0.2 ? forest*(0.45 + 0.8*hash(vec2(c, 3.3)))*(1.0 - abs(2.0*t - 1.0)) : 0.0;
}
float nearH(float az){ return 0.3 + 1.6*fbm(vec2(az*0.045, 3.7)) + 0.35*fbm(vec2(az*0.3, 9.1)) + trees(az); }
void main(){
  vec2 p = vec2(gl_FragCoord.x, uH - gl_FragCoord.y) / uDpr;
  float kx = (p.x - uOrigin.x)/uS, ky = (uOrigin.y - p.y)/uS, r2 = kx*kx + ky*ky;
  float Z = (4.0 - r2)/(4.0 + r2);
  vec3 v = 0.5*(1.0 + Z)*(kx*uR + ky*uUp) + Z*uF;
  float alt = asin(clamp(v.z, -1.0, 1.0))/D;
  if (alt > 14.0) discard;
  float az = mod(atan(v.x, v.y)/D + 360.0, 360.0);
  float px = (1.0 + Z)/(2.0*uS)/D; // degrees per CSS pixel, for soft edges
  float hf = farH(az), hm = midH(az), hn = nearH(az);
  float cf = clamp((hf - alt)/px + 0.5, 0.0, 1.0), cm = clamp((hm - alt)/px + 0.5, 0.0, 1.0), cn = clamp((hn - alt)/px + 0.5, 0.0, 1.0);
  if (cf + cm + cn <= 0.0) discard;
  // Moonlight: which side it comes from across the screen, and how high the Moon is.
  float moonUp = smoothstep(-0.05, 0.25, uMoon.z);
  float side = sin(atan(uMoon.x, uMoon.y) - az*D) > 0.0 ? 1.0 : -1.0;
  // The far range: dark rock, faintly lit on the broad slopes that face the Moon, with a little
  // snow on the very tops of the highest peaks.
  float slope = (farShape(az + 1.0) - farShape(az - 1.0))/2.0;
  // Light is strongest just under the crest and fades down the face, so lit faces taper like real ones.
  float lit = clamp(-slope*side*0.5, 0.0, 1.0)*(0.3 + 0.7*moonUp)*smoothstep(5.0, 0.3, hf - alt);
  float rock = fbm(vec2(az*0.9, alt*1.6));
  vec3 far = vec3(10.0, 12.0, 18.0)*(0.75 + 0.5*rock) + vec3(22.0, 26.0, 37.0)*lit;
  float snow = smoothstep(uSnow, uSnow + 0.45, alt + (noise(vec2(az*2.0, alt*1.4)) - 0.5)*0.5 + lit*0.2);
  far = mix(far, mix(vec3(70.0, 76.0, 92.0), vec3(176.0, 184.0, 204.0), clamp(lit*1.6, 0.0, 1.0)), snow*0.85);
  far += vec3(44.0, 50.0, 70.0)*exp(-(hf - alt)/(px*1.6 + 0.03))*0.3*(0.4 + 0.6*moonUp); // the crest catching the sky
  far = mix(far, vec3(24.0, 24.0, 33.0), exp(-max(alt - hm, 0.0)/0.8)*0.35); // mist above the middle range
  // The middle range: darker and closer.
  float slopeM = (midShape(az + 1.0) - midShape(az - 1.0))/2.0;
  float litM = clamp(-slopeM*side*0.4, 0.0, 1.0)*(0.3 + 0.7*moonUp)*smoothstep(3.0, 0.2, hm - alt);
  vec3 mid = vec3(6.0, 7.0, 11.0)*(0.85 + 0.3*fbm(vec2(az*1.2, alt*2.0))) + vec3(9.0, 10.0, 15.0)*litM;
  mid = mix(mid, vec3(17.0, 17.0, 24.0), exp(-max(alt - hn, 0.0)/0.5)*0.3); // mist above the foothills
  // The foothills and their trees: black.
  vec3 near = vec3(4.0, 4.0, 6.0);
  // Layer them back to front, premultiplied for blending over the sky.
  vec3 c = far*cf; float a = cf;
  c = mid*cm + c*(1.0 - cm); a = cm + a*(1.0 - cm);
  c = near*cn + c*(1.0 - cn); a = cn + a*(1.0 - cn);
  gl_FragColor = vec4(c/255.0, a);
}`;

type SkyView = { ox: number; oy: number; s: number; dpr: number; w: number; h: number; angle: number; time: number; twinkle: boolean; cell: [number, number]; snow: number };

function compile(gl: WebGLRenderingContext, vert: string, frag: string) {
  const prog = gl.createProgram()!;
  for (const [type, src] of [[gl.VERTEX_SHADER, vert], [gl.FRAGMENT_SHADER, frag]] as const) {
    const sh = gl.createShader(type)!;
    gl.shaderSource(sh, src); gl.compileShader(sh); gl.attachShader(prog, sh);
  }
  gl.linkProgram(prog);
  return gl.getProgramParameter(prog, gl.LINK_STATUS) ? prog : null;
}

/** The sky glow, Milky Way, faint stars and then every named star and planet, all on the GPU. */
function createSkyRenderer(canvas: HTMLCanvasElement, f: Vec, right: Vec, up: Vec) {
  const gl = canvas.getContext("webgl", { antialias: false, alpha: false, depth: false });
  if (!gl) return null;
  const sky = compile(gl, VERT, FRAG), stars = compile(gl, STAR_VERT, STAR_FRAG), land = compile(gl, VERT, MOUNT_FRAG);
  if (!sky || !stars || !land) return null;

  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  // Seven numbers per star: where it is on the sphere, then how it looks.
  const data = new Float32Array(STARS.length * 7);
  STARS.forEach((st, i) => data.set([st.sd, st.A, st.B, st.mag, st.bv, st.planet ? 1 : 0, Math.random() * 6.28], i * 7));
  const starBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, starBuf);
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);

  const loc = (prog: WebGLProgram, names: string[]) => Object.fromEntries(names.map((n) => [n, gl.getUniformLocation(prog, n)]));
  const u = loc(sky, ["uOrigin", "uS", "uDpr", "uH", "uF", "uR", "uUp", "uLat", "uLst", "uCell", "uMoon"]);
  const us = loc(stars, ["uTurn", "uLat", "uF", "uR", "uUp", "uOrigin", "uS", "uDpr", "uSize", "uTime", "uTwinkle"]);
  const ul = loc(land, ["uOrigin", "uS", "uDpr", "uH", "uF", "uR", "uUp", "uMoon", "uSnow"]);
  const aLand = gl.getAttribLocation(land, "aPos");
  gl.useProgram(land);
  gl.uniform3fv(ul.uF, f); gl.uniform3fv(ul.uR, right); gl.uniform3fv(ul.uUp, up);
  const aPos = gl.getAttribLocation(sky, "aPos"), aPolar = gl.getAttribLocation(stars, "aPolar"), aLook = gl.getAttribLocation(stars, "aLook");
  gl.useProgram(sky);
  gl.uniform3fv(u.uF, f); gl.uniform3fv(u.uR, right); gl.uniform3fv(u.uUp, up);
  gl.uniform2f(u.uLat, sinLat, cosLat);
  gl.useProgram(stars);
  gl.uniform3fv(us.uF, f); gl.uniform3fv(us.uR, right); gl.uniform3fv(us.uUp, up);
  gl.uniform2f(us.uLat, sinLat, cosLat);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  return (v: SkyView) => {
    const ct = Math.cos(v.angle), st = Math.sin(v.angle);
    gl.viewport(0, 0, canvas.width, canvas.height);
    // The sky itself.
    gl.useProgram(sky);
    gl.disable(gl.BLEND);
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.enableVertexAttribArray(aPos); gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    gl.uniform2f(u.uOrigin, v.ox, v.oy);
    gl.uniform1f(u.uS, v.s); gl.uniform1f(u.uDpr, v.dpr); gl.uniform1f(u.uH, canvas.height);
    gl.uniform1f(u.uLst, (((sky_lst + v.angle) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI));
    gl.uniform2f(u.uCell, v.cell[0], v.cell[1]);
    gl.uniform3fv(u.uMoon, turned(MOON, ct, st));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.disableVertexAttribArray(aPos);
    // The stars over it.
    gl.useProgram(stars);
    gl.enable(gl.BLEND);
    gl.bindBuffer(gl.ARRAY_BUFFER, starBuf);
    gl.enableVertexAttribArray(aPolar); gl.vertexAttribPointer(aPolar, 3, gl.FLOAT, false, 28, 0);
    gl.enableVertexAttribArray(aLook); gl.vertexAttribPointer(aLook, 4, gl.FLOAT, false, 28, 12);
    gl.uniform2f(us.uTurn, ct, st);
    gl.uniform2f(us.uOrigin, v.ox, v.oy);
    gl.uniform1f(us.uS, v.s); gl.uniform1f(us.uDpr, v.dpr);
    gl.uniform2f(us.uSize, v.w, v.h);
    gl.uniform1f(us.uTime, v.time); gl.uniform1f(us.uTwinkle, v.twinkle ? 1 : 0);
    gl.drawArrays(gl.POINTS, 0, STARS.length);
    gl.disableVertexAttribArray(aPolar); gl.disableVertexAttribArray(aLook);
    // The mountains in front of everything.
    gl.useProgram(land);
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.enableVertexAttribArray(aLand); gl.vertexAttribPointer(aLand, 2, gl.FLOAT, false, 0, 0);
    gl.uniform2f(ul.uOrigin, v.ox, v.oy);
    gl.uniform1f(ul.uS, v.s); gl.uniform1f(ul.uDpr, v.dpr); gl.uniform1f(ul.uH, canvas.height);
    gl.uniform3fv(ul.uMoon, turned(MOON, ct, st));
    gl.uniform1f(ul.uSnow, v.snow);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.disableVertexAttribArray(aLand);
  };
}
const sky_lst = sky.lst * D;

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
    const renderSky = createSkyRenderer(glCanvas, f, right, up);


    let w = 0, h = 0, W = 0, H = 0, dpr = 1, s = 1, ox = 0, oy = 0;
    let cell: [number, number] = [1, 1];
    let snowLine = 99;
    const N = STARS.length;
    const tp = Float32Array.from(STARS, () => Math.random() * 6.28); // sparkle phase for lit stars

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

      // Snow only reaches a little way down from the highest summits in view.
      let top = 0;
      for (let az = VIEW_AZ - 70; az <= VIEW_AZ + 70; az += 0.25) top = Math.max(top, farH(az));
      snowLine = top - 1.5;
    };

    // Where one star is on screen now, for hovering: null when it is hidden. Only worked out
    // while the pointer is over the sky; the drawing itself happens on the GPU.
    const place = (i: number, ct: number, st: number, offX: number, offY: number, look = false) => {
      const star = STARS[i];
      const v = turned(star, ct, st);
      if (v[2] < 0.0104) return null;
      const alt = Math.asin(Math.min(1, v[2])) / D;
      if (alt < 14 && alt < skyline((Math.atan2(v[0], v[1]) / D + 360) % 360)) return null;
      const Z = dot(v, f);
      if (Z < -0.3) return null;
      const k = (2 * s) / (1 + Z);
      const x = ox - offX + k * dot(v, right), y = oy - offY - k * dot(v, up);
      if (x < -20 || y < -20 || x > w + 20 || y > h + 20) return null;
      const ext = extinction(alt), flux = Math.pow(10, -0.4 * (star.mag - 1)) * ext;
      const r = star.planet ? Math.min(5, 1.4 + 1.6 * Math.pow(flux, 0.33)) : Math.max(0.7, Math.min(4.6, 0.85 + 1.6 * Math.pow(flux, 0.33)));
      const a = star.planet ? 0.98 : Math.min(1, 0.25 + 0.55 * Math.pow(flux, 0.4));
      const c = !look || star.planet || ext > 0.97 ? star.c : starColour(star.bv + (1 - ext) * 0.8).join(",");
      return { x, y, r, a, c };
    };

    // The 2D layer: shooting stars and lit-up stars. Redrawn only when something on it changes.
    const drawOverlay = (ms: number, offX: number, offY: number, ct: number, st: number) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      if (!renderSky) { ctx.fillStyle = "#06080f"; ctx.fillRect(0, 0, w, h); }

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

      hot.forEach((e, n) => { const p = place(n, ct, st, offX, offY, true); if (p) drawHot(p, n, e, ms / 1000); });
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
    let turn = { ct: 1, st: 0, offX: 0, offY: 0 };
    const nearestStar = (px: number, py: number, reach: number) => {
      let best = reach, found = -1;
      for (let i = 0; i < N; i++) {
        const p = place(i, turn.ct, turn.st, turn.offX, turn.offY);
        if (!p || Math.abs(p.x - px) > reach + 12 || Math.abs(p.y - py) > reach + 12) continue;
        const d = Math.hypot(p.x - px, p.y - py) - p.r * 2.5;
        if (d < best) { best = d; found = i; }
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
    const drawHot = (p: { x: number; y: number; r: number; a: number; c: string }, n: number, e: number, t: number) => {
      const { x, y, c } = p;
      const tw = 0.65 + 0.35 * Math.sin(t * 9 + tp[n]) * Math.sin(t * 5.3 + tp[n] * 2);
      const r = p.r * (1 + 2.4 * e);
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
      ctx.fillStyle = `rgba(${c},${Math.min(1, p.a + 0.5 * e) * (0.75 + 0.25 * tw)})`;
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

    let raf = 0, lastFrame = 0, start = NaN, lastSky = -1e9, lastX = NaN, lastY = NaN, overlayBusy = true;
    // Shooting stars, in screen coordinates; a new one every few seconds.
    let meteors: { x: number; y: number; dx: number; dy: number; len: number; t0: number; dur: number }[] = [];
    let nextMeteor = 2500;
    const frame = (ms: number) => {
      raf = requestAnimationFrame(frame);
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
      const moved = Math.abs(offX - lastX) > 0.05 || Math.abs(offY - lastY) > 0.05;
      const angle = ((ms - start) / 1000) * SPIN;
      turn = { ct: Math.cos(angle), st: Math.sin(angle), offX, offY };

      if (aimOn) hover = nearestStar(aimX, aimY, 30);
      if (hover >= 0) { const e = hot.get(hover) ?? 0; hot.set(hover, e + (1 - e) * (1 - Math.pow(0.82, dt))); }
      hot.forEach((e, n) => { if (n !== hover) { e *= Math.pow(0.9, dt); if (e < 0.02) hot.delete(n); else hot.set(n, e); } });
      if (ms - start > nextMeteor) {
        const a = (20 + Math.random() * 40) * D * (Math.random() < 0.5 ? 1 : -1);
        meteors = meteors.filter((m) => ms - m.t0 < m.dur);
        meteors.push({ x: w * (0.1 + 0.8 * Math.random()), y: h * (0.05 + 0.45 * Math.random()), dx: Math.sin(a), dy: Math.cos(a) * 0.6, len: 90 + Math.random() * 160, t0: ms, dur: 500 + Math.random() * 600 });
        nextMeteor = ms - start + 3000 + Math.random() * 7000;
      }
      const meteorLive = meteors.some((m) => ms - m.t0 < m.dur);
      const lively = moved || hot.size > 0 || meteorLive;

      // The slow turning alone needs only about 30 frames a second; scrolling, the pointer,
      // shooting stars and lit stars get every frame.
      if (lively || ms - lastSky > 33) {
        renderSky?.({ ox: ox - offX, oy: oy - offY, s, dpr, w, h, angle, time: ms / 1000, twinkle: true, cell, snow: snowLine });
        lastSky = ms;
      }
      if (lively || overlayBusy) {
        drawOverlay(ms, offX, offY, turn.ct, turn.st);
        // One more clean redraw after the last meteor or glow fades, then the layer rests.
        overlayBusy = hot.size > 0 || meteorLive;
      }
      lastX = offX; lastY = offY;
    };
    // With reduced motion the sky stays as it was that night.
    const still = () => {
      readScroll();
      const rg = range();
      renderSky?.({ ox: ox - rg.x, oy: oy - scroll * rg.y, s, dpr, w, h, angle: 0, time: 0, twinkle: false, cell, snow: snowLine });
      drawOverlay(0, rg.x, scroll * rg.y, 1, 0);
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
    const onResize = () => { clearTimeout(timer); timer = setTimeout(() => { hot.clear(); hover = -1; render(); readScroll(); lastX = NaN; overlayBusy = true; if (reduced) still(); }, 200); };
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
