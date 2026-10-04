import * as THREE from 'three';
import { TOWN } from '../../config.js';
import { cel, flat } from '../../core/toon.js';
import { rngKit } from '../../core/util.js';
import { JP_ROUND } from '../kit/tex.js';
import { Body, blob, limb, at } from './shapes.js';
import { painted } from './shade.js';

/* ------------------------------------------------------------------ *
 * ハチのおうち: Hachi's own home (Tan, 2026-10-01; the better version,
 * 2026-10-02: "looks very basic; can we go for a better version?").
 *
 * Across the level crossing the lane ended at a guardrail and a house you
 * could not get past.  The house is gone (line/index.js leaves its lot
 * out), the lane ends in a paved forecourt (line/crossing.js) and the lot
 * is his, a much-loved dog's place:
 *
 *   the gate      an arch with ハチのおうち hung under it, a red mailbox
 *                 (ハチ) beside it, いらっしゃい on the mat
 *   the doghouse  a little Japanese house on a raised floor: plastered
 *                 walls in a timber frame, a tiled roof with a ridge, an
 *                 arched doorway, a round window, a porch and its step, a
 *                 paper lantern, his name over the door, a cushion inside
 *   his things    a cushion bed on a checked blanket, two bowls in a stand
 *                 with his name, a basket of toys spilling over, a ball
 *                 (it rolls when he noses it), a play tunnel and a hoop,
 *                 a sandpit with a bone half dug up
 *   the garden    lawn, paw-print stepping stones, flower beds, potted
 *                 flowers, a white picket fence, a hedge behind, a paper
 *                 lamp, bunting and a string of lights from post to post
 *                 (lit after dark), a cherry (his: built with the town's)
 *
 * Everything is in the town's (turned) frame: the gate is on the north
 * side (-z), on the lane.  Four draws: one painted mesh (vertex colours,
 * the animals' shared material), one small sign page (256x128: the gate's
 * board, the name plate, the mat), the paper and bulbs that glow at night,
 * and the ball.  The whole group is hidden beyond `SEE` m.
 * ------------------------------------------------------------------ */

const H = TOWN.hachiHome;
const SEE = 130;      // m: from the plaza's far side the gate is a speck; beyond, nothing of the garden is drawn

/** For the guide (animals/guide.js): the ball he noses along, in the town's frame. */
export const HACHI_HOME = { ball: { x: H.ball[0], z: H.ball[1] }, nudge: () => {} };

const WOOD = 0xa4845e, WOOD_DARK = 0x6e5340, WOOD_PALE = 0xc9ab80, WHITE = 0xf4f1ea, LAWN = 0x9fca8c, LAWN2 = 0x8dbb7c, SOIL = 0x7a5a48;
const PLASTER = 0xf3ead6, TILE = [0x5d6f8c, 0x687a97], TILE_DARK = 0x46546e, RED = 0xd9534a;
const BRICK = [0xc0705a, 0xb2634f, 0xcb8068], STONE = [0xcfc9bf, 0xc2bcb4];
const BLOOM = [0xf48fb1, 0xffd54f, 0xfdfdf6, 0xe8554e, 0xb39ddb, 0xff9e80];
const FLAG = [0xe8554e, 0xffd54f, 0x6fb0d8, 0xfdfdf6, 0x8cc47a, 0xf48fb1];

/** The sign page (256x128): the gate's board (top, 256x72), his name plate (bottom left, 112x56), the mat (bottom right, 144x56). */
let signs = null;
function signTex() {
  if (signs) return signs;
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 128;
  const c = cv.getContext('2d');
  const paw = (x, y, s, col) => {
    c.fillStyle = col;
    c.beginPath(); c.ellipse(x, y + s * 0.35, s * 0.62, s * 0.5, 0, 0, Math.PI * 2); c.fill();
    for (const [dx, dy] of [[-0.72, -0.25], [-0.26, -0.72], [0.26, -0.72], [0.72, -0.25]]) { c.beginPath(); c.ellipse(x + dx * s, y + dy * s, s * 0.24, s * 0.3, dx * 0.4, 0, Math.PI * 2); c.fill(); }
  };
  c.textAlign = 'center'; c.textBaseline = 'middle';
  // the gate's board: cream, a brown line round it, his name between two paw prints
  c.fillStyle = '#f6ecd6'; c.fillRect(0, 0, 256, 72);
  c.strokeStyle = '#8a5a3a'; c.lineWidth = 4; c.strokeRect(4, 4, 248, 64);
  c.fillStyle = '#5a3a26';
  c.font = `bold 33px ${JP_ROUND}`;
  c.fillText('ハチのおうち', 128, 38);
  paw(24, 34, 11, '#d9825a'); paw(232, 34, 11, '#d9825a');
  // his name plate, hand painted: cream board, red brush letters a little off the level, a paw beside
  c.fillStyle = '#fbf3e0'; c.fillRect(0, 72, 112, 56);
  c.strokeStyle = '#c63d2f'; c.lineWidth = 3; c.strokeRect(3.5, 75.5, 105, 49);
  c.save(); c.translate(44, 101); c.rotate(-0.06);
  c.fillStyle = '#c63d2f'; c.font = `bold 33px ${JP_ROUND}`; c.fillText('ハチ', 0, 0);
  c.restore();
  paw(91, 99, 9, '#d9825a');
  // the mat: coir, a darker border, いらっしゃい
  c.fillStyle = '#b08a5c'; c.fillRect(112, 72, 144, 56);
  c.fillStyle = 'rgba(90,60,30,0.35)';
  for (let i = 0; i < 260; i++) c.fillRect(112 + ((i * 53) % 144), 72 + ((i * 29) % 56), 2, 1);
  c.strokeStyle = '#7a5632'; c.lineWidth = 5; c.strokeRect(115.5, 75.5, 137, 49);
  c.fillStyle = '#fff3d8'; c.font = `bold 21px ${JP_ROUND}`;
  c.fillText('いらっしゃい', 184, 101);
  signs = new THREE.CanvasTexture(cv);
  signs.colorSpace = THREE.SRGBColorSpace;
  signs.anisotropy = 8;
  return signs;
}
const PAGE = { board: [0, 0, 256, 72], plate: [0, 72, 112, 128], mat: [112, 72, 256, 128] };
/** A plane w x h showing the page's rect [u0, v0, u1, v1] (pixels, y down). */
function signPlane(w, h, [u0, v0, u1, v1]) {
  const g = new THREE.PlaneGeometry(w, h);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (u0 + uv.getX(i) * (u1 - u0)) / 256, 1 - (v0 + (1 - uv.getY(i)) * (v1 - v0)) / 128);
  return g;
}
/** Several plain geometries (position, normal, uv) as one. */
function join(parts) {
  const g = new THREE.BufferGeometry();
  const flatd = parts.map((p) => (p.index ? p.toNonIndexed() : p));
  for (const name of ['position', 'normal', 'uv']) g.setAttribute(name, new THREE.Float32BufferAttribute(flatd.flatMap((p) => [...p.attributes[name].array]), name === 'uv' ? 2 : 3));
  return g;
}

export function buildHachiHome(town) {
  // his things in one group: drawn only while you are within `SEE` m (nothing of it shows from the famous views)
  const group = new THREE.Group();
  group.name = 'hachi-home';
  group.userData.dynamic = true;                 // (kept out of the town's static batches: it is shown and hidden)
  town.add(group);
  const ctx = { ...town, add: (o) => { group.add(o); return o; } };
  const r = rngKit(8808);
  const b = new Body();                          // everything painted
  const glow = [];                               // paper and bulbs: lit after dark
  const plates = [];                             // the sign page's planes
  const y0 = ctx.groundAt((H.x0 + H.x1) / 2, (H.z0 + H.z1) / 2);
  const LY = 0.03;                               // the lawn's top over the ground
  const box = (w, h, d, x, y, z, color, ry = 0, rx = 0, rz = 0) => b.add(new THREE.BoxGeometry(w, h, d), { matrix: at(x, y0 + y, z, rx, ry, rz), color });
  const zF = TOWN.bounds.z1 - 2;                 // the south fence's line (town-core.js)
  /** A collider only you meet: Hachi goes through it (his door, his tunnel, his hoop: animals/guide.js skips `pet`). */
  const petOnly = (x0, z0, x1, z1, top) => {
    const a = town.toWorld({ x: x0, z: z0 }), c = town.toWorld({ x: x1, z: z1 });
    ctx.colliders.push({ x0: Math.min(a.x, c.x), x1: Math.max(a.x, c.x), z0: Math.min(a.z, c.z), z1: Math.max(a.z, c.z), top: y0 + top, pet: true });
  };

  /* ---- the lawn, mown in stripes ---- */
  box(H.x1 - H.x0, LY, H.z1 - zF - 0.15, (H.x0 + H.x1) / 2, LY / 2, (zF + 0.15 + H.z1) / 2, LAWN);
  ctx.surface?.({ x0: H.x0, x1: H.x1, z0: zF + 0.15, z1: H.z1, top: y0 + LY });      // (3 cm over the ground: his paws rest on it, ctx.js surfaceAt)
  for (let x = H.x0 + 1.0; x < H.x1 - 0.6; x += 1.9) box(0.95, LY + 0.002, H.z1 - zF - 0.9, x, LY / 2 + 0.001, (zF + H.z1) / 2 + 0.2, LAWN2);

  /* ---- the picket fence, low and white: the sides and the back ---- */
  const picket = (ax, az, bx, bz) => {
    const len = Math.hypot(bx - ax, bz - az), n = Math.round(len / 0.21), ry = Math.atan2(bx - ax, bz - az) + Math.PI / 2;
    for (let i = 0; i <= n; i++) {
      const t = i / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t, post = i % 8 === 0;
      const h = post ? 0.62 : 0.5, w = post ? 0.1 : 0.085;
      box(w, h, post ? 0.1 : 0.025, x, h / 2 + 0.03, z, WHITE, ry);
      b.add(post ? blob(0.06, 0.06, 0.06, 6, 4) : new THREE.ConeGeometry(0.06, 0.07, 4), { matrix: at(x, y0 + h + (post ? 0.07 : 0.065), z, 0, ry + (post ? 0 : Math.PI / 4), 0, post ? 1 : [1, 1, 0.3]), color: WHITE });
    }
    for (const y of [0.17, 0.4]) box(len, 0.05, 0.03, (ax + bx) / 2, y, (az + bz) / 2, WHITE, ry);
  };
  picket(H.x0, zF + 0.3, H.x0, H.z1);
  picket(H.x1, zF + 0.3, H.x1, H.z1);
  picket(H.x0, H.z1, H.x1, H.z1);
  ctx.collide(H.x0 - 0.12, zF, H.x0 + 0.12, H.z1 + 0.12, 0.9);
  ctx.collide(H.x1 - 0.12, zF, H.x1 + 0.12, H.z1 + 0.12, 0.9);
  ctx.collide(H.x0 - 0.12, H.z1 - 0.12, H.x1 + 0.12, H.z1 + 0.12, 0.9);

  /* ---- the hedge behind the back fence: the garden's own backdrop ---- */
  for (let x = H.x0 - 0.2, i = 0; x < H.x1 + 0.6; x += 1.15, i++) {
    const s = 0.85 + r.next() * 0.3;
    b.add(blob(0.8 * s, 0.75 * s, 0.6, 14, 9), { matrix: at(x + r.range(-0.1, 0.1), y0 + 0.62 * s, H.z1 + 0.75), color: (p, n) => (n.y > 0.45 ? 0x86b06a : 0x6f9a5c) });
  }

  /* ---- flowers: beds along the fences (soil, a brick edge), pots by his porch ---- */
  const flower = (x, y, z, h) => {
    const col = r.pick(BLOOM);
    box(0.014, h, 0.014, x, y + h / 2, z, 0x5f9150);
    b.add(blob(0.07, 0.035, 0.045, 6, 4), { matrix: at(x + 0.04, y0 + y + h * 0.4, z, 0, r.range(0, 6.28), 0.5), color: 0x6fa35c });
    b.add(blob(0.05, 0.036, 0.05, 7, 5), { matrix: at(x, y0 + y + h + 0.01, z), color: col });
    b.add(blob(0.02, 0.018, 0.02, 5, 4), { matrix: at(x, y0 + y + h + 0.035, z), color: col === 0xffd54f ? 0xf08a3c : 0xffe082 });
  };
  const bed = (x0, z0, x1, z1) => {
    box(x1 - x0, 0.07, z1 - z0, (x0 + x1) / 2, 0.05, (z0 + z1) / 2, SOIL);
    const alongX = x1 - x0 > z1 - z0;
    const run = (ax, az, bx, bz) => {
      const len = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(len / 0.23));
      for (let i = 0; i < n; i++) { const t = (i + 0.5) / n; box(0.2, 0.1, 0.09, ax + (bx - ax) * t, 0.06, az + (bz - az) * t, r.pick(BRICK), Math.atan2(bx - ax, bz - az) + Math.PI / 2, 0, r.range(-0.06, 0.06)); }
    };
    if (alongX) { run(x0, z0, x1, z0); run(x0, z1, x1, z1); } else { run(x0, z0, x0, z1); run(x1, z0, x1, z1); }
    const n = Math.round((alongX ? x1 - x0 : z1 - z0) / 0.3);
    for (let i = 0; i < n; i++) flower(r.range(x0 + 0.12, x1 - 0.12), 0.08, r.range(z0 + 0.12, z1 - 0.12), r.range(0.16, 0.34));
    ctx.collide(x0 - 0.05, z0 - 0.05, x1 + 0.05, z1 + 0.05, 0.45);      // (Tan, 2026-10-02: he waded through his things) neither of you through the flowers
  };
  bed(H.x0 + 0.18, zF + 0.9, H.x0 + 0.72, H.z1 - 2.1);                  // the west fence, as far as the sandpit
  bed(H.x0 + 2.2, H.z1 - 0.72, H.x1 - 3.0, H.z1 - 0.18);               // the back, from the sandpit to the cherry
  bed(H.gate.x + H.gate.w / 2 + 0.5, zF + 0.3, H.x1 - 0.3, zF + 0.84);  // inside the front fence, east of the gate
  const pot = (x, z, y = LY) => {
    b.add(new THREE.CylinderGeometry(0.11, 0.08, 0.16, 10), { matrix: at(x, y0 + y + 0.08, z), color: 0xc6714f });
    b.add(new THREE.CylinderGeometry(0.12, 0.12, 0.03, 10), { matrix: at(x, y0 + y + 0.165, z), color: 0xd27e5a });
    b.add(new THREE.CylinderGeometry(0.095, 0.095, 0.01, 10), { matrix: at(x, y0 + y + 0.176, z), color: SOIL });
    for (let k = 0; k < 3; k++) flower(x + Math.cos(k * 2.1) * 0.04, y + 0.17, z + Math.sin(k * 2.1) * 0.04, 0.1 + 0.05 * k);
  };

  /* ---- the gate: two posts, a beam, his name hung under it; a threshold stone; the mat on the forecourt ---- */
  const gx = H.gate.x, gw = H.gate.w / 2 + 0.02;
  for (const s of [-1, 1]) {
    box(0.17, 2.42, 0.17, gx + s * gw, 1.21, zF, WOOD_DARK);
    box(0.25, 0.06, 0.25, gx + s * gw, 2.45, zF, WOOD);
    ctx.collide(gx + s * gw - 0.12, zF - 0.12, gx + s * gw + 0.12, zF + 0.12, 2.5);
  }
  box(gw * 2 + 0.5, 0.13, 0.15, gx, 2.3, zF, WOOD_DARK);
  box(gw * 2 + 0.8, 0.05, 0.42, gx, 2.4, zF, 0x8e3a30);      // a little red roof board
  box(1.54, 0.5, 0.05, gx, 1.93, zF, WOOD);
  for (const s of [-1, 1]) box(0.025, 0.14, 0.025, gx + s * 0.6, 2.2, zF, 0x4a3a30);
  box(H.gate.w - 0.2, 0.075, 0.5, gx, 0.0375, zF + 0.14, STONE[0]);
  ctx.platform({ x0: gx - H.gate.w / 2 + 0.1, x1: gx + H.gate.w / 2 - 0.1, z0: zF - 0.11, z1: zF + 0.39, top: y0 + 0.075 });
  {
    const board = signPlane(1.44, 0.405, PAGE.board);
    plates.push(board.clone().applyMatrix4(at(gx, y0 + 1.93, zF - 0.027, 0, Math.PI, 0)));       // to the lane (-z)
    plates.push(board.clone().applyMatrix4(at(gx, y0 + 1.93, zF + 0.027)));                       // and into the garden
    // the mat, on the forecourt's setts (line/crossing.js: their top is 6 cm up), read as you come to the gate
    const mz = zF - 0.62, my = 0.06;
    box(1.06, 0.016, 0.48, gx, my + 0.008, mz, 0x8a6a44);
    plates.push(signPlane(1.02, 0.4, PAGE.mat).rotateX(-Math.PI / 2).rotateY(Math.PI).translate(gx, y0 + my + 0.0175, mz));
  }

  /* ---- the mailbox by the gate: red, on a post, his name on it ---- */
  {
    const mx = gx - gw - 0.52, mz = zF - 0.42, my = 0.06;
    box(0.08, 0.95, 0.08, mx, my + 0.475, mz, WOOD_DARK);
    box(0.28, 0.2, 0.4, mx, my + 1.06, mz, RED);
    b.add(new THREE.CylinderGeometry(0.14, 0.14, 0.4, 12, 1, false, 0, Math.PI), { matrix: at(mx, y0 + my + 1.16, mz, 0, Math.PI / 2, Math.PI / 2), color: RED });
    box(0.2, 0.025, 0.012, mx, my + 1.12, mz - 0.204, 0x3a2a26);                       // the slot
    box(0.02, 0.16, 0.05, mx + 0.152, my + 1.2, mz - 0.08, 0xffd54f);                  // the little flag, up
    plates.push(signPlane(0.2, 0.1, PAGE.plate).applyMatrix4(at(mx, y0 + my + 1.01, mz - 0.203, 0, Math.PI, 0)));
    ctx.collide(mx - 0.16, mz - 0.22, mx + 0.16, mz + 0.22, y0 + 1.3);
  }

  /* ---- paw-print stepping stones from the gate to his porch ---- */
  {
    const [kx, kz] = H.kennel;
    const path = [[gx, zF + 0.95], [gx + 0.12, zF + 1.8], [gx + 0.4, zF + 2.62], [gx + 0.82, zF + 3.4], [gx + 1.22, zF + 4.15], [kx - 0.1, kz - 2.1]];
    path.forEach(([x, z], i) => {
      const ry = i * 1.3, top = LY + 0.035;
      ctx.surface?.({ x0: x - 0.23, x1: x + 0.23, z0: z - 0.2, z1: z + 0.2, top: y0 + top });      // (his paws rest on it: ctx.js surfaceAt)
      b.add(new THREE.CylinderGeometry(0.3, 0.33, 0.05, 10), { matrix: at(x, y0 + top - 0.025, z, 0, ry, 0, [1, 1, 0.84]), color: STONE[i % 2] });
      // the print: a pad and four toes, pressed in dark, pointing on along the path
      const nx = path[Math.min(i + 1, path.length - 1)], pv = path[Math.max(i - 1, 0)], a = Math.atan2(nx[0] - pv[0], nx[1] - pv[1]) + (i % 2 ? 0.25 : -0.25);
      const pm = at(x, y0 + top + 0.002, z, 0, a, 0);
      b.add(new THREE.CylinderGeometry(0.075, 0.075, 0.004, 10), { matrix: pm.clone().multiply(at(0, 0, -0.035, 0, 0, 0, [1, 1, 0.8])), color: 0x9a8f88 });
      for (const [dx, dz] of [[-0.085, 0.045], [-0.032, 0.095], [0.032, 0.095], [0.085, 0.045]]) b.add(new THREE.CylinderGeometry(0.03, 0.03, 0.004, 8), { matrix: pm.clone().multiply(at(dx, 0, dz, 0, 0, 0, [0.85, 1, 1.15])), color: 0x9a8f88 });
    });
  }

  /* ---- the doghouse: a little Japanese house on a raised floor, its door to the gate ---- */
  const [kx, kz] = H.kennel;
  const KW = 1.7, KD = 1.5, FLOOR = 0.14, WALL = 0.95, EAVE = FLOOR + WALL, RISE = 0.56, PORCH = 0.62;
  {
    // in the house's own frame: +z out of the door; turned half round so the door looks north, at the gate
    const M = at(kx, y0 + LY, kz, 0, Math.PI, 0);
    const K = (geo, x, y, z, color, rx = 0, ry = 0, rz = 0, s = 1) => b.add(geo, { matrix: M.clone().multiply(at(x, y, z, rx, ry, rz, s)), color });
    const kbox = (w, h, d, x, y, z, color, rx = 0, ry = 0, rz = 0) => K(new THREE.BoxGeometry(w, h, d), x, y, z, color, rx, ry, rz);
    const planks = (p, n, local) => (Math.abs(((local.x + 10) * 5.5) % 1 - 0.5) > 0.44 ? 0x8a6c4c : WOOD_PALE);
    // the floor and porch (boards), on short stone feet; the porch's step
    kbox(KW + 0.12, 0.06, KD + PORCH, 0, FLOOR - 0.03, PORCH / 2, planks);
    kbox(KW + 0.04, FLOOR - 0.06, KD + PORCH - 0.1, 0, (FLOOR - 0.06) / 2, PORCH / 2, WOOD_DARK);
    kbox(0.86, 0.07, 0.26, 0, 0.035, KD / 2 + PORCH + 0.13, STONE[1]);
    // the frame: posts at the corners and beside the door, beams at the floor and the eaves
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) kbox(0.09, WALL, 0.09, sx * (KW / 2 - 0.045), FLOOR + WALL / 2, sz * (KD / 2 - 0.045), WOOD_DARK);
      kbox(0.07, WALL, 0.08, sx * 0.37, FLOOR + WALL / 2, KD / 2 - 0.04, WOOD_DARK);
      kbox(0.07, 0.07, KD + 0.3, sx * (KW / 2 - 0.035), EAVE - 0.035, 0, WOOD_DARK);
    }
    for (const sz of [-1, 1]) kbox(KW + 0.24, 0.08, 0.08, 0, EAVE - 0.04, sz * (KD / 2 - 0.04), WOOD_DARK);
    // the walls: plaster between the timbers; the front's two panels either side of the door
    kbox(KW - 0.1, WALL, 0.04, 0, FLOOR + WALL / 2, -KD / 2 + 0.04, PLASTER);
    for (const sx of [-1, 1]) {
      kbox(0.04, WALL, KD - 0.1, sx * (KW / 2 - 0.04), FLOOR + WALL / 2, 0, PLASTER);
      kbox(KW / 2 - 0.4, WALL, 0.04, sx * (KW / 4 + 0.2 - 0.02), FLOOR + WALL / 2, KD / 2 - 0.04, PLASTER);
      // a low dado of boards, and a round window (丸窓): a pale ring, dark glass, a cross of glazing bars
      kbox(0.012, 0.26, KD - 0.2, sx * (KW / 2 - 0.016), FLOOR + 0.13, 0, WOOD);
      K(new THREE.TorusGeometry(0.19, 0.028, 6, 20), sx * (KW / 2 - 0.01), FLOOR + 0.58, -0.08, WOOD_PALE, 0, Math.PI / 2, 0);
      K(new THREE.CylinderGeometry(0.19, 0.19, 0.012, 20), sx * (KW / 2 - 0.014), FLOOR + 0.58, -0.08, 0x3c4a66, 0, 0, Math.PI / 2);
      kbox(0.016, 0.38, 0.022, sx * (KW / 2 - 0.004), FLOOR + 0.58, -0.08, WOOD_PALE);
      kbox(0.016, 0.022, 0.38, sx * (KW / 2 - 0.004), FLOOR + 0.58, -0.08, WOOD_PALE);
    }
    // the doorway: an arch cut in the panel over the door
    {
      const DW = 0.67, DH = 0.4, AR = DW / 2, top = WALL - DH;      // the door is DH high to the arch's spring, AR more to its crown
      const s = new THREE.Shape();
      s.moveTo(-DW / 2, 0); s.absarc(0, 0, AR, Math.PI, 0, true); s.lineTo(DW / 2, top); s.lineTo(-DW / 2, top); s.closePath();
      K(new THREE.ExtrudeGeometry(s, { depth: 0.04, bevelEnabled: false, curveSegments: 14 }), 0, FLOOR + DH, KD / 2 - 0.06, PLASTER);
      K(new THREE.TorusGeometry(AR, 0.022, 5, 16, Math.PI), 0, FLOOR + DH, KD / 2 - 0.012, WOOD_DARK);
    }
    // inside: a dark floor mat, his cushion, plump and red
    kbox(KW - 0.3, 0.012, KD - 0.3, 0, FLOOR + 0.006, 0, 0x8a6a50);
    K(blob(0.4, 0.05, 0.34, 14, 8), 0, FLOOR + 0.05, -0.12, 0xd9534a);
    K(blob(0.3, 0.03, 0.25, 12, 6), 0, FLOOR + 0.08, -0.12, 0xe8736a);
    // the gables, and his name on the front one
    for (const sz of [-1, 1]) {
      const s = new THREE.Shape();
      const h1 = RISE * (0.22 / (KW / 2 + 0.22)) - 0.01;      // (the roof's underside over the wall's corner)
      s.moveTo(-KW / 2, 0); s.lineTo(KW / 2, 0); s.lineTo(KW / 2, h1); s.lineTo(0, RISE - 0.01); s.lineTo(-KW / 2, h1); s.closePath();
      K(new THREE.ExtrudeGeometry(s, { depth: 0.04, bevelEnabled: false }), 0, EAVE, sz * (KD / 2 - 0.04) - 0.02, PLASTER);
    }
    plates.push(signPlane(0.44, 0.22, PAGE.plate).applyMatrix4(M.clone().multiply(at(0, EAVE + 0.17, KD / 2 + 0.003))));
    // the roof: two slopes of tile, course over course, rolls down them, a round ridge with its end tiles
    const HALF = KW / 2 + 0.22, L = Math.hypot(HALF, RISE), A = Math.atan2(RISE, HALF), RL = KD + 0.56, COURSES = 5;
    for (const sx of [-1, 1]) {
      for (let i = 0; i < COURSES; i++) {
        const t = (i + 0.5) / COURSES, cl = L / COURSES + 0.07;
        K(new THREE.BoxGeometry(cl, 0.035, RL - (i === COURSES - 1 ? 0 : 0.04)), sx * t * HALF, EAVE + RISE * (1 - t) + 0.03 + 0.012 * (i % 2), 0.0, TILE[i % 2], 0, 0, -sx * (A - 0.05));
      }
      for (let k = 0; k < 8; k++) {
        K(new THREE.CylinderGeometry(0.03, 0.03, L + 0.04, 6), sx * HALF / 2, EAVE + RISE / 2 + 0.065, -RL / 2 + 0.08 + (k * (RL - 0.16)) / 7, TILE_DARK, 0, 0, sx * (Math.PI / 2 - A));
      }
      kbox(0.05, 0.05, RL/*@mini - 0.006 @*//*@@*/, sx * (HALF - 0.01), EAVE + 0.035, 0, TILE_DARK);       // the eaves' edge
    }
    K(new THREE.CylinderGeometry(0.075, 0.075, RL + 0.06, 10), 0, EAVE + RISE + 0.075, 0, TILE_DARK, Math.PI / 2);
    for (const sz of [-1, 1]) K(blob(0.07, 0.085, 0.035, 8, 6), 0, EAVE + RISE + 0.085, sz * (RL / 2 + 0.03), 0x39445a);
    // under the gables the roof's edge board
    for (const sz of [-1, 1]) for (const sx of [-1, 1]) kbox(L + 0.06, 0.07, 0.035, sx * HALF / 2, EAVE + RISE / 2 - 0.01, sz * (RL / 2 - 0.02), WOOD_DARK, 0, 0, -sx * A);
    // a paper lantern hung at the porch's corner (it glows after dark), on a little bracket
    kbox(0.03, 0.03, 0.36, -KW / 2 + 0.12, EAVE - 0.1, KD / 2 + 0.16, WOOD_DARK);
    kbox(0.012, 0.1, 0.012, -KW / 2 + 0.12, EAVE - 0.16, KD / 2 + 0.3, 0x3a2a26);
    glow.push(new THREE.CylinderGeometry(0.075, 0.075, 0.17, 12).applyMatrix4(M.clone().multiply(at(-KW / 2 + 0.12, EAVE - 0.3, KD / 2 + 0.3))));
    for (const dy of [-0.39, -0.21]) K(new THREE.CylinderGeometry(0.055, 0.055, 0.02, 12), -KW / 2 + 0.12, EAVE + dy, KD / 2 + 0.3, 0x3a2a26);
    // the ground he stands on in and before it, the walls he can't go through, and you kept out of it altogether
    ctx.platform({ x0: kx - KW / 2 - 0.06, x1: kx + KW / 2 + 0.06, z0: kz - KD / 2 - PORCH, z1: kz + KD / 2, top: y0 + LY + FLOOR });
    ctx.platform({ x0: kx - 0.43, x1: kx + 0.43, z0: kz - KD / 2 - PORCH - 0.26, z1: kz - KD / 2 - PORCH, top: y0 + LY + 0.07 });
    // (Tan, 2026-10-02: "submerged beneath all the items there") his cushion's top: he stands and turns ON it
    ctx.platform({ x0: kx - 0.32, x1: kx + 0.32, z0: kz + 0.12 - 0.26, z1: kz + 0.12 + 0.26, top: y0 + LY + FLOOR + 0.1 });
    ctx.collide(kx - KW / 2, kz + KD / 2 - 0.1, kx + KW / 2, kz + KD / 2, y0 + 1.6);
    for (const sx of [-1, 1]) ctx.collide(kx + sx * (KW / 2 - 0.05) - 0.05, kz - KD / 2, kx + sx * (KW / 2 - 0.05) + 0.05, kz + KD / 2, y0 + 1.6);
    petOnly(kx - KW / 2, kz - KD / 2, kx + KW / 2, kz + KD / 2, 1.6);
  }
  pot(kx - KW / 2 - 0.3, kz - KD / 2 - 0.25);
  pot(kx + KW / 2 + 0.3, kz - KD / 2 - 0.25);

  /* ---- his cushion bed on the checked blanket, in the cherry's shade ---- */
  {
    const [bx, bz] = H.bed, W = 1.5, D = 1.15, nx = 9, nz = 7, a = 0.2, c0 = Math.cos(a), s0 = Math.sin(a);
    box(W + 0.08, 0.014, D + 0.08, bx, LY + 0.007, bz, 0xf3e7cf, a);
    ctx.surface?.({ x0: bx - 0.7, x1: bx + 0.7, z0: bz - 0.48, z1: bz + 0.48, top: y0 + LY + 0.024 });      // (the blanket, within its turn: his paws rest on it)
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      const lx = (i + 0.5) / nx * W - W / 2, lz = (j + 0.5) / nz * D - D / 2;
      box(W / nx, 0.012, D / nz, bx + lx * c0 + lz * s0, LY + 0.018, bz - lx * s0 + lz * c0, (i + j) % 2 ? RED : (i % 2 ? 0xf0b8a8 : 0xfaf0e0), a);
    }
    // the bed: a round base, a plump bolster round it, a soft middle
    b.add(new THREE.CylinderGeometry(0.47, 0.5, 0.08, 20), { matrix: at(bx, y0 + LY + 0.064, bz), color: 0x4f73a8 });
    // (Tan, 2026-10-02: only his head showed over a bolster 12 cm above where he lay) a low bolster, a full middle: he lies ON it
    b.add(new THREE.TorusGeometry(0.4, 0.07, 8, 22), { matrix: at(bx, y0 + LY + 0.13, bz, Math.PI / 2), color: (p, n) => (n.y > 0.5 ? 0x7ea0d0 : 0x6388bd) });
    b.add(blob(0.35, 0.06, 0.35, 14, 6), { matrix: at(bx, y0 + LY + 0.13, bz), color: 0xf6ecd8 });
    ctx.platform({ x0: bx - 0.3, x1: bx + 0.3, z0: bz - 0.3, z1: bz + 0.3, top: y0 + LY + 0.185 });
    // the chew bone, left on the blanket
    const m = at(bx - 0.55, y0 + LY + 0.055, bz - 0.36, 0, 0.7, 0);
    b.add(limb([-0.085, 0, 0], [0.085, 0, 0], 0.022, 0.022, 7), { matrix: m, color: 0xfaf4e6 });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.add(blob(0.03, 0.028, 0.03, 7, 5), { matrix: m.clone().multiply(at(sx * 0.095, 0, sz * 0.022)), color: 0xfaf4e6 });
  }

  /* ---- his bowls, in a stand with his name on it: water and food ---- */
  {
    const sx = kx + KW / 2 + 0.85, sz = kz - 0.35;
    box(0.74, 0.04, 0.36, sx, LY + 0.22, sz, WOOD_PALE);
    for (const s of [-1, 1]) box(0.05, 0.2, 0.34, sx + s * 0.33, LY + 0.1, sz, WOOD);
    box(0.62, 0.15, 0.03, sx, LY + 0.125, sz - 0.165, WOOD);
    plates.push(signPlane(0.24, 0.12, PAGE.plate).applyMatrix4(at(sx, y0 + LY + 0.125, sz - 0.182, 0, Math.PI, 0)));
    for (const [dx, col, fill] of [[-0.18, 0xc4c8d0, 0x7fa8c8], [0.18, RED, 0x8a5a3c]]) {
      b.add(new THREE.CylinderGeometry(0.125, 0.1, 0.07, 14), { matrix: at(sx + dx, y0 + LY + 0.255, sz), color: col });
      b.add(new THREE.CylinderGeometry(0.105, 0.105, 0.012, 14), { matrix: at(sx + dx, y0 + LY + 0.288, sz), color: fill });
    }
    for (let i = 0; i < 9; i++) { const a = i * 2.4, d = 0.025 + (i % 3) * 0.026; b.add(blob(0.019, 0.013, 0.019, 5, 4), { matrix: at(sx + 0.18 + Math.cos(a) * d, y0 + LY + 0.298, sz + Math.sin(a) * d), color: i % 2 ? 0xb07a4c : 0x9a6a40 }); }
    ctx.collide(sx - 0.38, sz - 0.19, sx + 0.38, sz + 0.19, y0 + 0.4);
  }

  /* ---- the toy basket, spilling over: a rope, the squeaky duck, a frisbee, a bone, a second ball ---- */
  {
    const [tx, tz] = H.basket;
    b.add(new THREE.CylinderGeometry(0.31, 0.25, 0.3, 16, 1, true), { matrix: at(tx, y0 + LY + 0.15, tz), color: (p) => (Math.sin((p.y - y0) * 90) > 0.2 ? 0xc79a5e : 0xb08548) });
    b.add(new THREE.CylinderGeometry(0.3, 0.24, 0.29, 16, 1, true).scale(-1, 1, 1), { matrix: at(tx, y0 + LY + 0.15, tz), color: 0x8a6436 });
    b.add(new THREE.CylinderGeometry(0.25, 0.25, 0.02, 16), { matrix: at(tx, y0 + LY + 0.012, tz), color: 0x8a6436 });
    b.add(new THREE.TorusGeometry(0.31, 0.028, 6, 18), { matrix: at(tx, y0 + LY + 0.3, tz, Math.PI / 2), color: 0xd4a96c });
    b.add(blob(0.27, 0.07, 0.27, 12, 5), { matrix: at(tx, y0 + LY + 0.21, tz), color: 0x6fa3c8 });         // a folded towel the toys sit on
    // the duck, on top
    const dm = at(tx - 0.06, y0 + LY + 0.25, tz - 0.05, 0, 2.6, 0.1);
    b.add(blob(0.085, 0.07, 0.11, 10, 7), { matrix: dm.clone().multiply(at(0, 0.07, 0)), color: 0xffd23c });
    b.add(blob(0.04, 0.045, 0.05, 7, 5), { matrix: dm.clone().multiply(at(0, 0.11, -0.1, -0.5)), color: 0xffd23c });
    for (const s of [-1, 1]) b.add(blob(0.022, 0.045, 0.065, 7, 5), { matrix: dm.clone().multiply(at(s * 0.078, 0.078, -0.005, 0, 0, s * 0.2)), color: 0xf8c22c });
    b.add(blob(0.062, 0.06, 0.062, 10, 7), { matrix: dm.clone().multiply(at(0, 0.165, 0.065)), color: 0xffd84a });
    b.add(blob(0.034, 0.014, 0.042, 8, 5), { matrix: dm.clone().multiply(at(0, 0.152, 0.128)), color: 0xf08a3c });
    for (const s of [-1, 1]) b.add(blob(0.011, 0.013, 0.008, 6, 4), { matrix: dm.clone().multiply(at(s * 0.031, 0.183, 0.117)), color: 0x2a221e });
    // the frisbee, stood up against the rim; a blue ball; a bone poking out
    const fm = at(tx + 0.2, y0 + LY + 0.33, tz + 0.1, 0.2, 0.5, 1.15);
    b.add(new THREE.CylinderGeometry(0.135, 0.15, 0.022, 18), { matrix: fm, color: 0xff8a3c });
    b.add(new THREE.CylinderGeometry(0.06, 0.06, 0.026, 12), { matrix: fm, color: 0xffb37a });
    b.add(blob(0.075, 0.075, 0.075, 12, 8), { matrix: at(tx + 0.02, y0 + LY + 0.3, tz + 0.15), color: (p, n) => (Math.abs(n.x) < 0.3 ? 0xfaf6ee : 0x4a86c8) });
    const bm = at(tx - 0.19, y0 + LY + 0.33, tz + 0.12, 0, 0.4, 1.0);
    b.add(limb([-0.09, 0, 0], [0.09, 0, 0], 0.022, 0.022, 7), { matrix: bm, color: 0xfaf4e6 });
    for (const s of [-1, 1]) b.add(blob(0.03, 0.028, 0.03, 7, 5), { matrix: bm.clone().multiply(at(0.1, 0, s * 0.022)), color: 0xfaf4e6 });
    // the rope, hung over the rim and trailing onto the lawn: a twist of blue and white, a knot at each end
    for (let i = 0; i < 14; i++) {
      const u = i / 13, x = tx - 0.27 - u * 0.36, y = u < 0.3 ? 0.31 - u * 0.2 : Math.max(0.03, 0.25 - (u - 0.3) * 0.75);
      b.add(blob(0.03, 0.03, 0.026, 7, 5), { matrix: at(x, y0 + LY + y, tz - 0.14 + 0.03 * Math.sin(i * 1.3)), color: i % 2 ? 0x4a86c8 : 0xf6f2ea });
    }
    for (const [x, y] of [[tx - 0.25, 0.33], [tx - 0.66, 0.05]]) b.add(blob(0.05, 0.046, 0.05, 8, 6), { matrix: at(x, y0 + LY + y, tz - 0.14), color: 0x4a86c8 });
    ctx.collide(tx - 0.3, tz - 0.3, tx + 0.3, tz + 0.3, y0 + 0.5);
  }

  /* ---- the play tunnel: hoops of cloth, blue and yellow, open at both ends (he runs through; you don't) ---- */
  {
    /* (Tan, 2026-10-04: "Hachi runs through the tunnel, not inside it") at 0.36 its arch stood 0.34 m over his
     * flanks and he is 0.37 m to his ear tips: his back and ears went through the cloth all the way.  0.48: 0.45
     * inside over his flanks, room for his bound */
    const T = H.tunnel, len = T.z1 - T.z0, R = 0.48, RINGS = 8;
    for (let i = 0; i < RINGS; i++) {
      const z = T.z0 + ((i + 0.5) * len) / RINGS, col = i % 2 ? 0xf2c53d : 0x4a86c8;
      const shell = new THREE.CylinderGeometry(R, R, len / RINGS, 14, 1, true, -Math.PI / 2, Math.PI);
      b.add(shell, { matrix: at(T.x, y0 + LY, z, -Math.PI / 2), color: col });
      b.add(shell.clone().scale(-0.96, 1, 0.96), { matrix: at(T.x, y0 + LY, z, -Math.PI / 2), color: i % 2 ? 0xc9a22e : 0x3b6da6 });      // its inside
    }
    for (const z of [T.z0, T.z1]) b.add(new THREE.TorusGeometry(R, 0.03, 6, 14, Math.PI), { matrix: at(T.x, y0 + LY, z), color: 0xf4f1ea });
    ctx.collide(T.x - R - 0.02, T.z0, T.x + R + 0.02, T.z1, 0.8);      // (he runs THROUGH it end to end, guide.js glide; never across its cloth, nor you)
  }

  /* ---- the hoop: a striped ring on two posts; he leaps through it ---- */
  {
    const P = H.hoop, RY = 0.47, RR = 0.36;
    for (const s of [-1, 1]) {
      box(0.06, RY + 0.1, 0.06, P.x, LY + (RY + 0.1) / 2, P.z + s * (RR + 0.07), WHITE);
      box(0.34, 0.035, 0.1, P.x, LY + 0.0175, P.z + s * (RR + 0.07), 0x4a86c8);
    }
    b.add(new THREE.TorusGeometry(RR, 0.035, 7, 28), { matrix: at(P.x, y0 + LY + RY, P.z, 0, Math.PI / 2, 0), color: (p, n, l) => (Math.floor((Math.atan2(l.y, l.x) + Math.PI) / (Math.PI / 7)) % 2 ? RED : WHITE) });
    ctx.collide(P.x - 0.17, P.z - RR - 0.12, P.x + 0.17, P.z + RR + 0.12, 0.9);      // (his leap goes through it; a walk never does)
  }

  /* ---- the sandpit: a timber frame, sand, a hole he has been at, a bone half dug up ---- */
  {
    const [sx, sz] = H.sand, W = 1.35, D = 1.15;
    box(W, 0.07, D, sx, LY + 0.035, sz, 0xe9d9a6);
    for (const s of [-1, 1]) { box(W + 0.16, 0.13, 0.08, sx, LY + 0.065, sz + s * (D / 2 + 0.04), WOOD); box(0.08, 0.13, D, sx + s * (W / 2 + 0.04), LY + 0.065, sz, WOOD); }
    // (his paws on the sand, a hop over its timbers: ctx.js surfaceAt)
    ctx.platform({ x0: sx - W / 2, x1: sx + W / 2, z0: sz - D / 2, z1: sz + D / 2, top: y0 + LY + 0.07 });
    for (const s of [-1, 1]) {
      ctx.platform({ x0: sx - W / 2 - 0.08, x1: sx + W / 2 + 0.08, z0: sz + s * (D / 2 + 0.04) - 0.04, z1: sz + s * (D / 2 + 0.04) + 0.04, top: y0 + LY + 0.13 });
      ctx.platform({ x0: sx + s * (W / 2 + 0.04) - 0.04, x1: sx + s * (W / 2 + 0.04) + 0.04, z0: sz - D / 2, z1: sz + D / 2, top: y0 + LY + 0.13 });
    }
    for (const [dx, dz, s] of [[-0.3, 0.2, 1], [0.38, -0.25, 0.8], [-0.1, -0.3, 0.6], [0.25, 0.3, 0.7]]) b.add(blob(0.2 * s, 0.07 * s, 0.17 * s, 9, 5), { matrix: at(sx + dx, y0 + LY + 0.07, sz + dz), color: 0xf0e2b4 });
    b.add(new THREE.CylinderGeometry(0.13, 0.08, 0.02, 10), { matrix: at(sx + 0.05, y0 + LY + 0.071, sz + 0.02), color: 0xcdb983 });
    const m = at(sx + 0.08, y0 + LY + 0.12, sz + 0.02, 0, 0.6, 0.85);
    b.add(limb([-0.1, 0, 0], [0.09, 0, 0], 0.024, 0.024, 7), { matrix: m, color: 0xfaf4e6 });
    for (const s of [-1, 1]) b.add(blob(0.032, 0.03, 0.032, 7, 5), { matrix: m.clone().multiply(at(0.1, 0, s * 0.024)), color: 0xfaf4e6 });
    // a little spade stuck in the corner
    box(0.02, 0.3, 0.02, sx - 0.5, LY + 0.2, sz - 0.4, WOOD_DARK, 0, 0.2, 0.15);
    box(0.09, 0.1, 0.012, sx - 0.515, LY + 0.09, sz - 0.42, RED, 0, 0.2, 0.15);
  }

  /* ---- a paper lamp by the kennel, lit after dark ---- */
  {
    const lx = kx - KW / 2 - 0.75, lz = kz + 0.2;
    glow.push(new THREE.BoxGeometry(0.2, 0.26, 0.2).translate(lx, y0 + 0.5, lz));
    box(0.05, 0.36, 0.05, lx, 0.21, lz, WOOD_DARK);
    box(0.26, 0.03, 0.26, lx, 0.375, lz, WOOD_DARK);
    box(0.3, 0.035, 0.3, lx, 0.645, lz, WOOD_DARK);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(0.022, 0.26, 0.022, lx + sx * 0.1, 0.5, lz + sz * 0.1, WOOD_DARK);
    ctx.collide(lx - 0.16, lz - 0.16, lx + 0.16, lz + 0.16, y0 + 0.7);
  }

  /* ---- bunting and a string of lights, post to post round the garden and in from the gate ---- */
  {
    const PH = 1.95, e = 0.14;
    const P = {
      fw: [H.x0 + e, zF + 0.45], mw: [H.x0 + e, (zF + H.z1) / 2], sw: [H.x0 + e, H.z1 - e], sm: [(H.x0 + H.x1) / 2, H.z1 - e],
      se: [H.x1 - e, H.z1 - e], me: [H.x1 - e, (zF + H.z1) / 2], fe: [H.x1 - e, zF + 0.45],
    };
    for (const [x, z] of Object.values(P)) { box(0.06, PH, 0.06, x, PH / 2, z, WHITE); b.add(blob(0.05, 0.05, 0.05, 6, 4), { matrix: at(x, y0 + PH + 0.03, z), color: WHITE }); }
    const top = (k) => [P[k][0], PH - 0.04, P[k][1]];
    const gateTop = (s) => [gx + s * gw, 2.36, zF];
    const runs = [
      [top('fw'), top('mw'), 1], [top('mw'), top('sw'), 1], [top('sw'), top('sm'), 1], [top('sm'), top('se'), 1], [top('se'), top('me'), 1], [top('me'), top('fe'), 1],
      [gateTop(-1), top('mw'), 0], [gateTop(1), top('me'), 0],
    ];
    let f = 0;
    const flagGeo = (() => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([-0.085, 0, 0, 0.085, 0, 0, 0, -0.2, 0, 0.085, 0, 0, -0.085, 0, 0, 0, -0.2, 0], 3)); g.computeVertexNormals(); return g; })();
    for (const [p, q, flags] of runs) {
      const len = Math.hypot(q[0] - p[0], q[2] - p[2]), n = Math.max(4, Math.round(len / 0.42)), sag = 0.06 * len, ry = Math.atan2(q[0] - p[0], q[2] - p[2]);
      const pt = (u) => [p[0] + (q[0] - p[0]) * u, p[1] + (q[1] - p[1]) * u - sag * 4 * u * (1 - u), p[2] + (q[2] - p[2]) * u];
      for (let i = 0; i < n; i++) {
        const a = pt(i / n), c = pt((i + 1) / n), m = pt((i + 0.5) / n);
        const dl = Math.hypot(c[0] - a[0], c[1] - a[1], c[2] - a[2]), pitch = Math.asin((c[1] - a[1]) / dl);
        b.add(new THREE.BoxGeometry(0.012, 0.012, dl + 0.01), { matrix: at(m[0], y0 + m[1], m[2], 0, 0, 0).multiply(new THREE.Matrix4().makeRotationY(ry)).multiply(new THREE.Matrix4().makeRotationX(-pitch)), color: 0x4a3a30 });
        // a bulb under each joint; between the bulbs, on the fence runs, a flag
        if (i > 0) glow.push(new THREE.SphereGeometry(0.042, 7, 5).translate(a[0], y0 + a[1] - 0.05, a[2]));
        if (flags) b.add(flagGeo, { matrix: at(m[0], y0 + m[1] - 0.008, m[2], 0, ry + Math.PI / 2, 0), color: FLAG[f++ % FLAG.length] });
      }
    }
  }

  const garden = new THREE.Mesh(b.build(), painted());
  garden.name = 'hachi-home-garden';
  garden.castShadow = garden.receiveShadow = true;
  ctx.add(garden);

  /* ---- the signs: one small page ---- */
  {
    const m = new THREE.Mesh(join(plates), flat({ color: 0xffffff, map: signTex(), cache: false }));
    m.name = 'hachi-home-signs';
    m.userData.noAtlas = true;
    m.userData.noOutline = true;
    ctx.add(m);
  }

  /* ---- the paper and the bulbs: one mesh, lit after dark (kit/night.js) ---- */
  {
    const paper = cel({ color: 0xfff4dc, bands: 2, tint: 0x8a7a9a, emissive: 0xffc98a, emissiveIntensity: 0, cache: false });
    ctx.night?.glowing(paper, 0xffc98a, 1.15);
    const m = new THREE.Mesh(join(glow), paper);
    m.name = 'hachi-home-lights';
    m.userData.noOutline = true;
    ctx.add(m);
  }

  /* ---- the ball: red with a white band; it rolls when he noses it, and comes to rest ---- */
  const R = 0.075;
  const bb = new Body();
  bb.add(blob(R, R, R, 14, 10), { color: (p) => (Math.abs(p.y) < R * 0.3 ? 0xfaf6ee : 0xe2483e) });
  const ball = new THREE.Mesh(bb.build(), painted());
  ball.name = 'hachi-home-ball';
  ball.castShadow = true;
  ball.userData.dynamic = true;
  ball.rotation.set(0.5, 0, 0.6);
  const B = { x: H.ball[0], z: H.ball[1], vx: 0, vz: 0 };
  ball.position.set(B.x, y0 + LY + R, B.z);
  ctx.add(ball);
  const axis = new THREE.Vector3();
  // (kept on the open lawn in the garden's middle: off the tunnel, the hoop, the porch, the blanket and the beds)
  const inX = [H.tunnel.x + 0.9, H.bed[0] - 1.2], inZ = [zF + 1.3, kz - KD / 2 - PORCH - 0.6];
  HACHI_HOME.nudge = (dx, dz, v = 1.5) => { const l = Math.hypot(dx, dz) || 1; B.vx = (dx / l) * v; B.vz = (dz / l) * v; };
  const mid = town.toWorld({ x: (H.x0 + H.x1) / 2, z: (H.z0 + H.z1) / 2 });
  ctx.update((dt, cam) => {
    if (cam) group.visible = Math.hypot(cam.x - mid.x, cam.z - mid.z) < SEE;
    const v = Math.hypot(B.vx, B.vz);
    if (v < 0.02 || !(dt > 0)) return;
    B.x += B.vx * dt; B.z += B.vz * dt;
    if (B.x < inX[0] || B.x > inX[1]) { B.vx = -B.vx * 0.5; B.x = Math.max(inX[0], Math.min(inX[1], B.x)); }
    if (B.z < inZ[0] || B.z > inZ[1]) { B.vz = -B.vz * 0.5; B.z = Math.max(inZ[0], Math.min(inZ[1], B.z)); }
    const k = Math.max(0, 1 - dt * 1.4);
    B.vx *= k; B.vz *= k;
    ball.position.set(B.x, y0 + LY + R, B.z);
    ball.rotateOnWorldAxis(axis.set(B.vz, 0, -B.vx).normalize(), (v * dt) / R);
    HACHI_HOME.ball.x = B.x; HACHI_HOME.ball.z = B.z;
  });
  return { garden, ball };
}
