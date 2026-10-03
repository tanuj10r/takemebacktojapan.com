import * as THREE from 'three';
import { Field, GUIDE } from '../../world/animals/guide.js';
import { TUNE } from './tune.js';

/* ------------------------------------------------------------------ *
 * Tap to walk (Tan, 2026-10-03: one thumb; "tap where you want to go, drag to look, nothing else").
 *
 *   tap(x, y)   a tap on the view: on Hachi, you walk up to him; near something to do (its ring on the screen),
 *               you walk into its ring; on the ground or a building, you walk there (in front of the building,
 *               or into the ring of what is done there, if one is near).  A soft ring marks where you are going.
 *   go(x, z)    the same, from anywhere (the whole map's tap)
 *   cancel()    a drag, a pause, a card: the walk stops where you are
 *   update(dt)  each frame: the way, the steering, the camera's help
 *
 * The way is Hachi's own (animals/guide.js): his walk grid and his distance fields, grown a few milliseconds a
 * frame, so the walk keeps to pavements and crossings and goes round what is in the way.  You are steered at a
 * point a few cells down the field that is still in plain sight, so the walk is smooth, not cell by cell.
 *
 * The camera helps a little (TUNE.goto): while you walk it eases toward the way ahead; when you arrive it eases
 * toward what is there.  A drag always wins at once, and for a moment after it the camera is left alone.
 * ------------------------------------------------------------------ */

export function createGoTo({ scene, camera, player, world, spots = () => [] }) {
  const G = TUNE.goto;
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), v = new THREE.Vector3();

  /* the ring where you are going: drawn flat a hair over the ground, pulsing gently, gone as you arrive */
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xfff6e8, transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.34, 0.5, 40).rotateX(-Math.PI / 2), ringMat);
  ring.renderOrder = 3; ring.visible = false; ring.frustumCulled = false; ring.userData.noOutline = true; ring.userData.dynamic = true;
  scene.add(ring);

  let field = null, goal = null, face = null, ringT = 0;
  const angle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

  function cancel() {
    goal = null; face = null;
    player.steer = null;
  }
  /** Walk to (x, z); `look`: a point to turn to on arrival; `stop`: stop this short of it (m). */
  function go(x, z, { look = null, stop = 0 } = {}) {
    const W = GUIDE.walk;
    if (!W || !player.locked || player.suspended || player.seat) return false;
    let c = W.cell(x, z);
    if (c < 0 || !W.cost[c]) c = W.nearest(x, z, 6);
    if (c < 0) return false;
    field ??= new Field(W);
    field.start([c]);
    const q = W.at(c);
    goal = { x: q.x, z: q.z, stop, t: 0 };
    face = look;
    ring.position.set(q.x, world.heightAt(q.x, q.z) + 0.03, q.z);
    ring.visible = true; ringT = 0;
    return true;
  }

  /** The screen position of a world point (CSS px), or null behind the camera. */
  const screen = (x, y, z) => {
    v.set(x, y, z).project(camera);
    if (v.z > 1) return null;
    return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight };
  };

  function tap(sx, sy) {
    if (!player.locked || player.suspended || player.seat) return false;
    const P = player.pos;
    // Hachi
    const h = GUIDE.where?.();
    if (h) {
      const p = screen(h.x, (h.y ?? 0) + 0.3, h.z);
      if (p && Math.hypot(p.x - sx, p.y - sy) < G.hachiPx && Math.hypot(h.x - P.x, h.z - P.z) < 60) return go(h.x, h.z, { look: { x: h.x, z: h.z }, stop: 1.2 });
    }
    // something to do: its ring on the screen
    let best = null, bd = G.spotPx;
    for (const e of spots()) {
      if (e.kind !== 'engage' || e.hidden) continue;
      if (Math.hypot(e.x - P.x, e.z - P.z) > 70) continue;
      const p = screen(e.x, world.heightAt(e.x, e.z) + 0.2, e.z);
      if (!p) continue;
      const d = Math.hypot(p.x - sx, p.y - sy);
      if (d < bd) { bd = d; best = e; }
    }
    if (best) return go(best.x, best.z, { look: best.look ?? null });
    // the ground, or the first building in the way
    ndc.set(sx / innerWidth * 2 - 1, -(sy / innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const o = ray.ray.origin, d = ray.ray.direction, cols = world.colliders;
    let hit = null, last = null;
    for (let t = 0.5; t < G.reach; t += 0.4) {
      const x = o.x + d.x * t, y = o.y + d.y * t, z = o.z + d.z * t;
      const gy = world.heightAt(x, z);
      if (y <= gy + 0.02) { hit = { x, z }; break; }
      let wall = false;
      for (const c of cols) if (x > c.x0 && x < c.x1 && z > c.z0 && z < c.z1 && (c.top ?? 99) > y && (c.bottom ?? 0) < y && (c.top ?? 99) > gy + 0.6) { wall = true; break; }
      if (wall) { hit = last ?? { x, z }; break; }
      last = { x, z };
    }
    if (!hit) return false;
    // a thing to do close by takes the walk into its ring (a tap on NIPPON's front walks you to its door)
    let near = null, nd = G.snap;
    for (const e of spots()) {
      if (e.kind !== 'engage' || e.hidden) continue;
      const dd = Math.hypot(e.x - hit.x, e.z - hit.z);
      if (dd < nd) { nd = dd; near = e; }
    }
    if (near) return go(near.x, near.z, { look: near.look ?? null });
    return go(hit.x, hit.z);
  }

  function update(dt) {
    // the ring: in, a soft pulse, out
    ringT += dt;
    const want = goal ? 0.85 : 0;
    ringMat.opacity += (want - ringMat.opacity) * (1 - Math.exp(-dt * 10));
    if (!goal && ringMat.opacity < 0.02) ring.visible = false;
    ring.scale.setScalar(1 + 0.12 * Math.sin(ringT * 4.2));

    const W = GUIDE.walk, P = player.pos;
    const quiet = performance.now() - (player.lookedAt ?? 0) > G.handsOff * 1000;
    if (goal) {
      if (!player.locked || player.suspended || player.seat) { cancel(); return; }
      field.work(4);
      if (!field.ready) return;
      let c = W.cell(P.x, P.z);
      if (c < 0 || !W.cost[c]) c = W.nearest(P.x, P.z, 2);
      const left = c >= 0 ? field.m[c] : Infinity;
      if (c < 0 || left === Infinity) { cancel(); return; }
      if (left <= goal.stop + G.arrive || Math.hypot(goal.x - P.x, goal.z - P.z) <= goal.stop + G.arrive * 0.6) {
        player.steer = null;
        goal = null;
        face ??= null;
        return;
      }
      // a point some cells down the field, still in plain sight: steer at it
      let aim = c;
      for (let k = 0, q = c; k < G.ahead; k++) {
        q = field.next(q);
        if (q < 0) break;
        const a = W.at(q);
        if (!W.sight(P.x, P.z, a.x, a.z)) break;
        aim = q;
      }
      const a = aim === c ? { x: goal.x, z: goal.z } : W.at(aim);
      const dx = a.x - P.x, dz = a.z - P.z, L = Math.hypot(dx, dz) || 1;
      player.steer = { x: dx / L, z: dz / L, slow: Math.min(1, (left - goal.stop) / 2.5) };
      // the camera, toward the way ahead
      if (quiet) {
        const yaw = Math.atan2(-dx, -dz);
        player.yaw += angle(yaw - player.yaw) * (1 - Math.exp(-dt * G.turn));
        player.pitch += (G.pitch - player.pitch) * (1 - Math.exp(-dt * 1.2));
      }
      return;
    }
    // arrived: turn toward what is there, gently, once
    if (face && quiet && player.locked && !player.suspended && !player.seat) {
      const yaw = Math.atan2(-(face.x - P.x), -(face.z - P.z));
      const e = angle(yaw - player.yaw);
      player.yaw += e * (1 - Math.exp(-dt * G.turn));
      if (Math.abs(e) < 0.03) face = null;
    } else if (face && !quiet) face = null;
  }

  return { tap, go, cancel, update, get walking() { return !!goal; }, ring };
}
