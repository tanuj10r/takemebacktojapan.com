import * as THREE from 'three';
import { clamp, lerp, ease, ease5, spline, rng } from './util.js';

/* ------------------------------------------------------------------ *
 * The camera toolkit (Director Mode, dev only; Part 2).  A rig is a
 * function of the shot's clock that says where the camera is, where it
 * looks and its lens: { p: {x,y,z}, l: {x,y,z}, fov }.  `cut` switches
 * rigs at a time within a shot.  Every move is eased; the follow is a
 * damped spring stepped at a fixed rate (no jitter, the same each take).
 * The camera is then kept out of buildings, poles, the car and the pup.
 * ------------------------------------------------------------------ */

const V = (x, y, z) => ({ x, y, z });

/** Locked: position and look-at, an optional slow push-in toward what it looks at (m/s). */
export const tripod = (p, l, { fov = 50, push = 0, pushEase = true, dur = 2 } = {}) => (t) => {
  const k = push ? (pushEase ? ease(t / dur) * dur : t) * push : 0;
  const dx = l.x - p.x, dy = l.y - p.y, dz = l.z - p.z, d = Math.hypot(dx, dy, dz) || 1;
  return { p: V(p.x + dx / d * k, p.y + dy / d * k, p.z + dz / d * k), l, fov };
};

/** Through keyframes [{t, x,y,z, lx,ly,lz, fov}], a spline in eased time. */
export const dolly = (keys, { fov = 50 } = {}) => {
  const T0 = keys[0].t, T1 = keys[keys.length - 1].t;
  const P = keys.map((k) => ({ x: k.x, y: k.y, z: k.z, fov: k.fov ?? fov }));
  const L = keys.map((k) => ({ x: k.lx, y: k.ly, z: k.lz }));
  return (t) => {
    const u = ease5((t - T0) / Math.max(1e-3, T1 - T0));
    const p = spline(P, u, {}), l = spline(L, u, {});
    return { p: V(p.x, p.y, p.z), l: V(l.x, l.y, l.z), fov: p.fov ?? fov };
  };
};

/** Round a point: radius, height above it, degrees a second, from `a0` (radians, 0 = +z of the point). */
export const orbit = (c, { r = 1.6, h = 0.5, deg = 20, a0 = 0, fov = 50, lookY = 0.2 } = {}) => (t) => {
  const cc = typeof c === 'function' ? c(t) : c;
  const a = a0 + (deg * Math.PI / 180) * t;
  return { p: V(cc.x + Math.sin(a) * r, cc.y + h, cc.z + Math.cos(a) * r), l: V(cc.x, cc.y + lookY, cc.z), fov };
};

/** High to low onto a target: from `from` (a point) to `to` (a point), looking at `at(t)`. */
export const drone = (from, to, at, { dur = 2, fov = 55, reverse = false } = {}) => (t) => {
  const u = ease5(t / dur), k = reverse ? 1 - u : u;
  const p = V(lerp(from.x, to.x, k), lerp(from.y, to.y, k), lerp(from.z, to.z, k));
  const l = typeof at === 'function' ? at(t) : at;
  return { p, l, fov };
};

/** Low chase behind a target { x, z, yaw, y? }: offset back/height/side, a damped spring, a look ahead. */
export function follow(target, { back = 1.6, h = 0.45, side = 0, lookUp = 0.25, ahead = 0.8, fov = 50, k = 26, c = 10, lookH = 0.2 } = {}) {
  const S = { p: null, v: V(0, 0, 0), acc: 0, last: 0 };
  return (t) => {
    const g = target(t);
    const fx = Math.sin(g.yaw), fz = Math.cos(g.yaw);
    const want = V(g.x - fx * back + fz * side, (g.y ?? 0) + h, g.z - fz * back - fx * side);
    if (!S.p || t < S.last) { S.p = { ...want }; S.v = V(0, 0, 0); S.acc = 0; }
    S.acc += Math.max(0, t - S.last); S.last = t;
    const hs = 1 / 240;
    while (S.acc >= hs) {
      S.acc -= hs;
      for (const a of ['x', 'y', 'z']) { S.v[a] += (-k * (S.p[a] - want[a]) - c * S.v[a]) * hs; S.p[a] += S.v[a] * hs; }
    }
    const l = V(g.x + fx * ahead, (g.y ?? 0) + lookH + lookUp, g.z + fz * ahead);
    return { p: { ...S.p }, l, fov };
  };
}

/** At the pup's eye height (0.32 m), looking where it looks. */
export const hachiEye = (pup, { fov = 60, dist = 6 } = {}) => (t) => {
  const s = pup.state, y = (s.y ?? 0) + 0.32;
  const a = s.yaw;
  return { p: V(s.x + Math.sin(a) * 0.12, y, s.z + Math.cos(a) * 0.12), l: V(s.x + Math.sin(a) * dist, y + 0.4, s.z + Math.cos(a) * dist), fov };
};

/** Hard cuts between rigs: [[t, rig], ...] (each rig gets the time since its cut). */
export const cut = (list) => (t) => {
  let i = 0;
  for (let k = 0; k < list.length; k++) if (list[k][0] <= t) i = k;
  return list[i][1](t - list[i][0]);
};

/** A tiny slow handheld drift on any rig (off unless asked). */
export const handheld = (rig, { amt = 0.012, seed = 3 } = {}) => {
  const r = rng(seed), ph = [r() * 9, r() * 9, r() * 9];
  return (t) => {
    const o = rig(t);
    const n = (i, f) => Math.sin(t * f + ph[i]) * 0.6 + Math.sin(t * f * 2.3 + ph[i] * 1.7) * 0.4;
    o.l = V(o.l.x + n(0, 0.7) * amt, o.l.y + n(1, 0.5) * amt, o.l.z + n(2, 0.6) * amt);
    return o;
  };
};

/**
 * Put the camera where a rig says, kept out of solid things: out of any
 * collider it would sit in (buildings, poles, the car), above the ground,
 * and at least 0.28 m from the pup.
 */
export function place(camera, o, { colliders = [], ground = () => 0, pups = [] } = {}) {
  const p = new THREE.Vector3(o.p.x, o.p.y, o.p.z);
  for (const c of colliders) {
    if (p.y > (c.top ?? 9) || p.y < (c.bottom ?? 0)) continue;
    if (p.x > c.x0 - 0.12 && p.x < c.x1 + 0.12 && p.z > c.z0 - 0.12 && p.z < c.z1 + 0.12) {
      // out by the nearest face
      const d = [p.x - (c.x0 - 0.12), c.x1 + 0.12 - p.x, p.z - (c.z0 - 0.12), c.z1 + 0.12 - p.z];
      const m = d.indexOf(Math.min(...d));
      if (m === 0) p.x = c.x0 - 0.12; else if (m === 1) p.x = c.x1 + 0.12; else if (m === 2) p.z = c.z0 - 0.12; else p.z = c.z1 + 0.12;
    }
  }
  p.y = Math.max(p.y, ground(p.x, p.z) + 0.12);
  for (const q of pups) {
    const s = q.state; if (s.x === undefined) continue;
    const dx = p.x - s.x, dy = p.y - ((s.y ?? 0) + 0.2), dz = p.z - s.z, d = Math.hypot(dx, dy, dz);
    if (d < 0.28 && d > 1e-4) { p.x = s.x + dx / d * 0.28; p.y = (s.y ?? 0) + 0.2 + dy / d * 0.28; p.z = s.z + dz / d * 0.28; }
  }
  camera.position.copy(p);
  camera.up.set(0, 1, 0);
  camera.lookAt(o.l.x, o.l.y, o.l.z);
  if (o.roll) camera.rotateZ(o.roll);
  if (camera.fov !== o.fov) { camera.fov = o.fov; camera.updateProjectionMatrix(); }
}
