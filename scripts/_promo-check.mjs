// dev: check a rendered promo file (scripts/_promo-render.mjs): it plays in Chrome, its size, length and frame rate,
// frames pulled at given times (a contact sheet), and the sound: how loud each stretch is against the cue list.
//
//   node scripts/_promo-check.mjs <file.mp4> <t1,t2,...> [cue times t,t,...]
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { chromium } from 'playwright';

const file = path.resolve(process.argv[2]);
const times = (process.argv[3] ?? '1,5,10,15,20').split(',').map(Number);
const cues = (process.argv[4] ?? '').split(',').filter(Boolean).map(Number);
const dir = path.dirname(file), name = path.basename(file);
const srv = http.createServer((q, r) => {
  if (q.url.startsWith('/__check')) { r.writeHead(200, { 'Content-Type': 'text/html' }); r.end(`<video id="v" src="/${encodeURIComponent(name)}" muted playsinline></video>`); return; }
  const f = path.join(dir, decodeURIComponent(q.url.slice(1)));
  if (!fs.existsSync(f)) { r.writeHead(404); r.end(); return; }
  const size = fs.statSync(f).size, m = /bytes=(\d+)-(\d*)/.exec(q.headers.range ?? '');
  const a = m ? +m[1] : 0, b = m && m[2] ? +m[2] : size - 1;
  r.writeHead(m ? 206 : 200, { 'Content-Type': f.endsWith('.mp4') ? 'video/mp4' : 'text/html', 'Accept-Ranges': 'bytes', 'Content-Length': b - a + 1, ...(m ? { 'Content-Range': `bytes ${a}-${b}/${size}` } : {}) });
  fs.createReadStream(f, { start: a, end: b }).pipe(r);
}).listen(5191);
const LOCK = '/tmp/lawson-browser.lock';
let mine = false;
for (let i = 0; i < 360 && !mine; i++) { try { fs.mkdirSync(LOCK); mine = true; } catch { await new Promise((r) => setTimeout(r, 5000)); } }
const unlock = () => { if (mine) { try { fs.rmdirSync(LOCK); } catch { /* gone */ } mine = false; } };
process.on('exit', unlock);
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  page.setDefaultTimeout(60000);
  await page.goto('http://127.0.0.1:5191/__check');
  const meta = await page.evaluate(async () => {
    const v = document.getElementById('v');
    await new Promise((ok, no) => { if (v.readyState >= 1) ok(); v.onloadedmetadata = ok; v.onerror = () => no(new Error('the video does not load: ' + v.error?.message)); });
    return { w: v.videoWidth, h: v.videoHeight, dur: +v.duration.toFixed(3) };
  });
  // frames, counted as it plays for a second (requestVideoFrameCallback)
  const fps = await page.evaluate(async () => {
    const v = document.getElementById('v'); v.currentTime = 2; await new Promise((r) => { v.onseeked = r; });
    let n = 0; const t0 = v.currentTime; const cb = () => { n++; v.requestVideoFrameCallback(cb); }; v.requestVideoFrameCallback(cb);
    await v.play(); await new Promise((r) => setTimeout(r, 2000)); v.pause();
    return +(n / (v.currentTime - t0)).toFixed(1);
  });
  const sheet = await page.evaluate(async (times) => {
    const v = document.getElementById('v'), W = 270, H = 480, c = Object.assign(document.createElement('canvas'), { width: W * times.length, height: H + 26 }), g = c.getContext('2d');
    g.fillStyle = '#1b1626'; g.fillRect(0, 0, c.width, c.height); g.fillStyle = '#fff'; g.font = '600 14px system-ui';
    for (let i = 0; i < times.length; i++) { v.currentTime = times[i]; await new Promise((r) => { v.onseeked = r; }); g.drawImage(v, i * W, 0, W, H); g.fillText(times[i].toFixed(2) + ' s', i * W + 6, H + 18); }
    return c.toDataURL('image/jpeg', 0.88);
  }, times);
  fs.writeFileSync(file.replace(/\.mp4$/, '-frames.jpg'), Buffer.from(sheet.split(',')[1], 'base64'));
  const audio = await page.evaluate(async ([name, cues]) => {
    const ac = new AudioContext(), b = await ac.decodeAudioData(await (await fetch(`/${encodeURIComponent(name)}`)).arrayBuffer());
    const L = b.getChannelData(0), sr = b.sampleRate, rms = (a, z) => { let s = 0; const i0 = Math.max(0, Math.floor(a * sr)), i1 = Math.min(L.length, Math.floor(z * sr)); for (let i = i0; i < i1; i++) s += L[i] * L[i]; return Math.sqrt(s / Math.max(1, i1 - i0)); };
    let peak = 0; for (let i = 0; i < L.length; i++) peak = Math.max(peak, Math.abs(L[i]));
    return { dur: +b.duration.toFixed(3), ch: b.numberOfChannels, sr, peak: +peak.toFixed(3), whole: +rms(0, b.duration).toFixed(4),
      cues: cues.map((t) => ({ t, before: +rms(t - 0.25, t - 0.03).toFixed(4), after: +rms(t + 0.03, t + 0.45).toFixed(4) })) };
  }, [name, cues]);
  console.log(JSON.stringify({ file: name, mb: +(fs.statSync(file).size / 1048576).toFixed(1), ...meta, fps, audio }, null, 1));
} finally { await browser.close(); srv.close(); unlock(); }
