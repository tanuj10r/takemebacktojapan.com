/* The key art (start, loading and phone cards): one staged frame from our
 * own renderer.  AGENTS.md: visuals are built in code, so the picture on the
 * title card is the game itself -- here a made-up diorama of the town's
 * places (src/dev/poster.js, the dev page's ?poster), rendered at 3840x2160.
 *
 *   node scripts/keyart.mjs            render the master, then encode the files below
 *   node scripts/keyart.mjs --encode   only encode, from the master already on disk
 *
 * Master (lossless, kept out of public/): assets/keyart/keyart-3840.png.
 * Shipped (public/), downsampled from the master so they stay crisp:
 *   keyart-1280.webp       small windows and the phone page's card  (<= 130 KB; srcset)
 *   keyart-1920.webp       every card, every screen                 (<= 250 KB)
 *   keyart-2560.webp       the cards on large high-DPI screens      (<= 500 KB; srcset)
 *   keyart-portrait.webp   the phone card upright: its own 3:4 frame (--portrait; src/dev/poster.js POSTER_PORTRAIT)
 *
 *   node scripts/keyart.mjs --portrait     render the upright master (assets/keyart/keyart-portrait-1440.png) and encode it
 *
 * Headless system Chrome and its own dev server (port 5197), under the
 * shared browser lock; both are closed however the run ends.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const ENCODE_ONLY = process.argv.includes('--encode');
const PORTRAIT = process.argv.includes('--portrait');
const MASTER = path.join(ROOT, 'assets', 'keyart', PORTRAIT ? 'keyart-portrait-1440.png' : 'keyart-3840.png');
const W = PORTRAIT ? 1440 : 3840, H = PORTRAIT ? 1920 : 2160;
/* each file: its size, the master's crop (fractions: x0, width; full height), the byte budget */
const OUT = PORTRAIT ? [
  // (Tan, 2026-10-04: the 9:16 crop showed half of Fuji above the phone's sheet) the picture above the sheet is ~3:4
  { file: 'keyart-portrait.webp', w: 1080, h: 1440, crop: [0, 1], max: 190 * 1024 },
] : [
  { file: 'keyart-1280.webp', w: 1280, h: 720, crop: [0, 1], max: 130 * 1024 },
  { file: 'keyart-1920.webp', w: 1920, h: 1080, crop: [0, 1], max: 250 * 1024 },
  { file: 'keyart-2560.webp', w: 2560, h: 1440, crop: [0, 1], max: 500 * 1024 },
];

/* ---- one browser at a time across agents ---- */
const LOCK = '/tmp/lawson-browser.lock';
for (;;) {
  try { fs.mkdirSync(LOCK); break; } catch {
    console.log('  waiting for the browser lock');
    await new Promise((r) => setTimeout(r, 10000));
  }
}
let unlocked = false;
const unlock = () => { if (!unlocked) { unlocked = true; try { fs.rmdirSync(LOCK); } catch {} } };
process.on('exit', unlock);

const server = await createServer({ root: ROOT, logLevel: 'error', server: { port: 5197, strictPort: false, host: '127.0.0.1' } });
await server.listen();
const base = server.resolvedUrls.local[0];
let browser;
const done = async () => {
  await Promise.race([Promise.all([browser?.close(), server.close()]), new Promise((r) => setTimeout(r, 5000))]).catch(() => {});
  unlock();
};
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, async () => { await done(); process.exit(130); });

const write = (file, dataUrl) => {
  const buf = Buffer.from(dataUrl.replace(/^data:[\w/+-]+;base64,/, ''), 'base64');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, buf);
  return buf.length;
};

try {
  browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  page.setDefaultTimeout(600000);
  page.on('pageerror', (e) => console.log('  [page error]', e.message));

  let master;
  if (ENCODE_ONLY) {
    master = 'data:image/png;base64,' + fs.readFileSync(MASTER).toString('base64');
    await page.goto(`${base}credits.html`);
  } else {
    await page.goto(`${base}?shots&poster`);
    await page.waitForFunction(() => window.__ready === true, null, { timeout: 600000, polling: 500 });
    const r = await page.evaluate(async ([w, h]) => {
      const opts = await window.__poster({ portrait: w < h });
      return window.__shot('keyart', w, h, { ...opts, png: true, returnData: true, scale: 1 });
    }, [W, H]);
    master = r.data;
    const bytes = write(MASTER, master);
    console.log(`  master ${W}x${H} PNG ${(bytes / 1024 / 1024).toFixed(1)} MB -> ${path.relative(ROOT, MASTER)}  (${r.calls} calls, ${Math.round(r.triangles / 1000)}k tris)`);
  }

  // downsample (Chrome's high-quality resampling) and find the best WebP quality under each budget
  const files = await page.evaluate(async ([src, out]) => {
    const img = new Image();
    img.src = src;
    await img.decode();
    const res = [];
    for (const o of out) {
      const c = document.createElement('canvas');
      c.width = o.w; c.height = o.h;
      const x = c.getContext('2d');
      x.imageSmoothingEnabled = true;
      x.imageSmoothingQuality = 'high';
      const sx = o.crop[0] * img.width, sw = o.crop[1] * img.width;
      x.drawImage(img, sx, 0, sw, img.height, 0, 0, o.w, o.h);
      let best = null;
      for (let q = 0.92; q >= 0.5; q -= 0.02) {
        const d = c.toDataURL('image/webp', q);
        const bytes = Math.round(((d.length - d.indexOf(',') - 1) * 3) / 4);
        best = { data: d, q: +q.toFixed(2), bytes };
        if (bytes <= o.max) break;
      }
      res.push({ file: o.file, ...best });
    }
    return res;
  }, [master, OUT]);
  for (const f of files) {
    write(path.join(ROOT, 'public', f.file), f.data);
    console.log(`  ${f.file.padEnd(22)} q${f.q.toFixed(2)}  ${(f.bytes / 1024).toFixed(0)} KB`);
  }
  console.log(`KEYART ${files.map((f) => `${f.file} ${(f.bytes / 1024).toFixed(0)} KB`).join(', ')}`);
} finally {
  await done();
}
