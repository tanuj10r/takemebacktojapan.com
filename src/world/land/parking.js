import * as THREE from 'three';
import { cel, flat } from '../../core/toon.js';
import { rngKit } from '../../core/util.js';
import { TOWN, ROADS, DRIVEWAYS } from '../../config.js';
import { LAND_SIGNS } from '../../data/town.js';
import { asphaltTex, ASPHALT_TILE } from '../kit/tex.js';
import { makeDecals, LAYER } from '../kit/decals.js';
import { parkVehicle, vehicleWheels } from '../vehicles.js';
import { sheetGeo } from './geo.js';
import { HAN_BAY } from '../han/index.js';
import { noticeTex } from './tex.js';

/* ------------------------------------------------------------------ *
 * Across the road from the spawn (Tan's layout): the old photographers'
 * lot is a monthly car park (月極駐車場), and straight past it the river.
 *
 * Laid out for cars (town quality pass, Tan: "how do cars even enter it
 * from the main road?"), in the town's frame (the main road is +z):
 *
 *   in       from the main road at the west end, over the far walk's
 *            dropped kerb (config.js DRIVEWAYS.far; lawson.js lowers it),
 *            arrows turning into the aisle
 *   aisle    one-way, west to east, 4.9 m between the rows, arrows down it
 *   out      at the east end onto the bridge road (lane x 30), a stop
 *            line and 止まれ, a short run back to the master junction
 *   bays     2.5 x 4.85 m in two rows, wheel stops at the back: cars
 *            back in, as they do in Japan, fronts to the aisle
 *   walkway  kept clear down the spawn's axis to the stairs, zebra-striped
 *            where it crosses the aisle
 *
 * The road row's east bay, nearest the main road and the bridge road, is
 * kept empty: Han's RX-7 stands there (src/world/han/, tonight's build).
 * ------------------------------------------------------------------ */

const AY = 0.03;                                 // the lot's surface

/** The car park's bays (town frame): { x, z, row: 'river'|'road', han }. */
export function parkingBays() {
  const [x0, z0, x1, z1] = TOWN.land.parking;
  const inn = DRIVEWAYS.far.map(([a, b]) => [-b, -a])[0];   // the way in, town x
  const aisle = [-2.45, 2.45];
  const rows = [
    { row: 'river', za: z0 + 0.2, zb: aisle[0], segs: [[x0 + 0.6, -1.9], [1.9, x1 - 0.6]] },
    { row: 'road', za: aisle[1], zb: z1 - 0.15, segs: [[inn[1] + 0.8, -1.9], [1.9, x1 - 0.6]] },
  ];
  const bays = [];
  for (const R of rows) {
    for (const [a, b] of R.segs) {
      const n = Math.floor((b - a) / 2.5);
      const start = a + (b - a - n * 2.5) / 2;
      for (let k = 0; k < n; k++) bays.push({ x: start + 2.5 * k + 1.25, z: (R.za + R.zb) / 2, za: R.za, zb: R.zb, row: R.row });
    }
  }
  const road = bays.filter((b) => b.row === 'road');
  road[road.length - 1].han = true;             // east end, by the main road and the bridge road
  return { bays, aisle, inn };
}

export function buildParking(ctx, parts) {
  const [x0, z0, x1, z1] = TOWN.land.parking;
  const r = rngKit(4242);
  const asphalt = cel({ color: 0x8a8ea0, bands: 3, tint: 0x5a5480, map: asphaltTex() });
  const g = sheetGeo(x0, x1, z0, z1, AY, ASPHALT_TILE);
  const lot = new THREE.Mesh(g, asphalt);
  lot.receiveShadow = true;
  ctx.add(lot);
  ctx.surface?.({ x0, z0, x1, z1, top: AY });      // (2 cm over the ground: Hachi's paws rest on it, ctx.js surfaceAt)
  // the way out, paved over the verge to the bridge road's asphalt
  const laneEdge = TOWN.land.track.x - ROADS.lane.asphalt / 2;
  const mouth = new THREE.Mesh(sheetGeo(x1 - 0.1, laneEdge + 0.05, -2.6, 2.6, AY - 0.004, ASPHALT_TILE), asphalt);
  mouth.receiveShadow = true;
  ctx.add(mouth);
  const paint = makeDecals();
  const { bays, aisle, inn } = parkingBays();

  /* ---- the bays: a line each side, a wheel stop at the back ---- */
  const lines = new Set();
  for (const b of bays) {
    for (const x of [b.x - 1.25, b.x + 1.25]) {
      const k = `${b.row}${x.toFixed(2)}`;
      if (lines.has(k)) continue;
      lines.add(k);
      parts.box('white', x - 0.06, x + 0.06, AY, AY + 0.015, b.za, b.zb);
    }
    b.stopZ = b.row === 'river' ? b.za + 0.65 : b.zb - 0.65;
    parts.box('granite', b.x - 0.8, b.x + 0.8, AY, AY + 0.12, b.stopZ - 0.08, b.stopZ + 0.08);
    ctx.collide(b.x - 0.8, b.stopZ - 0.08, b.x + 0.8, b.stopZ + 0.08, AY + 0.12);
  }

  /* ---- the walkway down the spawn's axis, and its zebra over the aisle ---- */
  for (const x of [-1.6, 1.6]) parts.box('white', x - 0.06, x + 0.06, AY, AY + 0.015, z0, z1);
  for (let x = -1.2; x <= 1.21; x += 0.8) paint.add('white', x, 0, 0.42, aisle[1] - aisle[0] - 0.3, { x: 0, z: 1 }, AY, LAYER.paint);

  /* ---- the way in, the one-way aisle, the way out ---- */
  const E = { x: 1, z: 0 }, S = { x: 0, z: -1 };
  const inX = (inn[0] + inn[1]) / 2;
  paint.add('arrow', inX, z1 - 2.2, 1.0, 2.4, S, AY, LAYER.symbol);            // in off the road
  for (const x of [inX + 4.6, -12, 9, 21]) paint.add('arrow', x, 0, 0.9, 2.4, E, AY, LAYER.symbol);   // down the aisle
  // out: a stop line across the aisle's mouth, 止まれ before it
  paint.add('white', x1 - 0.5, 0, aisle[1] - aisle[0], 0.3, E, AY, LAYER.paint);
  paint.add('tomare', x1 - 2.6, 0, 2.2, 1.8, E, AY, LAYER.symbol);
  const decals = paint.build('parking-paint');
  ctx.add(decals);

  /* ---- a few cars, backed in, in the colours of a country town ---- */
  const kinds = ['kei', 'kei', 'keivan', 'kei', 'wagon', 'sedan', 'kei', 'minivan', 'kei'];
  const cols = [0xf2eee6, 0xd9665a, 0x9fc0dc, 0xa8d4b4, 0x3a3e48, 0xe8e2d4, 0xc8b89a, 0xf2eee6, 0x7f93a4];
  const free = bays.filter((b) => !b.han);
  const taken = new Set();
  for (let i = 0; i < kinds.length; i++) {
    let b;
    for (let k = 0; k < 20; k++) { b = free[r.int(0, free.length - 1)]; if (!taken.has(b)) break; }
    if (taken.has(b)) continue;
    taken.add(b);
    if (b.row !== 'river' && Math.abs(b.x - HAN_BAY.x) < HAN_BAY.keep) continue;   // Han's bay and its neighbours (world/han/)
    const w = vehicleWheels(kinds[i]);
    // rear tyre against the stop's aisle-side face; nose to the aisle
    const river = b.row === 'river';
    const rearAxle = river ? b.stopZ + 0.08 + w.R : b.stopZ - 0.08 - w.R;
    const cz = river ? rearAxle - w.rear : rearAxle + w.rear;
    parkVehicle(ctx, { kind: kinds[i], x: b.x + r.range(-0.08, 0.08), z: cz, y: AY, ry: river ? -Math.PI / 2 : Math.PI / 2, skew: r.range(-0.03, 0.03), color: cols[i] });
  }

  /* (the pocket town has no Han: a kei car takes his bay) */
  /*@mini { const b = bays.find((q) => q.han), w = vehicleWheels('kei'); if (b) parkVehicle(ctx, { kind: 'kei', x: b.x, z: b.stopZ - 0.08 - w.R + w.rear, y: AY, ry: Math.PI / 2, skew: 0.02, color: 0xd9665a }); } @*//*@@*/

  /* ---- boards: the lot's name and 入口 at the way in, 出口 at the way out ---- */
  const post = (px, pz, ry, boards) => {
    parts.box('post', px - 0.05, px + 0.05, 0, 2.0, pz - 0.05, pz + 0.05);
    for (const { key, lines: ln, w, h, y, red } of boards) {
      const tw = w / h > 1.5 ? 256 : 128, th = Math.round(tw * h / w);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), flat({ map: noticeTex(key, ln, { w: tw, h: th, red }) }));
      m.position.set(px + Math.sin(ry) * 0.06, y, pz + Math.cos(ry) * 0.06);
      m.rotation.y = ry;
      m.userData.detail = true;
      ctx.add(m);
    }
    ctx.collide(px - 0.12, pz - 0.12, px + 0.12, pz + 0.12, 2.0);
  };
  // by the way in, on the strip between the driveway and the first bay,
  // read from the road
  post(inn[1] + 0.4, z1 - 0.35, 0, [
    { key: 'parking', lines: LAND_SIGNS.parking, w: 1.1, h: 0.55, y: 1.65, red: { line: 1, color: '#2f7a3a' } },
    { key: 'parkingIn', lines: [LAND_SIGNS.parkingIn], w: 0.5, h: 0.25, y: 1.1 },
  ]);
  // by the way out, at the river row's east end, read coming down the aisle
  post(x1 - 0.3, aisle[0] - 0.35, -Math.PI / 2, [{ key: 'parkingOut', lines: [LAND_SIGNS.parkingOut], w: 0.5, h: 0.25, y: 1.1 }]);
}
