import * as THREE from 'three';
import { cel } from '../core/toon.js';
import { makeCtx } from '../world/ctx.js';
import { buildTownSakura } from '../world/kit/sakura.js';
import { buildWalkSignal } from '../world/signals.js';
import { SLOWLIFE, ANIMALS } from '../config.js';

/* ------------------------------------------------------------------ *
 * The key art's diorama (dev only: ?poster, rendered by scripts/keyart.mjs).
 *
 * One made-up frame that holds as much of the town as it can, the way a
 * poster would: NIPPON under Fuji at golden hour, Hachi sitting on a zebra
 * at your feet, its walk light green, the local train standing at the
 * level crossing with the gates down, the shrine's torii beyond, the
 * slow-life bench and its jizo under a cherry, Han leaning on the RX-7,
 * ドンペン堂 and its penguin.  Nothing is drawn for it: the town is built
 * unmerged (buildTown { merge: false }) and its places are picked up and
 * set down in front of the lens, each by its own group.
 *
 * Placement is in the lens's terms: `f` is the screen fraction left to
 * right, `a` the metres down the view, so the frame is composed on the
 * screen and survives a change of lens.  The layout keeps Fuji's peak left
 * of centre, the sky top right clear for the start card's title, and
 * nothing under the PAUSED chip (top left: blossom only).
 * ------------------------------------------------------------------ */

export const POSTER = {
  lens: { pos: [-23, 33.4], yaw: -0.45, vfov: 38.5, pitch: 0.045, lift: 0 },
  // the railway, square across the view: the crossing at (f, a), the train at the platform, pulling out
  rail: { f: 0.3, a: 22, trainShift: -6.5, depart: 3 },
  // a zebra across a road at your feet (6.9 m, as signals.js paints one); a side street's walk post on its far kerb
  zebra: { f: 0.45, a: 8, w: 4.6 },
  walkPost: { f: 0.26, a: 11.6 },
  // the photographers' lot under the zebra: its bay lines and wheel stops sink out of sight (world rect)
  clearLot: [-45, 20.2, 15, 38],
  megastore: { f: 0.87, a: 66, turn: 0.35 },
  rx7: { f: 0.82, a: 11.5, turn: 2.2 },
  shrine: { f: 0.34, a: 44 },
  bench: { f: 0.07, a: 9 },
  sakura: [{ f: -0.22, a: 7.5, s: 1.1 }],
  hachi: { f: 0.45, a: 5.9, pose: 'sit', size: 1.8 },     // (a little larger than life in the picture: Tan)
};

/* The phone's start card, upright (Tan, 2026-10-04: "the banner doesn't fit on mobile... even Fuji is half hidden"):
 * the picture there is the screen above the sheet, ~3:4, so its own frame at 3:4, the classic view square on:
 * NIPPON under Fuji, the torii to the left, Han leaning on the RX-7 on the store's forecourt, Hachi on the zebra at
 * the foot; the sky above clear for the title. */
export const POSTER_PORTRAIT = {
  // (Fuji a little left of the middle and the sky above it bare: the title sits top right; everything kept 10% in from
  // the sides and the zebra low, as the picture above the sheet runs from ~0.62 (a tall phone) to ~0.9 (Safari's bars))
  lens: { pos: [-7, 30], yaw: -0.24, vfov: 58, pitch: 0.19, lift: 0 },
  rail: null,                       // (no railway band: the main road and NIPPON's forecourt lie between the kerb and the store)
  zebra: { f: 0.48, a: 6.3, w: 4.6 },
  walkPost: { f: 0.2, a: 10.5 },
  clearLot: [-30, 18, 30, 40],
  clearTo: 20,
  megastore: null,
  rx7: { f: 0.7, a: 22.8, turn: 1.75 },   // parked on NIPPON's forecourt (Tan: on the footpath, sunk, at 12.5 m)
  shrine: { f: 0.12, a: 28 },
  bench: { f: -0.4, a: 9 },
  sakura: [{ f: -0.1, a: 9, s: 1.0 }],
  hachi: { f: 0.48, a: 5.4, pose: 'sit', size: 1.8 },
};

/**
 * Stage the diorama.  Returns the `__shot` options for its lens.
 * @param o.scene, o.world, o.applyLook  the game's own (main.js)
 */
export function stagePoster({ scene, world, applyLook, layout = POSTER, aspect = 16 / 9 }) {
  const S = layout, L = S.lens;
  const box = new THREE.Box3();
  const tanH = Math.tan((L.vfov * Math.PI) / 360) * aspect;
  const dir = [-Math.sin(L.yaw), -Math.cos(L.yaw)], right = [Math.cos(L.yaw), -Math.sin(L.yaw)];
  const obj = (n) => (typeof n === 'string' ? scene.getObjectByName(n) : n);

  /** world { x, z } at screen fraction f, `a` metres down the view */
  const at = (f, a) => {
    const t = (2 * f - 1) * tanH;
    return { x: L.pos[0] + dir[0] * a + right[0] * a * t, z: L.pos[1] + dir[1] * a + right[1] * a * t };
  };
  /** a world point in the lens's terms */
  const lens = (x, z) => {
    const v = [x - L.pos[0], z - L.pos[1]];
    const a = v[0] * dir[0] + v[1] * dir[1], lat = v[0] * right[0] + v[1] * right[1];
    return { a, f: 0.5 + (0.5 * lat) / a / tanH };
  };

  /* Moving a place: it goes into a pivot under its own parent, so code that
   * moves it in its parent's frame (Han's car, the trains) keeps working. */
  const put = (o, { x, z, yaw = 0, anchor }) => {
    o = obj(o);
    let pv = o.userData.posterPivot;
    if (!pv) {
      o.updateWorldMatrix(true, true);
      box.setFromObject(o);
      const c = box.getCenter(new THREE.Vector3());
      pv = { node: new THREE.Group(), anchor: new THREE.Vector3(c.x, box.min.y, c.z) };
      pv.node.name = 'poster-pivot:' + o.name;
      o.parent.add(pv.node);
      pv.node.add(o);
      o.userData.posterPivot = pv;
    }
    const a = anchor ? new THREE.Vector3(...anchor) : pv.anchor;
    const M = THREE.Matrix4;
    const Tw = new M().makeTranslation(new THREE.Vector3(x, a.y, z))
      .multiply(new M().makeRotationY(yaw))
      .multiply(new M().makeTranslation(a.clone().negate()));
    const parent = pv.node.parent;
    parent.updateWorldMatrix(true, false);
    new M().copy(parent.matrixWorld).invert().multiply(Tw).multiply(parent.matrixWorld)
      .decompose(pv.node.position, pv.node.quaternion, pv.node.scale);
    pv.node.updateMatrixWorld(true);
    return o;
  };
  /** set a place at (f, a), its front (atan2(x, z) radians, as built) turned to the lens, plus `turn` */
  const stage = (o, { f, a, turn = 0 }, front) => {
    const p = at(f, a);
    const to = Math.atan2(L.pos[0] - p.x, L.pos[1] - p.z);
    return put(o, { x: p.x, z: p.z, yaw: to - front + turn });
  };
  /** hide the town's pieces (up to 60 m across) whose middle is a0..a1 m down the view */
  const clear = (a0, a1, keep) => {
    for (const pn of ['town-turned', 'town', 'land']) {
      for (const o of [...obj(pn).children]) {
        if (!o.visible || keep.includes(o.name) || o.name.startsWith('poster') || o.isInstancedMesh) continue;
        if (['ground', 'land', 'town-turned'].includes(o.name)) continue;
        box.setFromObject(o);
        if (box.isEmpty()) continue;
        const s = box.getSize(new THREE.Vector3());
        if (s.x > 60 || s.z > 60) continue;
        const c = box.getCenter(new THREE.Vector3());
        const q = lens(c.x, c.z);
        if (q.a >= a0 && q.a <= a1) o.visible = false;
      }
    }
  };

  /* --- golden hour, no clouds (a cloud's underside peeks in at the top) --- */
  applyLook('golden');
  scene.traverse((o) => { if (o.renderOrder === -9 && o.parent) o.parent.visible = false; });

  /* --- the lens's ground: the lot's cars and clutter cleared --- */
  const keep = ['rx7', 'lawson', 'lawson-ground', 'signals', 'megastore', 'shrine'];
  clear(-5, S.clearTo ?? 14, keep);
  {
    const R = S.clearLot, v = new THREE.Vector3();
    scene.traverse((m) => {
      if (!m.isMesh || !['land-white', 'land-granite'].includes(m.name)) return;
      // merged meshes (the river's mirror has its own copy): sink the vertices in the rect
      const pos = m.geometry.attributes.position;
      m.updateWorldMatrix(true, false);
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
        if (v.x > R[0] && v.x < R[2] && v.z > R[1] && v.z < R[3] && v.y < 0.4) pos.setY(i, -2);
      }
      pos.needsUpdate = true;
      m.geometry.computeBoundingSphere();
    });
  }

  /* --- the railway: line, crossing, station and trains as one set, turned
   * square across the view, the crossing at (f, a) --- */
  const line = world.line.local;
  line.service.stage('platform-shut');
  if (S.rail) {
    const T = obj('town-turned');
    const set = new THREE.Group();
    set.name = 'poster-rail';
    T.add(set);
    for (const n of ['line', 'level-crossing', 'station']) set.add(obj(n));
    for (const o of [...T.children]) if (o.name.startsWith('train-')) set.add(o);
    // the line's far ends (cutting banks 330 m long) would swing through the town, and its catenary crosses Fuji
    obj('line').children.forEach((m, i) => { if (i >= 4 && i <= 11) m.visible = false; });
    const c0 = world.line.crossingPos, p = at(S.rail.f, S.rail.a);
    put(set, { x: p.x, z: p.z, yaw: L.yaw, anchor: [c0.x, 0, c0.z] });
    // the train pulls out of the platform toward the crossing: gates down, lamps on
    const run = line.service.runs.find((r) => r.phase !== 'idle');
    if (run) {
      run.x += S.rail.trainShift;
      Object.assign(run, { phase: 'depart', t: 2, v: S.rail.depart, doors: 0 });
    }
    line.service.update(0);
    Object.assign(line.service.cross, { armT: 1, closing: true, since: 10 });
    line.service.update(0);
    clear(S.rail.a - 12, S.rail.a + 12, keep);
  }

  /* --- the zebra at your feet (signals.js's bars) and a walk post on its far kerb, lit --- */
  {
    const g = new THREE.Group();
    g.name = 'poster-zebra';
    scene.add(g);
    const paint = cel({ color: 0xf2f2f5, bands: 3 });
    const c = at(S.zebra.f, S.zebra.a);
    g.position.set(c.x, 0, c.z);
    g.rotation.y = L.yaw;
    for (let z = -3.45 + 0.5; z < 3.45 - 0.5; z += 0.9) {
      const bar = new THREE.Mesh(new THREE.PlaneGeometry(S.zebra.w, 0.45), paint);
      bar.rotation.x = -Math.PI / 2;
      bar.position.set(0, 0.013, z + 0.225);
      bar.receiveShadow = true;
      g.add(bar);
    }
    // (the main road's junction posts carry car heads 5 m up, across Fuji)
    obj('signals').visible = false;
    const ws = new THREE.Group();
    ws.name = 'poster-walk';
    scene.add(ws);
    const tick = [];
    buildWalkSignal({ add: (o) => ws.add(o), collide() {}, update: (fn) => tick.push(fn) },
      { ends: [at(S.walkPost.f, S.walkPost.a), at(S.walkPost.f, 4.4)], offset: 25 });   // 25 s into its cycle: walk
    for (const fn of tick) fn(0);
    ws.children[1].visible = false;          // the near post, behind the lens
  }

  /* --- the shrine (its torii faces the town: +z), the bench looking at Fuji --- */
  stage('shrine', S.shrine, 0);
  {
    const b = world.frame.toWorld({ x: SLOWLIFE.bench[0], z: SLOWLIFE.bench[1] });
    const p = at(S.bench.f, S.bench.a);
    put('land-slowlife', { x: p.x, z: p.z, yaw: L.yaw, anchor: [b.x, 0, b.z] });
    obj('land-slowlife').traverse((o) => { if (/lantern/.test(o.name)) o.visible = false; });   // (it stands 7 m off, in the road)
  }

  /* --- a cherry of our own over the bench and the top left (the town's classic cherry) --- */
  const g = new THREE.Group();
  g.name = 'poster-sakura';
  scene.add(g);
  const ctx = makeCtx(scene, g);
  ctx.registry = [];
  const trees = buildTownSakura(ctx, S.sakura.map((t, i) => ({ ...at(t.f, t.a), y: 0, scale: t.s, seed: 5100 + i })), { classic: true });
  const update = world.update;
  world.update = (dt, cam) => { update(dt, cam); if (cam) trees.update(cam); };

  /* --- ドンペン堂 (its front faces -x as built), Han and the RX-7 (nose -z), Hachi --- */
  if (S.megastore) stage('megastore', S.megastore, -Math.PI / 2);
  stage('rx7', S.rx7, Math.PI);
  {
    const p = at(S.hachi.f, S.hachi.a);
    const from = { pos: { x: L.pos[0], z: L.pos[1] }, yaw: Math.atan2(L.pos[0] - p.x, L.pos[1] - p.z) };
    ANIMALS.guide.size = S.hachi.size;                      // (the poster page only: dev)
    window.__guide?.stage(S.hachi.pose, from, Math.hypot(p.x - L.pos[0], p.z - L.pos[1]));
  }

  return { pos: [L.pos[0], 0, L.pos[1]], yaw: L.yaw, pitch: L.pitch, lift: L.lift, vfov: L.vfov, clean: true };
}
