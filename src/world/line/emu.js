import * as THREE from 'three';
import { cel, flat } from '../../core/toon.js';
import { bake, trs } from '../../core/util.js';
import { hullOutline } from '../../core/outline.js';
import { RAIL_TOP } from '../railway.js';
import { mergeStatic } from '../merge.js';
import { CONTACT_Y } from './track.js';
import { RIDE } from '../../data/town.js';
import { destTex, runNoTex, carNumberTex, doorLcdTex, carAdsTex, CAR_AD_CELLS, prioritySticker, weakSticker, pokeArtTex, POKE_ART } from './tex.js';

/* ------------------------------------------------------------------ *
 * Our trains (Tan: "an extremely detailed train, like the real trains of
 * Japan"; 2026-09-29: three of them, for variety).  Two-car sets, built
 * hollow so they stop at the platform, open their doors and can be seen
 * into.  One body plan, three types (TYPES):
 *
 *   box   the Fujimi Line's own EMU: stainless with bead lines, the green
 *         band and the sakura pinstripe, a flat-faced cab, a stepped roof
 *   jr    a JR commuter EMU in the E233 manner: smooth stainless with the
 *         Chūō orange band (it runs through to the JR line at 大月), a
 *         rounded roof, the black glazed mask bulging forward with its
 *         rounded corners, the lights high in its corners, the LED
 *         destination over the windscreen
 *   poke  the Pokémon train: a bright yellow livery covered in Pikachu,
 *         Poké Balls and bolts (Canvas2D, tex.js pokeArtTex), a rounded
 *         roof, a yellow cab with Pikachu's face across its front, yellow
 *         and brown seats, silhouettes on the ceiling, paw prints on the
 *         floor.  A diesel railcar: no pantograph, an exhaust on the roof,
 *         an engine underneath.
 *
 * Every type shares the plan (car length, door positions, floor height),
 * so the platform's door marks, the listening spot, the colliders and the
 * service work for all of them.
 *
 * Cost: everything that doesn't move is baked per material and merged
 * across the set (merge.js folds the plain colours into one batch); the
 * moving parts are the door leaves (one mesh and its glass per sliding
 * group), one strap InstancedMesh per set, and one mesh for every
 * destination LED on the set.  The Pokémon skin is one texture page.
 *
 * Doors are two leaves each that slide into the wall pocket (`setDoors`).
 * They open on the car's local -z side, which is the platform side on both
 * tracks: trains keep left, and a westbound set is the eastbound one turned
 * round.
 * ------------------------------------------------------------------ */

export const CAR_L = 19.4, CAR_W = 2.86, PITCH = 20.1;
export const FLOOR = 1.06, TOP = 3.74, ROOF = 3.96;
export const DOORS = [-7.0, -2.4, 2.4, 7.0];
export const DOOR_W = 1.32;
const DOOR_TOP = FLOOR + 1.85;
const WIN_Y0 = 2.02, WIN_Y1 = 3.12;
const BAYS = [[-8.55, 1.5], [-4.7, 3.1], [0, 3.3], [4.7, 3.1], [8.55, 1.5]];
const DWIN = [2.06, 2.82];                    // the door windows
const NUMBER_X = CAR_L / 2 - 0.95;            // the car's number: on the end panel, clear of the last door's pocket
const BOGIE_X = 6.85;
const RAIL_Y = TOP - 0.33;                    // the strap rails
export const SEAT_D = 0.52, SEAT_TOP = FLOOR + 0.44;
const CAB_WALL = CAR_L / 2 - 1.75;            // the cab's back wall, from the car's centre
const SHOULDER = ROOF - (TOP - 0.14);         // the rounded roof's radius
const EAVES = TOP - 0.1;                      // the eaves strip's top on a rounded roof: the skin below, the roof above

const PLAIN = {
  rubber: 0x24242c, roof: 0x8f939c, gear: 0xaeb2ba, under: 0x3e4049, bogie: 0x33343d, spring: 0x6b6d78,
  wheel: 0x4a4552, insul: 0xe6e2d8, yellow: 0xf2c23c, console: 0x3a3d48,
};

/**
 * The three types.  `stripes` are painted on the skin (and the door
 * leaves) between y0 and y1; `beads` the pressed lines of the box EMU.
 */
export const TYPES = {
  box: {
    id: 'box', roof: 'step', cab: 'box', skin: 'steel', panto: true,
    steel: 0xd2d6dc, steelHi: 0xeaedf1, steelTint: 0x6e7292,
    band: new THREE.Color(RIDE.color).getHex(), bandTint: 0x3f5a6a, pink: new THREE.Color(RIDE.pink).getHex(),
    stripes: [['band', [1.72, 2.0]], ['pink', [1.65, 1.70]]], topline: ['band', [3.22, 3.28]], beads: [1.22, 1.36, 1.50],
    lining: 0xeceae4, floor: 0x9c9ca8, seat: 0x3f5f9e, seatPri: 0xb4606e, seatBase: 0xb8bac4, pole: 0xd8dce4, strap: 0xf4f2ec,
  },
  jr: {
    id: 'jr', roof: 'round', cab: 'e233', skin: 'steel', panto: true,
    steel: 0xd9dce1, steelHi: 0xf0f2f4, steelTint: 0x6e7292,
    band: 0xf4771c, bandTint: 0x7a3a2a, front: 0xf0f1f2,
    stripes: [['band', [1.46, 2.0]]], topline: ['band', [3.3, 3.37]], beads: null,
    lining: 0xf3f2ef, floor: 0xb8b2a4, seat: 0x2c4c9c, seatPri: 0x8c6cbc, seatBase: 0xc8cad0, pole: 0xdadee6, strap: 0xecebe6,
  },
  poke: {
    id: 'poke', roof: 'round', cab: 'kiha', skin: 'art', panto: false, dmu: true,
    steel: 0xf5c832, steelHi: 0xffe66a, steelTint: 0xf0a83a,     // a golden yellow; its shade a warm orange-yellow
    glow: 0xffd24a,                                              // a little self-light, so the yellow stays yellow in the canopy's shadow (ambient alone turned it olive)
    band: 0x8a4a1c, bandTint: 0x4a2a1a, front: 0xf9d83b,
    stripes: [], topline: null, beads: null,
    lining: 0xf5efe2, floor: 0xf0c93a, seat: 0xf2c23c, seatPri: 0x8a4a1c, seatBase: 0x6b4a2c, pole: 0xdadee6, strap: 0xf9d83b,
  },
};

const MATS = new Map();
function mats(T) {
  if (MATS.has(T.id)) return MATS.get(T.id);
  const c = (color, tint = 0x6f6796, bands = 3) => cel({ color, bands, tint });
  const live = (color, tint = 0x6a6288, extra = {}) => {
    const m = cel({ color, bands: 3, tint, emissive: color, emissiveIntensity: 0, cache: false, ...extra });
    m.userData.live = true;
    return m;
  };
  const art = T.skin === 'art' ? pokeArtTex() : null;
  // the body colour: with `glow`, a little self-light (a saturated yellow goes olive on ambient alone)
  const glowing = (extra) => (T.glow ? { emissive: T.glow, emissiveIntensity: 0.2, cache: false, ...extra } : extra);
  const body = (color) => cel({ color, bands: 3, tint: T.steelTint, ...glowing({}) });
  const M = {
    steel: body(T.steel), steelHi: body(T.steelHi), band: c(T.band ?? 0x888888, T.bandTint), pink: c(T.pink ?? 0xffffff, 0x8a5a86),
    front: body(T.front ?? T.steel),
    rubber: c(PLAIN.rubber, 0x4b4560, 2), bellows: c(0x5e606c, 0x4b4560), roof: c(PLAIN.roof, 0x60597f), gear: c(PLAIN.gear, 0x5c5680), under: c(PLAIN.under, 0x4b4560, 2),
    bogie: c(PLAIN.bogie, 0x4b4560, 2), spring: c(PLAIN.spring, 0x5c5680), wheel: c(PLAIN.wheel, 0x4b4560, 2), insul: c(PLAIN.insul, 0x7a7090),
    yellow: c(PLAIN.yellow, 0x8a6a50), console: c(PLAIN.console, 0x4b4560, 2),
    // the interior: its own glow after dark (setNight), so it reads as lit
    lining: live(T.lining, 0x7a7090),
    floor: live(T.floor),
    seat: live(T.seat, 0x3f4a7a),
    seatPri: live(T.seatPri, 0x6a4a6a),
    seatBase: live(T.seatBase),
    pole: live(T.pole, 0x666090),
    strap: live(T.strap, 0x6f6796),
    door: art
      ? cel({ color: 0xffffff, bands: 3, tint: T.steelTint, map: art, cache: false, ...glowing({ emissiveMap: art }) })
      : cel({ color: 0xffffff, bands: 3, tint: T.steelTint, vertexColors: true, cache: false }),
    light: flat({ color: 0xfffbea }),
    glass: flat({ color: 0xa8c4e0, transparent: true, opacity: 0.2, depthWrite: false }),
    cabGlass: flat({ color: 0x2c3348 }),
    glint: flat({ color: 0xe4eef8, transparent: true, opacity: 0.16, depthWrite: false }),
    head: flat({ color: 0xfff6da }),
    tail: flat({ color: 0xff4a3a }),
    lampOff: flat({ color: 0x5a5660 }),
    tailOff: flat({ color: 0x6a2a2a }),
    lcd: flat({ color: 0xffffff, map: doorLcdTex() }),
    ads: flat({ color: 0xffffff, map: carAdsTex() }),
    runNo: flat({ color: 0xffffff, map: runNoTex() }),
    carNo: [flat({ color: 0xffffff, map: carNumberTex(0), transparent: true }), flat({ color: 0xffffff, map: carNumberTex(1), transparent: true })],
    priority: flat({ color: 0xffffff, map: prioritySticker() }),
    weak: flat({ color: 0xffffff, map: weakSticker() }),
  };
  if (art) {
    // the painted skin, and the lit version for the floor and ceiling inside
    M.art = cel({ color: 0xffffff, bands: 3, tint: T.steelTint, map: art, cache: false, ...glowing({ emissiveMap: art }) });
    M.artLit = live(0xffffff, 0x7a7090, { map: art, emissiveMap: art });
    M.floor = M.artLit;
  }
  M.interior = [M.lining, M.floor, M.seat, M.seatPri, M.seatBase, M.pole, M.strap, M.artLit].filter(Boolean);
  MATS.set(T.id, M);
  return M;
}

/** The side-wall intervals along x, each with its openings (door / window / solid). */
function wallCells() {
  const edges = new Set([-CAR_L / 2, CAR_L / 2]);
  for (const d of DOORS) { edges.add(d - DOOR_W / 2); edges.add(d + DOOR_W / 2); }
  for (const [c, w] of BAYS) { edges.add(c - w / 2); edges.add(c + w / 2); }
  const xs = [...edges].sort((a, b) => a - b);
  const cells = [];
  for (let i = 0; i + 1 < xs.length; i++) {
    const a = xs[i], b = xs[i + 1], m = (a + b) / 2;
    if (b - a < 1e-3) continue;
    const door = DOORS.some((d) => Math.abs(m - d) < DOOR_W / 2);
    const win = !door && BAYS.some(([c, w]) => Math.abs(m - c) < w / 2);
    cells.push({ a, b, kind: door ? 'door' : win ? 'window' : 'solid' });
  }
  return cells;
}

/** The long seats: [x0, x1] between the doors (and the cab wall / end wall). */
export function benchRuns(cab = 0) {
  const lo = cab < 0 ? -CAB_WALL + 0.1 : -CAR_L / 2 + 0.55;
  const hi = cab > 0 ? CAB_WALL - 0.1 : CAR_L / 2 - 0.55;
  const stops = [lo, ...DOORS.flatMap((d) => [d - DOOR_W / 2 - 0.12, d + DOOR_W / 2 + 0.12]), hi];
  const runs = [];
  for (let i = 0; i + 1 < stops.length; i += 2) if (stops[i + 1] - stops[i] > 0.8) runs.push([stops[i], stops[i + 1]]);
  return runs;
}

const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const IDENT = new THREE.Matrix4();
/** A geometry painted one colour (for the vertex-coloured door leaves). */
function painted(geo, hex) {
  const n = geo.attributes.position.count, col = new Float32Array(n * 3), c = new THREE.Color(hex);
  for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}
/** A plane showing cell `k` of `n` across a strip atlas (u only). */
function cellPlane(w, h, k, n) {
  const g = new THREE.PlaneGeometry(w, h);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setX(i, (k + uv.getX(i)) / n);
  return g;
}

/* ---- the art page: planar projections onto the Pokémon skin (tex.js POKE_ART) ---- */
const A = POKE_ART;
/** Bake `mx` into the geometry and set every uv from its position with `fn(x, y, z) -> [u, v]`. */
function mapped(geo, mx, fn) {
  geo.applyMatrix4(mx);
  const p = geo.attributes.position, n = p.count;
  const uv = geo.attributes.uv ?? geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2)).attributes.uv;
  for (let i = 0; i < n; i++) { const [u, v] = fn(p.getX(i), p.getY(i), p.getZ(i)); uv.setXY(i, u, v); }
  uv.needsUpdate = true;
  return { geometry: geo, matrix: IDENT };
}
/** The car's side art: row `row`, seen unmirrored from either side (`sz` the side's sign). */
const sideUV = (row, sz) => (x, y) => {
  const u = (x + CAR_L / 2) / CAR_L;
  const v = 1 - (row * A.rowH + (A.y1 - THREE.MathUtils.clamp(y, A.y0, A.y1)) / (A.y1 - A.y0) * A.rowH) / A.h;
  return [sz < 0 ? 1 - u : u, v];
};
/** A region of the page across (a0..a1) -> u and (b0..b1) -> v. */
const regionUV = (R, a0, a1, b0, b1, pick) => (x, y, z) => {
  const [a, b] = pick(x, y, z);
  const u = (R.x + THREE.MathUtils.clamp((a - a0) / (a1 - a0), 0, 1) * R.w) / A.w;
  const v = 1 - (R.y + (1 - THREE.MathUtils.clamp((b - b0) / (b1 - b0), 0, 1)) * R.h) / A.h;
  return [u, v];
};
/** One flat colour of the swatch strip. */
const swatchUV = (k) => () => [((k + 0.5) * A.swatch.w) / A.w, 1 - (A.swatch.y + A.swatch.h / 2) / A.h];
const SW = { skin: 0, brown: 1, rubber: 2, hi: 3, caution: 4, dark: 5, white: 6, red: 7 };

/**
 * A profile [(z, y), ...] across the car, run from x0 to x1 with flat
 * faces, and capped at both ends: the rounded roof.
 */
function profileRun(prof, x0, x1) {
  const pos = [], nrm = [];
  const tri = (a, b, c, n) => { pos.push(...a, ...b, ...c); nrm.push(...n, ...n, ...n); };
  for (let i = 0; i + 1 < prof.length; i++) {
    const [z0, y0] = prof[i], [z1, y1] = prof[i + 1];
    const dz = z1 - z0, dy = y1 - y0, l = Math.hypot(dz, dy) || 1;
    const n = [0, dz / l, -dy / l];
    tri([x0, y0, z0], [x1, y0, z0], [x1, y1, z1], n);
    tri([x0, y0, z0], [x1, y1, z1], [x0, y1, z1], n);
  }
  // the caps: a fan from the middle of the base line
  const base = [(prof[0][0] + prof[prof.length - 1][0]) / 2, (prof[0][1] + prof[prof.length - 1][1]) / 2];
  for (const [x, s] of [[x0, -1], [x1, 1]]) {
    for (let i = 0; i + 1 < prof.length; i++) {
      const a = [x, base[1], base[0]], b = [x, prof[i][1], prof[i][0]], c = [x, prof[i + 1][1], prof[i + 1][0]];
      if (s > 0) tri(a, b, c, [1, 0, 0]); else tri(a, c, b, [-1, 0, 0]);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((pos.length / 3) * 2), 2));
  return g;
}
/** The rounded roof's profile: a quarter round each side, flat between. */
function roundRoof() {
  const R = SHOULDER, y0 = TOP - 0.14, z0 = CAR_W / 2 - R;
  // from the eaves strip's top (EAVES), not the curve's own foot: its first 4 cm rose within 2 mm of the skin's face
  const a0 = Math.asin((EAVES - y0) / R);
  const prof = [];
  for (let k = 0; k <= 7; k++) { const a = a0 + (k / 7) * (Math.PI / 2 - a0); prof.push([-z0 - R * Math.cos(a), y0 + R * Math.sin(a)]); }
  for (let k = 7; k >= 0; k--) { const a = a0 + (k / 7) * (Math.PI / 2 - a0); prof.push([z0 + R * Math.cos(a), y0 + R * Math.sin(a)]); }
  return prof;
}
/**
 * A rounded plate standing across the car (z, y), bulging forward: an
 * extruded rounded rectangle with a bevelled edge.  `s` the end it faces.
 */
function plate(z0, z1, y0, y1, { rTop = 0.12, rBot = 0.12, bevel = 0.08, depth = 0.02 } = {}, s = 1) {
  const sh = new THREE.Shape();
  const a0 = -z1 + bevel, a1 = -z0 - bevel, b0 = y0 + bevel, b1 = y1 - bevel;   // shrunk by the bevel, which grows it back
  sh.moveTo(a0 + rBot, b0);
  sh.lineTo(a1 - rBot, b0); sh.quadraticCurveTo(a1, b0, a1, b0 + rBot);
  sh.lineTo(a1, b1 - rTop); sh.quadraticCurveTo(a1, b1, a1 - rTop, b1);
  sh.lineTo(a0 + rTop, b1); sh.quadraticCurveTo(a0, b1, a0, b1 - rTop);
  sh.lineTo(a0, b0 + rBot); sh.quadraticCurveTo(a0, b0, a0 + rBot, b0);
  const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: true, bevelThickness: bevel * 1.1, bevelSize: bevel, bevelSegments: 3, curveSegments: 6 });
  g.rotateY(s > 0 ? Math.PI / 2 : -Math.PI / 2);      // the shape's +z (its face) toward the end
  return g;
}

function buildCar(T, { cab, tail, index, dests, straps, xOff }) {
  const m = mats(T);
  const car = new THREE.Group();
  const P = {};
  const push = (k, geo, mx) => (P[k] ??= []).push({ geometry: geo, matrix: mx });
  /** A box from its extents. */
  const B = (k, x0, x1, y0, y1, z0, z1, rx = 0, ry = 0, rz = 0) =>
    push(k, box(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0)), trs((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, rx, ry, rz));
  const cabEnd = cab ? 1 : tail ? -1 : 0;
  const face = (sz) => (sz > 0 ? 0 : Math.PI);            // a plane on the side wall facing out
  const art = T.skin === 'art';
  const round = T.roof === 'round';
  /** The outer skin: plain steel, or the painted side. */
  const skin = (geo, mx, sz) => (art ? push('art', ...Object.values(mapped(geo, mx, sideUV(index % 2, sz)))) : push('steel', geo, mx));
  const skinTop = TOP - 0.12;
  /* One surface owns each face (QA: z-fighting).  The car's end planes (x = +-CAR_L/2) are shared out: the side
   * skins own the corners (the outer 6 cm), the end skin or the cab the middle, the roof everything over END_TOP,
   * the underframe's rim everything under FLOOR.  The linings stop END_IN short, behind the end's own wall. */
  const END_TOP = round ? EAVES : skinTop;                // where the roof's end cap begins
  const END_IN = 0.08;                                    // the end wall's thickness

  /* ================================ the shell ================================ */
  // floor, and the underframe's edge under the skin
  if (art) push('floor', ...Object.values(mapped(box(CAR_L - 0.12, 0.1, CAR_W - 0.12), trs(0, FLOOR - 0.05, 0),
    regionUV(A.floor, -CAR_L / 2, CAR_L / 2, -CAR_W / 2, CAR_W / 2, (x, y, z) => [x, z]))));
  else B('floor', -CAR_L / 2 + 0.06, CAR_L / 2 - 0.06, FLOOR - 0.1, FLOOR, -CAR_W / 2 + 0.06, CAR_W / 2 - 0.06);
  /* The underframe's skin: a slab under the floor and a rim round it, never a face at the floor's own height
   * inside the car.  (It was one slab up to FLOOR, its top coplanar with the floor's: the two z-fought, and
   * every floor showed stair-step streaks of the skin through it, worst on the painted set; Tan, QA.) */
  const FE = 0.06;                                        // the rim: the floor stops this short of the skin
  for (const sz of [1, -1]) {
    skin(box(CAR_L, 0.1, CAR_W / 2), trs(0, FLOOR - 0.15, sz * CAR_W / 4), sz);
    skin(box(CAR_L, 0.1, FE), trs(0, FLOOR - 0.05, sz * (CAR_W / 2 - FE / 2)), sz);
    skin(box(FE, 0.1, CAR_W - 2 * FE), trs(sz * (CAR_L / 2 - FE / 2), FLOOR - 0.05, 0), sz);
  }
  B('under', -BOGIE_X + 1.6, BOGIE_X - 1.6, FLOOR - 0.3, FLOOR - 0.2, -CAR_W / 2 + 0.25, CAR_W / 2 - 0.25);
  if (round) {
    // the roof: a quarter round each side, flat between (its ends cap the cab and the end wall).  It starts at the
    // eaves strip's top (EAVES): below that the skin owns the side, and the curve never lies in the skin's face
    const g = profileRun(roundRoof(), -CAR_L / 2, CAR_L / 2);
    push('roof', g, IDENT.clone());
    // the eaves strip where the skin meets the curve: on top of the skin, not through it
    for (const sz of [1, -1]) skin(box(CAR_L, EAVES - skinTop, 0.06), trs(0, (skinTop + EAVES) / 2, sz * (CAR_W / 2 - 0.03)), sz);
  } else {
    // the roof: three shallow steps make its curve; gutters; the cornice
    B('steel', -CAR_L / 2, CAR_L / 2, TOP - 0.12, TOP, -CAR_W / 2, CAR_W / 2);
    B('roof', -CAR_L / 2 + 0.02, CAR_L / 2 - 0.02, TOP, TOP + 0.1, -CAR_W / 2 + 0.06, CAR_W / 2 - 0.06);
    B('roof', -CAR_L / 2 + 0.05, CAR_L / 2 - 0.05, TOP + 0.1, TOP + 0.17, -CAR_W / 2 + 0.3, CAR_W / 2 - 0.3);
    B('roof', -CAR_L / 2 + 0.08, CAR_L / 2 - 0.08, TOP + 0.17, ROOF, -CAR_W / 2 + 0.7, CAR_W / 2 - 0.7);
    for (const s of [-1, 1]) B('rubber', -CAR_L / 2 + 0.01, CAR_L / 2 - 0.01, TOP - 0.02, TOP + 0.04, s * (CAR_W / 2 - 0.02) - 0.03, s * (CAR_W / 2 - 0.02) + 0.03);   // (short of the ends: its cap is not in the end's face)
  }
  // the ceiling, its central duct, the two light strips
  if (art) {
    push('artLit', ...Object.values(mapped(new THREE.PlaneGeometry(CAR_L - 0.2, CAR_W - 0.2), trs(0, TOP - 0.16, 0, Math.PI / 2, 0, 0),
      regionUV(A.ceiling, -CAR_L / 2, CAR_L / 2, -CAR_W / 2, CAR_W / 2, (x, y, z) => [x, z]))));
    B('lining', -CAR_L / 2 + 0.1, CAR_L / 2 - 0.1, TOP - 0.155, TOP - 0.12, -CAR_W / 2 + 0.1, CAR_W / 2 - 0.1);
  } else {
    B('lining', -CAR_L / 2 + 0.1, CAR_L / 2 - 0.1, TOP - 0.16, TOP - 0.12, -CAR_W / 2 + 0.1, CAR_W / 2 - 0.1);
  }
  B('lining', -CAR_L / 2 + 0.4, CAR_L / 2 - 0.4, TOP - 0.28, TOP - 0.16, -0.36, 0.36);
  const lights = [];
  for (const z of [-0.52, 0.52]) lights.push({ geometry: box(CAR_L - 1.4, 0.03, 0.16), matrix: trs(0, TOP - 0.19, z) });

  /* ---- the side walls between the openings: skin, lining, livery ---- */
  const cells = wallCells();
  for (const sz of [1, -1]) {
    const zSkin = sz * (CAR_W / 2 - 0.03), zLine = sz * (CAR_W / 2 - 0.1), zOut = sz * (CAR_W / 2 + 0.004);
    const zOn = sz * (CAR_W / 2 + 0.005);      // paint 1 cm thick lying on the skin (not 2 mm into it: its end caps lay in the skin's at the car's ends)
    const zSeam = sz * (CAR_W / 2 + 0.006);    // a panel seam, 2 mm proud of the paint it crosses (level with the beads, it fought them)
    for (const c of cells) {
      const len = c.b - c.a, cx = (c.a + c.b) / 2;
      const spans = c.kind === 'door' ? [[DOOR_TOP, skinTop]]
        : c.kind === 'window' ? [[FLOOR, WIN_Y0], [WIN_Y1, skinTop]]
          : [[FLOOR, skinTop]];
      for (const [y0, y1] of spans) {
        skin(box(len, y1 - y0, 0.06), trs(cx, (y0 + y1) / 2, zSkin), sz);
        // (the lining ends behind the end wall: its cap lay in the car's end face, cream through the skin)
        const la = Math.max(c.a, -CAR_L / 2 + END_IN), lb = Math.min(c.b, CAR_L / 2 - END_IN);
        push('lining', box(lb - la, y1 - y0, 0.04), trs((la + lb) / 2, (y0 + y1) / 2, zLine));
      }
      // the band, the pinstripe, the line over the windows, the beads
      if (c.kind !== 'door') {
        for (const [k, [y0, y1]] of T.stripes) push(k, box(len, y1 - y0, 0.01), trs(cx, (y0 + y1) / 2, zOn));
        for (const y of T.beads ?? []) push('steelHi', box(len, 0.018, 0.009), trs(cx, y, sz * (CAR_W / 2 + 0.0045)));
      }
      if (T.topline) push(T.topline[0], box(len, T.topline[1][1] - T.topline[1][0], 0.01), trs(cx, (T.topline[1][0] + T.topline[1][1]) / 2, zOn));
      if (c.kind === 'window') {
        // black rubber round the glass, and the centre mullion of a wide bay
        for (const y of [WIN_Y0, WIN_Y1]) push('rubber', box(len, 0.05, 0.1), trs(cx, y, zSkin));
        for (const x of [c.a, c.b]) push('rubber', box(0.05, WIN_Y1 - WIN_Y0, 0.1), trs(x, (WIN_Y0 + WIN_Y1) / 2, zSkin));
        if (len > 2) push('rubber', box(0.06, WIN_Y1 - WIN_Y0, 0.08), trs(cx, (WIN_Y0 + WIN_Y1) / 2, zSkin));
        push('glass', new THREE.PlaneGeometry(len, WIN_Y1 - WIN_Y0), trs(cx, (WIN_Y0 + WIN_Y1) / 2, zSkin, 0, face(sz), 0));
        push('glint', new THREE.PlaneGeometry(len * 0.16, (WIN_Y1 - WIN_Y0) * 0.9), trs(cx - len * 0.22, (WIN_Y0 + WIN_Y1) / 2, zSkin + sz * 0.035, 0, face(sz), 0.22));
      }
    }
    // the door openings: rubber at the jambs and the head, a sill; seams beside them
    for (const d of DOORS) {
      for (const e of [-1, 1]) {
        push('rubber', box(0.035, DOOR_TOP - FLOOR, 0.1), trs(d + e * DOOR_W / 2, (FLOOR + DOOR_TOP) / 2, zSkin));
        // the pocket's panel seam, only where it falls on solid skin (next to a window bay it cut through the glass)
        const sxm = d + e * (DOOR_W / 2 + 0.3);
        if (!art && cells.find((c) => sxm > c.a && sxm < c.b)?.kind === 'solid') push('rubber', box(0.012, TOP - 0.2 - FLOOR + 0.18, 0.012), trs(sxm, (FLOOR - 0.18 + TOP - 0.2) / 2, zSeam));
      }
      push('rubber', box(DOOR_W + 0.07, 0.04, 0.1), trs(d, DOOR_TOP, zSkin));
      push('steelHi', box(DOOR_W, 0.04, 0.21), trs(d, FLOOR + 0.02, sz * (CAR_W / 2 - 0.075)));      // the sill, 1 cm proud of the jambs' rubber (its nose lay in their faces)
      // inside: the yellow line at the door's edge
      push('yellow', box(DOOR_W - 0.1, 0.006, 0.08), trs(d, FLOOR + 0.004, sz * (CAR_W / 2 - 0.26)));
    }
    // panel seams at the car's corners, and the car's number on the end panel
    // (below the window, past the last door's pocket: nothing sits where a leaf slides)
    if (!art) for (const e of [-1, 1]) push('rubber', box(0.014, TOP - FLOOR + 0.15, 0.012), trs(e * (CAR_L / 2 - 0.2), (FLOOR - 0.15 + TOP) / 2, zSeam));
    // (the painted car: at the top of the band, above the end panel's figure)
    push('carNo', new THREE.PlaneGeometry(0.62, 0.12), trs(cabEnd ? -cabEnd * NUMBER_X : NUMBER_X, art ? 1.95 : 1.58, zOut + sz * 0.008, 0, face(sz), 0));      // (2 mm proud of the band: on the JR car it sat 2 mm behind it, unseen)
    // the side destination LED, over the window by door 2
    dests.push({ geometry: new THREE.PlaneGeometry(0.66, 0.165), matrix: trs(xOff - 4.7, 3.44, zOut + sz * 0.006, 0, face(sz), 0) });
    push('rubber', box(0.74, 0.22, 0.02), trs(-4.7, 3.44, zOut));
    // the second car is the 弱冷房車: its sticker on the end window's glass, by the last door
    if (index % 2 && !art) push('weak', new THREE.PlaneGeometry(0.3, 0.1), trs(-cabEnd * 8.2, WIN_Y1 - 0.12, zSkin + sz * 0.004, 0, face(sz), 0));
  }
  // the crew doors on a cab's sides (outlines, a handhold)
  if (cabEnd) {
    for (const sz of [1, -1]) {
      const zOut = sz * (CAR_W / 2 + 0.008);      // (3 mm proud of the band the door's outline crosses)
      for (const x of [7.62, 9.42]) push('rubber', box(0.025, 2.3, 0.01), trs(cabEnd * x, FLOOR + 1.12, zOut));
      push('rubber', box(1.8, 0.025, 0.01), trs(cabEnd * 8.52, FLOOR + 2.27, zOut));
      push('steelHi', box(0.03, 0.5, 0.04), trs(cabEnd * 9.55, FLOOR + 0.95, zOut + sz * 0.02));
    }
  }

  /* ---- the door leaves: two per door, sliding into the pocket ----
   * Only the platform side (local -z) ever opens, and on it every left leaf
   * slides the same way, as does every right one: so a car has two sliding
   * groups, each one mesh and its glass.  The far side's leaves are plain
   * parts of the body.  Plain types paint the leaf's parts by vertex
   * colour; the painted skin maps them onto the art page (the art rides
   * with the leaf). */
  const leaves = { 1: [], [-1]: [] };
  const lw = DOOR_W / 2;
  const HEX = { skin: T.steel, hi: T.steelHi, rubber: PLAIN.rubber, caution: PLAIN.yellow, band: T.band, pink: T.pink };
  const leafParts = (x, half, z, sz) => {
    const out = [];
    const add = (key, x0, x1, y0, y1, dz = 0, t = 0.018) => {
      const g = box(x1 - x0, y1 - y0, t), mx = trs((x0 + x1) / 2, (y0 + y1) / 2, z + sz * dz);
      if (art) out.push(mapped(g, mx, key === 'skin' ? sideUV(index % 2, sz) : swatchUV(SW[key] ?? SW.rubber)));
      else out.push({ geometry: painted(g, HEX[key]), matrix: mx });
    };
    const a = x - lw / 2, b = x + lw / 2;
    const wi0 = a + (half > 0 ? 0.1 : 0.14), wi1 = b - (half > 0 ? 0.14 : 0.1);
    add('skin', a, b, FLOOR, DWIN[0]);
    add('skin', a, b, DWIN[1], DOOR_TOP);
    add('skin', a, wi0, DWIN[0], DWIN[1]);
    add('skin', wi1, b, DWIN[0], DWIN[1]);
    for (const [k, [y0, y1]] of T.stripes) add(k, a, b, y0, y1, 0.012, 0.008);
    for (const y of T.beads ?? []) add('hi', a, b, y - 0.009, y + 0.009, 0.012, 0.006);
    // the rubber: the meeting edge, and round the window
    const meet = half > 0 ? a : b;
    add('rubber', meet - 0.018, meet + 0.018, FLOOR, DOOR_TOP, 0.004, 0.03);
    // the door-caution sticker on the glass, low by the meeting edge: it rides with the leaf
    const sx = half > 0 ? wi0 + 0.03 : wi1 - 0.03;
    add('caution', Math.min(sx, sx + half * 0.17), Math.max(sx, sx + half * 0.17), DWIN[0] + 0.04, DWIN[0] + 0.11, 0.012, 0.004);
    add('rubber', wi0 - 0.02, wi1 + 0.02, DWIN[0] - 0.02, DWIN[0] + 0.01, 0.01, 0.01);
    add('rubber', wi0 - 0.02, wi1 + 0.02, DWIN[1] - 0.01, DWIN[1] + 0.02, 0.01, 0.01);
    add('rubber', wi0 - 0.02, wi0 + 0.01, DWIN[0], DWIN[1], 0.01, 0.01);
    add('rubber', wi1 - 0.01, wi1 + 0.02, DWIN[0], DWIN[1], 0.01, 0.01);
    const pane = { geometry: new THREE.PlaneGeometry(wi1 - wi0, DWIN[1] - DWIN[0]), matrix: trs((wi0 + wi1) / 2, (DWIN[0] + DWIN[1]) / 2, z, 0, face(sz), 0) };
    return { out, pane };
  };
  for (const sz of [1, -1]) {
    const z = sz * (CAR_W / 2 - 0.07);
    for (const half of [-1, 1]) {
      const body = [], glass = [];
      for (const d of DOORS) {
        const { out, pane } = leafParts(d + half * (lw / 2), half, z, sz);
        body.push(...out); glass.push(pane);
      }
      if (sz < 0) {
        const grp = new THREE.Group();
        const mb = new THREE.Mesh(bake(body), m.door);
        mb.castShadow = mb.receiveShadow = true;      // shaded like the body round it (unshadowed, a shut leaf read cream on a lavender car)
        const mg = new THREE.Mesh(bake(glass), m.glass);
        mg.userData.noOutline = true;
        grp.add(mb, mg);
        grp.userData.half = half;
        grp.userData.dynamic = true;       // it slides: never batched
        car.add(grp);
        leaves[sz].push(grp);
      } else {
        (P.doorStatic ??= []).push(...body);
        (P.glass ??= []).push(...glass);
      }
    }
  }

  /* ================================ the interior ================================ */
  const runs = benchRuns(cabEnd);
  for (const sz of [1, -1]) {
    const zw = sz * (CAR_W / 2 - 0.08);
    runs.forEach(([a, b], i) => {
      const len = b - a, cx = (a + b) / 2;
      const pri = cabEnd ? (i === (cabEnd > 0 ? runs.length - 1 : 0)) : (i === 0 || i === runs.length - 1);
      const seat = pri ? 'seatPri' : 'seat';
      // the base, the cushion, the back (the Pokémon car: yellow cushions, brown backs)
      push('seatBase', box(len, 0.3, SEAT_D - 0.08), trs(cx, FLOOR + 0.15, zw - sz * (SEAT_D / 2 + 0.02)));
      push(seat, box(len, 0.12, SEAT_D), trs(cx, SEAT_TOP - 0.06, zw - sz * SEAT_D / 2));
      push(art && !pri ? 'seatPri' : seat, box(len, 0.5, 0.1), trs(cx, SEAT_TOP + 0.3, zw - sz * 0.07, sz * 0.1, 0, 0));
      // seat dividers: a seam every 0.46 m
      for (let x = a + 0.46; x < b - 0.2; x += 0.46) push('seatBase', box(0.02, 0.02, SEAT_D - 0.04), trs(x, SEAT_TOP + 0.005, zw - sz * SEAT_D / 2));
      // the luggage rack and its brackets
      push('pole', box(len - 0.1, 0.025, 0.3), trs(cx, FLOOR + 1.74, zw - sz * 0.18));
      for (const x of [a + 0.1, b - 0.1]) push('pole', box(0.03, 0.2, 0.3), trs(x, FLOOR + 1.84, zw - sz * 0.18));
      // the tall partitions at the door ends (袖仕切り), each with its pole
      for (const [x, e] of [[a, -1], [b, 1]]) {
        const nearDoor = DOORS.some((d) => Math.abs(x - (d - e * (DOOR_W / 2 + 0.12))) < 0.02);
        if (!nearDoor) continue;
        push('lining', box(0.04, 1.62, SEAT_D + 0.04), trs(x + e * 0.02, FLOOR + 0.86, zw - sz * (SEAT_D / 2 + 0.02)));
        // the JR car's partitions are glazed above the seat back
        if (T.cab === 'e233') push('glass', new THREE.PlaneGeometry(SEAT_D + 0.2, 0.55), trs(x + e * 0.02, FLOOR + 1.4, zw - sz * (SEAT_D / 2 + 0.02), 0, Math.PI / 2, 0));
        push('pole', new THREE.CylinderGeometry(0.018, 0.018, TOP - 0.2 - FLOOR, 6), trs(x + e * 0.02, (FLOOR + TOP - 0.2) / 2, zw - sz * (SEAT_D + 0.06)));
      }
      // a pole through the middle of a seven-seat run (3 + 4)
      if (len > 2.6) push('pole', new THREE.CylinderGeometry(0.018, 0.018, TOP - 0.2 - SEAT_TOP, 6), trs(a + 0.46 * 3 + 0.02, (SEAT_TOP + TOP - 0.2) / 2, zw - sz * (SEAT_D - 0.04)));
      // the strap rail over the seat front, and its straps
      for (let x = a + 0.2; x < b - 0.1; x += 0.3) straps.push({ x: xOff + x, z: sz * (CAR_W / 2 - 0.62), ph: (x * 1.7 + sz) % 6.28 });
      // priority seats: the stickers on the window over them
      if (pri) {
        const win = BAYS.find(([c]) => Math.abs(c - cx) < 1.2);
        if (win) push('priority', new THREE.PlaneGeometry(0.24, 0.12), trs(win[0], WIN_Y0 + 0.14, sz * (CAR_W / 2 - 0.035), 0, face(-sz), 0));
      }
    });
    push('pole', box(CAR_L - (cabEnd ? 2.6 : 1.4), 0.03, 0.03), trs(-cabEnd * 0.6, RAIL_Y, sz * (CAR_W / 2 - 0.62)));
    // door poles, and the LCD pair over each door
    for (const d of DOORS) {
      push('rubber', box(DOOR_W + 0.3, 0.3, 0.06), trs(d, DOOR_TOP + 0.2, sz * (CAR_W / 2 - 0.15)));
      push('lcd', new THREE.PlaneGeometry(1.06, 0.3), trs(d, DOOR_TOP + 0.2, sz * (CAR_W / 2 - 0.185), 0, face(-sz), 0));
    }
    // the cards over the windows
    BAYS.forEach(([c, w], i) => {
      if (w < 2) return;
      for (const k of [-1, 1]) push('ads', cellPlane(0.62, 0.2, (i * 2 + (k > 0 ? 1 : 0) + index * 3 + (sz > 0 ? 4 : 0)) % CAR_AD_CELLS, CAR_AD_CELLS),
        trs(c + k * w * 0.24, WIN_Y1 + 0.2, sz * (CAR_W / 2 - 0.125), 0, face(-sz), 0));
    });
  }
  // the hanging ads (中吊り) down the aisle, each two-sided, on a rail
  push('pole', box(CAR_L - 3, 0.02, 0.02), trs(-cabEnd * 0.8, TOP - 0.3, 0));
  runs.forEach(([a, b], i) => {
    if (b - a < 2.5) return;
    const cx = (a + b) / 2;
    for (const [k, ry] of [[(i + index * 2) % CAR_AD_CELLS, Math.PI / 2], [(i + 5 + index) % CAR_AD_CELLS, -Math.PI / 2]]) {
      push('ads', cellPlane(0.54, 0.36, k, CAR_AD_CELLS), trs(cx + (ry > 0 ? 0.004 : -0.004), TOP - 0.52, 0, 0, ry, 0));
    }
    push('pole', box(0.02, 0.02, 0.56), trs(cx, TOP - 0.33, 0));
  });
  // door-side grab poles
  for (const sz of [1, -1]) for (const d of DOORS) for (const e of [-1, 1]) {
    push('pole', new THREE.CylinderGeometry(0.02, 0.02, TOP - 0.2 - FLOOR, 6), trs(d + e * (DOOR_W / 2 + 0.07), (FLOOR + TOP - 0.2) / 2, sz * (CAR_W / 2 - 0.2)));
  }

  /* ---- the ends: a cab, or the end wall with its gangway ---- */
  const endSkin = (x0, x1, y0, y1, z0, z1) => (art
    ? push('art', ...Object.values(mapped(box(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0)), trs((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), swatchUV(SW.skin))))
    : B('steel', x0, x1, y0, y1, z0, z1));
  for (const s of [-1, 1]) {
    if (s === cabEnd) continue;
    const x = s * (CAR_L / 2 - 0.04), xi = s * (CAR_L / 2 - 0.1);
    const GW = 0.45, GH = FLOOR + 1.95;
    /* The end wall, between the side skins and from the floor's rim to the roof's cap: it was the car's full
     * width and height, so its faces lay in the side skins', the rim's, the roof cap's and the side linings'
     * (two paints in one plane: the flicker between the cars; Tan, QA). */
    const zs = CAR_W / 2 - 0.06;                             // the side skin's inner face
    for (const e of [-1, 1]) {
      endSkin(x - 0.04, x + 0.04, FLOOR, END_TOP, e * GW, e * zs);
      B('lining', xi - 0.02, xi + 0.02, FLOOR, TOP - 0.12, e * GW, e * (CAR_W / 2 - 0.1));
    }
    endSkin(x - 0.04, x + 0.04, GH, END_TOP, -GW, GW);
    B('lining', xi - 0.02, xi + 0.02, GH, TOP - 0.12, -GW, GW);
    // the gangway's rubber jambs stand 12 mm into the opening, over the wall's cut edges (they lay flush in them)
    B('rubber', xi - 0.03, xi + 0.03, FLOOR, GH, -GW - 0.03, -GW + 0.012);
    B('rubber', xi - 0.03, xi + 0.03, FLOOR, GH, GW - 0.012, GW + 0.03);
    // the bellows to the next car (from this car's -x end only, so once): from end face to end face, into neither
    if (s < 0) {
      const g0 = -CAR_L / 2 - (PITCH - CAR_L), g1 = -CAR_L / 2;
      for (const e of [-1, 1]) B('bellows', g0, g1, FLOOR - 0.08, GH, e * (GW + 0.02), e * (GW + 0.14));
      B('bellows', g0, g1, GH, GH + 0.12, -GW - 0.14, GW + 0.14);
      B('steelHi', g0, g1, FLOOR - 0.04, FLOOR, -GW, GW);     // the plate abuts both cars' floor rims: nothing coplanar with it
      for (let k = 1; k < 5; k++) {
        const gx = g0 + ((g1 - g0) * k) / 5;
        for (const e of [-1, 1]) B('rubber', gx - 0.01, gx + 0.01, FLOOR - 0.06, GH + 0.1, e * (GW + 0.14), e * (GW + 0.15));
      }
      // the coupler under it
      B('under', g0 - 0.1, g1 + 0.1, 0.78, 0.98, -0.15, 0.15);
    }
  }

  /* ---- the cab ---- */
  let lamps = null;
  if (cabEnd) {
    const s = cabEnd, fx = s * (CAR_L / 2);
    const ry = s > 0 ? Math.PI / 2 : -Math.PI / 2;
    lamps = [];
    // behind a rounded cab's mask, between the side skins and under the roof's cap: the body's end (the side
    // linings used to run out to here and show in the corners)
    if (round) endSkin(fx - s * END_IN, fx, 2.0, END_TOP, -CAR_W / 2 + 0.06, CAR_W / 2 - 0.06);
    const lamp = (kind, r, y, z, x) => {
      lamps.push({ kind, geometry: new THREE.CircleGeometry(r, 16), matrix: trs(x, y, z, 0, ry, 0) });
      push('steelHi', new THREE.RingGeometry(r, r + 0.022, 16), trs(x - s * 0.001, y, z, 0, ry, 0));
    };
    if (T.cab === 'box') {
      // the silver end below the mask, the band and pinstripe wrapping round
      B('steel', fx - s * 0.08, fx, FLOOR, 2.0, -CAR_W / 2 + 0.06, CAR_W / 2 - 0.06);     // between the side skins, on the floor's rim
      B('band', fx - s * 0.02, fx + s * 0.012, 1.72, 2.0, -CAR_W / 2 - 0.004, CAR_W / 2 + 0.004);
      B('pink', fx - s * 0.02, fx + s * 0.012, 1.66, 1.72, -CAR_W / 2 - 0.004, CAR_W / 2 + 0.004);
      for (const y of T.beads) B('steelHi', fx, fx + s * 0.01, y - 0.009, y + 0.009, -CAR_W / 2 + 0.1, CAR_W / 2 - 0.1);
      // the emergency door in the middle of the front: its seams down the silver, a handle
      for (const e of [-1, 1]) B('rubber', fx + s * 0.005, fx + s * 0.022, FLOOR, 2.0, e * 0.5 - 0.008, e * 0.5 + 0.008);     // (1 cm proud of the band: 3 mm fought from the crossing)
      B('rubber', fx + s * 0.012, fx + s * 0.03, 1.1, 1.18, 0.3, 0.42);
      // the black mask with the silver pillars at its corners, a rain gutter over the glass
      B('rubber', fx - s * 0.08, fx + s * 0.02, 2.0, TOP, -CAR_W / 2 + 0.1, CAR_W / 2 - 0.1);
      for (const e of [-1, 1]) B('steel', fx - s * 0.08, fx + s * 0.03, 2.0, TOP, e * (CAR_W / 2 - 0.1), e * CAR_W / 2);
      B('steelHi', fx + s * 0.02, fx + s * 0.05, TOP - 0.06, TOP - 0.02, -CAR_W / 2 + 0.12, CAR_W / 2 - 0.12);
      // the windscreen, two big panes, a glint on each
      for (const [z0, z1] of [[-1.24, -0.05], [0.05, 1.24]]) {
        push('cabGlass', new THREE.PlaneGeometry(z1 - z0, 0.98), trs(fx + s * 0.03, 2.82, (z0 + z1) / 2, 0, ry, 0));
        push('glint', new THREE.PlaneGeometry(0.22, 0.9), trs(fx + s * 0.04, 2.82, z0 + (z1 - z0) * 0.3, 0, ry, 0.26));
        // a wiper, parked
        push('rubber', box(0.02, 0.62, 0.03), trs(fx + s * 0.05, 2.52, z0 + 0.2, s * 1.25, 0, 0));
      }
      // the destination LED and the run number, lit, in the mask
      dests.push({ geometry: new THREE.PlaneGeometry(1.36, 0.34), matrix: trs(xOff + fx + s * 0.03, 3.5, 0, 0, ry, 0) });
      push('runNo', new THREE.PlaneGeometry(0.36, 0.135), trs(fx + s * 0.03, 3.5, s > 0 ? -0.98 : 0.98, 0, ry, 0));
      // head and tail lights in their housings, low on the corners
      for (const e of [-1, 1]) {
        B('rubber', fx - s * 0.02, fx + s * 0.06, 1.26, 1.6, e * 0.72, e * 1.3);
        lamp('head', 0.1, 1.43, e * 1.14, fx + s * 0.065);
        lamp('tail', 0.075, 1.43, e * 0.86, fx + s * 0.065);
      }
    } else if (T.cab === 'e233') {
      /* The E233 face: a white FRP nose with the orange band across it, the
       * black glazed mask over it bulging forward with rounded top corners,
       * the head and tail lights high in the mask's corners, the LED
       * destination over the middle pane, the emergency door's pane between
       * the two big ones. */
      const noseD = 0.09, maskD = 0.11;
      push('front', plate(-CAR_W / 2 + 0.05, CAR_W / 2 - 0.05, FLOOR - 0.2, 2.1, { rTop: 0.05, rBot: 0.16, bevel: noseD - 0.02 }, s), trs(fx - s * 0.03, 0, 0));
      const nf = fx + s * (noseD + 0.008);          // the nose's face
      push('band', new THREE.PlaneGeometry(CAR_W - 0.36, 0.5), trs(nf, 1.75, 0, 0, ry, 0));
      for (const e of [-1, 1]) push('rubber', new THREE.PlaneGeometry(0.012, 1.15), trs(nf + s * 0.01, 1.5, e * 0.44, 0, ry, 0));   // the door's seams (1 cm off the band: 2 mm fought from the crossing)
      push('rubber', new THREE.PlaneGeometry(0.1, 0.05), trs(nf + s * 0.01, 1.28, 0.34, 0, ry, 0));
      push('rubber', plate(-CAR_W / 2 + 0.07, CAR_W / 2 - 0.07, 2.1, TOP + 0.08, { rTop: 0.42, rBot: 0.06, bevel: maskD - 0.03 }, s), trs(fx - s * 0.03, 0, 0));
      const mf = fx + s * (maskD + 0.006);          // the mask's face
      // the windscreen: two big panes and the door's narrow one, a glint on each big one
      for (const [z0, z1] of [[-1.22, -0.3], [-0.2, 0.2], [0.3, 1.22]]) {
        push('cabGlass', new THREE.PlaneGeometry(z1 - z0, 1.0), trs(mf, 2.78, (z0 + z1) / 2, 0, ry, 0));
        if (z1 - z0 > 0.5) {
          push('glint', new THREE.PlaneGeometry(0.2, 0.92), trs(mf + s * 0.01, 2.78, z0 + (z1 - z0) * 0.3, 0, ry, 0.26));
          push('rubber', box(0.02, 0.64, 0.03), trs(mf + s * 0.026, 2.48, z0 + 0.18, s * 1.25, 0, 0));    // a wiper
        }
      }
      // the LED destination over the middle, the run number beside it, the lights in the corners
      dests.push({ geometry: new THREE.PlaneGeometry(1.24, 0.31), matrix: trs(xOff + mf + s * 0.002, 3.5, 0, 0, ry, 0) });
      push('runNo', new THREE.PlaneGeometry(0.3, 0.115), trs(mf + s * 0.002, 3.5, s > 0 ? -0.8 : 0.8, 0, ry, 0));
      for (const e of [-1, 1]) {
        lamp('head', 0.08, 3.48, e * 1.1, mf + s * 0.004);
        lamp('tail', 0.048, 3.48, e * 1.245, mf + s * 0.004);
      }
      // the rounded corner pillars where the mask meets the sides
      for (const e of [-1, 1]) push('steelHi', new THREE.CylinderGeometry(0.05, 0.05, TOP - 2.1 + 0.08, 8), trs(fx - s * 0.02, (TOP + 2.18) / 2, e * (CAR_W / 2 - 0.06)));
    } else {
      /* The railcar's face: Pikachu's face across the yellow nose (the art
       * page's front panel), the cab band above it with two big panes, the
       * headlights either side of the LED over them, tail lights low. */
      const noseD = 0.09;
      push('art', ...Object.values(mapped(plate(-CAR_W / 2 + 0.05, CAR_W / 2 - 0.05, FLOOR - 0.2, 2.12, { rTop: 0.06, rBot: 0.16, bevel: noseD - 0.02 }, s), trs(fx - s * 0.03, 0, 0),
        regionUV(A.front, -CAR_W / 2, CAR_W / 2, FLOOR - 0.2, 2.12, (x, y, z) => [-s * z, y]))));
      push('front', plate(-CAR_W / 2 + 0.07, CAR_W / 2 - 0.07, 2.12, TOP + 0.08, { rTop: 0.4, rBot: 0.06, bevel: noseD - 0.02 }, s), trs(fx - s * 0.03, 0, 0));
      const mf = fx + s * (noseD + 0.006);
      for (const [z0, z1] of [[-1.2, -0.16], [0.16, 1.2]]) {
        push('rubber', new THREE.PlaneGeometry(z1 - z0 + 0.08, 1.06), trs(mf, 2.72, (z0 + z1) / 2, 0, ry, 0));
        // (each a centimetre off the one behind: at 3 mm the panes fought their rubber from the crossing)
        push('cabGlass', new THREE.PlaneGeometry(z1 - z0, 0.98), trs(mf + s * 0.01, 2.72, (z0 + z1) / 2, 0, ry, 0));
        push('glint', new THREE.PlaneGeometry(0.2, 0.9), trs(mf + s * 0.02, 2.72, z0 + (z1 - z0) * 0.3, 0, ry, 0.26));
        push('rubber', box(0.02, 0.62, 0.03), trs(mf + s * 0.036, 2.42, z0 + 0.2, s * 1.25, 0, 0));
      }
      push('rubber', new THREE.PlaneGeometry(1.3, 0.36), trs(mf, 3.5, 0, 0, ry, 0));
      dests.push({ geometry: new THREE.PlaneGeometry(1.24, 0.31), matrix: trs(xOff + mf + s * 0.01, 3.5, 0, 0, ry, 0) });
      for (const e of [-1, 1]) {
        push('rubber', new THREE.CircleGeometry(0.15, 16), trs(mf + s * 0.001, 3.5, e * 0.92, 0, ry, 0));
        lamp('head', 0.1, 3.5, e * 0.92, mf + s * 0.012);
        lamp('tail', 0.06, 1.3, e * 1.18, fx + s * (noseD + 0.012));
      }
    }
    // handrails at the corners, and below them the step
    for (const e of [-1, 1]) {
      push('steelHi', new THREE.CylinderGeometry(0.018, 0.018, 0.9, 6), trs(fx + s * 0.08, 1.6, e * 1.36));
      B('under', fx, fx + s * 0.22, 0.62, 0.66, e * 1.0, e * 1.35);
    }
    // the snowplough (排障器), raked, and the coupler
    push('under', box(0.06, 0.56, 2.3), trs(fx + s * 0.34, 0.66, 0, 0, 0, s * -0.35));
    for (const e of [-1, 1]) push('under', box(0.5, 0.5, 0.05), trs(fx + s * 0.18, 0.62, e * 1.13, 0, s * e * 0.3, 0));
    B('under', fx, fx + s * 0.6, 0.86, 1.02, -0.13, 0.13);
    B('rubber', fx + s * 0.6, fx + s * 0.72, 0.8, 1.08, -0.2, 0.2);
    // inside: the back wall with its door and window, the desk, the seat
    const xw = s * CAB_WALL;
    B('lining', xw - 0.03, xw + 0.03, FLOOR, TOP - 0.12, -CAR_W / 2 + 0.1, -0.35);
    B('lining', xw - 0.03, xw + 0.03, FLOOR, 2.0, 0.35, CAR_W / 2 - 0.1);
    B('lining', xw - 0.03, xw + 0.03, 2.8, TOP - 0.12, 0.35, CAR_W / 2 - 0.1);
    push('glass', new THREE.PlaneGeometry(CAR_W / 2 - 0.45, 0.8), trs(xw, 2.4, (0.35 + CAR_W / 2 - 0.1) / 2, 0, -ry, 0));
    B('rubber', xw - 0.02, xw + 0.02, 1.99, 2.03, 0.35, CAR_W / 2 - 0.11);      // (a centimetre short of the wall's end, seen through the cab's side window)
    B('rubber', xw - 0.02, xw + 0.02, 2.77, 2.81, 0.35, CAR_W / 2 - 0.11);
    B('panel', xw - 0.025, xw + 0.025, FLOOR, FLOOR + 1.9, -0.35, 0.35);
    B('rubber', xw - s * 0.03, xw - s * 0.02, 2.2, 2.7, -0.2, 0.2);
    B('console', fx - s * 0.75, fx - s * 0.12, FLOOR, FLOOR + 0.95, -1.3, 1.3);
    B('console', fx - s * 0.5, fx - s * 0.12, FLOOR + 0.95, FLOOR + 1.12, -1.3, 0.1, 0, 0, s * 0.3);
    B('console', fx - s * 1.35, fx - s * 1.0, FLOOR, FLOOR + 1.1, -0.85, -0.3);
    lights.push({ geometry: box(0.8, 0.03, 0.14), matrix: trs(fx - s * 1.0, TOP - 0.19, 0) });
    // the cab end's own roof gear: two little antennae
    for (const dz of [-0.35, 0.35]) B('rubber', fx - s * 1.5, fx - s * 1.2, ROOF, ROOF + 0.12, dz - 0.05, dz + 0.05);
  }

  /* ================================ the roof ================================ */
  // the air-conditioner, one big unit mid-car, its grille and two fans
  const acL = T.cab === 'e233' ? 2.2 : 1.8, acW = T.cab === 'e233' ? 1.05 : 0.95;
  B('gear', -acL, acL, ROOF, ROOF + 0.32, -acW, acW);
  for (let x = -acL + 0.2; x <= acL - 0.2; x += 0.2) B('under', x - 0.02, x + 0.02, ROOF + 0.32, ROOF + 0.325, -acW + 0.05, -0.2);
  for (const x of [-0.8, 0.8]) push('under', new THREE.CylinderGeometry(0.34, 0.34, 0.02, 16), trs(x, ROOF + 0.33, 0.45));
  for (const x of [-7.0, 7.0]) B('gear', x - 0.4, x + 0.4, ROOF, ROOF + 0.12, -0.5, 0.5);
  if (T.dmu) {
    // the railcar: its exhaust stack and radiator on the roof
    push('under', new THREE.CylinderGeometry(0.14, 0.14, 0.5, 10), trs(-4.6, ROOF + 0.2, 0.55));
    B('under', -4.75, -4.45, ROOF + 0.44, ROOF + 0.5, 0.35, 0.75);
    B('gear', -6.2, -4.9, ROOF, ROOF + 0.22, -0.7, 0.7);
    for (let x = -6.1; x < -4.95; x += 0.12) B('under', x - 0.015, x + 0.015, ROOF + 0.22, ROOF + 0.225, -0.6, 0.6);
  }
  // the pantograph: a single arm, on the motor car
  if (tail && T.panto) {
    const px = 5.2, py = ROOF + 0.05;
    B('under', px - 0.7, px + 0.7, py, py + 0.08, -0.55, 0.55);
    for (const dx of [-0.55, 0.55]) for (const dz of [-0.45, 0.45]) push('insul', new THREE.CylinderGeometry(0.05, 0.06, 0.14, 8), trs(px + dx, py + 0.15, dz));
    B('metal', px - 0.8, px + 0.8, py + 0.22, py + 0.28, -0.5, 0.5);
    const top = CONTACT_Y - 0.02;
    const hinge = [px - 0.65, py + 0.32], knee = [px + 0.62, py + 0.62], head = [px - 0.05, top - 0.08];
    const arm2 = (a, b, r, dz = 0) => {
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      push('metal', new THREE.CylinderGeometry(r, r, len, 6), trs((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, dz, 0, 0, Math.atan2(b[1] - a[1], b[0] - a[0]) - Math.PI / 2));
    };
    for (const dz of [-0.2, 0.2]) arm2(hinge, knee, 0.04, dz);
    arm2(knee, head, 0.028);
    arm2([hinge[0] + 0.2, hinge[1]], [knee[0] - 0.2, knee[1] - 0.05], 0.012);          // the damper
    B('metal', head[0] - 0.05, head[0] + 0.05, head[1] - 0.02, head[1] + 0.03, -0.55, 0.55);
    for (const dx of [-0.13, 0.13]) {
      B('metal', head[0] + dx - 0.035, head[0] + dx + 0.035, top - 0.04, top, -0.62, 0.62);
      for (const e of [-1, 1]) push('metal', box(0.05, 0.03, 0.3), trs(head[0] + dx, top - 0.09, e * 0.74, e * -0.5, 0, 0));
    }
    // the roof wiring to it
    B('insul', px - 3.5, px - 0.7, ROOF + 0.06, ROOF + 0.1, 0.62, 0.66);
  }

  /* ================================ underneath ================================ */
  // the boxes between the bogies: a different set on each car
  const kit = T.dmu
    ? [[-4.4, -1.0, 0.7, 'L'], [-4.4, -1.0, 0.7, 'R'], [0.2, 2.6, 0.55, 'L'], [1.0, 3.2, 0.5, 'R'], [3.6, 4.7, 0.45, 'L']]     // the engine, the transmission, the fuel tank
    : index % 2
      ? [[-4.8, -2.2, 0.55, 'L'], [-1.9, 0.6, 0.62, 'R'], [1.0, 2.6, 0.5, 'L'], [3.0, 4.6, 0.45, 'R']]      // the motor car: inverter, reactor
      : [[-4.6, -3.0, 0.45, 'L'], [-2.6, -0.4, 0.55, 'R'], [0.2, 2.2, 0.48, 'L'], [2.8, 4.6, 0.4, 'R']];     // the trailer: SIV, compressor, battery
  for (const [x0, x1, depth, side] of kit) {
    const z0 = side === 'L' ? -1.2 : 0.05, z1 = side === 'L' ? -0.05 : 1.2;
    B('under', x0, x1, FLOOR - 0.3 - depth * 0.7, FLOOR - 0.3, z0, z1);
    // a lid line and bolts: a lighter strip along the face
    B('spring', x0 + 0.05, x1 - 0.05, FLOOR - 0.3 - depth * 0.35 - 0.01, FLOOR - 0.3 - depth * 0.35 + 0.01, side === 'L' ? z0 - 0.005 : z1 - 0.005, side === 'L' ? z0 + 0.005 : z1 + 0.005);
  }
  // the air tanks, lying along the car
  for (const [x, z] of [[-1.2, -0.7], [1.6, 0.75]]) push('spring', new THREE.CylinderGeometry(0.16, 0.16, 2.2, 10), trs(x, 0.6, z, 0, 0, Math.PI / 2));
  // the bogies: frames, axle boxes, springs, air springs, the wheels and axles
  const WR = 0.36, WY = RAIL_TOP + WR;
  const wheelGeo = new THREE.CylinderGeometry(WR, WR, 0.13, 16);
  for (const bx of [-BOGIE_X, BOGIE_X]) {
    for (const e of [-1, 1]) {
      B('bogie', bx - 1.45, bx + 1.45, 0.56, 0.76, e * 0.92, e * 1.08);
      push('spring', new THREE.CylinderGeometry(0.24, 0.24, 0.16, 12), trs(bx, 0.8, e * 0.98));
      for (const wx of [-1.05, 1.05]) {
        B('bogie', bx + wx - 0.17, bx + wx + 0.17, WY - 0.14, WY + 0.12, e * 0.9, e * 1.12);
        push('spring', new THREE.CylinderGeometry(0.08, 0.08, 0.1, 8), trs(bx + wx, WY + 0.17, e * 1.0));
        push('wheel', wheelGeo, trs(bx + wx, WY, e * 0.6, Math.PI / 2, 0, 0));
        push('bogie', new THREE.CylinderGeometry(0.1, 0.1, 0.1, 10), trs(bx + wx, WY, e * 0.7, Math.PI / 2, 0, 0));
        // a brake unit behind each wheel
        B('bogie', bx + wx * 0.55 - 0.1, bx + wx * 0.55 + 0.1, 0.5, 0.72, e * 0.62, e * 0.8);
      }
    }
    B('bogie', bx - 0.2, bx + 0.2, 0.56, 0.74, -0.92, 0.92);
    for (const wx of [-1.05, 1.05]) push('bogie', new THREE.CylinderGeometry(0.07, 0.07, 1.4, 8), trs(bx + wx, WY, 0, Math.PI / 2, 0, 0));
    if (index % 2 && !T.dmu) for (const wx of [-0.55, 0.55]) push('under', new THREE.CylinderGeometry(0.2, 0.2, 0.9, 12), trs(bx + wx * 0.8, 0.62, 0, Math.PI / 2, 0, 0));   // traction motors
  }

  /* ---- bake ---- */
  const matFor = {
    steel: m.steel, steelHi: m.steelHi, band: m.band, pink: m.pink, front: m.front, art: m.art, artLit: m.artLit,
    rubber: m.rubber, roof: m.roof, gear: m.gear,
    under: m.under, bellows: m.bellows, bogie: m.bogie, spring: m.spring, wheel: m.wheel, insul: m.insul, yellow: m.yellow, console: m.console,
    metal: m.gear, panel: m.lining, floor: m.floor, lining: m.lining, seat: m.seat, seatPri: m.seatPri, seatBase: m.seatBase, pole: m.pole,
    glass: m.glass, glint: m.glint, cabGlass: m.cabGlass, lcd: m.lcd, ads: m.ads, runNo: m.runNo, carNo: m.carNo[index % 2],
    priority: m.priority, weak: m.weak, doorStatic: m.door,
  };
  const inside = new Set(['lining', 'panel', 'floor', 'seat', 'seatPri', 'seatBase', 'pole', 'lcd', 'ads', 'priority', 'yellow', 'console', 'artLit']);
  const see = new Set(['glass', 'glint', 'cabGlass', 'lcd', 'ads', 'runNo', 'carNo', 'priority', 'weak']);
  for (const [k, list] of Object.entries(P)) {
    const mesh = new THREE.Mesh(bake(list), matFor[k]);
    mesh.castShadow = !inside.has(k) && !see.has(k);
    mesh.receiveShadow = !see.has(k);
    if (inside.has(k) || see.has(k)) mesh.userData.noOutline = true;
    car.add(mesh);
    if (k === 'roof' || k === 'steel' || k === 'art' || k === 'front') hullOutline(mesh, { thickness: 0.003 });
  }
  const lit = new THREE.Mesh(bake(lights), m.light);
  lit.userData.noOutline = true;
  car.add(lit);
  if (lamps) {
    // the leading end shows its headlights, the trailing end its tail lights
    const on = lamps.filter((l) => (cab ? l.kind === 'head' : l.kind === 'tail'));
    const off = lamps.filter((l) => !on.includes(l));
    const a = new THREE.Mesh(bake(on), cab ? m.head : m.tail);
    const b = new THREE.Mesh(bake(off), cab ? m.tailOff : m.lampOff);
    for (const x of [a, b]) { x.userData.noOutline = true; car.add(x); }
  }
  return { car, leaves };
}

/** Where the cars stand along a set: [{ x, cab }] (the cab car leads, at +x). Same for every type. */
export function carLayout(cars = 2) {
  return Array.from({ length: cars }, (_, i) => ({ x: ((cars - 1) / 2 - i) * PITCH, cab: i === 0 ? 1 : i === cars - 1 ? -1 : 0 }));
}

/**
 * A two-car set of one type.  Returns the group and its moving parts;
 * line/index.js's fleet swaps sets in and out, line/service.js places the
 * one in service and decides what it does.
 */
export function buildEmu(ctx, { cars = 2, seed = 2104, type = 'box' } = {}) {
  const T = TYPES[type] ?? TYPES.box;
  const m = mats(T);
  const group = new THREE.Group();
  group.name = 'train-' + T.id;
  group.userData.seed = seed;
  ctx.add(group);
  const leaves = { 1: [], [-1]: [] };
  const dests = [], straps = [];
  const carX = carLayout(cars);
  carX.forEach(({ x: xOff }, i) => {
    const c = buildCar(T, { cab: i === 0, tail: i === cars - 1, index: i, dests, straps, xOff });
    c.car.position.x = xOff;
    group.add(c.car);
    leaves[1].push(...c.leaves[1]);
    leaves[-1].push(...c.leaves[-1]);
  });
  // batch the car bodies inside the set; the doors, the LEDs and the straps move or change
  mergeStatic(group);
  group.userData.dynamic = true;

  // every destination LED on the set: one mesh, its texture swapped by direction
  const destMat = flat({ color: 0xffffff, map: destTex('east'), cache: false });
  const dest = new THREE.Mesh(bake(dests), destMat);
  dest.userData.noOutline = true;
  dest.userData.keep = true;
  group.add(dest);

  // the straps: one InstancedMesh, swaying about their rail
  const strapGeo = (() => {
    const parts = [
      { geometry: box(0.05, 0.05, 0.042), matrix: trs(0, -0.017, 0) },      // the clasp, round the rail (its faces lay in the rail's)
      { geometry: box(0.024, 0.2, 0.008), matrix: trs(0, -0.14, 0) },
      { geometry: new THREE.TorusGeometry(0.068, 0.012, 5, 14), matrix: trs(0, -0.31, 0) },
    ];
    return bake(parts);
  })();
  const strapMesh = new THREE.InstancedMesh(strapGeo, m.strap, straps.length);
  strapMesh.userData.noOutline = true;
  strapMesh.castShadow = false;
  strapMesh.frustumCulled = false;
  group.add(strapMesh);
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1), _e = new THREE.Euler();
  const placeStraps = (t, lean, amp) => {
    straps.forEach((s, i) => {
      _e.set(0.04 * Math.sin(t * 1.3 + s.ph * 2), 0, lean + amp * Math.sin(t * 2.1 + s.ph));
      _q.setFromEuler(_e);
      _p.set(s.x, RAIL_Y, s.z);
      _m.compose(_p, _q, _s);
      strapMesh.setMatrixAt(i, _m);
    });
    strapMesh.instanceMatrix.needsUpdate = true;
  };
  placeStraps(0, 0, 0);

  let doorT = 0, swayT = 0, lastV = 0, accel = 0, lean = 0;
  return {
    group,
    type: T.id,
    length: PITCH * cars,
    carX,
    /** 0 shut .. 1 open, on the platform side (local -z) */
    setDoors(t) {
      doorT = t;
      const e = t * t * (3 - 2 * t);
      for (const l of leaves[-1]) l.position.x = l.userData.half * (DOOR_W / 2) * e * 0.96;
    },
    get doors() { return doorT; },
    /** 0 by day .. 1 at night: the interior lights up. */
    setNight(k) {
      for (const mm of m.interior) mm.emissiveIntensity = 0.62 * k;
    },
    setDest(dir) {
      destMat.map = destTex(dir);
      destMat.needsUpdate = true;
    },
    /** The wheels are baked in (a turning disc looks the same): kept for the service. */
    spin() {},
    /**
     * The straps: they lean back as the train pulls away, swing forward as it
     * brakes, and sway a little while it runs or stands.  Only when near.
     */
    animate(dt, v, near) {
      if (dt <= 0) return;
      accel += ((v - lastV) / dt - accel) * Math.min(1, dt * 3);
      lastV = v;
      if (!near) return;
      swayT += dt;
      lean += (THREE.MathUtils.clamp(-accel * 0.14, -0.22, 0.22) - lean) * Math.min(1, dt * 2.5);
      const amp = 0.015 + Math.min(1, v / 22) * 0.05;
      placeStraps(swayT, lean, amp);
    },
  };
}

/**
 * The fleet: one slot per track, each showing whichever type its run
 * needs.  A type's set is built the first time it is called for and kept
 * (hidden it draws nothing); only the sets in service are visible.  The
 * slot forwards the set's API, so the service and the station see one
 * train per track whatever its type.
 */
export function makeFleet(ctx, { slots = 2, cars = 2 } = {}) {
  const built = new Map();          // type -> set
  const claimed = new Map();        // type -> slot index holding it
  const get = (type) => {
    if (!built.has(type)) built.set(type, buildEmu(ctx, { cars, type, seed: 2104 + built.size * 127 }));
    return built.get(type);
  };
  let night = 0;
  const slotList = Array.from({ length: slots }, (_, i) => {
    let cur = null, key = null;
    const slot = {
      index: i,
      length: PITCH * cars,
      carX: carLayout(cars),
      /** The set on show, or null while the slot has never run. */
      get group() { return cur?.group ?? null; },
      get type() { return cur?.type ?? null; },
      /** Show `type` in this slot (built on first use); the previous set goes dark. */
      use(type) {
        if (!TYPES[type]) type = 'box';
        if (cur?.type === type) return cur;
        let want = type;
        const other = claimed.get(type);
        if (other !== undefined && other !== i) {
          // the other slot still holds this type (a one-type rotation): a second set of it
          // (a spare already built and free, whichever slot it was made for: the phone builds it at load)
          want = [...built.keys()].find((k) => k !== type && k.split('#')[0] === type && !claimed.has(k)) ?? `${type}#${i}`;
          if (!built.has(want)) built.set(want, buildEmu(ctx, { cars, type, seed: 2300 + i }));
        }
        if (cur) { cur.group.visible = false; claimed.delete(key); }
        cur = get(want); key = want;
        claimed.set(key, i);
        cur.group.visible = true;
        cur.setNight(night);
        cur.setDoors(0);
        return cur;
      },
      setDoors(t) { cur?.setDoors(t); },
      get doors() { return cur?.doors ?? 0; },
      setDest(dir) { cur?.setDest(dir); },
      spin() {},
      animate(dt, v, near) { cur?.animate(dt, v, near); },
      setNight(k) { night = k; for (const s of built.values()) s.setNight(k); },
    };
    return slot;
  });
  return {
    slots: slotList,
    types: Object.keys(TYPES),
    /** Build these types now (at load), so no run's first appearance costs a frame (~60 ms a type). */
    prime(types) { for (const t of types) if (TYPES[t]) get(t).group.visible = false; /*@mini this.primeSecond(types); @*//*@@*/ },
    /* (the pocket town, Tan 2026-10-04: "transparent trains with just doors"; the two runs stand at the platform
     * together there, so each track has its own set from the start, built at load like the first: a set built in
     * play came after the phone had let its pages' canvases go, mobile/lite.js) */
    primeSecond(types) { for (const t of types) if (TYPES[t] && !built.has(`${t}#1`)) { built.set(`${t}#1`, buildEmu(ctx, { cars, type: t, seed: 2301 })); built.get(`${t}#1`).group.visible = false; } },
    setNight(k) { night = k; for (const s of built.values()) s.setNight(k); },
    /** Dev: what is built and what each slot shows. */
    get state() { return { built: [...built.keys()], showing: slotList.map((s) => s.type) }; },
  };
}
