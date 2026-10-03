/* ------------------------------------------------------------------ *
 * The world's way to the sound engine (Tan's experiences).  World code
 * is built before main.js makes the engine, so it asks here: zones and
 * one-shots queue until main.js attaches the engine, then pass straight
 * through.  See core/sound.js `zone` and `oneShot`.
 * ------------------------------------------------------------------ */

let engine = null;
const pending = [];
const handles = [];

export const soundBus = {
  /** Attach the engine (main.js, once). */
  attach(sound) {
    engine = sound;
    for (const [kind, name, o, h] of pending.splice(0)) {
      if (kind === 'zone') h.real = engine.zone(name, o);
    }
  },
  /** A looping track heard only near a place: see sound.zone. */
  zone(name, o) {
    const h = { real: null, set(p) { if (h.real) h.real.set(p); else Object.assign(o, p); } };
    handles.push(h);
    if (engine) h.real = engine.zone(name, o);
    else pending.push(['zone', name, o, h]);
    return h;
  },
  /** A placed one-off; dropped if the engine isn't running yet (before the first click).
   * Returns a handle ({ ended }) while the engine runs, else null. */
  oneShot(name, o) { return engine?.oneShot(name, o) ?? null; },
  /** The engine's context and outdoor bus (null before the first click): see sound.graph. */
  graph() { return engine?.graph?.() ?? null; },
  /** Fetch and decode files ahead of need (resolves false before the first click). */
  preload(names, at) { return engine?.preload ? engine.preload(names, at) : Promise.resolve(false); },
  get ready() { return !!engine?.ready; },
  /** The engine's volume as gain, 0 when muted or not attached (line/sfx.js follows it). */
  get level() { return engine ? (engine.muted ? 0 : engine.volume) : 0; },
};
