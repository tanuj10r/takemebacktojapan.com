// dev check: the guide pup (animals/guide.js), headless, end to end.
//
//   node scripts/_guide.mjs [outdir]              the voice check, then four fake players:
//                                                   follow   follows every suggestion: reaches every engagement in turn,
//                                                            how long, how far, ever stuck, ever through anything solid
//                                                   turnaway turns from the first suggestion and walks off: the pup must
//                                                            drop it within ~3 s, catch up within ~6 s, then suggest a
//                                                            spot that lies the player's way
//                                                   wander   wanders aimlessly for 60 s: the pup stays with them (never
//                                                            > 12 m off after catching up) and invites at most every 20 s
//                                                   whistle  F with the pup behind you, ahead, to the side, out of sight
//                                                            ~35 m off (it runs from there) and 100+ m off (set on its
//                                                            way to you, out of sight): never a jump into view
//                                                   reactions  blinks; a head tilt when you stand looking at it; a yawn
//                                                            kept waiting; a startle at the crossing's bells, then brave
//                                                   snack    the konbini's five bits: by you where you eat, on the surface
//                                                   after    the tour over: whistled it stays with you; the tour again
//                                                   crossing the level crossing shut as he comes to it: he sits at the barrier, the
//                                                            train goes by, the arms lift, he goes over (never onto it while
//                                                            it is shut; caught on it as it shuts, he runs off it); then his
//                                                            own home: in through the gate, the joy, sat proudly on his mat
//                                                   bedtime  the tour's end: up onto the gate's bench, a play, curled up asleep on
//                                                            it; onNap once it has settled; F: it hops down first
//                                                 plus the respawn rule (a jump onto the view: out of the frame) and a
//                                                 map of the follow run's trail
//   node scripts/_guide.mjs --measure [--root d]  draw calls, triangles and frame ms at the hero view
//                                                 and three spots the pup waits at (--root: another checkout)
//
// Starts its own dev server and Chrome (queued on the shots lock) and closes
// both however it ends.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : null; };
const ROOT = path.resolve(opt('root') ?? path.resolve(path.dirname(new URL(import.meta.url).pathname), '..'));
const HERE = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const out = path.resolve(args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--root' && args[i - 1] !== '--only') ?? path.join(HERE, '.shots', 'guide'));
const MEASURE = args.includes('--measure');
const ONLY = opt('only');   // --only turnaway,whistle: just these scenarios
fs.mkdirSync(out, { recursive: true });

// one browser at a time on the shared laptop (taken first: a run that holds it may be queued on the shots lock)
const BLOCK = '/tmp/lawson-browser.lock';
let mineB = false;
for (let k = 0; ; k++) { try { fs.mkdirSync(BLOCK); mineB = true; break; } catch { if (k % 6 === 0) console.log('  waiting for the browser lock'); await new Promise((r) => setTimeout(r, 10000)); } }
const LOCK = path.join(os.tmpdir(), 'takemebacktojapan-shots.lock');
for (;;) {
  try { fs.mkdirSync(LOCK); fs.writeFileSync(path.join(LOCK, 'pid'), String(process.pid)); break; } catch {
    let pid = 0, alive = false;
    try { pid = +fs.readFileSync(path.join(LOCK, 'pid'), 'utf8'); } catch {}
    try { if (pid) { process.kill(pid, 0); alive = true; } } catch {}
    if (!alive) { fs.rmSync(LOCK, { recursive: true, force: true }); continue; }
    console.log(`  waiting for another run (pid ${pid})`);
    await new Promise((r) => setTimeout(r, 5000));
  }
}
const unlock = () => { try { if (+fs.readFileSync(path.join(LOCK, 'pid'), 'utf8') === process.pid) fs.rmSync(LOCK, { recursive: true, force: true }); } catch {} if (mineB) { try { fs.rmdirSync(BLOCK); } catch {} mineB = false; } };
process.on('exit', unlock);

// --phone: the phone page (m.html, its own plan: the pocket town) instead of the desktop's; run with --only tour (the
// other scenarios stand at the desktop's own spots)
const PHONE = process.argv.includes('--phone');
const server = await createServer({ root: ROOT, configFile: path.join(ROOT, 'vite.config.js'), ...(PHONE ? { mode: 'mobile' } : {}), logLevel: 'error', server: { port: +process.env.PORT || 5194, strictPort: !!process.env.PORT, host: '127.0.0.1' } });
await server.listen();
const base = server.resolvedUrls.local[0];
const flags = ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-precise-memory-info', '--autoplay-policy=no-user-gesture-required'];
let browser;
try { browser = await chromium.launch({ channel: 'chrome', headless: true, args: flags }); }
catch { browser = await chromium.launch({ headless: true, args: flags }); }
const close = async () => { await Promise.race([browser.close().then(() => server.close()), new Promise((r) => setTimeout(r, 8000))]).catch(() => {}); };
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, async () => { await close(); process.exit(130); });

const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.setDefaultNavigationTimeout(180000);
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error' && !/404/.test(m.text())) errs.push(m.text()); });

/* The fake players, run in the page.  `kind` picks the policy; the sim returns what happened. */
const SIM = async (arg) => {
  const [kind, PHONE_TOUR] = Array.isArray(arg) ? arg : [arg, false];
  const g = window.__guide, W = g.walk, world = window.__scene.world, camera = window.__scene.camera;
  g.reset();
  if (kind === 'intro') g.introReset(); else g.introMark();   // the hello is its own check; elsewhere it has been said
  const dt = 1 / 30;
  const P = { x: 0, y: 1.6, z: 16.5, yaw: 0 };
  const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  const solid = world.colliders.filter((c) => (c.bottom ?? 0) < 0.8 && (c.top ?? 9) > 0.3 && c.x1 - c.x0 > 0.01 && !c.pet);   // (`pet`: his own door, tunnel and hoop)
  const hit = (x, z) => solid.some((c) => x > c.x0 && x < c.x1 && z > c.z0 && z < c.z1);
  const lookAt = (tx, tz) => { P.yaw = Math.atan2(-(tx - P.x), -(tz - P.z)); };
  const sync = () => { camera.position.set(P.x, P.y, P.z); camera.rotation.set(0, P.yaw, 0); camera.updateMatrixWorld(); world.update(0, camera); };
  // a walker: straight at the goal on free ground, sliding along whatever is in the way
  let prog = { x: P.x, z: P.z, t: 0 }, detour = 0;
  // (you step over what a pup goes round, a wheel stop, a low kerb: the grid's `low` cells are free to you)
  const freeP = (x, z) => { if (W.free(x, z)) return true; const c = W.cell(x, z); return c >= 0 && W.low[c] === 1; };
  const walk = (goal, v, loose = false) => {
    const dx = goal.x - P.x, dz = goal.z - P.z, d = Math.hypot(dx, dz);
    if (d < 0.05) return true;
    if (!loose && !freeP(P.x, P.z)) { const c = W.nearest(P.x, P.z, 2); if (c >= 0) { const q = W.at(c); P.x = q.x; P.z = q.z; } }
    if (dist(P, prog) > 0.5) prog = { x: P.x, z: P.z, t: 0 }; else if ((prog.t += dt) > 2) detour = 3;
    if (detour > 0 && g.G.field?.ready) {
      detour -= dt;
      const c = W.cell(P.x, P.z), n = c >= 0 ? g.G.field.next(c) : -1;
      if (n >= 0) { const q = W.at(n); const qx = q.x - P.x, qz = q.z - P.z, qd = Math.hypot(qx, qz) || 1, s = Math.min(qd, v * dt); P.x += (qx / qd) * s; P.z += (qz / qd) * s; prog = { x: P.x, z: P.z, t: 0 }; return true; }
    }
    const s = Math.min(d, v * dt);
    const nx = P.x + (dx / d) * s, nz = P.z + (dz / d) * s;
    const clearTo = () => { for (let k = 1; k <= 8; k++) if (hit(P.x + dx * k / 8, P.z + dz * k / 8)) return false; return true; };
    if (freeP(nx, nz) || (loose && d < 2.5 && clearTo())) { P.x = nx; P.z = nz; return true; }
    if (freeP(nx, P.z)) { P.x = nx; return true; }
    if (freeP(P.x, nz)) { P.z = nz; return true; }
    return false;
  };
  // a step along a heading, sliding; false when nothing gives
  const stride = (yaw, v) => walk({ x: P.x + Math.sin(yaw) * 3, z: P.z + Math.cos(yaw) * 3 }, v);
  const S = g.G;
  // (the trains don't run in this sim: the listening spot, shown only while a train stands with its doors open, is
  // left on offer so the tour can pass through it; _play 24-train checks the real timing)
  world.update(0, camera);
  for (const e of world.experiences.list.concat(world.lawson.experiences.list)) if (e.id === 'train') e.hidden = false;
  const spots = () => world.experiences.list.concat(world.lawson.experiences.list).filter((e) => e.kind === 'engage');
  const angleTo = (e, hx, hz) => { const dx = e.x - P.x, dz = e.z - P.z, d = Math.hypot(dx, dz) || 1; return Math.acos(Math.max(-1, Math.min(1, (dx * hx + dz * hz) / d))) * 180 / Math.PI; };
  const rows = [], trail = [], events = [];
  let t = 0, away = null, lastDone = S.done.size, cur = null, viol = 0, wall = 0, pstuck = 0, stuck = 0, still = 0, lastPos = { x: S.x, z: S.z }, rest = 0, fieldMs = 0;
  let state = S.state, act = null, charges = 0, wasCharge = false;
  const acts = new Set(), states = new Set();
  const cone = (() => { const dx = S.x - P.x, dz = S.z - P.z; return Math.acos(-dz / Math.hypot(dx, dz)) * 180 / Math.PI; })();
  sync();
  const home0 = { x: S.x, z: S.z, state: S.state };
  /* the tour's books: how near the player passed each sound place and the gate; the pup's cells on water, in
   * alleys and on paddy plots; flights entered from the side; its feet against the real ground */
  const A = window.__guide.A;
  const hear = Object.fromEntries(Object.entries(A.hear).map(([k, v]) => [k, { need: v[2], min: 999 }]));
  const gateW = A.tour.find((l) => l.id === 'gate');
  let gateMin = 999, waterCells = 0, alleyCells = 0, plotCells = 0, sideEntries = 0, feetLow = 0, feetWorst = 0, lastCell = -1;
  const KC = A.costs;
  // the level crossing and the places he goes into (his home, the shrine): never onto the crossing while it is shut;
  // which phases of a visit were seen; how far he had gone at each leg
  let railEnter = 0, railWas = false, legWas = -1, hopMax = 0;
  const visitPhases = [], legsM = [];
  /* the route (Tan, 2026-10-02: after the mochi shop he cut across to the station by the lane behind and ドンペン堂 was
   * never passed): the order you come to each stop and each sound place in, and how far off the shopping street's
   * middle (x 50) he leads you between its first zebra and the plaza */
  const order = [];
  let spineOff = 0;
  const kSpine = [A.tour.findIndex((l) => l.hear === 'walk1'), A.tour.findIndex((l) => l.hear === 'station')];
  const WANT = PHONE_TOUR ? ['konbini', 'donki', 'walk1', 'station', 'train', 'shrine', 'slowlife']      // (the pocket town's order: no Han, no ぺったん堂, no home, no crossing detour)
    : ['konbini', 'han', 'mochi', 'walk1', 'donki', 'walk2', 'station', 'train', 'crossing', 'shrine', 'slowlife'];
  const inOrder = (from = 0, to = WANT.length) => { const at = WANT.slice(from, to).map((k) => order.indexOf(k)); return at.every((v, i) => v >= 0 && (i === 0 || v > at[i - 1])); };
  /* The surface (Tan, 2026-10-02: "Hachi's y must always be the true top surface under him"): what is really drawn
   * under the pup, by a ray straight down through the scene's solid meshes (not the platforms his ground is worked out
   * from), against the lowest point he is drawn at (g.lowest()).  Sampled every 0.25 m he moves and every 0.4 s he
   * stays: never under it (1.5 cm), never over it but in a stride or a hop, his body never inside anything solid. */
  const T3 = window.__scene.THREE, scn = window.__scene.scene;
  const SKIP = /exp-highlight|water|mirror|sky|cloud|fuji|hill|night|pool|glow|petal|shadow|animals|decal|paint/i;
  const boxes = new WeakMap(), rc = new T3.Raycaster(), down = new T3.Vector3(0, -1, 0), from = new T3.Vector3();
  const solidMat = (m) => (Array.isArray(m) ? m.some(solidMat) : !!m && m.visible !== false && m.depthWrite !== false && !(m.transparent && m.opacity < 0.6));
  const nameOf = (o) => { const n = []; for (let q = o; q && n.length < 4; q = q.parent) if (q.name) n.push(q.name); return n.join('<') || '?'; };
  /** The top of what is drawn at (x, z), looking down from `y + up`: { y, name }, or null (nothing within `far`). */
  const surface = (x, z, y, up = 0.45, far = 1.6) => {
    const cand = [];
    scn.traverseVisible((o) => {
      if (!o.isMesh || SKIP.test(o.name) || !solidMat(o.material)) return;
      let bb = boxes.get(o);
      if (!bb) {
        if (o.isInstancedMesh) { o.computeBoundingBox(); bb = o.boundingBox.clone(); } else { if (!o.geometry.boundingBox) o.geometry.computeBoundingBox(); bb = o.geometry.boundingBox.clone(); }
        bb.applyMatrix4(o.matrixWorld); boxes.set(o, bb);
      }
      if (x >= bb.min.x && x <= bb.max.x && z >= bb.min.z && z <= bb.max.z && bb.max.y > y + up - far && bb.min.y < y + up) cand.push(o);
    });
    // (the town's merged meshes are hundreds of thousands of triangles: each mesh's up-facing ones are binned by the
    // metre once, and a ray looks only at its own bin; instanced meshes go through three's own raycast)
    const y1 = y + up, y0 = y1 - far;
    let best = null, by = -Infinity;
    const inst = [];
    for (const o of cand) {
      if (o.isInstancedMesh) { inst.push(o); continue; }
      const ix = triIndex(o), l = ix.cells.get(Math.floor(x) + ',' + Math.floor(z));
      for (const list of [l, ix.big]) {
        if (!list) continue;
        const V = ix.V;
        for (let k = 0; k < list.length; k += 3) {
          const a = list[k] * 3, b = list[k + 1] * 3, c = list[k + 2] * 3;
          const ax = V[a], az = V[a + 2], bx = V[b] - ax, bz = V[b + 2] - az, cx = V[c] - ax, cz = V[c + 2] - az, px = x - ax, pz = z - az;
          const den = bx * cz - cx * bz;
          if (Math.abs(den) < 1e-12) continue;
          const u = (px * cz - cx * pz) / den, v = (bx * pz - px * bz) / den;
          if (u < 0 || v < 0 || u + v > 1) continue;
          const yy = V[a + 1] + u * (V[b + 1] - V[a + 1]) + v * (V[c + 1] - V[a + 1]);
          if (yy <= y1 && yy >= y0 && yy > by) { by = yy; best = o; }
        }
      }
    }
    if (inst.length) { rc.set(from.set(x, y1, z), down); rc.far = far; const h = rc.intersectObjects(inst, false)[0]; if (h && y1 - h.distance > by) { by = y1 - h.distance; best = h.object; } }
    return best ? { y: by, name: nameOf(best) } : null;
  };
  const tris = new WeakMap(), _v = new T3.Vector3();
  const triIndex = (o) => {
    let ix = tris.get(o);
    if (ix) return ix;
    const g = o.geometry, pos = g.attributes.position, idx = g.index, n = idx ? idx.count : pos.count;
    const V = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) { _v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld); V[i * 3] = _v.x; V[i * 3 + 1] = _v.y; V[i * 3 + 2] = _v.z; }
    const side = Array.isArray(o.material) ? 2 : o.material.side;      // 0 front, 1 back, 2 both
    const cells = new Map(), big = [];
    for (let i = 0; i + 2 < n; i += 3) {
      const a = idx ? idx.getX(i) : i, b = idx ? idx.getX(i + 1) : i + 1, c = idx ? idx.getX(i + 2) : i + 2;
      const ax = V[a * 3], az = V[a * 3 + 2], bx = V[b * 3], bz = V[b * 3 + 2], cx = V[c * 3], cz = V[c * 3 + 2];
      const ny = (bz - az) * (cx - ax) - (bx - ax) * (cz - az);       // the face's normal, its y: up-facing ones only
      if (side === 0 ? ny <= 1e-9 : side === 1 ? ny >= -1e-9 : Math.abs(ny) <= 1e-9) continue;
      const x0 = Math.floor(Math.min(ax, bx, cx)), x1 = Math.floor(Math.max(ax, bx, cx)), z0 = Math.floor(Math.min(az, bz, cz)), z1 = Math.floor(Math.max(az, bz, cz));
      if ((x1 - x0 + 1) * (z1 - z0 + 1) > 400) { big.push(a, b, c); continue; }
      for (let xx = x0; xx <= x1; xx++) for (let zz = z0; zz <= z1; zz++) { const k = xx + ',' + zz; let l = cells.get(k); if (!l) cells.set(k, l = []); l.push(a, b, c); }
    }
    tris.set(o, ix = { V, cells, big });
    return ix;
  };
  const SF = { n: 0, under: [], over: [], inside: [], none: 0, worstUnder: 0, worstOver: 0, last: null, stillT: 0, on: false, hops: { kerb: 0, stair: 0, other: 0, pop: 0 }, snaps: [], was: null };
  const probe = () => {
    // his hops over steps and kerbs, counted; and never a snap: his height changing by 9 cm or more in a frame (a
    // thirtieth of a second) while he hasn't been set somewhere else
    if (S.jump && S.jump !== SF.jumpWas) { const dh = Math.abs(S.jump.h1 - S.jump.h0); SF.hops[S.jump.flight ? 'stair' : dh > 0.1 ? 'kerb' : 'other']++; }
    SF.jumpWas = S.jump;
    if (S.pop && S.pop !== SF.popWas) SF.hops.pop++;
    SF.popWas = S.pop;
    if (SF.was && Math.hypot(S.x - SF.was.x, S.z - SF.was.z) < 0.6 && Math.abs(S.y - SF.was.y) >= 0.09 && S.state !== 'staged' && !S.jump && !SF.airWas && !S.pop && S.hopT < 0 && !S.lift && !S.hopOff) SF.snaps.push([+t.toFixed(1), S.state, +S.x.toFixed(2), +S.z.toFixed(2), +SF.was.y.toFixed(3), +S.y.toFixed(3)]);
    SF.was = { x: S.x, y: S.y, z: S.z }; SF.airWas = !!S.jump || !!S.pop;
    const moved = !SF.last || dist(SF.last, S) >= 0.25;
    if (!moved && (SF.stillT += dt) < 0.4) return;
    SF.last = { x: S.x, z: S.z }; SF.stillT = 0;
    sync(); scn.updateMatrixWorld();
    const lw = g.lowest();
    if (!lw || !isFinite(lw.low)) return;
    const gy = g.ground(S.x, S.z) + (S.lift ?? 0), paw = gy + lw.low;
    // (five rays, 6 cm apart: under the lowest of them is under the surface, over the highest is over it; a rail's
    // groove, a joint between two slabs or the very edge of a kerb is neither)
    let sf = null, hi = -9;
    for (const [ox, oz] of [[0, 0], [0.06, 0], [-0.06, 0], [0, 0.06], [0, -0.06]]) { const q = surface(S.x + ox, S.z + oz, gy); if (!q) { sf = null; break; } if (!sf || q.y < sf.y) sf = q; hi = Math.max(hi, q.y); }
    SF.n++;
    const fx = g.fx.names?.join?.('+') ?? '';
    const row = (d, nm) => [+t.toFixed(1), S.state, S.act?.name ?? (S.bed?.phase ?? (g.tour.visit?.phase ?? '')), fx, +S.x.toFixed(2), +S.z.toFixed(2), +gy.toFixed(3), +paw.toFixed(3), +d.toFixed(3), nm, +S.posture.toFixed(1), +S.speed.toFixed(1), +(S.hop ?? 0).toFixed(2)];
    if (!sf) { SF.none++; return; }
    const d = paw - sf.y;
    const air = (S.hop ?? 0) > 0.005 || g.fx.out.dy > 0.01 || !!S.jump || !!S.pop || S.bed?.phase === 'hop' || !!S.hopOff || (S.state === 'visit' && g.tour.visit?.phase === 'hoop');
    const dHi = paw - hi;
    // (his own things: in his tunnel and in his house there is a roof over him, by design; his cushion is soft)
    const own = S.state === 'visit' && ['tunnel', 'hoop', 'kennel'].includes(g.tour.visit?.phase), soft = dist(S, g.home.bed) < 0.55;
    if (d < (soft ? -0.035 : -0.0155) && !own) { SF.under.push(row(d, sf.name)); SF.worstUnder = Math.min(SF.worstUnder, d); }
    else if (dHi - (S.paws ?? 0) > (S.speed > 3 ? 0.11 : S.speed > 0.3 || S.act || g.fx.busy || S.amp > 0.15 ? 0.085 : 0.015) && !air) { SF.over.push(row(dHi, sf.name)); SF.worstOver = Math.max(SF.worstOver, dHi); }
    // his body (nose to rump, 14 cm either way) in a collider's box
    const perched = S.onBench || !!S.hopOff || S.bed?.phase === 'hop';
    if (!perched && !air && !own) for (const k of [-0.14, 0.14]) { const bx = S.x + Math.sin(S.yaw) * k, bz = S.z + Math.cos(S.yaw) * k; if (hit(bx, bz)) { SF.inside.push(row(k, 'collider')); break; } }
  };
  const surfRes = () => ({ n: SF.n, none: SF.none, snaps: SF.snaps.length, firstSnaps: SF.snaps.slice(0, 12), hops: SF.hops, under: SF.under.length, over: SF.over.length, inside: SF.inside.length, worstUnder: +SF.worstUnder.toFixed(3), worstOver: +SF.worstOver.toFixed(3), firstUnder: SF.under.slice(0, 400), firstOver: SF.over.slice(0, 400), firstInside: SF.inside.slice(0, 100) });
  const step = () => {
    const t0 = performance.now();
    g.step(dt, P);
    fieldMs += performance.now() - t0;
    t += dt;
    if (SF.on) probe();
    if (Math.round(t * 30) % 15 === 0) sync();
    if (Math.round(t * 30) % 6 === 0) trail.push([+S.x.toFixed(2), +S.z.toFixed(2)]);
    if (Math.round(t * 30) % 60 === 0 && t < 200) (window.__trace ??= []).push([Math.round(t), S.state, S.leg, +S.x.toFixed(1), +S.z.toFixed(1), +P.x.toFixed(1), +P.z.toFixed(1)]);
    // (up on the gate's bench, or hopping on or off it, it is over a collider by design)
    const perched = S.onBench || !!S.hopOff || S.bed?.phase === 'hop';
    // (through his own tunnel and hoop on purpose: walls to his walk since 2026-10-02, home.js)
    const through = S.state === 'visit' && ['tunnel', 'hoop'].includes(g.tour.visit?.phase);
    if (!W.free(S.x, S.z) && !(S.act?.name === 'circle') && !perched && !through) viol++;
    if (hit(S.x, S.z) && !perched && !through) wall++;
    for (const k in hear) { const v = A.hear[k], d = Math.hypot(P.x - v[0], P.z - v[1]); if (d < hear[k].min) hear[k].min = +d.toFixed(1); if (d <= v[2] && !order.includes(k)) order.push(k); }
    for (const id of S.done) if (!order.includes(id)) order.push(id);
    if (P.z < -5 && P.z > -95 && S.state === 'lead' && S.leg >= kSpine[0] && S.leg <= kSpine[1]) spineOff = Math.max(spineOff, Math.abs(S.x - 50));
    if (gateW) gateMin = Math.min(gateMin, Math.hypot(P.x - gateW.x, P.z - gateW.z));
    const c = W.cell(S.x, S.z);
    if (c >= 0) {
      if (W.water[c]) waterCells++;
      if (W.cost[c] === KC.alley) alleyCells++;
      if (W.cost[c] === KC.plot) plotCells++;
      if (c !== lastCell && lastCell >= 0) {
        const s = W.stair[c] || W.stair[lastCell];
        if (s) { const dx = (c % W.nx) - (lastCell % W.nx), dz = ((c / W.nx) | 0) - ((lastCell / W.nx) | 0); if ((s === 1 && dz !== 0) || (s === 2 && dx !== 0)) sideEntries++; }
      }
      lastCell = c;
    }
    { const rl = g.rail(); if (rl.on && !railWas && rl.shut) railEnter++; railWas = rl.on; }
    { const ph = g.tour.visit ? `${g.tour.visit.kind}:${g.tour.visit.phase}` : null; if (ph && visitPhases[visitPhases.length - 1] !== ph) visitPhases.push(ph); if (g.tour.visit?.kind === 'home') hopMax = Math.max(hopMax, S.hop); }
    if (S.state === 'lead' && S.leg !== legWas) { legsM.push([S.leg, +S.moved.toFixed(0), +t.toFixed(0)]); legWas = S.leg; }
    const gy = g.ground(S.x, S.z), low = S.y - gy;
    if (low < -0.035) { feetLow++; if (low < feetWorst) { feetWorst = low; res.feetAt = [+t.toFixed(1), S.state, +S.x.toFixed(2), +S.z.toFixed(2), !!S.jump, !!S.pop, g.tour.visit?.phase ?? null]; } }
    if (S.state !== state) { events.push({ t: +t.toFixed(1), from: state, to: S.state, target: S.target?.id ?? null, dP: +dist(P, S).toFixed(1) }); state = S.state; states.add(state); }
    if (S.state === 'charge' && !wasCharge) charges++;
    wasCharge = S.state === 'charge';
    if (S.act?.name && S.act.name !== act) acts.add(S.act.name);
    act = S.act?.name ?? null;
  };
  // the follower: stands a moment after each engagement, else follows the pup, stepping into the ring once the pup waits by it
  const crumbs = [];
  const follow = () => {
    { const l = crumbs[crumbs.length - 1]; if (!l || dist(l, S) > 0.5) crumbs.push({ x: S.x, z: S.z }); if (crumbs.length > 400) crumbs.shift(); }
    if (rest > 0) { rest -= dt; }
    else if (away && dist(P, away) < 5) {
      const dx = P.x - away.x, dz = P.z - away.z, d = Math.hypot(dx, dz) || 1;
      const goal = { x: P.x + (dx / d) * 2, z: P.z + (dz / d) * 2 };
      lookAt(goal.x, goal.z); if (!walk(goal, 2.3)) { if (!walk({ x: P.x - (dz / d) * 2, z: P.z + (dx / d) * 2 }, 2.3)) pstuck += dt; }
    } else {
      away = null;
      const tgt = S.target;
      let goal = null;
      if (tgt && (S.state === 'atSpot' || (S.state === 'lead' && dist(S, tgt) < 2.5))) goal = tgt;
      else if (tgt && S.state === 'invite') goal = tgt;
      else if (dist(P, S) > (S.state === 'visit' ? 1.7 : 3.2) && S.state !== 'home') {      // (into his home, into the shrine: right up to him)
        // follow its trail, as a player would (not a beeline at it: it leads from up to 9 m ahead, round corners)
        while (crumbs.length > 1 && dist(P, crumbs[0]) < 1.0) crumbs.shift();
        // off the trail (a corner cut, a stair's side): back onto it at the nearest crumb in sight
        if (crumbs.length && !W.sight(P.x, P.z, crumbs[0].x, crumbs[0].z)) {
          let bi = -1, bd = 1e9;
          for (let i = 0; i < crumbs.length; i++) { const d = dist(P, crumbs[i]); if (d < bd && W.sight(P.x, P.z, crumbs[i].x, crumbs[i].z)) { bd = d; bi = i; } }
          if (bi > 0) crumbs.splice(0, bi);
        }
        goal = crumbs.length && W.sight(P.x, P.z, crumbs[0].x, crumbs[0].z) ? crumbs[0] : S;
      }
      else if (S.state === 'home' && t < 3) goal = { x: P.x, z: P.z - 1 };      // walk off the view toward the store
      if (goal) { lookAt(goal.x, goal.z); if (!walk(goal, 2.3, goal === tgt)) pstuck += dt; }
    }
    if (S.state === 'lead' && dist(P, S) < 9) {
      if (dist(S, lastPos) < 0.3) { still += dt; if (still > 4) { stuck += dt; } } else { still = 0; lastPos = { x: S.x, z: S.z }; }
    } else still = 0;
    if (S.target?.id !== cur?.id && S.state === 'lead') { cur = { id: S.target.id, t0: t, moved: S.moved, p0: { x: P.x, z: P.z } }; }
    if (S.done.size > lastDone) {
      lastDone = S.done.size;
      if (cur) rows.push({ id: cur.id, secs: +(t - cur.t0).toFixed(1), dogM: +(S.moved - cur.moved).toFixed(1), crowM: +dist(cur.p0, S.target).toFixed(1) });
      rest = 3; away = { x: S.target?.x ?? P.x, z: S.target?.z ?? P.z };
      cur = null;
    }
  };
  window.__trace = [];
  const res = { kind, cone: +cone.toFixed(0), home0 };
  SF.on = true;      // (the surface under him is checked in every scenario: the tour, the whistle's ways, at your side after the tour)

  if (kind === 'tour') {
    // the follower goes wherever Hachi leads: the whole tour, to the nap
    let jogSum = 0, jogN = 0;
    // (the trains run, so the level crossing opens and shuts as it does in play: he waits at it when it is shut)
    world.line.service.stage('quiet');
    SF.on = true;
    while (t < 1500) { world.line.service.update(dt); follow(); step(); if (S.state === 'lead' && S.speed > 0.5) { jogSum += S.speed; jogN++; } if (S.state === 'nap' && S.posture > 1.9) break; }
    res.jog = +(jogSum / Math.max(1, jogN)).toFixed(2);
    res.rows = rows; res.secs = +t.toFixed(0); res.tourM = +S.moved.toFixed(0); res.end = g.state(); res.trace = window.__trace.slice(0, 90); res.pstuck = +pstuck.toFixed(1); res.stuck = +stuck.toFixed(1);
    res.hear = hear; res.gateMin = +gateMin.toFixed(1); res.waterCells = waterCells; res.alleyCells = alleyCells; res.plotCells = plotCells; res.sideEntries = sideEntries;
    res.feetLow = feetLow; res.feetWorst = +feetWorst.toFixed(3); res.legs = A.tour.length; res.lastLeg = S.leg;
    res.charges = charges;                      // (through the pigeons, on the shopping street and the plaza)
    SF.on = false; res.surface = surfRes();
    res.order = [...order]; res.inOrder = inOrder(); res.spineOff = +spineOff.toFixed(1); res.hops = SF.hops;
    res.visited = [...g.tour.visited]; res.visitPhases = visitPhases; res.railEnter = railEnter; res.legsM = legsM;
    const heard = Object.values(hear).every((h) => h.min <= h.need);
    // the respawn (H, or anything that puts you back on the view in a jump): the pup is home, out of the frame, at once
    {
      g.reset();
      const Q = { x: 0, y: 1.6, z: 16.5 };
      for (let k = 0; k < 90; k++) { if (k > 5) Q.z -= 2.3 * dt; g.step(dt, Q); }
      const before = { state: S.state, x: +S.x.toFixed(1), z: +S.z.toFixed(1), d: +dist(Q, S).toFixed(1) };
      Q.x = 0; Q.z = 16.5;
      g.step(dt, Q);
      const dx = S.x - Q.x, dz = S.z - Q.z;
      const angle = Math.acos(-dz / Math.hypot(dx, dz)) * 180 / Math.PI;
      res.respawn = { before, after: { state: S.state, x: +S.x.toFixed(1), z: +S.z.toFixed(1) }, angle: +angle.toFixed(0), ok: angle > 60 && S.state === 'home' };
    }
    // the map: the grid (black solid, grey asphalt, pale pavement) and the trail (red)
    const c = document.createElement('canvas');
    const sc = 2;
    c.width = W.nx * sc; c.height = W.nz * sc;
    const ctx = c.getContext('2d');
    for (let iz = 0; iz < W.nz; iz++) for (let ix = 0; ix < W.nx; ix++) {
      const k = W.cost[iz * W.nx + ix];
      ctx.fillStyle = k === 0 ? (W.water[iz * W.nx + ix] ? '#235' : '#111') : k === KC.alley ? '#555' : k === KC.plot ? '#8a7' : k >= 50 ? '#777' : k >= 20 ? '#9a9' : k <= 12 ? '#eee' : '#cdc';
      ctx.fillRect(ix * sc, (W.nz - 1 - iz) * sc, sc, sc);
    }
    ctx.strokeStyle = '#e02020'; ctx.lineWidth = 2; ctx.beginPath();
    trail.forEach(([x, z], i) => { const px = ((x - W.X0) / W.C) * sc, pz = (W.nz - (z - W.Z0) / W.C) * sc; i ? ctx.lineTo(px, pz) : ctx.moveTo(px, pz); });
    ctx.stroke();
    res.map = c.toDataURL('image/png');
    res.ok = rows.length === (PHONE_TOUR ? 3 : 5) && viol === 0 && wall === 0 && stuck < 5 && res.end.state === 'nap' && res.respawn.ok && cone > 60
      && heard && charges >= 1 && res.jog >= 2.7 && gateMin <= 8 && waterCells === 0 && alleyCells === 0 && sideEntries === 0 && feetLow === 0 && t < 900
      && (PHONE_TOUR || res.visited.includes('home')) && res.visited.includes('shrine') && railEnter === 0
      && (PHONE_TOUR ? ['shrine:sit'] : ['home:bounce', 'home:spin', 'home:tunnel', 'home:hoop', 'home:kennel', 'home:toy', 'home:flop', 'shrine:sit']).every((q) => visitPhases.includes(q))
      // every stop and sound place in the tour's order, down the shopping street past ドンペン堂; on the drawn surface throughout
      && res.inOrder && spineOff < 8 && res.surface.under === 0 && res.surface.over === 0 && res.surface.inside === 0 && res.surface.snaps === 0 && SF.hops.kerb >= 4 && SF.hops.stair >= 8;
  } else if (kind === 'route') {
    /* Tan, 2026-10-02: "after the new mochi stop Hachi led into the shopping street but turned left just before ドンペン堂
     * and went to the station by the parallel street".  Called (F) on that stretch, he used to make straight for the
     * next place not had (platform 1) by the planner's cheapest way; now the tour goes on from where you are, by its
     * own streets.  From the mochi shop: follow; F at the shop, at the street's mouth and short of ドンペン堂; each time
     * on to the train: ドンペン堂's spot passed within its radius, the stops in order, never off the shopping street. */
    const kM = A.tour.findIndex((l) => l.id === 'mochi');
    world.line.service.stage('quiet');
    const runs = [];
    for (const at of [30, 8, -22]) {
      g.reset(); g.introMark(); S.reUsed = new Set(spots().filter((e) => e.used).map((e) => e.id));
      order.length = 0; spineOff = 0; crumbs.length = 0; rest = 0; away = null; lastDone = 99;
      const c0 = W.nearest(A.tour[kM].x + 2, A.tour[kM].z, 2), q = W.at(c0);
      Object.assign(S, { x: q.x, z: q.z }); P.x = q.x - 2.5; P.z = q.z; sync();
      g.leadFrom(kM + 1);
      for (const k of WANT.slice(0, WANT.indexOf('mochi') + 1)) order.push(k);
      const t0 = t;
      let called = null, rejoined = null, legAfter = null, came = false;
      while (t - t0 < 240 && !S.done.has('train')) {
        world.line.service.update(dt);
        if (called === null && P.z < at) { called = +(t - t0).toFixed(1); g.whistle(); }
        if (called !== null && rejoined === null) { lookAt(S.x, S.z); if (S.state === 'come' || S.state === 'caught') came = true; if (came && S.state === 'lead') { rejoined = +(t - t0).toFixed(1); legAfter = S.leg; } }
        else follow();
        step();
      }
      const d = hear.donki.min;
      runs.push({ at, called, rejoined, legAfter, donki: d, spineOff: +spineOff.toFixed(1), order: order.slice(WANT.indexOf('mochi')), train: S.done.has('train'), secs: +(t - t0).toFixed(0),
        ok: called !== null && rejoined !== null && S.done.has('train') && d <= hear.donki.need && spineOff < 8 && inOrder(WANT.indexOf('mochi'), WANT.indexOf('train') + 1) });
      hear.donki.min = 999;
    }
    res.runs = runs;
    res.ok = runs.every((r) => r.ok);
  } else if (kind === 'intro') {
    // the hello, every start (Tan, 2026-09-29): standing on the start view as the game begins, it runs out from
    // behind you to in front, faces you, sits, says hello; waits there while you stay; leads when you walk off.
    // Nothing is remembered (no localStorage).
    try { localStorage.removeItem('hachi-intro'); } catch {}
    g.reset(); g.introReset();
    P.x = 0; P.z = 16.5; P.yaw = 0; sync();
    const pitch = 0.16;                                   // the start view's lens looks up at Fuji (HERO_VIEWS.golden.play)
    const bottom = 21.5 - pitch * 180 / Math.PI;          // degrees below the horizon at the frame's bottom edge (hfov 70, 16:9)
    let fired = null, sat = null, inLensFrames = 0, runFrames = 0, home = false;
    for (let k = 0; k < 20 * 30; k++) {
      step();
      if (fired === null && g.intro() === 1) fired = +t.toFixed(1);
      if (S.state === 'home' && fired !== null) home = true;
      if (fired !== null && S.state === 'intro' && S.introSaid && S.posture > 0.8 && sat === null) {
        const dx = S.x - P.x, dz = S.z - P.z, d = Math.hypot(dx, dz);
        const face = Math.abs(((Math.atan2(P.x - S.x, P.z - S.z) - S.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
        sat = { t: +t.toFixed(1), d: +d.toFixed(1), off: +(Math.acos(-dz / d) * 180 / Math.PI).toFixed(0), below: +(Math.atan2(1.6 - 0.35, d) * 180 / Math.PI).toFixed(1), faceDeg: +(face * 180 / Math.PI).toFixed(0) };
      }
      if (fired !== null && sat === null && S.state === 'intro') { runFrames++; const dx = S.x - P.x, dz = S.z - P.z, d = Math.hypot(dx, dz) || 1; if (-dz / d > Math.cos(33 * Math.PI / 180) && Math.atan2(1.25, d) * 180 / Math.PI < bottom) inLensFrames++; }
    }
    const card = document.getElementById('hachi-card');
    const cardText = card ? card.textContent : null;
    const waiting = S.state;                               // still on the view: sitting where it said hello
    // walk off the view: it leads
    let led = null;
    for (let k = 0; k < 5 * 30; k++) { lookAt(P.x, P.z - 2); walk({ x: P.x, z: P.z - 1 }, 2.3); step(); if (led === null && S.state === 'lead') led = +t.toFixed(1); }
    let stored = null; try { stored = localStorage.getItem('hachi-intro'); } catch {}
    // walking off the view at once: the hello comes then (not at 4 s), and it doesn't lead before it has said it
    g.reset(); g.introReset();
    P.x = 0; P.z = 16.5; P.yaw = 0; sync();
    const t1 = t; let early = null, ledFirst = false;
    for (let k = 0; k < 6 * 30; k++) { lookAt(P.x, P.z - 2); walk({ x: P.x, z: P.z - 1 }, 2.3); step(); if (S.state === 'lead' && g.intro() === 0) ledFirst = true; if (early === null && g.intro() === 1) early = +(t - t1).toFixed(1); }
    res.early = early; res.ledFirst = ledFirst;
    res.fired = fired; res.sat = sat; res.card = cardText; res.waiting = waiting; res.led = led; res.home = home; res.stored = stored; res.runSeen = +(inLensFrames / Math.max(1, runFrames)).toFixed(2);
    res.ok = fired !== null && fired >= A.intro.after - 0.1 && fired <= A.intro.after + 0.5 && !!sat && sat.t - fired <= 5 && sat.off <= 20 && sat.d >= 2 && sat.d <= 4.5 && sat.faceDeg <= 25   /* (on screen: the view eases down to it, main.js; _play 45-hachi-hello) */
      && early !== null && early > 0.3 && early < A.intro.after && !ledFirst && !!cardText && cardText.includes('F') && waiting === 'ready' && !home && led !== null && stored === null;
  } else if (kind === 'turnaway') {
    // Tan (2026-09-29): a guide, not a follower.  Off the view until the pup leads; follow 2 s; then turn away and
    // walk: it stops and waits where it is (never after you).  Walk back to it: it takes you on.  Away again, then F:
    // it comes, greets you, and rushes you to the nearest place you haven't been.
    while (t < 20 && !(S.state === 'lead' && S.target)) { lookAt(P.x, P.z - 2); if (t < 3) walk({ x: P.x, z: P.z - 1 }, 2.3); else { if (dist(P, S) > 3.2) { lookAt(S.x, S.z); walk(S, 2.3); } } step(); }
    const first = S.target?.id ?? null;
    for (let k = 0; k < 60 && S.state === 'lead'; k++) { lookAt(S.x, S.z); if (dist(P, S) > 2.5) walk(S, 2.3); step(); }
    const awayFrom = (secs) => {
      // away from where it is leading (not merely from the pup, which may be on the way there with you)
      const to = S.target ?? S;
      let yaw = Math.atan2(P.x - to.x, P.z - to.z);
      for (const d of [0, 0.5, -0.5, 1.0, -1.0, 1.5, -1.5]) { const y = yaw + d; if (W.free(P.x + Math.sin(y) * 4, P.z + Math.cos(y) * 4) && W.free(P.x + Math.sin(y) * 8, P.z + Math.cos(y) * 8)) { yaw = y; break; } }
      const t0 = t, seen = new Set();
      let tWait = null, at = null, moved = 0;
      while (t - t0 < secs) {
        lookAt(P.x + Math.sin(yaw) * 3, P.z + Math.cos(yaw) * 3);
        if (!stride(yaw, 2.3)) yaw += 0.6;
        step();
        seen.add(S.state);
        if (tWait === null && S.state === 'wait') { tWait = +(t - t0).toFixed(1); at = { x: S.x, z: S.z }; }
        if (at) moved = Math.max(moved, dist(at, S));
      }
      return { tWait, moved: +moved.toFixed(1), states: [...seen], d: +dist(P, S).toFixed(1) };
    };
    const a = awayFrom(14);
    // back to it: within a few metres it takes you on
    let rejoined = null;
    { const t0 = t; while (t - t0 < 25) { lookAt(S.x, S.z); walk(S, 2.3); step(); if (S.state === 'lead' && S.target) { rejoined = { t: +(t - t0).toFixed(1), target: S.target.id ?? `leg${S.target.k}`, d: +dist(P, S).toFixed(1) }; break; } } }
    const b = awayFrom(12);
    // F: it comes (seen), greets, then rushes you on: to the tour's next place not had (Tan, 2026-10-02: by the tour's
    // own streets), unless you stand within `near` m of another one
    g.whistle();
    let came = false, greeted = false, rush = null, fast = 0, t0 = t;
    const nearestLeft = () => {
      let best = null, bd = 1e9;
      for (const e of spots()) { if (S.done.has(e.id)) continue; const d = dist(P, e) + (S.skipped.has(e.id) ? A.drop.skipped : 0); if (d < bd) { bd = d; best = e; } }
      const next = A.tour.find((L, j) => j >= (S.leg ?? 0) && L.id && L.id !== 'gate' && !S.done.has(L.id));
      return next && best && next.id !== best.id && dist(P, best) > A.drop.near ? next.id : best?.id ?? null;
    };
    let expect = null;
    while (t - t0 < 30) {
      step();
      if (S.state === 'come') came = true;
      if (S.act?.name === 'greet') { greeted = true; expect ??= nearestLeft(); }
      if (greeted && S.state === 'lead' && rush === null) rush = { t: +(t - t0).toFixed(1), target: S.target?.id ?? null };
      if (rush && S.speed > fast) fast = S.speed;
      if (rush && t - t0 > rush.t + 3) break;
    }
    res.first = first; res.away = a; res.rejoined = rejoined; res.away2 = b; res.whistle = { came, greeted, rush, expect, fast: +fast.toFixed(1) };
    res.skipped = [...S.skipped]; res.events = events.slice(0, 14);
    const stays = (r) => r.tWait !== null && r.tWait <= 4.5 && r.moved <= 3.5 && !r.states.includes('come') && !r.states.includes('chase');
    res.ok = !!first && stays(a) && !!rejoined && rejoined.d <= 5 && stays(b) && came && greeted && !!rush && rush.target === expect && fast >= 3.2;
  } else if (kind === 'wander') {
    // wandering about on your own for a minute, never going back to it: it stays where it stopped (it never trails you)
    for (let k = 0; k < 90; k++) { lookAt(P.x, P.z - 2); walk({ x: P.x, z: P.z - 1 }, 2.3); step(); }
    const t0 = t;
    let yaw = Math.PI * 0.5, until = t, at = null, moved = 0, closest = 1e9, tWait = null;
    const seen = new Set();
    let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    while (t - t0 < 60) {
      if (t >= until) { yaw += (rnd() < 0.5 ? -1 : 1) * (Math.PI / 2 + rnd() * Math.PI / 2); until = t + 4 + rnd() * 2; }
      // (keep clear of it: walking back to it would take it up again)
      if (at && dist(P, S) < 8) yaw = Math.atan2(P.x - S.x, P.z - S.z);
      lookAt(P.x + Math.sin(yaw) * 3, P.z + Math.cos(yaw) * 3);
      if (!stride(yaw, 2.3)) yaw += 0.7;
      step();
      if (at) { seen.add(S.state); moved = Math.max(moved, dist(at, S)); closest = Math.min(closest, dist(P, S)); }
      if (!at && S.state === 'wait') { at = { x: S.x, z: S.z }; tWait = +(t - t0).toFixed(1); }
    }
    res.tWait = tWait; res.moved = +moved.toFixed(1); res.after = [...seen]; res.closest = +closest.toFixed(1); res.end = S.state;
    res.states = [...states]; res.acts = [...acts];
    res.ok = tWait !== null && tWait <= 12 && moved <= 3.5 && [...seen].every((q) => q === 'wait');
  } else if (kind === 'whistle') {
    /* F, from wherever it is (QA, Tan: "it runs in from a random place in front of me, out of nowhere, even when I had
     * just overtaken it"): within 60 m it runs from where it really is, by the way (behind you, it comes from behind);
     * only from farther is it set on its own way to you, out of your sight (behind you, off the side of your view, or
     * round a corner), and runs in from there.  Every frame: no jump that lands in your view ("popped"). */
    const VIEW = A.whistle.view;
    const inLens = (q, deg) => { const dx = q.x - P.x, dz = q.z - P.z, d = Math.hypot(dx, dz) || 1; return (-Math.sin(P.yaw) * dx - Math.cos(P.yaw) * dz) / d > Math.cos(deg * Math.PI / 180); };
    const lensAngle = (q) => { const dx = q.x - P.x, dz = q.z - P.z, d = Math.hypot(dx, dz) || 1; return +(Math.acos(Math.max(-1, Math.min(1, (-Math.sin(P.yaw) * dx - Math.cos(P.yaw) * dz) / d))) * 180 / Math.PI).toFixed(0); };
    const run = (place, label, yaw = 0, state = 'nap') => {
      g.reset();
      const dt = 1 / 30;
      Object.assign(S, { x: place.x, z: place.z, state, field: null, target: null });
      P.x = 0; P.z = 11; P.yaw = yaw; sync();          // (off the famous view: standing on one, the hero-frame rule wins and it waits behind you)
      for (let k = 0; k < 15; k++) g.step(dt, P);
      const d0 = +dist(P, S).toFixed(1), from = { x: +S.x.toFixed(1), z: +S.z.toFixed(1) }, fromAngle = lensAngle(S);
      // the sound log, in game time (the sim runs faster than the clock, so the log's own times mean nothing here)
      const log = window.__scene.sound.debug.log; log.length = 0;
      let seen = 0, tWhistle = null, tYip = null, whistles = 0, yips = 0;
      const readLog = (tt) => { for (; seen < log.length; seen++) { const n = log[seen].name; if (n === 'whistle') { whistles++; tWhistle ??= tt; } if (n === 'dog-yip') { yips++; tYip ??= tt; } } };
      g.whistle(); g.whistle();                          // a double press: one whistle, one answer
      readLog(0);
      let tt = 0, reached = null, resumed = null, states = [], start = null, perkUp = 0, runF = 0, seenF = 0, greeted = false, popped = false, jumps = 0, onWay = null, frontBy = null;
      let prev = { x: S.x, z: S.z };
      while (tt < 60) {
        g.step(dt, P); tt += dt;
        readLog(tt);
        if (tt < 0.8 && S.perk > 1.05) perkUp++;
        // a jump (more than a metre in a frame): only to where you can't see it
        if (dist(prev, S) > 1.0) { jumps++; if (inLens(S, VIEW) && !W.hidden(S.x, S.z, P.x, P.z)) popped = true; }
        prev = { x: S.x, z: S.z };
        if (start === null && S.state === 'come') {
          // (sideDeg: between the way it was from you and the way it is set from you)
          const ax = from.x - P.x, az = from.z - P.z, bx = S.x - P.x, bz = S.z - P.z;
          const sideDeg = +(Math.acos(Math.max(-1, Math.min(1, (ax * bx + az * bz) / ((Math.hypot(ax, az) * Math.hypot(bx, bz)) || 1)))) * 180 / Math.PI).toFixed(0);
          start = { x: +S.x.toFixed(1), z: +S.z.toFixed(1), d: +dist(P, S).toFixed(1), angle: lensAngle(S), hidden: W.hidden(S.x, S.z, P.x, P.z), cameFrom: S.cameFrom, sideDeg, answerMs: g.state().answerMs };
          // set somewhere: on its own way to you (the route down the whistle's field from where it was)?
          if (S.cameFrom === 'placed') {
            const f = S.field; let c = W.nearest(from.x, from.z, 3, (i) => f.m[i] < 1e9), best = 1e9;
            for (let k = 0; k < 6000 && c >= 0; k++) { const q = W.at(c); best = Math.min(best, dist(q, S)); c = f.next(c); }
            onWay = best < 1.0;
          }
        }
        if (!states.includes(S.state)) states.push(S.state);
        if (S.act?.name === 'greet') greeted = true;
        // from behind: when did it first come into the front half of your view (how near you)
        if (start && frontBy === null && reached === null && inLens(S, 90)) frontBy = +dist(P, S).toFixed(1);
        // the run you watch: from the answer until it is with you, in the lens (35 degrees) with nothing between
        if (tt > 0.9 && reached === null) { runF++; if (inLens(S, 33) && !W.hidden(S.x, S.z, P.x, P.z)) seenF++; }
        if (reached === null && dist(P, S) < 5) reached = +tt.toFixed(1);
        if (reached !== null && resumed === null && tt > 1.2 && ['lead', 'company', 'invite', 'nap'].includes(S.state)) { resumed = { t: +tt.toFixed(1), state: S.state, target: S.target?.id ?? null }; break; }
      }
      return { label, from, d0, fromAngle, start, onWay, frontBy, reached, resumed, states, whistles, yips, tWhistle, tYip: tYip === null ? null : +tYip.toFixed(2), earsUpFrames: perkUp, seen: +(seenF / Math.max(1, runF)).toFixed(2), greeted, jumps, popped };
    };
    const spot = (x, z, r = 4) => { const c = W.nearest(x, z, r); return c >= 0 ? W.at(c) : null; };
    const bench = window.__scene.world.frame.toWorld({ x: 75.6, z: 103.6 });
    const far = run(bench, 'far: the slow-life bench, 100+ m, you facing the store');
    const far2 = run(bench, 'far: the slow-life bench, 100+ m, you facing the car park', Math.PI);
    // within 60 m: it runs from where it is, wherever that is
    let mid = null;
    for (const cand of [{ x: 0, z: -24 }, { x: 4.6, z: -22 }, { x: -3, z: -22 }]) { mid = spot(cand.x, cand.z); if (mid) break; }
    const behindStore = mid ? run(mid, 'out of sight: behind the store, ~35 m') : null;
    // just overtaken: 18 m behind you on the far pavement, you walking on (looking -z)
    const back = spot(0, 29) ?? spot(4.6, 29);
    const behind = back ? run(back, 'behind you, ~18 m (just overtaken)', 0, 'wait') : null;
    // to the side: 20-25 m along the street to your left or right
    let sideQ = null;
    for (const x of [-22, 22, -18, 18]) { const q = spot(x, 11, 3); if (q && W.sight(q.x, q.z, 0, 11)) { sideQ = q; break; } }
    const side = sideQ ? run(sideQ, 'to the side, ~20 m', 0, 'wait') : null;
    // and in plain view ahead (the camera looking along open street): it runs from where it is, no jump
    let ahead = null;
    for (const yaw of [0, Math.PI, Math.PI / 2, -Math.PI / 2]) {
      for (const d of [22, 18, 14]) {
        const c = W.nearest(P.x - Math.sin(yaw) * d, P.z - Math.cos(yaw) * d, 3);
        if (c < 0) continue;
        const q = W.at(c);
        if (W.sight(q.x, q.z, 0, 11)) { ahead = { q, yaw }; break; }
      }
      if (ahead) break;
    }
    const near = ahead ? run(ahead.q, 'ahead, in view, ~20 m', ahead.yaw) : null;
    // and beside you already (2 m): no run, just the answer once the whistle is over
    const here = (() => {
      g.reset();
      P.x = 0; P.z = 11; P.yaw = 0; sync();
      for (let k = 0; k < 90; k++) g.step(1 / 30, P);        // it comes and starts leading
      const c = W.nearest(P.x, P.z - 2, 2); const q = c >= 0 ? W.at(c) : { x: P.x, z: P.z - 2 };
      Object.assign(S, { x: q.x, z: q.z, state: 'company', field: null, act: null, sinceInvite: 0 });   // (no invitation due, so what it does next is the answer alone)
      const log = window.__scene.sound.debug.log; log.length = 0;
      const d0 = +dist(P, S).toFixed(1);
      g.whistle(); g.whistle();
      let tt = 0, seen = 0, tWhistle = null, tYip = null, whistles = 0, yips = 0, hopped = false, ran = false, greetAt = null;
      while (tt < 4) {
        g.step(1 / 30, P); tt += 1 / 30;
        for (; seen < log.length; seen++) { const n = log[seen].name; if (n === 'whistle') { whistles++; tWhistle ??= +tt.toFixed(2); } if (n === 'dog-yip') { yips++; tYip ??= +tt.toFixed(2); } }
        if (S.act?.name === 'greet') hopped = true;
        if (S.act?.name === 'greet' && greetAt === null) greetAt = +dist(P, S).toFixed(1);
        if (S.state === 'chase' || dist(P, S) > 6) ran = true;   // (it bounds out in front of you to greet you; it must not run off)
      }
      return { d0, whistles, yips, tWhistle, tYip, hopped, ran, greetAt, d1: +dist(P, S).toFixed(1) };
    })();
    res.far = far; res.far2 = far2; res.behindStore = behindStore; res.behind = behind; res.side = side; res.near = near; res.here = here;
    const timing = (r) => r.whistles === 1 && r.yips >= 1 && r.tYip !== null && r.tYip - (r.tWhistle ?? 0) >= 0.52;
    const came = (r, secs) => r.reached !== null && r.reached <= secs && r.greeted && !!r.resumed && timing(r) && !r.popped;
    // far: set on its own way to you, out of your sight, and with you within ~10 s
    const placed = (r) => came(r, 10) && r.start?.cameFrom === 'placed' && (r.start.angle > A.whistle.view || r.start.hidden) && (r.onWay === true || r.start.sideDeg <= 60);
    // near enough: from where it is, no jump at all
    const ranFrom = (r, secs) => came(r, secs) && r.start?.cameFrom === 'here' && r.jumps === 0;
    res.ok = placed(far) && placed(far2)
      && (!behindStore || ranFrom(behindStore, 12))
      && !!behind && ranFrom(behind, 8) && behind.start.angle > 100 && (behind.frontBy === null || behind.frontBy <= 7)
      && (!side || ranFrom(side, 8))
      && !!near && ranFrom(near, near.d0 / 3.5 + 3) && near.seen >= 0.85 && near.earsUpFrames > 5
      && here.whistles === 1 && here.yips >= 1 && here.tYip - here.tWhistle >= 0.52 && here.hopped && !here.ran && here.greetAt >= 3.2 && here.greetAt <= 5.2;
  } else if (kind === 'crossing') {
    /* Tan, 2026-10-01: from the station to the level crossing; it is shut as he comes to it (a train coming): he sits
     * at the barrier and watches the train by, ears up; the arms lift and he goes over; never onto it while it is
     * shut.  Then his own home: in through the gate, the joy, sat proudly on his mat; visited once you are in. */
    const svc = world.line.service, F = world.frame;
    const kDown = A.tour.findIndex((l) => l.id === 'train') + 1, kCross = A.tour.findIndex((l) => l.cross), kHome = A.tour.findIndex((l) => l.visit === 'home');
    g.reset();
    const foot = A.tour[kDown];
    { const c = W.nearest(foot.x, foot.z, 2), q = W.at(c); Object.assign(S, { x: q.x, z: q.z }); P.x = q.x - 2; P.z = q.z + 2.5; sync(); }
    svc.stage('quiet');
    g.leadFrom(kDown);
    let staged = false, satAt = null, satFor = 0, perked = false, passed = false, wentAt = null, openAt = null, onShut = 0, armAtGo = null, trainAtGo = null, lookedAtTrain = 0;
    const log = window.__scene.sound.debug.log; log.length = 0;
    // (the listener where you stand: the frozen shots page doesn't move it, and his voice carries 16 m)
    const tick = () => { svc.update(dt); follow(); step(); if (Math.round(t * 30) % 15 === 0) window.__scene.sound.update(0, { camera, inside: false, look: 'day' }); };
    while (t < 240) {
      // the train: sent when he is 12 m short of the barrier, 11 s from the crossing (the lamps and bells on, the arms down)
      if (!staged && S.leg === kCross && dist(S, A.tour[kCross]) < 12) { staged = true; svc.stage('approach'); svc.runs[0].x -= 230; }
      tick();
      const rl = g.rail();
      if (rl.on && rl.shut) onShut++;
      if (S.state === 'cross') {
        if (S.posture > 0.8) { satAt ??= +t.toFixed(1); satFor += dt; }
        const tr = svc.runs[0], d = Math.max(0, Math.abs(tr.x - (-80)) - tr.len / 2);
        if (d === 0) passed = true;
        if (d < 40 && Math.abs(S.look) > 0.25) lookedAtTrain++;
        if (S.perk >= 0.95 && d < 70) perked = true;
      }
      if (staged && openAt === null && passed && !rl.shut) openAt = +t.toFixed(1);
      if (staged && wentAt === null && rl.on) { wentAt = +t.toFixed(1); armAtGo = +svc.cross.armT.toFixed(2); trainAtGo = svc.cross.closing; }
      if (staged && S.state === 'lead' && S.leg > kHome && !g.tour.visit) break;
    }
    const said = [...new Set(log.map((e) => e.name).filter((n) => /^dog-/.test(n ?? '')))];
    res.cross = { staged, satAt, satFor: +satFor.toFixed(1), perked, lookedAtTrain, passed, openAt, wentAt, armAtGo, trainAtGo, onShut, railEnter };
    res.home = { visited: [...g.tour.visited], phases: visitPhases, hopMax: +hopMax.toFixed(2), secs: +t.toFixed(0), said, end: g.state() };
    // caught on the crossing as it shuts (you far behind, so he had stopped to look back for you): off it at once
    let caught = null;
    {
      svc.stage('quiet');
      g.reset(); g.introMark();
      const c = W.nearest(A.tour[kCross].x, A.tour[kCross].z, 2), q = W.at(c);
      Object.assign(S, { x: q.x, z: q.z }); P.x = q.x; P.z = q.z + 3; sync();
      g.leadFrom(kCross);
      let on = null, off = null, armOff = null;
      for (let k = 0; k < 40 * 30; k++) {
        svc.update(dt);
        if (on === null) { lookAt(S.x, S.z); if (dist(P, S) > 3.2) walk(S, 2.3); }      // with him up to the deck, then you stop
        step();
        const rl = g.rail();
        // (a train 20 s off: the lamps and bells start, the arms still up)
        if (on === null && rl.on && Math.abs(S.z - (-134.3)) < 1.5) { on = +t.toFixed(1); svc.stage('approach'); svc.runs[0].x -= 400; Object.assign(svc.cross, { armT: 0, since: 0, closing: false }); }
        else if (on !== null && off === null && !rl.on) { off = +(t - on).toFixed(1); armOff = +svc.cross.armT.toFixed(2); break; }
      }
      caught = { on, off, armOff };
      svc.stage('quiet');
    }
    res.caught = caught;
    res.ok = staged && satAt !== null && satFor >= 4 && perked && passed && wentAt !== null && openAt !== null && wentAt >= openAt && armAtGo <= 0.05 && trainAtGo === false && onShut === 0 && railEnter === 0
      && res.home.visited.includes('home') && ['home:in', 'home:bounce', 'home:spin', 'home:tunnel', 'home:hoop', 'home:kennel', 'home:toy', 'home:flop'].every((q) => visitPhases.includes(q)) && hopMax > 0.2
      && ['dog-yip', 'dog-boof', 'dog-giggle'].every((n) => said.includes(n))
      && caught.on !== null && caught.off !== null && caught.off <= 3 && caught.armOff < 0.6;
  } else if (kind === 'bedtime') {
    // the tour's end (Tan: Hachi sank into the ground at the gate; make it "aww"): from 9 m off it trots to the gate's
    // bench, hops up, plays (a bow, a spin, a roll, a tilt), circles and curls up asleep ON the seat; GUIDE.onNap and
    // GUIDE.onTourEnd (the postcard) fire once, when it has settled, not before.  Then F from 6 m: it hops down first (never walks off in the air).
    g.reset();
    const Bn = g.bench;
    const fx = Bn.nap.x - Bn.x, fz = Bn.nap.z - Bn.z, fl = Math.hypot(fx, fz), F = { x: fx / fl, z: fz / fl }, L = { x: -F.z, z: F.x };
    P.x = Bn.x + F.x * 3.1 + L.x * 0.7; P.z = Bn.z + F.z * 3.1 + L.z * 0.7; lookAt(Bn.x, Bn.z); sync();
    // the listener where you stand (the frozen shots page doesn't move it; the pup's voice carries 16 m)
    window.__scene.sound.update(0, { camera, inside: false, look: 'day' });
    const c = W.nearest(Bn.nap.x + F.x * 9 - L.x * 2, Bn.nap.z + F.z * 9 - L.z * 2, 3), q = W.at(c);
    Object.assign(S, { x: q.x, z: q.z });
    const log = window.__scene.sound.debug.log; log.length = 0;
    g.napNow();
    let landed = null, settled = null, napAt = null, endAt = null, minY = 9, phases = [], last = null;
    while (t < 40) {
      step();
      if (endAt === null && S.ended) endAt = +t.toFixed(1);   // (GUIDE.onTourEnd, the postcard: once the bit is over and it has settled, never at the landing)
      const ph = S.bed?.phase ?? S.state;
      if (ph !== last) { phases.push(ph); last = ph; }
      if (landed === null && S.bed?.phase === 'bed') landed = +t.toFixed(1);
      if (S.bed?.phase === 'bed' || S.bed?.phase === 'sleep') minY = Math.min(minY, S.y);
      if (napAt === null && S.napped) napAt = +t.toFixed(1);
      if (settled === null && S.bed?.phase === 'sleep') settled = +t.toFixed(1);
      if (settled !== null && t > settled + 3) break;
    }
    const said = [...new Set(log.map((e) => e.name).filter((n) => /^dog-/.test(n ?? '')))];
    const asleep = { y: +S.y.toFixed(3), posture: +S.posture.toFixed(2), onBench: !!S.onBench };
    // F from 6 m out in front: down off the bench, then to you
    P.x += F.x * 3; P.z += F.z * 3; sync();
    g.whistle();
    let hopped = false, floating = 0, came = false;
    for (let k = 0; k < 6 * 30; k++) { step(); if (S.hopOff) hopped = true; if (!S.onBench && !S.hopOff && (S.lift ?? 0) > 0.01) floating++; if (S.state === 'come' || S.state === 'caught') came = true; }
    res.bedtime = { phases, landed, settled, napAt, endAt, minY: +minY.toFixed(3), seat: Bn.seat, asleep, said, hopped, floating, came, end: S.state };
    res.ok = landed !== null && settled !== null && napAt === settled && endAt === settled && settled - landed > 7 && minY >= Bn.seat - 0.005 && asleep.onBench && asleep.posture > 1.9
      && ['dog-yip', 'dog-snort', 'dog-hmm', 'dog-snore'].every((n) => said.includes(n)) && hopped && floating === 0 && came && !S.onBench;
  } else if (kind === 'ground') {
    // nothing drawn over the ground it stands on along the tour (Tan: sunk into the track at the Deer Park gate, which
    // was drawn 12 cm up and never walkable): every half metre, the surface under it against the ground it uses
    const T3 = window.__scene.THREE, scn = window.__scene.scene, Wd = world;
    scn.updateMatrixWorld(true);
    const meshes = [];
    scn.traverse((o) => { if (o.isMesh && o.visible && !o.isInstancedMesh && o.name !== 'exp-highlight' && !/water|mirror|sky|cloud|fuji|hill|night|pool|glow|petal|shadow|decal/i.test(o.name)) { if (!o.geometry.boundingBox) o.geometry.computeBoundingBox(); meshes.push([o, o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld)]); } });
    const rc = new T3.Raycaster(); rc.far = 1.0;
    const pts = [];
    for (let k = 1; k < A.tour.length; k++) { const a = A.tour[k - 1], b = A.tour[k], d = Math.hypot(b.x - a.x, b.z - a.z); for (let u = 0; u < d; u += 0.5) pts.push({ x: a.x + (b.x - a.x) * u / d, z: a.z + (b.z - a.z) * u / d }); }
    const bad = [];
    for (const q of pts) {
      const c = W.nearest(q.x, q.z, 1.5); if (c < 0) continue;
      const p = W.at(c), y = W.h[c] / 100;
      const cand = meshes.filter(([, bb]) => p.x >= bb.min.x && p.x <= bb.max.x && p.z >= bb.min.z && p.z <= bb.max.z && bb.max.y > y + 0.06 && bb.min.y < y + 0.6).map(([o]) => o);
      if (!cand.length) continue;
      rc.set(new T3.Vector3(p.x, y + 0.6, p.z), new T3.Vector3(0, -1, 0));
      const h = rc.intersectObjects(cand, false)[0];
      if (h && 0.6 - h.distance > 0.06) bad.push([+p.x.toFixed(1), +p.z.toFixed(1), +(0.6 - h.distance).toFixed(2), h.object.name || '?']);
    }
    res.samples = pts.length; res.sunk = bad.length; res.first = bad.slice(0, 12);
    res.ok = bad.length === 0;
  } else if (kind === 'tipsy') {
    // the Strong Nine going to its head anywhere (the old hook): the pup napping far off, you on the main road looking
    // up it: it comes into view, to just in front of you, and hiccups, wobbles and rolls about giggling, ON the ground
    g.reset();
    const dt = 1 / 30;
    const bench = window.__scene.world.frame.toWorld({ x: 75.6, z: 103.6 });
    Object.assign(S, { x: bench.x, z: bench.z, state: 'nap', field: null, target: null });
    P.x = 0; P.z = 11; P.yaw = 0; sync();
    for (let k = 0; k < 15; k++) g.step(dt, P);
    const log = window.__scene.sound.debug.log; log.length = 0;
    g.tipsy(10);
    let tt = 0, there = null, inLens = 0, frames = 0, giggles = 0, hics = 0, seen = 0, low = 9, onBack = 0, endState = null;
    while (tt < 16) {
      g.step(dt, P); tt += dt;
      for (; seen < log.length; seen++) { if (log[seen].name === 'dog-giggle') giggles++; if (log[seen].name === 'dog-hic') hics++; }
      if (there === null && dist(P, S) < 5.5) there = +tt.toFixed(1);
      if (S.snack?.bit === 'after') { const l = g.lowest(); if (l && l.low < low) low = l.low; if (Math.abs(g.fx.out.roll) > 2) onBack++; }
      if (tt > 1 && tt < 10) { frames++; const dx = S.x - P.x, dz = S.z - P.z, d = Math.hypot(dx, dz) || 1; if (-dz / d > Math.cos(40 * Math.PI / 180)) inLens++; }
    }
    endState = S.state;
    res.tipsy = { there, giggles, hics, onBack, low: +low.toFixed(3), inLens: +(inLens / frames).toFixed(2), endState };
    res.ok = there !== null && there <= 5 && giggles >= 2 && hics >= 3 && onBack > 20 && low > -0.02 && inLens >= 0.8 && endState !== 'snack';
  } else if (kind === 'reactions') {
    /* reactions in play (Tan, 2026-10-01).  The pup waiting 5 m in front of you, you standing looking at it: it blinks
     * (now and then, never long); a head tilt within a few seconds; a yawn when it has been kept waiting; the level
     * crossing's bells starting up near it: a startle, then it gathers itself (a shake, a brave woof), all where it
     * stands, on the ground; the bells again at once: no second startle */
    g.reset();
    P.x = 0; P.z = 11; P.yaw = 0; sync();
    const c = W.nearest(0, 6, 2), q = W.at(c);
    Object.assign(S, { x: q.x, z: q.z, state: 'wait', since: 10, waitT: 0, speed: 0, target: null });
    lookAt(S.x, S.z); sync();
    const seenFx = new Set();
    let blinkF = 0, frames2 = 0, blinks = 0, wasShut = false, tilt = null, yawn = null, low = 9;
    // (no idle acts of its own in this one: what is seen is what the moment asks for)
    const tick = () => { S.idleT = Math.min(S.idleT, 0); S.tiltNext = 99; step(); for (const n of g.fx.names) seenFx.add(n); const l = g.lowest(); if (l && l.low < low) low = l.low; };
    while (t < 22) {
      tick(); frames2++;
      const shut = g.fx.out.c[2] > 0.6 && !g.fx.busy;
      if (shut) blinkF++;
      if (shut && !wasShut) blinks++;
      wasShut = shut;
      if (tilt === null && seenFx.has('headTilt')) tilt = +t.toFixed(1);
      if (yawn === null && seenFx.has('yawn')) yawn = +t.toFixed(1);
    }
    // the bells
    for (let k = 0; k < 200 && (g.fx.busy || S.act); k++) tick();
    const at0 = { x: S.x, z: S.z };
    g.bells.on = false; tick();                // (whatever the real crossing is doing)
    seenFx.clear();
    Object.assign(g.bells, { on: true, x: S.x + 10, z: S.z });
    tick();
    const startled = g.fx.names.includes('startle');
    let maxUp = 0, tCalm = null;
    const t1 = t;
    while (t - t1 < 9) { tick(); maxUp = Math.max(maxUp, g.fx.out.dy); if (tCalm === null && !g.fx.busy) tCalm = +(t - t1).toFixed(1); }
    const chain = ['startle', 'scared', 'shakeOff', 'brave'].filter((n) => seenFx.has(n));
    g.bells.on = false; tick(); seenFx.clear(); g.bells.on = true; tick();
    const again = g.fx.names.includes('startle');
    g.bells.on = false;
    res.reactions = { blinks, blinkShare: +(blinkF / frames2).toFixed(3), tilt, yawn, startled, chain, maxUp: +maxUp.toFixed(3), tCalm, again, moved: +dist(at0, S).toFixed(2), low: +low.toFixed(3), state: S.state };
    res.ok = blinks >= 2 && blinkF / frames2 < 0.1 && tilt !== null && tilt < 9 && yawn !== null && yawn < 16 && startled && chain.length === 4 && maxUp > 0.03
      && tCalm !== null && tCalm < 6 && !again && dist(at0, S) < 0.5 && low > -0.02 && S.state === 'wait';
  } else if (kind === 'snack') {
    /* the konbini (Tan, 2026-10-01): you come out with something: Hachi sits out in front of where you eat, in your
     * view, begging; does the product's own bit while you eat and after; ON the ground throughout; then the tour goes on */
    const ids = ['strong_nine', 'sando_egg', 'fruit_sando', 'onigiri_tuna', 'choco_wafer_jumbo'];
    const EAT = { x: -2.3, z: A.snack.eatZ };
    const out = {};
    let all = true;
    const log = window.__scene.sound.debug.log;
    for (const id of ids) {
      g.reset();
      P.x = EAT.x; P.z = EAT.z; P.yaw = Math.PI; sync();                    // (looking out over the road, +z)
      for (let k = 0; k < 10; k++) g.step(dt, P);
      const c = W.nearest(EAT.x + 9, EAT.z + 3, 3), q = W.at(c);
      Object.assign(S, { x: q.x, z: q.z, state: 'wait', since: 10, target: null });
      log.length = 0;
      let low = 9, high = 0, inLens = 0, frames2 = 0, begged = false, tt = 0;
      const run = (secs, bit) => {
        for (let k = 0; k < secs * 30; k++) {
          g.step(dt, P); tt += dt;
          if (bit) {
            const l = g.lowest(); if (l) { low = Math.min(low, l.low); high = Math.max(high, l.low); }
            frames2++; const dx = S.x - P.x, dz = S.z - P.z, d = Math.hypot(dx, dz) || 1; if (dz / d > Math.cos(30 * Math.PI / 180)) inLens++;
          }
          if (g.fx.names.includes('puppyEyes') || g.fx.names.includes('beg')) begged = true;
          if (S.state !== 'snack') return false;
        }
        return true;
      };
      g.snack('hold', id);
      run(4.5, false);
      const dSit = +dist(P, S).toFixed(1), sat = S.posture > 0.8;
      g.snack('eat', id);
      run(3.5, true);
      const eatBit = g.fx.names.includes('eat');
      g.snack('done', id);
      let afterT = 0;
      while (afterT < 14 && run(dt, true)) afterT += dt;
      const said = [...new Set(log.map((e) => e.name).filter((n) => /^dog-/.test(n ?? '')))].sort();
      const r = { dSit, sat, begged, eatBit, afterS: +afterT.toFixed(1), low: +low.toFixed(3), hop: +high.toFixed(3), inLens: +(inLens / Math.max(1, frames2)).toFixed(2), said, end: S.state };
      r.ok = dSit > 3.8 && dSit < 5.6 && sat && begged && eatBit && afterT > 3 && afterT < 11 && low > -0.02 && r.inLens > 0.95 && said.length >= 3 && S.state !== 'snack';
      if (!r.ok) all = false;
      out[id] = r;
    }
    // each bit its own: no two with the same voice
    const voices = new Set(Object.values(out).map((r) => r.said.join()));
    res.snack = out; res.distinct = voices.size;
    res.ok = all && voices.size === ids.length;
  } else if (kind === 'after') {
    /* after the tour (Tan, 2026-10-01: "he goes back to the gate bench to sleep even when whistled.  Make him stay
     * interactive"): asleep on its bench (onNap once), whistled: it comes and STAYS (never straight back to bed): at
     * your side on a walk, sat in front of you when you stop, the tour on offer when you look at it.  E by it
     * (not a second whistle: that only brings it): the tour again, from the first place, everything to do again; and onNap fires again when that one is over.
     * Left alone instead: back to its bench. */
    g.reset();
    const Bn = g.bench;
    const fx = Bn.nap.x - Bn.x, fz = Bn.nap.z - Bn.z, fl = Math.hypot(fx, fz), F = { x: fx / fl, z: fz / fl };
    let naps = 0;
    const tick = () => { const was = !!S.napped; step(); if (S.napped && !was) naps++; };
    const toSleep = () => { for (let k = 0; k < 60 * 30 && S.bed?.phase !== 'sleep'; k++) tick(); return S.bed?.phase === 'sleep'; };
    P.x = Bn.x + F.x * 5; P.z = Bn.z + F.z * 5; lookAt(Bn.x, Bn.z); sync();
    { const c = W.nearest(Bn.nap.x + F.x * 2, Bn.nap.z + F.z * 2, 3), q = W.at(c); Object.assign(S, { x: q.x, z: q.z }); }
    g.napNow();
    const slept = toSleep(), eyesShut0 = (() => { P.x += F.x * 2; P.z += F.z * 2; for (let k = 0; k < 30; k++) tick(); return g.fx.out.c[2]; })();
    const naps1 = naps;
    g.whistle();
    let pal = null, bedAgain = false;
    { const t0 = t; while (t - t0 < 20) { tick(); if (pal === null && S.state === 'pal') pal = +(t - t0).toFixed(1); } }
    // it stays: half a minute standing with it
    { const t0 = t; while (t - t0 < 30) { tick(); if (S.state === 'nap') bedAgain = true; } }
    const stays = S.state === 'pal';
    // a walk together: back along the bridge road
    let far = 0, lost = false;
    { const goal = { x: -30, z: 30 }; const t0 = t; while (t - t0 < 14) { lookAt(goal.x, goal.z); walk(goal, 2.3); tick(); if (t - t0 > 3 && dist(P, S) > far) { far = dist(P, S); res.farAt = { t: +(t - t0).toFixed(1), x: +S.x.toFixed(1), z: +S.z.toFixed(1), px: +P.x.toFixed(1), pz: +P.z.toFixed(1), speed: +S.speed.toFixed(1), jump: !!S.jump, r: S.r, level: !!S.levelTo, act: S.act?.name ?? null }; } if (S.state !== 'pal') lost = true; } }
    // you stop and look for it: it comes round in front and sits; looked at, the tour is on offer
    let satUp = 0;
    { const t0 = t; while (t - t0 < 6) { tick(); satUp = Math.max(satUp, S.posture); } }
    const dx = S.x - P.x, dz = S.z - P.z, fwd = { x: -Math.sin(P.yaw), z: -Math.cos(P.yaw) };
    const front = (dx * fwd.x + dz * fwd.z) / (Math.hypot(dx, dz) || 1);
    const sits = { d: +dist(P, S).toFixed(1), posture: +satUp.toFixed(1), frontDeg: +(Math.acos(Math.max(-1, Math.min(1, front))) * 180 / Math.PI).toFixed(0) };
    lookAt(S.x, S.z); sync(); tick();
    const offer = g.offer();
    P.yaw += Math.PI; sync(); tick();
    const offerAway = g.offer();
    P.yaw -= Math.PI; sync(); tick();
    // a second whistle only brings it to you (it stays yours); the tour again is asked for (E: g.again)
    g.whistle();
    let whistled2 = 'pal';
    { const t0 = t; while (t - t0 < 7) { tick(); if (S.state === 'lead' || S.state === 'nap') whistled2 = S.state; } }
    whistled2 = whistled2 === 'pal' ? S.state : whistled2;
    g.again();
    let again = null;
    { const t0 = t; while (t - t0 < 6) { tick(); if (again === null && S.state === 'lead') again = { t: +(t - t0).toFixed(1), target: S.target?.id ?? null, leg: S.leg, done: [...S.done], napped: !!S.napped, gate: !!S.gateDone, visited: [...g.tour.visited] }; } }
    // ...and that tour over: its bedtime and the postcard's hook again
    g.napNow(); P.x = Bn.x + F.x * 5; P.z = Bn.z + F.z * 5; lookAt(Bn.x, Bn.z); sync();
    const slept2 = toSleep();
    const naps2 = naps;
    // whistled once more, then left alone: back to its bench (and no third postcard)
    g.whistle();
    { const t0 = t; while (t - t0 < 20 && S.state !== 'pal') tick(); }
    const pal2 = S.state === 'pal';
    P.x = Bn.x + F.x * 30; P.z = Bn.z + F.z * 30; sync();
    let leftT = null;
    { const t0 = t; while (t - t0 < 70) { tick(); if (leftT === null && S.state === 'nap') leftT = +(t - t0).toFixed(1); if (S.bed?.phase === 'sleep') break; } }
    res.after = { slept, eyesShut0: +eyesShut0.toFixed(2), naps1, pal, bedAgain, stays, far: +far.toFixed(1), lost, sits, offer, offerAway, whistled2, again, slept2, naps2, pal2, leftT, back: S.bed?.phase ?? S.state, naps3: naps };
    res.ok = slept && eyesShut0 > 0.9 && naps1 === 1 && pal !== null && pal < 12 && !bedAgain && stays && far < 8 && !lost && sits.d < 6.5 && sits.posture > 0.8 && sits.frontDeg < 50
      && offer && !offerAway && whistled2 === 'pal' && !!again && again.target === 'konbini' && again.done.length === 1 && again.visited.length === 0 && !again.napped && !again.gate && slept2 && naps2 === 2 && pal2
      && leftT !== null && leftT > 15 && leftT < 40 && S.bed?.phase === 'sleep' && naps === 2;
  }
  if (!res.surface) { SF.on = false; res.surface = surfRes(); if (res.surface.under || res.surface.over || res.surface.inside || res.surface.snaps) res.ok = false; }
  res.viol = viol; res.wall = wall; res.gridMs = +W.ms.toFixed(0); res.cells = W.N; res.msPerStep = +(fieldMs / Math.max(1, Math.round(t * 30))).toFixed(3);
  return res;
};

let bad = 0;
try {
  if (PHONE) {
    await page.goto(`${base}m.html?keepcpu`);   // (the surface check raycasts the town's batches: their CPU copies kept)
    await page.waitForFunction(() => window.__m && window.__guide, null, { timeout: 240000, polling: 500 });
    await page.evaluate(() => { window.__scene = window.__m; });
  } else {
    await page.goto(`${base}?shots`);
    await page.waitForFunction(() => window.__ready === true, null, { timeout: 150000, polling: 250 });
  }

  if (MEASURE) {
    const res = await page.evaluate(async () => {
      const { renderer } = window.__scene;
      const spots = {
        hero1: { hero: 'morning', look: 'day' },
        door: { look: 'day', pos: [-2.3, 0, 6.2], yaw: 0, pitch: 0.1, guide: 'sit' },                                  // outside NIPPON's door, the pup sat by the ring
        han: { look: 'day', frame: 'core', pos: [18.2, 0, 4.2], yaw: -1.5708, pitch: 0.05, guide: 'sit' },             // the car park, by Han's spot
        bench: { look: 'day', frame: 'core', pos: [70.5, 0, 103.5], yaw: 1.5708, pitch: 0.1, guide: 'nap' },           // the slow-life bench
      };
      const res = {};
      for (const [k, o] of Object.entries(spots)) {
        const g = o.guide; delete o.guide;
        const r = await window.__shot('m', 2560, 1440, { ...o, ...(window.__guide ? { guide: g } : {}), returnData: false, png: false, scale: 1.5, time: 20 });
        res[k] = { calls: r.mainCalls, tris: Math.round(r.mainTriangles / 1000) + 'k', ms: +r.ms.toFixed(2) };
      }
      const geo = window.__scene.scene.getObjectByName('animals-shiba')?.geometry;
      res.dog = geo ? { tris: geo.index.count / 3, verts: geo.attributes.position.count } : null;
      res.gpu = { textures: renderer.info.memory.textures, geometries: renderer.info.memory.geometries };
      return res;
    });
    await (await page.context().newCDPSession(page)).send('HeapProfiler.collectGarbage');
    res.heapMB = await page.evaluate(() => +(performance.memory.usedJSHeapSize / 1048576).toFixed(0));
    console.log(JSON.stringify(res, null, 1));
  } else {
    /* its voice (Tan: "very cute, adorable sounds"): each dog-* recipe, and your whistle, really comes out, at the listener */
    await page.mouse.click(800, 450);
    await page.waitForFunction(() => window.__scene.sound.debug.ac?.state === 'running', null, { timeout: 20000 }).catch(() => {});
    const voice = await page.evaluate(async () => {
      const snd = window.__scene.sound, dbg = snd.debug;
      if (!dbg.ac || dbg.ac.state !== 'running') return { error: 'no sound running' };
      // the engine really putting sound out before the first measure (it was 0 on a slow start)
      for (let k = 0; k < 20 && (await dbg.level(250)).peak < 0.001; k++) await new Promise((r) => setTimeout(r, 250));
      const out = {};
      for (const n of ['dog-yip', 'dog-boof', 'dog-whine', 'dog-hmm', 'dog-pant', 'dog-shake', 'dog-snore', 'dog-awoo', 'dog-snort', 'dog-sneeze', 'dog-giggle', 'dog-yawn', 'dog-tip', 'dog-yelp', 'dog-sniff', 'dog-hic', 'dog-lick', 'dog-munch', 'whistle']) {
        await new Promise((r) => setTimeout(r, 900));
        // the town's own sound varies: its level is the median of three short reads
        const bs = [(await dbg.level(200)).peak, (await dbg.level(200)).peak, (await dbg.level(200)).peak].sort((a, b) => a - b);
        const before = { peak: bs[1] };
        snd.oneShot(n, { gain: 0.7, recipe: n });
        const during = await dbg.level(700);
        out[n] = { before: +before.peak.toFixed(3), peak: +during.peak.toFixed(3) };
      }
      dbg.log.length = 0;
      return out;
    });
    const loud = voice.error ? false : Object.values(voice).every((v) => v.peak > 0.01 && v.peak > v.before * 1.4 && v.peak - v.before > 0.005);
    if (!loud) bad++;
    console.log(loud ? 'pass' : 'FAIL', 'voice', JSON.stringify(voice));

    for (const kind of ['tour', 'route', 'crossing', 'intro', 'turnaway', 'wander', 'whistle', 'bedtime', 'tipsy', 'reactions', 'snack', 'after', 'ground'].filter((k) => !ONLY || ONLY.split(',').includes(k))) {
      const r = await page.evaluate(SIM, [kind, PHONE]);
      if (r.map) { fs.writeFileSync(path.join(out, 'trail.png'), Buffer.from(r.map.split(',')[1], 'base64')); delete r.map; }
      if (r.surface) { fs.writeFileSync(path.join(out, `surface-${kind}.json`), JSON.stringify(r.surface)); for (const k of ['firstUnder', 'firstOver', 'firstInside']) r.surface[k] = r.surface[k].slice(0, 6); }
      const said = await page.evaluate(() => { const l = [...new Set(window.__scene.sound.debug.log.map((e) => e.name).filter((n) => /^dog-|^whistle/.test(n ?? '')))]; window.__scene.sound.debug.log.length = 0; return l; });
      r.said = said;
      if (kind === 'tour' && said.length < 2) r.ok = false;
      if (!r.ok) bad++;
      console.log(r.ok ? 'pass' : 'FAIL', kind, JSON.stringify(r, null, 1));
    }
  }
} finally {
  if (errs.length) { console.log('page errors:'); for (const e of errs.slice(0, 10)) console.log('  ', e); }
  await close();
}
if (bad || errs.length) process.exitCode = 1;
