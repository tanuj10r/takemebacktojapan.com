import { MOBILE_STRINGS as M } from '../data/strings.js';
import { TUNE, lookGain } from './controls/tune.js';

/* ------------------------------------------------------------------ *
 * Touch (docs/decisions/mobile-lite.md, "Mobile v3: UI"): the left thumb
 * walks, the right thumb looks, and the two never get in each other's way.
 *
 *   stick  a base you can always see, resting bottom left with a thumb on
 *          it.  A touch anywhere in the left TUNE.stick.zone of the screen
 *          (below its top strip) brings the base to the thumb; the knob
 *          follows to a full push at `radius`, and past `follow` radii the
 *          base trails the thumb, so the stick is never lost.  On the lift
 *          it glides home.  player.stick gets the push, 0..1 past the dead
 *          zone; player.js eases it into a stroll, a walk and (a full push
 *          held) a run, which lights the ring.
 *   look   every other touch drags the view, each on its own (two at once
 *          add up).  1:1, lifted a little for a flick (tune.js lookGain),
 *          from the finger's own timestamps and every coalesced sample, so
 *          a 60 Hz and a 120 Hz screen turn the same.  A flick's lift
 *          glides on a moment (player.flick).
 *   tap    a quick, still touch on the view: onTap(x, y).
 *   hints  "Walk" under the stick and "Drag to look" on the right, until
 *          each has been done once.
 *
 * The buttons (hud.js) take their own touches and stop them there, so a
 * thumb on the stick, a drag and a button tap are all independent.
 * Pointer events, so a mouse on a computer drags the view too.  The page
 * never scrolls, zooms or selects under the game: touch-action none
 * (m.html), and iOS's own pinch (gesturestart) and double-tap zoom are
 * stopped here.
 * ------------------------------------------------------------------ */

const CHEVRON = '<svg viewBox="0 0 132 132" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">'
  + '<path d="M58 17l8-7 8 7"/><path d="M58 115l8 7 8-7"/><path d="M17 58l-7 8 7 8"/><path d="M115 58l7 8-7 8"/></g></svg>';
const SWIPE = '<svg viewBox="0 0 48 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
  + '<path d="M9 12h30M14 7l-5 5 5 5M34 7l5 5-5 5"/></g><circle cx="24" cy="12" r="4.2" fill="currentColor"/></svg>';

export function createTouch(player, { surface = document.body, isPlaying = () => true, onTap = null, onDrag = null, onHold = null, onStick = null, parent = document.body } = {}) {
  const S = TUNE.stick, L = TUNE.look, TAP = TUNE.tap;
  const R = S.radius, B = S.base, K = S.knob;
  const style = document.createElement('style');
  style.textContent = `
    .stick, .knob, .look-hint { position: fixed; z-index: 5; left: 0; top: 0; pointer-events: none; opacity: 0; visibility: hidden; }
    .stick { width: ${B}px; height: ${B}px; margin: -${B / 2}px 0 0 -${B / 2}px; border-radius: 50%; color: rgba(255,255,255,.78);
      background: radial-gradient(circle, rgba(43,37,66,.06) 0 36%, rgba(43,37,66,.2) 78%, rgba(43,37,66,.3) 100%);
      box-shadow: inset 0 0 0 2px rgba(255,255,255,.72), 0 0 0 1px rgba(43,37,66,.22), 0 6px 22px rgba(20,12,40,.2);
      transition: opacity .3s ease, transform .28s cubic-bezier(.2,.8,.3,1), box-shadow .25s ease, color .25s ease; will-change: transform; }
    .stick svg { display: block; width: 100%; height: 100%; }
    .stick b { position: absolute; left: 50%; top: 100%; transform: translate(-50%, 8px); padding: 3px 10px; border-radius: 999px; white-space: nowrap;
      background: rgba(43,37,66,.62); color: #fff; font: 700 10.5px/1.3 -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      letter-spacing: .14em; text-transform: uppercase; transition: opacity .5s ease; }
    .stick.used b, .look-hint.used { opacity: 0 !important; }
    .knob { width: ${K}px; height: ${K}px; margin: -${K / 2}px 0 0 -${K / 2}px; border-radius: 50%;
      background: radial-gradient(circle at 50% 38%, #fff, #f1ebf5 70%, #ddd3e6);
      box-shadow: 0 4px 14px rgba(20,12,40,.38), inset 0 -2px 0 rgba(43,37,66,.1), 0 0 0 1px rgba(43,37,66,.14);
      transition: opacity .3s ease, transform .28s cubic-bezier(.2,.8,.3,1); will-change: transform; }
    .stick.show, .knob.show, .look-hint.show { visibility: visible; }
    .stick.show { opacity: .62; } .knob.show { opacity: .8; }
    .stick.on { opacity: 1; transition: opacity .1s ease, box-shadow .25s ease, color .25s ease; }
    .knob.on { opacity: 1; transition: opacity .1s ease; }
    .stick.run { color: #ffe08a; box-shadow: inset 0 0 0 3px rgba(255,214,120,.98), 0 0 0 1px rgba(120,84,10,.3), 0 0 22px rgba(255,205,96,.6); }
    .look-hint { left: ${S.side === 'right' ? 'max(26px, calc(var(--safe-l, 0px) + 18px))' : 'auto'}; top: auto; right: ${S.side === 'right' ? 'auto' : 'max(26px, calc(var(--safe-r, 0px) + 18px))'}; bottom: max(54px, calc(var(--safe-b, 0px) + 44px));
      display: flex; align-items: center; gap: 8px; padding: 7px 14px 7px 10px; border-radius: 999px; background: rgba(43,37,66,.62); color: #fff;
      font: 700 10.5px/1.3 -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; letter-spacing: .14em; text-transform: uppercase;
      transition: opacity .5s ease; }
    .look-hint.show { opacity: 1; }
    .look-hint svg { width: 34px; height: 17px; flex: none; animation: look-nudge 2.2s ease-in-out infinite; }
    @keyframes look-nudge { 0%, 100% { transform: translateX(-3px); } 50% { transform: translateX(3px); } }
    body.map-open .stick, body.map-open .knob, body.map-open .look-hint { opacity: 0; }
    @media (prefers-reduced-motion: reduce) { .look-hint svg { animation: none; } .stick, .knob { transition: opacity .3s ease; } }
  `;
  document.head.appendChild(style);
  const base = document.createElement('div');
  base.className = 'stick';
  base.innerHTML = `${CHEVRON}<b>${M.hints.walk}</b>`;
  const knob = document.createElement('div');
  knob.className = 'knob';
  const hint = document.createElement('div');
  hint.className = 'look-hint';
  hint.innerHTML = `${SWIPE}<span>${M.hints.look}</span>`;
  parent.append(base, knob, hint);

  let stickId = null, cx = 0, cy = 0, shown = false, lookedPx = 0;
  let holdTimer = 0, holding = null;
  const looks = new Map();          // pointerId -> { x, y, t, v, n, x0, y0, t0, moved, trail }
  const vw = () => window.innerWidth, vh = () => window.innerHeight;
  // where the stick rests when no thumb is on it: bottom left, inside the safe area
  let insets = null;               // the safe area, measured once per screen size
  // (read each time: the portrait panel switches schemes, and with them the stick's side and rest, panel.js)
  const rest = () => { const right = S.side === 'right'; insets ??= { l: safe('l'), r: safe('r'), b: safe('b') }; return [right ? vw() - S.rest[0] - insets.r : S.rest[0] + (S.restAbs ? 0 : insets.l), vh() - S.rest[1] - (S.restAbs ? 0 : insets.b)]; };
  const place = (el, x, y) => { el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`; };
  const home = () => { const [x, y] = rest(); cx = x; cy = y; place(base, x, y); place(knob, x, y); };
  const show = (on) => {
    shown = on;
    for (const el of S.off ? [hint] : [base, knob, hint]) el.classList.toggle('show', on);
    if (on) home();
  };

  const inStickZone = (x, y) => {
    if (S.fixed) { const [hx, hy] = rest(); return Math.hypot(x - hx, y - hy) < (B / 2) * S.grab; }
    return (S.side === 'right' ? x > vw() * (1 - S.zone) : x < vw() * S.zone) && y > vh() * S.top;
  };

  function stickMove(x, y) {
    let dx = x - cx, dy = y - cy;
    let d = Math.hypot(dx, dy);
    // past `follow` radii the base comes along behind the thumb
    const F = R * S.follow;
    if (d > F && !S.fixed) { cx += dx * (1 - F / d); cy += dy * (1 - F / d); dx = x - cx; dy = y - cy; d = F; place(base, cx, cy); }
    const k = Math.min(1, d / R);
    const kx = d > R ? dx * R / d : dx, ky = d > R ? dy * R / d : dy;
    place(knob, cx + kx, cy + ky);
    // the dead zone, then the rest of the push
    const push = k < S.dead ? 0 : (k - S.dead) / (1 - S.dead);
    const a = Math.atan2(dy, dx);
    player.stick.x = Math.cos(a) * push;
    player.stick.y = Math.sin(a) * push;
  }

  surface.addEventListener('pointerdown', (e) => {
    if (!isPlaying()) return;
    // (the portrait panel: the surface is the whole page; its buttons are their own, and only the picture looks)
    if (surface !== e.target && e.target.closest?.('button, a, .pp-pad, .mh, .fullmap')) return;
    const onPicture = !e.target.closest?.('.pp');
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (!S.off && stickId === null && e.pointerType !== 'mouse' && inStickZone(e.clientX, e.clientY)) {
      stickId = e.pointerId;
      // the base comes to the thumb (kept whole on the screen); a fixed stick stays where it rests
      if (S.fixed) [cx, cy] = rest();
      else {
        cx = Math.min(Math.max(e.clientX, B / 2 + 4), vw() - B / 2 - 4);
        cy = Math.min(Math.max(e.clientY, B / 2 + 4), vh() - B / 2 - 4);
      }
      for (const el of [base, knob]) { el.style.transition = 'opacity .1s ease'; el.classList.add('on'); }
      place(base, cx, cy);
      player.stick.held = true;
      onStick?.();
      stickMove(e.clientX, e.clientY);
      base.classList.add('used');
    } else if (onPicture) {
      const t = e.timeStamp || performance.now();
      looks.set(e.pointerId, { x: e.clientX, y: e.clientY, t, v: 0, n: 0, x0: e.clientX, y0: e.clientY, t0: t, moved: 0, trail: [] });
      // the hold scheme (panel.js): a finger kept on the picture a moment walks you on while it stays (it still looks)
      if (onHold && looks.size === 1) { const id = e.pointerId; holdTimer = setTimeout(() => { if (looks.has(id) && isPlaying()) { holding = id; onHold(true); } }, 180); }
      player._glide.yaw = player._glide.pitch = 0;            // a new touch stops a glide
    }
    try { surface.setPointerCapture?.(e.pointerId); } catch { /* fine */ }
    e.preventDefault();
  });

  surface.addEventListener('pointermove', (e) => {
    if (e.pointerId === stickId) { stickMove(e.clientX, e.clientY); return; }
    const l = looks.get(e.pointerId);
    if (!l) return;
    // every step of the finger, not only the last of the frame: the speed (and so the gain) is the finger's own
    const evs = e.getCoalescedEvents?.() ?? [];
    const list = evs.length ? evs : [e];
    let ax = 0, ay = 0;
    for (const p of list) {
      const dx = p.clientX - l.x, dy = p.clientY - l.y;
      if (!dx && !dy) continue;
      const t = p.timeStamp || performance.now();
      const dtm = Math.max(3, t - l.t);
      const v = Math.hypot(dx, dy) / dtm;
      l.v = l.n++ ? l.v * L.smooth + v * (1 - L.smooth) : v;     // (the first sample sets it: a short flick is only a few)
      const g = lookGain(l.v);
      ax += dx * g; ay += dy * g;
      l.moved += Math.abs(dx) + Math.abs(dy);
      l.x = p.clientX; l.y = p.clientY; l.t = t;
      l.trail.push(t, dx * g, dy * g);
      if (l.trail.length > 36) l.trail.splice(0, 3);
    }
    if (ax || ay) {
      if (l.moved > TAP.px) onDrag?.();
      player.look(ax, ay);
      lookedPx += Math.abs(ax) + Math.abs(ay);
      if (lookedPx > 160) hint.classList.add('used');
    }
  });

  const end = (e) => {
    if (e.pointerId === stickId) {
      stickId = null;
      player.stick.x = player.stick.y = 0; player.stick.held = false;
      for (const el of [base, knob]) { el.style.transition = ''; el.classList.remove('on'); }
      base.classList.remove('run');
      if (shown) home();
      return;
    }
    const l = looks.get(e.pointerId);
    if (!l) return;
    looks.delete(e.pointerId);
    clearTimeout(holdTimer);
    if (holding === e.pointerId) { holding = null; onHold?.(false); return; }
    const now = e.timeStamp || performance.now();
    // a tap: quick and still, on the view
    if (e.type === 'pointerup' && onTap && isPlaying() && now - l.t0 < TAP.ms
      && Math.hypot(e.clientX - l.x0, e.clientY - l.y0) < TAP.px && l.moved < TAP.px * 2) { onTap(e.clientX, e.clientY); return; }
    // a flick: the finger was still moving as it lifted; the view glides on a moment
    if (e.type !== 'pointerup' || looks.size || now - l.t > 45) return;
    let sx = 0, sy = 0, t0 = now;
    for (let i = l.trail.length - 3; i >= 0; i -= 3) {
      if (now - l.trail[i] > L.glideWindow) break;
      sx += l.trail[i + 1]; sy += l.trail[i + 2]; t0 = l.trail[i];
    }
    const span = Math.max(16, now - t0 + 8);
    player.flick(sx / span * 1000, sy / span * 1000);
  };
  surface.addEventListener('pointerup', end);
  surface.addEventListener('pointercancel', end);
  surface.addEventListener('lostpointercapture', (e) => { if (looks.has(e.pointerId) || e.pointerId === stickId) end(e); });

  // iOS: no pinch, no double-tap zoom, no rubber-band scroll
  for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(ev, (e) => e.preventDefault(), { passive: false });
  document.addEventListener('touchmove', (e) => { if (e.cancelable && !e.target.closest?.('.scroll-ok, .fullmap, .mk-post-scrim')) e.preventDefault(); }, { passive: false });
  document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });
  document.addEventListener('contextmenu', (e) => { if (!e.target.closest?.('a')) e.preventDefault(); });

  // the run shows on the stick's ring (player.js decides it, and says so)
  player.onRun = (run) => base.classList.toggle('run', run && stickId !== null);
  const api = {
    /** Playing or not: the stick shows only in play; a pause lets go of everything. */
    setPlaying(on) {
      if (!on) {
        clearTimeout(holdTimer); if (holding !== null) { holding = null; onHold?.(false); }
        stickId = null; looks.clear();
        player.stick.x = player.stick.y = 0; player.stick.held = false;
        for (const el of [base, knob]) { el.style.transition = ''; el.classList.remove('on'); }
        base.classList.remove('run');
      }
      show(on);
    },
    resize() { insets = null; if (stickId === null && shown) home(); },
    /** For tests and diag: how many fingers are on what. */
    get state() { return { stick: stickId !== null, looks: looks.size, push: Math.hypot(player.stick.x, player.stick.y), at: [cx, cy], rest: rest() }; },
  };
  return api;
}

/** A safe-area inset in px (m.html sets them as CSS variables). */
function safe(side) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(`--safe-${side}`);
  if (!v) return 0;
  if (v.includes('env(')) {
    // (a custom property keeps env() unresolved: measure it)
    const d = document.createElement('div');
    d.style.cssText = `position:fixed;visibility:hidden;width:0;height:0;padding-left:var(--safe-${side})`;
    document.body.appendChild(d);
    const px = parseFloat(getComputedStyle(d).paddingLeft) || 0;
    d.remove();
    return px;
  }
  return parseFloat(v) || 0;
}
