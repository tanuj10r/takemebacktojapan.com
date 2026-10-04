import * as THREE from 'three';
import { tripod, dolly, orbit, drone, follow, hachiEye, cut, handheld } from './camera.js';
import { KONBINI_DRIFT } from './han.js';
import { lerp, ease, seg, bell } from './util.js';

/* ------------------------------------------------------------------ *
 * The shots (Director Mode, dev only; Part 7 and Version C).  Each shot:
 * { id, name, dur, look, setup(env) -> { rig(t), update?(t, dt, env), end? } }.
 * setup places the cast and lays out their timeline on the shot's clock
 * (times may start before 0: the action is already under way at the cut);
 * the rig is the camera.  World frame throughout (the store's front is at
 * z 0, its door at x -2.3; the main road z 10.5-17.2).
 *
 * The shots are 1-3 s: a reaction's natural length is compressed with
 * `dur` where a shot needs it, and what happens between shots is the cut's
 * business.
 * ------------------------------------------------------------------ */

const V = (x, y, z) => ({ x, y, z });
const DOOR = { x: -2.3, z: 0.25 };
const BENCH = { x: -73, z: -74.8 };
const KENNEL = { x: 83, z: -89.75 };
const CROSSING = { x: 80, z: -134.3 };
const MASCOT = { x: 54.95, z: -41.41 };
const TORII = { x: -13, z0: -58.6, z1: -65.2 };
/** the vending machine the director stands by the store's west corner (A9, A10: Hachi's cover) */
export const VEND = { x: -8.25, z: 1.6, ry: 0 };
const HAN_BAY_K = { x: -4.7, z: 5.3 };          // nose-in, left of the door (KONBINI_DRIFT ends here)

/** The line's train run forward `secs` from where 'approach' stages it (eastbound, the front short of the crossing). */
function train(service, secs) {
  if (!service) return;
  service.stage('approach');
  for (let k = 0; k < secs * 60; k++) service.update(1 / 60);
}
/** Where the moving train's front is (world), for eyes to follow. */
function trainFront(service) {
  const r = service?.runs?.find((q) => q.phase !== 'idle');
  return r ? V(CROSSING.x + (r.x - 0) * 0 + 0, 1.8, CROSSING.z - 2.5) : null;
}
const head = (pup) => () => { const s = pup.state; return V(s.x, (s.y ?? 0) + 0.24, s.z); };
const at = (x, z, y = 0) => V(x, y, z);
/** a point by the pup at height y, `ahead` metres along its heading */
const near = (pup, ahead = 0, y = 0.24) => () => { const s = pup.state; return V(s.x + Math.sin(s.yaw) * ahead, (s.y ?? 0) + y, s.z + Math.cos(s.yaw) * ahead); };

/* ------------------------------------------ Version A: Hachi's Big Day ------------------------------------------ */
const A = [
  {
    id: 'A1', name: 'Wake up at the kennel', dur: 1.5, look: 'day',
    setup({ pup }) {
      // curled in the kennel's doorway (its door faces -z)
      const p = { x: KENNEL.x - 0.15, z: KENNEL.z - 0.9 };
      pup.reset({ x: p.x, z: p.z, yaw: Math.PI + 0.55, posture: 2 });
      pup.react('wakeUp', -0.9, { dur: 1.9 });
      pup.pose(0.62, 0, 0.3);                                   // up from the stretch, standing
      pup.look(0.55, 1.05, 'camera');
      pup.react('zoomOff', 1.0, { dur: 0.25 });
      pup.go(1.2, { x: p.x - 4.5, z: p.z - 1.2 }, 'sprint', { straight: true });
      return { rig: tripod(V(p.x - 0.45, 0.3, p.z - 1.3), V(p.x + 0.05, 0.2, p.z), { fov: 38, push: 0.08, dur: 1.5 }) };
    },
  },
  {
    id: 'A2', name: 'Stripe hops at the crossings', dur: 1.5, look: 'day',
    setup({ pup }) {
      // the side street's zebra (piyo) then the main road's (kakko); a hop on each white stripe
      // the lane's zebra runs x -32.2..-27.8 at z 3.1-6.1 (measured from above); already hopping at the cut
      pup.reset({ x: -32.7, z: 4.6, yaw: Math.PI / 2 });
      pup.stripeHop(-0.55, { x: -27.4, z: 4.6 });
      return {
        rig: cut([
          // side-on and low from the lane south of the zebra, panning with him, Fuji up the lane behind (its corners
          // have a fence and the signal cabinet, so a camera riding beside him would go through them)
          [0, () => { const s = pup.state; return { p: V(-29.9, 0.34, 7.5), l: V(s.x + 0.35, 0.3, s.z), fov: 45 }; }],
          [0.75, () => ({ p: V(-35, 3.0, 18.9), l: V(-35, 0, 14.4), fov: 50 })],   // his whole way across inside the safe frame
        ]),
        update(t, dt, env) {
          if (t >= 0.75 && !this.moved) { this.moved = true; pup.reset({ x: -35, z: 16.0, yaw: Math.PI }); pup.stripeHop(0.75, { x: -35, z: 10.2 }, { v: 3.0 }); }
        },
      };
    },
  },
  {
    id: 'A3', name: 'Watching the train', dur: 1.5, look: 'day',
    setup({ pup, service }) {
      train(service, 1.0);
      const p = { x: CROSSING.x - 2.6, z: CROSSING.z + 3.9 };
      pup.reset({ x: p.x, z: p.z, yaw: Math.PI + 0.25, posture: 1 });
      pup.react('sitWatch', -0.2, { dur: 1.2 });
      pup.look(-0.2, 0.95, () => trainFront(service));
      pup.react('startle', 0.95, { dur: 0.55 });
      return { rig: tripod(V(p.x - 0.6, 0.35, p.z + 1.2), V(p.x + 3.8, 0.95, p.z - 3.4), { fov: 60 }) };
    },
  },
  {
    id: 'A4', name: 'The station announcement', dur: 1.0, look: 'day',
    setup({ pup }) {
      const p = { x: 51, z: -117.5 };
      pup.reset({ x: p.x, z: p.z, yaw: Math.PI, posture: 1 });
      pup.react('startle', 0.05, { dur: 0.35 });
      pup.react('headTilt', 0.45, { dur: 0.55 });
      return {
        rig: cut([
          [0, (t) => ({ p: V(p.x, 0.32, p.z - 0.2), l: V(p.x, 1.6, p.z - 8), fov: 60 })],
          [0.42, tripod(V(p.x + 0.25, 0.34, p.z - 1.25), V(p.x, 0.27, p.z), { fov: 35 })],
        ]),
      };
    },
  },
  {
    id: 'A5', name: 'The torii tunnel, a petal', dur: 1.5, look: 'day',
    setup({ pup, env }) {
      pup.reset({ x: TORII.x, z: TORII.z0 - 0.3, yaw: Math.PI });
      pup.go(0, { x: TORII.x, z: TORII.z0 - 2.2 }, 'trot', { straight: true, v: 2.2 });
      pup.react('headTilt', 0.72, { dur: 0.32, side: 1 });
      pup.react('sniff', 0.95, { dur: 0.25 });
      pup.react('sneeze', 1.1, { dur: 0.45 });
      return {
        rig: dolly([
          { t: 0, x: TORII.x, y: 0.42, z: TORII.z0 + 1.4, lx: TORII.x, ly: 0.35, lz: TORII.z0 - 3 },
          { t: 1.5, x: TORII.x, y: 0.4, z: TORII.z0 - 0.4, lx: TORII.x, ly: 0.3, lz: TORII.z0 - 4 },
        ], { fov: 45 }),
        update(t) { petal(env, t, pup); },
      };
    },
  },
  {
    id: 'A6', name: 'Zoomies at ドンペン堂', dur: 1.5, look: 'golden',
    setup({ pup }) {
      // out in the street, 6 m off the front: close and low on him, the mascot 4.3 m up still in frame above
      const p = { x: MASCOT.x - 6.3, z: MASCOT.z + 0.3 };
      pup.reset({ x: p.x, z: p.z, yaw: Math.PI / 2 });
      pup.react('zoomies', -0.2, { dur: 1.0 });
      pup.react('playBow', 0.85, { dur: 0.65 });
      return { rig: tripod(V(p.x - 3.0, 0.3, p.z + 0.6), V(MASCOT.x, 1.75, p.z + 0.6), { fov: 65 }) };   // (on the zoomies' circle)
    },
  },
  {
    id: 'A7', name: 'Shake off by the pond', dur: 1.0, look: 'golden',
    setup({ pup }) {
      // on the promenade's edge; the camera low over the water, looking back at it (the bench's trees behind)
      const p = { x: -72, z: -90.4 };
      pup.reset({ x: p.x, z: p.z, yaw: Math.PI - 0.3 });
      pup.react('shakeOff', -0.05, { dur: 1.0 });
      return { rig: tripod(V(p.x + 0.6, 0.42, p.z - 1.55), V(p.x, 0.25, p.z), { fov: 46 }), noCollide: true };
    },
  },
  {
    id: 'A8', name: 'Night falls: to the konbini', dur: 1.0, look: 'blue',
    setup({ pup }) {
      pup.reset({ x: -4, z: 12.8, yaw: Math.PI });
      pup.go(0, { x: -4, z: 8.8 }, 'trot', { straight: true });
      // high to low; the aim travels from him down on the road to the store and Fuji, so he is in frame all the way
      return {
        rig: (t) => {
          const u = ease(Math.min(1, Math.max(0, t / 1.0)));
          const w = u * u;                                          // (the aim leaves him late: he stays above the bottom 20%)
          return { p: V(-4, lerp(7.5, 1.3, u), lerp(21.5, 17, u)), l: V(lerp(-3.6, -1, w), lerp(-1.5, 2.2, w), lerp(7, -6, w)), fov: 60 };
        },
      };
    },
  },
  {
    id: 'A9', name: 'The RX-7 drifts in', dur: 2.0, look: 'blue',
    setup({ pup, han }) {
      han.reset({ car: null, han: 'seat' });
      han.driftToKonbini(-1.9);
      const p = { x: -8.0, z: 8.1 };
      pup.reset({ x: p.x, z: p.z, yaw: 1.2 });
      pup.look(0, 0.9, () => { const c = han.position; return c ? V(c.x, 0.6, c.z) : null; });
      pup.react('startle', 0.55, { dur: 0.5 });
      pup.react('scared', 1.05, { dur: 0.55 });
      pup.go(1.55, { x: VEND.x - 0.2, z: VEND.z - 0.9 }, 'sprint', { straight: true });
      return { rig: tripod(V(-9.6, 0.35, 9.6), V(-4.5, 0.6, 5.2), { fov: 55 }) };
    },
  },
  {
    id: 'A10', name: 'Han gets out; Hachi peeks', dur: 1.5, look: 'blue',
    setup({ pup, han }) {
      han.reset({ car: { x: HAN_BAY_K.x, z: HAN_BAY_K.z, a: -Math.PI / 2 }, han: 'seat' });
      han.exitCar(-2.8);
      han.walk(-0.9, [{ x: -3.7, z: 4.1 }, { x: -2.4, z: 0.4 }], 'cool', 1.9);   // (in frame past the machine from 0, at the door 1.3)
      han.doorFor(0.9, 3);
      han.say(1.3, 'chime');
      // behind the machine from Han's side of it; the head slides out past its edge
      // in the gap behind the machine (between it and the glass); the camera looks east along the storefront, the
      // machine the right edge of the frame; Han comes into view past it as he reaches the door
      pup.reset({ x: VEND.x - 0.05, z: 0.62, yaw: Math.PI / 2 });
      pup.react('hideAndPeek', -0.3, { dur: 1.75 });
      pup.look(0.2, 1.5, () => { const c = han.position; return c ? V(c.x, 1.3, c.z) : null; }, 0.7);
      return { rig: tripod(V(-10.2, 0.45, 0.8), V(-2.5, 0.85, 1.25), { fov: 55 }) };
    },
  },
  {
    id: 'A11', name: 'Face on the glass', dur: 1.5, look: 'blue',
    setup({ pup }) {
      pup.reset({ x: -1.75, z: 0.42, yaw: Math.PI });
      pup.react('faceOnGlass', -0.3, { dur: 2.0 });
      return {
        rig: tripod(V(-1.7, 0.66, -2.05), V(-1.75, 0.45, 0.4), { fov: 36, push: 0.05, dur: 1.5 }),
        update(t, dt, env) { glassFog(env, t, pup); },
      };
    },
  },
  {
    id: 'A12', name: 'Han at the fridge and the till', dur: 1.5, look: 'blue',
    setup({ pup, han, shop }) {
      const till = shop.unitAt(shop.debug.TILL.stand), cool = shop.coolerAt;
      han.reset({ car: { x: HAN_BAY_K.x, z: HAN_BAY_K.z, a: -Math.PI / 2 }, han: 'hidden' });
      han.walk(-0.4, [{ x: till.x - 1.8, z: till.z - 1.2 }, { x: till.x - 0.35, z: till.z }], 'cool', 1.6);
      han.hold(0.55, 'stand', { x: till.x - 0.35, z: till.z, yaw: Math.PI / 2 });
      han.say(0.05, 'fridge-door', 0.5, { x: cool.x, z: cool.z });
      han.say(0.55, 'kiosk-scan', 0.8, { x: till.x, z: till.z });
      han.say(1.15, 'ka-ching', 0.9, { x: till.x, z: till.z });
      // through the clear middle pane (between the flag's post and the bins), over the glass's low wall, on the
      // checkout counter and its self-registers: Hachi up on his hind legs, paws on the ledge, watching; his ears in
      // the bottom of the frame
      const cam = V(2.3, 1.12, 2.45);
      pup.reset({ x: 3.0, z: 0.74, yaw: Math.atan2(2.9, -6.95), posture: 1 });
      pup.react('faceOnGlass', -0.8, { dur: 3.2, peek: true });
      pup.look(0, 1.5, () => { const c = han.position; return c ? V(c.x, 1.3, c.z) : null; }, 0.8);
      return { rig: tripod(cam, V(till.x - 0.25, 1.3, till.z), { fov: 45 }) };
    },
  },
  {
    id: 'A13', name: 'Han cracks the can', dur: 1.0, look: 'blue',
    setup({ pup, han }) {
      han.reset({ car: { x: HAN_BAY_K.x, z: HAN_BAY_K.z, a: -Math.PI / 2 }, han: 'hidden' });
      han.walk(-0.9, [{ x: -2.3, z: -0.4 }, { x: -2.0, z: 1.6 }], 'cool', 1.6);
      han.hold(0.2, 'stand', { x: -2.0, z: 1.6, yaw: 0.2 });
      han.doorFor(-1, 0.3);
      han.drink(-0.3);
      han.say(0.0, 'chime');
      pup.reset({ x: -1.6, z: 2.15, yaw: -2.6, posture: 0 });
      pup.react('tippyTaps', -0.1, { dur: 1.1 });
      return { rig: tripod(V(-0.6, 0.3, 3.7), V(-1.9, 0.75, 1.3), { fov: 55 }) };   // (him above the bottom 20%, Han's head under the top 15%)
    },
  },
  {
    id: 'A14', name: 'Han sees double', dur: 3.0, look: 'blue', drunk: true,
    setup({ pup, han, env }) {
      han.reset({ car: { x: HAN_BAY_K.x, z: HAN_BAY_K.z, a: -Math.PI / 2 }, han: 'hidden' });
      pup.reset({ x: -1.6, z: 4.1, yaw: 0.1, posture: 1 });
      pup.react('headTilt', 0.2, { dur: 1.3, side: 1 });
      pup.react('sneeze', 1.7, { dur: 1.1 });
      pup.double((t) => 0.18 + 0.1 * Math.sin(t * 1.7));
      const eye = V(-1.9, 1.62, 5.9);
      return {
        rig: (t) => {
          const sway = Math.sin(t * 1.3) * 0.12, wrong = 0.55 * bell(t, 2.1, 2.9, 0.25, 0.3);
          const a = sway + wrong;
          return { p: V(eye.x + Math.sin(t * 0.9) * 0.06, eye.y + Math.sin(t * 1.9) * 0.03, eye.z), l: V(-1.6 + Math.sin(a) * 2, 0.3 + 0.1 * Math.sin(t * 1.1), 4.1 - Math.cos(a) * 0.4), fov: 55, roll: 0.07 * Math.sin(t * 1.2) };
        },
        update(t) { env.blur = 0.55 + 0.25 * Math.sin(t * 1.5); },
        end() { env.blur = 0; },
      };
    },
  },
  {
    id: 'A15', name: 'Hachi leads Han home', dur: 2.5, look: 'blue',
    setup({ pup, han }) {
      han.reset({ car: { x: HAN_BAY_K.x, z: HAN_BAY_K.z, a: -Math.PI / 2 }, han: 'hidden' });
      // across the open lawn before the tea house, toward the bench; the camera leads, low in front of him looking
      // back, so Han weaves along behind him in the background
      pup.reset({ x: -61.2, z: -91.5, yaw: -0.55 });
      // leadOn: ahead, a stop, back over his shoulder at Han (the boof is the look back's own), on again
      const t1 = pup.leadOn(-0.05, [{ x: -63.6, z: -87.4 }], () => { const c = han.position; return c ? V(c.x, 1.4, c.z) : null; }, { v: 2.0, wait: 0.75 });
      pup.say(t1 + 0.05, 'dog-yip', 0.7);
      pup.go(t1, { x: -64.4, z: -86.0 }, 'trot', { straight: true, v: 2.0 });
      han.walk(-1.5, [{ x: -57.2, z: -99.2 }, { x: -60.4, z: -93.8 }], 'drunk', 0.9);
      han.lookAt(0, 2.5, () => { const s = pup.state; return V(s.x, 0.3, s.z); });
      return { rig: follow(() => pup.state, { back: -1.9, side: -0.25, h: 0.34, ahead: -1.2, lookH: 0.3, lookUp: 0.12, fov: 50 }) };
    },
  },
  {
    id: 'A16', name: 'Asleep on the bench', dur: 1.5, look: 'blue',
    setup({ pup, han, env }) {
      han.reset({ car: { x: HAN_BAY_K.x, z: HAN_BAY_K.z, a: -Math.PI / 2 }, han: 'hidden' });
      han.hold(-1, 'benchSleep', { x: BENCH.x, z: BENCH.z + 0.1, yaw: Math.PI });
      pup.reset({ x: BENCH.x + 0.95, z: BENCH.z - 0.35, yaw: 2.4 });
      pup.react('fallAsleep', -2.2, { dur: 3.2 });
      return {
        // from behind the bench, pulling back and up: the two asleep in the foreground, the paddies and Fuji beyond
        rig: drone(V(BENCH.x + 1.3, 1.1, BENCH.z + 2.3), V(BENCH.x + 2.6, 4.2, BENCH.z + 8.5), V(BENCH.x, 1.0, BENCH.z - 4), { dur: 1.5, fov: 50 }),
        update(t) { if (!this.song && t >= 0) { this.song = true; env.soundBus.oneShot('theme', { gain: 0.35 }); } },
      };
    },
  },
];

/* ------------------------------------------ Version B: Hachi Fears Nothing ------------------------------------------ */
const B = [
  {
    id: 'B1', name: 'The proud strut', dur: 1.0, look: 'day',
    setup({ pup }) {
      pup.reset({ x: -35, z: 9.3, yaw: 0 });
      pup.go(-0.2, { x: -35, z: 11.6 }, 'strut', { straight: true });
      pup.react('proudStrut', -0.2, { dur: 1.3 });
      return { rig: tripod(V(-35.15, 0.3, 13.3), V(-35, 0.32, 9.5), { fov: 40 }) };
    },
  },
  {
    id: 'B2', name: 'The train roars past', dur: 1.5, look: 'day',
    setup({ pup, service }) {
      train(service, 1.45);
      const p = { x: CROSSING.x - 2.6, z: CROSSING.z + 3.9 };
      pup.reset({ x: p.x, z: p.z, yaw: Math.PI + 0.25 });
      pup.react('startle', 0.3, { dur: 0.5 });
      pup.react('scared', 0.75, { dur: 0.8 });
      return { rig: tripod(V(p.x - 0.6, 0.35, p.z + 1.2), V(p.x + 3.8, 0.95, p.z - 3.4), { fov: 60 }) };
    },
  },
  {
    id: 'B3', name: 'The mascot', dur: 1.5, look: 'golden',
    setup({ pup }) {
      // out in the street (as A6), close on him backing away, the mascot rocking up on the front above
      const p = { x: MASCOT.x - 5.8, z: MASCOT.z + 0.4 };
      pup.reset({ x: p.x, z: p.z, yaw: Math.PI / 2 });
      pup.look(0, 1.5, V(MASCOT.x, 4.3, MASCOT.z), 0.8);
      pup.react('scared', 0.1, { dur: 1.4 });
      return { rig: tripod(V(p.x - 1.7, 0.35, p.z - 0.2), V(MASCOT.x, 1.55, p.z), { fov: 68 }) };
    },
  },
  {
    id: 'B4', name: 'Smoke over Hachi', dur: 2.0, look: 'golden',
    setup({ pup, han }) {
      han.reset({ car: null, han: 'seat' });
      han.driftToKonbini(-3.0);
      const p = { x: -7.0, z: 8.4 };
      pup.reset({ x: p.x, z: p.z, yaw: 1.0, posture: 1 });
      pup.look(0, 0.9, () => { const c = han.position; return c ? V(c.x, 0.6, c.z) : null; });
      pup.react('sneeze', 0.95, { dur: 0.6 });
      pup.react('headShake', 1.5, { dur: 0.45 });
      return { rig: tripod(V(-8.3, 0.3, 9.9), V(-5.5, 0.5, 6.5), { fov: 55 }) };
    },
  },
  {
    id: 'B5', name: 'The doors open', dur: 1.5, look: 'blue',
    setup({ pup, shop, env }) {
      pup.reset({ x: -2.2, z: 1.35, yaw: Math.PI, posture: 1 });
      pup.react('startle', 0.1, { dur: 0.45 });
      pup.react('headTilt', 0.6, { dur: 0.45, side: -1 });
      pup.react('tippyTaps', 1.02, { dur: 0.5 });
      env.visitAt = -0.2;
      return {
        rig: tripod(V(-2.3, 0.5, -1.6), V(-2.2, 0.38, 1.35), { fov: 46 }),
        update(t) { if (!this.go && t >= 0) { this.go = true; env.G.sound.storeChime({ x: -2.3, y: 2.3, z: 0.1 }); env.G.sound.autoDoor({ x: -2.3, y: 1.2, z: 0.1 }, true); env.G.world.lawson.door.also = () => ({ x: -2.3, z: 0.3 }); } },
        end() { env.G.world.lawson.door.also = null; },
      };
    },
  },
  {
    id: 'B6', name: 'In and out: fridge, sando, scanner, card', dur: 2.5, look: 'blue', pov: true, noCollide: true,
    setup({ pup, shop, player, camera, env }) {
      // the real konbini visit (the egg sando), in the player's own eyes, cut to four moments of it: the way past the
      // fridges, the hand taking the sando, the scanner, the card on the reader (slow)
      pup.show(false);
      const at = [[0, 4.35], [0.6, 5.55], [1.2, 16.45], [1.8, 18.2]];
      let vt = 0, k = -1;
      const ff = (to) => { while (vt < to - 1e-6) { const d = Math.min(1 / 60, to - vt); shop.update(d, camera, 0); vt += d; } };
      return {
        rig: (t) => {
          const d = new THREE.Vector3(); camera.getWorldDirection(d);
          return { p: camera.position.clone(), l: camera.position.clone().add(d), fov: 62 };
        },
        update(t, dt, e) {
          if (k < 0) { player.pos.set(-2.6, player.pos.y, 6.5); player.yaw = 0; shop.play('sando_egg'); k = 0; }
          vt += dt;                                            // (dt is already slowed for the tap)
          while (k < at.length && t >= at[k][0]) { ff(at[k][1]); k++; }
          if (!this.a && t >= 0.08) { this.a = true; e.soundBus.oneShot('fridge-door', { x: -2.4, z: -11.8, y: 1, near: 3, far: 14, gain: 0.55 }); }
          e.slowTap = t >= 1.95 && t < 2.45;
        },
        end() { env.slowTap = false; shop.debug?.cancel?.(); },
      };
    },
  },
  {
    id: 'B7', name: 'Puppy eyes at your feet', dur: 2.0, look: 'blue', noCollide: true,
    setup({ pup, env }) {
      pup.reset({ x: -3.0, z: 3.0, yaw: -0.05, posture: 1 });
      pup.react('puppyEyes', -0.1, { dur: 1.3 });
      pup.react('beg', 1.15, { dur: 0.85 });
      pup.say(0.05, 'wrapper', 0.7);
      return { rig: (t) => ({ p: V(-3.0, 1.55, 3.95 + 0.02 * Math.sin(t)), l: V(-3.0, 0.1, 3.0), fov: 55 }) };
    },
  },
  {
    id: 'B8', name: 'A piece of egg sando', dur: 2.0, look: 'blue', noCollide: true,
    setup({ pup, env }) {
      pup.reset({ x: -3.0, z: 3.0, yaw: -0.05, posture: 1 });
      pup.react('munch', 0.55, { dur: 0.8 });
      pup.react('happyWiggle', 1.3, { dur: 0.7, seated: true });   // (the bounce, not the spin: his face stays ours)
      return {
        rig: cut([
          [0, (t) => ({ p: V(-3.0, 1.55, 3.95), l: V(-3.0, 0.1, 3.0), fov: 55 })],
          [0.5, tripod(V(-2.5, 0.34, 3.85), V(-3.0, 0.24, 3.0), { fov: 38 })],
        ]),
        update(t) { sandoPiece(env, t, pup); },
      };
    },
  },
  {
    id: 'B9', name: 'Full belly, fast asleep', dur: 2.0, look: 'blue',
    setup({ pup, env }) {
      pup.reset({ x: -3.2, z: 3.4, yaw: 2.0 });
      pup.react('fallAsleep', -1.8, { dur: 3.0 });
      return {
        // from close on him asleep, back and up; the aim leaves him late for the store and Fuji
        rig: (t) => {
          const u = ease(Math.min(1, Math.max(0, t / 2.0))), w = u * u;
          return { p: V(lerp(-3.3, -2.6, u), lerp(0.75, 4.2, u), lerp(5.0, 13.5, u)), l: V(lerp(-3.2, -2.4, w), lerp(0.15, 1.9, w), lerp(3.4, -2, w)), fov: 50 };
        },
        update(t) { if (!this.c && t >= 1.1) { this.c = true; env.G.sound.storeChime({ x: -2.3, y: 2.3, z: 0.1 }); } },
      };
    },
  },
];

/* ------------------------------------------ Version C: Hachi Hears Japan ------------------------------------------ */
/* One take: the sounds, clean (not in the world), over a quiet bed; the cue list is what both the real-time take and
 * the deterministic 4K render play, so they match. */
/* Each sound starts on its beat: `offset` skips a file's lead-in to its first note (measured: the bells' first strike
 * 0.14 s in, the ka-ching's 0.38 s, the chime's 0.06 s), and the crossing signals loop just their calls (loopStart,
 * loopEnd) so two cycles fit in their 3 s. */
const C_CUES = [
  { t: 0, name: 'wind', gain: 0.22, dur: 28, loop: true, fadeIn: 0.5, fadeOut: 1.0, bed: true },
  { t: 1.0, name: 'walk-piyo', gain: 0.8, dur: 3.0, loop: true, loopEnd: 1.8, offset: 0.04, fadeOut: 0.3, cap: 'ぴよぴよ · crosswalk chick' },
  { t: 4.0, name: 'walk-kakko', gain: 0.8, dur: 3.0, loop: true, loopStart: 2.2, loopEnd: 3.95, offset: 3.28, fadeOut: 0.3, cap: 'カッコー · crosswalk cuckoo' },
  { t: 7.0, name: 'railway-bells', gain: 0.75, dur: 3.5, loop: true, offset: 0.13, fadeOut: 1.2, cap: '踏切 · level crossing' },
  { t: 10.5, name: 'train-nextstop', gain: 0.9, dur: 3.5, fadeOut: 0.4, cap: '次は渋谷 · next stop, Shibuya' },
  { t: 14.0, name: 'rural-flute', gain: 0.9, dur: 4.5, offset: 4.0, fadeIn: 0.3, fadeOut: 0.6, cap: 'のんびり · slow life' },
  { t: 18.5, name: 'donki-theme', gain: 0.75, dur: 3.0, fadeOut: 0.35, cap: 'ドンペン堂 · megastore theme' },
  { t: 21.5, name: 'ka-ching', gain: 0.95, dur: 2.0, offset: 0.38, cap: 'チャリン · ka-ching' },
  { t: 23.5, name: 'lawson-chime', gain: 0.8, dur: 4.5, offset: 0.055, fadeOut: 0.6, cap: '入店チャイム · konbini chime' },
];
const C = [
  {
    id: 'C1', name: 'Hachi Hears Japan (one take)', dur: 28, look: 'golden', clean: true,
    // on the far pavement, facing the konbini across the road: from his eye height the store is low enough there for
    // Fuji to rise over it (on the store's own forecourt its front hides the mountain); no traffic runs the road
    // the camera: 0.9 m, FOV 35, at his eye height (0.40 m, measured: the brief's 0.32 was an estimate, and from there
    // it looks up his chin and loses Fuji), aimed a little above his eyes so he sits just under the middle
    at: { x: 1.2, z: 18.6 }, bearing: 5, dist: 0.9, fov: 35, camY: 0.4, lookY: 0.44,
    setup({ pup, env }) {
      const p = this.at;
      const b = this.bearing * Math.PI / 180;                    // (degrees right of -z) Fuji's peak at 9.8: to his right
      const cx = p.x - Math.sin(b) * 0.9, cz = p.z + Math.cos(b) * 0.9;
      pup.reset({ x: p.x, z: p.z, yaw: Math.atan2(cx - p.x, cz - p.z), posture: 1 });
      const src = (side) => () => V(p.x + side * 1.6, 0.8, p.z + 0.6);
      // 0-1: idle, a blink, a tiny wag; eye contact between sounds
      pup.look(0, 28, 'camera', 0.8);
      // 1-4 piyo: ears perk, head toward it, tilt one way and hold; second cycle one ear up
      pup.look(1.0, 2.6, src(1));
      pup.react('headTilt', 1.2, { dur: 2.6, side: 1, hold: true, earAt: 0.6 });
      // 4-7 kakko: the other way, a double tilt, hm?, a tiny sniff toward it
      pup.look(4.0, 5.6, src(-1));
      pup.react('headTilt', 4.15, { dur: 2.0, side: -1 });
      pup.react('sniff', 6.2, { dur: 0.7 });
      // 7-10.5 the bells: startle, ears back, crouch, tail tucked, trembling, eyes big; relaxes as they fade
      pup.react('startle', 7.0, { dur: 0.6, seated: true });
      pup.react('scared', 7.4, { dur: 3.0, seated: true });
      // 10.5-14 the announcement: confused; one ear up, a slow tilt, looks at you asking; a blink; hm?; a small sneeze
      pup.look(10.5, 11.3, src(-1));
      pup.react('headTilt', 10.6, { dur: 2.5, side: -1, hold: true, slow: true, ask: true });
      pup.react('sneeze', 13.1, { dur: 0.85 });
      // 14-18.5 the flute: calm, slow blinks, head swaying, a big yawn in the middle
      pup.react('calm', 14.0, { dur: 4.4 });
      pup.react('slowBlink', 14.4, { dur: 1.2 });
      pup.react('yawn', 15.8, { dur: 1.4 });
      pup.react('slowBlink', 17.2, { dur: 1.2 });
      // 18.5-21.5 ドンペン堂: eyes open, bobbing to the beat, tippy taps, tongue out
      pup.react('bob', 18.5, { dur: 3.0, bpm: 83.5 });              // the theme is 167 bpm (measured): a nod every other beat
      pup.react('tippyTaps', 19.0, { dur: 2.4 });
      // 21.5-23.5 ka-ching: freeze, ears up, big eyes, straight at you, a paw lifts ("...treat?")
      pup.react('freeze', 21.5, { dur: 2.0 });
      // 23.5-27 the chime: joy: the wiggle, giggle and yip, happy squint, tongue out; ends on the happiest face
      pup.react('happyWiggle', 23.5, { dur: 2.2, seated: true });
      pup.react('bigSmile', 25.4, { dur: 3.0 });
      pup.react('slowBlink', 27.0, { dur: 0.95, keep: true });
      return {
        rig: (t) => {
          const d = this.dist * (1 - 0.15 * ease(t / 28));          // the slow push-in, 15% closer by the end
          return { p: V(p.x - Math.sin(b) * d, this.camY, p.z + Math.cos(b) * d), l: V(p.x, this.lookY, p.z), fov: this.fov };
        },
        update(t, dt, e) {
          for (const c of C_CUES) if (!c._on && t >= c.t) { c._on = true; e.clip(c); }
        },
        end() { for (const c of C_CUES) c._on = false; },
      };
    },
  },
];
for (const c of C_CUES) c._on = false;

/* ------------------------------------------ small props ------------------------------------------ */
/** A sakura petal falling in front of the pup (A5). */
function petal(env, t, pup) {
  let m = env.props?.petal;
  if (!m) {
    const g = new THREE.CircleGeometry(0.018, 8); g.scale(1, 0.7, 1);
    m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xffc9d8, side: THREE.DoubleSide }));
    m.userData.noOutline = true;
    env.G.scene.add(m);
    (env.props ??= {}).petal = m;
  }
  const u = seg(t, 0.25, 1.05);
  m.visible = t < 1.2;
  const s = pup.state;
  m.position.set(TORII.x + 0.06 * Math.sin(t * 7), lerp(0.75, 0.12, u), TORII.z0 - 1.9 - 0.2 * u);
  m.rotation.set(t * 5, t * 3, t * 4);
}
/** Breath fog on the glass by the pup's nose (A11). */
function glassFog(env, t, pup) {
  let m = env.props?.fog;
  if (!m) {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'); const r = g.createRadialGradient(32, 32, 2, 32, 32, 30);
    r.addColorStop(0, 'rgba(255,255,255,.55)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64);
    m = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.12), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
    m.userData.noOutline = true;
    env.G.scene.add(m);
    (env.props ??= {}).fog = m;
  }
  const s = pup.state;
  m.visible = t > 0.2 && t < 1.6;
  m.position.set(s.x, (s.y ?? 0) + 0.3, 0.07);
  m.rotation.y = Math.PI;
  m.material.opacity = 0.6 * bell(t, 0.3, 1.5, 0.15, 0.3) * (0.7 + 0.3 * Math.sin(t * 9));
}
/** A piece of egg sando dropped from the hand to the pup (B8). */
function sandoPiece(env, t, pup) {
  let m = env.props?.sando;
  if (!m) {
    const g = new THREE.Group();
    const bread = new THREE.MeshToonMaterial({ color: 0xf6ead2 }), egg = new THREE.MeshToonMaterial({ color: 0xf7d35c });
    const a = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.012, 0.04), bread); a.position.y = 0.012;
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.012, 0.038), egg);
    const c = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.012, 0.04), bread); c.position.y = -0.012;
    g.add(a, b, c);
    env.G.scene.add(g);
    (env.props ??= {}).sando = g;
    m = g;
  }
  const s = pup.state;
  const u = seg(t, 0.1, 0.55);
  m.visible = t < 0.75;
  const tx = s.x + Math.sin(s.yaw) * 0.22, tz = s.z + Math.cos(s.yaw) * 0.22;
  m.position.set(lerp(-3.0, tx, u), lerp(1.2, 0.03, u * u), lerp(3.85, tz, u));
  m.rotation.set(t * 6, 0.4, t * 3);
}

export const VERSIONS = {
  A: { title: "Hachi's Big Day", shots: A },
  B: { title: 'Hachi Fears Nothing', shots: B },
  C: { title: 'Hachi Hears Japan', shots: C, cues: C_CUES },
};
export { C_CUES };
