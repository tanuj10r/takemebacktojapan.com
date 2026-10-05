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

  /* ---- B: the shopping street: its first zebra's chirp; cut; ドンペン堂's theme and a slow look along its front ---- */
  if (on('B')) {
    log('B', JSON.stringify(await stage([50.4, 15.5, 0], [50, 11], { hear: 'walk1' })));
    await gp(() => window.GP.follow({ r: 3.2 }));
    await sleep(0.7);
    await REC.resume();
    await until('over the zebra', (s) => s.me[1] < -7.5, 40, 2);
    await REC.pause();
    log('B2', JSON.stringify(await stage([47.5, -24, 0], [48.5, -28.5], { hear: 'donki' })));
    await gp(() => window.GP.follow({ r: 3.2 }));
    await sleep(0.7);
    await REC.resume();
    await until('by the megastore', (s) => s.me[1] < -35.5, 40, 2);
    await gp(() => window.GP.walkTo(46.6, -40.8, { r: 0.5, look: { x: 56, z: -34, y: 4 }, max: 8 }));
    await gp(() => window.GP.pan(window.__scene.player.yaw, -Math.PI / 2 + 0.78, 0.2, 1.6));
    await gp(() => window.GP.pan(-Math.PI / 2 + 0.78, -Math.PI / 2 - 0.8, 0.2, 7));
    await sleep(0.5);
    await REC.pause();
  }

  /* ---- C: the plaza: he can't help himself with the pigeons ---- */
  if (on('C')) {
    log('C', JSON.stringify(await stage([51, -88.5, 0], [51.4, -91.5], { hear: 'station' })));
    await gp(() => window.GP.follow({ r: 3.2 }));
    await sleep(0.7);
    await REC.resume();
    await until('he charges them', (s) => s.st === 'charge', 30, 2);
    await gp(`window.GP.walkTo(51.7, -99.6, { r: 0.5, look: ${eyesOnPup}, max: 6 })`);
    await gp(() => window.GP.watch());
    await until('the charge is over', (s) => s.st !== 'charge', 20, 2);
    await sleep(2.6);
    await REC.pause();
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
