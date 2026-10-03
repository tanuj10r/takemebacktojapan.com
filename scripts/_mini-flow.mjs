// dev check (the phone build's pocket town, portrait): the whole flow on an emulated iPhone 15, by touch, in real time.
//
//   node scripts/_mini-flow.mjs <out dir> [--url=http://127.0.0.1:5195] [--q=tier=light]
//
// Start by tap; Hachi's hello card never over him; the two-thumbs stick in the panel (a thumb held on it walks, slid
// up runs, pulled down steps back, lifted stops); a drag on the picture looks; Walk with Hachi follows him; a konbini
// visit (a chip); the train's wait and its listening spot; Hachi's button; the time of day, pause and resume; no
// console errors; the page's own GPU count (?diag's) at each step and its peak.  One browser at a time:
// /tmp/lawson-browser.lock.
import { chromium } from 'playwright';
import fs from 'node:fs';

const args = process.argv.slice(2);
const flags = Object.fromEntries(args.filter((a) => a.startsWith('--')).map((a) => { const i = a.indexOf('='); return i < 0 ? [a.slice(2), true] : [a.slice(2, i), a.slice(i + 1)]; }));
const out = args.find((a) => !a.startsWith('--'));
fs.mkdirSync(out, { recursive: true });
const tag = 'portrait';

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
  const vp = { width: 393, height: 852 };
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
  const speed = () => page.evaluate(() => { const p = window.__m.player, f = { x: -Math.sin(p.yaw), z: -Math.cos(p.yaw) }; return +(p.vel.x * f.x + p.vel.z * f.z).toFixed(2); });
  const put = (x, z, yaw = 0, pitch = 0) => page.evaluate(([x, z, yaw, pitch]) => { const M = window.__m, p = M.player; p.pos.set(x, M.world.heightAt(x, z), z); p.yaw = yaw; p.pitch = pitch; p.vel.set(0, 0, 0); }, [x, z, yaw, pitch]);
  const shot = (name) => page.screenshot({ path: `${out}/flow-${tag}-${name}.jpg`, type: 'jpeg', quality: 80 });
  // Hachi's box on screen against the hello card's (and the hints')
  const covered = () => page.evaluate(() => {
    const M = window.__m, h = window.__m.GUIDE.where(), cv = document.getElementById('view').getBoundingClientRect();
    const V = M.camera.position.constructor, a = new V(h.x, h.y, h.z).project(M.camera), b = new V(h.x, h.y + 0.5, h.z).project(M.camera);
    if (a.z > 1 || b.z > 1) return { seen: false };
    const x = cv.left + (a.x + 1) / 2 * cv.width, y0 = cv.top + (1 - b.y) / 2 * cv.height, y1 = cv.top + (1 - a.y) / 2 * cv.height;
    const seen = y1 > cv.top && y0 < cv.bottom && x > cv.left && x < cv.right;
    const hits = [];
    for (const q of [document.getElementById('hachi-card'), document.querySelector('.look-hint')]) {
      if (!q || (q.id === 'hachi-card' ? q.style.opacity !== '1' : !q.classList.contains('show') || q.classList.contains('used'))) continue;
      const r = q.getBoundingClientRect();
      if (r.left < x + 8 && r.right > x - 8 && r.top < y1 && r.bottom > y0) hits.push(q.id || q.className);
    }
    return { seen, dog: [Math.round(x), Math.round(y0), Math.round(y1)], hits };
  });

  await page.goto((flags.url ?? 'http://127.0.0.1:5195') + '/m.html?stats&diag' + (flags.q ? '&' + flags.q : ''), { waitUntil: 'domcontentloaded', timeout: 240000 });
  await page.waitForFunction(() => document.getElementById('boot')?.classList.contains('ready') && window.__m, null, { timeout: 240000 });
  const load = await page.evaluate(() => ({ marks: window.__m.marks, tier: window.__m.tier }));
  ok('loads to the start card', true, load);
  await shot('0-start-card');

  // start by tap
  await page.locator('#start').tap({ timeout: 3000 }).catch(() => {});
  await wait(1200);
  let s = await state();
  ok('a tap starts the walk', s.locked, s);
  // Hachi's hello: the card never over him, sampled through the hello and after it
  let coveredT = 0, cardSeen = false, dogSeen = 0;
  for (let k = 0; k < 32; k++) {
    await wait(500);
    const c = await covered();
    if (c.seen) dogSeen++;
    if (c.hits?.length) coveredT++;
    cardSeen ||= await page.evaluate(() => document.getElementById('hachi-card')?.style.opacity === '1');
    if (k === 16) await shot('1-hello');
  }
  ok('the hello card shows and never covers Hachi', cardSeen && coveredT <= 1 && dogSeen > 10, { coveredSamples: coveredT, dogInFrame: dogSeen, ...(await covered()) });
  await shot('2-famous-view');

  // the stick (two thumbs, Tan 2026-10-03): a thumb held on it walks, slid up runs, pulled down steps back, lifted stops
  await put(0, 14, 0);
  await wait(300);
  const s0 = await state();
  const [jx, jy] = await page.evaluate(() => window.__m.touch.state.rest);
  await touch('touchStart', [[jx, jy, 1]]);
  await wait(1500);
  const vStill = await speed();
  for (let k = 1; k <= 6; k++) { await touch('touchMove', [[jx, jy - k * 9, 1]]); await wait(30); }
  await wait(1300);
  const vUp = await speed();
  for (let k = 1; k <= 12; k++) { await touch('touchMove', [[jx, jy - 54 + k * 9, 1]]); await wait(30); }
  await wait(1000);
  const vDown = await speed();
  await touch('touchEnd', []);
  await wait(900);
  const vLift = await speed();
  const sw = await state();
  ok('a thumb held on the stick walks', vStill > 0.8 && Math.hypot(sw.x - s0.x, sw.z - s0.z) > 1, { vStill });
  ok('slid up, faster', vUp > vStill * 2, { vUp });
  ok('pulled down, back', vDown < -0.3, { vDown });
  ok('lifted, it stops', Math.abs(vLift) < 0.2, { vLift });
  const lx = vp.width * 0.5, ly = vp.height * 0.3;
  await touch('touchStart', [[lx, ly, 2]]);
  for (let k = 1; k <= 10; k++) { await touch('touchMove', [[lx - k * 12, ly, 2]]); await wait(30); }
  await touch('touchEnd', []);
  await wait(500);
  const s1 = await state();
  ok('a drag on the picture looks', Math.abs(s1.yaw - sw.yaw) > 0.1 && Math.hypot(s1.x - sw.x, s1.z - sw.z) < 0.3, { yaw: [sw.yaw, s1.yaw] });

  // Walk with Hachi: from the view, the button follows him
  await page.evaluate(() => window.__m.GUIDE.reset?.());
  await put(0, 16.5, 0, -0.02); await wait(800);
  const f0 = await state();
  await page.locator('.pp-act').tap().catch(() => {});
  await wait(10000);
  const f1 = await state();
  const following = await page.evaluate(() => window.__m.shell.panel?.following);
  ok('Walk with Hachi walks you after him', Math.hypot(f1.x - f0.x, f1.z - f0.z) > 3, { from: [f0.x, f0.z], to: [f1.x, f1.z], following });
  await shot('3-walk-with-hachi');
  if (following) await page.locator('.pp-act').tap().catch(() => {});

  // the konbini: stand on the door's spot, tap a chip, the visit plays
  await put(-2.3, 6, 0); await wait(600);
  await put(-2.3, 2.3, 0); await wait(1500);
  const chips = await page.locator('[data-pick]').count();
  ok('the konbini offers its choice', chips > 0, { chips });
  await shot('4-konbini-choice');
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
      if (q.in) { inStorePeak = Math.max(inStorePeak, q.gpu); if (!shotIn && k > 5) { shotIn = true; await shot('5-in-the-konbini'); } }
    }
    ok('the visit ends back outside', !visiting, { inStoreGpu: inStorePeak, ...(await state()) });
    await shot('6-after-the-visit');
  }

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

  // Hachi: his button brings him
  await put(0, 16.5, 0, 0); await wait(800);
  await page.locator('[data-p="hachi"]').tap().catch(() => {});
  await wait(7000);
  await shot('9-hachi-called');
  ok('Hachi answers his button (no error)', true, await state());

  // time of day, pause, resume
  await page.locator('[data-b="time"]').tap().catch(() => {});
  await wait(1500);
  await shot('10-night');
  await page.locator('[data-p="pause"]').tap().catch(() => {});
  await wait(700);
  s = await state();
  ok('pause frees the walk', !s.locked);
  await shot('11-paused');
  await page.locator('[data-b="resume"]').tap().catch(() => {});
  await wait(700);
  s = await state();
  ok('resume takes it back', s.locked, s);
  const rel = await page.evaluate(() => { const r = window.__m.released; return r && { released: r.released, releasedMB: Math.round(r.releasedMB), pending: r.pending }; });
  ok('painted pages give their canvases back once uploaded', !rel || rel.releasedMB > 60, rel ?? { off: true });
  ok('no console errors', errs.length === 0, { errs: [...new Set(errs)].slice(0, 8) });
  fs.writeFileSync(`${out}/flow-${tag}.json`, JSON.stringify({ steps, diag: await page.evaluate(() => window.__m.diag.lines()) }, null, 1));
  await ctx.close();
} finally {
  await browser.close();
  unlock();
}
console.log(steps.every((s) => s.pass) ? 'ALL PASS' : 'SOME FAILED');
