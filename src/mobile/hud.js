import { MOBILE_STRINGS as M, STRINGS } from '../data/strings.js';
import { PRODUCT } from '../data/catalog.js';
import { STORE, VOLUME_STEPS } from '../config.js';
import { makerRow, STAMP, ICON as MK } from '../ui/maker.js';

/* ------------------------------------------------------------------ *
 * The phone's HUD (docs/decisions/mobile-lite.md, "Mobile v3: UI").  What
 * the desktop's keys do, as things to tap, where a thumb finds them:
 *
 *   top left      the corner map (ui/minimap.js draws it; m.html sizes it):
 *                 its button here lies over it, a tap opens the whole map
 *   top right     Hachi (the whistle), the time of day, pause: big tiles,
 *                 each with its word under its icon
 *   right         the one context action, just above where the right thumb
 *                 rests to look: only when there is something to do, with
 *                 its own words ("Order a mochi ¥200", "Take the tour again")
 *   bottom middle the konbini's choice as chips, on its spot
 *   left          the joystick (touch.js)
 *   cards         the pause card: the volume (a bar, the desktop's five
 *                 settings), Resume, back to the start, "Your postcard ✉"
 *                 (it glows), Made by Tan.  The start card is m.html's own.
 *
 * All words from src/data/strings.js.  Inline SVG icons: nothing is
 * downloaded.
 * ------------------------------------------------------------------ */

const ICON = {
  pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="5" width="4.2" height="14" rx="1.4"/><rect x="13.8" y="5" width="4.2" height="14" rx="1.4"/></svg>',
  sun: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.2"/><g stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 2.5v2.6M12 18.9v2.6M2.5 12h2.6M18.9 12h2.6M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/></g></svg>',
  dusk: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 16a7 7 0 0 1 14 0z"/><g stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 19.5h18M12 4.5v3M5.2 8.2l2 2M18.8 8.2l-2 2"/></g></svg>',
  moon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.5 3.5a8.5 8.5 0 1 0 5 12.5A7 7 0 0 1 15.5 3.5z"/></svg>',
  paw: '<svg viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="12" cy="16" rx="5" ry="4.3"/><ellipse cx="5.6" cy="10.4" rx="2.1" ry="2.6"/><ellipse cx="9.4" cy="6.4" rx="2.1" ry="2.7"/><ellipse cx="14.6" cy="6.4" rx="2.1" ry="2.7"/><ellipse cx="18.4" cy="10.4" rx="2.1" ry="2.6"/></svg>',
  hand: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.5 11V5.2a1.5 1.5 0 0 1 3 0V10m0-1.5V3.9a1.5 1.5 0 0 1 3 0V10m0-4.4a1.5 1.5 0 0 1 3 0v7.7c0 4.1-2.6 7.2-6.3 7.2-2.7 0-4.3-1.3-5.6-3.6L3.3 12.6a1.5 1.5 0 0 1 2.4-1.7L8.5 14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  vol: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10v4h4l5 4V6L8 10z"/><path class="w" d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>',
  home: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 12.5a7.5 7.5 0 1 0 2.2-5.3M4 4.5v4h4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};
const TIME_ICON = { morning: ICON.sun, golden: ICON.dusk, night: ICON.moon };
const yen = (n) => '¥' + n.toLocaleString('en');

const CSS = `
  .mh { position: fixed; inset: 0; z-index: 6; pointer-events: none; font-family: var(--ui); color: #2b2542; }
  .mh-play { transition: opacity .3s, visibility .3s; }
  .mh.off .mh-play { opacity: 0; visibility: hidden; }
  .mh button { pointer-events: auto; -webkit-touch-callout: none; }
  body.map-open .mh-play > :not(.mh-map) { opacity: 0; visibility: hidden; }

  /* the tiles, top right: an icon and its word */
  .mh-top { position: absolute; top: var(--edge-t); right: var(--edge-r); display: flex; gap: 8px; transition: opacity .2s, visibility .2s; }
  .mh-btn { position: relative; width: 54px; height: 54px; padding: 8px 0 6px; border-radius: 17px; border: 1.5px solid rgba(58,51,80,.18);
    display: flex; flex-direction: column; align-items: center; justify-content: space-between;
    background: rgba(251,246,240,.88); color: #3b3263;
    -webkit-backdrop-filter: blur(8px) saturate(1.2); backdrop-filter: blur(8px) saturate(1.2);
    box-shadow: 0 6px 18px -8px rgba(20,10,40,.5), inset 0 -2px 0 rgba(58,51,80,.07); transition: transform .08s ease, background .12s ease; }
  .mh-btn::after { content: ''; position: absolute; inset: -5px -4px -8px; }   /* a thumb's reach past the tile */
  .mh-btn svg { width: 23px; height: 23px; fill: currentColor; flex: none; }
  .mh-btn span { font-size: 9.5px; font-weight: 700; letter-spacing: .07em; text-transform: uppercase; line-height: 1; color: #5d5676; white-space: nowrap; }
  .mh-btn.down { transform: scale(.93); background: #e8e0f0; }
  /* the whistle answers: a ring goes out from the paw */
  .mh-btn.ping::before { content: ''; position: absolute; inset: -1.5px; border-radius: inherit; border: 2px solid #e59bb0; animation: mh-ping .6s ease-out both; }
  @keyframes mh-ping { from { opacity: .9; transform: scale(1); } to { opacity: 0; transform: scale(1.45); } }

  /* the corner map's button: over the map m.html placed top left; its word on the rim */
  .mh-map { position: absolute; left: var(--edge-l); top: var(--edge-t); width: var(--map); height: var(--map); padding: 0; border: 0; border-radius: 50%;
    background: transparent; transition: transform .08s ease; }
  .mh-map::after { content: ''; position: absolute; inset: -6px; border-radius: 50%; }
  .mh-map span { position: absolute; left: 50%; bottom: -8px; transform: translateX(-50%); padding: 3px 9px 3px; border-radius: 999px;
    background: #fbf6f0; border: 1.5px solid rgba(58,51,80,.22); box-shadow: 0 4px 10px -5px rgba(20,10,40,.5);
    font-size: 9.5px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; line-height: 1.1; color: #3b3263; }
  .mh-map.down { transform: scale(.95); }
  body.map-open .mh-map { display: none; }

  /* the context action: a pill just above the right thumb's resting place (it looks from below it) */
  .mh-act { position: absolute; left: max(18px, calc(var(--safe-l) + 8px)); bottom: clamp(112px, 34vh, 250px);      /* (left: the right thumb is on the stick, Tan 2026-10-03) */
    opacity: 0; transform: translateY(8px) scale(.94); transition: opacity .2s, transform .2s cubic-bezier(.2,.9,.3,1.3); pointer-events: none; }
  .mh-act.on { opacity: 1; transform: none; }
  .mh-act.on button { pointer-events: auto; }
  .mh-act button { position: relative; display: flex; align-items: center; gap: 10px; min-height: 58px; max-width: min(52vw, 300px); padding: 0 22px 0 8px;
    border-radius: 999px; border: 2px solid rgba(255,255,255,.9); background: rgba(59,50,99,.92); color: #fff;
    font-size: 16px; font-weight: 700; letter-spacing: .01em; box-shadow: 0 10px 26px -8px rgba(20,12,40,.6); transition: transform .08s ease, background .12s ease; }
  .mh-act button::after { content: ''; position: absolute; inset: -10px; }   /* a thumb's reach */
  .mh-act button i { flex: none; display: grid; place-items: center; width: 42px; height: 42px; border-radius: 50%; background: #ffdd57; color: #2b2542; }
  .mh-act button svg { width: 24px; height: 24px; }
  .mh-act button span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .mh-act button.down { transform: scale(.95); background: rgba(75,63,124,.98); }
  .mh-act.on button::before { content: ''; position: absolute; inset: -2px; border-radius: inherit; border: 2px solid rgba(255,221,87,.9); animation: mh-ring 1.8s ease-out infinite; pointer-events: none; }
  @keyframes mh-ring { 0% { opacity: .9; transform: scale(1); } 70%, 100% { opacity: 0; transform: scale(1.13, 1.32); } }

  .mh-toast { position: absolute; left: 50%; top: calc(var(--edge-t) + 64px); transform: translate(-50%, -6px);
    max-width: min(70vw, 480px); padding: 7px 16px 8px; border-radius: 19px; text-align: center;
    background: rgba(251,246,240,.93); border: 1.5px solid rgba(58,51,80,.22); box-shadow: 0 6px 18px -8px rgba(20,10,40,.45);
    font-size: 13.5px; font-weight: 600; line-height: 1.3; color: #3f3860;
    opacity: 0; transition: opacity .25s, transform .25s; z-index: 7; }
  .mh-toast.on { opacity: 1; transform: translate(-50%, 0); }
  .mh-toast.err { background: rgba(255,238,236,.96); border-color: rgba(208,52,47,.6); color: #b0282a; }
  .mh-pill { position: absolute; left: 50%; bottom: var(--edge-b); transform: translate(-50%, 8px);
    display: flex; align-items: center; gap: 8px; min-height: 44px; padding: 0 18px 0 14px; border: 0; border-radius: 999px;
    background: #ffdd57; color: #2b2542; font-size: 14px; font-weight: 700; box-shadow: 0 10px 26px -8px rgba(20,12,40,.6);
    white-space: nowrap; opacity: 0; visibility: hidden; transition: opacity .3s, transform .3s, visibility .3s; z-index: 26; }
  .mh-pill svg { width: 18px; height: 18px; fill: currentColor; }
  .mh-pill.on { opacity: 1; visibility: visible; transform: translate(-50%, 0); }
  .mh-cross { position: absolute; left: 50%; top: 50%; width: 6px; height: 6px; margin: -3px 0 0 -3px; border-radius: 50%;
    background: rgba(255,255,255,.88); box-shadow: 0 0 0 1.5px rgba(58,51,80,.5); opacity: .7; transition: opacity .2s; }
  .mh-cross.hidden { opacity: 0; }

  /* the konbini's choice: chips along the bottom, between the thumbs */
  .mh-menu { position: absolute; left: 50%; bottom: var(--edge-b); transform: translate(-50%, 10px);
    width: min(calc(100vw - 2 * var(--edge-l) - 310px), 560px); min-width: min(94vw, 330px); padding: 10px 10px 9px; border-radius: 18px;
    background: rgba(251,246,240,.95); border: 1.5px solid rgba(31,95,174,.4); box-shadow: 0 12px 32px -10px rgba(20,10,40,.5);
    opacity: 0; visibility: hidden; transition: opacity .25s, transform .25s, visibility .25s; }
  .mh-menu.on { opacity: 1; visibility: visible; transform: translate(-50%, 0); }
  .mh-menu h3 { margin: 0 4px 8px; font-size: 14px; display: flex; justify-content: space-between; align-items: baseline; }
  .mh-menu h3 span { font-size: 11.5px; font-weight: 600; color: #7a7394; }
  .mh-menu ol { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(92px, 1fr)); gap: 6px; }
  .mh-menu li button { position: relative; width: 100%; min-height: 60px; padding: 7px 7px 6px; border-radius: 12px; text-align: left;
    border: 1.5px solid rgba(31,95,174,.3); background: #fff; color: #2b2542; display: flex; flex-direction: column; justify-content: space-between; }
  .mh-menu li button.down { background: #e8f0fb; transform: scale(.97); }
  .mh-menu b { font-size: 13px; line-height: 1.15; }
  .mh-menu .mh-jp { font-size: 10.5px; color: #8f88a8; letter-spacing: 0; }
  .mh-menu .p { font-size: 12px; color: #1f5fae; font-weight: 700; font-variant-numeric: tabular-nums; }
  .mh-menu .stamp { position: absolute; right: 4px; top: -8px; transform: rotate(-8deg); padding: 0 5px; border: 1.5px solid #d23a2a;
    border-radius: 4px; color: #d23a2a; background: #fff5f0; font: 800 9px/1.4 system-ui, sans-serif; letter-spacing: .06em; text-transform: uppercase; }

  /* ---------- the pause card (m.html's .scrim/.card look): two columns on its side, one upright ---------- */
  .mh-pause .card { width: min(100%, 700px); flex-direction: row; border-top: 3px solid var(--sakura); }
  .mh-pause .col { flex: 1 1 0; min-width: 0; padding: 16px 18px 16px; display: flex; flex-direction: column; }
  .mh-pause .col + .col { border-left: 1.5px solid #efe5ea; background: linear-gradient(180deg, #fffaf5, var(--paper)); }
  .mh-pause .badge { align-self: flex-start; padding: 4px 10px; border-radius: 999px; background: #efe5ea; color: var(--ink);
    font-size: 10px; font-weight: 700; letter-spacing: .2em; text-transform: uppercase; }
  .mh-pause h2 { margin: 7px 0 0; font-family: var(--title); font-size: 22px; line-height: 1.1; font-weight: 700; letter-spacing: -.01em; color: #2a2140; }
  .mh-pause .btn { margin-top: 14px; }
  .mh-pause .btn.soft { display: flex; align-items: center; justify-content: center; gap: 7px; margin-top: 8px; }
  .mh-pause .btn.soft svg { width: 16px; height: 16px; }
  .mh-pause .mk-row { margin-top: 14px; }
  .mh-pause .url { margin-top: auto; padding-top: 10px; }
  /* the volume: a bar of the desktop's five settings; drag it or tap along it */
  .vol { margin: 14px 0 0; }
  .vol-head { display: flex; align-items: center; justify-content: space-between; font-size: 13px; font-weight: 700; color: var(--ink); }
  .vol-head span { display: inline-flex; align-items: center; gap: 6px; }
  .vol-head svg { width: 17px; height: 17px; fill: currentColor; }
  .vol-head output { font-variant-numeric: tabular-nums; color: var(--ink-soft); font-weight: 600; }
  .vol.muted .vol-head svg .w { display: none; }
  .vol-bar { position: relative; height: 40px; margin: 0 -4px; padding: 0 4px; touch-action: none; cursor: pointer; outline: 0; }
  .vol-bar .track { position: absolute; left: 4px; right: 4px; top: 50%; height: 10px; margin-top: -5px; border-radius: 999px; background: #e9dfe6; overflow: hidden; box-shadow: inset 0 1px 2px rgba(43,37,66,.12); }
  .vol-bar .fill { position: absolute; inset: 0 auto 0 0; width: var(--v, 50%); border-radius: inherit; background: linear-gradient(90deg, #5a4d8f, var(--action)); }
  .vol-bar .ticks { position: absolute; left: 4px; right: 4px; top: 50%; height: 10px; margin-top: -5px; display: flex; justify-content: space-between; padding: 0 4px; pointer-events: none; }
  .vol-bar .ticks i { width: 2px; height: 4px; margin-top: 3px; border-radius: 1px; background: rgba(43,37,66,.22); }
  .vol-bar .thumb { position: absolute; left: calc(4px + (100% - 8px) * var(--vk, .5)); top: 50%; width: 26px; height: 26px; margin: -13px 0 0 -13px; border-radius: 50%;
    background: #fff; border: 2px solid var(--action); box-shadow: 0 3px 10px -3px rgba(20,10,40,.55); transition: transform .1s ease; }
  .vol-bar.drag .thumb { transform: scale(1.14); }
  .vol-bar:focus-visible .thumb { outline: 3px solid var(--sakura); outline-offset: 2px; }
  /* Your postcard: a little postcard to press, glowing on every pause (the desktop's) */
  .mh-post { position: relative; display: flex; align-items: center; gap: 12px; width: 100%; min-height: 62px; margin: 0; padding: 9px 62px 9px 12px;
    border: 0; border-radius: 9px; background: #fdf8ef; color: var(--ink); text-align: left; cursor: pointer;
    box-shadow: 0 10px 24px -12px rgba(20,10,40,.6), 0 0 0 1px #eadfd6; transform: rotate(-1deg); animation: mh-glow 1.8s ease-in-out infinite; transition: transform .08s ease; }
  .mh-post.down { transform: rotate(-1deg) scale(.97); }
  .mh-post .cam { flex: none; width: 38px; height: 38px; padding: 8px; border-radius: 50%; background: var(--action); color: #fff; box-shadow: 0 0 0 2.5px #fdf8ef, 0 5px 12px -5px rgba(20,10,40,.8); }
  .mh-post .cam svg { display: block; width: 100%; height: 100%; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
  .mh-post .t { display: block; font: italic 600 18px/1.15 var(--serif); color: #2a2140; white-space: nowrap; }
  .mh-post small { display: block; margin-top: 3px; font-size: 11.5px; font-weight: 600; color: var(--ink-soft); line-height: 1.25; }
  .mh-post .stamp { position: absolute; right: 11px; top: 50%; width: 36px; aspect-ratio: .82; margin-top: -22px; padding: 2px; background: #fff; border: 1px dashed #d9c9c4; transform: rotate(5deg); }
  .mh-post .stamp svg { display: block; width: 100%; height: 100%; }
  @keyframes mh-glow {
    0%, 100% { box-shadow: 0 10px 24px -12px rgba(20,10,40,.6), 0 0 0 1px #eadfd6, 0 0 0 0 rgba(255,221,87,0); }
    50% { box-shadow: 0 10px 24px -12px rgba(20,10,40,.6), 0 0 0 1px #f3d985, 0 0 20px 6px rgba(255,221,87,.9); }
  }

  @media (orientation: landscape) and (max-height: 350px) {
    .mh-pause .col { padding: 11px 16px 11px; }
    .mh-pause h2 { font-size: 20px; margin-top: 5px; }
    .mh-pause .btn { margin-top: 9px; min-height: 44px; padding: 8px 16px; }
    .mh-pause .btn.soft { min-height: 38px; margin-top: 7px; }
    .vol { margin-top: 8px; } .vol-bar { height: 34px; }
    .mh-post { min-height: 54px; }
    .mh-pause .mk-row { margin-top: 10px; padding-top: 9px; }
    .mh-pause .mk-who small { display: none; }
  }
  @media (orientation: portrait) {
    .mh-toast { top: calc(var(--edge-t) + var(--map) + 108px); max-width: 88vw; }
    .mh-act { bottom: clamp(150px, 26vh, 250px); }
    .mh-menu { width: min(94vw, 420px); bottom: max(176px, calc(var(--safe-b) + 170px)); }
    .mh-menu ol { grid-template-columns: repeat(3, 1fr); }
    .mh-pause .card { width: min(100%, 430px); flex-direction: column; }
    .mh-pause .col { flex: none; padding: 18px 20px 16px; }
    .mh-pause .col + .col { border-left: 0; border-top: 1.5px solid #efe5ea; }
    .mh-pause .url { margin-top: 12px; padding-top: 0; }
    /* (Tan, 2026-10-04) upright, the start card's picture above the pause card, as on the start screen (the blurred
     * town above it said nothing) */
    .mh-pause { flex-direction: column; justify-content: flex-end; padding: 0; background: #2c2346; -webkit-backdrop-filter: none; backdrop-filter: none; }
    .mh-pause .mh-art { display: block; flex: 1 1 0; min-height: 0; width: 100%; object-fit: cover; object-position: 46% 86%; }
    .mh-pause .card { width: 100%; max-height: none; margin-top: -14px; border-radius: 22px 22px 0 0; padding-bottom: var(--safe-b); flex: none; }
  }
  .mh-art { display: none; }
  @media (prefers-reduced-motion: reduce) {
    .mh-post { animation: none; box-shadow: 0 10px 24px -12px rgba(20,10,40,.6), 0 0 0 3px #ffdd57; }
    .mh-act.on button::before, .mh-btn.ping::before { animation: none; opacity: 0; }
  }
`;

export function createMobileHud({ volume = 50 } = {}) {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const root = document.createElement('div');
  root.className = 'mh off';
  root.innerHTML = `
    <div class="mh-play">
      <div class="mh-cross"></div>
      <button class="mh-map" type="button" data-b="map" aria-label="${M.aria.map}"><span>${M.buttons.map}</span></button>
      <div class="mh-top">
        <button class="mh-btn" type="button" data-b="whistle" aria-label="${M.aria.hachi}">${ICON.paw}<span>${M.buttons.hachi}</span></button>
        <button class="mh-btn" type="button" data-b="time" aria-label="${M.aria.time}">${ICON.dusk}<span>${M.buttons.time}</span></button>
        <button class="mh-btn" type="button" data-b="pause" aria-label="${M.aria.pause}">${ICON.pause}<span>${M.buttons.pause}</span></button>
      </div>
      <div class="mh-act"><button type="button" data-b="act" aria-label="${M.aria.act}"><i>${ICON.hand}</i><span></span></button></div>
      <aside class="mh-menu" aria-live="polite"></aside>
    </div>
    <div class="mh-toast" role="status"></div>
  `;
  document.body.appendChild(root);
  // the sound's own pill: over every card too (a call can end while you are paused)
  const pill = document.createElement('button');
  pill.type = 'button';
  pill.className = 'mh-pill';
  pill.dataset.b = 'sound';
  pill.innerHTML = `${ICON.vol}<span>${M.soundBack}</span>`;
  pill.style.cssText = 'position:fixed;font-family:var(--ui)';
  document.body.appendChild(pill);

  const P = STRINGS.postcard;
  const pause = document.createElement('div');
  pause.className = 'scrim see-through mh-pause hidden';
  pause.setAttribute('role', 'dialog');
  pause.setAttribute('aria-modal', 'true');
  pause.setAttribute('aria-labelledby', 'mh-pause-title');
  pause.innerHTML = `
    <img class="mh-art" src="keyart-portrait.webp" alt="" width="1080" height="1440" decoding="async" />
    <section class="card scroll-ok">
      <div class="col">
        <span class="badge">${M.paused}</span>
        <h2 id="mh-pause-title">${STRINGS.title}</h2>
        <div class="vol">
          <div class="vol-head"><span>${ICON.vol}${M.volume}</span><output>50%</output></div>
          <div class="vol-bar" role="slider" tabindex="0" aria-label="${M.volume}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="50">
            <div class="track"><div class="fill"></div></div>
            <div class="ticks">${VOLUME_STEPS.map(() => '<i></i>').join('')}</div>
            <div class="thumb"></div>
          </div>
        </div>
        <button class="btn" type="button" data-b="resume">${M.resume}</button>
        <button class="btn soft" type="button" data-b="restart">${ICON.home}${M.restart}</button>
      </div>
      <div class="col">
        <button class="mh-post" type="button" data-b="postcard" aria-label="${P.miniAria}">
          <span class="cam" aria-hidden="true">${MK.camera}</span>
          <span><span class="t">${P.mini}</span><small>${P.selfie.add}</small></span>
          <span class="stamp" aria-hidden="true">${STAMP}</span>
        </button>
        ${makerRow('pause_card')}
        <p class="url">${STRINGS.credit}<i>·</i><a href="credits.html" target="_blank" rel="noopener">${STRINGS.credits}</a></p>
      </div>
    </section>`;
  document.body.appendChild(pause);

  const $ = (sel, r = root) => r.querySelector(sel);
  const toast = $('.mh-toast'), act = $('.mh-act'), actBtn = act.querySelector('button'), actLabel = act.querySelector('span'), kmenu = $('.mh-menu');
  const cross = $('.mh-cross'), timeBtn = $('[data-b="time"]'), whistleBtn = $('[data-b="whistle"]');
  const vol = pause.querySelector('.vol'), volBar = pause.querySelector('.vol-bar'), volOut = pause.querySelector('.vol-head output');
  let toastTimer = null, lastAct = null, menuKey = '', volNow = volume, playing = false;
  const nearest = (v) => VOLUME_STEPS.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a));
  const showCard = () => pause.classList.toggle('hidden', playing || api.holdCard);

  const api = {
    root, pause,
    /** Each tap of a button: 'pause' | 'time' | 'whistle' | 'map' | 'act' | 'resume' | 'restart' | 'postcard' | 'sound' | ['pick', id]. */
    onButton: null,
    onVolumeChange: null,
    /** Something else has the screen while paused (the postcard): the pause card waits behind it. */
    get holdCard() { return hold; },
    set holdCard(v) { hold = !!v; showCard(); },
    flash(text, ms = 1400, error = false) {
      toast.textContent = text;
      toast.classList.toggle('err', error);
      toast.classList.add('on');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => toast.classList.remove('on'), ms);
    },
    /** Playing (the controls show) or not (the pause card, unless something holds it: the start card, the postcard). */
    setPlaying(on) {
      playing = on;
      root.classList.toggle('off', !on);
      showCard();
    },
    get paused() { return !pause.classList.contains('hidden'); },
    /** What the context button does here ("Sit a while", "Order a mochi ¥200"), or null to hide it. */
    setAction(label) {
      if (label === lastAct) return;
      lastAct = label;
      act.classList.toggle('on', !!label);
      if (label) { actLabel.textContent = label; actBtn.setAttribute('aria-label', label); }
    },
    get action() { return lastAct; },
    setCrosshair(on) { cross.classList.toggle('hidden', !on); },
    /** The time of day: its icon and its word on the tile. */
    setTime(name) {
      timeBtn.innerHTML = `${TIME_ICON[name] ?? ICON.sun}<span>${M.timeShort[name] ?? M.buttons.time}</span>`;
      timeBtn.setAttribute('aria-label', `${M.aria.time}: ${M.times[name] ?? name}`);
    },
    /** The whole map is up: everything but it steps back (m.html, body.map-open). */
    setMapOpen(open) { document.body.classList.toggle('map-open', !!open); },
    /** The whistle was heard: the paw's ring. */
    ping() { whistleBtn.classList.remove('ping'); void whistleBtn.offsetWidth; whistleBtn.classList.add('ping'); },
    /** The konbini's choice: catalogue ids (null hides it). */
    menu(ids) {
      kmenu.classList.toggle('on', !!ids);
      if (!ids || menuKey === ids.join()) return;
      menuKey = ids.join();
      const S = STRINGS.store;
      kmenu.innerHTML = `<h3>${S.menuTitle}<span>${M.menuHint}</span></h3><ol>${ids.map((id) => {
        const p = PRODUCT[id];
        const rec = id === STORE.recommended ? `<span class="stamp">${S.recommended}</span>` : '';
        return `<li><button type="button" data-pick="${id}">${rec}<b>${S.menuNames[id] ?? p.nameEn}</b><span class="mh-jp" lang="ja">${p.nameJa}</span><span class="p">${yen(p.priceYen)}</span></button></li>`;
      }).join('')}</ol>`;
    },
    get menuOpen() { return kmenu.classList.contains('on'); },
    /** The volume's bar at one of the five settings (0 reads as muted). */
    setVolume(step) {
      volNow = nearest(step);
      const k = volNow / 100;
      volBar.style.setProperty('--v', `${volNow}%`);
      volBar.style.setProperty('--vk', String(k));
      volBar.setAttribute('aria-valuenow', String(volNow));
      volBar.setAttribute('aria-valuetext', `${volNow}%`);
      volOut.textContent = `${volNow}%`;
      vol.classList.toggle('muted', volNow === 0);
    },
    get volume() { return volNow; },
    /** The "tap to bring the sound back" pill (an interruption the phone won't resume without a tap). */
    askForSound(on) { pill.classList.toggle('on', !!on); },
    get asking() { return pill.classList.contains('on'); },
  };
  let hold = false;
  api.setVolume(volume);

  /* The volume's bar: the finger that lands on it owns it; where it is along the bar snaps to the nearest of the
   * five settings, heard at once.  Arrow keys for a keyboard. */
  const volAt = (e) => {
    const r = volBar.getBoundingClientRect();
    const v = nearest(Math.min(1, Math.max(0, (e.clientX - r.left - 4) / (r.width - 8))) * 100);
    if (v !== volNow) { api.setVolume(v); api.onVolumeChange?.(v); }
  };
  let volId = null;
  volBar.addEventListener('pointerdown', (e) => {
    e.stopPropagation(); e.preventDefault();
    volId = e.pointerId; volBar.classList.add('drag');
    try { volBar.setPointerCapture(e.pointerId); } catch { /* fine */ }
    volAt(e);
  });
  volBar.addEventListener('pointermove', (e) => { if (e.pointerId === volId) volAt(e); });
  for (const ev of ['pointerup', 'pointercancel']) volBar.addEventListener(ev, (e) => { if (e.pointerId === volId) { volId = null; volBar.classList.remove('drag'); } e.stopPropagation(); });
  volBar.addEventListener('click', (e) => e.stopPropagation());
  volBar.addEventListener('keydown', (e) => {
    const i = VOLUME_STEPS.indexOf(volNow), d = e.code === 'ArrowRight' || e.code === 'ArrowUp' ? 1 : e.code === 'ArrowLeft' || e.code === 'ArrowDown' ? -1 : 0;
    if (!d) return;
    e.preventDefault(); e.stopPropagation();
    const v = VOLUME_STEPS[Math.min(VOLUME_STEPS.length - 1, Math.max(0, i + d))];
    if (v !== volNow) { api.setVolume(v); api.onVolumeChange?.(v); }
  });

  /* A button acts on the finger's lift (pointerup), not on 'click': iOS
   * sends no click for a tap made while another finger is on the stick or
   * dragging the view, and delays or drops it after a quick earlier touch.
   * The finger that went down on a button owns it (captured), is shown
   * pressed, and fires once when it lifts on it; a lift is a user
   * activation, so the sound may start or wake in it.  'click' stays for a
   * mouse and the keyboard, and is ignored right after a touch fired the
   * same button. */
  const fire = (b) => {
    if (b.dataset.pick) api.onButton?.(['pick', b.dataset.pick]);
    else api.onButton?.(b.dataset.b);
  };
  const hit = (e) => e.target.closest?.('[data-b], [data-pick]');
  const downs = new Map();              // pointerId -> button
  let lastTouch = 0;
  for (const el of [root, pause, pill]) {
    el.addEventListener('pointerdown', (e) => {
      if (e.target.closest?.('.mh-act') && !act.classList.contains('on')) return;   // (a hidden action is not there)
      const b = hit(e);
      if (!b) return;
      e.stopPropagation();
      if (e.pointerType === 'mouse') return;            // a mouse clicks
      e.preventDefault();
      downs.set(e.pointerId, b);
      b.classList.add('down');
      try { b.setPointerCapture(e.pointerId); } catch { /* fine */ }
    });
    el.addEventListener('pointerup', (e) => {
      const b = downs.get(e.pointerId);
      if (!b) return;
      downs.delete(e.pointerId);
      b.classList.remove('down');
      e.stopPropagation();
      // lifted on the button (a little slack for a thumb), not dragged away
      const r = b.getBoundingClientRect(), pad = 16;
      if (e.clientX < r.left - pad || e.clientX > r.right + pad || e.clientY < r.top - pad || e.clientY > r.bottom + pad) return;
      lastTouch = performance.now();
      fire(b);
    });
    el.addEventListener('pointercancel', (e) => {
      const b = downs.get(e.pointerId);
      if (b) { b.classList.remove('down'); downs.delete(e.pointerId); }
    });
    el.addEventListener('click', (e) => {
      const b = hit(e);
      if (!b) return;
      e.preventDefault();
      e.stopPropagation();
      if (performance.now() - lastTouch < 700) return;   // (the touch already fired it)
      fire(b);
    });
    // no long-press callout or selection on the buttons
    el.addEventListener('contextmenu', (e) => { if (hit(e)) e.preventDefault(); });
  }
  return api;
}
