import * as THREE from 'three';
import { cel, flat } from '../../../core/toon.js';
import { rngKit } from '../../../core/util.js';
import { soundBus } from '../../../core/soundBus.js';
import { makeTimberFence } from '../../buildings.js';
import { sanpaiNotice } from '../../../core/textures.js';
import { makeParts } from '../../land/geo.js';
import { plant } from '../green.js';
import { LAYER } from '../decals.js';
import { ROADS } from '../../../config.js';
import { SHRINE } from '../../../data/town.js';
import { boxG, cylG, ext, latheG, xf } from './geo.js';
import { toriiTunnel, mainTorii } from './torii.js';
import { haiden, honden, roof } from './halls.js';
import { fox, stoneLantern, temizuya, emaRack, omikujiRack, saisenBox, namePillar, treeRope, fenceStone } from './props.js';
import { gakuTex, stoneNameTex, emaAtlas, chochinTex, trickleTex, noboriTex } from './tex.js';

/* ------------------------------------------------------------------ *
 * 富士見稲荷神社, the town's Inari shrine (Tan's experience 3).
 *
 * From the lane: a low stone fence (玉垣) and the name pillar, the big
 * vermilion Inari torii with its plaque and shimenawa, the stone foxes
 * either side (one with the key to the rice store, one with the jewel),
 * stone lanterns and the water pavilion, then the tunnel of donated torii
 * (千本鳥居) up to the worship hall (拝殿) with its long sweeping roof, the
 * bell and the offering box; behind it the small sanctuary (本殿) in its
 * fence, the old camphor with its rope, the ema and the omikuji, and the
 * wind chimes (Tan's recording) heard only in the grounds.  A sound
 * experience (Tan, 2026-09-28): no highlight and no E, a speaker on the map.
 *
 * Built in the lot's own frame (x across the frontage, z back from it).
 * Cost: the static parts bake into one mesh per material (and static
 * batching folds them into the town's style batches); the tunnel is two
 * InstancedMeshes and one mesh of inscriptions; the trickle and the
 * chimes are the only moving parts, updated only near.
 * ------------------------------------------------------------------ */

let M = null;
function mats() {
  if (M) return M;
  const red = { color: 0xd4462c, bands: 3, tint: 0x7a3f5c };
  M = {
    red: cel(red),
    black: cel({ color: 0x2a2630, bands: 2, tint: 0x4b4560 }),
    white: cel({ color: 0xf3efe6, bands: 3, tint: 0x7a7098 }),
    shadow: cel({ color: 0x3a2c30, bands: 2, tint: 0x2e2640 }),
    stone: cel({ color: 0xc4bfb6, bands: 3, tint: 0x5e5a80 }),
    stoneDark: cel({ color: 0x9a94a0, bands: 3, tint: 0x565078 }),
    foxStone: cel({ color: 0xe4dfd4, bands: 3, tint: 0x6a6490, flat: false }),       // smooth-carved
    bibCloth: cel({ color: 0xcf3526, bands: 3, tint: 0x7a3a58, side: THREE.DoubleSide, flat: false }),
    bib: cel({ color: 0xcf3526, bands: 3, tint: 0x7a3a58, side: THREE.DoubleSide }),
    gold: cel({ color: 0xd9b24c, bands: 3, tint: 0x7a6040 }),
    roof: cel({ color: 0x6f9d8c, bands: 3, tint: 0x3a5270 }),        // weathered copper (緑青)
    roofDark: cel({ color: 0x4f7a6e, bands: 3, tint: 0x2f4262 }),
    under: cel({ color: 0xb23b28, bands: 3, tint: 0x5a2c50 }),        // the eaves' vermilion underside
    hafu: cel({ color: 0xe9e2d2, bands: 3, tint: 0x6f6790, side: THREE.DoubleSide }),
    wood: cel({ color: 0xa8865f, bands: 3, tint: 0x6a5a80 }),
    woodDark: cel({ color: 0x6e4f3a, bands: 3, tint: 0x4a3a58 }),
    bamboo: cel({ color: 0x9fb06a, bands: 3, tint: 0x5a6a70 }),
    iron: cel({ color: 0x3e3c44, bands: 3, tint: 0x2e2c40 }),
    straw: cel({ color: 0xdcc88e, bands: 3, tint: 0x7a6478 }),
    strawDark: cel({ color: 0xc2aa6e, bands: 3, tint: 0x6a5470 }),
    paper: cel({ color: 0xfbfaf4, bands: 2, tint: 0x9a94b8, side: THREE.DoubleSide }),
    omikuji: cel({ color: 0xf8f6ee, bands: 2, tint: 0x9a94b8 }),
    gravel: cel({ color: 0xd6cfc3, bands: 3, tint: 0x6f6790 }),
    path: cel({ color: 0xbab4ae, bands: 3, tint: 0x5e5a80 }),
    path2: cel({ color: 0xc8c2b8, bands: 3, tint: 0x5e5a80 }),
    moss: cel({ color: 0x86986e, bands: 3, tint: 0x4f6a70 }),
    water: flat({ color: 0x86b4d0 }),
    lamp: cel({ color: 0x4a4048, bands: 2, tint: 0x3a3048, emissive: 0xffb45a, emissiveIntensity: 0, cache: false }),
    gaku: flat({ color: 0xffffff, map: gakuTex(), cache: false }),
    stoneName: cel({ color: 0xffffff, map: stoneNameTex(), bands: 3, tint: 0x5e5a80, cache: false }),
    ema: cel({ color: 0xffffff, map: emaAtlas(), bands: 3, tint: 0x7a6a80, side: THREE.DoubleSide, alphaTest: 0.5, cache: false }),
  };
  return M;
}

/** Bake in the parts that cast shadows and those that don't. */
const CAST = ['red', 'black', 'white', 'stone', 'stoneDark', 'foxStone', 'bibCloth', 'gold', 'roof', 'roofDark', 'under', 'hafu', 'wood', 'woodDark', 'bamboo', 'straw', 'strawDark', 'stoneName', 'lamp', 'bib'];

export function buildShrine(ctx, net, kit, s, F) {
  const m = mats();
  const W = F.w, D = F.d;
  const G = new THREE.Group();
  G.name = 'shrine';
  const o0 = F.at(0, 0);
  G.position.set(o0.x, 0, o0.z);
  G.rotation.y = Math.atan2(-F.f.x, -F.f.z);
  ctx.add(G);
  const town = (x, z) => F.at(x, z);
  const col = (x0, z0, x1, z1, top) => {
    const a = town(x0, z0), b = town(x1, z1);
    ctx.collide(Math.min(a.x, b.x), Math.min(a.z, b.z), Math.max(a.x, b.x), Math.max(a.z, b.z), top);
  };
  const reg = (x, z, kind = 'prop') => { const p = town(x, z); ctx.registry?.push({ kind, x: p.x, z: p.z }); };
  const parts = makeParts(m);
  const P = parts;
  const r = rngKit(7707);

  /* ---- the layout (z back from the lane) ---- */
  const L = {
    torii: 1.25, foxes: 3.0, tunnel: [4.3, 9.8], nTunnel: 12,
    hallF: 12.6, hallB: 15.0, honden: [16.55, 17.7], box: 11.9,
  };

  /* ---- ground: gravel, the stone path (参道), moss at the edges ---- */
  P.add('gravel', ext(-W / 2, W / 2, 0, 0.04, 0, D));
  for (let z = 0.05; z < L.hallF - 0.5; z += 0.62) {
    // two slabs a row, their joint staggered
    const j = (Math.round(z / 0.62) % 2 ? 0.18 : -0.18) + (r.next() - 0.5) * 0.08;
    P.add(r.chance(0.5) ? 'path' : 'path2', ext(-0.72, j - 0.015, 0.04, 0.07, z, z + 0.6));
    P.add(r.chance(0.5) ? 'path' : 'path2', ext(j + 0.015, 0.72, 0.04, 0.07, z, z + 0.6));
  }
  for (const sx of [-1, 1]) P.add('stoneDark', ext(sx * 0.72 - (sx < 0 ? 0.1 : 0), sx * 0.72 + (sx > 0 ? 0.1 : 0), 0.04, 0.09, 0.05, L.hallF - 0.55));
  // moss along the fences and round the stones
  for (const sx of [-1, 1]) P.add('moss', ext(sx * (W / 2 - 0.5) - 0.28, sx * (W / 2 - 0.5) + 0.28, 0.04, 0.048, 0.6, D - 0.4));

  // the ground you (and Hachi, 24 cm tall) stand on: the gravel, and the stone path a little above it
  {
    const plat = (x0, z0, x1, z1, top) => { const a = town(x0, z0), b = town(x1, z1); ctx.platform({ x0: Math.min(a.x, b.x), x1: Math.max(a.x, b.x), z0: Math.min(a.z, b.z), z1: Math.max(a.z, b.z), top }); };
    plat(-W / 2, 0, W / 2, D, 0.04);
    plat(-0.82, 0.05, 0.82, L.hallF - 0.55, 0.075);
    // (the path's kerb stones stand 2 cm over it: Hachi sits by the fox on one: ctx.js surfaceAt)
    for (const sx of [-1, 1]) { const a = town(sx * 0.77 - 0.05, 0.05), b = town(sx * 0.77 + 0.05, L.hallF - 0.55); ctx.surface?.({ x0: Math.min(a.x, b.x), x1: Math.max(a.x, b.x), z0: Math.min(a.z, b.z), z1: Math.max(a.z, b.z), top: 0.09 }); }
  }

  /* ---- the front: stone fence either side of the gate, the name pillar ---- */
  fenceStone(P, -W / 2 + 0.2, -2.75, 0.3);
  fenceStone(P, 2.75, W / 2 - 0.2, 0.3);
  col(-W / 2, 0.1, -2.7, 0.5, 1.0);
  col(2.7, 0.1, W / 2, 0.5, 1.0);
  namePillar(P, { x: -2.35, z: 0.75 });
  col(-2.7, 0.45, -2.0, 1.05, 2.3);

  /* ---- the main torii ---- */
  mainTorii(P, L.torii, { gakuMat: true });
  for (const sx of [-1, 1]) col(sx * 1.55 - 0.3, L.torii - 0.3, sx * 1.55 + 0.3, L.torii + 0.3, 4.5);
  reg(0, L.torii);

  /* ---- the foxes, lanterns, water pavilion, notice board ---- */
  for (const sx of [-1, 1]) {
    fox(P, { x: sx * 1.8, z: L.foxes, ry: Math.PI + sx * 0.42 }, sx > 0 ? 'key' : 'jewel');
    col(sx * 1.8 - 0.42, L.foxes - 0.42, sx * 1.8 + 0.42, L.foxes + 0.42, 1.9);
    reg(sx * 1.8, L.foxes);
    for (const [x, z, sc] of [[sx * 2.75, 1.95, 1.08], [sx * 2.2, 11.0, 1.0]]) {
      stoneLantern(P, { x, z }, sc);
      col(x - 0.35, z - 0.35, x + 0.35, z + 0.35, 1.9);
      const w = town(x, z);
      ctx.night?.pool(w.x, w.z, 2.7, { strength: 1.15 });
      reg(x, z);
    }
  }
  const tzPlace = { x: 4.75, z: 3.1, ry: Math.PI / 2 };
  const spout = temizuya(P, tzPlace, roof);
  col(3.8, 2.1, 5.7, 4.1, 2.8);
  reg(4.75, 3.1);
  // the notice of how to pray, by the gate
  {
    const nx = -4.7, nz = 2.4;
    const A = { add: (n, g) => P.add(n, xf(g, { x: nx, z: nz, ry: Math.PI + 0.25 })) };
    for (const sx of [-0.4, 0.4]) A.add('wood', boxG(0.08, 1.6, 0.08, { x: sx, y: 0.8 }));
    A.add('wood', boxG(0.9, 1.0, 0.05, { y: 1.22 }));
    A.add('roofDark', xf(boxG(1.05, 0.05, 0.34, {}), { y: 1.8, rx: 0.25 }));
    const n = new THREE.Mesh(new THREE.PlaneGeometry(0.74, 0.86), flat({ color: 0xffffff, map: sanpaiNotice(), cache: false }));
    const p = town(nx, nz);
    n.position.set(p.x, 1.22, p.z);
    n.rotation.y = F.ry + 0.25;   // it faces the lane, turned a little to the path
    n.translateZ(0.03);
    n.userData.noOutline = true;
    ctx.add(n);
    col(nx - 0.5, nz - 0.25, nx + 0.5, nz + 0.25, 1.8);
    reg(nx, nz);
  }

  /* ---- 千本鳥居: the tunnel ---- */
  const tun = toriiTunnel(m, L.tunnel[0], L.tunnel[1], L.nTunnel);
  for (const mesh of tun.meshes) G.add(mesh);
  for (const sx of [-1, 1]) col(sx * tun.halfSpan - 0.14, L.tunnel[0] - 0.14, sx * tun.halfSpan + 0.14, L.tunnel[1] + 0.14, 2.6);
  reg(0, (L.tunnel[0] + L.tunnel[1]) / 2);
  // nobori either side of the tunnel, outside it
  const cloth = flat({ color: 0xffffff, map: noboriTex(SHRINE.nobori), side: THREE.DoubleSide, cache: false });
  for (let z = L.tunnel[0] + 0.4; z < L.tunnel[1]; z += 1.75) {
    for (const sx of [-1, 1]) {
      const x = sx * 2.35;
      P.add('iron', cylG(0.022, 0.022, 3.3, 5, { x, y: 1.65, z }));
      P.add('iron', cylG(0.012, 0.012, 0.46, 4, { x, y: 3.15, z: z - 0.23, rx: Math.PI / 2 }));
      const c = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 1.8), cloth);
      const p = town(x, z - 0.23);
      c.position.set(p.x, 2.2, p.z);
      c.rotation.y = F.ry + Math.PI / 2;
      c.castShadow = true;
      c.userData.noOutline = true;
      ctx.add(c);
      col(x - 0.1, z - 0.1, x + 0.1, z + 0.1, 3.3);
    }
  }

  /* ---- the forecourt: ema, omikuji ---- */
  emaRack(P, { x: -3.9, z: 10.4, ry: Math.PI / 2 }, roof);
  col(-4.25, 9.4, -3.55, 11.4, 2.0);
  reg(-3.9, 10.4);
  omikujiRack(P, { x: 3.95, z: 10.5, ry: -Math.PI / 2 });
  col(3.75, 9.7, 4.15, 11.3, 1.6);
  reg(3.95, 10.5);

  /* ---- the halls ---- */
  const hall = haiden(P, { zF: L.hallF, zB: L.hallB });
  col(-2.8, L.hallF - 0.6 - 0.72, 2.8, L.hallB + 0.5, 4.5);
  for (const sx of [-1, 1]) col(sx * 1.5 - 0.15, hall.zK - 0.15, sx * 1.5 + 0.15, hall.zK + 0.15, 2.7);
  ctx.registry?.push({ kind: 'building', ...town(0, (L.hallF + L.hallB) / 2), rect: rectOf(town, -2.8, L.hallF - 0.6, 2.8, L.hallB + 0.5) });
  saisenBox(P, { x: 0, z: L.box });
  col(-0.6, L.box - 0.32, 0.6, L.box + 0.32, 0.7);
  const hon = honden(P, { z0: L.honden[0], z1: L.honden[1] });
  col(-hon.fx - 0.1, hon.fz0, hon.fx + 0.1, hon.fz1 + 0.1, 3.2);
  ctx.registry?.push({ kind: 'building', ...town(0, (L.honden[0] + L.honden[1]) / 2), rect: rectOf(town, -1.5, L.honden[0] - 0.6, 1.5, L.honden[1] + 0.6) });

  /* ---- the hanging lanterns (提灯) at the hall, lit at night ---- */
  const chochin = cel({ color: 0xffffff, map: chochinTex(), emissiveMap: chochinTex(), emissive: 0xffd09a, emissiveIntensity: 0, bands: 3, tint: 0x9a7a88, cache: false });
  ctx.night?.glowing(chochin, 0xffcf96, 0.95);
  ctx.night?.glowing(m.lamp, 0xffb45a, 1.6);
  m.chochin = chochin;
  for (const sx of [-1, 1]) {
    const x = sx * 0.95, z = hall.zK;
    const body = latheG([[0.001, 0], [0.12, 0.03], [0.17, 0.14], [0.18, 0.26], [0.16, 0.38], [0.11, 0.46], [0.001, 0.48]], 14);
    P.add('chochin', xf(body, { x, y: 1.83, z }));
    P.add('black', cylG(0.09, 0.09, 0.05, 10, { x, y: 1.82, z }));
    P.add('black', cylG(0.09, 0.09, 0.05, 10, { x, y: 2.32, z }));
    P.add('iron', cylG(0.008, 0.008, 0.18, 4, { x, y: 2.43, z }));
    const w = town(x, z);
    ctx.night?.pool(w.x, w.z - 0.3, 2.6, { strength: 0.9 });
  }

  /* ---- trees: the hero sakura over the honden, the old camphor (神木)
   * with its rope, sakaki either side of the sanctuary ---- */
  const t = town(W / 2 - 2.0, D - 2.3);
  ctx.sakura.push({ x: t.x, z: t.z, y: 0, scale: 1.55, seed: 7701 });
  col(W / 2 - 2.4, D - 2.7, W / 2 - 1.6, D - 1.9, 3);
  const kx = -W / 2 + 2.3, kz = D - 2.4, k = town(kx, kz);
  plant(ctx, 'camphor', { x: k.x, z: k.z, y: 0, scale: 1.45, seed: 7702 });
  col(kx - 0.5, kz - 0.5, kx + 0.5, kz + 0.5, 3);
  treeRope(P, kx, kz, 0.3 * 1.45 * 1.25 + 0.06, 1.7);
  for (const sx of [-1, 1]) {
    const q = town(sx * 2.5, L.honden[0] + 0.4);
    plant(ctx, 'shrub', { x: q.x, z: q.z, y: 0, scale: 0.8, seed: 7710 + sx });
  }

  /* ---- fence round the sides and back (the front is the stone fence) ---- */
  const runs = [
    [town(-W / 2 + 0.2, 0.5), town(-W / 2 + 0.2, D - 0.2)],
    [town(W / 2 - 0.2, 0.5), town(W / 2 - 0.2, D - 0.2)],
    [town(-W / 2 + 0.2, D - 0.2), town(W / 2 - 0.2, D - 0.2)],
  ];
  for (const [a, b] of runs) {
    const axis = Math.abs(a.x - b.x) > Math.abs(a.z - b.z) ? 'x' : 'z';
    const len = Math.hypot(a.x - b.x, a.z - b.z);
    ctx.add(makeTimberFence({ x: (a.x + b.x) / 2, z: (a.z + b.z) / 2, y: 0, len, axis, h: 1.2 }));
    ctx.collide(Math.min(a.x, b.x) - 0.15, Math.min(a.z, b.z) - 0.15, Math.max(a.x, b.x) + 0.15, Math.max(a.z, b.z) + 0.15, 1.2);
  }

  /* ---- bake the static parts ---- */
  parts.mats.chochin = chochin;
  const built = parts.build(G, { cast: [...CAST, 'chochin'], noShadow: ['water'] });
  for (const mesh of Object.values(built)) mesh.name = 'shrine-' + mesh.name.replace(/^land-/, '');

  /* ---- petals on the gravel: one InstancedMesh ---- */
  {
    const n = 170;
    const g = new THREE.CircleGeometry(0.035, 5);
    g.rotateX(-Math.PI / 2);
    g.scale(1, 1, 0.7);
    const im = new THREE.InstancedMesh(g, cel({ color: 0xf6c6d4, bands: 2, tint: 0xa07090 }), n);
    const mm = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3(1, 1, 1);
    const up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < n; i++) {
      // drifted under the sakura and along the path
      const near = i < n * 0.55;
      const x = near ? W / 2 - 2.0 + (r.next() - 0.5) * 7 : (r.next() - 0.5) * 3.2;
      const z = near ? D - 2.3 + (r.next() - 0.5) * 7 : r.next() * (L.hallF - 0.5);
      q.setFromAxisAngle(up, r.next() * 6.28);
      p.set(Math.max(-W / 2 + 0.3, Math.min(W / 2 - 0.3, x)), 0.075 + r.next() * 0.004, Math.max(0.3, Math.min(D - 0.3, z)));
      sc.setScalar(0.7 + r.next() * 0.6);
      im.setMatrixAt(i, mm.compose(p, q, sc));
    }
    im.receiveShadow = true;
    im.userData.noOutline = true;
    im.userData.keep = true;
    im.computeBoundingSphere?.();
    im.name = 'shrine-petals';
    G.add(im);
  }

  /* ---- the bell and its rope (still), and the moving parts: the trickle, the chimes ---- */
  bellRope(G, hall.bellAt, m);
  const trickle = trickleMesh(G, tzPlace, spout);
  const chimes = [-1, 1].map((sx) => windChime(G, { x: sx * 2.75, y: hall.eave.y - 0.02, z: hall.eave.z + 0.1 }, m));

  // the red-paved lane in front (カラー舗装): slow, people cross here
  {
    const laneZ = s.z0 - ROADS.lane.asphalt / 2 - 0.4;
    const wdt = ROADS.lane.asphalt - 2 * ROADS.lane.gutter;
    for (let x = Math.max(s.x0 - 5, 2.8); x + 3 < Math.min(s.x1 + 5, 27.4); x += 3) {
      kit.decals.add('red', x + 1.5, laneZ, wdt, 3.002, { x: 1, z: 0 }, ROADS.asphaltY, LAYER.wear);
    }
  }

  /* ---- the wind chimes, heard in the grounds (the shrine's sound experience) ---- */
  const mid = ctx.toWorld(town(0, D * 0.5));
  soundBus.zone('shrine-chimes', { x: mid.x, z: mid.z, y: 2.5, near: 6, far: /*@mini 18 @*/26/*@@*/, level: 0.5 });      // (the pocket town: the bench is 25 m off)
  ctx.experiences?.add({ kind: 'sound', id: 'shrine', name: 'Wind chimes', jp: '風鈴', ...town(0, D * 0.5) });

  // animate only near: the trickle, the chimes in the breeze
  let time = 0;
  ctx.update((dt, cam) => {
    const near = !cam || Math.hypot(cam.x - mid.x, cam.z - mid.z) < 45;
    if (!near) return;
    time += dt;
    trickle.material.map.offset.y = (time * 1.6) % 1;
    for (let i = 0; i < chimes.length; i++) chimes[i].update(time + i * 1.7);
  });
  return { layout: L, town };
}

/** The town-frame rect of a local rect. */
function rectOf(town, x0, z0, x1, z1) {
  const a = town(x0, z0), b = town(x1, z1);
  return [Math.min(a.x, b.x), Math.min(a.z, b.z), Math.max(a.x, b.x), Math.max(a.z, b.z)];
}

/* The bell (鈴) and its rope (鈴緒), hanging from the front beam. */
function bellRope(G, at, m) {
  const pivot = new THREE.Group();
  pivot.position.set(at.x, at.y, at.z);
  pivot.name = 'shrine-bell';
  const add = (mesh) => { mesh.castShadow = true; pivot.add(mesh); return mesh; };
  add(new THREE.Mesh(cylG(0.012, 0.012, 0.12, 5, { y: -0.06 }), m.iron));
  // three bells in a cluster, the big one in front
  add(new THREE.Mesh(xf(new THREE.SphereGeometry(0.12, 12, 9), { y: -0.24, z: -0.02 }), m.gold));
  for (const sx of [-1, 1]) add(new THREE.Mesh(xf(new THREE.SphereGeometry(0.075, 10, 7), { x: sx * 0.12, y: -0.2, z: 0.04 }), m.gold));
  add(new THREE.Mesh(boxG(0.13, 0.012, 0.03, { y: -0.3, z: -0.125 }), m.black));    // the slit
  // the rope: red and white twisted (紅白), with its tassel
  const len = 1.55, y0 = -0.36;
  const strand = (phase, mat) => {
    const pts = [];
    for (let i = 0; i <= 30; i++) {
      const y = y0 - (len * i) / 30, a = i * 0.9 + phase;
      pts.push(new THREE.Vector3(Math.cos(a) * 0.022, y, Math.sin(a) * 0.022));
    }
    add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.026, 6), mat));
  };
  strand(0, m.bib);
  strand(Math.PI, m.white);
  add(new THREE.Mesh(cylG(0.035, 0.07, 0.18, 8, { y: y0 - len - 0.08 }), m.bib));
  pivot.traverse((n) => { if (n.isMesh) n.userData.noOutline = true; });
  G.add(pivot);
}

/* The trickle from the bamboo spout into the basin: a thin streak whose
 * texture scrolls. */
function trickleMesh(G, place, spout) {
  const tex = trickleTex().clone();
  tex.needsUpdate = true;
  tex.repeat.set(1, 1.5);
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.85, depthWrite: false });
  mat.userData.live = true;
  const h = spout.y - spout.bottom;
  const g = new THREE.CylinderGeometry(0.009, 0.013, h, 6, 1, true);
  const mesh = new THREE.Mesh(g, mat);
  const p = new THREE.Vector3(spout.x, spout.bottom + h / 2, spout.z).applyAxisAngle(new THREE.Vector3(0, 1, 0), place.ry);
  mesh.position.set(place.x + p.x, p.y, place.z + p.z);
  mesh.userData.dynamic = true;
  mesh.userData.noOutline = true;
  mesh.name = 'shrine-trickle';
  G.add(mesh);
  // and the ripple where it lands
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.02, 0.05, 12), new THREE.MeshBasicMaterial({ color: 0xe8f6ff, transparent: true, opacity: 0.7, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(mesh.position.x, spout.bottom + 0.01, mesh.position.z);
  ring.userData.dynamic = true;
  ring.userData.noOutline = true;
  G.add(ring);
  return mesh;
}

/* A glass wind chime (風鈴) under the eave: the bell, its clapper and the
 * paper strip that catches the breeze. */
function windChime(G, at, m) {
  const g = new THREE.Group();
  g.position.set(at.x, at.y, at.z);
  g.userData.dynamic = true;
  const glass = cel({ color: 0xcfe6f2, bands: 2, tint: 0x6f86a8, side: THREE.DoubleSide });
  g.add(new THREE.Mesh(cylG(0.004, 0.004, 0.1, 4, { y: -0.05 }), m.iron));
  const bellG = new THREE.SphereGeometry(0.055, 12, 6, 0, Math.PI * 2, 0, Math.PI * 0.55);
  g.add(new THREE.Mesh(xf(bellG, { y: -0.1 }), glass));
  const swing = new THREE.Group();
  swing.position.y = -0.1;
  swing.add(new THREE.Mesh(cylG(0.002, 0.002, 0.14, 3, { y: -0.07 }), m.iron));
  const strip = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.17), m.paper);
  strip.position.y = -0.22;
  swing.add(strip);
  g.add(swing);
  g.traverse((n) => { if (n.isMesh) n.userData.noOutline = true; });
  G.add(g);
  return {
    update(t) {
      swing.rotation.x = Math.sin(t * 1.3) * 0.22 + Math.sin(t * 3.1) * 0.06;
      swing.rotation.z = Math.sin(t * 0.9 + 1) * 0.12;
      strip.rotation.y = Math.sin(t * 1.1) * 0.6;
    },
  };
}
