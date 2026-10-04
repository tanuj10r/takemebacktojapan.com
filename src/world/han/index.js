import * as THREE from 'three';
import { cel } from '../../core/toon.js';
import { soundBus } from '../../core/soundBus.js';
import { TOWN, SOUND, HAN_FX } from '../../config.js';
import { makeRX7, RX7 } from './rx7.js';
import { makeHan, POSES, blendPose } from './han.js';
import { buildDrive, driveAt, T_DRIVE } from './drive.js';
import { makeSmoke, makeMarks, makeVoice } from './fx.js';

/* ------------------------------------------------------------------ *
 * Han and the RX-7 (Tan's experience 2, docs/EXPERIENCES.md).
 *
 * In the car park across the road from the spawn, in the bay nearest the
 * main road and the bridge road, Han leans on the orange-and-black RX-7.
 * Nothing plays as you walk up (Tan, 2026-09-28: the glow ring says where
 * the engagement is).  Step into the glow in front of him and the Tokyo
 * Drift track starts with the show: he nods, gets in, backs out, runs up
 * the bridge road into the master junction, flicks the car and slides it
 * round in one long drift in a cloud of smoke, throws the tail the other
 * way into the bridge road, comes back into the bay, gets out and leans
 * again: all of it on the song's 17.7 s (the drive: drive.js; the smoke,
 * the tyre marks and the car's sound: fx.js).  The
 * camera is never taken.  The track is a placed one-shot (near 6 m, far
 * 24 m): heard at the car park, not across town.
 *
 * Town frame (TOWN.land; world = (-x, 2*main - z)).  The car park's road
 * row is z 2.2-7.2; the main road z 10.5-17.2; the master junction x 30.
 * If the player stands in the car's way it waits (the song plays on).
 *
 * Cost: the car ~30k triangles in about 14 draws, Han ~7k in about 25
 * (tiny ones), the smoke one draw of points and the tyre marks one more,
 * both only while there are any.  Nothing updates beyond 60 m unless the
 * drive is on.
 * ------------------------------------------------------------------ */

/** The bay Han's car stands in (town frame): parking.js keeps it and its
 * neighbours free of parked cars. */
export const HAN_BAY = { x: 24.15, z: 4.7, keep: 5.1 };   // the car park's reserved bay (land/parking.js: the road row's east end)
/** The glow Han waits by: step in and he goes. */
export const HAN_SPOT = { x: HAN_BAY.x - 2.45, z: 4.2, r: 0.85 };
/** The show, for whoever must keep out of the car's way (the guide shiba): is it running, where is the car (world). */
export const HAN_SHOW = { running: () => false, car: () => null };

/** The show, for the player's eyes (main.js, Tan 2026-09-28: "pan the view
 * of the player, focusing on the car, until the entire drift experience is
 * completed"): whether it is on, and where to look (world terms). */
export const hanShow = {
  running: false,
  /** The car, a little ahead of where it is (so the view leads it), at its roof line: into `out`. */
  target: (out) => out,
};

const SONG = 17.74;            // han-drift's length
const T_IN = 2.8;              // Han is in and the door shut: the drive starts
const T_END = T_IN + T_DRIVE + 2.3;
const NEAR = 60;               // beyond this nothing updates (the drive aside)

/* ------------------------------- building ------------------------------- */

export function buildHan(ctx) {
  const D = buildDrive(HAN_BAY);
  const car = makeRX7();
  const cg = car.group;
  cg.userData.dynamic = true;             // it moves: not merged into the town's static cells
  ctx.add(cg);

  // a soft contact shadow that goes where the car goes (the sun's shadow map redraws at 4 Hz)
  {
    const c = document.createElement('canvas');
    c.width = 64; c.height = 32;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(32, 16, 2, 32, 16, 32);
    grad.addColorStop(0, 'rgba(0,0,0,0.9)'); grad.addColorStop(0.6, 'rgba(0,0,0,0.55)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 64, 32);
    const tex = new THREE.CanvasTexture(c);
    const blob = new THREE.Mesh(new THREE.PlaneGeometry(4.7, 2.25), new THREE.MeshBasicMaterial({ map: tex, color: 0x1e1a30, transparent: true, opacity: 0.45, depthWrite: false }));
    blob.rotation.x = -Math.PI / 2;
    blob.position.y = 0.012;
    blob.renderOrder = 1;
    blob.userData.noOutline = true;
    cg.add(blob);
  }

  const han = makeHan();
  car.body.add(han.group);            // (he leans on it, sits in it: he rolls with the body)

  // where Han stands, car frame (the car's right side, +z, is the driver's)
  const HW = car.halfW(-0.55);
  const LEAN = new THREE.Vector3(-0.6, 0, HW + 0.05);    // his hips against the rear quarter, just ahead of the wheel
  const STAND = new THREE.Vector3(-0.72, 0, HW + 0.38);   // clear of the door's swing (its rear edge sweeps 1.18 m round the hinge)
  const DOOR = new THREE.Vector3(-0.3, 0, HW + 0.34);     // in the open door, his back to the seat
  const PERCH = new THREE.Vector3(-0.38, 0.24, 0.52);     // sat on the seat's edge, the feet still outside
  const SEAT = new THREE.Vector3(-0.38, 0.24, 0.37);      // (0.24: the seat of his trousers over the floor pan, his head under the roof; it was 0.2)
  const YAW_OUT = 0.12;                                    // facing out of the car, his back to the seat

  /* colliders: the car's follows it (world AABB round its turned box); Han's while he stands */
  const carCol = { x0: 0, x1: 0, z0: 0, z1: 0, top: 1.15 };
  const hanCol = { x0: 1e6, x1: 1e6, z0: 1e6, z1: 1e6, top: 1.8 };
  ctx.colliders.push(carCol, hanCol);

  /* the spot and the song: the track plays only with the show (no zone on approach) */
  const spotW = ctx.toWorld({ x: HAN_SPOT.x, z: HAN_SPOT.z });
  const songLevel = 0.5;
  let trigger = () => {};
  const spot = ctx.experiences?.add({
    id: 'han', name: "Han's RX-7", jp: 'ハン', x: HAN_SPOT.x, z: HAN_SPOT.z, r: HAN_SPOT.r, h: 1.9,
    label: "ハン  ·  Han's RX-7", action: () => trigger(),
  });

  const smoke = makeSmoke(ctx), marks = makeMarks(ctx), voice = makeVoice();

  /* state */
  const S = { run: false, t: 0, held: 0, rate: 1, armed: true, frozen: false, songT: 0, idle: 0, look: 0, lookP: 0, groundY: 0.03, door: 0 };
  const pose = {};
  const cp = {};
  const lot = TOWN.land.parking;
  const groundAt = (x, z) => {
    const g = ctx.groundAt ? ctx.groundAt(x, z) : 0;
    const inLot = x > lot[0] && x < lot[2] && z > lot[1] && z < lot[3];
    return Math.max(g, inLot ? 0.03 : 0);
  };

  const toTown = (px, pz, lx, lz, psi, out) => {
    const c = Math.cos(psi), s = Math.sin(psi);
    out.x = px + lx * c - lz * s; out.z = pz + lx * s + lz * c;
    return out;
  };
  const tw = {}, tw2 = {};
  function setBox(col, pts) {
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const p of pts) {
      const w = ctx.toWorld(p);
      x0 = Math.min(x0, w.x); x1 = Math.max(x1, w.x); z0 = Math.min(z0, w.z); z1 = Math.max(z1, w.z);
    }
    col.x0 = x0; col.x1 = x1; col.z0 = z0; col.z1 = z1;
  }

  /** Put the car at drive time dt (0 = parked). */
  function placeCar(dtm) {
    driveAt(D, dtm, cp);
    const psi = cp.psi;
    const gy = groundAt(cp.x, cp.z);
    S.groundY += (gy - S.groundY) * 0.35;
    cg.position.set(cp.x, S.groundY, cp.z);
    cg.rotation.y = -psi;
    car.setWheels(cp.dist / RX7.R, cp.steer, cp.rear / RX7.R);
    car.setLean(cp.roll, cp.pitch);
    // its collider, 6 cm in from the paint
    const hl = RX7.L / 2 - 0.08, hw = RX7.W / 2 - 0.1;
    setBox(carCol, [[hl, hw], [hl, -hw], [-hl, hw], [-hl, -hw]].map(([lx, lz]) => ({ ...toTown(cp.x, cp.z, lx, lz, psi, {}) })));
    return psi;
  }

  /** Is the player (town frame) in the car's way over the next moments? */
  function blocked(e, p) {
    const dt0 = e - T_IN;
    if (dt0 < 0 || dt0 > T_DRIVE) return false;
    const f = {};
    for (const a of [0.12, 0.3, 0.5, 0.7]) {
      driveAt(D, dt0 + a, f);
      const psi = f.psi, c = Math.cos(psi), s = Math.sin(psi);
      const dx = p.x - f.x, dz = p.z - f.z;
      const lx = dx * c + dz * s, lz = -dx * s + dz * c;
      if (Math.abs(lx) < RX7.L / 2 + 0.55 && Math.abs(lz) < RX7.W / 2 + 0.55) return true;
    }
    return false;
  }

  const ease = (u) => u * u * (3 - 2 * u);
  const seg01 = (e, a, b) => THREE.MathUtils.clamp((e - a) / (b - a), 0, 1);

  /* Getting in and out (Tan, 2026-10-02: no part of him under or through the car).  b: 0 stood in the open door, his
   * back to the seat .. 1 in the seat.  First he sits back onto the seat's edge, ducking under the roof, his feet
   * still on the ground outside (the legs by two-bone IK from the hip to where the feet stand, so they neither sink
   * nor float); then he swings his legs in over the sill, knees up, and his hands go to the wheel.  Out: the same,
   * backwards.  Writes `pos` and `pose`; returns his yaw. */
  const L1 = 0.44, L2 = 0.43, ANKLE = 0.1, SIT = 0.52;      // thigh, shin, the ankle over the sole (han.js); the share of b that is sitting back
  const lerp = THREE.MathUtils.lerp, clamp = THREE.MathUtils.clamp;
  const SEAT_PHI = -(POSES.seat.lHipX + POSES.seat.pelvisX);
  function legsTo(hipY, d, pelvisX, o) {
    // the hip `hipY` over the ground, the ankle `d` ahead of it and ANKLE up: the thigh's angle from straight down, the knee's bend
    const h = hipY - ANKLE, D = clamp(Math.hypot(d, h), 0.3, L1 + L2 - 0.004);
    o.phi = Math.atan2(d, h) + Math.acos(clamp((L1 * L1 + D * D - L2 * L2) / (2 * L1 * D), -1, 1));
    o.knee = Math.PI - Math.acos(clamp((L1 * L1 + L2 * L2 - D * D) / (2 * L1 * L2), -1, 1));
    o.foot = -(pelvisX - o.phi + o.knee);        // the sole level
    return o;
  }
  const lg = {}, lg1 = {};
  function seatMove(b, pos, pose) {
    const s = clamp(b / SIT, 0, 1), w = ease(clamp((b - SIT) / (1 - SIT), 0, 1));
    const down = ease(clamp(s * 1.25, 0, 1)), inn = ease(clamp((s - 0.15) / 0.85, 0, 1));
    pos.set(lerp(DOOR.x, PERCH.x, inn) + (SEAT.x - PERCH.x) * w, PERCH.y * down, lerp(DOOR.z, PERCH.z, inn) + (SEAT.z - PERCH.z) * w);
    // the body: down onto the seat, then the arms to the wheel as the legs come in
    blendPose(POSES.stand, POSES.seat, w, pose);
    pose.pelvisY = lerp(POSES.stand.pelvisY, POSES.seat.pelvisY, down);
    pose.pelvisX = lerp(POSES.stand.pelvisX, POSES.seat.pelvisX, down);
    const duck = Math.sin(Math.PI * s);                                         // the head and shoulders forward, under the roof's edge, as he goes in
    pose.spineX = lerp(POSES.stand.spineX, POSES.seat.spineX, w) + 0.5 * duck;
    pose.neckX = lerp(POSES.stand.neckX, POSES.seat.neckX, w) + 0.25 * duck;
    // (the hands to his thighs as he sits: hanging by his sides they went down through the seat)
    for (const k of ['lShX', 'rShX']) pose[k] = lerp(lerp(POSES.stand[k], -0.45, down), POSES.seat[k], w);
    for (const k of ['lElX', 'rElX']) pose[k] = lerp(lerp(POSES.stand[k], -1.0, down), POSES.seat[k], w);
    // the legs: the feet where they stood while he sits back; then swung in, knees up over the sill
    const back = Math.hypot(pos.x - DOOR.x, pos.z - DOOR.z);
    legsTo(pos.y + pose.pelvisY - 0.03, 0.04 + back, pose.pelvisX, lg);
    if (w > 0) {
      legsTo(PERCH.y + POSES.seat.pelvisY - 0.03, 0.04 + Math.hypot(PERCH.x - DOOR.x, PERCH.z - DOOR.z), POSES.seat.pelvisX, lg1);
      const up = Math.sin(Math.PI * w);
      lg.phi = lerp(lg1.phi, SEAT_PHI, w) + 0.4 * up;
      lg.knee = lerp(lg1.knee, POSES.seat.lKnee, w) + 0.5 * up;
      lg.foot = lerp(lg1.foot, POSES.seat.lFoot, w);
    }
    pose.lHipX = pose.rHipX = -lg.phi - pose.pelvisX;
    pose.lKnee = pose.rKnee = lg.knee;
    pose.lFoot = pose.rFoot = lg.foot;
    return YAW_OUT + (Math.PI / 2 - YAW_OUT) * w;
  }

  /** Han and the door at experience time e (not running: e < 0). */
  function placeHan(e, dt) {
    const g = han.group;
    let base = POSES.lean, target = POSES.lean, k = 0, door = 0, b = -1;
    const pos = new THREE.Vector3().copy(LEAN);
    let yaw = 0, nod = 0;
    const E = T_IN + T_DRIVE;
    if (e >= 0 && e < T_IN) {
      // a nod; off the car; the door opens; a step into it, turning his back to the seat; in; the door shuts
      nod = e < 0.6 ? Math.sin((e / 0.6) * Math.PI) : 0;
      const up = ease(seg01(e, 0.5, 1.1));
      base = POSES.lean; target = POSES.stand; k = up;
      pos.lerpVectors(LEAN, STAND, up);
      yaw = 0.7 * up;
      door = 1.15 * ease(seg01(e, 1.05, 1.45)) * (1 - ease(seg01(e, 2.4, 2.74)));
      const step = ease(seg01(e, 1.42, 1.78));
      if (step > 0) { pos.lerpVectors(STAND, DOOR, step); yaw = lerp(0.7, YAW_OUT, step); base = target = POSES.stand; }
      if (e > 1.78) b = seg01(e, 1.78, 2.44);
    } else if (e >= T_IN && e < E) {
      b = 1;
    } else if (e >= E && e < T_END) {
      // the door opens; out; a step clear of the door; it shuts; he leans on the car again
      const o = e - E;
      door = 1.15 * ease(seg01(o, 0.0, 0.4)) * (1 - ease(seg01(o, 1.3, 1.68)));
      if (o < 1.0) b = 1 - seg01(o, 0.34, 1.0);
      else {
        const step = ease(seg01(o, 1.0, 1.32));
        pos.lerpVectors(DOOR, STAND, step); yaw = lerp(YAW_OUT, 0.7, step); base = target = POSES.stand;
        const back = ease(seg01(o, 1.4, 2.2));
        if (back > 0) { pos.lerpVectors(STAND, LEAN, back); base = POSES.stand; target = POSES.lean; k = back; yaw = 0.7 * (1 - back); }
      }
    }
    if (b >= 0) yaw = seatMove(b, pos, pose); else blendPose(base, target, k, pose);
    g.position.copy(pos);
    g.rotation.y = yaw;
    // breathing, the head following you, the nod
    S.idle += dt;
    const br = Math.sin(S.idle * 1.6);
    pose.chestX += br * 0.012;
    pose.lShZ += br * 0.01; pose.rShZ -= br * 0.01;
    han.apply(pose);
    han.joints.chest.scale.set(1 + br * 0.008, 1 + br * 0.006, 1 + br * 0.012);
    han.joints.head.rotation.y = S.look;
    han.joints.head.rotation.x += S.lookP + nod * 0.32;
    car.setDoor(door);
    // the door's thunk as it shuts, a softer one as it opens (the sound engine's own recipe)
    if (!S.frozen && dt > 0) {
      const at = toTown(cg.position.x, cg.position.z, 0.2, 0.9, -cg.rotation.y, {});
      const w = ctx.toWorld(at);
      if (S.door > 0.05 && door <= 0.02) soundBus.oneShot('han-door', { recipe: 'fridge-door', x: w.x, z: w.z, y: 0.8, near: 3, far: 22, gain: 0.7 });
      if (S.door <= 0.001 && door > 0.001) soundBus.oneShot('han-door', { recipe: 'fridge-door', x: w.x, z: w.z, y: 0.8, near: 3, far: 18, gain: 0.3 });
    }
    S.door = door;
    return pos;
  }

  /* the song is fetched and decoded on the way here (QA-014); stepped in before it is ready, the show waits for it
   * (up to SOUND.hanSong.wait s), so the car and the song start together */
  let songAsked = false, songReady = false;
  function start() {
    if (S.run) return;
    if (!songReady && soundBus.ready) {
      const t = performance.now();
      S.songWait ??= t;
      if (t - S.songWait < SOUND.hanSong.wait * 1000) { S.pending = true; return; }
    }
    S.pending = false; S.songWait = null;
    S.run = true; S.t = 0; S.held = 0; S.rate = 1; S.songT = 0; S.armed = false;
    tyres[0].ok = tyres[1].ok = false; S.rear = null;
    // from the top, with the animation; local: full to 6 m, gone by 24 m (the famous view is 22.8 m off)
    soundBus.oneShot('han-drift', { x: spotW.x, z: spotW.z, y: 1.2, near: 6, far: 24, gain: songLevel });
    spot?.done();
  }
  trigger = start;
  HAN_SHOW.running = () => S.run;
  HAN_SHOW.car = () => ctx.toWorld({ x: cg.position.x, z: cg.position.z });

  // the paint's sky reflections follow the light: the scene's sun (the one shadow-casting directional)
  let sun = null;
  ctx.scene?.traverse((o) => { if (!sun && o.isDirectionalLight && o.castShadow) sun = o; });
  let envK = -1;
  const pl = new THREE.Vector3(), hv = new THREE.Vector3();
  ctx.update((dt, cam) => {
    if (!cam || S.puppet) return;                          // (Director Mode, dev: a shot drives Han and the car)
    const p = ctx.toLocal({ x: cam.x, z: cam.z });
    const dCar = Math.hypot(p.x - cg.position.x, p.z - cg.position.z);
    if (!songAsked && dCar < SOUND.hanSong.preload && soundBus.ready) {
      songAsked = true;
      soundBus.preload(['han-drift']).then(() => { songReady = true; });   // (no file: the show goes on without waiting)
    }
    if (!S.run && dCar > NEAR) return;
    if (sun) {
      const k = THREE.MathUtils.clamp(sun.intensity / 2.2, 0.22, 1.1);
      if (Math.abs(k - envK) > 0.01) { envK = k; car.setEnv(k); smoke.setLight(k); }
    }
    /* The show keeps the song's time, not the game's (the game's clock is
     * capped at 1/20 s a frame).  Paused (dt 0) both stand still: the engine
     * holds the song where it is (QA-013), and the show picks up with it on
     * the frame after resume.  A frozen capture (dt 0) stays frozen. */
    const now = performance.now();
    if (dt > 0) { const w = S.wall; S.wall = now; dt = w == null ? 0 : Math.min(0.25, (now - w) / 1000); }
    else S.wall = null;

    // the trigger: step into the glow; it re-arms once you have stepped out again
    const dSpot = Math.hypot(p.x - HAN_SPOT.x, p.z - HAN_SPOT.z);
    if (!S.run) {
      if (dSpot > HAN_SPOT.r + 0.6) S.armed = true;
      if ((S.pending || (S.armed && dSpot < HAN_SPOT.r)) && dt > 0) start();
    }

    if (S.run && !S.frozen) {
      S.songT += dt;
      const e = S.t - S.held;
      // you are in its way: it brakes to a stop and waits (the song plays on), then goes on
      const want = blocked(e + dt, p) ? 0 : 1;
      S.rate += (want - S.rate) * Math.min(1, dt * 5);
      if (!want && S.rate < 0.03) S.rate = 0;
      S.held += dt * (1 - S.rate);
      S.t += dt;
      if (S.t - S.held >= T_END) { S.run = false; voice.stop(); }
    }
    const e = S.run ? S.t - S.held : -1;
    const dtm = e < T_IN ? 0 : Math.min(e - T_IN, T_DRIVE);
    const psi = placeCar(dtm);

    // Han's head: toward you when you are near and he is out of the car
    pl.set(cam.x, cam.y, cam.z);
    han.group.updateWorldMatrix(true, false);
    hv.copy(pl);
    han.group.worldToLocal(hv);
    const out = !(e >= T_IN - 0.4 && e < T_IN + T_DRIVE + 0.4);
    const dH = Math.hypot(hv.x, hv.z);
    let want = 0, wantP = 0;
    if (out && dH < 8) {
      want = THREE.MathUtils.clamp(Math.atan2(hv.x, hv.z), -1.0, 1.0);
      wantP = THREE.MathUtils.clamp(-Math.atan2(hv.y - 1.55, dH) * 0.5, -0.12, 0.2);
    }
    const kk = 1 - Math.exp(-dt * 4);
    S.look += (want - S.look) * kk;
    S.lookP += (wantP - S.lookP) * kk;
    const hp = placeHan(e, dt);

    // Han's collider while he stands by the car
    if (e < 1.3 || e > T_IN + T_DRIVE + 1.2) {
      const a = toTown(cp.x, cp.z, hp.x, hp.z, psi, tw), b = toTown(cp.x, cp.z, hp.x, hp.z + 0.3, psi, tw2);
      setBox(hanCol, [{ x: a.x - 0.25, z: a.z - 0.25 }, { x: b.x + 0.25, z: b.z + 0.25 }, { x: a.x + 0.25, z: a.z + 0.25 }, { x: b.x - 0.25, z: b.z - 0.25 }]);
    } else { hanCol.x0 = hanCol.x1 = hanCol.z0 = hanCol.z1 = 1e6; }

    // what the rear tyres leave while they slide: smoke, and black on the road; and the sound of it
    const driving = S.run && !S.frozen && dt > 0 && e >= T_IN && e < T_IN + T_DRIVE;
    if (driving) {
      trail(dt * S.rate, S.rate);
      const wheel = Math.abs(cp.rear - S.rear) / Math.max(1e-3, dt), dv = (cp.speed - S.speed) / Math.max(1e-3, dt);
      voice.step(dCar, wheel, cp.speed * S.rate, cp.slide * S.rate, THREE.MathUtils.clamp(Math.max(cp.slide, dv / 5, 0.15) * S.rate, 0, 1));
    } else if (voice.on && !S.frozen && dt > 0) voice.stop();
    S.rear = cp.rear; S.speed = cp.speed;
    if (!S.frozen) { smoke.update(dt); marks.update(dt); }
  });

  /* The rear tyres' tracks over the last `dt` s of the drive (`k`: 0 while the car waits for you): marks laid
   * along each tyre's own path on the ground, puffs born along it and leaving with some of the car's speed and
   * some of the wheelspin's (thrown back off the tyre). */
  const tyres = [{ x: 0, z: 0, ok: false, acc: 0 }, { x: 0, z: 0, ok: false, acc: 0 }], tp = {};
  function trail(dt, k = 1) {
    const F = HAN_FX.smoke, slide = cp.slide * k;
    const c = Math.cos(cp.psi), s = Math.sin(cp.psi);
    const spin = cp.rev ? 0 : Math.max(0, (cp.rear - (S.rear ?? cp.rear)) / Math.max(1e-3, dt) - cp.speed);   // how much faster than the road the tyres turn
    for (let w = 0; w < 2; w++) {
      const T = tyres[w];
      toTown(cp.x, cp.z, RX7.axle.r, (w ? 1 : -1) * RX7.track.r, cp.psi, tp);
      const gy = groundAt(tp.x, tp.z);
      marks.lay(w, tp.x, gy, tp.z, slide > 0.3 ? slide : 0);
      if (slide > 0.05 && T.ok && dt > 0) {
        const vx = (tp.x - T.x) / dt, vz = (tp.z - T.z) / dt;
        T.acc += dt * F.rate * slide;
        const n = Math.floor(T.acc);
        T.acc -= n;
        for (let i = 0; i < n; i++) {
          const u = (i + 0.5) / n;                                              // along the stretch it covered this frame
          smoke.emit(T.x + (tp.x - T.x) * u, gy + 0.12, T.z + (tp.z - T.z) * u, vx * F.carry - c * spin * F.fling, vz * F.carry - s * spin * F.fling, slide);
        }
      }
      T.x = tp.x; T.z = tp.z; T.ok = true;
    }
  }

  /* where the eyes go: the car LEAD s ahead on its route, blended with where
   * it is (the drive is a fixed path, so the lead never jumps) */
  const LEAD = 0.35, ahead = {};
  hanShow.target = (out) => {
    const e = S.run ? S.t - S.held : -1;
    const dtm = e < T_IN ? 0 : Math.min(e - T_IN, T_DRIVE);
    driveAt(D, Math.min(T_DRIVE, dtm + (dtm > 0 && dtm < T_DRIVE ? LEAD * S.rate : 0)), ahead);
    const w = ctx.toWorld({ x: (ahead.x + cp.x) / 2, z: (ahead.z + cp.z) / 2 });
    out.x = w.x; out.y = S.groundY + 1.0; out.z = w.z;
    return out;
  };
  Object.defineProperty(hanShow, 'running', { get: () => S.run && !S.frozen, configurable: true });

  placeCar(0);
  S.groundY = groundAt(HAN_BAY.x, HAN_BAY.z);
  placeCar(0);
  placeHan(-1, 0);

  // dev: set the show to a moment and hold it there (shots: the spot's `train: 'han:<t>'`)
  if (import.meta.env?.DEV) {
    const set = (t) => {
      S.run = true; S.frozen = true; S.t = t; S.held = 0; S.songT = SONG;
      smoke.reset(); marks.reset();
      tyres[0].ok = tyres[1].ok = false; S.rear = null;
      // what the drive has left by then: its marks, and the smoke still hanging
      for (let u = T_IN; u < Math.min(t, T_IN + T_DRIVE); u += 1 / 60) {
        driveAt(D, u - T_IN, cp);
        trail(1 / 60);
        S.rear = cp.rear;
        smoke.update(1 / 60); marks.update(1 / 60);
      }
      for (let u = T_IN + T_DRIVE; u < t; u += 1 / 60) { smoke.update(1 / 60); marks.update(1 / 60); }
      placeCar(t < T_IN ? 0 : Math.min(t - T_IN, T_DRIVE));
      S.rear = cp.rear; S.speed = cp.speed;
    };
    // what it costs: triangles and draws, car and Han apart
    const stats = (root) => {
      let tris = 0, draws = 0;
      root.traverse((o) => {
        if (!o.isMesh || !o.visible) return;
        const g = o.geometry, n = (g.index ? g.index.count : g.getAttribute('position').count) / 3;
        tris += n * (o.isInstancedMesh ? o.count : 1);
        draws += 1;
      });
      return { tris: Math.round(tris), draws };
    };
    window.__han = {
      parts: { han: han.group, body: car.body, car: cg, halfW: car.halfW },   // (scripts/_han-seat.mjs: is any of him under or through the car)
      set, play: () => { S.frozen = false; start(); }, stop: () => { S.run = false; S.frozen = false; smoke.reset(); marks.reset(); voice.stop(); },
      state: () => ({ run: S.run, t: S.t, held: S.held, armed: S.armed, x: cg.position.x, z: cg.position.z, psi: -cg.rotation.y, slide: cp.slide, smoke: smoke.count, marks: marks.quads, voice: voice.on }),
      show: (on) => { cg.visible = on; smoke.mesh.userData.on = marks.mesh.userData.on = on; smoke.mesh.visible = marks.mesh.visible = false; },
      // Director Mode: the parts, to drive by hand (S.puppet = true rests the show)
      car, han, cg, smoke, S, POSES, blendPose, groundAt, toTown, cp, D, placeCar, ctx,
      /* (a director's shot feeds its own car's place, heading and slide: the show's tyre trail, as it lays it now) */
      smokeStep: (dt, psi) => { cp.psi = psi; cp.slide = cp.sliding ? 1 : 0; cp.rev = false; cp.rear = (S.rear ?? 0) + (cp.speed ?? 0) * dt * 1.6; trail(dt, 1); S.rear = cp.rear; },
      stats: () => {
        const h = stats(han.group), all = stats(cg);
        return { car: { tris: all.tris - h.tris, draws: all.draws - h.draws }, han: h, smoke: smoke.count, marks: marks.quads };
      },
    };
    const prev = Object.getOwnPropertyDescriptor(window, '__train');
    let inner = prev?.value;
    Object.defineProperty(window, '__train', {
      configurable: true,
      get: () => (k) => (typeof k === 'string' && k.startsWith('han:') ? set(+k.slice(4)) : inner?.(k)),
      set: (f) => { inner = f; },
    });
  }
  return { car, han, drive: D };
}
