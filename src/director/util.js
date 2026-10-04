/* ------------------------------------------------------------------ *
 * Director Mode's small tools (dev only): easing, a seeded random, a
 * spring, curves, and routes on the pup's walk grid.
 * ------------------------------------------------------------------ */

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
/** ease in and out (no linear start or stop) */
export const ease = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
export const ease5 = (t) => { t = clamp(t, 0, 1); return t * t * t * (t * (t * 6 - 15) + 10); };
/** 0 before a, 1 after b, eased between */
export const seg = (t, a, b) => ease5((t - a) / (b - a));
/** up over [a, a+i], held, down over [b-o, b] */
export const bell = (t, a, b, i = 0.2, o = i) => Math.min(seg(t, a, a + i), 1 - seg(t, b - o, b));
/** the angle from a to b, wrapped to [-pi, pi] */
export const turn = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

/** mulberry32: a small seeded random, so a shot plays the same every take */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A damped spring toward a target, integrated in fixed steps so it depends only on elapsed time. */
export class Spring {
  constructor(v = 0, k = 120, c = 14) { this.v = v; this.x = v; this.k = k; this.c = c; this.acc = 0; }
  step(target, dt) {
    this.acc += dt;
    const h = 1 / 240;
    while (this.acc >= h) {
      this.acc -= h;
      this.v += (-this.k * (this.x - target) - this.c * this.v) * h;
      this.x += this.v * h;
    }
    return this.x;
  }
  set(x) { this.x = x; this.v = 0; this.acc = 0; return this; }
}

/** Catmull-Rom through points [{x, y?, z}], at u in [0, 1] (centripetal-ish by uniform spacing). */
export function spline(pts, u, out = {}) {
  const n = pts.length - 1;
  if (n <= 0) { Object.assign(out, pts[0]); return out; }
  const f = clamp(u, 0, 1) * n, i = Math.min(n - 1, Math.floor(f)), t = f - i;
  const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n, i + 2)];
  for (const k of ['x', 'y', 'z', 'fov']) {
    if (p1[k] === undefined) continue;
    const a = p0[k] ?? p1[k], b = p1[k], c = p2[k] ?? b, d = p3[k] ?? c;
    out[k] = 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t);
  }
  return out;
}

/** A polyline with lengths, for walking along at a distance s. */
export function polyline(pts) {
  const L = [0];
  for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z));
  const total = L[L.length - 1];
  return {
    pts, total,
    at(s, out = {}) {
      s = clamp(s, 0, total);
      let i = 1;
      while (i < L.length - 1 && L[i] < s) i++;
      const a = pts[i - 1], b = pts[i], k = (s - L[i - 1]) / Math.max(1e-6, L[i] - L[i - 1]);
      out.x = a.x + (b.x - a.x) * k; out.z = a.z + (b.z - a.z) * k;
      out.yaw = Math.atan2(b.x - a.x, b.z - a.z);
      return out;
    },
  };
}

/** Round a polyline's corners (a few Chaikin passes), keeping its ends. */
export function smoothPath(pts, passes = 2) {
  let p = pts;
  for (let k = 0; k < passes; k++) {
    const q = [p[0]];
    for (let i = 0; i < p.length - 1; i++) {
      const a = p[i], b = p[i + 1];
      if (i > 0) q.push({ x: a.x * 0.75 + b.x * 0.25, z: a.z * 0.75 + b.z * 0.25 });
      if (i < p.length - 2) q.push({ x: a.x * 0.25 + b.x * 0.75, z: a.z * 0.25 + b.z * 0.75 });
    }
    q.push(p[p.length - 1]);
    p = q;
  }
  return p;
}

/**
 * A route on the pup's walk grid (guide.js W: cells, cost 0 = solid), A* on
 * 8 neighbours, no step higher than a kerb, pulled taut by line of sight and
 * rounded.  Falls back to the straight line when there is no grid.
 */
export function route(W, a, b) {
  if (!W?.built) return [a, b];
  const s = W.nearest(a.x, a.z, 2), g = W.nearest(b.x, b.z, 2);
  if (s < 0 || g < 0) return [a, b];
  const nx = W.nx, N = W.N;
  const gs = new Float32Array(N).fill(Infinity), from = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
  const heap = [];
  const push = (i, f) => { heap.push([f, i]); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
  const G = W.at(g);
  const hh = (i) => { const q = W.at(i); return Math.hypot(q.x - G.x, q.z - G.z); };
  gs[s] = 0; push(s, hh(s));
  let n = 0;
  while (heap.length && n++ < 400000) {
    const [, i] = pop();
    if (closed[i]) continue;
    closed[i] = 1;
    if (i === g) break;
    const ix = i % nx, iz = (i / nx) | 0;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dz) continue;
      const j = (iz + dz) * nx + ix + dx;
      if (j < 0 || j >= N || !W.cost[j] || closed[j]) continue;
      if (Math.abs(W.h[j] - W.h[i]) > 45) continue;
      const c = gs[i] + (dx && dz ? 1.414 : 1) * W.C;
      if (c < gs[j]) { gs[j] = c; from[j] = i; push(j, c + hh(j)); }
    }
  }
  if (from[g] < 0 && g !== s) return [a, b];
  const cells = [];
  for (let i = g; i >= 0; i = from[i]) { cells.push(i); if (i === s) break; }
  cells.reverse();
  const pts = cells.map((i) => W.at(i));
  // pulled taut: keep a point only when the next can't be seen from the last kept
  const taut = [a];
  let last = a;
  for (let i = 1; i < pts.length; i++) {
    const nxt = pts[i + 1] ?? b;
    if (!W.sight(last.x, last.z, nxt.x, nxt.z)) { taut.push(pts[i]); last = pts[i]; }
  }
  taut.push(b);
  return smoothPath(taut, 2);
}
