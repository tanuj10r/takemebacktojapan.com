// dev: the gameplay promo: the real game (its own HUD, its own sound engine), played by a scripted player and recorded
// frame by frame: every frame is 1/60 s of the game's time however long the laptop takes over it, so the file is an
// exact 60 fps (scripts/_gameplay-vtime.js puts the page's clock, timers, animations and sound in our hands).  The
// picture is the tab itself (its canvas and its HTML), read back after each step; the cuts are made in the camera.
//
//   node scripts/_gameplay.mjs [--dry] [--only a,b] [--w 1920 --h 1080] [--mbps 16] [--out docs/promo/out/gameplay.mp4]
//
// --dry: nothing recorded (and so much quicker than real time): the timeline logged, stills to docs/promo/out/gameplay-dry.
import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const argv = process.argv.slice(2);
const flag = (n, d = null) => { const i = argv.indexOf('--' + n); return i < 0 ? d : argv[i + 1]; };
const DRY = argv.includes('--dry');
const MBPS = +flag('mbps', 16), SHARE_MBPS = +flag('share', 1.85);
const ONLY = flag('only')?.split(',') ?? null;
const W = +flag('w', 1920), H = +flag('h', 1080);
const OUT = path.resolve(flag('out', path.join(ROOT, 'docs', 'promo', 'out', `gameplay-${W}x${H}.mp4`)));
fs.mkdirSync(path.dirname(OUT), { recursive: true });

const LOCK = '/tmp/lawson-browser.lock';
let mine = false;
for (let i = 0; i < 360 && !mine; i++) { try { fs.mkdirSync(LOCK); mine = true; } catch { await new Promise((r) => setTimeout(r, 5000)); } }
const unlock = () => { if (mine) { try { fs.rmdirSync(LOCK); } catch { /* gone */ } mine = false; } };
process.on('exit', unlock);

const t00 = Date.now();
const log = (...a) => console.log(((Date.now() - t00) / 1000).toFixed(1).padStart(6), ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let server, browser;
try {
  server = await createServer({ root: ROOT, logLevel: 'error', server: { port: 5192, strictPort: true, host: '127.0.0.1' } });
  await server.listen();
  browser = await chromium.launch({
    channel: 'chrome', headless: true,
    args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', '--auto-accept-this-tab-capture', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', '--disable-background-timer-throttling'],
  });
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.setDefaultTimeout(600000);
  const errs = [];
  page.on('pageerror', (e) => { errs.push(String(e).slice(0, 300)); log('PAGE ERROR', String(e).slice(0, 300)); });
  await page.addInitScript({ path: path.join(ROOT, 'scripts', '_gameplay-vtime.js') });
  await page.goto('http://127.0.0.1:5192/');
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 180000 });

  /* ------------------------------ the player's hands (in the page) ------------------------------ */
  await page.evaluate(() => {
    const { player, world } = window.__scene, g = window.__guide;
    const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
    const S = { aim: null, k: 3.2, go: null, fwd: false, run: false, toasts: [] };
    const key = (code, down) => window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, bubbles: true }));
    const fwd = (on) => { if (on !== S.fwd) { S.fwd = on; key('ArrowUp', on); } };
    const run = (on) => { if (on !== S.run) { S.run = on; key('ShiftLeft', on); } };
    const pup = () => ({ x: g.G.x, z: g.G.z, y: (g.G.y ?? 0) });
    let last = performance.now(), fN = 0, fT = performance.now(), fps = 0, worst = 0;
    const tick = (now) => {
      fN++; worst = Math.max(worst, now - last); if (now - fT > 1000) { fps = Math.round(fN * 1000 / (now - fT)); S.fps = fps + '/' + Math.round(worst); fN = 0; fT = now; worst = 0; }
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (!player.scripted && !player.suspended && player.locked) {
        let t = typeof S.aim === 'function' ? S.aim(dt) : S.aim;
        if (t) {
          if (t.x !== undefined) { const dx = t.x - player.pos.x, dz = t.z - player.pos.z; t = { yaw: Math.atan2(-dx, -dz), pitch: Math.atan2((t.y ?? 1) - (player.pos.y + 1.6), Math.hypot(dx, dz)) + (t.up ?? 0) }; }
          // a hand on a mouse: eased, never faster than a comfortable turn
          const k = Math.min(1, dt * (t.k ?? S.k)), dy = wrap(t.yaw - player.yaw) * k, dp = (t.pitch - player.pitch) * k, m = (t.max ?? 2.2) * dt;
          player.yaw += Math.max(-m, Math.min(m, dy)); player.pitch += Math.max(-m, Math.min(m, dp));
        }
        const q = typeof S.go === 'function' ? S.go() : S.go;
        if (q) {
          const dx = q.x - player.pos.x, dz = q.z - player.pos.z, d = Math.hypot(dx, dz);
          if (d < (q.r ?? 0.5)) { fwd(false); if (typeof S.go !== 'function') { const f = q.done; S.go = null; f?.(); } }
          else { fwd(Math.abs(wrap(Math.atan2(-dx, -dz) - player.yaw)) < 0.75); run(!!q.run && d > 4); }
        } else { fwd(false); run(false); }
      } else { fwd(false); run(false); }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    const flash = window.__scene.hud.flash.bind(window.__scene.hud);
    window.__scene.hud.flash = (t, ...a) => { S.toasts.push(t); return flash(t, ...a); };
    window.GP = {
      S, pup, key,
      press: (code) => { key(code, true); setTimeout(() => key(code, false), 60); },
      /** walk to a spot, looking where you go (or at `look`) */
      walkTo: (x, z, { r = 0.5, run = false, look = null, max = 15 } = {}) => new Promise((ok) => { S.aim = look ?? { x, z, y: 1.35 }; S.go = { x, z, r, run, done: () => ok(true) }; setTimeout(() => { if (S.go?.x === x && S.go?.z === z) { S.go = null; ok(false); } }, max * 1000); }),
      /** follow the pup the way it went (its own trail: it keeps to free ground), to within `r` m of it, eyes on it */
      follow: ({ r = 3.0, up = 0.12, run = false } = {}) => {
        const trail = []; let lastP = null;
        const step = () => {
          const p = pup();
          if (!lastP || Math.hypot(p.x - lastP.x, p.z - lastP.z) > 0.6) { trail.push({ x: p.x, z: p.z }); lastP = p; }
          // the trail from the crumb nearest you on (one passed a little to the side is behind you, not a place to turn back to)
          let near = 0, nd = 1e9;
          for (let i = 0; i < trail.length; i++) { const q = Math.hypot(trail[i].x - player.pos.x, trail[i].z - player.pos.z); if (q <= nd) { nd = q; near = i; } }
          trail.splice(0, near);
          // (in plain sight and near: straight to him; else a few crumbs ahead of where you are on it)
          const d = Math.hypot(p.x - player.pos.x, p.z - player.pos.z);
          return { p, d, to: d < 5 || trail.length < 2 ? p : trail[Math.min(trail.length - 1, 4)] };
        };
        S.aim = () => { const q = step(); return { yaw: Math.atan2(-(q.to.x - player.pos.x), -(q.to.z - player.pos.z)), pitch: Math.atan2(q.p.y + 0.3 - (player.pos.y + 1.6), Math.max(2.5, q.d)) + up }; };
        S.go = () => { const q = step(); return q.d < r ? { x: q.p.x, z: q.p.z, r: 1e9 } : { x: q.to.x, z: q.to.z, r: 0.2, run }; };
      },
      /** stand and look at the pup */
      watch: ({ up = 0.1 } = {}) => { S.go = null; S.aim = () => { const p = pup(); return { x: p.x, z: p.z, y: p.y + 0.3, up }; }; },
      look: (t) => { S.go = null; S.aim = t; },
      /** a slow pan from yaw a to yaw b at a pitch over `sec` */
      pan: (a, b, pitch, sec) => new Promise((ok) => { S.go = null; const t0 = performance.now(); S.aim = () => { const u = Math.min(1, (performance.now() - t0) / 1000 / sec), e = u * u * (3 - 2 * u); if (u >= 1) setTimeout(ok, 0); return { yaw: a + wrap(b - a) * e, pitch, k: 8, max: 3 }; }; }),
      free: () => { S.go = null; S.aim = null; },
      put: (x, z, yaw, pitch = 0) => { player.pos.set(x, world.heightAt(x, z), z); player.vel.set(0, 0, 0); player.yaw = yaw; player.pitch = pitch; },
      state: () => { const s = g.state(), v = window.__store.shop?.debug?.visit?.(); return { fps: S.fps, st: s.state, leg: s.leg, tgt: s.target, act: s.act, pup: [s.x, s.z], me: [+player.pos.x.toFixed(1), +player.pos.z.toFixed(1)], d: +Math.hypot(player.pos.x - s.x, player.pos.z - s.z).toFixed(1), visit: v?.active ? (v.cur?.label ?? v.cur?.kind ?? '-') + '@' + v.t.toFixed(1) : null, fx: g.fx?.name?.() ?? g.fx?.cur?.name ?? null, toasts: S.toasts.splice(0) }; },
    };
  });
  const st = () => page.evaluate(() => window.GP.state());
  const SHOTS = path.join(path.dirname(OUT), 'gameplay-dry'); if (DRY) fs.mkdirSync(SHOTS, { recursive: true });
  const snap = async (name) => { if (DRY) await page.screenshot({ path: path.join(SHOTS, name + '.jpg'), type: 'jpeg', quality: 70 }); };
  const gp = (fn, arg) => page.evaluate(fn, arg);
  const vnow = () => page.evaluate(() => window.VT.t / 1000);
  /** wait `sec` of the game's time */
  async function vsleep(sec) { const t1 = (await vnow()) + sec; while ((await vnow()) < t1) await sleep(25); }
  /** wait (logging the state every `every` s of the game's time) until cond(state) or `max` s */
  async function until(name, cond, max = 60, every = 1) {
    const t0 = await vnow(); let s, lastLog = t0;
    for (;;) {
      s = await st();
      const el = (await vnow()) - t0;
      if (cond(s, el)) { log(`  ${name}: yes after ${el.toFixed(1)} s`, JSON.stringify(s)); return s; }
      if (el > max) { log(`  ${name}: GAVE UP after ${max} s`, JSON.stringify(s)); return s; }
      if (t0 + el - lastLog >= every) { lastLog = t0 + el; log('   ', JSON.stringify(s)); }
      await sleep(40);
    }
  }

  /* ------------------------------ the recorder: the game stepped a frame at a time, each frame read back and encoded ------------------------------ */
  await page.evaluate(() => {
    const VT = window.VT, R = VT.real;
    const C = { on: false, rec: false, capture: false, frame: 0, out: 0, keep: [], chunks: [], vConfig: null, latest: null, latestAt: 0, got: 0, stale: 0, done: null, enc: null };
    const wait = (ms) => new Promise((r) => R.setTimeout(r, ms));
    async function loop() {
      while (C.on) {
        VT.step(1000 / 60);
        await VT.audioTo((C.frame + 1) / 60);
        C.frame++;
        if (C.rec && C.capture) {
          /* the step's picture: the tab hands a frame over only when something on it has changed, a frame or two
           * after it was drawn.  So: the first frame to arrive a screen refresh or more after the step, then a
           * moment's grace for a later one (the one before may have been on its way already); if none comes, nothing
           * moved, and the frame before is this one too. */
          const tR = R.now(), g0 = C.got;
          await new Promise((r) => R.raf(r));
          while (R.now() - tR < 130 && !(C.got > g0 && C.latestAt >= tR + 18)) await wait(2);
          if (C.got > g0) { const g1 = C.got, t1 = R.now(); while (R.now() - t1 < 26 && C.got === g1) await wait(2); } else C.stale++;
          const f = new VideoFrame(C.latest, { timestamp: Math.round(C.out * 1e6 / 60), duration: Math.round(1e6 / 60) });
          C.enc.encode(f, { keyFrame: C.out % 120 === 0 });
          C.g2.drawImage(f, 0, 0, C.cv2.width, C.cv2.height);
          const f2 = new VideoFrame(C.cv2, { timestamp: f.timestamp, duration: f.duration });
          C.enc2.encode(f2, { keyFrame: C.out % 120 === 0 }); f2.close();
          f.close(); C.out++;
          while (C.enc.encodeQueueSize > 4 || C.enc2.encodeQueueSize > 4) await wait(2);
        } else if (C.frame % 6 === 0) await wait(0);
      }
    }
    window.CAP = {
      C,
      async start(w, h, bitrate, capture, shareBps) {
        C.capture = capture;
        if (capture) {
          const stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 60, width: w, height: h, cursor: 'never' }, audio: false, preferCurrentTab: true, selfBrowserSurface: 'include' });
          C.stream = stream;
          const reader = new MediaStreamTrackProcessor({ track: stream.getVideoTracks()[0] }).readable.getReader();
          (async () => { for (;;) { const { value, done } = await reader.read(); if (done) break; C.latest?.close(); C.latest = value; C.latestAt = R.now(); C.got++; } })();
          while (!C.latest) await wait(10);
          C.size = [C.latest.displayWidth, C.latest.displayHeight];
          C.enc = new VideoEncoder({ output: (c, meta) => { const b = new Uint8Array(c.byteLength); c.copyTo(b); C.chunks.push({ data: b, ts: c.timestamp, dur: c.duration, key: c.type === 'key' }); if (meta?.decoderConfig) C.vConfig = meta.decoderConfig; }, error: (e) => { C.err = String(e); } });
          C.enc.configure({ codec: 'avc1.64002A', width: C.size[0], height: C.size[1], bitrate, framerate: 60, avc: { format: 'avc' }, latencyMode: 'quality', bitrateMode: 'variable' });
        }
        if (capture) {
          // (the share copy: the same frames at 1280 wide and a bit rate a phone will take)
          const k = 1280 / C.size[0]; C.cv2 = new OffscreenCanvas(1280, Math.round(C.size[1] * k / 2) * 2); C.g2 = C.cv2.getContext('2d'); C.g2.imageSmoothingQuality = 'high'; C.chunks2 = [];
          C.enc2 = new VideoEncoder({ output: (c, meta) => { const b = new Uint8Array(c.byteLength); c.copyTo(b); C.chunks2.push({ data: b, ts: c.timestamp, dur: c.duration, key: c.type === 'key' }); if (meta?.decoderConfig) C.vConfig2 = meta.decoderConfig; }, error: (e) => { C.err = String(e); } });
          C.enc2.configure({ codec: 'avc1.640020', width: C.cv2.width, height: C.cv2.height, bitrate: shareBps, framerate: 60, avc: { format: 'avc' }, latencyMode: 'quality', bitrateMode: 'variable' });
        }
        C.on = true; C.rec = true; C.keep.push([0, null]);
        C.done = loop();
        return { size: C.size ?? null, audio: !!VT.audio };
      },
      rec(on) { if (on === C.rec) return; C.rec = on; const t = C.frame / 60; if (on) C.keep.push([t, null]); else C.keep[C.keep.length - 1][1] = t; },
      async stop() {
        C.on = false; await C.done;
        if (C.rec) C.keep[C.keep.length - 1][1] = C.frame / 60;
        if (!C.capture) return { frames: C.frame, keep: C.keep };
        await C.enc.flush(); C.enc.close(); await C.enc2.flush(); C.enc2.close();
        C.stream.getTracks().forEach((t) => t.stop());
        // the sound: the kept stretches end to end (a few ms of fade at each join), levelled, AAC
        const { muxMP4 } = await import('/src/director/record.js'), { normalise } = await import('/src/director/loudness.js');
        const buf = await VT.audioEnd(), sr = buf.sampleRate, A = [buf.getChannelData(0), buf.getChannelData(1)];
        const n = C.keep.reduce((a, [x, y]) => a + Math.round((y - x) * sr), 0), L = new Float32Array(n), Rr = new Float32Array(n), F = Math.round(0.012 * sr);
        let o = 0;
        for (const [x, y] of C.keep) {
          const i0 = Math.round(x * sr), len = Math.round((y - x) * sr);
          for (let i = 0; i < len; i++) { const g = Math.min(1, i / F, (len - 1 - i) / F); L[o + i] = A[0][i0 + i] * g; Rr[o + i] = A[1][i0 + i] * g; }
          o += len;
        }
        const loud = normalise([L, Rr], sr, { target: -16, ceil: -1.5 });
        const chunksA = []; let aConfig = null;
        const aenc = new AudioEncoder({ output: (c, meta) => { const b = new Uint8Array(c.byteLength); c.copyTo(b); chunksA.push({ data: b, ts: c.timestamp, dur: c.duration }); if (meta?.decoderConfig) aConfig = meta.decoderConfig; }, error: (e) => { C.err = String(e); } });
        aenc.configure({ codec: 'mp4a.40.2', sampleRate: sr, numberOfChannels: 2, bitrate: 192000 });
        for (let i = 0; i < n; i += 1024) {
          const k = Math.min(1024, n - i), data = new Float32Array(k * 2);
          data.set(L.subarray(i, i + k), 0); data.set(Rr.subarray(i, i + k), k);
          const ad = new AudioData({ format: 'f32-planar', sampleRate: sr, numberOfFrames: k, numberOfChannels: 2, timestamp: Math.round(i * 1e6 / sr), data });
          aenc.encode(ad); ad.close();
        }
        await aenc.flush(); aenc.close();
        const file = muxMP4({ w: C.size[0], h: C.size[1], fps: 60, video: C.chunks, vConfig: C.vConfig, audio: chunksA, aConfig, acodec: 'mp4a.40.2', sr });
        window.__recBlob = new Blob([file], { type: 'video/mp4' });
        window.__recBlob2 = new Blob([muxMP4({ w: C.cv2.width, h: C.cv2.height, fps: 60, video: C.chunks2, vConfig: C.vConfig2, audio: chunksA, aConfig, acodec: 'mp4a.40.2', sr })], { type: 'video/mp4' });
        return { bytes: window.__recBlob.size, bytes2: window.__recBlob2.size, frames: C.out, gameFrames: C.frame, stale: C.stale, keep: C.keep.map(([x, y]) => [+x.toFixed(2), +y.toFixed(2)]), loud, err: C.err ?? null };
      },
    };
  });
  const REC = {
    /** from here the clock is ours: the first click (the song starts, and the tab may be read), then the take */
    async start() {
      await gp(() => window.VT.manual());
      await page.mouse.move(W * 0.3, H * 0.3);
      await page.mouse.click(W * 0.3, H * 0.3);
      log('recording', JSON.stringify(await gp(([w, h, b, cap, s]) => window.CAP.start(w, h, b, cap, s), [W, H, MBPS * 1e6, !DRY, SHARE_MBPS * 1e6])));
    },
    pause: () => { log('--- cut (out)'); return gp(() => window.CAP.rec(false)); },
    resume: () => { log('--- cut (in)'); return gp(() => window.CAP.rec(true)); },
    async stop() {
      const r = await gp(() => window.CAP.stop());
      log('take', JSON.stringify(r));
      if (DRY) return;
      for (const [name, blob, bytes] of [[OUT, '__recBlob', r.bytes], [OUT.replace(/\.mp4$/, '-share.mp4'), '__recBlob2', r.bytes2]]) {
        const f = fs.openSync(name, 'w');
        for (let o = 0; o < bytes; o += 4 << 20) {
          const b64 = await gp(async ([blob, a, z]) => { const u = new Uint8Array(await window[blob].slice(a, z).arrayBuffer()); let s = ''; for (let i = 0; i < u.length; i += 32768) s += String.fromCharCode(...u.subarray(i, i + 32768)); return btoa(s); }, [blob, o, Math.min(bytes, o + (4 << 20))]);
          fs.writeSync(f, Buffer.from(b64, 'base64'));
        }
        fs.closeSync(f);
        log('saved', name, (bytes / 1048576).toFixed(1) + ' MB');
      }
    },
  };

  const { default: scenes } = await import('./_gameplay-scenes.mjs');
  await scenes({ page, gp, st, until, log, sleep: vsleep, REC, DRY, ONLY, W, H, snap });
  await REC.stop();
  log('done; page errors:', JSON.stringify(errs.slice(0, 5)));
} finally { await browser?.close(); await server?.close(); unlock(); }
