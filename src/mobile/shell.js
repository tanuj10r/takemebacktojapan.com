import { createSound } from '../core/sound.js';
import { soundBus } from '../core/soundBus.js';
import { createMinimap } from '../ui/minimap.js';
import { trainWaitLabel } from '../ui/trainWait.js';
import { watchSoundLabels, createSoundLabels } from '../ui/soundLabels.js';
import { TRAIN_SOUND } from '../world/line/sfx.js';
import { GUIDE } from '../world/animals/guide.js';
import { STRINGS, MOBILE_STRINGS as M } from '../data/strings.js';
import { VOLUME_STEPS, DEFAULT_VOLUME, volumeGain, MAKER } from '../config.js';
import { TouchPlayer } from './player.js';
import { createTouch } from './touch.js';
import { createMobileHud } from './hud.js';
import { pickAction, actionWords } from './controls/spots.js';
import { watchMediaElements, unlockAudio, audioState, watchInterruptions, wakeAudio } from './audio.js';

/* ------------------------------------------------------------------ *
 * The phone's shell (docs/decisions/mobile-lite.md, "Mobile v3: UI"):
 * everything the player touches and reads, in one object for main.js.
 * The world (the town, its look, its loop) is main.js's; this is the
 * walker, the touch controls, the HUD, the cards, the map, the sound's
 * waking and its labels, Hachi's buttons and the postcard.
 *
 *   bootStage(text, '40%')            the loading card's line and bar
 *   const shell = createShell({ canvas, camera, world, ... })   once the town stands
 *   shell.player / .sound / .hud      the walker (TouchPlayer), the engine
 *                                     (core/sound.js, attached to the
 *                                     soundBus, labelled), the HUD
 *   shell.ready()                     the loading card becomes the start card
 *   shell.update(dt, { inStore })     each drawn frame, after world.update
 *                                     and shop.update; returns what the
 *                                     context button is on
 *   shell.resize()                    the screen changed
 *
 * What it does by itself, as the desktop's main.js does:
 *   start    only the Start button starts the town; a tap anywhere else
 *            on the card wakes the sound (the title song).  Resume the same.
 *   Hachi    his hello's words for touch ("tap the paw"), the whistle
 *            (the paw tile), "Take the tour again" as the context button,
 *            the konbini's snack bits (shop.onSnack), the postcard when
 *            his tour is over (GUIDE.onTourEnd)
 *   the map  the corner map, a tap opens the whole map, a tap closes it
 *   sound    made awake inside every tap, the audio session set to
 *            'playback', resumed after an interruption or asked for with
 *            the "Tap to bring the sound back" pill; the sounds' names;
 *            "Next train · 0:25" on the platform
 *   action   the one context button: what the crosshair is on (or the
 *            nearest thing to do ahead), with its own words, mochi and all
 * ------------------------------------------------------------------ */

/* The words that name keys on the desktop, said for touch (the shared code reads STRINGS when it shows them). */
STRINGS.hachi.line = M.hachiLine;
STRINGS.store.menuHint = M.menuHint;
STRINGS.map.close = M.closeMap;
STRINGS.postcard.selfie.say.blocked = M.selfie.blocked;
STRINGS.postcard.selfie.say.none = M.selfie.none;
// a phone saves a picture through its share sheet (iOS ignores `download` on a blob link)
const SHARES_FILES = typeof navigator !== 'undefined' && !!navigator.share && !!navigator.canShare;
if (SHARES_FILES) STRINGS.postcard.selfie.save = M.selfie.save;

const boot = document.getElementById('boot');
/** The loading card (m.html #boot): what is happening, and its bar. */
export function bootStage(text, progress) {
  if (!boot) return;
  const line = boot.querySelector('.line');
  if (line) line.textContent = text;
  boot.style.setProperty('--p', progress);
}

const VOLUME_KEY = 'takemebacktojapan-volume';

/**
 * @param canvas, camera   the view
 * @param world            the town: colliders, heightAt, bounds, interactables, lawson?.shop, line?, experiences
 * @param held             () => something of main.js's holds the view (the glide to the famous view, Han's drive)
 * @param famous           () => standing on a famous view (no crosshair there)
 * @param onTime           () => the time tile was tapped (main.js changes the light and calls shell.setTime(name))
 * @param onRestart        () => "Back to the start" (main.js stands you on the famous view; the shell resumes)
 */
export function createShell({ canvas, camera, world, scene = null, held = () => false, famous = () => false, onTime = null, onRestart = null } = {}) {
  const shop = world.lawson?.shop ?? null;
  const player = new TouchPlayer(camera, canvas, world);

  /* ---- the sound: the desktop's engine, with what a phone needs round it (audio.js) ---- */
  let volumeStep = DEFAULT_VOLUME;
  try {
    const saved = localStorage.getItem(VOLUME_KEY);
    if (saved !== null && VOLUME_STEPS.includes(Number(saved))) volumeStep = Number(saved);
  } catch { /* optional */ }
  const hud = createMobileHud({ volume: volumeStep });
  watchMediaElements();
  const sound = createSound({ volume: volumeGain(volumeStep) });
  // the sounds' names (ui/soundLabels.js, the desktop's): wrapped before the world's queued zones pass through
  const labels = watchSoundLabels(sound, { names: STRINGS.soundNames, isPlaying: () => player.locked, show: createSoundLabels(hud.root) });
  soundBus.attach(sound);
  world.line?.onEvent((name, run) => {
    if (name === 'arrive' || name === 'depart') labels?.at('train-' + name, run.x, run.z, TRAIN_SOUND);
  });
  hud.onVolumeChange = (step) => {
    volumeStep = step;
    sound.setVolume(volumeGain(step));
    try { localStorage.setItem(VOLUME_KEY, String(step)); } catch { /* optional */ }
  };
  const needTap = (on) => hud.askForSound(on);
  const interruptions = watchInterruptions(sound, needTap);
  /** Inside a tap: the context, the audio session, the streams; and the pill away once it runs. */
  const wake = () => {
    const state = unlockAudio(sound);
    interruptions();
    if (state === 'running') hud.askForSound(false);
    else if (hud.asking) setTimeout(() => { if (audioState(sound) === 'running') hud.askForSound(false); }, 250);
    return state;
  };
  // every lift and click anywhere is a gesture the sound may need (the buttons call wake() themselves too)
  document.addEventListener('touchend', wake, { passive: true });
  document.addEventListener('click', wake);
  document.addEventListener('keydown', wake);

  /* ---- the map, the platform's countdown ---- */
  const minimap = createMinimap(world);
  const trainWait = trainWaitLabel(hud.root, { bottom: 'calc(var(--edge-b) + 58px)' });
  /* The whole map on a phone (Tan, 2026-10-02: "the map seems to be broken... a simpler map with less text"): it was
   * drawn larger than the screen and panned, so only a slice of it showed, its labels cut at the edges.  Now the
   * whole sheet fits the screen, drawn simply (ui/minimap.js `simple`); a tap closes it. */
  const fullmap = document.querySelector('.fullmap');
  let mapAt = 0;
  function drawMap() {
    const cs = fullmap ? getComputedStyle(fullmap) : null, px = (k) => parseFloat(cs?.[k]) || 0;
    const w = (fullmap?.clientWidth || window.innerWidth) - px('paddingLeft') - px('paddingRight');
    const h = (fullmap?.clientHeight || window.innerHeight) - px('paddingTop') - px('paddingBottom');
    minimap.setFull(true, player.pos, player.yaw, { simple: true, fit: { w, h } });
  }
  function toggleMap(open = !minimap.fullOpen) {
    if (open === minimap.fullOpen) return;
    if (open && (!player.locked || shop?.busy || player.seat || player.suspended)) return;
    if (open) { drawMap(); mapAt = performance.now(); } else minimap.setFull(false);
    player.suspended = open;
    hud.setMapOpen(open);
    touch.setPlaying(player.locked && !open);
  }
  // it closes with a tap anywhere on it (a click: not the lift of a pan, not the tap that opened it)
  fullmap?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!minimap.fullOpen || performance.now() - mapAt < 400) return;
    wake();
    toggleMap(false);
  });

  /* ---- the postcard (ui/postcard.js, the desktop's): from the pause card, and by itself when Hachi's tour is over ---- */
  let postcard = null, toured = false, postcardCame = false, postcardSeen = false, postcardDue = -1;
  const closePostcard = () => { postcard?.hide(); hud.holdCard = false; };
  const loadPostcard = () => import('../ui/postcard.js').then(({ createPostcard }) => {
    if (!postcard) {
      postcard = createPostcard({ touch: true, onMenu: closePostcard });
      const show = postcard.show;
      postcard.show = (...a) => { show(...a); phonePostcard(postcard.el, () => postcard.selfie); };
    }
    return postcard;
  });
  /* the tour's ending, in the desktop's order (Tan, 2026-10-02: "the postcard appears before Hachi puts a show on the
   * bench"): his bench bit plays in full, then (GUIDE.onTourEnd: he has settled) the postcard, then, once it has
   * been up and put away, "Take the tour again" */
  GUIDE.onTourEnd = () => {
    toured = true;
    if (postcardCame || postcardSeen) return;
    postcardDue = MAKER.postcardAfter;
    loadPostcard().catch(() => { postcardDue = -1; postcardSeen = true; });   // (offline: no postcard, no harm)
  };
  function openPostcard() {
    loadPostcard().then(() => {
      if (player.locked || postcard.open) return;
      hud.holdCard = true;
      postcardSeen = true;
      postcard.show(true, toured);
    }).catch(() => {});
  }
  function watchPostcard(dt) {
    if (postcardDue < 0 || dt <= 0 || !postcard) return;
    postcardDue = Math.max(0, postcardDue - dt);
    // never over something that holds you: the konbini's scene, the whole map, Han's drive, a staged view
    if (postcardDue > 0 || !player.locked || shop?.visiting || minimap.fullOpen || player.suspended || player.scripted || held()) return;
    postcardDue = -1;
    postcardCame = postcardSeen = true;
    hud.holdCard = true;
    postcard.show(false, true);
    player.unlock();
  }

  /* ---- Hachi ---- */
  let pupOffer = false, hovered = null;
  GUIDE.onTour = () => hud.flash(STRINGS.hachi.againToast, 2600);
  function whistle() {
    if (!player.locked || shop?.visiting || minimap.fullOpen || player.suspended || player.seat) return;
    if (GUIDE.whistle()) hud.ping();
  }
  if (shop) {
    shop.flash = (text, error = false) => hud.flash(text, error ? 2800 : 2200, error);
    // what you bought, in your hand, being eaten, gone: Hachi begs, then does its bit for it along with you
    shop.onSnack = (phase, id) => GUIDE.snack(phase, id);
  }

  /* ---- the buttons ---- */
  function act() {
    if (!player.locked) return;
    if (hovered) hovered.action?.({ player, hud });
    else if (pupOffer && GUIDE.again()) pupOffer = false;
    else if (player.seat?.dir > 0) player.stand();
  }
  player.onInteract = (target) => { hovered = target ?? hovered; act(); };
  function pause() {
    if (!player.locked) return;
    toggleMap(false);
    player.unlock();
  }
  function resume() {
    wake();
    if (postcard?.open) closePostcard();
    player.lock();
  }
  function pickMenu(id) {
    if (shop?.atSpot && shop.menu.includes(id) && shop.play(id)) hud.menu(null);
  }
  hud.onButton = (b) => {
    wake();                                   // every tap is a gesture the sound may need
    if (Array.isArray(b)) { if (b[0] === 'pick') pickMenu(b[1]); return; }
    if (b === 'pause') pause();
    else if (b === 'resume') resume();
    else if (b === 'restart') { if (shop?.visiting || held()) return; player.seat = null; player.suspended = false; onRestart?.(); resume(); }
    else if (b === 'map') toggleMap();
    else if (b === 'time') { if (player.locked) onTime?.(); }
    else if (b === 'whistle') whistle();
    else if (b === 'act') act();
    else if (b === 'postcard') openPostcard();
    else if (b === 'sound') hud.askForSound(audioState(sound) !== 'running' && audioState(sound) !== 'none');
  };
  // a keyboard (or a computer, testing): the desktop's keys
  window.addEventListener('keydown', (e) => {
    if (e.repeat || e.target?.closest?.('.vol-bar, [data-sf]')) return;
    if (e.code === 'Space') { e.preventDefault(); if (!started) return; if (player.locked) pause(); else resume(); return; }
    if (!player.locked || postcard?.open) return;
    if (shop?.atSpot && /^Digit[1-9]$/.test(e.code)) { const id = shop.menu[Number(e.code.slice(5)) - 1]; if (id) pickMenu(id); return; }
    if (e.code === 'KeyF') whistle();
    if (e.code === 'KeyM') toggleMap();
    if (e.code === 'KeyN') hud.flash(sound.toggle() ? STRINGS.soundOff : STRINGS.soundOn);
  });

  /* ---- touch; playing or paused ---- */
  const touch = createTouch(player, { surface: canvas, isPlaying: () => player.locked && !minimap.fullOpen });

  player.onLockChange = (locked) => {
    if (!locked && minimap.fullOpen) { minimap.setFull(false); player.suspended = false; hud.setMapOpen(false); }
    hud.setPlaying(locked);
    touch.setPlaying(locked);
    api.onPlaying?.(locked);
  };
  hud.holdCard = true;                         // the start card is up: no pause card behind it

  /* ---- away and back: a call, the lock screen, another app ---- */
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { pause(); sound.setAwake(false); } else if (!lost) wakeAudio(sound, needTap);
  });
  window.addEventListener('pagehide', () => sound.setAwake(false));
  window.addEventListener('pageshow', (e) => { if (e.persisted && !lost) wakeAudio(sound, needTap); });
  let lost = false;

  /* ---- the start card: only its button starts the town ---- */
  let started = false;
  function start(e) {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    if (started || !boot?.classList.contains('ready')) return;
    started = true;
    wake();                                   // inside the tap: the context, the audio session, the streams
    boot.classList.add('hidden');
    setTimeout(() => boot.remove(), 600);
    hud.holdCard = false;
    player.lock();
    if (window.innerHeight > window.innerWidth * 1.1) hud.flash(M.rotate, 4200);
    api.onStart?.();
  }
  const startBtn = boot?.querySelector('#start');
  if (startBtn) {
    // the finger's lift starts it (a tap's click can be late or dropped on iOS), a click for a mouse and the keyboard
    startBtn.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') startBtn.classList.add('down'); });
    for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) startBtn.addEventListener(ev, () => startBtn.classList.remove('down'));
    startBtn.addEventListener('pointerup', (e) => { if (e.pointerType !== 'mouse') start(e); });
    startBtn.addEventListener('click', start);
  }

  let menuShown = null, lastW = 0, lastH = 0;
  const api = {
    player, hud, sound, touch, minimap, labels,
    /** the postcard has been up this page load (the tour is offered again only after it; the checks set it) */
    get postcardSeen() { return postcardSeen; }, set postcardSeen(v) { postcardSeen = !!v; },
    /** main.js's: (locked) => {} when play starts or stops; () => {} once, at Start. */
    onPlaying: null, onStart: null,
    get started() { return started; },
    get hovered() { return hovered; },
    get postcard() { return postcard; },
    wake, pause, resume, toggleMap, whistle, act, openPostcard,
    /** The loading card becomes the start card. */
    ready() { bootStage(M.ready, '100%'); boot?.classList.add('ready'); },
    /** The time tile's icon and word (main.js, when the light has changed), and a toast saying it. */
    setTime(name, say = false) { hud.setTime(name); if (say) hud.flash(M.times[name] ?? name, 1100); },
    /** The GPU was taken (main.js shows the card): hush, and no waking until it is back. */
    setLost(on) { lost = on; if (on) { pause(); sound.setAwake(false); } else if (!document.hidden) sound.setAwake(true); },
    resize() {
      const w = window.innerWidth, h = window.innerHeight;
      if (w === lastW && h === lastH) return;
      lastW = w; lastH = h;
      touch.resize();
      if (minimap.fullOpen) drawMap();     // (drawn again at the new size)
      if (h > w * 1.1 && player.locked) hud.flash(M.rotate, 3600);
    },
    /**
     * Each drawn frame, after world.update and shop.update (dt 0 while paused): the cards' song, the map, what the
     * context button offers, the konbini's chips, the countdown, the postcard.  Returns what the button is on.
     */
    update(dt, { inStore = false } = {}) {
      const menu = !player.locked;
      if (menu !== menuShown) { menuShown = menu; sound.setMenu(menu); document.body.classList.toggle('game-paused', menu); }
      watchPostcard(dt);
      const open = minimap.fullOpen;
      minimap.setVisible(player.locked && !open);
      minimap.update(player.pos, player.yaw);
      const choosing = !!(shop?.atSpot && player.locked && !open);
      hud.menu(choosing ? shop.menu : null);
      hovered = null;
      const free = player.locked && !shop?.busy && !open && !held();
      if (free && !player.seat && !inStore) hovered = pickAction(player, world.interactables, camera);
      player.hovered = hovered;
      pupOffer = !hovered && free && !player.seat && !shop?.visiting && !player.suspended && postcardDue < 0 && postcardSeen && GUIDE.offer();
      const seated = free && player.seat?.dir > 0 && player.seat.k > 0.98;
      hud.setAction(hovered ? actionWords(hovered.label) : pupOffer ? STRINGS.hachi.again : seated ? STRINGS.keys.standUp : null);
      trainWait.update(world.line?.station?.wait, player.locked && !open && !choosing);
      hud.setCrosshair(!choosing && !famous() && !player.seat);
      return hovered;
    },
  };
  return api;
}

/**
 * The postcard on a phone (ui/postcard.js and ui/postcardSelfie.js are the desktop's, unchanged): two things a
 * phone needs, met from outside, on the postcard's own element.
 *
 *   the camera  needs a secure page (https); on an insecure one (a phone on the dev server's LAN address) the
 *               browser has no camera to give: "Add your selfie" says so instead of failing
 *   Save        iOS ignores `download` on a blob link: where the share sheet takes files, Save hands it the
 *               picture (Save Image, AirDrop, Messages...); elsewhere the link downloads as on desktop
 */
function phonePostcard(el, selfie) {
  if (!el || el.__phone) return;
  el.__phone = true;
  el.addEventListener('click', (e) => {
    const add = e.target.closest?.('[data-pc="selfie"]');
    if (add && !(window.isSecureContext && navigator.mediaDevices?.getUserMedia)) {
      e.stopPropagation(); e.preventDefault();
      if (!el.querySelector('.m-note')) {
        const p = document.createElement('p');
        p.className = 'm-note';
        p.setAttribute('role', 'status');
        p.textContent = M.selfie.insecure;
        add.after(p);
      }
      return;
    }
    const save = e.target.closest?.('[data-sf="save"]');
    const file = save && selfie()?.file;
    if (file && SHARES_FILES && navigator.canShare({ files: [file] })) {
      e.stopPropagation(); e.preventDefault();
      // (Tan, 2026-10-02) the picture goes with a line about the game and its link, as the postcard's own Share does
      navigator.share({ files: [file], title: document.title, text: `${STRINGS.postcard.shareText} ${MAKER.share}` }).catch(() => {});
    }
  }, true);
}
