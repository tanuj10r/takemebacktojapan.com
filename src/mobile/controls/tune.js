import { MOBILE } from '../../config.js';

/* ------------------------------------------------------------------ *
 * The phone's controls, as numbers (docs/decisions/mobile-lite.md,
 * "Mobile v3: UI").  Defaults here; config.js MOBILE.controls (the world
 * build's) overrides any of them, key by key, so the feel is tuned in one
 * place without touching the code.
 *
 * How a good phone first-person game does it, and so here:
 *   - the left stick has a base you can always see, resting bottom left;
 *     it floats to where the thumb lands (anywhere on the left) and trails
 *     a thumb that overshoots, so it is never lost or out of reach
 *   - the walk eases in and out (no twitch); a full push, held a moment,
 *     breaks into a run by itself and the ring says so
 *   - the right thumb drags the view 1:1 with a mild lift for a flick,
 *     timed from the fingers' own timestamps (so 60 and 120 Hz screens
 *     feel the same), the pitch a little slower than the yaw, and a short
 *     glide when a flick lets go; the view never re-centres by itself
 * ------------------------------------------------------------------ */

const DEFAULTS = {
  stick: {
    off: false,
    /* (Tan, 2026-10-03: "the entire navigation... with just one joystick on the right") one stick, under the right
     * thumb: up walks on, down steps back, left and right turn you (no sidestep) */
    side: 'right',
    fixed: true,         // (Tan, 2026-10-03: "can't it be in a fixed position?") the base never moves; a thumb within `grab` radii of it takes it
    grab: 1.35,
    steer: true,
    turn: 1.9,           // rad/s at a full push across
    turnCurve: 1.6,      // the push across to the turn (more is gentler near the middle: a nudge is a small turn)
    level: 0.6,          // 1/s: walking, the view eases back toward level (nothing else on the stick looks up or down)
    zone: 0.46,          // the left part of the screen a thumb can land in to walk (0..1 of the width)
    top: 0.2,            // ... below this part of the height (the top is the map's and the labels')
    radius: 50,          // px: a full push
    base: 132,           // px: the base's disc
    knob: 58,            // px: the thumb's
    dead: 0.12,          // of the radius: no walking within it
    follow: 1.25,        // past this many radii the base trails the thumb
    rest: [92, 96],      // px from the left and bottom safe edges: where the base rests
    stroll: 0.28,        // the slowest pace, of the walk (a small push)
    curve: 1.5,          // the push to pace curve (1 linear; more is gentler at first)
    edge: 0.9,           // a push at least this far counts as "full" ...
    runAfter: 0.28,      // ... and held there this long (s) breaks into a run
    runHold: 0.7,        // a run lasts while the push stays over this
    runBlend: 0.45,      // s: walk to run, eased
    smooth: 22,          // 1/s: the thumb's jitter is eased out of the push
    accel: 7.5,          // 1/s: how fast the walk reaches its pace ...
    brake: 10,           // ... and how fast it stops
  },
  look: {
    yaw: 0.0046,         // rad per CSS px across (a half-screen swipe in landscape turns ~110 degrees)
    pitch: 0.0034,       // rad per CSS px up and down (slower: the horizon is where the town is)
    fast: 1.7,           // the gain for a flick (1 for a careful drag) ...
    v0: 0.35, v1: 2.2,   // ... px/ms: where the lift starts and where it tops out
    smooth: 0.4,         // the speed's smoothing over the finger's samples (0 none .. 1 frozen)
    glide: 0.09,         // s: the time constant of the short glide after a flick lets go
    glideMin: 0.5,       // rad/s: slower than this at the lift, no glide
    glideMax: 5.5,       // rad/s: the glide never starts faster
    glideWindow: 70,     // ms: the lift's speed is taken over the finger's last samples within this
  },
  aim: { reach: 2.8, cone: 0.6 },                    // no crosshair hit: the nearest thing to do within reach (m) and this cone (rad)
  tap: { ms: 260, px: 12 },                          // a tap: quick and still
};

const over = MOBILE.controls ?? MOBILE.pocket?.controls ?? {};
export const TUNE = Object.fromEntries(Object.entries(DEFAULTS).map(([k, v]) => [k, { ...v, ...(over[k] ?? {}) }]));

export const smoothstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** The stick's push (0..1, past the dead zone already taken out) to a pace, of the walk: a stroll to a walk. */
export function stickPace(push, S = TUNE.stick) {
  if (push <= 0) return 0;
  return S.stroll + (1 - S.stroll) * Math.pow(Math.min(1, push), S.curve);
}

/** A drag's speed (px/ms) to the look's gain: a careful drag is 1:1, a flick turns faster. */
export function lookGain(v, L = TUNE.look) {
  return 1 + (L.fast - 1) * smoothstep(L.v0, L.v1, v);
}
