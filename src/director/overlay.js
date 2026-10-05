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
export function drawOverlay(c, W, H, { hook = null, cues = [], t, total, title, url, endLen = 1.8, capY = 0.705, endY = 0.712, hookHold = 0, soundOn = null, endLine = null, hud = null }) {
  const k = W / 1080;
  c.save();
  c.textAlign = 'center'; c.textBaseline = 'middle';

  // the hook
  if (hud) drawHud(c, W, H, k, hud);
  // (cut D: after the hook, a small "sound on" stays up top while the sounds play)
  if (soundOn) {
    const a = win(t, soundOn[0], soundOn[1], 0.25, 0.25);
    if (a > 0.01) {
      c.font = `700 ${34 * k}px ${UI}`;
      const txt = 'sound on', tw = c.measureText(txt).width, w = tw + 118 * k, y = H * 0.155, x0 = W / 2 - w / 2;
      plate(c, W / 2, y, w, 66 * k, 33 * k, a * 0.92);
      c.globalAlpha = a; c.fillStyle = INK; c.strokeStyle = INK; c.lineWidth = 4 * k; c.lineCap = 'round';
      // a speaker: its box and cone, two waves (the outer one beats)
      const sx = x0 + 34 * k;
      c.beginPath(); c.moveTo(sx, y - 7 * k); c.lineTo(sx + 9 * k, y - 7 * k); c.lineTo(sx + 20 * k, y - 16 * k); c.lineTo(sx + 20 * k, y + 16 * k); c.lineTo(sx + 9 * k, y + 7 * k); c.lineTo(sx, y + 7 * k); c.closePath(); c.fill();
      c.beginPath(); c.arc(sx + 20 * k, y, 11 * k, -0.9, 0.9); c.stroke();
      c.globalAlpha = a * (0.45 + 0.55 * (0.5 + 0.5 * Math.sin(t * 6))); c.beginPath(); c.arc(sx + 20 * k, y, 20 * k, -0.9, 0.9); c.stroke();
      c.globalAlpha = a; c.textAlign = 'left'; c.fillText(txt, sx + 52 * k, y + 2 * k); c.textAlign = 'center';
      c.globalAlpha = 1;
    }
  }
  if (hook) {
    // (`hookHold`: there whole from the first frame, no way in, until then)
    const a = hookHold ? 1 - ease((t - (hookHold - 0.3)) / 0.3) : win(t, 0.05, 1.7, 0.2, 0.3);
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
    const len = q.capDur ?? q.dur;        // (a name may leave before its sound does: the chime's, for his run)
    if (!q.cap || t < q.t - 0.02 || t > q.t + len + 0.02) continue;
    const a = win(t, q.t, Math.min(q.t + len, total - endLen), 0.14, 0.18);
    if (a <= 0.01) continue;
    const [jp, en] = q.cap.split(' · ');
    const pop = 1 + 0.06 * (1 - ease((t - q.t) / 0.22));
    c.font = `700 ${66 * k}px ${JP}`; const wj = c.measureText(jp).width;
    c.font = `600 ${34 * k}px ${UI}`; const we = c.measureText(en ?? '').width;
    const w = Math.max(wj, we) + 92 * k, h = 168 * k, y = H * (q.capY ?? capY);
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
    const up = endLine ? 42 * k : 0;                       // (a third line under the address: the card grows down)
    plate(c, W / 2, y + up, w, 250 * k + 2 * up, 44 * k, e);
    c.fillStyle = INK; c.font = `700 ${84 * k}px ${TITLE}`; c.fillText(title, W / 2, y - 44 * k);
    c.fillStyle = '#8b5a73'; c.font = `700 ${44 * k}px ${UI}`; c.fillText(url, W / 2, y + 58 * k);
    c.fillStyle = SAKURA; c.fillRect(W / 2 - 120 * k, y + 14 * k, 240 * k, 5 * k);
    if (endLine) {
      c.font = `700 ${38 * k}px ${UI}`;
      const lw = c.measureText(endLine).width + 56 * k;
      c.fillStyle = '#1f5fae'; c.beginPath(); c.roundRect(W / 2 - lw / 2, y + 104 * k, lw, 66 * k, 33 * k); c.fill();
      c.fillStyle = '#fff'; c.fillText(endLine, W / 2, y + 139 * k);
    }
  }
  c.restore();
}

/* The game's own HUD, drawn into the frame (cut D's first-person part).  In the game it is HTML over the canvas
 * (core/hud.js: the crosshair; ui/hands.js: the card at the konbini's door), which a canvas recording does not
 * hold, so it is drawn again here from the same strings and the same colours, sized for the 9:16 frame. */
function drawHud(c, W, H, k, { cross = false, menu = null }) {
  c.save();
  if (cross) {
    c.globalAlpha = 0.85; c.fillStyle = '#fff'; c.shadowColor = 'rgba(0,0,0,.45)'; c.shadowBlur = 6 * k;
    c.beginPath(); c.arc(W / 2, H / 2, 5 * k, 0, Math.PI * 2); c.fill();
    c.shadowBlur = 0;
  }
  if (menu && menu.a > 0.01) {
    const w = 760 * k, row = 92 * k, h = 96 * k + row * menu.rows.length + 22 * k, x = W / 2 - w / 2, y = H * 0.62 - h / 2 + (1 - menu.a) * 14 * k;
    c.globalAlpha = menu.a * 0.95;
    c.shadowColor = 'rgba(40,30,60,.25)'; c.shadowBlur = 40 * k; c.shadowOffsetY = 12 * k;
    c.fillStyle = 'rgba(252,250,252,.95)'; c.beginPath(); c.roundRect(x, y, w, h, 28 * k); c.fill();
    c.shadowColor = 'transparent';
    c.strokeStyle = 'rgba(31,95,174,.45)'; c.lineWidth = 3 * k; c.stroke();
    c.globalAlpha = menu.a; c.textBaseline = 'middle';
    c.textAlign = 'left'; c.fillStyle = '#3a3350'; c.font = `700 ${34 * k}px ${UI}`; c.fillText(menu.title, x + 30 * k, y + 54 * k);
    c.textAlign = 'right'; c.fillStyle = '#7a7394'; c.font = `500 ${26 * k}px ${UI}`; c.fillText(menu.hint, x + w - 30 * k, y + 56 * k);
    menu.rows.forEach((r, i) => {
      const ry = y + 96 * k + row * i + row / 2, on = menu.pick === i;
      if (i) { c.fillStyle = 'rgba(58,51,80,.1)'; c.fillRect(x + 30 * k, ry - row / 2, w - 60 * k, 2 * k); }
      if (on) { c.fillStyle = 'rgba(31,95,174,.12)'; c.beginPath(); c.roundRect(x + 14 * k, ry - row / 2 + 6 * k, w - 28 * k, row - 12 * k, 14 * k); c.fill(); }
      const ks = (on ? 54 : 46) * k;
      c.fillStyle = on ? '#e59bb0' : '#1f5fae'; c.beginPath(); c.roundRect(x + 30 * k + (46 * k - ks) / 2, ry - ks / 2, ks, ks, 12 * k); c.fill();
      c.fillStyle = '#fff'; c.textAlign = 'center'; c.font = `700 ${28 * k}px ${UI}`; c.fillText(String(i + 1), x + 53 * k, ry + 1 * k);
      c.textAlign = 'left'; c.fillStyle = '#3a3350'; c.font = `500 ${32 * k}px ${UI}`; c.fillText(r.name, x + 100 * k, ry - 13 * k);
      c.fillStyle = '#8f88a8'; c.font = `500 ${22 * k}px ${JP}`; c.fillText(r.jp, x + 100 * k, ry + 24 * k);
      c.textAlign = 'right'; c.fillStyle = '#6a6384'; c.font = `500 ${28 * k}px ${UI}`; c.fillText(r.price, x + w - 30 * k, ry);
    });
  }
  c.restore();
}
