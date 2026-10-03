import { TOWN, ROADS } from '../config.js';

/* ------------------------------------------------------------------ *
 * The town plan (SPEC section 3): the core's road network, derived from
 * the grid lines in config.js TOWN.grid, and the special lots.
 *
 *   the main road     the Lawson's own (lawson.js paves it); the kit only
 *                     dresses it, and never inside the hero window
 *   the spine         shopping street from the main road to the plaza
 *   lanes             everywhere else, a lane every 25-35 m
 *
 * Every crossing of two grid lines is a node; consecutive nodes on a line
 * are an edge.
 * ------------------------------------------------------------------ */

const key = (x, z) => `${x},${z}`;

/* The grid before the town pass took the two east lanes: every edge keeps
 * the seed it had then (network.js seeds by list position), so the houses
 * that frame the famous views stay the ones they were. */
const LEGACY = (G) => ({
  ...G,
  // (lane x 30 began at the main road then; Tan's bridge road carries it on now)
  ns: [...G.ns.map((r) => (r.x === 30 ? { ...r, z0: undefined } : r)), { x: 62, cls: 'lane', z1: 144 }, { x: 92, cls: 'lane', z1: 144 }],
  ew: G.ew.map((r) => ({ ...r, x1: 92 })),
});

/** Lines, nodes and edges of a grid; `slot` maps axis:c:start to an edge. */
function gridEdges(G) {
  const nodes = {};
  const node = (x, z) => { nodes[key(x, z)] = [x, z]; return key(x, z); };
  const lines = [];   // { axis, c, from, to, cls, opts }

  lines.push({ axis: 'x', c: G.main, from: G.mainX[0], to: G.mainX[1], cls: 'hero', opts: { surface: false, poles: 1 } });
  for (const r of G.ns) {
    lines.push({ axis: 'z', c: r.x, from: r.z0 ?? G.main, to: r.z1, cls: r.cls, opts: r.opts ?? {} });
  }
  for (const r of G.ew) lines.push({ axis: 'x', c: r.z, from: r.x0, to: r.x1, cls: 'lane', opts: r.opts ?? {} });

  // nodes: ends, and wherever two lines cross (ends included, so T's join)
  const stops = lines.map((l) => new Set([l.from, l.to]));
  for (let i = 0; i < lines.length; i++) {
    for (let j = 0; j < lines.length; j++) {
      const a = lines[i], b = lines[j];
      if (a.axis === b.axis) continue;
      // a crosses b at a's position b.c
      if (b.c >= a.from - 1e-6 && b.c <= a.to + 1e-6 && a.c >= b.from - 1e-6 && a.c <= b.to + 1e-6) {
        stops[i].add(b.c);
      }
    }
  }
  const edges = [];
  const slot = new Map();
  lines.forEach((l, i) => {
    const s = [...stops[i]].sort((p, q) => p - q);
    for (let k = 0; k + 1 < s.length; k++) {
      const [ax, az] = l.axis === 'x' ? [s[k], l.c] : [l.c, s[k]];
      const [bx, bz] = l.axis === 'x' ? [s[k + 1], l.c] : [l.c, s[k + 1]];
      const A = node(ax, az), B = node(bx, bz);
      slot.set(`${l.axis}:${l.c}:${s[k]}`, edges.length);
      edges.push([A, B, l.cls, { ...l.opts }]);
    }
  });
  return { nodes, edges, slot };
}

export function planNetwork() {
  const G = TOWN.grid;
  const { nodes, edges, slot } = gridEdges(G);
  const old = gridEdges(LEGACY(/*@mini G.desktop @*/G/*@@*/)).slot;
  for (const [k, i] of slot) {
    const j = old.get(k);
    if (j !== undefined && edges[i][3].seed === undefined) edges[i][3].seed = 1000 + j * 17;
  }

  /** Index of the edge on grid line (axis, c) that contains coordinate `at`. */
  const edgeAt = (axis, c, at) => {
    let best = -1;
    edges.forEach(([A, B], i) => {
      const [ax, az] = nodes[A], [bx, bz] = nodes[B];
      const same = axis === 'x' ? az === c && bz === c : ax === c && bx === c;
      if (!same) return;
      const lo = axis === 'x' ? Math.min(ax, bx) : Math.min(az, bz);
      const hi = axis === 'x' ? Math.max(ax, bx) : Math.max(az, bz);
      if (at >= lo && at <= hi) best = i;
    });
    if (best < 0) throw new Error(`no edge on ${axis}=${c} at ${at}`);
    return best;
  };

  return {
    nodes,
    edges,
    edgeAt,
    crossings: [
      /*@mini @*/{ edge: edgeAt('z', -50, 30), at: 30 },/*@@*/       // the spine, near the main road (the pocket town: ドンペン堂's door is here; its one zebra is at the plaza)
      { edge: edgeAt('z', -50, /*@mini 46 @*/100/*@@*/), at: /*@mini 46 @*/100/*@@*/ },     // and halfway down
      // the master junction (Tan): the main road's zebra (kakko, signals.js) and
      // this one across lane x 30 (piyo), side by side, so both tunes are
      // heard at one corner.  Its walk light alternates with the main road's
      // (offset 19 s puts it inside the main road's car green), as at a real
      // junction, so the two take turns
      { edge: edgeAt('z', 30, /*@mini 4 @*/23.5/*@@*/), at: /*@mini 4 @*/23.5/*@@*/, offset: 19, signalised: true },      // (the pocket town: across the gate road, behind the car park)
      // and the main road's zebra itself, painted by the kit like every other
      // crossing (stop lines, diamonds, tactile pads); its signals and walk
      // lights are signals.js's (town-edge.js), so no kit walk light here
      { edge: edgeAt('x', G.main, -TOWN.crosswalk.x), at: -TOWN.crosswalk.x, signalised: true, signal: false },
    ],
    busStops: [{ edge: edgeAt('x', G.main, 62), at: 62, side: 1 }],   // clear of the master junction's zebra
    quiet: TOWN.quiet,
    lowPoles: TOWN.lowPoles,
  };
}

/* ---- the special lots (SPEC section 3), as rectangles in the town's own
 * frame (built turned, north of the main road: world/ctx.js `turned`) ----
 * `face` is the direction the frontage looks: toward the road it opens on. */
const lane = ROADS.lane.asphalt / 2;
export const SPECIALS = [
  // a corner plot on the main road, as coin parking always is: west of the
  // Lawson's forecourt now the town stands behind the store (M2e.3)
  { kind: 'coinParking', x0: 42, z0: 20.5, x1: 62 - lane - 0.4, z1: 34.5, face: 'z-' },
  { kind: 'shrine', x0: 6, z0: 80 + lane + 0.4, x1: 20, z1: 101.5, face: 'z-' },   // deepened for the torii tunnel and two halls (experience 3)
  { kind: 'apartment', x0: 30 + lane + 0.5, z0: 86, x1: 30 + lane + 12.5, z1: 102, face: 'x-' },
  { kind: 'vacant', x0: 40, z0: 98, x1: 51, z1: 112 - lane - 0.3, face: 'z+' },
  /*@mini @*/{ kind: 'park', x0: 5, z0: 112 + lane + 0.4, x1: 24, z1: 132, face: 'z-' },/*@@*/
  // ドンペン堂, the discount megastore (experiences): two of the spine's lots
  // on its west side, halfway from the main road to the station
  { kind: 'megastore', x0: -69.3, z0: 58.2, x1: -55.3, z1: 76.0, face: 'x+' },
  { kind: 'plaza', x0: TOWN.plaza.x0, z0: TOWN.plaza.z0, x1: TOWN.plaza.x1, z1: TOWN.plaza.z1, face: 'z-' },
  // the station building's strip between the plaza and the tracks (world/line/station.js builds it)
  { kind: 'station', x0: TOWN.plaza.x0, z0: TOWN.plaza.z1, x1: TOWN.plaza.x1, z1: 154/*@dz*/, face: 'z-' },
];
