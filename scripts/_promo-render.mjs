// dev: render a promo video with Director Mode's frame-by-frame renderer (src/director/, ?director) and save the file.
//
//   node scripts/_promo-render.mjs <version A|C> <width> <height> [Mbps]
//
// Exactly 60 fps whatever the laptop is doing (each frame is drawn, then encoded), H.264 + AAC in an MP4, the words
// burned in (overlay.js).  Its own dev server (port 5192) and headless Chrome, on the shared browser lock.
import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const [version = 'C', w = '1080', h = '1920', mbps = ''] = process.argv.slice(2);      // (mbps: the video's bit rate; blank: 20 at 1080, 45 at 4K)
const OUT = path.resolve(path.join(ROOT, 'docs', 'promo', 'out'));
fs.mkdirSync(OUT, { recursive: true });
const LOCK = '/tmp/lawson-browser.lock';
let mine = false;
for (let i = 0; i < 360 && !mine; i++) { try { fs.mkdirSync(LOCK); mine = true; } catch { await new Promise((r) => setTimeout(r, 5000)); } }
const unlock = () => { if (mine) { try { fs.rmdirSync(LOCK); } catch { /* gone */ } mine = false; } };
process.on('exit', unlock);
let server, browser;
try {
  server = await createServer({ root: ROOT, logLevel: 'error', server: { port: 5192, strictPort: true, host: '127.0.0.1' } });
  await server.listen();
  browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--autoplay-policy=no-user-gesture-required', '--enable-features=PlatformHEVCEncoderSupport'] });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 }, acceptDownloads: true });
  const page = await ctx.newPage();
  page.setDefaultTimeout(1800000);
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e.stack ?? e).slice(0, 400)));
  const saved = [];
  page.on('download', async (d) => { const f = path.join(OUT, d.suggestedFilename()); await d.saveAs(f); saved.push(f); console.log('saved', f, (fs.statSync(f).size / 1048576).toFixed(1) + ' MB'); });
  await page.goto('http://127.0.0.1:5192/?director');
  await page.waitForFunction(() => window.__director, null, { timeout: 300000 });
  await page.mouse.click(700, 500);                        // (a gesture: the sound engine's context)
  await page.waitForTimeout(3000);
  await document_fonts(page);
  const t0 = Date.now();
  const r = await page.evaluate(async ([v, w, h, mbps]) => {
    const D = window.__director;
    D.S.version = v;
    await D.renderHiRes({ w, h, bitrate: mbps ? mbps * 1e6 : null, tag: mbps ? '-share' : '' });
    return window.__lastRecording ?? null;
  }, [version, +w, +h, +mbps]);
  await page.waitForTimeout(4000);
  console.log('rendered', JSON.stringify(r), 'in', Math.round((Date.now() - t0) / 1000) + ' s', 'errors', JSON.stringify(errs.slice(0, 4)));
  if (!saved.some((f) => f.endsWith('.mp4'))) process.exitCode = 1;
} finally { await browser?.close(); await server?.close(); unlock(); }

async function document_fonts(page) { await page.evaluate(() => document.fonts.load("700 60px 'TMBJ Title'").then(() => document.fonts.ready)); }
