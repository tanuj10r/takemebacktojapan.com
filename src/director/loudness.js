/* ------------------------------------------------------------------ *
 * Loudness for the promo mixes (Director Mode, dev only).
 *
 *   lufs(chs, sr)        integrated loudness, ITU-R BS.1770-4: K-weighting, 400 ms blocks 75% overlapped, the
 *                        absolute gate at -70 LUFS and the relative one 10 LU under the ungated mean
 *   truePeak(chs)        the peak of the signal four times oversampled (dBTP)
 *   normalise(chs, sr, { lufs, ceil })
 *                        gain to the target loudness with a look-ahead limiter under the ceiling, in place
 *
 * The K-weighting coefficients are the standard's, for 48 kHz (the offline mix's rate; the check resamples to it).
 * ------------------------------------------------------------------ */

const PRE = { b: [1.53512485958697, -2.69169618940638, 1.19839281085285], a: [1, -1.69065929318241, 0.73248077421585] };
const RLB = { b: [1, -2, 1], a: [1, -1.99004745483398, 0.99007225036621] };

function biquad(x, { b, a }) {
  const y = new Float32Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = b[0] * x[i] + b[1] * x1 + b[2] * x2 - a[1] * y1 - a[2] * y2;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v;
  }
  return y;
}

export function lufs(chs, sr = 48000) {
  const k = chs.map((c) => biquad(biquad(c, PRE), RLB));
  const B = Math.round(0.4 * sr), hop = Math.round(0.1 * sr), z = [];
  for (let s = 0; s + B <= k[0].length; s += hop) {
    let e = 0;
    for (const c of k) { let q = 0; for (let i = s; i < s + B; i++) q += c[i] * c[i]; e += q / B; }
    z.push(e);
  }
  const L = (e) => -0.691 + 10 * Math.log10(Math.max(e, 1e-12));
  const mean = (a) => a.reduce((n, v) => n + v, 0) / Math.max(1, a.length);
  const abs = z.filter((e) => L(e) > -70);
  if (!abs.length) return -Infinity;
  const rel = L(mean(abs)) - 10;
  return L(mean(abs.filter((e) => L(e) > rel)));
}

/* a 4x polyphase windowed sinc (12 taps a side) */
const TAPS = 12;
const PHASES = [0.25, 0.5, 0.75].map((f) => {
  const h = [];
  for (let n = -TAPS + 1; n <= TAPS; n++) {
    const x = n - f, w = 0.5 + 0.5 * Math.cos(Math.PI * x / TAPS);
    h.push((Math.abs(x) < 1e-9 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x)) * w);
  }
  return h;
});
export function truePeak(chs) {
  let p = 0;
  for (const c of chs) {
    for (let i = 0; i < c.length; i++) {
      const a = Math.abs(c[i]); if (a > p) p = a;
      if (a < p * 0.5) continue;                               // (an inter-sample peak is near a sample peak)
      for (const h of PHASES) {
        let v = 0;
        for (let n = 0; n < h.length; n++) { const j = i + n - TAPS + 1; if (j >= 0 && j < c.length) v += c[j] * h[n]; }
        v = Math.abs(v); if (v > p) p = v;
      }
    }
  }
  return 20 * Math.log10(Math.max(p, 1e-9));
}

/** A look-ahead limiter: the gain that keeps every sample under `c`, held 5 ms either side and smoothed. */
function limit(chs, c, sr) {
  const n = chs[0].length, W = Math.round(0.005 * sr), need = new Float32Array(n);
  for (let i = 0; i < n; i++) { let m = 0; for (const ch of chs) m = Math.max(m, Math.abs(ch[i])); need[i] = m > c ? c / m : 1; }
  // the least over +-W (a sliding minimum), then a mean over 2W: no click, the peak still under
  const held = new Float32Array(n), dq = [];
  for (let i = 0, o = -W; o < n; i++, o++) {
    if (i < n) { while (dq.length && need[dq[dq.length - 1]] >= need[i]) dq.pop(); dq.push(i); }
    while (dq.length && dq[0] < o - W) dq.shift();
    if (o >= 0) held[o] = need[dq[0]];
  }
  const held2 = new Float32Array(n);
  { const q = []; for (let i = 0, o = -W; o < n; i++, o++) { if (i < n) { while (q.length && held[q[q.length - 1]] >= held[i]) q.pop(); q.push(i); } while (q.length && q[0] < o - W) q.shift(); if (o >= 0) held2[o] = held[q[0]]; } }
  let acc = 0; const g = new Float32Array(n);
  for (let i = 0; i < n + W; i++) {
    if (i < n) acc += held2[i]; else acc += 1;
    if (i - 2 * W >= 0) acc -= i - 2 * W < n ? held2[i - 2 * W] : 1;
    const o = i - W; if (o >= 0 && o < n) g[o] = acc / Math.min(2 * W, i + 1);
  }
  for (const ch of chs) for (let i = 0; i < n; i++) ch[i] *= Math.min(1, g[i]);
}

/** In place: to `target` LUFS with the true peak under `ceil` dBTP.  Returns what it measured. */
export function normalise(chs, sr, { target = -15, ceil = -1.5 } = {}) {
  const src = chs.map((c) => Float32Array.from(c));
  const before = { lufs: lufs(src, sr), tp: truePeak(src) };
  let gain = Math.pow(10, (target - before.lufs) / 20), c = Math.pow(10, ceil / 20), now = before;
  for (let pass = 0; pass < 6; pass++) {
    for (let k = 0; k < chs.length; k++) for (let i = 0; i < src[k].length; i++) chs[k][i] = src[k][i] * gain;
    limit(chs, c, sr);
    now = { lufs: lufs(chs, sr), tp: truePeak(chs) };
    if (now.tp > ceil + 0.3) c *= Math.pow(10, (ceil - now.tp) / 20);
    if (Math.abs(now.lufs - target) < 0.1 && now.tp <= ceil + 0.3) break;
    gain *= Math.pow(10, (target - now.lufs) / 20);
  }
  return { before, after: now, gain: 20 * Math.log10(gain) };
}
