import { TOWN, WORLD, SLOWLIFE, PLACES, ANIMALS, MOBILE, SOUND } from '../config.js';

/* ------------------------------------------------------------------ *
 * The pocket town's plan (Tan, 2026-10-03: "redo the entire layout of the town such that we do just one single
 * stretch or one additional lane... extremely small but include as many experiences as possible").
 *
 * The phone's Fujikawaguchikko is still the desktop's own generator, kit and builders (world/town-core.js, kit/,
 * land/, line/) run on a much smaller plan, the key art made walkable.  From the famous view (the photographers'
 * pavement, looking at NIPPON with Fuji behind it):
 *
 *   the main road     as on the desktop, end to end; the konbini, the car park with Han, ぺったん堂 opposite the
 *                     shopping lane's mouth: untouched
 *   right             the shopping lane (the desktop's spine, x -50), 36 m long: ドンペン堂 on its corner, shops,
 *                     then the station plaza, the station and the line; the station lane (x -80) runs from the
 *                     plaza's corner over the level crossing to Hachi's home.  Everything there is the desktop's,
 *                     moved `dz` (76 m) nearer the road
 *   left              the shrine on the main road beside the store; past it two paddies and the slow-life bench
 *                     looking over them to Fuji
 *   behind you        the car park; a short road from the main road's zebra to the Deer Park gate (the tour's end)
 *
 * Gone: the river and its bridge, 鏡池, the back lanes, the pocket park, the residential rows.  Nothing in the
 * town is far from anything else, so nothing need load or unload as you walk.
 *
 * This file only sets config.js (it must run before any world module is evaluated: boot.js imports it first;
 * the lots, pocket-lots.js, right after).  Positions written into the shared builders as numbers are moved by
 * the build itself: `vite --mode mobile` rewrites the `@dz` and `@mini` marks left in comments beside them
 * (vite.config.js miniPlan), so the desktop bundle, built without the marks, is byte for byte what it was.
 * ------------------------------------------------------------------ */

const dz = MOBILE.plan.dz;
const S = (z) => z - dz;                    // a southern z, town frame
const W = (z) => z + dz;                    // ... and in the world (the town is built turned: world z = 2 main - z)
const main = TOWN.grid.main;

/* ---- the grid ---- */
TOWN.bounds.x0 = -100; TOWN.bounds.x1 = 96;
TOWN.bounds.z0 = -21;                       // the Deer Park gate's rope
TOWN.bounds.z1 = S(TOWN.bounds.z1);         // 98: the line's far side
TOWN.core.x1 = 94;                          // the paddies' far ridge
TOWN.core.z1 = S(TOWN.core.z1);             // 92
TOWN.core.buildX1 = 40;                     // lots only east of the shrine (the store's side)
TOWN.rail.z = S(TOWN.rail.z);               // 86
/* (the desktop's own lines, kept: every street the two towns share takes the seed it has there, town-plan.js, so
 * the same houses and shops stand along it) */
TOWN.grid.desktop = { ...TOWN.grid };
TOWN.grid.ns = [
  { x: -80, cls: 'lane', z0: S(126), z1: S(172) },    // the station lane: the plaza's corner, over the crossing, to Hachi's gate
  { x: -50, cls: 'shopping', z1: S(126) },            // the shopping lane, to the plaza
  { x: 30, cls: 'lane', z0: -11, z1: main },          // the gate road: the main road's zebra to the Deer Park gate
];
TOWN.grid.ew = [];
for (const k of ['z0', 'z1']) TOWN.plaza[k] = S(TOWN.plaza[k]);
for (const k of ['z0', 'z1']) TOWN.station.building[k] = S(TOWN.station.building[k]);
TOWN.quiet[1] = [-200, S(153), 200, S(171)];

/* ---- Hachi's home, across the level crossing ---- */
{
  const H = TOWN.hachiHome;
  H.z0 = S(H.z0); H.z1 = S(H.z1);
  for (const k of ['kennel', 'bed', 'ball', 'mid', 'basket', 'sand']) H[k][1] = S(H[k][1]);
  H.tunnel.z0 = S(H.tunnel.z0); H.tunnel.z1 = S(H.tunnel.z1);
  H.hoop.z = S(H.hoop.z);
}

/* ---- the land: two paddies beside the shrine, the bench at their road edge; the gate road and the Deer Park
 * gate behind the car park (no river: land/index.js leaves the channel, the bridge and 鏡池 out) ---- */
{
  const L = TOWN.land;
  L.paddies.box = [61, 22, 93, 46];
  L.track = { ...L.track, z0: -19, z1: 7.3 };
  L.deerGate = { x: 30, z: -20.6 };
  L.gateBench = { ...L.gateBench, z: -18.5 };
  L.far = [-118, -24, 118, -21];
  L.sunk = { ...L.sunk, z0: -21, z1: -21 };          // (no channel: the edge's tree lines and fences run unbroken to the main road, town-edge.js)
  L.pond = { ...L.pond, box: [60, 15.5, 96, 47] };   // (no pond: its box keeps lots off the paddies and the bench, town-core.js `reserved`)
  L.bridge = { ...L.bridge, z0: -11, z1: -11 };      // (no bridge either)
}
{
  /* the bench where the main road meets the paddies, looking over them to Fuji (the desktop's, as it stands by the
   * pond, moved whole) */
  const L = SLOWLIFE, mx = 1, mz = -83.3;
  for (const k of ['bench', 'tree', 'jizo', 'lantern']) { L[k][0] += mx; L[k][1] += mz; }
  L.petals.at[0] += mx; L.petals.at[1] += mz;
  L.butterflies.at[0] += mx; L.butterflies.at[1] += mz;
  L.glints.count = 0;                       // (the glints were the pond's)
}

/* ---- the sounds: in a town this small each place's reach is shortened, so wherever you stand you hear one place
 * at a time (the desktop's rule): the station's announcements over the plaza but not down to ドンペン堂, the walk
 * signals along their own street, the bench's flute only at the bench ---- */
SOUND.station = { ...SOUND.station, near: 14, far: 40 };
SOUND.walkSignal = { ...SOUND.walkSignal, near: 10, far: 30 };
SLOWLIFE.sound = { ...SLOWLIFE.sound, near: 4, far: 15 };

/* ---- the world's bounds follow the town's (config.js WORLD) ---- */
WORLD.bounds.x0 = -TOWN.bounds.x1; WORLD.bounds.x1 = -TOWN.bounds.x0;
WORLD.bounds.z0 = 2 * main - TOWN.bounds.z1; WORLD.bounds.z1 = 2 * main - TOWN.bounds.z0;

/* ---- the map's places ---- */
{
  const at = {
    spine: [-50, 44], donpen: [-62.3, 29.3], shrine: [51, 30], plaza: [-52.5, S(137)], station: [-51, S(151.5)],
    crossing: [-80, S(162)], hachiHome: [-78.4, S(176.6)], slowlife: [SLOWLIFE.bench[0], SLOWLIFE.bench[1]], deerGate: [30, -20.6],
  };
  for (const p of PLACES) if (at[p.id]) p.at = at[p.id];
  for (const id of ['pond', 'river']) { const i = PLACES.findIndex((p) => p.id === id); if (i >= 0) PLACES.splice(i, 1); }
}

/* ---- Hachi's tour over the pocket town (world frame).  From the view: the konbini, back over the road to Han, the
 * far pavement to ぺったん堂, over to the shopping lane: ドンペン堂, its zebra (piyo), the plaza and the station, the
 * train; the station lane over the level crossing to his home; back through the plaza and down the lane, west
 * along the store's pavement to the shrine and the bench over the paddies; over the main road's zebra (kakko) and
 * the gate road's (piyo) to the Deer Park gate, where he naps.  Every sound place is passed within earshot. ---- */
ANIMALS.guide.tour = [
  { id: 'view', x: 0, z: 16.5 },
  { id: 'konbini', x: -2.3, z: 2.3 },
  { x: -1, z: 9 },
  { x: -1, z: 18.6 },
  { x: -18.3, z: 20.5 },                      // the gap in the car park's kerb
  { id: 'han', x: -21.7, z: 23.5 },           // Han and the RX-7
  { x: -18.3, z: 20.5 },
  { x: -12, z: 19.3 },                        // east along the far pavement, behind the famous view
  { x: 20, z: 19.3 },
  { id: 'mochi', x: 39.2, z: 19.4 },          // ぺったん堂
  { x: 50, z: 17 },                           // over to the shopping lane's mouth
  { x: 50, z: 6 },
  { x: 51.5, z: -1.7, hear: 'donki' },        // ドンペン堂's door and its jingle
  { x: 50, z: -18.3, hear: 'walk1' },         // the lane's zebra (piyo), at the plaza
  { x: 50, z: -25, hear: 'station' },         // the plaza: the station's announcements
  { x: 51, z: W(-115.5) },                    // the foot of the station's steps
  { id: 'train', x: 53, z: W(-129.2) },       // platform 1: the train's listening spot
  { x: 51, z: W(-115.5) },
  { x: 68, z: W(-110) },                      // through the plaza
  { x: 80, z: W(-116) },                      // onto the station lane
  { x: 80, z: W(-127.6), cross: true, hear: 'crossing' },   // at the barrier: he waits here while it is shut
  { x: 80, z: W(-141.0) },                    // over the line
  { visit: 'home', x: 79.4, z: W(-146.6) },   // ハチのおうち
  { x: 80, z: W(-141.0), cross: true },       // back to the barrier, from the far side
  { x: 80, z: W(-127.6) },
  { x: 68, z: W(-110) },                      // back through the plaza
  { x: 50, z: -22 },
  { x: 50, z: 9.5 },                          // down the lane to the main road
  { x: 20, z: 9.5 },                          // west along the store's pavement
  { x: -20, z: 9.5 },
  { x: -51, z: 9.6, hear: 'shrine' },         // the shrine's front: its wind chimes
  { visit: 'shrine', x: -51.95, z: 4.2 },     // 富士見稲荷: through the torii, to the guardian fox
  { x: -51, z: 9.6 },
  { id: 'slowlife', x: -74, z: 9.6 },         // the bench, looking over the paddies to Fuji
  { x: -51, z: 9.6 },
  { x: -35, z: 9.2 },
  { x: -35, z: 18.6, hear: 'walk0' },         // over the main road's zebra (kakko)
  { x: -30, z: 23.7, hear: 'walk3' },         // and the gate road's (piyo)
  { x: -30, z: 36 },                          // the gate road
  { id: 'gate', x: -30, z: 45, wait: 7 },     // 鹿公園, coming soon
];
ANIMALS.guide.hear = {
  walk0: [-35, 13.8, 14], walk1: [50, -18.3, 14], walk3: [-30, 23.7, 14], donki: [55.9, -1.7, 12],
  station: [51, W(-125.5), 14], crossing: [80, W(-134.3), 10], shrine: [-51, -2.2, 14],
};
ANIMALS.guide.nap = [TOWN.land.gateBench.x, TOWN.land.gateBench.z + 0.75];
