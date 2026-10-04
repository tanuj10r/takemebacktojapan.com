# The experiences build (2026-09-28, launch the next day)

**On phones (the pocket town, m.html, 2026-10-04).** To do: the famous view,
the konbini, the train's listening spot, the slow-life bench, the shrine's
fox (Hachi's visit). To hear: the walk signals, ドンペン堂, the station, the
level crossing (from the plaza; no detour), the shrine's chimes. Not on the
phone: Han's RX-7, ぺったん堂, Hachi's home. Hachi's tour ends at the Deer
Park gate, then the postcard (src/mobile/plan.js; DECISIONS.md).

The town is Fujikawaguchikko (富士川口湖町), its station 富士川口湖駅
(docs/decisions/rename-and-sound.md).

**Two kinds (Tan, later on 2026-09-28).** Things to do (`kind: 'engage'`:
the konbini, the Nippon Fuji view, Han's RX-7, the train's listening spot,
the slow-life bench) keep the highlight in town and a diamond on the map.
Things to hear (`kind: 'sound'`: each zebra's walk-signal tune, ドンペン堂's
theme, the station, the level crossing's bells, the shrine's wind chimes)
have no highlight and no E; a speaker on the map. Gone: the shrine's
prayer, the megastore's confetti, boarding the train, the station master.

Tan (the owner; they/them) turned the game into a set of experiences in a
compact town. Read AGENTS.md and docs/BUILDERS.md first; this adds to them.

## The seven experiences, and two teasers
1. **Nippon Konbini**: the famous view, then in: four glowing hotspots (sando,
   onigiri, "Strong Nine" chu-hi, "Choco Wafer Jumbo" ice), a scene: choose one
   of five at the door, walk in, the right hand takes it, pay at a
   self-checkout with an IC card (no cashier), eat it outside.
2. **Han and the RX-7**: the actual Mazda RX-7 (FD, VeilSide Fortune kit) from
   The Fast and the Furious: Tokyo Drift, orange with the black side sweep; a
   stylised racer (not the actor's likeness) leaning on it; `E` plays the
   drift track and a short drift.
3. **Inari shrine**: detailed torii tunnel, fox statues, halls, wind chimes
   (heard in the grounds: a thing to hear).
4. **The station**: gates, ticket office, announcements (a thing to hear,
   mild over the plaza). Nobody works here.
5. **The train**: detailed, braking/pulling away; nobody boards. Step into
   the highlighted spot by its door on platform 1 to hear the in-train
   announcement.
6. **The discount megastore** (a MEGA Don Quijote homage, ドンペン堂): its theme
   as you pass.
7. **Slow life**: a bench by the paddies and pond, the flute theme.
8. **Osaka posters**: "tickets to Osaka, reservations open soon" (Dotonbori),
   at the station and at the Deer Park gate.
9. **Deer Park, coming soon**: the gate at the bridge road's end (exists).
10. **Hachi's home** (ハチのおうち, 2026-10-01): a place, not an engagement (no ring, no E): his own little garden
    across the level crossing (TOWN.hachiHome, animals/home.js), a paw on the map. Hachi's tour goes station, plaza,
    level crossing (he waits at the barrier while it is shut), his home, the shrine (in to the guardian fox), the
    slow-life bench, the Deer Park gate.

## Rules that changed tonight
- **People:** only the player's own hand and Han (and the animals). No
  one else (the cashier was replaced by self-checkouts, the station master
  removed, 2026-09-28).
- **Names:** close homages for brands (ドンペン堂, Strong Nine, Choco Wafer
  Jumbo). Tan's one exception: the car is the real Mazda RX-7 from the film.
- **Look:** today's cartoon cel look (the pond pass is the quality bar: Tan
  said "this is the kind of quality level you need to work towards in all
  aspects"). No bloom, haze or film effects; no src/core changes except where
  your brief says.
- **Cost:** the game must stay seamless from a URL on a normal laptop.
  Measure before/after (draw calls, triangles, frame ms, texture MB, npm run
  size). Guides: an experience adds under ~40 draw calls where you see it,
  a few MB, no hitch when it starts. Anything animated updates only near.

## The shared APIs (use them)
- **Experience spots** (src/world/experiences.js): `ctx.experiences.add({ id,
  name, jp, x, z, r, h, y, action, label, marker })` in your ctx's frame (the
  town's code gets the turned town frame, T). It draws the yellow glow ring
  and floating marker and hooks `E`. Returns `{ done(), setLabel(text) }`.
  A thing to hear: `ctx.experiences.add({ kind: 'sound', id, name, jp, x, z })`
  (the map's speaker only).
- **Sound** (core/soundBus.js; import `soundBus`): `soundBus.zone(name, { x,
  z, y, near, far, level, indoor })` for a place's looping track (world
  coordinates; convert with ctx.toWorld in the town frame), and
  `soundBus.oneShot(name, { x, z, near, far, gain })` for a one-off. Encoded
  tracks: han-drift, donki-theme, shrine-chimes, rural-flute,
  station-ambience, train-nextstop (plus the older ones in
  scripts/audio-cuts.json). New sounds: add a cut to scripts/audio-cuts.json
  (`src`, `ext: '.aiff'` for voices made with macOS `say -v Kyoko`), run
  `npm run audio`. Audio sources live in /Users/tanujr/DevSpace/takemebacktojapan/
  assets/audio (not in your worktree: symlink it).
- Everything else: docs/BUILDERS.md (ctx.add/collide/platform/update, cel(),
  Canvas2D signs with JP_ROUND/JP_BRUSH, one InstancedMesh per kind).

## Setup in your worktree
    git log --oneline -1   # must include "Experiences groundwork"; else: git reset --hard main
    ln -s /Users/tanujr/DevSpace/takemebacktojapan/node_modules node_modules
    ln -s /Users/tanujr/DevSpace/takemebacktojapan/reference/density reference/density
    mkdir -p assets && ln -s /Users/tanujr/DevSpace/takemebacktojapan/assets/audio assets/audio
    ln -s /Users/tanujr/DevSpace/takemebacktojapan/assets/fonts assets/fonts
    mkdir -p screenshots && cp -R /Users/tanujr/DevSpace/takemebacktojapan/screenshots/baseline screenshots/
    npm run audio          # public/audio for your dev server

## The loop (mandatory)
Shots: `node scripts/shots.mjs --spots <yours> --quick --size 1280x720
--scale 1` (runs queue on a lock; never kill another run). LOOK at every
frame close up; compare against the real thing; fix; repeat. Frozen frames
can't show motion: reason about it from the code and shoot key poses. Before
reporting: full-size shots, `node scripts/shots.mjs --spots hero --quick`
(guard < 0.5% for hero-1/2/3), and the walk check (copy
/private/tmp/claude-501/-Users-tanujr-DevSpace-lawson-fuji/a68fe900-411a-4400-b6e6-a7230fe711a7/scratchpad/walk.mjs
into your worktree's .shots/, point its paths at your worktree; all routes
stuck 0). Never leave Chrome or a dev server running.

## Finish
Commit on your branch as you go (small commits; end each message with
"Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"). Log judgement
calls in docs/decisions/<area>.md. Report: branch and worktree path, what you
built file by file, the numbers before/after, the guard and walk results,
absolute paths of your best full-size frames, and anything unsure.
