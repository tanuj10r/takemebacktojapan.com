import * as THREE from 'three';
import { cel } from '../../core/toon.js';
import { TOWN } from '../../config.js';
import { makeParts, makeScatter, sheetGeo } from './geo.js';
import { asphaltTex } from '../kit/tex.js';
import { ploughTex, rengeTex, bankGrassTex, masonryTex, slabTex, TILE, shojiTex } from './tex.js';
import { makeWater } from './water.js';
import { planPaddies, buildPaddies, buildTrack, buildPumpShed, buildNotice, buildScarecrow, landMats } from './paddies.js';
import { buildChannel, channelMats } from './channel.js';
import { buildPond, pondMats } from './pond.js';
import { buildGate } from './gate.js';
import { buildParking } from './parking.js';
import { buildHills } from './hills.js';
import { buildSlowLife } from './slowlife.js';
import { buildHan } from '../han/index.js';

/* ------------------------------------------------------------------ *
 * The land north of the main road (town quality pass; Tan's layout in
 * wave 2c), laid out by config.js TOWN.land in the town's own (turned)
 * frame: north is -z.  From the spawn you turn round to the river:
 *
 *   channel.js  the river 桜川 in its sunken channel: revetments, lower
 *               walks with sakura, stairs down and up, stepping stones,
 *               the road-level bridge 富士見橋, the river walks on top
 *   paddies.js  the paddies beyond (curving paths, early April), the
 *               farm track, the pump shed, the kei truck, the scarecrow
 *   pond.js     鏡池, the pond: promenade, lanterns, pines, a willow,
 *               lotus, the tea house and low houses, benches
 *   gate.js     the Deer Park gate (鹿公園, coming soon)
 *   hills.js    the painted far hills
 *   water.js    sky-mirror paddies, the river's moving lines, the pond
 *
 * Cost: every surface of a kind is one mesh (static batching then folds
 * the plain-coloured ones into the town's style batches); every small
 * thing (seedlings, flowers, reeds, stones, pads) one InstancedMesh per
 * kind; a few small tiling textures and plates.
 * ------------------------------------------------------------------ */

export function buildLand(ctx) {
  const group = new THREE.Group();
  group.name = 'land';
  group.userData.ownsSinks = true;   // the land sinks the ground and floors it itself (sinkcut.js leaves its floors alone)
  ctx.add(group);
  const add = (o) => { group.add(o); return o; };
  ctx.green ??= {};              // the pond's pines join the town's batch (kit/green.js)
  const lctx = { ...ctx, add };
  const L = TOWN.land;

  const tex = {
    plough: ploughTex(), renge: rengeTex(), track: asphaltTex(), grass: bankGrassTex(),   // the bridge road is asphalt now
    masonry: masonryTex(), slab: slabTex(), shoji: shojiTex(),
  };
  const mats = {
    ...landMats(tex),
    ...channelMats(tex),
    ...pondMats(tex),
    shedWall: cel({ color: 0xdcd6c6, bands: 3, tint: 0x6f6790 }),
    shedRoof: cel({ color: 0x7f97a6, bands: 3, tint: 0x4f5a88 }),
    shedDoor: cel({ color: 0x6f8f7a, bands: 3, tint: 0x4a5a70 }),
    cloth: cel({ color: 0x4f6aa0, bands: 3, tint: 0x3a3a70 }),
    straw: cel({ color: 0xd8bf82, bands: 3, tint: 0x7a6478 }),
    stone: cel({ color: 0xb4b0a6, bands: 3, tint: 0x5e5a78 }),
    gateWood: cel({ color: 0xa8825f, bands: 3, tint: 0x7a6478 }),
    door: cel({ color: 0xc9a47a, bands: 3, tint: 0x86707e }),
    roof: cel({ color: 0x5c5a66, bands: 3, tint: 0x3a3858 }),
    roofDark: cel({ color: 0x46444f, bands: 3, tint: 0x302e4a }),
    iron: cel({ color: 0x3e3c44, bands: 3, tint: 0x2e2c40 }),
    rope: cel({ color: 0xd9c38e, bands: 3, tint: 0x7a6478 }),
    paper: cel({ color: 0xfff4dc, bands: 'soft', tint: 0xd8c0b0 }),
  };
  const parts = makeParts(mats);
  const scatter = makeScatter();
  const water = makeWater(lctx);

  /*@mini @*/buildChannel(lctx, parts, scatter, water);/*@@*/      // (the pocket town has no river)
  buildTrack(lctx, parts);                 // the bridge road, from the master junction to the gate
  // the paddies Tan kept, between the main road's shops and the pond
  const plan = planPaddies();
  buildPaddies(lctx, parts, scatter, water, plan);
  buildPumpShed(lctx, parts, plan.apron);
  /*@mini {
    // the pocket town: a second, wider field behind the store, the shrine and the plaza, to the line (Tan: "a rice
    // paddy or two"; what the desktop's back lanes held), its own plan in its own box
    const keep = TOWN.land.paddies.box;
    TOWN.land.paddies.box = [-26, 45, 58, 83.5];
    buildPaddies(lctx, parts, scatter, water, planPaddies());
    TOWN.land.paddies.box = keep;
  } @*//*@@*/
  buildNotice(lctx, parts, TOWN.land.paddies.box[0] - 0.9, /*@mini 24 @*/77.4/*@@*/);   // by the lane z 80's end, facing it
  {
    const p = plan.plots.find((q) => q.kind === 'renge') ?? plan.plots[0];
    const x = (p.sw + p.se) / 2;
    buildScarecrow(parts, x, (p.S(x) + p.N(x)) / 2);
  }
  buildParking(lctx, parts);               // across the road from the spawn
  /* 鏡池, by the railway.  Its own parts stay out of the town's 128 m
   * static cells (userData.dynamic), so its mirror can show them without
   * drawing whole cells of the town again; the houses and benches round it
   * (addStatic) are batched with the town as usual. */
  const pondGroup = new THREE.Group();
  pondGroup.name = 'land-pond';
  pondGroup.userData.dynamic = true;
  group.add(pondGroup);
  const pctx = { ...lctx, add: (o) => { pondGroup.add(o); return o; }, addStatic: add };
  const pondParts = makeParts(mats);
  /*@mini @*/buildPond(pctx, pondParts, scatter, water);/*@@*/      // (nor 鏡池)
  buildGate(lctx, parts);
  buildSlowLife(lctx, scatter);            // ひと休み: the bench where the paddies meet the pond (Tan's experiences)

  // past the far walk: a strip of grass to the tree line, the town's edge
  {
    const [fx0, fz0, fx1, fz1] = L.far, t = L.track;
    for (const [a, b] of [[fx0, t.x - t.w / 2 - 0.8], [t.x + t.w / 2 + 0.8, fx1]]) parts.add('grass', sheetGeo(a, b, fz0 - 4, fz1, 0.02, TILE.grass));
  }

  parts.build(group, {
    cast: ['bridge', 'bridgeDark', 'rail', 'white', 'post', 'wood', 'gateWood', 'door', 'roof', 'roofDark', 'shedWall', 'shedRoof',
      'cloth', 'straw', 'stone', 'steel', 'steelBlue', 'granite', 'graniteDark', 'railWood', 'plaster', 'timber', 'tile', 'willowWood', 'willowDeep', 'redFelt'],
  });
  pondParts.build(pondGroup, {
    cast: ['granite', 'graniteDark', 'plaster', 'timber', 'tile', 'willowWood', 'willowDeep', 'redFelt', 'post', 'wood',
      'kawara', 'kawaraDark', 'yakisugi', 'plasterOld', 'lattice', 'cedar', 'railWood', 'shoji'],
  });
  scatter.build(group);
  /* The sprawling surfaces (paddy sheets, walks, the track: each one mesh
   * across the whole land) are ground, whose height ctx.groundAt already
   * knows from the sinks and platforms: fallen petals don't raycast them
   * (petals.js), which cost seconds of load. */
  const size = new THREE.Vector3();
  group.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh) return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    o.geometry.boundingBox.getSize(size);
    if (Math.max(size.x, size.z) > 60) o.userData.ground = true;
  });
  buildHills(lctx);
  buildHan(lctx);                          // Han and the RX-7, in the car park (world/han/)
}
