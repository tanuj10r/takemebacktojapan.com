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


export function createPanel({ player, world, hud, act, whistle, pause, spots }) {
  const P = M.panel;

  const style = document.createElement('style');
  style.textContent = `
  .pp { position: fixed; left: 0; right: 0; bottom: 0; height: 25dvh; z-index: 6; display: flex; flex-direction: column; gap: 1.2dvh;
    padding: 1.1dvh max(12px, var(--safe-l)) max(1.4dvh, calc(var(--safe-b) + 2px)) max(12px, var(--safe-r));
    background: #fbf6f0; border-top: 3px solid #e59bb0; color: #2b2542; font-family: var(--ui); touch-action: none; }
  body.game-paused .pp { pointer-events: none; }
  .pp-rule { display: flex; align-items: center; gap: 10px; min-height: 0; padding: 7px 12px; border-radius: 12px; background: #f3ebe4; }
  .pp-rule svg { flex: none; width: 20px; height: 20px; color: #b98ab4; }
  .pp-rule b { display: block; font-size: 13.5px; line-height: 1.2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .pp-rule small { display: block; margin-top: 2px; font-size: 11.5px; line-height: 1.25; color: #6c6482; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .pp-rule > div { min-width: 0; }
  .pp-row { flex: 1; min-height: 0; display: flex; align-items: center; gap: 12px; }
  .pp-left { flex: none; width: 112px; height: 112px; position: relative; }
    display: grid; place-items: center; box-shadow: inset 0 -3px 0 rgba(0,0,0,.25); touch-action: none; }
  .pp-act { flex: 1; min-width: 0; height: 64px; border: 0; border-radius: 18px; background: #3b3263; color: #fff; display: flex; align-items: center; gap: 10px;
    padding: 0 10px 0 8px; text-align: left; box-shadow: 0 0 0 3px rgba(255,221,87,.9), inset 0 -3px 0 rgba(0,0,0,.25); touch-action: manipulation; }
  .pp-act.follow { box-shadow: 0 0 0 3px rgba(229,155,176,.9), inset 0 -3px 0 rgba(0,0,0,.25); }
  .pp-act.down { transform: scale(.97); }
  .pp-act i { flex: none; width: 44px; height: 44px; border-radius: 50%; background: #ffdd57; color: #2b2542; display: grid; place-items: center; }
  .pp-act i svg { width: 24px; height: 24px; }
  .pp-act span { min-width: 0; font-weight: 700; font-size: 14.5px; line-height: 1.15; }
  .pp-act small { display: block; margin-top: 2px; font-weight: 600; font-size: 11px; opacity: .75; }
  .pp-side { flex: none; display: flex; flex-direction: column; gap: 8px; }
  .pp-side button { width: 56px; height: 46px; border: 0; border-radius: 12px; background: #fff; color: #2b2542; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;
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
    </div>`;
  document.body.appendChild(el);
  const ruleB = el.querySelector('.pp-rule b'), ruleS = el.querySelector('.pp-rule small');
  const left = el.querySelector('.pp-left'), actBtn = el.querySelector('.pp-act'), actI = actBtn.querySelector('i'), actS = actBtn.querySelector('span');

  /* ---- the stick (Tan, 2026-10-03: two thumbs; "pressing on the toggle makes the user walk, sliding the toggle up
   * increases speed"): touch.js's own stick, fixed in the panel's left square.  A thumb on it walks you on; slid up,
   * faster, into a run; pulled down, slower, then back; across, a sidestep.  A drag on the picture looks. ---- */
  function build() {
    const S = TUNE.stick;
    Object.assign(S, { off: false, side: 'left', fixed: true, steer: false, pressWalk: true, restAbs: true, runAfter: 0.28 });
    left.className = 'pp-left';
    left.innerHTML = '';
    const r = left.getBoundingClientRect();
    S.rest = [r.left + r.width / 2, innerHeight - (r.top + r.height / 2)];
    api.onScheme?.();
  }

  /* ---- Walk with Hachi ---- */
  let following = false;
  const crumbs = [];
  function follow(on) {
    if (on === following) return;
    following = on;
    crumbs.length = 0;
    if (!on) player.steer = null;
  }
  const angle = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  function followStep(dt) {
    const h = GUIDE.where?.(), W = GUIDE.walk, info = GUIDE.tourInfo?.();
    if (!following || !h || !W || !player.locked || player.suspended || player.seat) { if (following && player.seat) follow(false); player.steer = null; return; }
    const last = crumbs[crumbs.length - 1];
    if (!last || Math.hypot(h.x - last.x, h.z - last.z) > 0.6) { crumbs.push({ x: h.x, z: h.z }); if (crumbs.length > 120) crumbs.shift(); }
    const p = player.pos;
    // he waits at a place: into its ring, then stop
    const waiting = info && (info.state === 'atSpot' || info.state === 'invite' || info.state === 'linger') && info.target;
    let goal = null;
    if (waiting) {
      const t = info.target;
      if (Math.hypot(t.x - p.x, t.z - p.z) < 0.8) { follow(false); return; }
      goal = W.sight(p.x, p.z, t.x, t.z) ? t : null;
    }
    if (!goal) {
      if (Math.hypot(h.x - p.x, h.z - p.z) < 2.4) { player.steer = null; return; }
      while (crumbs.length > 1 && Math.hypot(crumbs[0].x - p.x, crumbs[0].z - p.z) < 0.7) crumbs.shift();
      goal = crumbs[0];
      for (let i = crumbs.length - 1; i > 0; i--) if (W.sight(p.x, p.z, crumbs[i].x, crumbs[i].z)) { goal = crumbs[i]; break; }
    }
    if (!goal) { player.steer = null; return; }
    const dx = goal.x - p.x, dz = goal.z - p.z, L = Math.hypot(dx, dz) || 1;
    player.steer = { x: dx / L, z: dz / L, slow: 1 };
    if (performance.now() - (player.lookedAt ?? 0) > 1400) player.yaw += angle(Math.atan2(-dx, -dz) - player.yaw) * (1 - Math.exp(-dt * 2.2));
  }

  /* ---- the action and the guide line ---- */
  let actMode = null;
  actBtn.addEventListener('click', () => {
    if (actMode === 'act') { follow(false); act(); }
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

  const api = {
    get following() { return following; },
    follow,
    onScheme: null,
    /** each frame: `action` the words of what can be done here (or null) */
    update(dt, action) {
      followStep(dt);
      rule(dt);
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
