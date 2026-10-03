import * as THREE from 'three';
import { TOWN, STREET, LAWSON, HERO_VIEWS, ANIMALS, ROADS } from '../../config.js';
import { pondShore } from '../land/pond.js';
import { planPaddies } from '../land/paddies.js';
import { SPECIALS } from '../town-plan.js';
import { HAN_BAY, HAN_SHOW } from '../han/index.js';
import { buildDrive, driveAt, T_DRIVE } from '../han/drive.js';
import { shibaGeometry, RIG, SHADOW, BODY_R } from './shiba.js';
import { makeReactions, SNACKS } from './reactions.js';
import { PIGEONS } from './pigeons.js';
import { animalMaterial, Herd, ease, turn } from './shade.js';
import { soundBus } from '../../core/soundBus.js';
import { STRINGS } from '../../data/strings.js';
import { HACHI_HOME } from './home.js';        // [tour-B] his own garden's ball

/* ------------------------------------------------------------------ *
 * The guide (Tan, 2026-09-28): a shiba that leads you to the town's
 * engagements one at a time, instead of a dog trailing behind where you
 * would never see it.
 *
 * The pup suggests, you decide; it guides, it doesn't follow (Tan,
 * 2026-09-29: "it's very difficult to guess whether it wants to follow me or
 * I need to follow it").  It waits on the far pavement behind the famous
 * view (out of every hero frame) and comes when you walk off.  It leads along
 * the town tour at a jog, a few metres ahead, stopping to look back when you
 * fall behind; at a spot it waits beside the ring until you step in.  Not
 * interested (you heading off its way, your distance to the spot growing
 * while it waits, or you 16 m off): it stops where it is and waits, watching
 * you go.  Walk back to it and it takes you on; whistle (F) and it comes
 * running wherever you are, greets you, and rushes you to the nearest place
 * you haven't been.  When every engagement is done it naps beside the
 * Deer Park gate, the tour's last stop.
 *
 * Between times it is a puppy: a bouncy trot, zoomies, play bows, hops,
 * rolling over belly-up, chasing its tail, a sneeze, a head tilt, the odd
 * trip over its own paws; picked by an energy/nearness mood, never the
 * same twice running.
 *
 * The way: a coarse walkable grid of the town (world frame) built from the
 * colliders, the ground's height (the river's channel is sunk), the pond's
 * shore and the road layout, with pavements cheap, asphalt dear and the
 * zebras cheap again, so it keeps to the pavements and crosses at the
 * crossings.  For each goal one distance field (Dijkstra, spread over
 * frames) is grown from the goal; the dog descends it, and the field tells
 * how far ahead of you it is along the way, not as the crow flies.
 *
 * One instanced draw, no collider (it steps aside from you instead), and
 * it keeps off the RX-7's route while Han's show runs.
 * ------------------------------------------------------------------ */

const A = ANIMALS.guide;
/** The pup, for main.js: `whistle()` (F) calls it to you from anywhere; set once it is built.  `onTourEnd`, main.js's:
 *  called once a tour, when the tour is over and its happy bit on the gate's bench has played in full and it has
 *  settled (the postcard, ui/postcard.js: the tour's ending), or when you whistle it to you before that (the bit cut
 *  short at your call).  `onNap`: called once it has lain down asleep there. */
export const GUIDE = {
  whistle: () => false, tipsy: () => {}, greeting: () => null, onNap: null, onTourEnd: null,
  /** the konbini (store/shop.js, by main.js): what you bought, and where you are with it: 'hold' | 'eat' | 'done' */
  snack: () => {},
  /** after the tour, the pup by you and looked at: true while "E · Take the tour again" is on offer; `again()` takes it
   *  (true if the tour began again); `onTour`, main.js's: called when it does */
  offer: () => false, again: () => false, onTour: null,
  /** main.js, each frame: the level crossing's bells (on, and where: world { x, z }) */
  bells: { on: false, x: 0, z: 0 },
  /** ぺったん堂's show (world/mochi/): see buildGuide */
  watchShow: () => {}, showCue: () => {}, where: () => null,
  /** the walk grid, once built (the phone's tap-to-walk goes his ways: mobile/controls/goto.js) */
  walk: null,
};
const INF = Infinity;
const ENGAGE = A.engage;

/* ------------------------------ the grid ------------------------------ */
class Walk {
  constructor(ctx, core) {
    this.ctx = ctx; this.core = core; this.built = false;
  }
  build() {
    const t0 = performance.now();
    const ctx = this.ctx, C = A.cell;
    // the town's bounds are in its own (turned) frame: in the world's
    const b0 = ctx.toWorld({ x: TOWN.bounds.x0, z: TOWN.bounds.z0 }), b1 = ctx.toWorld({ x: TOWN.bounds.x1, z: TOWN.bounds.z1 });
    const B = { x0: Math.min(b0.x, b1.x), x1: Math.max(b0.x, b1.x), z0: Math.min(b0.z, b1.z), z1: Math.max(b0.z, b1.z) };
    // [tour-B] Hachi's garden lies past the town's south fence: the grid reaches it
    { const hh = TOWN.hachiHome, q = ctx.toWorld({ x: hh.x0, z: hh.z1 + 1.2 }); B.z0 = Math.min(B.z0, q.z); B.z1 = Math.max(B.z1, q.z); }
    const X0 = this.X0 = B.x0, Z0 = this.Z0 = B.z0;
    const nx = this.nx = Math.ceil((B.x1 - B.x0) / C), nz = this.nz = Math.ceil((B.z1 - B.z0) / C);
    const N = this.N = nx * nz;
    const K = A.costs;
    // everything is an alley until a street, a plaza, the land's paths or a lot says otherwise
    const cost = this.cost = new Uint8Array(N).fill(K.alley);
    const h = this.h = new Int16Array(N);
    this.haz = new Uint8Array(N);
    this.tall = new Uint8Array(N);       // something that hides a pup from you (a wall, a car, a machine): the whistle's corners
    this.stair = new Uint8Array(N);      // 1: a flight climbing along x, 2: along z (entered only along that axis)
    this.water = new Uint8Array(N);      // for the checks: cells that are water (all blocked)
    this.low = new Uint8Array(N);        // for the checks: cells shut only by something low (a wheel stop): you step over it
    this.C = C;
    const rect = (x0, z0, x1, z1, fn) => {
      const ix0 = Math.max(0, Math.floor((Math.min(x0, x1) - X0) / C)), ix1 = Math.min(nx - 1, Math.floor((Math.max(x0, x1) - X0) / C));
      const iz0 = Math.max(0, Math.floor((Math.min(z0, z1) - Z0) / C)), iz1 = Math.min(nz - 1, Math.floor((Math.max(z0, z1) - Z0) / C));
      for (let iz = iz0; iz <= iz1; iz++) for (let ix = ix0; ix <= ix1; ix++) fn(iz * nx + ix);
    };
    const paint = (v) => (i) => { if (cost[i]) cost[i] = v; };
    const W = (p) => ctx.toWorld(p);
    const wrect = (x0, z0, x1, z1, v) => { const a = W({ x: x0, z: z0 }), b = W({ x: x1, z: z1 }); rect(a.x, a.z, b.x, b.z, paint(v)); };

    /* the ground: its height, and nothing below street level (the channel) */
    for (let iz = 0; iz < nz; iz++) for (let ix = 0; ix < nx; ix++) {
      const i = iz * nx + ix;
      const p = ctx.toLocal({ x: X0 + (ix + 0.5) * C, z: Z0 + (iz + 0.5) * C });
      const y = ctx.groundAt(p.x, p.z);
      h[i] = Math.round(y * 100);
      if (y < -0.05) cost[i] = 0;
    }
    /* open ground you may cross: the land north of the main road (the car park, the river walks, the bridge
     * road's verges), the paddies' paths and the pond's grounds; the plaza and the station's strip */
    wrect(TOWN.bounds.x0, TOWN.bounds.z0, TOWN.bounds.x1, TOWN.grid.main - 2.5, K.ground);
    { const [x0, z0, x1, z1] = TOWN.land.paddies.box; wrect(x0 - 1.5, z0 - 1.5, x1 + 1.5, z1 + 1.5, K.ground); }
    { const [x0, z0, x1, z1] = TOWN.land.pond.box; wrect(x0 - 1.5, z0 - 1.5, x1 + 1.5, z1 + 1.5, K.ground); }
    for (const s of SPECIALS) if (s.kind === 'plaza' || s.kind === 'station') wrect(s.x0, s.z0, s.x1, s.z1, K.plaza);
    // [tour-B] the shrine's grounds and Hachi's own garden (and the lane's end at its gate) are places he goes into
    for (const s of SPECIALS) if (s.kind === 'shrine') wrect(s.x0, s.z0 - 0.5, s.x1, s.z1, K.plaza);
    { const hh = TOWN.hachiHome; wrect(hh.x0, hh.z0 - 0.6, hh.x1, hh.z1, K.plaza); }
    /* the roads: pavements cheap, asphalt dear, the zebras cheap again */
    const net = this.core?.kit?.net, feats = this.core?.kit?.features;
    if (net) {
      const r4 = (e, s0, s1, o0, o1, v) => (e.axis === 'x' ? wrect(s0, e.c + o0, s1, e.c + o1, v) : wrect(e.c + o0, s0, e.c + o1, s1, v));
      for (const e of net.edges) {
        if (e.opts.surface === false) continue;
        if (e.spec.walk > 0) { r4(e, e.s0, e.s1, e.a, e.t, K.pavement); r4(e, e.s0, e.s1, -e.t, -e.a, K.pavement); }
      }
      for (const e of net.edges) if (e.opts.surface !== false) r4(e, e.a0, e.a1, -e.a, e.a, e.spec.walk > 0 ? K.asphalt : K.lane);
      for (const n of Object.values(net.nodes)) if (!n.external && n.ax > 0 && n.az > 0) wrect(n.x - n.ax, n.z - n.az, n.x + n.ax, n.z + n.az, n.edges.some((e) => e.spec.walk > 0) ? K.asphalt : K.lane);
      for (const c of feats?.crossings ?? []) r4(c.e, c.s - c.L / 2, c.s + c.L / 2, -c.e.a, c.e.a, K.pavement);
    }
    // the main road and what borders it (world frame): the store's forecourt,
    // the far pavement, the signalled zebra; the bridge road and the car park
    rect(STREET.roadX0, STREET.forecourtZ, STREET.roadX1, STREET.roadZ, paint(K.asphalt));
    rect(STREET.roadX0, STREET.roadZ, STREET.roadX1, STREET.sidewalkZ, paint(K.pavement));
    rect(STREET.x0, LAWSON.frontZ, STREET.x1, STREET.forecourtZ, paint(K.lot));
    rect(TOWN.crosswalk.x - TOWN.crosswalk.width / 2, STREET.forecourtZ, TOWN.crosswalk.x + TOWN.crosswalk.width / 2, STREET.roadZ, paint(K.pavement));
    // the road in front of the store's forecourt has no kerb (cars turn in off it): crossed there, as everyone does
    rect(STREET.bayX0, STREET.forecourtZ, STREET.bayX1, STREET.roadZ, paint(K.lot));
    { const t = TOWN.land.track; wrect(t.x - t.w / 2, t.z0, t.x + t.w / 2, t.z1, K.lane); }
    { const [x0, z0, x1, z1] = TOWN.land.parking; wrect(x0, z0, x1, z1, K.lot); }
    /* solid things: every collider a dog can't step over, with clearance */
    const R = A.radius;
    for (const c of ctx.colliders) {
      if ((c.bottom ?? 0) >= 0.8 || c.x1 - c.x0 < 0.01 || c.z1 - c.z0 < 0.01 || c.pet) continue;   // ([tour-B] `pet`: his own door, tunnel and hoop keep you out, not him: animals/home.js)
      /* low things (a wheel stop, a planter's kerb: up to 30 cm over the ground they stand on): you step over them,
       * and so did he, through them (Tan, 2026-10-02: sunk to his chest in a wheel stop by the konbini's door); he
       * goes round them, close by.  Flush with the ground (a step's own collider, a lid): nothing to go round. */
      if ((c.top ?? 9) <= 0.3) {
        const p = ctx.toLocal({ x: (c.x0 + c.x1) / 2, z: (c.z0 + c.z1) / 2 });
        const over = c.top - ctx.surfaceAt(p.x, p.z);
        if (over > 0.05 && over <= 0.31) rect(c.x0 - 0.1, c.z0 - 0.1, c.x1 + 0.1, c.z1 + 0.1, (i) => { if (cost[i]) this.low[i] = 1; cost[i] = 0; });
        continue;
      }
      rect(c.x0 - R, c.z0 - R, c.x1 + R, c.z1 + R, (i) => { cost[i] = 0; });
      if ((c.top ?? 9) >= 1.1) rect(c.x0, c.z0, c.x1, c.z1, (i) => { this.tall[i] = 1; });
    }
    // the store itself (its door opens for you, not for a dog) and Han's bay
    rect(-LAWSON.width / 2 - 0.4, -LAWSON.depth - 0.4, LAWSON.width / 2 + LAWSON.wingWidth + 0.4, LAWSON.frontZ + 0.35, (i) => { cost[i] = 0; });
    rect(-LAWSON.width / 2, -LAWSON.depth, LAWSON.width / 2 + LAWSON.wingWidth, LAWSON.frontZ, (i) => { this.tall[i] = 1; });
    wrect(HAN_BAY.x - 1.3, HAN_BAY.z - 2.6, HAN_BAY.x + 1.3, HAN_BAY.z + 2.6, 0);
    /* the pond's water, with a margin */
    {
      const poly = pondShore().map((p) => W({ x: p.x, z: p.y }));
      let x0 = INF, z0 = INF, x1 = -INF, z1 = -INF;
      for (const p of poly) { x0 = Math.min(x0, p.x); z0 = Math.min(z0, p.z); x1 = Math.max(x1, p.x); z1 = Math.max(z1, p.z); }
      const m = 0.5;
      const inside = (x, z) => {
        let c = false;
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
          const a = poly[i], b = poly[j];
          if ((a.z > z) !== (b.z > z) && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) c = !c;
        }
        return c;
      };
      rect(x0 - m, z0 - m, x1 + m, z1 + m, (i) => {
        const x = X0 + ((i % nx) + 0.5) * C, z = Z0 + (((i / nx) | 0) + 0.5) * C;
        if (inside(x, z) || inside(x + m, z) || inside(x - m, z) || inside(x, z + m) || inside(x, z - m)) { cost[i] = 0; this.water[i] = 1; }
      });
    }
    /* the paddies: the plots themselves are dear (the paths between them are the way), the flooded ones and the
     * feeder channel are water: blocked, with a margin (Tan saw the pup half under in the channel) */
    {
      const plan = planPaddies();
      const inPlot = (p, x, z) => x >= p.sw - 0.2 && x <= p.se + 0.2 && z >= p.S(x) - 0.2 && z <= p.N(x) + 0.2;
      const [bx0, bz0, bx1, bz1] = TOWN.land.paddies.box;
      const a = W({ x: bx0 - 1, z: bz0 - 1 }), b = W({ x: bx1 + 1, z: bz1 + 1 });
      rect(a.x, a.z, b.x, b.z, (i) => {
        const p = ctx.toLocal({ x: X0 + ((i % nx) + 0.5) * C, z: Z0 + (((i / nx) | 0) + 0.5) * C });
        for (const q of plan.plots) {
          if (!inPlot(q, p.x, p.z)) continue;
          if (q.kind === 'flood') { cost[i] = 0; this.water[i] = 1; } else if (cost[i]) cost[i] = K.plot;
          break;
        }
      });
      for (const c of plan.channels) {
        const m = 0.45;
        const a = W({ x: c.x0 - m, z: c.z0 - m }), b = W({ x: c.x1 + m, z: c.z1 + m });
        rect(a.x, a.z, b.x, b.z, (i) => { cost[i] = 0; this.water[i] = 1; });
      }
    }
    // the river's water (the sunken walks are blocked already, being below street level)
    for (let i = 0; i < N; i++) if (h[i] < -250) this.water[i] = 1;
    /* stairs: a run of three or more risers (8-45 cm each) along one axis is a flight; its cells are entered
     * only along that axis (from the foot or the head, as a person does), and the cells beside a flight at
     * another level are shut, so it cannot be climbed from the side or walked into (Tan: the station's steps) */
    {
      const stair = this.stair, step = Math.round(A.step * 100);
      const riser = (d) => Math.abs(d) >= 8 && Math.abs(d) <= step;
      for (const [axis, di, len] of [[1, 1, nx], [2, nx, nz]]) {
        const other = axis === 1 ? nz : nx;
        for (let k = 0; k < other; k++) {
          const base = axis === 1 ? k * nx : k;
          let j = 1;
          while (j < len) {
            // a maximal run of risers of one sign, starting at cell j-1
            const start = j - 1;
            let run = 0, sign = 0;
            while (j < len) {
              const c = base + j * di, d = h[c] - h[c - di];
              if (!(cost[c] && cost[c - di] && riser(d) && (sign === 0 || Math.sign(d) === sign))) break;
              sign = Math.sign(d); run++; j++;
            }
            if (run >= 3) for (let m = 0; m <= run; m++) stair[base + (start + m) * di] = axis;
            if (run === 0) j++;
          }
        }
      }
      // the sides: a non-stair neighbour across the axis at another level is shut
      const side = [];
      for (let i = 0; i < N; i++) {
        if (!stair[i]) continue;
        const cx = i % nx, cz = (i / nx) | 0;
        const nb = stair[i] === 1 ? [i - nx, i + nx] : [i - 1, i + 1];
        const on = stair[i] === 1 ? [cz > 0, cz < nz - 1] : [cx > 0, cx < nx - 1];
        nb.forEach((q, k) => { if (on[k] && !stair[q] && cost[q] && Math.abs(h[q] - h[i]) > 6) side.push(q); });
      }
      for (const q of side) cost[q] = 0;
    }
    /* the RX-7's way (han/drive.js), in the town frame: kept off while the show runs */
    {
      const D = buildDrive(HAN_BAY), p = {};
      for (let t = 0; t <= T_DRIVE; t += 0.08) {
        driveAt(D, t, p);
        const w = W({ x: p.x, z: p.z });
        rect(w.x - 2.2, w.z - 2.2, w.x + 2.2, w.z + 2.2, (i) => { this.haz[i] = 1; });
      }
    }
    this.built = true;
    this.ms = performance.now() - t0;
  }
  cell(x, z) {
    const ix = Math.floor((x - this.X0) / this.C), iz = Math.floor((z - this.Z0) / this.C);
    return ix < 0 || iz < 0 || ix >= this.nx || iz >= this.nz ? -1 : iz * this.nx + ix;
  }
  at(i) { return { x: this.X0 + ((i % this.nx) + 0.5) * this.C, z: this.Z0 + (((i / this.nx) | 0) + 0.5) * this.C }; }
  free(x, z) { const i = this.cell(x, z); return i >= 0 && this.cost[i] > 0; }
  /** May a step go from cell c to its neighbour q (offset dx, dz)?  Stairs only along their axis. */
  can(c, q, dx, dz) {
    const s = this.stair[c] || this.stair[q];
    if (!s) return true;
    return s === 1 ? dz === 0 : dx === 0;
  }
  /** The free cell nearest (x, z), within `r` metres; -1 if none. */
  nearest(x, z, r = 3, ok = null) {
    const c0 = this.cell(x, z);
    if (c0 < 0) return -1;
    const cx = c0 % this.nx, cz = (c0 / this.nx) | 0, R = Math.ceil(r / this.C);
    let best = -1, bd = INF;
    for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
      const ix = cx + dx, iz = cz + dz;
      if (ix < 0 || iz < 0 || ix >= this.nx || iz >= this.nz) continue;
      const i = iz * this.nx + ix;
      if (!this.cost[i] || (ok && !ok(i))) continue;
      const d = dx * dx + dz * dz;
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }
  /** Is a pup at a hidden from an eye at b (something tall on the line between, short of the pup's own half-metre)? */
  hidden(ax, az, bx, bz) {
    const L = Math.hypot(bx - ax, bz - az) || 1, n = Math.ceil(L / (this.C * 0.5));
    for (let k = 1; k <= n; k++) {
      const t = k / n;
      if (t * L < 0.5) continue;
      const c = this.cell(ax + (bx - ax) * t, az + (bz - az) * t);
      if (c >= 0 && this.tall[c]) return true;
    }
    return false;
  }
  /** Nothing solid on a straight line from a to b, nor a hand's width either side of it (no grazing a corner). */
  sight(ax, az, bx, bz) {
    const L = Math.hypot(bx - ax, bz - az) || 1, n = Math.ceil(L / (this.C * 0.4));
    const px = (-(bz - az) / L) * 0.14, pz = ((bx - ax) / L) * 0.14;
    // a line that touches a flight must run along the flight's axis (within ~15 degrees), and never up a big step
    const ux = Math.abs(bx - ax) / L, uz = Math.abs(bz - az) / L;
    let last = this.cell(ax, az);
    for (let k = 1; k <= n; k++) {
      const t = k / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t;
      if (!this.free(x, z) || !this.free(x + px, z + pz) || !this.free(x - px, z - pz)) return false;
      const c = this.cell(x, z);
      const s = this.stair[c];
      if (s && (s === 1 ? uz > 0.26 : ux > 0.26)) return false;
      if (c !== last) { if (last >= 0 && Math.abs(this.h[c] - this.h[last]) > A.step * 100) return false; last = c; }
    }
    return true;
  }
}

/* ---------------------- a distance field, grown over frames ---------------------- */
export class Field {
  constructor(W) { this.W = W; this.d = new Float32Array(W.N); this.m = new Float32Array(W.N); this.heap = []; this.ready = false; this.limit = INF; }
  /** Grow from `cells` (distance 0), no farther than `limit` metres. */
  start(cells, limit = INF) {
    this.d.fill(INF); this.m.fill(INF); this.heap.length = 0; this.ready = false; this.limit = limit; this.fresh = true;
    for (const c of cells) if (c >= 0 && this.W.cost[c]) { this.d[c] = 0; this.m[c] = 0; this.push(c); }
    if (!this.heap.length) this.ready = true;
  }
  push(c) {
    const h = this.heap, d = this.d;
    h.push(c);
    let i = h.length - 1;
    while (i > 0) { const p = (i - 1) >> 1; if (d[h[p]] <= d[h[i]]) break; [h[p], h[i]] = [h[i], h[p]]; i = p; }
  }
  pop() {
    const h = this.heap, d = this.d, top = h[0], last = h.pop();
    if (h.length) {
      h[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < h.length && d[h[l]] < d[h[m]]) m = l;
        if (r < h.length && d[h[r]] < d[h[m]]) m = r;
        if (m === i) break;
        [h[m], h[i]] = [h[i], h[m]]; i = m;
      }
    }
    return top;
  }
  /** Some work, within `ms`. */
  work(ms) {
    if (this.ready) return;
    const W = this.W, d = this.d, m = this.m, cost = W.cost, h = W.h, nx = W.nx, nz = W.nz, C = W.C, step = Math.round(A.step * 100);
    const shut = (W.shut ??= new Uint8Array(W.N));
    if (this.fresh !== false || W.shutOf !== this) { shut.fill(0); this.fresh = false; W.shutOf = this; }
    const t0 = performance.now();
    let n = 0;
    while (this.heap.length) {
      const c = this.pop();
      if (shut[c]) continue;
      shut[c] = 1;
      if (d[c] > this.limit) { this.heap.length = 0; break; }
      const cx = c % nx, cz = (c / nx) | 0;
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dz) continue;
        const ix = cx + dx, iz = cz + dz;
        if (ix < 0 || iz < 0 || ix >= nx || iz >= nz) continue;
        const q = iz * nx + ix;
        if (!cost[q] || shut[q] || Math.abs(h[q] - h[c]) > step || !W.can(c, q, dx, dz)) continue;
        if (dx && dz && (!cost[cz * nx + ix] || !cost[iz * nx + cx])) continue;     // no corner cutting
        const len = (dx && dz ? Math.SQRT2 : 1) * C;
        const nd = d[c] + len * (cost[c] + cost[q]) / (2 * A.costs.pavement);
        if (nd < d[q]) { d[q] = nd; m[q] = m[c] + len; this.push(q); }
      }
      if ((++n & 255) === 0 && performance.now() - t0 > ms) return;
    }
    this.ready = true;
    this.fresh = true;
  }
  /** Metres along the cheapest way from (x, z) to the goal (the cost picks the way; this is its length). */
  at(x, z) { const c = this.W.cell(x, z); return c < 0 ? INF : this.m[c]; }
  /** The distance at (x, z), or the best near it (you may stand where a dog can't). */
  near(x, z) {
    let best = INF;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) best = Math.min(best, this.at(x + dx * this.W.C, z + dz * this.W.C));
    return best;
  }
  /** The next cell downhill from c; -1 at the goal (or off the field). */
  next(c) {
    const W = this.W, d = this.d, nx = W.nx, nz = W.nz;
    const cx = c % nx, cz = (c / nx) | 0;
    let best = -1, bd = d[c];
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dz) continue;
      const ix = cx + dx, iz = cz + dz;
      if (ix < 0 || iz < 0 || ix >= nx || iz >= nz) continue;
      const q = iz * nx + ix;
      if (dx && dz && (!W.cost[cz * nx + ix] || !W.cost[iz * nx + cx])) continue;
      if (!W.can(c, q, dx, dz) || Math.abs(W.h[q] - W.h[c]) > A.step * 100) continue;
      if (d[q] < bd) { bd = d[q]; best = q; }
    }
    return best;
  }
}


/* --------------------------------- the pup --------------------------------- */
export function buildGuide(ctx, { spots, shadows, core, facing }) {
  const W = new Walk(ctx, core);
  const geo = shibaGeometry();
  const mat = animalMaterial({ key: 'shibaGuide', rig: RIG, tint: 0x7a6488, bands: 4 });
  const herd = new Herd(ctx, geo, mat, 1, 'shiba', { extra: 3 });      // (three more pose vectors: the face, reactions.js)
  herd.mesh.frustumCulled = false;
  const shadow = shadows.slot();
  const turned = ctx.turnedFrame ? Math.PI : 0;
  const HOME = { x: A.home[0], z: A.home[1] };
  const NAP = ctx.toWorld({ x: A.nap[0], z: A.nap[1] });
  // the gate's bench (land/gate.js): its middle, and the way along its seat (world)
  const GB = TOWN.land.gateBench;
  const BENCH = ctx.toWorld({ x: GB.x, z: GB.z });
  const BENCH_ALONG = (() => { const q = ctx.toWorld({ x: GB.x + 1, z: GB.z }); return { x: q.x - BENCH.x, z: q.z - BENCH.z }; })();
  const VIEW = { x: HERO_VIEWS.golden.play.pos[0], z: HERO_VIEWS.golden.play.pos[2] };
  const heroes = Object.values(HERO_VIEWS).map((v) => ({ x: v.play.pos[0], z: v.play.pos[2] }));
  const storeRect = { x0: -LAWSON.width / 2 - 1, x1: LAWSON.width / 2 + LAWSON.wingWidth + 1, z0: -LAWSON.depth - 1, z1: LAWSON.frontZ + 0.3 };
  const inStore = (p) => p.x > storeRect.x0 && p.x < storeRect.x1 && p.z > storeRect.z0 && p.z < storeRect.z1;
  const D = A.drop;

  /* the pup: where it is, how it stands, what it is doing */
  const G = {
    x: HOME.x, z: HOME.z, y: 0, yaw: Math.PI, speed: 0, roll: 0, pitch: 0, ox: 0, oy: 0,
    ph: 0, amp: 0, look: 0, nod: 0, tilt: 0, wag: 0, wagA: 0, wagPh: 0, posture: 0, perk: 1, hop: 0, hopT: -1, shakeT: -1, landT: -1, jump: null, pop: null, gy: null, sy: null,
    state: 'home', target: null, done: new Set(['view']), skipped: new Set(), t: 0, waitT: 0, sat: 0, glance: 0, tiltT: -1, tiltNext: 3,
    lostT: 0, offT: 0, waitD0: null, minD: INF, hopped: null, field: null, goal: null, since: 0, resume: null, aside: null, moved: 0, thinkT: 0,
    drops: 0, act: null, leg: 0, resumeK: null, whistleAt: null, lastWhistle: -9, intro: 0, introT: 0, last: '', idleT: 0, energy: 0.7, stillT: 0, chaseT: 0, circ: null, inviteE: null,
  };
  const P = { x: VIEW.x, z: VIEW.z, y: 1.6, vx: 0, vz: 0, speed: 0, first: true, hx: 0, hz: -1 };
  /* Its voice (Tan: "very cute, adorable sounds"; core/sound.js dog-* recipes):
   * soft, heard only near it, never two within 1.2 s. */
  let lastSay = -9, pantT = 0, whined = false, snoreT = 0;
  const say = (name, gain = 0.7, must = false, far = 16) => {
    if (!must && G.t - lastSay < 1.2) return;
    lastSay = G.t;
    soundBus.oneShot(name, { x: G.x, z: G.z, y: 0.3, near: 3, far, gain, recipe: name });
  };
  /* its face and its reactions (reactions.js), laid over the pose as it is drawn */
  const FX = makeReactions({ say: (name, gain) => say(name, gain, true) });
  let list = [], listT = 0;
  const fields = { follow: null, whistle: null };
  const ready = new Map();            // goal key -> a Field; the last few kept (each is 2.6 MB of Float32 for the town)
  const queue = [];                   // fields to grow ahead while nothing else is wanted
  const dbg = { paths: 0 };
  const TOUR = A.tour;

  const rOf = (e) => e.r ?? ENGAGE[e.id] ?? 1.2;
  const isEngage = (e) => (e.kind ? e.kind === 'engage' : ENGAGE[e.id] !== undefined);
  const refresh = () => { list = (spots?.() ?? []).filter(isEngage); };
  const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  const keyOf = (x, z) => `${x.toFixed(1)},${z.toFixed(1)}`;

  /** Grow a field from a disc round (x, z); the pup thinks until it is ready (unless it was grown ahead). */
  const aim = (which, x, z, r, limit = INF) => {
    if (which !== 'follow') {
      const key = keyOf(x, z);
      if (ready.has(key)) { const f = ready.get(key); ready.delete(key); ready.set(key, f); return f; }   // freshest last
      const f = new Field(W);
      ready.set(key, f);
      while (ready.size > A.fields) { const [k0, f0] = ready.entries().next().value; if (f0 === G.field) { ready.delete(k0); ready.set(k0, f0); } else ready.delete(k0); }
      grow(f, x, z, r, limit);
      dbg.paths++;
      return f;
    }
    const f = (fields[which] ??= new Field(W));
    grow(f, x, z, r, limit);
    dbg.paths++;
    return f;
  };
  const grow = (f, x, z, r, limit) => {
    const cells = [];
    const n = Math.max(1, Math.round(r / W.C));
    for (let dz = -n; dz <= n; dz++) for (let dx = -n; dx <= n; dx++) {
      if (dx * dx + dz * dz > n * n + 0.5) continue;
      const c = W.cell(x + dx * W.C, z + dz * W.C);
      if (c >= 0 && W.cost[c]) cells.push(c);
    }
    if (!cells.length) { const c = W.nearest(x, z, 4); if (c >= 0) cells.push(c); }
    f.start(cells, limit);
    f.goalAt = { x, z };
    return f;
  };
  const fieldOf = (e) => aim('goal', e.x, e.z, e.leg && !isStop(e) ? 0.6 : rOf(e) * 0.7);
  /** A field already grown for e, if any (scoring never grows one). */
  const fieldIf = (e) => ready.get(keyOf(e.x, e.z));

  /* ---- the tour: an ordered chain of street waypoints (config.js ANIMALS.guide.tour); engagements are stops ---- */
  const isStop = (t) => !!(t?.leg?.id && t.leg.id !== 'gate');
  /** The leg's target: the engagement's own entry (its ring) for a stop, else the waypoint. */
  const legTarget = (k) => {
    const L = TOUR[k];
    if (!L) return null;
    if (L.id && L.id !== 'gate') { refresh(); const e = list.find((q) => q.id === L.id); return e ? { ...e, k, leg: L } : null; }
    return { x: L.x, z: L.z, id: L.id ?? null, k, leg: L };
  };
  const legDone = (k) => { const L = TOUR[k]; return !L || (!!L.visit && TB.visited.has(L.visit)) || (!!L.id && L.id !== 'gate' && (G.done.has(L.id) || !legTarget(k))); };   // ([tour-B] `visit` legs: a place you have been into)
  /** The first leg from `from` on that still wants doing. */
  const nextLeg = (from) => { let k = from; while (k < TOUR.length && legDone(k)) k++; return k; };
  /** Ahead of need: this leg's field and the next one's, one at a time while the pup isn't waiting on one. */
  const prefetch = () => {
    const k = nextLeg(G.leg ?? 0);
    for (const j of [k, nextLeg(k + 1)]) { const t = legTarget(j); if (t) queue.push(() => fieldOf(t)); }
    queue.push(() => aim('goal', NAP.x, NAP.z, 0.3));
  };
  let growing = null;
  /** How far you are from e along the way (a grown field's metres, else the crow's and a bit). */
  const wayTo = (e) => { const f = fieldIf(e); const m = f?.ready ? f.near(P.x, P.z) : INF; return m === INF ? dist(P, e) * 1.3 : m; };
  /** Which way you mean to go: your walk, or where you look when you stand. */
  const intent = () => {
    if (P.speed > 0.5) { const l = Math.hypot(P.vx, P.vz) || 1; return { x: P.vx / l, z: P.vz / l }; }
    const f = facing?.();
    return f && f.lengthSq() > 0.5 ? { x: f.x, z: f.z } : { x: P.hx, z: P.hz };
  };
  const angleOff = (dir, e) => { const dx = e.x - P.x, dz = e.z - P.z, d = Math.hypot(dx, dz) || 1; return Math.acos(THREE.MathUtils.clamp((dx * dir.x + dz * dir.z) / d, -1, 1)); };
  /** The nearest engagement not done, by the way from you (one you walked away from counts `D.skipped` m further). */
  const pickTarget = () => {
    refresh();
    let best = null, bd = INF;
    for (const e of list) {
      if (G.done.has(e.id)) continue;
      const d = wayTo(e) + (G.skipped.has(e.id) ? D.skipped : 0);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  };
  const startLead = (t) => {
    G.target = t; G.state = 'lead'; G.hopped = null; G.aside = null; G.since = 0; G.lostT = 0; G.offT = 0; G.waitD0 = null; G.minD = INF;
    if (t.id) G.skipped.delete(t.id);
    G.field = fieldOf(t);
  };
  /** Lead along the tour from leg k (skipping what is done). */
  const lead = (k) => {
    k = nextLeg(k);
    if (k >= TOUR.length) { leftovers(); return; }
    G.leg = k;
    startLead(legTarget(k));
    const n = legTarget(nextLeg(k + 1));
    if (n) queue.push(() => fieldOf(n));
  };
  /** After the tour: any engagement still not done (a skipped one), else the nap. */
  const leftovers = () => { G.leg = TOUR.length; const e = pickTarget(); if (e) startLead({ ...e, k: TOUR.length, leg: { id: e.id } }); else toGateOrNap(); };
  /** Everything done: the Deer Park gate last (Tan), if you haven't been; then the nap beside it. */
  const toGateOrNap = () => {
    const kg = TOUR.findIndex((L) => L.id === 'gate');
    if (kg >= 0 && !G.gateDone) { G.leg = kg; startLead(legTarget(kg)); return; }
    G.bed = null;
    goTo('nap', NAP, 0.3);
  };
  const advance = () => lead((G.leg ?? 0) + 1);
  const goTo = (state, p, r = 0.3) => { G.state = state; G.goal = p; G.field = aim('goal', p.x, p.z, r); G.since = 0; };
  /** The goal is cut off from here: aim instead at the reachable cell nearest it. */
  const nearestReach = (goal) => {
    const f = aim('follow', G.x, G.z, 0.3, 400);
    while (!f.ready) f.work(50);
    let best = -1, bd = INF;
    for (let i = 0; i < W.N; i++) {
      if (f.m[i] === INF) continue;
      const q = W.at(i), d = (q.x - goal.x) ** 2 + (q.z - goal.z) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
    if (best < 0) return null;
    const q = W.at(best);
    G.field = aim('goal', q.x, q.z, 0.3);
    return q;
  };
  const allDone = () => { refresh(); return list.every((e) => G.done.has(e.id)); };
  /** After a stop: the tour goes on; after the tour, the leftovers, then the nap. */
  const nextOrNap = () => advance();
  /** Whistled (or you walked back to it): to the nearest place you haven't been, at a run (Tan: "rush me to the next
   * spot I haven't covered"); the tour goes on from there. */
  const rushNext = () => {
    G.drops = 0;
    let e = pickTarget();
    if (!e) { toGateOrNap(); return; }
    /* (Tan, 2026-10-02: called to in the shopping street after the mochi shop, he made for the place nearest as the
     * crow flies and by the planner's cheapest way, down the lane behind, and ドンペン堂 was never passed.)  With the tour
     * under way it is the tour's own next stop, and by the tour's own streets from where you are (tourJoin); only a
     * place you are standing by (`near` m) comes before it. */
    const kN = TOUR.findIndex((L, j) => j >= (G.leg ?? 0) && L.id && L.id !== 'gate' && !G.done.has(L.id) && list.some((q) => q.id === L.id));
    let kE = TOUR.findIndex((L) => L.id === e.id);
    const onTour = kN >= 0 && (kE === kN || dist(P, e) > D.near);
    if (onTour && kE !== kN) { kE = kN; e = list.find((q) => q.id === TOUR[kN].id); }
    // ([tour-B] his home or the shrine first, if they come before it and you haven't been in)
    let k = tourRush(kE);
    if (onTour) k = tourJoin(k);
    if (k >= 0 && !TOUR[k].id) lead(k);
    else if (k >= 0) { G.leg = k; startLead(legTarget(k) ?? { ...e, k, leg: TOUR[k] }); }
    else { G.leg = TOUR.length; startLead({ ...e, k: TOUR.length, leg: { id: e.id } }); }
  };
  /** Your whistle (F): the two notes sound at you; Hachi answers once they are over (ears up meanwhile): a yip, and
   * it comes at a gallop, or, already beside you, a happy hop.  From very far it appears from the nearest corner
   * out of view.  A second press while one is pending, or within a second, does nothing (no stacked whistles or yips). */
  const whistle = () => {
    if (!W.built || G.whistleAt !== null || G.t - G.lastWhistle < 1.0) return false;
    soundBus.oneShot('whistle', { x: P.x, z: P.z, y: P.y, near: 4, far: 30, gain: 0.8, recipe: 'whistle' });
    G.lastWhistle = G.t; G.whistleAt = G.t + A.whistle.answer;
    // the way to you, grown over the notes (a frame's worth at a time), so the answer doesn't stall a frame
    const f = (fields.whistle ??= new Field(W));
    grow(f, P.x, P.z, 0.6, A.whistle.grow);
    return true;
  };
  /** Where to come from so you see it come (Tan: no popping up, no coming from behind): a street `from` [min, max] m
   * ahead of you, within `cone` degrees of the lens, hidden from you right now (behind a building's corner, a car, a
   * machine), whose way to you comes out into plain view within a few metres and runs at you from there (a way not
   * much longer than the straight line).  `f` is a field grown from you.  The middle of the view and of the range win.
   * With `hide` false it may be in plain view already (only as a far fallback: small and far, it reads as arriving). */
  const spotInView = (f, [d0, d1], cone, hide = true, mid = null, exitCone = 28, within = 5) => {
    const fc = facing?.();
    if (!fc || fc.lengthSq() < 0.5) return null;
    const cosC = Math.cos(cone * Math.PI / 180), cosE = Math.cos(exitCone * Math.PI / 180), dm = mid ?? (d0 + d1) / 2;
    let best = -1, bs = INF;
    for (let i = 0; i < W.N; i += 2) {
      const m = f.m[i];
      if (m > d1 * 1.5 + 4) continue;
      const q = W.at(i), dx = q.x - P.x, dz = q.z - P.z, d = Math.hypot(dx, dz);
      if (d < d0 || d > d1 || m > d * 1.5 + 4) continue;
      const c = (dx * fc.x + dz * fc.z) / d;
      if (c < cosC) continue;
      const sc = Math.abs(d - dm) / dm + 3 * (1 - c) + 0.3 * (m / d - 1);
      if (sc >= bs || !W.free(q.x, q.z)) continue;
      if (!hide) { if (!W.hidden(q.x, q.z, P.x, P.z)) { bs = sc; best = i; } continue; }
      if (!W.hidden(q.x, q.z, P.x, P.z)) continue;
      // out into view within 4 m of its way, then a clear run at you
      let k = i, walked = 0, out = false;
      for (let s2 = 0; s2 < 24 && walked < within; s2++) {
        const n = f.next(k);
        if (n < 0) break;
        const a = W.at(k), b = W.at(n);
        walked += Math.hypot(b.x - a.x, b.z - a.z); k = n;
        const ex = b.x - P.x, ez = b.z - P.z, e = Math.hypot(ex, ez) || 1;
        if ((ex * fc.x + ez * fc.z) / e > cosE && !W.hidden(b.x, b.z, P.x, P.z)) { out = true; break; }
      }
      if (out) { bs = sc; best = i; }
    }
    return best >= 0 ? W.at(best) : null;
  };
  /** Set it where you will see it come from (see spotInView); false if there is nowhere. */
  const enterView = (f, near, cone) => {
    const m = (near[0] + near[1]) / 2;
    const q = spotInView(f, near, cone)                         // hidden ahead, out into the middle of the view at once
      ?? spotInView(f, [5, 30], 70, true, m, 28, 10)            // hidden to a side, out into the middle within 10 m
      ?? spotInView(f, [5, 30], 70, true, m, 46, 12)            // round a corner at the edge of the view (its run swings in across it)
      ?? spotInView(f, [24, 40], 28, false)                     // far off and small, in plain view
      ?? offView(f);                                            // nowhere to be seen coming from: round a corner behind you
    if (!q) return false;
    setAt(q);
    // facing down its way already, and off at a run: no turning on the spot where it comes out
    const c = W.cell(q.x, q.z), n = c >= 0 ? f.next(c) : -1;
    if (n >= 0) { const b = W.at(n); G.yaw = Math.atan2(b.x - q.x, b.z - q.z); }
    G.speed = A.whistle.gallop * 0.8;
    return true;
  };
  /** The spot `d` m in front of you (where you look), on free ground: where it greets you and plays. */
  const frontSpot = (d) => {
    const fc = facing?.();
    const fx = fc && fc.lengthSq() > 0.5 ? fc.x : P.hx, fz = fc && fc.lengthSq() > 0.5 ? fc.z : P.hz;
    const c = W.nearest(P.x + fx * d, P.z + fz * d, 1.6);
    return c >= 0 ? W.at(c) : null;
  };
  /** Last resort: a street 12-30 m off by the way, out of your view (the old whistle's corner). */
  const offView = (f) => {
    const fc = facing?.();
    let best = -1, bd = INF;
    for (let i = 0; i < W.N; i++) {
      const mm = f.m[i];
      if (mm < 12 || mm > 30) continue;
      const q = W.at(i), dx = q.x - P.x, dz = q.z - P.z, d = Math.hypot(dx, dz) || 1;
      if (fc && (dx * fc.x + dz * fc.z) / d > 0.2 && !W.hidden(q.x, q.z, P.x, P.z)) continue;
      if (mm < bd) { bd = mm; best = i; }
    }
    return best >= 0 ? W.at(best) : null;
  };
  /** Can you see it now: near enough, in the lens, nothing between? */
  const inSight = (see, cone) => dist(P, G) <= see && inCone(cone) && W.sight(G.x, G.z, P.x, P.z);
  const setAt = (q) => { offBench(); G.jump = null; G.pop = null; G.gy = null; G.x = q.x; G.z = q.z; G.y = ground(G.x, G.z); G.speed = 0; G.yaw = Math.atan2(P.x - G.x, P.z - G.z); };
  /** Too far to run from where it is, or no way from there (QA, Tan: it ran in from in front of you out of nowhere,
   * having just been behind you): set on its own way to you, `hide` [min, max] m from you by the way, at the first
   * point of that way you can't see (behind you, off the side of your view by `view` degrees, or round a corner); else
   * a street on the side it really is, out of your sight.  `f` is a field grown from you.  Null if nowhere. */
  const comeFrom = (f) => {
    const W_ = A.whistle, [m0, m1] = W_.hide, fc = facing?.(), cosV = Math.cos(W_.view * Math.PI / 180);
    const look = fc && fc.lengthSq() > 0.5 ? fc : null;
    const unseen = (q) => {
      const dx = q.x - P.x, dz = q.z - P.z, d = Math.hypot(dx, dz) || 1;
      return !look || (dx * look.x + dz * look.z) / d < cosV || W.hidden(q.x, q.z, P.x, P.z);
    };
    // its way to you, traced down the field from where it is (from the bench's foot when it is up on the bench)
    const from = G.onBench ? NAP : G;
    let c = W.cell(from.x, from.z);
    if (c < 0 || f.m[c] === INF) c = W.nearest(from.x, from.z, 3, (i) => f.m[i] < INF);
    if (c >= 0) {
      const route = [];
      for (let k = 0; k < 6000 && c >= 0; k++) { route.push(c); c = f.next(c); }
      for (let i = route.length - 1; i >= 0; i--) {
        const m = f.m[route[i]];
        if (m < m0) continue;
        if (m > m1) break;
        const q = W.at(route[i]);
        if (unseen(q)) return q;
      }
    }
    // no way from there, or all of it in plain view: a street on its side of you that you can't see
    const gx = G.x - P.x, gz = G.z - P.z, gl = Math.hypot(gx, gz) || 1;
    let best = -1, bs = INF;
    for (let i = 0; i < W.N; i++) {
      const m = f.m[i];
      if (m < m0 || m > m1) continue;
      const q = W.at(i);
      const dx = q.x - P.x, dz = q.z - P.z, d = Math.hypot(dx, dz) || 1;
      const sc = 2 * (1 - (dx * gx + dz * gz) / (d * gl)) + m / m1;     // toward where it really is, and near
      if (sc >= bs || !unseen(q)) continue;
      bs = sc; best = i;
    }
    return best >= 0 ? W.at(best) : null;
  };
  const answer = () => {
    const t0 = performance.now();
    const dP = dist(P, G), W_ = A.whistle;
    G.act = null; G.roll = G.pitch = 0; FX.stop(); G.charge = null; G.snack = null;
    // already just in front of you: the greeting there; beside or behind you (under or out of your view), it bounds
    // out to the spot in front and greets you from there
    const fs0 = frontSpot(W_.near);
    if (fs0 && dist(G, fs0) < 1.2 && G.state !== 'nap' && G.state !== 'home') { say('dog-yip', 0.9, true, 30); greet(); return; }
    G.target = null; G.resume = null; G.drops = 0;
    G.state = 'come'; G.since = 0; G.thinkT = -9; G.waitT = 0; G.cameYip = false;
    const pre = fields.whistle;
    G.field = pre && pre.goalAt && dist(pre.goalAt, P) < 3 ? pre : aim('follow', P.x, P.z, 0.6, W_.grow); G.thinkT = 0;
    const f = G.field;
    while (!f.ready) f.work(50);          // (grown over the notes already: this finishes it, if anything)
    /* Near enough (`runFrom` m, `reach` m by the way): it runs from where it really is, at a sprint, by the way:
     * behind you, it comes from behind; round a corner, round the corner.  Only from farther (or with no way from
     * there) is it set on its way to you, out of your sight (comeFrom), and runs in from there. */
    const from = G.onBench ? NAP : G;
    G.cameFrom = 'here';
    if (!(dP <= W_.runFrom && f.near(from.x, from.z) <= W_.reach)) {
      const q = comeFrom(f);       // 1-4 ms
      if (q) {
        setAt(q);
        // facing down its way already, and off at a run: no turning on the spot where it comes out
        const c = W.cell(q.x, q.z), n = c >= 0 ? f.next(c) : -1;
        if (n >= 0) { const b = W.at(n); G.yaw = Math.atan2(b.x - q.x, b.z - q.z); }
        G.speed = W_.gallop;
        G.cameFrom = 'placed';
      }
    }
    // the yip, from where it is (the answer carries, you called it; from beyond 30 m you don't hear it, and it yips
    // again as it comes up to you)
    say('dog-yip', 0.9, true, 30);
    dbg.answerMs = performance.now() - t0;
  };
  /** Arrived at your whistle (or already beside you): the greeting. */
  const greet = () => {
    G.state = 'caught'; G.since = 0;
    play('greet', { yaw0: Math.atan2(P.x - G.x, P.z - G.z), s: Math.random() < 0.5 ? 1 : -1 });
  };
  /** The Strong Nine going to its head, anywhere (dev, and the old hook): the konbini's bit for it, from the hiccups on,
   * just in front of you (see `snack` below). */
  const tipsy = () => snack('done', 'strong_nine');
  GUIDE.tipsy = tipsy;
  /** Its hello, for main.js's view: where its head is while it runs in front of you and says hello, else null. */
  const _head = { x: 0, y: 0, z: 0 };
  GUIDE.greeting = () => {
    if (G.state !== 'intro' || !(G.introSaid || (inCone(40) && dist(P, G) < 12))) return null;
    _head.x = G.x; _head.z = G.z; _head.y = G.y + 0.3;
    return _head;
  };
  GUIDE.whistle = whistle;

  /* ---- a show to watch (world/mochi/: ぺったん堂's mochi pounding).  The show's own code calls these; nothing else
   * here knows about it.  GUIDE.watchShow({ seat, at }) while it plays (world points; null when it is over): if the
   * pup is free (leading, waiting, lingering) and within `reach` m it trots to `seat`, sits facing `at` and watches,
   * its tour paused where it was.  GUIDE.showCue(kind): 'hit' a bob of the head, 'big' a startle where it sits, 'end' a happy wiggle,
   * 'treat' it looks up for what is thrown, 'catch' it has it (and sneezes).  GUIDE.where(): where it is, and
   * whether it is sat watching.  Only poses and acts the rig already has. ---- */
  const SHOW = { on: null, nod: 0, back: 0, wag: 0, up: 0, sat: false };
  GUIDE.watchShow = (o) => { SHOW.on = o; if (!o) SHOW.sat = false; };
  GUIDE.showCue = (kind) => {
    if (!SHOW.sat) return;
    if (kind === 'hit') { SHOW.nod = 1; G.nod += 0.24; }          // (a nudge on the eased value: the bob reads at once)
    // (the reactions layer, animals/reactions.js: a startle where he sits at the cheer, never over his sneeze; a
    // happy wiggle at the bow; the kinako's sneeze)
    else if (kind === 'big') { if (FX.is('sneeze')) return; G.act = null; FX.stop(); FX.play('startle', { seated: true }); }
    else if (kind === 'end') { SHOW.wag = 2.6; if (!FX.busy) FX.play('happyWiggle', { seated: true, s: 1 }); }
    else if (kind === 'treat') SHOW.up = 0.9;
    else if (kind === 'catch') { SHOW.up = 0; SHOW.wag = 1.2; G.act = null; FX.stop(); FX.play('sneeze'); }
  };
  const _where = { x: 0, y: 0, z: 0, watching: false };
  GUIDE.where = () => { _where.x = G.x; _where.y = G.y; _where.z = G.z; _where.watching = SHOW.sat; return _where; };
  /** Where the tour stands (the phone's guide line and its follow-Hachi walk): the next stop not had (its tour leg's
   *  `id` or `visit`, and where), how many of the stops are had, how many there are, his state and target. */
  GUIDE.tourInfo = () => {
    const stops = TOUR.filter((L) => (L.id && L.id !== 'view') || L.visit);
    const had = stops.filter((L) => (L.visit ? TB.visited.has(L.visit) : G.done.has(L.id))).length;
    let next = null;
    for (let k = Math.max(0, G.leg ?? 0); k < TOUR.length; k++) { const L = TOUR[k]; if (((L.id && L.id !== 'view') || L.visit) && !(L.visit ? TB.visited.has(L.visit) : G.done.has(L.id))) { next = L; break; } }
    return { next: next ? (next.visit ?? next.id) : null, had, of: stops.length, state: G.state, target: G.target ? { x: G.target.x, z: G.target.z, id: G.target.id ?? null } : null, over: !!G.gateDone };
  };
  /** The pup's frame while it watches: returns how it moved ('still' | 'moving' ...), or null when it isn't watching. */
  const showStep = (dt, pose) => {
    const o = SHOW.on;
    if (!o || !['lead', 'atSpot', 'linger', 'wait'].includes(G.state) || dist(G, o.seat) > (o.reach ?? 14)) { SHOW.sat = false; return null; }
    SHOW.nod = Math.max(0, SHOW.nod - dt * 5); SHOW.back = Math.max(0, SHOW.back - dt); SHOW.wag = Math.max(0, SHOW.wag - dt); SHOW.up = Math.max(0, SHOW.up - dt);
    // its seat; for a moment after the cheer, half a metre further back
    const ax = o.seat.x - o.at.x, az = o.seat.z - o.at.z, al = Math.hypot(ax, az) || 1;
    const q = SHOW.back > 0.7 ? { x: o.seat.x + (ax / al) * 0.5, z: o.seat.z + (az / al) * 0.5 } : o.seat;
    let r = 'still';
    const off = dist(G, q);
    if (off > 0.15 && !FX.holding) r = move(dt, q, off > 1.5 ? A.trot : 1.3);
    SHOW.sat = dist(G, o.seat) < 1.0;
    if (r !== 'moving') G.yaw += turn(G.yaw, Math.atan2(o.at.x - G.x, o.at.z - G.z)) * Math.min(1, dt * 6);
    pose.posture = SHOW.sat && r !== 'moving' && SHOW.back <= 0 ? 1 : 0;
    pose.look = 0;
    pose.nod = -0.14 + 0.36 * SHOW.nod - 0.32 * Math.min(1, SHOW.up * 4);
    pose.wag = SHOW.wag > 0 ? 1 : 0.35;
    pose.perk = SHOW.wag > 0 || SHOW.up > 0 ? 1.3 : 1;
    return r;
  };
  /** "Not interested": it stops and waits where it is (the leg counts as skipped); a tilt of the head, "okay". */
  const drop = () => {
    if (G.target?.id && G.target.id !== 'gate') G.skipped.add(G.target.id);
    G.drops++; G.dropT = G.t; G.dropAt = { x: G.x, z: G.z };
    G.state = 'wait'; G.field = null; G.since = 0; G.waitT = 0; G.act = null; G.speed = 0;
    play('tilt');
  };
  /** Somewhere free beside the ring, off the line you come in on. */
  const beside = (e) => {
    const r = rOf(e) + 0.9;
    let best = null, bd = INF;
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      const q = { x: e.x + Math.sin(a) * r, z: e.z + Math.cos(a) * r };
      if (!W.free(q.x, q.z) || !W.sight(e.x, e.z, q.x, q.z) || !flat(q.x, q.z)) continue;   // (on level ground: he sits there)
      // not between you and the spot: keep at least a metre off the line you come in on
      const ux = P.x - e.x, uz = P.z - e.z, L = Math.hypot(ux, uz) || 1;
      const along = ((q.x - e.x) * ux + (q.z - e.z) * uz) / L;
      const off = Math.abs((q.x - e.x) * uz - (q.z - e.z) * ux) / L;
      if (along > 0 && off < 1.2) continue;
      const d = dist(q, G) + (along > 0 ? 1 : 0);
      if (d < bd) { bd = d; best = q; }
    }
    return best ?? { x: e.x, z: e.z };
  };
  /** Player on a famous view, and is the pup in the picture? */
  const onView = () => heroes.some((h) => dist(P, h) < 1.4);
  /** Is Hachi within `deg` of the middle of your view? */
  const inCone = (deg) => {
    const f = facing?.();
    if (!f || f.lengthSq() < 0.5) return false;
    const dx = G.x - P.x, dz = G.z - P.z, d = Math.hypot(dx, dz) || 1;
    return (dx * f.x + dz * f.z) / d > Math.cos(deg * Math.PI / 180);
  };
  /* the introduction's caption: a small card just above where it sits in your view (the view eases down to it, so it
   * sits in the lower third: a card lower would cover it), two lines, fades by itself */
  let cardEl = null, cardT = -1;
  const showCard = () => {
    if (typeof document === 'undefined') return;
    if (!cardEl) {
      cardEl = document.createElement('div');
      cardEl.id = 'hachi-card';
      cardEl.setAttribute('aria-live', 'polite');
      cardEl.style.cssText = 'position:fixed;left:50%;bottom:36%;transform:translateX(-50%) translateY(6px);z-index:7;pointer-events:none;'
        + 'max-width:min(560px,86vw);padding:11px 20px 12px;border-radius:14px;background:rgba(24,20,34,.74);color:#fff6e6;'
        + 'font:500 16px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;text-align:center;'
        + 'box-shadow:0 6px 24px rgba(0,0,0,.25);opacity:0;transition:opacity .45s ease,transform .45s ease;';
      const a = document.createElement('div'); a.style.cssText = 'font-weight:700;font-size:18px;margin-bottom:2px;'; a.textContent = STRINGS.hachi.hi;
      const b = document.createElement('div'); b.style.cssText = 'opacity:.92;'; b.textContent = STRINGS.hachi.line;
      cardEl.append(a, b);
      document.body.appendChild(cardEl);
    }
    requestAnimationFrame(() => { cardEl.style.opacity = '1'; cardEl.style.transform = 'translateX(-50%)'; });
    cardT = 0;
  };
  const tickCard = (dt) => {
    if (cardT < 0 || !cardEl) return;
    cardT += dt;
    if (cardT > A.introCard) { cardEl.style.opacity = '0'; cardEl.style.transform = 'translateX(-50%) translateY(6px)'; cardT = -1; }
  };
  const inFrame = () => {
    const f = facing?.();
    if (!f || f.lengthSq() < 0.5) return true;
    const dx = G.x - P.x, dz = G.z - P.z, d = Math.hypot(dx, dz) || 1;
    return (dx * f.x + dz * f.z) / d > Math.cos(1.05);      // 60 degrees either side of the lens
  };

  /* ---- placing ---- */
  /* (rolled over, the pup turns about a centre at the body's height, not about its feet; and whatever way up it is, it
   * rests ON the ground (Tan: tipsy and rolling, it sank under the road): `rollLift` is that centre's height, and how
   * much more it must come up for nothing to go under, from the measured tables in config.js (`rollUp`)) */
  const rollLift = (roll, posture) => {
    let a = Math.abs(roll) % (2 * Math.PI);
    if (a > Math.PI) a = 2 * Math.PI - a;
    if (a < 1e-4) return [0, 0];
    const U = A.rollUp, f = a / U.step, i = Math.min(U.lie.length - 2, Math.floor(f)), k = Math.min(1, f - i), lie = Math.max(0, Math.min(1, posture - 1));
    const up = (t) => t[i] + (t[i + 1] - t[i]) * k;
    // (+ 9 mm lying and rolled: the tables were measured over the 12 mm a lying pup then had; postureUp gives it 3)
    return [a < 0.3 ? 0 : BODY_R * ease((a - 0.3) / 0.6), up(U.stand) + (up(U.lie) - up(U.stand)) * lie + 0.009 * lie * Math.min(1, a / 0.3)];
  };
  /** How far the pup must come up in a posture (-1 bow, 0 stand, 1 sit, 2 lie) for its lowest part to rest ON the ground. */
  const postureUp = (p) => {
    const U = A.postureUp, f = THREE.MathUtils.clamp((p - U.from) / U.step, 0, U.up.length - 1), i = Math.min(U.up.length - 2, Math.floor(f));
    return U.up[i] + (U.up[i + 1] - U.up[i]) * (f - i);
  };
  const place = () => {
    const X = FX.out;
    // a reaction's step aside (only onto ground it may stand on) and its turn on the spot
    const yawG = G.yaw + X.dyaw;
    let gx = G.x, gz = G.z;
    if ((X.fwd || X.side) && W.built) {
      const nx = G.x + Math.sin(yawG) * X.fwd + Math.cos(yawG) * X.side, nz = G.z + Math.cos(yawG) * X.fwd - Math.sin(yawG) * X.side;
      if (W.free(nx, nz) && Math.abs(ground(nx, nz) - ground(G.x, G.z)) < 0.03) { gx = nx; gz = nz; }
    }
    const l = ctx.toLocal({ x: gx, z: gz });
    const yaw = yawG + turned;
    const roll = G.roll + X.roll, posture = X.posture;
    const [cy, more] = rollLift(roll, posture);
    const ox = Math.sin(roll) * cy, oy = cy - Math.cos(roll) * cy + more;
    // (lying, the belly rests on the ground: the pose's posture may be a reaction's, not the one G.y was worked out for)
    // (and tipped back on its haunches or nose-down, the low end stays on the ground)
    // (on its back its paws go, but that is no trot: the stride's bob stays out of it)
    // (sat, lying or bowing, its lowest part rests on the ground: `postureUp`, measured: scripts/_hachi.mjs --only posture)
    // (lying with its head down, asleep: the chin rests on the ground, not in it: 12 cm up a radian of nod past 0.1)
    // (and in a bow with its nose down at something, the ball in its garden, the nose)
    const chin = Math.max(0, Math.min(1, posture - 1)) * Math.min(0.034, Math.max(0, (X.nod - 0.1) * 0.12)) * Math.abs(Math.cos(roll))
      + Math.max(0, -posture) * 0.08 * Math.max(0, X.nod);
    const y = G.y - (G.bob ?? 0) * Math.min(1, Math.abs(roll)) + X.dy + A.tipLift * Math.abs(G.pitch + X.pitch) + postureUp(posture) + chin;
    herd.set(0, l.x + ox * Math.cos(yaw), y + oy, l.z - ox * Math.sin(yaw), yaw, G.pitch + (G.bpitch ?? 0) + X.pitch, roll, A.size);
    // (on its side a turn of the head is a turn into the ground: it looks about on its feet or on its back)
    herd.setPose(0, G.ph, X.amp, X.look * Math.abs(Math.cos(roll)), X.nod);
    herd.setPose2(0, posture, X.wag, X.perk, X.tilt);
    herd.setPoseN(0, 0, X.c[0], X.c[1], X.c[2], X.c[3]);
    herd.setPoseN(1, 0, X.d[0], X.d[1], X.d[2], X.d[3]);
    herd.setPoseN(2, 0, X.e[0], X.e[1], X.e[2], 0);
    herd.flush();
    const sit = Math.max(0, Math.min(1, posture)), lie = Math.max(0, posture - 1), bow = Math.max(0, -posture);
    shadows.set(shadow, l.x + Math.sin(yaw) * 0.02, G.sy ?? G.y - G.hop, l.z + Math.cos(yaw) * 0.02, SHADOW[0] * (1 + 0.5 * lie + 0.1 * (cy > 0 ? 1 : 0)) * A.size, SHADOW[1] * (1 - 0.25 * sit + 0.2 * lie + 0.15 * bow) * A.size, yaw);
  };
  /** The pose as the guide has it, through the face and the reactions, ready to draw (`still`: a staged frame). */
  const _B = {}, _E = {};
  const express = (dt, face, toYou = 0, nodYou = 0, asleep = false) => {
    _B.look = G.look; _B.nod = G.nod; _B.tilt = G.tilt; _B.posture = G.posture; _B.perk = G.perk; _B.amp = G.amp; _B.ph = G.ph;
    _B.wag = G.wag; _B.wagAmp = G.wagA; _B.wagRate = G.wagRate ?? 8;
    _E.toYou = toYou; _E.nodYou = nodYou; _E.face = face; _E.asleep = asleep; _E.now = NOW;
    return FX.step(dt, _B, _E);
  };
  /* the ground under him: the drawn surface (ctx.js surfaceAt: the platforms, the slopes of the dropped kerbs, and the
   * asphalt, lawns and pads drawn a little over the ground plane), not the walker's stepped heightAt */
  const ground = (x, z) => { const p = ctx.toLocal({ x, z }); return ctx.surfaceAt(p.x, p.z); };
  /** Level ground `r` m round (x, z)?  (Where he may sit, lie, roll or tear about: not half over a kerb or a step.) */
  const flat = (x, z, r = 0.3) => {
    const h = ground(x, z);
    for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; if (Math.abs(ground(x + Math.sin(a) * r, z + Math.cos(a) * r) - h) > 0.025) return false; }
    return true;
  };

  /* ---- steps and kerbs (Tan, 2026-10-02: "when he goes up or down a stair step, or between the footpath and the road,
   * he must JUMP: a quick anticipation crouch, a hop arc with ears flopping, a small landing squash; for stair flights
   * a rhythmic hop per step (or two steps at a time when running); never sliding up a riser or dropping instantly").
   * move() looks along his way for the first edge (the ground's height changing by `min` m or more between two
   * points 4 cm apart: a slope is no edge); he dips, leaves the ground short of it and comes down past it, on the
   * first stretch long enough to land on (a kerb stone or a wheel stop is cleared whole).  A flight goes tread by
   * tread, a hop each with no crouch between (the rhythm), two treads a hop at a run.  Whatever else takes him over
   * an edge (a lap of zoomies, his garden's bits) gets the `pop` in update(): a little hop, never a snap. ---- */
  const JP = A.jump, DS = 0.04, _prof = new Float32Array(48);
  const NOW = { crouch: 0 };           // expression channels set this frame, not eased (reactions.js env.now)
  /** The first edge along (ux, uz) from (x, z), within `reach` m: how far (m, to the first point past it); else 0. */
  const edgeAhead = (x, z, ux, uz, reach, h0) => {
    let was = h0;
    for (let s = DS; s <= reach + 1e-6; s += DS) { const h = ground(x + ux * s, z + uz * s); if (Math.abs(h - was) >= JP.min) return s; was = h; }
    return 0;
  };
  /** A hop over the edge ahead on his way along (ux, uz) to a point `d` m off, if there is one: true when it began. */
  const tryJump = (ux, uz, d) => {
    if (G.jump || G.lift || G.onBench || G.hopOff) return false;
    const h0 = ground(G.x, G.z);
    const es = edgeAhead(G.x, G.z, ux, uz, Math.min(d, JP.look + G.speed * JP.lookV), h0);
    if (!es) return false;
    // the ground's profile along the way, and the stretch he comes down on
    const P_ = _prof, N = P_.length;
    for (let i = 0; i < N; i++) P_[i] = i ? ground(G.x + ux * i * DS, G.z + uz * i * DS) : h0;
    const edge = (i) => i < N && Math.abs(P_[i] - P_[i - 1]) >= JP.min;
    let i = Math.round(es / DS), j, two = false, tread = false;
    for (;;) {
      j = i + 1;
      while (j < N && !edge(j)) j++;
      tread = j < N && (j - i) * DS < 0.62 && Math.sign(P_[j] - P_[j - 1]) === Math.sign(P_[i] - P_[i - 1]);   // another riser the same way after it
      if (j >= N || (j - i) * DS >= JP.run) {
        if (tread && !two && G.speed > JP.two && Math.abs(P_[j] - h0) <= A.step) { two = true; i = j; continue; }
        break;
      }
      i = j;                                             // too short to land on: over it
      if (i * DS > 1.1) return false;
    }
    let s1 = tread ? (i + (j - i) / 2) * DS : i * DS + Math.min(JP.land + G.speed * JP.landV, j < N ? (j - i) * DS / 2 : 9);
    if (s1 > d) s1 = Math.max(d, i * DS + 0.1);          // (no farther than where he is going, but clear of the edge)
    const x1 = G.x + ux * s1, z1 = G.z + uz * s1, h1 = ground(x1, z1);
    let top = Math.max(h0, h1);
    for (let k = 1; k * DS < s1; k++) top = Math.max(top, P_[k]);
    if (Math.abs(h1 - h0) > A.step + 0.05 || top - Math.min(h0, h1) > 0.6 || !W.free(x1, z1) || railShut(x1, z1)) return false;
    const chained = G.t - (G.landedAt ?? -9) < 0.25;
    G.jump = {
      x0: G.x, z0: G.z, x1, z1, h0, h1, y: h0, t: 0, flight: tread || chained,
      crouch: chained || es < 0.16 ? 0 : JP.crouch,
      air: THREE.MathUtils.clamp(s1 / Math.max(G.speed, 1.5), JP.air[0], JP.air[1]),
      rise: top - Math.max(h0, h1) + JP.arc * (tread || chained ? 0.75 : 1) + 0.2 * Math.abs(h1 - h0),
    };
    return true;
  };
  /** The hop's frame: along its line at an even pace; the dip, then up and over, nose up and then down, ears back. */
  const jumpStep = (dt, pose) => {
    const j = G.jump;
    j.t += dt;
    const k = Math.min(1, j.t / (j.crouch + j.air));
    const x = j.x0 + (j.x1 - j.x0) * k, z = j.z0 + (j.z1 - j.z0) * k;
    G.moved += Math.hypot(x - G.x, z - G.z); G.x = x; G.z = z;
    pose.amp = 0.3; pose.perk = 0.55; pose.wag = 0.5; pose.bound = 0; pose.posture = 0;
    if (j.t < j.crouch) { NOW.crouch = 0.9 * Math.sin(Math.PI * 0.5 * j.t / j.crouch); G.pitch = G.pitchTo = 0.07; j.y = Math.max(j.h0, ground(x, z)); return; }
    const v = Math.min(1, (j.t - j.crouch) / j.air), up = j.h1 >= j.h0;
    // (up: at the higher level before his middle is over the edge; down: he keeps the higher level until he is past it)
    // (and never under what he is over: an edge met at his very feet)
    j.y = Math.max(ground(x, z), j.h0 + (j.h1 - j.h0) * (up ? ease(v / 0.6) : ease((v - 0.4) / 0.6)) + j.rise * Math.sin(Math.PI * v));
    G.pitch = G.pitchTo = -JP.pitch * (j.flight ? 0.6 : 1) * Math.cos(Math.PI * v) + (up ? -0.06 : 0.08);
    pose.face = { earsBack: 0.9 * Math.sin(Math.PI * Math.min(1, v * 1.3)), paws: 0.6 * Math.sin(Math.PI * v), mouth: 0.2 };
    NOW.crouch = Math.max(0, 0.9 * (1 - v * 5));
    if (v >= 1) { G.x = j.x1; G.z = j.z1; G.jump = null; G.landedAt = G.t; G.landT = 0; G.landK = j.flight ? 0.45 : 0.75; }
  };

  /* ---- moving along a field ---- */
  const steer = (dt, wantSpeed) => {
    const f = G.field;
    if (!f || !f.ready) { G.speed = 0; return 'thinking'; }
    const c = W.cell(G.x, G.z);
    if (c < 0 || !W.cost[c] || f.m[c] === INF) {
      // off the field: to the nearest cell that is on it
      const n = W.nearest(G.x, G.z, 3, (i) => f.m[i] < INF);
      if (n < 0) { G.speed = 0; return 'lost'; }
      const q = W.at(n);
      if (dist(q, G) > 0.2) return move(dt, q, Math.min(wantSpeed, A.trot));
      return 'ok';
    }
    if (f.m[c] < W.C * 0.9) { G.speed = 0; return 'there'; }
    // the way down: as far along it as is in plain sight, up to a few metres
    let cur = c, way = W.at(c), steps = 0;
    for (;;) {
      const n = f.next(cur);
      if (n < 0 || ++steps > 16) break;
      const q = W.at(n);
      if (!W.sight(G.x, G.z, q.x, q.z)) break;
      way = q; cur = n;
      if (dist(q, G) > Math.max(2.5, wantSpeed * 0.5)) break;      // (farther at a sprint: it slows to arrive at the point it aims for)
    }
    // never through you: bend round when you are close to the line
    const dxp = P.x - G.x, dzp = P.z - G.z, dp = Math.hypot(dxp, dzp);
    if (dp < 1.6 && dp > 0.01) {
      const wx = way.x - G.x, wz = way.z - G.z, wl = Math.hypot(wx, wz) || 1;
      const side = (wx * dzp - wz * dxp) / (wl * dp);
      if (Math.abs(side) < 0.6 && (wx * dxp + wz * dzp) > 0) {
        const s = side >= 0 ? -1 : 1;
        const q = { x: way.x + (-wz / wl) * s * 1.0, z: way.z + (wx / wl) * s * 1.0 };
        if (W.free(q.x, q.z) && W.sight(G.x, G.z, q.x, q.z)) way = q;
      }
    }
    return move(dt, way, wantSpeed);
  };
  const move = (dt, to, wantSpeed, turnRate = 5) => {
    const dx = to.x - G.x, dz = to.z - G.z, d = Math.hypot(dx, dz);
    if (d < 0.05) { G.speed = 0; return 'there'; }
    const want = Math.atan2(dx, dz);
    const dyaw = turn(G.yaw, want);
    const rate = turnRate * dt;
    G.yaw += Math.abs(dyaw) < rate ? dyaw : Math.sign(dyaw) * rate;
    // a sharp turn is made on the spot; then on, slowing to arrive
    if (Math.abs(dyaw) > 1.0) { G.speed *= Math.max(0, 1 - dt * 8); return 'moving'; }
    const v = Math.min(wantSpeed * (Math.abs(dyaw) > 0.5 ? 0.5 : 1), Math.max(0.6, d * 2.5));
    G.speed += (v - G.speed) * Math.min(1, dt * 5);
    const s = G.speed * dt;
    // a step or a kerb on the way: the hop takes it (jumpStep, from the next frame); not yet facing the way, he turns
    // first rather than slide over the edge sideways
    if (Math.abs(dyaw) < 0.35) { if (tryJump(dx / d, dz / d, d)) { G.yaw = want; return 'moving'; } }
    else if (edgeAhead(G.x, G.z, Math.sin(G.yaw), Math.cos(G.yaw), s + 0.1, ground(G.x, G.z))) { G.speed *= Math.max(0, 1 - dt * 8); return 'moving'; }
    let nx = G.x + Math.sin(G.yaw) * s, nz = G.z + Math.cos(G.yaw) * s;
    if (!W.free(nx, nz)) { nx = G.x + (dx / d) * s; nz = G.z + (dz / d) * s; }      // straight at it, then
    if (W.free(nx, nz) && !railShut(nx, nz)) { G.moved += Math.hypot(nx - G.x, nz - G.z); G.x = nx; G.z = nz; G.stall = 0; }   // ([tour-B] railShut: never onto the level crossing while it is shut)
    else {
      G.speed = 0;
      // held against something for a while: back to the middle of its own cell
      if ((G.stall = (G.stall ?? 0) + dt) > 1.5) { const c = W.cell(G.x, G.z); if (c >= 0 && W.cost[c]) { const q = W.at(c); G.x = q.x; G.z = q.z; } G.stall = 0; }
    }
    return 'moving';
  };
  /** After you: straight at you when you are in plain sight, else down a field grown from where you are
   * (re-grown only once the last one is ready and you have moved on, so it never stands "thinking" while you walk). */
  const pursue = (dt, speed) => {
    const dP = dist(P, G);
    if (dP < 14 && W.sight(G.x, G.z, P.x, P.z)) { G.field = null; return move(dt, P, speed); }
    const f = fields.follow;
    const stale = !f || !f.goalAt || (f.ready && (dist(f.goalAt, P) > 3 || G.since - G.thinkT > 2.5)) || dist(f.goalAt, P) > 12;
    if (stale) { G.field = aim('follow', P.x, P.z, 0.6, Math.min(90, dP * 2 + 20)); G.thinkT = G.since; }
    else G.field = f;
    return steer(dt, speed);
  };
  /** A step of `s` metres along `yaw`, only onto free ground. */
  const stepAlong = (yaw, s) => {
    const nx = G.x + Math.sin(yaw) * s, nz = G.z + Math.cos(yaw) * s;
    if (!W.free(nx, nz)) return false;
    G.moved += s; G.x = nx; G.z = nz; return true;
  };
  /** Room for a circle of radius r about (cx, cz), all of it on one level (no lap over a kerb)? */
  const roomFor = (cx, cz, r) => { const h = ground(cx, cz); for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2, x = cx + Math.sin(a) * r, z = cz + Math.cos(a) * r; if (!W.free(x, z) || Math.abs(ground(x, z) - h) > 0.025) return false; } return true; };

  /* ---- the acts: the pup's little performances (Tan: "roll on the floor, jump around, and so on") ----
   * Each runs for `dur` seconds and shapes the pose that frame; the moving
   * ones (zoomies, chasing its tail, the circle round your legs) move it too.
   * Which one, and when, comes from its energy and how near you are. */
  const ACTS = {
    bow: 2.2, roll: 4.2, tail: 2.8, zoom: 3.4, hop: 0.6, sneeze: 1.1, shake: 0.7, tilt: 1.6, trip: 0.8, greet: 3.8,
  };
  const play = (name, extra = {}) => {
    if (G.act && G.act.name === name) return false;
    G.act = { name, t: 0, dur: ACTS[name], ...extra };
    G.last = name;
    G.idleT = 0;
    if (name === 'bow') { say('dog-yip', 0.8); G.energy -= 0.05; }
    else if (name === 'roll') { G.energy -= 0.12; }
    else if (name === 'tail') { say('dog-yip', 0.7); G.energy -= 0.3; }
    else if (name === 'zoom') { say('dog-awoo', 0.8, true); G.energy -= 0.45; }
    else if (name === 'hop') { G.hopT = 0; G.energy -= 0.04; if (Math.random() < 0.5) say('dog-yip', 0.7); }
    else if (name === 'sneeze') {}
    else if (name === 'shake') { G.shakeT = 0; say('dog-shake', 0.7); }
    else if (name === 'tilt') { G.tiltT = 0; G.tiltSide = Math.random() < 0.5 ? -1 : 1; if (Math.random() < 0.5) say('dog-hmm', 0.7); }
    else if (name === 'trip') { G.energy -= 0.02; }
    return true;
  };
  /** An idle act, chosen by mood: playful near you, restful when tired, never the same twice running. */
  const idle = (dP, resting) => {
    if (FX.busy) return;
    if (!flat(G.x, G.z)) { G.last = 'none'; return; }      // (by a kerb or on a step: no rolling about half over the edge)
    const near = THREE.MathUtils.clamp(1.5 - dP / 5, 0, 1), E = G.energy;
    const w = {
      // (reactions.js: front paws pattering, a grin up at you, nose to the ground, a lick of the lips)
      tippyTaps: 0.5 * near * E, bigSmile: G.posture > 0.6 && dP < 6 ? 0.5 : 0, sniff: G.posture < 0.5 ? 0.4 : 0, lick: dP < 6 ? 0.2 : 0,
      roll: dP < 4 ? 1.1 * near + 0.2 : 0,
      tail: E > 0.55 ? 0.7 * E : 0,
      zoom: E > 0.7 && dP > 1.8 ? 0.6 * (E - 0.4) * (0.5 + near) : 0,
      bow: dP < 6 ? 0.8 * near : 0,
      hop: 0.6 * near * E,
      sneeze: 0.22,
      shake: 0.18,
      tilt: G.posture > 0.6 && dP < 8 ? 1.0 : 0.3,
      none: resting ? 1.6 : 0.8,
    };
    if (G.last && w[G.last]) w[G.last] = 0;
    let sum = 0;
    for (const k in w) sum += w[k];
    let r = Math.random() * sum;
    for (const k in w) { if ((r -= w[k]) <= 0) { if (k === 'none') { G.last = 'none'; return; } if (k === 'zoom') { zoomies(); return; } if (!ACTS[k]) { G.last = k; G.idleT = 0; FX.play(k); return; } play(k); return; } }
  };
  /** Zoomies: a happy tearing circle, where there is room. */
  const zoomies = () => {
    const R = A.zoom.r, centre = (s) => ({ x: G.x + Math.cos(G.yaw) * -s * R, z: G.z + Math.sin(G.yaw) * s * R });   // the centre off to one side
    // (waiting where you left it, the side that keeps it there: lap after lap it drifted off down the street)
    const sides = G.state === 'wait' && G.dropAt && dist(centre(-1), G.dropAt) < dist(centre(1), G.dropAt) ? [-1, 1] : [1, -1];
    for (const s of sides) {
      const { x: cx, z: cz } = centre(s);
      if (G.state === 'wait' && G.dropAt && dist({ x: cx, z: cz }, G.dropAt) > R + 0.4) continue;
      if (roomFor(cx, cz, R)) { play('zoom', { cx, cz, R, s, a: Math.atan2(G.x - cx, G.z - cz) }); return true; }
    }
    G.last = 'zoom';
    return false;
  };
  /** Zoomies with you at the centre (you've just arrived): a lap round you, if there is room. */
  const zoomRound = () => {
    const R = A.zoom.r;
    if (!roomFor(P.x, P.z, R)) return zoomies();
    const a = Math.atan2(G.x - P.x, G.z - P.z);
    play('zoom', { cx: P.x, cz: P.z, R, s: Math.random() < 0.5 ? 1 : -1, a, you: true });
    return true;
  };
  /** The act's frame: returns true while it owns the pup's movement. */
  const act = (dt, pose) => {
    const a = G.act;
    if (!a) return false;
    a.t += dt;
    const u = a.t / a.dur;
    if (u >= 1) { G.act = null; G.roll = 0; G.pitch = 0; return false; }
    switch (a.name) {
      case 'bow':
        pose.posture = -1; pose.wag = 0.7; pose.perk = 1.3; pose.look = pose.toYou; pose.nod = -0.15;
        // the rump wiggles a touch
        G.rollTo = 0.04 * Math.sin(a.t * 14);
        return true;
      case 'roll': {
        // down, over onto the back, a wiggle with the paws in the air, and up again
        const over = ease((u - 0.18) / 0.2) * (1 - ease((u - 0.8) / 0.16));
        pose.posture = 2 * Math.min(1, ease(u / 0.18) + over) * (u < 0.85 ? 1 : 1 - ease((u - 0.85) / 0.15));
        pose.posture = Math.max(pose.posture, 2 * over);
        const wig = over * Math.sin(a.t * 9) * 0.35;
        // (over only once it is down: half-sat and upside down, its rump went under the ground)
        G.rollTo = (Math.PI + wig) * over * ease((G.posture - 1) / 0.7);
        pose.amp = Math.abs(G.roll) > 2.3 ? over * 0.7 : 0; pose.phRate = 13 * over;      // (the paws go once it is on its back: on its side they went into the ground)
        pose.wag = 0.6; pose.perk = 0.4 + 0.5 * (1 - over); pose.look = over > 0.5 ? 0.6 * Math.sin(a.t * 3) : pose.toYou; pose.nod = -0.2 * over;
        if (!a.said && u > 0.32) { a.said = true; say('dog-snort', 0.7, true); }
        return true;
      }
      case 'tail': {
        // round and round after its own tail, on a tight circle
        const s = a.s ?? (a.s = Math.random() < 0.5 ? 1 : -1);
        G.yaw += s * 5.2 * dt; pose.posture = 0;
        stepAlong(G.yaw, 0.55 * dt);
        pose.amp = 0.9; pose.phRate = 14; pose.look = -s * 1.35; pose.nod = 0.25; pose.wag = 0.5; pose.perk = 1.3;
        G.pitchTo = 0.08;
        return true;
      }
      case 'zoom': {
        // a fast lap on a circle about (cx, cz), leaning in, ears back, tongue out; skid at the end
        const v = A.zoom.speed, w = v / a.R;
        if (u < 0.86) {
          a.a += a.s * w * dt;
          const nx = a.cx + Math.sin(a.a) * a.R, nz = a.cz + Math.cos(a.a) * a.R;
          if (W.free(nx, nz)) { G.moved += dist({ x: nx, z: nz }, G); G.x = nx; G.z = nz; }
          G.yaw = a.a + a.s * Math.PI / 2;
          G.speed = v;
          pose.amp = 1; pose.phRate = 16; pose.perk = 0.25; pose.wag = 0.3; pose.look = -a.s * 0.5; pose.nod = 0.1;
          G.rollTo = a.s * 0.18; G.pitchTo = 0.04;
        } else {
          // the skid: sits back on its haunches, then a shake
          G.speed *= Math.max(0, 1 - dt * 10);
          pose.amp = 0; pose.posture = 0.5; pose.perk = 1.3; pose.look = pose.toYou; pose.wag = 0.7;
          G.pitchTo = -0.12; G.rollTo = 0;
          if (!a.shook) { a.shook = true; G.shakeT = 0; }
        }
        return true;
      }
      case 'greet': {
        // at your whistle, arrived: a skid, a happy spin on the spot, two little bounces up at you, then a sit looking up,
        // head tilted, tongue out, tail going
        G.speed *= Math.max(0, 1 - dt * 10);
        const toP = Math.atan2(P.x - G.x, P.z - G.z);
        pose.perk = 1.3; pose.wag = 1;
        if (u < 0.1) { pose.posture = 0.35; G.pitchTo = -0.14; pose.look = pose.toYou; pose.nod = pose.nodYou; }
        else if (u < 0.4) {
          const k = ease((u - 0.1) / 0.3);
          G.yaw = a.yaw0 + a.s * Math.PI * 2 * k;
          pose.amp = 0.85; pose.phRate = 17; pose.look = -a.s * 0.55; pose.nod = 0.05; G.rollTo = a.s * 0.12;
          if (!a.said) { a.said = true; say('dog-giggle', 0.7, true); }
        } else if (u < 0.68) {
          G.yaw += turn(G.yaw, toP) * Math.min(1, dt * 10);
          if (!a.h1) { a.h1 = true; G.hopT = 0; }
          if (!a.h2 && u > 0.54) { a.h2 = true; G.hopT = 0; say('dog-yip', 0.75, true); }
          G.pitchTo = -0.22 * Math.sin(Math.PI * ((u - 0.4) / 0.14 % 1));
          pose.look = pose.toYou; pose.nod = pose.nodYou;
        } else {
          G.yaw += turn(G.yaw, toP) * Math.min(1, dt * 6);
          pose.posture = 1; pose.look = pose.toYou; pose.nod = pose.nodYou - 0.05;
          if (!a.tilted && u > 0.74) { a.tilted = true; G.tiltT = 0; G.tiltSide = a.s; say('dog-hmm', 0.7, true); }
        }
        return true;
      }
      case 'hop':
        // a little pounce: up, nose down at the top, landing on the forepaws
        G.pitchTo = 0.35 * Math.sin(Math.PI * u);
        pose.perk = 0.55; pose.wag = 0.6; pose.look = pose.toYou;
        return true;
      case 'sneeze':
        // the head goes back... and snaps down; then a shake of the whole pup
        pose.nod = u < 0.45 ? -0.4 * ease(u / 0.45) : 0.55 * (1 - ease((u - 0.5) / 0.5));
        pose.perk = u < 0.45 ? 0.5 : 0.9;
        if (!a.said && u >= 0.45) { a.said = true; say('dog-sneeze', 0.8, true); G.shakeT = 0; }
        return false;
      case 'shake': return false;
      case 'tilt': pose.look = pose.toYou; pose.nod = pose.nodYou - 0.05; return false;
      case 'trip':
        // a paw catches: a stumble forward, a dip, and on as if nothing happened
        G.pitchTo = 0.28 * Math.sin(Math.PI * Math.min(1, u * 1.4));
        NOW.crouch = Math.max(NOW.crouch, 0.6 * Math.sin(Math.PI * u));      // (down on its legs, not down into the ground)
        pose.speedK = 0.45; pose.perk = 0.6; pose.nod = 0.3 * Math.sin(Math.PI * u);
        return false;
    }
    return false;
  };

  /* ---- bedtime on the gate's bench (Tan: "catchy and aww"): it faces the bench, hops up, lands with a yip, a play
   * bow at you with its rump wiggling, a happy spin, over onto its back with its paws going, a sit and a head tilt,
   * two slow circles sniffing the seat, and down, curled up along the bench, a sleepy breath; then it is settled
   * (`GUIDE.onNap`, once) and snores now and then.  The postcard's `GUIDE.onTourEnd` fires then too, once a tour
   * (Tan, 2026-10-02: the bit is watched in full, then the card, then "Take the tour again": main.js).  Returns where
   * it looks, or null for the pose's own. ---- */
  const bedtime = (dt, pose, dP, toYou, nodYou) => {
    const b = G.bed, T = A.bedtime;
    b.t += dt;
    const toBench = Math.atan2(BENCH.x - G.x, BENCH.z - G.z);
    // whom it plays to: you, when you're about; else out over the forecourt (the way it came up)
    const toP = Math.atan2(P.x - G.x, P.z - G.z), out = dP < 25 ? toP : Math.atan2(NAP.x - BENCH.x, NAP.z - BENCH.z);
    if (b.phase === 'face') {
      const d = turn(G.yaw, toBench);
      G.yaw += THREE.MathUtils.clamp(d, -dt * 6, dt * 6);
      pose.perk = 1.2; pose.wag = 0.8; pose.nod = -0.1;
      if (Math.abs(d) < 0.15) Object.assign(b, { phase: 'hop', t: 0, from: { x: G.x, z: G.z } });
      return null;
    }
    if (b.phase === 'hop') {
      // a crouch, then up in an arc onto the seat
      const u = Math.min(1, b.t / T.hop), c = 0.25;
      if (u < c) { pose.posture = -0.35 * Math.sin(Math.PI * u / c); G.pitchTo = -0.1; pose.perk = 0.8; return null; }
      const k = (u - c) / (1 - c);
      G.x = b.from.x + (BENCH.x - b.from.x) * ease(k); G.z = b.from.z + (BENCH.z - b.from.z) * ease(k);
      G.lift = seatLift() * ease(Math.min(1, k * 1.25)) + 0.16 * Math.sin(Math.PI * k);
      G.pitchTo = -0.35 * Math.cos(Math.PI * k); pose.perk = 0.55; pose.amp = 0.4; pose.phRate = 12; pose.wag = 0.6;
      if (u >= 1) { G.lift = seatLift(); G.onBench = true; Object.assign(b, { phase: 'bed', t: 0, yaw0: G.yaw }); say('dog-yip', 0.85, true); }
      return null;
    }
    // on the bench (b.phase 'bed', or 'sleep' once settled)
    const t = b.t, seg = ([a, z]) => (t - a) / (z - a), awake = dP < 3;
    if (b.phase === 'sleep') {
      pose.posture = 2; pose.perk = awake ? 1 : 0.35; pose.wag = awake ? 0.4 : 0;
      return awake ? 'player' : 'sleep';
    }
    pose.wag = 1; pose.perk = 1.3;
    if (t < T.bow[0]) { pose.posture = 0.3; G.pitchTo = -0.12; return null; }   // the landing: a little squash
    if (t < T.bow[1]) {
      // a play bow at you, its rump wiggling
      G.yaw += turn(G.yaw, out) * Math.min(1, dt * 8);
      pose.posture = -1 * ease(seg(T.bow) * 5); pose.look = toYou; pose.nod = nodYou - 0.1;
      G.rollTo = 0.05 * Math.sin(t * 14);
      return null;
    }
    if (t < T.spin[1]) {
      // a happy spin on the spot, ending side-on to you with a little hop
      if (b.spinFrom == null) { b.spinFrom = G.yaw; b.s = Math.random() < 0.5 ? 1 : -1; }
      const k = ease(seg(T.spin));
      G.yaw = b.spinFrom + (b.s * Math.PI * 2 + turn(b.spinFrom, out - 1.4)) * k;
      pose.amp = 0.85; pose.phRate = 17; pose.look = -b.s * 0.5; G.rollTo = b.s * 0.1;
      if (!b.hopped && seg(T.spin) > 0.75) { b.hopped = true; G.hopT = 0; }
      return null;
    }
    if (t < T.roll[1]) {
      // over onto its back, paws going, a wriggle, and up again (as the idle roll, a touch quicker)
      const u = seg(T.roll), over = ease((u - 0.15) / 0.2) * (1 - ease((u - 0.8) / 0.16));
      pose.posture = Math.max(2 * Math.min(1, ease(u / 0.15) + over) * (u < 0.85 ? 1 : 1 - ease((u - 0.85) / 0.15)), 2 * over);
      G.rollTo = (Math.PI + over * Math.sin(t * 9) * 0.35) * over * ease((G.posture - 1) / 0.7);
      pose.amp = Math.abs(G.roll) > 2.3 ? over * 0.8 : 0; pose.phRate = 14 * over; pose.perk = 0.4 + 0.5 * (1 - over);
      pose.look = over > 0.5 ? 0.6 * Math.sin(t * 3) : toYou; pose.nod = -0.2 * over;
      if (!b.snort && u > 0.3) { b.snort = true; say('dog-snort', 0.75, true); }
      return null;
    }
    if (t < T.sit[1]) {
      // sat up, looking at you: a head tilt, "hm?"
      G.yaw += turn(G.yaw, out) * Math.min(1, dt * 5);
      pose.posture = 1; pose.look = toYou; pose.nod = nodYou - 0.05;
      if (!b.tilted && seg(T.sit) > 0.2) { b.tilted = true; G.tiltT = 0; G.tiltSide = b.s ?? 1; say('dog-hmm', 0.7, true); }
      return null;
    }
    if (t < T.circle[1]) {
      // round and round on the seat, nose down, settling on a way to lie: along the bench
      if (b.c0 === undefined) {
        b.c0 = G.yaw;
        // lying along the seat, the way round that has its left side (the side its sleeping head turns to) facing out
        // over the forecourt, so the curled-up face is seen from the front
        const along = Math.atan2(BENCH_ALONG.x, BENCH_ALONG.z), s = b.s ?? 1;
        const fx = NAP.x - BENCH.x, fz = NAP.z - BENCH.z;
        const a1 = Math.cos(along) * fx - Math.sin(along) * fz > 0 ? along : along + Math.PI;
        const end = b.c0 + s * 3 * Math.PI;
        b.total = s * 3 * Math.PI + turn(end, a1);
      }
      G.yaw = b.c0 + b.total * ease(seg(T.circle));
      pose.amp = 0.55; pose.phRate = 9; pose.nod = 0.3; pose.look = 0; pose.wag = 0.5; pose.perk = 0.9;
      return null;
    }
    // down, curled up; a sleepy breath out; settled
    const k = Math.min(1, (t - T.circle[1]) / (T.settle - T.circle[1]));
    pose.posture = 1 + k; pose.wag = 0.3 * (1 - k); pose.perk = 0.9 - 0.55 * k;
    if (!b.sighed && k > 0.5) { b.sighed = true; say('dog-snore', 0.6, true); }
    if (t >= T.settle && G.posture > 1.9) {
      b.phase = 'sleep';
      if (!G.napped) { G.napped = true; GUIDE.onNap?.(); }
      endTour();
    }
    return 'sleep';
  };
  /** Off the bench at once (it was moved: a whistle from afar, a jump to a view, a staged pose). */
  /** The seat's height over the ground the pup stands on there. */
  const seatLift = () => GB.seat - ground(BENCH.x, BENCH.z);
  const offBench = () => { G.onBench = false; G.lift = 0; G.bed = null; G.hopOff = null; };
  /** Down off the bench, to the forecourt in front of it, in a little hop (it is going somewhere). */
  const hopOffStep = (dt, pose) => {
    const h = G.hopOff, u = Math.min(1, (h.t += dt) / 0.42);
    G.x = h.from.x + (NAP.x - h.from.x) * ease(u); G.z = h.from.z + (NAP.z - h.from.z) * ease(u);
    G.lift = h.lift * (1 - ease(Math.min(1, u * 1.15))) + 0.1 * Math.sin(Math.PI * u);
    G.yaw += turn(G.yaw, Math.atan2(NAP.x - h.from.x, NAP.z - h.from.z)) * Math.min(1, dt * 14);
    G.pitchTo = 0.3 * Math.sin(Math.PI * u); pose.amp = 0.5; pose.phRate = 12; pose.perk = 0.6; pose.wag = 0.8;
    if (u >= 1) offBench();
  };

  /* ====================================================================================================================
   * Reactions in play, the pigeons, the konbini bits, and after the tour (Tan, 2026-10-01: "the game has become centred
   * on Hachi's cuteness; more reactions = more fun").  Kept apart from the tour's own logic: `own` runs a frame of the
   * states that belong here (charge, snack, pal) or holds the pup where it stands under a reaction; `react` starts the
   * reactions where they belong; `mood` is its face for the frame.
   * ================================================================================================================== */
  const R_ = A.react;
  const STILL = { r: 'still', lookAt: 'player' }, MOVING = { r: 'moving', lookAt: 'way' };
  const HOLDS = new Set(['lead', 'atSpot', 'gate', 'wait', 'linger', 'ready']);
  const LEVEL = new Set(['lead', 'atSpot', 'gate', 'wait', 'linger', 'ready', 'pal', 'cross', 'hazard', 'caught']);   // where he sits down by himself (update: on level ground)
  const FACES = {
    run: { earsBack: 0.5, mouth: 0.35 }, zoom: { earsBack: 0.6, mouth: 0.35, tuck: 0.2 }, wind: { big: 0.6 },
    roll: { mouth: 0.45, lids: 0.6 }, bow: { mouth: 0.25 }, greet: { mouth: 0.4, lids: 0.3 }, hello: { mouth: 0.3, big: 0.3 },
    sad: { big: 0.55, earsBack: 0.3 }, trip: { big: 0.7, earsBack: 0.4 }, chase: { mouth: 0.3 }, cheer: { mouth: 0.35, lids: 0.3 },
    watch: { big: 0.5 }, asleep: { lids: 1 }, drowsy: { lids: 0.6 }, squeeze: { lids: 1, mouth: 0.2 },
  };
  const RX = { look: 0, lookNext: 5, petal: R_.petal[0], strut: R_.strut[0], yawned: 0, bells: false, bellT: -999, carT: -999, car: null, hopped: null, lingered: null, gate: false, after: null, dream: 6, charged: new Map() };
  /** Its face for the frame, from what it is doing (a reaction lays its own over this). */
  const mood = (pose, dP) => {
    if (pose.face) return pose.face;
    const a = G.act, u = a ? a.t / a.dur : 0, st = G.state;
    if (a) {
      if (a.name === 'roll') return u > 0.2 && u < 0.85 ? FACES.roll : null;
      if (a.name === 'zoom') return u < 0.86 ? FACES.zoom : FACES.greet;
      if (a.name === 'bow') return FACES.bow;
      if (a.name === 'greet') return u < 0.68 ? FACES.greet : FACES.hello;
      if (a.name === 'tail') return FACES.chase;
      if (a.name === 'trip') return FACES.trip;
      if (a.name === 'sneeze') return u > 0.4 && u < 0.6 ? FACES.squeeze : null;
    }
    if (st === 'nap' && G.bed) {
      if (G.bed.phase === 'sleep') return dP < 3 ? null : FACES.asleep;
      if (G.bed.phase === 'bed') return G.bed.t > A.bedtime.circle[1] ? FACES.drowsy : G.bed.t > A.bedtime.roll[0] + 0.4 && G.bed.t < A.bedtime.roll[1] - 0.4 ? FACES.roll : null;
    }
    if ((st === 'come' || st === 'intro') && G.speed > 3) return FACES.run;
    if (st === 'intro' || st === 'ready') return FACES.hello;
    if (st === 'wait' && G.since < 4) return FACES.sad;                 // you walked off: it watches you go
    if (st === 'hazard') return FACES.watch;
    if (G.cheerT > 0) return FACES.cheer;
    return null;
  };
  const startle = () => {
    const seated = G.posture > 0.6;
    FX.stop();
    FX.chain([['startle', { seated }], ['scared', { seated, dur: 1.3, delay: -0.15 }], ['shakeOff', { delay: -0.1 }], ['brave', { delay: -0.1 }]]);
  };
  /** Start the reactions that belong to the moment (once a frame, after the state's own step). */
  const react = (dt, dP, show) => {
    const st = G.state;
    if (st !== 'charge' && PIGEONS.scare) PIGEONS.scare = null;      // (called off mid-charge: a whistle, the RX-7)
    // ([tour-B] in his home and by the shrine's fox the visit is the show: nothing of this; sat at the barrier only the
    // startle as the bells start, seated, and then he watches the train as the tour has him do)
    const up = !['nap', 'staged', 'intro', 'snack', 'charge', 'come', 'caught', 'home', 'visit'].includes(st) && !G.hopOff;
    const awake = up && st !== 'cross';
    const calm = awake && !G.act && !FX.busy && G.speed < 0.1;
    // the level crossing's bells start up near it, or the RX-7 comes sliding by: a jump out of its skin, low and
    // trembling for a second, a shake... and a brave little woof at it
    const b = GUIDE.bells;
    if (b.on && !RX.bells && up && G.t - RX.bellT > R_.again && dist(G, b) < R_.bells) { RX.bellT = G.t; G.act = null; startle(); }      // (whatever it was up to)
    RX.bells = b.on;
    if (show) {
      const c = HAN_SHOW.car();
      if (c) {
        const v = RX.car && dt > 0 ? dist(c, RX.car) / dt : 0;
        RX.car = { x: c.x, z: c.z };
        if (v > R_.carSpeed && dist(G, c) < R_.car && G.t - RX.carT > R_.again && st !== 'nap' && st !== 'staged' && st !== 'snack' && st !== 'visit') { RX.carT = G.t; if (G.act?.name !== 'zoom') G.act = null; startle(); }
      }
    } else RX.car = null;
    // asleep on its bench: a dream now and then (an ear, a paw)
    if (st === 'nap' && G.bed?.phase === 'sleep' && dP >= 3 && (RX.dream -= dt) <= 0) { RX.dream = 7 + Math.random() * 9; FX.play('dream'); }
    if (!awake) return;
    // you reach a place with it (it hopped as you came up; you stepped into the ring; the gate): tippy taps, a wiggle
    if (G.hopped !== RX.hopped) { RX.hopped = G.hopped; if (G.hopped) RX.after = 'tippyTaps'; }
    if (st === 'linger' && RX.lingered !== G.target?.id) { RX.lingered = G.target?.id ?? null; if (dP < 12 && !inStore(P)) RX.after = 'happyWiggle'; }
    if (st !== 'linger') RX.lingered = null;
    if (G.gateDone && !RX.gate) RX.after = 'tippyTaps';
    RX.gate = !!G.gateDone;
    if (RX.after && !G.act && !FX.busy) { FX.play(RX.after, { seated: G.posture > 0.6, s: Math.random() < 0.5 ? 1 : -1 }); RX.after = null; return; }
    // leading you somewhere good, you right behind: a proud strut for a few strides
    if (st === 'lead' && G.speed > 2 && P.speed > 1.2 && dP < 11 && !G.act && !FX.busy && (RX.strut -= dt) <= 0) { RX.strut = R_.strut[0] + Math.random() * (R_.strut[1] - R_.strut[0]); FX.play('proudStrut'); return; }
    // and through the pigeons, if there are any
    if (st === 'lead' && !G.act && !FX.busy && tryCharge()) return;
    if (!calm) { RX.look = 0; return; }
    // you stop and look at it: a head tilt, one ear up
    RX.lookNext -= dt;
    RX.look = dP < 8 && dP > 1 && P.speed < 0.3 && inCone(R_.look[0]) ? RX.look + dt : 0;
    if (RX.look > R_.look[1] && RX.lookNext <= 0) { RX.lookNext = R_.look[2] + Math.random() * R_.look[2]; RX.look = 0; FX.play('headTilt', { side: Math.random() < 0.5 ? -1 : 1, ask: Math.random() < 0.35 }); return; }
    // kept waiting: a big yawn, then slow blinks
    if (G.waitT < 1) RX.yawned = 0;
    if (G.waitT > R_.bored * (1 + RX.yawned)) { FX.play(RX.yawned++ % 2 ? 'slowBlink' : 'yawn'); return; }
    // a petal comes down past its nose now and then
    if (G.waitT > 1.5 && !inStore(G) && (RX.petal -= dt) <= 0) { RX.petal = R_.petal[0] + Math.random() * (R_.petal[1] - R_.petal[0]); FX.play('petal'); }
  };

  /* ---- the pigeons (the shopping street's and the plaza's): leading past them, it can't help itself ---- */
  const _scare = { x: 0, z: 0 };
  const scareAt = () => { const l = ctx.toLocal({ x: G.x, z: G.z }); _scare.x = l.x; _scare.z = l.z; PIGEONS.scare = _scare; };
  const tryCharge = () => {
    const C = A.charge, R = A.zoom.r;
    if (!PIGEONS.flocks.length || dist(P, G) > C.you) return false;
    for (const f of PIGEONS.flocks) {
      const at = ctx.toWorld({ x: f.x, z: f.z }), d = dist(G, at);
      if ((at.x - G.x) * Math.sin(G.yaw) + (at.z - G.z) * Math.cos(G.yaw) < 0.5 * d) continue;      // (only a flock on its way, ahead)
      if (d > C.from || d < R + 1 || G.t - (RX.charged.get(f) ?? -999) < C.again || f.grounded() < 3 || !roomFor(at.x, at.z, R)) continue;
      // onto a lap round them along a tangent: the two tangent points from here, the one with a clear run to it
      const a0 = Math.atan2(G.x - at.x, G.z - at.z), beta = Math.acos(R / d);
      for (const sg of [1, -1]) {
        const a = a0 + sg * beta, q = { x: at.x + Math.sin(a) * R, z: at.z + Math.cos(a) * R };
        if (!W.free(q.x, q.z) || !W.sight(G.x, G.z, q.x, q.z)) continue;
        const s = (q.x - G.x) * Math.cos(a) - (q.z - G.z) * Math.sin(a) >= 0 ? 1 : -1;     // the way round its run carries it
        RX.charged.set(f, G.t);
        G.charge = { at, q, a, s, t: 0, phase: 'wind' };
        G.state = 'charge'; G.speed = 0; G.field = null;
        say('dog-hmm', 0.8, true);
        return true;
      }
    }
    return false;
  };
  const chargeStep = (dt, pose) => {
    const c = G.charge;
    const done = () => { G.charge = null; PIGEONS.scare = null; G.state = 'home'; lead(G.leg ?? 0); return STILL; };
    if (!c || (c.t += dt) > 12) return done();
    if (c.phase === 'wind') {
      // it has seen them: down on its elbows, rump up and wiggling, eyes on them
      G.yaw += turn(G.yaw, Math.atan2(c.q.x - G.x, c.q.z - G.z)) * Math.min(1, dt * 10);
      pose.posture = -0.8; pose.wag = 1; pose.perk = 1.2; pose.look = 0; pose.nod = -0.1; pose.face = FACES.wind;
      G.rollTo = 0.05 * Math.sin(c.t * 16);
      if (c.t > A.charge.wind) { c.phase = 'run'; say('dog-yip', 0.85, true); }
      return STILL;
    }
    if (c.phase === 'run') {
      const r = move(dt, c.q, A.charge.speed, 9);
      pose.bound = 1; pose.perk = 0.3; pose.wag = 0.6; pose.face = FACES.run;
      scareAt();
      if (dist(G, c.q) < 0.6 || r === 'there') { c.phase = 'lap'; G.act = null; play('zoom', { cx: c.at.x, cz: c.at.z, R: A.zoom.r, s: c.s, a: c.a, dur: A.charge.lap }); }
      return MOVING;
    }
    if (c.phase === 'lap') {
      scareAt();
      if (G.act) return MOVING;
      // they are up on the roof: it looks up after them, very pleased with itself, and on with the tour
      c.phase = 'pleased'; PIGEONS.scare = null;
      FX.play('pleased');
      return STILL;
    }
    pose.wag = 0.9; pose.perk = 1.3;
    return FX.busy ? STILL : done();
  };

  /* ---- the konbini (Tan: "Hachi jumps around and imitates the player ... a distinct short bit per product, cute, on
   * the surface, near the player outside the store where they eat"): with something in your hand it sits out in front
   * of where you eat, all eyes and a paw; while you eat it does the product's bit along with you; then the bit's end
   * (reactions.js SNACKS).  Afterwards the tour goes on as it would have. ---- */
  const EAT = { x: LAWSON.doorX, z: A.snack.eatZ };
  const snack = (phase, id) => {
    if (!W.built || !SNACKS[id] || HAN_SHOW.running() || G.state === 'staged' || G.state === 'intro' || G.intro === 0) return;
    let s = G.snack;
    if (!s || G.state !== 'snack' || s.id !== id) {
      const back = (G.state === 'linger' || G.state === 'atSpot') && G.target ? G.target : null;
      if (G.state === 'lead' || G.state === 'atSpot' || G.state === 'gate') G.resumeK = G.leg;
      const atStore = dist(P, EAT) < 4 || inStore(P);
      const c = atStore ? W.nearest(EAT.x + A.snack.side, EAT.z + A.snack.d, 1.5, (i) => { const q = W.at(i); return flat(q.x, q.z); }) : -1;   // (on level ground: he sits, and rolls about, there)
      s = G.snack = { id, phase: null, t: 0, n: 0, back, bit: null, end: 0, spot: c >= 0 ? W.at(c) : frontSpot(A.snack.d) ?? { x: G.x, z: G.z } };
      G.state = 'snack'; G.act = null; G.roll = G.pitch = 0; G.whistleAt = null; G.charge = null; PIGEONS.scare = null; G.since = 0; G.pal = null;
      FX.stop();
      G.field = aim('goal', s.spot.x, s.spot.z, 0.3);
    }
    if (s.phase === phase) return;
    s.phase = phase; s.t = 0; s.bit = null;
    if (phase !== 'hold' && dist(G, s.spot) > 8 && !inSight(24, 40)) {
      // far off (asleep on its bench, waiting streets away): it comes into your view from round a corner, at a run
      const f = aim('follow', P.x, P.z, 0.6, 120);
      while (!f.ready) f.work(50);
      enterView(f, A.snack.from, 30);
      G.field = aim('goal', s.spot.x, s.spot.z, 0.3);
    }
  };
  const snackEnd = () => {
    const s = G.snack;
    G.snack = null; G.since = 0; G.waitT = 0;
    if (s?.back && !tourOver()) { G.state = 'linger'; G.target = s.back; } else { G.state = 'caught'; G.target = null; }
    return STILL;
  };
  const snackStep = (dt, pose) => {
    const s = G.snack;
    if (!s) return snackEnd();
    s.t += dt; G.since += dt;
    const off = dist(G, s.spot), B = SNACKS[s.id];
    // to its spot first, flat out (the food won't wait)
    if (off > 0.4 && !s.bit && G.since < 14) {
      const v = off > 3 ? A.run : A.trot;
      let r = off < 24 && W.sight(G.x, G.z, s.spot.x, s.spot.z) ? move(dt, s.spot, v) : steer(dt, v);
      if (r === 'there') r = move(dt, s.spot, A.trot);
      if (r === 'lost' && G.since > 2) { const q = frontSpot(A.snack.d); s.spot = q && W.sight(G.x, G.z, q.x, q.z) ? q : { x: G.x, z: G.z }; }
      pose.bound = off > 3 ? 1 : 0; pose.wag = 0.95; pose.perk = 1.2;
      if (off > 3) pose.face = FACES.run;
      return { r, lookAt: 'player' };
    }
    // there, facing you
    G.yaw += turn(G.yaw, Math.atan2(P.x - G.x, P.z - G.z)) * Math.min(1, dt * 8);
    pose.posture = 1; pose.wag = 0.6; pose.perk = 1.2;
    if (s.phase === 'hold') {
      // you have something: the eyes, then a paw, the eyes again
      if (!FX.busy) FX.play(s.n++ % 2 ? 'beg' : 'puppyEyes');
      if (s.t > 25) return snackEnd();
    } else if (s.phase === 'eat') {
      if (!s.bit) { s.bit = 'eat'; FX.stop(); if (s.t < B.eat.dur - 0.8) FX.play(B.eat, { at: s.t, name: 'eat' }); }
      if (s.t > B.eat.dur + 3) return snackEnd();            // (never told you finished: it lets it go)
    } else if (!s.bit) { s.bit = 'after'; FX.stop(); s.end = s.t + FX.play(B.after, { name: 'after' }); }
    else if (s.t >= s.end) return snackEnd();
    return STILL;
  };
  GUIDE.snack = snack;

  /* ---- after the tour (Tan: "today after the tour ends Hachi goes back to the gate bench to sleep even when whistled.
   * Make him stay interactive"): whistled, it comes and stays with you: at your side as you walk, sat in front of you
   * and playing when you stop.  Looked at from close by it can be asked for the tour again (E, main.js: only E; a
   * whistle just brings it to you): the tour starts over from the first place.  Left alone for a while (you `far` m off: it keeps up with a
   * walk, not with a run; or in the store; for `alone` s) it goes back to its bench and its nap. ---- */
  const tourOver = () => !!G.gateDone && allDone();
  /** The tour's ending, once a tour (main.js's postcard): settled on its bench, or yours before it got that far. */
  const endTour = () => { if (!G.ended) { G.ended = true; GUIDE.onTourEnd?.(); } };
  const startPal = () => {
    if (tourOver()) endTour();
    G.state = 'pal'; G.pal = { t: 0, alone: 0, still: 0, side: Math.random() < 0.5 ? 1 : -1, spot: null };
    G.palKeep = true; G.target = null; G.field = null; G.since = 0; G.waitT = 0; G.idleT = 0;
  };
  const palStep = (dt, pose, dP) => {
    const p = G.pal ?? (G.pal = { t: 0, alone: 0, still: 0, side: 1, spot: null }), L = A.pal;
    p.t += dt; G.since += dt;
    // left alone: back to the bench
    p.alone = dP > L.far || inStore(P) ? p.alone + dt : Math.max(0, p.alone - 2 * dt);
    if (p.alone > L.alone) { G.pal = null; G.palKeep = false; G.act = null; toGateOrNap(); return STILL; }
    pose.wag = dP < 6 ? 0.6 : 0.3;
    if (G.act) return STILL;
    let r = 'still', lookAt = 'player';
    if (dP > L.far) {
      // you have gone off without it (at a run, or in a jump): it doesn't chase; it sits and watches you go
      G.waitT += dt; p.spot = null;
      pose.posture = G.waitT > 1.2 ? 1 : 0; pose.wag = 0.15; pose.face = FACES.sad;
    } else if (P.speed > 0.5) {
      // you walk: at your side and a little ahead, where you see it; it runs to catch up
      p.still = 0; p.spot = null; G.waitT = 0;
      const d = intent();
      let q = { x: P.x + d.x * L.ahead - d.z * p.side * L.aside, z: P.z + d.z * L.ahead + d.x * p.side * L.aside };
      if (!W.free(q.x, q.z)) { const o = { x: P.x + d.x * L.ahead + d.z * p.side * L.aside, z: P.z + d.z * L.ahead - d.x * p.side * L.aside }; if (W.free(o.x, o.z)) { q = o; p.side = -p.side; } }
      // (never faster than its jog: walk and it is with you; run off and you leave it behind)
      const off = dist(G, q), v = Math.max(A.trot, Math.min(A.jog, P.speed + (off > 1.5 ? 1.2 : 0.2)));
      if (off > 0.5) { r = W.free(q.x, q.z) && W.sight(G.x, G.z, q.x, q.z) ? move(dt, q, v) : pursue(dt, v); lookAt = 'way'; pose.bound = off > 5 ? 1 : 0.45; }
    } else {
      // you stop: out in front of you where you see it, sat, looking up at you; a little play now and then
      p.still += dt;
      if (!p.spot && (dP > L.sit[1] || dP < 1.4 || (!inCone(50) && p.still > 1))) p.spot = frontSpot(L.sit[0]);
      if (p.spot && dist(G, p.spot) > 0.4 && p.still < 20) { r = W.sight(G.x, G.z, p.spot.x, p.spot.z) ? move(dt, p.spot, dist(G, p.spot) > 4 ? A.jog : A.trot) : pursue(dt, A.trot); G.waitT = 0; }
      else {
        p.spot = null; G.waitT += dt;
        if (G.speed < 0.1) G.yaw += turn(G.yaw, Math.atan2(P.x - G.x, P.z - G.z)) * Math.min(1, dt * 4);
        pose.posture = G.waitT > 1.2 ? 1 : 0;
        if (G.speed < 0.1 && !FX.busy && (G.idleT += dt) > 2.5 + Math.random() * 3) idle(dP, G.waitT > 40);
      }
    }
    return r === 'still' ? STILL : { r, lookAt };
  };
  /** The tour again, from the first place (asked for after the tour: E by it). */
  const again = () => {
    if (!W.built || !tourOver() || G.state === 'staged' || HAN_SHOW.running()) return false;
    refresh();
    // (what you have had stays had, as far as each place knows: this time round a place counts once you step into its ring)
    G.reUsed = new Set(list.filter((e) => e.used).map((e) => e.id));
    G.done = new Set(['view']); G.skipped = new Set(); G.gateDone = false; G.napped = false; G.ended = false; G.drops = 0; G.resumeK = null;
    G.pal = null; G.palKeep = false; G.snack = null; G.charge = null; G.shook = null; G.hopped = null; G.act = null; G.whistleAt = null;
    RX.charged.clear();
    tourReset();                                 // ([tour-B] his home and the shrine's fox are to visit again too)
    queue.length = 0; G.leg = 0; prefetch();
    FX.stop();
    say('dog-yip', 0.9, true, 30);
    G.state = 'home';
    lead(0);
    FX.play('hopSpin', { s: Math.random() < 0.5 ? 1 : -1 });
    GUIDE.onTour?.();
    return true;
  };
  GUIDE.again = again;
  /** Is the tour on offer again: it is yours after the tour (or asleep on its bench as you stand by it), near, and you
   * are looking at it? */
  GUIDE.offer = () => W.built && (G.state === 'pal' || (G.state === 'nap' && G.bed?.phase === 'sleep')) && G.speed < 0.5
    && dist(P, G) < A.pal.ask[0] && inCone(A.pal.ask[1]) && tourOver();
  /** A frame of the states that are this block's, or the pup held where it stands under a reaction; else null. */
  const own = (dt, pose, dP) => {
    if (G.state === 'charge') return chargeStep(dt, pose);
    if (G.state === 'snack') return snackStep(dt, pose);
    if (G.state === 'pal') return FX.holding ? STILL : palStep(dt, pose, dP);
    // (the tour over and it was yours: off the view, or after Han's show, it is yours again, not off to bed)
    if (G.palKeep && G.state === 'nap' && !G.bed && !G.onBench) { startPal(); return STILL; }
    if (FX.holding && HOLDS.has(G.state)) { pose.posture = G.posture > 0.5 ? 1 : 0; pose.wag = 0.5; return STILL; }
    return null;
  };

  /* ================================================================================================ *
   * [tour-B] The level crossing, Hachi's own home, the shrine's fox (Tan, 2026-10-01).
   *
   * `cross` legs: at the barrier he goes on only with the arms right up; else he sits facing the line and
   *   watches the train by (ears up, a boof as it comes), and is off with a hop when the arms have lifted.
   *   Whatever he is doing he never steps onto the crossing while it is shut (move()), and caught on it as
   *   it shuts he runs off it (railClear).
   * `visit` legs: places he goes into (config.js ANIMALS.guide.visit); visited once you come in after him.
   *   home: his garden: the joy (bounces, spins, through his tunnel and his hoop, into his house and out, his
   *   ball nosed along), then a flop onto his cushion, looking at you.  shrine: in under the torii, he sits by the guardian fox looking back.
   * ================================================================================================ */
  const TB = { visited: new Set(), visit: null, crossSat: false, heard: false };
  const tourReset = () => { TB.visited.clear(); TB.visit = null; TB.crossSat = false; TB.heard = false; G.hopH = null; };
  const LINE = core?.line ?? null;
  const HH = TOWN.hachiHome, SHRINE = SPECIALS.find((s) => s.kind === 'shrine');
  const tw = (x, z) => ctx.toWorld({ x, z });
  // between the two barrier arms (they come down 5.3 m either side of the line's middle), in the town's frame
  const RAILZ = [TOWN.rail.z - 5.15, TOWN.rail.z + 5.15], RAILX = ROADS.lane.asphalt / 2 + 0.9;
  const inRail = (x, z) => { const p = ctx.toLocal({ x, z }); return Math.abs(p.x - TOWN.rail.crossX) < RAILX && p.z > RAILZ[0] && p.z < RAILZ[1]; };
  const crossShut = () => { const c = LINE?.service?.cross; return !!c && (c.closing || c.armT > A.crossing.open); };
  const railShut = (nx, nz) => crossShut() && inRail(nx, nz) && !inRail(G.x, G.z);
  const RAIL_OUT = [tw(TOWN.rail.crossX, RAILZ[0] - 1.2), tw(TOWN.rail.crossX, RAILZ[1] + 1.2)];
  const RAIL_MID = tw(TOWN.rail.crossX, TOWN.rail.z);
  const railClear = (dt, pose) => {
    if (G.state === 'staged' || !inRail(G.x, G.z) || !crossShut()) return false;
    G.act = null;
    // on along his way if he has one, else out by the nearer side
    const way = G.field?.ready && G.state === 'lead' ? steer(dt, A.run) : 'lost';
    if (way !== 'moving') move(dt, dist(G, RAIL_OUT[0]) < dist(G, RAIL_OUT[1]) ? RAIL_OUT[0] : RAIL_OUT[1], A.run);
    pose.bound = 1; pose.perk = 0.6; pose.wag = 0.3;
    return true;
  };
  /** The train nearest the crossing: where its middle is (world) and how far its nearer end is from the lane; null if none is about. */
  const trainNear = () => {
    let best = null;
    for (const t of LINE?.service?.runs ?? []) {
      if (t.phase === 'idle') continue;
      const d = Math.max(0, Math.abs(t.x - TOWN.rail.crossX) - t.len / 2);
      if (!best || d < best.d) { const w = tw(t.x, t.z); best = { x: w.x, z: w.z, d }; }
    }
    return best;
  };
  /** Arrived at a waypoint that is a crossing's barrier or a place: true if he stays for it. */
  const tourStop = (L) => {
    if (L?.cross) {
      if (!crossShut()) return false;
      G.state = 'cross'; G.waitT = 0; G.since = 0; G.speed = 0; TB.crossSat = false; TB.heard = false;
      return true;
    }
    if (L?.visit) {
      G.state = 'visit'; G.waitT = 0; G.since = 0;
      TB.visit = { kind: L.visit, phase: L.visit === 'home' ? 'gate' : 'go', t: 0, held: 0 };
      return true;
    }
    return false;
  };
  /** Whistled: the leg to rush to.  A place on the tour before engagement leg k that you haven't been into comes
   * first (from its crossing's barrier, if it has one just before it). */
  const tourRush = (k) => {
    const from = Math.min(G.leg ?? 0, TOUR.length), to = k < 0 ? TOUR.length : k;
    for (let j = from; j < to; j++) {
      if (!TOUR[j].visit || TB.visited.has(TOUR[j].visit)) continue;
      for (let c = j - 1; c >= Math.max(from, j - 2); c--) if (TOUR[c].cross) return c;
      return j;
    }
    return k;
  };
  /** Whistled (or after a snack) with the tour under way: where to take it up for a place ahead on it (leg k).  Not
   * straight at that place: the legs between are the tour (Tan, 2026-10-02: called to in the shopping street after the
   * mochi shop, he cut across to the station by the lane behind, and ドンペン堂 was never passed: the planner's cheapest
   * way to platform 1, not the tour's).  It goes on from the end of the stretch of the chain you stand nearest, among
   * the stretches from where the tour had got to up to that place. */
  const tourJoin = (k) => {
    const from = G.leg ?? 0;
    if (k < 0 || k <= from || from >= TOUR.length) return k;
    let best = k, bd = INF;
    for (let j = Math.max(1, from); j <= k; j++) {
      const a = TOUR[j - 1], b = TOUR[j], ux = b.x - a.x, uz = b.z - a.z, l2 = ux * ux + uz * uz || 1;
      const u = THREE.MathUtils.clamp(((P.x - a.x) * ux + (P.z - a.z) * uz) / l2, 0, 1);
      const d = Math.hypot(P.x - (a.x + ux * u), P.z - (a.z + uz * u));
      if (d < bd - 0.05) { bd = d; best = j; }
    }
    return best;
  };
  const crossStep = (dt, pose, dP, notInterested) => {
    G.since += dt; G.waitT += dt;
    if (!crossShut()) {
      // the arms are up: over we go (a hop and a yip, having waited)
      if (TB.crossSat) { G.hopT = 0; say('dog-yip', 0.8, true); }
      TB.crossSat = false; TB.heard = false;
      advance();
      return 'way';
    }
    TB.crossSat = true;
    // sat at the barrier, facing the line; the train coming, ears up and a boof; his head follows it by; the arms
    // lifting, up on his feet, tail going, a look back at you: "come on"
    const want = Math.atan2(RAIL_MID.x - G.x, RAIL_MID.z - G.z), off = turn(G.yaw, want);
    G.yaw += THREE.MathUtils.clamp(off, -dt * 3, dt * 3);
    const lifting = !LINE.service.cross.closing, t = trainNear(), near = !!t && t.d < A.crossing.hear;
    pose.posture = lifting || Math.abs(off) > 0.6 ? 0 : 1;
    pose.wag = lifting ? 0.9 : near ? 0.5 : 0.25;
    pose.perk = lifting ? 1.3 : 1;
    if (near && !TB.heard) { TB.heard = true; say('dog-boof', 0.75, true); }
    if (G.since > 1.0 && notInterested(true)) { drop(); return 'player'; }
    if (lifting) return 'player';
    if (near) { pose.look = THREE.MathUtils.clamp(turn(G.yaw, Math.atan2(t.x - G.x, t.z - G.z)), -1.4, 1.4); pose.nod = -0.06; return 'line-alert'; }
    // nothing in sight yet: down the line, with a look back at you now and then
    return G.since % 6 > 4.4 ? 'player' : 'line';
  };
  /** Have you come in (the place counts as visited)? */
  const visitIn = (kind) => {
    const p = ctx.toLocal({ x: P.x, z: P.z });
    if (kind === 'home') return p.x > HH.x0 && p.x < HH.x1 && p.z > HH.z0 + 0.1 && p.z < HH.z1;
    return !!SHRINE && p.x > SHRINE.x0 && p.x < SHRINE.x1 && p.z > SHRINE.z0 && p.z < SHRINE.z1;   // (in past its stone fence)
  };
  // his garden's places, in the world: the open lawn, his tunnel's two mouths, the run-up to his hoop and where he
  // lands, the foot of his porch, inside his house, his cushion
  const HP = {
    mid: tw(HH.mid[0], HH.mid[1]), bed: tw(HH.bed[0], HH.bed[1]),
    tunIn: tw(HH.tunnel.x, HH.tunnel.z0 - 0.8), tunOut: tw(HH.tunnel.x, HH.tunnel.z1 + 0.8),      // (clear of its ends: the tunnel is a wall to his walk now, home.js)
    hoopA: tw(HH.hoop.x - 0.95, HH.hoop.z), hoopB: tw(HH.hoop.x + 0.95, HH.hoop.z),
    porch: tw(HH.kennel[0], HH.kennel[1] - 1.75), door: tw(HH.kennel[0], HH.kennel[1] - 0.95), inside: tw(HH.kennel[0], HH.kennel[1] + 0.1),
  };
  /** Straight from a to b by u (0..1), the grid aside: through his tunnel, his hoop, his door. */
  const glide = (a, b, u) => { const k = Math.max(0, Math.min(1, u)), x = a.x + (b.x - a.x) * k, z = a.z + (b.z - a.z) * k; G.moved += Math.hypot(x - G.x, z - G.z); G.x = x; G.z = z; G.yaw = Math.atan2(b.x - a.x, b.z - a.z); };
  const visitStep = (dt, pose, dP, toYou, nodYou, notInterested) => {
    const v = TB.visit, C = A.visit[v.kind];
    G.since += dt;
    if (!TB.visited.has(v.kind) && visitIn(v.kind)) TB.visited.add(v.kind);
    const been = TB.visited.has(v.kind);
    const toP = Math.atan2(P.x - G.x, P.z - G.z);
    const faceYou = (rate) => { G.yaw += turn(G.yaw, toP) * Math.min(1, dt * rate); };
    const next = (phase) => { v.phase = phase; v.t = 0; };
    // on with the tour: a little hop, and off
    const on = () => { TB.visit = null; G.hopH = null; G.hopT = 0; advance(); return ['still', 'way']; };
    let r = 'still', look = 'player';
    v.t += dt;
    if (v.kind === 'shrine') {
      // up the path to the guardian fox; there he turns, sits beside it and looks back at you until you come in
      const spot = v.spot ??= (() => { const c = W.nearest(G.target.x, G.target.z, 1.5); return c >= 0 ? W.at(c) : G.target; })();
      if (v.phase === 'go') {
        if (dist(G, spot) > 0.22 && v.t < 4) return [move(dt, spot, A.trot), 'way'];
        next('sit');
      }
      faceYou(5);
      pose.posture = Math.abs(turn(G.yaw, toP)) < 0.7 ? 1 : 0; pose.wag = dP < 7 ? 0.5 : 0.25; pose.look = toYou; pose.nod = nodYou;
      if (been && G.posture > 0.8) { v.held += dt; if (!v.said) { v.said = true; say('dog-boof', 0.6, true); G.tiltT = 0; G.tiltSide = 1; } }
      if (v.held > C.sit || v.t > 14) return on();          // (you only watch from the lane: he moves on after a while)
      if (G.since > 1.0 && notInterested(true)) { TB.visit = null; drop(); }
      return [r, look];
    }
    /* his home */
    pose.wag = 1; pose.perk = 1.3;
    switch (v.phase) {
      case 'gate': {
        // just inside his gate, looking back for you: little hops, "come on, come on"
        faceYou(8);
        if (G.hopT < 0 && v.t % 1.1 < 0.1) G.hopT = 0;
        pose.look = toYou; pose.nod = nodYou;
        if ((dP < C.see && W.sight(G.x, G.z, P.x, P.z)) || been) { next('in'); say('dog-yip', 0.9, true, 30); }
        else if (G.since > 1.0 && notInterested(true)) { TB.visit = null; drop(); }
        break;
      }
      case 'in':
        // in at a bounding run to the middle of his lawn
        if (dist(G, HP.mid) > 0.3 && v.t < 3) { r = move(dt, HP.mid, A.whistle.gallop); pose.bound = 1; pose.perk = 0.6; look = 'way'; break; }
        next('bounce'); say('dog-yip', 0.9, true, 30);
        break;
      case 'bounce': {
        // jumping for joy on the spot, turning to you
        G.hopH = 0.3;
        if (G.hopT < 0) G.hopT = 0;
        faceYou(6);
        G.pitchTo = -0.25 * Math.sin(Math.PI * Math.min(1, Math.max(0, G.hopT) / 0.5));
        pose.look = toYou; pose.nod = nodYou - 0.1;
        if (v.t > C.bounce) { next('spin'); v.yaw0 = G.yaw; v.s = Math.random() < 0.5 ? 1 : -1; say('dog-giggle', 0.8, true); }
        break;
      }
      case 'spin': {
        // two happy spins on the spot
        G.hopH = null;
        G.yaw = v.yaw0 + v.s * Math.PI * 4 * ease(v.t / C.spin);
        pose.amp = 0.85; pose.phRate = 17; pose.look = -v.s * 0.55; pose.nod = 0.05; G.rollTo = v.s * 0.12;
        if (v.t > C.spin) { next('tunnel'); say('dog-awoo', 0.8, true); }
        break;
      }
      case 'tunnel': {
        // to his tunnel's mouth at a run, and through it, ears back, low
        if (!v.at) {
          if (dist(G, HP.tunIn) > 0.3 && v.t < 3) { r = move(dt, HP.tunIn, A.run); pose.bound = 0.6; look = 'way'; break; }
          if (dist(G, HP.tunIn) > 0.7) { next('hoop'); break; }      // (never through its cloth: not at its mouth, no tunnel this time)
          v.at = { x: G.x, z: G.z }; v.t = 0;
        }
        const T = dist(v.at, HP.tunOut) / 4.2;
        glide(v.at, HP.tunOut, v.t / T);
        G.speed = 4.2; r = 'moving'; look = 'way';
        pose.amp = 1; pose.phRate = 17; pose.perk = 0.3; pose.nod = 0.15; G.pitchTo = 0.05;
        if (v.t >= T) { next('hoop'); v.at = null; }
        break;
      }
      case 'hoop': {
        // round to the run-up, and a leap clean through his hoop
        if (!v.at) {
          if (dist(G, HP.hoopA) > 0.25 && v.t < 3) { r = move(dt, HP.hoopA, A.run); pose.bound = 0.6; look = 'way'; break; }
          v.at = { x: G.x, z: G.z }; v.t = 0;
          G.hopH = 0.4; G.hopT = 0; say('dog-yip', 0.9, true, 30);
        }
        glide(v.at, HP.hoopB, v.t / 0.5);
        G.speed = 3.6; r = 'moving'; look = 'way';
        G.pitchTo = -0.3 * Math.cos(Math.PI * Math.min(1, v.t / 0.5));          // nose up going up, down coming down
        pose.amp = 0.3; pose.perk = 0.5; pose.nod = 0;
        if (v.t >= 0.5) { next('kennel'); v.at = null; G.hopH = null; }
        break;
      }
      case 'kennel': {
        // up his porch and in at his door; round inside; his head out of the door, a yip at you; and out again
        if (!v.at) {
          if (dist(G, HP.porch) > 0.25 && v.t < 3) { r = move(dt, HP.porch, A.run * 0.8); look = 'way'; break; }
          v.at = { x: G.x, z: G.z }; v.t = 0;
        }
        const tIn = 0.7, tTurn = tIn + 0.35, tOut = tTurn + C.inside;
        if (v.t < tIn) { glide(v.at, HP.inside, v.t / tIn); G.speed = 2.6; r = 'moving'; look = 'way'; pose.amp = 1; pose.phRate = 15; pose.perk = 0.6; }
        else if (v.t < tTurn) { G.speed = 0; G.yaw += turn(G.yaw, Math.atan2(HP.door.x - G.x, HP.door.z - G.z)) * Math.min(1, dt * 16); pose.amp = 0.6; pose.phRate = 14; }
        else if (v.t < tOut) {
          // out to the doorway, front paws on the sill: looking at you, a yip
          glide(HP.inside, HP.door, (v.t - tTurn) / 0.35);
          G.speed = 0; pose.look = toYou; pose.nod = nodYou - 0.05;
          if (!v.said) { v.said = true; say('dog-yip', 0.9, true, 30); G.tiltT = 0; G.tiltSide = 1; }
        } else {
          glide(HP.door, HP.porch, (v.t - tOut) / 0.4);
          G.speed = 2.6; r = 'moving'; pose.amp = 1; pose.phRate = 15; look = 'way';
          if (v.t > tOut + 0.4) { next('toy'); v.at = null; v.said = false; }
        }
        break;
      }
      case 'toy': {
        // to his ball: a play bow at it, a push with his nose, and after it as it rolls
        const ball = ctx.toWorld(HACHI_HOME.ball), d = dist(G, ball);
        const toBall = Math.atan2(ball.x - G.x, ball.z - G.z);
        if (!v.nosed) {
          if (d > 0.3 && v.t < 2.2) { r = move(dt, ball, A.run * 0.7); look = 'way'; pose.nod = 0.2; break; }
          G.yaw += turn(G.yaw, toBall) * Math.min(1, dt * 12);
          v.bow = (v.bow ?? 0) + dt;
          pose.posture = -1; pose.look = 0; pose.nod = 0.25; G.rollTo = 0.05 * Math.sin(v.bow * 14);
          if (v.bow > 0.55) {
            v.nosed = true; v.t = 0; say('dog-yip', 0.85, true);
            // off across the lawn, away from him (toward its middle when he is at its edge), in the town's frame
            const b = HACHI_HOME.ball, g = ctx.toLocal({ x: G.x, z: G.z });
            HACHI_HOME.nudge((b.x - g.x) + 0.6 * (HH.mid[0] - b.x), (b.z - g.z) + 0.6 * (HH.mid[1] - b.z), 1.7);
          }
        } else {
          if (d > 0.35) { r = move(dt, ball, A.run * 0.8); pose.bound = 0.6; }
          pose.look = THREE.MathUtils.clamp(turn(G.yaw, toBall), -1, 1); pose.nod = 0.2; pose.perk = 0.7;
          if (v.t > C.toy) next('flop');
        }
        break;
      }
      case 'flop': {
        // to his cushion: a turn on it, and down in a happy heap, on his side a little, looking at you
        if (dist(G, HP.bed) > 0.16 && v.t < 3.5 && !v.sat) { r = move(dt, HP.bed, A.trot * 1.2); look = 'way'; break; }
        if (!v.sat) { v.sat = true; v.t = 0; v.yaw0 = G.yaw; v.s = Math.random() < 0.5 ? 1 : -1; }
        if (v.t < 0.7) { G.yaw = v.yaw0 + v.s * Math.PI * 2 * ease(v.t / 0.7); pose.amp = 0.6; pose.phRate = 12; pose.nod = 0.25; break; }
        faceYou(4);
        pose.posture = 2; pose.wag = 0.7; pose.look = toYou; pose.nod = nodYou - 0.05; pose.perk = 1.3;
        G.rollTo = 0.32 * v.s * ease((v.t - 0.9) / 0.5);
        if (G.posture > 1.8) { if (been || dP < 7) v.held += dt; if (!v.said && v.held > 0.5) { v.said = true; say('dog-snort', 0.75, true); } }
        if (v.held > C.flop || v.t > 16) return on();       // (you only watch from the lane: he moves on after a while)
        if (G.since > 1.0 && notInterested(true)) { TB.visit = null; G.hopH = null; drop(); }
        break;
      }
    }
    return [r, look];
  };
  /* ======================================== [tour-B] ends ======================================== */

  /* ---- what it does ---- */
  function update(dt, cam) {
    if (!W.built) { W.build(); GUIDE.walk = W; const c = W.nearest(HOME.x, HOME.z, 3); if (c >= 0) { const q = W.at(c); G.x = q.x; G.z = q.z; } G.y = ground(G.x, G.z); prefetch(); }
    G.t += dt;
    // you: where, how fast, which way
    const jumped = !P.first && Math.hypot(cam.x - P.x, cam.z - P.z) > 3;
    if (dt > 0 && !P.first) {
      const vx = (cam.x - P.x) / dt, vz = (cam.z - P.z) / dt, k = Math.min(1, dt * 6);
      P.vx += (vx - P.vx) * k; P.vz += (vz - P.vz) * k;
      P.speed = Math.min(6, Math.hypot(P.vx, P.vz));
      if (P.speed > 0.5) { P.hx = P.vx / P.speed; P.hz = P.vz / P.speed; }
    }
    P.x = cam.x; P.z = cam.z; P.y = cam.y; P.first = false;
    if ((listT += dt) > 2 || !list.length) { listT = 0; refresh(); }
    /* waiting with you for the train (QA-010): the train's spot is not on offer until it stands there with its doors
     * open (`hidden`), and while it is coming its entry says so (`wait`: which way it comes from, whether it can be
     * heard yet).  The doors opening, having waited: a happy wag */
    const trainE = G.target?.id === 'train' ? list.find((e) => e.id === 'train') : null;
    if (G.trainWas && trainE && !trainE.hidden && (G.state === 'atSpot' || G.state === 'linger')) G.cheerT = A.trainCheer;
    G.trainWas = !!(trainE?.hidden && trainE.wait) && G.state === 'atSpot';
    // stepping into a ring is the engagement: done
    // done: its own code says it was had (the bench's seat, Han's show, the konbini, the train's announcement), or you
    // stepped into its ring while it was on offer
    for (const e of list) if (!G.done.has(e.id) && ((e.used && !G.reUsed?.has(e.id)) || (!e.hidden && dist(P, e) < rOf(e) + 0.25))) { G.done.add(e.id); G.skipped.delete(e.id); if (G.target?.id === e.id && (G.state === 'lead' || G.state === 'atSpot')) { G.state = 'linger'; G.since = 0; G.act = null; G.drops = 0; } }
    // the famous views: never in the picture while you stand on one (keys 1-3
    // put you there in a jump: it is home at once; walking on, it trots out)
    const view = onView() && (P.speed < 0.6 || jumped);
    if (view && jumped) { offBench(); const c = W.nearest(HOME.x, HOME.z, 3); const q = c >= 0 ? W.at(c) : HOME; G.x = q.x; G.z = q.z; G.speed = 0; G.state = 'home'; G.field = null; G.act = null; G.roll = G.pitch = 0; G.yaw = Math.atan2(P.x - G.x, P.z - G.z); }
    else if (view && G.state !== 'home' && G.state !== 'nap' && G.state !== 'intro' && G.state !== 'ready' && inFrame()) { G.resumeK = G.state === 'lead' || G.state === 'atSpot' || G.state === 'gate' ? G.leg : null; G.act = null; goTo('home', HOME); }
    // Han's show: off the car's way, sitting, watching it go by
    const show = HAN_SHOW.running();
    if (show && G.state !== 'hazard') {
      const c = W.cell(G.x, G.z);
      if (c >= 0 && W.haz[c]) { G.resumeK = G.state === 'lead' || G.state === 'atSpot' || G.state === 'gate' ? G.leg : G.resumeK; const n = W.nearest(G.x, G.z, 8, (i) => !W.haz[i]); G.state = 'hazard'; G.aside = n >= 0 ? W.at(n) : null; G.field = null; G.waitT = 0; G.act = null; }
    }
    if (!show && G.state === 'hazard') { G.state = 'home'; if (G.resumeK !== null) { const k = G.resumeK; G.resumeK = null; lead(k); } else nextOrNap(); }

    /* the introduction (Tan, 2026-09-29: every time the game begins, nothing remembered): a moment after you press
     * Start it runs out from behind you to `A.intro.d` m in front (nearer, it is under the start view's frame: the lens
     * looks up at Fuji), turns to face you, sits and says hello (a caption); then it waits there until you walk off */
    if (!G.intro && (G.t > A.intro.after || dist(P, VIEW) > 1.5) && !show && !inStore(P) && ['home', 'nap'].includes(G.state)) {   // (walk off the view sooner: the hello comes then)
      const fs = frontSpot(A.intro.d);
      G.introSpot = fs ?? { x: G.x, z: G.z };
      G.intro = 1; G.introT = 0; G.introSaid = false;
      G.state = 'intro'; G.field = aim('goal', G.introSpot.x, G.introSpot.z, 0.3); G.act = null;
    }
    // the field grows a little each frame while it is wanted; the others are grown ahead, one at a time
    // (not while a whistle is pending: its own way is growing, and two fields grown in turn undo each other's work)
    if (G.whistleAt !== null) {}
    else if (G.field && !G.field.ready) G.field.work(dt > 0 ? 4 : 40);
    else if (dt > 0) {
      if (growing && growing.ready) growing = null;
      if (!growing && queue.length) growing = queue.shift()();
      if (growing && !growing.ready) growing.work(2.5);
    }

    const dP = dist(P, G);
    const dxp = P.x - G.x, dzp = P.z - G.z;
    const toYou = THREE.MathUtils.clamp(turn(G.yaw, Math.atan2(dxp, dzp)), -1.4, 1.4);
    const headY = G.y + 0.27 * (1 - 0.3 * Math.max(0, G.posture - 1));
    const nodYou = THREE.MathUtils.clamp(-Math.atan2(P.y - headY, Math.max(0.5, dP)) * 0.8, -0.6, 0.35);
    const pose = { posture: 0, wag: 0.15, perk: 1, look: null, nod: null, amp: null, phRate: 0, speedK: 1, bound: 0, toYou, nodYou };
    let wantSpeed = 0, lookAt = 'player';
    G.rollTo = 0; G.pitchTo = 0; G.dip = 0;
    // how far ahead of you it is: along the way, or as the crow flies when you are right here (off the way, your path metres run long)
    const gap = () => (G.field?.ready ? Math.min(G.field.near(P.x, P.z) - G.field.at(G.x, G.z), dP) : 0);
    /* "not interested" (Tan: if I walk away, the pup should follow me, not insist) */
    const notInterested = (waiting) => {
      if (inStore(P) || !G.target) return false;
      if (dP > D.away) return true;
      // your heading against the way: the field's downhill from where you stand
      if (P.speed > 0.6 && G.field?.ready) {
        const c = W.nearest(P.x, P.z, 1.2, (i) => G.field.m[i] < INF);
        const n = c >= 0 ? G.field.next(c) : -1;
        let wx, wz;
        if (n >= 0) { const q = W.at(n), o = W.at(c); wx = q.x - o.x; wz = q.z - o.z; } else { wx = G.target.x - P.x; wz = G.target.z - P.z; }
        const l = Math.hypot(wx, wz) || 1;
        const cos = (P.vx * wx + P.vz * wz) / (P.speed * l);
        G.offT = cos < Math.cos(D.angle * Math.PI / 180) ? G.offT + dt : Math.max(0, G.offT - 2 * dt);
        if (G.offT > D.angleT) return true;
      }
      // while it waits, your distance to the spot grows
      const d = G.field?.ready ? G.field.near(P.x, P.z) : dist(P, G.target) * 1.3;
      if (waiting) { if (G.waitD0 === null || d < G.waitD0) G.waitD0 = d; if (d - G.waitD0 > D.grow) return true; } else G.waitD0 = null;
      return false;
    };
    let r = 'still';
    // off somewhere from the bench (a whistle, the Strong Nine): down off it first
    if ((G.onBench || G.lift > 0) && G.state !== 'nap' && !G.hopOff) G.hopOff = { t: 0, from: { x: G.x, z: G.z }, lift: G.lift };
    let mine = null, watching = null;
    NOW.crouch = 0;
    if (G.hopOff) hopOffStep(dt, pose);
    else if (G.jump) { jumpStep(dt, pose); r = 'moving'; lookAt = 'way'; }   // off the ground over a step or a kerb: whatever he is about waits for him to land
    else if (railClear(dt, pose)) r = 'moving';             // [tour-B] caught on the level crossing as it shuts: off it at a run
    else if ((watching = showStep(dt, pose)) !== null) { r = watching; lookAt = 'show'; }   // (world/mochi/: sat at ぺったん堂's show, the tour and his own bits paused)
    else if ((mine = own(dt, pose, dP))) { r = mine.r; lookAt = mine.lookAt; }      // (reactions, the pigeons, the konbini bits, after the tour: above)
    else switch (G.state) {
      case 'cross': lookAt = crossStep(dt, pose, dP, notInterested); break;                       // [tour-B] at the barrier, the train going by
      case 'visit': [r, lookAt] = visitStep(dt, pose, dP, toYou, nodYou, notInterested); break;   // [tour-B] his home, the shrine's fox
      case 'home': {
        if (!G.field) goTo('home', HOME);
        const there = dist(G, HOME) < 0.6;
        if (!there) { r = steer(dt, A.trot); lookAt = 'way'; } else G.waitT += dt;
        pose.wag = dP < 6 ? 0.5 : 0.2;
        pose.posture = there && G.waitT > A.waitSit ? 1 : 0;
        // you walk off the view: it comes and suggests the first place
        if (!view && dist(P, VIEW) > 1.5 && !inStore(P) && G.intro !== 0) { const k = G.resumeK ?? G.leg ?? 0; G.resumeK = null; lead(k); }   // (the hello first)
        break;
      }
      case 'lead': {
        // a suggestion: it trots ahead along the way and looks back; you decide
        G.since += dt;
        const g = gap();
        const [lo, hi] = A.lead;
        if (G.field?.ready && G.field.at(G.x, G.z) < 1.2 && G.field.at(G.x, G.z) !== INF) {
          if (isStop(G.target) || G.leg >= TOUR.length) { G.state = 'atSpot'; G.aside = beside(G.target); G.waitT = 0; G.minD = INF; break; }
          if (G.target.leg?.wait) { G.state = 'gate'; G.waitT = 0; G.since = 0; break; }
          if (tourStop(G.target.leg)) break;                // [tour-B] the level crossing shut: he waits; a place: he goes in
          // a waypoint passed: a glance back where there is something to hear, and on
          if (G.target.leg?.hear) { G.glance = -1.3; if (Math.random() < 0.5) say('dog-boof', 0.6); }
          advance(); break;
        }
        // a jog, quicker than your walk (Tan: slowly following it was annoying); you close, it picks up; you run, it runs;
        // too far ahead, it stops and looks back
        if (g < lo) wantSpeed = Math.min(A.run, Math.max(A.jog, P.speed + 1.5));
        else if (g < hi) wantSpeed = Math.min(A.run, Math.max(A.jog, P.speed + 0.5));
        else wantSpeed = 0;
        if (wantSpeed > 0) { r = steer(dt, wantSpeed); lookAt = 'way'; G.waitT = 0; pose.bound = 0.45; } else { G.waitT += dt; lookAt = 'player'; }
        if (r === 'lost' || r === 'thinking') { G.waitT += dt; lookAt = 'player'; }
        if (r === 'lost' && G.field?.ready) { G.lostFor = (G.lostFor ?? 0) + dt; if (G.lostFor > 1.5) { G.lostFor = 0; const q = nearestReach(G.target); if (q) G.near = q; } } else G.lostFor = 0;
        pose.posture = G.waitT > A.waitSit && G.speed < 0.1 ? 1 : 0;
        pose.wag = G.speed > 0.5 ? 0.3 : G.waitT > 6 ? 0.1 : 0.45;
        if (G.since > 1.0 && notInterested(wantSpeed === 0)) { drop(); break; }
        if (G.since > 8) G.drops = 0;                   // you came along a while: a fresh count of walk-aways

        // waiting a while: a little something to pass the time
        if (G.waitT > 2 && G.speed < 0.1 && !G.act && (G.idleT += dt) > 3 + Math.random() * 3) idle(dP, true);
        break;
      }
      case 'atSpot': {
        // beside the ring, waiting for you to step in; playful when you come close
        G.since += dt;                       // (its clock runs here too: arrived within a second, it never let you go)
        const q = G.aside ?? G.target;
        if (dist(G, q) > 0.25 && !G.done.has(G.target.id) && !G.act) { r = move(dt, q, A.trot * 0.8); lookAt = 'way'; G.waitT = 0; } else G.waitT += dt;
        if (G.shook !== G.target.id && dist(G, q) <= 0.25) { G.shook = G.target.id; play('shake'); }
        if (G.hopped !== G.target.id && dist(P, G.target) < 3.5 && G.speed < 0.2) { G.hopped = G.target.id; G.waitT = 0; if (G.energy > 0.6 && Math.random() < 0.5) zoomRound(); else play('hop'); }
        pose.posture = G.waitT > A.waitSit + 1 ? 1 : 0;
        pose.wag = dP < 6 ? 0.55 : 0.2;
        if (G.since > 1.0 && notInterested(true)) { drop(); break; }
        const tw = G.trainWas ? trainE.wait : null;
        if (tw && dist(G, q) <= 0.25 && !G.act) {
          /* the train isn't in (QA-010): it sits by the spot facing down the line, the way it will come; its sound
           * coming up, ears up and a small boof, once a train */
          const want = Math.atan2(tw.from.x, tw.from.z), dy = turn(G.yaw, want);
          G.yaw += THREE.MathUtils.clamp(dy, -dt * 2.5, dt * 2.5);
          pose.posture = Math.abs(dy) < 0.6 ? 1 : 0;
          pose.wag = tw.near ? 0.5 : 0.2;
          pose.perk = tw.near ? 1.3 : 1;
          lookAt = tw.near ? 'line-alert' : 'line';
          if (tw.near && !G.heardTrain) { G.heardTrain = true; say('dog-boof', 0.75, true); }
        }
        if (!tw?.near) G.heardTrain = false;
        if (!tw && !G.act && G.speed < 0.1 && (G.idleT += dt) > 2.5 + Math.random() * 3) idle(dP, G.waitT > 10);
        break;
      }
      case 'gate': {
        // the Deer Park gate: it waits for you to come up (a hop when you do), then turns back with you
        G.since += dt; G.waitT += dt;
        pose.wag = dP < 6 ? 0.55 : 0.25;
        pose.posture = G.waitT > A.waitSit + 1 ? 1 : 0;
        if (dist(P, G.target) < (G.target.leg.wait ?? 6)) { G.gateDone = true; play('hop'); advance(); break; }
        if (G.since > 1.0 && notInterested(true)) { drop(); break; }
        if (!G.act && G.speed < 0.1 && (G.idleT += dt) > 2.5 + Math.random() * 3) idle(dP, G.waitT > 10);
        break;
      }
      case 'intro': {
        // "Hi, I'm Hachi": a happy bounding run out in front of you, a turn to face you, sit, look up, a double yip, the
        // caption, a wag and a head tilt
        G.introT += dt;
        const spot = G.introSpot;
        const there = dist(G, spot) < 0.4 || G.introT > 8;
        if (!there) { r = G.field?.ready ? steer(dt, A.whistle.gallop) : 'thinking'; if (r === 'there' || r === 'lost') r = move(dt, spot, A.whistle.gallop); lookAt = 'way'; pose.bound = 1; pose.perk = 0.6; pose.wag = 0.9; break; }
        G.yaw += turn(G.yaw, Math.atan2(P.x - G.x, P.z - G.z)) * Math.min(1, dt * 6);
        if (!G.introSaid) { G.introSaid = true; G.introAt = G.introT; say('dog-yip', 0.9, true, 30); G.tiltNext = 0.8; showCard(); }
        pose.posture = 1; pose.wag = 0.8; pose.perk = 1.3; pose.look = toYou; pose.nod = nodYou;
        const shown = G.introT - G.introAt;
        if (shown > A.intro.hold) { G.intro = 2; G.state = 'ready'; G.waitT = 0; G.field = null; }
        break;
      }
      case 'ready': {
        // introduced: sitting where it said hello, watching you, until you walk off; then the tour
        G.waitT += dt;
        G.yaw += turn(G.yaw, Math.atan2(P.x - G.x, P.z - G.z)) * Math.min(1, dt * 3);
        pose.posture = 1; pose.wag = dP < 9 ? 0.5 : 0.25; pose.look = toYou; pose.nod = nodYou;
        if (!G.act && (G.idleT += dt) > 4 + Math.random() * 3) { const k = ['tilt', 'sneeze', 'bow'][Math.floor(Math.random() * 3)]; play(k); }
        if (dist(P, VIEW) > 1.5 && !view) { G.act = null; lead(G.leg ?? 0); }
        break;
      }
      case 'linger': {
        // you're having the experience: it waits by, then plays a little, until you come away
        G.since += dt; G.waitT += dt;
        pose.posture = G.waitT > A.waitSit ? 1 : 0;
        pose.wag = dP < 5 ? 0.5 : 0.15;
        if (!G.act && (G.idleT += dt) > 3 + Math.random() * 3) idle(dP, G.waitT > 15);
        if (G.since > 1.5 && dist(P, G.target) > 4 && !inStore(P) && !view) { G.act = null; nextOrNap(); }
        break;
      }
      case 'wait': {
        // you went your own way: it stays put (a guide, not a follower), watching you go, playing a little; walk
        // back to it and it takes you on where it left off, or whistle (F) and it comes
        G.since += dt; G.waitT += dt;
        pose.posture = G.waitT > A.waitSit ? 1 : 0;
        pose.wag = dP < 6 ? 0.5 : 0.15;
        if (!G.act && G.speed < 0.1 && (G.idleT += dt) > 3 + Math.random() * 3) idle(dP, G.waitT > 12);
        if (G.since > 3 && dP < D.rejoin && !inStore(P) && !view) { G.act = null; play('hop'); lead(G.leg ?? 0); }   // on with the tour where it left off
        break;
      }
      case 'caught': {
        // the greeting (or the party) plays out; then off to the nearest place you haven't been
        pose.wag = 0.7; pose.perk = 1.3;
        if (!G.act) { if (tourOver()) startPal(); else rushNext(); }      // (after the tour it stays with you: `pal`)
        break;
      }
      case 'come': {
        // whistled: a bounding puppy gallop to just in front of you (across your view, not at your feet), ears flopping,
        // tongue out, tail going; there, the greeting
        G.since += dt;
        // the spot it runs for slides in as it comes: far off it aims well out in front of you, so the run swings across
        // the middle of your view instead of along its edge; close, it is the greeting spot
        const lead = THREE.MathUtils.clamp(0.5 * dP, A.whistle.near, 7);
        const fs = frontSpot(lead) ?? frontSpot(A.whistle.near);
        const dF = fs ? dist(G, fs) : dP;
        // the greeting is in front of you: at the spot, or bumping into you from the front; coming up from behind, it
        // runs on past you (round your side, never through your legs) to greet you where you can see it
        const front = inCone(70);
        if ((dF > 0.45 || lead > A.whistle.near + 0.3) && (dP > 1.1 || !front)) {
          // a sprint while far off (it runs from where it really is: it must not take long), the bounding gallop for
          // the last ten metres or so, where you see it come
          const v = A.whistle.gallop + (A.whistle.sprint - A.whistle.gallop) * THREE.MathUtils.clamp((dP - 10) / 12, 0, 1);
          // (far off, down the whistle's own field while you stay about where you whistled: grown 120 m out, it has the
          // whole way; pursue's fields, re-grown as you move, are shorter)
          const wf = fields.whistle, onWf = wf?.ready && dist(wf.goalAt, P) < 3 && dP > 14 && wf.near(G.x, G.z) < INF;
          if (onWf) G.field = wf;
          // close and behind or beside you: first to a point off your shoulder, on the side it is
          let by = null;
          const fc = facing?.();
          if (!front && dP < 3.5 && fc && fc.lengthSq() > 0.5) {
            const px = fc.z, pz = -fc.x, sd = (G.x - P.x) * px + (G.z - P.z) * pz >= 0 ? 1 : -1;
            for (const k of [1.3, 1.0, -1.3]) { const q = { x: P.x + px * sd * k + fc.x * 1.2, z: P.z + pz * sd * k + fc.z * 1.2 }; if (W.free(q.x, q.z) && W.sight(G.x, G.z, q.x, q.z)) { by = q; break; } }
          }
          r = by ? move(dt, by, v) : fs && dF < 24 && W.sight(G.x, G.z, fs.x, fs.z) ? move(dt, fs, v) : onWf ? steer(dt, v) : pursue(dt, v);
          lookAt = 'player'; pose.bound = 1;
          // no way to you from where it is (a pocket of the grid): set on its way to you out of your sight, else by you
          if (r === 'lost' && G.since > 4) { const f = aim('follow', P.x, P.z, 0.6, 120); while (!f.ready) f.work(50); G.since = 0; const q = comeFrom(f); if (q) setAt(q); else { const n = W.nearest(P.x, P.z, 4); if (n >= 0) setAt(W.at(n)); } }
          if (!G.cameYip && dP < 7) { G.cameYip = true; say('dog-yip', 0.8); }
        } else greet();
        pose.perk = 0.6; pose.wag = 0.95; pose.nod = 0.02;
        break;
      }
      case 'hazard': {
        if (G.aside && dist(G, G.aside) > 0.25) { r = move(dt, G.aside, A.run); lookAt = 'way'; } else G.waitT += dt;
        pose.posture = G.waitT > 1.5 ? 1 : 0;
        lookAt = 'car'; pose.wag = 0.2;
        break;
      }
      case 'nap': {
        // the tour's end: to the gate's bench, up onto it, a little play, and curled up asleep on it (bedtime())
        if (!G.bed) {
          const there = G.field?.ready && G.field.at(G.x, G.z) < W.C;
          if (!there) { r = steer(dt, A.trot); lookAt = 'way'; break; }
          G.bed = { phase: 'face', t: 0 };
        }
        lookAt = bedtime(dt, pose, dP, toYou, nodYou) ?? lookAt;
        break;
      }
    }
    /* sat or lying down, he is on level ground: stopped at a kerb's edge or on a step (waiting for you, sat by a ring),
     * he shuffles off it to the nearest level spot first (Tan: half sunk into an edge) */
    if (pose.posture > 0 && r !== 'moving' && LEVEL.has(G.state) && !G.jump && !G.act && !SHOW.sat && !FX.holding && !G.onBench && !G.lift && !G.hopOff) {
      if (flat(G.x, G.z)) G.levelTo = null;
      else {
        if (G.levelTo == null) { const c = W.nearest(G.x, G.z, 1.4, (i) => { const q = W.at(i); return flat(q.x, q.z); }); G.levelTo = c >= 0 ? W.at(c) : false; }
        if (G.levelTo) { pose.posture = 0; r = move(dt, G.levelTo, A.trot * 0.7); lookAt = 'way'; if (G.state === 'atSpot' || G.state === 'hazard') G.aside = G.levelTo; if (r === 'there') G.levelTo = false; }
      }
    } else if (r === 'moving' || G.jump) G.levelTo = null;
    G.r = r;
    // the train's doors opened after you waited together (QA-010): a happy wag, ears up
    if (G.cheerT > 0) { G.cheerT -= dt; pose.wag = 1; pose.perk = 1.3; }
    // your whistle: ears up until the notes are over (whatever it was doing), then the answer
    if (G.whistleAt !== null) { pose.perk = 1.2; if (fields.whistle && !fields.whistle.ready) fields.whistle.work(dt > 0 ? 3 : 40); if (G.t >= G.whistleAt) { G.whistleAt = null; answer(); } }
    // the reactions that belong to the moment
    if (dt > 0) react(dt, dP, show);
    // the acts shape the pose (and some of them move it)
    const acting = act(dt, pose);
    if (!acting && r !== 'moving') G.speed += (0 - G.speed) * Math.min(1, dt * 6);
    if (G.speed < 0.05) G.speed = 0;
    // tripping over its own paws, once in a while at a trot
    if (r === 'moving' && G.speed > 1.5 && !G.act && !G.jump && Math.random() < dt / A.tripEvery) play('trip');
    // energy: back while it rests, spent by the acts
    G.energy = THREE.MathUtils.clamp(G.energy + dt * (G.speed < 0.2 ? 0.02 : -0.004), 0, 1);

    /* ---- the body ---- */
    const k3 = Math.min(1, dt * 3);
    const ampTo = pose.amp ?? Math.min(1, G.speed / A.trot);
    G.amp += (ampTo - G.amp) * Math.min(1, dt * 6);
    G.ph += dt * (pose.phRate || G.speed * 6.5 * pose.speedK);
    // posture: stands up before it walks; the shake after a long sit
    let postureTo = pose.posture;
    const wasSitting = G.posture > 0.6;
    if (G.speed > 0.2 && postureTo > 0) postureTo = 0;
    G.posture += Math.sign(postureTo - G.posture) * Math.min(Math.abs(postureTo - G.posture), dt * (postureTo < 0 || G.posture < 0 ? 3 : 1.5));
    if (wasSitting && G.posture <= 0.6 && G.sat > 8 && G.shakeT < 0 && !G.act) play('shake');
    // panting at a trot, now and then; a whine once when you've kept it waiting; snuffly breaths asleep
    if (G.speed > 0.6) { pantT += dt; if (pantT > 3.2) { pantT = -Math.random() * 2.5; say('dog-pant', 0.55); } } else pantT = Math.min(pantT, 1.5);
    if ((G.state === 'lead' || G.state === 'atSpot') && G.waitT > 12 && !whined && !G.trainWas) { whined = true; say('dog-whine', 0.6); }
    if (G.waitT < 1) whined = false;
    if (G.state === 'nap' && G.posture > 1.8) { snoreT += dt; if (snoreT > 3.4) { snoreT = 0; say('dog-snore', 0.6); } }
    G.sat = G.posture > 0.6 ? G.sat + dt : 0;
    // the head: at you, along the way with a glance back over the shoulder, or down asleep
    let lookTo = 0, nodTo = 0.1;
    if (lookAt === 'player') { lookTo = toYou; nodTo = nodYou; }
    else if (lookAt === 'way') {
      // trotting: every few seconds a look back over the shoulder
      G.glance += dt;
      if (G.glance > 3.4) { G.glance = -1.3; if (Math.random() < 0.3) say('dog-boof', 0.6); }
      if (G.glance < 0) { lookTo = toYou; nodTo = nodYou * 0.6; } else { lookTo = Math.sin(G.t * 1.3) * 0.12; nodTo = 0.12; }
    } else if (lookAt === 'car') {
      const c = HAN_SHOW.car();
      if (c) { lookTo = THREE.MathUtils.clamp(turn(G.yaw, Math.atan2(c.x - G.x, c.z - G.z)), -1.4, 1.4); nodTo = 0.15; }
    } else if (lookAt === 'sleep') { lookTo = 0.9; nodTo = 0.2; }
    else if (lookAt === 'line') { lookTo = 0.15 * Math.sin(G.t * 0.6); nodTo = 0.05; }       // down the line, idly
    else if (lookAt === 'line-alert') { lookTo = 0; nodTo = -0.08; }                          // there it comes
    if (pose.look !== null) lookTo = pose.look;
    if (pose.nod !== null) nodTo = pose.nod;
    G.look += (lookTo - G.look) * (acting ? Math.min(1, dt * 6) : k3);
    G.nod += (nodTo - G.nod) * (acting ? Math.min(1, dt * 6) : k3);
    // sitting and waiting: a head tilt now and then, one ear up
    if (G.posture > 0.8 && G.speed < 0.1 && G.state !== 'nap' && !G.act) {
      if (G.tiltT < 0) { G.tiltNext -= dt; if (G.tiltNext <= 0) { play('tilt'); G.tiltNext = 4 + Math.random() * 5; } }
    }
    let tiltTo = 0;
    if (G.tiltT >= 0) { G.tiltT += dt; const u = G.tiltT / 1.6; tiltTo = G.tiltSide * 0.4 * Math.sin(Math.PI * Math.min(1, u)); if (u >= 1) G.tiltT = -1; }
    G.tilt += (tiltTo - G.tilt) * Math.min(1, dt * 5);
    // the tail
    const glancing = lookAt === 'way' && G.glance < 0;
    let wagTo = pose.wag;
    if (glancing) wagTo = Math.max(wagTo, 0.55);
    G.wagA += (wagTo - G.wagA) * k3;
    G.wagRate = glancing || G.wagA > 0.6 ? 18 : G.wagA > 0.4 ? 13 : 8;
    G.wagPh += dt * G.wagRate;
    G.wag = Math.sin(G.wagPh) * G.wagA + G.amp * 0.08 * Math.sin(2 * G.ph);
    // ears: pricked when alert, back for the hop, the chase and the nap
    // excited (you close and it wagging hard): the tongue comes out (the rig reads ears past 1)
    let perk = pose.perk;
    if (perk >= 1 && G.wagA > 0.42 && dP < 7 && G.state !== 'nap') perk = 1.3;
    if (G.hopT >= 0) perk = Math.min(perk, 0.55);
    G.perk += (perk - G.perk) * Math.min(1, dt * 5);
    // the little hop, the shake, the lean and the roll
    G.hop = 0;
    if (G.hopT >= 0) { G.hopT += dt; const u = G.hopT / 0.5; G.hop = ((G.state === 'visit' && G.hopH) || 0.14) * Math.sin(Math.PI * Math.min(1, u)); if (u >= 1) G.hopT = -1; }
    let shakeRoll = 0;
    if (G.shakeT >= 0) { G.shakeT += dt; const u = G.shakeT / 0.7; shakeRoll = 0.16 * Math.sin(G.shakeT * 70) * (1 - u); G.tilt += 0.3 * Math.sin(G.shakeT * 70 + 1) * (1 - u); if (u >= 1) G.shakeT = -1; }
    G.roll += (G.rollTo - G.roll) * Math.min(1, dt * 7);
    if (Math.abs(G.roll) < 0.002) G.roll = 0;
    G.roll += shakeRoll;
    G.pitch += (G.pitchTo - G.pitch) * Math.min(1, dt * 8);
    // the bouncy puppy trot: a high bob at two beats a stride
    // the whistle's gallop: a bound a stride, rocking nose-up, nose-down (the pitch is added at placing, too quick to ease)
    G.boundA = (G.boundA ?? 0) + ((G.speed > 1 ? pose.bound : 0) - (G.boundA ?? 0)) * Math.min(1, dt * 5);
    G.bpitch = G.boundA * 0.1 * Math.cos(G.ph);
    /* the ground under him: in a hop over a step or a kerb, the hop's own arc; and whatever else took him over an edge
     * this frame (zoomies, his garden's bits, a reaction's step aside), a little hop instead of a snap (`pop`: up at
     * once and over, or held up and let down) */
    const gNow = ground(G.x, G.z);
    let base = gNow;
    /* (Tan, 2026-10-02: "still submerged in the kerb area, between the pavement and the road") the ground was taken
     * under his middle only: beside a kerb half of him stood inside it.  He stands on the highest thing under his
     * paws (fore and hind, left and right; a step's height at most: a wall beside him is not under him), eased so
     * walking along a kerb never snaps. */
    {
      const fx = Math.sin(G.yaw) * 0.15, fz = Math.cos(G.yaw) * 0.15, sx = fz * 0.5, sz = -fx * 0.5;
      let top = gNow;
      for (const [dx, dz] of [[fx, fz], [-fx, -fz], [sx, sz], [-sx, -sz]]) { const h = ground(G.x + dx, G.z + dz); if (h > top && h - gNow <= 0.3) top = h; }
      const want = G.jump || G.lift || G.onBench || G.hopOff ? 0 : top - gNow;
      G.paws = (G.paws ?? 0) + (want - (G.paws ?? 0)) * Math.min(1, dt * 14);
    }
    if (G.jump) { base = G.jump.y; G.pop = null; }
    else if (!G.lift && !G.onBench && !G.hopOff && G.state !== 'staged') {
      if (G.gy != null && Math.abs(gNow - G.gy) >= JP.min && Math.hypot(G.x - G.lx, G.z - G.lz) < 1.2) G.pop = { t: 0, from: G.base ?? G.gy };
      if (G.pop) {
        const u = (G.pop.t += dt) / JP.pop;
        if (u >= 1) G.pop = null;
        else base = (gNow > G.pop.from ? gNow : G.pop.from + (gNow - G.pop.from) * ease((u - 0.3) / 0.7)) + JP.popArc * Math.sin(Math.PI * u);      // (never under the higher side)
      }
    } else G.pop = null;
    G.gy = gNow; G.lx = G.x; G.lz = G.z; G.base = base; G.sy = gNow + (G.lift ?? 0);
    // landed: a small squash on his legs
    if (G.landT >= 0) { G.landT += dt; const u = G.landT / JP.squash; if (u >= 1) G.landT = -1; else NOW.crouch = Math.max(NOW.crouch, (G.landK ?? 0.7) * Math.sin(Math.PI * Math.min(1, u * 1.4))); }
    // (`lift`: up on the bench)
    G.y = base + (G.jump ? 0 : (G.paws ?? 0)) + (G.lift ?? 0) + (G.bob = G.amp * 0.036 * (0.5 + 0.5 * Math.sin(2 * G.ph + 1))) + G.boundA * 0.055 * Math.abs(Math.sin(G.ph)) + G.hop + G.dip;
    tickCard(dt);
    // its face and its reactions over the pose (a reaction may be paddling its legs: the stride's phase runs on)
    const X = express(dt, mood(pose, dP), toYou, nodYou, G.state === 'nap' && G.bed?.phase === 'sleep' && dP >= 3);
    if (X.phRate) G.ph += dt * X.phRate;
    place();
  }

  // it starts at home, facing the view (the grid is built on the first update,
  // once every builder has placed its colliders; the pup then snaps to free ground)
  G.yaw = Math.atan2(VIEW.x - G.x, VIEW.z - G.z);
  place();

  /* dev: state, staged poses for the screenshots, and a headless run */
  if (import.meta.env?.DEV && typeof window !== 'undefined') {
    window.__guide = {
      state: () => ({ state: G.state, leg: G.leg, target: G.target?.id ?? null, done: [...G.done], visited: [...TB.visited], visit: TB.visit?.phase ?? null, skipped: [...G.skipped], act: G.act?.name ?? null, x: +G.x.toFixed(2), z: +G.z.toFixed(2), yaw: +G.yaw.toFixed(2), speed: +G.speed.toFixed(2), posture: +G.posture.toFixed(2), energy: +G.energy.toFixed(2), gridMs: +W.ms.toFixed(0), cells: W.N, paths: dbg.paths, ready: !!G.field?.ready, answerMs: +(dbg.answerMs ?? 0).toFixed(1) }),
      walk: W, G, P, A, ground, flat,
      /** Stand the pup in a pose `d` metres in front of a player { pos, yaw } for a frame: `kind` or `kind@d`:
       *  trot | look | sit | tilt | nap | hop | stand | side | behind | bow | roll | lie | zoom | chase | tail */
      stage(spec, player, d = 1.6) {
        const [kind, dd] = String(spec).split('@');
        if (dd) d = +dd;
        const fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw);
        const px = player.pos.x + fx * d, pz = player.pos.z + fz * d;
        const c = W.nearest(px, pz, 2);
        const q = c >= 0 ? W.at(c) : { x: px, z: pz };
        offBench();
        Object.assign(G, { x: q.x, z: q.z, speed: 0, amp: 0, ph: 0, look: 0, nod: 0.1, tilt: 0, wag: 0, posture: 0, perk: 1, hop: 0, roll: 0, pitch: 0, dip: 0, state: 'staged', act: null });
        const toCam = Math.atan2(player.pos.x - q.x, player.pos.z - q.z);
        if (kind === 'trot') Object.assign(G, { yaw: toCam + 2.1, amp: 1, ph: 1.1, wag: 0.25, nod: 0.12 });
        else if (kind === 'look') Object.assign(G, { yaw: toCam + Math.PI - 0.5, look: -1.25, nod: 0.05, wag: 0.4 });
        else if (kind === 'sit') Object.assign(G, { yaw: toCam + 0.25, posture: 1, nod: -0.1, wag: 0.35, perk: 1.3 });
        else if (kind === 'side') Object.assign(G, { yaw: toCam + Math.PI / 2, amp: 1, ph: 4.2, wag: 0.3, nod: 0.1 });
        else if (kind === 'behind') Object.assign(G, { yaw: toCam + Math.PI, amp: 1, ph: 1.1, wag: -0.3, nod: 0.12, look: 0 });
        else if (kind === 'tilt') Object.assign(G, { yaw: toCam, posture: 1, tilt: 0.4, nod: -0.12, wag: 0.3 });
        else if (kind === 'nap' || kind === 'lie') Object.assign(G, { yaw: toCam + (kind === 'nap' ? 1.9 : 0.5), posture: 2, look: kind === 'nap' ? 0.9 : 0, nod: kind === 'nap' ? 0.2 : -0.05, perk: kind === 'nap' ? 0.35 : 1 });
        else if (kind === 'hop') Object.assign(G, { yaw: toCam + 0.3, hop: 0.12, perk: 0.55, wag: 0.5, nod: -0.15, pitch: 0.3 });
        else if (kind === 'stand') Object.assign(G, { yaw: toCam + 0.6, wag: 0.3 });
        else if (kind === 'bow') Object.assign(G, { yaw: toCam + 0.35, posture: -1, wag: 0.7, perk: 1.3, nod: -0.15 });
        else if (kind === 'roll') Object.assign(G, { yaw: toCam + 1.3, posture: 2, roll: Math.PI + 0.25, amp: 0.7, ph: 2.0, wag: 0.5, perk: 0.5, nod: -0.2, look: 0.5 });
        else if (kind === 'zoom') Object.assign(G, { yaw: toCam + 1.2, amp: 1, ph: 2.6, wag: 0.3, perk: 0.25, roll: 0.18, pitch: 0.04, look: -0.5 });
        else if (kind === 'chase') Object.assign(G, { yaw: toCam, amp: 1, ph: 0.6, wag: 0.4, perk: 0.3, pitch: 0.05, nod: 0.05 });
        else if (kind === 'tail') Object.assign(G, { yaw: toCam + 0.9, amp: 0.9, ph: 3.1, wag: 0.5, perk: 1.3, look: -1.35, nod: 0.25, pitch: 0.08 });
        G.y = ground(G.x, G.z) + G.hop + G.amp * 0.012; G.sy = null; G.jump = null; G.pop = null; G.gy = null;
        FX.reset(); express(0, null, 0, 0, true);
        place();
      },
      /** (tuning) draw G as it has been set by hand */
      stage2() { FX.reset(); express(0, null, 0, 0, true); place(); },
      /** [tour-B] the tour from leg k on, everything before it had (the checks: the crossing, his home, the shrine) */
      leadFrom(k) { for (let j = 0; j < k; j++) { const L = TOUR[j]; if (L.id && L.id !== 'gate') G.done.add(L.id); if (L.visit) TB.visited.add(L.visit); } G.act = null; lead(k); },
      home: HP, tour: TB, rail: () => ({ shut: crossShut(), on: inRail(G.x, G.z) }),
      /** Step the pup by `dt` with the player at `p` (the headless run drives it). */
      step(dt, p) { update(dt, p); },
      whistle,
      tipsy,
      /** the reactions (reactions.js), the konbini bits, the tour again, the crossing's bells, the pigeons' hook */
      fx: FX, snack, again, offer: () => GUIDE.offer(), pal: startPal, bells: GUIDE.bells, pigeons: PIGEONS, RX,
      /** How far the lowest drawn part of the pup is over the ground it stands on (m; negative: under it), and the
       * highest: the pup alone, drawn side-on and end-on through an orthographic lens into a small target, read back
       * (Tan: rolling about tipsy it sank under the road; the checks hold every bit to the surface with this). */
      lowest() {
        const r = window.__scene?.renderer;
        if (!r) return null;
        const size = 256, span = 1.0, floor = -0.3;
        const L = (window.__guide._low ??= { rt: new THREE.WebGLRenderTarget(size, size), cam: new THREE.OrthographicCamera(-span / 2, span / 2, span + floor, floor, 0.05, 6), buf: new Uint8Array(size * size * 4), col: new THREE.Color() });
        const gy = ground(G.x, G.z) + (G.lift ?? 0);
        const prev = r.getRenderTarget(), pa = r.getClearAlpha();
        r.getClearColor(L.col);
        let low = Infinity, high = -Infinity;
        for (const a of [0.4, 0.4 + Math.PI / 2]) {
          L.cam.position.set(G.x + Math.sin(a) * 2, gy, G.z + Math.cos(a) * 2);
          L.cam.lookAt(G.x, gy, G.z);
          L.cam.updateMatrixWorld();
          r.setRenderTarget(L.rt); r.setClearColor(0x000000, 0); r.clear();
          r.render(herd.mesh, L.cam);
          r.readRenderTargetPixels(L.rt, 0, 0, size, size, L.buf);
          for (let row = 0; row < size; row++) {
            let any = false;
            for (let x = 0; x < size && !any; x++) any = L.buf[(row * size + x) * 4 + 3] > 0;
            if (!any) continue;
            const y = floor + (row / size) * span;
            if (y < low) low = y;
            if (y > high) high = y + span / size;
          }
        }
        r.setRenderTarget(prev); r.setClearColor(L.col, pa);
        return { low: +low.toFixed(3), high: +high.toFixed(3) };
      },
      /** the tour over (everything done, the gate seen): off to the bench for its nap */
      napNow() { refresh(); for (const e of list) G.done.add(e.id); G.gateDone = true; G.act = null; G.leg = TOUR.length; toGateOrNap(); },
      bench: { x: BENCH.x, z: BENCH.z, nap: NAP, seat: GB.seat },
      /** the introduction: 0 not yet, 1 running, 2 done (reset() counts it done; introReset() makes it due again) */
      intro: () => G.intro,
      introReset() { G.intro = 0; },
      introMark() { G.intro = 2; },
      reset() { offBench(); FX.reset(); PIGEONS.scare = null; RX.charged.clear(); Object.assign(RX, { look: 0, lookNext: 5, petal: R_.petal[0], strut: R_.strut[0], yawned: 0, bells: false, bellT: -999, carT: -999, hopped: null, lingered: null, gate: false, after: null }); Object.assign(G, { jump: null, pop: null, gy: null, sy: null, landT: -1, snack: null, charge: null, pal: null, palKeep: false, reUsed: null, state: 'home', target: null, field: null, resume: null, speed: 0, posture: 0, moved: 0, shook: null, hopped: null, act: null, roll: 0, pitch: 0, drops: 0, energy: 0.7, leg: 0, resumeK: null, whistleAt: null, lastWhistle: -9, intro: 2, introT: 0, t: 0, gateDone: false, napped: false, ended: false }); G.done = new Set(['view']); G.skipped = new Set(); tourReset(); ready.clear(); queue.length = 0; growing = null; prefetch(); P.first = true; const c = W.nearest(HOME.x, HOME.z, 3); const q = c >= 0 ? W.at(c) : HOME; G.x = q.x; G.z = q.z; G.y = ground(G.x, G.z); place(); },
    };
  }
  return { update, herd, G };
}
