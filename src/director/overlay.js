/* ------------------------------------------------------------------ *
 * The words on the picture (Director Mode, dev only; Tan, 2026-10-01: "share-ready, no editing on my side").
 * Drawn onto the out canvas after the frame, so they are in the recording:
 *
 *   the hook      the first second and a half, near the top
 *   the sounds    Version C: each cue's name as it plays, Japanese over English, in a plate under his chin
 *   the end card  the last seconds: the game's name and its address
 *
 * Everything keeps out of the top 12% and the bottom 22% of a 9:16 frame, where Reels, TikTok and Shorts lay their
 * own buttons and captions.  Sizes are in 1080ths of the frame's width, so the 4K render is the same picture.
 * ------------------------------------------------------------------ */

const TITLE = "'TMBJ Title', 'Hiragino Maru Gothic ProN', 'Arial Rounded MT Bold', system-ui, sans-serif";
const JP = "'Hiragino Maru Gothic ProN', 'Hiragino Sans', 'Noto Sans JP', sans-serif";
const UI = "-apple-system, BlinkMacSystemFont, 'Helvetica Neue', system-ui, sans-serif";
const INK = '#2b2542', PAPER = 'rgba(251,246,240,0.94)', SAKURA = '#e59bb0';
const ease = (u) => { u = Math.max(0, Math.min(1, u)); return u * u * (3 - 2 * u); };
/** 0..1: in over `a` s from t0, out over `b` s before t1 */
const win = (t, t0, t1, a = 0.16, b = 0.2) => Math.min(ease((t - t0) / a), ease((t1 - t) / b));

function plate(c, x, y, w, h, r, alpha) {
  c.save();
  c.globalAlpha = alpha;
  c.shadowColor = 'rgba(20,12,40,0.35)'; c.shadowBlur = h * 0.35; c.shadowOffsetY = h * 0.08;
  c.fillStyle = PAPER;
  c.beginPath(); c.roundRect(x - w / 2, y - h / 2, w, h, r); c.fill();
  c.restore();
}

/**
 * @param c      the out canvas's 2D context (the frame is already on it)
 * @param W, H   its size
 * @param o      { hook, cues, t, total, title, url, endLen }
 */
export function drawOverlay(c, W, H, { hook = null, cues = [], t, total, title, url, endLen = 1.8, capY = 0.705, endY = 0.712 }) {
  const k = W / 1080;
  c.save();
  c.textAlign = 'center'; c.textBaseline = 'middle';

  // the hook
  if (hook) {
    const a = win(t, 0.05, 1.7, 0.2, 0.3);
    if (a > 0.01) {
      c.font = `700 ${58 * k}px ${TITLE}`;
      const w = c.measureText(hook).width + 76 * k, y = H * 0.165 - (1 - a) * 14 * k;
      plate(c, W / 2, y, w, 104 * k, 52 * k, a);
      c.globalAlpha = a; c.fillStyle = INK; c.fillText(hook, W / 2, y + 3 * k);
      c.globalAlpha = 1;
    }
  }

  // the sounds' names: "ぴよぴよ · crosswalk chick" as two lines
  for (const q of cues) {
    if (!q.cap || t < q.t - 0.02 || t > q.t + q.dur + 0.02) continue;
    const a = win(t, q.t, Math.min(q.t + q.dur, total - endLen), 0.14, 0.18);
    if (a <= 0.01) continue;
    const [jp, en] = q.cap.split(' · ');
    const pop = 1 + 0.06 * (1 - ease((t - q.t) / 0.22));
    c.font = `700 ${66 * k}px ${JP}`; const wj = c.measureText(jp).width;
    c.font = `600 ${34 * k}px ${UI}`; const we = c.measureText(en ?? '').width;
    const w = Math.max(wj, we) + 92 * k, h = 168 * k, y = H * capY;
    c.save();
    c.translate(W / 2, y); c.scale(pop, pop); c.translate(-W / 2, -y);
    plate(c, W / 2, y, w, h, 36 * k, a);
    c.globalAlpha = a;
    c.fillStyle = INK; c.font = `700 ${66 * k}px ${JP}`; c.fillText(jp, W / 2, y - 26 * k);
    c.fillStyle = '#6c6482'; c.font = `600 ${34 * k}px ${UI}`; c.fillText(en ?? '', W / 2, y + 44 * k);
    // a little speaker's dot in sakura, top left of the plate
    c.fillStyle = SAKURA; c.beginPath(); c.arc(W / 2 - w / 2 + 30 * k, y - h / 2 + 30 * k, 9 * k, 0, Math.PI * 2); c.fill();
    c.restore();
  }

  // the end card: the picture dims a little, the name and the address
  const e = ease((t - (total - endLen)) / 0.35);
  if (e > 0.01) {
    c.globalAlpha = 0.34 * e; c.fillStyle = '#2c2346'; c.fillRect(0, 0, W, H);
    c.globalAlpha = e;
    const y = H * endY + (1 - e) * 18 * k;
    c.font = `700 ${84 * k}px ${TITLE}`;
    const w = Math.max(c.measureText(title).width, 620 * k) + 96 * k;
    plate(c, W / 2, y, w, 250 * k, 44 * k, e);
    c.fillStyle = INK; c.font = `700 ${84 * k}px ${TITLE}`; c.fillText(title, W / 2, y - 44 * k);
    c.fillStyle = '#8b5a73'; c.font = `700 ${44 * k}px ${UI}`; c.fillText(url, W / 2, y + 58 * k);
    c.fillStyle = SAKURA; c.fillRect(W / 2 - 120 * k, y + 14 * k, 240 * k, 5 * k);
  }
  c.restore();
}
