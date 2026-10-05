/* dev (scripts/_gameplay.mjs): the page's clock, in our hands.  Loaded before the game's own code.
 *
 * The gameplay promo is the real game recorded frame by frame: each frame is 1/60 s of the game's time however long
 * the laptop takes to draw and capture it.  For that the page must not see the wall clock at all:
 *
 *   performance.now, Date.now          the virtual time
 *   requestAnimationFrame, timers      queued, and run by VT.step(ms)
 *   CSS transitions and animations     held, and set to the virtual time each step (the HUD's fades)
 *   AudioContext                       an OfflineAudioContext rendered one frame's worth at a time (its suspend and
 *                                      resume), so the engine's sound is in step with the picture to the sample
 *   new Audio(src) (the streamed       a buffer source in that context (a media element cannot feed an offline one)
 *   songs)
 *
 * Until VT.manual() the clock free-runs off the real frames (loading). */
(() => {
  const real = {
    raf: window.requestAnimationFrame.bind(window), now: performance.now.bind(performance),
    setTimeout: window.setTimeout.bind(window), clearTimeout: window.clearTimeout.bind(window),
  };
  const D0 = Date.now();
  let vt = 0, id = 1, manual = false;
  let rafs = [];
  const timers = new Map();
  performance.now = () => vt;
  Date.now = () => D0 + vt;
  window.requestAnimationFrame = (cb) => { const k = id++; rafs.push([k, cb]); return k; };
  window.cancelAnimationFrame = (k) => { rafs = rafs.filter((r) => r[0] !== k); };
  window.setTimeout = (fn, ms = 0, ...a) => { const k = id++; timers.set(k, { at: vt + Math.max(0, +ms || 0), fn, a }); return k; };
  window.setInterval = (fn, ms = 0, ...a) => { const k = id++; timers.set(k, { at: vt + Math.max(1, +ms || 0), fn, a, every: Math.max(1, +ms || 0) }); return k; };
  window.clearTimeout = window.clearInterval = (k) => { timers.delete(k); };

  const anims = new WeakMap();
  function step(ms) {
    vt += ms;
    // timers due, in order (those they set that are due too; never more than a few thousand a step)
    for (let n = 0; n < 4000; n++) {
      let pick = null, pk = 0;
      for (const [k, t] of timers) if (t.at <= vt && (!pick || t.at < pick.at)) { pick = t; pk = k; }
      if (!pick) break;
      if (pick.every) pick.at += pick.every; else timers.delete(pk);
      try { typeof pick.fn === 'function' ? pick.fn(...pick.a) : (0, eval)(pick.fn); } catch (e) { console.error(e); }
    }
    const q = rafs; rafs = [];
    for (const [, cb] of q) { try { cb(vt); } catch (e) { console.error(e); } }
    // the page's animations, at the virtual time
    for (const a of document.getAnimations()) {
      let s = anims.get(a);
      if (s === undefined) { s = vt - (Number(a.currentTime) || 0); anims.set(a, s); }
      try {
        const end = a.effect?.getComputedTiming?.().endTime;
        if (a.playState !== 'paused') a.pause();
        const t = vt - s;
        if (Number.isFinite(end) && t >= end) a.finish(); else a.currentTime = t;
      } catch { /* an animation gone mid-step */ }
    }
  }
  const pump = () => { if (!manual) { step(1000 / 60); real.raf(pump); } };
  real.raf(pump);

  /* ---- the sound ---- */
  const OAC = window.OfflineAudioContext, SR = 48000, LEN = 480;
  let ctx = null;
  class VAC extends OAC {
    constructor() { super(2, SR * LEN, SR); ctx = this; this._begun = false; this._at = Promise.resolve(); this._frames = 0; }
    get state() { return 'running'; }
    resume() { return Promise.resolve(); }
    suspend() { return Promise.resolve(); }
    close() { return Promise.resolve(); }
    createMediaElementSource(el) { return el._out(this); }
    createMediaStreamDestination() { const g = this.createGain(); g.stream = new MediaStream(); return g; }
  }
  window.AudioContext = window.webkitAudioContext = VAC;
  class FakeAudio {
    constructor(src) { this.src = src; this.loop = false; this.preload = ''; this.crossOrigin = null; this.volume = 1; this._buf = null; this._node = null; this._off = 0; this._want = false; }
    _out(ac) {
      this._ac = ac; this._g = ac.createGain();
      fetch(this.src).then((r) => r.arrayBuffer()).then((b) => ac.decodeAudioData(b)).then((b) => { this._buf = b; if (this._want && !this._node) this._start(); }).catch((e) => console.error('stream', this.src, e));
      return this._g;
    }
    _start() { const s = this._ac.createBufferSource(); s.buffer = this._buf; s.loop = this.loop; s.connect(this._g); this._t0 = this._ac.currentTime; s.start(this._t0, this._off % this._buf.duration); this._node = s; }
    play() { this._want = true; if (this._buf && !this._node) this._start(); return Promise.resolve(); }
    pause() { this._want = false; if (this._node) { this._off += this._ac.currentTime - this._t0; try { this._node.stop(); } catch { /* not started */ } this._node.disconnect(); this._node = null; } }
    get paused() { return !this._want; }
    get currentTime() { return this._node ? this._off + this._ac.currentTime - this._t0 : this._off; }
    set currentTime(v) { const on = this._want; this.pause(); this._off = +v || 0; if (on) this.play(); }
    load() {} addEventListener() {} removeEventListener() {}
  }
  window.Audio = FakeAudio;

  window.VT = {
    real, step,
    get t() { return vt; },
    manual() { manual = true; },
    get audio() { return ctx; },
    /** the sound brought up to the frame just stepped (frame n of the take): resolves when it is there */
    async audioTo(sec) {
      if (!ctx) return;
      const p = OAC.prototype.suspend.call(ctx, sec);
      if (!ctx._begun) { ctx._begun = true; ctx._done = OAC.prototype.startRendering.call(ctx); } else OAC.prototype.resume.call(ctx);
      await p;
    },
    /** the rest rendered out (quick: nothing waits on it), the whole buffer returned */
    async audioEnd() { if (!ctx || !ctx._begun) return null; OAC.prototype.resume.call(ctx); return ctx._done; },
  };
})();
