import * as THREE from 'three';
import { STORE, LAWSON } from '../../config.js';
import { PRODUCT, FEATURED } from '../../data/catalog.js';
import { STRINGS } from '../../data/strings.js';
import { soundBus } from '../../core/soundBus.js';
import { productGeometry, placeUnit, unitMatrix } from './products.js';
import { onTopClamped, ease, easeOut, clamp01 } from './figure.js';
import { makeHands, holdFor } from './hands.js';
import { makeEating } from './eat.js';

/* ------------------------------------------------------------------ *
 * The Nippon Konbini (Tan's experience, made a scene: 2026-09-28).
 *
 * Tan: "very simple ... just experience the nostalgia that a konbini
 * carries".  You don't roam the store.  Stand on the highlighted spot at
 * the door and choose one thing (main.js shows the choice); then it plays
 * out in first person, no skipping: you walk to the door, it slides open
 * to the chime; down the aisle to the shelf, your right hand takes it; to
 * the self-checkout (no cashier: Tan), where it goes on the scanner as the
 * machine talks (Tan's recording), then your IC card on the reader; out
 * through the door, the chime again, and you eat or drink it outside.
 * Then you are yours again.  The Strong Nine leaves you a little tipsy.
 *
 * The walk is planned on the store's own colliders (A* on a grid), so it
 * keeps to the aisles whatever the planogram does.  The hand, what it
 * holds and the flights are drawn on top of the world (store/figure.js).
 * ------------------------------------------------------------------ */

const hw = LAWSON.width / 2;
/** The highlighted spot outside the door (store frame): where you choose, and where you eat. */
export const SPOT = { x: LAWSON.doorX, z: 2.3, r: 1.2 };
const S = STRINGS.store;
const Q = Math.PI / 2;
/* The self-checkout (セルフレジ, Tan 2026-09-28: no cashier): the terminal
 * on the counter nearest the door, facing the shop (store frame). */
const REG_Z = STORE.till.z;
const TILL = {
  box: new THREE.Box3(new THREE.Vector3(5.95, 0.85, REG_Z - 0.62), new THREE.Vector3(7.9, 1.95, REG_Z + 0.62)),
  screen: new THREE.Vector3(6.2, 1.34, REG_Z),                   // its touchscreen, tilted to you
  scan: new THREE.Vector3(6.2, 1.0, REG_Z - 0.02),               // on the scanner's glass
  reader: new THREE.Vector3(6.2, 1.05, REG_Z + 0.3),             // the IC reader's pad
  bag: new THREE.Vector3(6.25, 0.99, REG_Z - 0.48),             // the bagging shelf, left of it
  stand: new THREE.Vector3(5.45, 0, REG_Z),
  look: new THREE.Vector3(6.2, 1.3, REG_Z),
};
/** The transit card you pay with: our own (Tan: an IC card like Suica, no real brand). */
function cardTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 160;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 256, 160);
  gr.addColorStop(0, '#7fd6a4'); gr.addColorStop(1, '#2fa36e');
  g.fillStyle = gr; g.beginPath(); g.roundRect(0, 0, 256, 160, 16); g.fill();
  // Fuji in white, the wordmark, the chip and the IC mark
  g.fillStyle = 'rgba(255,255,255,0.9)';
  g.beginPath(); g.moveTo(120, 132); g.lineTo(178, 70); g.lineTo(196, 70); g.lineTo(254, 132); g.closePath(); g.fill();
  g.fillStyle = '#ffffff'; g.font = 'bold 44px "Avenir Next", "Helvetica Neue", sans-serif'; g.textBaseline = 'top';
  g.fillText('Fujica', 18, 16);
  g.font = 'bold 15px "Hiragino Kaku Gothic ProN", sans-serif'; g.fillText('フジカ', 20, 64);
  g.fillStyle = '#e8c35a'; g.beginPath(); g.roundRect(22, 96, 40, 30, 5); g.fill();
  g.strokeStyle = '#b8902a'; g.lineWidth = 1.5; g.strokeRect(30, 104, 24, 14);
  g.fillStyle = '#ffffff'; g.font = 'bold 18px sans-serif'; g.fillText('IC', 214, 134);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function makeShop(inside, { doors, lit, colliders = [], entrance = null }) {
  const units = inside.userData.units;

  /* ------------------- the featured facings, as boxes ------------------- */
  const pickable = [];
  const bb = new THREE.Box3(), m4 = new THREE.Matrix4();
  for (const u of units) {
    if (u.front || !u.feature) continue;
    const box = new THREE.Box3();
    for (const w of [u, ...u.backs]) {
      unitMatrix(w, m4);
      box.union(bb.copy(productGeometry(w.id).boundingBox).applyMatrix4(m4));
    }
    u.box = box;
    u.centre = box.getCenter(new THREE.Vector3());
    u.full = u.count;
    u.depth = productGeometry(u.id).boundingBox.max.z - productGeometry(u.id).boundingBox.min.z + 0.012;
    const h = u.slot.zone;
    u.door = doors.list.find((d) => d.spec.holds.zone === h
      && u.centre[d.spec.holds.axis] >= d.spec.holds.a && u.centre[d.spec.holds.axis] < d.spec.holds.b) ?? null;
    pickable.push(u);
  }

  /* ----------------------------- the cast ----------------------------- */
  const view = new THREE.Group();          // follows the camera (main.js adds it to the scene)
  view.matrixAutoUpdate = false;
  view.name = 'shop-view';
  const fx = new THREE.Group();            // flights, in world terms
  fx.name = 'shop-fx';
  const hands = makeHands(lit);
  view.add(hands.view);
  /* The self-checkout's screen: what it asks, what you bought, the total.
   * Redrawn only when it changes. */
  const makeScreen = (z) => {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 192;
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.userData.live = true;          // (redrawn as you pay: the phone keeps its canvas, mobile/lite.js releaseCanvases)
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.225), new THREE.MeshBasicMaterial({ map: t, toneMapped: false }));
    mesh.position.set(TILL.screen.x, TILL.screen.y, z);
    mesh.rotation.set(0, -Q, 0);
    mesh.rotateX(-0.35);                       // leaned back toward the customer
    mesh.userData.noOutline = true;
    mesh.userData.dynamic = true;
    inside.add(mesh);
    const JP = '"Hiragino Kaku Gothic ProN", "Hiragino Sans", sans-serif';
    let last = '';
    const show = (state, id = null, sum = 0) => {
      const key = state + id + sum;
      if (key === last) return;
      last = key;
      const g = c.getContext('2d');
      g.fillStyle = '#f4f7fb'; g.fillRect(0, 0, 256, 192);
      g.fillStyle = '#1f5fae'; g.fillRect(0, 0, 256, 30);
      g.fillStyle = '#fff'; g.font = `bold 15px ${JP}`; g.textBaseline = 'middle'; g.textAlign = 'left';
      g.fillText('セルフレジ', 10, 15);
      g.textAlign = 'center';
      const big = (txt, y, col = '#1d2230', px = 20) => { g.fillStyle = col; g.font = `bold ${px}px ${JP}`; g.fillText(txt, 128, y); };
      if (state === 'idle') { big('画面にタッチして', 88); big('スタート', 118); }
      if (state === 'scan') { big('商品のバーコードを', 84); big('スキャンしてください', 112); }
      if (state === 'item' || state === 'pay' || state === 'tap' || state === 'paid') {
        const p = PRODUCT[id] ?? null;
        if (p) {
          g.textAlign = 'left'; g.fillStyle = '#1d2230'; g.font = `bold 15px ${JP}`; g.fillText(p.nameJa, 12, 48);
          g.textAlign = 'right'; g.fillText('¥' + p.priceYen, 244, 48);
          g.fillStyle = '#d8dee8'; g.fillRect(10, 62, 236, 2);
          g.textAlign = 'right'; g.font = `bold 26px ${JP}`; g.fillStyle = '#1d2230'; g.fillText('合計 ¥' + sum, 244, 88);
          g.textAlign = 'center';
        }
        if (state === 'pay') { g.fillStyle = '#2fa36e'; g.beginPath(); g.roundRect(40, 118, 176, 52, 10); g.fill(); big('交通系IC', 144, '#fff', 20); }
        if (state === 'tap') { big('カードをリーダーに', 132, '#1f5fae', 17); big('タッチしてください', 158, '#1f5fae', 17); }
        if (state === 'paid') { big('ありがとうございました', 136, '#2fa36e', 17); big('レシートをお取りください', 162, '#5a6070', 13); }
      }
      t.needsUpdate = true;
    };
    show('idle');
    return { mesh, show };
  };
  const screen = makeScreen(REG_Z);
  makeScreen(REG_Z < -3.9 ? REG_Z + 0.88 : REG_Z - 0.88);  // the other self-checkout, waiting (clear of the bun steamer: interior.js)
  // the card, drawn on top like what you hold; in your right hand only to pay
  const cardMat = onTopClamped(new THREE.MeshBasicMaterial({ map: cardTexture() }));
  lit.push(cardMat);
  const card = new THREE.Mesh(new THREE.PlaneGeometry(0.086, 0.054), cardMat);
  card.frustumCulled = false; card.renderOrder = 11; card.visible = false;
  card.geometry.computeBoundingBox();
  const CARD_ROT = [-0.5, 0, 0.12];
  card.rotation.set(...CARD_ROT);
  hands.anchor.add(card);
  /** Close the hand as it holds product `id` in its pack (store/hands.js). */
  const holdItem = (id) => hands.setHold(holdFor(PRODUCT[id].mesh.shape));

  /* what you carry: the product's own page material, drawn on top */
  const pageMat = new Map();
  const topMat = (u) => {
    const src = u.mat;
    if (!pageMat.has(src)) { const m = onTopClamped(src.clone()); u.page.adopt(m); lit.push(m); pageMat.set(src, m); }   // (it follows its page: store/pages.js)
    return pageMat.get(src);
  };
  const itemMesh = (u) => {
    const m = new THREE.Mesh(productGeometry(u.id), topMat(u));
    m.frustumCulled = false;
    m.renderOrder = 11;
    return m;
  };

  /* ------------------------------- state ------------------------------- */
  const held = [];              // { id, u, mesh, hand, paid, where: 'flying' | 'hand' | 'counter' }
  const flights = [], slides = [], pendingTakes = [];
  let wasInside = false, wallet = STORE.wallet;
  let phase = 'out';            // out | shop | till | paid | eat
  let checkout = null;          // the running checkout's timeline
  let primed = false;
  const api = {
    view, fx, hands, screen,
    get held() { return held; },
    get phase() { return phase; },
    get wallet() { return wallet; },
    get busy() { return visit.active || phase === 'till'; },
    /** Scripted: the visit is playing (main.js leaves the player alone). */
    get visiting() { return visit.active; },
    /** Standing on the highlighted spot at the door, free to choose. */
    atSpot: false,
    /** What you can choose (catalogue ids), in the order main.js lists them. */
    menu: FEATURED.flatMap((f) => f.ids),
    onTipsy: null,             // main.js: after the Strong Nine
    onSnack: null,             // main.js: (phase, id): 'hold' paid and on your way out with it, 'eat' the first of it, 'done' gone (Hachi's bits)
    flash: null,               // main.js: hud.flash
    onSound: null,             // main.js: (kind, unit) -> the sound engine (taking it off the shelf)
    onEnter: null, onExit: null,
    player: null,              // main.js: the player, held still while you pay
    isFamousView: () => false, // main.js
    spot: null,                // lawson.js: the konbini's experience spot outside
  };
  /* ------------------------------ sounds ------------------------------ */
  const at = (p) => inside.localToWorld(p.clone());
  const tillAt = () => at(TILL.screen);
  /** A sound from the self-checkout (Tan's recording), heard only near it. */
  const heard = [];                 // dev tests: what the self-checkout played
  const tillSound = (name, recipe, gain = 1) => { const w = tillAt(); heard.push(name); soundBus.oneShot(name, { x: w.x, y: w.y, z: w.z, ...STORE.tillSound, gain, recipe, indoor: true }); };
  /** Sounds at you (eating). */
  const EAT_RECIPE = { bite: 'soft', munch: 'paper', gulp: 'bottle', 'can-open': 'can', wrapper: 'plastic' };
  const mine = (name) => soundBus.oneShot(name, { gain: STORE.eatGain[name] ?? 0.8, recipe: EAT_RECIPE[name] });
  /* The engine plays a file only once it is decoded, and a recipe until then:
   * ask for them all quietly as you come near, so the first of each is real. */
  function prime() {
    if (primed || !soundBus.ready) return;
    primed = true;
    // (it waits for the list of files: asked for too early, it fetched nothing and the first checkout was a tap)
    soundBus.preload(['kiosk-scan', 'kiosk-pay', 'ka-ching', 'bite', 'munch', 'gulp', 'can-open', 'wrapper']);
  }

  /* ----------------------------- flights ----------------------------- */
  /** Fly `mesh` from world matrix `from` to wherever `to()` says (a world matrix), then `done()`. */
  const _pa = new THREE.Vector3(), _pb = new THREE.Vector3(), _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion(), _sa = new THREE.Vector3(), _sb = new THREE.Vector3();
  function fly(mesh, from, to, { dur = STORE.flight, arc = 0.12, done = null } = {}) {
    mesh.matrixAutoUpdate = false;
    fx.add(mesh);
    const f = { mesh, from: from.clone(), to, t: 0, dur, arc, done };
    flights.push(f);
    return f;
  }
  const worldOf = (obj) => { obj.updateWorldMatrix(true, false); return obj.matrixWorld; };
  /** A thing on the counter at `p` (store frame), its front toward you. */
  const counterMatrix = (p, ry = -Q) => new THREE.Matrix4().makeRotationY(ry).setPosition(at(p));
  /** Hold `mesh` in the anchor, centred and facing you. */
  function holdIn(mesh, anchor) {
    mesh.matrixAutoUpdate = true;
    const c = mesh.geometry.boundingBox.getCenter(new THREE.Vector3());
    mesh.position.copy(c).multiplyScalar(-1);
    mesh.rotation.set(0, 0, 0);
    mesh.scale.setScalar(1);
    anchor.add(mesh);
  }
  const anchorMatrix = (mesh) => () => {
    const a = hands.anchor;
    const c = mesh.geometry.boundingBox.getCenter(new THREE.Vector3());
    return new THREE.Matrix4().copy(worldOf(a)).multiply(new THREE.Matrix4().makeTranslation(-c.x, -c.y, -c.z));
  };

  /* ------------------------------ taking ------------------------------ */
  const total = () => held.filter((h) => !h.paid && h.where !== 'gone').reduce((n, h) => n + PRODUCT[h.id].priceYen, 0);
  function refreshSlot(u) { [u, ...u.backs].forEach((w, i) => placeUnit(w, 0, i >= u.count)); }
  /** Take the one thing chosen off its shelf, into your right hand. */
  function take(u, doorOpen = false) {
    if (phase !== 'shop') return;
    // the chu-hi is behind a fridge door: it swings open first
    if (u.door && u.door.open < 0.6 && !doorOpen) { doors.open(u.door); pendingTakes.push({ u, t: 0.32 }); return; }
    const from = unitMatrix(u, new THREE.Matrix4()).premultiply(inside.matrixWorld);
    u.count--;
    holdItem(u.id);
    const mesh = itemMesh(u);
    const h = { id: u.id, u, mesh, hand: 0, paid: false, where: 'flying' };
    held.push(h);
    fly(mesh, from, anchorMatrix(mesh), { done: () => { h.where = 'hand'; holdIn(mesh, hands.anchor); } });
    api.onSound?.('take', u);
    refreshSlot(u);
    if (u.count > 0 && u.slot.zone !== 'icecase') slides.push({ u, t: -0.08 });
  }
  /** Walked out with unpaid things (a famous-view key, say): they go straight back. */
  function returnUnpaid() {
    let n = 0;
    for (const h of [...held]) {
      if (h.paid) continue;
      h.mesh.removeFromParent();
      if (h.where !== 'gone') { h.u.count++; refreshSlot(h.u); n++; }
      held.splice(held.indexOf(h), 1);
    }
    return n;
  }

  /* ------------------------------ paying ------------------------------ */
  /* The self-checkout, as a timeline of moments, set to two short cuts of
   * Tan's recording (STORE.kiosk: where their beeps fall).  About 3.7 s from
   * standing at it to walking away, the machine still talking as you go:
   *   0.00  the screen asks for a scan; your thing goes onto the scanner
   *   0.45  the scan beep as it lands; the screen shows it and the total
   *   0.90  onto the bagging shelf; the screen asks how you'll pay
   *   1.35  the IC card up in your right hand
   *   2.25  the card on the reader: its beep
   *   3.15  the paid beep: the screen thanks you
   *   3.25  the card away, your thing back from the shelf
   *   3.70  yours again (the thanks and the closing two-tone play on) */
  function startCheckout() {
    const items = held.filter((h) => !h.paid && h.where === 'hand');
    if (phase !== 'shop' || !items.length || flights.length) return;
    phase = 'till';
    const sum = total();
    const K = STORE.kiosk;
    const h = items[0];
    const ev = [];
    const T = (t, fn) => ev.push({ t, fn });
    const p = api.player;
    if (p) p.suspended = true;
    gaze = TILL.scan;
    const beep = 0.45;                             // the item lands on the scanner on the recording's beep
    T(0, () => {
      screen.show('scan');
      const f = worldOf(h.mesh).clone();
      h.mesh.removeFromParent();
      h.where = 'flying';
      fly(h.mesh, f, () => counterMatrix(TILL.scan), { dur: beep, arc: 0.05, done: () => { h.where = 'counter'; } });
    });
    T(beep - K.scanBeep, () => tillSound('kiosk-scan', 'ui-tap', STORE.checkoutGain));
    T(beep - 0.1, () => hands.raise(false));             // an empty hand has nothing to do in view
    T(beep, () => screen.show('item', h.id, sum));
    T(beep + 0.45, () => { gaze = TILL.look; screen.show('pay', h.id, sum); fly(h.mesh, counterMatrix(TILL.scan), () => counterMatrix(TILL.bag), { dur: 0.4, arc: 0.06 }); });
    // the card: up in the right hand (0.55 s), onto the reader on the card beep
    const tp = beep + 0.9, cardAt = tp + 0.9, pay = cardAt - K.payCard;
    T(tp, () => { screen.show('tap', h.id, sum); hands.setHold('card', { rot: CARD_ROT }); card.visible = true; hands.raise(true); gaze = TILL.reader; });
    T(pay, () => tillSound('kiosk-pay', 'ui-tap', STORE.checkoutGain));
    T(cardAt - 0.45, () => { reachFor(TILL.reader); reachR = 0; });
    T(cardAt + 0.05, () => tillSound('ka-ching', 'can', STORE.checkoutGain));      // paid: the ka-ching as the card taps (Tan)
    T(cardAt + 0.35, () => { reachR = -1; });
    T(pay + K.payDone, () => { screen.show('paid', h.id, sum); gaze = TILL.look; });
    // the card away, your thing back from the bagging shelf
    T(pay + K.payDone + 0.1, () => {
      card.visible = false;
      holdItem(h.id);
      gaze = null;
      h.paid = true;
      fly(h.mesh, counterMatrix(TILL.bag), anchorMatrix(h.mesh), { dur: 0.4, done: () => { h.where = 'hand'; holdIn(h.mesh, hands.anchor); } });
    });
    T(pay + K.payDone + 0.55, () => {
      phase = 'paid';
      wallet = STORE.wallet - sum;
      /* The view stays the walk's until you are outside (Tan, 2026-10-02): free from here, you could turn to any shelf
       * on the way out, so nearly all the stock and its labels had to stay (store/seen.js).  The visit hands it back
       * on the pavement, as you turn to the street to eat. */
      if (api.player && !visit.active) api.player.suspended = false;
    });
    checkout = { ev, t: 0, sum };
  }
  let gaze = null;                 // where you look during the checkout (store frame)
  const reachTo = new THREE.Vector3(-0.03, 0.09, -0.22);
  /** Reach the right hand so what it holds lands on `p` (store frame): p in the camera's terms, less where the hand rests and its grip. */
  let lastCam = null;
  const _rv = new THREE.Vector3(), _ra = new THREE.Vector3();
  let reachGoal = null, reachErr = 0;            // a point the hand is homing in on (store frame), or null
  function reachFor(p) {
    reachGoal = p;
    if (!lastCam) return;
    lastCam.updateMatrixWorld();
    _rv.copy(p).applyMatrix4(inside.matrixWorld);
    lastCam.worldToLocal(_rv);
    _ra.copy(hands.R.anchor.position).applyQuaternion(hands.R.pivot.quaternion);
    reachTo.copy(_rv).sub(hands.R.rest.pos).sub(_ra);
    reachTo.y += 0.012;                      // just over the pad
  }
  let reachR = null;               // the right hand's reach (to the shelf, to the reader): 0..1 out, -1 back
  function abortCheckout() {
    checkout = null;
    for (const f of [...flights]) { flights.splice(flights.indexOf(f), 1); f.mesh.removeFromParent(); }
    for (const h of held) { h.mesh.removeFromParent(); h.u.count++; refreshSlot(h.u); }
    held.length = 0;
    hands.R.off.set(0, 0, 0); reachR = null;
    card.visible = false; gaze = null;
    screen.show('idle');
    if (api.player) api.player.suspended = false;
    phase = 'out';
    hands.raise(false);
  }

  /* ------------------------------ eating ------------------------------ */
  const eating = makeEating(hands, hands.skinMat, mine);
  function startEating() {
    phase = 'eat';
    const h = held.find((x) => x.paid && x.where === 'hand');
    eating.start(h ? { id: h.id, mesh: h.mesh, onEaten: () => { h.where = 'gone'; } } : null);
    snacking = h?.id ?? null;
    if (snacking) api.onSnack?.('eat', snacking);
  }
  let snacking = null;
  function finishEating() {
    if (snacking) { api.onSnack?.('done', snacking); snacking = null; }
    for (const h of held) h.mesh.removeFromParent();
    held.length = 0;
    screen.show('idle');
    phase = wasInside ? 'shop' : 'out';
    if (!wasInside) hands.raise(false);
    api.spot?.done();
  }

  const inv = new THREE.Matrix4();
  /* ------------------------------ the visit ------------------------------ */
  const visit = { active: false, id: null, eat: false, queue: [], cur: null, armed: true };
  const WALK = STORE.walk;                  // m/s, a brisk konbini pace (Tan: the visit in 30-35 s)

  /* Where you can stand: the store's floor and the forecourt on a 10 cm
   * grid, clear of every collider (the entrance's own leaves excepted: they
   * open for you).  Two clearances: the walk is planned keeping a good
   * half metre off every shelf (a shopper, not a ghost brushing the
   * stock), and only where an aisle is narrower than that does it fall back
   * to the body's own width. */
  let grids = null;
  function makeGrid(R) {
    const C = 0.1;
    const X0 = -hw + 0.1, X1 = hw - 0.1, Z0 = -LAWSON.depth + 0.1, Z1 = 3.4;
    const nx = Math.ceil((X1 - X0) / C), nz = Math.ceil((Z1 - Z0) / C);
    const solid = colliders.filter((c) => !(c.top !== undefined && c.top <= 0.38)
      && !(entrance && c.x0 === entrance.d0 && c.x1 === entrance.d1)).concat(WALK_AROUND);
    const free = new Uint8Array(nx * nz);
    for (let iz = 0; iz < nz; iz++) for (let ix = 0; ix < nx; ix++) {
      const x = X0 + (ix + 0.5) * C, z = Z0 + (iz + 0.5) * C;
      free[iz * nx + ix] = solid.some((c) => x > c.x0 - R && x < c.x1 + R && z > c.z0 - R && z < c.z1 + R) ? 0 : 1;
    }
    const ok = (x, z) => { const ix = Math.floor((x - X0) / C), iz = Math.floor((z - Z0) / C); return ix >= 0 && iz >= 0 && ix < nx && iz < nz && free[iz * nx + ix] === 1; };
    return { C, X0, Z0, nx, nz, free, ok,
      cell: (x, z) => [Math.floor((x - X0) / C), Math.floor((z - Z0) / C)],
      at: (ix, iz) => new THREE.Vector2(X0 + (ix + 0.5) * C, Z0 + (iz + 0.5) * C),
      /** Nothing in the way along a straight line from p to q. */
      sight: (p, q) => { const n = Math.ceil(p.distanceTo(q) / 0.04); for (let i = 1; i < n; i++) { const t2 = i / n; if (!ok(p.x + (q.x - p.x) * t2, p.y + (q.y - p.y) * t2)) return false; } return true; } };
  }
  /* Props with no collider that a walk must still go round (store frame):
   * the umbrella-bag stand by the door (interior.js). */
  const WALK_AROUND = [{ x0: -1.02, x1: -0.78, z0: -0.95, z1: -0.75 }];
  /* Three clearances: a good half metre off the shelves; the body's own
   * width; and a squeeze (shoulders past the umbrella stand, which leaves
   * 0.69 m to the end caps of the front aisle). */
  const getGrids = () => (grids ??= { wide: makeGrid(0.55), body: makeGrid(0.38), squeeze: makeGrid(0.28) });
  /** The free cell nearest (x, z). */
  function nearestFree(g, x, z) {
    let [cx, cz] = g.cell(x, z), best = null, bd = Infinity;
    for (let r = 0; r < 30 && !best; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      const ix = cx + dx, iz = cz + dz;
      if (ix < 0 || iz < 0 || ix >= g.nx || iz >= g.nz || !g.free[iz * g.nx + ix]) continue;
      const d = dx * dx + dz * dz;
      if (d < bd) { bd = d; best = [ix, iz]; }
    }
    return best;
  }
  /** The shortest way on grid `g` (A*, eight ways, true distances), as cell centres; null if none. */
  function search(g, a, b) {
    const N = g.nx * g.nz, cost = new Float32Array(N).fill(Infinity), prev = new Int32Array(N).fill(-1), shut = new Uint8Array(N);
    const start = a[1] * g.nx + a[0], goal = b[1] * g.nx + b[0];
    const hx = (c) => Math.hypot((c % g.nx) - b[0], ((c / g.nx) | 0) - b[1]);
    // a small binary heap of [f, cell]
    const heap = [];
    const push = (f, c) => { heap.push([f, c]); let i = heap.length - 1; while (i > 0) { const p2 = (i - 1) >> 1; if (heap[p2][0] <= heap[i][0]) break; [heap[p2], heap[i]] = [heap[i], heap[p2]]; i = p2; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
    cost[start] = 0; push(hx(start), start);
    while (heap.length) {
      const [, c] = pop();
      if (shut[c]) continue;
      shut[c] = 1;
      if (c === goal) break;
      const cx = c % g.nx, cz = (c / g.nx) | 0;
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        const ix = cx + dx, iz = cz + dz, n = iz * g.nx + ix;
        if ((!dx && !dz) || ix < 0 || iz < 0 || ix >= g.nx || iz >= g.nz || !g.free[n] || shut[n]) continue;
        if (dx && dz && (!g.free[cz * g.nx + ix] || !g.free[iz * g.nx + cx])) continue;    // no corner cutting
        const nc = cost[c] + (dx && dz ? Math.SQRT2 : 1);
        if (nc < cost[n]) { cost[n] = nc; prev[n] = c; push(nc + hx(n), n); }
      }
    }
    if (prev[goal] < 0 && goal !== start) return null;
    const cells = [];
    for (let c = goal; ; c = prev[c]) { cells.push(g.at(c % g.nx, (c / g.nx) | 0)); if (c === start) break; }
    return cells.reverse();
  }
  /** A walk from `from` to `to`: the shortest way, pulled taut, its corners rounded where that stays clear. */
  function plan(from, to) {
    const { wide, body, squeeze } = getGrids();
    /* The roomier clearance is kept unless a tighter one saves a detour: the
     * umbrella stand closes the front aisle to the wide and body grids, and
     * from the till they went round the back of the store (23.6 m for 10). */
    let pick = null;
    for (const gg of [wide, body, squeeze]) {
      const a = nearestFree(gg, from.x, from.y), b = nearestFree(gg, to.x, to.y);
      const c = a && b ? search(gg, a, b) : null;
      if (!c) continue;
      const len = c.reduce((n, q, i) => n + (i ? q.distanceTo(c[i - 1]) : 0), 0);
      if (!pick || len < pick.len * 0.8 - 0.5) pick = { g: gg, cells: c, len };
    }
    if (!pick) return [from.clone(), to.clone()];
    const g = pick.g, cells = pick.cells;
    // pulled taut: from each point, the farthest one still in plain sight
    const all = [from.clone(), ...cells, to.clone()];
    let pts = [all[0]];
    for (let i = 0; i < all.length - 1;) {
      let j = all.length - 1;
      while (j > i + 1 && !g.sight(all[i], all[j])) j--;
      pts.push(all[j].clone());
      i = j;
    }
    // each corner rounded (a short curve from 0.6 m before it to 0.6 m after), if that curve is clear
    const out = [pts[0]];
    for (let i = 1; i < pts.length - 1; i++) {
      const a = pts[i - 1], c = pts[i], b = pts[i + 1];
      const ra = Math.min(0.6, a.distanceTo(c) / 2), rb = Math.min(0.6, b.distanceTo(c) / 2);
      const p0 = c.clone().add(a.clone().sub(c).setLength(ra)), p1 = c.clone().add(b.clone().sub(c).setLength(rb));
      const curve = [];
      for (let k = 0; k <= 6; k++) {
        const t2 = k / 6;
        curve.push(p0.clone().multiplyScalar((1 - t2) * (1 - t2)).add(c.clone().multiplyScalar(2 * t2 * (1 - t2))).add(p1.clone().multiplyScalar(t2 * t2)));
      }
      if (curve.every((q, k) => k === 0 || (g === squeeze ? squeeze : body).sight(curve[k - 1], q))) out.push(...curve);
      else out.push(c);
    }
    out.push(pts[pts.length - 1]);
    return out;
  }

  const P2 = (x, z) => new THREE.Vector2(x, z);
  /** Where to stand to take from `u`: in the aisle in front of it. */
  function standFor(u) {
    const s = u.slot, c = u.centre;
    if (s.zone === 'chilled') return P2(s.rail + 0.95, c.z);
    if (s.zone === 'drinks') return P2(c.x, s.rail + 0.95);
    return P2(c.x, -3.0 + 0.62);                    // the ice case's front rim
  }
  /** Turn to look at `p` (store frame, a Vector3). */
  function lookAngles(p, camera) {
    const w = at(p).sub(camera.position);
    return { yaw: Math.atan2(-w.x, -w.z), pitch: Math.atan2(w.y, Math.hypot(w.x, w.z)) };
  }
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

  /* The scene, as a queue of steps; each is { kind, ... } and runs until done. */
  const walkTo = (to) => ({ kind: 'walk', to });
  const face = (p, dur = 0.7) => ({ kind: 'face', p, dur });
  const act = (fn) => ({ kind: 'do', fn });
  const until = (cond) => ({ kind: 'wait', cond });
  const pause = (sec) => ({ kind: 'pause', sec });

  /** Play the visit for catalogue id `id` (one of api.menu). */
  api.play = (id) => {
    if (visit.active || !api.player) return false;
    const u = pickable.filter((x) => x.id === id && x.count > 0)[0];
    if (!u) return false;
    const p = api.player;
    visit.active = true; visit.id = id; visit.eat = false; visit.t = 0; visit.marks = [];
    p.scripted = true; p.suspended = true;
    p.vel.set(0, 0, 0);
    const street = new THREE.Vector3(SPOT.x + 0.6, 0.55, SPOT.z + 12);      // (eyes a little down the road as you eat: Hachi sits there doing its bit, animals/guide.js)
    /* Tan (2026-09-28): in, the chime, the store's music on the way to the
     * shelf, take it, the self-checkout's sounds, out through the chime, eat;
     * 30-35 s in all.  No idle pauses: the hand goes up as you turn to the
     * shelf and comes back as you walk on. */
    const L = (label, step) => Object.assign(step, { label });
    visit.queue = [
      L('in', walkTo(standFor(u))),
      L('take', act(() => { holdItem(u.id); hands.raise(true); })),
      face(u.centre.clone(), 0.6),
      act(() => { reachTo.set(-0.03, 0.09, -0.22); reachR = 0; }),
      pause(0.2),
      act(() => take(u)),
      until(() => held.some((h) => h.where === 'hand') && !flights.length && !pendingTakes.length),
      act(() => { reachR = -1; }),
      L('to-till', walkTo(P2(TILL.stand.x, TILL.stand.z))),
      L('checkout', face(TILL.look, 0.5)),
      act(() => startCheckout()),
      until(() => phase === 'paid'),
      act(() => api.onSnack?.('hold', id)),
      L('out', walkTo(P2(SPOT.x, SPOT.z + 0.1))),
      L('eat', face(street, 0.6)),
      act(() => { visit.eat = true; p.suspended = false; }),     // outside, facing the street: the view is yours again
      until(() => phase === 'out' || phase === 'shop'),
      pause(0.3),
    ];
    visit.cur = null;
    return true;
  };
  function endVisit() {
    const p = api.player;
    visit.active = false; visit.eat = false; visit.armed = false;
    p.scripted = false; p.suspended = false;
    p.vel.set(0, 0, 0);
    api.flash?.(S.ate, 4200);
    if (visit.id === 'strong_nine') api.onTipsy?.();
  }
  const _l = new THREE.Vector3();
  function stepVisit(dt, camera) {
    const p = api.player;
    visit.t += dt;
    let moving = 0;
    for (let guard = 0; guard < 4; guard++) {
      if (!visit.cur) {
        visit.cur = visit.queue.shift() ?? null;
        if (!visit.cur) { endVisit(); break; }
        const c = visit.cur;
        c.t = 0;
        visit.marks.push([c.label ?? c.kind, +visit.t.toFixed(2)]);   // (dev: the timeline, part by part)
        if (c.kind === 'walk') {
          _l.copy(p.pos).applyMatrix4(inv.copy(inside.matrixWorld).invert());
          c.path = plan(P2(_l.x, _l.z), c.to);
          c.len = [0];
          for (let i = 1; i < c.path.length; i++) c.len.push(c.len[i - 1] + c.path[i].distanceTo(c.path[i - 1]));
          c.s = 0;
        }
        if (c.kind === 'face') { c.from = { yaw: p.yaw, pitch: p.pitch }; c.goal = lookAngles(c.p, camera); }
        if (c.kind === 'do') { c.fn(); visit.cur = null; continue; }
      }
      const c = visit.cur;
      c.t += dt;
      if (c.kind === 'walk') {
        const L = c.len[c.len.length - 1];
        const pt = (s) => {
          s = Math.max(0, Math.min(L, s));
          let i = 1;
          while (i < c.len.length - 1 && c.len[i] < s) i++;
          const k = (s - c.len[i - 1]) / Math.max(1e-6, c.len[i] - c.len[i - 1]);
          return c.path[i - 1].clone().lerp(c.path[i], k);
        };
        // ease in and out over the first and last half metre
        const v = WALK * Math.min(1, 0.35 + c.s / 0.6, 0.35 + (L - c.s) / 0.6);
        let next = c.s + v * dt;
        // the automatic door: wait for it to open
        const q = pt(next);
        if (entrance && q.y > -0.45 && q.y < 0.6 && Math.abs(q.x - LAWSON.doorX) < LAWSON.doorWidth && entrance.open < 0.8) next = c.s;
        moving = (next - c.s) / Math.max(dt, 1e-6);
        c.s = next;
        const here = pt(c.s), ahead = pt(c.s + 1.1);          // looking a little further ahead at the brisker pace
        const w = inside.localToWorld(new THREE.Vector3(here.x, 0, here.y));
        p.pos.x = w.x; p.pos.z = w.z;
        p.pos.y += (p.world.heightAt(w.x, w.z, p.pos.y) - p.pos.y) * Math.min(1, dt * 18);
        const d = ahead.sub(here);
        if (d.lengthSq() > 1e-4) {
          const wd = new THREE.Vector3(d.x, 0, d.y).transformDirection(inside.matrixWorld);
          const yaw = Math.atan2(-wd.x, -wd.z);
          p.yaw += wrap(yaw - p.yaw) * Math.min(1, dt * 4.5);
        }
        p.pitch += (-0.06 - p.pitch) * Math.min(1, dt * 3);
        if (c.s >= L - 1e-3) visit.cur = null;
      } else if (c.kind === 'face') {
        const k = ease(clamp01(c.t / c.dur));
        p.yaw = c.from.yaw + wrap(c.goal.yaw - c.from.yaw) * k;
        p.pitch = c.from.pitch + (c.goal.pitch - c.from.pitch) * k;
        if (c.t >= c.dur) visit.cur = null;
      } else if (c.kind === 'pause') {
        if (c.t >= c.sec) visit.cur = null;
      } else if (c.kind === 'wait') {
        if (c.cond()) visit.cur = null;
      }
      break;
    }
    p.bob += dt * moving * 6.4;
    p.applyCamera(moving);
  }

  /* ------------------------------- frame ------------------------------- */
  const local = new THREE.Vector3();
  /** Is `camera` inside the store? */
  api.inside = (camera) => {
    local.copy(camera.position).applyMatrix4(inv.copy(inside.matrixWorld).invert());
    return local.x > -hw && local.x < hw && local.z < 0 && local.z > -LAWSON.depth;
  };
  api.unitAt = (u) => inside.localToWorld(new THREE.Vector3(u.x, u.y, u.z));
  api.coolerAt = inside.localToWorld(new THREE.Vector3(-2.4, 1, -12.3));
  api.doors = doors;
  /** The automatic door opens for the visit only (you don't roam the store); anyone inside is let out. */
  api.holdDoor = (p) => !visit.active && p.z > -0.15;

  let t = 0;
  const _e = new THREE.Vector3();
  api.update = (dt, camera, bob = 0) => {
    t += dt;
    lastCam = camera;
    if (visit.active) stepVisit(dt, camera);
    camera.updateMatrixWorld();
    view.matrix.copy(camera.matrixWorld);
    view.matrixWorldNeedsUpdate = true;
    const inNow = api.inside(camera);
    const dDoor = Math.hypot(local.x - LAWSON.doorX, local.z);
    if (dDoor < 30) prime();

    /* coming in, going out */
    if (inNow && !wasInside) {
      if (phase === 'out') { phase = 'shop'; wallet = STORE.wallet; }
      if (phase === 'eat') { eating.stop(); finishEating(); phase = 'shop'; wallet = STORE.wallet; }
      api.onEnter?.();
    }
    if (!inNow && wasInside) {
      if (returnUnpaid()) api.flash?.(S.notOut);
      if (phase === 'shop') { phase = 'out'; hands.raise(false); }
      api.onExit?.();
    }
    wasInside = inNow;
    // left mid-checkout (a famous-view key): it is all called off
    if (phase === 'till' && !inNow) abortCheckout();

    // outside with what you paid for, clear of the door: eat
    if (phase === 'paid' && !inNow && local.z > 1.4 && (!visit.active || visit.eat)) startEating();
    // the choice shows on the spot; after a visit, only once you have stepped off and back on
    const dSpot = Math.hypot(local.x - SPOT.x, local.z - SPOT.z);
    if (dSpot > SPOT.r + 0.3) visit.armed = true;
    api.atSpot = visit.armed && !visit.active && !inNow && dSpot < SPOT.r;
    if (phase === 'eat') { eating.update(dt); if (eating.done) finishEating(); }


    /* the checkout's timeline, and the view easing onto the till */
    if (checkout) {
      checkout.t += dt;
      for (const e of checkout.ev) if (!e.done && checkout.t >= e.t) { e.done = true; e.fn(); }
      // your eyes on what matters: the screen, the scanner, the reader
      const p = api.player;
      if (p && gaze) {
        _e.copy(gaze).applyMatrix4(inside.matrixWorld).sub(camera.position);
        const yaw = Math.atan2(-_e.x, -_e.z), pitch = Math.atan2(_e.y, Math.hypot(_e.x, _e.z));
        const k = Math.min(1, dt * 4);
        p.yaw += Math.atan2(Math.sin(yaw - p.yaw), Math.cos(yaw - p.yaw)) * k;
        p.pitch += (pitch - p.pitch) * k;
      }
      if (checkout.ev.every((e) => e.done)) checkout = null;
    }
    // the right hand's reach to the shelf and back
    if (reachR !== null) {
      if (reachR >= 0) {
        reachR = Math.min(1, reachR + dt / 0.45);
        hands.R.off.copy(reachTo).multiplyScalar(easeOut(reachR));
        // homing: where the grip really is against where it should be, corrected a little each frame
        if (reachGoal && lastCam) {
          hands.R.anchor.getWorldPosition(_ra);
          lastCam.worldToLocal(_ra);
          _rv.copy(reachGoal).applyMatrix4(inside.matrixWorld);
          _rv.y += 0.012;
          lastCam.worldToLocal(_rv);
          reachErr = _rv.distanceTo(_ra);
          reachTo.addScaledVector(_rv.sub(_ra), Math.min(1, dt * 8) * easeOut(reachR));
        }
      } else {
        reachGoal = null; hands.R.off.multiplyScalar(Math.max(0, 1 - dt * 5)); if (hands.R.off.length() < 0.002) { hands.R.off.set(0, 0, 0); reachR = null; } }
    }
    if (pendingTakes.length) {
      for (let k = pendingTakes.length - 1; k >= 0; k--) {
        const pt = pendingTakes[k];
        pt.t -= dt;
        if (pt.t <= 0) { pendingTakes.splice(k, 1); take(pt.u, true); }
      }
    }

    /* your hand (hidden when down) */
    hands.update(dt, bob, camera);
    view.updateMatrixWorld(true);
    doors.update(dt, local);

    for (let k = slides.length - 1; k >= 0; k--) {
      const s = slides[k];
      s.t += dt / STORE.slide;
      const e = ease(Math.max(0, Math.min(1, s.t)));
      placeUnit(s.u, s.u.depth * (1 - e), s.u.count <= 0);
      if (s.t >= 1) { slides.splice(k, 1); refreshSlot(s.u); }
    }
    for (let k = flights.length - 1; k >= 0; k--) {
      const f = flights[k];
      f.t += dt / f.dur;
      const e = ease(Math.min(1, f.t));
      const end = f.to();
      f.from.decompose(_pa, _qa, _sa);
      end.decompose(_pb, _qb, _sb);
      _pa.lerp(_pb, e);
      _pa.y += Math.sin(Math.PI * e) * f.arc;
      _qa.slerp(_qb, e);
      f.mesh.matrix.compose(_pa, _qa, _sa.lerp(_sb, e));
      f.mesh.matrixWorldNeedsUpdate = true;
      if (f.t >= 1) {
        // it stays where it landed (the counter, the tray) unless `done` takes it on
        flights.splice(k, 1);
        f.mesh.matrix.copy(end);
        f.done?.();
      }
    }
  };

  /** The famous views are the opening shot: nothing of ours shows there (lawson.js asks). */
  api.quietView = () => api.isFamousView();

  if (import.meta.env?.DEV) {
    api.stats = inside.userData.stockStats;      // the STOCK check (scripts/shots.mjs)
    api.debug = {
      pickable, take, startCheckout, visit: () => visit, heard, tillSound: (n) => tillSound(n, null, STORE.checkoutGain), get reachErr() { return reachErr; }, get reachTo() { return reachTo; },
      /** Each leg's length (m) for `id` (dev): door to shelf, shelf to till, till to the spot. */
      legs(id) {
        const u = pickable.find((x) => x.id === id), L = (pts) => +pts.reduce((n, q, i) => n + (i ? q.distanceTo(pts[i - 1]) : 0), 0).toFixed(2);
        return [L(plan(P2(SPOT.x, SPOT.z), standFor(u))), L(plan(standFor(u), P2(TILL.stand.x, TILL.stand.z))), L(plan(P2(TILL.stand.x, TILL.stand.z), P2(SPOT.x, SPOT.z + 0.1)))];
      },
      /** The walkable floor and the walk for `id`, as text (dev): '#' blocked, '.' free, '*' the path. */
      pathMap(id, grid = 'wide') {
        const g = getGrids()[grid], u = pickable.find((x) => x.id === id);
        const legs = [plan(P2(SPOT.x, SPOT.z), standFor(u)), plan(standFor(u), P2(TILL.stand.x, TILL.stand.z)), plan(P2(TILL.stand.x, TILL.stand.z), P2(SPOT.x, SPOT.z + 0.1))];
        const rows = [];
        for (let iz = 0; iz < g.nz; iz += 2) {
          let r = '';
          for (let ix = 0; ix < g.nx; ix++) r += g.free[iz * g.nx + ix] ? '.' : '#';
          rows.push(r.split(''));
        }
        for (const leg of legs) for (let i = 1; i < leg.length; i++) {
          const a = leg[i - 1], b = leg[i], n = Math.ceil(a.distanceTo(b) / 0.1);
          for (let k = 0; k <= n; k++) {
            const x = a.x + (b.x - a.x) * k / n, z = a.y + (b.y - a.y) * k / n;
            const [ix, iz] = g.cell(x, z);
            if (rows[iz >> 1]?.[ix] !== undefined) rows[iz >> 1][ix] = rows[iz >> 1][ix] === '#' ? 'X' : '*';
          }
        }
        return rows.map((r) => r.join('')).join('\n');
      },
      /** Stop the scene where it is (dev tests): everything put back, the player freed. */
      cancel() {
        if (!visit.active) return;
        visit.queue = []; visit.cur = null;
        if (phase === 'till') abortCheckout();
        if (phase === 'eat') eating.stop();
        for (const h of held) h.mesh.removeFromParent();
        held.length = 0; hands.raise(false);
        phase = 'out';
        endVisit();
      }, productGeometry, TILL,
      get flights() { return flights; }, get checkout() { return checkout; }, eating,
      /** Everything as it is when you walk in (dev shots): hands up, the greeting done. */
      reset() { returnUnpaid(); phase = wasInside ? 'shop' : 'out'; hands.snap(wasInside); },
    };
  }
  return api;
}
