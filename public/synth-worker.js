// Soundtrack worker. Renders four original tracks in the spirit of Cream, The Doors,
// Pink Floyd and Led Zeppelin, entirely from synthesis: no samples, no recordings.
// Message in: { id, sr }. Message out: { id, sr, L, R } (Float32Array channels, transferred).
function renderTrack(id, sr) {
  "use strict";
  let seed = { cream: 1967, doors: 1971, floyd: 1973, zep: 1969 }[id] || 7;
  const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const m2f = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const TAU = Math.PI * 2;

  // ---------------- DSP toolkit ----------------
  function biq(type, f, q, db) {
    const w = TAU * Math.min(f, sr * 0.45) / sr, c = Math.cos(w), s = Math.sin(w), al = s / (2 * q), A = Math.pow(10, (db || 0) / 40);
    let b0, b1, b2, a0, a1, a2;
    if (type === "lp") { b0 = (1 - c) / 2; b1 = 1 - c; b2 = (1 - c) / 2; a0 = 1 + al; a1 = -2 * c; a2 = 1 - al; }
    else if (type === "hp") { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = (1 + c) / 2; a0 = 1 + al; a1 = -2 * c; a2 = 1 - al; }
    else if (type === "bp") { b0 = al; b1 = 0; b2 = -al; a0 = 1 + al; a1 = -2 * c; a2 = 1 - al; }
    else { b0 = 1 + al * A; b1 = -2 * c; b2 = 1 - al * A; a0 = 1 + al / A; a1 = -2 * c; a2 = 1 - al / A; }
    b0 /= a0; b1 /= a0; b2 /= a0; a1 /= a0; a2 /= a0;
    return (x) => { let x1 = 0, x2 = 0, y1 = 0, y2 = 0; for (let i = 0; i < x.length; i++) { const xi = x[i], y = b0 * xi + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = xi; y2 = y1; y1 = y; x[i] = y; } return x; };
  }
  const peak = (x) => { let p = 0; for (let i = 0; i < x.length; i++) { const a = Math.abs(x[i]); if (a > p) p = a; } return p; };
  const scaleTo = (x, t) => { const p = peak(x) || 1, k = t / p; for (let i = 0; i < x.length; i++) x[i] *= k; return x; };
  const blep = (t, dt) => { if (t < dt) { t /= dt; return t + t - t * t - 1; } if (t > 1 - dt) { t = (t - 1) / dt; return t * t + t + t + 1; } return 0; };

  function Mix(seconds) {
    const total = Math.ceil(seconds * sr);
    const M = { total, L: new Float32Array(total), R: new Float32Array(total), RV: new Float32Array(total), DL: new Float32Array(total) };
    M.bus = () => new Float32Array(total);
    M.into = (dst, src, off, gain) => { const s = Math.round(off * sr); for (let i = 0; i < src.length; i++) { const j = s + i; if (j >= 0 && j < total) dst[j] += src[i] * gain; } };
    M.out = (src, off, pan, gain, rev, dly) => {
      const a = (pan + 1) * Math.PI / 4, gl = Math.cos(a) * gain, gr = Math.sin(a) * gain, s = Math.round(off * sr);
      for (let i = 0; i < src.length; i++) { const j = s + i; if (j < 0 || j >= total) continue; const v = src[i]; M.L[j] += v * gl; M.R[j] += v * gr; if (rev) M.RV[j] += v * gain * rev; if (dly) M.DL[j] += v * gain * dly; }
    };
    return M;
  }

  // Karplus-Strong string with fractional delay. detune in cents.
  function pluck(freq, dur, decay, bright, release) {
    const rel = release || 0.06, n = Math.floor((dur + rel) * sr), y = new Float32Array(n), Ld = sr / freq, P = Math.min(n, Math.ceil(Ld) + 2);
    let lp = 0; for (let i = 0; i < P; i++) { lp += ((rnd() * 2 - 1) - lp) * bright; y[i] = lp; }
    for (let i = P; i < n; i++) { const t = i - Ld, i0 = Math.floor(t), fr = t - i0; y[i] = decay * 0.5 * (y[i0] * (1 - fr) + y[i0 + 1] * fr + y[i0 - 1] * (1 - fr) + y[i0] * fr); }
    const ds = Math.floor(dur * sr); for (let i = ds; i < n; i++) y[i] *= 1 - (i - ds) / (n - ds);
    for (let i = 0; i < Math.min(n, 40); i++) y[i] *= i / 40;
    return y;
  }
  // Oscillator voice with optional bend (from `bendFrom` semitones below), vibrato, PolyBLEP saw + sub.
  function leadVoice(midi, dur, o) {
    const n = Math.floor((dur + o.release) * sr), y = new Float32Array(n), f1 = m2f(midi), f0 = o.bend ? m2f(midi - o.bend) : f1;
    let ph = 0, ph2 = 0;
    for (let i = 0; i < n; i++) {
      const t = i / sr, bk = o.bend ? Math.min(1, t / o.bendTime) : 1, bs = bk * bk * (3 - 2 * bk);
      const vib = t > o.vibDelay ? Math.sin(TAU * o.vibRate * t) * o.vibDepth * Math.min(1, (t - o.vibDelay) / 0.4) : 0;
      const f = (f0 + (f1 - f0) * bs) * (1 + vib), dt = f / sr;
      ph += dt; if (ph >= 1) ph -= 1; ph2 += dt * 0.5; if (ph2 >= 1) ph2 -= 1;
      const saw = 2 * ph - 1 - blep(ph, dt), sub = 2 * ph2 - 1 - blep(ph2, dt * 0.5);
      const env = Math.min(1, t / o.attack) * (t < dur ? 1 : Math.max(0, 1 - (t - dur) / o.release)) * (0.78 + 0.22 * Math.exp(-t * 5));
      y[i] = (saw * 0.8 + sub * o.sub) * env;
    }
    return y;
  }
  function amp(bus, drive, bias, cab) {
    biq("hp", 100, 0.7)(bus);
    for (let i = 0; i < bus.length; i++) bus[i] = Math.tanh(bus[i] * drive + bias) - Math.tanh(bias);
    biq("pk", cab.mid, 0.8, cab.midDb)(bus); biq("lp", cab.lp, 0.7)(bus); biq("lp", cab.lp * 1.5, 0.7)(bus); biq("pk", 220, 1, -3)(bus);
    return bus;
  }
  function wah(bus, period, lo, hi, wet) {
    let low = 0, band = 0; const q = 1 / 3.5;
    for (let i = 0; i < bus.length; i++) {
      const ph = ((i / sr) / period) % 1, fc = lo + (hi - lo) * Math.pow(Math.sin(Math.PI * ph), 2), f = 2 * Math.sin(Math.PI * fc / sr);
      low += f * band; const high = bus[i] - low - q * band; band += f * high; bus[i] = bus[i] * (1 - wet) + band * wet * 1.6;
    }
    return bus;
  }

  // ---------------- Drums ----------------
  function drumSample(kind, tune) {
    const k = tune || 1;
    const dur = { kick: 0.45, snare: 0.35, hat: 0.07, ohat: 0.45, crash: 2.4, ride: 1.6, xstick: 0.12, tom1: 0.5, tom2: 0.55, tom3: 0.65, heart: 0.5 }[kind];
    const n = Math.floor(dur * sr), y = new Float32Array(n); let ph = 0;
    for (let i = 0; i < n; i++) {
      const t = i / sr, w = rnd() * 2 - 1;
      if (kind === "kick") { const f = 44 * k + 120 * Math.exp(-t * 30); ph += f / sr; y[i] = Math.tanh(1.7 * Math.sin(TAU * ph) * Math.exp(-t * 7.5)) + w * Math.exp(-t * 400) * 0.3; }
      else if (kind === "heart") { const f = 50 + 25 * Math.exp(-t * 20); ph += f / sr; const e = Math.exp(-t * 14) + 0.55 * (t > 0.24 ? Math.exp(-(t - 0.24) * 16) : 0); y[i] = Math.sin(TAU * ph) * e; }
      else if (kind === "snare") { ph += 185 * k / sr; y[i] = Math.sin(TAU * ph) * Math.exp(-t * 26) * 0.6 + w * Math.exp(-t * 13) * 0.9; }
      else if (kind === "xstick") { ph += 520 / sr; y[i] = Math.sin(TAU * ph) * Math.exp(-t * 55) * 0.6 + w * Math.exp(-t * 70); }
      else if (kind === "hat") y[i] = w * Math.exp(-t * 70);
      else if (kind === "ohat") y[i] = w * Math.exp(-t * 7);
      else if (kind === "crash") y[i] = w * Math.exp(-t * 1.9);
      else if (kind === "ride") { let m = 0; [3150, 4270, 5190, 6730, 7910, 9120].forEach((f, j) => { m += Math.sign(Math.sin(TAU * f * t + j)) * 0.12; }); y[i] = (m * 0.6 + w * 0.5) * Math.exp(-t * 2.6) + Math.sin(TAU * 2530 * t) * Math.exp(-t * 9) * 0.35; }
      else { const f0 = { tom1: 200, tom2: 150, tom3: 105 }[kind] * k; ph += f0 * (0.7 + 0.3 * Math.exp(-t * 10)) / sr; y[i] = Math.sin(TAU * ph) * Math.exp(-t * 6) + w * Math.exp(-t * 80) * 0.25; }
    }
    if (kind === "snare") { biq("hp", 150, 0.7)(y); biq("pk", 2200, 0.8, 4)(y); }
    if (kind === "xstick") biq("bp", 1700, 1.2)(y);
    if (kind === "hat" || kind === "ohat") { biq("hp", 7000, 0.7)(y); biq("hp", 7000, 0.7)(y); }
    if (kind === "crash") { biq("hp", 3400, 0.7)(y); biq("pk", 6000, 1, 5)(y); }
    if (kind === "ride") biq("hp", 2000, 0.7)(y);
    return scaleTo(y, 1);
  }
  function Kit(M, levels, room, tune) {
    const S = {}; Object.keys(levels).forEach((k) => (S[k] = drumSample(k, tune)));
    const PAN = { kick: 0, heart: 0, snare: 0.05, xstick: 0.05, hat: 0.3, ohat: 0.3, crash: -0.35, ride: 0.35, tom1: 0.25, tom2: -0.05, tom3: -0.3 };
    return (k, off, v = 1) => M.out(S[k], off + (rnd() - 0.5) * 0.005, PAN[k], levels[k] * v * (0.92 + rnd() * 0.12), k === "kick" || k === "heart" ? room * 0.3 : room, 0);
  }

  // ---------------- Master: delay, reverb, glue, fade ----------------
  function finish(M, o) {
    const total = M.total;
    if (o.delay) {
      const d = Math.round(o.delay.time * sr), dl = new Float32Array(total), dr = new Float32Array(total); let lpL = 0, lpR = 0;
      for (let i = 0; i < total; i++) {
        const inL = i >= d ? M.DL[i - d] + o.delay.fb * dr[i - d] : 0, inR = i >= d ? o.delay.fb * dl[i - d] : 0;
        lpL += (inL - lpL) * 0.35; lpR += (inR - lpR) * 0.35; dl[i] = lpL; dr[i] = lpR;
        M.L[i] += dl[i] * o.delay.wet; M.R[i] += dr[i] * o.delay.wet; M.RV[i] += (dl[i] + dr[i]) * 0.2;
      }
    }
    const k = sr / 44100, combs = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617], aps = [556, 441, 341, 225];
    for (let ch = 0; ch < 2; ch++) {
      const out = new Float32Array(total), spread = ch ? 23 : 0;
      combs.forEach((len) => { const n = Math.round((len + spread) * k * o.reverb.size), buf = new Float32Array(n); let idx = 0, store = 0;
        for (let i = 0; i < total; i++) { const v = buf[idx]; store = v * (1 - o.reverb.damp) + store * o.reverb.damp; buf[idx] = M.RV[i] * 0.015 + store * o.reverb.room; out[i] += v; if (++idx >= n) idx = 0; } });
      aps.forEach((len) => { const n = Math.round((len + spread) * k), buf = new Float32Array(n); let idx = 0;
        for (let i = 0; i < total; i++) { const b = buf[idx], v = -out[i] + b; buf[idx] = out[i] + b * 0.5; out[i] = v; if (++idx >= n) idx = 0; } });
      const dst = ch ? M.R : M.L; for (let i = 0; i < total; i++) dst[i] += out[i] * o.reverb.wet;
    }
    biq("hp", 30, 0.7)(M.L); biq("hp", 30, 0.7)(M.R);
    for (let i = 0; i < total; i++) { M.L[i] = Math.tanh(M.L[i] * o.glue); M.R[i] = Math.tanh(M.R[i] * o.glue); }
    // Loudness-match the setlist: bring every track to the same RMS, soft-limit the peaks.
    let sq = 0; for (let i = 0; i < total; i++) sq += M.L[i] * M.L[i] + M.R[i] * M.R[i];
    const g = Math.pow(10, -15 / 20) / (Math.sqrt(sq / (2 * total)) || 1);
    for (let i = 0; i < total; i++) { M.L[i] = 0.95 * Math.tanh(M.L[i] * g / 0.95); M.R[i] = 0.95 * Math.tanh(M.R[i] * g / 0.95); }
    // Trim trailing silence, then fade in/out.
    let end = total; while (end > sr && Math.abs(M.L[end - 1]) < 0.0015 && Math.abs(M.R[end - 1]) < 0.0015) end--;
    end = Math.min(total, end + Math.floor(0.3 * sr));
    const L = M.L.slice(0, end), R = M.R.slice(0, end), fi = Math.floor(0.01 * sr), fo = Math.min(end, Math.floor(o.fadeOut * sr));
    for (let i = 0; i < fi; i++) { L[i] *= i / fi; R[i] *= i / fi; }
    for (let i = end - fo; i < end; i++) { const k = (end - i) / fo; L[i] *= k; R[i] *= k; }
    return { L, R, sr, id };
  }

  // ================= 1. Cream: "Liquid Light" =================
  function cream() {
    const BPM = 108, E8 = 60 / BPM / 2, BAR = E8 * 8, BARS = 4 + 24 + 2, M = Mix(BARS * BAR + 4), T = (b, s) => (b * 8 + s) * E8;
    const gA = M.bus(), gB = M.bus(), bs = M.bus(), ld = M.bus(), ogL = M.bus(), ogR = M.bus();
    const hit = Kit(M, { kick: 0.95, snare: 0.62, hat: 0.16, ohat: 0.14, crash: 0.22, tom1: 0.5, tom2: 0.5, tom3: 0.55 }, 0.18, 1);
    const strum = (bus, ms, off, dur, mute, vel, jit) => ms.forEach((m, k) => { const v = pluck(m2f(m), mute ? Math.min(dur, E8 * 0.7) : dur, mute ? 0.985 : 0.9985, mute ? 0.25 : 0.6); if (mute) biq("lp", 900, 0.7)(v); M.into(bus, v, off + k * 0.006 + jit, vel * (mute ? 0.8 : 1)); });
    const RIFF = [[0,1,0,1],[1,1,0,1],[2,1,3,0],[3,2,5,0],[5,1,6,0],[6,1,5,0],[7,1,3,0],[8,2,0,0],[10,1,-2,0],[11,1,0,0],[12,2,3,0],[14,1,5,0],[15,1,0,1]];
    const riffBar = (g, half, tr, withBass, doubled, vel) => RIFF.filter((e) => Math.floor(e[0] / 8) === half).forEach(([st, ln, semi, mute]) => {
      const off = T(g, st % 8), dur = ln * E8 * 0.96, root = 40 + semi + tr, ch = mute ? [root, root + 7] : (semi === 6 || semi === -2) ? [root, root + 12] : [root, root + 7, root + 12];
      strum(gA, ch, off, dur, mute, vel, (rnd() - 0.5) * 0.008); if (doubled) strum(gB, ch, off, dur, mute, vel, (rnd() - 0.5) * 0.012 + 0.004);
      if (withBass) M.into(bs, pluck(m2f(28 + semi + tr), dur, 0.997, 0.22), off, 1);
    });
    const organ = (g, notes, bars, att) => { const n = Math.floor(bars * BAR * sr), l = new Float32Array(n), r = new Float32Array(n);
      notes.forEach((m) => [[0.5, 0.5], [1, 0.8], [2, 0.45], [3, 0.3], [4, 0.15]].forEach(([mul, a]) => { const f = m2f(m) * mul, p0 = rnd() * TAU; for (let i = 0; i < n; i++) { const e = Math.min(1, i / (att * sr)) * Math.min(1, (n - i) / (0.08 * sr)); l[i] += Math.sin(p0 + TAU * f * i / sr) * a * e; } }));
      for (let i = 0; i < n; i++) { const t = i / sr, s = Math.sin(TAU * 6.4 * t); r[i] = Math.tanh(l[i] * 0.35 * (1 - 0.3 * (0.5 - 0.5 * s))); l[i] = Math.tanh(l[i] * 0.35 * (1 - 0.3 * (0.5 + 0.5 * s))); }
      M.into(ogL, l, T(g, 0), 1); M.into(ogR, r, T(g, 0), 1); };
    const lead = (off, ln, m, bend) => M.into(ld, leadVoice(m, ln * E8, { bend: bend ? 2 : 0, bendTime: 0.11, vibDelay: 0.22, vibRate: 5.6, vibDepth: 0.007, attack: 0.008, release: 0.08, sub: 0.3 }), off, 1);
    const groove = (g) => { hit("kick", T(g, 0)); hit("kick", T(g, 3), 0.8); hit("kick", T(g, 4)); hit("snare", T(g, 2)); hit("snare", T(g, 6)); hit("snare", T(g, 5), 0.18); for (let s = 0; s < 8; s++) hit(s === 7 ? "ohat" : "hat", T(g, s), s % 2 ? 0.7 : 1); };
    const fill = (g) => { hit("kick", T(g, 0)); hit("snare", T(g, 2)); [[4, "snare"], [4.5, "snare"], [5, "tom1"], [5.5, "tom1"], [6, "tom2"], [6.5, "tom2"], [7, "tom3"], [7.5, "tom3"]].forEach(([s, k], i) => hit(k, T(g, s), 0.7 + i * 0.04)); };
    const EM7 = [52, 55, 59, 62], AM7 = [57, 60, 64, 67], PROG = [0, 0, 0, 0, 5, 5, 0, 0];
    for (let g = 0; g < 4; g++) riffBar(g, g % 2, 0, g >= 2, false, 1);
    organ(2, EM7, 2, 1.6); [4, 5, 5.5, 6, 6.5, 7, 7.25, 7.5, 7.75].forEach((s, i) => hit("snare", T(3, s), 0.35 + i * 0.07));
    const SOLO = [[[0,3,71,1],[3,1,69,0],[4,4,67,0]],[[0,2,64,0],[2,1,67,0],[3,1,69,0],[4,1,70,0],[5,1,69,0],[6,2,67,0]],[[0,6,74,1],[6,1,76,0],[7,1,74,0]],[[0,2,71,0],[2,2,69,0],[4,4,64,0]],[[0,3,76,1],[3,1,74,0],[4,2,74,0],[6,2,69,0]],[[0,1,72,0],[1,1,69,0],[2,2,67,0],[4,4,69,0]],[[0,1,76,0],[1,1,79,0],[2,6,81,1]],[[0,2,79,0],[2,2,76,0],[4,4,76,0]]];
    const BR = { gtr: [40, 48, 50, 47], bass: [28, 36, 38, 35], organ: [[52,55,59,62],[48,52,55,60],[50,54,57,62],[47,51,54,57]], lead: [83, 79, 81, 78] };
    for (let b = 0; b < 24; b++) {
      const g = 4 + b;
      if (b < 16 || b >= 20) {
        const tr = PROG[b % 8]; riffBar(g, b % 2, tr, true, true, b >= 8 && b < 16 ? 0.8 : 1);
        if (b % 2 === 0) organ(g, tr ? AM7 : EM7, 2, 0.05);
        if (b === 23) fill(g); else groove(g);
        if (b === 0 || b === 8 || b === 20) hit("crash", T(g, 0));
        if (b >= 8 && b < 16) SOLO[b - 8].forEach(([s, ln, m, bend]) => lead(T(g, s) + (rnd() - 0.5) * 0.01, ln, m, bend));
      } else {
        const k = b - 16, root = BR.gtr[k];
        [0, 4].forEach((s) => { const ch = [root, root + 7, root + 12]; strum(gA, ch, T(g, s), E8 * 4, false, s ? 0.75 : 1, 0); strum(gB, ch, T(g, s) + 0.005, E8 * 4, false, s ? 0.75 : 1, 0); });
        for (let s = 0; s < 8; s++) M.into(bs, pluck(m2f(BR.bass[k]), E8 * 0.9, 0.997, 0.22), T(g, s), s % 2 ? 0.8 : 1);
        organ(g, BR.organ[k], 1, 0.15); hit("crash", T(g, 0)); hit("kick", T(g, 0)); hit("snare", T(g, 4)); hit("kick", T(g, 6), 0.7);
        for (let s = 0; s < 8; s += 2) hit("ohat", T(g, s), 0.6);
        lead(T(g, 0), 8, BR.lead[k], true);
      }
    }
    // ending: one ringing E chord and a crash
    strum(gA, [40, 47, 52], T(28, 0), BAR * 1.8, false, 1, 0); strum(gB, [40, 47, 52], T(28, 0) + 0.005, BAR * 1.8, false, 1, 0);
    M.into(bs, pluck(m2f(28), BAR * 1.8, 0.9995, 0.22), T(28, 0), 1); hit("crash", T(28, 0)); hit("kick", T(28, 0));
    for (const [bus, pan] of [[gA, -0.7], [gB, 0.7]]) { scaleTo(bus, 1.2); amp(bus, 5, 0.15, { mid: 1100, midDb: 4, lp: 4300 }); wah(bus, E8 * 2, 450, 1950, 0.6); scaleTo(bus, 0.34); M.out(bus, 0, pan, 1, 0.16, 0.03); }
    scaleTo(bs, 1); biq("lp", 1100, 0.8)(bs); for (let i = 0; i < bs.length; i++) bs[i] = Math.tanh(bs[i] * 1.6); scaleTo(bs, 0.5); M.out(bs, 0, 0, 1, 0.02, 0);
    scaleTo(ld, 1); amp(ld, 9, 0.15, { mid: 1700, midDb: 5, lp: 3800 }); scaleTo(ld, 0.24); M.out(ld, 0, 0.18, 1, 0.3, 0.42);
    const op = Math.max(peak(ogL), peak(ogR)) || 1; for (let i = 0; i < M.total; i++) { M.L[i] += ogL[i] / op * 0.1; M.R[i] += ogR[i] / op * 0.13; M.RV[i] += (ogL[i] + ogR[i]) / op * 0.025; }
    return finish(M, { delay: { time: 3 * E8, fb: 0.42, wet: 0.55 }, reverb: { size: 1, room: 0.84, damp: 0.3, wet: 1 }, glue: 1.15, fadeOut: 1.5 });
  }

  // ================= 2. The Doors: "Desert Highway Rain" =================
  // E dorian, 104 bpm. Rain and thunder, a Rhodes-style electric piano, a walking organ-bass ostinato,
  // brushed jazz drums with ride, and a thin Vox-style combo organ solo.
  function doors() {
    const BPM = 104, E8 = 60 / BPM / 2, BAR = E8 * 8, BARS = 34, M = Mix(BARS * BAR + 5), T = (b, s) => (b * 8 + s) * E8;
    const ep = M.bus(), bs = M.bus(), vox = M.bus(), rain = M.bus();
    const hit = Kit(M, { kick: 0.55, xstick: 0.4, snare: 0.32, ride: 0.2, hat: 0.1, crash: 0.16 }, 0.3, 1);
    // Rain bed: lowpassed noise plus scattered droplets. Thunder: brown-noise rumble.
    { let b = 0; for (let i = 0; i < M.total; i++) { const w = rnd() * 2 - 1; b = b * 0.97 + w * 0.03; rain[i] = w * 0.35 + b * 2.2; } biq("lp", 3200, 0.6)(rain); biq("hp", 300, 0.6)(rain);
      for (let k = 0; k < M.total / sr * 22; k++) { const at = rnd() * M.total, n = Math.floor(0.015 * sr), d = new Float32Array(n), f = 2500 + rnd() * 4000; for (let i = 0; i < n; i++) d[i] = Math.sin(TAU * f * i / sr) * Math.exp(-i / sr * 300) * (0.3 + rnd() * 0.5); M.out(d, at / sr, rnd() * 1.6 - 0.8, 0.05, 0.3, 0); } }
    const thunder = (at, dur) => { const n = Math.floor(dur * sr), y = new Float32Array(n); let b = 0; for (let i = 0; i < n; i++) { b = b * 0.995 + (rnd() * 2 - 1) * 0.05; const t = i / sr; y[i] = b * Math.min(1, t / 0.3) * Math.exp(-t * 0.9) * (1 + 0.5 * Math.sin(TAU * 0.7 * t)); } biq("lp", 220, 0.7)(y); scaleTo(y, 1); M.out(y, at, -0.2, 0.55, 0.4, 0); };
    thunder(0.4, 7); thunder(T(18, 0), 6);
    // Rhodes-style electric piano: two-operator FM with a decaying index, plus a tine "ping".
    const rhodes = (m, off, dur, vel) => { const n = Math.floor((dur + 0.9) * sr), y = new Float32Array(n), f = m2f(m);
      for (let i = 0; i < n; i++) { const t = i / sr, idx = (1.2 + 1.6 * vel) * Math.exp(-t * 3.5) + 0.25, env = Math.min(1, t / 0.003) * Math.exp(-t * (0.7 + m / 160)) * (t < dur ? 1 : Math.exp(-(t - dur) * 9));
        y[i] = (Math.sin(TAU * f * t + idx * Math.sin(TAU * f * t)) + 0.12 * vel * Math.sin(TAU * f * 7.1 * t) * Math.exp(-t * 22)) * env * vel; }
      M.into(ep, y, off, 1); };
    // Thin combo organ: band-limited pulse waves with fast vibrato.
    const voxNote = (m, off, dur) => { const n = Math.floor((dur + 0.05) * sr), y = new Float32Array(n); let p1 = 0, p2 = 0;
      for (let i = 0; i < n; i++) { const t = i / sr, f = m2f(m) * (1 + 0.004 * Math.sin(TAU * 6.8 * t)), dt = f / sr; p1 += dt; if (p1 >= 1) p1 -= 1; p2 += dt * 2; if (p2 >= 1) p2 -= 1;
        const q = (p1 + 0.3) % 1, pulse = (2 * p1 - 1 - blep(p1, dt)) - (2 * q - 1 - blep(q, dt)), oct = 2 * p2 - 1 - blep(p2, dt * 2);
        y[i] = (pulse * 0.7 + oct * 0.25) * Math.min(1, t / 0.006) * (t < dur ? 1 : 1 - (t - dur) / 0.05); }
      M.into(vox, y, off, 1); };
    // Harmony: Em7 | Em7 | A7 | A7 with a D - C - B7 turnaround in the solo.
    const CH = { Em7: [52, 55, 59, 62], A7: [57, 61, 64, 67], D: [54, 57, 62], C: [52, 55, 60], B7: [51, 54, 57, 59] };
    const BASS = { E: [[0, 3, 28], [3, 1, 28], [4, 1, 31], [5, 1, 33], [6, 2, 35]], A: [[0, 3, 33], [3, 1, 33], [4, 1, 37], [5, 1, 38], [6, 2, 40]], D: [[0, 4, 38], [4, 4, 33]], C: [[0, 4, 36], [4, 4, 31]], B: [[0, 4, 35], [4, 2, 30], [6, 2, 33]] };
    const comp = (g, ch, vel) => { [[0, 3], [3, 1], [5, 2], [7, 1]].forEach(([s, l], k) => CH[ch].forEach((m, j) => rhodes(m, T(g, s) + j * 0.004, l * E8 * 0.95, vel * (k === 0 ? 1 : 0.7)))); };
    const bassBar = (g, which) => BASS[which].forEach(([s, l, m]) => M.into(bs, pluck(m2f(m), l * E8 * 0.95, 0.996, 0.3), T(g, s), 1));
    const brush = (g, sw) => { for (let s = 0; s < 8; s++) { const off = T(g, s) + (s % 2 ? sw : 0); hit("ride", off, s % 2 ? 0.55 : 0.9); } hit("kick", T(g, 0), 0.9); hit("kick", T(g, 5) + sw, 0.5); hit("xstick", T(g, 2)); hit("xstick", T(g, 6)); hit("hat", T(g, 2), 0.6); hit("hat", T(g, 6), 0.6); };
    const sw = E8 / 3.5;
    const SOLO = [
      [[0, 2, 76], [2, 1, 74], [3, 1, 71], [4, 3, 69], [7, 1, 67]],
      [[0, 4, 71], [4, 2, 74], [6, 2, 76]],
      [[0, 1, 78], [1, 1, 76], [2, 2, 73], [4, 2, 71], [6, 2, 69]],
      [[0, 6, 73], [6, 1, 71], [7, 1, 69]],
      [[0, 2, 74], [2, 2, 78], [4, 4, 81]],
      [[0, 2, 79], [2, 2, 76], [4, 4, 72]],
      [[0, 2, 75], [2, 2, 78], [4, 2, 81], [6, 2, 78]],
      [[0, 8, 76]],
    ];
    const form = [];
    for (let g = 0; g < 2; g++) form.push(["rain"]);
    for (let g = 0; g < 2; g++) form.push(["bass", "E"]);
    for (let r = 0; r < 4; r++) form.push(["full", "Em7", "E"], ["full", "Em7", "E"], ["full", "A7", "A"], ["full", "A7", "A"]);
    ["Em7", "Em7", "A7", "A7", "D", "C", "B7", "B7"].forEach((c, i) => form.push(["solo", c, { Em7: "E", A7: "A", D: "D", C: "C", B7: "B" }[c], i]));
    form.push(["full", "Em7", "E"], ["full", "Em7", "E"], ["end", "Em7", "E"], ["rain"]);
    form.forEach((f, g) => {
      if (f[0] === "bass") { bassBar(g, f[1]); if (g === 3) hit("ride", T(g, 6), 0.5); }
      if (f[0] === "full" || f[0] === "solo") { comp(g, f[1], f[0] === "solo" ? 0.6 : 0.85); bassBar(g, f[2]); brush(g, sw); if (g === 4 || (f[0] === "solo" && f[3] === 0)) hit("crash", T(g, 0)); }
      if (f[0] === "solo") SOLO[f[3]].forEach(([s, l, m]) => voxNote(m, T(g, s) + (s % 2 ? sw : 0), l * E8 * 0.92));
      if (f[0] === "end") { CH.Em7.concat([64, 67]).forEach((m, j) => rhodes(m, T(g, 0) + j * 0.03, BAR * 1.6, 0.8)); M.into(bs, pluck(m2f(28), BAR * 1.6, 0.9993, 0.3), T(g, 0), 1); hit("ride", T(g, 0)); hit("kick", T(g, 0)); }
    });
    // Rhodes suitcase tremolo (stereo auto-pan)
    scaleTo(ep, 1); biq("lp", 5000, 0.7)(ep);
    { const l = new Float32Array(M.total), r = new Float32Array(M.total); for (let i = 0; i < M.total; i++) { const s = Math.sin(TAU * 4.2 * i / sr); l[i] = ep[i] * (0.65 + 0.35 * s); r[i] = ep[i] * (0.65 - 0.35 * s); } scaleTo(l, 0.3); scaleTo(r, 0.3); M.out(l, 0, -1, 1, 0.25, 0.04); M.out(r, 0, 1, 1, 0.25, 0.04); }
    scaleTo(bs, 1); biq("lp", 900, 0.8)(bs); for (let i = 0; i < bs.length; i++) bs[i] = Math.tanh(bs[i] * 1.4); scaleTo(bs, 0.5); M.out(bs, 0, 0, 1, 0.03, 0);
    scaleTo(vox, 1); biq("lp", 3600, 0.7)(vox); biq("hp", 250, 0.7)(vox); for (let i = 0; i < vox.length; i++) vox[i] = Math.tanh(vox[i] * 1.3); scaleTo(vox, 0.2); M.out(vox, 0, 0.25, 1, 0.35, 0.2);
    scaleTo(rain, 0.07); M.out(rain, 0, 0, 1, 0.1, 0);
    return finish(M, { delay: { time: 3 * E8, fb: 0.3, wet: 0.4 }, reverb: { size: 1.15, room: 0.86, damp: 0.4, wet: 1.1 }, glue: 1.05, fadeOut: 2.5 });
  }

  // ================= 3. Pink Floyd: "Echoes in the Wire" =================
  // D minor, 64 bpm. Heartbeat and a sonar ping, warm pad, clean echoing arpeggios,
  // slow heavy drums, and a singing lead with long bends.
  function floyd() {
    const BPM = 64, E8 = 60 / BPM / 2, BAR = E8 * 8, BARS = 18, M = Mix(BARS * BAR + 7), T = (b, s) => (b * 8 + s) * E8;
    const pad = M.bus(), arp = M.bus(), arp2 = M.bus(), bs = M.bus(), ld = M.bus();
    const hit = Kit(M, { kick: 0.9, heart: 0.9, snare: 0.55, hat: 0.1, ohat: 0.1, crash: 0.2, tom1: 0.5, tom2: 0.5, tom3: 0.55 }, 0.35, 0.95);
    const PROG = [["Dm9", [50, 53, 57, 60, 64], 38], ["Bbmaj7", [46, 50, 53, 57, 62], 34], ["Gm7", [43, 50, 53, 58, 62], 31], ["Asus4", [45, 50, 52, 57, 62], 33]];
    const padChord = (g, notes, bars) => { const dur = bars * BAR, n = Math.floor((dur + 2) * sr), y = new Float32Array(n);
      notes.forEach((m) => [-7, 0, 6].forEach((det) => { const f = m2f(m + 12) * Math.pow(2, det / 1200); let ph = rnd(); for (let i = 0; i < n; i++) { const dt = f / sr; ph += dt; if (ph >= 1) ph -= 1; const t = i / sr; y[i] += (2 * ph - 1 - blep(ph, dt)) * Math.min(1, t / 1.6) * (t < dur ? 1 : Math.max(0, 1 - (t - dur) / 2)); } }));
      M.into(pad, y, T(g, 0), 1); };
    const ping = (off) => { const n = Math.floor(4 * sr), y = new Float32Array(n), f = m2f(83); for (let i = 0; i < n; i++) { const t = i / sr; y[i] = Math.sin(TAU * f * t + 0.6 * Math.exp(-t * 3) * Math.sin(TAU * f * 2 * t)) * Math.exp(-t * 1.3) * (1 + 0.25 * Math.sin(TAU * 5.5 * t)); } M.out(y, off, 0.3, 0.16, 0.8, 0.7); };
    const lead = (m, off, beats, bend) => M.into(ld, leadVoice(m, beats * E8 * 2, { bend: bend || 0, bendTime: 0.28, vibDelay: 0.45, vibRate: 5, vibDepth: 0.009, attack: 0.02, release: 0.35, sub: 0.15 }), off, 1);
    // intro: heartbeat, pings, pad swells
    for (let b = 0; b < 4; b++) for (let k = 0; k < 4; k++) hit("heart", T(b, k * 2), 0.6 + b * 0.1);
    [0, 1.5, 3].forEach((b) => ping(T(0, 0) + b * BAR));
    padChord(0, PROG[0][1], 2); padChord(2, PROG[1][1], 2);
    for (let g = 4; g < 16; g++) {
      const [name, notes, root] = PROG[g % 4];
      padChord(g, notes, 1);
      const order = [0, 2, 3, 4, 3, 2, 1, 2];
      order.forEach((ix, s) => { const m = notes[ix] + 12; M.into(arp, pluck(m2f(m), E8 * 1.6, 0.9994, 0.75, 0.2), T(g, s), s === 0 ? 1 : 0.8); M.into(arp2, pluck(m2f(m) * 1.0017, E8 * 1.6, 0.9994, 0.7, 0.2), T(g, s) + 0.009, 0.8); });
      M.into(bs, pluck(m2f(root - 12 + 12), BAR * 0.6, 0.9985, 0.2), T(g, 0), 1); M.into(bs, pluck(m2f(root), BAR * 0.3, 0.998, 0.2), T(g, 5), 0.7);
      if (g >= 6) { hit("kick", T(g, 0)); hit("kick", T(g, 5), 0.7); hit("snare", T(g, 2)); hit("snare", T(g, 6)); for (let s = 0; s < 8; s++) hit("hat", T(g, s), s % 2 ? 0.5 : 0.8); }
      if (g === 6 || g === 10 || g === 14) hit("crash", T(g, 0));
      if (g === 9 || g === 13) [[6, "tom1"], [6.5, "tom2"], [7, "tom3"], [7.5, "tom3"]].forEach(([s, k]) => hit(k, T(g, s), 0.8));
    }
    // lead: two phrases over bars 8-15, bends and long sustains (D minor pentatonic)
    const LEAD = [[8, 0, 69, 4, 2], [8, 4, 72, 2], [8, 6, 74, 2, 2], [9, 0, 77, 6, 2], [9, 6, 76, 2], [10, 0, 74, 4], [10, 4, 72, 2], [10, 6, 69, 2], [11, 0, 67, 8, 2],
                  [12, 0, 74, 2], [12, 2, 77, 2, 2], [12, 4, 79, 4, 2], [13, 0, 81, 6, 2], [13, 6, 79, 2], [14, 0, 77, 3], [14, 3, 76, 1], [14, 4, 74, 4], [15, 0, 76, 8, 1]];
    LEAD.forEach(([g, s, m, ln, bend]) => lead(m, T(g, s), ln / 2, bend));
    // outro: a final Dm9 swell with pings
    padChord(16, PROG[0][1], 2); ping(T(16, 0)); ping(T(17, 0)); M.into(bs, pluck(m2f(38), BAR * 1.5, 0.9993, 0.2), T(16, 0), 1); hit("crash", T(16, 0)); hit("kick", T(16, 0));
    scaleTo(pad, 1); biq("lp", 1300, 0.5)(pad); biq("lp", 1800, 0.5)(pad); scaleTo(pad, 0.16); M.out(pad, 0, -0.15, 1, 0.5, 0.05); M.out(pad, 0.011, 0.15, 1, 0, 0);
    for (const [bus, pan] of [[arp, -0.55], [arp2, 0.55]]) { scaleTo(bus, 1); biq("lp", 4500, 0.7)(bus); biq("hp", 180, 0.7)(bus); scaleTo(bus, 0.16); M.out(bus, 0, pan, 1, 0.35, 0.35); }
    scaleTo(bs, 1); biq("lp", 700, 0.8)(bs); for (let i = 0; i < bs.length; i++) bs[i] = Math.tanh(bs[i] * 1.3); scaleTo(bs, 0.45); M.out(bs, 0, 0, 1, 0.04, 0);
    scaleTo(ld, 1); amp(ld, 3.2, 0.1, { mid: 1300, midDb: 4, lp: 3300 }); scaleTo(ld, 0.26); M.out(ld, 0, 0.12, 1, 0.45, 0.55);
    return finish(M, { delay: { time: 3 * E8, fb: 0.5, wet: 0.6 }, reverb: { size: 1.3, room: 0.9, damp: 0.25, wet: 1.2 }, glue: 1.05, fadeOut: 3 });
  }

  // ================= 4. Led Zeppelin: "Hammer of the Hills" =================
  // D, 78 bpm, shuffled. Huge-room drums alone to start, a crunchy riff doubled by bass,
  // a half-time breakdown with a lead break, then the riff again.
  function zep() {
    const BPM = 78, E8 = 60 / BPM / 2, BAR = E8 * 8, SW = E8 * 0.28, BARS = 24, M = Mix(BARS * BAR + 5), T = (b, s) => (b * 8 + s) * E8 + (s % 2 ? SW : 0);
    const gA = M.bus(), gB = M.bus(), bs = M.bus(), ld = M.bus();
    const hit = Kit(M, { kick: 1, snare: 0.75, hat: 0.14, ohat: 0.13, crash: 0.24, tom1: 0.6, tom2: 0.6, tom3: 0.65 }, 0.5, 0.92);
    const strum = (bus, ms, off, dur, mute, vel) => ms.forEach((m, k) => { const v = pluck(m2f(m), mute ? Math.min(dur, E8 * 0.6) : dur, mute ? 0.984 : 0.9988, mute ? 0.3 : 0.65); if (mute) biq("lp", 1100, 0.7)(v); M.into(bus, v, off + k * 0.007, vel); });
    // riff: [step, len, semitones above D2 (38), kind] kind: 0 power, 1 single+octave, 2 palm mute
    const RIFF = [[0,2,0,0],[2,1,0,2],[3,1,3,1],[4,1,5,1],[5,1,6,1],[6,1,7,0],[7,1,10,1],[8,3,12,1],[11,1,10,1],[12,1,7,0],[13,1,5,1],[14,1,3,1],[15,1,0,2]];
    const riffBar = (g, half, vel, withBass) => RIFF.filter((e) => Math.floor(e[0] / 8) === half).forEach(([st, ln, semi, kind]) => {
      const off = T(g, st % 8), dur = ln * E8 * 0.95, root = 38 + semi, ch = kind === 0 ? [root, root + 7, root + 12] : kind === 1 ? [root, root + 12] : [root, root + 7];
      strum(gA, ch, off + (rnd() - 0.5) * 0.008, dur, kind === 2, vel); strum(gB, ch, off + 0.006 + (rnd() - 0.5) * 0.01, dur, kind === 2, vel);
      if (withBass) M.into(bs, pluck(m2f(26 + semi), dur, 0.997, 0.25), off, 1);
    });
    const beat = (g, big) => { hit("kick", T(g, 0)); hit("kick", T(g, 1), 0.7); hit("snare", T(g, 2)); hit("kick", T(g, 3), 0.8); hit("kick", T(g, 5), 0.85); hit("snare", T(g, 6)); for (let s = 0; s < 8; s++) hit(big && s % 2 === 0 ? "ohat" : "hat", T(g, s), s % 2 ? 0.6 : 0.9); };
    const tripletFill = (g) => { const t0 = T(g, 4), step = (E8 * 4) / 6; ["tom1", "tom1", "tom2", "tom2", "tom3", "kick"].forEach((k, i) => { hit(k, t0 + i * step, 0.85); if (i % 2) hit("kick", t0 + i * step, 0.6); }); };
    const lead = (m, off, ln, bend) => M.into(ld, leadVoice(m, ln * E8, { bend: bend || 0, bendTime: 0.12, vibDelay: 0.25, vibRate: 6, vibDepth: 0.008, attack: 0.006, release: 0.1, sub: 0.25 }), off, 1);
    // bars 0-1: drums alone in the big room
    beat(0, false); beat(1, false); tripletFill(1);
    for (let g = 2; g < 10; g++) { riffBar(g, g % 2, 1, true); beat(g, false); if (g === 2) hit("crash", T(g, 0)); if (g === 9) tripletFill(g); }
    // breakdown: half time, D - C - G - D chords ringing, lead break
    const BRK = [38, 36, 43, 38];
    for (let k = 0; k < 8; k++) { const g = 10 + k, r = BRK[k % 4]; strum(gA, [r, r + 7, r + 12], T(g, 0), BAR * 0.95, false, 1); strum(gB, [r, r + 7, r + 12], T(g, 0) + 0.006, BAR * 0.95, false, 1);
      M.into(bs, pluck(m2f(r - 12), BAR * 0.9, 0.9985, 0.25), T(g, 0), 1); hit("kick", T(g, 0)); hit("snare", T(g, 4)); hit("crash", T(g, 0), 0.8); hit("ohat", T(g, 2), 0.7); hit("ohat", T(g, 6), 0.7); hit("kick", T(g, 7), 0.6); }
    const LB = [[10, 0, 74, 3, 2], [10, 3, 72, 1], [10, 4, 69, 4], [11, 0, 67, 2], [11, 2, 69, 2, 1], [11, 4, 72, 4, 2], [12, 0, 79, 6, 2], [12, 6, 77, 2], [13, 0, 74, 2], [13, 2, 72, 1], [13, 3, 69, 1], [13, 4, 74, 4, 2],
                [14, 0, 81, 2], [14, 2, 79, 1], [14, 3, 77, 1], [14, 4, 74, 4, 2], [15, 0, 72, 2], [15, 2, 74, 2], [15, 4, 77, 2, 2], [15, 6, 79, 2], [16, 0, 81, 8, 2], [17, 0, 74, 4, 2], [17, 4, 72, 2], [17, 6, 69, 2]];
    LB.forEach(([g, s, m, ln, b]) => lead(m, T(g, s), ln, b)); tripletFill(17);
    for (let g = 18; g < 22; g++) { riffBar(g, g % 2, 1, true); beat(g, true); if (g === 18) hit("crash", T(g, 0)); }
    // ending: big D chord, cymbal wash, kick
    strum(gA, [38, 45, 50], T(22, 0), BAR * 1.7, false, 1); strum(gB, [38, 45, 50], T(22, 0) + 0.006, BAR * 1.7, false, 1); M.into(bs, pluck(m2f(26), BAR * 1.7, 0.9993, 0.25), T(22, 0), 1);
    hit("crash", T(22, 0)); hit("kick", T(22, 0)); hit("tom3", T(22, 0), 0.7);
    for (const [bus, pan] of [[gA, -0.75], [gB, 0.75]]) { scaleTo(bus, 1.1); amp(bus, 3.4, 0.12, { mid: 800, midDb: 3.5, lp: 5000 }); scaleTo(bus, 0.33); M.out(bus, 0, pan, 1, 0.18, 0.02); }
    scaleTo(bs, 1); biq("lp", 1000, 0.8)(bs); for (let i = 0; i < bs.length; i++) bs[i] = Math.tanh(bs[i] * 1.8); scaleTo(bs, 0.5); M.out(bs, 0, 0, 1, 0.03, 0);
    scaleTo(ld, 1); amp(ld, 6, 0.15, { mid: 1200, midDb: 5, lp: 4200 }); scaleTo(ld, 0.25); M.out(ld, 0, 0.2, 1, 0.35, 0.3);
    return finish(M, { delay: { time: 2 * E8, fb: 0.3, wet: 0.4 }, reverb: { size: 1.25, room: 0.88, damp: 0.35, wet: 1.25 }, glue: 1.2, fadeOut: 2.5 });
  }

  return ({ cream, doors, floyd, zep })[id]();
}

self.onmessage = (e) => {
  const { id, sr } = e.data;
  const song = renderTrack(id, sr);
  self.postMessage(song, [song.L.buffer, song.R.buffer]);
};
