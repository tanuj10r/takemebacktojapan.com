import './core/fonts.js';     // first: the sign fonts are ready before the town paints its signs
import * as THREE from 'three';
import { PAL } from './core/palette.js';
import { Pipeline } from './core/post.js';
import { buildSky } from './core/sky.js';
import { setOutlineResolution } from './core/outline.js';
import { Player } from './core/player.js';
import { createHud } from './core/hud.js';
import { createSound } from './core/sound.js';
import { soundBus } from './core/soundBus.js';
import { WALK_SIGNALS } from './world/signals.js';
import { buildTown } from './world/town.js';
import { tagReflections } from './world/land/mirror.js';
import { createMinimap } from './ui/minimap.js';
import { createHandsHud } from './ui/hands.js';
import { createControls } from './ui/controls.js';
import { trainWaitLabel } from './ui/trainWait.js';
import { watchSoundLabels, createSoundLabels } from './ui/soundLabels.js';
import { TRAIN_SOUND } from './world/line/sfx.js';
import { buildKitTest } from './world/kit-test.js';
import { atSpot, bareStretches } from './world/kit/density.js';
import { STRINGS } from './data/strings.js';
import { PRODUCT } from './data/catalog.js';
import { hanShow } from './world/han/index.js';
import { GUIDE } from './world/animals/guide.js';
import { PETTAN } from './world/mochi/index.js';
import { PLAYER, PLAYER_VFOV, HERO_VIEWS, LOOKS, SPAWN, FUJI, LAWSON, VOLUME_STEPS, DEFAULT_VOLUME, volumeGain, HAN_WATCH, ANIMALS, MAKER } from './config.js';

/* ------------------------------------------------------------------ *
 * Take Me Back to Japan -- entry point.  Rendering is inherited from Sakura Crossing (MIT).
 *
 * Lighting is the classic two-light anime setup: one warm quantised key
 * for the sun, one cool bounce fill from the opposite side, and a
 * hemisphere with a violet ground colour so nothing in shadow ever goes
 * black.  The shadow camera follows the player on a snapped grid to keep
 * cast shadows crisp without shimmering.
 * ------------------------------------------------------------------ */

const canvas = document.getElementById('view');

/* The loading card (index.html #boot, QA-004): painted by the page before any
 * of this runs; here it says what is happening and steps its bar.  The build
 * is one long task, so the page is given a frame to paint before it. */
const boot = document.getElementById('boot');
function bootStage(text, progress) {
  if (!boot) return;
  boot.querySelector('.boot-line').textContent = text;
  boot.style.setProperty('--p', progress);
}
// a frame to paint (or a moment, in a hidden tab where frames never come)
const nextPaint = () => new Promise((r) => { requestAnimationFrame(() => setTimeout(r, 0)); setTimeout(r, 150); });
/* A card in index.html (#gate) for when the town can't be drawn: no WebGL 2
 * (index.html checks first; this catches what it can't) or a GPU reset. */
const showGate = (kind) => document.documentElement.classList.add(`gate-${kind}`);
let contextLost = false;   // the GPU reset: nothing more is drawn (webglcontextlost, below)

let renderer;
try {
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    powerPreference: 'high-performance',
    stencil: false,
  });
} catch (err) {
  console.warn('No WebGL 2:', err?.message ?? err);
  showGate('nogl');
  await new Promise(() => {});   // the card says it all: build nothing
}
renderer.setPixelRatio(1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;   // soft-filtered edges: plain PCF drew a low sun's shadows as blocks on steps (Tan)
// the shadow pass is asked for by seatLights(), not run every frame
renderer.shadowMap.autoUpdate = false;
renderer.setClearColor(new THREE.Color(PAL.fog), 1);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(PAL.fog, 44, 205);

// far enough for Mt. Fuji (drawn ~1.4 km out) and the sky dome behind it
const camera = new THREE.PerspectiveCamera(PLAYER_VFOV, 1, 0.25, 3200);
camera.rotation.order = 'YXZ';

/* --------------------------------- light --------------------------------- */
const sun = new THREE.DirectionalLight(PAL.sun, 2.25);
sun.position.set(-52, 62, 56);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -40;
sun.shadow.camera.right = 40;
sun.shadow.camera.top = 40;
sun.shadow.camera.bottom = -40;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 200;
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.035;
scene.add(sun);
scene.add(sun.target);

// Cool bounce from the opposite quarter.  This carries most of the shadow
// side of every surface, so it is deliberately strong: an anime background
// has *coloured* shadows, not dark ones.
const fill = new THREE.DirectionalLight(PAL.fill, 1.08);
fill.position.set(48, 26, -44);
scene.add(fill);
scene.add(fill.target);

// a second, weaker bounce from below-front stops undersides going flat black
const bounce = new THREE.DirectionalLight(0xd8cbe8, 0.34);
bounce.position.set(10, -18, 40);
scene.add(bounce);
scene.add(bounce.target);

const hemi = new THREE.HemisphereLight(PAL.hemiSky, PAL.hemiGround, 1.12);
scene.add(hemi);

/* --------------------------------- world --------------------------------- */
bootStage(STRINGS.boot.building, '45%');
await nextPaint();
const sky = buildSky(scene, 2900, { avoidYaw: FUJI.bearing });
/* Dev only: ?kit swaps the town for the M2a kit test street, and ?shots
 * (scripts/shots.mjs) freezes time so every frame it takes repeats exactly. */
const devParams = new URLSearchParams(location.search);
const KIT = import.meta.env.DEV && devParams.has('kit');
const POSTER = import.meta.env.DEV && devParams.has('poster');   // the key art's staged diorama (src/dev/poster.js)
const FROZEN = import.meta.env.DEV && (devParams.has('shots') || POSTER);
/* ?director (dev only): Director Mode for the promo videos (src/director/, docs/director-mode-prompt.md).
 * The flag is up before the world is built (the pup gets a second instance for the double vision). */
const DIRECTOR = import.meta.env.DEV && devParams.has('director');
if (DIRECTOR) window.__directorBoot = true;
let director = null;                                      // (dev: Director Mode's frame, once it has loaded)
const world = KIT ? buildKitTest(scene) : buildTown(scene, { merge: !POSTER });
bootStage(STRINGS.boot.ready, '85%');
await nextPaint();
/* The minimap and full map (M2f): the town only.  `famousView` is the spot
 * of the famous view you stand on, if any: the minimap keeps off it. */
const minimap = KIT ? null : createMinimap(world);
let famousView = { x: SPAWN.pos[0], z: SPAWN.pos[2] };        // the game opens on one

/* Shadow stand-ins (userData.shadowOnly): cheap shapes that cast a shadow
 * for something drawn in full detail on screen, the town's blossom.  They
 * are hidden, and shown only while the shadow map is drawn. */
const shadowOnly = [];
scene.traverse((o) => { if (o.userData.shadowOnly) { o.visible = false; shadowOnly.push(o); } });
if (shadowOnly.length) {
  const drawShadows = renderer.shadowMap.render;
  renderer.shadowMap.render = function (...args) {
    for (const o of shadowOnly) o.visible = !o.userData.shadowEmpty;   // an empty stand-in costs a call for nothing
    drawShadows.apply(this, args);
    for (const o of shadowOnly) o.visible = false;
  };
}

const player = new Player(camera, canvas, world);

/* The konbini (Tan's experience, store/shop.js): your hands in view, the
 * self-checkout and the choice card. */
const shop = world.lawson?.shop ?? null;
const handsHud = shop ? createHandsHud() : null;
const controls = createControls();
if (shop) {
  scene.add(shop.view, shop.fx);
  shop.player = player;
  PETTAN.attach({ hands: shop.hands });      // ぺったん堂 borrows your hand for its mochi (world/mochi/)
  world.interactables.push(...(world.lawson.interactables ?? []));
}
/* The sound setting: one of the five (config VOLUME_STEPS), not a free
 * slider.  What is saved is the setting; volumeGain turns it into gain. */
const VOLUME_STORAGE_KEY = 'takemebacktojapan-volume';
const OLD_VOLUME_KEY = 'lawson-fuji-volume';   // the working title's key: read once, then moved
let volumeStep = DEFAULT_VOLUME;
try {
  const old = localStorage.getItem(OLD_VOLUME_KEY);
  if (old !== null) {
    if (localStorage.getItem(VOLUME_STORAGE_KEY) === null) localStorage.setItem(VOLUME_STORAGE_KEY, old);
    localStorage.removeItem(OLD_VOLUME_KEY);
  }
} catch { /* optional */ }
try {
  // only a setting that was really saved counts: an empty store must not read as 0 (muted)
  const saved = localStorage.getItem(VOLUME_STORAGE_KEY);
  if (saved !== null && VOLUME_STEPS.includes(Number(saved))) volumeStep = Number(saved);
} catch { /* storage is optional; the game works without it */ }

const hud = createHud({ volume: volumeStep });
const trainWait = trainWaitLabel(hud.root);     // "Next train · 0:25" on the platform (QA-010)
if (shop) {
  shop.flash = (text, error = false) => hud.flash(text, error ? 2800 : 2200, error);
  // the Strong Nine: ten seconds a little tipsy
  shop.onTipsy = () => { tipsy = 0; hud.flash(STRINGS.store.tipsy, 3200); };
  // what you bought, in your hand, being eaten, gone: Hachi begs, then does its bit for it along with you (Tan; animals/guide.js)
  shop.onSnack = (phase, id) => GUIDE.snack(phase, id);
}
/* The sound (M4): one engine for the town and the store, started by the
 * same first click that takes the pointer lock (browsers start no audio
 * before a gesture).  Every sound of a place is local to it. */
const sound = createSound({ volume: volumeGain(volumeStep) });
/* the sounds' names, top left, as you come near one (ui/soundLabels.js); wrapped before the world's zones pass through */
const soundLabels = FROZEN ? null : watchSoundLabels(sound, {
  names: STRINGS.soundNames, isPlaying: () => player.locked, show: createSoundLabels(hud.root),
});
soundBus.attach(sound);          // the world's zones and one-shots (core/soundBus.js)
hud.setMuted(sound.muted);
const rememberVolume = () => {
  try { localStorage.setItem(VOLUME_STORAGE_KEY, String(volumeStep)); } catch { /* optional */ }
};
world.line?.onEvent((name, run) => {
  if (name === 'chime') sound.chime(Math.hypot(camera.position.x - run.x, camera.position.z - run.z));
  if (name === 'arrive' || name === 'depart') soundLabels?.at('train-' + name, run.x, run.z, TRAIN_SOUND);   // (the trains' own sounds: line/sfx.js)
});
const _v = new THREE.Vector3();
let lastStride = 0;
const DOOR_AT = { x: LAWSON.x + LAWSON.doorX, y: 2.2, z: LAWSON.frontZ };
// the chime's speaker, in the ceiling just inside the door (it is heard through the glass from outside)
const CHIME_AT = { x: LAWSON.x + LAWSON.doorX, y: 2.7, z: LAWSON.frontZ - 1.2 };
// every zebra's walk light (signals.js), in world terms once the town stands
scene.updateMatrixWorld(true);
const walkAt = WALK_SIGNALS.map((w) => ({ w, p: w.marker.getWorldPosition(new THREE.Vector3()) }));
const walkList = walkAt.map(({ w, p }) => ({ x: p.x, z: p.z, on: false, sound: w.sound }));
if (import.meta.env?.DEV) window.__walkList = walkList;
if (shop) {
  // the chime once as you come in and once as you go out, at the door
  shop.onEnter = () => sound.storeChime(CHIME_AT);
  shop.onExit = () => sound.storeChime(CHIME_AT);
  shop.doors.onSound = (door, opening) => sound.fridgeDoor({ x: door.box.getCenter(_v).x, y: 1.2, z: _v.z }, opening);
  shop.onSound = (kind, u) => {
    if (kind === 'take') sound.item(PRODUCT[u.id].sound, shop.unitAt(u));
  };
}
if (world.lawson?.door) world.lawson.door.onMove = (opening) => sound.autoDoor(DOOR_AT, opening);

hud.onVolumeChange = (step) => {
  volumeStep = step;
  hud.setMuted(sound.setVolume(volumeGain(step)));
  rememberVolume();
};

/* Start and Resume only on purpose (Tan, 2026-10-01): the card's button or Space.  Any other click on the card
 * only wakes the sound (hud.onWake), so the title song plays on the start card from the first click.  A browser
 * may refuse the pointer to a key (all three take it from keydown, a user activation; Firefox checked headless):
 * then the card stays and says to press its button. */
hud.onStart = () => { sound.start(); player.lock(); };
hud.onWake = () => sound.start();
let refusedHint = null;
function takePointer() {
  sound.start();
  const mode = hud.overlay.dataset.mode;
  const refused = () => {
    document.removeEventListener('pointerlockerror', refused);
    if (player.locked) return;
    if (postcard?.open) { closePostcard(); hud.setLocked(false); }   // its Resume is on the pause card
    hud.flash(STRINGS.pointerRefused[mode === 'start' ? 'start' : 'resume'], 2600);
  };
  if (refusedHint) document.removeEventListener('pointerlockerror', refusedHint);
  refusedHint = refused;
  document.addEventListener('pointerlockerror', refused);
  const r = player.lock();
  if (r?.then) r.then(() => document.removeEventListener('pointerlockerror', refused), refused);
}
player.onLockChange = (locked) => {
  if (locked && refusedHint) { document.removeEventListener('pointerlockerror', refusedHint); refusedHint = null; }
  if (locked && postcard?.open) closePostcard();   // Space took the pointer back: the walk goes on
  hud.setLocked(locked);
  // leaving pointer lock (Esc) closes the full map too
  if (!locked && minimap?.fullOpen) { minimap.setFull(false); player.suspended = false; }
  handsHud?.setLocked(locked);
};
/* The postcard (Tan, 2026-10-01; ui/postcard.js): once a page load, a moment after Hachi's tour is over and his happy
 * bit on his bench by the gate has played in full.  The pointer goes free for its buttons while it shows, and the pause card waits behind it
 * (hud.holdCard); the game stands still as it does behind any card.  Back, Esc or a click outside it: the pause
 * card.  Space: the walk goes on (its own handler, below: taking the pointer back closes the postcard).  After it,
 * and on every pause before it, the pause card has a little postcard that opens it (hud.onPostcard); before the
 * tour is over its words are "wish you were here". */
let postcard = null;           // ui/postcard.js, loaded when first wanted (the little postcard, or the nap)
let toured = false;            // Hachi's tour is over: the postcard's words say so
let postcardCame = false;      // it has come by itself (once a page load)
let postcardDue = -1;          // s of play still to wait; -1: nothing due
let postcardSeen = false;      // it has been up this page load (by itself or from the pause card), or can't be had: the tour may be offered again
const loadPostcard = () => import('./ui/postcard.js').then(({ createPostcard }) => {
  postcard ??= createPostcard({ onMenu: () => { closePostcard(); hud.setLocked(false); } });
  return postcard;
});
/* (Tan, 2026-10-02: the ending's order.  Hachi's happy bit on the bench plays in full and is watched; then, a moment
 * after he has settled (GUIDE.onTourEnd), the postcard; then, once it is put away, "Take the tour again" (pupOffer,
 * below: never while the card is due, never before it has been up).  Seen already from the pause card: no second
 * card, the tour is on offer as soon as he has settled.) */
GUIDE.onTourEnd = () => {
  toured = true;
  if (postcardCame || postcardSeen) return;
  postcardDue = MAKER.postcardAfter;
  loadPostcard().catch(() => { postcardDue = -1; postcardSeen = true; });   // (offline: no postcard, no harm)
};
function closePostcard() { hud.holdCard = false; postcard?.hide(); }
// the pause card's little postcard: the postcard again, over the card (the pointer is already free)
hud.onPostcard = () => {
  loadPostcard().then(() => {
    if (player.locked || postcard.open) return;
    hud.holdCard = true;
    hud.setLocked(false);
    postcardSeen = true;
    postcard.show(true, toured);
  }).catch(() => {});   // (offline: no postcard, no harm)
};
function watchPostcard(dt) {
  if (postcardDue < 0 || dt <= 0 || !postcard) return;
  postcardDue = Math.max(0, postcardDue - dt);
  // never over something that holds you: the konbini's scene, the full map, Han's drive, a staged view
  if (postcardDue > 0 || !player.locked || shop?.visiting || minimap?.fullOpen || player.suspended || player.scripted || watch.on) return;
  postcardDue = -1;
  postcardCame = postcardSeen = true;
  hud.holdCard = true;
  postcard.show(false, true);
  document.exitPointerLock?.();
}
if (import.meta.env?.DEV) window.__postcard = { get card() { return postcard; }, due: (s = 0.01) => loadPostcard().then(() => { postcardDue = s; }), nap: () => GUIDE.onTourEnd?.(), pending: () => postcardDue, get seen() { return postcardSeen; }, gate: () => postcardDue < 0 && postcardSeen, forget() { postcardSeen = postcardCame = false; postcardDue = -1; } };

/* The browser lets a page make sound only after a click or a key: the first one anywhere (the start card's volume,
 * the card itself, a key) starts the sound, and with it the song, before Start is even pressed */
window.addEventListener('pointerdown', () => sound.start(), { once: true });
window.addEventListener('keydown', () => sound.start(), { once: true });
canvas.addEventListener('click', () => {
  sound.start();
  if (!player.locked) player.lock();
});

player.onInteract = (target) => {
  // an experience's action may seat the player or say a line (world/land/slowlife.js)
  if (target) target.action?.({ player, hud });
  // after the tour, Hachi by you and looked at: the tour again (animals/guide.js)
  else if (pupOffer && GUIDE.again()) pupOffer = false;
};
let pupOffer = false;
GUIDE.onTour = () => hud.flash(STRINGS.hachi.againToast, 2600);

/* ------------------------------- pipeline ------------------------------- */
const pipeline = new Pipeline(renderer, scene, camera);

/* --------------------------------- looks --------------------------------- *
 * One look per time of day (config.js LOOKS): sky, fog, lights, grade, Fuji
 * and the store's glow.  M6 blends between them; M1 switches. */
/** Light directions, fixed in world space: the world is flat. */
const SUN_DIR = new THREE.Vector3(-52, 62, 56);
const FILL_DIR = new THREE.Vector3(48, 26, -44);
const BOUNCE_DIR = new THREE.Vector3(10, -18, 40);
let lookName = null;

function applyLook(name) {
  const look = LOOKS[name];
  lookName = name;
  sky.setLook(look);
  world.setLook(look);
  scene.fog.color.set(look.fog.color);
  scene.fog.near = look.fog.near;
  scene.fog.far = look.fog.far;
  renderer.setClearColor(look.fog.color, 1);
  sun.color.set(look.sun.color);
  sun.intensity = look.sun.intensity;
  SUN_DIR.set(...look.sun.dir);
  fill.color.set(look.fill.color);
  fill.intensity = look.fill.intensity;
  bounce.intensity = look.bounce;
  hemi.color.set(look.hemi.sky);
  hemi.groundColor.set(look.hemi.ground);
  hemi.intensity = look.hemi.intensity;
  const g = pipeline.grade.mat.uniforms;
  g.uShadowTint.value.set(look.grade.shadow);
  g.uLightTint.value.set(look.grade.light);
  g.uSaturation.value = look.grade.saturation;
  g.uLift.value = look.grade.lift;
  g.uVignette.value = look.grade.vignette;
  g.uWarmth.value = look.grade.warmth;
}

/* ------------------------------ hero views ------------------------------ *
 * Keys 1, 2, 3 (and the spawn) stand the player on a famous view
 * (config.js HERO_VIEWS[].play) in the ordinary gameplay lens, and set its
 * look.  Fuji is magnified in that lens to keep hero camera 1's on-screen
 * size (FUJI.gameplaySize), so the view reads as the photo and walking off
 * it changes nothing but where you stand: no lens change, no zoom.
 *
 * Dev only: with the ` overlay on, the view uses the exact photo camera
 * instead (narrow, shifted lens, true-size Fuji) so the composition can be
 * checked against the photo.  Moving off it eases back to the gameplay lens. */
const HERO_DAY = HERO_VIEWS.morning;
const FUJI_GAMEPLAY = FUJI.gameplaySize
  * Math.tan(THREE.MathUtils.degToRad(PLAYER_VFOV / 2))
  / Math.tan(THREE.MathUtils.degToRad(HERO_DAY.vfov / 2));
let hero = null;          // the photo camera, while it holds (dev overlay)
// the famous views are the opening shot: the konbini's spot keeps out of them
if (shop) shop.isFamousView = () => !!(hero || famousView);
let lastView = SPAWN.view;
let heroBlend = 0;        // 1 = photo lens, 0 = gameplay lens
const heroAt = { x: 0, z: 0, yaw: 0, pitch: 0 };

function updateProjection() {
  const v = HERO_VIEWS[lastView];
  const t = heroBlend * heroBlend * (3 - 2 * heroBlend);
  camera.fov = PLAYER_VFOV + (v.vfov - PLAYER_VFOV) * t;
  camera.updateProjectionMatrix();
  world.fuji.magnify(1 + (FUJI_GAMEPLAY - 1) * (1 - t));
  if (t > 0) {
    // lens shift: slide the frame, keep the camera level (verticals stay straight)
    const e = camera.projectionMatrix.elements;
    e[8] = (v.shift[0] * t) / camera.aspect;
    e[9] = v.shift[1] * t;
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
  }
}

/** Stand on a famous view.  `photo` uses the exact photo camera (dev overlay). */
function enterHero(name, { photo = refOn } = {}) {
  const v = HERO_VIEWS[name];
  lastView = name;
  applyLook(v.look);
  const spot = photo ? { pos: v.pos, yaw: v.yaw, pitch: 0 } : v.play;
  hero = photo ? v : null;
  heroBlend = photo ? 1 : 0;
  player.pos.set(spot.pos[0], world.heightAt(spot.pos[0], spot.pos[2]), spot.pos[2]);
  player.vel.set(0, 0, 0);
  player.yaw = spot.yaw;
  player.pitch = spot.pitch;
  player.bob = 0;
  if (photo) player.hold();
  else player.holdLook = false;
  Object.assign(heroAt, { x: player.pos.x, z: player.pos.z, yaw: player.yaw, pitch: player.pitch });
  famousView = { x: player.pos.x, z: player.pos.z };        // the minimap stays away until you walk off
  player.applyCamera(0);
  updateProjection();
  refOverlay?.show(refOn);
}

function leaveHero() {
  hero = null;
  player.holdLook = false;
}
player.onReleaseLook = leaveHero;

/* The time of day (Tan, 2026-09-28): 1 2 3 change the light wherever you
 * are, no longer a jump back to the famous view.  A short dip to dark hides
 * the switch (the sky, the lamps, the grade all change at once). */
const fadeEl = document.createElement('div');
fadeEl.style.cssText = 'position:fixed;inset:0;background:#0c0a14;opacity:0;pointer-events:none;z-index:4';
document.body.appendChild(fadeEl);
let fade = null;
function setTime(name) {
  if (fade) return;
  fade = { t: 0, name, done: false };
}
function timeFade(dt) {
  if (!fade) return;
  fade.t += Math.min(dt, 1 / 30) || 1 / 60;
  const IN = 0.22, HOLD = 0.08, OUT = 0.4;
  if (!fade.done && fade.t >= IN) {
    fade.done = true;
    lastView = fade.name;
    applyLook(HERO_VIEWS[fade.name].look);   // the sky says what changed: no toast (quality pass, Tan)
  }
  fadeEl.style.opacity = String(fade.t < IN ? fade.t / IN : Math.max(0, 1 - (fade.t - IN - HOLD) / OUT));
  if (fade.t > IN + HOLD + OUT) { fade = null; fadeEl.style.opacity = '0'; }
}

/* The Nippon Fuji view as a place to stand (Tan): walk onto its highlight and
 * the camera settles into the famous framing; walk off and it is yours. */
const VIEW_SPOT = HERO_VIEWS.morning.play;
let gliding = null;
function viewSpot(dt) {
  if (gliding) {
    gliding.t += dt;
    const k = THREE.MathUtils.smootherstep(gliding.t / 1.3, 0, 1);
    const f = gliding.from;
    player.pos.x = f.x + (VIEW_SPOT.pos[0] - f.x) * k;
    player.pos.z = f.z + (VIEW_SPOT.pos[2] - f.z) * k;
    player.yaw = f.yaw + Math.atan2(Math.sin(VIEW_SPOT.yaw - f.yaw), Math.cos(VIEW_SPOT.yaw - f.yaw)) * k;
    player.pitch = f.pitch + (VIEW_SPOT.pitch - f.pitch) * k;
    player.applyCamera(0);
    if (gliding.t >= 1.3) { gliding = null; player.scripted = false; enterHero(lastView); }
    return;
  }
  if (famousView || hero || player.scripted || player.seat || !player.locked || FROZEN) return;
  if (Math.hypot(player.pos.x - VIEW_SPOT.pos[0], player.pos.z - VIEW_SPOT.pos[2]) < 0.8) {
    gliding = { t: 0, from: { x: player.pos.x, z: player.pos.z, yaw: player.yaw, pitch: player.pitch } };
    player.scripted = true;
    player.vel.set(0, 0, 0);
  }
}

/* Han's drive (Tan 2026-09-28: "pan the view of the player, focusing on the
 * car, until the entire drift experience is completed").  From the moment
 * you step into his glow until he leans on the car again, you stand where
 * you are (held like the prayer and the seat hold you: `suspended`, so no
 * walking and the mouse is not read) and your head turns to follow the car:
 * a damped turn toward it, a little ahead of it, capped to a head's speed,
 * the pitch kept near level.  The car's path is continuous, so the view never
 * jumps when a building hides it.  Then the view is yours again, where it is. */
const watch = { on: false, mine: false, gone: false, t: new THREE.Vector3(), at: { x: 0, z: 0 } };
function watchCar(dt) {
  // moved from outside (a teleport, a famous view): let go for the rest of the show
  if (watch.on && Math.hypot(player.pos.x - watch.at.x, player.pos.z - watch.at.z) > 1) watch.gone = true;
  if (!hanShow.running) watch.gone = false;
  const on = hanShow.running && !watch.gone && !player.scripted && !player.seat && !hero && !famousView && !gliding;
  if (on && !watch.on) {
    watch.on = true;
    watch.mine = !player.suspended;        // (anything else holding the player keeps its hold)
    player.suspended = true;
    player.vel.set(0, 0, 0);
    watch.at.x = player.pos.x; watch.at.z = player.pos.z;
  } else if (!on && watch.on) {
    watch.on = false;
    if (watch.mine) player.suspended = false;
    watch.mine = false;
  }
  if (!on || dt <= 0) { watch.last = 0; return; }
  /* the car keeps the song's (real) time; so does the turn of the head, or a
   * slow frame (dt is capped at 1/20 s) left the view behind the car */
  const nowMs = performance.now();
  const rdt = watch.last ? Math.min(0.25, (nowMs - watch.last) / 1000) : dt;
  watch.last = nowMs;
  dt = Math.max(dt, rdt);
  const W = HAN_WATCH, t = hanShow.target(watch.t), c = camera.position;
  const dx = t.x - c.x, dz = t.z - c.z;
  const yaw = Math.atan2(-dx, -dz);
  const pitch = THREE.MathUtils.clamp(Math.atan2(t.y - c.y, Math.hypot(dx, dz)), W.pitch[0], W.pitch[1]);
  const k = 1 - Math.exp(-W.follow * dt);
  const dy = Math.atan2(Math.sin(yaw - player.yaw), Math.cos(yaw - player.yaw));
  // well behind the car: turn quicker until it's back in the middle of the view
  const turnMax = W.maxTurn * (1 + 3 * Math.max(0, Math.abs(dy) - 0.35));
  player.yaw += THREE.MathUtils.clamp(dy * k, -turnMax * dt, turnMax * dt);
  player.pitch += THREE.MathUtils.clamp((pitch - player.pitch) * k, -W.maxTurn * 0.6 * dt, W.maxTurn * 0.6 * dt);
}
if (import.meta.env?.DEV) window.__watch = watch;

/* Hachi's hello (Tan, 2026-09-29: every start, it runs out in front of you and introduces itself).  The start view
 * looks up at Fuji, so a pup in front of you is under the frame: while it runs in and says hello the view eases down
 * to it, then back to where it was.  Nothing holds you: move the mouse or walk and the view is yours at once. */
const pupLook = { on: false, back: false, pitch0: 0, looked: 0, at: { x: 0, z: 0 } };
function watchPup(dt) {
  if (dt <= 0) return;
  const A = ANIMALS.guide.intro;
  const free = !player.scripted && !player.seat && !player.suspended && !hero && !gliding && player.locked;
  const mine = () => player.looked - pupLook.looked > 40 || Math.hypot(player.pos.x - pupLook.at.x, player.pos.z - pupLook.at.z) > 0.3;
  const t = free ? GUIDE.greeting() : null;
  if (t && !pupLook.on && !pupLook.back) {
    pupLook.on = true; pupLook.pitch0 = player.pitch; pupLook.looked = player.looked;
    pupLook.at.x = player.pos.x; pupLook.at.z = player.pos.z;
  }
  if (!pupLook.on && !pupLook.back) return;
  if (!free || mine()) { pupLook.on = pupLook.back = false; return; }
  const k = 1 - Math.exp(-A.follow * dt);
  if (t) {
    const c = camera.position, dx = t.x - c.x, dz = t.z - c.z;
    const yaw = Math.atan2(-dx, -dz), pitch = Math.max(A.pitchMin, Math.atan2(t.y - c.y, Math.hypot(dx, dz)) + A.above);
    player.yaw += Math.atan2(Math.sin(yaw - player.yaw), Math.cos(yaw - player.yaw)) * k * 0.5;
    player.pitch += (pitch - player.pitch) * k;
  } else if (pupLook.on) { pupLook.on = false; pupLook.back = true; }
  else {
    player.pitch += (pupLook.pitch0 - player.pitch) * k * 0.6;
    if (Math.abs(pupLook.pitch0 - player.pitch) < 0.01) pupLook.back = false;
  }
}
if (import.meta.env?.DEV) window.__pupLook = pupLook;

/* The Strong Nine (Tan: "just a fun add-on"): ten seconds of a soft blur
 * and a slow sway after you drink it.  A CSS filter on the canvas, so it
 * costs nothing when it's over. */
let tipsy = -1, tipsyT = 0;
function tipsyStep(dt) {
  if (tipsy < 0) return;
  if (player.locked) tipsy += dt;
  tipsyT += dt;
  const k = Math.min(1, tipsy / 1.5) * Math.min(1, Math.max(0, (10 - tipsy) / 2));
  canvas.style.filter = k > 0.01 ? `blur(${(k * 3).toFixed(2)}px)` : '';
  if (tipsy >= 10) { tipsy = -1; canvas.style.filter = ''; return; }
  // the world leans and drifts a little
  player.yaw += Math.sin(tipsyT * 0.7) * 0.22 * k * dt;
  camera.rotation.z += Math.sin(tipsyT * 1.1) * 0.05 * k;
  camera.rotation.x += Math.sin(tipsyT * 0.8 + 1) * 0.02 * k;
}

/* Dev only: ` (Backquote) lays the matching reference photo over the frame at 50%,
 * fitted by height like the photo lens, and switches to that lens.  Photos load from reference/ through
 * the dev server and never reach the build. */
let refOn = false;
const refOverlay = import.meta.env.DEV ? (() => {
  const img = document.createElement('img');
  img.className = 'ref-overlay';
  img.alt = '';
  document.body.appendChild(img);
  return {
    img,
    show(on) {
      img.src = `./reference/${HERO_VIEWS[lastView].ref}`;
      img.classList.toggle('on', on);
    },
  };
})() : null;

function resize() {
  if (DIRECTOR && director) return;                       // (Director Mode renders at its own 9:16 size)
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  updateProjection();
  pipeline.setSize(w, h);
  setOutlineResolution(pipeline.size.x, pipeline.size.y);
}
window.addEventListener('resize', resize);
// a hidden tab keeps no audio graph running either
document.addEventListener('visibilitychange', () => sound.setAwake(!document.hidden && !contextLost));
resize();

/* --------------------------------- loop --------------------------------- */
const clock = new THREE.Clock();
const shadowTarget = new THREE.Vector3();

/** Aim a light at `origin` from a fixed direction. */
function seatLight(light, dir, origin) {
  light.target.position.copy(origin);
  light.position.copy(origin).add(dir);
}

/* The shadow camera follows the player so cast shadows stay crisp near them.
 * It centres a little ahead, so a hero camera's storefront 30 m out is in it.
 *
 * Snapped to a 4 m grid, and the map is redrawn only when it lands on a new
 * square (or now and then, for the things that move).  Left to itself it
 * followed every twitch of the mouse, which redrew a whole shadow pass 60
 * times a second -- 2.5 ms of a 6.6 ms frame -- and made the shadows crawl. */
const SNAP = 4;
let shadowAt = null, shadowAge = 1e9;
/* Snapped to whole shadow-map texels in the sun's own view, too: a 4 m step
 * is 102.4 texels, so each move re-sampled every shadow edge by a fraction of
 * a texel and the shadows "acted up" as you walked (Tan, at the river stairs). */
const _lr = new THREE.Vector3(), _lu = new THREE.Vector3(), _lf = new THREE.Vector3();
function snapToTexel(p) {
  const cam = sun.shadow.camera;
  const texel = (cam.right - cam.left) / sun.shadow.mapSize.x;
  _lf.copy(SUN_DIR).normalize();
  _lr.set(0, 1, 0).cross(_lf).normalize();
  _lu.copy(_lf).cross(_lr).normalize();
  const r = Math.round(p.dot(_lr) / texel) * texel, u = Math.round(p.dot(_lu) / texel) * texel, f = p.dot(_lf);
  p.copy(_lr).multiplyScalar(r).addScaledVector(_lu, u).addScaledVector(_lf, f);
}
function seatLights(dt = 0) {
  shadowTarget.set(
    player.pos.x - Math.sin(player.yaw) * 16, 0, player.pos.z - Math.cos(player.yaw) * 16);
  shadowTarget.x = Math.round(shadowTarget.x / SNAP) * SNAP;
  shadowTarget.z = Math.round(shadowTarget.z / SNAP) * SNAP;
  snapToTexel(shadowTarget);
  seatLight(sun, SUN_DIR, shadowTarget);
  seatLight(fill, FILL_DIR, shadowTarget);
  seatLight(bounce, BOUNCE_DIR, shadowTarget);
  shadowAge += dt;
  const moved = !shadowAt || shadowAt.x !== shadowTarget.x || shadowAt.z !== shadowTarget.z;
  if (moved || shadowAge > 0.25) {           // and four times a second for the train and the doors
    shadowAt = { x: shadowTarget.x, z: shadowTarget.z };
    shadowAge = 0;
    renderer.shadowMap.needsUpdate = true;
  }
}

window.addEventListener('keydown', (e) => {
  /* Space pauses and plays (Tan).  Pausing is letting the pointer go, which
   * raises the same card Esc does; pressing it again takes the pointer back. */
  if (e.code === 'Space') {
    // on one of the selfie's buttons (ui/postcardSelfie.js) Space is that button's, not the walk's
    if (e.target?.closest?.('[data-sf]')) return;
    e.preventDefault();
    if (e.repeat) return;
    if (player.locked) document.exitPointerLock?.();
    else takePointer();
    return;
  }
  // the postcard up: only Space (above) and its own Esc and buttons
  if (postcard?.open) return;
  // Tab never moves the page's focus off the game
  if (e.code === 'Tab') { e.preventDefault(); return; }
  if (e.repeat) return;
  // seated (ひと休み): a walking key stands you up (core/player.js); the light, the sound
  // and pause still work; nothing else (no whistle, map or jump from the bench)
  if (player.seat && !/^(Digit[1-3]|KeyN)$/.test(e.code)) return;
  // the konbini's choice: on the highlighted spot at its door, a number picks what you'll have
  if (handsHud?.open && player.locked && /^Digit[1-9]$/.test(e.code)) {
    const id = shop.menu[Number(e.code.slice(5)) - 1];
    if (id && shop.play(id)) handsHud.menu(null);
    return;
  }
  // nothing else while the konbini's scene plays (the time of day still changes)
  if (shop?.visiting && !/^Digit[1-3]$/.test(e.code) && e.code !== 'KeyN') return;
  // M: the full town map (M2f); it holds your walking and looking while open (not while you pay)
  // (not opened while something else holds the player, e.g. the konbini's scene)
  // R: back to the start (the famous view), from anywhere, at the time of day you're in
  // (Tan: a respawn; R for restart, 2026-09-28, was H)
  if (e.code === 'KeyR' && player.locked && !shop?.visiting && !gliding && !minimap?.fullOpen && !hero) {
    player.suspended = false;
    enterHero(lastView);
    return;
  }
  // F: a whistle for the pup, from anywhere; it comes running and guides on from here (Tan)
  if (e.code === 'KeyF' && player.locked && !shop?.visiting && !minimap?.fullOpen && !player.suspended) GUIDE.whistle();
  if (e.code === 'KeyM' && minimap && player.locked && !shop?.busy && (minimap.fullOpen || !player.suspended)) {
    const open = !minimap.fullOpen;
    minimap.setFull(open, player.pos, player.yaw);
    player.suspended = open;
  }
  if (e.code === 'KeyN') {
    const off = sound.toggle();
    hud.setMuted(off);
    hud.setVolume(off ? 0 : volumeStep);
    hud.flash(off ? STRINGS.soundOff : STRINGS.soundOn);
  }
  // dev only (QA-011): two quiet toggles, handy for seeing what the ink and grade passes do
  if (import.meta.env.DEV && e.code === 'KeyO') pipeline.enabled.ink = !pipeline.enabled.ink;
  if (import.meta.env.DEV && e.code === 'KeyG') pipeline.enabled.grade = !pipeline.enabled.grade;
  // 1 2 3: the time of day, wherever you are (Tan)
  for (const [name, v] of Object.entries(HERO_VIEWS)) {
    if (e.code === v.key && name !== lastView) setTime(name);
  }
  // dev only: ` lays the reference photo over the famous view (was R, now the player's restart)
  if (e.code === 'Backquote' && refOverlay) {
    refOn = !refOn;
    enterHero(lastView);   // on: the exact photo camera; off: back to the view in play
    hud.flash(refOn ? STRINGS.refOn : STRINGS.refOff, 900);
  }
});

/** Which keys do something where the player is standing (ui/controls.js).
 * The keys and their words are the cards' own (data/strings.js). */
const K = STRINGS.keys;
const C = STRINGS.control;
function controlRows(hovered) {
  if (!player.locked || FROZEN) return [];
  if (minimap?.fullOpen) return [[['M'], K.closeMap]];
  // standing on a famous view the shot is the point (the minimap keeps off
  // it too): only how to walk off it, and the light
  if (shop?.visiting) return [C('views')];
  if (hero || famousView) return [C('move'), C('views')];
  if (player.seat) return [C('look'), [C('move')[0], K.standUp], C('views')];
  const rows = [C('move'), C('look')];
  if (handsHud?.open) rows.push([[`1–${shop.menu.length}`], K.choose]);
  rows.push(C('run'));
  if (hovered) rows.push(C('interact'));
  rows.push(C('whistle'), C('map'), C('home'), C('views'));
  rows.push(C('sound'), C('pause'));
  return rows;
}

/* Drawing only when it is worth drawing.
 *
 * The game used to render flat out whenever the page was open -- behind the
 * pause card, behind another window, in a background tab -- which is why it
 * made the whole machine feel slow.  Hidden, it draws nothing; paused or
 * unfocused, ten frames a second, enough to look alive. */
let lastDraw = 0;
let menuShown = null;
function frame(now = 0) {
  if (contextLost) return;
  requestAnimationFrame(frame);
  if (document.hidden) return;
  if (DIRECTOR && director?.frame(now)) return;           // Director Mode runs the frame (dev only)
  // Tan's song on the start and pause cards: on whenever the pointer is free (a card is up), off in play
  const menu = !player.locked && !FROZEN;
  if (menu !== menuShown) { menuShown = menu; sound.setMenu(menu); document.body.classList.toggle('game-paused', menu); }
  const idle = !player.locked && !FROZEN;
  if (idle && now - lastDraw < 100) return;
  lastDraw = now;
  if (import.meta.env?.DEV) window.__drawn = (window.__drawn ?? 0) + 1;
  /* paused (a card up: the start or the pause card), the game stands still (Tan, 2026-09-29: "When the user pauses,
   * everything about the game pauses"): no time passes for anything, Hachi's hello, the trains, Han, the konbini;
   * the scene is still drawn (blurred behind the card), and the clock is read so play resumes without a jump */
  const tick = Math.min(clock.getDelta(), 1 / 20);
  const dt = FROZEN || menu ? 0 : tick;

  watchCar(dt);
  watchPup(dt);
  watchPostcard(dt);
  if (!player.scripted) player.update(dt);
  /* watching the drive you stay put: the car's collider is a box round the
   * turned car, bigger than it as it swings out of the bay, and would shove
   * you (the car itself stops for anyone really in its way) */
  if (watch.on) { player.pos.x = watch.at.x; player.pos.z = watch.at.z; player.applyCamera(0); }
  viewSpot(dt);
  tipsyStep(dt);
  timeFade(dt);
  // walking off the spot hands the lens back to the player
  if (hero && (Math.abs(player.pos.x - heroAt.x) > 0.01 || Math.abs(player.pos.z - heroAt.z) > 0.01)) {
    leaveHero();
  }
  if (!hero && heroBlend > 0) {
    heroBlend = Math.max(0, heroBlend - dt / 1.6);
    updateProjection();
  }
  world.update(dt, camera);
  seatLights(dt);
  if (world.line) {
    const c = world.line.crossingPos;
    sound.bells(world.line.service.cross.bells, Math.hypot(camera.position.x - c.x, camera.position.z - c.z));
    GUIDE.bells.on = world.line.service.cross.bells; GUIDE.bells.x = c.x; GUIDE.bells.z = c.z;      // (Hachi hears them too)
  }

  // the sky dome is centred on the flat origin, so it has to trail the camera
  sky.dome.position.copy(camera.position);
  sky.clouds.position.copy(camera.position);

  // the minimap: not over the famous views (until you walk off the spot), not
  // on the start or pause screens, not in dev captures
  if (minimap) {
    const onView = famousView && Math.hypot(player.pos.x - famousView.x, player.pos.z - famousView.z) < 1.5;
    if (!onView) famousView = null;
    minimap.setVisible(player.locked && !onView && !refOn && !FROZEN);
    minimap.update(player.pos, player.yaw);
  }

  // outside, the hitboxes (in the store there is nothing to aim at: the choice is made at the door)
  let hovered = null;
  if (shop) shop.update(dt, camera, player.bob);   // (0 while paused, like everything)
  if (handsHud) {
    const want = shop.atSpot && player.locked && !FROZEN && !minimap?.fullOpen;
    if (want !== handsHud.open) handsHud.menu(want ? shop.menu : null);
  }
  if (player.locked && !shop?.busy && !player.seat && !gliding) {   // not while paying (the till) or seated (ひと休み)
    hovered = shop?.inside(camera) ? null : player.pick(world.interactables);
  }
  player.hovered = hovered;
  pupOffer = !hovered && player.locked && !FROZEN && !shop?.visiting && !shop?.busy && !player.seat && !player.suspended && !minimap?.fullOpen && postcardDue < 0 && postcardSeen && GUIDE.offer();   // (only once the tour's postcard has been up and put away)
  controls.set(controlRows(hovered || pupOffer));
  // the sound: where you are and what time of day it is; a footstep each stride
  const inStore = !!shop?.inside(camera);
  sound.update(dt, { camera, inside: inStore, look: lookName, cooler: shop?.coolerAt });
  walkAt.forEach(({ w }, i) => { walkList[i].on = w.walk(); });
  sound.walkSignals(walkList);
  // a footstep every other swing of the head-bob (Tan: half the old rate)
  const stride = Math.floor(player.bob / (2 * Math.PI));
  if (stride !== lastStride) { lastStride = stride; if (player.locked) sound.step(inStore); }
  hud.setPrompt(hovered ? `E  ·  ${hovered.label.replace(/^.*?·\s*/, '')}` : pupOffer ? `E  ·  ${STRINGS.hachi.again}` : '');
  trainWait.update(world.line?.station?.wait, player.locked && !FROZEN && !minimap?.fullOpen);
  // flat authoring coordinates, so what the readout says is what the code uses
  hud.setCoords(player.pos, player.yaw, player.pitch, dt);

  pipeline.render();
}
// the pond's mirror (land/mirror.js) sees only what stands round it, and the sky
if (world.reflectRect) {
  tagReflections(scene, world.root, world.reflectRect);
  // Fuji is built once its elevation has loaded: tag again then
  world.fuji?.ready?.then(() => tagReflections(scene, world.root, world.reflectRect));
}
enterHero(SPAWN.view);
frame();
if (DIRECTOR) {
  import('./director/index.js').then((m) => {
    director = m.startDirector({
      THREE, scene, camera, renderer, pipeline, world, player, sound, hud, shop, sky, canvas, minimap, handsHud, controls,
      applyLook, get lookName() { return lookName; }, setOutlineResolution, seatLights,
      soundTick(dt) {
        const inStore = !!shop?.inside(camera);
        sound.update(dt, { camera, inside: inStore, look: lookName, cooler: shop?.coolerAt });
        walkAt.forEach(({ w }, i) => { walkList[i].on = w.walk(); });
        sound.walkSignals(walkList);
        if (world.line) { const c = world.line.crossingPos; sound.bells(world.line.service.cross.bells, Math.hypot(camera.position.x - c.x, camera.position.z - c.z)); }
      },
      magnifyFuji() { world.fuji.magnify(FUJI_GAMEPLAY); },
    });
  });
}
// the town is up and its card drawn: the loading card fades off it
if (boot) {
  boot.classList.add('hidden');
  setTimeout(() => boot.remove(), 600);
}

/* A GPU reset (QA-012: a driver reset, a dual-GPU switch, waking from sleep)
 * loses every texture and target.  Rebuilding them all isn't worth it for a
 * rare event: stop drawing, hush, and offer a reload (index.html #gate). */
canvas.addEventListener('webglcontextlost', (e) => {
  e.preventDefault();
  contextLost = true;
  sound.setAwake(false);
  document.exitPointerLock?.();
  showGate('lost');
});

// expose a little for tuning from the console (dev only, QA-011)
if (import.meta.env.DEV) {
  window.__scene = {
    scene, camera, renderer, pipeline, world, player, sound, hud, sun, fill, bounce, hemi, THREE,
    applyLook, enterHero,
  };
  window.__setOutlineRes = setOutlineResolution;
}
if (import.meta.env?.DEV) window.__store = { shop, hud: handsHud, price: (id) => PRODUCT[id].priceYen };

if (import.meta.env?.DEV) {
  /**
   * Dev capture: render one frame at a fixed size and post it to the dev
   * server, so framing and colour can be reviewed outside the browser.
   */
  window.__shot = async (name = 'shot', W = 1600, H = 900, opts = {}) => {
    refOn = false;
    if (opts.hero) enterHero(opts.hero);
    if (opts.train) window.__train?.(opts.train);
    if (opts.look) applyLook(opts.look);
    // spots in the town's own frame (turned, M2e.3) stand in the world turned
    const F = opts.frame === 'core' ? world.frame : null;
    if (opts.pos) {
      const p = F ? F.toWorld({ x: opts.pos[0], z: opts.pos[2] }) : { x: opts.pos[0], z: opts.pos[2] };
      player.pos.set(p.x, player.pos.y, p.z);
    }
    if (opts.y !== undefined) player.pos.y = opts.y;
    if (opts.yaw !== undefined) player.yaw = F ? F.yawToWorld(opts.yaw) : opts.yaw;
    if (opts.pitch !== undefined) player.pitch = opts.pitch;
    // always resync the camera: the rAF loop is throttled when the page is
    // not compositing, so the camera cannot be assumed to match the player
    player.pos.y = world.heightAt(player.pos.x, player.pos.z);
    player.bob = 0;
    player.applyCamera(0);
    // dev: lift the camera for overview shots
    if (opts.lift) camera.position.y += opts.lift;
    if (opts.ink !== undefined) pipeline.enabled.ink = opts.ink;
    if (opts.grade !== undefined) pipeline.enabled.grade = opts.grade;
    pipeline.forceScale = opts.scale || 1;

    camera.aspect = W / H;
    updateProjection();
    // a staged lens (scripts/keyart.mjs); the next updateProjection puts the play lens back
    if (opts.vfov) { camera.fov = opts.vfov; camera.updateProjectionMatrix(); }
    pipeline.setSize(W, H);
    setOutlineResolution(pipeline.size.x, pipeline.size.y);
    world.update(0, camera);
    // the guide shiba in a pose in front of the lens (or of `guideFrom`: { pos: {x, z}, yaw }, `guideD` m out)
    if (opts.guide) window.__guide?.stage(opts.guide, opts.guideFrom ?? player, opts.guideD);
    // staged art (scripts/keyart.mjs): no engagement highlights in the frame
    if (opts.clean) scene.traverse((o) => { if (o.name === 'exp-highlight') o.visible = false; });
    renderer.shadowMap.needsUpdate = true;      // this one frame draws its own shadows
    // the shop: `opts.shop` seconds pass (flights land, doors swing), and what you carry follows the camera
    if (shop) {
      const steps = Math.round((opts.shop ?? 0) * 60);
      for (let k = 0; k < steps; k++) {
        if (opts.stepWorld) world.update(1 / 60, camera);
        viewSpot(1 / 60); tipsyStep(1 / 60); shop.update(1 / 60, camera, 0);
        // the listener goes where the camera goes, so a stepped scene is heard from where it is seen
        if (opts.stepWorld) sound.update(0, { camera, inside: shop.inside(camera), look: lookName, cooler: shop.coolerAt });
      }
      shop.update(0, camera, 0);
    }
    seatLights();
    sky.dome.position.copy(camera.position);
    sky.clouds.position.copy(camera.position);
    // count this one frame, every pass (shadow map included)
    renderer.info.autoReset = false;
    renderer.info.reset();
    pipeline.render();
    window.__frameInfo = { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles };
    // and again with the shadow map left as it is: the main pass alone
    renderer.shadowMap.autoUpdate = false;
    renderer.info.reset();
    pipeline.render();
    window.__frameInfo.mainCalls = renderer.info.render.calls;
    window.__frameInfo.mainTriangles = renderer.info.render.triangles;
    renderer.info.autoReset = true;
    if (opts.time) {
      // average frame time over `time` frames, GPU work included (readPixels waits for it)
      const gl = renderer.getContext();
      const px = new Uint8Array(4);
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      const t0 = performance.now();
      for (let k = 0; k < opts.time; k++) pipeline.render();
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      window.__frameInfo.ms = (performance.now() - t0) / opts.time;
      window.__frameInfo.internal = [pipeline.size.x, pipeline.size.y];
      if (!opts.returnData && !opts.dir) return window.__frameInfo;
    }

    const off = document.createElement('canvas');
    const outW = opts.outW || W;
    off.width = outW;
    off.height = Math.round((outW * H) / W);
    const ctx = off.getContext('2d');
    ctx.drawImage(canvas, 0, 0, off.width, off.height);
    if (opts.overlay) {
      // the reference photo at 50%, fitted by height as the ` overlay is
      const img = new Image();
      img.src = opts.overlay;
      await img.decode();
      const h = off.height, w = (img.width * h) / img.height;
      ctx.globalAlpha = 0.5;
      ctx.drawImage(img, (off.width - w) / 2, 0, w, h);
      ctx.globalAlpha = 1;
    }
    const data = opts.png ? off.toDataURL('image/png') : off.toDataURL('image/jpeg', opts.quality || 0.86);
    if (opts.returnData) return { data, ...window.__frameInfo };
    const r = await fetch('/__shot', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, data, dir: opts.dir }),
    });
    return r.json();
  };

  /* ?lookdev: frame each hero camera once Fuji has loaded, save it to
   * reference/lookdev/, and save a copy with the reference photo laid over
   * it to .shots/ (those carry the third-party photo, so they stay local). */
  const params = devParams;
  window.__lastView = () => lastView;
  /** Stand the trains in a moment: 'platform', 'platform2', 'crossing', 'approach'. */
  window.__train = (kind) => world.line?.service.stage(kind);
  /** The z-fighting detector (scripts/_zfight.mjs, src/dev/zfight.js): one pose, drawn N times a hair apart. */
  window.__zfight = async (pose, o) => (await import('./dev/zfight.js')).zfight({ scene, camera, renderer, pipeline, world, sky, canvas }, pose, o);
  /** ?poster: stage the key art's diorama (src/dev/poster.js); resolves to its `__shot` options. */
  if (POSTER) window.__poster = async (o = {}) => { const m = await import('./dev/poster.js'); return m.stagePoster({ scene, world, applyLook, ...(o.portrait ? { layout: { ...m.POSTER_PORTRAIT, ...(o.layout ?? {}) }, aspect: 3 / 4 } : {}) }); };

  /* ?traincheck: run the service fast in fixed steps and check it (SPEC M2c).
   * Events with their times, the dwell and headway, and at every step: is
   * the crossing shut whenever a train is within the margin of it? */
  if (params.has('traincheck')) {
    world.fuji.ready.then(() => {
      const L = world.line.local ?? world.line, S = L.service;     // in the line's own frame
      const dt = 1 / 20;
      const cx = L.crossingPos.x;
      let openWhileNear = 0, lampsOffWhileDown = 0, steps = 0;
      for (let t = 0; t < 1200; t += dt) {
        S.update(dt);
        steps++;
        for (const r of S.runs) {
          if (r.phase === 'idle') continue;
          const lo = Math.min(r.x - r.len / 2, r.x + r.len / 2) - 4, hi = Math.max(r.x - r.len / 2, r.x + r.len / 2) + 4;
          if (cx > lo && cx < hi && S.cross.armT < 0.999) openWhileNear++;
        }
        if (S.cross.armT >= 0.999 && !S.cross.bells) lampsOffWhileDown++;
      }
      const ev = S.events;
      const find = (name, from = 0) => ev.findIndex((e, i) => i >= from && e.name === name);
      const out = { events: ev.map((e) => `${e.t}s ${e.name} set${e.set} track${e.track} ${e.dir}`), dwell: [], headway: [], order: [] };
      for (let i = 0; i < ev.length; i++) {
        const e = ev[i];
        if (e.name === 'doorsOpen') {
          const c = find('chime', i);
          if (c >= 0) out.dwell.push(+(ev[c].t - e.t).toFixed(1));
          const cl = find('doorsClosed', i);
          if (c >= 0 && cl >= 0) out.order.push(ev[c].t < ev[cl].t ? 'chime-then-close' : 'WRONG');
        }
        if (e.name === 'depart') {
          const a = find('arrive', i);
          if (a >= 0) out.headway.push({ s: +(ev[a].t - e.t).toFixed(1), from: e.track, to: ev[a].track });
        }
      }
      out.crossing = { steps, openWhileNear, lampsOffWhileDown };
      window.__traincheck = out;
      console.log('traincheck ' + JSON.stringify(out));
      document.title = 'traincheck done';
    });
  }
  /* The density budget (SPEC section 3), from a spot and town-wide. */
  window.__density = (spot) => {
    const kit = world.core?.kit ?? world.kit;
    if (!kit || !world.registry) return null;
    const out = {};
    if (spot) out.spot = atSpot(world.registry, kit.decals, spot, PLAYER.hfov);
    else out.bare = bareStretches(kit.net, world.core?.lots ?? [], world.registry, kit.decals, world.core?.specials ?? []);
    return out;
  };
  world.fuji.ready.then(() => { window.__ready = true; });

  /* ?m2check: the M2 acceptance measurements, printed to the console.
   *   walk   the player controller driven along the town's longest routes at
   *          walking pace: seconds taken, and whether it ever got stuck
   *   fuji   share of walkable sample points with a clear line of sight from
   *          eye height to Fuji's peak
   *   perf   average frame time at 2560 x 1440, GPU work included */
  if (params.has('m2check')) {
    world.fuji.ready.then(async (fujiMesh) => {
      const log = (...a) => console.log('m2check ' + a.join(' '));
      enterHero('morning');

      /* ---- walk ---- */
      const walkRoute = (name, pts) => {
        player.pos.set(pts[0][0], world.heightAt(pts[0][0], pts[0][1]), pts[0][1]);
        player.vel.set(0, 0, 0);
        player.locked = true;
        player.keys.clear();
        player.keys.add('KeyW');
        let t = 0, i = 1, stuck = 0, lastD = Infinity, since = 0, dist = 0;
        const prev = player.pos.clone();
        while (i < pts.length && t < 600) {
          const [tx, tz] = pts[i];
          const dx = tx - player.pos.x, dz = tz - player.pos.z;
          const d = Math.hypot(dx, dz);
          if (d < 0.8) { i++; lastD = Infinity; since = 0; continue; }
          player.yaw = Math.atan2(-dx, -dz);
          player.update(1 / 60);
          dist += prev.distanceTo(player.pos);
          prev.copy(player.pos);
          t += 1 / 60;
          since += 1 / 60;
          if (d < lastD - 0.5) { lastD = d; since = 0; }
          if (since > 4) {
            stuck++;
            log(`walk ${name} STUCK near (${player.pos.x.toFixed(1)}, ${player.pos.z.toFixed(1)}) heading to (${tx}, ${tz})`);
            i++; since = 0; lastD = Infinity;
          }
        }
        player.keys.clear();
        player.locked = false;
        log(`walk ${name}: ${t.toFixed(0)} s, ${dist.toFixed(0)} m, stuck ${stuck}`);
      };
      // routes authored in the town's own frame (built turned, M2e.3)
      const inTown = (pts) => pts.map(([x, z]) => { const w = world.frame.toWorld({ x, z }); return [w.x, w.z]; });
      // M2b: the famous view -> down the spine -> the plaza
      walkRoute('spine-to-plaza', inTown([[0, 18.6], [-48.4, 18.6], [-48.4, 124]]));
      /* The walker steers straight at each waypoint, so pavements are checked
       * separately: at every 0.25 m along the spine's two pavements there has
       * to be a gap the player (0.34 m round) fits through. */
      {
        const R = 0.34;
        const blocked = (x, z) => world.colliders.some((c) => c.top > world.heightAt(x, z) + 0.45
          && x > c.x0 - R && x < c.x1 + R && z > c.z0 - R && z < c.z1 + R);
        for (const [name, xa, xb] of [['spine east', -47.0, -44.8], ['spine west', -55.2, -53.0]]) {
          let bad = 0;
          for (let z = 21; z < 124; z += 0.25) {
            let ok = false;
            for (let x = xa; x <= xb && !ok; x += 0.1) ok = !blocked(x, z);
            if (!ok) bad++;
          }
          log(`pavement ${name}: ${bad === 0 ? 'passable all along' : bad + ' blocked slices'}`);
        }
      }
      // a loop round the lanes of the core
      walkRoute('lanes-loop', inTown([[-25.5, 19.5], [-25.5, 80], [30, 80], [30, 146], [0, 146], [0, 112], [-50, 112], [-50, 45], [-25.5, 45]]));
      // the north side (town pass): over the zebra, up the farm track, over the bridge to the Deer Park gate
      walkRoute('to-the-gate', [[-30, 6], [-30, 21], [-30, 40], [-30, 66]]);   // world: over the master junction, down the bridge road
      // (Tan's layout) the spawn, turned round: down the stairs (their left lane:
      // a handrail runs down x 0), over the stepping stones, up, along the far walk to the gate
      walkRoute('spawn-to-river', [[0, 16.5], [0.9, 30], [0.9, 41.5], [0, 42.6], [0, 57.6], [0.9, 58.8], [0.9, 63.8], [-28, 63.8], [-30, 66]]);
      // and to 鏡池: through the junction, up lane x 30, along lane z 112 into the pond's grounds
      walkRoute('spawn-to-pond', [[0, 16.5], [-30, 15], [-30, 8], [-30, -84.3], [-55, -84.3], [-63, -87]]);
      // the barricade west to the barricade east, along the main road
      walkRoute('road-end-to-end', [[-116, 13.8], [116, 13.8]]);

      /* ---- fuji ---- */
      {
        const pos = fujiMesh.geometry.attributes.position;
        let top = 0;
        for (let k = 1; k < pos.count; k++) if (pos.getY(k) > pos.getY(top)) top = k;
        const peakLocal = new THREE.Vector3().fromBufferAttribute(pos, top);
        const ray = new THREE.Raycaster();
        const targets = [];
        world.root.traverse((o) => { if (o.isMesh && o.visible && o.name !== 'ground') targets.push(o); });
        const B = world.bounds;
        let n = 0, clear = 0;
        const eye = new THREE.Vector3(), peak = new THREE.Vector3(), dir = new THREE.Vector3();
        const inside = (x, z) => world.colliders.some((c) => c.top > 1.5 && x > c.x0 && x < c.x1 && z > c.z0 && z < c.z1);
        for (let x = B.x0 + 6; x < B.x1 - 6; x += 10) {
          for (let z = B.z0 + 6; z < B.z1 - 6; z += 10) {
            if (inside(x, z)) continue;
            eye.set(x, world.heightAt(x, z) + 1.6, z);
            camera.position.copy(eye);
            world.fuji.follow(camera);
            fujiMesh.updateMatrixWorld(true);
            peak.copy(peakLocal).applyMatrix4(fujiMesh.matrixWorld);
            dir.subVectors(peak, eye).normalize();
            ray.set(eye, dir);
            ray.far = 400;
            n++;
            if (!ray.intersectObjects(targets, false).length) clear++;
          }
        }
        log(`fuji peak visible from ${clear} of ${n} walkable sample points (${Math.round((100 * clear) / n)}%)`);
      }

      /* ---- perf ---- */
      {
        const W = 2560, H = 1440;
        camera.aspect = W / H;
        pipeline.forceScale = 0;
        pipeline.setSize(W, H);
        updateProjection();
        setOutlineResolution(pipeline.size.x, pipeline.size.y);
        const gl = renderer.getContext();
        const px = new Uint8Array(4);
        const views = [['morning', null], ['spine', [-46.2, 40, Math.PI]], ['road', [-60, 14, -1.35]], ['lane', [52, 79.4, 1.5708]]];
        for (const [name, at] of views) {
          enterHero(name === 'morning' ? 'morning' : 'golden');
          if (at) { player.pos.set(at[0], world.heightAt(at[0], at[1]), at[1]); player.yaw = at[2]; player.pitch = 0.05; player.applyCamera(0); }
          world.update(0, camera);
          seatLights();
          sky.dome.position.copy(camera.position);
          sky.clouds.position.copy(camera.position);
          for (let k = 0; k < 5; k++) pipeline.render();
          gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
          const N = 60;
          const t0 = performance.now();
          for (let k = 0; k < N; k++) {
            world.update(1 / 60, camera);
            pipeline.render();
          }
          gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
          const ms = (performance.now() - t0) / N;
          log(`perf ${name}: ${ms.toFixed(2)} ms/frame at ${W}x${H} (internal ${pipeline.size.x}x${pipeline.size.y})`);
        }
        const dbg = gl.getExtension('WEBGL_debug_renderer_info');
        log('gpu ' + (dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : 'unknown'));
      }
      log('done');
      console.log('tour done');
    });
  }

  if (params.has('lookdev')) {
    world.fuji.ready.then(async () => {
      const W = Number(params.get('w')) || 1920;
      const H = Number(params.get('h')) || 1080;
      for (const name of Object.keys(HERO_VIEWS)) {
        // what keys 1, 2, 3 show in play
        refOn = false;
        enterHero(name);
        await window.__shot(`hero-${name}`, W, H, { dir: 'lookdev', quality: 0.92 });
        // the exact photo camera, alone and under the reference photo
        refOn = true;
        enterHero(name);
        await window.__shot(`hero-${name}-photo-lens`, W, H, { dir: 'lookdev', quality: 0.92 });
        await window.__shot(`hero-${name}-vs-ref`, W, H,
          { overlay: `./reference/${HERO_VIEWS[name].ref}`, quality: 0.88 });
        // the play view under the reference photo, to judge how close it reads
        refOn = false;
        enterHero(name);
        await window.__shot(`hero-${name}-play-vs-ref`, W, H,
          { overlay: `./reference/${HERO_VIEWS[name].ref}`, quality: 0.88 });
      }
      refOverlay.show(false);
      // a few steps on from the spawn, to check nothing jumps
      enterHero('golden');
      await window.__shot('play-golden-walk', W, H, { pos: [0, 0, 13], yaw: 0, pitch: 0.16 });
      document.title = 'lookdev done';
      console.log('lookdev done');
    });
  }
}
