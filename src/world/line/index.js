import { TOWN } from '../../config.js';
import { buildTrack, LINE_Z } from './track.js';
import { buildCrossing } from './crossing.js';
import { makeFleet } from './emu.js';
import { makeService } from './service.js';
import { buildStation } from './station.js';
import { buildHouse } from '../kit/houses.js';
import { ROADS } from '../../config.js';
import { rngKit } from '../../core/util.js';
import { trainVoice, sfxListen } from './sfx.js';

/* ------------------------------------------------------------------ *
 * The line, the station and the trains (SPEC section 3, M2c).
 *
 *   track     double track, fences, catenary, cuttings
 *   crossing  the level crossing on lane x -80
 *   station   building, two platforms, the in-station crossing, the plaza
 *   service   two sets and the timetable they keep; it works the crossing
 *
 * `onEvent(name, run)` hears the service ('arrive', 'chime', 'depart' ...),
 * which is how main.js plays the door chime where the train is.
 * ------------------------------------------------------------------ */

export function buildLine(ctx, { kit }) {
  const R = TOWN.rail;
  const B = TOWN.station.building, PLt = TOWN.station.platforms;
  const crossHalf = 3.8;
  const track = buildTrack(ctx, {
    gaps: [
      { x0: R.crossX - crossHalf, x1: R.crossX + crossHalf },       // the level crossing
      { x0: B.x0, x1: B.x1, side: -1 },                              // the station building is the boundary
      /* the platforms' backs stand in the fences' line (and the annex's wall): the fence ran in their faces, mesh
       * flickering through concrete (QA: z-fighting).  The lineside fence stops at each platform's end; the
       * platforms carry their own along the back (station.js). */
      { x0: PLt.x0, x1: B.x0, side: -1, wall: true },
      { x0: B.x1, x1: PLt.x1, side: -1, wall: true },
      { x0: PLt.x0, x1: PLt.x1, side: 1, wall: true },
    ],
    // boards over the tracks: the level crossing's deck, the station's own crossing (station.js): no sleepers under them
    decks: [
      { x0: R.crossX - ROADS.lane.asphalt / 2 - 0.7, x1: R.crossX + ROADS.lane.asphalt / 2 + 0.7 },
      { x0: TOWN.station.platforms.x1 + 6 * 0.42, x1: TOWN.station.platforms.x1 + 6 * 0.42 + 2.6 },
    ],
  });
  /*@mini globalThis.__sys?.('line-track'); @*//*@@*/
  const crossing = buildCrossing(ctx, { x: R.crossX, kit });
  /*@mini globalThis.__sys?.('line-crossing'); @*//*@@*/
  // its bells are a sound experience (Tan, 2026-09-28): a speaker on the map
  ctx.experiences?.add({ kind: 'sound', id: 'crossing', name: 'Level crossing bells', jp: '踏切', x: R.crossX, z: LINE_Z });
  // the fleet: a slot per track, showing whichever of the three types its run needs (config TOWN.rail.trains)
  const fleet = makeFleet(ctx, { slots: 2 });
  fleet.prime(R.trains ?? ['box']);       // built at load, hidden until their run: no hitch when one first appears
  /*@mini globalThis.__sys?.('line-trains'); @*//*@@*/
  const sets = fleet.slots;
  const listeners = [];
  const service = makeService({ sets, crossing, onEvent: (name, run) => listeners.forEach((f) => f(name, run)) });
  const station = buildStation(ctx, { kit, service, sets });
  /*@mini globalThis.__sys?.('line-station'); @*//*@@*/
  buildBeyond(ctx, kit);
  /*@mini globalThis.__sys?.('line-beyond'); @*//*@@*/
  lineCherries(ctx);
  // Hachi's own cherry, in his garden's corner (last in the list: the town's cherries keep their order, and the
  // famous views their petals and shadows)
  /*@mini @*/{ const HH = TOWN.hachiHome; ctx.sakura?.push({ x: HH.x1 - 1.7, z: HH.z1 - 1.5, y: 0, scale: 0.9, seed: 7461 }); }/*@@*/
  /* the trains' sound and their straps: only near */
  const voices = sets.map(() => trainVoice());
  const lastV = sets.map(() => 0);
  ctx.update((dt, cam) => {
    service.update(dt);
    if (!cam) return;
    sfxListen(cam);
    const me = ctx.toLocal({ x: cam.x, z: cam.z });
    service.runs.forEach((r, i) => {
      const dx = Math.max(0, Math.abs(me.x - r.x) - r.len / 2), d = Math.hypot(dx, me.z - r.z);
      const visible = r.phase !== 'idle';
      const dv = dt > 0 ? (r.v - lastV[i]) / dt : 0;
      lastV[i] = r.v;
      sets[i].animate(dt, r.v, visible && d < 45);
      // the nearest point of the train, in the world
      const nx = Math.max(r.x - r.len / 2, Math.min(r.x + r.len / 2, me.x));
      voices[i].step(dt, { v: r.v, dv, at: ctx.toWorld({ x: nx, z: r.z }), phase: r.phase, visible });
    });
    station.update(dt, cam, me);
  });
  return {
    track, crossing, sets, fleet, service, station,
    z: LINE_Z,
    /** After dark the trains' interiors light up. */
    setLook(look) {
      const k = Math.max(0, Math.min(1, (look.store.spill - 0.05) / 0.25));
      fleet.setNight(k);
    },
    crossingPos: { x: R.crossX, z: LINE_Z },
    onEvent(f) { listeners.push(f); },
    /** How hard the nearest moving train shoves the air at `p` (0..1), for the petals. */
    gustAt(p) {
      let best = 0, dir = 1;
      for (const r of service.runs) {
        if (r.phase === 'idle' || r.v < 1) continue;
        const d = Math.hypot(Math.max(0, Math.abs(p.x - r.x) - r.len / 2), p.z - r.z);
        const near = Math.max(0, 1 - d / 46) * Math.min(1, r.v / 20);
        if (near > best) { best = near; dir = r.dir; }
      }
      return { gust: best * best, dir };
    },
  };
}

/**
 * The houses on the far side of the line: out of bounds, but what the
 * platforms and the crossing look across at.  The town's own house
 * generator, on lots facing the tracks.
 */
/* Cherries along the line (M2e, reference 18-22): a row between the south
 * fence and the houses beyond, clear of the level crossing. */
function lineCherries(ctx) {
  const r = rngKit(7400);
  const z = TOWN.rail.z + 7.4 + 1.5;
  for (let x = TOWN.core.x0 + 6; x < TOWN.core.x1 - 4; x += r.range(11, 16)) {
    if (Math.abs(x - TOWN.rail.crossX) < 9) continue;
    ctx.sakura?.push({ x, z: z + r.range(-0.2, 0.3), y: 0, scale: r.range(0.95, 1.25), seed: 7400 + Math.round(x) });
  }
}

function buildBeyond(ctx, kit) {
  const r = rngKit(7300);
  const z0 = TOWN.bounds.z1 - 1.6;            // just behind the town's south fence
  const fakeEdge = { cls: 'lane', spec: ROADS.lane };
  const HH = TOWN.hachiHome;
  let x = TOWN.core.x0 + 1;
  let k = 0;
  while (x < TOWN.core.x1 - 7) {
    const w = r.range(8, 11.5);
    const cx = x + w / 2;
    const lot = { e: fakeEdge, w, depth: 11, seed: 7300 + k * 37, side: 1 };
    const F = {
      at: (u, v) => ({ x: cx + u, z: z0 + v }),
      face: { x: 0, z: -1 }, faceKey: 'z-', ry: Math.PI,
    };
    // (the lot at the end of the crossing's lane is Hachi's garden: animals/home.js)
    if (/*@mini true @*/!(x < HH.gate.x && x + w > HH.gate.x)/*@@*/) buildHouse(ctx, null, kit, lot, F);
    x += w + r.range(0.6, 1.4);
    k++;
  }
}
