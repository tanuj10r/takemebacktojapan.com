// dev: one frame of a promo shot at full size (Director Mode's still), to look at closely.
//   node scripts/_promo-still.mjs <shot id> <t> <out.png> [w h]
import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';
import { chromium } from 'playwright';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const [id = 'C1', t = '9', out = 'still.png', w = '1080', h = '1920'] = process.argv.slice(2);
const LOCK = '/tmp/lawson-browser.lock';
let mine = false;
for (let i = 0; i < 360 && !mine; i++) { try { fs.mkdirSync(LOCK); mine = true; } catch { await new Promise((r) => setTimeout(r, 5000)); } }
const unlock = () => { if (mine) { try { fs.rmdirSync(LOCK); } catch { /* gone */ } mine = false; } };
process.on('exit', unlock);
let server, browser;
try {
  server = await createServer({ root: ROOT, logLevel: 'error', server: { port: 5192, strictPort: true, host: '127.0.0.1' } });
  await server.listen();
  browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal'] });
  const page = await (await browser.newContext({ viewport: { width: 1400, height: 1000 } })).newPage();
  page.setDefaultTimeout(600000);
  await page.goto('http://127.0.0.1:5192/?director');
  await page.waitForFunction(() => window.__director, null, { timeout: 300000 });
  await page.waitForTimeout(3000);
  if (process.env.PRE) console.log('pre', JSON.stringify(await page.evaluate(process.env.PRE)));
  const ts = String(t).split(',').map(Number);
  for (const tt of ts) {
    const url = await page.evaluate(async ([id, t, w, h]) => { const D = window.__director; D.S.version = id[0]; return D.still(id, t, { w, h, type: 'image/png' }); }, [id, tt, +w, +h]);
    const f = ts.length > 1 ? out.replace(/\.png$/, `-${tt}.png`) : out;
    fs.writeFileSync(f, Buffer.from(String(url).split(',')[1], 'base64'));
    console.log('saved', f);
  }
} finally { await browser?.close(); await server?.close(); unlock(); }
