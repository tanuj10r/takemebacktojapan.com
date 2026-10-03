import { paintMap, drawIcon, drawGem, drawSpeaker, JP } from './mapArt.js';
import { STRINGS } from '../data/strings.js';

/* ------------------------------------------------------------------ *
 * The minimap and the full map (SPEC M2f; map 2.0).
 *
 *   corner   a round map in the bottom-right, turned so the way you face
 *            is up, your arrow in the middle, a compass ring with N, the
 *            places' pictograms upright; the Nippon always shown, pinned
 *            to the rim when it is out of range
 *   full     M: the whole town north-up on its sheet, every place's
 *            pictogram and label (English, the Japanese small beside it),
 *            the experiences' marks (a diamond for a thing to do, a
 *            speaker for a thing to hear), where you are, a title
 *            cartouche, a compass rose, a scale bar and the key
 *
 * The map itself is painted once (mapArt.js); a frame only copies it,
 * turned, into a small canvas -- and only when you have moved or turned.
 * The full map is drawn when it opens.
 * ------------------------------------------------------------------ */

const SIZE = 196;             // corner map, CSS px
const RANGE = 60;             // metres from the centre to the rim
const TAU = Math.PI * 2;
const INK = '#2e2a3a', INK_SOFT = '#6a6378', CREAM = 'rgba(255,251,242,0.95)', LINE = 'rgba(70,62,86,0.28)';

export function createMinimap(world) {
  const art = paintMap(world);
  if (import.meta.env?.DEV) window.__mapArt = art;
  const dpr = Math.min(2, window.devicePixelRatio || 1);

  /* ---- DOM ---- */
  const style = document.createElement('style');
  style.textContent = `
    .minimap { position: fixed; right: 22px; bottom: 22px; width: ${SIZE}px; height: ${SIZE}px;
      border-radius: 50%; pointer-events: none; z-index: 5; transition: opacity 0.6s;
      filter: drop-shadow(0 3px 8px rgba(40,30,60,0.35)); }
    .minimap.hidden { opacity: 0; }
    .fullmap { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center;
      background: rgba(30,26,44,0.55); z-index: 20; transition: opacity 0.25s; }
    .fullmap.hidden { opacity: 0; pointer-events: none; }
    .fullmap canvas { max-width: 92vw; max-height: 92vh; border-radius: 10px;
      box-shadow: 0 12px 44px rgba(20,14,34,0.45); }
  `;
  document.head.appendChild(style);
  const corner = document.createElement('canvas');
  corner.className = 'minimap hidden';
  corner.width = corner.height = SIZE * dpr;
  corner.style.width = corner.style.height = SIZE + 'px';
  document.body.appendChild(corner);
  const fullWrap = document.createElement('div');
  fullWrap.className = 'fullmap hidden';
  const full = document.createElement('canvas');
  fullWrap.appendChild(full);
  document.body.appendChild(fullWrap);
  const cc = corner.getContext('2d');

  const lawson = art.places.find((p) => p.id === 'lawson');
  /* The experiences (Tan's things to do and to hear): a diamond, the soft
   * yellow of their glow in town, for an engagement; a speaker for a sound. */
  const spots = () => [...(world.experiences?.list ?? []), ...(world.lawson?.experiences?.list ?? [])];
  const mark = { engage: drawGem, sound: drawSpeaker };
  /* Where each mark goes: on its spot, unless it belongs to a place (or a
   * place's icon is there), when it sits on that icon's corner as a badge
   * (a diamond top right, a speaker top left, so a place can wear both);
   * two of a kind that land together draw once.  [[x, y, kind]] */
  const placeGems = (list, at, icons, gr) => {
    const outp = [];
    for (const e of list) {
      let [x, y, d] = at(e.x, e.z);
      if (d !== undefined && d > RANGE * 0.95) continue;
      const kind = e.kind === 'sound' ? 'sound' : 'engage', side = kind === 'sound' ? -1 : 1;
      const ic = icons.find((q) => q.exp === e.id) ?? icons.find((q) => Math.hypot(q.x - x, q.y - y) < q.r + gr * 0.6);
      if (ic) { x = ic.x + side * ic.r * 0.85; y = ic.y - ic.r * 0.85; }
      if (!outp.some(([a, b, k]) => k === kind && Math.hypot(a - x, b - y) < gr * 1.2)) outp.push([x, y, kind]);
    }
    return outp;
  };
  let last = { x: NaN, z: NaN, yaw: NaN };

  /* ---- the corner map ---- */
  function drawCorner(pos, yaw) {
    const S = SIZE * dpr, R = S / 2, k = (R - 10 * dpr) / RANGE;   // px per metre
    cc.clearRect(0, 0, S, S);
    cc.save();
    cc.beginPath(); cc.arc(R, R, R - 4 * dpr, 0, Math.PI * 2); cc.clip();
    cc.fillStyle = '#f1ebdd'; cc.fillRect(0, 0, S, S);
    cc.translate(R, R);
    cc.rotate(yaw);                               // the way you face is up
    const [px, pz] = art.toPx(pos.x, pos.z);
    const sc = k / art.ppm;
    cc.scale(sc, sc);
    cc.imageSmoothingQuality = 'high';
    cc.drawImage(art.canvas, -px, -pz);
    cc.restore();

    // places, upright, where they fall once turned
    const at = (x, z) => {
      const dx = x - pos.x, dz = z - pos.z;
      const c = Math.cos(yaw), s = Math.sin(yaw);
      return [R + (dx * c - dz * s) * k, R + (dx * s + dz * c) * k, Math.hypot(dx, dz)];
    };
    const shown = [];
    const ir = 9 * dpr;
    for (const p of art.places) {
      if (p.id === 'lawson') continue;
      const [x, y, d] = at(p.w.x, p.w.z);
      if (d < RANGE * 0.95) { drawIcon(cc, p.kind, x, y, ir); shown.push({ x, y, r: ir, exp: p.exp }); }
    }
    // the Nippon: always shown, on the rim when it is out of range
    {
      let [x, y] = at(lawson.w.x, lawson.w.z);
      const rim = R - 16 * dpr;
      if (Math.hypot(x - R, y - R) > rim) {
        const a = Math.atan2(y - R, x - R);
        x = R + Math.cos(a) * rim; y = R + Math.sin(a) * rim;
      }
      drawIcon(cc, 'konbini', x, y, 10 * dpr);
      shown.push({ x, y, r: 10 * dpr, exp: lawson.exp });
    }
    // the experiences' marks, over the icons
    for (const [x, y, kind] of placeGems(spots(), at, shown, 7 * dpr)) mark[kind](cc, x, y, 7 * dpr);

    // the compass ring, turning with the map, N at north
    cc.lineWidth = 5 * dpr; cc.strokeStyle = '#fffaf0';
    cc.beginPath(); cc.arc(R, R, R - 4 * dpr, 0, Math.PI * 2); cc.stroke();
    cc.lineWidth = 1.5 * dpr; cc.strokeStyle = 'rgba(70,62,86,0.6)';
    cc.beginPath(); cc.arc(R, R, R - 7 * dpr, 0, Math.PI * 2); cc.stroke();
    for (const [lab, ang, col] of [[STRINGS.map.north, 0, '#c0392b'], ['E', Math.PI / 2, '#555064'], ['S', Math.PI, '#555064'], ['W', -Math.PI / 2, '#555064']]) {
      // north is -z: at screen angle (yaw + ang) from straight up
      const a = yaw + ang - Math.PI / 2;
      const x = R + Math.cos(a) * (R - 5 * dpr), y = R + Math.sin(a) * (R - 5 * dpr);
      const big = ang === 0;
      cc.beginPath(); cc.arc(x, y, (big ? 10 : 7.5) * dpr, 0, Math.PI * 2);
      cc.fillStyle = '#fffaf0'; cc.fill();
      cc.fillStyle = col; cc.font = `bold ${(big ? 12 : 9) * dpr}px ${JP}`;
      cc.textAlign = 'center'; cc.textBaseline = 'middle';
      cc.fillText(lab, x, y + 0.5 * dpr);
    }

    // you: an arrow pointing up
    cc.save();
    cc.translate(R, R);
    cc.beginPath();
    cc.moveTo(0, -11 * dpr); cc.lineTo(8 * dpr, 8 * dpr); cc.lineTo(0, 4 * dpr); cc.lineTo(-8 * dpr, 8 * dpr); cc.closePath();
    cc.fillStyle = '#e8453f'; cc.fill();
    cc.lineWidth = 2 * dpr; cc.strokeStyle = '#fffaf0'; cc.stroke();
    cc.restore();
  }

  /* ---- the full map, drawn in CSS px (u device px each, a touch larger on a big screen) ---- */
  /* `simple` (the phone, Tan 2026-10-02: "a simpler map with less text"): the whole sheet inside `fit` (CSS px), no
   * cartouche, rose or scale bar; one short English line a place, the things to do first, and a label that has no
   * clear place is left out rather than laid over another */
  function drawFull(pos, yaw, { simple = false, fit = null } = {}) {
    const src = art.canvas;
    const fw0 = fit?.w ?? window.innerWidth * 0.92, fh0 = fit?.h ?? window.innerHeight * 0.92;
    const scale = Math.min(fw0 / src.width, fh0 / src.height) * dpr;
    lastScale = scale;
    const DW = Math.round(src.width * scale), DH = Math.round(src.height * scale);
    full.width = DW; full.height = DH;
    full.style.width = DW / dpr + 'px'; full.style.height = DH / dpr + 'px';
    const c = full.getContext('2d');
    c.imageSmoothingQuality = 'high';
    c.drawImage(src, 0, 0, DW, DH);
    const u = simple ? dpr : dpr * Math.max(0.8, Math.min(1.15, DH / dpr / 900));
    c.setTransform(u, 0, 0, u, 0, 0);
    const W = DW / u, H = DH / u, k = scale / u;
    const P = (x, z) => art.toPx(x, z).map((v) => v * k);
    const font = (px, bold = '') => { c.font = `${bold}${px}px ${JP}`; };
    const text = (t, x, y, col, align = 'left', base = 'middle') => { c.fillStyle = col; c.textAlign = align; c.textBaseline = base; c.fillText(t, x, y); };

    // the sheet's border: a double ink rule inside the edge
    c.strokeStyle = 'rgba(70,62,86,0.55)'; c.lineWidth = 1.6; c.strokeRect(9, 9, W - 18, H - 18);
    c.strokeStyle = 'rgba(70,62,86,0.35)'; c.lineWidth = 0.7; c.strokeRect(13, 13, W - 26, H - 26);

    const r = simple ? 10 : 12, gr = simple ? 6.5 : 8;
    const [ux, uy] = P(pos.x, pos.z);
    // the furniture first, so labels keep clear of it: the title cartouche, the rose, the foot
    const M = STRINGS.map;
    font(21, 'bold '); const tw = Math.max(c.measureText(M.title).width + 30, (font(12), c.measureText(M.titleJp).width)) + 16;
    const seg = 25 * k * art.ppm;
    font(10.5); const fw = seg * 2 + 60;
    // the key to the marks sits bottom right, left of "M to close" (a wider foot on the left covered the Deer Park's icon)
    const kw = 72 + c.measureText(M.todo).width + c.measureText(M.hear).width;
    font(11); const cw = c.measureText(M.close).width + 16;
    const kx = W - 24 - cw - 10 - kw, ky = H - 49;
    const taken = simple ? [[kx, ky, W - 20, H - 20], [ux - 34, uy - 44, ux + 34, uy + 16]]
      : [[24, 24, 24 + tw, 86], [W - 104, 12, W - 20, 112], [24, H - 58, 24 + fw, H - 24], [kx, ky, W - 20, H - 20], [ux - 34, uy - 44, ux + 34, uy + 16]];
    // (a label never runs off the sheet: Hachi's home sits by its top edge)
    const hits = (b) => b[0] < 16 || b[1] < 16 || b[2] > W - 16 || b[3] > H - 16 || taken.some((t) => b[0] < t[2] && b[2] > t[0] && b[1] < t[3] && b[3] > t[1]);
    const icons = art.places.map((p) => { const [x, y] = P(p.w.x, p.w.z); taken.push([x - r, y - r, x + r, y + r]); return { p, x, y, r, exp: p.exp }; });
    // the marks: placed first so no label covers them, drawn last, on top
    const gems = placeGems(spots(), P, icons, gr);
    for (const [x, y] of gems) taken.push([x - gr, y - gr, x + gr, y + gr]);
    for (const { p, x, y } of simple ? [...icons].sort((a, b) => !!b.exp - !!a.exp) : icons) {
      const en = simple ? (p.short ?? p.en) : p.en;
      font(simple ? 11 : 13, 'bold '); const w1 = c.measureText(en).width;
      font(10.5); const bw = (simple ? w1 : Math.max(w1, c.measureText(p.jp).width)) + (simple ? 10 : 14), bh = simple ? 18 : 33, g = simple ? 3 : 5;
      const tries = [
        [x + r + g, y - bh / 2], [x - r - g - bw, y - bh / 2],
        [x - bw / 2, y + r + g], [x - bw / 2, y - r - g - bh],
        [x + r + g, y + 5], [x - r - g - bw, y + 5], [x + r + g, y - bh - 5], [x - r - g - bw, y - bh - 5],
      ];
      // the first clear place; failing that, the one that covers least
      // (what it covers, and four times whatever of it would run off the sheet)
      const off = (a, b) => bw * bh - Math.max(0, Math.min(a + bw, W - 16) - Math.max(a, 16)) * Math.max(0, Math.min(b + bh, H - 16) - Math.max(b, 16));
      const over = ([a, b]) => 4 * off(a, b) + taken.reduce((sum, t) => sum + Math.max(0, Math.min(a + bw, t[2]) - Math.max(a, t[0])) * Math.max(0, Math.min(b + bh, t[3]) - Math.max(b, t[1])), 0);
      const clear = tries.find(([a, b]) => !hits([a, b, a + bw, b + bh]));
      if (simple && !clear) continue;
      const [bx, by] = clear ?? tries.reduce((best, t) => (over(t) < over(best) ? t : best));
      taken.push([bx, by, bx + bw, by + bh]);
      chip(c, bx, by, bw, bh);
      if (simple) { font(11, 'bold '); text(en, bx + 5, by + 9.5, INK); continue; }
      font(13, 'bold '); text(p.en, bx + 7, by + 11.5, INK);
      font(10.5); text(p.jp, bx + 7, by + 24, INK_SOFT);
    }
    for (const { p, x, y } of icons) drawIcon(c, p.kind, x, y, r);
    for (const [x, y, kind] of gems) mark[kind](c, x, y, gr);

    // you are here
    c.save(); c.translate(ux, uy); c.rotate(-yaw);
    c.beginPath(); c.moveTo(0, -15); c.lineTo(10, 10); c.lineTo(0, 5); c.lineTo(-10, 10); c.closePath();
    c.fillStyle = '#e8453f'; c.fill(); c.lineWidth = 2.5; c.strokeStyle = '#fffaf0'; c.stroke();
    c.restore();
    font(12, 'bold ');
    const hw = c.measureText(M.here).width / 2 + 7;
    c.fillStyle = '#e8453f'; c.beginPath(); c.roundRect(ux - hw, uy - 40, hw * 2, 19, 9.5); c.fill();
    text(M.here, ux, uy - 30, '#ffffff', 'center');

    if (!simple) {
    // the title cartouche: a plate with a double rule
    chip(c, 24, 24, tw, 62);
    c.strokeStyle = LINE; c.beginPath(); c.roundRect(28, 28, tw - 8, 54, 4); c.stroke();
    font(21, 'bold '); text(M.title, 40, 48, INK);
    font(12); text(M.titleJp, 40, 69, INK_SOFT);

    // a compass rose: four long points and four short, each shaded on one side, N in red
    c.save(); c.translate(W - 62, 70);
    c.fillStyle = CREAM; c.beginPath(); c.arc(0, 0, 28, 0, TAU); c.fill();
    c.strokeStyle = LINE; c.lineWidth = 0.8; c.stroke();
    for (let i = 0; i < 8; i++) {
      const n = i === 0, long = i % 2 === 0, len = n ? 34 : long ? 29 : 18, wid = long ? 5.4 : 3.6;
      for (const s of [1, -1]) {
        c.fillStyle = n ? (s > 0 ? '#b8392e' : '#e8766a') : long ? (s > 0 ? '#4a4460' : '#a49db4') : (s > 0 ? '#8a8298' : '#d9d3e0');
        c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -len); c.lineTo(s * wid, 0); c.fill();
      }
      c.rotate(TAU / 8);
    }
    font(15, 'bold '); text(M.north, 0, -35, '#b8392e', 'center', 'bottom');
    c.restore();

    // the foot: a scale bar (0, 25, 50 m)
    const fy = H - 58;
    chip(c, 24, fy, fw, 34);
    c.fillStyle = '#4a4460'; c.fillRect(36, fy + 12, seg, 5);
    c.strokeStyle = '#4a4460'; c.lineWidth = 0.9; c.strokeRect(36, fy + 12, seg * 2, 5);
    font(10.5);
    text('0', 36, fy + 20, INK_SOFT, 'center', 'top'); text('25', 36 + seg, fy + 20, INK_SOFT, 'center', 'top');
    text(M.scale(50), 30 + seg * 2, fy + 20, INK_SOFT, 'left', 'top');
    }

    // the key to the marks: a diamond to do, a speaker to hear
    font(10.5);
    chip(c, kx, ky, kw, 28);
    drawGem(c, kx + 16, ky + 14, 7);
    text(M.todo, kx + 28, ky + 14.5, INK);
    const hx = kx + 28 + c.measureText(M.todo).width + 22;
    drawSpeaker(c, hx, ky + 14, 7);
    text(M.hear, hx + 12, ky + 14.5, INK);

    // the key to close, bottom right
    font(11);
    chip(c, W - 24 - cw, H - 46, cw, 22);
    text(M.close, W - 32, H - 35, INK_SOFT, 'right');
  }

  /** A label's plate: cream, a hairline, a soft drop (CSS px). */
  function chip(c, x, y, w, h) {
    c.save();
    c.shadowColor = 'rgba(40,30,60,0.22)'; c.shadowBlur = 5 * dpr; c.shadowOffsetY = 1.5 * dpr;
    c.fillStyle = CREAM;
    c.beginPath(); c.roundRect(x, y, w, h, 6); c.fill();
    c.restore();
    c.strokeStyle = LINE; c.lineWidth = 0.8;
    c.beginPath(); c.roundRect(x + 0.4, y + 0.4, w - 0.8, h - 0.8, 6); c.stroke();
  }

  let visible = false, fullOpen = false, lastScale = 1;
  if (import.meta.env?.DEV) window.__minimapDraw = () => drawCorner(window.__scene.player.pos, window.__scene.player.yaw);
  return {
    /** Each frame: redraw the corner map only if you moved or turned. */
    update(pos, yaw) {
      if (!visible) return;
      if (Math.abs(pos.x - last.x) < 0.05 && Math.abs(pos.z - last.z) < 0.05 && Math.abs(yaw - last.yaw) < 0.002) return;
      last = { x: pos.x, z: pos.z, yaw };
      drawCorner(pos, yaw);
    },
    setVisible(v) {
      if (v === visible) return;
      visible = v;
      corner.classList.toggle('hidden', !v);
      last = { x: NaN, z: NaN, yaw: NaN };
    },
    get fullOpen() { return fullOpen; },
    /** The world point under a CSS-px point on the open whole map, or null off the sheet (the phone's tap to walk). */
    toWorld(cx, cy) {
      if (!fullOpen) return null;
      const r = full.getBoundingClientRect();
      if (cx < r.left || cx > r.right || cy < r.top || cy > r.bottom) return null;
      const k = dpr / lastScale;                     // art px a CSS px
      return { x: art.bounds.x0 + ((cx - r.left) * k) / art.ppm, z: art.bounds.z0 + ((cy - r.top) * k) / art.ppm };
    },
    setFull(open, pos, yaw, opts) {
      fullOpen = open;
      if (open) drawFull(pos, yaw, opts);
      corner.style.visibility = open ? 'hidden' : '';
      fullWrap.classList.toggle('hidden', !open);
    },
  };
}
