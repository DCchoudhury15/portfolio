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

/** Starts the moving painting on a canvas. Returns a stop function, or null without a 2D canvas. */
export function flowPainting(canvas: HTMLCanvasElement, img: HTMLImageElement, focus: [number, number], speed: number, onReady: () => void) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const base = document.createElement("canvas");
  const bctx = base.getContext("2d", { willReadFrequently: true })!;

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
    // A shade brighter than the paint underneath, so the moving strokes show without hiding it.
    colour[i] = `rgb(${Math.min(255, pixels[o] * 1.06)},${Math.min(255, pixels[o + 1] * 1.06)},${Math.min(255, pixels[o + 2] * 1.06)})`;
  };

  // Size to the box, crop the painting to cover it, and read its strokes.
  const fit = () => {
    const box = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    w = canvas.width = base.width = Math.max(2, Math.min(1400, Math.round(box.width * dpr)));
    h = canvas.height = base.height = Math.max(2, Math.min(1400, Math.round(box.height * dpr)));
    scale = w / Math.max(box.width, 1);
    const k = Math.max(w / img.naturalWidth, h / img.naturalHeight);
    const dw = img.naturalWidth * k, dh = img.naturalHeight * k;
    bctx.drawImage(img, (w - dw) * focus[0], (h - dh) * focus[1], dw, dh);
    pixels = bctx.getImageData(0, 0, w, h).data;
    field = strokeField(pixels, w, h, Math.max(3, Math.round(4 * scale)));
    ctx.drawImage(base, 0, 0);
    n = Math.min(3500, Math.round((w * h) / (150 * scale * scale)));
    x = new Float32Array(n); y = new Float32Array(n); vx = new Float32Array(n); vy = new Float32Array(n); life = new Float32Array(n);
    colour = new Array(n);
    for (let i = 0; i < n; i++) { spawn(i); life[i] *= Math.random(); }
  };
  fit();

  let visible = true, raf = 0, ready = false, last = 0;
  const step = () => {
    // Old trails melt back into the painting.
    ctx.globalAlpha = 0.14;
    ctx.drawImage(base, 0, 0);
    ctx.globalAlpha = 0.75;
    ctx.lineWidth = 1.2 * scale; ctx.lineCap = "round";
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
      ctx.strokeStyle = colour[i];
      ctx.beginPath(); ctx.moveTo(x[i], y[i]); ctx.lineTo(nx, ny); ctx.stroke();
      x[i] = nx; y[i] = ny;
    }
    ctx.globalAlpha = 1;
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
