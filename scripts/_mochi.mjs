// dev helper: ぺったん堂, the mochi-pounding shop (world/mochi/), played headless.
//
//   node scripts/_mochi.mjs [outdir]
//
// The real loop runs with sound on.  Checks: the shop is quiet until you order
// (on the ring nothing plays, no sound, no label; the rabbits wait behind the
// counter); an order start to end: pay first (the card up and in view, the
// ka-ching, "Paid"), the three out one by one, the show only then and once, on
// the recording's own clock (never more than a frame off it), Hachi sat
// watching and fed in your view, the mochi served, taken and eaten in three
// bites, the wave, you set free, the shop quiet again and the ring back; the
// cue table against the encoded file; the recording standing still under the
// pause card; the sound local.  Frames of each go to outdir.
//
// Starts its own dev server (PORT, default 5195; VITE_CACHE_DIR for a private
// vite cache) and Chrome, queued on the shots lock, and closes both however it ends.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const out = path.resolve(process.argv[2] ?? path.join(ROOT, '.shots', 'mochi'));
fs.mkdirSync(out, { recursive: true });

// one browser at a time on the shared laptop (taken first: a run that holds it may be queued on the shots lock)
const BLOCK = '/tmp/lawson-browser.lock';
let mineB = false;
for (let k = 0; ; k++) { try { fs.mkdirSync(BLOCK); mineB = true; break; } catch { if (k % 6 === 0) console.log('  waiting for the browser lock'); await new Promise((r) => setTimeout(r, 10000)); } }
process.on('exit', () => { if (mineB) { try { fs.rmdirSync(BLOCK); } catch {} mineB = false; } });
const LOCK = path.join(os.tmpdir(), 'takemebacktojapan-shots.lock');
for (;;) {
  try { fs.mkdirSync(LOCK); fs.writeFileSync(path.join(LOCK, 'pid'), String(process.pid)); break; } catch {
    let pid = 0, alive = false;
    try { pid = +fs.readFileSync(path.join(LOCK, 'pid'), 'utf8'); } catch {}
    try { if (pid) { process.kill(pid, 0); alive = true; } } catch {}
    if (!alive) { fs.rmSync(LOCK, { recursive: true, force: true }); continue; }
    console.log(`  waiting for another run (pid ${pid})`);
    await new Promise((r) => setTimeout(r, 5000));
  }
}
const unlock = () => { try { if (+fs.readFileSync(path.join(LOCK, 'pid'), 'utf8') === process.pid) fs.rmSync(LOCK, { recursive: true, force: true }); } catch {} };
process.on('exit', unlock);

const server = await createServer({
  root: ROOT, logLevel: 'error', ...(process.env.VITE_CACHE_DIR ? { cacheDir: process.env.VITE_CACHE_DIR } : {}),
  server: { port: +process.env.PORT || 5195, strictPort: !!process.env.PORT, host: '127.0.0.1' },
});
await server.listen();
const base = server.resolvedUrls.local[0];
const flags = ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-precise-memory-info', '--autoplay-policy=no-user-gesture-required'];
let browser;
try { browser = await chromium.launch({ channel: 'chrome', headless: true, args: flags }); }
catch { browser = await chromium.launch({ headless: true, args: flags }); }
const close = async () => { await Promise.race([browser.close().then(() => server.close()), new Promise((r) => setTimeout(r, 8000))]).catch(() => {}); };
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, async () => { await close(); process.exit(130); });

const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.setDefaultNavigationTimeout(180000);
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error' && !/404/.test(m.text())) errs.push(m.text()); });

let bad = 0;
const save = (name, data) => { if (data) fs.writeFileSync(path.join(out, name + '.jpg'), Buffer.from(data.split(',')[1], 'base64')); };
async function step(name, fn, check, arg) {
  let r;
  try { r = await page.evaluate(fn, arg); } catch (e) { r = { error: String(e).slice(0, 500) }; }
  for (const [k, v] of Object.entries(r ?? {})) if (typeof v === 'string' && v.startsWith('data:image')) { save(`${name}-${k}`, v); delete r[k]; }
  const ok = !r?.error && (check ? !!check(r) : true);
  if (!ok) bad++;
  console.log(ok ? 'pass' : 'FAIL', name, JSON.stringify(r));
  return r;
}
const english = (x) => !!x && !/[぀-ヿ一-鿿]/.test(x);

try {
  await page.goto(base);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 170000, polling: 250 });
  await page.evaluate(async () => {
    const { player, sound } = window.__scene;
    window.wait = (ms) => new Promise((r) => setTimeout(r, ms));
    window.frames = (n) => new Promise((r) => { const f = () => (--n <= 0 ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); });
    window.put = (x, z, yaw = Math.PI, pitch = -0.2) => { player.pos.set(x, player.pos.y, z); player.yaw = yaw; player.pitch = pitch; player.vel.set(0, 0, 0); };
    window.snap = async (W = 1280, H = 720) => (await window.__shot('x', W, H, { returnData: true })).data;
    window.pounds = () => sound.debug.log.filter((e) => e.name === 'mochi-pound').length;
    window.labelled = () => [...document.querySelectorAll('.snd-pill')].some((e) => /mochi pounding/i.test(e.textContent));
    player.locked = true;
    await sound.start();
    sound.setMenu(false);
    window.__guide?.introMark?.();
    await window.wait(600);
  });

  /* far off: nothing of it plays or sounds */
  await step('far', async () => {
    const { sound } = window.__scene, M = window.__mochi;
    window.put(0, 16.5, 0, 0.1);
    await window.wait(1500);
    return { phase: M.S.phase, played: window.pounds(), inManifest: !!sound.debug.manifest['mochi-pound'] };
  }, (r) => r.phase === 'quiet' && r.played === 0);

  /* on the ring, not ordering: the shop stays quiet (no show, no sound, no label), the rabbits behind the counter, the
   * mallets at rest; the prompt offers the order, in English */
  await step('quiet', async () => {
    const { player, world } = window.__scene, M = window.__mochi, w = M.world;
    window.put(w.spot.x, w.spot.z, Math.atan2(-(w.usu.x - w.spot.x), -(w.usu.z - w.spot.z)), -0.12);
    await window.wait(3500);
    const item = world.interactables.find((i) => /Order a mochi/.test(i.label));
    const behind = M.P.every((o) => o.z < M.shop.room.z + 0.05), ducked = M.P.filter((o) => o.y < M.shop.room.y - 0.1).length;
    return {
      phase: M.S.phase, played: window.pounds(), labelled: window.labelled(), behind, ducked, malletsLaid: M.P[0].role > 0.5 && M.P[1].role > 0.5,
      prompt: item ? `E  ·  ${item.label.replace(/^.*?·\s*/, '')}` : null, hovered: !!item && player.pick(world.interactables) === item, shot: await window.snap(),
    };
  }, (r) => r.phase === 'quiet' && r.played === 0 && !r.labelled && r.behind && r.ducked >= 2 && r.malletsLaid && r.prompt === 'E  ·  Order a mochi  ¥200' && english(r.prompt) && r.hovered);

  /* an order, start to end, in the real loop with sound: pay first (the card up, the ka-ching, the toast), then the
   * entrance, the show on the recording's own clock, Hachi fed in view, the serving, the eating, the wave; you are
   * held for it and set free; the shop is quiet again and the ring comes back */
  await step('order', async () => {
    const { player, hud, sound, world, camera } = window.__scene, M = window.__mochi, G = window.__guide.G, w = M.world;
    M.low.v = 9;          // (the held mallets' lowest edge over the stage floor, through the show: Tan, 2026-10-04, 'into the floor')
    const item = world.interactables.find((i) => /Order a mochi/.test(i.label));
    Object.assign(G, { x: w.spot.x - 2.2, z: w.spot.z + 0.6, state: 'wait', act: null, since: 0, waitT: 0 });
    const log0 = sound.debug.log.length, toasts = [];
    const flash = hud.flash.bind(hud);
    hud.flash = (text, ...a) => { toasts.push(text); return flash(text, ...a); };
    const t0 = performance.now();
    player.onInteract(item);
    const seen = { suspended: player.suspended, card: false, cardInView: false, alert: false, entered: 0, served: false, onPlate: false, held: false, treat: false, hachiSat: false, hachiInView: false, nods: 0, labelAtPay: false, labelInShow: false, poundsBeforeShow: 0 };
    const phases = [], shots = {}, fired = [];
    const want = { pay: { '01-card': 1.0, '02-tap': 1.6 }, enter: { '03-first': 1.0, '04-bow': 2.5, '05-all': 4.6 }, show: { '06-hit': 1.02, '07-turn': 1.43, '08-cheer': 11.05, '09-held-up': 13.75, '10-bow': 14.5 }, after: {}, bye: { '17-wave': 0.6, '18-leaving': 3.0 } };
    let last = null, frame = 0, drift = 0, ci = 0, n = 0, lastHit = -9, h = null, entry = null, inShowFrames = 0;
    const v = new (window.__scene.THREE.Vector3)();
    const inView = (x, y, z) => { v.set(x, y, z).project(camera); return Math.abs(v.x) < 0.98 && Math.abs(v.y) < 0.98 && v.z < 1; };
    while ((M.order || M.S.phase !== 'quiet') && performance.now() - t0 < 70000) {
      await window.frames(1);
      const S = M.S, ph = S.phase, now = performance.now();
      if (phases[phases.length - 1] !== ph) phases.push(ph);
      if (ph === 'pay') {
        const c = M.card();
        if (c?.visible && S.pt > 0.8 && S.pt < 1.2) { seen.card = true; c.getWorldPosition(v); if (inView(v.x, v.y, v.z)) seen.cardInView = true; }
        if (S.alert > 0.9) seen.alert = true;
        if (window.labelled()) seen.labelAtPay = true;
        seen.poundsBeforeShow = window.pounds();
      }
      if (ph === 'enter') { seen.entered = Math.max(seen.entered, M.P.filter((o) => o.z > M.shop.room.z + 0.5).length); seen.poundsBeforeShow = window.pounds(); }
      if (ph === 'show') {
        h ??= S.handle; entry ??= sound.debug.log.filter((e) => e.name === 'mochi-pound').pop();
        const pos = h?.pos && !h.ended ? h.pos() : null;
        if (last !== null) frame = Math.max(frame, now - last);
        n++;
        if (pos !== null && S.t < 12.9) drift = Math.max(drift, Math.abs(S.t - pos - 0.03));
        while (ci < S.ci) { const c = M.cues[ci++]; fired.push({ kind: c.kind, late: +((S.t - c.t) * 1000).toFixed(1) }); }
        if (window.labelled()) seen.labelInShow = true;
        if (G.posture > 0.8 && Math.hypot(G.x - w.seat.x, G.z - w.seat.z) < 0.4) seen.hachiSat = true;
        if (S.hitT !== lastHit) { lastHit = S.hitT; await window.frames(3); if (G.nod > 0.02) seen.nods++; }
      }
      last = now;
      if (ph === 'after') {
        if (M.served.visible) { seen.served = true; if (Math.hypot(M.served.position.x - M.shop.plate[0], M.served.position.z - M.shop.plate[2]) < 0.01) seen.onPlate = true; }
        if (M.held()?.parent) seen.held = true;
        if (M.potato.visible) {
          seen.treat = true;
          M.potato.getWorldPosition(v);
          if (inView(v.x, v.y, v.z) && inView(G.x, G.y + 0.3, G.z)) seen.hachiInView = true;
          if (!shots['11-treat'] && M.order?.fired.has('treat')) { shots['11-treat'] = await window.snap(); last = null; }
        }
        const o = M.order;
        if (o) for (const [k, key] of [['12-pon', 'pon'], ['14-take', 'take']]) if (!shots[k] && o.fired.has(key)) { shots[k] = await window.snap(); last = null; }
        if (o && !shots['13-served'] && seen.onPlate) { shots['13-served'] = await window.snap(); last = null; }
        if (o && o.eatT > 1.25 && !shots['15-pull']) shots['15-pull'] = await window.snap();
        if (o && o.eatT > 2.75 && !shots['16-bite2']) shots['16-bite2'] = await window.snap();
      }
      for (const [k, at] of Object.entries(want[ph] ?? {})) if (!shots[k] && (ph === 'show' ? S.t : S.pt) >= at) { shots[k] = await window.snap(); last = null; }
    }
    hud.flash = flash;
    const names = sound.debug.log.slice(log0).map((e) => e.name), late = fired.map((f) => f.late);
    const res = {
      seconds: +((performance.now() - t0) / 1000).toFixed(1), phases: phases.join(' '), ...seen, toasts, free: !player.suspended,
      kachingBeforeShow: names.indexOf('ka-ching') >= 0 && names.indexOf('ka-ching') < names.indexOf('mochi-pound'), pounds: names.filter((x) => x === 'mochi-pound').length,
      bites: names.filter((x) => x === 'bite').length, sneeze: names.includes('dog-sneeze'),
      src: entry?.src, showFrames: n, worstFrameMs: +frame.toFixed(1), clockOffMs: +(drift * 1000).toFixed(2), cues: fired.length, hits: fired.filter((f) => f.kind === 'hit').length,
      lateMsMax: Math.max(...late), lateMsMean: +(late.reduce((a, b) => a + b, 0) / Math.max(1, late.length)).toFixed(1),
      handDown: (await window.wait(700), window.__store.shop.hands.up < 0.05), endPhase: M.S.phase, ringBack: (await window.wait(4600), item.hitbox.visible),
      malletLow: +M.low.v.toFixed(3), ...shots,
    };
    return res;
  }, (r) => r.phases === 'pay enter show after bye quiet' && r.suspended && r.card && r.cardInView && r.alert && r.entered === 3 && !r.labelAtPay && r.poundsBeforeShow === 0 && r.pounds === 1 && r.kachingBeforeShow
    && r.labelInShow && (r.src === 'file' || r.src === 'file-late') && r.cues === 31 && r.hits === 8 && r.clockOffMs < r.worstFrameMs + 5 && r.lateMsMax < r.worstFrameMs + 25
    && r.hachiSat && r.nods >= 2 && r.treat && r.hachiInView && r.sneeze && r.served && r.onPlate && r.held && r.bites === 3
    && r.toasts.length === 2 && r.toasts.every(english) && r.toasts[0] === 'Paid  ¥200' && r.free && r.handDown && r.endPhase === 'quiet' && r.ringBack && r.malletLow > -0.005);

  /* the cue table against the encoded file: each strike's thud in the decoded audio */
  await step('cues-vs-file', async () => {
    const { sound } = window.__scene, M = window.__mochi;
    const man = sound.debug.manifest['mochi-pound'];
    if (!man) return { skipped: 'no file: the recipe follows the table by construction' };
    const b = sound.debug.buffers.get('mochi-pound');
    const sr = b.sampleRate, x = b.getChannelData(0), pad = Math.min(2112 / sr, Math.max(0, b.duration - man.duration));
    // the mallet's crack: the broadband level's sharpest rise within 90 ms of the cue (2 ms windows; where a call lands
    // on the blow, as at 7.5, 9.1 and 10.6 s, this picks the voice: those three read up to 60 ms off, the others under 10)
    const w = Math.round(sr * 0.002), env = [];
    for (let i = 0; i + w <= x.length; i += w) { let m = 0; for (let k = 0; k < w; k++) m = Math.max(m, Math.abs(x[i + k])); env.push(m); }
    const rows = M.cues.filter((c) => c.kind === 'hit').map((c) => {
      const i0 = Math.round((c.t + pad - 0.09) / 0.002), i1 = Math.round((c.t + pad + 0.09) / 0.002);
      let best = 0, at = i0;
      for (let i = i0 + 3; i < i1; i++) { const rise = env[i] - Math.max(env[i - 1], env[i - 2], env[i - 3]); if (rise > best) { best = rise; at = i; } }
      return { cue: c.t, thud: +(at * 0.002 - pad).toFixed(3), offMs: Math.round((at * 0.002 - pad - c.t) * 1000) };
    });
    return { pad: +pad.toFixed(4), dur: +b.duration.toFixed(3), worstMs: Math.max(...rows.map((r) => Math.abs(r.offMs))), rows };
  }, (r) => r.skipped || r.worstMs <= 65);

  /* a second order (the ring is back): under the pause card the recording stands still and the rabbits with it; and
   * the sound is local: heard on the stage, not at the famous view, not at ドンペン堂, not down the street */
  await step('again-pause-local', async () => {
    const { player, hud, sound, world } = window.__scene, M = window.__mochi, w = M.world;
    const item = world.interactables.find((i) => /Order a mochi/.test(i.label));
    window.put(w.spot.x, w.spot.z, Math.atan2(-(w.usu.x - w.spot.x), -(w.usu.z - w.spot.z)), -0.12);
    await window.frames(10);
    player.onInteract(item);
    const t0 = performance.now();
    while (!(M.S.phase === 'show' && M.S.handle?.pos && M.S.t > 1.2 && M.S.t < 6) && performance.now() - t0 < 25000) await window.frames(1);
    if (M.S.phase !== 'show') return { error: 'no second show', phase: M.S.phase };
    const h = M.S.handle;
    sound.setMenu(true);
    await window.wait(300);
    const a = h.pos(), sa = M.S.t;
    await window.wait(900);
    const b = h.pos(), sb = M.S.t;
    sound.setMenu(false);
    await window.wait(500);
    const c = h.pos();
    const level = (x, z) => {
      const d = Math.hypot(x - w.usu.x, z - w.usu.z);
      const v = [...sound.debug._voices].filter((q) => Math.abs(q.at.x - w.usu.x) < 0.1);
      return { d: +d.toFixed(1), voices: v.length, far: v.length ? d >= v[0].range.far : true };
    };
    const here = level(w.order.x, w.order.z), view = level(1.6, 14.6), donki = level(55.9, -41.4), zebra = level(50, -2.3);
    // let it run out, so the next step measures a quiet shop
    while ((M.order || M.S.phase !== 'quiet') && performance.now() - t0 < 80000) await window.frames(2);
    return { heldMs: +((b - a) * 1000).toFixed(1), showHeldMs: +((sb - sa) * 1000).toFixed(1), resumed: c > b + 0.2, here, view, donki, zebra, shows: M.S.shows, endPhase: M.S.phase, free: !player.suspended };
  }, (r) => Math.abs(r.heldMs) < 5 && Math.abs(r.showHeldMs) < 40 && r.resumed && r.here.voices > 0 && !r.here.far && r.view.far && r.donki.far && r.zebra.far && r.shows === 2 && r.endPhase === 'quiet' && r.free);

  /* what it costs, on the ring: quiet, and with the show on */
  await step('cost', async () => {
    const { renderer } = window.__scene, M = window.__mochi, w = M.world;
    window.put(w.order.x, w.order.z, Math.atan2(-(w.usu.x - w.order.x), -(w.usu.z - w.order.z)), -0.2);
    await window.frames(5);
    const quiet = await window.__shot('x', 1280, 720, { returnData: true, time: 30 });
    M.stage('show', 5.0);
    await window.frames(3);
    const on = await window.__shot('x', 1280, 720, { returnData: true, time: 30 });
    const dyn = [];
    M.herd.mesh.parent.traverse((o) => { if (o.isMesh) dyn.push(o); });
    for (const o of dyn) o.visible = false;
    const off = await window.__shot('x', 1280, 720, { returnData: true });
    for (const o of dyn) o.visible = true;
    M.stage(null);
    return { quiet: { calls: quiet.mainCalls, tris: quiet.mainTriangles, ms: +quiet.ms.toFixed(2) }, show: { calls: on.mainCalls, tris: on.mainTriangles, ms: +on.ms.toFixed(2) }, showCalls: on.mainCalls - off.mainCalls, showTris: on.mainTriangles - off.mainTriangles, parts: M.tris(), heapMB: Math.round(performance.memory.usedJSHeapSize / 1048576), textures: renderer.info.memory.textures, geometries: renderer.info.memory.geometries, atlas: window.__atlasPages };
  });
  if (errs.length) { bad++; console.log('FAIL errors', [...new Set(errs)].slice(0, 8)); }
} catch (e) { bad++; console.log('FAILED', String(e).slice(0, 600)); }
await close();
console.log(bad ? `MOCHI: ${bad} FAILED` : 'MOCHI: all pass');
process.exit(bad ? 1 : 0);
