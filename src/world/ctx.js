import * as THREE from 'three';

/* ------------------------------------------------------------------ *
 * The builder context every part is placed through (the shape Sakura
 * Crossing's parts expect): add, collide, platform, interact, update and
 * groundAt.  `offset(dx, dz)` gives a child context whose group, colliders,
 * platforms and ground queries are shifted, so a part authored round its
 * own origin (the railway, round its level crossing) drops into our layout
 * unchanged.  `turned(cz)` gives one turned half round about z = cz: the
 * town is built in its own tested frame and stands north of the main road
 * (M2e.3).
 * ------------------------------------------------------------------ */

export function makeCtx(scene, root) {
  const colliders = [];
  const platforms = [];
  const interactables = [];
  const updaters = [];

  /** Height of the walkable surface.  `fromY`: only platforms within a step
   * of it count, so something can be walked under as well as on. */
  /* Sunken ground (town pass: the river's channel): rects where the base
   * ground lies below 0.  Platforms (stairs, walks) inside one stand on it. */
  const sinks = [];

  function heightAt(x, z, fromY) {
    let h = 0;
    for (const k of sinks) if (x > k.x0 && x < k.x1 && z > k.z0 && z < k.z1 && k.y < h) h = k.y;
    const reach = fromY === undefined ? Infinity : fromY + 0.55;
    for (const p of platforms) {
      if (p.top > reach) continue;
      if (x > p.x0 && x < p.x1 && z > p.z0 && z < p.z1 && p.top > h) h = p.top;
    }
    return h;
  }

  /* The drawn surface, to the centimetre (Tan, 2026-10-02: Hachi's paws must rest ON what is drawn; a pup 24 cm tall
   * shows 2 cm of sinking that a walker's eye height never does).  `heightAt` and its platforms stay as they are for
   * the player; this adds what they leave out:
   *   `fine` surfaces   (ctx.surface): what is drawn a little over the ground plane and is no step to a person: the
   *                     asphalt (2 cm), a gutter, a lawn, a gravel pad.  The highest of the platforms and these wins.
   *   ramps             a platform with `ramp` { axis, a, b, ya, yb } (streetprops.js droppedKerb: for the player a
   *                     ramp is two flat steps) is the slope itself: ya at a, yb at b along the axis. */
  const fine = [];
  function surfaceAt(x, z) {
    let h = 0, on = null;
    for (const k of sinks) if (x > k.x0 && x < k.x1 && z > k.z0 && z < k.z1 && k.y < h) h = k.y;
    for (const p of platforms) if (x > p.x0 && x < p.x1 && z > p.z0 && z < p.z1 && p.top > h) { h = p.top; on = p; }
    if (on?.ramp) { const r = on.ramp, t = ((r.axis === 'x' ? x : z) - r.a) / (r.b - r.a); h = r.ya + (r.yb - r.ya) * Math.max(0, Math.min(1, t)); }
    for (const p of fine) if (p.top > h && x > p.x0 && x < p.x1 && z > p.z0 && z < p.z1) h = p.top;
    return h;
  }

  /* A context's frame: world = (s·x + dx, s·z + dz), s = ±1.  s = -1 is a
   * half-turn about y (M2e.3: the town is built turned, north of the road). */
  function build(group, s, dx, dz) {
    const wx = (x) => s * x + dx, wz = (z) => s * z + dz;
    const lx = (x) => (x - dx) * s, lz = (z) => (z - dz) * s;
    return {
      scene,
      root: group,
      colliders,
      platforms,
      interactables,
      add: (obj) => { group.add(obj); return obj; },
      collide: (x0, z0, x1, z1, top, bottom) => {
        const a = wx(x0), b = wx(x1), c = wz(z0), d = wz(z1);
        colliders.push({
          x0: Math.min(a, b), x1: Math.max(a, b),
          z0: Math.min(c, d), z1: Math.max(c, d),
          top, bottom,
        });
      },
      platform: (p) => {
        const a = wx(p.x0), b = wx(p.x1), c = wz(p.z0), d = wz(p.z1);
        const ramp = p.ramp ? { ramp: { ...p.ramp, a: (p.ramp.axis === 'x' ? wx : wz)(p.ramp.a), b: (p.ramp.axis === 'x' ? wx : wz)(p.ramp.b) } } : null;
        platforms.push({ ...p, ...ramp, x0: Math.min(a, b), x1: Math.max(a, b), z0: Math.min(c, d), z1: Math.max(c, d) });
      },
      /** A drawn surface too slight to be a step for you (asphalt, a lawn): { x0, z0, x1, z1, top }; see surfaceAt. */
      surface: (p) => {
        const a = wx(p.x0), b = wx(p.x1), c = wz(p.z0), d = wz(p.z1);
        fine.push({ x0: Math.min(a, b), x1: Math.max(a, b), z0: Math.min(c, d), z1: Math.max(c, d), top: p.top });
      },
      surfaceAt: (x, z) => surfaceAt(wx(x), wz(z)),
      cut: () => {},
      /** Lower the base ground to `y` (< 0) over a rect; town.js leaves the
       * ground plane open there, so the builder must floor and wall it. */
      sink: (x0, z0, x1, z1, y) => {
        const a = wx(x0), b = wx(x1), c = wz(z0), d = wz(z1);
        sinks.push({ x0: Math.min(a, b), x1: Math.max(a, b), z0: Math.min(c, d), z1: Math.max(c, d), y });
      },
      groundAt: (x, z) => heightAt(wx(x), wz(z)),
      interact: (i) => interactables.push(i),
      update: (fn) => updaters.push(fn),
      /** This frame's point in world coordinates, and back. */
      toWorld: (p) => ({ ...p, x: wx(p.x), z: wz(p.z) }),
      toLocal: (p) => ({ ...p, x: lx(p.x), z: lz(p.z) }),
      /** A heading (yaw) in this frame, in the world's. */
      yawToWorld: (yaw) => (s < 0 ? yaw + Math.PI : yaw),
      turnedFrame: s < 0,
      /** A child context whose origin sits at (ox, oz) in this one. */
      offset(ox, oz, name = 'part') {
        const g = new THREE.Group();
        g.name = name;
        g.position.set(ox, 0, oz);
        group.add(g);
        return build(g, s, wx(ox), wz(oz));
      },
      /** A child context turned half round about the line z = cz of this
       * one: (x, z) here lands at (-x, 2·cz - z).  Signs, text and stairs
       * stay the right way round (a rotation, not a mirror). */
      turned(cz, name = 'turned') {
        const g = new THREE.Group();
        g.name = name;
        g.rotation.y = Math.PI;
        g.position.set(0, 0, 2 * cz);
        group.add(g);
        return build(g, -s, wx(0), wz(2 * cz));
      },
    };
  }

  const ctx = build(root, 1, 0, 0);
  ctx.platforms = platforms;
  ctx.updaters = updaters;
  ctx.heightAt = heightAt;
  ctx.sinks = sinks;
  return ctx;
}
