import * as THREE from 'three';
import { STATION, LINE, TAXI, RIDE, NAME_BOARD, CAR_ADS } from '../../data/town.js';
import { BUS } from '../../data/bus.js';
import { JP, JP_ROUND, JP_BRUSH } from '../kit/tex.js';
import { pikachu, pokeball, bolt, pawprint, cloud, eevee, piplup, bulbasaur, PIKA } from './art.js';

/* ------------------------------------------------------------------ *
 * Canvas2D art for the station and the train (AGENTS.md: drawn in code).
 * Every name comes from data/town.js.  Each texture is the size it is
 * seen at; the LED boards are drawn as real dot matrices (a low-res
 * paint, each pixel a round lamp), so they read as LEDs up close.
 * ------------------------------------------------------------------ */

const cache = new Map();
function tex(key, w, h, draw) {
  if (cache.has(key)) return cache.get(key);
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  cache.set(key, t);
  return t;
}

function fit(c, str, x, y, maxW, size, color, { weight = 'bold', align = 'center', font = JP } = {}) {
  let s = size;
  do {
    c.font = `${weight} ${s}px ${font}`;
    if (c.measureText(str).width <= maxW) break;
    s -= 1;
  } while (s > 6);
  c.fillStyle = color;
  c.textAlign = align;
  c.textBaseline = 'middle';
  c.fillText(str, x, y);
}

const NAVY = '#1f3f7a', GREEN = RIDE.color, CREAM = '#f7f2e4', INK = '#23222c', PINK = RIDE.pink;
const SANS = `'Helvetica Neue', Helvetica, Arial, sans-serif`;
const here = LINE.stations.findIndex((s) => s.jp === STATION.jp);
const D = RIDE.dest;

/* ------------------------------- LEDs ------------------------------- */

const AMBER = '#ffa726', ORANGE = '#ff6a1a', LGREEN = '#3fe070', LRED = '#ff3b30', LWHITE = '#f4f0e0';

/**
 * A dot-matrix panel: `paint(o, cols, rows)` draws at one pixel per lamp on
 * a transparent canvas; every pixel is then drawn as a round lamp, lit in
 * its colour or dark.
 */
const ledCanvas = new Map();          // one low-res canvas per size, reused (the boards redraw each second while you wait)
function led(c, x0, y0, cols, rows, pitch, paint, from = 0) {
  const key = cols * 10000 + rows;
  let off = ledCanvas.get(key);
  if (!off) { off = document.createElement('canvas'); off.width = cols; off.height = rows; ledCanvas.set(key, off); }
  const o = off.getContext('2d', { willReadFrequently: true });
  o.setTransform(1, 0, 0, 1, 0, 0);
  o.globalCompositeOperation = 'source-over';
  o.clearRect(0, 0, cols, rows);
  o.textBaseline = 'middle';
  paint(o, cols, rows);
  const d = o.getImageData(0, 0, cols, rows).data;
  const r = pitch * 0.4;
  for (let j = from; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const k = (j * cols + i) * 4;
      const on = d[k + 3] > 96;
      c.fillStyle = on ? `rgb(${d[k]},${d[k + 1]},${d[k + 2]})` : '#2a2522';
      c.beginPath(); c.arc(x0 + (i + 0.5) * pitch, y0 + (j + 0.5) * pitch, on ? r : r * 0.8, 0, Math.PI * 2); c.fill();
    }
  }
}
/** Text on the low-res LED canvas: crisp at one pixel per lamp. */
function ledText(o, str, x, y, size, color, { align = 'left', font = JP, weight = 'bold', maxW = 999 } = {}) {
  let s = size;
  do { o.font = `${weight} ${s}px ${font}`; if (o.measureText(str).width <= maxW) break; s -= 1; } while (s > 6);
  o.fillStyle = color; o.textAlign = align; o.textBaseline = 'middle';
  o.fillText(str, x, y);
}
/** A train type in the LED manner: a lit block with the word cut out of it. */
function ledKind(o, str, x, y, w, h, color) {
  o.fillStyle = color; o.fillRect(x, y, w, h);
  o.globalCompositeOperation = 'destination-out';
  ledText(o, str, x + w / 2, y + h / 2 + 1, h - 2, '#000', { align: 'center', maxW: w - 2 });
  o.globalCompositeOperation = 'source-over';
}
const kindColor = (k) => (k === '快速' ? ORANGE : LGREEN);

/** The destination LED on the train's front (and, small, on its sides). */
export const destTex = (dir, small = false) =>
  tex('dest' + dir + small, small ? 256 : 512, small ? 64 : 128, (c, w, h) => {
    const d = D[dir];
    c.fillStyle = '#0c0b0c'; c.fillRect(0, 0, w, h);
    const cols = small ? 64 : 128, rows = small ? 16 : 32, p = w / cols;
    led(c, 0, 0, cols, rows, p, (o) => {
      if (small) {
        ledKind(o, d.kind, 1, 1, 22, 14, kindColor(d.kind));
        ledText(o, d.jp, 44, 8.5, 14, AMBER, { align: 'center', maxW: 38 });
      } else {
        ledKind(o, d.kind, 2, 4, 40, 24, kindColor(d.kind));
        ledText(o, d.jp, 88, 16.5, 24, AMBER, { align: 'center', maxW: 76 });
      }
    });
  });

/** 運行番号: the run number in its little window on the front. */
export const runNoTex = () =>
  tex('runNo', 128, 48, (c, w, h) => {
    c.fillStyle = '#0c0b0c'; c.fillRect(0, 0, w, h);
    led(c, 0, 0, 32, 12, 4, (o) => ledText(o, RIDE.car.run, 16, 6.5, 11, AMBER, { align: 'center', font: SANS, maxW: 31 }));
  });

/**
 * The departure board (発車標): a live LED panel, redrawn only when what it
 * says changes.  rows: [{ time, kind, dest, track }]; `next`: while you wait
 * on the platform (QA-010), the second line counts platform 1's train in:
 * 次の電車 あと25秒 (`{ secs }`, whole seconds; 0: まもなく到着).
 */
export function makeDepartureBoard(w = 768, h = 256) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const c = cv.getContext('2d');
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  let last = '';
  return {
    texture: t,
    draw(rows, next = null) {
      const head = JSON.stringify(rows) + (next ? '+' : '');
      const key = head + (next ? next.secs : '');
      if (key === last) return;
      // only the countdown's second changed: repaint its line's lamps alone (half the panel)
      const line2 = last.startsWith(head) && next ? 26 : 0;
      last = key;
      const cols = 192, rows0 = 52, p = w / cols;
      c.fillStyle = '#101014';
      if (line2) c.fillRect(0, 48 + line2 * p, w, h);
      else {
        c.fillRect(0, 0, w, h);
        // the header strip: printed, not LED
        c.fillStyle = '#23283a'; c.fillRect(0, 0, w, 44);
        const heads = [['種別', 68], ['時刻', 224], ['行先', 464], ['のりば', 688]];
        for (const [s, x] of heads) fit(c, s, x, 23, 150, 24, '#c8d2e8', { weight: '600' });
      }
      led(c, 0, 48, cols, rows0, p, (o) => {
        rows.slice(0, next ? 1 : 2).forEach((r, i) => {
          const y = 1 + i * 26;
          ledKind(o, r.kind, 3, y + 2, 28, 20, kindColor(r.kind));
          ledText(o, r.time, 56, y + 12, 19, LGREEN, { align: 'center', font: SANS, maxW: 42 });
          ledText(o, r.dest, 116, y + 12, 21, AMBER, { align: 'center', maxW: 70 });
          ledText(o, `${r.track}`, 172, y + 12, 21, LWHITE, { align: 'center', font: SANS });
        });
        if (next) {
          // the second line: the next train's countdown, the way the boards say "arriving" (lit amber, the seconds white)
          ledText(o, RIDE.next.head, 50, 39, 21, AMBER, { align: 'center', maxW: 88 });
          ledText(o, next.secs > 0 ? RIDE.next.in(next.secs) : RIDE.next.soon, 144, 39, 21, next.secs > 0 ? LWHITE : LGREEN, { align: 'center', maxW: 92 });
        }
      }, line2);
      t.needsUpdate = true;
    },
  };
}

/* ------------------------------ the train ------------------------------ */

/** The car number, stencilled on the body side by the cab. */
export const carNumberTex = (n = 0) =>
  tex('carNo' + n, 256, 48, (c, w, h) => {
    // the number alone, painted straight on the stainless (no plate behind it)
    c.clearRect(0, 0, w, h);
    fit(c, n ? RIDE.car.number2 : RIDE.car.number, w / 2, h / 2 + 1, w - 16, 34, '#2a2c34', { weight: '600' });
  });

/** 弱冷房車 (mildly air-conditioned car): the blue sticker on the second car's window. */
export const weakSticker = () =>
  tex('weak', 192, 64, (c, w, h) => {
    c.fillStyle = '#2b6fc4'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#ffffff'; c.fillRect(4, 4, w - 8, h - 8);
    fit(c, RIDE.car.weak, w / 2, h * 0.42, w - 16, 30, '#2b6fc4');
    fit(c, 'Mildly air-conditioned car', w / 2, h * 0.8, w - 14, 11, '#2b6fc4', { font: SANS });
  });

/** The pair of LCDs over each door inside: next stop, and our own ad. */
export const doorLcdTex = () =>
  tex('doorLcd', 512, 144, (c, w, h) => {
    c.fillStyle = '#16161c'; c.fillRect(0, 0, w, h);
    // left: 次は 渋谷
    const L = { x: 8, y: 8, w: 240, h: 128 };
    c.fillStyle = '#ffffff'; c.fillRect(L.x, L.y, L.w, L.h);
    c.fillStyle = GREEN; c.fillRect(L.x, L.y, L.w, 30);
    fit(c, `${D.east.kind}  ${D.east.jp} 行`, L.x + L.w / 2, L.y + 16, L.w - 16, 20, '#ffffff');
    fit(c, '次は', L.x + 40, L.y + 62, 70, 22, INK);
    fit(c, D.east.jp, L.x + 150, L.y + 70, 150, 50, INK);
    fit(c, `Next  ${D.east.en}`, L.x + L.w / 2, L.y + 112, L.w - 20, 20, '#4a4a58', { weight: '600', font: SANS });
    // right: the Osaka teaser, small
    const R = { x: 264, y: 8, w: 240, h: 128 };
    /*@mini c.fillStyle = GREEN; c.fillRect(R.x, R.y, R.w, R.h); fit(c, '富士見線', R.x + R.w / 2, R.y + 56, R.w - 20, 40, '#ffffff'); fit(c, 'Fujimi Line', R.x + R.w / 2, R.y + 98, R.w - 20, 22, '#ffffff', { weight: '600', font: SANS }); @*/    osakaScene(c, R.x, R.y, R.w, R.h, 3);
    c.fillStyle = 'rgba(20,14,40,0.55)'; c.fillRect(R.x, R.y + R.h - 40, R.w, 40);
    fit(c, `${RIDE.osaka.title}  ${RIDE.osaka.sub}`, R.x + R.w / 2, R.y + R.h - 20, R.w - 16, 20, '#ffd84a');/*@@*/      // (the pocket town: no Osaka)
  });

/** Every ad card in the car, on one small atlas: `n` cells across. */
export const CAR_AD_CELLS = CAR_ADS.length;
export const carAdsTex = () =>
  tex('carAds', 1024, 192, (c, w, h) => {
    const cw = w / CAR_ADS.length;
    CAR_ADS.forEach((a, i) => {
      const x = i * cw;
      c.save();
      c.beginPath(); c.rect(x, 0, cw, h); c.clip();
      if (/*@mini false && @*//*@@*/a.osaka) {
        osakaScene(c, x, 0, cw, h, 11);
        c.fillStyle = 'rgba(20,14,40,0.6)'; c.fillRect(x, 0, cw, 58);
        fit(c, a.t, x + cw / 2, 20, cw - 10, 22, a.fg);
        fit(c, a.s, x + cw / 2, 44, cw - 10, 16, '#ffffff');
      } else {
        c.fillStyle = a.bg; c.fillRect(x, 0, cw, h);
        c.fillStyle = a.fg; c.globalAlpha = 0.18;
        c.beginPath(); c.arc(x + cw * 0.7, h * 0.55, 48, 0, Math.PI * 2); c.fill();
        c.globalAlpha = 1;
        fit(c, a.t, x + cw / 2, h * 0.34, cw - 12, 24, a.fg, { font: JP_ROUND });
        c.fillStyle = a.fg; c.fillRect(x, h - 48, cw, 48);
        fit(c, a.s, x + cw / 2, h - 24, cw - 10, 17, a.bg);
      }
      c.restore();
      c.fillStyle = '#d8d8dc'; c.fillRect(x, 0, 2, h);
    });
  });

/** 優先席 stickers on the priority seats' windows. */
export const prioritySticker = () =>
  tex('priority', 128, 64, (c, w, h) => {
    c.fillStyle = '#f08a2a'; c.fillRect(0, 0, w, h);
    fit(c, RIDE.car.priority, w / 2, h * 0.4, w - 12, 28, '#ffffff');
    fit(c, 'Priority Seat', w / 2, h * 0.8, w - 12, 12, '#ffffff', { font: SANS });
  });

/* ------------------------------ the station ------------------------------ */

/** 駅名標: the station's name, kana and romaji, the line's band with the neighbours. */
export const nameBoardTex = () =>
  tex('nameBoard', 1024, 320, (c, w, h) => {
    const NB = NAME_BOARD;
    c.fillStyle = '#fbfbf8'; c.fillRect(0, 0, w, h);
    // the station number, in the line's colour
    c.fillStyle = GREEN; c.fillRect(60, 46, 104, 104);
    c.fillStyle = '#ffffff'; c.fillRect(70, 56, 84, 84);
    fit(c, NB.no.slice(0, 2), 112, 80, 70, 30, GREEN, { font: SANS });
    fit(c, NB.no.slice(2), 112, 118, 70, 40, INK, { font: SANS });
    fit(c, NB.kana, w / 2, 48, w * 0.4, 34, INK, { weight: '600' });
    fit(c, STATION.jp, w / 2, 118, w * 0.6, 104, INK);
    fit(c, STATION.romaji, w / 2, 188, w * 0.5, 34, '#4a4a56', { weight: '600', font: SANS });
    // the band
    c.fillStyle = GREEN; c.fillRect(0, 218, w, 62);
    c.fillStyle = PINK; c.fillRect(0, 280, w, 8);
    c.fillStyle = '#ffffff';
    c.beginPath(); c.moveTo(w / 2 - 30, 218); c.lineTo(w / 2 + 30, 218); c.lineTo(w / 2, 246); c.fill();
    for (const [n, x, al, arrow] of [[NB.west, 28, 'left', '◀ '], [NB.east, w - 28, 'right', ' ▶']]) {
      const t = al === 'left' ? `${arrow}${n.kana}` : `${n.kana}${arrow}`;
      fit(c, t, x, 238, w * 0.36, 30, '#ffffff', { align: al });
      fit(c, `${n.en}  ${n.no}`, x + (al === 'left' ? 36 : -36), 266, w * 0.34, 18, '#e8f4ec', { align: al, weight: '600', font: SANS });
    }
    fit(c, n2(NB), w / 2, 304, w * 0.6, 16, '#8a8a94', { weight: '600' });
  });
const n2 = () => `${RIDE.line}  ${RIDE.lineEn}`;

/** The station's name over the entrance. */
export const entranceTex = () =>
  tex('entrance', 1024, 256, (c, w, h) => {
    c.fillStyle = CREAM; c.fillRect(0, 0, w, h);
    c.fillStyle = GREEN; c.fillRect(0, 0, w, 22); c.fillRect(0, h - 22, w, 22);
    c.fillStyle = PINK; c.fillRect(0, h - 30, w, 8);
    fit(c, `${STATION.jp}駅`, w * 0.36, h * 0.5, w * 0.6, 150, INK);
    fit(c, STATION.en, w * 0.835, h * 0.42, w * 0.28, 36, '#5a5a66', { weight: '600' });
    fit(c, LINE.name, w * 0.835, h * 0.66, w * 0.28, 32, GREEN);
  });

export const platformNumberTex = (n) =>
  tex('platNo' + n, 256, 256, (c, w, h) => {
    const d = n === 1 ? D.east : D.west;
    c.fillStyle = NAVY; c.fillRect(0, 0, w, h);
    c.fillStyle = CREAM; c.beginPath(); c.arc(w / 2, h * 0.4, 76, 0, Math.PI * 2); c.fill();
    fit(c, String(n), w / 2, h * 0.42, 120, 124, NAVY, { font: SANS });
    fit(c, `${d.jp} 方面`, w / 2, h * 0.8, w - 20, 34, CREAM);
    fit(c, `for ${d.en}`, w / 2, h * 0.93, w - 20, 20, '#c8d2e8', { weight: '600', font: SANS });
  });

/** 改札口 sign over the gates, with the platforms and where they go. */
export const gateSignTex = () =>
  tex('gateSign', 1024, 192, (c, w, h) => {
    c.fillStyle = NAVY; c.fillRect(0, 0, w, h);
    fit(c, '改札口', w * 0.14, h * 0.46, w * 0.24, 80, CREAM);
    fit(c, 'Ticket Gate', w * 0.14, h * 0.82, w * 0.24, 24, '#c8d2e8', { weight: '600', font: SANS });
    for (const [n, x, d] of [[1, 0.44, D.east], [2, 0.76, D.west]]) {
      c.fillStyle = CREAM; c.beginPath(); c.arc(w * x - 110, h / 2, 34, 0, Math.PI * 2); c.fill();
      fit(c, String(n), w * x - 110, h / 2 + 2, 50, 50, NAVY, { font: SANS });
      fit(c, `${d.jp} 方面`, w * x + 20, h * 0.42, w * 0.22, 48, CREAM);
      fit(c, `for ${d.en}`, w * x + 20, h * 0.76, w * 0.22, 24, '#c8d2e8', { weight: '600', font: SANS });
    }
  });

/** The fare map over the ticket machines: the line, the fares, the through service to Shibuya. */
export const fareMapTex = () =>
  tex('fareMap', 1280, 480, (c, w, h) => {
    c.fillStyle = '#fbf8f0'; c.fillRect(0, 0, w, h);
    c.fillStyle = GREEN; c.fillRect(0, 0, w, 64);
    c.fillStyle = PINK; c.fillRect(0, 64, w, 6);
    fit(c, `${RIDE.line}  きっぷうりば  運賃表`, w * 0.36, 33, w * 0.6, 38, '#ffffff');
    fit(c, 'Fares (yen)', w * 0.86, 33, w * 0.24, 28, '#e8f4ec', { weight: '600', font: SANS });
    // the stations, west to east: the through service beyond 大月 drawn dashed
    const all = [...RIDE.through.map((s) => ({ ...s, jr: true })), ...LINE.stations];
    const y = h * 0.52, x0 = 80, x1 = w - 80;
    const X = (i) => x0 + ((x1 - x0) * i) / (all.length - 1);
    const j0 = RIDE.through.length;
    c.strokeStyle = '#8a8a94'; c.lineWidth = 12; c.setLineDash([22, 12]);
    c.beginPath(); c.moveTo(X(0), y); c.lineTo(X(j0), y); c.stroke();
    c.setLineDash([]);
    c.fillStyle = GREEN; c.fillRect(X(j0), y - 8, X(all.length - 1) - X(j0), 16);
    all.forEach((s, i) => {
      const x = X(i), me = s.jp === STATION.jp;
      c.fillStyle = me ? '#d8302c' : '#ffffff'; c.strokeStyle = s.jr ? '#8a8a94' : GREEN; c.lineWidth = 6;
      c.beginPath(); c.arc(x, y, me ? 24 : 17, 0, Math.PI * 2); c.fill(); c.stroke();
      fit(c, s.jp, x, y - 62, 150, 38, me ? '#d8302c' : INK);
      fit(c, s.en, x, y - 30, 150, 15, '#6a6a74', { weight: '600', font: SANS });
      fit(c, me ? '現在地' : `${s.fare}`, x, y + 52, 140, 38, me ? '#d8302c' : NAVY, { font: me ? JP : SANS });
    });
    // the ribbon: this train runs through to Shibuya
    c.fillStyle = PINK;
    c.beginPath(); c.roundRect(X(0) - 40, h - 118, X(j0) - X(0) + 330, 58, 29); c.fill();
    fit(c, RIDE.throughNote, X(0) + (X(j0) - X(0) + 250) / 2, h - 100, X(j0) - X(0) + 280, 24, '#ffffff');
    fit(c, RIDE.throughNoteEn, X(0) + (X(j0) - X(0) + 250) / 2, h - 74, X(j0) - X(0) + 280, 18, '#fff4f7', { weight: '600', font: SANS });
    fit(c, 'おとな の 運賃（円）  こども は 半額', w * 0.72, h - 88, w * 0.44, 24, '#6a6a74', { weight: '600' });
    fit(c, 'IC運賃 は 1円単位', w * 0.72, h - 56, w * 0.44, 20, '#8a8a94', { weight: '600' });
  });

/** A ticket machine's touch screen. */
export const machineScreenTex = () =>
  tex('machineScreen', 256, 192, (c, w, h) => {
    c.fillStyle = '#e8f0fa'; c.fillRect(0, 0, w, h);
    c.fillStyle = GREEN; c.fillRect(0, 0, w, 34);
    fit(c, 'きっぷ ・ チャージ', w / 2, 18, w - 20, 20, '#ffffff');
    const fares = [160, 180, 230, 310, 520, 'IC'];
    fares.forEach((f, i) => {
      const x = 14 + (i % 3) * 78, y = 46 + Math.floor(i / 3) * 70;
      c.fillStyle = typeof f === 'string' ? '#f2c23c' : '#ffffff'; c.fillRect(x, y, 70, 60);
      c.strokeStyle = '#8fa4c8'; c.lineWidth = 2; c.strokeRect(x, y, 70, 60);
      fit(c, String(f), x + 35, y + 30, 60, 26, INK, { font: SANS });
    });
  });

/** The sign over the ticket machines. */
export const machineSignTex = () =>
  tex('machineSign', 512, 96, (c, w, h) => {
    c.fillStyle = NAVY; c.fillRect(0, 0, w, h);
    fit(c, RIDE.machines.jp, w * 0.3, h * 0.42, w * 0.5, 48, CREAM);
    fit(c, RIDE.machines.en, w * 0.3, h * 0.82, w * 0.5, 18, '#c8d2e8', { weight: '600', font: SANS });
    c.fillStyle = '#f2c23c'; c.beginPath(); c.roundRect(w * 0.62, 18, w * 0.34, h - 36, 10); c.fill();
    fit(c, RIDE.machines.ic, w * 0.79, h / 2, w * 0.3, 26, INK);
  });

/** The ticket office window: our own name, a sakura for its mark. */
export const windowSignTex = () =>
  tex('windowSign', 512, 128, (c, w, h) => {
    c.fillStyle = '#1d6b42'; c.fillRect(0, 0, w, h);
    // the mark: a white disc with a five-petal sakura
    c.fillStyle = '#ffffff'; c.beginPath(); c.arc(64, h / 2, 46, 0, Math.PI * 2); c.fill();
    c.fillStyle = PINK;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
      c.beginPath(); c.ellipse(64 + Math.cos(a) * 18, h / 2 + Math.sin(a) * 18, 15, 11, a, 0, Math.PI * 2); c.fill();
    }
    c.fillStyle = '#fff4a8'; c.beginPath(); c.arc(64, h / 2, 7, 0, Math.PI * 2); c.fill();
    fit(c, RIDE.office.jp, 300, h * 0.4, 340, 56, '#ffffff');
    fit(c, `${RIDE.office.en}  ·  ${RIDE.office.sub}`, 300, h * 0.8, 360, 20, '#d8f0e0', { weight: '600' });
  });

/** The IC reader's plate on a gate: a wave mark in a ring. */
export const icReaderTex = () =>
  tex('icReader', 128, 128, (c, w, h) => {
    c.fillStyle = '#1e7fd8'; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#ffffff'; c.lineWidth = 6;
    c.beginPath(); c.arc(w / 2, h / 2, 50, 0, Math.PI * 2); c.stroke();
    c.lineWidth = 5;
    for (const r of [14, 26, 38]) { c.beginPath(); c.arc(w / 2 - 22, h / 2, r, -0.7, 0.7); c.stroke(); }
    fit(c, 'IC', w / 2 + 16, h / 2 + 2, 50, 34, '#ffffff', { font: SANS });
  });

/** A gate's end: the green arrow (enter) or the red bar (no entry). */
export const gateSignalTex = (ok) =>
  tex('gateSig' + ok, 64, 64, (c, w, h) => {
    c.fillStyle = '#101014'; c.fillRect(0, 0, w, h);
    c.fillStyle = ok ? LGREEN : LRED;
    if (ok) {
      c.beginPath(); c.moveTo(14, 26); c.lineTo(34, 26); c.lineTo(34, 14); c.lineTo(54, 32); c.lineTo(34, 50); c.lineTo(34, 38); c.lineTo(14, 38); c.fill();
    } else {
      c.save(); c.translate(w / 2, h / 2); c.rotate(Math.PI / 4); c.fillRect(-22, -6, 44, 12); c.rotate(Math.PI / 2); c.fillRect(-22, -6, 44, 12); c.restore();
    }
  });

/** 乗車位置: where each door stops, painted on the platform (car-door, 8 marks). */
export const boardingMarkTex = () =>
  tex('boardingMarks', 1024, 96, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    for (let k = 0; k < 8; k++) {
      const x = k * 128, car = Math.floor(k / 4) + 1, door = (k % 4) + 1;
      c.fillStyle = GREEN; c.beginPath(); c.roundRect(x + 6, 30, 116, 60, 10); c.fill();
      // the arrow to the train
      c.beginPath(); c.moveTo(x + 64, 2); c.lineTo(x + 86, 28); c.lineTo(x + 42, 28); c.fill();
      c.fillStyle = PINK; c.fillRect(x + 6, 82, 116, 8);
      fit(c, `${car}号車 ${door}`, x + 64, 56, 104, 30, '#ffffff');
    }
  });

/** 時刻表: departures by hour, both ways. */
export const timetableTex = () =>
  tex('timetable', 512, 640, (c, w, h) => {
    c.fillStyle = '#fbfaf6'; c.fillRect(0, 0, w, h);
    c.fillStyle = NAVY; c.fillRect(0, 0, w, 70);
    fit(c, `${STATION.jp}  時刻表`, w / 2, 36, w - 40, 38, CREAM);
    for (const [col, d] of [[0, D.east], [1, D.west]]) {
      fit(c, `${d.jp} 方面`, w * (0.3 + col * 0.44), 96, w * 0.4, 26, NAVY);
    }
    for (let hr = 6; hr <= 23; hr++) {
      const y = 126 + (hr - 6) * 29;
      c.fillStyle = hr % 2 ? '#f2f0ea' : '#fbfaf6'; c.fillRect(0, y - 14, w, 29);
      fit(c, String(hr), 30, y, 40, 20, INK);
      for (const col of [0, 1]) {
        const mins = [(hr * 7 + col * 3) % 12, 20 + ((hr * 3 + col) % 10), 40 + ((hr * 5 + col * 7) % 12)];
        fit(c, mins.map((m) => String(m).padStart(2, '0')).join('  '), w * (0.3 + col * 0.44), y, w * 0.38, 20, INK, { weight: '500' });
      }
    }
  });

/** The analogue clock face (hands are geometry). */
export const clockFaceTex = () =>
  tex('clockFace', 256, 256, (c, w, h) => {
    c.fillStyle = '#fbfaf6'; c.beginPath(); c.arc(w / 2, h / 2, w / 2 - 4, 0, Math.PI * 2); c.fill();
    c.strokeStyle = INK; c.lineWidth = 8; c.stroke();
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * Math.PI * 2, r0 = i % 5 ? 104 : 92;
      c.lineWidth = i % 5 ? 3 : 8;
      c.beginPath(); c.moveTo(w / 2 + Math.sin(a) * r0, h / 2 - Math.cos(a) * r0); c.lineTo(w / 2 + Math.sin(a) * 114, h / 2 - Math.cos(a) * 114); c.stroke();
    }
  });

/** 周辺案内図: the town round the station, as a simple coloured map. */
export const areaMapTex = () =>
  tex('areaMap', 768, 512, (c, w, h) => {
    c.fillStyle = '#eef2e6'; c.fillRect(0, 0, w, h);
    c.fillStyle = NAVY; c.fillRect(0, 0, w, 60);
    fit(c, `${STATION.jp}駅  周辺案内図`, w / 2, 32, w - 40, 34, CREAM);
    c.fillStyle = '#ffffff';
    for (let i = 0; i < 5; i++) c.fillRect(80 + i * 140, 70, 16, h - 110);
    for (let j = 0; j < 4; j++) c.fillRect(20, 110 + j * 95, w - 40, 14);
    c.fillStyle = '#f2e6a0'; c.fillRect(150, 70, 26, h - 110);                  // the spine
    c.fillStyle = GREEN; c.fillRect(20, h - 44, w - 40, 12);                     // the line
    c.fillStyle = '#d8302c'; c.beginPath(); c.arc(163, h - 60, 12, 0, Math.PI * 2); c.fill();
    fit(c, '現在地', 210, h - 62, 90, 24, '#d8302c');
    const pins = [['コンビニ', 380, 96], ['富士見稲荷', 420, 250], ['ちびっこ広場', 460, 360], ['商店街', 168, 200]];
    for (const [t, x, y] of pins) { c.fillStyle = '#2458b8'; c.fillRect(x - 6, y - 6, 12, 12); fit(c, t, x + 60, y, 110, 20, INK, { align: 'center' }); }
  });

/** Station posters: a festival, a hiking line, manners, where the platforms go. */
export const posterTex = (v) =>
  tex('stPoster' + v, 256, 360, (c, w, h) => {
    const sets = [
      { bg: '#f7d8e2', fg: '#8a2f4a', t: '富士川口湖 桜まつり', s: '4月上旬  駅前ひろば' },
      { bg: '#d8ecf6', fg: '#1f4f7a', t: '富士山麓 ハイキング', s: `${LINE.name}で いこう` },
      { bg: '#f6f0d8', fg: '#6a4a1a', t: 'かけこみ乗車は', s: 'おやめください' },
      { bg: '#e2f2dc', fg: '#2f5a2a', t: 'のりば ご案内', s: `1番線 ${D.east.jp} ・ 2番線 ${D.west.jp}` },
    ];
    const st = sets[v % sets.length];
    c.fillStyle = st.bg; c.fillRect(0, 0, w, h);
    c.fillStyle = st.fg; c.fillRect(0, h - 70, w, 70);
    c.beginPath(); c.arc(w / 2, h * 0.38, 70, 0, Math.PI * 2); c.globalAlpha = 0.25; c.fill(); c.globalAlpha = 1;
    fit(c, st.t, w / 2, h * 0.14, w - 24, 34, st.fg);
    fit(c, st.s, w / 2, h - 35, w - 20, 22, '#ffffff');
  });

export const taxiSignTex = () =>
  tex('taxiSign', 256, 96, (c, w, h) => {
    c.fillStyle = '#f5c428'; c.fillRect(0, 0, w, h);
    fit(c, TAXI, w / 2, h * 0.5, w - 20, 40, INK);
  });

/* ---- the plaza's bus stop (busstop.js): each the size it is read at ---- */

/** The board under the shelter's eave: バスのりば, the stop, the line. */
export const busSignTex = () =>
  tex('busSign', 512, 64, (c, w, h) => {
    c.fillStyle = '#1f5a48'; c.fillRect(0, 0, w, h);
    c.fillStyle = CREAM; c.fillRect(3, 3, w - 6, h - 6);
    c.fillStyle = '#1f5a48'; c.fillRect(6, 6, 150, h - 12);
    fit(c, 'バスのりば', 81, h / 2 + 1, 136, 28, CREAM, { font: JP_ROUND });
    fit(c, BUS.stop, 268, h / 2 + 1, 200, 30, INK, { font: JP_ROUND });
    fit(c, BUS.line, 444, h / 2 + 1, 110, 24, '#c8542c', { font: JP_ROUND });
  });

/** The small plate on the stop pole: the bay and the line. */
export const busBayPlateTex = () =>
  tex('busBay', 256, 72, (c, w, h) => {
    c.fillStyle = '#1f5a48'; c.fillRect(0, 0, w, h);
    c.fillStyle = CREAM; c.beginPath(); c.arc(36, h / 2, 24, 0, Math.PI * 2); c.fill();
    fit(c, BUS.bay, 36, h / 2 + 2, 30, 36, '#1f5a48', { font: SANS });
    fit(c, `${BUS.line} のりば`, 156, h / 2 + 1, 170, 32, CREAM, { font: JP_ROUND });
  });

/** The route map in the shelter: the loop round the town, this stop marked, the fare. */
export const busRouteTex = () =>
  tex('busRoute', 512, 320, (c, w, h) => {
    c.fillStyle = '#fbf8ee'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#1f5a48'; c.fillRect(0, 0, w, 54);
    fit(c, `${BUS.line}  路線図`, w / 2, 28, w - 150, 32, CREAM, { font: JP_ROUND });
    fit(c, BUS.kind, w - 70, 30, 120, 16, '#cfe6d8', { weight: '600' });
    const n = BUS.loop.length, cx = w / 2, cy = 168, rx = 176, ry = 70;
    c.strokeStyle = '#2f8a66'; c.lineWidth = 10;
    c.beginPath(); c.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); c.stroke();
    BUS.loop.forEach((name, i) => {
      const a = -Math.PI / 2 + (i / n) * Math.PI * 2, x = cx + Math.cos(a) * rx, y = cy + Math.sin(a) * ry;
      c.fillStyle = i ? '#fbf8ee' : '#d8302c'; c.strokeStyle = i ? '#2f8a66' : '#8a1f1c'; c.lineWidth = 5;
      c.beginPath(); c.arc(x, y, i ? 11 : 14, 0, Math.PI * 2); c.fill(); c.stroke();
      const out = Math.sin(a) < -0.3 ? -28 : Math.sin(a) > 0.3 ? 30 : 0;
      const sideways = out ? 0 : Math.cos(a) > 0 ? -62 : 62;
      fit(c, name, x + sideways, y + out + (out ? 0 : 0), 104, i ? 20 : 22, i ? INK : '#d8302c', { font: JP_ROUND });
    });
    fit(c, '現在地', cx, cy - ry + 32, 80, 15, '#d8302c', { weight: '600' });
    // which way it goes round
    c.fillStyle = '#2f8a66'; c.beginPath(); c.moveTo(cx + 12, cy + ry - 13); c.lineTo(cx - 12, cy + ry); c.lineTo(cx + 12, cy + ry + 13); c.closePath(); c.fill();
    c.fillStyle = '#e9e2cc'; c.fillRect(0, h - 44, w, 44);
    fit(c, BUS.fare, w / 2, h - 21, w - 40, 22, INK, { weight: '600' });
  });

/** A plain label: a word on a coloured plate (待合室, お手洗い, 交番). */
export const labelTex = (text, bg = CREAM, fg = INK, sub = '') =>
  tex(`label|${text}|${bg}|${fg}|${sub}`, 512, 160, (c, w, h) => {
    c.fillStyle = bg; c.fillRect(0, 0, w, h);
    fit(c, text, w / 2, sub ? h * 0.4 : h / 2, w - 40, 84, fg);
    if (sub) fit(c, sub, w / 2, h * 0.8, w - 40, 26, fg, { weight: '600' });
  });

/* --------------------------- Osaka, coming soon --------------------------- */

/**
 * Dotonbori at night, our own drawing: the canal between two walls of
 * neon, the tall signboards, a big red crab over a restaurant (no name on
 * it), a bridge across, the lights running down into the water.
 */
function osakaScene(c, x, y, w, h, seed = 1) {
  let s = seed * 9301 + 49297;
  const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  c.save();
  c.beginPath(); c.rect(x, y, w, h); c.clip();
  const sky = c.createLinearGradient(0, y, 0, y + h * 0.7);
  sky.addColorStop(0, '#20145a'); sky.addColorStop(0.6, '#6a2f8e'); sky.addColorStop(1, '#c0508e');
  c.fillStyle = sky; c.fillRect(x, y, w, h);
  const water = y + h * 0.7;
  const cx = x + w * 0.5;
  const neon = ['#ff4fa3', '#ffd84a', '#4ff0ff', '#ff7a3a', '#8aff6a', '#ffffff', '#b58aff'];
  // far buildings: a skyline of lit blocks down the canal
  for (let i = 0; i < 12; i++) {
    const bx = cx - w * 0.18 + (i / 12) * w * 0.36, bw = w * 0.035, top = y + h * (0.36 + r() * 0.1);
    c.fillStyle = '#4a3278'; c.fillRect(bx, top, bw, water - top);
    c.fillStyle = neon[i % neon.length]; c.globalAlpha = 0.8; c.fillRect(bx, top + 4, bw, 3); c.globalAlpha = 1;
  }
  // the two banks, stepping back toward the far end
  for (const side of [-1, 1]) {
    for (let k = 5; k >= 0; k--) {
      const t = k / 6;
      const edge = cx + side * (w * 0.52 - t * w * 0.34);
      const bw = w * (0.22 - t * 0.025);
      const top = y + h * (0.05 + t * 0.2 + r() * 0.06);
      const bx0 = side < 0 ? edge - bw * 0.2 : edge - bw * 0.8;
      c.fillStyle = k % 2 ? '#3a2868' : '#4c3480';
      c.fillRect(bx0, top, bw, water - top);
      // rows of lit windows
      c.fillStyle = 'rgba(255,214,150,0.75)';
      for (let yy = top + 8; yy < water - 16; yy += 11) for (let xx = bx0 + 4; xx < bx0 + bw - 6; xx += 9) if (r() < 0.45) c.fillRect(xx, yy, 4, 5);
      // neon bands across the front
      for (let b = 0; b < 3; b++) {
        c.fillStyle = neon[(k + b * 2 + (side > 0 ? 1 : 0)) % neon.length];
        c.fillRect(bx0, top + (water - top) * (0.3 + b * 0.22), bw, Math.max(2, h * 0.008));
      }
      // a tall signboard standing off the building, lit
      const sw = Math.max(10, bw * 0.34), sh = (water - top) * 0.7;
      const sx = side < 0 ? bx0 + bw - sw * 0.6 : bx0 - sw * 0.4;
      const col = neon[(k * 3 + (side > 0 ? 2 : 0)) % neon.length];
      const inv = (k + (side > 0 ? 1 : 0)) % 2 === 0;
      c.fillStyle = col; c.fillRect(sx - 2, top + 4, sw + 4, sh + 4);
      c.fillStyle = inv ? col : '#1a1030'; c.fillRect(sx, top + 6, sw, sh);
      const word = RIDE.osaka.neon[(k * 2 + (side > 0 ? 1 : 0)) % RIDE.osaka.neon.length];
      const fs = Math.min(sw - 4, (sh - 8) / Math.max(2, word.length) - 1);
      c.fillStyle = inv ? '#1a1030' : col;
      c.font = `bold ${fs}px ${JP}`; c.textAlign = 'center'; c.textBaseline = 'top';
      [...word].forEach((ch, i) => c.fillText(ch, sx + sw / 2, top + 10 + i * (fs + 1)));
    }
  }
  // a big lit billboard over the right bank
  {
    const bw = w * 0.26, bh = h * 0.12, bx = x + w * 0.66, by = y + h * 0.1;
    c.fillStyle = '#ffd84a'; c.fillRect(bx - 3, by - 3, bw + 6, bh + 6);
    const gr = c.createLinearGradient(bx, 0, bx + bw, 0);
    gr.addColorStop(0, '#ff4fa3'); gr.addColorStop(1, '#ff7a3a');
    c.fillStyle = gr; c.fillRect(bx, by, bw, bh);
    fit(c, 'たこ焼', bx + bw / 2, by + bh / 2, bw - 8, bh * 0.8, '#ffffff');
  }
  // the crab over the nearest restaurant, left: a big friendly red crab, no lettering
  crab(c, x + w * 0.2, y + h * 0.2, w * 0.15);
  // the bridge across the canal, lit along its rail
  c.fillStyle = '#2a1a4a';
  c.beginPath(); c.moveTo(x + w * 0.1, water - h * 0.015); c.quadraticCurveTo(cx, water - h * 0.11, x + w * 0.9, water - h * 0.015);
  c.lineTo(x + w * 0.9, water + h * 0.01); c.quadraticCurveTo(cx, water - h * 0.08, x + w * 0.1, water + h * 0.01); c.fill();
  c.fillStyle = '#ffe6a0';
  for (let i = 0; i <= 16; i++) {
    const u = i / 16, bxp = x + w * (0.1 + 0.8 * u), byp = water - h * 0.015 - Math.sin(Math.PI * u) * h * 0.047;
    c.beginPath(); c.arc(bxp, byp - 2, Math.max(1.5, h * 0.006), 0, Math.PI * 2); c.fill();
  }
  // the canal, and every light running down into it
  const wg = c.createLinearGradient(0, water, 0, y + h);
  wg.addColorStop(0, '#3a2068'); wg.addColorStop(1, '#160c30');
  c.fillStyle = wg; c.fillRect(x, water, w, y + h - water);
  for (let i = 0; i < 46; i++) {
    const rx = x + r() * w, rl = h * (0.05 + r() * 0.24);
    c.fillStyle = neon[i % neon.length]; c.globalAlpha = 0.7;
    for (let j = 0; j < rl; j += 4) c.fillRect(rx + Math.sin(j * 0.45) * 3, water + 3 + j, 3 + r() * 5, 2);
  }
  c.globalAlpha = 1;
  // lanterns strung along the near walk
  for (let i = 0; i < 14; i++) {
    const lx = x + (i + 0.5) * (w / 14), ly = water + h * 0.02 + Math.sin((i / 13) * Math.PI) * h * 0.02;
    c.fillStyle = i % 2 ? '#ff5a4a' : '#fff0d0';
    c.beginPath(); c.ellipse(lx, ly, Math.max(2, w * 0.011), Math.max(3, h * 0.016), 0, 0, Math.PI * 2); c.fill();
  }
  c.restore();
}

function crab(c, x, y, s) {
  c.save();
  c.translate(x, y);
  c.strokeStyle = '#e8321e'; c.lineCap = 'round';
  // legs, four a side
  c.lineWidth = s * 0.08;
  for (const side of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const a = side * (0.3 + i * 0.28);
      c.beginPath(); c.moveTo(side * s * 0.4, s * 0.05 * i);
      c.lineTo(side * s * (0.75 + i * 0.05), -s * 0.1 + s * 0.12 * i);
      c.lineTo(side * s * (0.95 + i * 0.04), s * (0.25 + 0.1 * i) + a * 0.01);
      c.stroke();
    }
    // the big claws, raised
    c.lineWidth = s * 0.1;
    c.beginPath(); c.moveTo(side * s * 0.3, -s * 0.2); c.lineTo(side * s * 0.55, -s * 0.6); c.stroke();
    c.fillStyle = '#ff4a2a';
    c.beginPath(); c.ellipse(side * s * 0.6, -s * 0.78, s * 0.16, s * 0.24, side * 0.3, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#1a1030';
    c.beginPath(); c.moveTo(side * s * 0.6, -s * 0.95); c.lineTo(side * s * 0.66, -s * 0.72); c.lineTo(side * s * 0.54, -s * 0.72); c.fill();
  }
  // the shell
  c.fillStyle = '#ff4a2a';
  c.beginPath(); c.ellipse(0, 0, s * 0.5, s * 0.34, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#ff8a5a';
  c.beginPath(); c.ellipse(-s * 0.12, -s * 0.1, s * 0.22, s * 0.1, -0.2, 0, Math.PI * 2); c.fill();
  // eyes on stalks
  for (const side of [-1, 1]) {
    c.fillStyle = '#ff4a2a'; c.fillRect(side * s * 0.12 - s * 0.03, -s * 0.5, s * 0.06, s * 0.2);
    c.fillStyle = '#ffffff'; c.beginPath(); c.arc(side * s * 0.12, -s * 0.52, s * 0.07, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#1a1030'; c.beginPath(); c.arc(side * s * 0.12, -s * 0.52, s * 0.035, 0, Math.PI * 2); c.fill();
  }
  c.restore();
}

/**
 * The Osaka teaser: 'tall' (a B1 on a wall), 'wide' (the concourse's big
 * one, and the board at the Deer Park gate).
 */
export const osakaPosterTex = (shape = 'tall') =>
  tex('osaka' + shape, shape === 'tall' ? 512 : 1024, shape === 'tall' ? 720 : 640, (c, w, h) => {
    const O = RIDE.osaka;
    c.fillStyle = '#fbf6ea'; c.fillRect(0, 0, w, h);
    if (shape === 'tall') {
      osakaScene(c, 0, h * 0.2, w, h * 0.62, 5);
      // title block
      c.fillStyle = '#1a1240'; c.fillRect(0, 0, w, h * 0.2);
      fit(c, O.title, w / 2, h * 0.075, w - 40, 64, '#ffd84a');
      c.fillStyle = PINK; c.beginPath(); c.roundRect(w * 0.14, h * 0.125, w * 0.72, h * 0.06, 20); c.fill();
      fit(c, O.sub, w / 2, h * 0.155, w * 0.68, 34, '#ffffff');
      // 道頓堀 down the right, brushed, on a lantern-red strip
      c.fillStyle = 'rgba(200,40,40,0.9)'; c.fillRect(w - 86, h * 0.24, 66, h * 0.4);
      c.fillStyle = '#fff4e0'; c.font = `64px ${JP_BRUSH}`; c.textAlign = 'center'; c.textBaseline = 'middle';
      [...O.place].forEach((ch, i) => c.fillText(ch, w - 53, h * 0.3 + i * 76));
      // the foot: the teaser line, the English, coming soon
      c.fillStyle = '#fbf6ea'; c.fillRect(0, h * 0.82, w, h * 0.18);
      fit(c, O.teaser, w / 2, h * 0.855, w - 40, 34, '#1a1240', { font: JP_ROUND });
      fit(c, O.en, w / 2, h * 0.905, w - 40, 22, '#4a3a6a', { weight: '600', font: SANS });
      c.fillStyle = GREEN; c.fillRect(0, h * 0.94, w, h * 0.06);
      fit(c, `${O.soon}  ·  ${RIDE.line}`, w / 2, h * 0.97, w - 40, 22, '#ffffff', { font: SANS });
    } else {
      osakaScene(c, w * 0.34, 0, w * 0.66, h * 0.86, 7);
      c.fillStyle = '#1a1240'; c.fillRect(0, 0, w * 0.34, h);
      fit(c, '大阪行き', w * 0.17, h * 0.16, w * 0.3, 84, '#ffd84a');
      fit(c, 'きっぷ', w * 0.17, h * 0.3, w * 0.3, 72, '#ffd84a');
      c.fillStyle = PINK; c.beginPath(); c.roundRect(w * 0.025, h * 0.4, w * 0.29, h * 0.1, 24); c.fill();
      fit(c, O.sub, w * 0.17, h * 0.45, w * 0.26, 44, '#ffffff');
      fit(c, O.teaser, w * 0.17, h * 0.6, w * 0.3, 34, '#f0e8ff', { font: JP_ROUND });
      fit(c, 'Tickets to Osaka', w * 0.17, h * 0.71, w * 0.3, 34, '#ffffff', { font: SANS });
      fit(c, 'reservations open soon', w * 0.17, h * 0.77, w * 0.3, 26, '#d8d0f0', { weight: '600', font: SANS });
      // 道頓堀 over the scene, brushed
      c.fillStyle = 'rgba(200,40,40,0.9)'; c.beginPath(); c.roundRect(w * 0.83, h * 0.06, w * 0.13, h * 0.5, 10); c.fill();
      c.fillStyle = '#fff4e0'; c.font = `80px ${JP_BRUSH}`; c.textAlign = 'center'; c.textBaseline = 'middle';
      [...O.place].forEach((ch, i) => c.fillText(ch, w * 0.895, h * 0.14 + i * 92));
      c.fillStyle = GREEN; c.fillRect(0, h * 0.86, w, h * 0.14);
      c.fillStyle = PINK; c.fillRect(0, h * 0.86, w, 8);
      fit(c, O.soon, w * 0.17, h * 0.93, w * 0.3, 44, '#ffffff', { font: SANS });
      fit(c, `${RIDE.line}  →  ${STATION.jp}  →  大阪`, w * 0.66, h * 0.93, w * 0.6, 36, '#ffffff');
    }
  });

/* --------------------------- the Pokémon train --------------------------- */

/**
 * One page for the whole Pokémon livery (emu.js maps the body onto it by
 * planar projection).  Layout (POKE_ART, in page pixels):
 *   rows A and B (rowH each, from the top): the two cars' sides, the car's
 *     length across the full width, from 0.2 m under the floor to the
 *     roof line (y0..y1)
 *   `front`: the nose panel under the cab windows
 *   `ceiling`: cream with silhouettes;  `floor`: yellow with paw prints
 *   `swatch`: the bottom strip of flat colours for parts that share the
 *     material (the door leaves' rubber and sticker)
 */
export const POKE_ART = {
  w: 4096, h: 1024, rowH: 368, y0: 0.86, y1: 3.85,           // car y -> row v (211 px/m along, 123 px/m up: 21 MB with mips; Tan chose crisp)
  front: { x: 0, y: 736, w: 1024, h: 264 },
  ceiling: { x: 1024, y: 736, w: 2048, h: 264 },
  floor: { x: 3072, y: 736, w: 1024, h: 264 },
  swatch: { y: 1000, h: 24, w: 64, colours: ['#f9d83b', '#8a4a1c', '#24242c', '#ffe66a', '#f2c23c', '#6b4a2c', '#f6f4ee', '#e8362a'] },
};
export const pokeArtTex = () =>
  tex('pokeArt', POKE_ART.w, POKE_ART.h, (c, w, h) => {
    const A = POKE_ART, Y = '#f5c832', BR = PIKA.brown;         // the body's yellow (emu.js TYPES.poke.steel); the figures are brighter
    const ppm = w / 19.4, pym = A.rowH / (A.y1 - A.y0);       // pixels per metre, across and up
    const X = (xm) => (xm + 9.7) * ppm;                         // car x (m) -> page x
    const rowY = (row, ym) => row * A.rowH + (A.y1 - ym) * pym; // car y (m) -> page y in a row
    c.fillStyle = Y; c.fillRect(0, 0, w, h);
    // the two sides
    for (const row of [0, 1]) {
      const y = (ym) => rowY(row, ym);
      const seed = row * 7 + 3;
      // the brown skirt band under the floor line, and Pikachu's back stripes over it
      c.fillStyle = BR; c.fillRect(0, y(1.06), w, y(0.86) - y(1.06));
      c.fillStyle = PIKA.yellowLo; c.fillRect(0, y(1.2), w, y(1.06) - y(1.2));
      /* the parade under the windows: full-colour figures on white and pastel
       * clouds, in the solid runs between the doors (a leaf's art rides with
       * it, so nothing that matters sits on a door); the wordmark in the middle */
      const runsA = [[-8.68, 1.9], [-4.7, 3.2], [4.7, 3.2], [8.68, 1.9]];
      const cast = row
        ? [['pikachu', 'cheer'], ['eevee', null, 'pikachu', 'sit'], ['pikachu', 'wave', 'bulbasaur', null], ['piplup', null]]
        : [['pikachu', 'wave'], ['piplup', null, 'pikachu', 'cheer'], ['pikachu', 'sit', 'eevee', null], ['bulbasaur', null]];
      const pastel = ['#ffffff', '#dff1ff', '#ffe4ee', '#e6f6dc'];
      const draw = (kind, pose, xm, ym, s, dir) => {
        if (kind === 'pikachu') pikachu(c, X(xm), y(ym), s * pym, { pose, dir });
        else if (kind === 'eevee') eevee(c, X(xm), y(ym), s * pym, { dir });
        else if (kind === 'piplup') piplup(c, X(xm), y(ym), s * pym, { dir });
        else bulbasaur(c, X(xm), y(ym), s * pym, { dir });
      };
      runsA.forEach(([cx, wm], i) => {
        const who = cast[i];
        cloud(c, X(cx), y(1.54), wm * 0.98 * ppm, 0.92 * pym, pastel[(i + row) % pastel.length]);
        if (who.length === 2) draw(who[0], who[1], cx, 1.1, 0.92, cx < 0 ? 1 : -1);
        else {
          draw(who[0], who[1], cx - wm * 0.25, 1.1, 0.88, 1);
          draw(who[2], who[3], cx + wm * 0.25, 1.1, 0.9, -1);
        }
      });
      // over each door: a Poké Ball between two bolts; over the wide windows, a peeking Pikachu on a cloud
      for (const d of [-7.0, -2.4, 2.4, 7.0]) {
        pokeball(c, X(d), y(3.3), 0.19 * pym);
        for (const e of [-1, 1]) bolt(c, X(d + e * 0.45), y(3.3), 0.36 * pym, e * (row ? 1 : -1) > 0 ? '#ffffff' : BR, e * 0.2);
      }
      for (const [bx, dir] of [[-4.7, 1], [0, row ? -1 : 1], [4.7, -1]]) {
        cloud(c, X(bx), y(3.34), 1.3 * ppm, 0.4 * pym, '#ffffff');
        pikachu(c, X(bx), y(3.14), 0.62 * pym, { pose: 'peek', dir });
      }
      // the wordmark under the middle window, and paw prints running to it
      c.save();
      // under the middle window, between the two inner doors (x ±1.74): sized to fit
      const word = 'POKÉMON with YOU', wx = X(0), wy = y(1.62);
      let fs = 0.36 * pym;
      do { c.font = `900 ${Math.round(fs)}px ${SANS}`; fs -= 2; } while (c.measureText(word).width > 3.2 * ppm && fs > 10);
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillStyle = '#ffffff'; c.beginPath(); c.roundRect(X(-1.66), y(1.98), 3.32 * ppm, 0.86 * pym, 0.2 * pym); c.fill();
      c.lineJoin = 'round'; c.lineWidth = 0.07 * pym; c.strokeStyle = BR; c.fillStyle = '#e8362a';
      c.strokeText(word, wx, wy); c.fillText(word, wx, wy);
      c.restore();
      pokeball(c, X(-1.3), y(1.26), 0.1 * pym); pokeball(c, X(1.3), y(1.26), 0.1 * pym);
      for (let k = 0; k < 5; k++) pawprint(c, X(-0.9 + k * 0.45), y(1.24 + (k % 2) * 0.06), 0.05 * pym, BR);
    }
    // the front panel: the face, big, with a Poké Ball either side
    {
      const F = A.front;
      c.fillStyle = Y; c.fillRect(F.x, F.y, F.w, F.h);
      c.fillStyle = BR; c.fillRect(F.x, F.y + F.h - 30, F.w, 30);
      pikachu(c, F.x + F.w * 0.5, F.y + F.h + 10, F.h * 2.6, { pose: 'peek' });
      pokeball(c, F.x + F.w * 0.11, F.y + F.h * 0.6, F.h * 0.2);
      pokeball(c, F.x + F.w * 0.89, F.y + F.h * 0.6, F.h * 0.2);
    }
    // the ceiling: cream, with silhouettes of Pikachu and Poké Balls
    {
      const C2 = A.ceiling;
      c.fillStyle = '#f5efe2'; c.fillRect(C2.x, C2.y, C2.w, C2.h);
      const n = Math.floor(C2.w / 220);
      for (let k = 0; k < n; k++) {
        const x = C2.x + 70 + k * (C2.w / n), up = k % 2 ? 1 : -1;
        pikachu(c, x, C2.y + C2.h * (up > 0 ? 0.92 : 0.6), 150, { pose: ['wave', 'sit', 'cheer', 'stand'][k % 4], silhouette: '#c9b98e', dir: up });
        pokeball(c, x + 110, C2.y + C2.h * 0.5, 34, { silhouette: '#c9b98e' });
      }
    }
    // the floor: yellow with paw prints wandering along it
    {
      const F = A.floor;
      c.fillStyle = '#f0c93a'; c.fillRect(F.x, F.y, F.w, F.h);
      const np = Math.floor(F.w / 82);
      for (let k = 0; k < np; k++) pawprint(c, F.x + 40 + k * (F.w / np), F.y + F.h * (0.3 + 0.4 * (k % 2)), 34, '#a8761e');
      for (let k = 0; k < Math.floor(F.w / 250); k++) bolt(c, F.x + 140 + k * 250, F.y + F.h * 0.5, 160, 'rgba(255,255,255,0.4)', 0.3);
    }
    // the swatches
    A.swatch.colours.forEach((col, k) => { c.fillStyle = col; c.fillRect(k * A.swatch.w, A.swatch.y, A.swatch.w, A.swatch.h); });
  });
