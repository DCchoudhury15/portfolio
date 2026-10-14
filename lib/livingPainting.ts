// Makes a painting move along its own brush strokes, in the spirit of Petros Vrellis's animated
// Starry Night. The direction of the strokes is read from the painting itself (the structure
// tensor of its brightness: strokes run across the direction in which colour changes fastest).
// Thousands of short strokes, each carrying the colour of the paint where it starts, then flow
// along those directions and leave trails that slowly melt back into the painting.

type Field = { cols: number; rows: number; cell: number; dx: Float32Array; dy: Float32Array };

/** Stroke direction at every cell of a coarse grid over the painting. */
function strokeField(px: Uint8ClampedArray, w: number, h: number, cell: number): Field {
  const cols = Math.ceil(w / cell), rows = Math.ceil(h / cell);
  // Brightness, averaged into cells.
  const lum = new Float32Array(cols * rows), count = new Float32Array(cols * rows);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const o = (y * w + x) * 4, c = Math.floor(y / cell) * cols + Math.floor(x / cell);
    lum[c] += 0.3 * px[o] + 0.59 * px[o + 1] + 0.11 * px[o + 2]; count[c]++;
  }
  for (let i = 0; i < lum.length; i++) lum[i] /= count[i] || 1;
  // Structure tensor from Sobel gradients.
  const at = (x: number, y: number) => lum[Math.min(rows - 1, Math.max(0, y)) * cols + Math.min(cols - 1, Math.max(0, x))];
  let jxx = new Float32Array(cols * rows), jyy = new Float32Array(cols * rows), jxy = new Float32Array(cols * rows);
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const gx = at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1) - at(x - 1, y - 1) - 2 * at(x - 1, y) - at(x - 1, y + 1);
    const gy = at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1) - at(x - 1, y - 1) - 2 * at(x, y - 1) - at(x + 1, y - 1);
    const i = y * cols + x;
    jxx[i] = gx * gx; jyy[i] = gy * gy; jxy[i] = gx * gy;
  }
  // Smooth the tensor so neighbouring strokes agree and the flow follows the larger swirls.
  const blur = (a: Float32Array) => {
    const out = new Float32Array(a.length), r = 2;
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      let s = 0, n = 0;
      for (let j = -r; j <= r; j++) for (let k = -r; k <= r; k++) {
        const yy = y + j, xx = x + k;
        if (yy >= 0 && yy < rows && xx >= 0 && xx < cols) { s += a[yy * cols + xx]; n++; }
      }
      out[y * cols + x] = s / n;
    }
    return out;
  };
  for (let pass = 0; pass < 3; pass++) { jxx = blur(jxx); jyy = blur(jyy); jxy = blur(jxy); }
  const dx = new Float32Array(cols * rows), dy = new Float32Array(cols * rows);
  for (let i = 0; i < dx.length; i++) {
    // The gradient's direction, turned a quarter turn: along the stroke.
    const a = 0.5 * Math.atan2(2 * jxy[i], jxx[i] - jyy[i]) + Math.PI / 2;
    dx[i] = Math.cos(a); dy[i] = Math.sin(a);
  }
  return { cols, rows, cell, dx, dy };
}

// How much of the painting the moving strokes cover: how quickly trails melt back into the
// painting each step, how wide the strokes are, and how many there are (one per this many pixels).
const FADE = 0.038, WIDTH = 2.5, AREA_PER_STROKE = 34, MAX_STROKES = 10000;

const FADE_VERT = `attribute vec2 aPos; varying vec2 vUv; void main(){ vUv = vec2(aPos.x*0.5 + 0.5, 0.5 - aPos.y*0.5); gl_Position = vec4(aPos, 0.0, 1.0); }`;
const FADE_FRAG = `precision mediump float; varying vec2 vUv; uniform sampler2D uTex; uniform float uAlpha;
void main(){ gl_FragColor = vec4(texture2D(uTex, vUv).rgb, uAlpha); }`;
const STROKE_VERT = `attribute vec2 aPos; attribute vec3 aCol; uniform vec2 uSize; varying vec3 vCol;
void main(){ vCol = aCol; gl_Position = vec4(aPos.x / uSize.x * 2.0 - 1.0, 1.0 - aPos.y / uSize.y * 2.0, 0.0, 1.0); }`;
const STROKE_FRAG = `precision mediump float; varying vec3 vCol; void main(){ gl_FragColor = vec4(vCol, 0.95); }`;

function program(gl: WebGLRenderingContext, vert: string, frag: string) {
  const prog = gl.createProgram()!;
  for (const [type, src] of [[gl.VERTEX_SHADER, vert], [gl.FRAGMENT_SHADER, frag]] as const) {
    const sh = gl.createShader(type)!;
    gl.shaderSource(sh, src); gl.compileShader(sh); gl.attachShader(prog, sh);
  }
  gl.linkProgram(prog);
  return gl.getProgramParameter(prog, gl.LINK_STATUS) ? prog : null;
}

/**
 * Starts the moving painting on a canvas. Everything is drawn by the GPU: each step fades the
 * canvas a little back towards the painting, then draws every moving stroke in one call.
 * Returns a stop function, or null without WebGL.
 */
export function flowPainting(canvas: HTMLCanvasElement, img: HTMLImageElement, focus: [number, number], speed: number, onReady: () => void, vivid = 1) {
  // Weaker strokes (vivid below 1) leave more of the painting clear: fewer of them, thinner,
  // closer to the paint's own colour, and quicker to melt away.
  const gain = 1 + 0.12 * vivid, strokeWidth = WIDTH * (0.7 + 0.3 * vivid), fadeRate = FADE / (0.45 + 0.55 * vivid);
  const gl = canvas.getContext("webgl", { alpha: false, antialias: true, preserveDrawingBuffer: true });
  if (!gl) return null;
  const fade = program(gl, FADE_VERT, FADE_FRAG), strokes = program(gl, STROKE_VERT, STROKE_FRAG);
  if (!fade || !strokes) return null;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const base = document.createElement("canvas");
  const bctx = base.getContext("2d", { willReadFrequently: true })!;

  const quad = gl.createBuffer(), lines = gl.createBuffer(), tex = gl.createTexture();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  for (const [k, v] of [[gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE], [gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
  const fPos = gl.getAttribLocation(fade, "aPos"), fAlpha = gl.getUniformLocation(fade, "uAlpha");
  const sPos = gl.getAttribLocation(strokes, "aPos"), sCol = gl.getAttribLocation(strokes, "aCol"), sSize = gl.getUniformLocation(strokes, "uSize");
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  let w = 0, h = 0;
  let pixels = new Uint8ClampedArray(0);
  let field: Field = { cols: 1, rows: 1, cell: 1, dx: new Float32Array(1), dy: new Float32Array(1) };
  // Particles: position, current direction, remaining life and the paint colour they carry.
  let n = 0, x = new Float32Array(0), y = new Float32Array(0), vx = new Float32Array(0), vy = new Float32Array(0), life = new Float32Array(0);
  let col = new Float32Array(0), verts = new Float32Array(0);

  const spawn = (i: number) => {
    x[i] = Math.random() * w; y[i] = Math.random() * h;
    const angle = Math.random() * Math.PI * 2;
    vx[i] = Math.cos(angle); vy[i] = Math.sin(angle);
    // Strokes live long enough to carry their paint well across the picture.
    life[i] = 70 + Math.random() * 210;
    const o = (Math.floor(y[i]) * w + Math.floor(x[i])) * 4;
    // A shade brighter than the paint underneath, so the moving strokes show over it.
    for (let k = 0; k < 3; k++) col[i * 3 + k] = Math.min(1, (pixels[o + k] * gain) / 255);
  };

  // Writes one corner of a stroke's quad: position, then the particle's colour.
  const corner = (m: number, px: number, py: number, i: number) => {
    verts[m] = px; verts[m + 1] = py; verts[m + 2] = col[i * 3]; verts[m + 3] = col[i * 3 + 1]; verts[m + 4] = col[i * 3 + 2];
    return m + 5;
  };

  const drawFade = (alpha: number) => {
    gl.useProgram(fade);
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.enableVertexAttribArray(fPos); gl.vertexAttribPointer(fPos, 2, gl.FLOAT, false, 0, 0);
    gl.disableVertexAttribArray(sCol);
    gl.uniform1f(fAlpha, alpha);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  // Size to the box, crop the painting to cover it, and read its strokes. One pixel per CSS
  // pixel at most: the paint is soft, and it keeps the work small.
  const fit = () => {
    const box = canvas.getBoundingClientRect();
    const k0 = Math.min(1, 1100 / Math.max(box.width, box.height, 1));
    w = canvas.width = base.width = Math.max(2, Math.round(box.width * k0));
    h = canvas.height = base.height = Math.max(2, Math.round(box.height * k0));
    const k = Math.max(w / img.naturalWidth, h / img.naturalHeight);
    const dw = img.naturalWidth * k, dh = img.naturalHeight * k;
    bctx.drawImage(img, (w - dw) * focus[0], (h - dh) * focus[1], dw, dh);
    pixels = bctx.getImageData(0, 0, w, h).data;
    field = strokeField(pixels, w, h, 4);
    gl.viewport(0, 0, w, h);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, base);
    drawFade(1);
    n = Math.min(MAX_STROKES, Math.round(((w * h) / AREA_PER_STROKE) * Math.min(1, 0.4 + 0.6 * vivid)));
    x = new Float32Array(n); y = new Float32Array(n); vx = new Float32Array(n); vy = new Float32Array(n); life = new Float32Array(n);
    col = new Float32Array(n * 3); verts = new Float32Array(n * 6 * 5);
    gl.bindBuffer(gl.ARRAY_BUFFER, lines);
    gl.bufferData(gl.ARRAY_BUFFER, verts.byteLength, gl.DYNAMIC_DRAW);
    for (let i = 0; i < n; i++) { spawn(i); life[i] *= Math.random(); }
  };
  fit();

  let visible = true, raf = 0, ready = false, last = 0;
  const step = () => {
    // Old trails melt back into the painting.
    drawFade(fadeRate);
    // Move every stroke along the paint and lay it down as a thin quad from where it was.
    const v = 0.82 * speed, half = strokeWidth / 2;
    let m = 0;
    for (let i = 0; i < n; i++) {
      if (--life[i] <= 0) { spawn(i); continue; }
      const c = Math.min(field.rows - 1, Math.floor(y[i] / field.cell)) * field.cols + Math.min(field.cols - 1, Math.floor(x[i] / field.cell));
      let fx = field.dx[c], fy = field.dy[c];
      // Strokes have no arrow on them; keep going the way this particle was already going.
      if (fx * vx[i] + fy * vy[i] < 0) { fx = -fx; fy = -fy; }
      vx[i] = vx[i] * 0.7 + fx * 0.3; vy[i] = vy[i] * 0.7 + fy * 0.3;
      const nx = x[i] + vx[i] * v, ny = y[i] + vy[i] * v;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) { spawn(i); continue; }
      // A quad from where it was to where it is, reaching half a width past both ends like a
      // round brush tip, so successive steps overlap into one continuous stroke.
      const len = Math.hypot(nx - x[i], ny - y[i]) || 1;
      const ux = (nx - x[i]) / len * half, uy = (ny - y[i]) / len * half, ox = -uy, oy = ux;
      const ax = x[i] - ux, ay = y[i] - uy, bx = nx + ux, by = ny + uy;
      m = corner(m, ax + ox, ay + oy, i); m = corner(m, ax - ox, ay - oy, i); m = corner(m, bx + ox, by + oy, i);
      m = corner(m, bx + ox, by + oy, i); m = corner(m, ax - ox, ay - oy, i); m = corner(m, bx - ox, by - oy, i);
      x[i] = nx; y[i] = ny;
    }
    gl.useProgram(strokes);
    gl.uniform2f(sSize, w, h);
    gl.bindBuffer(gl.ARRAY_BUFFER, lines);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, verts.subarray(0, m));
    gl.enableVertexAttribArray(sPos); gl.vertexAttribPointer(sPos, 2, gl.FLOAT, false, 20, 0);
    gl.enableVertexAttribArray(sCol); gl.vertexAttribPointer(sCol, 3, gl.FLOAT, false, 20, 8);
    gl.drawArrays(gl.TRIANGLES, 0, m / 5);
    if (!ready) { ready = true; onReady(); }
  };
  const frame = (ms: number) => {
    // 30 steps a second is plenty for slow paint.
    if (visible && ms - last > 31) { step(); last = ms; }
    raf = requestAnimationFrame(frame);
  };
  const io = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; });
  io.observe(canvas);
  if (reduced) onReady(); else raf = requestAnimationFrame(frame);

  let t: ReturnType<typeof setTimeout>;
  const onResize = () => { clearTimeout(t); t = setTimeout(fit, 200); };
  window.addEventListener("resize", onResize);
  return () => { cancelAnimationFrame(raf); io.disconnect(); clearTimeout(t); window.removeEventListener("resize", onResize); };
}
