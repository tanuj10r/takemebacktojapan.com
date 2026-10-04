import * as THREE from 'three';
import { MOCHI, SOUND, STORE } from '../../config.js';
import { STRINGS } from '../../data/strings.js';
import { STREET } from '../../data/catalog.js';
import { soundBus } from '../../core/soundBus.js';
import { animalMaterial, Herd, makeShadows, painted } from '../animals/shade.js';
import { GUIDE } from '../animals/guide.js';
import { makeEating, eatStages } from '../store/eat.js';
import { rabbitGeometry, malletGeometry, malletMatrix, RIG, malletFace, swingFor, pawAt } from './rabbits.js';
import { mochiGeometry, potatoGeometry, foodMaterial } from './food.js';
import { buildShopfront, Y0, USU } from './shop.js';
import { icCardTex } from './tex.js';

/* ------------------------------------------------------------------ *
 * ぺったん堂 / PETTAN-DO: the mochi-pounding shop (Tan, 2026-10-01; the
 * order of things remade 2026-10-02 after Tan's play-test).
 *
 * A homage to Kyoto's high-speed mochi pounders, with nobody in it: three
 * white moon rabbits, a stone mortar on the open strip before a low
 * machiya front.  The shop is QUIET until you order: the steamer steams,
 * the lanterns glow, the two mallets rest in the mortar, and the rabbits
 * wait behind the counter, a pair of ears over it, one peeking at you now
 * and then.  Nothing sounds.
 *
 *   an order   E on the ring ("Order a mochi  ¥200").  You are walked the
 *              step to the order stand at the stage's edge, and then:
 *     pay      your IC card comes up in your hand, held still to be seen,
 *              taps the reader (the konbini's ka-ching, the reader's ring
 *              turns green, "Paid ¥200") and goes away
 *     enter    the three hop out by the counter's end, one by one, to their
 *              places, each with a bow to you; the pounders take up their
 *              mallets
 *     show     the pounding, to Tan's 13 s recording.  It is driven by the
 *              AUDIO clock: the one-shot's position in the file
 *              (core/sound.js `pos()`) is read each frame and the pose is a
 *              pure function of it and the cue table (config MOCHI.cues), so
 *              a dropped frame or a pause can't pull picture and sound
 *              apart.  With no sound it runs on the frame clock; with no
 *              file, on the engine's recipe.  Then the finale: the fresh
 *              mochi held up, the bow.
 *     after    the mallets are laid back in the mortar; a pounder hops over
 *              to Hachi with his dried sweet potato (no mochi for a dog) and
 *              holds it out, your eyes eased over to them; the turner brings
 *              your mochi round to the stand, hops up on its step and sets it
 *              on the plate with a bow; your hand takes it and you eat it
 *              (store/eat.js: three bites, the first a long stretchy pull)
 *     bye      they wave, bow, and hop back in; you are free again, and the
 *              ring offers another after a short rest
 *   Hachi      sits before the mortar, bobs on every strike, hops back at
 *              the cheer, wags at the bow, takes his treat and sneezes at
 *              its kinako (animals/guide.js GUIDE.watchShow / showCue)
 *
 * Cost: one instanced mesh for the three rabbits, one for the dough and its
 * strand, one for every puff of steam, one for their shadows, one for the
 * two mallets at rest; the mochi on the tray; the house is static and
 * batches with the town.
 * ------------------------------------------------------------------ */

/** main.js hands over what the shop borrows from the konbini: your hands (store/hands.js). */
export const PETTAN = { hands: null, attach(o) { Object.assign(PETTAN, o); } };

const SCALE = 1.3;                         // the rabbits stand a metre to the top of the head
const UP = -0.9, READY = -0.62, REST = 0.42, LEAN_HIT = 0.22;   // (the paws must stay before its big head: no mallet goes straight overhead)
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const ease = (u) => { u = clamp01(u); return u * u * (3 - 2 * u); };
const easeOut = (u) => { u = clamp01(u); return 1 - (1 - u) * (1 - u); };
const mix = (a, b, k) => a + (b - a) * k;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
/** 0 → 1 → 0 over [0, len] (a sine hump); 0 outside. */
const hump = (x, len) => (x <= 0 || x >= len ? 0 : Math.sin((Math.PI * x) / len));
/** Up over `a` s, held, down over `b` s, `len` s in all. */
const pulse = (x, len, a = 0.25, b = 0.25) => (x <= 0 || x >= len ? 0 : Math.min(ease(x / a), ease((len - x) / b)));

export function buildMochi(ctx, net, kit, lot) {
  const cx = (lot.rect[0] + lot.rect[2]) / 2, fz = lot.rect[3];
  const shop = buildShopfront(ctx, { cx, fz });
  const C = MOCHI.cues, LEN = MOCHI.len, OR = MOCHI.order, HOP = OR.hop;
  const [ux, uz] = MOCHI.usu;
  const toWorld = (x, z) => ctx.toWorld({ x: cx + x, z: fz + z });
  const USU_W = toWorld(ux, uz), ORDER_W = toWorld(OR.at[0], OR.at[1]), SEAT_W = toWorld(MOCHI.hachi[0], MOCHI.hachi[1]), COUNTER_W = toWorld(MOCHI.counter[0], MOCHI.counter[1]);
  const WATCH = { seat: SEAT_W, at: USU_W }, WATCH_FEED = { seat: SEAT_W, at: { x: USU_W.x, z: USU_W.z } };

  /* everything that moves, in the lot's own frame */
  const dyn = new THREE.Group();
  dyn.name = 'pettan-show';
  dyn.position.set(cx, 0, fz);
  dyn.userData.dynamic = true;
  ctx.add(dyn);
  const dctx = { add: (m) => dyn.add(m) };

  /* ---- the rabbits: 0 and 1 pound, on their steps either side of the mortar; 2 turns the dough, behind it ---- */
  const geo = rabbitGeometry();
  const mat = animalMaterial({ key: 'mochiRabbit', rig: RIG, tint: 0xd6d1ec, bands: 3 });
  const herd = new Herd(dctx, geo, mat, 3, 'rabbits', { bounds: [ux, 0.8, uz, 5.5] });
  const pose3 = new THREE.InstancedBufferAttribute(new Float32Array(12), 4);
  pose3.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('aPose3', pose3);
  // the swing that lays the mallet's face on the dough, and how far back that stands a pounder
  const feetY = Y0 + USU.step, doughTop = Y0 + USU.dough;
  const HIT = swingFor((doughTop - feetY) / SCALE, LEAN_HIT);
  const reachD = malletFace(HIT, LEAN_HIT)[1] * SCALE;
  const HOME = [
    { x: ux - reachD, y: feetY, z: uz, yaw: Math.PI / 2 },
    { x: ux + reachD, y: feetY, z: uz, yaw: -Math.PI / 2 },
    { x: ux, y: Y0, z: uz - 0.6, yaw: 0 },
  ];
  /* where each stands turned to you, at ease */
  const FACE = HOME.map((H) => Math.atan2(OR.at[0] - H.x, OR.at[1] - H.z));
  /* the mallets at rest: the left one's head in the bowl on the dough, the right one's on the mortar's rim; each lies
   * exactly where its pounder's own would with this swing and turn, so taking it up is one hand-over */
  const RIM = swingFor((Y0 + USU.rim + 0.012 - feetY) / SCALE, LEAN_HIT);
  const LAID = [{ yaw: HOME[0].yaw, swing: HIT }, { yaw: HOME[1].yaw + 0.34, swing: RIM }];
  /* which pounder takes which strike: turn about; and each kind's times */
  const hits = C.filter((c) => c.kind === 'hit').map((c) => c.t);
  const HITS = [hits.filter((_, i) => i % 2 === 0), hits.filter((_, i) => i % 2 === 1)];
  const TURNS = C.filter((c) => c.kind === 'turn').map((c) => c.t);
  const SHOUTS = C.filter((c) => c.kind === 'shout').map((c) => c.t);
  const BIG = C.filter((c) => c.kind === 'big').map((c) => c.t);
  const before = (list, t) => { let r = null; for (const v of list) { if (v <= t) r = v; else break; } return r; };
  const after = (list, t) => { for (const v of list) if (v > t) return v; return null; };

  const shadows = makeShadows(dctx, 4);
  const shadow = HOME.map(() => shadows.slot());

  /* the two mallets while nobody holds them */
  const mallets = new THREE.InstancedMesh(malletGeometry(), painted(), 2);
  mallets.name = 'pettan-mallets';
  mallets.frustumCulled = false; mallets.receiveShadow = true;
  mallets.userData.noAtlas = true;
  dyn.add(mallets);
  const _hide = new THREE.Matrix4().makeScale(0, 0, 0), _mm = new THREE.Matrix4();
  const laid = [null, null];
  function layMallets(P) {
    let any = false;
    for (let i = 0; i < 2; i++) {
      const on = P[i].role > 0.5;
      if (on === laid[i]) continue;
      laid[i] = on; any = true;
      mallets.setMatrixAt(i, on ? malletMatrix(_mm, HOME[i].x, HOME[i].y, HOME[i].z, LAID[i].yaw, SCALE, LAID[i].swing, LEAN_HIT) : _hide);
    }
    if (any) mallets.instanceMatrix.needsUpdate = true;
  }

  /* ---- the dough and the strand that follows the mallet up ---- */
  const bitGeo = new THREE.SphereGeometry(1, 12, 8);
  bitGeo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(bitGeo.attributes.position.count * 3).fill(1), 3));
  const bits = new THREE.InstancedMesh(bitGeo, painted(), 2);
  bits.name = 'pettan-dough';
  bits.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  bits.frustumCulled = false; bits.receiveShadow = true;
  bits.userData.noAtlas = true;
  dyn.add(bits);
  const _o = new THREE.Object3D(), _up = new THREE.Vector3(0, 1, 0), _d = new THREE.Vector3();
  const DOUGH = { x: ux, y: Y0 + 0.4, z: uz, r: 0.185, h: 0.075 };

  /* ---- the mochi (the ones on the tray, the one served), Hachi's treat: made the first time you come near ---- */
  // (painted by its own material, lit like what you hold: the stage is in the eave's shade all day and it must look good there)
  const foodMat = foodMaterial(), heldMat = foodMaterial({ onTop: true });
  const served = new THREE.Mesh(new THREE.BufferGeometry(), foodMat);
  served.name = 'pettan-mochi';
  served.visible = false;
  dyn.add(served);
  let tray = null;
  function makeFood() {
    served.geometry = mochiGeometry();
    const list = [[-0.13, 0.015, 0.4], [0.0, -0.02, -0.7], [0.13, 0.02, 1.9]].map(([dx, dz, ry]) => mochiGeometry({ detail: 0.36 }).rotateY(ry).translate(shop.tray[0] + dx, shop.tray[1], shop.tray[2] + dz));
    tray = new THREE.Mesh(mergeAll(list), foodMat);
    tray.name = 'pettan-tray';
    dyn.add(tray);
  }
  function mergeAll(list) {
    // (the same attributes on each: one buffer after another)
    const g = new THREE.BufferGeometry(), names = Object.keys(list[0].attributes);
    let n = 0; const idx = [];
    for (const q of list) { for (let i = 0; i < q.index.count; i++) idx.push(q.index.array[i] + n); n += q.attributes.position.count; }
    for (const k of names) {
      const size = list[0].attributes[k].itemSize, arr = new Float32Array(n * size);
      let o = 0; for (const q of list) { arr.set(q.attributes[k].array, o); o += q.attributes[k].array.length; }
      g.setAttribute(k, new THREE.BufferAttribute(arr, size));
    }
    g.setIndex(idx);
    for (const q of list) q.dispose();
    g.computeBoundingSphere();
    return g;
  }
  const potato = new THREE.Mesh(potatoGeometry(), painted());
  potato.name = 'pettan-treat';
  potato.visible = false;
  dyn.add(potato);

  /* ---- the reader's ring: pale, green for a moment as your card taps ---- */
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x9ccbe0 });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.02, 0.031, 20).rotateX(-Math.PI / 2 + 0.3), ringMat);
  ring.position.set(shop.reader[0], shop.reader[1] + 0.002, shop.reader[2]);
  ring.userData.noOutline = true;
  dyn.add(ring);
  const RING_IDLE = new THREE.Color(0x9ccbe0), RING_OK = new THREE.Color(0x5df08a);

  /* ---- steam and dust: soft pale puffs that swell and thin away (one instanced mesh) ---- */
  const PUFFS = 14, SEIRO = 4;
  const puffs = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 7, 5), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.62, depthWrite: false }), PUFFS);
  puffs.name = 'pettan-steam';
  puffs.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  puffs.frustumCulled = false;
  puffs.userData.noOutline = true; puffs.userData.noAtlas = true;
  puffs.renderOrder = 3;
  dyn.add(puffs);
  const WHITE = new THREE.Color(0xfbfaf6), KINAKO = new THREE.Color(0xe2c588);
  const puff = Array.from({ length: PUFFS }, (_, i) => ({ t: i < SEIRO ? i / SEIRO : 1, life: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, r: 0.1, live: i < SEIRO }));
  for (let i = 0; i < PUFFS; i++) { puffs.setMatrixAt(i, _hide); puffs.setColorAt(i, WHITE); }
  let nextPuff = SEIRO;
  function burst(x, y, z, n, { r = 0.07, up = 0.7, out = 0.25, life = 0.7, color = WHITE } = {}) {
    for (let k = 0; k < n; k++) {
      const i = nextPuff; nextPuff = SEIRO + ((nextPuff - SEIRO + 1) % (PUFFS - SEIRO));
      const a = Math.random() * Math.PI * 2;
      Object.assign(puff[i], { t: 0, life: life * (0.8 + 0.4 * Math.random()), x, y, z, vx: Math.cos(a) * out, vy: up * (0.7 + 0.6 * Math.random()), vz: Math.sin(a) * out, r: r * (0.8 + 0.4 * Math.random()), live: true });
      puffs.setColorAt(i, color);
    }
    puffs.instanceColor.needsUpdate = true;
  }
  function stepPuffs(dt) {
    for (let i = 0; i < PUFFS; i++) {
      const p = puff[i];
      if (i < SEIRO) {
        // the steamer: a slow column that leans off downwind
        p.t = (p.t + dt / 2.4) % 1;
        const u = p.t;
        _o.position.set(shop.seiro[0] + Math.sin(i * 2.4 + u * 3) * 0.06 + u * u * 0.22, shop.seiro[1] + u * 1.05, shop.seiro[2] + Math.cos(i * 1.7 + u * 2.2) * 0.05);
        _o.scale.setScalar((0.07 + 0.13 * u) * Math.min(1, u * 5) * (1 - u * u));
      } else {
        if (!p.live) continue;
        p.t += dt / p.life;
        if (p.t >= 1) { p.live = false; puffs.setMatrixAt(i, _hide); continue; }
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        p.vx *= 1 - 2.5 * dt; p.vz *= 1 - 2.5 * dt; p.vy *= 1 - 1.4 * dt;
        _o.position.set(p.x, p.y, p.z);
        _o.scale.setScalar(p.r * (0.5 + 1.3 * p.t) * (1 - p.t * p.t));
      }
      _o.rotation.set(0, 0, 0);
      _o.updateMatrix();
      puffs.setMatrixAt(i, _o.matrix);
    }
    puffs.instanceMatrix.needsUpdate = true;
  }

  /* ================================ where they go ================================ */
  /** One rabbit's pose: where it stands (`gy` the ground under it) and the rig's numbers. */
  const blank = () => ({ x: 0, y: 0, z: 0, gy: 0, yaw: 0, swing: REST, lean: 0, sq: 0, flop: 0, reach: 0, nod: 0, look: 0, flick: 0, hold: 0, wipe: 0, twitch: 0, role: 1 });
  const P = HOME.map(blank), Q = HOME.map(blank), E = HOME.map(blank);
  const rest = (o) => { o.swing = REST; o.lean = 0.03; o.sq = 0; o.flop = 0; o.reach = 0; o.nod = 0.05; o.look = 0; o.flick = 0; o.hold = 0; o.wipe = 0; o.twitch = 0; o.role = 1; return o; };
  const stand = (o, i, yaw) => { const H = HOME[i]; rest(o); o.x = H.x; o.y = H.y; o.gy = H.y; o.z = H.z; o.yaw = yaw; return o; };

  /* behind the counter, out of sight: the pounders nearest the way out (the right one leaves first) */
  const yr = shop.room.y, zr = shop.room.z, gap = shop.room.gap, DUCK = 0.25;
  const HIDE = [0.45, -0.35, 1.25];
  /* out by the counter's end and round to its place, a hop a leg: [x, y of the ground, z] */
  const way = (i, ...pts) => [[HIDE[i], yr, zr], ...pts, [HOME[i].x, HOME[i].y, HOME[i].z]];
  const OUTDOOR = [[gap, yr, zr + 0.14], [gap, Y0, -2.9]];
  const IN = [
    way(0, [-0.25, yr, zr], [-0.92, yr, zr], ...OUTDOOR, [-1.3, Y0, -2.2]),
    way(1, [-0.95, yr, zr], ...OUTDOOR, [-0.85, Y0, -2.5], [-0.1, Y0, -2.7], [0.7, Y0, -2.62], [1.27, Y0, -2.05]),
    way(2, [0.55, yr, zr], [-0.15, yr, zr], [-0.88, yr, zr], ...OUTDOOR, [-0.78, Y0, -2.5]),
  ];
  const START = [OR.stagger, 0, OR.stagger * 2];
  const ARRIVE = IN.map((p, i) => START[i] + (p.length - 1) * HOP);
  const T_ALL = Math.max(...ARRIVE) + 0.95, ENTER_LEN = T_ALL + 0.5;
  /* the turner's way round to the step behind the order stand, and everyone's way back in */
  const STOOL = [shop.stool[0], shop.stool[1], shop.stool[2]];
  const SERVE = [[HOME[2].x, Y0, HOME[2].z], [-0.72, Y0, -2.22], [-1.32, Y0, -1.75], [-1.32, Y0, -1.1], [-1.02, Y0, -0.72], STOOL];
  const OUT = [IN[0].slice().reverse(), IN[1].slice().reverse(), [STOOL, [-1.02, Y0, -0.72], [-1.32, Y0, -1.2], [gap + 0.05, Y0, -2.0], ...OUTDOOR.slice().reverse(), [-0.88, yr, zr], [-0.15, yr, zr], [0.55, yr, zr], [HIDE[2], yr, zr]]];
  const LEAVE = [0.55, 1.1, 0];
  const BYE_LEN = OR.bye + Math.max(...OUT.map((p, i) => LEAVE[i] + (p.length - 1) * HOP)) + 0.5;
  const T_DOWN = 0.8, SERVE_SET = 0.35 + (SERVE.length - 1) * HOP + 0.4;       // the mallets laid down; the mochi on the plate (s into the serving)
  const heading = (path, k) => Math.atan2(path[k + 1][0] - path[k][0], path[k + 1][2] - path[k][2]);
  /** `u` hops along `path` (a hop a leg), facing where it goes. */
  function hop(path, u, o, h = 0.14) {
    const n = path.length - 1, f = Math.max(0, Math.min(n - 1e-4, u)), k = Math.floor(f), fr = f - k;
    const a = path[k], b = path[k + 1], s = ease(fr), air = Math.sin(Math.PI * fr);
    o.x = mix(a[0], b[0], s); o.z = mix(a[2], b[2], s);
    o.gy = fr < 0.5 ? a[1] : b[1];
    o.y = mix(a[1], b[1], s) + (h + 0.5 * Math.abs(b[1] - a[1])) * air;
    o.sq = 0.085 * air - 0.07 * (1 - air) ** 3;
    o.flop = 0.5 * Math.sin(2 * Math.PI * fr - 0.6);
    const h1 = heading(path, k), h0 = k > 0 ? heading(path, k - 1) : h1;
    o.yaw = h0 + wrap(h1 - h0) * ease(fr / 0.4);
    return o;
  }
  const hidden = (o, i, up = 0) => { rest(o); o.x = HIDE[i]; o.z = zr; o.gy = yr; o.y = yr - DUCK * (1 - up); o.yaw = 0; return o; };

  /** Quiet: behind the counter, ears over it; within reach one at a time peeks at you (`alert`: all three up). */
  function poseQuiet(T, out, near, gx, gz, alert = 0) {
    for (let i = 0; i < 3; i++) {
      const o = out[i];
      const pk = Math.max(alert, near ? pulse(((T + i * 2.45) % 7.35) - 0.7, 2.3, 0.4, 0.35) : 0);
      hidden(o, i, pk * 1.05);
      o.look = THREE.MathUtils.clamp(Math.atan2(gx - o.x, gz - o.z), -0.7, 0.7) * pk;
      o.nod = 0.05 - 0.15 * pk;
      const tw = ((T * 0.9 + i * 1.37) % 3.7) / 0.5;
      o.twitch = tw < 1 ? Math.sin(Math.PI * tw) * Math.sin(Math.PI * 6 * tw) : 0.5 * alert * Math.sin(T * 17 + i);
      o.sq = 0.012 * Math.sin(T * 1.9 + i * 2.1) + 0.03 * alert * Math.sin(T * 11 + i * 2);
    }
  }
  /** The entrance, `te` s in: one by one out by the counter's end to their places, a bow each; then the mallets are taken up. */
  function poseEnter(te, out) {
    for (let i = 0; i < 3; i++) {
      const o = out[i], path = IN[i], n = path.length - 1, ti = te - START[i];
      if (ti <= 0) { hidden(o, i, 1); o.twitch = 0.5 * Math.sin(te * 17 + i); o.sq = 0.03 * Math.sin(te * 11 + i * 2) - 0.08 * hump(ti + 0.14, 0.14); continue; }
      rest(o);
      if (ti < n * HOP) { hop(path, ti / HOP, o); continue; }
      const ta = ti - n * HOP, bow = pulse(ta - 0.18, 0.68, 0.2, 0.22);
      stand(o, i, heading(path, n - 1) + wrap(FACE[i] - heading(path, n - 1)) * ease(ta / 0.22));
      o.lean = 0.03 + 0.48 * bow; o.nod = 0.05 + 0.3 * bow; o.twitch = hump(ta - 0.05, 0.3); o.flop = 0.35 * bow;
      o.sq = -0.05 * hump(ta, 0.16);
      const tk = te - T_ALL;                                   // all three in, all bowed: the pounders take their mallets up
      if (i < 2 && tk > 0) {
        const k = ease(tk / 0.28);
        o.yaw = FACE[i] + wrap(LAID[i].yaw - FACE[i]) * k; o.lean = mix(0.03, LEAN_HIT, k); o.swing = LAID[i].swing;
        o.role = 1 - ease((tk - 0.26) / 0.12);
      } else if (i === 2 && tk > 0) o.look = 0;
    }
  }

  /** The show at `t` seconds into the recording (and on into the finale after it), into `out`. */
  function showPose(t, out) {
    const fin = t - LEN;                                      // into the finale
    // the cheer: everyone jumps, twice
    let jump = 0, jsq = 0, flick = 0, jflop = 0, cheer = 0;
    for (const b of BIG) {
      for (const [at, h, len] of [[b, 0.3, 0.5], [b + 0.56, 0.17, 0.36]]) {
        const x = t - at;
        if (x > -0.12 && x < 0) jsq -= 0.11 * (1 + x / 0.12);
        if (x >= 0 && x < len) { const s = Math.sin((Math.PI * x) / len); jump += h * s; jsq += 0.1 * Math.cos((Math.PI * x) / len); flick = Math.max(flick, Math.pow(s, 0.6)); jflop -= 0.55 * Math.cos((Math.PI * x) / len); }
        if (x >= len && x < len + 0.2) { jsq -= 0.1 * (1 - (x - len) / 0.2); jflop += 0.5 * (1 - (x - len) / 0.2); flick = Math.max(flick, 0.5 * (1 - (x - len) / 0.2)); }
      }
      cheer = Math.max(cheer, pulse(t - b + 0.1, 1.05, 0.14, 0.2));
    }
    // the calls on the pulse: a little bob, the ears apart
    const sh = before(SHOUTS, t);
    const bob = sh === null ? 0 : hump(t - sh, 0.24);
    // the bow at the end
    const bow = fin > 0 ? pulse(fin - 1.0, 1.1, 0.3, 0.3) : 0;
    const lastHit = before(hits, t);

    for (let i = 0; i < 3; i++) {
      const o = out[i], H = HOME[i];
      rest(o);
      o.x = H.x; o.y = H.y + jump; o.gy = H.y; o.z = H.z; o.yaw = H.yaw;
      o.sq = jsq + 0.045 * bob; o.flick = flick; o.twitch = bob; o.flop = jflop;
      if (i < 2) {
        o.role = 0;
        // a pounder: ready on the shoulder, up, down onto the dough, held a moment, back up
        const face = fin > 0 ? ease(fin / 0.5) : 0;                  // the finale: round to you, the mallet set down before it
        let swing = mix(READY, REST, face), lean = 0.03;
        const prev = before(HITS[i], t), next = after(HITS[i], t);
        // between its own blows it stands turned a little aside, its mallet clear of the mortar and the turner
        const busy = Math.max(prev === null ? 0 : 1 - ease((t - prev - 0.3) / 0.3), next === null ? 0 : ease((0.8 - (next - t)) / 0.25));
        o.yaw = mix(H.yaw - Math.sign(H.yaw) * 0.9 * (1 - busy) * (1 - cheer), FACE[i], face);
        swing = mix(swing, mix(0.22, REST, face), 1 - busy);
        if (prev !== null) {
          const x = t - prev;
          if (x < 0.07) { swing = HIT; lean = LEAN_HIT; o.sq -= 0.06 * (1 - x / 0.07); }
          else if (x < 0.5) { const u = easeOut((x - 0.07) / 0.43); swing = mix(HIT, swing, u); lean = mix(LEAN_HIT, lean, u); }
          o.flop += 0.95 * Math.exp(-x * 6) * Math.cos(x * 15);       // the ears whip forward with the blow, and swing on
        }
        if (next !== null) {
          const x = next - t;                                            // s to the blow
          if (x < 0.11) { const u = 1 - x / 0.11; swing = mix(UP, HIT, u * u); lean = mix(-0.2, LEAN_HIT, u * u); o.flop -= 0.6 * (1 - u); o.sq += 0.07 * (1 - u); }
          else if (x < 0.56) { const u = ease((0.56 - x) / 0.45); swing = mix(swing, UP, u); lean = mix(lean, -0.2, u); o.flop -= 0.6 * u; o.sq += 0.07 * u; }
        }
        // the cheer: the mallet thrown up over its head
        swing = mix(swing, UP - 0.1, cheer);
        o.swing = swing; o.lean = lean + 0.5 * bow;
        o.nod = 0.16 - 0.3 * bob * (1 - cheer) - 0.3 * cheer + 0.25 * bow;
      } else {
        // the turner: its paw darts in between the blows, flat on the dough, and out again
        let reach = 0;
        const a = before(TURNS, t), b = after(TURNS, t);
        if (a !== null) { const x = t - a; reach = x < 0.05 ? 1 : 1 - ease((x - 0.05) / 0.17); }
        if (b !== null) { const x = b - t; if (x < 0.13) reach = Math.max(reach, easeOut(1 - x / 0.13)); }
        // never under a mallet: the paw is out before every blow lands
        const nh = after(hits, t);
        if (nh !== null && nh - t < 0.1) reach = Math.min(reach, (nh - t) / 0.1);
        if (lastHit !== null && t - lastHit < 0.09) { reach = 0; o.sq -= 0.03; }
        reach *= 1 - cheer;
        o.reach = reach;
        const hold = fin > 0 ? ease((fin - 0.2) / 0.4) * (1 - ease((fin - 2.0) / 0.3)) : 0;
        o.hold = Math.max(hold, 0.42 * cheer);
        o.lean = 0.1 + 0.2 * reach + 0.22 * bow - 0.1 * cheer;
        o.nod = 0.2 - 0.25 * bob * (1 - reach) - 0.42 * o.hold + 0.3 * bow;
        o.swing = 0;
        if (fin > 0) { o.y += 0.1 * hump(fin - 0.62, 0.3); o.yaw = FACE[2] * ease(fin / 0.5); }                 // a hop as the mochi goes up
      }
    }
  }

  /**
   * After the finale, `a` s on: the mallets are laid back in the mortar; the right pounder takes Hachi his treat
   * (`feed`: its way there, or null); the turner brings your mochi round to the stand's step and sets it on the plate.
   */
  function poseAfter(a, out, feed, serveAt) {
    for (let i = 0; i < 3; i++) {
      const o = out[i];
      if (i < 2) {
        // down with the mallet: round to the mortar, its head laid where it rests, the paws let go, round to you again
        const k1 = ease(a / 0.32), k2 = ease((a - 0.5) / 0.3);
        stand(o, i, FACE[i] + wrap(LAID[i].yaw - FACE[i]) * k1 * (1 - k2));
        o.swing = mix(REST, LAID[i].swing, k1); o.lean = mix(0.03, LEAN_HIT, k1 * (1 - k2));
        o.role = ease((a - 0.36) / 0.12);
        const idle = ease((a - T_DOWN) / 0.3);
        o.twitch = idle * Math.max(0, Math.sin(a * 2.3 + i * 2)) ** 12; o.sq = idle * 0.012 * Math.sin(a * 2.1 + i);
        if (i === 1 && feed) {
          const fa = a - T_DOWN, n = feed.path.length - 1, there = n * HOP, GIVE = 0.62, STAY = 1.2;
          if (fa > 0 && fa < there) { hop(feed.path, fa / HOP, o); o.reach = 0.55 * ease(fa / 0.3); }
          else if (fa >= there && fa < there + STAY) {
            const ta = fa - there, tg = ta - GIVE;
            o.x = feed.path[n][0]; o.z = feed.path[n][2]; o.y = o.gy = Y0;
            o.yaw = feed.yaw; o.reach = mix(0.55, 1, ease(ta / 0.3)) * (1 - 0.6 * ease(tg / 0.25));
            o.lean = 0.16 * ease(ta / 0.3) * (1 - ease(tg / 0.3)); o.nod = 0.16;
            if (tg > 0) { o.y += 0.1 * hump(tg - 0.12, 0.3); o.twitch = hump(tg - 0.1, 0.4); o.sq = 0.06 * hump(tg - 0.12, 0.3); }
          } else if (fa >= there + STAY && fa < there * 2 + STAY) hop(feed.back, (fa - there - STAY) / HOP, o);
          else if (fa >= there * 2 + STAY) { const ta = fa - there * 2 - STAY, hb = heading(feed.back, n - 1); o.yaw = hb + wrap(FACE[1] - hb) * ease(ta / 0.25); }
        }
      } else {
        const sa = a - serveAt, n = SERVE.length - 1;
        stand(o, 2, FACE[2]);
        o.twitch = Math.max(0, Math.sin(a * 2.3 + 4)) ** 12;
        if (sa <= 0) continue;
        const pick = ease(sa / 0.3);
        o.reach = pick; o.hold = 0.3 * pick; o.nod = 0.05 * (1 - pick);
        if (sa < 0.35) { o.sq = -0.05 * hump(sa - 0.1, 0.2); continue; }
        if (sa < 0.35 + n * HOP) { const r = o.reach, h = o.hold; hop(SERVE, (sa - 0.35) / HOP, o); o.reach = r; o.hold = h; o.nod = 0; continue; }
        // up on the step behind the stand: round to you, the mochi set on the plate, a bow; then it watches you eat
        const ts = sa - 0.35 - n * HOP, put = ease((ts - 0.08) / 0.3), let_ = ease((ts - 0.4) / 0.25), bow = pulse(ts - 0.6, 0.6, 0.2, 0.2);
        const hs = heading(SERVE, n - 1);
        o.x = STOOL[0]; o.y = o.gy = STOOL[1]; o.z = STOOL[2]; o.yaw = hs * (1 - ease(ts / 0.22));
        o.reach = 1 - let_; o.hold = 0.3 * (1 - let_);
        o.lean = 0.16 * put * (1 - let_) + 0.22 * bow + 0.03;
        o.nod = 0.1 * put * (1 - let_) + 0.3 * bow;
        o.twitch = Math.max(hump(ts - 0.45, 0.3), ease((ts - 1.5) / 0.3) * Math.max(0, Math.sin(ts * 2.6)) ** 10);
        o.look = 0.12 * ease((ts - 1.4) / 0.4);
      }
    }
  }
  /** Goodbye, `b` s on: a wave, a bow, and back in by the counter's end, one after another. */
  function poseBye(b, out) {
    const wave = pulse(b - 0.05, 1.25, 0.2, 0.25), bow = pulse(b - 1.25, 0.62, 0.2, 0.2);
    for (let i = 0; i < 3; i++) {
      const o = out[i], path = OUT[i], n = path.length - 1, ti = b - OR.bye - LEAVE[i];
      if (ti >= n * HOP) { hidden(o, i, 1 - ease((ti - n * HOP) / 0.35)); continue; }
      if (ti > 0) { rest(o); hop(path, ti / HOP, o); continue; }
      stand(o, i, i === 2 ? 0 : FACE[i]);
      if (i === 2) { o.x = STOOL[0]; o.y = o.gy = STOOL[1]; o.z = STOOL[2]; }
      // (the paw up and going: `hold` stops short of where the turner's own mochi shows)
      o.hold = wave * (0.5 + 0.14 * Math.sin(b * 16 + i)); o.look = 0.1 * wave * Math.sin(b * 8 + i);
      o.y += 0.05 * wave * Math.abs(Math.sin(b * 8 + i * 1.3)); o.nod = -0.08 * wave + 0.3 * bow;
      o.lean = 0.03 + (i === 2 ? 0.22 : 0.45) * bow; o.twitch = wave * 0.6; o.flop = 0.3 * bow;
    }
  }

  /* ================================ the state ================================ */
  /* `phase`: quiet | pay | enter | show | after | bye.  `t`: the recording's own clock in the show; `pt`: s into the phase. */
  const S = { phase: 'quiet', pt: 0, t: 0, T: 0, handle: null, waited: 0, ci: 0, w: 0, ended: false, forced: null, cam: { x: 0, z: 0, d: 99 }, hitT: -9, turnT: -9, primed: false, shows: 0, last: null, restT: 0, alert: 0 };
  function startShow() {
    S.phase = 'show'; S.pt = 0; S.t = 0; S.ci = 0; S.ended = false; S.waited = 0; S.w = 0; S.shows++; S.hitT = -9; S.turnT = -9;
    for (let i = 0; i < 3; i++) Object.assign(E[i], P[i]);
    S.handle = soundBus.oneShot('mochi-pound', { x: USU_W.x, z: USU_W.z, y: 1.0, ...SOUND.mochi, gain: MOCHI.gain });
  }
  function fire(c) {
    S.last = c;
    if (c.kind === 'hit') { S.hitT = c.t; burst(DOUGH.x, DOUGH.y + 0.08, DOUGH.z, 2, { r: 0.06, up: 0.75, out: 0.3, life: 0.65 }); GUIDE.showCue?.('hit'); }
    else if (c.kind === 'turn') S.turnT = c.t;
    else if (c.kind === 'big') GUIDE.showCue?.('big');
  }

  /* ================================ an order ================================ */
  const product = STREET[MOCHI.id];
  let order = null, eating = null, held = null, card = null;
  const EAT_RECIPE = { bite: 'soft', munch: 'paper' };
  const mine = (name) => soundBus.oneShot(name, { gain: STORE.eatGain[name] ?? 0.8, recipe: EAT_RECIPE[name] });
  const _v = new THREE.Vector3(), _a = new THREE.Vector3(), _goal = new THREE.Vector3(), _aim = new THREE.Vector3(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
  const worldOf = (x, y, z, out) => dyn.localToWorld(out.set(x, y, z));
  /** The hand's offset that brings what it holds to world point `w` (the hand turned as it is now). */
  function reachOff(w, camera, hands, out) {
    const R = hands.R;
    _v.copy(w); camera.worldToLocal(_v);
    _q.setFromEuler(_e.set(R.turn.x, R.turn.y, R.turn.z, 'XYZ')).multiply(hands.grip(R, new THREE.Quaternion()));
    _a.copy(R.anchor.position).applyQuaternion(_q);
    return out.copy(_v).sub(R.rest.pos).sub(_a);
  }
  /** Ease your eyes toward a point of the lot. */
  function gaze(player, x, y, z, dt, rate = 2.8) {
    worldOf(x, y, z, _aim);
    const e = player.camera.position, dx = _aim.x - e.x, dy = _aim.y - e.y, dz = _aim.z - e.z;
    const k = 1 - Math.exp(-dt * rate);
    player.yaw += wrap(Math.atan2(-dx, -dz) - player.yaw) * k;
    player.pitch += (Math.atan2(dy, Math.hypot(dx, dz)) - player.pitch) * k;
  }
  /* your IC card: its own little plane, drawn over the world and near-clamped as your hand is */
  function makeCard() {
    const m = new THREE.ShaderMaterial({
      uniforms: { map: { value: icCardTex() }, uBright: { value: new THREE.Color(1, 1, 1) } },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); gl_Position.z = -gl_Position.w + 0.02 * max( gl_Position.z + gl_Position.w, 0.0001 * gl_Position.w ); }',
      fragmentShader: 'uniform sampler2D map; uniform vec3 uBright; varying vec2 vUv; void main() { vec4 t = texture2D( map, gl_FrontFacing ? vUv : vec2( 1.0 - vUv.x, vUv.y ) ); if ( t.a < 0.5 ) discard; vec3 c = gl_FrontFacing ? t.rgb : mix( vec3( 0.52, 0.8, 0.66 ), t.rgb, 0.12 ); gl_FragColor = vec4( c * uBright, 1.0 );\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}',
      side: THREE.DoubleSide,
    });
    const c = new THREE.Mesh(new THREE.PlaneGeometry(0.0856, 0.054), m);
    c.frustumCulled = false; c.renderOrder = 11; c.visible = false;
    return c;
  }
  /* how your card sits in the hand (the anchor's frame: it faces you), and how it tips onto the reader */
  const CARD = { pos: [-0.016, 0.05, 0.004], rot: [-0.1, 0.0, 0.2], tip: -0.95 };

  const spot = ctx.experiences.add({
    id: 'mochi', name: STRINGS.mochi.name, jp: STRINGS.mochi.jp,
    x: cx + MOCHI.spot[0], z: fz + MOCHI.spot[1], r: MOCHI.spot[2], y: Y0, h: 1.9, hitInside: true,
    label: `${STRINGS.mochi.jp}  ·  ${STRINGS.mochi.buy(product.priceYen)}`,
    action: ({ player, hud } = {}) => {
      const hands = PETTAN.hands;
      if (order || S.phase !== 'quiet' || !player || !hands || player.seat) return;
      dyn.updateWorldMatrix(true, false);
      const from = { x: player.pos.x, z: player.pos.z };
      order = {
        t: 0, player, hud, hands, mine: !player.suspended, from, glide: THREE.MathUtils.clamp(Math.hypot(ORDER_W.x - from.x, ORDER_W.z - from.z) / OR.walk, 0.45, 1.4),
        fired: new Set(), off: new THREE.Vector3(), feed: null, serveAt: 0.5, eatT: -1, aim: new THREE.Vector3(),
      };
      player.suspended = true;
      player.vel?.set(0, 0, 0);
      spot.show(false);
      S.phase = 'pay'; S.pt = 0;
      card ??= makeCard();
      card.position.set(...CARD.pos); card.rotation.set(...CARD.rot);
      hands.setHold('card', { rot: CARD.rot, at: CARD.pos });
      hands.anchor.add(card);
      card.visible = true;
      hands.raise(true);
      eating ??= makeEating(hands, heldMat, mine);
      held ??= Object.assign(new THREE.Mesh(eatStages(MOCHI.id)[0], heldMat), { frustumCulled: false, renderOrder: 11 });
      soundBus.preload(['ka-ching', 'bite', 'munch', 'mochi-pound']);
    },
  });
  const once = (key, fn) => { if (!order.fired.has(key)) { order.fired.add(key); fn(); } };
  /** Where rabbit `o`'s right paw is, in the lot's frame. */
  function pawOf(o, out) {
    const p = pawAt(o.reach, o.lean, o.hold), c = Math.cos(o.yaw), s = Math.sin(o.yaw), lx = p[0] * SCALE, lz = p[2] * SCALE;
    return out.set(o.x + c * lx + s * lz, o.y + p[1] * SCALE * (1 + o.sq), o.z - s * lx + c * lz);
  }

  /** Your part of the order, each frame: where you stand and look, your hand, your card, the mochi. */
  function stepOrder(dt) {
    const { player, hands } = order, R = hands.R, camera = player.camera;
    order.t += dt;
    player.suspended = true;
    const ph = S.phase, pt = S.pt;
    cardLight(hands);

    if (ph === 'pay') {
      // the step to the order stand
      const k = ease(pt / order.glide);
      player.pos.x = mix(order.from.x, ORDER_W.x, k); player.pos.z = mix(order.from.z, ORDER_W.z, k);
      // your eyes: the reader, then (paid) the counter where three heads have come up
      if (pt < OR.tap + 0.45) gaze(player, shop.reader[0] - 0.05, shop.reader[1] + 0.2, shop.reader[2], dt, 4.2);
      else gaze(player, gap + 1.1, Y0 + 1.15, zr, dt, 2.2);
      // the card: up and held to be seen, onto the reader, away
      const reach = Math.min(ease((pt - OR.card - 0.3) / (OR.tap - OR.card - 0.3)), 1 - ease((pt - OR.tap - 0.22) / (OR.away - OR.tap - 0.22)));
      R.turn.set(CARD.tip * reach, 0, 0);
      worldOf(shop.reader[0], shop.reader[1] + 0.03, shop.reader[2] + 0.012, _goal);
      reachOff(_goal, camera, hands, order.off);
      R.off.copy(order.off).multiplyScalar(reach);
      if (pt >= OR.tap) once('tap', () => {
        soundBus.oneShot('ka-ching', { x: COUNTER_W.x, z: COUNTER_W.z, y: 1.0, near: 4, far: 18, gain: STORE.checkoutGain, recipe: 'can' });
        order.hud?.flash?.(STRINGS.mochi.paid(product.priceYen), 2000);
        order.paidAt = S.T;
      });
      if (pt >= OR.away) once('away', () => hands.raise(false));
      if (pt >= OR.away + 0.4) once('card', () => { card.visible = false; });
      S.alert = ease((pt - OR.tap - 0.1) / 0.3);
      return;
    }
    if (card.visible && hands.up < 0.05) card.visible = false;
    /* (Tan, 2026-10-02: "the view is too zoomed in, which does not show Hachi and his reactions at all") for the
     * pounding you stand `back` m off the order stand, the mortar and Hachi before it both in the picture; you step
     * up to it again as the mallets are laid down (the treat, your mochi) */
    {
      // (Tan, 2026-10-02, again: "after payment, the player standing way too close... Hachi's reactions are never seen")
      // back from the moment you have paid, through the rabbits' entrance, the pounding and Hachi's treat; up to the
      // stand again only as the turner brings your mochi round
      const want = ph === 'enter' || ph === 'show' || (ph === 'after' && pt < (order.serveAt ?? 0) + 0.25) ? 1 : 0;
      order.back = (order.back ?? 0) + (want - (order.back ?? 0)) * (1 - Math.exp(-dt * (want ? 2.4 : 3.2)));
      const w = toWorld(OR.at[0] + (OR.side ?? 0) * order.back, OR.at[1] + (OR.back ?? 0) * order.back);   // (and `side` m to the right: the order stand out of the pounders' way)
      player.pos.x = w.x; player.pos.z = w.z;
    }
    if (ph === 'enter') {
      // your eyes follow them out and over to the mortar
      let n = 0, mx = 0, mz = 0;
      for (let i = 0; i < 3; i++) if (pt > START[i] - 0.3) { mx += P[i].x; mz += P[i].z; n++; }
      if (n) order.aim.set(mx / n, Y0 + 0.98, mz / n); else order.aim.set(gap + 1.1, Y0 + 1.15, zr);
      const late = ease((pt - T_ALL + 0.6) / 0.8);
      gaze(player, mix(order.aim.x, ux + 0.24, late), mix(order.aim.y, Y0 + 0.5, late), mix(order.aim.z, uz + 0.2, late), dt, 2.6);
      return;
    }
    if (ph === 'show') { gaze(player, ux + 0.24, Y0 + 0.5, uz + 0.2, dt, 2.2); return; }
    if (ph !== 'after') return;

    /* ---- after the finale ---- */
    const a = pt, feed = order.feed, sa = a - order.serveAt;
    /* Hachi's treat: in the pounder's paw as it hops over, held out, and his */
    if (feed) {
      const o = P[1], fa = a - T_DOWN, there = (feed.path.length - 1) * HOP, GIVE = there + 0.62;
      if (fa > 0.12 && fa < GIVE) {
        once('treat-out', () => { potato.visible = true; burst(o.x, o.y + 0.5, o.z + 0.1, 2, { r: 0.03, up: 0.3, out: 0.15, life: 0.4, color: KINAKO }); });
        pawOf(o, _v);
        potato.position.set(_v.x, _v.y + 0.035, _v.z);
        potato.rotation.set(0.2, o.yaw + Math.PI / 2, 0.25);
        potato.scale.setScalar(ease((fa - 0.12) / 0.2));
        if (fa > there - 0.1) once('treat', () => GUIDE.showCue?.('treat'));
      } else if (fa >= GIVE && !order.fired.has('caught')) {
        // from the paw to his mouth
        once('give', () => { order.give = { from: potato.position.clone(), t: 0 }; });
        const g = order.give, h = GUIDE.where?.();
        g.t += dt / 0.22;
        if (h) { const l = ctx.toLocal({ x: h.x, z: h.z }); _v.set(l.x - cx, h.y + 0.34, l.z - fz); } else _v.copy(g.from);
        const u = clamp01(g.t);
        potato.position.lerpVectors(g.from, _v, ease(u));
        potato.position.y += 0.05 * Math.sin(Math.PI * u);
        if (u >= 1) once('caught', () => { potato.visible = false; GUIDE.showCue?.('catch'); burst(_v.x, _v.y, _v.z, 2, { r: 0.03, up: 0.25, out: 0.2, life: 0.5, color: KINAKO }); });
      }
    }
    /* your eyes: Hachi and the rabbit while he is fed; then the turner round to the stand, the plate, and up as you eat */
    const feeding = feed && a > T_DOWN - 0.25 && a < order.serveAt + 0.15;
    if (feeding) gaze(player, mix(feed.at[0], P[1].x, 0.42), Y0 + 0.5, mix(feed.at[1], P[1].z, 0.42), dt, 2.6);
    else if (sa < SERVE_SET - 0.9) gaze(player, mix(ux, P[2].x, ease(sa / 0.5)), Y0 + 1.0, mix(uz, P[2].z, ease(sa / 0.5)), dt, 2.4);
    else if (order.eatT < 0) gaze(player, shop.plate[0] - 0.04, shop.orderTop + 0.3, shop.plate[2] - 0.3, dt, 3.0);      // (the rabbit's face over the plate: it serves from its step, level with you)
    else gaze(player, STOOL[0] + 0.25, Y0 + 1.2, STOOL[2], dt, 1.8);

    /* the mochi: out of a puff onto the turner's paw, round to the stand, onto the plate, yours */
    if (sa >= 0.18) once('pon', () => { served.visible = true; pawOf(P[2], _v); burst(_v.x, _v.y + 0.06, _v.z, 4, { r: 0.045, up: 0.35, out: 0.3, life: 0.5, color: KINAKO }); });
    if (served.visible) {
      const ts = sa - 0.35 - (SERVE.length - 1) * HOP;
      pawOf(P[2], _v); _v.y += 0.045;
      served.position.set(mix(_v.x, shop.plate[0], ease((ts - 0.08) / 0.32)), mix(_v.y, shop.plate[1], ease((ts - 0.08) / 0.32)), mix(_v.z, shop.plate[2], ease((ts - 0.08) / 0.32)));
      served.rotation.y = P[2].yaw * (1 - ease((ts - 0.08) / 0.32)) - 0.3;
    }
    /* your hand: up, to the plate, the mochi in it, and eat */
    const TAKE = SERVE_SET + 1.15, EAT = TAKE + 0.5;
    if (sa >= SERVE_SET + 0.2) once('hand', () => { const st = eatStages(MOCHI.id); hands.setHold(st.hold, { rot: st.turn, at: st.seat }); hands.raise(true); R.turn.set(0, 0, 0); R.off.set(0, 0, 0); });
    if (order.eatT < 0) {
      const reach = Math.min(ease((sa - (TAKE - 0.5)) / 0.5), 1 - ease((sa - TAKE - 0.05) / 0.4));
      worldOf(shop.plate[0], shop.plate[1] + 0.035, shop.plate[2], _goal);
      reachOff(_goal, camera, hands, order.off);
      R.off.copy(order.off).multiplyScalar(Math.max(0, reach));
    }
    if (sa >= TAKE) once('take', () => {
      served.visible = false;
      const st = eatStages(MOCHI.id);
      held.position.set(...st.seat); held.rotation.set(...st.turn); held.visible = true;
      hands.anchor.add(held);
      burst(shop.plate[0], shop.plate[1] + 0.03, shop.plate[2], 3, { r: 0.03, up: 0.3, out: 0.2, life: 0.55, color: KINAKO });
      soundBus.oneShot('soft', { x: COUNTER_W.x, z: COUNTER_W.z, y: 1.0, ...SOUND.shelf, gain: 0.9, recipe: 'soft' });
    });
    if (sa >= EAT) {
      once('eat', () => { order.eatT = 0; R.off.set(0, 0, 0); eating.start({ id: MOCHI.id, mesh: held, onEaten: () => {} }); });
      order.eatT += dt;
      eating.update(dt);
    }
  }
  const cardLight = (hands) => { if (card) card.material.uniforms.uBright.value.copy(hands.skinMat.uniforms.uBright.value); };
  /** You have eaten: you are free, and they say goodbye. */
  function release(ate) {
    const { player, hands, hud } = order;
    if (!ate) eating?.stop();
    held?.removeFromParent();
    served.visible = false; potato.visible = false;
    if (card) { card.visible = false; card.removeFromParent(); }
    hands.R.off.set(0, 0, 0); hands.R.turn.set(0, 0, 0); hands.R.eat = 0;
    hands.raise(false);
    if (order.mine) player.suspended = false;
    if (ate) { spot.done(); hud?.flash?.(STRINGS.mochi.ate, 3600); }
    order = null;
  }
  /** What an order needs once the finale is over: is Hachi watching (then where the pounder goes to him), when the turner serves. */
  function planAfter() {
    const h = GUIDE.where?.();
    if (h?.watching) {
      const l = ctx.toLocal({ x: h.x, z: h.z }), hx = l.x - cx, hz = l.z - fz;
      // to his side nearer the middle, a paw's reach from his nose
      const to = [hx - 0.36, Y0, hz - 0.42], from = [HOME[1].x, HOME[1].y, HOME[1].z], mid = [mix(from[0], to[0], 0.45) + 0.12, Y0, mix(from[2], to[2], 0.5) + 0.12];
      const path = [from, mid, to];
      order.feed = { path, back: path.slice().reverse(), yaw: Math.atan2(hx - to[0], hz - to[2]), at: [hx, hz] };
      order.serveAt = T_DOWN + OR.feed;
    } else { order.feed = null; order.serveAt = 0.5; }
  }

  /* ================================ each frame ================================ */
  const LOW = { v: 9 };                 // dev: the held mallets' lowest edge over the stage floor (m)
  function place() {
    for (let i = 0; i < 3; i++) {
      const o = P[i];
      /* (Tan, 2026-10-04: "the pounding mallets go into the floor") held, its head never under the stage: let down
       * aside its face sat 15 cm under a pounder's feet, and in a bow 44 cm; the swing is held back so the head's
       * lowest edge stays a hair over the stage floor (rabbits.js malletFace: the face's middle, the head 6 cm round) */
      if (o.role < 1) {
        const lo = (Y0 - o.y) / SCALE + 0.075;
        if (malletFace(o.swing, o.lean)[0] < lo) o.swing = Math.min(o.swing, swingFor(lo, o.lean));
        if (import.meta.env?.DEV) LOW.v = Math.min(LOW.v, (malletFace(o.swing, o.lean)[0] - 0.06) * SCALE + o.y - Y0);   // (scripts/_mochi.mjs)
      }
      herd.set(i, o.x, o.y, o.z, o.yaw, 0, 0, SCALE);
      herd.setPose(i, o.swing, o.lean, o.sq, o.flop);
      herd.setPose2(i, o.role, o.reach, o.nod, o.look);
      pose3.setXYZW(i, o.flick, o.hold, o.wipe, o.twitch);
      const air = Math.max(0, o.y - o.gy);
      shadows.set(shadow[i], o.x, o.gy, o.z, 0.22 * (1 - air), 0.22 * (1 - air), 0);
    }
    pose3.needsUpdate = true;
    herd.flush();
    layMallets(P);
  }
  function placeDough(t, inShow) {
    // squashed under the blow, springing back; a wobble when the turner folds it
    const xh = inShow ? t - S.hitT : 9, xt = inShow ? t - S.turnT : 9;
    const squash = xh >= 0 && xh < 0.5 ? 0.42 * Math.exp(-xh * 9) * Math.cos(xh * 20) : 0;
    const fold = xt >= 0 && xt < 0.35 ? 0.12 * Math.sin((Math.PI * xt) / 0.35) : 0;
    _o.position.set(DOUGH.x, DOUGH.y - DOUGH.h * squash * 0.6, DOUGH.z);
    _o.rotation.set(0, fold * 3, 0);
    _o.scale.set(DOUGH.r * (1 + 0.22 * squash + fold * 0.3), DOUGH.h * (1 - squash + fold * 0.5), DOUGH.r * (1 + 0.22 * squash - fold * 0.3));
    _o.updateMatrix();
    bits.setMatrixAt(0, _o.matrix);
    // the strand: stuck to the mallet as it lifts, thinning, gone
    let strand = false;
    if (xh > 0.07 && xh < 0.34) {
      const who = HITS[0].includes(S.hitT) ? 0 : 1, o = P[who];
      const [fy, fzz] = malletFace(o.swing, o.lean);
      const fx = o.x + Math.sin(o.yaw) * fzz * SCALE, fzw = o.z + Math.cos(o.yaw) * fzz * SCALE, fyw = o.y + fy * SCALE * (1 + o.sq);
      _d.set(fx - DOUGH.x, fyw - (DOUGH.y + DOUGH.h * 0.5), fzw - DOUGH.z);
      const len = _d.length(), u = (xh - 0.07) / 0.27;
      if (len > 0.02 && len < 0.55) {
        _o.position.set(DOUGH.x + _d.x / 2, DOUGH.y + DOUGH.h * 0.5 + _d.y / 2, DOUGH.z + _d.z / 2);
        _o.quaternion.setFromUnitVectors(_up, _d.normalize());
        const th = 0.06 * (1 - u) * (1 - u) + 0.008;
        _o.scale.set(th, len / 2 + 0.02, th);
        _o.updateMatrix();
        bits.setMatrixAt(1, _o.matrix);
        _o.rotation.set(0, 0, 0);
        strand = true;
      }
    }
    if (!strand) bits.setMatrixAt(1, _hide);
    bits.instanceMatrix.needsUpdate = true;
  }
  /** The rabbits at a moment of a phase, into `out`. */
  function poseAt(phase, pt, out, gx, gz, near) {
    if (phase === 'quiet' || phase === 'pay') poseQuiet(S.T, out, near, gx, gz, phase === 'pay' ? S.alert : 0);
    else if (phase === 'enter') poseEnter(pt, out);
    else if (phase === 'show') showPose(S.t, out);
    else if (phase === 'after') poseAfter(pt, out, order?.feed ?? S.forced?.feed ?? null, order?.serveAt ?? S.forced?.serveAt ?? 0.5);
    else if (phase === 'bye') poseBye(pt, out);
  }

  ctx.update((dt, cam) => {
    if (!cam) return;
    const l = ctx.toLocal({ x: cam.x, z: cam.z });
    const gx = l.x - cx, gz = l.z - fz;
    const d = Math.hypot(gx - ux, gz - uz);
    S.cam.x = gx; S.cam.z = gz; S.cam.d = d;
    const seen = d < MOCHI.hide || !!order;
    dyn.visible = seen;
    if (!seen) {
      // (walked right away while they were going back in: they are in)
      if (S.phase !== 'quiet') { S.phase = 'quiet'; S.handle = null; S.restT = 0; spot.show(true); GUIDE.watchShow?.(null); }
      return;
    }
    S.T += dt;
    if (!tray) makeFood();
    if (PETTAN.hands) { foodMat.follow(PETTAN.hands.skinMat); heldMat.follow(PETTAN.hands.skinMat); }
    if (!S.primed && d < 40 && soundBus.ready) { S.primed = true; soundBus.preload(['mochi-pound']); }
    stepPuffs(dt);
    // the reader's ring: green for a moment as the card taps
    const paid = order?.paidAt !== undefined ? S.T - order.paidAt : 9;
    ringMat.color.copy(RING_IDLE).lerp(RING_OK, paid < 1.6 ? 1 - ease((paid - 1.0) / 0.6) : 0);

    /* the phases */
    if (S.forced) { S.phase = S.forced.phase; S.pt = S.forced.t; if (S.phase === 'show') { S.t = S.forced.t; S.w = 1; S.hitT = before(hits, S.t) ?? -9; S.turnT = before(TURNS, S.t) ?? -9; } }
    else if (S.phase !== 'quiet') {
      S.pt += dt;
      if (S.phase === 'pay' && S.pt >= OR.enter) { S.phase = 'enter'; S.pt = 0; }
      else if (S.phase === 'enter' && S.pt >= ENTER_LEN) startShow();
      else if (S.phase === 'show') {
        /* the show's clock: the recording's own, where there is one */
        const h = S.handle;
        if (h?.pos && !h.ended) S.t = Math.max(0, h.pos() + MOCHI.sync);
        else if (h && !h.pos && !h.ended && S.waited < 3) S.waited += dt;        // its file is still coming: the rabbits wait for it
        else S.t += dt;
        S.w = Math.min(1, S.w + dt / 0.3);
        while (S.ci < C.length && C[S.ci].t <= S.t) fire(C[S.ci++]);
        if (S.t >= LEN + 0.3 && !S.ended) { S.ended = true; GUIDE.showCue?.('end'); }
        if (S.t >= LEN + OR.finale) { S.phase = 'after'; S.pt = 0; S.handle = null; if (order) planAfter(); }
      } else if (S.phase === 'after') {
        // (nobody to serve: an order that was let go; else until you have eaten)
        if (!order || (order.eatT > 0.5 && eating.done)) { if (order) release(true); S.phase = 'bye'; S.pt = 0; }
      } else if (S.phase === 'bye' && S.pt >= BYE_LEN) { S.phase = 'quiet'; S.restT = MOCHI.rest; }
    } else if (S.restT > 0) { S.restT -= dt; if (S.restT <= 0) spot.show(true); }
    const inShow = S.phase === 'show';
    // Hachi comes and sits to watch from the moment you order until they wave; while he is fed he turns to the rabbit
    if (order?.feed && S.phase === 'after' && S.pt < order.serveAt) { const w = toWorld(P[1].x, P[1].z); WATCH_FEED.at.x = w.x; WATCH_FEED.at.z = w.z; GUIDE.watchShow?.(WATCH_FEED); }
    else GUIDE.watchShow?.(S.phase !== 'quiet' && S.phase !== 'bye' ? WATCH : null);

    if (d > MOCHI.live && S.phase === 'quiet') return;                // far off, quiet: only the steamer steams
    poseAt(S.phase, S.pt, P, gx, gz, d < MOCHI.near);
    // into the show from where the entrance left them
    if (inShow && S.w < 1) { const k = ease(S.w); for (let i = 0; i < 3; i++) for (const key in P[i]) P[i][key] = key === 'role' ? P[i][key] : mix(E[i][key], P[i][key], k); }
    if (order) stepOrder(dt);
    else if (S.demo) { eating.update(dt); if (eating.done) S.demo = false; }
    place();
    placeDough(S.t, inShow);
  });

  hidden(P[0], 0); hidden(P[1], 1); hidden(P[2], 2); place(); placeDough(0, false);

  if (import.meta.env?.DEV && typeof window !== 'undefined') {
    window.__mochi = {
      S, P, HOME, shop, herd, spot, HIT, cues: C, CARD, low: LOW,
      len: { enter: ENTER_LEN, bye: BYE_LEN, down: T_DOWN, set: SERVE_SET, all: T_ALL },
      /** Stand the rabbits at `t` s of a phase (null: let it run); no sound.  `o`: { feed: true } stages the treat for a Hachi on his seat. */
      stage(phase, t = 0, o = {}) {
        if (phase === null) { S.forced = null; S.phase = 'quiet'; S.handle = null; return; }
        const hx = MOCHI.hachi[0], hz = MOCHI.hachi[1], to = [hx - 0.36, Y0, hz - 0.42], from = [HOME[1].x, HOME[1].y, HOME[1].z], mid = [mix(from[0], to[0], 0.45) + 0.12, Y0, mix(from[2], to[2], 0.5) + 0.12];
        const path = [from, mid, to];
        S.forced = { phase, t, feed: o.feed ? { path, back: path.slice().reverse(), yaw: Math.atan2(hx - to[0], hz - to[2]), at: [hx, hz] } : null, serveAt: o.feed ? T_DOWN + OR.feed : 0.5 };
      },
      /** dev: the mochi in your hand, and eat it (no order). */
      demoEat() {
        const hands = PETTAN.hands, st = eatStages(MOCHI.id);
        eating ??= makeEating(hands, heldMat, mine);
        held ??= Object.assign(new THREE.Mesh(st[0], heldMat), { frustumCulled: false, renderOrder: 11 });
        held.position.set(...st.seat); held.rotation.set(...st.turn); held.visible = true;
        hands.setHold(st.hold, { rot: st.turn, at: st.seat });
        hands.anchor.add(held); hands.snap(true);
        eating.start({ id: MOCHI.id, mesh: held, onEaten: () => {} });
        S.demo = true;
      },
      get order() { return order; },
      get eating() { return eating; },
      served, held: () => held, potato, card: () => card, mallets, foodMat, heldMat,
      world: { usu: USU_W, order: ORDER_W, seat: SEAT_W, counter: COUNTER_W, spot: toWorld(MOCHI.spot[0], MOCHI.spot[1]) },
      tris: () => ({ rabbit: geo.index.count / 3, mochi: served.geometry.index ? served.geometry.index.count / 3 : 0, tray: tray ? tray.geometry.index.count / 3 : 0, house: shop.tris }),
    };
  }
  return { group: shop.group, type: 'old', H: shop.H };
}
