// The gameplay promo's scenes (scripts/_gameplay.mjs runs them; Tan's brief, 2026-10-05): the real game, start card
// to postcard, played by the scripted player.  The cuts are made in the camera: the recorder pauses, the game goes on
// (or the two of you are set down at the next place), the recorder takes up again.
export default async function scenes({ page, gp, st, until, log, sleep, REC, DRY, ONLY, W, H, snap }) {
  const on = (n) => !ONLY || ONLY.includes(n);
  const vt = (s) => (s.visit ? +s.visit.split('@')[1] : -1), vl = (s) => (s.visit ? s.visit.split('@')[0] : null);
  const startBtn = () => gp(() => { const e = [...document.querySelectorAll('button')].find((x) => /start/i.test(x.textContent)); const q = e.getBoundingClientRect(); return { x: q.x + q.width / 2, y: q.y + q.height / 2 }; });
  const lockNow = () => gp(() => { const p = window.__scene.player; if (!p.locked) { p.locked = true; p.onLockChange?.(true); return 'forced'; } return 'real'; });
  const eyesOnPup = '(() => { const p = window.GP.pup(); return { x: p.x, z: p.z, y: p.y + 0.3, up: 0.1 }; })';
  /** you and the pup set down for a scene: you at `me` [x, z, yaw], him at `pup` [x, z], his tour taken up at the leg that matches `leg` */
  const stage = (me, pup, leg) => gp(([me, pup, leg]) => {
    const g = window.__guide, T = g.A.tour;
    const k = T.findIndex((L) => Object.entries(leg).every(([a, b]) => L[a] === b));
    window.GP.free(); window.GP.put(me[0], me[1], me[2], me[3] ?? -0.05);
    Object.assign(g.G, { x: pup[0], z: pup[1], speed: 0, act: null, field: null, state: 'home' });
    g.leadFrom(k);
    return { k, leg: T[k] };
  }, [me, pup, leg]);

  /* ---- A: the start card with its song, Start, Hachi's hello, to the konbini, a Strong Nine, drunk outside ---- */
  if (on('A')) {
    await REC.start();                                         // (its first click, anywhere on the card: the song starts)
    await sleep(DRY ? 0.5 : 4.2);
    const b = await startBtn();
    await page.mouse.move(b.x, b.y, { steps: 12 });
    await page.mouse.click(b.x, b.y);
    await sleep(0.3);
    log('started; pointer lock:', await lockNow());
    // his hello, as it is (your view goes down to him by itself)
    await until('hello over (he waits for you)', (s) => s.st === 'ready' || s.st === 'lead', 30, 3);
    await sleep(0.9);
    gp(() => window.GP.walkTo(-1.2, 13.2, { r: 0.4 })).catch(() => {});        // (you step off past him: he takes you on)
    await until('he leads', (s) => s.st === 'lead' || s.st === 'atSpot', 15, 3);
    await gp(() => window.GP.follow({ r: 3.2 }));
    await until('he is at the konbini', (s) => s.st === 'atSpot' && s.tgt === 'konbini', 40, 3);
    await gp(() => window.GP.walkTo(-2.3, 2.45, { r: 0.35, look: { x: -2.3, z: -4, y: 1.5 }, max: 10 }));
    await sleep(1.5);                                          // (the card: what would you like?)
    await gp(() => { window.GP.free(); window.GP.press('Digit' + (window.__store.shop.menu.indexOf('strong_nine') + 1)); });
    // in at the doors, the chime ...
    await until('inside', (s) => vt(s) >= 3.7, 20, 2);
    await REC.pause();
    // ... the fridge: the can
    await until('at the fridge', (s) => vt(s) >= 7.4, 20, 2);
    await REC.resume();
    await until('the can is taken', (s) => vl(s) === 'to-till' && vt(s) >= 10.4, 20, 2);
    await REC.pause();
    // ... the till
    await until('at the till', (s) => vt(s) >= 14.3 && vl(s) !== 'to-till', 30, 2);
    await REC.resume();
    await until('paid', (s) => vl(s) === 'out' || vt(s) >= 19, 30, 2);
    await REC.pause();
    // ... out through the doors, the can, and Hachi's own bit
    await until('at the doors', (s) => vl(s) === 'out' && vt(s) >= 22.3, 30, 2);
    await REC.resume();
    await until('the can is drunk', (s) => s.visit === null, 60, 3);
    await gp(() => window.GP.follow({ r: 2.3, up: 0.06 }));        // (a step nearer, to see him)
    await until('his bit is over', (s) => s.st !== 'snack', 40, 2);
    await sleep(2.2);
    await REC.pause();
  } else {
    await REC.start(); await REC.pause();
    const b = await startBtn();
    await page.mouse.click(b.x, b.y);
    await sleep(0.5); await lockNow(); await sleep(1);
  }

  /* ---- F: a flyby (Tan, 2026-10-05: "rather than literally following Hachi ... a drone showing us the shopping
   * street, Donki and the station plaza while Hachi zoomies into the pigeons; 10-15 s"): the lens leaves your
   * shoulders, comes down over the street's mouth, runs its length past ドンペン堂's front, and arrives over the plaza
   * as he tears into the pigeons.  The HUD is off for it. ---- */
  if (on('F')) {
    const KEYS = [
      [0, 50, 12, 26, 50, 4, 0],
      [2.4, 50, 8.5, 7, 50, 3.5, -22],
      [4.6, 48.4, 6.6, -18, 55, 5, -38],
      [6.4, 47.4, 5.6, -34, 57.5, 5.5, -42],
      [8.0, 48.2, 5.2, -52, 54, 4, -66],
      [10.0, 50, 4.4, -80, 51.5, 1.2, -100],
      [11.8, 50.3, 3.2, -91.5, 51.5, 0.6, -103],
      [13.6, 50.4, 2.3, -97.2, 51.5, 0.5, -103.8],
      [15.0, 50.9, 1.9, -99.6, 51.5, 0.4, -103.8],
    ];
    await gp(() => { window.GP.free(); window.GP.clean(true); window.GP.put(50, 26, 0); });
    const flown = gp((K) => window.GP.drone(K, { pupFrom: 10.9 }), KEYS);
    await sleep(0.4);
    await REC.resume();
    for (const t of [1, 3, 5, 6.4, 8]) { while ((await gp(() => window.GP.droneT())) < t && (await gp(() => window.GP.droneT())) >= 0) await sleep(0.05); await snap('F-' + t); }
    while ((await gp(() => window.GP.droneT())) < 9.9) await sleep(0.05);
    // he is set down at the plaza's edge, his tour taken up there: the pigeons are on his way
    log('F pup', JSON.stringify(await gp(() => { const g = window.__guide, T = g.A.tour, k = T.findIndex((L) => L.hear === 'station'); Object.assign(g.G, { x: 51.4, z: -91.5, speed: 0, act: null, field: null, state: 'home' }); g.leadFrom(k); return k; })));
    for (const t of [11, 12, 13, 14, 14.9]) { while ((await gp(() => window.GP.droneT())) < t && (await gp(() => window.GP.droneT())) >= 0) await sleep(0.05); await snap('F-' + t); log('   ', JSON.stringify(await st())); }
    await flown;
    await sleep(0.3);
    await REC.pause();
    await gp(() => { window.__scene.player.scripted = false; window.GP.clean(false); });
  }

  /* ---- D: the Deer Park gate: up onto his bench, his bedtime, the postcard and its song ---- */
  if (on('D')) {
    log('D', JSON.stringify(await stage([-30, 50, Math.PI], [-30, 55], { id: 'gate' })));
    await gp(() => window.GP.follow({ r: 3.4 }));
    await sleep(0.7);
    await REC.resume();
    await until('he is at his bench', (s) => s.st === 'nap', 40, 2);
    gp(`window.GP.walkTo(-29.15, 63.8, { r: 0.35, look: ${eyesOnPup}, max: 6 })`).then(() => gp(() => window.GP.watch())).catch(() => {});
    for (let k = 0; ; k++) {
      const p = await gp(() => ({ open: !!window.__postcard.card?.open, pending: window.__postcard.pending() }));
      if (p.open) { log('  the postcard is up'); break; }
      if (k > 160) { log('  NO POSTCARD', JSON.stringify(p), JSON.stringify(await st())); break; }
      await sleep(0.25);
    }
    await sleep(5.5);
    await snap('D-postcard');
  }
}
