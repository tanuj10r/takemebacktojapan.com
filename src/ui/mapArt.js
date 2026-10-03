import { TOWN, STREET, LAWSON, WORLD, PLACES, HERO_VIEWS, placeAt } from '../config.js';
import { STRINGS } from '../data/strings.js';
import { SPECIALS } from '../world/town-plan.js';
import { planPaddies, RIDGE } from '../world/land/paddies.js';
import { pondShore } from '../world/land/pond.js';
import { rngKit } from '../core/util.js';
import { M, roofStyle } from './map/style.js';
export { drawIcon, drawGem, drawSpeaker, ICON } from './map/icons.js';

/* ------------------------------------------------------------------ *
 * The town map, painted once (M2f; map 2.0, 2026-09-28).
 *
 * Drawn from the game's own data, so it is always the town you walk: the
 * kit network's roads, the density registry's building footprints (roofed
 * by what the lot holds), the special lots, the railway and platforms, the
 * paddies' real plots and their earth paths (land/paddies.js planPaddies),
 * 鏡池's shore (land/pond.js pondShore), the river's channel, walks, stairs
 * and bridge, and the trees where their crowns stand.  An illustrated map
 * on paper in the game's pastels: soft ink edges, a drop shadow under
 * every roof, the main road ranked above the shopping street above the
 * lanes.  One canvas, painted once at load; the full map and the corner
 * map only copy it.
 *
 * Everything is drawn in world metres (north, -z, up) through one canvas
 * transform; the town's own frame (built turned) goes through frame.toWorld.
 *
 * Returns { canvas, ppm, toPx(x, z), places, bounds, paintMs }.
 * ------------------------------------------------------------------ */

const PPM = 7;                 // pixels per metre
const PAD = 14;                // metres of margin round the world bounds
export const JP = `'NF Round', 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', 'Yu Gothic', Meiryo, sans-serif`;
const TAU = Math.PI * 2;

export function paintMap(world) {
  const t0 = performance.now();
  const B = WORLD.bounds;
  const x0 = B.x0 - PAD, x1 = B.x1 + PAD, z0 = B.z0 - PAD, z1 = B.z1 + PAD;
  const W = Math.round((x1 - x0) * PPM), H = Math.round((z1 - z0) * PPM);
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  const F = world.frame;
  const r = rngKit(2610);
  const L = TOWN.land, R = TOWN.rail;

  /* ---- helpers, all in world metres ---- */
  const tw = (x, z) => { const p = F.toWorld({ x, z }); return [p.x, p.z]; };
  const wz = (z) => tw(0, z)[1];
  /** A town-frame rect [x0, z0, x1, z1] as a world one. */
  const trect = (q) => { const [ax, az] = tw(q[0], q[1]), [bx, bz] = tw(q[2], q[3]); return [Math.min(ax, bx), Math.min(az, bz), Math.max(ax, bx), Math.max(az, bz)]; };
  const ink = (col, w) => { c.strokeStyle = col; c.lineWidth = w; };
  const rr = (q, rad) => { c.beginPath(); c.roundRect(q[0], q[1], q[2] - q[0], q[3] - q[1], rad); };
  const box = (q, fill, rad = 0) => { c.fillStyle = fill; rr(q, rad); c.fill(); };
  const edge = (q, col, w, rad = 0) => { ink(col, w); rr([q[0] + w / 2, q[1] + w / 2, q[2] - w / 2, q[3] - w / 2], rad); c.stroke(); };
  const poly = (pts) => { c.beginPath(); pts.forEach(([x, z], i) => (i ? c.lineTo(x, z) : c.moveTo(x, z))); c.closePath(); };
  const line = (ax, az, bx, bz) => { c.beginPath(); c.moveTo(ax, az); c.lineTo(bx, bz); c.stroke(); };
  const X0 = x0 - 2, X1 = x1 + 2;
  /** A band right across the sheet, between two town-frame z. */
  const band = (za, zb, fill) => { const q = trect([0, za, 1, zb]); q[0] = X0; q[2] = X1; box(q, fill); return q; };
  /** Little grass marks (the map sign for meadow), scattered in a world rect. */
  const tufts = (q, n, col) => {
    ink(col, 0.22); c.lineCap = 'round';
    c.beginPath();
    for (let i = 0; i < n; i++) {
      const x = r.range(q[0] + 1, q[2] - 1), z = r.range(q[1] + 1, q[3] - 1);
      c.moveTo(x - 0.55, z - 0.5); c.lineTo(x - 0.25, z + 0.2); c.lineTo(x, z - 0.7); c.lineTo(x + 0.25, z + 0.2); c.lineTo(x + 0.55, z - 0.5);
    }
    c.stroke(); c.lineCap = 'butt';
  };
  /** Parallel lines across a world rect every `step` (along z if `v`, else along x), on multiples of `step` from `at`. */
  const hatch = (q, step, v, col, w, at = 0) => {
    ink(col, w); c.beginPath();
    const [a, b, p, s] = v ? [q[0], q[2], q[1], q[3]] : [q[1], q[3], q[0], q[2]];
    for (let t = at + Math.ceil((a - at) / step) * step; t <= b; t += step) v ? (c.moveTo(t, p), c.lineTo(t, s)) : (c.moveTo(p, t), c.lineTo(s, t));
    c.stroke();
  };
  /** A car park: asphalt, rows of white bays along both long sides. */
  const park = (q) => {
    box(q, M.lot); edge(q, M.lotEdge, 0.2);
    for (const z of [q[1] + 0.5, q[3] - 5]) hatch([q[0] + 1.5, z, q[2] - 1.5, z + 4.5], 2.5, 1, M.bayLine, 0.18, q[0] + 1.5);
  };

  /* ---- paper, with a faint, even grain ---- */
  c.fillStyle = M.paper; c.fillRect(0, 0, W, H);
  for (let i = 0; i < 9000; i++) {
    c.fillStyle = i % 3 ? 'rgba(255,255,255,0.22)' : 'rgba(140,124,100,0.07)';
    c.fillRect(r.next() * W, r.next() * H, 1.5, 1.5);
  }
  c.setTransform(PPM, 0, 0, PPM, -x0 * PPM, -z0 * PPM);

  /* ---- beyond the river: the far verge and the Deer Park's meadow, fading off the sheet ---- */
  {
    const far = trect(L.far);
    const g = c.createLinearGradient(0, far[3], 0, z1);
    g.addColorStop(0, M.meadow); g.addColorStop(1, M.meadowFade);
    box([far[0], far[1], far[2], z1], g);
    tufts([far[0], far[3] + 2, far[2], z1 - 2], 70, M.tuft);
  }

  /* ---- the town's ground: every lot a pale garden or yard ---- */
  box(trect([TOWN.core.x0, TOWN.core.z0, TOWN.core.x1, TOWN.core.z1]), M.ground);
  const lots = world.core?.lots ?? [];
  const built = world.core?.built ?? [];
  for (const lot of lots) box(trect(lot.rect), lot.kind === 'shop' ? M.yard : M.garden);

  /* ---- Hachi's garden, past the south fence at the crossing lane's end: a lawn, his kennel's red roof (animals/home.js; not in the pocket town) ---- */
  if (/*@mini false @*/true/*@@*/) {
    const hh = TOWN.hachiHome, q = trect([hh.x0, hh.z0 - 0.2, hh.x1, hh.z1]);
    box(q, M.park, 0.8); edge(q, M.parkEdge, 0.25, 0.8);
    box(trect([hh.kennel[0] - 0.7, hh.kennel[1] - 0.7, hh.kennel[0] + 0.7, hh.kennel[1] + 0.7]), '#b5503f', 0.3);
  }

  /* ---- the special lots ---- */
  const spec = (k) => SPECIALS.find((s) => s.kind === k) ?? { x0: 0, z0: 0, x1: 0, z1: 0 };
  const sRect = (s) => trect([s.x0, s.z0, s.x1, s.z1]);
  { const q = sRect(spec('park')); box(q, M.park, 0.8); edge(q, M.parkEdge, 0.25, 0.8); }
  { const q = sRect(spec('vacant')); box(q, M.vacant); tufts(q, 16, M.tuftDry); }
  {
    const s = spec('shrine');
    box(sRect(s), M.gravel, 0.6);
    // the approach (参道) from the lane to the halls, under its tunnel of torii
    const [ax, az] = tw((s.x0 + s.x1) / 2, s.z0), [, bz] = tw(0, s.z1 - 6);
    ink(M.sando, 1.6); line(ax, az, ax, bz);
    hatch([ax - 1.2, bz + (az - bz) * 0.2, ax + 1.2, az - (az - bz) * 0.12], 0.72, 0, M.torii, 0.35);
  }
  {
    const q = sRect(spec('plaza'));
    box(q, M.plaza);
    for (const v of [0, 1]) hatch(q, 3, v, M.plazaGrid, 0.08);
  }
  park(sRect(spec('coinParking')));
  park(trect(L.parking));                          // the photographers' lot, a car park now

  /* ---- the river (桜川): banks, walks, water, stairs, stepping stones ---- */
  /*@mini if (false) @*//*@@*/{
    band(L.farTop.z0, L.farTop.z1, M.walk);
    band(L.top.z0, L.top.z1, M.walk);
    // the stone revetments, hatched as a map draws a bank
    for (const [za, zb] of [[L.walks.town[1], L.sunk.z1], [L.sunk.z0, L.walks.far[0]]]) hatch(band(za, zb, M.revet), 0.9, 1, M.revetHatch, 0.14);
    const a = band(L.walks.town[0], L.walks.town[1], M.lowWalk);
    const b = band(L.walks.far[0], L.walks.far[1], M.lowWalk);
    // a strip of grass along each lower walk, on the water's side
    box([X0, a[1], X1, a[1] + 1], M.bankGrass); box([X0, b[3] - 1, X1, b[3]], M.bankGrass);
    const q = trect([0, L.river.z0, 1, L.river.z1]);
    const g = c.createLinearGradient(0, q[1], 0, q[3]);
    g.addColorStop(0, M.waterDeep); g.addColorStop(0.18, M.water); g.addColorStop(0.82, M.water); g.addColorStop(1, M.waterDeep);
    box([X0, q[1], X1, q[3]], g);
    ink(M.waterEdge, 0.3); line(X0, q[1] + 0.15, X1, q[1] + 0.15); line(X0, q[3] - 0.15, X1, q[3] - 0.15);
    // gentle current marks
    ink(M.waterLine, 0.22); c.lineCap = 'round';
    c.beginPath();
    for (let i = 0; i < 46; i++) {
      const x = r.range(X0, X1), z = r.range(q[1] + 2.2, q[3] - 2.2), w = r.range(2.2, 4.2);
      c.moveTo(x - w, z); c.quadraticCurveTo(x - w / 2, z - 0.5, x, z); c.quadraticCurveTo(x + w / 2, z + 0.5, x + w, z);
    }
    c.stroke(); c.lineCap = 'butt';
    // the railings along the top walks
    ink(M.rail2, 0.14);
    for (const z of [wz(L.top.z0), wz(L.farTop.z1)]) line(X0, z, X1, z);
    // the stone stairs down to the lower walks
    for (const s of L.stairs) {
      const [za, zb] = s.side === 'town' ? [L.walks.town[1], L.top.z0] : [L.farTop.z1, L.walks.far[0]];
      const sq = trect([s.x - s.w / 2, za, s.x + s.w / 2, zb]);
      box(sq, M.stair);
      hatch(sq, 0.32, 0, M.stairLine, 0.08);
    }
    // 飛び石: the stepping stones across the water
    c.fillStyle = M.stone; ink(M.stoneEdge, 0.1);
    const [sx] = tw(L.stones.x, 0);
    for (let z = q[1] + 0.9, i = 1; z < q[3] - 0.5; z += 1.35, i = -i) {
      c.beginPath(); c.ellipse(sx + 0.35 * i, z, 0.62, 0.45, 0.3 * i, 0, TAU); c.fill(); c.stroke();
    }
  }
  // the bridge's shadow on the channel (its deck is the bridge road, drawn with the roads)
  const bq = trect([L.bridge.x - L.bridge.w / 2, L.bridge.z0, L.bridge.x + L.bridge.w / 2, L.bridge.z1]);
  box([bq[0] + 0.9, bq[1], bq[2] + 0.9, bq[3]], M.shadow);

  /* ---- the paddies (田んぼ): each plot as planned, its earth paths between ---- */
  /*@mini const keepBox = L.paddies.box; @*//*@@*/
  for (const fieldBox of [L.paddies.box/*@mini , [-26, 45, 58, 83.5] @*//*@@*/]) {
    L.paddies.box = fieldBox;      // (the pocket town's second field, behind the store: land/index.js)
    const plan = planPaddies();
    box(trect(L.paddies.box), M.levee);
    for (const p of plan.plots) {
      // along its south curve, back along its north (the town's frame)
      const pts = [];
      for (let i = 0; i <= 8; i++) { const x = p.sw + ((p.se - p.sw) * i) / 8; pts.push(tw(x, p.S(x))); }
      for (let i = 0; i <= 8; i++) { const x = p.ne + ((p.nw - p.ne) * i) / 8; pts.push(tw(x, p.N(x))); }
      const k = M.plot[p.kind] ?? M.plot.fallow;
      const xs = pts.map((v) => v[0]), zs = pts.map((v) => v[1]);
      const bx0 = Math.min(...xs), bx1 = Math.max(...xs), bz0 = Math.min(...zs), bz1 = Math.max(...zs);
      c.save();
      poly(pts); c.fillStyle = k.fill; c.fill(); c.clip();
      if (k.sky) {
        // the sky in the water: a soft light band across it
        const g = c.createLinearGradient(bx0, bz0, bx1, bz1);
        g.addColorStop(0, M.clear); g.addColorStop(0.45, M.sky); g.addColorStop(0.6, M.clear);
        box([bx0, bz0, bx1, bz1], g);
      }
      if (k.rows) {
        // furrows, or rows of seedlings or flowers
        c.fillStyle = k.mark;
        for (let x = bx0 + 0.5; x < bx1; x += k.rows[0]) for (let z = bz0 + 0.5; z < bz1; z += k.rows[1]) c.fillRect(x - 0.12, z - 0.12, k.rows[2], k.rows[3]);
      }
      if (p.kind === 'fallow') tufts([bx0, bz0, bx1, bz1], 10, M.tuft);
      c.restore();
    }
    // the earth paths (畦道): a grass shoulder and a trodden top
    c.lineCap = c.lineJoin = 'round';
    for (const [w, col] of [[RIDGE.w, M.ridge], [RIDGE.path, M.ridgeTop]]) {
      ink(col, w);
      c.beginPath();
      for (const l of plan.lines) {
        const pts = l.kind === 'curve' ? Array.from({ length: 17 }, (_, i) => { const x = l.x0 + ((l.x1 - l.x0) * i) / 16; return tw(x, l.f(x)); }) : [tw(...l.a), tw(...l.b)];
        pts.forEach(([x, z], i) => (i ? c.lineTo(x, z) : c.moveTo(x, z)));
      }
      c.stroke();
    }
    c.lineCap = 'butt';
    // the feeder channel (用水路) down the lane side, and the pump shed's apron
    for (const ch of plan.channels) { const q = trect([ch.x0, ch.z0, ch.x1, ch.z1]); box(q, M.waterDeep); edge(q, M.concreteEdge, 0.12); }
    if (plan.apron) box(trect(plan.apron), M.concrete, 0.3);
  }
  /*@mini L.paddies.box = keepBox; @*//*@@*/

  /* ---- 鏡池: its grounds, the granite promenade, the water ---- */
  /*@mini if (false) @*//*@@*/{
    box(trect(L.pond.box), M.lawn, 1.2);
    const shore = pondShore().map((v) => tw(v.x, v.y));
    // the promenade: the shore stroked wide with round joins, so its outer edge stays smooth
    const pw = Math.min(3.2, L.pond.promenade) * 2;
    for (const [w, col] of [[pw + 0.4, M.promEdge], [pw, M.promenade]]) { ink(col, w); poly(shore); c.stroke(); }
    c.lineJoin = 'miter';
    // the water: deeper at the stone lip, light in the middle
    const cx = shore.reduce((s, v) => s + v[0], 0) / shore.length, cz = shore.reduce((s, v) => s + v[1], 0) / shore.length;
    const g = c.createRadialGradient(cx, cz - 3, 2, cx, cz, 22);
    g.addColorStop(0, M.pondLight); g.addColorStop(1, M.pond);
    poly(shore); c.fillStyle = g; c.fill();
    ink(M.waterEdge, 0.35); c.stroke();
  }

  /* ---- the railway: ballast and sleepers (its rails go down after the roads); the platforms ---- */
  const tracks = [R.z - R.spacing / 2, R.z + R.spacing / 2].map(wz);
  {
    const q = band(R.z - R.spacing / 2 - 1.7, R.z + R.spacing / 2 + 1.7, M.ballast);
    ink(M.ballastEdge, 0.15); line(X0, q[1], X1, q[1]); line(X0, q[3], X1, q[3]);
    for (const z of tracks) hatch([X0, z - 1.05, X1, z + 1.05], 0.65, 1, M.sleeper, 0.24);
    const S = TOWN.station.platforms, bz = TOWN.station.building.z1, fz = R.z + R.spacing / 2 + 1;
    for (const [za, zb] of [[bz, bz + S.depth], [fz, fz + S.depth]]) {
      const p = trect([S.x0, za, S.x1, zb]);
      box(p, M.platform, 0.3); edge(p, M.platformEdge, 0.14, 0.3);
      // the yellow tactile line along the track edge
      const t = Math.abs(p[1] - wz(R.z)) < Math.abs(p[3] - wz(R.z)) ? p[1] + 0.6 : p[3] - 0.6;
      ink(M.tactile, 0.28); line(p[0] + 0.5, t, p[2] - 0.5, t);
    }
  }

  /* ---- roads: kerbs, pavements, asphalt, ranked main > shopping > lane ---- */
  const net = world.core?.kit?.net ?? world.core?.net;
  const segs = [];
  for (const e of net?.edges ?? []) {
    if (e.cls === 'hero') continue;
    const a = net.at(e, e.s0), b = net.at(e, e.s1);
    segs.push([...tw(a.x, a.z), ...tw(b.x, b.z), e.a, e.t, e.cls]);
  }
  // the bridge road, from the master junction to the gate
  segs.push([...tw(L.track.x, L.track.z0), ...tw(L.track.x, L.track.z1), L.track.w / 2, L.track.w / 2, 'lane']);
  // the main road the width of the town (the world's frame), its far walk to the lot
  const mainA = (STREET.roadZ - STREET.forecourtZ) / 2, mainZ = STREET.forecourtZ + mainA;
  segs.push([STREET.roadX0, mainZ, STREET.roadX1, mainZ, mainA, mainA + STREET.sidewalkZ - STREET.roadZ, 'main']);
  c.lineCap = 'square';
  const pass = (col, w, only) => { for (const s of segs) if (!only || only(s)) { ink(col(s), w(s)); line(s[0], s[1], s[2], s[3]); } };
  const walked = (s) => s[5] > s[4];
  pass(() => M.kerb, (s) => s[5] * 2 + 0.5, walked);
  pass(() => M.pavement, (s) => s[5] * 2, walked);
  pass((s) => M.roadCase[s[6]] ?? M.roadCase.lane, (s) => s[4] * 2 + 0.45);
  for (const k of ['lane', 'shopping', 'main']) pass(() => M.roadFill[k], (s) => s[4] * 2, (s) => s[6] === k);
  c.lineCap = 'butt';
  // the main road's centre line
  ink(M.centre, 0.18); c.setLineDash([3, 3]); line(STREET.roadX0, mainZ, STREET.roadX1, mainZ); c.setLineDash([]);
  // the rails, on across the level crossing's boards
  ink(M.railSteel, 0.16);
  for (const z of tracks) for (const d of [-R.gauge / 2, R.gauge / 2]) line(X0, z + d, X1, z + d);
  // the crossing's barriers, black and yellow either side of the tracks
  {
    const [lx] = tw(R.crossX, 0);
    for (const z of [Math.min(...tracks) - 2.3, Math.max(...tracks) + 2.3]) for (let i = 0; i < 6; i++) box([lx - 2.4 + i * 0.8, z - 0.25, lx - 1.6 + i * 0.8, z + 0.25], i % 2 ? M.gateBlack : M.gateYellow);
  }
  // the bridge's parapets
  ink(M.parapet, 0.35);
  for (const x of [bq[0] + 0.18, bq[2] - 0.18]) line(x, bq[1], x, bq[3]);

  /* ---- the zebras: their own bars, as on the road ---- */
  const zebra = (ax, az, bx, bz, width) => {
    const len = Math.hypot(bx - ax, bz - az);
    c.save();
    c.translate(ax, az); c.rotate(Math.atan2(bz - az, bx - ax));
    box([0, -width / 2, len, width / 2], M.zebraBack);
    c.fillStyle = M.zebraBar;
    for (let t = 0.25; t < len - 0.3; t += 0.9) c.fillRect(t, -width / 2 + 0.15, 0.45, width - 0.3);
    c.restore();
  };
  zebra(-TOWN.crosswalk.x, STREET.forecourtZ, -TOWN.crosswalk.x, STREET.roadZ, TOWN.crosswalk.width);
  for (const cr of world.core?.kit?.features?.crossings ?? []) {
    const a = net.at(cr.e, cr.s, -cr.e.a), b = net.at(cr.e, cr.s, cr.e.a);
    zebra(...tw(a.x, a.z), ...tw(b.x, b.z), cr.L);
  }

  /* ---- the Nippon's forecourt: paving and its painted bays ---- */
  box([STREET.x0, 0, STREET.x1, STREET.forecourtZ], M.forecourt);
  hatch([STREET.bayX0, STREET.bayZ0, STREET.bayX1, STREET.bayZ1], STREET.bayWidth, 1, M.bayLine, 0.14, STREET.bayFirstX);

  /* ---- buildings: every footprint roofed by what it is ---- */
  const inRect = (x, z, q) => x >= q[0] && x <= q[2] && z >= q[1] && z <= q[3];
  const lawsonW = [-LAWSON.width / 2, -LAWSON.depth, LAWSON.width / 2 + LAWSON.wingWidth, 0];
  const mega = spec('megastore'), stB = TOWN.station.building;
  const roofs = [];
  for (const g of world.registry ?? []) {
    if (g.kind !== 'building' || !g.rect) continue;
    const q = trect(g.rect);
    const mx = (g.rect[0] + g.rect[2]) / 2, mz = (g.rect[1] + g.rect[3]) / 2;
    // the Nippon, ドンペン堂 and the station are drawn whole, below
    if (inRect((q[0] + q[2]) / 2, (q[1] + q[3]) / 2, lawsonW) || [mega, stB].some((s) => inRect(mx, mz, [s.x0, s.z0, s.x1, s.z1]))) continue;
    const i = lots.findIndex((l) => inRect(mx, mz, l.rect)), lot = lots[i];
    const sp = SPECIALS.find((s) => inRect(mx, mz, [s.x0, s.z0, s.x1, s.z1]))?.kind;
    const kind = lot ? (lot.kind === 'shop' ? 'shop' : built[i]?.type) : sp === 'apartment' ? sp : sp === 'shrine' ? 'hall' : 'house';
    // a shop's awning faces the street it stands on (the lot's face, turned into the world)
    roofs.push({ q, kind, seed: lot?.seed ?? Math.round(mx * 13 + mz * 7), face: lot && [-lot.face.x, -lot.face.z] });
  }
  // what the land builds without a registry entry: the pond's tea house and houses
  const reg = roofs.map((b) => b.q), pondW = trect(L.pond.box);
  for (const k of world.colliders ?? []) {
    const cx = (k.x0 + k.x1) / 2, cz = (k.z0 + k.z1) / 2;
    if (k.top > 2.5 && k.x1 - k.x0 > 3 && k.z1 - k.z0 > 3 && inRect(cx, cz, pondW) && !reg.some((q) => inRect(cx, cz, q))) roofs.push({ q: [k.x0, k.z0, k.x1, k.z1], kind: 'old', seed: Math.round(cx * 31) });
  }
  roofs.push({ q: sRect(mega), kind: 'mega', face: [-1, 0] }, { q: sRect(stB), kind: 'station' }, { q: lawsonW, kind: 'konbini', face: [0, 1] });
  // shadows first, all together, so no roof's shadow falls on its neighbour's roof
  c.fillStyle = M.shadow;
  for (const { q } of roofs) { rr([q[0] + 0.7, q[1] + 0.9, q[2] + 0.7, q[3] + 0.9], 0.6); c.fill(); }
  for (const b of roofs) roof(c, b);

  /* ---- trees, where their crowns stand ---- */
  paintTrees(c, world);

  // the edge of the sheet: a soft warm vignette
  c.setTransform(1, 0, 0, 1, 0, 0);
  const g = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.max(W, H) * 0.75);
  g.addColorStop(0, M.clear); g.addColorStop(1, M.vignette);
  c.fillStyle = g; c.fillRect(0, 0, W, H);

  /* ---- the places, and where each stands ---- */
  const hv = HERO_VIEWS.morning.play.pos;
  const places = PLACES.map((p) => ({ ...p, ...STRINGS.map.places[p.id], w: p.id === 'start' ? { x: hv[0], z: hv[2] } : placeAt(p) }));

  return { canvas: cv, ppm: PPM, toPx: (x, z) => [(x - x0) * PPM, (z - z0) * PPM], places, bounds: { x0, x1, z0, z1 }, paintMs: +(performance.now() - t0).toFixed(1) };
}

/** A roof, drawn by kind: pitched ones light and shade either side of the
 * ridge (hipped ones with their hips), flat ones with a parapet line,
 * shops with their awning's colour along the frontage.  Drawn about its
 * centre with the long side along x.  `q` is a world rect. */
function roof(c, { q, kind, seed = 1, face }) {
  const S = roofStyle(kind, seed);
  const W = q[2] - q[0], D = q[3] - q[1];
  const rad = Math.min(0.6, W / 6, D / 6);
  const outline = () => { c.beginPath(); c.roundRect(-W / 2, -D / 2, W, D, rad); };
  c.save();
  c.translate((q[0] + q[2]) / 2, (q[1] + q[3]) / 2);
  outline(); c.fillStyle = S.fill; c.fill();
  c.save(); c.clip();
  c.save();
  // the detail with the long side along x
  let w = W, d = D;
  if (d > w) { c.rotate(-Math.PI / 2); [w, d] = [d, w]; }   // (its +y, the shaded side, turns to the east)
  if (S.pitched) {
    // the shaded slope (the half away from the light), the ridge, the hips
    c.fillStyle = S.shade; c.fillRect(-w / 2, 0, w, d / 2);
    c.strokeStyle = S.ridge; c.lineWidth = 0.22;
    const h = Math.min(d / 2, w / 3);
    c.beginPath(); c.moveTo(-w / 2 + h, 0); c.lineTo(w / 2 - h, 0);
    if (S.hip) for (const s of [-1, 1]) { c.moveTo(s * w / 2, -d / 2); c.lineTo(s * (w / 2 - h), 0); c.lineTo(s * w / 2, d / 2); }
    c.stroke();
  } else {
    // a flat roof's parapet, and an apartment block's balconies
    const i = Math.min(0.7, d / 6);
    c.strokeStyle = S.ridge; c.lineWidth = 0.14;
    c.beginPath(); c.roundRect(-w / 2 + i, -d / 2 + i, w - 2 * i, d - 2 * i, rad / 2); c.stroke();
    if (S.stripes) {
      c.strokeStyle = S.shade; c.lineWidth = 0.12; c.beginPath();
      for (let z = -d / 2 + 1.6; z < d / 2 - 1; z += 1.6) { c.moveTo(-w / 2 + i + 0.3, z); c.lineTo(w / 2 - i - 0.3, z); }
      c.stroke();
    }
  }
  c.restore();
  // the frontage: an awning or a sign band along the edge that faces the street
  if (S.front && face) {
    const t = S.frontT;
    c.fillStyle = S.front;
    if (Math.abs(face[1]) > 0.5) c.fillRect(-W / 2, face[1] > 0 ? D / 2 - t : -D / 2, W, t);
    else c.fillRect(face[0] > 0 ? W / 2 - t : -W / 2, -D / 2, t, D);
  }
  c.restore();
  outline(); c.strokeStyle = S.edge; c.lineWidth = 0.2; c.stroke();
  c.restore();
}

/** The trees: where the town's canopies put their cushions (each species'
 * instanced crowns, as built: every one is in its set at load), each
 * cushion a circle; in one path they merge into a crown's scalloped
 * outline.  A shadow under every crown, the crowns, their lit tops. */
function paintTrees(c, world) {
  const buckets = new Map();
  world.root?.traverse((o) => {
    const m = o.isInstancedMesh && o.count && /^(townSakura(?:Kept)?|zelkova|camphor|mapleRed|maple|pine|grove\w*?)(Near|Far)\d?$|^land-pad$/.exec(o.name);
    if (!m) return;
    const sp = o.name === 'land-pad' ? 'pad' : m[1].replace(/^townSakura\w*/, 'sakura').replace(/^grove\w*/, 'grove');
    o.updateWorldMatrix(true, false);
    const E = o.matrixWorld.elements, A = o.instanceMatrix.array, ws = Math.hypot(E[0], E[1], E[2]);
    const arr = buckets.get(sp) ?? [];
    for (let b = 0; b < o.count * 16; b += 16) {
      const lx = A[b + 12], ly = A[b + 13], lz = A[b + 14];
      arr.push(E[0] * lx + E[4] * ly + E[8] * lz + E[12], E[2] * lx + E[6] * ly + E[10] * lz + E[14], Math.hypot(A[b], A[b + 1], A[b + 2]) * ws);
    }
    buckets.set(sp, arr);
  });
  const draw = (arr, k, dx, dz, col, lo = 0.7, hi = 1.7) => {
    c.fillStyle = col; c.beginPath();
    for (let i = 0; i < arr.length; i += 3) {
      const rad = Math.max(lo, Math.min(hi, arr[i + 2] * 1.25)) * k;
      c.moveTo(arr[i] + dx + rad, arr[i + 1] + dz);
      c.arc(arr[i] + dx, arr[i + 1] + dz, rad, 0, TAU);
    }
    c.fill();
  };
  for (const [sp, arr] of buckets) if (sp !== 'pad') draw(arr, 1, 0.55, 0.7, M.treeShadow);
  for (const [sp, arr] of buckets) {
    const T = M.tree[sp];
    if (sp === 'pad') { draw(arr, 1, 0, 0, T[0], 0.25, 0.5); continue; }
    draw(arr, 1, 0, 0, T[0]);
    draw(arr, 0.62, -0.32, -0.4, T[1]);
  }
}
