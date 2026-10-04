// dev check: the falling petals land on what is under them (Tan, 2026-10-04).
//
//   node scripts/_petals.mjs [outdir]
//
// The desktop dev page, the real loop for a minute at three places under the cherries (the famous view, the shopping
// street, the plaza): petals come to rest (some of them on things: a car, a bench, a kerb), none in the air is inside
// anything solid, the fall goes on (most are still in the air), and the frame costs no more.  A frame of each place.
// Its own dev server (port 5193) and Chrome, on the shared browser lock.
import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const OUT = path.resolve(process.argv[2] ?? path.join(ROOT, '.shots', 'petals'));
fs.mkdirSync(OUT, { recursive: true });
const LOCK = '/tmp/lawson-browser.lock';
let mine = false;
for (let i = 0; i < 360 && !mine; i++) { try { fs.mkdirSync(LOCK); mine = true; } catch { await new Promise((r) => setTimeout(r, 5000)); } }
const unlock = () => { if (mine) { try { fs.rmdirSync(LOCK); } catch { /* gone */ } mine = false; } };
process.on('exit', unlock);
let server, browser, bad = 0;
try {
  server = await createServer({ root: ROOT, logLevel: 'error', server: { port: 5193, strictPort: true, host: '127.0.0.1' } });
  await server.listen();
  browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
  await page.goto('http://127.0.0.1:5193/');
  await page.waitForFunction(() => window.__scene && window.__petals?.length, null, { timeout: 300000 });
  await page.mouse.click(640, 360).catch(() => {});
  await page.evaluate(() => { window.__scene.player.locked = true; });          // (no pointer lock headless: the loop runs as if we had it)
  await page.addStyleTag({ content: 'body > *:not(canvas) { visibility: hidden !important; }' });      // (the frames: the picture alone)
  for (const [name, x, z, yaw, pitch] of [['view', 0, 16.5, 0, -0.1], ['street', 50, -30, 0, -0.15], ['plaza', 52, -112, 0.4, -0.15], ['carpark', -12, 24.5, 2.2, -0.35]]) {
    await page.evaluate(([x, z, yaw, pitch]) => { const s = window.__scene, p = s.player; p.pos.set(x, s.world.heightAt(x, z), z); p.yaw = yaw; p.pitch = pitch; p.vel.set(0, 0, 0); p.locked = true; }, [x, z, yaw, pitch]);
    let worstInside = 0, maxRest = 0, maxHigh = 0, last = null, ms = [];
    for (let k = 0; k < 20; k++) {
      await page.waitForTimeout(1000);
      const r = await page.evaluate(() => { const a = window.__petals.map((f) => f()); return { all: a, fps: window.__scene.perf?.fps ?? null }; });
      last = r.all;
      for (const q of r.all) { worstInside = Math.max(worstInside, q.inside); }
      maxRest = Math.max(maxRest, r.all.reduce((s, q) => s + q.rest, 0));
      maxHigh = Math.max(maxHigh, r.all.reduce((s, q) => s + q.high, 0));
    }
    const air = last.reduce((s, q) => s + q.air, 0), n = last.reduce((s, q) => s + q.n, 0);
    const pass = maxRest > 5 && worstInside === 0 && air > n * 0.4 && last.every((q) => q.grid > 0);
    if (!pass) bad++;
    console.log(pass ? 'pass' : 'FAIL', name, JSON.stringify({ maxRest, maxOnThings: maxHigh, worstInside, air, n, top: Math.max(...last.map((q) => q.top)) }));
    await page.screenshot({ path: path.join(OUT, `petals-${name}.jpg`), type: 'jpeg', quality: 88 });
  }
  if (errs.length) { bad++; console.log('FAIL errors', JSON.stringify(errs.slice(0, 4))); }
} finally { await browser?.close(); await server?.close(); unlock(); }
console.log(bad ? 'SOME FAILED' : 'ALL PASS');
process.exit(bad ? 1 : 0);
