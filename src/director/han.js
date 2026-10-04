import * as THREE from 'three';
import { soundBus } from '../core/soundBus.js';
import { clamp, lerp, ease, seg, bell, turn, polyline } from './util.js';

/* ------------------------------------------------------------------ *
 * Han and the RX-7's puppeteer (Director Mode, dev only; Part 4).
 * While a shot uses them the show rests (han/index.js S.puppet) and this
 * drives them: the car along a route of its own (driftToKonbini: along the
 * store's lane, a drift into NIPPON's forecourt in smoke, nose in); Han out
 * of the car, walking (a cool walk, a drunk one), into the store and out,
 * the can cracked and drunk, asleep on the bench; looking at Hachi.
 *
 * Han's rig (han/han.js): a pose of joint angles (POSES), applied with
 * han.apply(); his group is the car's child while he's in or at it, and
 * the town's while he walks (world placed through the town frame).
 * Stylised Han only, never the actor's likeness (docs/decisions/han.md).
 * ------------------------------------------------------------------ */

const TAU = Math.PI * 2;

/** A route as a turtle in the world (x, z; heading a: forward = (cos a, sin a)), each piece at a speed v0 -> v1. */
function turtle(start, pieces) {
  const segs = [];
  let x = start.x, z = start.z, a = start.a, t = 0, d = 0;
  for (const o of pieces) {
    const { len = 0, R = 0, turn: tn = 0, v0 = 0, v1 = 0, drift = 0, hold = 0, launch = false } = o;
    const pts = [{ x, z, a }];
    const n = Math.max(1, Math.ceil(len / 0.02)), ds = len / n;
    for (let i = 1; i <= n && len > 0; i++) {
      if (R) { const da = tn * ds / R, mid = a + da / 2; x += Math.cos(mid) * ds; z += Math.sin(mid) * ds; a += da; }
      else { x += Math.cos(a) * ds; z += Math.sin(a) * ds; }
      pts.push({ x, z, a });
    }
    const T = hold || (2 * len) / Math.max(0.01, v0 + v1);
    segs.push({ len, R, tn, v0, v1, T, t0: t, d0: d, drift, launch, pts });
    t += T; d += len;
  }
  return { segs, total: t, dist: d };
}
function turtleAt(D, t, out = {}) {
  t = clamp(t, 0, D.total);
  let s = D.segs[D.segs.length - 1];
  for (const q of D.segs) if (t <= q.t0 + q.T) { s = q; break; }
  const u = s.T > 0 ? (t - s.t0) / s.T : 1;
  const k = s.v0 + s.v1 > 0 ? (s.v0 * u + (s.v1 - s.v0) * u * u / 2) / ((s.v0 + s.v1) / 2) : 0;
  const f = s.pts.length > 1 ? Math.min(s.pts.length - 1.001, k * (s.pts.length - 1)) : 0;
  const i = Math.floor(f), A = s.pts[i], B = s.pts[Math.min(i + 1, s.pts.length - 1)], w = f - i;
  out.x = lerp(A.x, B.x, w); out.z = lerp(A.z, B.z, w); out.a = lerp(A.a, B.a, w);
  out.speed = lerp(s.v0, s.v1, u); out.dist = s.d0 + s.len * k;
  let drift = 0;
  for (const q of D.segs) {
    if (!q.drift) continue;
    const mid = q.t0 + q.T / 2, half = q.T / 2 + 0.4, r = (t - mid) / half;
    if (Math.abs(r) < 1) drift += q.tn * q.drift * Math.cos(r * Math.PI / 2) ** 1.5 * (r > 0 ? 1 - 0.3 * r : 1);
  }
  out.drift = drift; out.sliding = Math.abs(drift) > 0.18; out.launch = s.launch && u < 0.3;
  out.steer = s.R ? clamp(s.tn * Math.atan(2.43 / s.R), -0.6, 0.6) : 0;
  if (drift) out.steer = clamp(out.steer + drift * 1.1, -0.6, 0.6);
  return out;
}

/** The drift into NIPPON's forecourt (world): along the store's lane toward the store, a hard drift left into the
 * forecourt, nose in to the bay left of the door. */
export const KONBINI_DRIFT = {
  start: { x: -31.9, z: 12.3, a: 0 },
  pieces: [
    { len: 18, v0: 13, v1: 12, launch: false },
    { len: 5, v0: 12, v1: 8 },
    { len: 4.2 * Math.PI / 2, R: 4.2, turn: -1, v0: 8, v1: 4, drift: 0.62 },
    { len: 2.6, v0: 4, v1: 0 },
  ],
};

export function makeHanPuppet(G) {
  const H = window.__han;
  if (!H) return { release() {}, frame() {}, reset() {} };
  const { car, han, cg, smoke, POSES } = H;
  const tctx = H.ctx;
  const HW = car.halfW(-0.55);
  const SEAT = new THREE.Vector3(-0.38, 0.2, 0.37), DOOR = new THREE.Vector3(-0.08, 0, HW + 0.32), STAND = new THREE.Vector3(-0.42, 0, HW + 0.34);
  const pose = {};
  let on = false, plan = null, lastDoor = 0, can = null;
  const toTown = (w) => tctx.toLocal({ x: w.x, z: w.z });

  // the can he drinks (a Strong Nine), in his right hand while he has it
  function makeCan() {
    const g = new THREE.CylinderGeometry(0.033, 0.033, 0.123, 18);
    const m = new THREE.MeshStandardMaterial({ color: 0xd9dde6, metalness: 0.7, roughness: 0.35 });
    const c = new THREE.Mesh(g, m);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.0335, 0.0335, 0.06, 18), new THREE.MeshStandardMaterial({ color: 0xf0d64a, metalness: 0.4, roughness: 0.4 }));
    c.add(band);
    c.position.set(0, -0.09, 0.04);
    c.rotation.x = Math.PI / 2 * 0.1;
    c.visible = false;
    han.joints.rHand.add(c);
    return c;
  }

  function attachToCar() { if (han.group.parent !== cg) { cg.add(han.group); } }
  function attachToTown() { if (han.group.parent !== cg.parent) { cg.parent.add(han.group); } }

  /** Han's walk (cool or drunk) as a pose at phase φ (radians of stride), weight 1. */
  function walkPose(o, φ, style) {
    Object.assign(o, POSES.stand);
    const s = Math.sin(φ), c = Math.cos(φ);
    const A = style === 'drunk' ? 0.34 : 0.4;
    o.lHipX = -A * s; o.rHipX = A * s;
    o.lKnee = 0.12 + 0.55 * Math.max(0, Math.sin(φ + 0.9)); o.rKnee = 0.12 + 0.55 * Math.max(0, Math.sin(φ + Math.PI + 0.9));
    o.lFoot = 0.18 * s; o.rFoot = -0.18 * s;
    o.pelvisY = 0.965 - 0.018 * Math.abs(c);
    o.pelvisZ = 0.035 * s;
    o.chestZ = -0.03 * s;
    const arm = style === 'drunk' ? 0.12 : 0.22;
    o.lShX = arm * s; o.rShX = -arm * s; o.lElX = -0.3; o.rElX = -0.3; o.lShZ = 0.12; o.rShZ = -0.12;
    o.headX = style === 'drunk' ? 0.12 : 0.02;
    if (style === 'drunk') { o.lShZ = 0.85; o.lElX = -0.2; o.headZ = 0.12 * Math.sin(φ * 0.5); o.spineX = 0.06; }
    return o;
  }

  const api = {
    /** Han and the car where a shot wants them: the car at { x, z, a } (world) or its bay; Han 'lean' | 'seat' | 'hidden' | world { x, z, yaw }. */
    reset({ car: at = null, han: h = 'lean', visible = true } = {}) {
      H.S.puppet = true; on = true;
      can ??= makeCan();
      can.visible = false;
      smoke.reset();
      plan = { car: at, han: h, drive: null, driveT0: 0, events: [], walks: [], poses: [], doors: [], look: null, seatT0: null, exitT0: null, drinkT0: null };
      cg.visible = visible;
      han.group.visible = h !== 'hidden';
      if (at) api.carAt(at);
      if (h === 'lean' || h === 'seat') attachToCar();
      return api;
    },
    carAt(w, drift = 0) {
      const tp = toTown(w);
      const ta = Math.atan2(-Math.sin(w.a), -Math.cos(w.a));        // town heading (the town frame is the world turned half round)
      const gy = H.groundAt(tp.x, tp.z);
      cg.position.set(tp.x, gy, tp.z);
      cg.rotation.y = -(ta + drift);
    },
    /** The drift into the konbini's forecourt, from shot time t0. */
    driftToKonbini(t0, spec = KONBINI_DRIFT) { plan.drive = turtle(spec.start, spec.pieces); plan.driveT0 = t0; plan.driveSpec = spec; return t0 + plan.drive.total; },
    /** Out of the car: door open, out, door shut (t0 .. t0 + 1.9). */
    exitCar(t0) { plan.exitT0 = t0; return t0 + 1.9; },
    /** Walk through world points from t0 (style 'cool' | 'drunk'), speed m/s. */
    walk(t0, pts, style = 'cool', v = style === 'drunk' ? 0.75 : 1.25) {
      const line = polyline(pts);
      plan.walks.push({ t0, line, style, v, T: line.total / v });
      return t0 + line.total / v;
    },
    /** A still pose from t0: 'stand' | 'drink' | 'benchSit' | 'benchSleep' | 'lean' (world placement unchanged). */
    hold(t0, name, at = null) { plan.poses.push({ t0, name, at }); plan.poses.sort((a, b) => a.t0 - b.t0); return api; },
    /** The can cracked (t0) and drunk, head back. */
    drink(t0) { plan.drinkT0 = t0; plan.events.push({ t: t0 + 0.35, snd: 'can-open' }, { t: t0 + 1.0, snd: 'gulp' }, { t: t0 + 1.6, snd: 'gulp' }); return t0 + 2.2; },
    /** Look at a target (a function of t, world) from t0 to t1. */
    lookAt(t0, t1, target) { plan.look = { t0, t1, target }; return api; },
    /** A world point the entrance door should open for (Han walking in or out). */
    doorFor(t0, t1) { plan.doors.push({ t0, t1 }); return api; },
    say(t, snd, gain = 0.8, at = null) { plan.events.push({ t, snd, gain, at }); return api; },
    release() {
      if (!on) return;
      on = false;
      H.S.puppet = false;
      if (can) can.visible = false;
      attachToCar();
      han.group.visible = true; cg.visible = true;
      smoke.reset();
      G.world.lawson?.door && (G.world.lawson.door.also = null);
    },
    get position() { return api._pos ?? null; },
    frame(t, dt) {
      if (!on || !plan) return;
      // ---- the car ----
      let psiDrift = 0;
      if (plan.drive) {
        const τ = t - plan.driveT0;
        const c = turtleAt(plan.drive, Math.max(0, τ), {});
        api.carAt({ x: c.x, z: c.z, a: c.a }, 0);
        const ta = Math.atan2(-Math.sin(c.a), -Math.cos(c.a));
        cg.rotation.y = -(ta - c.drift);
        car.setWheels(c.dist / 0.32, -c.steer);
        psiDrift = ta - c.drift;
        // the tyres' smoke while it slides (the show's own emitter, fed our car)
        if (τ > 0 && τ < plan.drive.total + 0.2 && dt > 0) {
          Object.assign(H.cp, { x: cg.position.x, z: cg.position.z, th: ta, speed: c.speed, sliding: c.sliding || (τ > plan.drive.total * 0.55 && τ < plan.drive.total * 0.8), launch: false });
          H.smokeStep(dt, psiDrift);
        }
        // the drift track with it (the show's song)
        if (!plan.songOn && τ >= 0) { plan.songOn = true; soundBus.oneShot('han-drift', { gain: 0.5 }); }
      }
      if (dt > 0) smoke.update(dt);
      // ---- Han ----
      let base = POSES.lean, k = 0, tgt = POSES.lean, door = 0;
      const pos = new THREE.Vector3();
      let yaw = 0, inCar = plan.han === 'lean' || plan.han === 'seat';
      if (plan.han === 'seat') { pos.copy(SEAT); base = tgt = POSES.seat; yaw = Math.PI / 2; }
      else if (plan.han === 'lean') { pos.set(-0.6, 0, HW + 0.05); }
      if (plan.exitT0 !== null && t >= plan.exitT0) {
        const o = t - plan.exitT0;
        door = 1.15 * ease(seg(o, 0, 0.4)) * (1 - ease(seg(o, 1.4, 1.8)));
        const outk = ease(seg(o, 0.35, 1.3));
        const a = Math.min(1, outk * 2), b = Math.max(0, outk * 2 - 1);
        pos.copy(SEAT).lerp(DOOR, a); if (b > 0) pos.lerp(STAND, b);
        base = POSES.seat; tgt = POSES.stand; k = a;
        yaw = Math.PI / 2 + (0.2 - Math.PI / 2) * outk;
        inCar = true;
        if (door > 0.05 && lastDoor <= 0.05) soundBus.oneShot('han-door', { recipe: 'fridge-door', x: api._w?.x, z: api._w?.z, y: 0.8, near: 3, far: 22, gain: 0.35 });
        if (door <= 0.02 && lastDoor > 0.05) soundBus.oneShot('han-door', { recipe: 'fridge-door', x: api._w?.x, z: api._w?.z, y: 0.8, near: 3, far: 22, gain: 0.75 });
      }
      lastDoor = door;
      car.setDoor(door);
      // walking: in the town's frame, from the last walk that has begun
      let walking = null;
      for (const w of plan.walks) if (t >= w.t0) walking = w;
      let hp = null;
      for (const p of plan.poses) if (t >= p.t0) hp = p;
      if (walking && (!hp || hp.t0 <= walking.t0 || t < walking.t0 + walking.T)) {
        const τ = clamp(t - walking.t0, 0, walking.T);
        const moving = t - walking.t0 < walking.T;
        const d = ease(τ / walking.T) * 0.15 * walking.line.total + (τ / walking.T) * 0.85 * walking.line.total;
        const p = walking.line.at(d);
        let wx = p.x, wz = p.z, wyaw = p.yaw;
        if (walking.style === 'drunk') { const sw = 0.28 * Math.sin(t * 2.1) + 0.1 * Math.sin(t * 5.3); wx += Math.cos(wyaw) * sw; wz -= Math.sin(wyaw) * sw; wyaw += 0.25 * Math.cos(t * 2.1); }
        attachToTown(); han.group.visible = true;
        const tl = toTown({ x: wx, z: wz });
        han.group.position.set(tl.x, H.groundAt(tl.x, tl.z), tl.z);
        han.group.rotation.set(0, wyaw + Math.PI, 0);
        const φ = d * TAU / 1.35;
        walkPose(pose, moving ? φ : 0, walking.style);
        if (!moving) Object.assign(pose, POSES.stand);
        if (walking.style === 'drunk' && moving) {
          // the stumble: a lurch every few seconds
          const st = bell((t - walking.t0) % 2.6, 1.7, 2.2, 0.12, 0.25);
          pose.spineX += 0.25 * st; pose.pelvisY -= 0.04 * st; pose.rShX -= 0.5 * st;
        }
        api._w = { x: wx, z: wz }; api._pos = { x: wx, y: 0, z: wz, yaw: wyaw };
      } else if (hp && hp.name !== 'lean' && hp.at) {
        attachToTown(); han.group.visible = true;
        const tl = toTown(hp.at);
        han.group.position.set(tl.x, H.groundAt(tl.x, tl.z) + (hp.at.y ?? 0), tl.z);
        han.group.rotation.set(0, (hp.at.yaw ?? 0) + Math.PI, 0);
        api._w = { x: hp.at.x, z: hp.at.z }; api._pos = { x: hp.at.x, y: 0, z: hp.at.z, yaw: hp.at.yaw ?? 0 };
        Object.assign(pose, POSES.stand);
      } else {
        if (inCar) attachToCar();
        han.group.position.copy(pos);
        han.group.rotation.set(0, yaw, 0);
        H.blendPose(base, tgt, k, pose);
        const w = new THREE.Vector3(); han.group.getWorldPosition(w);
        api._w = { x: w.x, z: w.z }; api._pos = { x: w.x, y: w.y, z: w.z, yaw: 0 };
      }
      // held poses over the top
      if (hp && t >= hp.t0 && !(walking && t < walking.t0 + walking.T && walking.t0 > hp.t0)) {
        const k2 = ease((t - hp.t0) / 0.5);
        const P2 = {};
        if (hp.name === 'benchSit' || hp.name === 'benchSleep') {
          Object.assign(P2, POSES.seat, { pelvisY: 0.47, lShX: 0.1, rShX: 0.1, lElX: -1.0, rElX: -1.0, lShZ: 0.25, rShZ: -0.25, spineX: -0.05 });
          if (hp.name === 'benchSleep') Object.assign(P2, { headX: 0.55, neckX: 0.3, spineX: 0.12, headZ: 0.15 });
        } else if (hp.name === 'drink' || hp.name === 'stand') Object.assign(P2, POSES.stand);
        else if (hp.name === 'lean') Object.assign(P2, POSES.lean);
        if (Object.keys(P2).length) H.blendPose(pose, P2, k2, pose);
      }
      // the drink: the can up, head back
      if (plan.drinkT0 !== null && t >= plan.drinkT0 - 0.6) {
        can.visible = true;
        const o = t - plan.drinkT0;
        const up = bell(o, 0.55, 2.1, 0.35, 0.3);
        pose.rShX = lerp(pose.rShX, -1.55, up); pose.rShZ = lerp(pose.rShZ, -0.15, up); pose.rElX = lerp(pose.rElX, -1.95, up); pose.rElY = lerp(pose.rElY, 0.6, up);
        pose.headX = lerp(pose.headX, -0.42, up * seg(o, 0.8, 1.1)); pose.neckX = lerp(pose.neckX, -0.2, up * seg(o, 0.8, 1.1));
        // cracking it: the left hand comes over
        const crack = bell(o, 0.0, 0.5, 0.15, 0.15);
        pose.rShX = lerp(pose.rShX, -0.7, crack); pose.rElX = lerp(pose.rElX, -1.4, crack);
        pose.lShX = lerp(pose.lShX, -0.7, crack); pose.lElX = lerp(pose.lElX, -1.5, crack); pose.lShZ = lerp(pose.lShZ, -0.2, crack);
      }
      han.apply(pose);
      // looking (at Hachi, a function of t)
      if (plan.look && t >= plan.look.t0 && t <= plan.look.t1 && api._pos) {
        const p = plan.look.target(t);
        if (p) {
          han.group.updateWorldMatrix(true, false);
          const v = new THREE.Vector3(p.x, p.y ?? 0.3, p.z);
          han.group.worldToLocal(v);
          han.joints.head.rotation.y = clamp(Math.atan2(v.x, v.z), -1.0, 1.0);
          han.joints.head.rotation.x += clamp(-Math.atan2(v.y - 1.55, Math.hypot(v.x, v.z)) * 0.6, -0.1, 0.5);
        }
      }
      // the entrance door opens for him while he's at it
      const lw = G.world.lawson;
      if (lw?.door) {
        const want = plan.doors.some((q) => t >= q.t0 && t <= q.t1);
        lw.door.also = want ? () => (api._w ? { x: api._w.x, z: api._w.z } : null) : null;
      }
      for (const e of plan.events) {
        if (e.done || t < e.t) continue;
        e.done = true;
        const at = e.at ?? api._w;
        if (e.snd === 'chime') G.sound.storeChime({ x: -2.3, y: 2.3, z: 0.1 });
        else soundBus.oneShot(e.snd, at ? { x: at.x, z: at.z, y: 1.4, near: 4, far: 26, gain: e.gain ?? 0.8, recipe: e.snd.startsWith('dog-') ? e.snd : undefined } : { gain: e.gain ?? 0.8 });
      }
    },
  };
  return api;
}
