// Makes a painting flow slowly into itself: a WebGL shader pushes the image along a gentle,
// ever-changing current (the curl of a noise field). Two copies, half a cycle apart, are
// cross-faded so the paint keeps flowing without smearing further and further.

const VERT = `attribute vec2 aPos; varying vec2 vUv; void main(){ vUv = aPos*0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;

const FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uTex; uniform float uTime; uniform vec2 uScale; uniform vec2 uOffset; uniform float uAmp;
float hash(vec2 p){ vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p), u = f*f*(3.0-2.0*f);
  return mix(mix(hash(i), hash(i+vec2(1.0,0.0)), u.x), mix(hash(i+vec2(0.0,1.0)), hash(i+vec2(1.0,1.0)), u.x), u.y); }
float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 3; i++){ s += a*noise(p); p *= 2.03; a *= 0.5; } return s; }
// The current: the curl of a slowly changing noise field, so it swirls without bunching up.
vec2 current(vec2 p, float t){
  const float e = 0.02;
  vec2 q = p + vec2(t, -t*0.7);
  float dy = fbm(q + vec2(0.0, e)) - fbm(q - vec2(0.0, e));
  float dx = fbm(q + vec2(e, 0.0)) - fbm(q - vec2(e, 0.0));
  return vec2(dy, -dx) / (2.0*e);
}
void main(){
  vec2 uv = vec2(vUv.x, 1.0 - vUv.y) * uScale + uOffset; // cover-crop into the painting
  vec2 c = current(uv*2.5, uTime*0.02) * uAmp;
  float pa = fract(uTime*0.05), pb = fract(uTime*0.05 + 0.5);
  vec4 a = texture2D(uTex, uv - c*pa);
  vec4 b = texture2D(uTex, uv - c*pb);
  float wa = 1.0 - abs(2.0*pa - 1.0);
  gl_FragColor = vec4(mix(b.rgb, a.rgb, wa), 1.0);
}`;

/** Starts the flowing painting on a canvas. Returns a stop function, or null without WebGL. */
export function flowPainting(canvas: HTMLCanvasElement, img: HTMLImageElement, focus: [number, number], amp: number, onReady: () => void) {
  const gl = canvas.getContext("webgl", { antialias: false, alpha: false, premultipliedAlpha: false });
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
  gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
  const u = (n: string) => gl.getUniformLocation(prog, n);
  const uTime = u("uTime"), uScale = u("uScale"), uOffset = u("uOffset");
  gl.uniform1f(u("uAmp"), amp);

  // Size the canvas to its box and crop the painting to cover it, like object-fit: cover.
  const fit = () => {
    const box = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.max(2, Math.min(1400, Math.round(box.width * dpr)));
    canvas.height = Math.max(2, Math.min(1400, Math.round(box.height * dpr)));
    const boxAspect = box.width / Math.max(box.height, 1), imgAspect = img.naturalWidth / img.naturalHeight;
    const sx = boxAspect < imgAspect ? boxAspect / imgAspect : 1, sy = boxAspect < imgAspect ? 1 : imgAspect / boxAspect;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(uScale, sx, sy);
    gl.uniform2f(uOffset, (1 - sx) * focus[0], (1 - sy) * focus[1]);
  };
  fit();

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let visible = true, raf = 0, ready = false;
  const draw = (ms: number) => {
    gl.uniform1f(uTime, 30 + ms / 1000);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (!ready) { ready = true; onReady(); }
  };
  const frame = (ms: number) => {
    if (visible) draw(ms);
    raf = requestAnimationFrame(frame);
  };
  const io = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; });
  io.observe(canvas);
  if (reduced) draw(0); else raf = requestAnimationFrame(frame);

  let t: ReturnType<typeof setTimeout>;
  const onResize = () => { clearTimeout(t); t = setTimeout(() => { fit(); if (reduced) draw(0); }, 150); };
  window.addEventListener("resize", onResize);
  return () => { cancelAnimationFrame(raf); io.disconnect(); clearTimeout(t); window.removeEventListener("resize", onResize); };
}
