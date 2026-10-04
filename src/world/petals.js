import * as THREE from 'three';
import { PAL } from '../core/palette.js';
import { flat, cel } from '../core/toon.js';
import { petalTex } from '../core/textures.js';
import { rngKit } from '../core/util.js';
import { centerX, groundY } from './street.js';

/* ------------------------------------------------------------------ *
 * Falling blossom.
 *
 * Petals drift down in slow overlapping waves, tumbling on their own
 * axis.  Density is deliberately restrained -- enough to catch the light
 * across the road and the tracks, never enough to obscure the frame.  The
 * whole field takes a sideways shove when the train goes past.
 * ------------------------------------------------------------------ */

const COUNT_DEFAULT = 980;
const TOP = 6.8;
const Z0_DEFAULT = -30;
const Z1_DEFAULT = 34;
const HALF_DEFAULT = 9.5;

/**
 * @param opts.count   petals in the air (default 980)
 * @param opts.half    half-size of the square field (default: the street band)
 * @param opts.follow  () => {x, z}: the field is centred there every frame
 *                     and petals wrap round it (here: the player), on
 *                     flat ground at y = 0
 * @param opts.trackZ  z of the railway, for the lift a passing train gives
 * @param opts.land    a following field's petals land on what is under them (Tan, 2026-10-04: "the blossoms
 *                     always go behind objects rather than falling on them"): they fell to y 0 through
 *                     everything, so one over a car, a bench or the pavement went into it and out of sight.
 *                     Now each comes to rest on the highest thing under it (ctx's colliders and platforms: a
 *                     roof's edge, a bonnet, a slat, a kerb), slides down the face of what stands taller than
 *                     it is instead of going through, lies flat a few seconds (a gust slides it), and shrinks
 *                     away before it falls again from a tree.
 * @param opts.pup     { where(): { x, y, z, yaw, size }, listen(fn) }: Hachi's petal (Tan, 2026-10-04).  His own bit
 *                     (animals/reactions.js `petal`: nose up after one, eyes big as it lands on his nose, a sneeze,
 *                     a shake) had no petal in it; when it starts, the nearest one in the air comes down onto his
 *                     nose in step with it (1.5 s), sits there, and is sneezed off (1.9 s) to fall on.
 */
export function buildPetals(ctx, opts = {}) {
  const COUNT = opts.count ?? COUNT_DEFAULT;
  const follow = opts.follow ?? null;
  const HALF = opts.half ?? HALF_DEFAULT;
  const Z0 = follow ? -HALF : Z0_DEFAULT;
  const Z1 = follow ? HALF : Z1_DEFAULT;
  const trackZ = opts.trackZ ?? 0;
  const rng = rngKit(opts.seed ?? 8123);
  const tex = petalTex();

  const geo = new THREE.PlaneGeometry(0.185, 0.135);
  const groups = [
    { color: PAL.petal, n: Math.round(COUNT * 0.55) },
    { color: PAL.blossomLight, n: Math.round(COUNT * 0.28) },
    { color: PAL.petalDeep, n: COUNT - Math.round(COUNT * 0.55) - Math.round(COUNT * 0.28) },
  ];

  const meshes = [];
  const P = [];
  for (const grp of groups) {
    const mat = flat({
      color: grp.color, map: tex, transparent: true, opacity: 0.95,
      depthWrite: false, side: THREE.DoubleSide, alphaTest: 0.32, cache: false,
    });
    const inst = new THREE.InstancedMesh(geo, mat, grp.n);
    inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    inst.frustumCulled = false;
    inst.renderOrder = 4;
    inst.userData.noOutline = true;
    ctx.add(inst);
    meshes.push(inst);
    for (let i = 0; i < grp.n; i++) {
      P.push({
        mesh: inst,
        idx: i,
        x: rng.range(-HALF, HALF),
        y: rng.range(0.2, TOP),
        z: rng.range(Z0, Z1),
        fall: rng.range(0.42, 0.86),
        swayAmp: rng.range(0.25, 0.75),
        swayFreq: rng.range(0.5, 1.35),
        phase: rng.range(0, 10),
        spin: new THREE.Vector3(rng.range(-1, 1), rng.range(-1, 1), rng.range(-1, 1)).normalize(),
        spinRate: rng.range(0.5, 2.4),
        angle: rng.range(0, 6.28),
        scale: rng.range(0.78, 1.25),
        drift: rng.range(-0.16, 0.16),
      });
    }
  }

  const dummy = new THREE.Object3D();
  const q = new THREE.Quaternion();
  const scaleV = new THREE.Vector3();
  let t = 0;

  /* ---- what a petal can land on, or run into: the town's solid boxes and raised surfaces, by 4 m cells (made at
   * the first frame: the town is built by then) ---- */
  const LAND = !!opts.land && !!follow;
  const CELL = 4, REST = [1.6, 3.6], GONE = 0.7;
  let grid = null;
  const makeGrid = () => {
    grid = new Map();
    const put = (b, top, bottom) => {
      if (!(b.x1 > b.x0) || !(b.z1 > b.z0)) return;
      const e = { x0: b.x0, x1: b.x1, z0: b.z0, z1: b.z1, top, bottom };
      for (let ix = Math.floor(b.x0 / CELL); ix <= Math.floor(b.x1 / CELL); ix++) for (let iz = Math.floor(b.z0 / CELL); iz <= Math.floor(b.z1 / CELL); iz++) {
        const k = ix * 8192 + iz;
        let l = grid.get(k);
        if (!l) grid.set(k, (l = []));
        l.push(e);
      }
    };
    for (const c of ctx.colliders ?? []) put(c, c.top ?? Infinity, c.bottom ?? -Infinity);
    for (const p of ctx.platforms ?? []) put(p, p.top, -Infinity);
  };
  /** Under (x, z) for a petal at height y: `land` the highest top it is over, `wall` if it is inside something taller. */
  const probe = { land: 0, wall: false };
  const look = (x, z, y) => {
    probe.land = 0; probe.wall = false;
    const l = grid.get(Math.floor(x / CELL) * 8192 + Math.floor(z / CELL));
    if (!l) return probe;
    for (let i = 0; i < l.length; i++) {
      const e = l[i];
      if (x < e.x0 || x > e.x1 || z < e.z0 || z > e.z1 || y < e.bottom) continue;
      if (e.top <= y + 0.08) { if (e.top > probe.land) probe.land = e.top; } else probe.wall = true;
    }
    return probe;
  };
  /* Hachi's petal: one at a time, flown by hand */
  const PUP = { down: 1.5, off: 1.9 };
  let ride = null;
  opts.pup?.listen(() => {
    const h = opts.pup.where();
    if (!h || ride) return;
    let best = null, bd = Infinity;
    for (const p of P) {
      if (p.rest > 0 || p.y < -1) continue;
      const d = Math.hypot(p.x - h.x, p.y - (h.y + 1.6), p.z - h.z);
      if (d < bd) { bd = d; best = p; }
    }
    if (!best) return;
    // from where it is if that is just over him, else from a little above and ahead of him
    const fx = Math.sin(h.yaw), fz = Math.cos(h.yaw);
    const from = bd < 2.2 && best.y > h.y + 0.9 ? { x: best.x, y: best.y, z: best.z } : { x: h.x + fx * 0.5 - fz * 0.35, y: h.y + 1.5, z: h.z + fz * 0.5 + fx * 0.35 };
    ride = { p: best, t: 0, from };
  });
  const noseOf = (h, out) => { const k = h.size ?? 1; out.x = h.x + Math.sin(h.yaw) * 0.215 * k; out.y = h.y + 0.335 * k; out.z = h.z + Math.cos(h.yaw) * 0.215 * k; return out; };
  const nose = { x: 0, y: 0, z: 0 };
  const flatQ = new THREE.Quaternion(), yawQ = new THREE.Quaternion(), X = new THREE.Vector3(1, 0, 0), Z = new THREE.Vector3(0, 0, 1);
  const lay = (p, y) => {
    p.rest = REST[0] + (REST[1] - REST[0]) * ((p.phase * 0.37) % 1);
    p.restY = y;
    p.y = y + 0.014;
    // flat on it, face up, turned as it fell, a hair of tilt
    flatQ.setFromAxisAngle(X, -Math.PI / 2 + ((p.phase % 1) - 0.5) * 0.2);
    yawQ.setFromAxisAngle(Z, p.angle);
    p.restQ = (p.restQ ?? new THREE.Quaternion()).copy(flatQ).multiply(yawQ);
  };

  let cxF = 0, czF = 0;
  /* `emitters` ([{ x, y, z, r }], M2d): canopies the fall comes from.  A
   * petal that lands mostly re-spawns inside a tree near the player, so the
   * blossom visibly drops from the sakura rather than out of the air. */
  const emitters = opts.emitters ?? [];
  const onlyTrees = !!opts.onlyTrees;
  // `exclude` ([{ x0, x1, z0, z1, top }]): roofed places no petal falls into (the store, M3d)
  const exclude = opts.exclude ?? [];
  const indoors = (p) => exclude.some((r) => p.y < r.top && p.x > r.x0 && p.x < r.x1 && p.z > r.z0 && p.z < r.z1);
  function respawn(p) {
    const near = emitters.filter((e) => Math.abs(e.x - cxF) < HALF && Math.abs(e.z - czF) < HALF);
    if (near.length && (onlyTrees || rng.next() < 0.75)) {
      const e = near[Math.floor(rng.next() * near.length)];
      const a = rng.range(0, Math.PI * 2), d = Math.sqrt(rng.next()) * e.r;
      p.x = e.x + Math.cos(a) * d;
      p.z = e.z + Math.sin(a) * d;
      p.y = e.y + rng.range(-0.8, 0.6);
    } else if (onlyTrees) {
      // no tree near: this petal waits, out of sight, until there is one
      p.x = cxF; p.z = czF; p.y = -5;
    } else {
      p.x = cxF + rng.range(-HALF, HALF);
      p.z = czF + rng.range(Z0, Z1);
      p.y = TOP + rng.range(0, 1.4);
    }
    p.phase = rng.range(0, 10);
    p.rest = 0;
    // (never born inside a building: a canopy's edge over a roof, a wrap of the field)
    // (in a street most of the field's box is houses: a dozen tries finds the open air; else it waits out of sight)
    if (grid && p.y > 0 && look(p.x, p.z, p.y).wall) { if ((p.tries = (p.tries ?? 0) + 1) < 12) { respawn(p); return; } p.y = -5; }
    p.tries = 0;
  }

  function update(dt, gust, gustDir) {
    t += dt;
    if (follow) {
      const c = follow();
      cxF = c.x;
      czF = c.z;
    }
    const wind = gust * 5.4 * gustDir;
    const lift = gust * 1.5;
    if (LAND && !grid && (ctx.colliders?.length ?? 0) > 0) makeGrid();
    const pupAt = ride ? opts.pup.where() : null;
    if (ride && !pupAt) ride = null;
    for (let i = 0; i < P.length; i++) {
      const p = P[i];
      if (ride && ride.p === p) {
        // down onto his nose, a sway dying out as it comes; there until the sneeze; then off and up a little, to fall on
        ride.t += dt;
        noseOf(pupAt, nose);
        if (ride.t < PUP.off) {
          const u = Math.min(1, ride.t / PUP.down), e = u * u * (3 - 2 * u), f = ride.from, w = (1 - u) * 0.22;
          p.x = f.x + (nose.x - f.x) * e + Math.sin(t * 2.3 + p.phase) * w;
          p.y = f.y + (nose.y - f.y) * u;
          p.z = f.z + (nose.z - f.z) * e + Math.cos(t * 1.9 + p.phase) * w;
          p.angle += p.spinRate * dt * (1 - u);
          q.setFromAxisAngle(p.spin, p.angle);
          if (u >= 1) { flatQ.setFromAxisAngle(X, -Math.PI / 2 + 0.35); yawQ.setFromAxisAngle(Z, pupAt.yaw); q.copy(flatQ).multiply(yawQ); }
          dummy.position.set(p.x, p.y, p.z);
          dummy.quaternion.copy(q);
          scaleV.setScalar(p.scale * (1 - 0.48 * e));      // (a petal is 18 cm and he 24 at the shoulder: on his nose, a small one)
          dummy.scale.copy(scaleV);
          dummy.updateMatrix();
          p.mesh.setMatrixAt(p.idx, dummy.matrix);
          continue;
        }
        p.x = nose.x + Math.sin(pupAt.yaw) * 0.12; p.z = nose.z + Math.cos(pupAt.yaw) * 0.12; p.y = nose.y + 0.16; p.rest = 0;
        ride = null;
      }
      if (p.rest > 0) {
        // landed: it lies there, slid a little by a gust (off its edge and it falls on), then shrinks away
        p.rest -= dt;
        if (gust > 0.25) {
          p.x += wind * 0.06 * dt; p.z += wind * 0.012 * dt;
          const s = look(p.x, p.z, p.y + 0.1);
          if (s.wall || Math.abs(s.land - p.restY) > 0.03) { p.rest = 0; continue; }
        }
        if (p.rest <= 0 || Math.abs(p.x - cxF) > HALF || Math.abs(p.z - czF) > HALF) { respawn(p); continue; }
        dummy.position.set(p.x, p.y, p.z);
        dummy.quaternion.copy(p.restQ);
        scaleV.setScalar(p.scale * Math.min(1, p.rest / GONE));
        dummy.scale.copy(scaleV);
        dummy.updateMatrix();
        p.mesh.setMatrixAt(p.idx, dummy.matrix);
        continue;
      }
      const px = p.x, pz = p.z;
      // large slow wave + small fast flutter: reads as air, not noise
      const s = Math.sin(t * p.swayFreq + p.phase);
      const s2 = Math.sin(t * p.swayFreq * 2.7 + p.phase * 1.7);
      p.y -= (p.fall + gust * 0.4) * dt;
      p.x += (p.swayAmp * s * 0.55 + p.drift + wind * 0.24) * dt;
      p.z += (p.swayAmp * s2 * 0.32 + wind * 0.05) * dt;
      p.y += lift * Math.max(0, 1 - Math.abs(p.z - trackZ) / 8) * dt;
      p.angle += p.spinRate * dt * (1 + gust);

      // against what stands taller than it is: down its face, not through it
      let landY = 0;
      if (grid) {
        let s = look(p.x, p.z, p.y);
        if (s.wall) { p.x = px; p.z = pz; s = look(px, pz, p.y); if (s.wall) { respawn(p); continue; } }
        landY = s.land;
      }
      const cx = follow ? cxF : centerX(p.z);
      // a petal from a tree never wraps round the box: it falls again from a tree
      if (onlyTrees && (Math.abs(p.x - cx) > HALF || p.z < czF + Z0 || p.z > czF + Z1)) respawn(p);
      // `while`, so a teleport (the famous-view keys) re-centres at once
      const ux = p.x, uz = p.z;
      while (p.x < cx - HALF) p.x += 2 * HALF;
      while (p.x > cx + HALF) p.x -= 2 * HALF;
      while (p.z < czF + Z0) p.z += Z1 - Z0;
      while (p.z > czF + Z1) p.z -= Z1 - Z0;
      if (grid && p.y > -1) {
        // (a wrap of the field may have set it down in something: it falls again from a tree)
        if (p.x !== ux || p.z !== uz) { const s = look(p.x, p.z, p.y); if (s.wall) { respawn(p); continue; } landY = s.land; }
        if (exclude.length && indoors(p)) { respawn(p); continue; }
        if (p.y < landY + 0.03) { lay(p, landY); p.y = landY + 0.014; }
      } else if (p.y < (follow ? 0 : groundY(p.z)) + 0.04) respawn(p);   // a waiting petal (y -5) retries every frame
      else if (exclude.length && indoors(p)) respawn(p);

      q.setFromAxisAngle(p.spin, p.angle);
      dummy.position.set(p.x, p.y, p.z);
      dummy.quaternion.copy(q);
      scaleV.setScalar(p.scale);
      dummy.scale.copy(scaleV);
      dummy.updateMatrix();
      p.mesh.setMatrixAt(p.idx, dummy.matrix);
    }
    for (const m of meshes) m.instanceMatrix.needsUpdate = true;
  }

  // a tree field starts at the trees, not scattered through the box
  if (onlyTrees) for (const p of P) respawn(p);
  // settle the field so the very first frame already has petals mid-air
  for (let i = 0; i < 40; i++) update(0.1, 0, 1);

  if (!follow) buildFallenPetals(ctx, tex);
  // dev (scripts/_petals.mjs): how many lie where, and whether any is inside something solid
  if (import.meta.env?.DEV && typeof window !== 'undefined') (window.__petals ??= []).push(() => {
    let rest = 0, high = 0, inside = 0, air = 0, top = 0;
    for (const p of P) {
      if (p.y < -1) continue;
      if (p.rest > 0) { rest++; if (p.restY > 0.3) high++; top = Math.max(top, p.restY); }
      else { air++; if (grid && look(p.x, p.z, p.y).wall) inside++; }
    }
    let my = 0, mn = 9, k = 0; for (const p of P) if (p.y > -1 && !(p.rest > 0)) { my += p.y; mn = Math.min(mn, p.y); k++; }
    return { n: P.length, air, rest, high, inside, top: +top.toFixed(2), grid: grid ? grid.size : 0, meanY: +(my / Math.max(1, k)).toFixed(2), minY: +mn.toFixed(2), c: [+cxF.toFixed(0), +czF.toFixed(0)], t: +t.toFixed(1), ride: ride ? +ride.t.toFixed(2) : null };
  });
  return { update, meshes };
}

/**
 * Petals that have already landed.  They drift into the gutters, along the
 * kerb line and across the crossing deck, which is both true to life and the
 * cheapest way to stop a wide stretch of asphalt reading as a dead field.
 */
function buildFallenPetals(ctx, tex) {
  const rng = rngKit(4471);
  const geo = new THREE.PlaneGeometry(0.17, 0.125);
  geo.rotateX(-Math.PI / 2);

  const tones = [PAL.petal, PAL.blossomLight, PAL.petalDeep];
  const lists = [[], [], []];
  const dummy = new THREE.Object3D();

  const place = (x, z, y) => {
    dummy.position.set(x, y + 0.019, z);
    dummy.rotation.set(0, rng.range(0, 6.28), 0);
    const s = rng.range(0.8, 1.25);
    dummy.scale.set(s, 1, s);
    dummy.updateMatrix();
    lists[rng.int(0, 2)].push(dummy.matrix.clone());
  };

  for (let i = 0; i < 620; i++) {
    const z = rng.range(-26, 32);
    const cx = centerX(z);
    const y = groundY(z);
    const r = rng.next();
    if (r < 0.42) {
      // hugging the gutters, where wind and rain push them
      const s = rng.sign();
      place(cx + s * rng.range(2.35, 3.12), z, y);
    } else if (r < 0.62) {
      // on the pavement, against the tactile line
      const s = rng.sign();
      place(cx + s * rng.range(3.2, 4.6), z, y + 0.135);
    } else if (r < 0.78) {
      // caught along the crossing deck
      const dz = rng.range(-2.4, 2.4);
      place(cx + rng.range(-3.1, 3.1), dz, 0.32);
    } else {
      // a thin scatter over the open road
      place(cx + rng.range(-3.0, 3.0), z, y);
    }
  }

  lists.forEach((list, i) => {
    if (!list.length) return;
    const inst = new THREE.InstancedMesh(
      geo,
      flat({
        color: tones[i], map: tex, transparent: true, opacity: 0.9,
        depthWrite: false, alphaTest: 0.32, cache: false,
      }),
      list.length
    );
    list.forEach((m, k) => inst.setMatrixAt(k, m));
    inst.renderOrder = 2;
    inst.userData.noOutline = true;
    ctx.add(inst);
  });
}

/* ------------------------------------------------------------------ *
 * Petals where they land (sakura pass).
 *
 * Under every cherry the petals are dropped, not painted: a ray falls from
 * the canopy and a petal lies wherever it lands -- the walk, a bench's
 * slats, a planter's rim, a car roof, a wall's coping.  On the carriageway
 * the wind clears them, except in the gutter, where the kerb stops them and
 * they pile up; there a drift decal thickens the pile.  The river gets
 * rafts of them, strung out along the current.
 *
 * Everything is one instanced mesh (a flat petal, three tones as instance
 * colours), shaded like the ground under it, and out of the depth buffer so
 * the ink pass does not outline every petal into speckle.
 * ------------------------------------------------------------------ */

const FALLEN_TONES = [0xfff2f6, 0xfcd9e4, 0xf3bdd0];

/**
 * @param trees  [{ x, z, y, r, top, seed }] in ctx's frame (kit/canopy.js)
 * @param opts.decals  the town's decal set, for gutter drifts
 * @param opts.river   { z0, z1, x0, x1, y }: the river's surface, rafts on it
 */
export function buildFallen(ctx, trees, { decals, river } = {}) {
  const root = ctx.root;
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  /* what a petal can land on: static meshes under the town's root, their
   * boxes in the root's frame (instanced things, glass and decals are
   * passed through) */
  const solid = [];
  const box = new THREE.Box3();
  const rel = new THREE.Matrix4();
  root.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || !o.visible || o.userData.shadowOnly || o.userData.noOutline) return;
    if (o.userData.ground) return;          // big ground sheets: groundAt has their height (land/index.js)
    const m = o.material;
    if (Array.isArray(m) || m.transparent || m.depthWrite === false || m.alphaTest > 0) return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    rel.multiplyMatrices(inv, o.matrixWorld);
    box.copy(o.geometry.boundingBox).applyMatrix4(rel);
    solid.push({ o, x0: box.min.x, x1: box.max.x, z0: box.min.z, z1: box.max.z, y1: box.max.y });
  });

  const rng = rngKit(5151);
  const mats = [];
  const ray = new THREE.Raycaster();
  const down = new THREE.Vector3(0, -1, 0).transformDirection(root.matrixWorld);
  const o = new THREE.Vector3(), hitN = new THREE.Vector3(), hp = new THREE.Vector3();
  const nm = new THREE.Matrix3();
  const dummy = new THREE.Object3D();
  const put = (x, y, z, tilt = 0.12) => {
    dummy.position.set(x, y + 0.012, z);
    dummy.rotation.set(-Math.PI / 2 + rng.range(-tilt, tilt), rng.range(-tilt, tilt), rng.range(0, Math.PI * 2));
    const k = rng.range(0.85, 1.45);
    dummy.scale.set(k, k, 1);
    dummy.updateMatrix();
    mats.push([dummy.matrix.clone(), rng.int(0, 2)]);
  };
  const g = (x, z) => ctx.groundAt?.(x, z) ?? 0;
  const KERB = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  for (const t of trees) {
    const R = t.r * 1.15;
    const objs = solid
      .filter((q) => q.x1 > t.x - R && q.x0 < t.x + R && q.z1 > t.z - R && q.z0 < t.z + R && q.y1 < t.top)
      /*@mini @*/.map((q) => q.o)/*@@*/;
    const n = Math.round(Math.min(420, 15 * R * R));
    for (let i = 0; i < n; i++) {
      // thickest under the crown's middle, thinning past its edge
      const a = rng.range(0, Math.PI * 2), d = R * Math.pow(rng.next(), 0.7);
      const x = t.x + Math.cos(a) * d, z = t.z + Math.sin(a) * d;
      let y = g(x, z), onTop = false;
      if (objs.length) {
        o.set(x, t.top, z).applyMatrix4(root.matrixWorld);
        ray.set(o, down);
        ray.far = t.top + 2;
        const hit = /*@mini ray.intersectObjects(objs.filter((q) => x > q.x0 - 1e-3 && x < q.x1 + 1e-3 && z > q.z0 - 1e-3 && z < q.z1 + 1e-3).map((q) => q.o), false)[0] @*/ray.intersectObjects(objs, false)[0]/*@@*/;
        if (hit) {
          const hy = hp.copy(hit.point).applyMatrix4(inv).y;
          // only what lies flat holds a petal; a roof's pitch or a wall's face lets it slide
          if (hy > y + 0.02) {
            if (!hit.face) continue;
            nm.getNormalMatrix(hit.object.matrixWorld);
            hitN.copy(hit.face.normal).applyMatrix3(nm).normalize();
            if (hitN.y < 0.8) continue;
            y = hy; onTop = true;
          }
        }
      }
      if (!onTop && y < 0.05) {
        // the carriageway: blown clear, except where a kerb stops them
        const k = KERB.find(([dx, dz]) => { const h = g(x + dx * 0.8, z + dz * 0.8) - y; return h > 0.06 && h < 0.4; });
        if (!k) { if (rng.next() < 0.65) put(x, y, z); continue; }
        // walk to the kerb's foot and pile there
        const [ux, uz] = k;
        let bx = x, bz = z;
        for (let s = 0; s < 16 && g(bx + ux * 0.06, bz + uz * 0.06) - y < 0.06; s++) { bx += ux * 0.06; bz += uz * 0.06; }
        for (let j = 0; j < 4; j++) put(bx - ux * rng.range(0.02, 0.3), y, bz - uz * rng.range(0.02, 0.3));
        if (decals && rng.next() < 0.08) {
          decals.add('petals', bx - ux * 0.25, bz - uz * 0.25, rng.range(0.5, 0.8), rng.range(1.2, 2.2), { x: -uz, z: ux }, y, 4);
        }
        continue;
      }
      put(x, y, z, onTop ? 0.05 : 0.12);
    }
  }

  // the river: rafts strung out along the current, and a thin scatter
  if (river) {
    const { x0 = -118, x1 = 118, z0, z1, y } = river;
    for (let k = 0; k < 28; k++) {
      const cx = rng.range(x0 + 4, x1 - 4), cz = rng.range(z0 + 1.5, z1 - 1.5);
      const len = rng.range(3, 9), wid = rng.range(0.4, 1.3), ang = rng.range(-0.25, 0.25);
      const m = Math.round(len * wid * rng.range(40, 70));
      for (let i = 0; i < m; i++) {
        const u = rng.range(-0.5, 0.5) * len, v = (rng.next() + rng.next() - 1) * wid * (1 - Math.abs(u) / len);
        put(cx + Math.cos(ang) * u - Math.sin(ang) * v, y, cz + Math.sin(ang) * u + Math.cos(ang) * v, 0.03);
      }
    }
    for (let i = 0; i < 400; i++) put(rng.range(x0, x1), y, rng.range(z0 + 0.5, z1 - 0.5), 0.03);
  }

  if (!mats.length) return null;
  const geo = new THREE.PlaneGeometry(0.16, 0.12);
  const mat = cel({
    color: 0xffffff, map: petalTex(), bands: 2, tint: 0x8a78a8, transparent: true, opacity: 0.95,
    depthWrite: false, alphaTest: 0.32, side: THREE.DoubleSide, cache: false,
  });
  // true decals on the ground (they write no depth): pulled toward the eye, so a petal a fraction of a
  // millimetre over a slab never fights it
  mat.polygonOffset = true; mat.polygonOffsetFactor = -2; mat.polygonOffsetUnits = -4;
  const inst = new THREE.InstancedMesh(geo, mat, mats.length);
  const col = new THREE.Color();
  mats.forEach(([m, tone], i) => { inst.setMatrixAt(i, m); inst.setColorAt(i, col.set(FALLEN_TONES[tone])); });
  inst.computeBoundingSphere();
  inst.name = 'fallenPetals';
  inst.renderOrder = 2;
  inst.receiveShadow = true;
  inst.castShadow = false;
  inst.userData.noOutline = true;
  inst.userData.dynamic = true;        // one instanced draw of its own, not merged by cell
  ctx.add(inst);
  return inst;
}

/**
 * A shower from the cherries near the player: a small field of petals that
 * leave the canopies overhead, on top of the town's fall (town.js), so under
 * a big tree the air is thick with them.  Runs only within `reach` of a
 * cherry; beyond it, hidden and idle.  Hooked into ctx.update.
 */
export function buildShower(ctx, emitters, { count = 150, reach = 26 } = {}) {
  if (!emitters.length) return null;
  const rng = rngKit(7373);
  const geo = new THREE.PlaneGeometry(0.17, 0.125);
  const mat = flat({
    color: 0xffffff, map: petalTex(), transparent: true, opacity: 0.95,
    depthWrite: false, side: THREE.DoubleSide, alphaTest: 0.32, cache: false,
  });
  const inst = new THREE.InstancedMesh(geo, mat, count);
  inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const col = new THREE.Color();
  for (let i = 0; i < count; i++) inst.setColorAt(i, col.set([PAL.petal, PAL.blossomLight, PAL.petalDeep][i % 3]));
  inst.frustumCulled = false;
  inst.renderOrder = 4;
  inst.visible = false;
  inst.name = 'sakuraShower';
  inst.userData.noOutline = true;
  inst.userData.dynamic = true;
  ctx.add(inst);

  const cam = new THREE.Vector3(1e6, 0, 1e6);
  let near = [];
  const P = Array.from({ length: count }, () => ({
    x: 0, y: -5, z: 0, fall: rng.range(0.35, 0.75), amp: rng.range(0.25, 0.7), f: rng.range(0.5, 1.3),
    ph: rng.range(0, 10), spin: new THREE.Vector3(rng.range(-1, 1), rng.range(-1, 1), rng.range(-1, 1)).normalize(),
    rate: rng.range(0.6, 2.4), ang: rng.range(0, 6.28), s: rng.range(0.8, 1.25),
  }));
  const spawn = (p, anywhere) => {
    if (!near.length) { p.y = -5; return; }
    const e = near[Math.floor(rng.next() * near.length)];
    const a = rng.range(0, Math.PI * 2), d = Math.sqrt(rng.next()) * e.r;
    p.x = e.x + Math.cos(a) * d; p.z = e.z + Math.sin(a) * d;
    p.y = anywhere ? rng.range(0.2, e.y) : e.y + rng.range(-1.2, 0.4);
  };
  const dummy = new THREE.Object3D();
  let t = 0, active = false;
  const step = (dt) => {
    t += dt;
    for (let i = 0; i < count; i++) {
      const p = P[i];
      p.y -= p.fall * dt;
      p.x += (p.amp * Math.sin(t * p.f + p.ph) * 0.5 + 0.08) * dt;
      p.z += p.amp * Math.sin(t * p.f * 2.3 + p.ph * 1.7) * 0.3 * dt;
      p.ang += p.rate * dt;
      if (p.y < 0.05) spawn(p, false);
      dummy.position.set(p.x, p.y, p.z);
      dummy.quaternion.setFromAxisAngle(p.spin, p.ang);
      dummy.scale.setScalar(p.s);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
    }
    inst.instanceMatrix.needsUpdate = true;
  };
  ctx.update((dt) => { if (active) step(dt); });
  return {
    mesh: inst,
    /** The camera (or its position) in ctx's frame, once a frame. */
    follow(c) {
      const p = c.position ?? c;
      if (Math.hypot(p.x - cam.x, p.z - cam.z) < 2) return;
      cam.set(p.x, p.y ?? 0, p.z);
      near = emitters.filter((e) => Math.hypot(e.x - cam.x, e.z - cam.z) < reach);
      const was = active;
      active = near.length > 0;
      inst.visible = active;
      if (active && !was) {
        // arrive under the trees with the air already full
        for (const p of P) spawn(p, true);
        for (let i = 0; i < 10; i++) step(0.1);
      }
    },
  };
}
