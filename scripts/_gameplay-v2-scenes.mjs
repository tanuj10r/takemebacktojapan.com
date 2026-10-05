// The gameplay promo, cut 2 (Tan's brief, 2026-10-05; run by scripts/_gameplay.mjs --scenes ./_gameplay-v2-scenes.mjs
// --name gameplay-v2 --no4k): the same real game, tighter (about a minute) and dressed for a phone: no start card, the
// keys' panel off, the sounds' chips and Hachi's hello larger, the Strong Nine's line large, an end card.
export default async function scenes({ page, gp, st, until, log, sleep, REC, DRY, W, H, snap }) {
  const vt = (s) => (s.visit ? +s.visit.split('@')[1] : -1), vl = (s) => (s.visit ? s.visit.split('@')[0] : null);
  const stage = (me, pup, leg) => gp(([me, pup, leg]) => {
    const g = window.__guide, T = g.A.tour;
    const k = T.findIndex((L) => Object.entries(leg).every(([a, b]) => L[a] === b));
    window.GP.free(); window.GP.put(me[0], me[1], me[2], me[3] ?? -0.05);
    Object.assign(g.G, { x: pup[0], z: pup[1], speed: 0, act: null, field: null, state: 'home' });
    g.leadFrom(k);
    return { k, leg: T[k] };
  }, [me, pup, leg]);
  const droneT = () => gp(() => window.GP.droneT());

  /* the promo's dressing of the page (nothing of the game's own is changed: this is the take's style sheet) */
  await gp(() => window.GP.css(`
    .controls { display: none !important; }                       /* the keys' panel, bottom left */
    .kmenu { opacity: 0 !important; }                              /* the little menu at the konbini's door */
    .snd { zoom: 2; }                                              /* the sounds' chips: the hook, readable on a phone */
    #hachi-card { zoom: 2.1; }                                     /* "Hi, I'm Hachi!" */
    body.gp-joke .hud .toast { top: 34% !important; transform: translate(-50%, 0) scale(2.7) !important; transform-origin: center top; box-shadow: 0 3px 14px rgba(30,20,50,.3); background: rgba(252,250,252,.95) !important; }   /* the Strong Nine's line, large and in the middle */
    #gp-end { position: fixed; inset: 0; z-index: 99999; display: grid; place-content: center; text-align: center; gap: 26px; pointer-events: none;
      background: rgba(22,15,40,.58); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); opacity: 0; transition: opacity .45s ease;
      font-family: 'Arial Rounded MT Bold', 'Hiragino Maru Gothic ProN', -apple-system, system-ui, sans-serif; color: #fff6ea; }
    #gp-end.on { opacity: 1; }
    #gp-end .u { font-size: 104px; font-weight: 800; letter-spacing: .01em; text-shadow: 0 6px 30px rgba(0,0,0,.35); }
    #gp-end .p { justify-self: center; font-size: 50px; font-weight: 700; padding: 14px 44px 16px; border-radius: 999px; background: #1f5fae; color: #fff; }
  `));

  /* ---- 1: straight onto the konbini and Fuji (the start card is pressed unrecorded) ---- */
  await REC.start({ rec: false });
  const b = await gp(() => { const e = [...document.querySelectorAll('button')].find((x) => /start/i.test(x.textContent)); const q = e.getBoundingClientRect(); return { x: q.x + q.width / 2, y: q.y + q.height / 2 }; });
  await page.mouse.click(b.x, b.y);
  await sleep(0.3);
  log('started; pointer lock:', await gp(() => { const p = window.__scene.player; if (!p.locked) { p.locked = true; p.onLockChange?.(true); return 'forced'; } return 'real'; }));
  await sleep(0.55);                                            // (the card's own fade is over)
  await REC.resume();
  await snap('1-open');

  /* ---- 2: his hello (the card up 3 s and more), cut, the last of the way to the door ---- */
  for (let k = 0; k < 400; k++) { if (await gp(() => document.getElementById('hachi-card')?.style.opacity === '1')) break; await sleep(0.05); }
  log('  the hello card is up', JSON.stringify(await st()));
  await sleep(1.6); await snap('2-hello');
  await sleep(1.7);
  await REC.pause();
  await until('hello over (he waits for you)', (s) => s.st === 'ready' || s.st === 'lead', 30, 5);
  gp(() => window.GP.walkTo(-1.2, 13.2, { r: 0.4 })).catch(() => {});
  await until('he leads', (s) => s.st === 'lead' || s.st === 'atSpot', 15, 5);
  await gp(() => window.GP.follow({ r: 3.2 }));
  await until('on the way', (s) => s.me[1] < 10.6, 20, 5);
  await REC.resume();
  await until('he is at the konbini', (s) => s.st === 'atSpot' && s.tgt === 'konbini', 40, 5);
  await gp(() => window.GP.walkTo(-2.3, 2.45, { r: 0.35, look: { x: -2.3, z: -4, y: 1.5 }, max: 10 }));

  /* ---- 3: the store: the doors and their chime, the aisle; cut; the Strong Nine; cut; the self-checkout ---- */
  await gp(() => { window.GP.free(); window.GP.press('Digit' + (window.__store.shop.menu.indexOf('strong_nine') + 1)); });
  await until('inside, down the aisle', (s) => vt(s) >= 4.4, 20, 5);
  await snap('3-aisle');
  await REC.pause();
  await until('at the fridge', (s) => vt(s) >= 7.7, 20, 5);
  await REC.resume();
  await until('the can is taken', (s) => vl(s) === 'to-till' && vt(s) >= 10.3, 20, 5);
  await REC.pause();
  await until('at the till', (s) => vt(s) >= 14.4 && vl(s) !== 'to-till', 30, 5);
  await REC.resume();
  await until('paid', (s) => vl(s) === 'out' || vt(s) >= 19, 30, 5);
  await REC.pause();

  /* ---- 4: the sip outside; cut; its line, large, with the wobble ---- */
  await until('outside, the can up', (s) => s.visit === null || (vl(s) !== 'out' && vt(s) >= 24.3), 40, 5);
  await REC.resume();
  await sleep(2.2); await snap('4-sip');
  await REC.pause();
  await until('the can is drunk', (s) => s.visit === null, 60, 5);
  await gp(() => { document.body.classList.add('gp-joke'); const p = window.__scene.player; window.GP.look({ yaw: p.yaw, pitch: 0.04, k: 2 }); });
  await REC.resume();
  await sleep(1.1); await snap('4-joke');
  await sleep(1.1);
  await REC.pause();
  await gp(() => { document.body.classList.remove('gp-joke'); window.GP.free(); });
  await sleep(9.5);                                             // (unrecorded: the Strong Nine wears off before the lens flies)

  /* ---- 5: the flyby, as it was: the street, ドンペン堂, the plaza and the pigeons, the station and its train ---- */
  {
    const KEYS = [
      [0, 50, 12, 26, 50, 4, 0], [2.4, 50, 8.5, 7, 50, 3.5, -22], [4.6, 48.4, 6.6, -18, 55, 5, -38], [6.4, 47.4, 5.6, -34, 57.5, 5.5, -42],
      [8.0, 48.2, 5.2, -52, 54, 4, -66], [10.0, 50, 4.4, -80, 51.5, 1.2, -100], [11.6, 49.7, 2.4, -91.5, 51.5, 0.5, -102],
      [13.2, 49.2, 1.1, -98.6, 51.5, 0.4, -103.8], [15.0, 49.3, 0.75, -101.0, 51.5, 0.4, -103.8], [16.8, 58, 5, -107, 54, 4, -124],
      [18.6, 70, 6.5, -117, 60, 3, -130], [20.4, 76.5, 4.2, -128.4, 56, 2.3, -132.8],
    ];
    await gp(() => { window.GP.free(); window.GP.clean(true); window.GP.put(50, 26, 0); });
    const flown = gp((K) => window.GP.drone(K, { pupFrom: 10.5, pupTo: 16.2 }), KEYS);
    await sleep(0.4);
    await REC.resume();
    while ((await droneT()) < 9.9) await sleep(0.05);
    await gp(() => { const g = window.__guide, T = g.A.tour, k = T.findIndex((L) => L.hear === 'station'); Object.assign(g.G, { x: 51.4, z: -91.5, speed: 0, act: null, field: null, state: 'home' }); g.leadFrom(k); });
    while ((await droneT()) < 18.6) await sleep(0.05);
    await gp(() => window.__train('platform-shut'));
    await flown;
    await sleep(0.3);
    await REC.pause();
    await gp(() => { window.__scene.player.scripted = false; window.GP.clean(false); });
  }

  /* ---- 6: the Deer Park gate, one beat: its sign, and he hops up onto his bench ---- */
  log('6', JSON.stringify(await stage([-29.6, 59.6, Math.PI, 0.1], [-30, 61.6], { id: 'gate' })));
  await gp(() => window.GP.watch({ up: 0.2 }));
  await sleep(0.6);
  await REC.resume();
  for (const t of [1.5, 3, 4.5, 6]) { await sleep(1.5); await snap('6-gate' + t); log('   ', JSON.stringify(await st())); }
  await REC.pause();

  /* ---- 7: the postcard (he has settled, unrecorded): in, and held; 8: the end card over it ---- */
  for (let k = 0; k < 600; k++) { const p = await gp(() => window.__postcard.pending()); if (p >= 0) break; await sleep(0.05); }
  await REC.resume();
  for (let k = 0; k < 200; k++) { if (await gp(() => !!window.__postcard.card?.open)) break; await sleep(0.05); }
  log('  the postcard is up');
  await sleep(3.3); await snap('7-postcard');
  await gp(() => { const e = document.createElement('div'); e.id = 'gp-end'; e.innerHTML = '<div class="u">takemebacktojapan.com</div><div class="p">Play free in your browser</div>'; document.body.appendChild(e); requestAnimationFrame(() => e.classList.add('on')); });
  await sleep(3.1); await snap('8-end');
  await REC.stop({ fade: 1.0, xfade: 0.35 });
}
