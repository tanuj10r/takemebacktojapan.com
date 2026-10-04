import * as THREE from 'three';
import { cel, setWearTexture } from '../core/toon.js';
import { wearAtlas } from '../world/kit/paint.js';
import { WORLD, TOWN, LAWSON, MOBILE } from '../config.js';
import { makeCtx } from '../world/ctx.js';
import { cutSinks } from '../world/sinkcut.js';
import { buildLawson } from '../world/lawson.js';
import { dressLawsonGround } from '../world/lawson-dress.js';
import { buildFuji } from '../world/fuji.js';
import { buildFrame, buildOldTown } from '../world/town-edge.js';
import { buildCore } from '../world/town-core.js';
import { buildPetals } from '../world/petals.js';
import { mergeStatic } from '../world/merge.js';
import { buildTownSakura } from '../world/kit/sakura.js';
import { buildLand } from '../world/land/index.js';
import { makeExperiences } from '../world/experiences.js';
import { buildAnimals } from '../world/animals/index.js';
import { GUIDE } from '../world/animals/guide.js';
import { makeNight } from '../world/kit/night.js';

/* ------------------------------------------------------------------ *
 * The town (SPEC section 3).
 *
 * Places everything in the world: the Lawson and its road (M1), and round
 * them the compact town (M2) -- main road, railway with its level crossing
 * and station, shopping street, residential lane, park, sakura, poles and
 * wires -- then batches the static geometry by material.  Sakura Crossing's
 * modules are used as parts, placed in our layout with our own signs.
 * ------------------------------------------------------------------ */

/* LITE: `stage(name)` is told as each big part is done (the ?diag readout
 * keeps the last, so a phone that dies while building says where), and
 * `shrink(root, store)` caps each part's painted pages as soon as it is
 * built (MOBILE.maxTexture: the desktop's own sizes in the pocket edition). */
/* MINI: the static batching, in passes by what a mesh is painted with (world/merge.js does the merging; this
 * says what goes together, by holding the rest back for a pass with userData.keep / noAtlas).  On the desktop
 * the whole town is one pass: 128 m cells, every sign packed into one atlas (~90 MB there, always resident).
 * A phone wants fewer draws and pages that can shrink or leave when you are far from them:
 *
 *   bulk    everything with no picture of its own: plain colours (they batch by lighting style, coloured per
 *           vertex) and the tiling skins the whole town shares (siding, roofs, asphalt).  Nothing here can be
 *           given back by distance, so it goes in big cells (MOBILE.bulkCell): a style is a draw or two a view,
 *           not one per 64 m square
 *   page    a big picture of its own (over MOBILE.atlas.max texels: ドンペン堂's boards), used in one part of
 *           town: its own texture, batched in small cells (MOBILE.cell), so it shrinks and leaves with them
 *   own     the smaller pictures that belong to one part of town (a shop's fascia, a house's name board):
 *           packed into that region's own atlas page (MOBILE.atlas.z, .x cut the town into regions), one batch
 *           a material a region; the page is whole only while you are near the region (lite.js: a quarter-size
 *           copy from afar)
 *   shared  small pictures used all over (road signs, pole plates): one atlas, in the big cells.  (Tried and
 *           dropped: copying these into every region's page, 35 MB a region near you; and a higher size limit,
 *           100 k texels: 38 MB of shared atlas, whole wherever you stand.)
 *
 * A pass sees only its own meshes; what a pass makes stays out of the passes after it. */
function splitMulti(root) {
  // (world/merge.js splitMulti, word for word: here so every part can be put in its own pass)
  const dyn = (o) => { for (let a = o; a; a = a.parent) if (a.userData.dynamic) return true; return false; };
  const list = [];
  root.traverse((o) => { if (o.isMesh && !o.isInstancedMesh && Array.isArray(o.material) && !o.userData.keep && o.visible) list.push(o); });
  for (const o of list) {
    if (dyn(o) || !o.parent) continue;
    const src = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry;
    const groups = src.groups.length ? src.groups : [{ start: 0, count: src.attributes.position.count, materialIndex: 0 }];
    const parts = [];
    for (const gr of groups) {
      const mat = o.material[gr.materialIndex];
      if (!mat || gr.count === 0) continue;
      const geo = new THREE.BufferGeometry();
      for (const [name, attr] of Object.entries(src.attributes)) {
        const n = attr.itemSize;
        geo.setAttribute(name, new THREE.BufferAttribute(attr.array.slice(gr.start * n, (gr.start + gr.count) * n), n, attr.normalized));
      }
      const m = new THREE.Mesh(geo, mat);
      m.position.copy(o.position); m.quaternion.copy(o.quaternion); m.scale.copy(o.scale);
      m.castShadow = o.castShadow; m.receiveShadow = o.receiveShadow; m.renderOrder = o.renderOrder;
      m.userData = { ...o.userData };
      o.parent.add(m);
      parts.push(m);
    }
    for (const c of [...o.children]) (parts[0] ?? o.parent).add(c);
    o.parent.remove(o);
    if (src !== o.geometry) src.dispose();
  }
}

function mergeMini(root, { cell, bulkCell, detailCell }) {
  splitMulti(root);
  root.updateMatrixWorld(true);
  const { z: zs, x: xs, max } = MOBILE.atlas;
  const c = new THREE.Vector3();
  const region = (o) => {
    if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
    c.copy(o.geometry.boundingSphere.center).applyMatrix4(o.matrixWorld);
    let i = 0, j = 0;
    while (i < zs.length && c.z < zs[i]) i++;
    while (j < xs.length && c.x > xs[j]) j++;
    return i * (xs.length + 1) + j;
  };
  const count = (zs.length + 1) * (xs.length + 1);
  /** can world/merge.js pack this mesh's picture into an atlas page (its own test, in short) */
  const packs = (o) => {
    const m = o.material, t = m?.map;
    if (!t || Array.isArray(m) || !(m.isMeshBasicMaterial || m.isMeshToonMaterial) || m.userData.live || m.alphaMap) return false;
    if (!(t.image?.width > 0) || t.wrapS !== THREE.ClampToEdgeWrapping || t.wrapT !== THREE.ClampToEdgeWrapping) return false;
    if (t.repeat.x !== 1 || t.repeat.y !== 1 || t.offset.x !== 0 || t.offset.y !== 0 || t.rotation !== 0 || !t.flipY) return false;
    for (let a = o; a; a = a.parent) if (a.userData.noAtlas) return false;
    return true;
  };
  const meshes = [], regionsOf = new Map();
  root.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || o.userData.keep) return;
    const m = { o, r: region(o), noAtlas: o.userData.noAtlas, packs: packs(o) };
    if (m.packs) {
      const src = o.material.map.source;
      if (!regionsOf.has(src)) regionsOf.set(src, new Set());
      regionsOf.get(src).add(m.r);
    }
    meshes.push(m);
  });
  for (const m of meshes) {
    // BUDGET: what has no picture at all in one batch a style for the whole town (`plain`): nothing of it can shrink or leave anyway
    if (!m.packs) { m.pass = m.o.material?.map || Array.isArray(m.o.material) ? 'bulk' : 'plain'; continue; }
    const t = m.o.material.map, one = regionsOf.get(t.source).size === 1;
    const small = t.image.width * t.image.height <= max && Math.max(t.image.width, t.image.height) <= 1024;   // (merge.js packs nothing wider than 1024 at its own size)
    m.pass = small ? (one ? 'own' + m.r : 'shared') : (one ? 'page' : 'bulk');
  }
  const known = new Set(), made = [];
  root.traverse((o) => { if (o.isMesh) known.add(o); });
  const passes = [
    ['plain', { cell: MOBILE.plainCell ?? bulkCell, detailCell }, false],
    ['bulk', { cell: bulkCell, detailCell }, false],
    ['page', { cell, detailCell }, false],
    ...Array.from({ length: count }, (_, r) => ['own' + r, { cell: 0, detailCell, atlas: true }, true]),
    ['shared', { cell: MOBILE.plainCell ?? bulkCell, detailCell, atlas: true }, true],
  ];
  // (measuring: how many pictures and texels each pass holds)
  { const st = {}; const seen = new Set(); for (const m of meshes) { const t = m.o.material?.map; if (!m.packs || seen.has(m.pass + t.source.uuid)) continue; seen.add(m.pass + t.source.uuid); const e = (st[m.pass] ??= { n: 0, mtx: 0 }); e.n++; e.mtx += t.image.width * t.image.height / 1e6; } globalThis.__mergeStats = st; }
  if (import.meta.env?.DEV) {
    // (measuring: the shared pass's pictures, their size, how many regions wear them, and who)
    const seen = new Map();
    for (const m of meshes) if (m.pass === 'shared') { const t = m.o.material.map; let who = ''; for (let a = m.o; a && !who; a = a.parent) who = a.name; const e = seen.get(t.source) ?? [t.image.width, t.image.height, regionsOf.get(t.source).size, 0, who]; e[3]++; seen.set(t.source, e); }
    globalThis.__mergeShared = [...seen.values()].sort((x, y) => y[0] * y[1] - x[0] * x[1]);
  }
  let out = null;
  for (const [name, opts, atlas] of passes) {
    for (const m of meshes) {
      const other = m.pass !== name;
      m.o.userData.keep = other || undefined;
      m.o.userData.noAtlas = other || !atlas || m.noAtlas;
    }
    out = mergeStatic(root, opts);
    // this pass's batches are its own
    root.traverse((o) => { if (o.isMesh && !known.has(o)) { o.userData.keep = true; known.add(o); made.push(o); } });
  }
  for (const m of meshes) {
    delete m.o.userData.keep;
    if (m.noAtlas === undefined) delete m.o.userData.noAtlas; else m.o.userData.noAtlas = m.noAtlas;
  }
  for (const o of made) delete o.userData.keep;
  return out;
}

export function buildTown(scene, { cell = 128, bulkCell = 128, detailCell = 0, stage = () => {}, shrink = null } = {}) {
  const root = new THREE.Group();
  root.name = 'town';
  scene.add(root);
  const ctx = makeCtx(scene, root);
  if (import.meta.env?.DEV) globalThis.__sysRoot = root;   // dev (scripts/_budget.mjs): what each part of the build made, and how long it took
  // the shared painted weather every worn surface reads (M2e, kit/paint.js)
  /* POCKET: the painted weather at MOBILE.wear texels a side (the desktop's 2048): soft grime and
   * streaks, low in detail, seen magnified on every wall */
  const wear = wearAtlas();
  if (MOBILE.wear && wear.image.width > MOBILE.wear) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = MOBILE.wear;
    const c = cv.getContext('2d');
    c.imageSmoothingQuality = 'high';
    c.drawImage(wear.image, 0, 0, MOBILE.wear, MOBILE.wear);
    wear.image.width = wear.image.height = 1;
    wear.image = cv;
    wear.needsUpdate = true;
  }
  setWearTexture(wear);

  /* --- the Lawson and the road in front of it (M1) --- */
  const lawson = buildLawson(root);
  ctx.colliders.push(...lawson.colliders);
  ctx.platforms.push(...lawson.platforms);
  for (const s of lawson.surfaces) ctx.surface(s);
  shrink?.(lawson.root, true);            // LITE: the konbini's pages, now
  globalThis.__sys?.('konbini');
  stage('built: konbini');

  /* --- the town (M2e.3): built in its own tested frame, turned half round
   * about the main road, so it stands between the Lawson and Fuji and you
   * walk into it from the famous views.  T is that frame; the world ctx
   * keeps the Lawson, the road and what the famous views see. --- */
  const T = ctx.turned(TOWN.grid.main, 'town-turned');
  // experience spots (Tan's seven things to do): one set per frame
  const expWorld = makeExperiences(ctx), expTown = makeExperiences(T);
  ctx.experiences = expWorld;
  T.experiences = expTown;
  // the density registry lives in the town's frame, with its decals and lots
  const registry = [];
  T.registry = registry;
  const localRect = (r) => {
    const a = T.toLocal({ x: r[0], z: r[1] }), b = T.toLocal({ x: r[2], z: r[3] });
    return [Math.min(a.x, b.x), Math.min(a.z, b.z), Math.max(a.x, b.x), Math.max(a.z, b.z)];
  };
  ctx.registry = { push: (e) => registry.push({ ...e, ...T.toLocal(e), ...(e.rect ? { rect: localRect(e.rect) } : {}) }) };
  // the Lawson counts toward the density budget like any building
  ctx.registry.push({ kind: 'building', x: 0, z: -5, rect: [-8.5, -LAWSON.depth, 11.1, 0] });
  const frame = buildFrame(ctx);
  /* MINI: past the core's side fences (|x| > 97) the main road runs on 20 m between tree lines to its barricade.
   * North of it there the ground is the open strip beside the town (bare ground, the railway's cutting end on):
   * not a place to walk on a phone.  The pavement's back edge is the limit, under the trees. */
  for (const sx of [-1, 1]) ctx.collide(Math.min(sx * 97.2, sx * 123), 6.6, Math.max(sx * 97.2, sx * 123), 7.0, 3);
  T.sakura = [];                 // the old town's trees join the town's batch
  buildOldTown(T);
  globalThis.__sys?.('frame');
  T.night = makeNight(T);        // before the land, so its lantern can light the ground
  buildLand(T);                  // paddies, the river, the Deer Park gate (town pass)
  globalThis.__sys?.('land');
  stage('built: land');
  // the Lawson's lot is worn with the town's own decals (oil, scuffs,
  // patches), placed in world terms and turned into the town's frame
  T.onDecals = (decals) => dressLawsonGround({
    add: (cell, x, z, across, along, f = { x: 0, z: -1 }, y, layer) => {
      const p = T.toLocal({ x, z });
      decals.add(cell, p.x, p.z, across, along, { x: -f.x, z: -f.z }, y, layer);
    },
  });
  const core = buildCore(T);
  globalThis.__sys?.('core-rest');
  shrink?.(root, false);                  // LITE: the town's pages, before they are packed into the atlas
  stage('built: town core');
  // wave 3: koi, ducks, herons, pigeons... (world/animals/), and the guide shiba, which
  // reads the experiences (every frame's list, world coordinates) and where you look
  const animals = buildAnimals(T, { core, spots: () => [...expWorld.list, ...expTown.list, ...lawson.experiences.list], facing: () => camDir });

  /* The line, seen from the world: its crossing, its trains' events and
   * their gusts in world terms (`local` is the line itself, for checks
   * that run in its own frame). */
  // the two cherries framing the famous view: the town's painted tree, in
  // the world's frame (its own small batch; lit at night like the rest)
  globalThis.__sys?.('animals');
  const frameSakura = buildTownSakura({ ...ctx, night: T.night }, frame.sakura, { classic: true });   // the famous views' own trees keep their look
  const L = core.line;
  const line = Object.create(L, {
    local: { value: L },
    crossingPos: { get: () => T.toWorld(L.crossingPos) },
    onEvent: { value: (fn) => L.onEvent((name, run) => fn(name, run && run.x !== undefined ? { ...run, ...T.toWorld(run) } : run)) },
    gustAt: { value: (p) => { const a = L.gustAt(T.toLocal(p)); return { gust: a.gust, dir: -a.dir }; } },
  });
  /** The camera as the town's frame sees it (sakura culling, birds). */
  const camLocal = { isCamera: true, position: new THREE.Vector3(), fov: 50, aspect: 1, getWorldDirection: null };
  const camDir = new THREE.Vector3();
  // bottles behind a vending machine's glass shadow only its own insides
  root.traverse((o) => {
    if (o.isInstancedMesh && o.parent?.name === 'vending') o.castShadow = false;
  });


  globalThis.__sys?.('frame-sakura');
  const camPos = new THREE.Vector3(0, 0, 16.5);
  // no petals fall inside the store (M3d): its footprint under the roof
  const indoors = [{ x0: -LAWSON.width / 2 - 0.1, x1: LAWSON.width / 2 + LAWSON.wingWidth, z0: -LAWSON.depth - 0.1, z1: 0.05, top: LAWSON.height }];
  const petals = buildPetals(ctx, {
    count: TOWN.petals.air, half: 24, trackZ: T.toWorld({ x: 0, z: TOWN.rail.z }).z, follow: () => camPos, exclude: indoors, land: true,
  });
  // and the fall from the town's sakura (M2d), a separate field so the famous
  // views keep M2's petals exactly
  const railZ = T.toWorld({ x: 0, z: TOWN.rail.z }).z;
  const fall = buildPetals(ctx, {
    count: TOWN.petals.trees, half: 24, trackZ: railZ, follow: () => camPos,
    emitters: [...(core.sakura?.emitters ?? []).map((e) => T.toWorld(e)), ...(frameSakura?.emitters ?? [])], onlyTrees: true, seed: 8211, exclude: indoors, land: true,
    pup: { where: () => GUIDE.where?.() ?? null, listen: (fn) => { GUIDE.onPetal = fn; } },      // (Hachi's petal: the one he sneezes off his nose)
  });
  for (const m of fall.meshes) m.userData.dynamic = true;
  for (const m of petals.meshes) m.userData.dynamic = true;

  /* --- ground: one plane, open over any sunken ground (ctx.sink: the
   * river's channel, town pass), so it is built after everything else.
   * Every other flat piece of street-level ground (the Lawson's lot, walks)
   * is cut back to the sinks' edges too, or it caps the channel from above
   * (sinkcut.js; quality pass). --- */
  globalThis.__sys?.('petals');
  cutSinks(root, ctx.sinks);
  const groundMat = cel({ color: WORLD.groundColor, bands: 3, tint: 0x7a7396, cache: false });
  groundMat.userData.live = true;
  {
    const h = WORLD.groundHalf;
    const shape = new THREE.Shape([new THREE.Vector2(-h, -h), new THREE.Vector2(h, -h), new THREE.Vector2(h, h), new THREE.Vector2(-h, h)]);
    // the shape lies in (x, -z): it is turned flat below, so y becomes -z
    for (const k of ctx.sinks) {
      const x0 = Math.max(-h + 1, k.x0), x1 = Math.min(h - 1, k.x1), z0 = Math.max(-h + 1, k.z0), z1 = Math.min(h - 1, k.z1);
      shape.holes.push(new THREE.Path([new THREE.Vector2(x0, -z1), new THREE.Vector2(x0, -z0), new THREE.Vector2(x1, -z0), new THREE.Vector2(x1, -z1)]));
    }
    const g = new THREE.ShapeGeometry(shape);
    g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, groundMat);
    m.receiveShadow = true;
    m.frustumCulled = false;
    m.userData.keep = true;
    m.name = 'ground';
    root.add(m);
  }

  // batched per 128 m cell, so the camera and the shadow map can cull
  // the Lawson keeps its own textures: the famous view never changes
  lawson.root.userData.noAtlas = true;
  lawson.ground.userData.noAtlas = true;
  // small props (the kit's detail tag) still take shadows but cast none:
  // at their size the shadow pass pays far more than it shows (SPEC 11)
  const small = (o, on) => {
    on ||= !!o.userData.detail;
    if (on && o.isMesh) o.castShadow = false;
    for (const c of o.children) small(c, on);
  };
  small(root, false);
  /* LITE: a batch is split by its shadow flags too, so every style came in
   * up to four batches a cell.  A basic (unlit) material shows no shadow
   * whatever its flag says, and a toon one takes them: one receive flag
   * each, and a cell's batches are about halved. */
  root.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || Array.isArray(o.material)) return;
    if (o.material.isMeshBasicMaterial) o.receiveShadow = false;
    else if (o.material.isMeshToonMaterial) o.receiveShadow = true;
  });
  shrink?.(root, false);
  globalThis.__sys?.('ground');
  if (import.meta.env?.DEV && window.__preMerge) window.__preMerge(root, core, T);   // dev: the cost of each part, before batching
  stage('batching');
  const batching = mergeMini(root, { cell, bulkCell, detailCell });   // MINI: in passes by what a mesh is painted with (above)
  globalThis.__sys?.('merge');
  stage('batched');

  /* --- Mt. Fuji, riding with the camera like the sky --- */
  const fuji = buildFuji(scene);

  // what the pond's mirror shows (world rect): its grounds and 25 m round
  // (and the paddies' mirror: the two sit side by side, so one rect holds both)
  const pb = TOWN.land.pond?.box && [
    Math.min(TOWN.land.pond.box[0], TOWN.land.paddies?.box[0] ?? Infinity), Math.min(TOWN.land.pond.box[1], TOWN.land.paddies?.box[1] ?? Infinity),
    Math.max(TOWN.land.pond.box[2], TOWN.land.paddies?.box[2] ?? -Infinity), Math.max(TOWN.land.pond.box[3], TOWN.land.paddies?.box[3] ?? -Infinity)];
  const worldRect = (r, pad) => {
    const a = T.toWorld({ x: r[0], z: r[1] }), b = T.toWorld({ x: r[2], z: r[3] });
    return [Math.min(a.x, b.x) - pad, Math.min(a.z, b.z) - pad, Math.max(a.x, b.x) + pad, Math.max(a.z, b.z) + pad];
  };
  // and the river's mirror (land/channel.js): the channel's stretch through the town, 12 m round
  const rv = TOWN.land.sunk && TOWN.land.riverMirror && [TOWN.land.riverMirror[0], TOWN.land.sunk.z0, TOWN.land.riverMirror[1], TOWN.land.sunk.z1];
  const reflectRect = pb && [worldRect(pb, 25), ...(rv ? [worldRect(rv, 12)] : [])];

  return {
    root,
    reflectRect,
    /** Every experience spot, world positions (the minimap's stars). */
    experiences: { get list() { return [...expWorld.list, ...expTown.list]; } },
    colliders: ctx.colliders,
    interactables: ctx.interactables,
    bounds: WORLD.bounds,
    /** The one walkable rect outside the bounds: Hachi's garden beyond the south fence (core/player.js). */
    pocket: (() => { const H = TOWN.hachiHome, a = T.toWorld({ x: H.x0, z: H.z0 - 2.5 }), b = T.toWorld({ x: H.x1, z: H.z1 }); return { x0: Math.min(a.x, b.x), x1: Math.max(a.x, b.x), z0: Math.min(a.z, b.z), z1: Math.max(a.z, b.z) }; })(),
    lawson,
    /** The falling petals' meshes (M3d: checked to stay out of the store). */
    petalMeshes: [...petals.meshes, ...fall.meshes],
    core,
    registry,                  // in the town's frame (density checks run there)
    fuji,
    line,
    /** The town's frame (turned): toWorld / toLocal / yawToWorld. */
    frame: { toWorld: T.toWorld, toLocal: T.toLocal, yawToWorld: T.yawToWorld },
    batching,
    /** Ground height at (x, z); see ctx.heightAt for `fromY`. */
    heightAt: ctx.heightAt,
    setLook(look) {
      groundMat.color.set(look.ground);
      lawson.setLook(look);
      core.kit.setLook(look);
      core.line.setLook(look);
      core.night.setLook(look);
      fuji.setLook(look);
    },
    update(dt, camera) {
      if (camera) camPos.copy(camera.position);
      for (const fn of ctx.updaters) fn(dt, camPos);   // camPos: where the camera is, in the world
      lawson.update(dt, camPos);          // the automatic door
      const lp = T.toLocal(camPos);
      camLocal.position.set(lp.x, camPos.y, lp.z);
      if (camera) {
        camera.getWorldDirection(camDir);
        camLocal.fov = camera.fov; camLocal.aspect = camera.aspect;
        camLocal.getWorldDirection = (v) => v.set(-camDir.x, camDir.y, -camDir.z);
      }
      core.sakura?.update(camera ? camLocal : camLocal.position);
      core.green?.update(camera ? camLocal : camLocal.position);
      frameSakura?.update(camera ?? camPos);
      core.life?.update(dt, camLocal.position);
      const air = line.gustAt(camPos);
      petals.update(dt, air.gust, air.dir);
      fall.update(dt, air.gust, air.dir);
      if (camera) fuji.follow(camera);
    },
  };
}
