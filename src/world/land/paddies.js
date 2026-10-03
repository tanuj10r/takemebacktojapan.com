import * as THREE from 'three';
import { cel, flat } from '../../core/toon.js';
import { rngKit } from '../../core/util.js';
import { TOWN } from '../../config.js';
import { LAND_SIGNS } from '../../data/town.js';
import { parkVehicle } from '../vehicles.js';
import { sheetGeo, boxGeo } from './geo.js';
import { TILE, noticeTex, pondWobbleTex } from './tex.js';
import { makeMirror, REFLECT } from './mirror.js';

/* ------------------------------------------------------------------ *
 * The paddies (田んぼ) in early April, beyond the river (wave 2c: fewer,
 * and following the land).  Each field is a band between two gently
 * curving earth paths (畦道), cut across by paths that lean a little, so
 * no two plots are the same shape.  A plot is one of
 *   flood     flooded, a sky mirror (you cannot walk in it)
 *   seed      flooded, with sparse rows of new seedlings
 *   plough    just ploughed: furrows, clods, puddles
 *   renge     green manure in flower (pink-violet)
 *   fallow    grass (the pump shed's corner)
 * A concrete channel (用水路) runs beside the track with sluice gates; the
 * pump shed, its kei truck and a scarecrow stand among them.  The freed
 * block behind the main road's shops (TOWN.land.east) is paddies too.
 * ------------------------------------------------------------------ */

export const RIDGE = { w: 0.7, top: 0.15, path: 0.36 };
const Y = { flood: 0.05, seed: 0.05, plough: 0.06, renge: 0.065, fallow: 0.03 };

/** A field: rows between curves z = f(x), columns between leaning lines. */
function field(name, [x0, z0, x1, z1], { seed, rows = 3, amp = 4, col = [18, 27], skew = 5 } = {}) {
  const r = rngKit(seed);
  // the curves, south (z1) to north (z0); the outer two straight
  const curves = [];
  for (let k = 0; k <= rows; k++) {
    const base = z1 - ((z1 - z0) * k) / rows;
    const a = k === 0 || k === rows ? 0 : amp * r.range(0.6, 1.1);
    const f = r.range(14, 26), p = r.range(0, 6.3);
    curves.push((x) => base + a * Math.sin(x / f + p));
  }
  const plots = [], lines = [];
  for (let k = 0; k <= rows; k++) lines.push({ kind: 'curve', f: curves[k], x0, x1 });
  // the field's own ends
  for (let k = 0; k < rows; k++) for (const x of [x0, x1]) lines.push({ kind: 'cut', a: [x, curves[k](x)], b: [x, curves[k + 1](x)] });
  for (let k = 0; k < rows; k++) {
    const S = curves[k], N = curves[k + 1];
    // columns: leaning cuts at random widths, none thinner than 12 m
    const cuts = [[x0, x0]];
    let x = x0;
    while (x < x1 - 14) {
      let w = r.range(...col);
      if (x1 - (x + w) < 12) w = x1 - x;
      x += w;
      const lean = x >= x1 ? 0 : r.range(-skew, skew);
      cuts.push(x >= x1 ? [x1, x1] : [x - lean / 2, x + lean / 2]);   // [at the south curve, at the north]
    }
    if (cuts[cuts.length - 1][0] < x1) cuts.push([x1, x1]);
    for (let c = 0; c < cuts.length - 1; c++) {
      plots.push({ zone: name, row: k, col: c, S, N, sw: cuts[c][0], nw: cuts[c][1], se: cuts[c + 1][0], ne: cuts[c + 1][1], kind: null });
      if (c > 0) lines.push({ kind: 'cut', a: [cuts[c][0], S(cuts[c][0])], b: [cuts[c][1], N(cuts[c][1])] });
    }
  }
  return { plots, lines };
}

/** A point of a plot: u across (west to east), v along (south to north),
 * inset by half a path from every edge. */
function plotPoint(p, u, v, inset = 0.5) {
  const xs = p.sw + inset + (p.se - p.sw - 2 * inset) * u;
  const xn = p.nw + inset + (p.ne - p.nw - 2 * inset) * u;
  const zs = p.S(xs) - inset, zn = p.N(xn) + inset;
  return [xs + (xn - xs) * v, zs + (zn - zs) * v];
}
/** The largest easy rectangle inside a plot (its collider). */
function plotRect(p, m = 0.3) {
  const xa = Math.max(p.sw, p.nw) + RIDGE.w / 2 + m, xb = Math.min(p.se, p.ne) - RIDGE.w / 2 - m;
  let za = -Infinity, zb = Infinity;
  for (let i = 0; i <= 8; i++) {
    const x = xa + ((xb - xa) * i) / 8;
    za = Math.max(za, p.N(x) + RIDGE.w / 2 + m);
    zb = Math.min(zb, p.S(x) - RIDGE.w / 2 - m);
  }
  return [xa, za, xb, zb];
}
/** A plot's surface: a grid over its ruled shape, world-mapped UVs. */
function plotGeo(p, y, tile, rot = false, inset = 0.5) {
  const nu = Math.max(2, Math.ceil(Math.max(p.se - p.sw, p.ne - p.nw) / 3)), nv = 3;
  const pos = [], uv = [], nrm = [], idx = [];
  for (let j = 0; j <= nv; j++) {
    for (let i = 0; i <= nu; i++) {
      const [x, z] = plotPoint(p, i / nu, j / nv, inset);
      pos.push(x, y, z); nrm.push(0, 1, 0);
      if (rot) uv.push(z / tile, x / tile); else uv.push(x / tile, z / tile);
    }
  }
  for (let j = 0; j < nv; j++) {
    for (let i = 0; i < nu; i++) {
      const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1;
      idx.push(a, b, d, a, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setIndex(idx);
  // wind so the face looks up
  const e = new THREE.Vector3(), f = new THREE.Vector3();
  e.set(pos[3] - pos[0], 0, pos[5] - pos[2]);
  f.set(pos[(nu + 1) * 3] - pos[0], 0, pos[(nu + 1) * 3 + 2] - pos[2]);
  if (e.cross(f).y < 0) {
    const ix = g.index.array;
    for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; }
  }
  return g;
}

/** A path along a polyline: a grass-shouldered bank with a trodden top. */
function pathAlong(parts, pts) {
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
    const len = Math.hypot(bx - ax, bz - az) + 0.08;
    const a = Math.atan2(bz - az, bx - ax);
    for (const [name, w, y0, y1] of [['ridgeGrass', RIDGE.w, 0, RIDGE.top - 0.03], ['ridgeTop', RIDGE.path, RIDGE.top - 0.05, RIDGE.top]]) {
      const g = new THREE.BoxGeometry(len, y1 - y0, w);
      g.rotateY(-a);
      g.translate((ax + bx) / 2, (y0 + y1) / 2, (az + bz) / 2);
      parts.add(name, g);
    }
  }
}

/** Lay out every plot: the land beyond the river, and the east block. */
export function planPaddies() {
  /* Tan's layout: one block of paddies between the main road's shops and
   * 鏡池, reached from the ends of lanes z 45 and 80 (x 52).  A feeder
   * channel (用水路) runs down its lane side with a sluice to every flooded
   * plot; the pump shed stands in the corner by the coin parking. */
  const [bx0, bz0, bx1, bz1] = TOWN.land.paddies.box;
  const ch = { x0: bx0 + 0.3, x1: bx0 + 1.0 };                  // the channel, along the west (lane) edge
  const block = field('east', [ch.x1 + RIDGE.w / 2 + 0.3, bz0 + 0.6, bx1 - 0.6, bz1 - 0.6], { seed: 4421, rows: /*@mini 3 @*/5/*@@*/, amp: /*@mini 1.4 @*/1.8/*@@*/, col: [12, 17], skew: 3 });
  const { plots, lines } = block;
  const kr = rngKit(4441);
  for (const p of plots) {
    const t = kr.next();
    p.kind = t < 0.36 ? 'flood' : t < 0.54 ? 'seed' : t < 0.78 ? 'plough' : 'renge';   // April: some flooded, some still being worked
  }
  const set = (row, col, kind) => { const p = plots.find((q) => q.row === row && q.col === col); if (p) p.kind = kind; };
  // row 0 is the south (pond) end, the last row by the road
  const last = Math.max(...plots.map((p) => p.row));
  // a dozen plots is too few to leave to chance: April's mix, by hand
  set(last, Math.max(...plots.filter((p) => p.row === last).map((p) => p.col)), 'fallow');   // the pump shed's corner
  set(last, 0, 'flood');                    // by the lane z 45 end: water you see first
  set(last, 1, 'seed');
  set(last - 1, 0, 'seed');
  set(last - 1, 1, 'plough');
  set(2, 0, 'seed');
  set(2, 1, 'flood');
  set(1, 0, 'renge');                       // by the lane z 80 end
  set(1, 1, 'seed');
  set(0, 0, 'flood');                       // by the pond: water beside water
  set(0, 1, 'plough');
  set(0, 2, 'seed');
  const corner = plots.find((p) => p.kind === 'fallow');
  const apron = corner ? [corner.sw + 0.8, bz0 + 1.2, corner.se - 0.8, bz0 + 8.2] : [bx1 - 14, bz0 + 1.2, bx1 - 1, bz0 + 8.2];
  const channels = [{ x0: ch.x0, z0: bz0 + 0.3, x1: ch.x1, z1: bz1 - 0.3, axis: 'z' }];
  return { plots, lines, channels, apron, channelX: ch };
}

/** Build the paddies into `parts` (and `scatter`), colliders into ctx. */
export function buildPaddies(ctx, parts, scatter, water, plan) {
  const { plots, lines, channels } = plan;
  const r = rngKit(4501);
  const flood = [];

  for (const p of plots) {
    if (p.kind === 'flood' || p.kind === 'seed') {
      flood.push(plotGeo(p, Y.flood, TILE.water));
      const [a, b, c, d] = plotRect(p);
      if (c > a && d > b) ctx.collide(a, b, c, d, 1.0);        // flooded plots are not for walking
    } else if (p.kind === 'plough') {
      parts.add('plough', plotGeo(p, Y.plough, TILE.plough, (p.se - p.sw) > 16));
    } else if (p.kind === 'renge') {
      parts.add('renge', plotGeo(p, Y.renge, TILE.renge));
    } else {
      parts.add('grass', plotGeo(p, Y.fallow, TILE.grass));
    }
    // a muddy lip where the water meets the path: a slightly larger sheet under it
    if (p.kind !== 'fallow') parts.add('mud', plotGeo(p, Y.flood - 0.012, 1, false, RIDGE.w / 2));
  }

  // the paths: along every curve, across at every cut
  for (const l of lines) {
    if (l.kind === 'curve') {
      const pts = [];
      for (let x = l.x0; x < l.x1; x += 2.5) pts.push([x, l.f(x)]);
      pts.push([l.x1, l.f(l.x1)]);
      pathAlong(parts, pts);
      weeds(scatter, r, pts);
    } else {
      pathAlong(parts, [l.a, l.b]);
      weeds(scatter, r, [l.a, l.b]);
    }
  }

  /* ---- seedlings: sparse rows, planted part way across ---- */
  for (const p of plots.filter((q) => q.kind === 'seed')) {
    const stop = r.range(0.5, 0.8);
    const nv = Math.floor(Math.abs(p.S(p.sw) - p.N(p.nw)) / 0.36);
    const nu = Math.floor((p.se - p.sw) / 0.34);
    for (let j = 1; j < nv; j++) {
      for (let i = 1; i < nu * stop; i++) {
        if (r.chance(0.06)) continue;
        const [x, z] = plotPoint(p, i / nu, j / nv, 0.8);
        const h = r.range(0.13, 0.19);
        scatter.put('tuft', x, Y.flood - 0.02, z, 0.5 * h, h, 0.5 * h, r.range(0, 6.3), r.pick([0x98c95c, 0x8cc257, 0xa4d066]));
      }
    }
  }
  /* ---- renge in flower, clods on the ploughed ---- */
  for (const p of plots) {
    const area = (p.se - p.sw) * Math.abs(p.S(p.sw) - p.N(p.nw));
    if (p.kind === 'renge') {
      for (let i = 0; i < area * 0.45; i++) {
        const [x, z] = plotPoint(p, r.next(), r.next(), 0.5);
        const h = r.range(0.1, 0.18);
        scatter.put('tuft', x, Y.renge - 0.01, z, h * 1.3, h, h * 1.3, r.range(0, 6.3), r.pick([0x86b062, 0x7ba65a]));
        scatter.put('head', x, Y.renge + h * 0.9, z, 0.07, 0.05, 0.07, r.range(0, 6.3), r.pick([0xd47fc2, 0xc670b8, 0xe6a0d4]));
      }
    } else if (p.kind === 'plough') {
      for (let i = 0; i < area * 0.05; i++) {
        const [x, z] = plotPoint(p, r.next(), r.next(), 0.6);
        const s = r.range(0.08, 0.16);
        scatter.put('stone', x, Y.plough, z, s * 1.4, s, s, r.range(0, 6.3), r.pick([0x7a6048, 0x8a6e52]));
      }
    }
  }

  /* ---- the channel by the track, and the water mesh ---- */
  const chWater = [];
  for (const c of channels) {
    const t = 0.1, top = 0.2;
    parts.box('concrete', c.x0, c.x0 + t, 0, top, c.z0, c.z1);
    parts.box('concrete', c.x1 - t, c.x1, 0, top, c.z0, c.z1);
    parts.box('concreteDark', c.x0 + t, c.x1 - t, 0, 0.1, c.z0, c.z1);
    chWater.push(sheetGeo(c.x0 + t, c.x1 - t, c.z0, c.z1, 0.13, TILE.water));
  }
  const waterMesh = new THREE.Mesh(mergeFlat([...flood, ...chWater]), water.paddy);
  waterMesh.name = 'land-paddy-water';
  waterMesh.userData.dynamic = true;
  waterMesh.userData.ground = true;
  waterMesh.receiveShadow = false;
  ctx.add(waterMesh);

  /* Near the paddies the flooded plots are a true mirror (Tan: better than
   * before): in April a flooded paddy is a sheet of sky with the town and
   * the trees upside down in it.  A small target (512) and a short range
   * keep it cheap; the painted water stays for the distance. */
  if (flood.length) {
    const [bx0, bz0, bx1, bz1] = TOWN.land.paddies.box;
    const mirror = makeMirror(mergeFlat(flood), Y.flood + 0.009, pondWobbleTex(),   // a hair over the painted sheet under it
      { size: 512, base: 0xb4ac8a, deep: 0x908668, name: 'land-paddy-mirror' });
    mirror.camera.layers.set(REFLECT);
    mirror.visible = false;
    ctx.add(mirror);
    const NEAR = 55;
    let t = 0;
    ctx.update((dt, cam) => {
      if (!cam) return;
      const q = ctx.toLocal({ x: cam.x, z: cam.z });
      const d = Math.hypot(Math.max(bx0 - q.x, 0, q.x - bx1), Math.max(bz0 - q.z, 0, q.z - bz1));
      mirror.visible = d < NEAR;
      if (mirror.visible) {
        t += dt;
        mirror.material.uniforms.chopOff.value.set(t * 0.002, Math.sin(t * 0.13) * 0.006);
        const fog = ctx.scene.fog;
        if (fog) mirror.material.uniforms.light.value = THREE.MathUtils.clamp((fog.color.r * 0.3 + fog.color.g * 0.55 + fog.color.b * 0.15) * 1.7, 0.22, 1);
      }
    });
  }

  // sluice gates where the channel feeds a flooded plot
  const cx = plan.channelX;
  for (const p of plots) {
    if (p.col !== 0 || !(p.kind === 'flood' || p.kind === 'seed')) continue;
    const zm = (p.S(p.sw) + p.N(p.nw)) / 2;
    sluice(parts, cx.x1 - 0.05, zm, 'x');
  }
  return { water: waterMesh };
}

function weeds(scatter, r, pts) {
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
    const len = Math.hypot(bx - ax, bz - az);
    const nx = -(bz - az) / (len || 1), nz = (bx - ax) / (len || 1);
    for (let k = 0; k < len / 1.6; k++) {
      const t = r.next(), s = r.sign() * (RIDGE.w / 2 - 0.06);
      const x = ax + (bx - ax) * t + nx * s, z = az + (bz - az) * t + nz * s;
      const h = r.range(0.12, 0.26);
      scatter.put('tuft', x, RIDGE.top - 0.04, z, h * 0.9, h, h * 0.9, r.range(0, 6.3), r.pick([0x7fa65a, 0x8db265, 0x74985a]));
      if (r.chance(0.12)) scatter.put('head', x + 0.03, RIDGE.top - 0.04 + h * 0.8, z, 0.04, 0.03, 0.04, 0, r.chance(0.7) ? 0xf4cf3a : 0xfbfaf0);
    }
  }
}

function mergeFlat(geos) {
  const g = new THREE.BufferGeometry();
  const pos = [], uv = [], nrm = [], idx = [];
  let base = 0;
  for (const s of geos) {
    const p = s.attributes.position, u = s.attributes.uv;
    for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); uv.push(u.getX(i), u.getY(i)); nrm.push(0, 1, 0); }
    const ix = s.index.array;
    for (let i = 0; i < ix.length; i++) idx.push(ix[i] + base);
    base += p.count;
  }
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setIndex(idx);
  return g;
}

/** A small sluice gate (水門): a steel plate in a frame, a handwheel on top. */
function sluice(parts, x, z, across) {
  const w = 0.62, h = 0.72;
  const ax = across === 'x';
  const [dx, dz] = ax ? [0.04, w / 2] : [w / 2, 0.04];
  for (const s of [-1, 1]) {
    const px = ax ? x : x + (s * w) / 2, pz = ax ? z + (s * w) / 2 : z;
    parts.add('steel', boxGeo(px - 0.035, px + 0.035, 0, h, pz - 0.035, pz + 0.035));
  }
  parts.add('steel', boxGeo(x - (ax ? 0.05 : w / 2 + 0.04), x + (ax ? 0.05 : w / 2 + 0.04), h - 0.06, h, z - (ax ? w / 2 + 0.04 : 0.05), z + (ax ? w / 2 + 0.04 : 0.05)));
  parts.add('steelBlue', boxGeo(x - dx, x + dx, 0.12, 0.46, z - dz, z + dz));
  parts.add('steel', boxGeo(x - 0.012, x + 0.012, h, h + 0.16, z - 0.012, z + 0.012));
  const wheel = new THREE.TorusGeometry(0.13, 0.014, 4, 10);
  wheel.rotateX(Math.PI / 2);
  wheel.translate(x, h + 0.16, z);
  parts.add('steelRed', wheel);
}

/** The farm track: packed earth with grass shoulders, from the main road
 * to the bridge, and from the bridge to the Deer Park gate. */
export function buildTrack(ctx, parts) {
  const L = TOWN.land, T = L.track, B = L.bridge;
  const tx0 = T.x - T.w / 2, tx1 = T.x + T.w / 2;
  // (the town side, from the junction to the bridge, is lane x 30's own road: the kit's)
  for (const [z0, z1] of [[T.z0, B.z0]]) {
    const g = sheetGeo(tx0, tx1, z0, z1, T.top, 1, { rot: false, uTile: 1 });
    // u across the width, v along z
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (g.attributes.position.getX(i) - tx0) / T.w, g.attributes.position.getZ(i) / (TILE.track * 2));
    parts.add('track', g);
    // walked on at its own height (it wasn't: Hachi stood 12 cm into it at the gate, Tan 2026-09-29)
    ctx.platform({ x0: tx0, x1: tx1, z0: Math.min(z0, z1), z1: Math.max(z0, z1), top: T.top });
    for (const [a, b] of [[tx0 - 0.8, tx0], [tx1, tx1 + 0.8]]) {
      parts.add('grass', sheetGeo(a, b, z0, z1, 0.05, TILE.grass));
      ctx.surface?.({ x0: a, x1: b, z0: Math.min(z0, z1), z1: Math.max(z0, z1), top: 0.05 });      // (Hachi's paws on the grass, not 2 cm into it)
    }
  }
}

/** The pump shed (揚水機場) on its gravel apron, a kei truck parked by it. */
export function buildPumpShed(ctx, parts, apron) {
  const [ax0, az0, ax1, az1] = apron;
  parts.add('gravel', sheetGeo(ax0, ax1, az0, az1, 0.035));
  const sx0 = ax0 + 0.6, sx1 = sx0 + 3.0, sz1 = az1 - 0.6, sz0 = sz1 - 2.4, h = 2.3;
  parts.box('shedWall', sx0, sx1, 0, h, sz0, sz1);
  const roof = new THREE.BoxGeometry(sx1 - sx0 + 0.5, 0.06, sz1 - sz0 + 0.6);
  roof.rotateX(0.16);
  roof.translate((sx0 + sx1) / 2, h + 0.16, (sz0 + sz1) / 2);
  parts.add('shedRoof', roof);
  // the door and plate face the paddies (north); the pipe runs to the river
  parts.box('shedDoor', sx0 + 0.3, sx0 + 1.2, 0.02, 1.95, sz0 - 0.03, sz0);
  parts.box('steel', sx1 - 0.9, sx1 - 0.3, 1.4, 1.8, sz0 - 0.03, sz0);
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.24), flat({ map: noticeTex('pump', LAND_SIGNS.pump, { w: 256, h: 64 }) }));
  plate.position.set(sx0 + 2.0, 2.0, sz0 - 0.035);
  plate.rotation.y = Math.PI;
  plate.userData.detail = true;
  ctx.add(plate);
  const pipe = new THREE.CylinderGeometry(0.12, 0.12, 1.6, 8);
  pipe.rotateX(Math.PI / 2);
  pipe.translate(sx0 + 0.8, 0.3, sz1 + 0.8);
  parts.add('steelBlue', pipe);
  parts.box('post', sx1 + 0.4, sx1 + 0.5, 0, 1.9, sz0 + 0.2, sz0 + 0.3);
  parts.box('white', sx1 + 0.3, sx1 + 0.6, 1.2, 1.7, sz0, sz0 + 0.2);
  ctx.collide(sx0 - 0.05, sz0 - 0.05, sx1 + 0.05, sz1 + 0.05, h);
  parkVehicle(ctx, { kind: 'keitruck', x: ax0 + 7.4, z: az0 + 3.2, y: 0.035, ry: Math.PI, color: 0xf2eee6, load: 'sheet' });
}

/** 田んぼに入らないでください, on a stake by the track past the bridge. */
export function buildNotice(ctx, parts, x, z) {
  parts.box('wood', x - 0.04, x + 0.04, 0, 1.05, z - 0.04, z + 0.04);
  const note = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.36), flat({ map: noticeTex('paddy', LAND_SIGNS.paddy, { red: { line: 1, color: '#c0392b' } }) }));
  note.position.set(x, 0.92, z + 0.05);
  note.userData.detail = true;
  ctx.add(note);
  parts.box('white', x - 0.38, x + 0.38, 0.72, 1.1, z - 0.01, z + 0.04);
}

/** A scarecrow (案山子): a pole, a crossbar, a shirt, a straw hat. */
export function buildScarecrow(parts, x, z) {
  parts.box('wood', x - 0.04, x + 0.04, 0, 1.7, z - 0.04, z + 0.04);
  parts.box('wood', x - 0.7, x + 0.7, 1.28, 1.34, z - 0.03, z + 0.03);
  parts.box('cloth', x - 0.3, x + 0.3, 0.8, 1.38, z - 0.12, z + 0.12);
  parts.box('cloth', x - 0.72, x - 0.3, 1.2, 1.38, z - 0.1, z + 0.1);
  parts.box('cloth', x + 0.3, x + 0.72, 1.2, 1.38, z - 0.1, z + 0.1);
  parts.box('white', x - 0.2, x + 0.2, 1.36, 1.44, z - 0.13, z + 0.13);
  const head = new THREE.SphereGeometry(0.17, 8, 6);
  head.translate(x, 1.58, z);
  parts.add('straw', head);
  const hat = new THREE.ConeGeometry(0.42, 0.22, 12);
  hat.translate(x, 1.8, z);
  parts.add('straw', hat);
  for (const s of [-1, 1]) {
    const hand = new THREE.ConeGeometry(0.08, 0.2, 6);
    hand.rotateZ((s * Math.PI) / 2);
    hand.translate(x + s * 0.8, 1.31, z);
    parts.add('straw', hand);
  }
}

/** The land's materials shared by the parts. */
export function landMats(tex) {
  return {
    plough: cel({ color: 0xffffff, bands: 3, tint: 0x6a5a78, map: tex.plough }),
    renge: cel({ color: 0xffffff, bands: 3, tint: 0x5b6f8c, map: tex.renge }),
    mud: cel({ color: 0x7d6650, bands: 3, tint: 0x5e5070 }),
    ridgeGrass: cel({ color: 0x8fb36a, bands: 3, tint: 0x55708a }),
    ridgeTop: cel({ color: 0xa88e6e, bands: 3, tint: 0x655676 }),
    concrete: cel({ color: 0xd2cec4, bands: 3, tint: 0x6f6790 }),
    concreteDark: cel({ color: 0x9c9a92, bands: 3, tint: 0x5f5880 }),
    steel: cel({ color: 0x7c8088, bands: 3, tint: 0x4f4a70 }),
    steelBlue: cel({ color: 0x6f96b4, bands: 3, tint: 0x4a5a86 }),
    steelRed: cel({ color: 0xc8483a, bands: 3, tint: 0x6a3a5a }),
    gravel: cel({ color: 0xc7bca4, bands: 3, tint: 0x6a6388 }),
    white: cel({ color: 0xf2f0ea, bands: 3, tint: 0x6f6790 }),
    wood: cel({ color: 0x9a7a58, bands: 3, tint: 0x5a4a68 }),
    earth: cel({ color: 0x9e8668, bands: 3, tint: 0x655676 }),
  };
}
