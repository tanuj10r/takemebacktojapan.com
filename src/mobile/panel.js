import { GUIDE } from '../world/animals/guide.js';
import { MOBILE_STRINGS as M } from '../data/strings.js';
import { TUNE } from './controls/tune.js';

/* ------------------------------------------------------------------ *
 * The portrait phone (Tan, 2026-10-03: "top 75 percent of the screen has the visuals and bottom 25% has controls
 * and rules"; the phone is a glimpse, the desktop the whole of it).  The town fills the top three quarters
 * (m.html body.pui sizes the canvas); this panel is the bottom quarter:
 *
 *   the guide line   what is happening and what is next: where Hachi is heading, stop k of n; at a place, its
 *                    name and a line about it
 *   the stick        two thumbs (Tan's pick, 2026-10-03): a fixed stick in the panel; a thumb on it walks you on,
 *                    slid up faster, pulled down slower then back, across a sidestep; drag the picture to look
 *   the action       one big button: what can be done here ("Order a mochi ¥200", "Sit a while"), else
 *                    "Walk with Hachi": you walk behind him, along his way, and only look
 *   Hachi, Pause
 *
 * Walk with Hachi follows his trail (the points he has passed, the farthest still in plain sight), keeps a couple
 * of metres behind him, walks into the ring where he waits, and stops there; any control stops it.
 * ------------------------------------------------------------------ */


export function createPanel({ player, world, hud, act, whistle, pause, spots, camera }) {
  const P = M.panel;

  const style = document.createElement('style');
  style.textContent = `
  .pp { position: fixed; left: 0; right: 0; top: var(--view-h); height: var(--pp-h); z-index: 6; display: grid; grid-template-rows: 46px minmax(0, 1fr) 13px; gap: 6px;
    padding: 8px max(12px, var(--safe-r)) calc(var(--safe-b) + 5px) max(12px, var(--safe-l)); box-sizing: border-box;
    background: #fbf6f0; border-top: 3px solid #e59bb0; color: #2b2542; font-family: var(--ui); touch-action: none; }
  .pp-foot { margin: 0; text-align: center; font-size: 10.5px; line-height: 13px; font-weight: 600; letter-spacing: .03em; color: #9a90ab; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .pp-foot b { color: #7d6f95; font-weight: 700; }
  body.game-paused .pp { pointer-events: none; }
  body.pui #hachi-card.pp-up, body.pui .look-hint.pp-up, body.pui .train-wait.pp-up { top: calc(var(--safe-t, 0px) + 164px) !important; bottom: auto !important; translate: none; }
  .pp-rule { display: flex; align-items: center; gap: 10px; min-height: 0; overflow: hidden; padding: 6px 12px; border-radius: 12px; background: #f3ebe4; }
  .pp-rule svg { flex: none; width: 20px; height: 20px; color: #b98ab4; }
  .pp-rule b { display: block; font-size: 13.5px; line-height: 1.2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .pp-rule small { display: block; margin-top: 2px; font-size: 11.5px; line-height: 1.25; color: #6c6482; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .pp-rule > div { min-width: 0; }
  .pp-row { min-height: 0; display: flex; align-items: center; gap: 10px; }
  .pp-left { flex: none; width: 116px; height: 116px; position: relative; }
  /* (a stray line above this rule had it dropped, Tan's phone showed the button's default look and width: that look,
   * light with a pink ring, kept; now it takes the row's free width) */
  .pp-act { flex: 1; min-width: 0; height: 66px; border: 0; border-radius: 16px; background: #efeaef; color: #2b2542; display: flex; align-items: center; gap: 8px;
    padding: 0 10px 0 8px; text-align: left; box-shadow: 0 0 0 3px rgba(255,214,87,.95), inset 0 -3px 0 rgba(43,37,66,.12); touch-action: manipulation; }
  .pp-act.follow { box-shadow: 0 0 0 3px rgba(229,155,176,.95), inset 0 -3px 0 rgba(43,37,66,.12); }
  .pp-act.on { background: #3b3263; color: #fff; }
  .pp-act.down { transform: scale(.97); }
  .pp-act i { flex: none; width: 38px; height: 38px; border-radius: 50%; background: #ffdd57; color: #2b2542; display: grid; place-items: center; }
  .pp-act i svg { width: 22px; height: 22px; }
  .pp-act span { min-width: 0; font-weight: 700; font-size: 14px; line-height: 1.15; overflow: hidden; }
  .pp-act small { display: block; margin-top: 2px; font-weight: 600; font-size: 11px; opacity: .72; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .pp-side { flex: none; display: flex; flex-direction: column; gap: 8px; }
  .pp-side button { width: 60px; height: 50px; border: 0; border-radius: 12px; background: #fff; color: #2b2542; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;
    box-shadow: 0 0 0 1px #e3d9e0, 0 2px 6px rgba(20,12,40,.12); touch-action: manipulation; }
  .pp-side svg { width: 18px; height: 18px; }
  .pp-side small { font-size: 9.5px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
  `;
  document.head.appendChild(style);

  const PAW = '<svg viewBox="0 0 24 24" fill="currentColor"><ellipse cx="7" cy="9" rx="2.2" ry="2.8"/><ellipse cx="12" cy="6.5" rx="2.2" ry="2.8"/><ellipse cx="17" cy="9" rx="2.2" ry="2.8"/><path d="M12 11.5c-3.2 0-6 3.6-6 6.1 0 1.6 1.3 2.4 3 2.4 1.2 0 2-.6 3-.6s1.8.6 3 .6c1.7 0 3-.8 3-2.4 0-2.5-2.8-6.1-6-6.1z"/></svg>';
  const HAND = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V12M11 11V4.5a1.5 1.5 0 0 1 3 0V12M14 11.5V6a1.5 1.5 0 0 1 3 0v8a6 6 0 0 1-6 6h-1a6 6 0 0 1-4.6-2.2L3.6 15a1.5 1.5 0 0 1 2.3-1.9L8 15"/></svg>';
  const PAUSE = '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>';
  const el = document.createElement('div');
  el.className = 'pp';
  el.innerHTML = `
    <div class="pp-rule">${PAW}<div><b></b><small></small></div></div>
    <div class="pp-row">
      <div class="pp-left"></div>
      <button class="pp-act" type="button"><i></i><span></span></button>
      <div class="pp-side">
        <button type="button" data-p="hachi" aria-label="${M.aria.hachi}">${PAW}<small>${M.buttons.hachi}</small></button>
        <button type="button" data-p="pause" aria-label="${M.aria.pause}">${PAUSE}<small>${M.buttons.pause}</small></button>
      </div>
    </div>
    <p class="pp-foot">${P.desktopFoot}</p>`;
  document.body.appendChild(el);
  const ruleB = el.querySelector('.pp-rule b'), ruleS = el.querySelector('.pp-rule small');
  const left = el.querySelector('.pp-left'), actBtn = el.querySelector('.pp-act'), actI = actBtn.querySelector('i'), actS = actBtn.querySelector('span');

  /* ---- the stick (Tan, 2026-10-03: two thumbs; "pressing on the toggle makes the user walk, sliding the toggle up
   * increases speed"): touch.js's own stick, fixed in the panel's left square.  A thumb on it walks you on; slid up,
   * faster, into a run; pulled down, slower, then back; across, a sidestep.  A drag on the picture looks. ---- */
  function build() {
    /* the home-screen app (iOS, black-translucent status bar): 100dvh is the screen less the status bar there, and the
     * page is drawn under the bar too, so a panel set by it left a band at the foot; the screen's own height instead */
    const standalone = navigator.standalone || matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches;
    document.documentElement.style.setProperty('--app-h', standalone ? `${Math.max(innerHeight, Math.max(screen.width, screen.height))}px` : '100dvh');
    const S = TUNE.stick;
    Object.assign(S, { off: false, side: 'left', fixed: true, steer: false, pressWalk: true, restAbs: true, runAfter: 0.28 });
    left.className = 'pp-left';
    left.innerHTML = '';
    const r = left.getBoundingClientRect();
    S.rest = [r.left + r.width / 2, innerHeight - (r.top + r.height / 2)];
    api.onScheme?.();
  }

  /* ---- Walk with Hachi (Tan, 2026-10-04) ----
   * It stays on through the tour: into the ring where he waits, stood there while he does (the place's own action
   * on the button), and after him again when he goes on.  A drag looks about and it goes on; a thumb held on the
   * stick, or slid up, keeps it and quickens the pace; pulled back or across, the walk is yours again.  The way is
   * his trail (the farthest point of it in plain sight, with room for your shoulders); with no headway for 2 s you
   * are put down a couple of metres behind him (a blink). */
  let following = false;
  const crumbs = [], stuck = { t: 0, x: 0, z: 0 };
  /* at a stop, done (Tan: "when you complete an experience, Hachi doesn't automatically move on"): he lingers until you
   * come away, so with the follow on, he is told to go on once the place has been had: the konbini or the bench a
   * moment after your visit or your sit ends, the platform once a train has stood there and gone, anywhere else after
   * a short pause */
  const at = { id: null, t: 0, busy: false, free: 0, dwelt: false };
  function stopDone(id, dt) {
    if (at.id !== id) Object.assign(at, { id, t: 0, busy: false, free: 0, dwelt: false });
    at.t += dt;
    const busy = player.scripted || player.suspended || !!player.seat || !!world.lawson?.shop?.visiting;
    if (busy) { at.busy = true; at.free = 0; } else at.free += dt;
    if (id === 'train') {
      const runs = (world.line?.local ?? world.line)?.service?.runs ?? [];
      if (runs.some((r) => r.phase === 'dwell')) at.dwelt = true;
      return at.dwelt && !runs.some((r) => ['dwell', 'opening', 'closing', 'hold'].includes(r.phase)) && at.free > 1;
    }
    if (id === 'konbini' || id === 'slowlife') return at.busy && at.free > 2;
    return at.t > 4 && !busy;
  }
  function follow(on) {
    if (on === following) return;
    following = on;
    crumbs.length = 0;
    stuck.t = 0;
    if (!on) player.steer = null;
  }
  const angle = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  /** In plain sight on his walk, with room for you: the middle line and one either side, 0.3 m out. */
  const clear = (W, a, b) => {
    if (!W.sight(a.x, a.z, b.x, b.z)) return false;
    const L = dist(a, b) || 1, nx = -(b.z - a.z) / L * 0.3, nz = (b.x - a.x) / L * 0.3;
    return W.sight(a.x + nx, a.z + nz, b.x + nx, b.z + nz) && W.sight(a.x - nx, a.z - nz, b.x - nx, b.z - nz);
  };
  const view = document.getElementById('view');
  function catchUp(h, W) {
    const p = player.pos, d = dist(h, p) || 1;
    const c = W.nearest(h.x + (p.x - h.x) / d * 2.2, h.z + (p.z - h.z) / d * 2.2, 3);
    if (c < 0) return;
    const q = W.at(c);
    if (view) { view.style.transition = 'opacity .16s ease'; view.style.opacity = '0.15'; setTimeout(() => { view.style.opacity = ''; }, 200); }
    player.pos.set(q.x, world.heightAt?.(q.x, q.z) ?? p.y, q.z);
    player.vel.set(0, 0, 0);
    player.yaw = Math.atan2(-(h.x - q.x), -(h.z - q.z));
    crumbs.length = 0;
  }
  function followStep(dt) {
    const h = GUIDE.where?.(), W = GUIDE.walk, info = GUIDE.tourInfo?.();
    const rest = () => { player.steer = null; stuck.t = 0; };
    // (a visit or a sit is noted as it happens: the steps below stand aside while it plays)
    if (following && info?.target?.id && (player.scripted || player.suspended || player.seat || world.lawson?.shop?.visiting)) {
      if (at.id !== info.target.id) Object.assign(at, { id: info.target.id, t: 0, busy: false, free: 0, dwelt: false });
      at.busy = true; at.free = 0;
    }
    if (!following || !h || !W || !player.locked || player.suspended || player.scripted) { rest(); return; }
    const p = player.pos;
    // sat on the bench: up again once he goes on
    if (player.seat) { if (info?.state === 'lead' && dist(h, p) > 4) player.stand?.(); rest(); return; }
    // the stick: held still or slid up, the follow goes on (quicker); pulled back or across, the walk is yours
    if (player.stick?.held && (TUNE.stick.pressBase - player.stick.y < 0.2 || Math.abs(player.stick.x) > 0.55)) { follow(false); return; }
    const last = crumbs[crumbs.length - 1];
    if (!last || dist(h, last) > 0.6) { crumbs.push({ x: h.x, z: h.z }); if (crumbs.length > 160) crumbs.shift(); }
    // he waits at a place: into its ring, and stay there while he does
    const waiting = info && (info.state === 'atSpot' || info.state === 'invite' || info.state === 'linger') && info.target;
    let goal = null;
    if (waiting) {
      const t = info.target;
      if (info.state === 'linger' && stopDone(t.id, dt)) { GUIDE.moveOn?.(); rest(); return; }
      if (dist(t, p) < 0.8) { rest(); return; }
      goal = clear(W, p, t) ? t : null;
    }
    if (!goal) {
      // (a couple of metres behind him; up to him while he waits for you to set off or to catch up, which is what
      // starts him again: he and you stood waiting for each other)
      if (dist(h, p) < (['ready', 'wait', 'home', 'intro'].includes(info?.state) ? 1.0 : 2.4)) { rest(); return; }
      while (crumbs.length > 1 && dist(crumbs[0], p) < 0.7) crumbs.shift();
      goal = crumbs[0];
      for (let i = crumbs.length - 1; i > 0; i--) if (clear(W, p, crumbs[i])) { goal = crumbs[i]; break; }
    }
    if (!goal) { rest(); return; }
    // no headway (a corner his walk takes and your shoulders don't): put down behind him
    if (dist(p, stuck) > 0.5) { stuck.x = p.x; stuck.z = p.z; stuck.t = 0; } else if ((stuck.t += dt) > 2) { catchUp(h, W); stuck.t = 0; return; }
    const dx = goal.x - p.x, dz = goal.z - p.z, L = Math.hypot(dx, dz) || 1;
    player.steer = { x: dx / L, z: dz / L, slow: 1 };
    // (the view turns the way you go, unless you have looked about in the last 3 s)
    if (performance.now() - (player.lookedAt ?? 0) > 3000) player.yaw += angle(Math.atan2(-dx, -dz) - player.yaw) * (1 - Math.exp(-dt * 2.2));
  }

  /* ---- the action and the guide line ---- */
  let actMode = null;
  actBtn.addEventListener('click', () => {
    if (actMode === 'act') act();          // (the follow goes on after it: Tan, 2026-10-04)
    else if (actMode === 'follow') follow(!following);
  });
  actBtn.addEventListener('pointerdown', () => actBtn.classList.add('down'));
  for (const e of ['pointerup', 'pointercancel', 'pointerleave']) actBtn.addEventListener(e, () => actBtn.classList.remove('down'));
  el.querySelector('[data-p="hachi"]').addEventListener('click', () => whistle());
  el.querySelector('[data-p="pause"]').addEventListener('click', () => { follow(false); pause(); });

  const name = (id) => P.places[id]?.[0] ?? null;
  let lastRule = '';
  function rule(dt) {
    const info = GUIDE.tourInfo?.();
    const p = player.pos;
    // at a place: its name and a line about it
    let here = null, hd = 7;
    for (const s of spots()) { const d = Math.hypot(s.x - p.x, s.z - p.z); if (d < hd && P.places[s.id]) { hd = d; here = s; } }
    let b, sm;
    if (here) { [b, sm] = P.places[here.id]; }
    else if (info?.over) { b = P.overTitle; sm = P.overLine; }
    else if (info?.next) { b = P.heading(name(info.next) ?? P.next); sm = P.stop(Math.min(info.had + 1, info.of), info.of); }
    else { b = P.idleTitle; sm = P.idleLine; }
    const k = b + '|' + sm;
    if (k !== lastRule) { lastRule = k; ruleB.textContent = b; ruleS.textContent = sm; }
    void dt;
  }

  /* ---- nothing over Hachi (Tan, 2026-10-03: "the intro message is covering Hachi"): his hello card and the hints
   * sit just above the panel; while one of them would cover him (the pup's box on screen, a margin round it) it
   * moves to the top of the picture, under the map and the sound chip, and stays there until it goes (a quarter second
   * of overlap first: not for the pup passing behind it) ---- */
  const _a = camera ? camera.position.clone() : null, _b = _a?.clone();
  const over = new Map();
  function clearOfHachi(dt) {
    if (!camera) return;
    const h = GUIDE.where?.(), cv = document.getElementById('view')?.getBoundingClientRect();
    let box = null;
    if (h && cv) {
      _a.set(h.x, h.y, h.z).project(camera); _b.set(h.x, h.y + 0.62, h.z).project(camera);
      if (_a.z < 1 && _b.z < 1) {
        const x = cv.left + (_a.x + 1) / 2 * cv.width, y0 = cv.top + (1 - _b.y) / 2 * cv.height, y1 = cv.top + (1 - _a.y) / 2 * cv.height;
        const r = Math.max(24, (y1 - y0) * 0.75);
        if (y1 > cv.top && y0 < cv.bottom) box = [x - r, y0 - 10, x + r, y1 + 10];
      }
    }
    for (const q of [document.getElementById('hachi-card'), document.querySelector('.look-hint'), document.querySelector('.train-wait')]) {
      if (!q) continue;
      const shown = q.classList.contains('look-hint') ? q.classList.contains('show') && !q.classList.contains('used') : q.style.opacity === '1';
      // (moved up, it stays there through its fade, 0.7 s: it slid back over him as it went)
      if (!shown) { if (q.classList.contains('pp-up') && (q.__gone ??= performance.now()) < performance.now() - 700) { q.classList.remove('pp-up'); q.__gone = null; } over.delete(q); continue; }
      q.__gone = null;
      if (q.classList.contains('pp-up')) continue;
      const r = q.getBoundingClientRect();
      const hit = !!box && r.left < box[2] && r.right > box[0] && r.top < box[3] && r.bottom > box[1];
      const t = hit ? (over.get(q) ?? 0) + dt : 0;
      over.set(q, t);
      if (t > 0.25) q.classList.add('pp-up');
    }
  }

  const api = {
    get following() { return following; },
    follow,
    onScheme: null,
    /** each frame: `action` the words of what can be done here (or null) */
    update(dt, action) {
      followStep(dt);
      rule(dt);
      clearOfHachi(dt);
      const mode = action ? 'act' : 'follow';
      const words = action ?? (following ? P.stopFollowing : P.walkWithHachi);
      const sub = action ? '' : following ? P.followingSub : P.walkSub;
      const k = mode + words + sub;
      if (k !== actMode + actS.dataset.k) {
        actMode = mode;
        actS.dataset.k = words + sub;
        actI.innerHTML = action ? HAND : PAW;
        actS.innerHTML = '';
        actS.append(words);
        if (sub) { const s = document.createElement('small'); s.textContent = sub; actS.append(s); }
        actBtn.classList.toggle('follow', !action);
        actBtn.classList.toggle('on', !action && following);      // (walking with him: the button lit)
      }
    },
    /** any look or walk of yours stops the follow */
    stopFollow() { follow(false); },
    resize() { build(); },
    el,
  };
  build();
  return api;
}
