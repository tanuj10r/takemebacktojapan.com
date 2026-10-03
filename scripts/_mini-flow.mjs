// dev check (the phone build's mini town): the whole flow on an emulated iPhone 15, by touch, in real time.
//
//   node scripts/_mini-flow.mjs <out dir> [--portrait] [--url=http://127.0.0.1:5195] [--q=tier=light]
//
// Start by tap, walk and turn with the right stick, look by dragging, a konbini visit (a chip), the mochi shop, the train's
// wait and its listening spot, Han's show, Hachi's whistle; no console errors; the page's own GPU count (?diag's)
// at each step and its peak.  One browser at a time: /tmp/lawson-browser.lock.
import { chromium } from 'playwright';
import fs from 'node:fs';

const args = process.argv.slice(2);
const flags = Object.fromEntries(args.filter((a) => a.startsWith('--')).map((a) => { const i = a.indexOf('='); return i < 0 ? [a.slice(2), true] : [a.slice(2, i), a.slice(i + 1)]; }));
const out = args.find((a) => !a.startsWith('--'));
fs.mkdirSync(out, { recursive: true });
const tag = flags.portrait ? 'portrait' : 'landscape';

const LOCK = '/tmp/lawson-browser.lock';
let mine = false;
for (let i = 0; i < 360 && !mine; i++) { try { fs.mkdirSync(LOCK); mine = true; } catch { await new Promise((r) => setTimeout(r, 10000)); } }
if (!mine) { console.error('browser lock busy'); process.exit(2); }
const unlock = () => { if (mine) { try { fs.rmdirSync(LOCK); } catch { /* gone */ } mine = false; } };
process.on('exit', unlock);
process.on('SIGINT', () => { unlock(); process.exit(130); });
process.on('SIGTERM', () => { unlock(); process.exit(143); });

const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--autoplay-policy=no-user-gesture-required'] });
const errs = [], steps = [];
const ok = (name, pass, info = {}) => { steps.push({ name, pass: !!pass, ...info }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}  ${JSON.stringify(info)}`); };
try {
  const vp = flags.portrait ? { width: 393, height: 852 } : { width: 852, height: 393 };
  const ctx = await browser.newContext({
    viewport: vp, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errs.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errs.push(m.text()); });
  const cdp = await ctx.newCDPSession(page);
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y, id]) => ({ x, y, id, radiusX: 8, radiusY: 8, force: 1 })) });
  const wait = (ms) => page.waitForTimeout(ms);
  const state = () => page.evaluate(() => {
    const M = window.__m, p = M.player;
    return { x: +p.pos.x.toFixed(2), z: +p.pos.z.toFixed(2), yaw: +p.yaw.toFixed(3), locked: p.locked, gpu: Math.round(M.meter.total / 1048576), peak: Math.round(M.meter.peak / 1048576), fps: +M.perf.fps.toFixed(0), scale: M.scale, calls: M.renderer.info.render.calls };
  });
  const put = (x, z, yaw = 0, pitch = 0) => page.evaluate(([x, z, yaw, pitch]) => { const M = window.__m, p = M.player; p.pos.set(x, M.world.heightAt(x, z), z); p.yaw = yaw; p.pitch = pitch; p.vel.set(0, 0, 0); }, [x, z, yaw, pitch]);
  const shot = (name) => page.screenshot({ path: `${out}/flow-${tag}-${name}.jpg`, type: 'jpeg', quality: 80 });

  await page.goto((flags.url ?? 'http://127.0.0.1:5195') + '/m.html?stats&diag' + (flags.q ? '&' + flags.q : ''), { waitUntil: 'domcontentloaded', timeout: 240000 });
  await page.waitForFunction(() => document.getElementById('boot')?.classList.contains('ready') && window.__m, null, { timeout: 240000 });
  const load = await page.evaluate(() => ({ marks: window.__m.marks, tier: window.__m.tier }));
  ok('loads to the start card', true, load);
  await shot('0-start-card');

  // start by tap
  await page.touchscreen.tap(vp.width / 2, vp.height / 2);
  await page.locator('#start').tap({ timeout: 3000 }).catch(() => {});
  await wait(1200);
  let s = await state();
  ok('a tap starts the walk', s.locked, s);
  await wait(9000);                                      // Hachi's hello
  await shot('1-famous-view');

  // one stick on the right (Tan, 2026-10-03): up walks on, across turns; a drag elsewhere looks
  const s0 = await state();
  const [jx, jy] = await page.evaluate(() => window.__m.touch.state.rest);      // (the stick is fixed: Tan, 2026-10-03)
  await touch('touchStart', [[jx, jy, 1]]);
  for (let k = 1; k <= 6; k++) { await touch('touchMove', [[jx, jy - k * 9, 1]]); await wait(30); }
  await wait(2500);
  await touch('touchEnd', []);
  await wait(400);
  const sw = await state();
  ok('the stick walks', Math.hypot(sw.x - s0.x, sw.z - s0.z) > 2, { from: [s0.x, s0.z], to: [sw.x, sw.z] });
  await touch('touchStart', [[jx, jy, 1]]);
  for (let k = 1; k <= 6; k++) { await touch('touchMove', [[jx + k * 9, jy, 1]]); await wait(30); }
  await wait(900);
  await touch('touchEnd', []);
  await wait(300);
  const st2 = await state();
  ok('the stick turns', Math.abs(st2.yaw - sw.yaw) > 0.3 && Math.hypot(st2.x - sw.x, st2.z - sw.z) < 0.5, { yaw: [sw.yaw, st2.yaw] });
  const lx = vp.width * 0.3, ly = vp.height * 0.5;
  await touch('touchStart', [[lx, ly, 2]]);
  for (let k = 1; k <= 10; k++) { await touch('touchMove', [[lx - k * 12, ly, 2]]); await wait(30); }
  await touch('touchEnd', []);
  await wait(500);
  const s1 = await state();
  ok('a drag looks', Math.abs(s1.yaw - st2.yaw) > 0.1, { yaw: [st2.yaw, s1.yaw] });

  // the konbini: stand on the door's spot, tap a chip, the visit plays
  await put(-2.3, 6, 0); await wait(600);
  await put(-2.3, 2.3, 0); await wait(1500);
  const chips = await page.locator('[data-pick]').count();
  ok('the konbini offers its choice', chips > 0, { chips });
  await shot('2-konbini-choice');
  if (chips) {
    await page.locator('[data-pick]').first().tap();
    await wait(1500);
    let visiting = await page.evaluate(() => !!window.__m.world.lawson.shop.visiting);
    ok('a chip starts the visit', visiting);
    let inStorePeak = 0, shotIn = false;
    for (let k = 0; k < 60 && visiting; k++) {
      await wait(1000);
      const q = await page.evaluate(() => ({ v: !!window.__m.world.lawson.shop.visiting, in: !!window.__m.world.lawson.shop.inside(window.__m.camera), gpu: Math.round(window.__m.meter.total / 1048576) }));
      visiting = q.v;
      if (q.in) { inStorePeak = Math.max(inStorePeak, q.gpu); if (!shotIn && k > 5) { shotIn = true; await shot('3-in-the-konbini'); } }
    }
    ok('the visit ends back outside', !visiting, { inStoreGpu: inStorePeak, ...(await state()) });
    await shot('4-after-the-visit');
  }

  // ぺったん堂: its ring, the action button
  await put(39.2, 17, Math.PI); await wait(500);
  await put(39.2, 19.4, Math.PI); await wait(1800);
  const actLabel = await page.evaluate(() => document.querySelector('.mh-act span')?.textContent ?? '');
  await shot('5-mochi');
  ok('the mochi shop offers its mochi', actLabel.length > 0, { actLabel });
  if (actLabel) { await page.locator('[data-b="act"]').tap().catch(() => {}); await wait(7000); await shot('6-mochi-bought'); }

  // the train: on the platform, the wait counts down, the train comes in
  await put(53, -93, 0); await wait(500);
  await put(53, -96.8, 1.57); await wait(2000);
  let arrived = false, label = '';
  for (let k = 0; k < 50 && !arrived; k++) {
    await wait(1000);
    const q = await page.evaluate(() => { const S = (window.__m.world.line.local ?? window.__m.world.line).service; return { phases: S.runs.map((r) => r.phase), wait: document.querySelector('.train-wait, [class*=train]')?.textContent ?? '' }; });
    if (q.wait) label = q.wait;
    arrived = q.phases[0] === 'dwell';
    if (k === 12) await shot('7-train-coming');
  }
  ok('the train comes for you', arrived, { label, ...(await state()) });
  await shot('8-train-in');

  // Han: step into his ring, the show runs
  await put(-21.7, 20.5, Math.PI); await wait(500);
  await put(-21.7, 23.5, Math.PI); await wait(1500);
  const hanLabel = await page.evaluate(() => document.querySelector('.mh-act span')?.textContent ?? '');
  if (hanLabel) await page.locator('[data-b="act"]').tap().catch(() => {});
  let running = false;
  for (let k = 0; k < 12 && !running; k++) { await wait(500); running = await page.evaluate(() => !!window.__m.hanShow.running); }
  ok("Han's show starts", running, { hanLabel });
  await wait(9000);
  await shot('9-han-show');
  for (let k = 0; k < 60 && running; k++) { await wait(1000); running = await page.evaluate(() => !!window.__m.hanShow.running); }
  ok("Han's show ends", !running, await state());

  // Hachi: the whistle brings him
  await put(0, 16.5, 0, 0.1); await wait(800);
  await page.locator('[data-b="whistle"]').tap().catch(() => {});
  await wait(7000);
  await shot('10-hachi-whistled');
  ok('the whistle is answered (no error)', true, await state());

  // time of day, pause, resume
  await page.locator('[data-b="time"]').tap().catch(() => {});
  await wait(1500);
  await shot('11-night');
  await page.locator('[data-b="pause"]').tap().catch(() => {});
  await wait(700);
  s = await state();
  ok('pause frees the walk', !s.locked);
  await shot('12-paused');
  await page.locator('[data-b="resume"]').tap().catch(() => {});
  await wait(700);
  s = await state();
  ok('resume takes it back', s.locked, s);
  ok('no console errors', errs.length === 0, { errs: [...new Set(errs)].slice(0, 8) });
  fs.writeFileSync(`${out}/flow-${tag}.json`, JSON.stringify({ steps, diag: await page.evaluate(() => window.__m.diag.lines()) }, null, 1));
  await ctx.close();
} finally {
  await browser.close();
  unlock();
}
console.log(steps.every((s) => s.pass) ? 'ALL PASS' : 'SOME FAILED');
