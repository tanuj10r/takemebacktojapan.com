import * as THREE from 'three';
import { soundBus } from '../core/soundBus.js';
import { sfxTap, sfxOn } from '../world/line/sfx.js';
import { makePuppet, REACTIONS } from './hachi.js';
import { place, orbit } from './camera.js';
import { makeHanPuppet } from './han.js';
import { VERSIONS, VEND } from './shots.js';
import { makeVendingMachine } from '../world/vending.js';
import { makePanel } from './panel.js';
import { makeRecorder, renderDeterministic } from './record.js';
import { rng } from './util.js';

/* ------------------------------------------------------------------ *
 * Director Mode (dev only, ?director): plays every shot of the Hachi promo
 * videos, timed and repeatable, and records itself (docs/director-mode-
 * prompt.md, docs/director-mode-version-c.md, DIRECTOR.md).
 *
 * main.js hands it the frame when it is up.  It renders the town at a
 * fixed 1080x1920 (9:16) into the WebGL canvas, copies each frame onto
 * its own 2D canvas (the one on screen and the one recorded: the drunk
 * blur is drawn there, where a CSS filter would not be recorded), and
 * keeps everything else (its panel, the safe-frame overlay) off it.
 * ------------------------------------------------------------------ */

export const OUT = { w: 1080, h: 1920 };

export function startDirector(G) {
  const { camera, renderer, pipeline, world, player, sound, shop, sky, canvas: glCanvas } = G;
  document.body.classList.add('director');

  /* ---------------- the frame: 9:16, 1080x1920 at device pixel ratio 1 ---------------- */
  const out = document.createElement('canvas');
  out.id = 'director-out';
  out.width = OUT.w; out.height = OUT.h;
  const ctx2 = out.getContext('2d', { alpha: false, desynchronized: false });
  const style = document.createElement('style');
  style.textContent = `
    body.director { background: #000; }
    body.director > *:not(.director-keep) { display: none !important; }
    body.director.director-hud > *:not(.director-keep):not(#view) { display: revert !important; }
    #director-out { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: #000; image-rendering: auto; }
    #director-safe { position: fixed; pointer-events: none; display: none; }
    #director-safe.on { display: block; }
    #director-safe .top, #director-safe .bot { position: absolute; left: 0; right: 0; background: rgba(255,40,80,.28); border: 1px dashed rgba(255,255,255,.6); }
  `;
  document.head.appendChild(style);
  out.classList.add('director-keep');
  document.body.appendChild(out);
  const safe = document.createElement('div');
  safe.id = 'director-safe';
  safe.className = 'director-keep';
  safe.innerHTML = '<div class="top"></div><div class="bot"></div>';
  document.body.appendChild(safe);

  let size = { ...OUT };
  function setSize(w, h, scale = 1.5) {
    size = { w, h };
    out.width = w; out.height = h;
    pipeline.forceScale = scale;
    const budget = pipeline.pixelBudget;
    pipeline.pixelBudget = Math.max(budget, w * h * scale * scale);
    pipeline.setSize(w, h);
    G.setOutlineResolution(pipeline.size.x, pipeline.size.y);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    fit();
  }
  function fit() {
    // shown as large as the window allows, beside the panel; rendered at its own size regardless
    const availH = window.innerHeight - 16, availW = window.innerWidth - 380;
    const k = Math.min(1, availH / size.h, availW / size.w);
    const w = Math.round(size.w * k), h = Math.round(size.h * k);
    out.style.width = w + 'px'; out.style.height = h + 'px';
    out.style.left = `calc(50% + 180px)`;
    const r = { left: (window.innerWidth + 360) / 2 - w / 2, top: window.innerHeight / 2 - h / 2 };
    Object.assign(safe.style, { left: r.left + 'px', top: r.top + 'px', width: w + 'px', height: h + 'px' });
    safe.querySelector('.top').style.cssText = `top:0;height:${h * 0.15}px`;
    safe.querySelector('.bot').style.cssText = `bottom:0;height:${h * 0.2}px`;
  }
  window.addEventListener('resize', fit);
  setSize(OUT.w, OUT.h);
  G.magnifyFuji();

  /* a soft fill that follows the pup in night shots (its face reads; the cel bands keep it painted); made now, at 0,
   * so switching it on never recompiles a shader mid-shot */
  const fill = new THREE.PointLight(0xffe2c4, 0, 3.2, 1.6);
  G.scene.add(fill);
  const rim = new THREE.PointLight(0xc8d8ff, 0, 5, 1.6);
  G.scene.add(rim);
  /* ---------------- the cast ---------------- */
  const pup = makePuppet({ camera }, { index: 0 });
  const han = makeHanPuppet(G);
  const guide = window.__guide;
  let prevPuppet = null;
  function env0ground(x, z) { return window.__guide?.ground?.(x, z) ?? 0; }
  const own = (on) => {
    if (on && !guide.G.puppet) { prevPuppet = guide.G.state; guide.G.puppet = () => {}; }
    if (!on && guide.G.puppet) { guide.G.puppet = null; guide.hide(1); }
  };

  /* ---------------- state ---------------- */
  const S = {
    version: 'A', shotIndex: 0, running: null, t: 0, slow: false, hud: false, playAll: false, recording: null,
    held: false, tester: null, lastWall: 0, det: false,
  };
  const clockDt = (now) => { const d = S.lastWall ? Math.min(0.1, (now - S.lastWall) / 1000) : 0; S.lastWall = now; return d; };

  /* the vending machine Hachi hides behind (A9, A10): NIPPON has none, so Director Mode stands one by its west corner */
  const vend = makeVendingMachine(1, 7);
  vend.position.set(VEND.x, env0ground(VEND.x, VEND.z), VEND.z);
  vend.rotation.y = VEND.ry;
  vend.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  G.scene.add(vend);
  world.colliders.push({ x0: VEND.x - 0.56, x1: VEND.x + 0.56, z0: VEND.z - 0.45, z1: VEND.z + 0.45, top: 1.9 });
  const hl = [];
  G.scene.traverse((o) => { if (o.name === 'exp-highlight') hl.push(o); });

  /* ---------------- shots ---------------- */
  const env = {
    G, THREE, camera, world, shop, sound, soundBus, pup, han, guide, player,
    W: guide.walk,
    ground: (x, z) => guide.ground(x, z),
    toWorld: (p) => world.frame.toWorld(p),
    line: world.line?.local ?? null,
    service: world.line?.local?.service ?? world.line?.service ?? null,
    look: (name) => G.applyLook(name),
    blur: 0, slowTap: false,
    clip: (c) => sound.clip(c),
  };
  env.env = env;                                            // (shots take { pup, han, env, ... })
  const RANDOM = Math.random;
  let shot = null;          // { def, rig, update, t }
  function begin(def, { seed = 1 } = {}) {
    // the shot's own random (the town's crows, pigeons, anything that rolls a die): the same every take
    const r = rng((def.seed ?? seed) * 9973 + def.id.charCodeAt(0) * 131 + (+def.id.slice(1) || 0));
    Math.random = r;
    own(true);
    // Version C is clean: the sounds alone (its cues, the pup's voice) over its own quiet bed
    if (def.clean) { for (const g of ['amb', 'fx', 'music']) sound.setGroup(g, false); sfxOn(false); }
    env.blur = 0; env.roll = 0;
    han.release();
    pup.show(true); pup.double(null);
    const made = def.setup(env);
    shot = { def, rig: made.rig, update: made.update ?? (() => {}), end: made.end ?? (() => {}), t: 0 };
    if (def.look) G.applyLook(def.look);
    // a frame at t = 0 so the first drawn frame is the shot's own
    stepShot(0);
  }
  function end() {
    shot?.end?.();
    fill.intensity = 0; rim.intensity = 0;
    if (shot?.def.clean) { for (const g of ['amb', 'fx', 'music']) sound.setGroup(g, true); sfxOn(true); }
    for (const m of Object.values(env.props ?? {})) m.visible = false;
    Math.random = RANDOM;
    shot = null;
    han.release();
    pup.double(null);
    own(false);
    env.blur = 0;
  }
  function stepShot(dt) {
    if (!shot) return;
    const d = shot.def;
    shot.update(shot.t, dt, env);
    pup.frame(shot.t, dt);
    han.frame(shot.t, dt);
    const cam = shot.rig(shot.t, env);
    // the night fill: between the camera and the pup, above it (and on Han when he's the subject)
    const night = d.look === 'blue';
    const ps = pup.state, cp = cam.p;
    if (ps.x !== undefined) {
      const dx = cp.x - ps.x, dz = cp.z - ps.z, dd = Math.hypot(dx, dz) || 1;
      fill.position.set(ps.x + dx / dd * 0.9, (ps.y ?? 0) + 0.85, ps.z + dz / dd * 0.9);
      fill.intensity = night ? (d.fill ?? 2.2) : (d.dayFill ?? 0);
      rim.position.set(ps.x - dx / dd * 0.8, (ps.y ?? 0) + 1.0, ps.z - dz / dd * 0.8);
      rim.intensity = night ? 1.2 : 0;
    }
    place(camera, cam, { colliders: d.noCollide ? [] : world.colliders.filter((c) => (c.top ?? 0) > 0.5), ground: env.ground, pups: d.noCollide ? [] : [pup] });
  }

  /* ---------------- the frame ---------------- */
  const _lat = new THREE.Vector3();
  function render() {
    for (const o of hl) o.visible = S.hud;
    sky.dome.position.copy(camera.position);
    sky.clouds.position.copy(camera.position);
    G.seatLights(0);
    pipeline.render();
    // onto the out canvas (blurred when drunk)
    ctx2.filter = env.blur > 0.02 ? `blur(${(env.blur * 3 * size.w / 1080).toFixed(2)}px)` : 'none';
    ctx2.drawImage(glCanvas, 0, 0, size.w, size.h);
  }
  /** one step of the world and the shot, `dt` of shot time (the world slowed with it) */
  function step(dt) {
    const w = dt * (S.slow || env.slowTap ? 0.35 : 1);
    if (shot) { shot.t += w; stepShot(w); }
    else if (S.tester) S.tester.step(w);
    world.update(w, camera);
    shop?.update(w, camera, 0);
    G.soundTick(dt);
    for (const o of hl) o.visible = S.hud;
  }

  const api = {
    frame(now) {
      const dt = clockDt(now);
      if (S.det) return true;                                // (a deterministic render drives the frames itself)
      if (S.running) {
        step(dt);
        if (shot && shot.t >= shot.def.dur + (S.running.post ?? 0)) nextOrStop();
      } else if (!S.held) step(0);
      render();
      panel.tick(S, shot);
      return true;
    },
  };

  /* ---------------- playing ---------------- */
  const shotsOf = (v = S.version) => VERSIONS[v].shots;
  function play(i, { all = false, record = false, pre = 0, post = 0 } = {}) {
    const list = shotsOf();
    S.shotIndex = i;
    S.running = { all, record, i, post: all ? 0 : post };
    begin(list[i]);
    if (pre) shot.t = -pre;
    S.lastWall = 0;
  }
  function nextOrStop() {
    const list = shotsOf();
    if (S.running.all && S.running.i + 1 < list.length) {
      // cut straight to the next (prepared: look, positions and sounds set in begin(), the ambience across the cut)
      const carry = shot.t - shot.def.dur;
      end();
      S.running.i++;
      S.shotIndex = S.running.i;
      begin(list[S.running.i]);
      shot.t = Math.max(0, carry);
      return;
    }
    const rec = S.running.record;
    S.running = null;
    end();
    if (rec && S.recording) S.recording.stop();
  }
  function stop() {
    if (S.recording) S.recording.stop(true);
    S.running = null; S.held = false;
    end();
  }
  function resetHold() {
    stop();
    begin(shotsOf()[S.shotIndex]);
    S.held = true;
    render();
  }

  /* ---------------- recording ---------------- */
  const recorder = makeRecorder({ canvas: out, sound, sfxTap, onState: (on) => panel.rec(on) });
  function captions() {
    const cues = VERSIONS.C.cues.filter((c) => c.cap);
    const ts = (x) => { const ms = Math.round(x * 1000); const h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, sec = Math.floor(ms / 1000) % 60; return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`; };
    const srt = cues.map((c, k) => `${k + 1}\n${ts(c.t)} --> ${ts(c.t + c.dur)}\n${c.cap}\n`).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([srt], { type: 'text/plain' }));
    a.download = 'hachi-C-captions.srt';
    document.body.appendChild(a); a.click(); setTimeout(() => a.remove(), 1000);
    window.__lastCaptions = srt;
  }
  function record(whole) {
    const v = S.version, i = S.shotIndex;
    if (v === 'C') captions();
    const name = whole ? `hachi-${v}` : `hachi-${shotsOf()[i].id}`;
    S.recording = recorder.start(name, () => { S.recording = null; });
    if (whole) play(0, { all: true, record: true });
    else play(i, { record: true, pre: 1, post: 1 });
  }

  /* ---------------- the reaction tester (J) ---------------- */
  function tester(name) {
    stop();
    own(true);
    const at = world.frame.toWorld({ x: -3, z: 9.2 });          // the konbini's forecourt, clear ground
    const t0 = 0.4;
    S.tester = {
      name, t: 0,
      rig: orbit(() => ({ x: pup.x, y: guide.ground(pup.x, pup.z), z: pup.z }), { r: 1.25, h: 0.28, deg: 14, a0: 0.3, fov: 40, lookY: 0.2 }),
      step(dt) {
        this.t += dt;
        pup.frame(this.t, dt);
        place(camera, this.rig(this.t), { colliders: [], ground: env.ground, pups: [] });
        if (this.t > REACTIONS[name].dur + t0 + 1.2) { this.t = 0; reset(); }
      },
    };
    const reset = () => {
      pup.reset({ x: at.x, z: at.z, yaw: 0.3, posture: ['wakeUp', 'fallAsleep'].includes(name) ? (name === 'wakeUp' ? 2 : 0) : ['puppyEyes', 'beg', 'munch', 'sitWatch'].includes(name) ? 1 : 0 });
      pup.react(name, t0);
      if (['zoomOff'].includes(name)) pup.go(t0 + REACTIONS.zoomOff.dur, { x: at.x + 5, z: at.z + 1 }, 'sprint', { straight: true });
    };
    reset();
    panel.note(`reaction: ${name}`);
  }

  /* ---------------- keys (they never reach the game) ---------------- */
  const reactionNames = Object.keys(REACTIONS);
  window.addEventListener('keydown', (e) => {
    sound.start();
    e.preventDefault(); e.stopImmediatePropagation();
    if (e.repeat) return;
    const c = e.code, sh = e.shiftKey;
    const list = shotsOf();
    if (S.tester && (c === 'ArrowUp' || c === 'ArrowDown')) { const k = (reactionNames.indexOf(S.tester.name) + (c === 'ArrowDown' ? 1 : -1) + reactionNames.length) % reactionNames.length; tester(reactionNames[k]); return; }
    if (sh && /^Digit[0-4]$/.test(c)) {
      const k = c.slice(5);
      if (k === '0') { for (const g of ['amb', 'music', 'fx', 'dog']) sound.setGroup(g, true); sfxOn(true); }
      else { const g = ['amb', 'music', 'fx', 'dog'][+k - 1]; const on = !sound.groups[g]; sound.setGroup(g, on); if (g === 'fx') sfxOn(on); }
      panel.note(`sound: ${JSON.stringify(sound.groups)}`);
      return;
    }
    switch (c) {
      case 'KeyH': S.hud = !S.hud; document.body.classList.toggle('director-hud', S.hud); break;
      case 'KeyT': S.slow = !S.slow; panel.note(S.slow ? 'slow motion 0.35x' : 'normal speed'); break;
      case 'KeyB': safe.classList.toggle('on'); break;
      case 'KeyJ': S.tester ? (S.tester = null, own(false), panel.note('')) : tester(reactionNames[0]); break;
      case 'KeyV': S.version = S.version === 'A' ? 'B' : S.version === 'B' ? 'C' : 'A'; S.shotIndex = 0; stop(); panel.build(S); break;
      case 'ArrowUp': S.shotIndex = (S.shotIndex - 1 + list.length) % list.length; panel.select(S.shotIndex); break;
      case 'ArrowDown': S.shotIndex = (S.shotIndex + 1) % list.length; panel.select(S.shotIndex); break;
      case 'Enter': S.tester = null; if (sh) record(false); else play(S.shotIndex, {}); break;
      case 'Escape': S.tester = null; stop(); break;
      case 'KeyP': S.tester = null; if (sh) record(true); else play(0, { all: true }); break;
      case 'KeyR': S.tester = null; resetHold(); break;
      case 'KeyX': if (sh) renderHiRes(); break;
      default: break;
    }
  }, true);

  /* ---------------- the deterministic render (Version C's 4K; any version at 1080x1920) ---------------- */
  async function renderHiRes({ w = S.version === 'C' ? 2160 : 1080, h = S.version === 'C' ? 3840 : 1920 } = {}) {
    stop();
    if (S.version === 'C') captions();
    S.det = true;
    panel.rec(true);
    setSize(w, h, 1);
    const list = shotsOf();
    const total = list.reduce((a, s) => a + s.dur, 0);
    const heard = [];
    let i = -1, at = 0;
    // (what the real-time take plays of a shot's list: after its first frame, up to its end)
    const take = () => pup.sounds().filter((v) => v.t > 0 && v.t <= list[i].dur).map((v) => ({ ...v, t: v.t + at }));
    try {
      await renderDeterministic({
        name: S.version === 'C' ? 'hachi-C-4k' : `hachi-${S.version}-det`, w, h, fps: 60, total, canvas: out, sound,
        version: VERSIONS[S.version],
        // the pup's voice, rendered offline at the times its reactions ask (the same schedule the real-time take plays):
        // each shot's list is taken as it ends (shots add to it as they run), at the shot's place in the version
        voices: () => [...heard, ...take()],
        seek: (t) => {
            // the shot that owns time t, begun fresh when entered; stepped 1/60 s at a time
            let k = 0, a = 0;
            while (k < list.length - 1 && t >= a + list[k].dur) { a += list[k].dur; k++; }
            if (k !== i) { if (i >= 0) heard.push(...take()); end(); i = k; at = a; begin(list[k]); }
            const want = t - at;
            while (shot.t < want - 1e-6) step(Math.min(1 / 60, want - shot.t));
            render();
        },
        progress: (f, n) => panel.note(`rendering ${f}/${n}`),
      });
    } finally {
      end();
      setSize(OUT.w, OUT.h);
      S.det = false;
      panel.rec(false);
      panel.note('render done');
    }
  }

  /* ---------------- the panel ---------------- */
  const panel = makePanel({ onPick: (i) => { S.shotIndex = i; }, onVersion: (v) => { S.version = v; S.shotIndex = 0; stop(); panel.build(S); } });
  panel.build(S);

  /* ---------------- dev handles for the test scripts ---------------- */
  window.__director = {
    S, env, pup, han, VERSIONS, REACTIONS,
    /** Hold shot `id` at time t (stepped from its start at 1/60 s), and return the frame as a data URL. */
    async still(id, t, { w = OUT.w, h = OUT.h, type = 'image/jpeg', q = 0.9 } = {}) {
      stop();
      if (size.w !== w || size.h !== h) setSize(w, h);
      const v = Object.values(VERSIONS).find((vv) => vv.shots.some((s) => s.id === id));
      begin(v.shots.find((s) => s.id === id));
      while (shot.t < t - 1e-6) step(Math.min(1 / 60, t - shot.t));
      render();
      S.held = true;
      return out.toDataURL(type, q);
    },
    /** A reaction at a moment (the tester's orbit, stepped), as a data URL. */
    async reaction(name, u, { w = OUT.w, h = OUT.h, a0 = 0.3, r = 1.25, hgt = 0.28, fov = 40 } = {}) {
      tester(name);
      S.tester.rig = orbit(() => ({ x: pup.x, y: guide.ground(pup.x, pup.z), z: pup.z }), { r, h: hgt, deg: 0, a0, fov, lookY: 0.2 });
      const T = 0.4 + REACTIONS[name].dur * u;
      while (S.tester.t < T - 1e-6) { const d = Math.min(1 / 60, T - S.tester.t); S.tester.step(d); world.update(d, camera); }
      render();
      S.held = true;
      const url = out.toDataURL('image/jpeg', 0.9);
      S.tester = null;
      return url;
    },
    /** A free look (a debug view): camera at p looking at l. */
    peek(p, l, fov = 50) { stop(); place(camera, { p: { x: p[0], y: p[1], z: p[2] }, l: { x: l[0], y: l[1], z: l[2] }, fov }, {}); world.update(0, camera); render(); S.held = true; return out.toDataURL('image/jpeg', 0.85); },
    stop, play, record, renderHiRes, setSize, render, step, begin, end,
    get shot() { return shot; },
  };
  panel.note('Director Mode: V version, Enter play shot, P play all, Shift+P record, J reactions');
  return api;
}
