// dev: check a rendered promo file (scripts/_promo-render.mjs): it plays in Chrome, its size, length and frame rate,
// frames pulled at given times (a contact sheet), and the sound: how loud each stretch is against the cue list.
//
//   node scripts/_promo-check.mjs <file.mp4> <t1,t2,...|sec> [cue times t,t,...]
//
// `sec`: one frame a second (the sheet wraps to rows of 13).  The loudness is ITU-R BS.1770 integrated (LUFS) and the
// true peak (dBTP), measured on the file's decoded sound by src/director/loudness.js (there is no ffmpeg here).
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { chromium } from 'playwright';

const file = path.resolve(process.argv[2]);
if (!fs.existsSync(file)) { console.error('no such file: ' + file); process.exit(1); }
let times = process.argv[3] === 'sec' ? null : (process.argv[3] ?? '1,5,10,15,20').split(',').map(Number);
const cues = (process.argv[4] ?? '').split(',').filter(Boolean).map(Number);
const dir = path.dirname(file), name = path.basename(file);
const srv = http.createServer((q, r) => {
  if (q.url.startsWith('/__loudness.js')) { r.writeHead(200, { 'Content-Type': 'text/javascript' }); r.end(fs.readFileSync(new URL('../src/director/loudness.js', import.meta.url))); return; }
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
  if (!times) { times = []; for (let t = 0; t < meta.dur - 0.02; t++) times.push(t); }
  // frames, counted as it plays for a second (requestVideoFrameCallback)
  const fps = await page.evaluate(async () => {
    const v = document.getElementById('v'); v.currentTime = 2; await new Promise((r) => { v.onseeked = r; });
    let n = 0; const t0 = v.currentTime; const cb = () => { n++; v.requestVideoFrameCallback(cb); }; v.requestVideoFrameCallback(cb);
    await v.play(); await new Promise((r) => setTimeout(r, 2000)); v.pause();
    return +(n / (v.currentTime - t0)).toFixed(1);
  });
  const sheet = await page.evaluate(async (times) => {
    const v = document.getElementById('v'), W = 270, H = 480, per = times.length > 14 ? 13 : times.length, c = Object.assign(document.createElement('canvas'), { width: W * per, height: (H + 26) * Math.ceil(times.length / per) }), g = c.getContext('2d');
    g.fillStyle = '#1b1626'; g.fillRect(0, 0, c.width, c.height); g.fillStyle = '#fff'; g.font = '600 14px system-ui';
    for (let i = 0; i < times.length; i++) { v.currentTime = times[i]; await new Promise((r) => { v.onseeked = r; }); const x = (i % per) * W, y = Math.floor(i / per) * (H + 26); g.drawImage(v, x, y, W, H); g.fillText(times[i].toFixed(2) + ' s', x + 6, y + H + 18); }
    return c.toDataURL('image/jpeg', 0.88);
  }, times);
  fs.writeFileSync(file.replace(/\.mp4$/, '-frames.jpg'), Buffer.from(sheet.split(',')[1], 'base64'));
  const audio = await page.evaluate(async ([name, cues]) => {
    const { lufs, truePeak } = await import('/__loudness.js');
    const ac = new AudioContext({ sampleRate: 48000 }), b = await ac.decodeAudioData(await (await fetch(`/${encodeURIComponent(name)}`)).arrayBuffer());
    const L = b.getChannelData(0), sr = b.sampleRate, rms = (a, z) => { let s = 0; const i0 = Math.max(0, Math.floor(a * sr)), i1 = Math.min(L.length, Math.floor(z * sr)); for (let i = i0; i < i1; i++) s += L[i] * L[i]; return Math.sqrt(s / Math.max(1, i1 - i0)); };
    let peak = 0; for (let i = 0; i < L.length; i++) peak = Math.max(peak, Math.abs(L[i]));
    const chs = [...Array(b.numberOfChannels)].map((_, k) => b.getChannelData(k));
    // (dead air: the longest stretch under -50 dBFS, 50 ms windows)
    let quiet = 0, run = 0; for (let t = 0; t + 0.05 <= b.duration; t += 0.05) { if (rms(t, t + 0.05) < 0.00316) { run += 0.05; quiet = Math.max(quiet, run); } else run = 0; }
    return { dur: +b.duration.toFixed(3), ch: b.numberOfChannels, sr, lufs: +lufs(chs, sr).toFixed(2), truePeakDb: +truePeak(chs).toFixed(2), longestSilence: +quiet.toFixed(2), peak: +peak.toFixed(3), whole: +rms(0, b.duration).toFixed(4),
      cues: cues.map((t) => ({ t, before: +rms(t - 0.25, t - 0.03).toFixed(4), after: +rms(t + 0.03, t + 0.45).toFixed(4) })) };
  }, [name, cues]);
  console.log(JSON.stringify({ file: name, mb: +(fs.statSync(file).size / 1048576).toFixed(1), ...meta, fps, audio }, null, 1));
} finally { await browser.close(); srv.close(); unlock(); }
