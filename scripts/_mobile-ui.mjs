/* The phone build's UI (src/mobile/, m.html; docs/decisions/mobile-lite.md "Mobile v3: UI"): screenshots and checks,
 * with real multi-touch (CDP Input.dispatchTouchEvent) on an emulated iPhone 15 (844x390 and 390x844 at 3x).
 *
 *   node scripts/_mobile-ui.mjs [out-dir] [cards] [play] [controls] [audio]      (default: all)
 *     cards     the loading, start and pause cards, the postcard (and its selfie on an insecure page), both ways up
 *     play      the play screen: the tiles, the corner map and the whole map, Hachi's hello, the context button
 *               (mochi, the bench, the tour again), the konbini's chips, the sound's name, the countdown, the toast
 *     controls  the stick and the look as numbers: speeds, the run, input-to-camera latency, two thumbs at once,
 *               the buttons under a held stick, Start and Resume only by their buttons
 *     audio     the sound wakes in the tap, the title song on the start card, the pill after an interruption
 *   BASE=http://127.0.0.1:5196/  use a server that is already up (else its own dev server on PORT, default 5196)
 * One headless Chrome (on /tmp/lawson-browser.lock); it and the server are closed however it ends. */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const args = process.argv.slice(2);
const OUT = path.resolve(args.find((a) => a.includes('/')) ?? path.join(ROOT, '.shots', 'mobile-ui'));
const want = args.filter((a) => !a.includes('/'));
const on = (k) => !want.length || want.includes(k);
fs.mkdirSync(OUT, { recursive: true });
const PORT = +process.env.PORT || 5196;

const LOCK = '/tmp/lawson-browser.lock';
for (;;) { try { fs.mkdirSync(LOCK); break; } catch { console.log('  waiting for the browser lock'); await new Promise((r) => setTimeout(r, 10000)); } }
let server, browser;
const done = async () => {
  await Promise.race([Promise.all([browser?.close(), server?.close()]), new Promise((r) => setTimeout(r, 6000))]).catch(() => {});
  try { fs.rmdirSync(LOCK); } catch {}
};
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, async () => { await done(); process.exit(130); });

let bad = 0;
const check = (name, ok, info) => { if (!ok) bad++; console.log(`${ok ? 'pass' : 'FAIL'}  ${name}${info === undefined ? '' : '  ' + JSON.stringify(info)}`); };
const note = (name, info) => console.log(`      ${name}  ${JSON.stringify(info)}`);
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const SIZES = { land: { width: 844, height: 390 }, port: { width: 390, height: 844 } };

/** A phone: its page, and fingers (CDP touch points by id, so two thumbs are really down at once). */
async function phone(base, way, { query = '' } = {}) {
  const ctx = await browser.newContext({ viewport: SIZES[way], deviceScaleFactor: 3, hasTouch: true, isMobile: true, userAgent: UA });
  const page = await ctx.newPage();
  page.setDefaultNavigationTimeout(180000);
  page.setDefaultTimeout(120000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e?.message ?? e)));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) errors.push(m.text()); });
  const cdp = await ctx.newCDPSession(page);
  const down = new Map();
  const send = (type) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: [...down].map(([id, p]) => ({ id, x: p.x, y: p.y, radiusX: 12, radiusY: 12, force: 1 })) });
  const finger = {
    async down(id, x, y) { down.set(id, { x, y }); await send('touchStart'); },
    async move(id, x, y) { down.set(id, { x, y }); await send('touchMove'); },
    // (CDP: touchEnd names the fingers that lift; the others stay down)
    async up(id) { const p = down.get(id); down.delete(id); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: p ? [{ id, x: p.x, y: p.y }] : [] }); },
    /** a drag over `ms`, in steps of ~8 ms (a 120 Hz finger) */
    async drag(id, x0, y0, x1, y1, ms = 300, keep = false) {
      await finger.down(id, x0, y0);
      const n = Math.max(2, Math.round(ms / 8)), t0 = Date.now();
      for (let i = 1; i <= n; i++) {
        await finger.move(id, x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n);
        const wait = t0 + ms * i / n - Date.now();
        if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      }
      if (!keep) await finger.up(id);
    },
    async tap(x, y, id = 9) { await finger.down(id, x, y); await page.waitForTimeout(40); await finger.up(id); },
  };
  await page.goto(base + 'm.html' + query);
  /* A finger on a button while others are down on the view: CDP's emulation hands every finger of a sequence to the
   * first finger's element, which a real phone does not; so this one is sent to the button as pointer events. */
  const pressOn = (sel) => page.evaluate((s) => {
    const b = document.querySelector(s), r = b.getBoundingClientRect(), o = { bubbles: true, cancelable: true, pointerId: 77, pointerType: 'touch', isPrimary: false, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 };
    b.dispatchEvent(new PointerEvent('pointerdown', o)); b.dispatchEvent(new PointerEvent('pointerup', o));
  }, sel);
  const tapOn = async (sel) => {
    const r = await page.evaluate((s) => { const b = document.querySelector(s)?.getBoundingClientRect(); return b ? [b.left + b.width / 2, b.top + b.height / 2] : null; }, sel);
    if (!r) throw new Error('no ' + sel);
    await finger.tap(r[0], r[1]);
  };
  const shot = async (name) => {
    await page.evaluate(() => Promise.all([...document.images].filter((i) => !i.complete).map((i) => i.decode().catch(() => {}))));
    await page.waitForTimeout(450);
    const f = path.join(OUT, `${name}-${way}.png`);
    await page.screenshot({ path: f });
    console.log('  ' + f);
  };
  const ready = () => page.waitForFunction(() => { const b = document.getElementById('boot'); return (b?.classList.contains('ready') || /\bready\b/.test(b?.dataset.was ?? '')) && window.__m; }, null, { timeout: 180000 });
  const start = async () => { await ready(); await tapOn('#start'); await page.waitForFunction(() => window.__m.player.locked); await page.waitForTimeout(700); };
  /** stand somewhere, facing something */
  const stand = (x, z, tx, tz) => page.evaluate(([x, z, tx, tz]) => {
    const { player, world } = window.__m;
    player.pos.set(x, world.heightAt(x, z), z); player.vel.set(0, 0, 0);
    player.yaw = Math.atan2(-(tx - x), -(tz - z)); player.pitch = -0.12; player.applyCamera(0);
  }, [x, z, tx, tz]);
  return { ctx, page, finger, tapOn, pressOn, shot, ready, start, stand, errors, way, size: SIZES[way] };
}

try {
  let base = process.env.BASE;
  if (!base) {
    const { createServer } = await import('vite');
    server = await createServer({ root: ROOT, mode: 'mobile', logLevel: 'error', server: { port: PORT, strictPort: true, host: '127.0.0.1' } });
    await server.listen();
    base = `http://127.0.0.1:${PORT}/`;
  }
  browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--autoplay-policy=document-user-activation-required', '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1'] });

  for (const way of ['land', 'port']) {
    /* ------------------------------ the cards ------------------------------ */
    if (on('cards')) {
      const P = await phone(base, way);
      const { page } = P;
      await page.waitForSelector('#boot .sheet');
      await page.waitForTimeout(300);
      // the loading card as it is while the town builds (the game may already be ready on a fast machine: shown as loading)
      await page.evaluate(() => { const b = document.getElementById('boot'); b.dataset.was = b.className; b.classList.remove('ready'); b.style.setProperty('--p', '62%'); });
      await P.shot('01-loading');
      await P.ready();
      await page.evaluate(() => document.getElementById('boot').classList.add('ready'));
      await page.waitForTimeout(700);
      await P.shot('02-start');
      // the socials: Coffee first, then X, GitHub, the site, each with ?ref=
      const links = await page.evaluate(() => [...document.querySelectorAll('#boot .mk-row a')].map((a) => ({ href: a.href, goal: a.dataset.fastGoal, target: a.target, rel: a.rel, w: a.getBoundingClientRect().width, h: a.getBoundingClientRect().height })));
      check(`${way}: start card: Coffee first, then X, GitHub, the site`, links.map((l) => l.goal).join() === 'maker_coffee,maker_x,maker_github,maker_site', links.map((l) => l.goal));
      check(`${way}: start card: every link out carries ?ref=takemebacktojapan, opens a new tab`, links.every((l) => /[?&]ref=takemebacktojapan/.test(l.href) && l.target === '_blank' && /noopener/.test(l.rel)));
      check(`${way}: start card: every social is a thumb's size (>= 38 px)`, links.every((l) => l.w >= 38 && l.h >= 38), links.map((l) => [Math.round(l.w), Math.round(l.h)]));
      const fits = await page.evaluate(() => { const s = document.querySelector('#boot .sheet').getBoundingClientRect(); return { top: s.top, bottom: s.bottom, h: innerHeight, w: innerWidth, right: s.right }; });
      check(`${way}: start card fits the screen`, fits.top >= 0 && fits.bottom <= fits.h + 0.5 && fits.right <= fits.w + 0.5, fits);
      // a tap on the art wakes nothing but the sound; only Start starts
      await P.finger.tap(P.size.width * 0.6, P.size.height * 0.3);
      await page.waitForTimeout(500);
      const woke = await page.evaluate(() => ({ locked: window.__m.player.locked, ac: window.__m.sound.graph()?.ac?.state ?? 'none', boot: !!document.getElementById('boot') }));
      check(`${way}: a tap on the start card's art does not start the game`, !woke.locked && woke.boot, woke);
      check(`${way}: ... and wakes the sound (the title song)`, woke.ac === 'running', woke.ac);
      await P.start();
      check(`${way}: Start starts`, await page.evaluate(() => window.__m.player.locked && document.getElementById('boot')?.classList.contains('hidden') !== false));
      await page.waitForTimeout(800);
      await P.tapOn('[data-b="pause"]');
      await page.waitForFunction(() => !window.__m.player.locked);
      await page.waitForTimeout(700);
      await P.shot('05-pause');
      const pc = await page.evaluate(() => {
        const q = (s) => document.querySelector('.mh-pause ' + s);
        const c = q('.card').getBoundingClientRect();
        return { look: /look speed/i.test(q('.card').textContent), resume: !!q('[data-b="resume"]'), post: getComputedStyle(q('.mh-post')).animationName, socials: q('.mk-row').querySelectorAll('a').length,
          slider: q('.vol-bar').getAttribute('role'), fits: c.top >= 0 && c.bottom <= innerHeight + 0.5, scroll: q('.card').scrollHeight - q('.card').clientHeight };
      });
      check(`${way}: pause card: no "Look speed"; a volume slider, Resume, the socials, a glowing postcard`, !pc.look && pc.resume && pc.slider === 'slider' && pc.socials === 4 && pc.post === 'mh-glow', pc);
      check(`${way}: pause card fits the screen without scrolling`, pc.fits && pc.scroll <= 1, pc);
      // a tap on the scrim does not resume; the volume's bar is dragged; Resume resumes
      await P.finger.tap(8, P.size.height - 8);
      await page.waitForTimeout(300);
      check(`${way}: a tap outside the pause card does not resume`, await page.evaluate(() => !window.__m.player.locked));
      const bar = await page.evaluate(() => { const r = document.querySelector('.vol-bar').getBoundingClientRect(); return [r.left, r.top + r.height / 2, r.width]; });
      await P.finger.drag(3, bar[0] + bar[2] * 0.5, bar[1], bar[0] + bar[2] * 0.99, bar[1], 250);
      const v1 = await page.evaluate(() => ({ step: window.__m.hud.volume, gain: window.__m.sound.volume, saved: localStorage.getItem('takemebacktojapan-volume') }));
      check(`${way}: dragging the volume's bar to its end sets 100 (heard at once, remembered)`, v1.step === 100 && Math.abs(v1.gain - 0.6) < 1e-6 && v1.saved === '100', v1);
      await P.finger.tap(bar[0] + bar[2] * 0.5, bar[1]);
      check(`${way}: a tap in the middle of the bar sets 50`, await page.evaluate(() => window.__m.hud.volume) === 50);
      // the postcard, from the pause card
      await P.tapOn('[data-b="postcard"]');
      await page.waitForFunction(() => document.querySelector('.mk-post-scrim.on'));
      await page.waitForTimeout(700);
      await P.shot('06-postcard');
      const post = await page.evaluate(() => { const r = document.querySelector('.mk-post').getBoundingClientRect(); return { held: document.querySelector('.mh-pause').classList.contains('hidden'), w: Math.round(r.width), h: Math.round(r.height), fits: r.left >= -1 && r.right <= innerWidth + 1, tall: document.querySelector('.mk-post-scrim').scrollHeight <= innerHeight + 1 || r.height <= innerHeight }; });
      check(`${way}: the postcard opens over the pause card (which waits behind it) and fits`, post.held && post.fits && post.tall, post);
      // the selfie: this page is secure (127.0.0.1) but headless Chrome has no camera: its own "no camera" words
      await page.click('[data-pc="selfie"]');
      await page.waitForFunction(() => document.querySelector('.sf')?.dataset.state && document.querySelector('.sf').dataset.state !== 'ask', null, { timeout: 20000 }).catch(() => {});
      await page.waitForTimeout(500);
      await P.shot('07-postcard-selfie');
      const sf = await page.evaluate(() => ({ state: document.querySelector('.sf')?.dataset.state, say: document.querySelector('.sf-say')?.textContent, video: document.querySelector('.sf video')?.playsInline }));
      check(`${way}: the selfie asks for the camera; with none it says so in a phone's words; its live view is playsinline`, !!sf.state && sf.video === true && !/address bar|Plug one in/.test(sf.say ?? ''), sf);
      await page.click('[data-sf="cancel"]');
      // on an insecure page (http on the LAN) there is no camera to ask for: a plain message, nothing broken
      await page.evaluate(() => { Object.defineProperty(window, 'isSecureContext', { value: false, configurable: true }); });
      await page.click('[data-pc="selfie"]');
      await page.waitForTimeout(400);
      await P.shot('08-postcard-insecure');
      const ins = await page.evaluate(() => ({ note: document.querySelector('.mk-post .m-note')?.textContent, on: document.querySelector('.mk-post').classList.contains('sf-on') }));
      check(`${way}: on an insecure page "Add your selfie" explains (https), and does not open the camera view`, /secure|https/i.test(ins.note ?? '') && !ins.on, ins);
      await page.click('[data-pc="back"]');
      await page.waitForTimeout(500);
      check(`${way}: Back: the pause card again`, await page.evaluate(() => !document.querySelector('.mh-pause').classList.contains('hidden') && !window.__m.player.locked));
      await P.tapOn('[data-b="resume"]');
      await page.waitForTimeout(400);
      check(`${way}: Resume resumes`, await page.evaluate(() => window.__m.player.locked));
      check(`${way}: cards: no page errors`, P.errors.length === 0, P.errors.slice(0, 4));
      await P.ctx.close();
    }

    /* ------------------------------ the play screen ------------------------------ */
    if (on('play')) {
      const P = await phone(base, way);
      const { page } = P;
      await P.start();
      await P.shot('03-play');
      const lay = await page.evaluate(() => {
        const r = (s) => { const b = document.querySelector(s)?.getBoundingClientRect(); return b ? [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)] : null; };
        return { map: r('.minimap'), mapBtn: r('.mh-map'), tiles: [...document.querySelectorAll('.mh-btn')].map((b) => [b.dataset.b, b.textContent.trim(), Math.round(b.getBoundingClientRect().width)]), stick: r('.stick'), mapShown: !document.querySelector('.minimap').classList.contains('hidden') };
      });
      check(`${way}: the corner map shows, top left, with its button over it`, lay.mapShown && lay.map && lay.mapBtn && Math.abs(lay.map[0] - lay.mapBtn[0]) < 2 && lay.map[2] >= 80 && lay.map[2] <= 110, lay);
      check(`${way}: three labelled tiles (Hachi, the time of day, Pause), each >= 48 px`, lay.tiles.length === 3 && lay.tiles.every((t) => t[1] && t[2] >= 48), lay.tiles);
      // Hachi's hello: after 4 s, with the caption card (touch words)
      await page.waitForFunction(() => document.getElementById('hachi-card') && getComputedStyle(document.getElementById('hachi-card')).opacity > 0.9, null, { timeout: 30000 }).catch(() => {});
      await page.waitForTimeout(600);
      await P.shot('04-hachi-hello');
      const hello = await page.evaluate(() => { const c = document.getElementById('hachi-card'); if (!c) return null; const b = c.getBoundingClientRect(); return { text: c.textContent, o: +getComputedStyle(c).opacity, box: [Math.round(b.left), Math.round(b.top), Math.round(b.right), Math.round(b.bottom)], w: innerWidth, h: innerHeight }; });
      check(`${way}: Hachi's hello comes, its card on screen, in touch words (tap the paw, no "press F")`, !!hello && hello.o > 0.9 && /tap the paw/.test(hello.text) && !/press F/i.test(hello.text) && hello.box[0] >= 0 && hello.box[2] <= hello.w, hello);
      // the whistle: the paw
      await page.waitForTimeout(1500);
      const w0 = await page.evaluate(() => { window.__whistles = 0; const o = window.__m.GUIDE.whistle; window.__m.GUIDE.whistle = () => { const r = o(); if (r) window.__whistles++; return r; }; return 0; });
      await P.tapOn('[data-b="whistle"]');
      await page.waitForTimeout(300);
      note(`${way}: whistle`, await page.evaluate(() => window.__whistles));
      // the whole map: a tap on the corner map opens it, a tap closes it
      await P.tapOn('.mh-map');
      await page.waitForTimeout(700);
      await P.shot('09-map');
      check(`${way}: a tap on the corner map opens the whole map (the walk held)`, await page.evaluate(() => window.__m.shell.minimap.fullOpen && window.__m.player.suspended && !document.querySelector('.fullmap').classList.contains('hidden')));
      // (Tan, 2026-10-02: a simpler map) the whole sheet inside the screen, nothing to pan
      const m0 = await page.evaluate(() => { const c = document.querySelector('.fullmap canvas').getBoundingClientRect(); return { l: Math.round(c.left), t: Math.round(c.top), r: Math.round(c.right), b: Math.round(c.bottom), W: innerWidth, H: innerHeight }; });
      check(`${way}: the whole map is whole on the screen`, m0.l >= 0 && m0.t >= 0 && m0.r <= m0.W && m0.b <= m0.H && (m0.r - m0.l) > 0.4 * Math.min(m0.W, m0.H), m0);
      await P.shot('09b-map-panned');
      // (Tan, 2026-10-03) a tap on a place walks you there; a tap off the sheet only closes it
      await P.finger.tap(P.size.width / 2, P.size.height / 2);
      await page.waitForTimeout(500);
      check(`${way}: a tap closes it`, await page.evaluate(() => !window.__m.shell.minimap.fullOpen && !window.__m.player.suspended));
      await P.tapOn('.mh-map');
      await page.waitForTimeout(700);
      await P.finger.tap(4, 4);
      await page.waitForTimeout(500);
      check(`${way}: a tap off the sheet closes it too`, await page.evaluate(() => !window.__m.shell.minimap.fullOpen));
      // the time of day
      await P.tapOn('[data-b="time"]');
      await page.waitForTimeout(1300);
      await P.shot('10-time');
      note(`${way}: time tile`, await page.evaluate(() => document.querySelector('[data-b="time"]').textContent.trim()));
      // the context button: the mochi shop's spot (generic: whatever its label says), the bench
      const spots = await page.evaluate(() => {
        const { world, THREE } = window.__m, v = new THREE.Vector3();
        world.root?.updateMatrixWorld?.(true);
        return world.interactables.map((it) => { it.hitbox.getWorldPosition(v); return { label: it.label, x: v.x, z: v.z, live: !!it.hitbox.parent }; });
      });
      note(`${way}: interactables`, spots.map((s) => s.label));
      const mochi = spots.find((s) => /mochi/i.test(s.label));
      if (mochi) {
        await P.stand(mochi.x + 0.9, mochi.z + 0.9, mochi.x, mochi.z);
        await page.waitForTimeout(900);
        await P.shot('11-action-mochi');
        const a = await page.evaluate(() => ({ label: window.__m.hud.action, on: document.querySelector('.mh-act').classList.contains('on') }));
        check(`${way}: at the mochi shop the context button offers its own words`, a.on && /mochi\s+¥\d+/i.test(a.label ?? '') && !/·/.test(a.label), a);
      } else check(`${way}: a mochi spot among the interactables`, false);
      const bench = spots.find((s) => /ひと休み|sit/i.test(s.label));
      if (bench) {
        await P.stand(bench.x + 0.8, bench.z + 0.8, bench.x, bench.z);
        await page.waitForTimeout(700);
        const a = await page.evaluate(() => window.__m.hud.action);
        check(`${way}: at the bench the context button says what it does`, !!a, a);
        await P.tapOn('.mh-act button');
        await page.waitForTimeout(2600);
        await P.shot('12-bench-seated');
        const s = await page.evaluate(() => ({ seat: !!window.__m.player.seat, action: window.__m.hud.action }));
        check(`${way}: the button seats you; seated, it offers "Stand up"`, s.seat && /stand/i.test(s.action ?? ''), s);
        await P.tapOn('.mh-act button');
        await page.waitForTimeout(1500);
        check(`${way}: ... and stands you up`, await page.evaluate(() => !window.__m.player.seat || window.__m.player.seat.dir < 0));
      }
      // "Take the tour again": on offer when the guide says so (the tour over, Hachi by you and looked at)
      await P.stand(0, 14, 0, 0);
      // (Tan, 2026-10-02: only once the tour's postcard has been up and put away)
      await page.evaluate(() => { const G = window.__m.GUIDE; G.__offer = G.offer; G.offer = () => true; });
      await page.waitForTimeout(400);
      check(`${way}: before the postcard has been up, the tour is not on offer`, await page.evaluate(() => window.__m.hud.action) !== 'Take the tour again');
      await page.evaluate(() => { window.__m.shell.postcardSeen = true; window.__m.GUIDE.offer = window.__m.GUIDE.__offer; });
      await page.evaluate(() => { const G = window.__m.GUIDE; G.__offer = G.offer; G.__again = G.again; G.offer = () => true; G.again = () => { window.__again = (window.__again ?? 0) + 1; G.onTour?.(); return true; }; });
      await page.waitForTimeout(500);
      const tour = await page.evaluate(() => window.__m.hud.action);
      await P.tapOn('.mh-act button');
      await page.waitForTimeout(500);
      await P.shot('13-tour-again');
      check(`${way}: after the tour the context button is "Take the tour again", and takes it`, tour === 'Take the tour again' && await page.evaluate(() => window.__again === 1), tour);
      await page.evaluate(() => { const G = window.__m.GUIDE; G.offer = G.__offer; G.again = G.__again; });
      // the konbini's chips on its spot
      const chips = await page.evaluate(() => {
        const { world, player } = window.__m, shop = world.lawson?.shop;
        if (!shop) return null;
        const e = (world.lawson.experiences?.list ?? []).find((x) => x.kind !== 'sound');
        return e ? { x: e.x, z: e.z } : null;
      });
      if (chips) {
        await P.stand(chips.x, chips.z, chips.x, chips.z - 5);
        await page.waitForTimeout(1200);
        await P.shot('14-konbini-chips');
        const c = await page.evaluate(() => ({ open: window.__m.hud.menuOpen, n: document.querySelectorAll('.mh-menu [data-pick]').length, box: (() => { const b = document.querySelector('.mh-menu').getBoundingClientRect(); return [Math.round(b.left), Math.round(b.right), innerWidth]; })() }));
        check(`${way}: on the konbini's spot its choice shows as chips, on screen`, c.open && c.n >= 3 && c.box[0] >= 0 && c.box[1] <= c.box[2], c);
      }
      // a sound's name, the countdown, a toast: shown together to see they keep clear of each other
      await P.stand(0, 14, 0, 0);
      await page.evaluate(() => {
        const { shell, hud } = window.__m;
        document.querySelector('.snd').append(...['ぴよぴよ|crosswalk chick', 'カンカン|level crossing'].map((t) => { const [a, b] = t.split('|'); const el = document.createElement('div'); el.className = 'snd-pill'; el.style.animation = 'none'; el.innerHTML = `<svg viewBox="0 0 24 24"><path d="M4 10v4h4l5 4V6L8 10z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg><p><b lang="ja">${a}</b><i>·</i><em>${b}</em></p>`; return el; }));
        hud.flash('Off we go again. Follow Hachi', 5000);
        const tw = document.querySelector('.train-wait'); tw.textContent = 'Next train  ·  0:25'; tw.style.opacity = '1'; tw.style.setProperty('--p', '40%');
        hud.askForSound(true);
        void shell;
      });
      await page.waitForTimeout(500);
      await P.shot('15-labels-toast-train-pill');
      const over = await page.evaluate(() => {
        const box = (s) => [...document.querySelectorAll(s)].map((e) => e.getBoundingClientRect());
        const hit = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
        const groups = { labels: box('.snd-pill'), toast: box('.mh-toast'), tiles: box('.mh-btn'), map: box('.mh-map'), train: box('.train-wait'), pill: box('.mh-pill') };
        const bad = [];
        const names = Object.keys(groups);
        for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) for (const a of groups[names[i]]) for (const b of groups[names[j]]) if (hit(a, b)) bad.push(names[i] + ' x ' + names[j]);
        return bad;
      });
      check(`${way}: the labels, the toast, the tiles, the map, the countdown and the sound pill keep clear of each other`, over.length === 0, over);
      await page.evaluate(() => window.__m.hud.askForSound(false));
      // the postcard comes by itself when Hachi's tour is over (GUIDE.onTourEnd), over a held pause card
      await page.evaluate(() => { window.__m.shell.postcardSeen = false; window.__m.GUIDE.onTourEnd?.(); });
      await page.waitForFunction(() => document.querySelector('.mk-post-scrim.on'), null, { timeout: 20000 }).catch(() => {});
      await page.waitForTimeout(600);
      const came = await page.evaluate(() => ({ post: !!document.querySelector('.mk-post-scrim.on'), locked: window.__m.player.locked, pauseHidden: document.querySelector('.mh-pause').classList.contains('hidden'), msg: document.querySelector('.mk-post .msg')?.textContent }));
      check(`${way}: the tour's end brings the postcard by itself (the game paused behind it, its words the tour's)`, came.post && !came.locked && came.pauseHidden && /seen the whole town/.test(came.msg ?? ''), came);
      await P.shot('16-postcard-after-tour');
      check(`${way}: play: no page errors`, P.errors.length === 0, P.errors.slice(0, 4));
      await P.ctx.close();
    }

    /* ------------------------------ the controls, as numbers ------------------------------ */
    if (on('controls')) {
      const P = await phone(base, way);
      const { page, finger } = P;
      const { width: W, height: H } = P.size;
      await P.start();
      // an open stretch of road to walk on, facing along it; the guide's hello not in the way of the numbers
      await page.evaluate(() => { window.__m.GUIDE.greeting = () => null; });
      await P.stand(0, 14, 0, -40);
      await page.evaluate(() => {
        const m = window.__m, cam = m.camera;
        window.__lat = { moves: [], frames: [] };
        let last = cam.rotation.y, lastMove = 0;
        m.renderer.domElement.addEventListener('pointermove', (e) => { lastMove = performance.now(); window.__lat.moves.push([e.timeStamp, lastMove]); }, { capture: true });
        const tick = () => { requestAnimationFrame(tick); const y = cam.rotation.y; if (y !== last && lastMove) { window.__lat.frames.push(performance.now() - lastMove); lastMove = 0; } last = y; };
        requestAnimationFrame(tick);
      });
      const rest = await page.evaluate(() => window.__m.touch.state.rest);
      const sx = rest[0], sy = rest[1];
      const gait = () => page.evaluate(() => ({ ...window.__m.player.gait, x: window.__m.player.pos.x, z: window.__m.player.pos.z, yaw: window.__m.player.yaw, pitch: window.__m.player.pitch }));
      // one stick on the right (Tan, 2026-10-03): up walks on, across turns (no sidestep), resting bottom right
      let g0 = await gait();
      await finger.down(1, sx, sy); await finger.move(1, sx, sy - 60);
      await page.waitForTimeout(1500);
      let g1 = await gait();
      await finger.move(1, sx + 60, sy);
      await page.waitForTimeout(800);
      const g2 = await gait();
      await finger.up(1);
      check(`${way}: the stick rests bottom right`, sx > W * 0.6 && sy > H * 0.55, { sx, sy });
      check(`${way}: up on the stick walks on`, Math.hypot(g1.x - g0.x, g1.z - g0.z) > 1.5, { from: [g0.x, g0.z], to: [g1.x, g1.z] });
      check(`${way}: across turns you, with no sidestep`, Math.abs(g2.yaw - g1.yaw) > 0.4 && Math.hypot(g2.x - g1.x, g2.z - g1.z) < 2.5,      // (the walk winding down as the push goes across) { yaw: [g1.yaw, g2.yaw] });
      check(`${way}: the context button sits on the left, clear of the stick`, await page.evaluate(() => { const r = document.querySelector('.mh-act').getBoundingClientRect(); return r.left < innerWidth * 0.4; }));
      await P.stand(0, 14, 0, -40);
      // the look: a slow 200 px drag, a quick one, up and down; from the right thumb's side
      const lx = W * 0.3, ly = H * 0.55;
      let a = await gait();
      await finger.drag(2, lx, ly, lx + 200 * (way === 'land' ? 1 : 0.6), ly, 900);
      await page.waitForTimeout(350);
      let b = await gait();
      note(`${way}: while looking`, await page.evaluate(() => ({ han: window.__m.hanShow.running, suspended: !!window.__m.player.suspended, scripted: !!window.__m.player.scripted, a: window.__lat.moves.length })));
      const px = 200 * (way === 'land' ? 1 : 0.6);
      const slowDeg = Math.abs(b.yaw - a.yaw) * 180 / Math.PI;
      note(`${way}: look, slow ${px} px across`, { deg: +slowDeg.toFixed(1), perPx: +(slowDeg / px).toFixed(3) });
      check(`${way}: a careful drag turns 1:1 (${(0.0046 * 180 / Math.PI).toFixed(3)} deg/px)`, Math.abs(slowDeg / px - 0.0046 * 180 / Math.PI) < 0.03, slowDeg / px);
      /* a flick: headless Chrome acknowledges each CDP touch a frame late, so a real flick's timing cannot be sent;
       * the gain's curve and the glide are checked as they are: lookGain by its numbers, the glide by a lift at speed */
      const curve = await page.evaluate(async () => { const t = await import('/src/mobile/controls/tune.js'); return { slow: t.lookGain(0.2), mid: t.lookGain(1.2), fast: t.lookGain(3), L: t.TUNE.look }; });
      check(`${way}: the look's gain: 1:1 for a careful drag, rising smoothly to ${curve.L.fast}x for a flick`, curve.slow === 1 && curve.mid > 1.1 && curve.mid < curve.L.fast && Math.abs(curve.fast - curve.L.fast) < 1e-9, curve);
      a = await gait();
      await page.evaluate(() => window.__m.player.flick(900, 0));        // a lift at 900 px/s across
      const glide = [];
      for (let i = 0; i < 6; i++) { await page.waitForTimeout(70); glide.push(+(((await gait()).yaw - a.yaw) * 180 / Math.PI).toFixed(2)); }
      note(`${way}: the glide after a flick's lift at 900 px/s, degrees over time (70 ms apart)`, glide);
      const want = 900 * curve.L.yaw * curve.L.glide * 180 / Math.PI;
      check(`${way}: a flick's lift glides on a little (about ${want.toFixed(0)} degrees) and settles within 0.4 s`, Math.abs(glide[5]) > want * 0.6 && Math.abs(glide[5]) < want * 1.3 && Math.abs(glide[5] - glide[4]) < 0.3, glide);
      a = await gait();
      await finger.drag(2, lx, ly, lx, ly - 80, 600);
      await page.waitForTimeout(300);
      b = await gait();
      const upDeg = (b.pitch - a.pitch) * 180 / Math.PI;
      check(`${way}: dragging up looks up, a little slower than across`, upDeg > 8 && upDeg / 80 < slowDeg / px, upDeg / 80);
      // a tile answers a tap while a finger is down on the view
      await finger.drag(2, lx, ly, lx + 60, ly, 300, true);
      await P.pressOn('[data-b="time"]');
      await page.waitForTimeout(1200);
      const third = await page.evaluate(() => ({ ...window.__m.touch.state, tile: document.querySelector('[data-b="time"]').textContent.trim() }));
      check(`${way}: a tile answers a second finger while one drags the view (and it stays down)`, third.looks === 1 && third.tile !== 'Golden', third);
      await finger.up(2);
      // latency: a finger's move to the camera turned, in the frame's own time
      await page.evaluate(() => { window.__lat.frames.length = 0; window.__lat.moves.length = 0; });
      await finger.drag(2, lx, ly, lx + 160, ly + 20, 1600);
      const lat = await page.evaluate(() => { const f = window.__lat.frames, m = window.__lat.moves; const d = m.map(([ts, t]) => t - ts).filter((x) => x >= 0 && x < 1000).sort((p, q) => p - q); f.sort((p, q) => p - q); return { n: f.length, mean: f.reduce((s, x) => s + x, 0) / (f.length || 1), p95: f[Math.floor(f.length * 0.95)] ?? 0, max: f[f.length - 1] ?? 0, dispatch: d[Math.floor(d.length / 2)] ?? 0, fps: window.__m.perf.fps }; });
      note(`${way}: input-to-camera latency, ms (the finger's event to the frame that has the camera turned)`, lat);
      check(`${way}: the camera turns in the frame after the finger moves (mean under 17 ms at 60 fps, here ${lat.mean.toFixed(1)})`, lat.n > 20 && lat.mean < 20, lat);
      // a pause lets go of the stick
      await finger.down(1, sx, sy); await finger.move(1, sx, sy - 50);
      await P.pressOn('[data-b="pause"]');
      await page.waitForTimeout(300);
      const let0 = await page.evaluate(() => ({ ...window.__m.touch.state, locked: window.__m.player.locked }));
      check(`${way}: pausing lets go of the stick`, !let0.locked && !let0.stick && let0.push === 0, let0);
      await finger.up(1);
      check(`${way}: controls: no page errors`, P.errors.length === 0, P.errors.slice(0, 4));
      await P.ctx.close();
    }

    /* ------------------------------ the sound ------------------------------ */
    if (on('audio') && way === 'land') {
      const P = await phone(base, way);
      const { page } = P;
      await P.ready();
      const before = await page.evaluate(() => ({ ac: window.__m.sound.graph()?.ac?.state ?? 'none', session: navigator.audioSession?.type ?? 'n/a' }));
      check('audio: nothing sounds before a tap (no context yet)', before.ac === 'none', before);
      await P.finger.tap(P.size.width * 0.7, P.size.height * 0.4);
      await page.waitForTimeout(1500);
      const tune = await page.evaluate(() => { const s = window.__m.sound, t = s._theme; return { ac: s.graph()?.ac?.state, locked: window.__m.player.locked, theme: !!t, playing: t?.el ? !t.el.paused : null }; });
      check('audio: the first tap anywhere wakes the sound, and the title song plays on the start card (the game not started)', tune.ac === 'running' && !tune.locked, tune);
      await P.start();
      // an interruption (a call, Siri): the context suspended under us, in view.  Resumed by itself, or the pill; a tap brings it back
      await page.evaluate(() => { const ac = window.__m.sound.graph().ac; ac.__resume = ac.resume.bind(ac); ac.resume = () => Promise.reject(new Error('refused outside a gesture')); return ac.suspend(); });
      await page.waitForTimeout(1300);
      const pill = await page.evaluate(() => ({ ac: window.__m.sound.graph().ac.state, pill: document.querySelector('.mh-pill').classList.contains('on') }));
      await P.shot('17-sound-pill');
      check('audio: an interruption the phone will not resume by itself shows "Tap to bring the sound back"', pill.ac === 'suspended' && pill.pill, pill);
      await page.evaluate(() => { const ac = window.__m.sound.graph().ac; ac.resume = ac.__resume; });
      await P.tapOn('.mh-pill');
      await page.waitForTimeout(700);
      const back = await page.evaluate(() => ({ ac: window.__m.sound.graph().ac.state, pill: document.querySelector('.mh-pill').classList.contains('on') }));
      check('audio: a tap on it brings the sound back and puts the pill away', back.ac === 'running' && !back.pill, back);
      // away and back (the lock screen, another app): paused on the way out, awake on the way back
      await page.evaluate(() => { Object.defineProperty(document, 'hidden', { value: true, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
      await page.waitForTimeout(400);
      const away = await page.evaluate(() => ({ ac: window.__m.sound.graph().ac.state, locked: window.__m.player.locked }));
      await page.evaluate(() => { Object.defineProperty(document, 'hidden', { value: false, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
      await page.waitForTimeout(1500);
      const home = await page.evaluate(() => ({ ac: window.__m.sound.graph().ac.state, locked: window.__m.player.locked, paused: !document.querySelector('.mh-pause').classList.contains('hidden'), pill: document.querySelector('.mh-pill').classList.contains('on') }));
      check('audio: leaving pauses the game and suspends the sound; coming back it runs again (the pause card up)', away.ac === 'suspended' && !away.locked && home.ac === 'running' && home.paused && !home.pill, { away, home });
      check('audio: no page errors', P.errors.length === 0, P.errors.slice(0, 4));
      await P.ctx.close();
    }
  }
  console.log(bad ? `\n${bad} FAILED` : '\nall passed');
} catch (e) {
  console.error(e);
  bad++;
} finally {
  await done();
}
process.exit(bad ? 1 : 0);
