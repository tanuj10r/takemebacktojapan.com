import { VERSIONS } from './shots.js';

/* The director's panel (Director Mode, dev only; Part 6): beside the 9:16
 * frame, never in it or in a recording.  The versions, the shot list, the
 * keys, a note line and the red recording dot. */
export function makePanel({ onPick, onVersion }) {
  const el = document.createElement('div');
  el.className = 'director-keep';
  el.style.cssText = 'position:fixed;left:0;top:0;bottom:0;width:360px;overflow:auto;background:#15131c;color:#e8e4f0;font:13px/1.45 -apple-system,system-ui,sans-serif;padding:14px 16px;box-sizing:border-box;z-index:10;';
  document.body.appendChild(el);
  let rows = [];
  const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const api = {
    build(S) {
      const v = VERSIONS[S.version];
      const total = v.shots.reduce((a, s) => a + s.dur, 0);
      el.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
          <b style="font-size:15px">Director Mode</b><span id="dir-rec" style="width:10px;height:10px;border-radius:50%;background:#e02a3a;display:none"></span>
        </div>
        <div style="display:flex;gap:6px;margin-bottom:10px">${Object.entries(VERSIONS).map(([k, vv]) => `<button data-v="${k}" style="flex:1;padding:6px 4px;border-radius:6px;border:1px solid #3a3550;background:${k === S.version ? '#3b3170' : '#211d2c'};color:#fff;cursor:pointer;font-size:12px">${k}: ${esc(vv.title)}</button>`).join('')}</div>
        <div style="opacity:.75;margin-bottom:6px">${esc(v.title)} · ${v.shots.length} shots · ${total.toFixed(1)} s</div>
        <div id="dir-shots">${v.shots.map((s, i) => `<div data-i="${i}" style="padding:4px 6px;border-radius:5px;cursor:pointer;display:flex;gap:8px"><b style="width:34px">${s.id}</b><span style="flex:1">${esc(s.name)}</span><span style="opacity:.7">${s.dur.toFixed(1)}s</span></div>`).join('')}</div>
        <div id="dir-t" style="margin:10px 0 4px;font-variant-numeric:tabular-nums;opacity:.85"></div>
        <div id="dir-note" style="min-height:18px;color:#ffd27a"></div>
        <div style="margin-top:12px;opacity:.7;font-size:12px;line-height:1.6">
          <b>Keys</b><br>
          ↑ ↓ select a shot · Enter play it · Esc stop<br>
          P play the version · Shift+P record it<br>
          Shift+Enter record the shot (1 s handles)<br>
          R hold the shot's first frame · V next version<br>
          T slow motion · B safe frame · H HUD<br>
          J reactions (↑ ↓ to browse) · Shift+1..4 mute amb/music/fx/dog · Shift+0 all on<br>
          Shift+X deterministic render (C: 4K 2160x3840)
        </div>`;
      rows = [...el.querySelectorAll('[data-i]')];
      rows.forEach((r) => r.addEventListener('click', () => { onPick(+r.dataset.i); api.select(+r.dataset.i); }));
      el.querySelectorAll('[data-v]').forEach((b) => b.addEventListener('click', () => onVersion(b.dataset.v)));
      api.select(S.shotIndex);
    },
    select(i) { rows.forEach((r, k) => { r.style.background = k === i ? '#3b3170' : 'transparent'; }); rows[i]?.scrollIntoView({ block: 'nearest' }); },
    tick(S, shot) {
      const t = el.querySelector('#dir-t');
      if (t) t.textContent = shot ? `${shot.def.id}  ${shot.t.toFixed(2)} / ${shot.def.dur.toFixed(2)} s${S.slow ? '  (slow)' : ''}` : S.tester ? `testing ${S.tester.name}` : '';
      if (S.running) api.select(S.shotIndex);
    },
    note(s) { const n = el.querySelector('#dir-note'); if (n) n.textContent = s; },
    rec(on) { const d = el.querySelector('#dir-rec'); if (d) d.style.display = on ? 'inline-block' : 'none'; },
  };
  return api;
}
