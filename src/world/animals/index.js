import * as THREE from 'three';
import { TOWN, ANIMALS } from '../../config.js';
import { pondShore } from '../land/pond.js';
import { REFLECT } from '../land/mirror.js';
import { makeShadows, makeMarks } from './shade.js';
import { buildKoi } from './koi.js';
import { buildTurtles } from './turtles.js';
import { buildDucks } from './ducks.js';
import { planPaddies } from '../land/paddies.js';
import { buildWaders } from './waders.js';
import { buildPigeons } from './pigeons.js';
import { buildHachiHome } from './home.js';
import { buildGuide } from './guide.js';
import { buildButterflies } from './butterflies.js';
import { sagCurve } from '../../core/util.js';
import { POLES } from '../../config.js';

/* ------------------------------------------------------------------ *
 * The animals (town quality pass, wave 3).  Called once by town.js with
 * the town's own (turned) context after the core and the land are built;
 * per-frame work goes through ctx.update((dt, cam)).
 *
 *   koi.js        鏡池's koi
 *
 * Each kind is one instanced mesh, moved by a small state machine on the
 * CPU and posed by its vertex shader (shade.js).  A kind is updated only
 * while the camera is within ANIMALS.near of where it lives.
 * ------------------------------------------------------------------ */

export function buildAnimals(ctx, { core, spots, facing } = {}) {
  const group = new THREE.Group();
  group.name = 'animals';
  ctx.add(group);
  const actx = { ...ctx, add: (o) => { group.add(o); return o; } };
  const L = TOWN.land;

  /* ---- the pond: its shore, what is in it, where the benches are ---- */
  const shore = pondShore();
  const pts = shore.map((p) => [p.x, p.y]);
  const segDist = (x, z) => {
    let best = Infinity, bx = 0, bz = 0;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [ax, az] = pts[j], [cx, cz] = pts[i];
      const dx = cx - ax, dz = cz - az;
      const t = THREE.MathUtils.clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1), 0, 1);
      const px = ax + dx * t, pz = az + dz * t;
      const d = Math.hypot(x - px, z - pz);
      if (d < best) { best = d; bx = px; bz = pz; }
    }
    return { d: best, x: bx, z: bz };
  };
  const inPoly = (x, z) => {
    let c = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[j];
      if ((az > z) !== (bz > z) && x < ((bx - ax) * (z - az)) / (bz - az) + ax) c = !c;
    }
    return c;
  };
  /** in the water, at least `m` from the shore */
  const inside = (x, z, m = 0) => inPoly(x, z) && (m <= 0 || segDist(x, z).d > m);
  // the benches' places on the shore (as land/pond.js sets them)
  const benchAt = [[62, 130/*@dz*/], [67, 117/*@dz*/], [85, 125/*@dz*/], [80, 113/*@dz*/]].map(([x, z]) => segDist(x, z));   // as land/pond.js sets them
  const benches = {
    at: benchAt,
    near: (x, z) => Math.min(...benchAt.map((b) => Math.hypot(b.x - x, b.z - z))),
    /** the camera on the promenade: the nearest shore point, and how far */
    edgeNear: (x, z) => (inPoly(x, z) ? null : segDist(x, z)),
  };
  const water = L.pond.water;

  const shadows = makeShadows(actx, 96);
  const marks = makeMarks(actx, { rings: 32, wakes: 8 });

  const kinds = [];
  const pb = L.pond.box;
  const pondC = { x: (pb[0] + pb[2]) / 2, z: (pb[1] + pb[3]) / 2, r: 60 };
  /* (the pocket town has neither 鏡池 nor the river: no koi, turtles, ducks or heron) */
  /*@mini @*/  const koi = buildKoi(actx, { shore, inside, water, benches, marks });
  kinds.push({ ...pondC, name: 'koi', wet: true, mesh: 'koi', draw: 55, update: koi.update, list: koi.fish, dbg: koi.dbg });
  const turtles = buildTurtles(actx, { water, marks, shadows, reflect: REFLECT });
  kinds.push({ ...pondC, name: 'turtles', shadowed: true, wet: true, mesh: 'turtles', draw: 70, update: turtles.update, list: turtles.list });

  /* ---- ducks: a pair on the pond, two pairs on the river ---- */
  const R = L.river;
  const inRiver = (x0, x1) => (x, z) => x > x0 && x < x1 && z > R.z0 + 1.2 && z < R.z1 - 1.2;
  const ducks = buildDucks(actx, {
    marks, reflect: REFLECT, bounds: [25, 0, 55, 110],   // x, y, z, r: the pond and the river's stretch
    groups: [
      { x: 76, z: 134/*@dz*/, n: 2, water, roam: 7, area: (x, z) => inside(x, z, 1.2), upend: false },
      { x: -26, z: -22.5, n: 2, water: R.water, roam: 12, area: inRiver(-60, -2), flow: 0.12, upend: true },
      { x: 14, z: -24, n: 2, water: R.water, roam: 8, area: inRiver(3, 31), flow: 0.12, upend: true },
    ],
  });
  kinds.push({ x: 25, z: 55, r: 130, name: 'ducks', wet: true, mesh: 'ducks', draw: 80, update: ducks.update, list: ducks.list });

  /* ---- the grey heron in the river's shallows, by the town-side walk ---- */
  {
    const edges = [R.z1 - 0.9, R.z0 + 0.9];
    const landings = [];
    for (let x = -104; x <= 26; x += 6) if (Math.abs(x) > 4) for (const z of edges) landings.push([x, z]);
    const shallow = (x, z) => x > -110 && x < 28 && Math.abs(x) > 2.5 && ((z > R.z1 - 1.7 && z < R.z1 - 0.45) || (z < R.z0 + 1.7 && z > R.z0 + 0.45));
    const heron = buildWaders(actx, {
      kind: 'heron', marks, reflect: 0, bounds: [-40, R.water, -28, 90],
      birds: [{ x: -34, z: R.z1 - 0.95, y: R.bed + 0.01, water: R.water, yaw: 2.2, area: shallow, landings }],
    });
    kinds.push({ x: -40, z: -28, r: 80, name: 'heron', wet: true, mesh: 'heron', draw: 110, update: heron.update, list: heron.list });
  }
  /*@@*/

  /* ---- little egrets in the flooded paddies, in twos and threes ---- */
  let rengeSpots = [];
  {
    const plan = planPaddies();
    // inside a plot, `m` in from its paths
    const inPlot = (p, m) => (x, z) => {
      const zs = p.S(x) - m, zn = p.N(x) + m;
      if (z > zs || z < zn) return false;
      const v = (zs - z) / (zs - zn || 1);
      const xl = p.sw + (p.nw - p.sw) * v + m, xr = p.se + (p.ne - p.se) * v - m;
      return x > xl && x < xr;
    };
    const centre = (p) => { const x = (p.sw + p.se + p.nw + p.ne) / 4; return { x, z: (p.S(x) + p.N(x)) / 2 }; };
    const wet = plan.plots.filter((p) => p.kind === 'flood' || p.kind === 'seed');
    const any = (x, z) => wet.some((q) => inPlot(q, 0.7)(x, z));
    const landings = [];
    for (const q of wet) {
      const c = centre(q);
      for (let k = 0; k < 4; k++) {
        const x = c.x + (k - 1.5) * 2.4, z = c.z + (k % 2 ? 1.2 : -1.2);
        if (inPlot(q, 0.8)(x, z)) landings.push([x, z]);
      }
    }
    // a flock of three in the plot nearest the lane z 45, two farther in
    const byLane = wet.slice().sort((p, q) => Math.hypot(centre(p).x - 60, centre(p).z - 50) - Math.hypot(centre(q).x - 60, centre(q).z - 50));
    const birds = [];
    const Y = 0.05;
    for (const [p, n] of [[byLane[0], 3], [byLane[Math.min(3, byLane.length - 1)], 2]]) {
      if (!p) continue;
      const c = centre(p);
      for (let k = 0; k < n; k++) {
        const x = c.x + (k - (n - 1) / 2) * 2.4 + (k % 2) * 0.6, z = c.z - (k % 2) * 1.2;
        birds.push({ x, z, y: Y - 0.045, water: Y, yaw: 1.2 + k * 1.9, area: any, landings });
      }
    }
    if (birds.length) {
      const cx = birds.reduce((a, b) => a + b.x, 0) / birds.length, cz = birds.reduce((a, b) => a + b.z, 0) / birds.length;
      const egrets = buildWaders(actx, { kind: 'egret', birds, marks, reflect: 0, bounds: [cx, 0, cz, 80] });
      egrets.list && kinds.push({ x: cx, z: cz, r: 60, name: 'egrets', wet: true, mesh: 'egret', draw: 90, update: egrets.update, list: egrets.list });
    }
    // the cabbage whites' renge (below)
    rengeSpots = plan.plots.filter((p) => p.kind === 'renge').map(centre);
  }



  /* ---- pigeons: the station plaza and the shopping spine ---- */
  {
    const P = TOWN.plaza, B = TOWN.station.building;
    const trunk = { x: (P.x0 + P.x1) / 2 + 4, z: (P.z0 + P.z1) / 2 };
    const plazaAvoid = (x, z) => Math.hypot(x - trunk.x, z - trunk.z) < 4.2 || x < P.x0 + 1 || x > P.x1 - 1 || z < P.z0 + 0.5 || z > P.z1 - 3.5;
    // the station's roof edge, facing the plaza
    const roof = [];
    for (let x = B.x0 + 1; x < B.x1 - 1; x += 0.45) if (x < -56.5 || x > -43.5) roof.push({ x, y: 1.08 + 3.4 + 0.3, z: B.z0 - 0.43, ry: Math.PI, along: 0.3 });
    // the spine's wires, a few metres either way
    const wires = (x, z, reach) => {
      const out = [];
      for (const run of core?.kit?.wireRuns ?? []) {
        for (let i = 0; i < run.points.length - 1; i++) {
          const a = run.points[i], c = run.points[i + 1];
          const len = a.distanceTo(c);
          if (len < 6) continue;
          const curve = sagCurve(a, c, (run.sag ?? POLES.sag) * Math.min(1.6, len / 14), 12);
          const along = Math.atan2(c.x - a.x, c.z - a.z);
          for (let t = 0.15; t < 0.86; t += 0.05) {
            const q = curve.getPoint(t);
            if (Math.hypot(q.x - x, q.z - z) < reach) out.push({ x: q.x, y: q.y + 0.005, z: q.z, ry: along + Math.PI / 2, along: 0 });
          }
        }
      }
      return out;
    };
    const spine = { x: -50.6, z: /*@mini 70.5 @*/103.5/*@@*/ };
    const spineWires = wires(spine.x, spine.z, 18);
    const flocks = [
      { x: -51.5, z: 131.5/*@dz*/, n: ANIMALS.pigeons.plaza, r: 3, y: ctx.groundAt(-51.5, 131.5/*@dz*/), perches: roof, avoid: plazaAvoid },
    ];
    if (spineWires.length) flocks.push({ x: spine.x, z: spine.z, n: ANIMALS.pigeons.spine, r: 2.0, y: ctx.groundAt(spine.x, spine.z), perches: spineWires, avoid: (x) => Math.abs(x - spine.x) > 2.2 });
    const pigeons = buildPigeons(actx, { flocks, shadows, bounds: [-51, 3, 118/*@dz*/, 42] });
    kinds.push({ x: -51, z: 118/*@dz*/, r: 40, name: 'pigeons', shadowed: true, mesh: 'pigeons', draw: 70, update: pigeons.update, list: pigeons.list });
  }

  /* ---- Hachi's own home, across the level crossing: his kennel, his toys, his garden (home.js; the dog is out: it
   * is the guide, below) ---- */
  /*@mini @*/buildHachiHome(actx);/*@@*/   // (not in the pocket town)

  /* ---- the guide: the shiba that leads you round (Tan, 2026-09-28) ---- */
  const guide = buildGuide(actx, { spots, shadows, core, facing });

  /* ---- cabbage whites over the renge and the walks' flowers ---- */
  {
    const W = L.sunk.walk;
    const patches = [
      ...rengeSpots.slice(0, 2).map((c) => ({ x: c.x, z: c.z, y: 0.25, r: 3, n: 3 })),   // over the paddies' renge
      { x: 57, z: 108/*@dz*/, y: 0.4, r: 2.6, n: 3 },                // the pond's hedges, by the tea house
      { x: 94, z: 125/*@dz*/, y: 0.4, r: 2.6, n: 2 },                // and on its east bank
      { x: -9, z: L.walks.town[1] - 0.8, y: W + 0.22, r: 3.2, n: 3 },   // the town-side lower walk's flowers
      { x: 22, z: L.walks.far[0] + 0.8, y: W + 0.22, r: 3, n: 3 },       // the far lower walk
    ];
    const butterflies = buildButterflies(actx, { patches });
    kinds.push({ x: 40, z: 40, r: 110, name: 'butterflies', mesh: 'butterflies', draw: 25, update: butterflies.update, list: butterflies.list });
  }

  /* ---- the frame: each kind moves only with the camera near ---- */
  const NEAR = ANIMALS.near;
  let camL = { x: 0, y: 0, z: 0 };
  // each kind's meshes (and reflections), hidden when the camera is far off
  for (const k of kinds) k.meshes = group.children.filter((m) => m.name === `animals-${k.mesh}` || m.name === `animals-${k.mesh}-reflection`);
  const tick = (dt, cam) => {
    if (!cam) return;
    const p = ctx.toLocal({ x: cam.x, z: cam.z });
    camL = { x: p.x, y: cam.y, z: p.z };
    guide.update(dt, cam);                     // always near you, by design; world frame
    let wet = false, any = true;               // (the guide's shadow: always)
    for (const k of kinds) {
      const d = Math.hypot(k.x - camL.x, k.z - camL.z);
      // drawn while any of them is within `draw` of the camera
      let near = Infinity;
      for (const a of k.list) { const q = Math.hypot(a.x - camL.x, a.z - camL.z); if (q < near) near = q; }
      const show = near < k.draw;
      for (const m of k.meshes) m.visible = show;
      any ||= show && k.shadowed;
      if (d > NEAR + k.r) continue;
      k.update(dt, camL);
      wet ||= !!k.wet;
    }
    if (wet) marks.update(dt);
    if (wet) marks.cull(camL); else for (const m of marks.meshes) m.visible = false;
    shadows.mesh.visible = any;
    // under the water: never in the pond's mirror (main.js tags by place, late)
    for (const m of below) m.layers.disable(REFLECT);
  };
  // only the pond's own (turtles, ducks, the stones) belong in its mirror
  const below = group.children.filter((m) => m.isMesh && !['animals-turtles', 'animals-ducks', 'animals-stones'].includes(m.name));
  ctx.update(tick);

  /* dev: step the animals on by `sec` seconds (the shots freeze time) */
  if (import.meta.env?.DEV && typeof window !== 'undefined') {
    window.__animals = {
      step(sec = 1, fps = 30, move = null) {
        for (let t = 0; t < sec; t += 1 / fps) {
          if (move) camL = { ...camL, x: camL.x + move[0] / fps, z: camL.z + move[1] / fps };
          for (const k of kinds) if (Math.hypot(k.x - camL.x, k.z - camL.z) <= NEAR + k.r) k.update(1 / fps, camL);
          marks.update(1 / fps);
        }
      },
      kinds,
      cam: () => camL,
      group,
      edge: (x, z) => benches.edgeNear(x, z),
    };
  }

  return { kinds, shadows, marks, reflect: REFLECT };
}
