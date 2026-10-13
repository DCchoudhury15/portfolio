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

/**
 * A soft, irregular mask: opaque in the middle, thinning out like mist towards a wandering edge,
 * so the painting dissolves into the sky without any circle or other shape around it.
 */
function mistMask(w: number, h: number) {
  const N = 128, m = document.createElement("canvas");
  m.width = N; m.height = N;
  const g = m.getContext("2d")!, img = g.createImageData(N, N);
  const ph = Array.from({ length: 6 }, () => Math.random() * Math.PI * 2);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const u = (i + 0.5) / N * 2 - 1, v = (j + 0.5) / N * 2 - 1;
    const d = Math.hypot(u, v), a = Math.atan2(v, u);
    // The edge wanders in and out around the painting, and the fade is wide and patchy.
    const edge = 0.92 + 0.07 * Math.sin(2 * a + ph[0]) + 0.06 * Math.sin(3 * a + ph[1]) + 0.04 * Math.sin(5 * a + ph[2]);
    const patch = 0.08 * Math.sin(u * 5 + ph[3]) * Math.sin(v * 4 + ph[4]) + 0.05 * Math.sin((u + v) * 7 + ph[5]);
    const t = Math.min(1, Math.max(0, (d + patch - edge * 0.25) / (edge * 0.75)));
    const alpha = 1 - t * t * (3 - 2 * t);
    img.data[(j * N + i) * 4 + 3] = Math.round(255 * alpha);
  }
  g.putImageData(img, 0, 0);
  const out = document.createElement("canvas");
  out.width = w; out.height = h;
  const o = out.getContext("2d")!;
  o.imageSmoothingQuality = "high";
  o.drawImage(m, 0, 0, w, h);
  return out;
}

/** Starts the moving painting on a canvas. Returns a stop function, or null without a 2D canvas. */
export function flowPainting(canvas: HTMLCanvasElement, img: HTMLImageElement, focus: [number, number], speed: number, mist: boolean, onReady: () => void) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // The painting as it hangs, and a canvas where the moving strokes build up over it.
  const base = document.createElement("canvas");
  const bctx = base.getContext("2d", { willReadFrequently: true })!;
  const paint = document.createElement("canvas");
  const pctx = paint.getContext("2d")!;
  let mask: HTMLCanvasElement | null = null;

  let w = 0, h = 0, scale = 1;
  let pixels = new Uint8ClampedArray(0);
  let field: Field = { cols: 1, rows: 1, cell: 1, dx: new Float32Array(1), dy: new Float32Array(1) };
  // Particles: position, current direction, the paint colour they carry, and remaining life.
  let n = 0, x = new Float32Array(0), y = new Float32Array(0), vx = new Float32Array(0), vy = new Float32Array(0), life = new Float32Array(0);
  let colour: string[] = [];

  const spawn = (i: number) => {
    x[i] = Math.random() * w; y[i] = Math.random() * h;
    const angle = Math.random() * Math.PI * 2;
    vx[i] = Math.cos(angle); vy[i] = Math.sin(angle);
    life[i] = 40 + Math.random() * 120;
    const o = (Math.floor(y[i]) * w + Math.floor(x[i])) * 4;
    // A shade brighter than the paint underneath, so the moving strokes show over it.
    colour[i] = `rgb(${Math.min(255, pixels[o] * 1.1)},${Math.min(255, pixels[o + 1] * 1.1)},${Math.min(255, pixels[o + 2] * 1.1)})`;
  };

  // Show the strokes, faded into the sky through the mist mask.
  const present = () => {
    ctx.globalCompositeOperation = "copy";
    ctx.drawImage(paint, 0, 0);
    if (mask) { ctx.globalCompositeOperation = "destination-in"; ctx.drawImage(mask, 0, 0); }
    ctx.globalCompositeOperation = "source-over";
  };

  // Size to the box, crop the painting to cover it, and read its strokes.
  const fit = () => {
    const box = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    w = canvas.width = base.width = paint.width = Math.max(2, Math.min(1400, Math.round(box.width * dpr)));
    h = canvas.height = base.height = paint.height = Math.max(2, Math.min(1400, Math.round(box.height * dpr)));
    scale = w / Math.max(box.width, 1);
    const k = Math.max(w / img.naturalWidth, h / img.naturalHeight);
    const dw = img.naturalWidth * k, dh = img.naturalHeight * k;
    bctx.drawImage(img, (w - dw) * focus[0], (h - dh) * focus[1], dw, dh);
    pixels = bctx.getImageData(0, 0, w, h).data;
    field = strokeField(pixels, w, h, Math.max(3, Math.round(4 * scale)));
    pctx.drawImage(base, 0, 0);
    mask = mist ? mistMask(w, h) : null;
    n = Math.min(5000, Math.round((w * h) / (95 * scale * scale)));
    x = new Float32Array(n); y = new Float32Array(n); vx = new Float32Array(n); vy = new Float32Array(n); life = new Float32Array(n);
    colour = new Array(n);
    for (let i = 0; i < n; i++) { spawn(i); life[i] *= Math.random(); }
    present();
  };
  fit();

  let visible = true, raf = 0, ready = false, last = 0;
  const step = () => {
    // Old trails melt back into the painting.
    pctx.globalAlpha = 0.05;
    pctx.drawImage(base, 0, 0);
    pctx.globalAlpha = 0.88;
    pctx.lineWidth = 1.6 * scale; pctx.lineCap = "round";
    const v = 0.9 * speed * scale;
    for (let i = 0; i < n; i++) {
      if (--life[i] <= 0) { spawn(i); continue; }
      const c = Math.min(field.rows - 1, Math.floor(y[i] / field.cell)) * field.cols + Math.min(field.cols - 1, Math.floor(x[i] / field.cell));
      let fx = field.dx[c], fy = field.dy[c];
      // Strokes have no arrow on them; keep going the way this particle was already going.
      if (fx * vx[i] + fy * vy[i] < 0) { fx = -fx; fy = -fy; }
      vx[i] = vx[i] * 0.7 + fx * 0.3; vy[i] = vy[i] * 0.7 + fy * 0.3;
      const nx = x[i] + vx[i] * v, ny = y[i] + vy[i] * v;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) { spawn(i); continue; }
      pctx.strokeStyle = colour[i];
      pctx.beginPath(); pctx.moveTo(x[i], y[i]); pctx.lineTo(nx, ny); pctx.stroke();
      x[i] = nx; y[i] = ny;
    }
    pctx.globalAlpha = 1;
    present();
    if (!ready) { ready = true; onReady(); }
  };
  const frame = (ms: number) => {
    // About 40 steps a second is enough for slow paint, and kinder to phones.
    if (visible && ms - last > 24) { step(); last = ms; }
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
