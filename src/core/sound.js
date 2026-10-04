/* ------------------------------------------------------------------ *
 * The sound of the town and the store (M4; SPEC section 9).
 *
 * One AudioContext, made on the first click (browsers start no audio
 * before a gesture).  The graph:
 *
 *   sfx bus  ──┬─────────────────────────▶ master ─▶ compressor ─▶ out
 *              └─▶ reverb (made in code) ──┘
 *   outdoor  ───▶ lowpass ─▶ gain ────────▶ master     (muffled indoors)
 *   indoor   ───▶ gain ───────────────────▶ master     (hum, fridge; up indoors)
 *   music    ───▶ gain ───────────────────▶ master     (the store's music)
 *
 * Files are public/audio/*.m4a (npm run audio), fetched after the game has
 * started and decoded on first need; a missing one falls back to its
 * procedural recipe, so a fresh clone still makes every sound.
 *
 * Every placed sound is local (config.js SOUND): full within `near`, eased
 * to nothing at `far`, and not played at all beyond it.  Only the ambience
 * beds and the store's own music are heard wherever they apply.
 * ------------------------------------------------------------------ */

import { Vector3 } from 'three';
import { SOUND, MOCHI } from '../config.js';

/** 1 within `near`, easing to 0 at `far`. */
export function falloff(d, { near, far }) {
  if (d <= near) return 1;
  if (d >= far) return 0;
  const t = 1 - (d - near) / (far - near);
  return t * t * (3 - 2 * t);
}

// the beds, quiet (Tan: another 10-15% down, M4 review).  Golden hour has
// no bed but the wind: its crows call now and then, far off (crowCalls).
const BEDS = { wind: 0.14, birds: 0.26, 'night-insects': 0.21 };
const BED_OF_LOOK = { day: 'birds', blue: 'night-insects' };

export function createSound({ volume = 0.5, release = 0 } = {}) {
  let ac = null, master, world, sfxBus, outBus, outLow, outGain, inGain, musicGain, reverb, wet;
  let theme = null, menuOn = false;
  /* four groups for recording passes (Director Mode, dev): ambience, music, effects, the dog's voice; each a gain the
   * group's sounds go through (1 in play: nothing changes) */
  const grp = {};
  const MUSIC = new Set(['han-drift', 'donki-theme', 'rural-flute', 'store-bgm', 'theme']);
  const AMB = new Set(['station-ambience', 'shrine-chimes', 'wind', 'birds', 'night-insects', 'crows', 'crow-call']);
  const groupOf = (name = '') => (name.startsWith('dog-') ? 'dog' : MUSIC.has(name) ? 'music' : AMB.has(name) ? 'amb' : 'fx');
  let manifest = {}, muted = volume <= 0.001, lastAudible = volume > 0.001 ? volume : 0.5;
  const buffers = new Map(), loading = new Map();
  const log = [];                    // dev: every sound started, for the audio check
  const now = () => ac.currentTime;
  const state = { inside: false, look: null, bells: false, music: false, lowpass: 20000 };
  const listener = { x: 0, y: 1.6, z: 0 };

  /* --------------------------- loading --------------------------- */
  let manifestReady = null;
  async function buffer(name) {
    if (buffers.has(name)) return buffers.get(name);
    await manifestReady;
    if (!manifest[name]) return null;
    if (!loading.has(name)) {
      loading.set(name, (async () => {
        try {
          const res = await fetch(import.meta.env.BASE_URL + 'audio/' + manifest[name].file);
          if (!res.ok) return null;
          const b = await ac.decodeAudioData(await res.arrayBuffer());
          buffers.set(name, b);
          return b;
        } catch { return null; }
      })());
    }
    return loading.get(name);
  }
  /** The loop's span inside a decoded buffer: AAC's encoder delay may pad the head. */
  function loopSpan(name, b) {
    const d = manifest[name]?.duration ?? b.duration;
    const pad = Math.min(2112 / b.sampleRate, Math.max(0, b.duration - d));
    return [pad, Math.min(b.duration, pad + d)];
  }

  /* Letting go (the phone: createSound({ release }), Tan 2026-10-04): a decoded file is raw PCM, ~0.18 MB a
   * second, and every one stayed for good (48 MB after a walk round the pocket town).  A place's loop, a placed
   * line of 5 s or more, a time of day's bed not in use: once the listener is `release` m beyond where it can be
   * heard and nothing is playing it, its decoded copy goes; within half that margin it is fetched (the browser's
   * cache) and decoded again, so it is back before its range begins.  The wind (always on) and short sounds stay. */
  const lastAt = new Map();                     // a placed file: where it last played and how far it carries
  let sweepT = 0;
  const drop = (name) => { if (buffers.has(name)) { buffers.delete(name); loading.delete(name); } };
  const playing = (b) => { for (const r of held) if (r.b === b) return true; return false; };
  function sweep() {
    const M = release, far = (x, z, f) => Math.hypot(x - listener.x, z - listener.z) - f;
    for (const z of zones) {
      const d = far(z.x, z.z, z.far), L = z.node;
      if (d > M && (!L || (!L.on && !L.src))) drop(z.name);
      else if (d < M / 2 && manifest[z.name] && !buffers.has(z.name)) buffer(z.name);
    }
    for (const [k, name] of Object.entries(BED_OF_LOOK)) { const L = beds[name]; if (L && k !== state.look && !L.on && !L.src) drop(name); }
    if (state.look !== 'golden') drop('crows');
    for (const [file, p] of lastAt) {
      const b = buffers.get(file);
      if (b && b.duration >= 5 && far(p.x, p.z, p.far) > M && !playing(b)) drop(file);
    }
  }

  /* ------------------------ the procedural sounds ------------------------ */
  const noiseBuf = () => {
    const n = ac.sampleRate, b = ac.createBuffer(1, n, n), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return b;
  };
  let noise = null;
  function tone(dest, freq, t, dur, { type = 'sine', level = 0.3, attack = 0.004 } = {}) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(level, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g).connect(dest);
    o.start(t); o.stop(t + dur + 0.02);
  }
  function burst(dest, t, dur, { freq = 2000, q = 1, level = 0.3, type = 'bandpass' } = {}) {
    const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noise; s.loop = true;
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(level, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    s.connect(f).connect(g).connect(dest);
    s.start(t, Math.random()); s.stop(t + dur + 0.02);
  }
  /** A little voice: a sawtooth gliding through `pitch` ([[u 0..1, Hz], ...]),
   * shaped by bandpass formants, with a breath of noise (the guide dog). */
  function voice(dest, t, dur, pitch, { level = 0.5, formants = [[1400, 4], [2600, 6]], breath = 0.03, vib = 0 } = {}) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(pitch[0][1], t);
    for (const [u, f] of pitch.slice(1)) o.frequency.linearRampToValueAtTime(f, t + u * dur);
    if (vib) {
      const l = ac.createOscillator(), lg = ac.createGain();
      l.frequency.value = 7; lg.gain.value = vib;
      l.connect(lg).connect(o.frequency);
      l.start(t); l.stop(t + dur + 0.05);
    }
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(level, t + Math.min(0.02, dur * 0.2));
    g.gain.setValueAtTime(level, t + dur * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    for (const [f, q] of formants) {
      const b = ac.createBiquadFilter();
      b.type = 'bandpass'; b.frequency.value = f; b.Q.value = q;
      o.connect(b).connect(g);
    }
    g.connect(dest);
    o.start(t); o.stop(t + dur + 0.05);
    if (breath) burst(dest, t, dur, { freq: formants[0][0], q: 1.2, level: breath });
  }
  // a puppy's yip: small, high and soft, a quick rise and fall
  const yip = (d, t, k = 1) => voice(d, t, 0.1, [[0, 980 * k], [0.3, 1520 * k], [1, 1050 * k]], { level: 0.42, formants: [[1900, 3], [3400, 5]], breath: 0.02 });
  const RECIPES = {
    /* the Shiba pup (Tan: "very cute, adorable sounds"): all small, soft, high and rare */
    'dog-yip'(d, t) { yip(d, t); yip(d, t + 0.16, 1.1); },                                     // happy: you've arrived, or off after you
    'dog-boof'(d, t) { voice(d, t, 0.14, [[0, 520], [0.25, 680], [1, 470]], { level: 0.45, formants: [[1100, 3], [2100, 4]], breath: 0.05 }); },   // a cheek-puffed little woof, looking back
    'dog-whine'(d, t) {                                                                            // you've kept it waiting
      voice(d, t, 0.7, [[0, 1150], [0.35, 1600], [0.7, 1450], [1, 1100]], { level: 0.28, formants: [[1800, 6], [3200, 8]], breath: 0.012, vib: 20 });
      voice(d, t + 0.85, 0.4, [[0, 1300], [0.5, 1650], [1, 1200]], { level: 0.22, formants: [[1800, 6], [3200, 8]], breath: 0.01, vib: 16 });
    },
    'dog-hmm'(d, t) { voice(d, t, 0.26, [[0, 850], [1, 1250]], { level: 0.26, formants: [[1400, 5], [2700, 6]], breath: 0.01 }); },   // the head tilt: "hm?"
    'dog-pant'(d, t) { for (let i = 0; i < 6; i++) burst(d, t + i * 0.15, 0.08, { freq: i % 2 ? 1700 : 1300, q: 1.1, level: 0.26 }); },   // audible over the town (it sat at the ambience's level)
    'dog-shake'(d, t) {                                                                            // the collar tag jingling as it shakes off
      for (let i = 0; i < 7; i++) {
        tone(d, 3200 + Math.random() * 1600, t + i * 0.055 + Math.random() * 0.02, 0.2, { level: 0.06 });
        burst(d, t + i * 0.06, 0.05, { freq: 800, q: 0.8, level: 0.04 });
      }
    },
    'dog-snore'(d, t) { burst(d, t, 0.8, { freq: 700, q: 0.7, level: 0.26, type: 'lowpass' }); tone(d, 1900, t + 0.72, 0.16, { level: 0.04 }); },   // a puppy's snuffly breath asleep
    'dog-awoo'(d, t) { voice(d, t, 0.55, [[0, 700], [0.3, 1150], [0.75, 1250], [1, 900]], { level: 0.34, formants: [[1300, 4], [2600, 6]], breath: 0.02, vib: 10 }); },   // zoomies: a little "awoo"
    'dog-snort'(d, t) { burst(d, t, 0.09, { freq: 900, q: 0.9, level: 0.3, type: 'lowpass' }); burst(d, t + 0.13, 0.07, { freq: 1100, q: 0.9, level: 0.22, type: 'lowpass' }); },   // happy snorts, rolling on its back
    // a puppy's giggle (Tan: tipsy with you, it giggles and rolls): quick breathy huffs, each with a tiny squeak, rising then tumbling
    'dog-giggle'(d, t) {
      for (let i = 0; i < 6; i++) {
        const k = 1 + 0.06 * Math.min(i, 3) - 0.1 * Math.max(0, i - 3), at = t + i * 0.105 + (Math.random() - 0.5) * 0.015;
        burst(d, at, 0.055, { freq: 1500 + i * 90, q: 1.2, level: 0.2 });
        voice(d, at + 0.012, 0.065, [[0, 1250 * k], [0.45, 1700 * k], [1, 1350 * k]], { level: 0.27, formants: [[1900, 3], [3400, 5]], breath: 0.05 });
      }
    },
    'dog-sneeze'(d, t) { burst(d, t, 0.03, { freq: 2600, q: 0.6, level: 0.22 }); voice(d, t + 0.02, 0.11, [[0, 1500], [1, 700]], { level: 0.3, formants: [[1800, 2], [3000, 3]], breath: 0.12 }); },   // a big little sneeze
    /* its reactions (animals/reactions.js): a squeaky rising yawn, soft paw pats, a tiny yelp, sniffs, a hiccup, a lick
     * of the lips, small wet chomps */
    'dog-yawn'(d, t) {
      voice(d, t, 0.9, [[0, 620], [0.25, 980], [0.55, 1320], [0.8, 1100], [1, 760]], { level: 0.3, formants: [[1200, 3], [2400, 4]], breath: 0.06, vib: 6 });
      burst(d, t + 0.05, 0.8, { freq: 900, q: 0.7, level: 0.05, type: 'lowpass' });
    },
    'dog-tip'(d, t) { for (let i = 0; i < 2; i++) burst(d, t + i * 0.07, 0.035, { freq: 1600 + i * 300, q: 1.4, level: 0.3 }); },
    'dog-yelp'(d, t) { voice(d, t, 0.13, [[0, 1500], [0.35, 2350], [1, 1650]], { level: 0.45, formants: [[2100, 3], [3600, 5]], breath: 0.03 }); },
    'dog-sniff'(d, t) { for (let i = 0; i < 4; i++) burst(d, t + i * 0.1, 0.05, { freq: 3200 + (i % 2) * 500, q: 0.9, level: 0.26 }); },
    'dog-hic'(d, t) { voice(d, t, 0.07, [[0, 1100], [0.5, 2300], [1, 2500]], { level: 0.4, formants: [[2000, 3], [3500, 5]], breath: 0.02 }); burst(d, t, 0.03, { freq: 700, q: 0.8, level: 0.14, type: 'lowpass' }); },
    'dog-lick'(d, t) { for (let i = 0; i < 2; i++) { burst(d, t + i * 0.17, 0.07, { freq: 1900 + i * 500, q: 2.2, level: 0.34 }); burst(d, t + i * 0.17 + 0.05, 0.04, { freq: 600, q: 0.8, level: 0.2, type: 'lowpass' }); } },
    'dog-munch'(d, t) { for (let i = 0; i < 3; i++) { burst(d, t + i * 0.16, 0.05, { freq: 800 + i * 80, q: 0.9, level: 0.5, type: 'lowpass' }); burst(d, t + i * 0.16 + 0.02, 0.04, { freq: 2300, q: 1.6, level: 0.2 }); } },
    // your whistle for the pup (F): two clear notes, breathy, the second higher
    'whistle'(d, t) {
      for (const [dt, f0, f1, dur] of [[0, 1420, 1560, 0.2], [0.24, 1780, 2080, 0.28]]) {
        const o = ac.createOscillator(), g = ac.createGain();
        o.type = 'sine'; o.frequency.setValueAtTime(f0, t + dt); o.frequency.linearRampToValueAtTime(f1, t + dt + dur);
        g.gain.setValueAtTime(0.0001, t + dt); g.gain.exponentialRampToValueAtTime(0.28, t + dt + 0.03); g.gain.setValueAtTime(0.28, t + dt + dur * 0.7); g.gain.exponentialRampToValueAtTime(0.0008, t + dt + dur);
        o.connect(g).connect(d); o.start(t + dt); o.stop(t + dt + dur + 0.02);
        burst(d, t + dt, dur, { freq: (f0 + f1) / 2, q: 6, level: 0.05 });
      }
    },
    // an original phrase on a soft electric piano (SPEC 9), if the file is missing
    'store-chime'(d, t) { [659.3, 554.4, 440, 493.9, 659.3, 880].forEach((f, i) => { tone(d, f, t + i * 0.28, 1.2, { level: 0.22 }); tone(d, f * 2, t + i * 0.28, 0.6, { level: 0.06 }); }); },
    'auto-door'(d, t) { burst(d, t, 0.6, { freq: 900, q: 0.6, level: 0.12 }); tone(d, 60, t, 0.6, { level: 0.08 }); },
    'fridge-door'(d, t) { tone(d, 80, t, 0.08, { level: 0.35 }); burst(d, t + 0.02, 0.07, { freq: 1200, q: 2, level: 0.2 }); },
    'ui-tap'(d, t) { tone(d, 1200, t, 0.05, { level: 0.15 }); },
    // taking it off the shelf, by what it is made of (catalog `sound`)
    plastic(d, t) { for (let i = 0; i < 4; i++) burst(d, t + i * 0.035 + Math.random() * 0.02, 0.05, { freq: 5000 + Math.random() * 2000, q: 1.5, level: 0.12 }); },
    soft(d, t) { burst(d, t, 0.12, { freq: 3500, q: 0.8, level: 0.1 }); burst(d, t + 0.06, 0.1, { freq: 4500, q: 1, level: 0.07 }); },
    can(d, t) { tone(d, 900, t, 0.12, { level: 0.14 }); tone(d, 2380, t, 0.08, { level: 0.05 }); },
    bottle(d, t) { tone(d, 300, t, 0.12, { level: 0.2 }); burst(d, t, 0.05, { freq: 900, q: 3, level: 0.08 }); },
    paper(d, t) { burst(d, t, 0.14, { freq: 1500, q: 0.5, level: 0.1, type: 'lowpass' }); },
    box(d, t) { tone(d, 180, t, 0.06, { level: 0.2 }); burst(d, t, 0.06, { freq: 1200, q: 0.7, level: 0.1 }); },
    step(d, t, o = {}) {
      burst(d, t, o.inside ? 0.05 : 0.08, { freq: o.inside ? 2400 : 900, q: o.inside ? 1.2 : 0.7, level: o.inside ? 0.05 : 0.07 });
      tone(d, o.inside ? 140 : 90, t, 0.05, { level: 0.05 });
    },
    /* ぺったん堂's show without its recording (world/mochi/): the same cue table (config MOCHI.cues), so the rabbits
     * keep time with it: a woody thud for the mallet, a wet slap for the turner's paw, tiny rabbit squeaks for the
     * calls, three together for the cheer */
    'mochi-pound'(d, t) {
      const squeak = (at, k = 1, lvl = 0.2) => voice(d, at, 0.09, [[0, 1700 * k], [0.35, 2500 * k], [1, 1900 * k]], { level: lvl, formants: [[2300, 3], [3900, 5]], breath: 0.015 });
      for (const c of MOCHI.cues) {
        const at = t + c.t;
        if (c.kind === 'hit') {
          tone(d, 150, at, 0.05, { level: 0.5, attack: 0.002 }); tone(d, 74, at, 0.2, { level: 0.6, attack: 0.003 });
          burst(d, at, 0.035, { freq: 900, q: 0.7, level: 0.35 }); burst(d, at, 0.12, { freq: 240, q: 0.8, level: 0.3, type: 'lowpass' });
        } else if (c.kind === 'turn') {
          burst(d, at, 0.045, { freq: 1900, q: 0.8, level: 0.2 }); burst(d, at + 0.012, 0.07, { freq: 620, q: 1.2, level: 0.16 });
          squeak(at + 0.03, 1.12, 0.12);
        } else if (c.kind === 'shout') squeak(at, 1, 0.2);
        else if (c.kind === 'big') { squeak(at, 1, 0.2); squeak(at + 0.02, 1.26, 0.17); squeak(at + 0.05, 0.84, 0.17); squeak(at + 0.3, 1.5, 0.14); }
      }
    },
  };
  /** How long a recipe sounds (s), where it is longer than the short ones: its handle ends then. */
  const RECIPE_LEN = { 'mochi-pound': MOCHI.len };

  /* ------------------------------ playing ------------------------------ */
  /**
   * A one-shot.  `file` the manifest name (else the recipe `recipe ?? file`);
   * `at` a world position (heard only inside its `range`), or none for a
   * sound at the listener; `bus` sfx (default) or outdoor.
   */
  /* Placed sounds that are still playing: their level follows the listener
   * as they move (walk out of the store and the chime fades behind you), and
   * one inside the store heard from outside comes through the glass,
   * muffled and quieter. */
  const voices = new Set();
  const voiceLevel = (v) => {
    const d = Math.hypot(v.at.x - listener.x, v.at.z - listener.z);
    const through = v.indoor && !state.inside;
    return { k: v.gain * falloff(d, v.range) * (through ? 0.4 : 1), f: through ? 1400 : 20000 };
  };
  /* File one-shots still playing (QA-013): paused, the world stands still,
   * so they stop where they are and pick up from there on resume (Han's
   * song stays on the car's beat; the announcement doesn't run on unheard). */
  const held = new Set();
  function holdStart(r, t) {
    const s = ac.createBufferSource(), fg = ac.createGain();
    s.buffer = r.b; s.playbackRate.value = r.rate;
    s.connect(fg).connect(r.dest);
    s.onended = () => { fg.disconnect(); if (r.s === s) holdEnd(r); };
    r.s = s; r.fg = fg; r.t0 = t;
    s.start(t, r.off);
  }
  function holdEnd(r) { r.s = null; held.delete(r); r.h.ended = true; if (r.v) voices.delete(r.v); }
  function holdPause(r) {
    if (!r.s) return;
    const t = now(), s = r.s;
    r.off += Math.max(0, t - r.t0) * r.rate;
    r.s = null;                                   // (its onended no longer ends it)
    r.fg.gain.setTargetAtTime(0, t, 0.02);         // out in a breath, no click
    try { s.stop(t + 0.1); } catch { /* stopped */ }
  }
  function holdResume(r) {
    if (r.s) return;
    if (r.off >= r.end - 0.01) holdEnd(r);
    else holdStart(r, now() + 0.01);
  }
  function play(file, { at = null, range = null, recipe = null, gain = 1, rate = 1, bus = null, indoor = false, o = {} } = {}) {
    const h = o._h ?? { ended: false };      // the caller's handle: `ended` once it has played out (QA-006)
    if (!ac || muted) { h.ended = true; return h; }
    const v = at && range ? { at, range, gain, indoor } : null;
    if (file && v) lastAt.set(file, { x: at.x, z: at.z, far: Math.max(range.far, lastAt.get(file)?.far ?? 0) });   // (kept from as far as it was warmed)
    let k = gain, f = 20000;
    if (v) {
      if (Math.hypot(at.x - listener.x, at.z - listener.z) >= range.far) { h.ended = true; return h; }   // beyond its range it does not play at all
      ({ k, f } = voiceLevel(v));
    }
    const entry = { name: file ?? recipe, t: +now().toFixed(3), k: +k.toFixed(3) };
    if (!o._waited) log.push(entry);   // (a waited replay was logged when asked)
    const g = ac.createGain();
    g.gain.value = k;
    let dest = g;
    if (at) {
      const p = ac.createPanner();
      p.panningModel = 'HRTF'; p.distanceModel = 'inverse'; p.rolloffFactor = 0;   // the level is ours (falloff)
      p.positionX.value = at.x; p.positionY.value = at.y ?? 1.2; p.positionZ.value = at.z;
      const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = f;
      g.connect(lp).connect(p); p.connect(bus ?? grp[groupOf(file ?? recipe)]?.sfx ?? sfxBus);
      if (v) { v.g = g; v.lp = lp; voices.add(v); }
    } else g.connect(bus ?? grp[groupOf(file ?? recipe)]?.sfx ?? sfxBus);
    const t = now() + 0.01;
    const b = file && buffers.get(file);
    if (b) {
      const [a, end] = loopSpan(file, b);
      // followed by where you are for as long as it plays (was a fixed 8 s: a longer
      // announcement stayed at the level it had then, however far you walked)
      const r = { b, rate, dest, h, v, off: a, end, s: null, fg: null, t0: t };
      held.add(r);
      /* where it is in the file (s), on the audio clock: it stands still while a card holds it (ぺったん堂's rabbits
       * move by this, world/mochi/; config MOCHI.cues) */
      h.pos = () => (r.s ? r.off + Math.max(0, now() - r.t0) * r.rate : r.off) - a;
      // started under a card only if it was waiting for its file (a click on the card itself plays at once, unheard)
      if (menuOn && o._waited) r.t0 = now();
      else holdStart(r, t);
      if (o._waited) o._waited.src = 'file-late';        // it played once decoded, late
      else entry.src = 'file';
    } else if (file && manifest[file] && !recipe && !o._waited) {
      // not decoded yet: fetch it and play it then (a voice line or a track
      // must not become a tap the first time it is asked for)
      g.disconnect();
      if (v) voices.delete(v);                                     // its replay, once decoded, is followed instead
      entry.src = 'waiting';
      buffer(file).then((ok) => {
        if (ok) play(file, { at, range, recipe, gain, rate, bus, indoor, o: { ...o, _waited: entry, _h: h } });
        else h.ended = true;
      });
    } else {
      if (file && manifest[file]) buffer(file);            // next time
      entry.src = 'recipe';
      (RECIPES[recipe ?? file] ?? RECIPES['ui-tap'])(dest, t, o);
      h.pos = () => now() - t;
      setTimeout(() => { if (v) voices.delete(v); h.ended = true; }, (RECIPE_LEN[recipe ?? file] ?? 4) * 1000);   // the recipes are short, but for the mochi show's
    }
    return h;
  }

  /* ------------------------------ loops ------------------------------ */
  /**
   * A long loop that streams instead of being decoded (M4, the store's
   * music): an <audio> element through the graph, so the browser keeps only
   * a little of it in memory.  A decoded 5.6-minute track costs about 65 MB
   * of PCM; streamed it costs almost nothing.  Short loops stay decoded,
   * where a buffer's loop is seamless and a media element's is not.
   */
  function streamNode(name, dest, level) {
    const g = ac.createGain();
    g.gain.value = 0;
    g.connect(dest);
    const L = { name, g, level, on: false, el: null };
    L.arm = () => {                              // from the first click, so playback is allowed later
      if (L.el || !manifest[name]) return;
      L.el = new Audio(import.meta.env.BASE_URL + 'audio/' + manifest[name].file);
      L.el.loop = true;
      L.el.preload = 'none';
      L.el.crossOrigin = 'anonymous';
      ac.createMediaElementSource(L.el).connect(g);
    };
    L.set = (on, fade = 2) => {
      if (on === L.on) return;
      L.on = on;
      L.arm();
      if (!L.el) return;
      if (on) {
        L.el.play().then(() => log.push({ name, t: +now().toFixed(3), loop: true, stream: true }), () => {});
      } else {
        clearTimeout(L.stopT);
        L.stopT = setTimeout(() => { if (!L.on) L.el.pause(); }, fade * 1000 + 200);
      }
      g.gain.cancelScheduledValues(now());
      g.gain.setTargetAtTime(on ? L.level : 0, now(), fade / 4);
    };
    return L;
  }

  function loopNode(name, dest, level) {
    const g = ac.createGain();
    g.gain.value = 0;
    g.connect(dest);
    const L = { name, g, src: null, level, on: false };
    L.set = async (on, fade = 2) => {
      if (on === L.on) return;
      L.on = on;
      if (on && !L.src) {
        const b = await buffer(name);
        if (!b || !L.on || L.src) return;
        const s = ac.createBufferSource();
        s.buffer = b; s.loop = true;
        [s.loopStart, s.loopEnd] = loopSpan(name, b);
        s.connect(g); s.start(now(), s.loopStart + (L.offset ?? 0));
        L.src = s; L.started = now();
        log.push({ name, t: +now().toFixed(3), loop: true });
      }
      g.gain.cancelScheduledValues(now());
      g.gain.setTargetAtTime(on ? L.level : 0, now(), fade / 4);
      if (!on) {
        const s = L.src;
        clearTimeout(L.stopT);
        L.stopT = setTimeout(() => {
          if (L.on || L.src !== s || !s) return;
          const span = s.loopEnd - s.loopStart;
          L.offset = span > 0 ? ((L.offset ?? 0) + now() - L.started) % span : 0;   // pick up where it left off
          try { s.stop(); } catch { /* stopped */ }
          L.src = null;
        }, fade * 1000 + 200);
      }
    };
    return L;
  }
  let beds = {}, music = null, hum = null, fridge = null;
  /* Golden hour's crows (config SOUND.crows): a single caw, cut on the fly
   * from the crows recording, from a point far off round the listener. */
  const crow = { wait: 0, pair: 0 };
  function crowCall() {
    const C = SOUND.crows, b = buffers.get('crows');
    if (!b) { buffer('crows'); return; }
    const [pad] = loopSpan('crows', b);
    const at = C.calls[Math.floor(Math.random() * C.calls.length)] - C.before, len = C.before + C.after;
    const ang = Math.random() * Math.PI * 2, d = C.dist[0] + Math.random() * (C.dist[1] - C.dist[0]);
    const t = now() + 0.02, lvl = C.level * (0.7 + Math.random() * 0.3);
    const s = ac.createBufferSource(), g = ac.createGain(), lp = ac.createBiquadFilter(), p = ac.createPanner();
    s.buffer = b; s.playbackRate.value = 0.94 + Math.random() * 0.12;      // not the same bird each time
    lp.type = 'lowpass'; lp.frequency.value = C.lowpass;
    p.panningModel = 'HRTF'; p.rolloffFactor = 0;
    p.positionX.value = listener.x + Math.sin(ang) * d; p.positionY.value = listener.y + 14; p.positionZ.value = listener.z + Math.cos(ang) * d;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(lvl, t + 0.06);
    g.gain.setValueAtTime(lvl, t + len - 0.25);
    g.gain.linearRampToValueAtTime(0, t + len);
    s.connect(g).connect(lp).connect(p).connect(grp.amb?.out ?? outBus);
    s.start(t, pad + Math.max(0, at), len + 0.05);
    log.push({ name: 'crow-call', t: +now().toFixed(3), k: +lvl.toFixed(3), d: Math.round(d) });
  }
  /* Experience zones (Tan's experiences): a looping track heard only near a
   * place, e.g. the discount store's theme or the shrine's wind chimes.
   * Beyond `far` it does not play at all; between near and far it fades. */
  const zones = [];
  if (import.meta.env?.DEV) window.__soundZones = zones;   // dev: the final QA's sound audit
  function zoneTick(z) {
    const d = Math.hypot(z.x - listener.x, z.z - listener.z);
    const shape = z.core ? Math.max((z.edge ?? 1) * falloff(d, z), falloff(d, z.core)) : falloff(d, z);
    const want = !muted && d < z.far ? z.level * shape * (z.indoor && !state.inside ? 0.35 : 1) : 0;
    if (want > 0 && !z.node) {
      z.g = ac.createGain(); z.g.gain.value = 0;
      z.p = ac.createPanner(); z.p.panningModel = 'HRTF'; z.p.rolloffFactor = 0;
      z.p.positionX.value = z.x; z.p.positionY.value = z.y; z.p.positionZ.value = z.z;
      z.g.connect(z.p).connect(z.indoor ? inGain : grp[groupOf(z.name)]?.out ?? outBus);
      z.node = loopNode(z.name, z.g, 1);
    }
    if (!z.node) return;
    z.node.set(want > 0, 1.2);
    z.g.gain.setTargetAtTime(want, now(), 0.25);
  }
  const walks = [];
  const bell = { src: null, timer: null, gain: null, on: false };

  /* the store's own hum and the cooler's compressor, made in code */
  function makeHum() {
    const g = ac.createGain(); g.gain.value = 0; g.connect(inGain);
    for (const [f, l] of [[60, 0.02], [120, 0.012], [2000, 0.0025]]) {
      const o = ac.createOscillator(), og = ac.createGain();
      o.frequency.value = f; og.gain.value = l; o.connect(og).connect(g); o.start();
    }
    return g;
  }
  function makeFridge() {
    const g = ac.createGain(); g.gain.value = 0;
    const p = ac.createPanner(); p.panningModel = 'HRTF'; p.rolloffFactor = 0;
    g.connect(p).connect(inGain);
    const s = ac.createBufferSource(); s.buffer = noise; s.loop = true;
    const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 110;
    const o = ac.createOscillator(); o.frequency.value = 50; const og = ac.createGain(); og.gain.value = 0.25;
    s.connect(f).connect(g); o.connect(og).connect(g); s.start(); o.start();
    return { g, p, cycle: 0 };
  }

  /* ------------------------------ the api ------------------------------ */
  const api = {
    /** The decoded files held now: { mb, names } (a phone's memory check). */
    decoded() { let n = 0; for (const b of buffers.values()) n += b.numberOfChannels * b.length * 4; return { mb: +(n / 1048576).toFixed(1), names: [...buffers.keys()] }; },
    /**
     * A looping track that belongs to a place (Tan's experiences): heard from
     * `far` in, full from `near`, nowhere else.  { x, z, y, near, far,
     * level, indoor }; with `core: { near, far }` it is full only in the
     * core and `edge` (0..1) of that out to `far` (the station).  Returns a handle: { set(opts) } to move or retune it.
     */
    zone(name, o) {
      const z = { name, x: 0, z: 0, y: 2, near: 8, far: 30, level: 0.6, indoor: false, ...o, node: null };
      zones.push(z);
      return { set: (p) => Object.assign(z, p) };
    },
    /** A placed one-off (a line said, a track played on interaction).
     * `indoor`: it belongs inside the store (heard through the glass from outside). */
    oneShot(name, { x, z, y = 1.6, near = 6, far = 40, gain = 1, recipe = null, indoor = false } = {}) {
      return play(name, { at: x === undefined ? null : { x, y, z }, range: x === undefined ? null : { near, far }, gain, recipe, indoor });
    },
    /** Fetch and decode these files now, so their first play is the file and
     * not the recipe.  Waits for the list of files first: asked for before it
     * has arrived (the first click, near the store), it used to fetch nothing
     * and the self-checkout's first run was a tap (2026-09-28). */
    async preload(names, at = null) {
      if (!ac) return false;
      if (at) for (const n of names) lastAt.set(n, at);   // (where it belongs: a phone lets it go far from there, sweep)
      await manifestReady;
      const got = await Promise.all(names.map((n) => (manifest[n] ? buffer(n) : null)));
      return got.every(Boolean);
    },
    /** The context and the outdoor bus, for sounds made in code elsewhere (the trains, line/sfx.js):
     * they join the mix, so volume, mute, the pause card and the store's walls all reach them (QA-007). */
    graph() { return ac ? { ac, out: outBus } : null; },
    get ready() { return !!ac; },
    get muted() { return muted; },
    get volume() { return volume; },
    get available() { return true; },
    /** From the first click: make the context, the graph, and start loading. */
    async start() {
      if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
      try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch { return; }
      if (ac.state === 'suspended') ac.resume();
      noise = noiseBuf();
      const comp = ac.createDynamicsCompressor();
      comp.threshold.value = -14; comp.ratio.value = 3;
      comp.connect(ac.destination);
      master = ac.createGain(); master.gain.value = muted ? 0 : volume; master.connect(comp);
      // the game's own sound goes through `world`, so the menu's song can take its place (setMenu); the song goes to master
      world = ac.createGain(); world.gain.value = menuOn ? SOUND.menu.duck : 1; world.connect(master);
      sfxBus = ac.createGain(); sfxBus.connect(world);
      // a small room, made in code: decaying noise (SPEC 9)
      reverb = ac.createConvolver();
      const n = Math.round(ac.sampleRate * 0.8), ir = ac.createBuffer(2, n, ac.sampleRate);
      for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n) ** 3; }
      reverb.buffer = ir;
      wet = ac.createGain(); wet.gain.value = 0.05;
      sfxBus.connect(wet).connect(reverb).connect(world);
      outBus = ac.createGain();
      outLow = ac.createBiquadFilter(); outLow.type = 'lowpass'; outLow.frequency.value = 20000; outLow.Q.value = 0.5;
      outGain = ac.createGain(); outGain.gain.value = 1;
      outBus.connect(outLow).connect(outGain).connect(world);
      inGain = ac.createGain(); inGain.gain.value = 0; inGain.connect(world);
      musicGain = ac.createGain(); musicGain.gain.value = 1;
      for (const k of ['amb', 'music', 'fx', 'dog']) { grp[k] = { out: ac.createGain(), sfx: ac.createGain() }; grp[k].out.connect(outBus); grp[k].sfx.connect(sfxBus); }
      grp.music.world = ac.createGain(); grp.music.world.connect(world);
      musicGain.connect(grp.music.world);
      bell.gain = ac.createGain(); bell.gain.gain.value = 0; bell.gain.connect(grp.fx.out);
      hum = makeHum();
      fridge = makeFridge();
      // the loops exist at once (they wait for their files); the list of files comes after
      for (const [k, lvl] of Object.entries(BEDS)) beds[k] = loopNode(k, grp.amb.out, lvl);
      music = streamNode('store-bgm', musicGain, 0.2);
      grp.music.master = ac.createGain(); grp.music.master.connect(master);
      theme = streamNode('theme', grp.music.master, SOUND.menu.level);
      manifestReady = fetch(import.meta.env.BASE_URL + 'audio/manifest.json').then((r) => r.json()).then((m) => { manifest = m; }, () => { manifest = {}; });
      await manifestReady;
      music.arm();                              // while the click that started us is still in hand
      theme.arm();
      if (menuOn) { theme.set(true, SOUND.menu.fadeIn); }
      // the short sounds are fetched now, quietly, so the first of each is ready
      for (const k of ['lawson-chime', 'auto-door', 'fridge-door', 'railway-bells', 'walk-kakko', 'walk-piyo']) buffer(k);
    },
    /** The start and pause cards (the title tune): the song loops while one shows, picking up where it
     * left off, and the game's own sound steps back under it; off, the song fades out and the game comes back. */
    setMenu(on) {
      menuOn = on;
      if (!ac) return;
      world.gain.setTargetAtTime(on ? SOUND.menu.duck : 1, now(), (on ? SOUND.menu.fadeIn : SOUND.menu.fadeOut) / 4);
      theme?.set(on, on ? SOUND.menu.fadeIn : SOUND.menu.fadeOut);
      for (const r of [...held]) (on ? holdPause : holdResume)(r);   // the world's one-shots stand still with it (QA-013)
    },
    /** The tab went away or came back: an unheard graph should not be running. */
    setAwake(awake) {
      if (!ac) return;
      if (awake) ac.resume();
      else if (ac.state === 'running') ac.suspend();
    },
    setVolume(v) {
      volume = Math.max(0, Math.min(1, v));
      muted = volume <= 0.001;
      if (!muted) lastAudible = volume;
      if (master) master.gain.setTargetAtTime(muted ? 0 : volume, now(), 0.05);
      return muted;
    },
    toggle() {
      muted = !muted;
      if (!muted && volume <= 0.001) volume = lastAudible;
      if (master) master.gain.setTargetAtTime(muted ? 0 : volume, now(), 0.1);
      return muted;
    },

    /**
     * Each frame: the listener (the camera), inside the store or not, the
     * look (the ambience bed), and where the cooler is (its compressor).
     */
    update(dt, { camera, inside, look, cooler }) {
      if (!ac || !music) return;
      const t = now(), L = ac.listener;
      listener.x = camera.position.x; listener.y = camera.position.y; listener.z = camera.position.z;
      for (const z of zones) zoneTick(z);
      if (release > 0 && (sweepT += dt) > 1) { sweepT = 0; sweep(); }
      camera.getWorldDirection(_f);
      if (L.positionX) {
        L.positionX.setTargetAtTime(listener.x, t, 0.02); L.positionY.setTargetAtTime(listener.y, t, 0.02); L.positionZ.setTargetAtTime(listener.z, t, 0.02);
        L.forwardX.setTargetAtTime(_f.x, t, 0.02); L.forwardY.setTargetAtTime(_f.y, t, 0.02); L.forwardZ.setTargetAtTime(_f.z, t, 0.02);
      } else { L.setPosition(listener.x, listener.y, listener.z); L.setOrientation(_f.x, _f.y, _f.z, 0, 1, 0); }

      // stepping in muffles the town within a second; the store's own sound comes up
      if (inside !== state.inside) {
        state.inside = inside;
        outLow.frequency.cancelScheduledValues(t);
        outLow.frequency.setTargetAtTime(inside ? 900 : 20000, t, 0.15);
        state.lowpassTarget = inside ? 900 : 20000;      // Firefox does not report a ramping value
        outGain.gain.setTargetAtTime(inside ? 0.3 : 1, t, 0.15);
        // the store's own sound: its bed, music and hum, 15% up on the first mix (Tan, 2026-09-28)
        inGain.gain.setTargetAtTime(inside ? SOUND.storeInside : 0, t, 0.4);
        hum.gain.setTargetAtTime(inside ? SOUND.storeInside : 0, t, 0.4);
        wet.gain.setTargetAtTime(inside ? 0.22 : 0.05, t, 0.3);
        music.set(inside, 1.5);
        state.music = inside;
      }
      state.lowpass = Math.round(outLow.frequency.value);
      for (const v of voices) {
        const { k, f } = voiceLevel(v);
        v.g.gain.setTargetAtTime(k, t, 0.06);
        v.lp.frequency.setTargetAtTime(f, t, 0.06);
      }
      // the bed for the time of day, crossfaded; the wind always, low
      if (look !== state.look) {
        state.look = look;
        beds.wind.set(true, 2);
        for (const [k, name] of Object.entries(BED_OF_LOOK)) if (beds[name]) beds[name].set(k === look, 3);
        if (look === 'golden') { buffer('crows'); crow.wait = 3 + Math.random() * 5; crow.pair = 0; }
      }
      // golden hour: a crow now and then, far off
      if (look === 'golden' && !muted) {
        const C = SOUND.crows;
        crow.wait -= dt;
        if (crow.pair > 0 && (crow.pair -= dt) <= 0) crowCall();
        if (crow.wait <= 0) {
          crowCall();
          crow.wait = C.every[0] + Math.random() * (C.every[1] - C.every[0]);
          if (Math.random() < C.pair) crow.pair = 0.7 + Math.random() * 0.8;
        }
      }
      // the cooler's compressor, heard near the drinks wall, cycling on and off
      if (cooler) {
        fridge.p.positionX.value = cooler.x; fridge.p.positionY.value = 1; fridge.p.positionZ.value = cooler.z;
        fridge.cycle = (fridge.cycle + dt) % 60;
        const on = fridge.cycle < 40 ? 1 : 0;
        const d = Math.hypot(cooler.x - listener.x, cooler.z - listener.z);
        fridge.g.gain.setTargetAtTime(0.05 * on * falloff(d, SOUND.fridge), t, 0.8);
      }
    },

    /* ---- the store ---- */
    /** The chime: once as you come in, once as you go out, at the door. */
    storeChime(at) {
      play(manifest['lawson-chime'] ? 'lawson-chime' : null,
        { at, range: SOUND.storeChime, recipe: 'store-chime', gain: 0.55, indoor: true });
    },
    autoDoor(at, opening) { play('auto-door', { at, range: SOUND.autoDoor, gain: opening ? 0.35 : 0.25, rate: opening ? 1 : 0.96 }); },
    fridgeDoor(at, opening) { play('fridge-door', { at, range: SOUND.fridge, gain: opening ? 0.5 : 0.3, rate: opening ? 1 : 0.85 }); },
    /** Taking it off the shelf: by what it is made of. */
    item(material, at) { play(null, { at, range: SOUND.shelf, recipe: RECIPES[material] ? material : 'plastic', gain: 0.9 }); },
    step(inside) { play(null, { recipe: 'step', gain: 0.9, o: { inside } }); },

    /* ---- the railway (M2c), now through the engine ---- */
    /** The crossing: ringing or not, and how far the listener is. */
    bells(on, distance) {
      if (!ac) return;
      const audible = on && distance < SOUND.crossingBells.far;
      state.bells = audible;
      if (audible && !bell.on) {
        bell.on = true;
        const b = buffers.get('railway-bells');
        if (b) {
          bell.src = ac.createBufferSource(); bell.src.buffer = b; bell.src.loop = true;
          [bell.src.loopStart, bell.src.loopEnd] = loopSpan('railway-bells', b);
          bell.src.connect(bell.gain); bell.src.start(now(), bell.src.loopStart);
        } else {
          let k = 0;
          const tick = () => { tone(bell.gain, k++ % 2 ? 860 : 730, now() + 0.01, 0.45, { type: 'sine', level: 0.3 }); };
          tick(); bell.timer = setInterval(tick, 250);
        }
        log.push({ name: 'railway-bells', t: +now().toFixed(3), loop: true });
      } else if (!audible && bell.on) {
        bell.on = false;
        if (bell.src) { try { bell.src.stop(); } catch { /* stopped */ } bell.src = null; }
        if (bell.timer) { clearInterval(bell.timer); bell.timer = null; }
      }
      bell.gain.gain.setTargetAtTime(audible ? falloff(distance, SOUND.crossingBells) * 0.7 : 0, now(), 0.1);
    },
    /**
     * The zebras' walk lights (M4, Tan): each plays the pedestrian signal
     * (piyo-piyo, kakko) while it is green, heard only near it.
     * `list` [{ x, z, on, sound }] in world terms, the same order every frame.
     */
    walkSignals(list) {
      if (!ac) return;
      /* One junction, one voice: crossings with the same tune within 15 m of
       * each other (the master junction's two main-road zebras) are heard as
       * one, from the nearest of them, not as two loops in unison. */
      const dist = list.map((w) => Math.hypot(w.x - listener.x, w.z - listener.z));
      const twin = list.map((w, i) => list.some((v, j) => j !== i && v.on && v.sound === w.sound
        && Math.hypot(v.x - w.x, v.z - w.z) < 15 && (dist[j] < dist[i] || (dist[j] === dist[i] && j < i))));
      list.forEach((w, i) => {
        const n = walks[i] ?? (walks[i] = { g: null, src: null, timer: null });
        const d = dist[i];
        const on = w.on && !twin[i] && d < SOUND.walkSignal.far && !muted;
        if (on && !n.g) {
          n.g = ac.createGain(); n.g.gain.value = 0;
          const p = ac.createPanner(); p.panningModel = 'HRTF'; p.rolloffFactor = 0;
          p.positionX.value = w.x; p.positionY.value = 3; p.positionZ.value = w.z;
          n.g.connect(p).connect(grp.fx?.out ?? outBus);
        }
        if (on && !n.src && !n.timer) {
          const file = 'walk-' + (w.sound ?? 'piyo');
          const b = buffers.get(file);
          if (b) {
            n.src = ac.createBufferSource(); n.src.buffer = b; n.src.loop = true;
            [n.src.loopStart, n.src.loopEnd] = loopSpan(file, b);
            n.src.connect(n.g); n.src.start(now(), n.src.loopStart);
          } else {
            // SPEC 9's recipe: an original two-tone "pi-yo" chirp every 0.6 s
            const chirp = () => { const t0 = now() + 0.01; tone(n.g, 2800, t0, 0.08, { level: 0.25 }); tone(n.g, 3600, t0 + 0.12, 0.08, { level: 0.25 }); };
            chirp(); n.timer = setInterval(chirp, 600);
          }
          state.walk = (state.walk ?? 0) + 1;
          log.push({ name: 'walk-' + (w.sound ?? 'piyo'), t: +now().toFixed(3), loop: true, i });
        } else if (!on && (n.src || n.timer)) {
          const src = n.src, timer = n.timer;
          n.src = null; n.timer = null;
          n.g.gain.setTargetAtTime(0, now(), 0.08);
          setTimeout(() => { if (src) { try { src.stop(); } catch { /* stopped */ } } if (timer) clearInterval(timer); }, 400);
        }
        if (n.g && on) n.g.gain.setTargetAtTime(1.6 * falloff(d, SOUND.walkSignal), now(), 0.1);
      });
      state.walking = walks.filter((n) => n.src || n.timer).length;
    },

    /** The train's door chime: three notes of our own (never a station melody). */
    chime(distance) {
      if (!ac || muted || distance >= SOUND.doorChime.far) return;
      const g = ac.createGain(); g.gain.value = 0.6 * falloff(distance, SOUND.doorChime); g.connect(grp.fx?.out ?? outBus);
      const t = now() + 0.02;
      [[659.3, 0], [880.0, 0.28], [784.0, 0.56]].forEach(([f, dt]) => tone(g, f, t + dt, 0.45, { level: 0.4 }));
      log.push({ name: 'train-chime', t: +now().toFixed(3) });
    },
  };
  if (import.meta.env?.DEV) api.debug = {
    get _voices() { return voices; },
    get _held() { return held; },
    get _music() { return music; },
    get _theme() { return theme; },
    get _world() { return world; },
    get _beds() { return beds; },
    /** What is actually coming out: the master's level over `ms` (dev only). */
    async level(ms = 1500) {
      if (!ac) return 0;
      if (!api.debug._an) { api.debug._an = ac.createAnalyser(); api.debug._an.fftSize = 2048; master.connect(api.debug._an); }
      const an = api.debug._an, buf = new Float32Array(an.fftSize);
      let peak = 0, sum = 0, n = 0;
      const t0 = performance.now();
      while (performance.now() - t0 < ms) {
        an.getFloatTimeDomainData(buf);
        for (const v of buf) { peak = Math.max(peak, Math.abs(v)); sum += v * v; n++; }
        await new Promise((r) => setTimeout(r, 30));
      }
      return { rms: +Math.sqrt(sum / n).toFixed(5), peak: +peak.toFixed(4) };
    }, voiceLevels: () => [...voices].map((v) => ({ indoor: v.indoor, ...voiceLevel(v) })), log, state, get ac() { return ac; }, get manifest() { return manifest; }, buffers };
  /* Director Mode (dev only; none of this is in the build): the pup's extra voice, clean clips, the offline render of
   * a recipe, a tap for the recording, the groups on and off (docs/director-mode-prompt.md) */
  if (import.meta.env.DEV) {
    Object.assign(RECIPES, {
      // a squeaky rising yawn, soft paw pats, a tiny yelp, sniffs
      'dog-yawn'(d, t) {
        voice(d, t, 0.9, [[0, 620], [0.25, 980], [0.55, 1320], [0.8, 1100], [1, 760]], { level: 0.3, formants: [[1200, 3], [2400, 4]], breath: 0.06, vib: 6 });
        burst(d, t + 0.05, 0.8, { freq: 900, q: 0.7, level: 0.05, type: 'lowpass' });
      },
      'dog-tip'(d, t) { for (let i = 0; i < 2; i++) burst(d, t + i * 0.07, 0.03, { freq: 1600 + i * 300, q: 1.4, level: 0.16 }); },
      'dog-yelp'(d, t) { voice(d, t, 0.13, [[0, 1500], [0.35, 2350], [1, 1650]], { level: 0.45, formants: [[2100, 3], [3600, 5]], breath: 0.03 }); },
      'dog-sniff'(d, t) { for (let i = 0; i < 4; i++) burst(d, t + i * 0.1, 0.045, { freq: 3200 + (i % 2) * 500, q: 0.9, level: 0.12 }); },
    });
    Object.assign(api, {
      /** Director Mode (dev): a file played clean (not in the world): straight to the master, with a gain, fades, a
       * length, looped if asked (between loopStart and loopEnd when given).  { name, gain, dur, loop, loopStart,
       * loopEnd, fadeIn, fadeOut, offset } */
      async clip({ name, gain = 1, dur = null, loop = false, loopStart = 0, loopEnd = 0, fadeIn = 0.02, fadeOut = 0.05, offset = 0 }) {
        if (!ac || !manifest[name]) return;
        const b = buffers.get(name) ?? (await buffer(name) && buffers.get(name));
        if (!b) return;
        const t0 = now() + 0.005, len = dur ?? b.duration;
        const s = ac.createBufferSource(), g = ac.createGain();
        s.buffer = b; s.loop = loop; s.loopStart = loopStart; s.loopEnd = loopEnd;
        g.gain.setValueAtTime(0, t0);
        g.gain.linearRampToValueAtTime(gain, t0 + fadeIn);
        g.gain.setValueAtTime(gain, Math.max(t0 + fadeIn, t0 + len - fadeOut));
        g.gain.linearRampToValueAtTime(0, t0 + len);
        s.connect(g).connect(master);
        s.start(t0, offset);
        s.stop(t0 + len + 0.05);
        log.push({ name, t: +now().toFixed(3), clip: true });
      },
      /** Director Mode (dev): a recipe (the dog's voice...) rendered into another context (an OfflineAudioContext) at t. */
      renderRecipe(ctx, dest, name, t, gain = 1) {
        if (!RECIPES[name]) return false;
        const keep = ac;
        ac = ctx;
        try { const g = ctx.createGain(); g.gain.value = gain; g.connect(dest); RECIPES[name](g, t, {}); } finally { ac = keep; }
        return true;
      },
      /** Director Mode (dev): everything the engine makes, as a MediaStream (it still plays through the speakers). */
      tap() {
        if (!ac) return null;
        if (!api._tap) { api._tap = ac.createMediaStreamDestination(); master.connect(api._tap); }
        return { ac, node: api._tap, stream: api._tap.stream };
      },
      /** Director Mode (dev): a group on or off for a recording pass: 'amb' | 'music' | 'fx' | 'dog'. */
      setGroup(k, on) {
        const G = grp[k];
        if (!G) return;
        for (const n of Object.values(G)) n.gain.setTargetAtTime(on ? 1 : 0, now(), 0.02);
        api.groups[k] = on;
      },
      groups: { amb: true, music: true, fx: true, dog: true },
    });
  }
  return api;
}
const _f = new Vector3();
