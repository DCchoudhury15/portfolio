// Liquid light show: a WebGL fragment shader in the spirit of 1960s oil-projector light shows.
// Domain-warped noise, posterised into jewel-tone bands with dark line work.

export type Look = { seed: number; mode: 0 | 1 | 2 | 3; dim: number; pal: string[] };

export const LOOKS: Record<string, Look> = {
  hero: { seed: 11.3, mode: 0, dim: 0.78, pal: ["#3a0f26", "#7a1f3a", "#b5832e", "#15433f", "#24123f", "#8a4418"] },
  agentward: { seed: 42.1, mode: 2, dim: 0.95, pal: ["#2a0f3a", "#9e2a5e", "#d4a63a", "#14504c", "#5b2a86", "#1a0a1f"] },
  audio: { seed: 7.7, mode: 3, dim: 0.95, pal: ["#0f3a40", "#3b1f5c", "#8e2c6a", "#c9a43a", "#123a5c", "#b5531c"] },
  chatai: { seed: 63.4, mode: 1, dim: 0.95, pal: ["#3a1208", "#a33a14", "#d99a2b", "#1b0f2e", "#6b1a2a", "#2e5d6b"] },
  resumez: { seed: 88.2, mode: 1, dim: 0.95, pal: ["#16362a", "#0b1a14", "#a37a4a", "#2f7a5a", "#8a3a5e", "#1a1060"] },
};

const FRAG = `
precision highp float;
varying vec2 vUv;
uniform vec2 uRes; uniform float uTime; uniform float uSeed; uniform int uMode;
uniform vec3 uPal[6]; uniform float uEnergy; uniform float uDim;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);
  return mix(mix(hash(i), hash(i+vec2(1.0,0.0)), u.x), mix(hash(i+vec2(0.0,1.0)), hash(i+vec2(1.0,1.0)), u.x), u.y); }
float fbm(vec2 p){ float v = 0.0, a = 0.5; mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 5; i++){ v += a*noise(p); p = m*p; a *= 0.5; } return v; }
vec3 pal(float x){ float k = mod(floor(x), 6.0); vec3 c = uPal[0];
  if (k > 0.5) c = uPal[1]; if (k > 1.5) c = uPal[2]; if (k > 2.5) c = uPal[3]; if (k > 3.5) c = uPal[4]; if (k > 4.5) c = uPal[5]; return c; }
void main(){
  vec2 uv = vUv; float asp = uRes.x / uRes.y;
  vec2 p = (uv - 0.5) * vec2(asp, 1.0) * 2.0;
  float t = uTime * 0.045;
  float r = length(p), a = atan(p.y, p.x);
  vec2 q = p;
  if (uMode == 1) { float s = 6.28318 / 8.0; float b = mod(a + t*0.5, s); b = abs(b - s*0.5); q = vec2(cos(b), sin(b)) * r; }
  if (uMode == 2) { float b = a + 2.2*log(r + 0.06) - t*2.0; q = vec2(cos(b), sin(b)) * r; }
  vec2 w1 = vec2(fbm(q*1.2 + uSeed + t), fbm(q*1.2 + uSeed*1.7 - t + 5.2));
  vec2 w2 = vec2(fbm(q*1.5 + 3.0*w1 + vec2(1.7, 9.2) + t*0.7), fbm(q*1.5 + 3.0*w1 + vec2(8.3, 2.8) - t*0.5));
  float f = fbm(q*1.0 + 3.0*(1.0 + uEnergy*0.8)*w2 + uSeed*0.3);
  float x;
  if (uMode == 0) x = f*10.0 + uTime*0.2;
  else if (uMode == 1) x = f*7.0 + r*3.5 - uTime*0.2;
  else if (uMode == 2) x = f*5.0 + r*8.0 - uTime*0.35;
  else { float rays = (a/6.28318)*24.0 + f*3.0 + uTime*0.1; float rings = r*14.0 + f*5.0 - uTime*0.3; x = r < 0.45 ? rings : rays; }
  float e = fract(x);
  float lw = 0.035;
  float line = smoothstep(0.0, lw, e) * (1.0 - smoothstep(1.0 - lw, 1.0, e));
  float band = smoothstep(0.0, 0.5, e) * 0.25 + 0.75;
  vec3 col = mix(vec3(0.02, 0.015, 0.025), pal(x) * band, line);
  vec2 vg = uv - 0.5;
  col *= uDim * (1.0 - 1.1*dot(vg, vg)) + uEnergy * 0.18;
  col += (hash(uv*uRes + floor(uTime*24.0)) - 0.5) * 0.035;
  gl_FragColor = vec4(col, 1.0);
}`;

const VERT = `attribute vec2 aPos; varying vec2 vUv; void main(){ vUv = aPos*0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;

const hex3 = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);

export type Draw = (look: Look, time: number, energy: number) => void;

export function createLightShow(canvas: HTMLCanvasElement, keepBuffer = false): Draw | null {
  const gl = canvas.getContext("webgl", { antialias: false, preserveDrawingBuffer: keepBuffer });
  if (!gl) return null;
  const compile = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? "shader error");
    return s;
  };
  const prog = gl.createProgram()!;
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) ?? "link error");
  gl.useProgram(prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "aPos");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const u = (n: string) => gl.getUniformLocation(prog, n);
  const U = { res: u("uRes"), time: u("uTime"), seed: u("uSeed"), mode: u("uMode"), pal: u("uPal"), energy: u("uEnergy"), dim: u("uDim") };

  return (look, time, energy) => {
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(U.res, canvas.width, canvas.height);
    gl.uniform1f(U.time, time);
    gl.uniform1f(U.seed, look.seed);
    gl.uniform1i(U.mode, look.mode);
    gl.uniform3fv(U.pal, new Float32Array(look.pal.flatMap(hex3)));
    gl.uniform1f(U.energy, energy);
    gl.uniform1f(U.dim, look.dim);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
}

// One shared offscreen renderer paints every album sleeve, so the page holds only two WebGL
// contexts however many sleeves there are. Visible sleeves are animated from a single loop.
const SLEEVE_PX = 512;
let sleeveCanvas: HTMLCanvasElement | null = null;
let sleeveDraw: Draw | null | undefined;
const sleeves = new Map<HTMLCanvasElement, { look: Look; visible: boolean }>();
let loop = 0;

function renderer(): Draw | null {
  if (sleeveDraw === undefined) {
    sleeveCanvas = document.createElement("canvas");
    sleeveCanvas.width = sleeveCanvas.height = SLEEVE_PX;
    try { sleeveDraw = createLightShow(sleeveCanvas, true); } catch { sleeveDraw = null; }
  }
  return sleeveDraw;
}

function paint(target: HTMLCanvasElement, look: Look, time: number): boolean {
  const draw = renderer();
  const ctx = target.getContext("2d");
  if (!draw || !sleeveCanvas || !ctx) return false;
  draw(look, time, 0);
  ctx.drawImage(sleeveCanvas, 0, 0, target.width, target.height);
  return true;
}

// Each sleeve starts at its own point in time so the four covers never look alike.
const startTime = (look: Look) => 30 + (look.seed % 13);

function tick(ms: number) {
  let any = false;
  sleeves.forEach((s, canvas) => { if (s.visible) { any = true; paint(canvas, s.look, startTime(s.look) + ms / 1000); } });
  loop = any ? requestAnimationFrame(tick) : 0;
}

/** Paints a sleeve and keeps it moving while it is on screen. Returns a cleanup function,
 *  or null if WebGL is unavailable. */
export function animateSleeve(canvas: HTMLCanvasElement, look: Look): (() => void) | null {
  if (!paint(canvas, look, startTime(look))) return null;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return () => {};
  sleeves.set(canvas, { look, visible: false });
  const io = new IntersectionObserver(([entry]) => {
    const s = sleeves.get(canvas);
    if (!s) return;
    s.visible = entry.isIntersecting;
    if (s.visible && !loop) loop = requestAnimationFrame(tick);
  });
  io.observe(canvas);
  return () => { io.disconnect(); sleeves.delete(canvas); };
}
