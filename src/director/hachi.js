import { soundBus } from '../core/soundBus.js';
import { clamp, lerp, ease, ease5, seg, bell, turn, rng, Spring, polyline, route } from './util.js';

/* ------------------------------------------------------------------ *
 * Hachi's puppeteer (Director Mode, dev only; docs/director-mode-prompt.md
 * Part 3).  While a shot runs it owns the pup: the guide's brain rests
 * (guide.js G.puppet) and the pup is drawn from a script.
 *
 * Everything is a function of the shot's clock: where it is (a route on
 * the walk grid, walked at a named gait with eased starts and stops), how
 * it sits or lies, and the reactions laid over that, each blended in and
 * out; the secondary motion (ears and tail following through, blinks) is
 * sprung in fixed steps from the shot's start.  So a shot plays the same
 * every take.
 *
 * The rig (shiba.js): aPose [phase, stride, look, nod], aPose2 [posture,
 * tail, ears, tilt], aPose3 [ears back, one ear up, lids, big eyes], aPose4
 * [mouth, tail tucked, crouch, one paw], aPose5 [hips, squish, both paws].
 * ------------------------------------------------------------------ */

/** gaits: speed (m/s), stride (0..1), the bound, and how it carries itself */
export const GAITS = {
  walk: { v: 0.9, amp: 0.55, rate: 6.5 },
  trot: { v: 2.4, amp: 1, rate: 6.5 },
  jog: { v: 3.6, amp: 1, rate: 6.3, bound: 0.45 },
  sprint: { v: 5.4, amp: 1, rate: 6.0, bound: 1, earsBack: 0.55, mouth: 0.35, ta: 0.3 },
  sneak: { v: 0.45, amp: 0.55, rate: 8, crouch: 0.6, earsBack: 0.45, nod: 0.12 },
  strut: { v: 1.25, amp: 1, rate: 5.6, bound: 0.35, nod: -0.2, perk: 1.15, wagAmp: 0.5, wagRate: 5, pitch: -0.06 },
  hop: { v: 1.5, amp: 0.35, rate: 6.5 },
};

/** Base pose: what every reaction starts from and blends back to. */
const BASE = () => ({
  look: 0, nod: 0.08, tilt: 0, posture: 0, wagAmp: 0.25, wagRate: 9, perk: 1, earsBack: 0, earAsym: 0,
  lids: 0, big: 0, mouth: 0, tuck: 0, crouch: 0, paw: 0, paws: 0, hips: 0, squish: 0, amp: 0, bound: 0,
  dy: 0, pitch: 0, roll: 0, dyaw: 0, fwd: 0, side: 0, tremble: 0, shake: 0, eye: 0, blink: 1,
});
const KEYS = Object.keys(BASE());

/* ---------------------------------------------------------------------------------------------------------------
 * The reaction library.  Each: its natural length (s), and a function of u (0..1 across it), its own seconds τ and
 * length D, writing over the pose R (already the base).  `snd` lists its sounds: [u, name, gain].
 * ------------------------------------------------------------------------------------------------------------- */
const wave = (t, hz) => Math.sin(t * Math.PI * 2 * hz);
export const REACTIONS = {
  wakeUp: {
    dur: 3.4, blend: [0.05, 0.3],
    snd: [[0.02, 'dog-snore', 0.6], [0.4, 'dog-yawn', 0.8]],
    f(R, u) {
      // curled asleep; one ear pops, then the other; the eyes open; a big yawn; a full stretch into a play bow
      const up = seg(u, 0.72, 0.86);
      R.posture = lerp(2, -1, up) * (1 - seg(u, 0.93, 1)) ;
      R.nod = lerp(0.28, 0.05, seg(u, 0.25, 0.4)) - 0.35 * bell(u, 0.4, 0.66, 0.06, 0.1);
      R.lids = 1 - seg(u, 0.26, 0.34) + 0.55 * bell(u, 0.42, 0.62, 0.05, 0.08);
      R.earAsym = 0.9 * bell(u, 0.1, 0.24, 0.02, 0.05);
      R.perk = lerp(0.35, 1, seg(u, 0.16, 0.26));
      R.mouth = bell(u, 0.4, 0.64, 0.06, 0.08);
      R.blink = 0;
      R.wagAmp = 0.1 + 0.6 * seg(u, 0.75, 0.85);
      R.wagRate = 14;
      R.eye = seg(u, 0.64, 0.72);
    },
  },
  anticipate: {
    dur: 0.3, blend: [0.08, 0.08],
    f(R, u) { R.crouch = 0.7 * Math.sin(Math.PI * u); R.pitch = -0.05 * Math.sin(Math.PI * u); R.earsBack = 0.3; R.perk = 1.2; },
  },
  zoomOff: {
    dur: 0.35, blend: [0.06, 0.08], snd: [[0.6, 'dog-yip', 0.8]],
    f(R, u) { R.crouch = 0.75 * Math.sin(Math.PI * u); R.pitch = -0.06 * Math.sin(Math.PI * u); R.earsBack = 0.4; R.perk = 1.3; R.mouth = 0.3; },
  },
  proudStrut: {
    dur: 2.0, blend: [0.25, 0.3],
    f(R, u, t) { R.nod = -0.22; R.perk = 1.15; R.wagAmp = 0.5; R.wagRate = 5; R.pitch = -0.06; R.lids = 0.25; R.eye = 0; R.tilt = 0.05 * wave(t, 1.1); },
  },
  sitWatch: {
    dur: 3, blend: [0.3, 0.3],
    f(R) { R.posture = 1; R.perk = 1.15; R.wagAmp = 0.15; R.eye = 0; },
  },
  startle: {
    dur: 0.8, blend: [0.02, 0.25], snd: [[0.0, 'dog-yelp', 0.9]],
    f(R, u, t, D, o) {
      // straight up on all four, eyes wide, ears back; lands and freezes low (seated: a little hop where he sits)
      const air = u < 0.42 ? Math.sin(Math.PI * u / 0.42) : 0;
      R.big = 1; R.lids = 0; R.blink = 0;
      R.earsBack = 0.95; R.perk = 0.4;
      R.tuck = 0.5 * seg(u, 0.3, 0.6);
      R.wagAmp = 0;
      if (o.seated) { R.dy = 0.045 * air; R.nod = 0.1 * seg(u, 0.4, 0.55); R.pitch = -0.06 * air; return; }
      R.dy = 0.085 * air;
      R.posture = 0;
      R.crouch = 0.25 * air + 0.55 * seg(u, 0.4, 0.55);
      R.pitch = -0.1 * air;
      R.fwd = -0.05 * seg(u, 0.1, 0.45);
    },
  },
  scared: {
    dur: 2.4, blend: [0.2, 0.4], snd: [[0.1, 'dog-whine', 0.55]],
    f(R, u, t, D, o) {
      R.earsBack = 1; R.perk = 0.2; R.tuck = 1; R.tremble = 1; R.big = 0.85; R.lids = 0; R.wagAmp = 0;
      // seated: he stays sat and shrinks into himself, the head drawn down between the shoulders
      if (o.seated) { R.nod = 0.2; R.dy = -0.012; R.pitch = 0.05; return; }
      R.posture = 0; R.crouch = 0.75; R.nod = 0.12; R.pitch = 0.04;
      R.fwd = -0.16 * D * ease(u);          // backs away slowly
    },
  },
  hideAndPeek: {
    dur: 2.6, blend: [0.15, 0.3], snd: [[0.35, 'dog-whine', 0.3]],
    f(R, u) {
      // behind cover (the shot places it); the head slides out sideways first, ears flat, then the rest follows
      const head = seg(u, 0.2, 0.45), body = seg(u, 0.6, 0.95);
      R.crouch = 0.7 - 0.3 * body; R.earsBack = 0.9 - 0.5 * body; R.perk = 0.3 + 0.6 * body;
      R.side = lerp(-0.22, 0, body) + 0.1 * head * (1 - body);
      R.look = 0.9 * head * (1 - 0.5 * body);
      R.tilt = 0.28 * head * (1 - body);
      R.big = 0.7; R.tuck = 0.6 * (1 - body); R.eye = head;
      R.wagAmp = 0.15 * body;
    },
  },
  headTilt: {
    dur: 1.8, blend: [0.12, 0.25], snd: [[0.08, 'dog-hmm', 0.7]],
    f(R, u, t, D, o) {
      // one way, hold, then the other way (the double tilt); the ears go asymmetric with it.  `hold`: one way only;
      // `slow`: a slow lean into it; `earAt`: the ears stay level until then (u), and one pops up
      const s = o.side ?? 1;
      const a = seg(u, 0.0, o.slow ? 0.4 : 0.18) * (o.hold ? 1 : 1 - seg(u, 0.5, 0.62)), b = o.hold ? 0 : seg(u, 0.52, 0.66);
      R.tilt = s * (0.5 * a - 0.5 * b);
      R.earAsym = o.earAt !== undefined ? s * 0.9 * seg(u, o.earAt, o.earAt + 0.06) : s * (0.85 * a - 0.85 * b);
      R.perk = 1.1; R.big = 0.3; R.eye = 1; R.nod = -0.05;
      // `ask`: chin up, big eyes on you, as if asking what that was
      if (o.ask) { R.big = 0.85 * seg(u, 0.1, 0.35); R.nod = -0.14 * seg(u, 0.1, 0.35); R.perk = 0.95; }
    },
  },
  sniff: {
    dur: 1.3, blend: [0.15, 0.2], snd: [[0.15, 'dog-sniff', 0.7]],
    f(R, u, t) { R.nod = 0.38 + 0.05 * wave(t, 7) * bell(u, 0.1, 0.9, 0.1, 0.1); R.perk = 1.05; R.lids = 0.2; R.fwd = 0.04 * seg(u, 0, 0.3); R.eye = 0; },
  },
  sneeze: {
    dur: 1.4, blend: [0.08, 0.25], snd: [[0.36, 'dog-sneeze', 0.9]],
    f(R, u) {
      // the head goes back, eyes squeeze... snap; then a head shake, one ear flopped
      R.nod = u < 0.36 ? -0.38 * seg(u, 0, 0.34) : 0.4 * (1 - seg(u, 0.36, 0.55));
      R.lids = u < 0.34 ? 0.55 * seg(u, 0.05, 0.3) : u < 0.44 ? 1 : 0;
      R.mouth = 0.4 * bell(u, 0.2, 0.36, 0.05, 0.02);
      R.shake = bell(u, 0.5, 0.78, 0.03, 0.08);
      R.earAsym = -0.8 * seg(u, 0.6, 0.72);
      R.blink = 0; R.eye = seg(u, 0.8, 0.95);
    },
  },
  shakeOff: {
    dur: 1.2, blend: [0.1, 0.25], snd: [[0.1, 'dog-shake', 0.9]],
    f(R, u, t) {
      // head to tail: the head first, the body after, ears flapping
      const k = bell(u, 0.05, 0.85, 0.08, 0.15);
      R.shake = k;
      R.roll = 0.22 * k * wave(t, 8.5);
      R.look = 0.35 * k * wave(t + 0.03, 8.5);
      R.perk = 0.7 + 0.35 * k * wave(t, 17);
      R.lids = 0.7 * k; R.blink = 0;
      R.hips = 0.2 * k * wave(t - 0.04, 8.5);
    },
  },
  zoomies: {
    dur: 2.6, blend: [0.08, 0.2], snd: [[0.02, 'dog-awoo', 0.8], [0.84, 'dog-snort', 0.8]],
    f(R, u, t, D) {
      // tight fast circles, rump tucked, ears back, then a sudden flop
      const run = 1 - seg(u, 0.72, 0.8);
      const ang = 2 * Math.PI * 1.6 * ease5(Math.min(1, u / 0.8));
      const r = 0.75 * seg(u, 0, 0.1) * (1 - seg(u, 0.74, 0.82));
      R.fwd = r * Math.sin(ang); R.side = r * (1 - Math.cos(ang));
      R.dyaw = ang;
      R.amp = run; R.bound = 0.6 * run; R.earsBack = 0.6 * run; R.perk = 1.2; R.mouth = 0.3 * run;
      R.roll = -0.18 * run; R.hips = -0.15 * run; R.tuck = 0.2 * run;
      R.posture = 2 * seg(u, 0.8, 0.9);
      R.lids = 0.5 * seg(u, 0.85, 0.95); R.wagAmp = 0.6;
    },
  },
  playBow: {
    dur: 1.6, blend: [0.15, 0.25], snd: [[0.2, 'dog-boof', 0.8]],
    f(R, u, t) { R.posture = -1; R.wagAmp = 0.95; R.wagRate = 20; R.perk = 1.3; R.dy = 0.02 * Math.max(0, wave(t, 2.2)) * bell(u, 0.1, 0.9); R.eye = 1; R.nod = -0.1; R.mouth = 0.2; },
  },
  tippyTaps: {
    dur: 1.8, blend: [0.12, 0.2], snd: [[0.05, 'dog-giggle', 0.8], [0.2, 'dog-tip', 0.6], [0.45, 'dog-tip', 0.6], [0.7, 'dog-tip', 0.6]],
    f(R, u, t) {
      const k = bell(u, 0.02, 0.95, 0.05, 0.1);
      R.paw = k * (wave(t, 3.2) > 0 ? 0.55 : -0.55) * Math.min(1, Math.abs(wave(t, 3.2)) * 3);
      R.hips = 0.22 * k * wave(t, 3.2);
      R.perk = 1.35; R.mouth = 0.3; R.wagAmp = 0.9; R.wagRate = 18; R.lids = 0.25; R.eye = 1; R.nod = -0.08;
      R.dy = 0.012 * Math.abs(wave(t, 6.4)) * k;
    },
  },
  faceOnGlass: {
    dur: 2.4, blend: [0.3, 0.3], snd: [[0.35, 'dog-pant', 0.45]],
    f(R, u, t, D, o) {
      // up on the hind legs against the glass, face squished, eyes big (`peek`: paws on the ledge, face off the glass)
      const up = seg(u, 0, 0.25);
      R.posture = 1; R.paws = up; R.pitch = -0.62 * up; R.dy = 0.05 * up; R.fwd = 0.04 * up;
      R.squish = o.peek ? 0 : seg(u, 0.2, 0.35); R.big = 1; R.perk = 1.2; R.mouth = 0.2; R.eye = 0; R.nod = -0.15 * up; R.wagAmp = 0.7;
    },
  },
  puppyEyes: {
    dur: 2.4, blend: [0.25, 0.3], snd: [[0.3, 'dog-whine', 0.35]],
    f(R, u) {
      R.posture = 1; R.big = 1; R.eye = 1; R.perk = 0.85; R.earsBack = 0.2; R.tilt = 0.18 * seg(u, 0.1, 0.3);
      R.lids = bell(u, 0.45, 0.72, 0.12, 0.14) * 0.9; R.blink = 0;
      R.paw = 0.75 * bell(u, 0.55, 0.98, 0.1, 0.1); R.wagAmp = 0.2;
    },
  },
  beg: {
    dur: 2.0, blend: [0.2, 0.25], snd: [[0.2, 'dog-giggle', 0.7]],
    f(R, u, t) {
      R.posture = 1; R.eye = 1; R.big = 0.5; R.perk = 1.2;
      R.paw = 0.55 + 0.4 * wave(t, 2.6) * bell(u, 0.05, 0.75, 0.1, 0.1);
      R.tilt = 0.3 * bell(u, 0.3, 0.8, 0.1, 0.15);
      R.mouth = 0.35 * bell(u, 0.78, 0.92, 0.03, 0.04);
      R.wagAmp = 0.7; R.wagRate = 15;
    },
  },
  happyWiggle: {
    dur: 1.8, blend: [0.08, 0.25], snd: [[0.02, 'dog-yip', 0.9], [0.45, 'dog-giggle', 0.9]],
    f(R, u, t, D, o) {
      const k = bell(u, 0.02, 0.95, 0.05, 0.12);
      R.hips = 0.38 * k * wave(t, 3.6);
      // a spin on the spot; seated, a bounce on the front paws instead
      if (o.seated) R.paws = 0.35 * k * Math.max(0, wave(t, 3.6));
      else R.dyaw = u < 0.45 ? 2 * Math.PI * seg(u, 0.12, 0.45) : 0;   // (once round it is 0 again: the blend-out has nothing to unwind)
      R.mouth = 0.4; R.lids = 0.62; R.blink = 0; R.perk = 1.3; R.wagAmp = 1; R.wagRate = 22; R.eye = seg(u, 0.45, 0.55);
      R.dy = 0.02 * Math.abs(wave(t, 3.6)) * k;
      R.amp = 0.4 * bell(u, 0.12, 0.45, 0.05, 0.05);
    },
  },
  munch: {
    dur: 2.0, blend: [0.15, 0.25], snd: [[0.1, 'bite', 0.7], [0.4, 'munch', 0.7]],
    f(R, u, t) {
      R.nod = 0.45 * seg(u, 0, 0.12) - 0.2 * seg(u, 0.2, 0.35);
      R.mouth = 0.45 * Math.max(0, wave(t, 4.2)) * bell(u, 0.15, 0.95, 0.05, 0.1);
      R.lids = 0.6 * seg(u, 0.2, 0.3); R.blink = 0; R.wagAmp = 0.65; R.wagRate = 14; R.perk = 1.1;
      R.dy = 0.006 * Math.max(0, wave(t, 4.2));
    },
  },
  lookBack: {
    dur: 1.0, blend: [0.15, 0.25], snd: [[0.15, 'dog-boof', 0.7]],
    // eye contact with the camera; `away`: the look is the shot's (pup.look at whoever is behind him)
    f(R, u, t, D, o) { R.eye = o.away ? 0 : 1; R.perk = 1.25; R.wagAmp = 0.5; },
  },
  slowBlink: {
    dur: 1.4, blend: [0.15, 0.2],
    // over whatever face it has (a squint closes the rest of the way); `keep`: the ears as they are (the happy end)
    f(R, u, t, D, o) { R.lids = Math.max(R.lids, bell(u, 0.2, 0.85, 0.25, 0.3) * 0.95); R.blink = 0; R.eye = 1; if (!o.keep) { R.perk = 0.7; R.earsBack = 0.1; } },
  },
  fallAsleep: {
    dur: 3.6, blend: [0.15, 0.1], snd: [[0.62, 'dog-snore', 0.6], [0.9, 'dog-snore', 0.5]],
    f(R, u, t) {
      // once round, curled up, head on paws; eyes droop and close; an ear twitches in a dream
      R.dyaw = 2 * Math.PI * seg(u, 0.0, 0.3);
      R.amp = 0.5 * bell(u, 0.0, 0.3, 0.05, 0.05);
      R.fwd = 0.18 * Math.sin(2 * Math.PI * seg(u, 0, 0.3)); R.side = 0.18 * (1 - Math.cos(2 * Math.PI * seg(u, 0, 0.3)));
      R.posture = 2 * seg(u, 0.3, 0.45);
      R.nod = 0.3 * seg(u, 0.4, 0.55);
      R.lids = seg(u, 0.45, 0.7); R.blink = 0;
      R.perk = 0.4; R.look = 0.8 * seg(u, 0.4, 0.55);
      R.earAsym = 0.7 * bell(u, 0.8, 0.86, 0.02, 0.03);
      R.wagAmp = 0.05; R.eye = 0;
    },
  },
  yawn: {
    dur: 1.4, blend: [0.12, 0.25], snd: [[0.1, 'dog-yawn', 0.8]],
    f(R, u) { R.mouth = bell(u, 0.08, 0.8, 0.12, 0.15); R.nod = -0.3 * bell(u, 0.08, 0.8, 0.12, 0.15); R.lids = 0.85 * bell(u, 0.1, 0.8, 0.1, 0.1); R.blink = 0; R.perk = 0.6; },
  },
  headShake: {
    dur: 0.7, blend: [0.03, 0.1], snd: [[0.05, 'dog-shake', 0.5]],
    f(R, u) { R.shake = bell(u, 0, 1, 0.08, 0.2); R.lids = 0.7 * R.shake; R.blink = 0; },
  },
  freeze: {
    dur: 1.2, blend: [0.03, 0.2],
    f(R) { R.perk = 1.3; R.big = 1; R.lids = 0; R.blink = 0; R.eye = 1; R.wagAmp = 0; R.paw = 0.7; R.nod = -0.08; },
  },
  bob: {
    dur: 3, blend: [0.1, 0.1],
    f(R, u, t, D, o) { const bpm = o.bpm ?? 128; const b = wave(t, bpm / 60); R.nod = -0.02 + 0.13 * b; R.tilt = 0.12 * wave(t, bpm / 120); R.perk = 1.35; R.mouth = 0.3; R.wagAmp = 1; R.wagRate = 24; R.eye = 0.6; R.dy = 0.008 * Math.max(0, b); },
  },
  calm: {
    dur: 4, blend: [0.4, 0.4],
    f(R, u, t) { R.perk = 0.55; R.lids = 0.45; R.tilt = 0.1 * wave(t, 0.35); R.look = 0.12 * wave(t, 0.2); R.wagAmp = 0.12; R.wagRate = 4; R.eye = 0.7; },
  },
  bigSmile: {
    dur: 2, blend: [0.2, 0.3],
    f(R) { R.mouth = 0.45; R.lids = 0.66; R.blink = 0; R.perk = 1.3; R.earsBack = 0.15; R.tilt = 0.1; R.wagAmp = 0.9; R.wagRate = 20; R.eye = 1; R.nod = -0.12; },
  },
};

/* --------------------------------------------------------------------------------------------------------------- */
export function makePuppet({ camera }, { index = 0, seed = 1 } = {}) {
  const guide = window.__guide;
  const W = guide.walk;
  let segs = [], postures = [], reactions = [], looks = [], sounds = [];
  let tPrev = -1, blinks = [];
  const earS = new Spring(1, 260, 13), earB = new Spring(0, 260, 13), tailS = new Spring(0, 90, 7);
  const yawS = new Spring(0, 60, 14);
  let wagPh = 0, ph = 0, lastS = 0, visible = true, dbl = null;
  const P = { x: 0, z: 0, yaw: 0 };

  const api = {
    index,
    get x() { return P.x; }, get z() { return P.z; }, get yaw() { return P.yaw; },
    /** Start over: where it stands and faces, and how. */
    reset({ x, z, yaw = 0, posture = 0, seed: sd = seed } = {}) {
      segs = [{ kind: 'at', t0: -1e9, x, z, yaw }];
      postures = [{ t: -1e9, v: posture, d: 0 }];
      reactions = []; looks = []; sounds = []; tPrev = -1; wagPh = 0; ph = 0; lastS = 0;
      yawS.set(yaw); earS.set(1); earB.set(0); tailS.set(0);
      // blinks: every 2 to 5 s, sometimes a double
      const r = rng(sd * 7919 + index);
      blinks = [];
      for (let t = 0.6 + r() * 2; t < 120; t += 2 + r() * 3) { blinks.push(t); if (r() < 0.25) blinks.push(t + 0.26); }
      Object.assign(P, { x, z, yaw });
      return api;
    },
    /** Walk a route from where it is to (x, z) (on the grid, round what stands in the way), or through `via` points. */
    go(t0, to, gait = 'trot', { via = null, straight = false, v = null } = {}) {
      const from = api.where(t0);
      const pts = via ? [from, ...via, to] : straight ? [from, to] : route(W, from, to);
      const line = polyline(pts.map((p) => ({ x: p.x, z: p.z })));
      const G = GAITS[gait], speed = v ?? G.v, ta = G.ta ?? 0.25;
      const da = speed * ta / 2, tc = Math.max(0, (line.total - 2 * da) / speed);
      const T = line.total < 2 * da ? 2 * Math.sqrt(line.total * ta / speed) : 2 * ta + tc;
      segs.push({ kind: 'path', t0, T, line, gait, speed, ta: line.total < 2 * da ? T / 2 : ta, tc });
      return t0 + T;
    },
    /** stripeHop: hops across a zebra to `to`, a bounce and a soft paw pat (dog-tip) on each white stripe (0.9 m apart). */
    stripeHop(t0, to, { v = 2.6, spacing = 0.9, gain = 0.55 } = {}) {
      const from = api.where(t0), L = Math.hypot(to.x - from.x, to.z - from.z);
      const t1 = api.go(t0, to, 'hop', { straight: true, v });
      segs[segs.length - 1].hopSpacing = spacing;
      for (let d = spacing; d < L; d += spacing) sounds.push({ t: t0 + (t1 - t0) * d / L, name: 'dog-tip', gain });   // (on each landing)
      return t1;
    },
    /** leadOn: trots ahead through `stops`, and at each one stops, looks back at `back` (a point or a function of t)
     * and waits with a wag, then goes on; returns when the last wait ends. */
    leadOn(t0, stops, back, { gait = 'trot', v = null, wait = 0.8 } = {}) {
      let t = t0;
      for (const q of stops) {
        t = api.go(t, q, gait, { straight: true, v });
        api.react('lookBack', t, { dur: wait + 0.2, away: true });
        api.look(t, t + wait, back);
        t += wait;
      }
      return t;
    },
    /** Stand, sit (1), lie (2) or bow (-1) from t, over d seconds. */
    pose(t, v, d = 0.35) { postures.push({ t, v, d }); postures.sort((a, b) => a.t - b.t); return api; },
    /** A reaction at t0 (optional length and options). */
    react(name, t0, { dur, ...o } = {}) {
      const r = REACTIONS[name];
      if (!r) throw new Error('no reaction ' + name);
      const D = dur ?? r.dur;
      reactions.push({ name, t0, D, o, r });
      for (const [u, snd, gain] of r.snd ?? []) sounds.push({ t: t0 + u * D, name: snd, gain });
      return t0 + D;
    },
    /** Look at a target (world {x,y,z}, a function of t, or 'camera') between t0 and t1. */
    look(t0, t1, target, k = 1) { looks.push({ t0, t1, target, k }); return api; },
    /** A sound of its own at t (a dog recipe or a file). */
    say(t, name, gain = 0.7) { sounds.push({ t, name, gain }); return api; },
    /** The drunk double vision: a second pup offset sideways by f(t) metres (null: none). */
    double(f) { dbl = f; return api; },
    show(on) { visible = on; if (!on) { guide.hide(index); if (index === 0) guide.hide(1); } },
    /** Where it is at t (the locomotion alone). */
    where(t) {
      let s = segs[0];
      for (const q of segs) if (q.t0 <= t) s = q;
      if (s.kind === 'at') return { x: s.x, z: s.z, yaw: s.yaw, v: 0 };
      const τ = clamp(t - s.t0, 0, s.T), a = s.speed / s.ta;
      let d, v;
      if (τ < s.ta) { d = 0.5 * a * τ * τ; v = a * τ; }
      else if (τ < s.ta + s.tc) { d = s.speed * s.ta / 2 + s.speed * (τ - s.ta); v = s.speed; }
      else { const r = s.T - τ; d = s.line.total - 0.5 * a * r * r; v = a * r; }
      const p = s.line.at(d);
      const ahead = s.line.at(d + 0.6);
      return { x: p.x, z: p.z, yaw: p.yaw, ahead: ahead.yaw, v, d, gait: s.gait, moving: τ < s.T - 1e-3, seg: s };
    },
    /** Draw it at shot time t (dt since the last call). */
    frame(t, dt) {
      if (!visible) return;
      const L = api.where(t);
      const G = L.gait ? GAITS[L.gait] : null;
      const moving = L.v > 0.05;
      // the base: posture keys, the gait's carriage
      const R = BASE();
      let prev = postures[0];
      for (const k of postures) if (k.t <= t) prev = k;
      const i = postures.indexOf(prev), before = postures[i - 1];
      R.posture = before && prev.d > 0 ? lerp(before.v, prev.v, ease((t - prev.t) / prev.d)) : prev.v;
      if (moving) R.posture = 0;
      if (G) {
        const k = clamp(L.v / Math.max(0.3, L.seg.speed), 0, 1);
        R.amp = G.amp * k; R.bound = (G.bound ?? 0) * k;
        for (const c of ['earsBack', 'mouth', 'crouch', 'nod', 'perk', 'wagAmp', 'wagRate', 'pitch']) if (G[c] !== undefined) R[c] = lerp(R[c], G[c], k);
        if (L.gait === 'hop') { const sp = L.seg.hopSpacing ?? 0.9; R.dy = 0.07 * Math.abs(Math.sin(Math.PI * (L.d ?? 0) / sp)) * k; }
      }
      // reactions, blended over the base in order
      for (const q of reactions) {
        const τ = t - q.t0;
        if (τ < 0 || τ > q.D) continue;
        const [bi, bo] = q.r.blend ?? [0.2, 0.25];
        const w = Math.min(ease(τ / Math.max(1e-3, bi)), ease((q.D - τ) / Math.max(1e-3, bo)));
        const T = { ...R };
        q.r.f(T, τ / q.D, τ, q.D, q.o);
        for (const c of KEYS) R[c] = lerp(R[c], T[c], w);
      }
      // gait phase: by the ground covered, or by the reaction's own stride
      if (moving && L.d !== undefined) { ph += (L.d - lastS) * (G?.rate ?? 6.5); lastS = L.d; }
      else ph += dt * (R.amp > 0.05 ? 13 : 0);
      if (!moving) lastS = L.d ?? 0;
      // where it looks: a target, the camera when asked (eye contact sells it), else ahead along the way
      const yawBody = yawS.step(L.yaw + (L.seg ? 0 : 0), dt) ;
      const heading = (moving ? yawBody : L.yaw) + R.dyaw;
      const off = { x: Math.sin(heading) * R.fwd + Math.cos(heading) * R.side, z: Math.cos(heading) * R.fwd - Math.sin(heading) * R.side };
      const x = L.x + off.x, z = L.z + off.z;
      const headY = guide.ground(x, z) + 0.28 + R.dy;
      let look = R.look, nod = R.nod;
      if (moving && L.ahead !== undefined) look += clamp(turn(heading, L.ahead), -0.6, 0.6);      // the head leads into turns
      const aim = (p, k) => {
        const dx = p.x - x, dz = p.z - z, d = Math.hypot(dx, dz) || 1;
        const lk = clamp(turn(heading, Math.atan2(dx, dz)), -1.4, 1.4);
        const nd = clamp(-Math.atan2((p.y ?? 1.2) - headY, d) * 0.85, -0.7, 0.45);
        look = lerp(look, lk, k); nod = lerp(nod, nd, k);
      };
      for (const q of looks) {
        if (t < q.t0 || t > q.t1) continue;
        const k = q.k * Math.min(ease((t - q.t0) / 0.25), ease((q.t1 - t) / 0.25));
        const p = q.target === 'camera' ? camera.position : typeof q.target === 'function' ? q.target(t) : q.target;
        if (p) aim(p, k);
      }
      if (R.eye > 0) {
        const c = camera.position, dx = c.x - x, dz = c.z - z;
        const front = Math.cos(turn(heading, Math.atan2(dx, dz)));
        if (front > -0.2) aim(c, R.eye * clamp((front + 0.2) / 0.5, 0, 1));
      }
      // secondary: the ears overshoot and settle, the head shakes, trembling, blinks
      const perk = earS.step(R.perk, dt), back = earB.step(R.earsBack, dt);
      look += 0.55 * R.shake * Math.sin(t * Math.PI * 2 * 7.5);
      const tilt = R.tilt + 0.25 * R.shake * Math.sin(t * Math.PI * 2 * 7.5 + 1);
      let roll = R.roll + 0.03 * R.tremble * Math.sin(t * Math.PI * 2 * 21);
      let lids = R.lids;
      if (R.blink > 0.5) for (const b of blinks) { const u = (t - b) / 0.16; if (u > 0 && u < 1) lids = Math.max(lids, Math.sin(Math.PI * u)); }
      wagPh += dt * R.wagRate;
      const wag = tailS.step(Math.sin(wagPh) * R.wagAmp, dt) + R.amp * 0.08 * Math.sin(2 * ph);
      // the body: a trot's bob, the bound, the hop
      const y = guide.ground(x, z) + R.amp * 0.036 * (0.5 + 0.5 * Math.sin(2 * ph + 1)) + R.bound * 0.055 * Math.abs(Math.sin(ph)) + R.dy;
      const pitch = R.pitch + R.bound * 0.1 * Math.cos(ph);
      const side = 0.004 * R.tremble * Math.sin(t * Math.PI * 2 * 17);
      const px = x + Math.cos(heading) * side, pz = z - Math.sin(heading) * side;
      const a = [ph, R.amp, clamp(look, -1.5, 1.5), nod], b = [R.posture, wag, perk, tilt];
      const c = [back, R.earAsym, clamp(lids, 0, 1), R.big], d = [R.mouth, R.tuck, R.crouch, R.paw], e = [R.hips, R.squish, R.paws, 0];
      guide.put(index, px, y, pz, heading, pitch, roll, a, b, c, d, e);
      if (dbl) {
        const o = dbl(t);
        guide.put(1, px + Math.cos(heading) * o, y, pz - Math.sin(heading) * o, heading, pitch, roll, a, b, c, d, e);
      }
      P.x = px; P.z = pz; P.yaw = heading; P.y = y;
      // its sounds, as the clock passes them (played at the pup)
      if (tPrev >= 0) for (const s of sounds) if (s.t > tPrev && s.t <= t) soundBus.oneShot(s.name, { x: px, z: pz, y: 0.3, near: 3, far: 20, gain: s.gain, recipe: s.name.startsWith('dog-') ? s.name : undefined });
      tPrev = t;
    },
    /** Its sound schedule (shot time), for the offline mix. */
    sounds() { return sounds.map((q) => ({ ...q })); },
    /** The pup's head (world), for cameras. */
    head() { return { x: P.x + Math.sin(P.yaw) * 0.16, y: (P.y ?? 0) + 0.28, z: P.z + Math.cos(P.yaw) * 0.16 }; },
    get state() { return { ...P }; },
  };
  return api;
}
