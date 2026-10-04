# Mobile lite (the pocket edition)

Tan, 2026-09-30: "Spin up a light version of the whole game, suitable for
mobile ... Remove any part of the game that is overkill ... Don't compromise
on the sound ... Don't disturb or change the desktop build."  AGENTS.md's
"desktop only" rule is lifted for this separate build only.

## Shape
- **A second page, a second build.** `m.html` + `src/mobile/*`, built by
  `vite build --mode mobile` into `dist/m.html` and `dist/m/assets/`
  (`npm run build` runs both passes). A separate pass rather than a second
  Rollup input: a shared input would have split the desktop bundle into
  shared chunks. Checked: `dist/assets/main-CSJqjHw2.js` and every other
  desktop asset are byte-identical to `main` (31ef8db); `npm run size`
  unchanged (4.82 MB, 1.51 MB before the first click).
- The page sits beside index.html (not in `m/`), so `./audio/` and
  the key art (`./keyart-1280.webp`, `-1920` by srcset) are the same files the desktop uses: no second copy of the
  sound, and sound.js's `BASE_URL + 'audio/'` needs no change.
- **Routing:** `config.js MOBILE.route` (false). index.html's head script
  already tells phones apart; with the switch on it sends them to `m.html`
  (vite writes `%S:mobile.route%` into the page). Off, today's card.
- **Shared files:** only additive and tree-shaken: `MOBILE` in config.js,
  `MOBILE_STRINGS` in strings.js, the route snippet in index.html, the build
  mode in vite.config.js, two npm scripts, a `_headers` block. No shared
  module's code changed; everything else is done from `src/mobile/`
  (subclassing the player, wrapping `<audio>`, config set before the build).
- `src/mobile/town.js` is world/town.js with three LITE changes (marked).
  Keep it in step when the town changes; `src/mobile/main.js` likewise
  mirrors src/main.js (hero views, time, Han's watch, Hachi's hello, the
  konbini, the view spot, tipsy) without the dev tools.

## What's in, what's cut
- **In, all of it:** the whole town and layout (Hachi's tour needs the
  whole town: the station and the crossing are 140 m from the konbini), the
  famous view at golden hour, Hachi, the konbini's scene, Han's RX-7 show,
  the trains and level crossing, walk signals, shrine, bench, pond, river,
  Deer Park gate, the map, three times of day, animals, petals.
- **Sound: untouched.** Same engine (core/sound.js), same files, same local
  places and mix. Around it (src/mobile/audio.js): the context is made in the
  start tap; `navigator.audioSession.type = 'playback'` before it (iPhone's
  silent switch); the engine's streamed `<audio>` (title song, store music)
  are made after an await, outside the gesture, so every later tap retries
  any that iOS refused and unlocks the rest; `touchend`/`click` resume the
  context after a call or the lock screen, and if the phone won't resume on
  return a "Tap to bring the sound back" pill asks. The trains already share
  the one context (QA-007).
- **Cut or lightened (lite.js):**
  - Mirrors (pond, river, paddies) off: each redrew the scene. The painted
    water under them (the desktop's own distance fallback) always shows.
  - Inverted-hull outlines (134) removed: the ink pass still draws every line.
  - No FXAA pass; ink + grade kept (they are the look). Internal size capped
    at 1.0 Mpx, supersampling up to 1.5x, stepping down to 0.85x when frames
    run under 26 fps and back up over 53.
  - Shadows: 1024 map over ±34 m (desktop 2048 over ±40), plain PCF,
    redrawn on a new 4 m square or every 2 s (desktop 4 Hz).
  - Draw distance 110 m, fog 30-105 m (desktop fog 60-300): the far edge
    is never seen. Static batches in 128 m cells culled by box; anything that
    moves by its sphere; small instanced kinds and detail cells at 36 m. The
    culler wraps `visible` so the game's own show/hide still works.
  - Petals 70 in the air, 110 from the trees (desktop 150 + 250); Hachi keeps
    3 distance fields (6).
  - Fuji at half its elevation grid (209 K -> 52 K triangles, same vertices).
  - Textures redrawn smaller before upload: 1024 px for the town, 2048 for
    the konbini (its labels are read up close); big static canvases and the
    static batches' vertex arrays freed once on the GPU.
  - The konbini's ~55 painted quads packed onto one 2048 page (one draw).
  - Batch shadow flags normalised (a basic material shows no shadow; a toon
    one receives): fewer batches per cell.
- **A leak found on the way:** `mergeStatic`'s returned `cullDetail` closure
  keeps its whole scope alive, including every mesh it merged away (~90 MB
  of geometry). The lite build drops `world.batching`; the desktop has the
  same leak (worth fixing there too: see the report).

## Controls
- Left 40% of the screen (lower 75%): a joystick where the thumb lands;
  the push is the pace, past 92% it runs. Anywhere else: drag to look
  (0.0052 rad/px). Mouse drag and WASD/arrows/E/F/M/R/N/1-3/Space also work,
  so the page can be tried on a computer.
- Buttons: paw (whistle), time of day (cycles golden -> night -> morning),
  map (tap it to close), pause. The hand appears bottom right only when
  something is there to do, with its name; a thumb aims loosely, so with
  nothing under the crosshair the nearest thing within 2.8 m and 34° ahead
  (or whose ring you stand in) counts.
- The konbini's choice: chips on its spot, tap one.
- Portrait works: the lens widens to keep ~42° across (vfov up to 80°), and a
  toast suggests turning the phone; landscape is the intended view.
- No pinch, double-tap zoom, scroll, selection or callouts; safe areas
  respected; hidden page pauses the game and the sound.

## Cards
- m.html paints the desktop card's look (art, name, sakura rule) at once as
  the loading card; when the town is built, compiled and drawn once, it
  becomes the start card: "Tap to start" starts the town and its sound in the
  same tap. The pause card: volume (the five steps), Resume, Back to the
  start, what does what, credits. No WebGL 2 or a lost context: a card
  (context loss is how phones take memory back: "Reload to walk on").
- Phones that report little memory (`deviceMemory <= 3`, Android) draw
  90 m, textures 512/1024.

## After Tan's iPhones (2026-09-30, second round)
Tan saw: Chrome for iOS (dev build) lost the GPU context ("The town was
put away"), and the production build didn't load in it; Safari on an
iPhone 15 played but looked "a little pixelated"; the paw, map and sun
needed several taps.
- **?diag** (src/mobile/diag.js): the context is made by us and its
  allocating calls wrapped, so every texture, buffer and renderbuffer byte
  is counted (an estimate: drivers pad). The panel shows the stage reached
  (with the JS heap at each stage on Chrome), renderer.info, the GPU
  estimate and peak, heap, DPR and canvas; it sits over the lost card, and
  the last reading is kept in localStorage (stages are written while the
  town builds too), so a load that dies says where on the next ?diag load.
- **Tiers.** light: any iOS browser that isn't Safari (Chrome, Firefox,
  Edge and the in-app ones social links open in), iPhones below the 14 Pro/
  15 screen (the 4 GB ones), Android web views and <= 4 GB, and any device
  that has lost the context here before (remembered). Textures 512 (konbini
  1024), no shadow map, 85 m, canvas at DPR 1 drawn inside at up to 0.7 Mpx.
  full: everything else; renders up to 2x / 2.5 Mpx, stepping down when
  frames run long. `?tier=light|full` overrides.
- **Streaming by distance** (both tiers): batches, moving things (trains,
  Han, the car) and the konbini's goods give their GPU copy back past
  far + stream (and the goods past 45 m from the store) and upload again as
  you come near. The CPU copies are kept for this, which is also what lets
  a restored context (webglcontextrestored) upload everything again and
  carry on: tested with WEBGL_lose_context. What's cut is GPU residency, not
  the build: the town is still built whole at load (its builders are
  monolithic; building per place would mean rewriting them), but its
  painted pages are shrunk as each part is built (the konbini, then the
  town before the atlas packs them), so the desktop-sized pages never all
  exist at once.
- **Programs**: core/toon.js keys every toon program by its shadow tint,
  which is a uniform: sharing one program per style cut 326 to 151 and the
  compile from 3.0 s to 0.2 s. Static batches' normals, colours and tints
  packed (48 -> 27 bytes a vertex).
- **Buttons** act on the finger's lift (pointerup, captured, a pressed
  state, a wider hit area): iOS sends no click for a tap made while another
  finger holds the stick or drags.

## Judgement calls
- Draw calls: the target was ~250. Measured 434 at the famous view, 375 in
  the konbini, 172-386 elsewhere. The rest is the town's material variety per
  128 m cell (each style and texture a batch); going below would mean
  re-authoring the batching (untextured far LODs) or cutting the town. At 4x
  CPU throttling the frame's CPU side still ran well over 60 fps in
  emulation, so the calls were left there; real-device numbers decide.
- Triangles in view ~1.0-2.1 M (target 0.8 M): the konbini's stock (520 K,
  drawn through the glass at the famous view) and the town batches. Kept:
  an empty-shelved store would break the famous view.
- Load: ~3.6 s of town building at 1x on the M2 (15 s at 4x CPU). The card
  shows from 0.35 s; the bar's glint runs on the compositor while it builds.
- Portrait kept playable rather than blocked (people open links upright).

## The pocket edition (Tan, 2026-09-30, after the iPhone 15 looked "extremely subpar")
The town smaller, what is left at full, desktop quality ("very crisp").
- **Kept, at desktop quality:** the famous view (NIPPON, Fuji, the car
  park), Hachi and his tour, Han's RX-7 show, the zebras and their walk
  signals, the level crossing and the station (plain local trains), the
  shrine and torii, the slow-life bench, ドンペン堂, the sakura round the
  famous view, the lots round the konbini and the zebras. Every place is
  still built, so Hachi's tour and every sound and place cue are the
  desktop's, unmoved (no sound needed a new home).
- **Cut:** the residential filler and the other shops (every lot outside
  `MOBILE.pocket.keep`, and the few inside it in `pocket.cut`, is a kitchen
  garden behind a block wall, flat toon colours, no texture: mobile/core.js);
  the Pokémon train (its 4096 x 1024 wrap); every other parked bicycle,
  crate, cone and capsule bank beyond 40 m of the famous views
  (`pocket.clutter`). Kept shops: five (the zebra corner's, the east
  zebra's two, one behind the store's west corner, the one by the car park);
  the two past the east corner stay because the famous view sees their walls
  over the store's shoulder (checked frame by frame against the uncut town).
- **Textures at the desktop's own sizes**, then each at the size it is seen:
  - The konbini (konbini.js): scripts/_mobile-seen.mjs plays the five
    visits, the famous views, the forecourt and the approach, and renders
    the store in id colours from every pose: the most each label, price tag
    and painted quad is ever drawn at, per kind of pose. The GPU holds one
    **level** at a time, packed from a CPU-only master: the visit playing
    (what it hands you at the whole 192 cell), `near` (outside within 15 m
    of the middle) or `far`. Each level has its own layout; the stock's,
    the tags' and the quads' uvs are rewritten from the master's on a change.
    Before (one scaled copy per distance): 84 MB in the store, 21 at the
    door, 9 at the famous view; now 58, 26, 8 (labels + tags + signs and
    posters), and sharper at the glass and from the famous view (the half
    and quarter copies were below what those poses showed for dozens of
    labels and most of the signs).
  - From inside the konbini, every town page is at most a half
    (texLod.store): the town is seen through the glass, metres off, while
    the visit walks you to a shelf (-48 MB in the store).
  - The painted weather (kit/paint.js wearAtlas, soft grime on every wall):
    1024 instead of 2048 (-16 MB everywhere). Side by side on a wall at 4 m
    the two can't be told apart.
- **Vertices in 16 bits**: the static batches', the trees' trunks' and the
  konbini's stock positions over each mesh's own box (the box's middle and
  size moved into the mesh's transform: 1 mm over a 64 m cell); the stock's
  uvs too. A unit taken off the shelf rewrites its float copy, carried into
  the 16-bit one. -15 to -20 MB of buffers near the store.
- **Streaming**: into the store, the town behind the walls streams out in the
  same frame the visit's pages come (they came a frame early: a 352 MB spike);
  out again eating, the near level with the product in hand whole; at load
  and on any jump (the start again, a famous view) at once, so a new place's
  pages never land on top of the old ones (the load peak fell 286 -> 217).
- **A bug found on the way:** the far tree lines (groveCanopyFar, instanced,
  under 40 m across) were culled as small props at 36 m, so from anywhere
  in the town they stood as bare trunks. They are drawn to the draw distance
  now. Tan's brief said to cut them for a painted backdrop: a flat silhouette
  mass and a coarse flat-colour version were both tried and both read worse
  (slabs from along a line; faceted lollipops); the far groves are one
  shared 512 texture and a few draws, so they stay as the desktop draws them.
- **Tiers.** full (Safari on the 6 GB iPhones): render 2x, draw 100 m.
  light (Chrome and the in-app browsers on iOS, the 4 GB phones): the same
  textures at the sizes its pixels need, render 1.35x (from 1.5), draw 52 m
  (fog 16-48), town pages a quarter beyond 24 m (full within 18), shadow map
  1024: far detail and pixels go before any texture near you blurs.
- KTX2/Basis for the konbini's pages: not shipped. The label pages are
  painted at load from code (AGENTS.md: visuals built in code), so a
  compressed page would mean either a transcoder in the bundle (~200 KB of
  wasm) and encoding at runtime (seconds on a phone), or shipping baked
  images (against the rule). With the levels the store's pages are 51 MB at
  their largest; UASTC would make that ~13 MB but blur the small text of
  labels, ETC1S far worse.

### Measured (?diag GPU estimate, emulated iPhone 15 in Chrome, 2026-10-01)
WebKit through Playwright was not used: the counts are the page's own
(diag.js), the same in any engine; the phone's real total adds the canvas's
own buffers and driver padding.

| place | mobile-lite 3cbd26e | first pass | now, full | now, light |
|---|---|---|---|---|
| famous view | 285 | 311 | 221 (portrait 208) | 175 |
| konbini door / the choice | 315 | 317 | 235-251 | 175 |
| in the store (a visit) | 324 | 356 (peak 352) | 213 | 153 |
| zebra | 302 | 302 | 224-235 | 178 |
| ドンペン堂 | 323 | 316 | 233-249 | 161 |
| shrine | 330 | 319 | 199-230 | 153 |
| station / train wait | 289 | 276 | 172-184 | 141 |
| crossing | 286 | 252 | 165-181 | 138 |
| bench | 298 | 220 | 146-175 | 124 |
| load peak | ~290 | 286 | 222 | 180 |
| peak over a whole play | 330 | 356 | 253 | 185 |

(3cbd26e rendered at CSS size with 1024 px pages: more memory for a softer
picture. Ranges: the two harnesses stand at slightly different spots.)
- Before/after screenshot pairs (landscape and portrait) of the famous view,
  the zebra, ドンペン堂, the shrine, the bench, the station, the crossing, the
  choice at the door and a visit; the station's countdown after.
- Flow, both tiers: start by tap, walk, Hachi's whistle (tap) and his tour,
  a konbini choice (tap a chip), the train's wait and arrival, Han's show:
  no console errors, no lost context.
- Desktop: every asset byte-identical to a build of main; index.html differs
  only by the (off) phone route.

## Pocket diorama

### Lead / foundation (builder 1)
- Entry: m.html loads src/mobile/boot.js, which plays the Pocket Town
  (src/mobile/pocket/game.js) when config.js MOBILE.pocket.on (on), else
  the old pocket edition (main.js, kept as is). ?pocket=0/1 picks by hand.
  The old town's MOBILE.pocket keys (keep/cut/clutter) stay beside `on`.
- One tier, full DPR (up to 3): the frame is the phone's own pixels
  (pixel budget 3.6 M); the scale steps down by 0.25 only while 2 s of
  frames average under 50 fps (to 1.5 at the least), back up over 57.
  The old tiers (light/full) are not read by the pocket game.
- The street is flush: asphalt y 0, block pavements 3 cm, kerb stones
  10 cm drawn but never stepped (heightAt is 0 everywhere), so every
  place's ground(x, z) = 0 holds and no goods sink into a raised pavement.
- No pavement in front of the konbini (x -12..12): its forecourt meets the
  kerb at a dropped kerb line (the plan's car park reaches z -1; the street
  is 6.8 m wide, so the car park's base is my asphalt to z -3.4).
- The famous view at (0, 16) is 10 m south of the street: an open
  photographers' lot (coin parking, x -14..14, z 5.8..26) stands there, as
  on desktop; the rest of the south side is a block wall with two rows of
  plain houses behind it (one batch each: walls, roofs, windows).
- Han's corner at x -60 is a gravel farm road from the street to the lake
  shore walk; the paddies lie either side of it (west -88..-62, east
  -58..-44, z -44..-8), the shore walk z -52..-44 (the bench at -48 on it).
  The plan's paddies box -88..-56, z -50..-8 moved for the road and the
  bench.
- Zebra walk signals (unassigned in the plan): the lead's, two simple
  pole-and-head signals, 18 s green (walk-piyo through sound.walkSignals),
  5 s blinking, 25 s red.
- Horizon: one vertex-coloured unlit ring (treeline at 210 m, the lake's
  far shore at 720, hills at 600/900/1250), dipped to 18% round Fuji's
  bearing; recoloured only when the fog colour changes.  No textures.
- Ambience: the engine's own beds (wind always, birds by day, night-insects
  at blue hour) are already global and follow the look; there is no frog
  or lake file, so the lake adds none.
- Hachi: animals/guide.js is built into the desktop town's frame and grid
  (TOWN bounds, the store's rect, the road network), and editing it would
  change the desktop bundle; the pocket has its own small mind
  (pocket/hachi.js) on the same shiba (shiba.js rig, shade.js Herd, its
  voice): follows you, and on the whistle leads you along the street to
  the nearest unvisited place's spot.

### Controls (builder 5, 2026-10-01)
Files: src/mobile/pocket/controls/* (tune, settings, labels, spots, index),
touch.js, player.js, hud.js, audio.js, m.html's start card, MOBILE_STRINGS.
- Joystick: lands wherever the thumb does in the left 45% (below the top
  22%); past 1.2 radii its centre trails the thumb, so it is never lost.
  Push to pace: dead zone 10% of the radius, then a stroll (0.3 of the
  walk, ~0.8 m/s) rising on a 1.35 curve to the walk (2.55 m/s); held at
  93%+ for 0.4 s it breaks into a run (5.1 m/s), eased over ~0.35 s, and
  stays a run while the push is over 78%. The ring turns warm while running.
  Idle: a faint hint bottom left that fades out in ~4.5 s (CSS, no timers).
- Wall sliding: the body is now a circle against the colliders' boxes
  (core/player.js used an AABB push per axis, which snagged on corners);
  the wish loses only its part into the wall, and the rest is lifted toward
  the whole pace the more it slants (70 degrees into a wall glides at ~70%).
- Look: gain by the finger's speed, 0.75x slow (< 0.15 px/ms) to 2.4x for a
  flick (> 1.9 px/ms), coalesced samples, the first sample seeds the speed
  (a flick is only a few). Look speed 1-5 on the pause card (x0.6..x1.55),
  saved as takemebacktojapan-look. Pitch settles toward -0.03 rad after
  0.9 s of walking with no look (standing still, the view stays put).
- Buttons: three (whistle, time, pause); the map button went (the plan's
  max three). The context action is a pill with the spot's words, just
  above the right thumb's resting place; a quick still tap on the thing
  itself (a spot projected on screen, within 70 px and 7 m) uses it too.
- Sound labels: the engine is wrapped in place in the phone build only
  (core/sound.js untouched, desktop byte-identical): zones, one-shots, the
  konbini chime, the crossing's bells, the walk signals. A label shows when
  you come within near + 55% of (far - near), once per 45 s per name, a
  zone again only after leaving its far; never on a card or when muted.
- Start card: "Best with headphones" and a Sound check (two soft bell notes
  of our own, at the game's volume) that also unlocks the sound and does
  not start the game; portrait gets a "turn your phone" line.
- iOS audio: kept as was (one context, made and resumed in the tap,
  audioSession 'playback', the visibility resume, the pill); added a
  statechange watch for interruptions while in view: resume, else the pill.
- Tested in emulated Chrome (CDP multi-touch) at 844x390 and 390x844, and
  Playwright WebKit (synthetic pointers): stick + look + button at once,
  labels, spot by button and by tap, context loss and restore, no errors.
  CDP note for later tests: touchEnd lists the fingers that lift (an empty
  list lifts all; listing the remaining ones lifts those instead).

### ドンペン堂 and street (builder 3, 2026-10-01)
Files: src/mobile/pocket/places/donpen.js (+ donpen/tex.js, donpen/fixtures.js),
src/mobile/pocket/places/street.js.  Measured in a private one-place harness
(the lead's p-dev.html was not in yet), Chrome on the laptop, 2x.

- **The look.** Tan asked for the real discount palace's street face, so
  ドンペン堂 is no longer the desktop's silver-and-black front: a yellow crown
  board on a red frame ringed with bulbs, the penguin in a white disc, the
  tagline on a red ribbon, MEGA in blue block letters, the name in fat red
  letters outlined white and navy; first-floor windows papered with sale
  banners; a red canopy lettered with what's inside; a tall yellow blade
  sign at the east end (the end you walk up from); ペンちゃん (kit mascot)
  waving on the canopy beside two starburst boards.  Our name, tagline
  (爆安の宮殿) and mascot only: no real name, logo or mascot design.
- **圧縮陳列.** The desktop store's fixtures and goods (kit/megastore goods.js,
  its misc page of POP cards) on our frontage: gondolas, shelving carts,
  wire baskets, cut cases, dump bins, wagons, cartons, carts, pegboards,
  hanging rails, gold garlands, ~150 price cards (the end walls papered with
  them, a row dangling from the canopy).  Goods spill 0.85 m onto the
  pavement; 1.75 m of it stays clear.
- **Only what is seen.** A 16 x 12 m box: the entrance 3.4 m deep with one
  aisle to look down; flanks carry the board again, a blue strip and posters.
  The front faces north, so by day it stands in its own shade (as it would);
  the signs and the inside are unlit paint and glow at night, with warm pools
  on the walk.
- **Paint.** One new page, 2048 x 1024 (11 MB with mips: ~125 px a metre on
  the board, what a phone at 3x needs from across the street), plus the
  desktop's misc (1024^2) and package (768 x 512) pages.
- **The theme** is declared, not started: `sounds: [{ donki-theme, door,
  near 6, far 26, level 0.6 }]` (heard at the zebra, silent at the konbini
  and the start).  The loader starts it.
- **Street.** Utility poles on both kerbs with crossarms, transformers and
  the wire web (two spans across the road); none in x -20..20 (the famous
  view, as the real store has no lines in front) nor over the railway.  LED
  lamps on every other pole (live colour, pools at night); three vending
  machines; five bicycles; seven planters; walk signals at the zebra
  (x -24) with the cuckoo, as the desktop's main-road zebra (east-west road,
  walked north-south); `dispose()` takes them out of WALK_SIGNALS.  The
  zebra's stripes are the lead's street (layout.js).
- **Sakura.** Three in the frame's classic look: two near the start whose
  crowns reach into the famous view's upper corners (trunks just outside),
  one at the zebra's north corner (street.js SAKURA_SPOTS, easy to move once
  the konbini stands).  The desktop's frame tree behind the store's corner
  would land in builder 2's small shop, so it is not used.
- **Cost.** ドンペン堂: 16 draws, 69k triangles, 22.7 MB, built in 120-220 ms.
  Street: 44 draws (sakura 7, vending 12), 55-150k triangles in view, 10.7 MB,
  140-195 ms.  Together 33.4 MB (budget ~35).  Statics merged by material
  (world/merge.js; 1100 and 400 pieces); the street in one cell (70k
  triangles are cheaper drawn whole than culled in pieces).  Desktop build
  byte-identical with and without these files.

### Crossing, shrine, bench (builder 4, 2026-10-01)
- Shared modules untouched (desktop and phone dist byte-identical to the base
  build). Where a desktop part keeps its pieces private or hard-codes the town,
  the pocket carries its own version in `places/crossing/*`:
  - the crossing (`gate.js`): line/crossing.js is sized to a 4.6 m lane on the
    desktop's double track; the pocket's is the whole street (asphalt 3.4 +
    walk 2.4 each side), one track, two barrier machines per approach (one
    from each kerb, each arm over half the street, as wide roads have them).
  - the service (`service.js`): line/service.js is two sets on TOWN.station /
    TOWN.rail; the pocket's is one set, the plain local ('box', 各停 富士山),
    southbound only (its doors open on the platform side; a northbound set
    would open toward the fence). Cruise 16 m/s, dwell 40 s, headway 90 s,
    warn 14 s. The set never leaves until the arms are fully down: an hour
    simulated, 28 runs, the arms down on every frame a train was on the
    street, at least 14.8 s of bells before it, closed at most 23 s.
  - the bench (`bench.js`): land/slowlife.js builds round 鏡池 (its tree and
    lantern would stand in the pocket lake); its bench, jizo, lantern and
    moving life are carried over, SLOWLIFE's tunables reused.
- The platform is z -12.6..-48.4 (the plan said -14..-46): the two-car set
  (40.2 m) must stand with its front 10.4 m short of the street so the gates
  open while it waits, and its end doors still meet the platform.
- Walkable tops (the platform, its steps, the crossing deck) are exported as
  `platforms` ([{ x0, x1, z0, z1, top }], world): the lead's heightAt should
  take them; colliders stop the player off the track either way.
- Rings: the train's spot (dim waiting ring, QA-010) and the bench's are drawn
  by the places themselves with world/experiences.js; the bench's spot says
  `ring: true` so the lead's HUD doesn't draw a second.
- The trees' shadow stand-ins (canopy `shadowOnly`) are made colour- and
  depth-less in the places until the pocket stage hides them like the old
  mobile main.js did. Tree sorting runs only when the ear moves 2 m.
- Sakura scales trimmed (shrine 1.2 + 0.95): ~140 k tris in view for the two.
- Numbers (Chrome, 852x393, own stats / meter delta vs _example):
  crossing 12.6 MB, ~35 draws without the train (+32 with it), 68 k tris,
  builds ~220 ms; shrine 9.9 MB, 37 draws, 176 k tris (+126 k shadow-only),
  ~150 ms; bench 2.5 MB, 24 draws, 125 k tris, ~110 ms. Together ~25 MB.
  Code: 43 KB minified, 16.7 KB gzipped (not in any bundle until the lead
  wires the pocket).

### Konbini (builder 2, 2026-10-01)
src/mobile/pocket/places/konbini.js (+ konbini/*) and smallshops.js.
- **The store is the desktop's own** (world/lawson.js buildLawson: shell,
  NIPPON band, glass, nobori, bins, interior, fridge doors, self-checkout,
  store/shop.js's scripted visit), built in its own frame (glass at local z
  0, front +z) and placed by the loader at (0, -10).  Nothing shared was
  edited: what the pocket does not want is let go after the build, before
  anything uploads (the desktop's ground: road, far kerb, coin lot; the
  desktop's famous-view ring).  Desktop bundle untouched by construction
  (only files under src/mobile/pocket/places/ added).
- **The car park is ours** (konbini/carpark.js): the desktop forecourt's
  materials and paint (bays, wheel stops, the zebra walk from the door,
  the dusk pool of window light) cut to the layout's 6.6 m from the glass to
  the kerb (layout.js: no pavement in front of the konbini), x -12..12.  The
  bays are 3 m long, not the desktop's 5.3: the plan's street is closer.
- **Unseen stock does not exist** (konbini/seen-tool.js -> seen.js, prune.js):
  each unit drawn in its own colour behind everything opaque, from the five
  visits frame by frame and 8340 poses outside (car park, street, its ends,
  five headings, three pitches).  Only 106 of 6164 units are never seen
  (through the glass nearly the whole store shows from somewhere), so the
  real saving is the next item.  A planogram with another unit count keeps
  everything (guarded); rerun the tool after a planogram change.
- **The stock drawn indexed and trimmed** (konbini/compact.js): each unit's
  distinct vertices once, an index, and not its back and bottom faces
  (toward the shelf's back and board: never seen; what you hold is the
  product's own geometry).  The desktop's arrays stay on the CPU and every
  write the shop and the label levels make is carried into the copy.
  Stock buffers 19.3 -> 13.3 MB, triangles 0.54 M -> 0.34 M.
- **Outside pages at the size seen** (konbini/pagelod.js, also the shops):
  the band (4096), six 512 x 704 food posters, banner, flags, plates keep
  their painting on the CPU; the GPU copy is the share the nearest surface
  needs from the camera (halves down to an eighth; one-sided pages seen
  from behind, as the posters are from inside, go small).  21.8 MB at full
  -> 2.4 MB from the famous view, full at the glass.
- **Fewer draws**: the 11 glass doors no visit opens are static batches
  (one shared material); the entrance leaves one draw each frame; 81 -> 54
  meshes for the konbini.  Small shops 36 meshes; their atlas
  (mergeStatic atlas) halved draws but cost +6 MB, not taken.
- **A bug fixed on the way** (mobile/konbini.js levels + store/shop.js): what
  you hold is drawn with a clone of its shelf material made at the first
  visit; the next visit's level freed that clone's page, so from the second
  visit on the item in hand was black.  The place re-points it each frame.
- **Kept as is, over the 60 MB aim inside the store**: the visit's label page
  (2.3-2.6 k square, ~33 MB) and quad page (~19 MB) are the old tool's
  measured needs at 2x; split by leg (in / after the take) the label page
  would only shrink for the Strong Nine and the ice (the walk to the till
  passes everything), so not done.  Halving the visit's pages to 0.75 of
  their size would save ~20 MB at a slight softness on the nearest shelves.
- **Small shops**: makeShop + the shopfront kit's dressing by hand (kit
  buildShop wants a town lot): パン工房 こむぎ (bakery, awning, shelves) west,
  そば処 ふじみ (noren, blade, paper lanterns, bench) east, fronts a metre
  behind the konbini's glass; their room cards and glow at night, the loader's
  night pools.  The bakery gets no menu board (its art is a noodle menu).

### Measured (my harness: Chrome, 852 x 393 at 2x, the lead's pipeline; place's
own GPU = total - the empty stage's 44.3 MB; includes the shared 5.3 MB wear page)
| where | konbini + car park + shops |
|---|---|
| famous view (0, 16) | 38 MB, ~120 draws (scene pass), 0.35 M tris |
| the spot at the door | 61 MB |
| in a visit (sandos, onigiri / Strong Nine / ice) | 84-90 / 76 / 65 MB, 45-70 draws |
| eating outside | 63 MB, 0.04 M tris facing the street |
| small shops alone | 4-6 MB, 36 meshes, 8 k tris |
Build ~0.8-1.1 s here (desktop store 380 ms, label pages 190-240, stock
150-180, batching 50).  Every visit plays with its sounds: auto-door,
lawson-chime, store-bgm inside only, fridge-door (Strong Nine), the take,
kiosk-scan, kiosk-pay, ka-ching, chime out, wrapper / can-open, bite,
munch / gulp; the spot re-arms after.

### Integration (lead, 2026-10-01)
- Merged: controls (builder 5), ドンペン堂 + street (3), crossing + shrine +
  bench (4), konbini + small shops (2).  The street's walk signals
  (WALK_SIGNALS, kakko) replace the lead's; the crossing fences its own
  track (the lead's fence went); pavements raised to the kerb (0.15) as the
  street and ドンペン堂 assumed, heightAt says so and takes the places'
  `platforms` (the platform, its steps, the crossing deck).
- Load: the konbini, small shops and street build before the first frame;
  ドンペン堂, the crossing, shrine and bench (none in the famous view)
  after it, one a frame, behind the start card (MOBILE.pocket.defer).
- Memory: the wear page at 1024 before anything uploads it (-16 MB), the
  shadow map 1536 over 64 m (the old pocket edition's; -14 MB), Fuji on its
  half grid (lite.js liteFuji: 211 k -> 54 k triangles; ?fuji=full for the
  whole grid).  In the konbini the crossing, shrine and bench give their
  GPU copies back (MOBILE.pocket.hidden) and upload again as you step out.
- The lake was under the far ground plane (y -0.35 vs -0.02): it sits at
  -0.012 now, a grid pulled to the shore, darker and bluer near you.
- Known over budget: in a visit ~164 MB GPU (target ~150).  Builder 2's
  offer: the visit's two pages at 0.75 (-~20 MB, slightly softer nearest
  shelves); not taken (Tan's call: crispness vs the number).

## Mobile v3: UI (2026-10-02, Tan rated the last phone build 2/100)

Everything the player touches and reads on a phone, rebuilt; the world (a mini town from the desktop's own generator)
is the world build's, in parallel. Tan's five points, and what was done. Checked with `scripts/_mobile-ui.mjs` (real
multi-touch through CDP on an emulated iPhone 15, 844x390 and 390x844 at 3x; screenshots of every card and control).

- **Split:** `src/mobile/shell.js` is the one object `main.js` talks to (`createShell({ canvas, camera, world, held,
  famous, onTime, onRestart })`, then `shell.ready()`, `shell.update(dt, { inStore })`, `shell.resize()`,
  `shell.setTime(name)`, `shell.setLost(on)`; it makes the walker, the sound engine, the HUD). `main.js` here runs it
  against the desktop's own town (`world/town.js`) as a harness: its lines are marked WORLD (to be replaced by the
  mini town) and SHELL (to be kept). The old pocket world files (`mobile/town.js`, `core.js`, `lite.js`,
  `konbini.js`, `pocket/`) are not on this branch.
- **Shared code unchanged:** the guide, the minimap, the sound labels, the train countdown, the postcard and its
  selfie are the desktop's own modules, imported as they are; what a phone needs differently is done from outside
  (words swapped in `STRINGS` at import, CSS in `m.html`, a capture listener on the postcard). The desktop bundle is
  byte-identical to main's.
- **1. Start card:** the key art over the whole screen (the 1.8x Hachi banner on its side, the portrait crop upright,
  Hachi sitting just above the sheet), the name in its sky, and a paper sheet: "A pocket-sized Japan. Best with sound
  on 🎧", Start, the Made by Tan row (`ui/maker.js` `makerRow`: Tan's face, Buy Tan a coffee first, X, GitHub, the
  site, each with `?ref=takemebacktojapan`), "Full town on desktop · Credits". The loading bar is in the same sheet.
- **5. Start and Resume only by their buttons**, as desktop: a tap anywhere else on the card only wakes the sound, so
  the title song plays on the start card. A tap outside the pause card does nothing.
- **2. Controls** (numbers in `controls/tune.js`, overridable from `config.js MOBILE.controls`):
  - *Stick:* a base that is always visible, resting bottom left with "Walk" under it until first used. A thumb landing
    anywhere on the left 46% brings the base to it (floating); past 1.25 radii the base trails the thumb; on the lift
    it glides home. The push is eased (22/s) so a thumb's jitter never reaches the walk; the walk eases to its pace
    (7.5/s) and to a stop (10/s). A half push strolls at 1.1 m/s, a full push walks at 2.55 m/s, and held 0.28 s it
    breaks into the run (5.1 m/s, eased over ~0.5 s; the ring turns gold).
  - *Look:* 1:1, 0.264 degrees a CSS px across and 0.195 up and down (a half-screen swipe in landscape is about 110
    degrees), lifted smoothly to 1.7x for a flick; the speed is taken from the fingers' own timestamps and every
    coalesced sample, so 60 Hz and 120 Hz screens turn the same. A flick's lift glides on (time constant 90 ms, about
    21 degrees from a 900 px/s lift) and settles; any new touch stops it. No pitch re-centring at all (the old build's
    settle fought the view of Fuji). "Drag to look" shows bottom right until it has been done.
  - *Buttons:* three labelled tiles top right (Hachi with the paw, the time of day with its name, Pause), 54 px with a
    wider touch area; they act on the finger's lift, each finger owning its button, so they answer while both thumbs
    are down. One context button above the right thumb with the action's own words and a pulsing ring.
  - *Aim assist, without turning the camera:* the context button takes what the crosshair is on, else the nearest
    thing to do within 2.8 m and 34 degrees of the view (or whose ring you stand in). Turning the view toward spots or
    Hachi was considered and left out: free roam is the point, and a view that moves by itself reads as a fault.
  - *The map:* the desktop's corner map, 96 px (86 upright), top left, with a "Map" tag; a tap opens the whole map. The
    whole map is the desktop's too, drawn for a big window, so on a phone it is drawn 1.6x the screen and panned with
    a finger (its labels crowded and overlapped at screen size); a tap closes it.
  - *Measured* (headless Chrome at 58-60 fps, the desktop town): the camera has turned 4.7 ms (mean; p95 6.6 ms,
    max 10 ms; 5.0 / 7.9 ms upright) after the finger's event is handled, i.e. in the same frame; nothing waits for
    a later frame. Speed after a full push: 1.8 m/s at 0.1 s, running from 0.32 s, 5 m/s at 0.9 s; after the lift
    3.1 m/s at 0.2 s, 0.1 m/s at 0.52 s. (CDP's touch emulation gives every finger the first finger's element and
    acknowledges each touch a frame late, so a button under a held stick and a flick's timing are checked with
    pointer events and by the numbers; see the script.)
  - *Desktop build:* every JS, font and data file of `vite build` is byte-identical to main's (8cc9948); `index.html`
    and `_headers` differ only by the phone route switch (off) and the `/m/` cache lines carried over from the
    pocket branch. 102 checks pass.
- **3. Pause card:** no "Look speed". The volume is a bar (the desktop's five settings: drag it or tap along it, heard
  at once, remembered), Resume, Back to the start, "Your postcard ✉" (a little postcard, glowing on every pause),
  the Made by Tan row, credits. Two columns on its side, one upright; it never scrolls at 844x390 or 390x844.
- **Postcard and selfie:** the desktop's postcard, opened from the pause card and by itself at the end of Hachi's tour
  (`GUIDE.onTourEnd`). On a phone: on an insecure page (http on the LAN) the browser has no camera to give, so "Add
  your selfie" says "The camera only works on a secure (https) page..." instead of failing; Save hands the picture to
  the share sheet with the file (iOS ignores `download` on a blob link), where the sheet takes files, and is called
  "Save or share"; the camera's blocked and missing words are a phone's. The live view was already `playsinline`,
  muted and started inside the tap.
- **4. Hachi parity:** the real guide runs unchanged. His hello's card is sized for a phone and says "tap the paw 🐾";
  the paw tile whistles (a ring goes out when he hears it); "Take the tour again" is the context button
  (`GUIDE.offer` / `again`, not while the postcard is due); the konbini's snack bits (`shop.onSnack`); the bench (the
  context button seats you, then offers "Stand up"; a push on the stick stands too); the postcard at the tour's end;
  the sounds' names with the desktop's own watcher and pill (`ui/soundLabels.js`; the old mobile copy is gone),
  beside the map; "Next train · 0:25" above the bottom edge; the mochi shop through its spot's own label and action
  (whatever the label says after the dot is the button: "Order a mochi ¥200" once that rework lands).
- **Sound on iOS:** the context is made and resumed inside every tap (touchend and click), the audio session is set
  to `playback` (the silent switch), streamed elements are unlocked in the tap; an interruption the phone will not
  resume shows "Tap to bring the sound back" (now over the cards too); coming back from the lock screen or another
  app, the context is suspended and resumed once more (iOS can return one that reads running and is silent).
- **Not done / to check on Tan's iPhone:** the feel numbers were tuned by measurement, not by a thumb; the selfie's
  camera and the share sheet were checked only as far as headless Chrome goes (no camera, no share sheet).

## Mobile v3: the mini town (world, 2026-10-02)
Tan rated the pocket diorama 2/100 (placeholder houses, a flat lake, a train out of thin air): "Based on the
latest desktop version, recreate a very small town, but the experience should be nice."  So the phone's town
is the desktop's own generator, kit and builders on a smaller plan; nothing is hand-built.

- **The plan** (src/mobile/plan.js, config.js MOBILE.plan): the desktop's plan with the block row south of
  lane 112 taken out.  Everything south of it stands 32 m further north: the plaza (z 94), the station, the
  line (z 130), the level crossing, Hachi's home, and lane 144 as lane 112; 鏡池 and the slow-life bench
  move up whole, and the paddies between the pond and the main road's shops are 29 m instead of 61 (three
  rows of plots, not five).  The pocket park's row is gone.  North of lane 80 nothing moves: the main road,
  the konbini, the famous view, the car park and Han's route, ぺったん堂, the river and the Deer Park gate,
  ドンペン堂, the shrine.  244 x 184 m (the desktop: 244 x 216), 63 lots (33 shops, 30 houses).
- **How one generator builds two towns.**  plan.js sets config.js before any world module is evaluated
  (boot.js imports it first).  Positions written into the shared builders as numbers (the pond's pines and
  houses, the animals' places, the specials) carry a mark in a comment: `144/*@dz*/` (a southern z) or
  `/*@mini A @*/B/*@@*/` (the mini town's value instead of B).  `vite build --mode mobile` rewrites them
  (vite.config.js miniPlan); the desktop build never does, and comments are gone from its bundle, so it is
  byte for byte main's (cmp: every asset the same, main-wTXaBEVN.js; index.html differs by the off route).
  Streets the two towns share take the desktop's seeds (TOWN.grid.desktop), so the same houses and shops
  stand on them.  src/mobile/town.js is world/town.js with the phone's hooks: keep it in step.
- **Not taken: a smaller town still.**  Taking the row between lanes 80 and 112 as well would put the shrine
  in the cone behind the konbini that the famous view sees; cutting x would cut the plaza or the car park.
- **Kept as on the desktop, where v1/v2 cut:** the water's mirrors (pond, river, paddies: small targets,
  drawn only by their water), real houses on every lot, the looks' own fog colours.
- **Fog and draw distance:** fog 55-145 m (desktop 60-300), nothing drawn past 150 m.  The far tree lines
  and the houses beyond the line are hazier than on the desktop: the one visible difference in the sheets.
- **Draw calls** (mobile/town.js mergeMini, lite.js): plain colours and the town's shared tiles batch in
  256 m cells (they cannot stream; a style is a draw or two a view); pictures of one place in a region atlas
  each (nine regions, a quarter-size page from afar); small pictures used all over in one shared atlas; big
  pages of their own in 64 m cells.  The crossing's, station's and shrine's loose siblings merged per parent;
  the konbini's 59 painted quads on one page (a quarter-size copy from the street).  Famous view 893 -> 548.
  Tried and dropped: copying shared pictures into every region (35 MB a region near you); a 100 k texel
  atlas limit (38 MB always resident).
- **Memory:** the frame's targets R11G11B10 instead of half-float RGBA (-24 MB at 3 Mpx; checked by drawing,
  else left); the konbini's label pages one mipmap smaller than the desktop holds them, and their small
  copies made one page at a time before the first frame (load peak 385 -> 333 MB); the standing stock packed
  and streamed; instanced kinds culled by where their instances stand (they were all measured at the origin:
  sleepers, shrubs and pigeons vanished 42 m from it).
- **Walking:** past the core's side fences the main road's verge is closed (the open strip there shows the
  railway cutting end on); spots for the shell come from world.interactables.
- **Integration:** the UI branch's main.js is kept as the shell's harness; the lines marked WORLD are the
  mini town's.  main (bus stop, z-fighting sweep, fonts) merged last.

### Measured (emulated iPhone 15, Chrome, 2556 x 1179 at 3x, the page's own GPU count; a busy shared laptop)
| place | full: GPU MB | draws (frame alone) | light: GPU MB |
|---|---|---|---|
| famous view | 290 | 517-548 | 220 |
| zebra and signals | 277-299 | 690 | 228 |
| konbini door | 331 | 633 | 270 |
| in a visit | 244-254 | - | - |
| shopping street | 313 | 430-460 | 228 |
| ドンペン堂 | 312 | 340-400 | - |
| plaza / station | 299-333 | 290-490 | 225 |
| crossing | 260-305 | 130-380 | 203 |
| shrine | 282-294 | 300-540 | 212 |
| bench / pond | 264-277 | 260-500 | 188 |
| river, edges | 255-266 | 95-165 | - |
| load peak | 333 | | |
Over the budget, said plainly: GPU 255-333 MB against ~250 (light 188-270 against ~180); draws 95-690
against ~300; the town builds in 3.1-3.6 s on this laptop when it is idle (first frame ~5 s) against ~3 s.
60 fps at 3x at the famous view and the streets when the laptop is free; the scale stepped down (to 1.5-2.25)
in Han's show and in portrait while other agents' browsers ran.  What would close the gap: the sign atlas and
ドンペン堂's page (24 + 16 MB) by region LOD of their own, the decal page (16 MB) cropped per cell, building
the south after the first frame.
- Flow (scripts/_mini-flow.mjs, by touch): start, stick, look, a konbini visit, the mochi, the train's
  wait, Han's show, the whistle, time, pause: all pass, landscape and portrait, no console errors.
- The gate: scripts/_mini.mjs draws the phone page and the desktop game at 69 spots (places, edges, the
  train followed out of sight both ways, night, morning) and a walk grid (175 reachable points x 8 ways).

## Mobile v3: budget (2026-10-02)
Tan: "Do smart work cutting the budget for the experiences, but not the experiences themselves ... Assess what's
heaviest, prioritise, and cut or reduce."  Measured first, then cut by weight; nothing on Hachi's tour looks
different up close (side-by-side sheets against the desktop at 69 spots, before and after).

### Measured (scripts/_budget.mjs; emulated iPhone 15, Chrome, 2556 x 1179 at 3x; the page's own GPU count)
What each system brings to the build before batching (its own pictures at full size with mipmaps, its vertices as
built), and how long it takes to build on this laptop:

| system | tris | buffers MB | pictures MB | build ms |
|---|---:|---:|---:|---:|
| konbini: stock and labels (5 label pages, 3 of price tags) | 397 k | 17.8 | 90 | 300-400 (the store) |
| konbini: painted signs, POP (59) | 2 k | 0.1 | 76 | |
| konbini: forecourt, sign band, shell, interior | 21 k | 1.5 | 23 | |
| shops (33; the shopping street and the main road) | 93 k | 5.8 | 29 | 360-440 (all 63 lots) |
| houses (30), their lots' fences, hedges, gardens | 156 k | 10.9 | 3 | |
| station (building, two platforms, canopies, 38 boards) | 28 k | 1.2 | 26 | 110-140 |
| line: track, catenary, fences, cuttings | 31 k | 0.8 | 1 | 35 |
| trains: the local, the JR set | 51 k + 49 k | 3.4 + 3.1 | 2 | 115-140 |
| level crossing | 4 k | 0.2 | 0.7 | 5 |
| houses beyond the line (the row the platforms look at) | 79 k | 5.5 | 0.2 | 80 |
| ドンペン堂 | 72 k | 3.6 | 12.7 | 125-150 (all specials) |
| mochi shop | 13 k | 0.3 | 1 | |
| shrine | 46 k | 3.7 | 2.3 | |
| pond, teahouse, bench; river, bridge; paddies; gate; land | 93 k | 3.4 | 10 | 190-230 |
| street furniture (poles, wires, signs, vending, bikes) | 167 k | 2.9 | 11.8 | 60 + 55 |
| sakura (63 trees, fallen petals) | 1044 k | 10.8 | 1.7 | 800-880 |
| other trees and shrubs, far groves | 398 k | 9.1 | 5.3 | 150-170 |
| cars, parking; Han and the RX-7 | 118 k | 9.2 | 4 | |
| animals, Hachi, his home | 135 k | 4 | 0.2 | 70 |
| roads, decals, edge fences | 44 k | 3 | 3.1 | |
| shared by several: the decal page (21), wear, tile skins | | | 47 | |
| batching (mobile/town.js) | | | | 550-650 |
| after the build: shell 360-470, pack 380-500, pages 250-340, compile 280-320, first frame 560-700 | | | | |

On the GPU at the famous view (267 MB): the frame's three targets 34.5, the shadow map 18, the konbini's near
label copies 24 (held all over town), the town-wide sign atlas 23.7, the decal page 16, the first region's own
atlas 10, the store's quad page (39 at the door), buffers 68 (batches 39, small props 17, stock 12).

### Cut, heaviest first
- **The konbini's pages at the size they are seen** (mobile/pages.js, a mark in store/pages.js): painted straight at
  their level (the far one behind the start card, the near one a few cells a frame as you walk up, let go as you
  leave) instead of whole and copied down.  -24 MB everywhere but the store, no 150 MB of painting at load.
- **Pages step by what the screen can show** (lite.js `density`, MOBILE.texLod.safe): a page's own texels a metre
  against the screen's pixels a metre give the distance for its half and its quarter.  The plaza: -30 MB (the
  station's 38 boards are whole only within reach).
- **Static batches indexed** (lite.js indexLocal): -11 MB of buffers.
- **Ink and grade in one pass**: a whole frame's target less (-11.5 MB) and one full-screen pass less.
- **Atlas pages as wide as packs them tightest** (a mark in merge.js; the konbini's quad page too): -9 MB.
- **The konbini's signs on two pages** (by the glass / deep inside: the deep one a half on the forecourt): -13 MB at
  the door.
- **Mirrors only while their water is on the screen** (lite.js lazyMirrors: an occlusion query): the pond's was
  drawn at the konbini's door, 66 m off through the whole town.  -100 to -230 draws at eleven stops, their targets
  given back.
- **Plain colours and the town-wide atlas: one batch a style for the whole town** (MOBILE.plainCell 0): -60 draws
  at the famous view.  Positions keep their floats in batches over 80 m (16 bits there were 4 mm a step, and 16
  poses flickered: `_zfight.mjs --phone`): +6 MB back.
- **One train set**, the plain local, both ways (emu.js `lend`): the JR set is not built (-3 MB, -60 ms).
- **Light tier: every painting at 0.75** (its frame has 0.7 of the pixels each way): -45 MB.
- **Load:** which cherries the famous views see is kept (sakura-seen-data.js, -0.3 s), the konbini's far pages
  painted behind the start card (-0.3 s).

### Not cut, and why
- **Single track, one platform, the station moved** (Tan's example): after the cuts above the station is not what
  costs (platform 225 MB, 345 draws; its pictures are whole only near them).  A single track would save ~60
  draws and ~0.15 s and make the station and the crossing differ from the desktop in every frame they are in.
- **Fewer lots, simpler houses off the tour:** 11 MB of buffers town-wide, but most of it streams by distance
  already; the row beyond the line is what the platforms and the crossing look at.
- **The konbini's stock and fixtures:** already only what a visit or the glass ever shows (store/seen.js).
- **The decal page (16 MB), the shadow map (18 MB), the frame's colour and depth (23 MB):** each would soften
  something underfoot or on every pixel.

### After (same harness; before -> after)
| place | full: GPU MB | draws | light: GPU MB | draws |
|---|---|---|---|---|
| famous view | 267 -> 213 | 521 -> 460 | 219 -> 136 | 423 -> 352 |
| konbini door (near pages in) | 313 -> 276 | 603 -> 442 | 265 -> 172 | 512 -> 349 |
| in a visit | 244-254 -> 222-231 | | -> 145 | |
| zebra and signals | 284 -> 224 | 690 -> 472 | 226 -> 140 | 609 -> 392 |
| Han, car park | 285 -> 219 | 538 -> 279 | 219 -> 134 | 511 -> 254 |
| mochi shop | 270 -> 210 | 202 -> 146 | 215 -> 128 | 200 -> 149 |
| shopping street | 296-300 -> 229-241 | 372-436 -> 344-393 | 224-244 -> 131-140 | 347-354 -> 292-303 |
| ドンペン堂 | 299 -> 237 | 342 -> 300 | 233 -> 140 | 306 -> 252 |
| plaza / station | 307-313 -> 230-238 | 289-493 -> 263-416 | 221-235 -> 129-142 | 249-333 -> 214-282 |
| platform | 299 -> 225 | 379 -> 345 | 207 -> 123 | 312 -> 272 |
| crossing | 298-316 -> 223-229 | 231-423 -> 213-358 | 192-206 -> 122-125 | 217-305 -> 201-270 |
| shrine | 279-290 -> 221-238 | 329-543 -> 272-472 | 208-235 -> 128-149 | 308-449 -> 241-372 |
| pond gate, bench | 272-287 -> 217-227 | 478-497 -> 316-319 | 208-227 -> 141-147 | 451-467 -> 293-296 |
| junction, bridge, gate bench | 268-286 -> 207-222 | 99-310 -> 101-209 | 201-219 -> 128-147 | 99-302 -> 102-203 |
| peak in the flow test | 333 -> 271-285 | | 270 -> 171 | |
Town built 3.3-3.9 s -> 2.9-3.5 s, ready 6.0-6.9 s -> 5.1-6.3 s (this laptop, other agents' browsers running).

**Still over, said plainly.**  GPU: under 250 MB everywhere on the full tier but the konbini's door (276: the
front sign page 18, near labels and tags 32, the town outside still whole) and the moments of walking in and out
(peak 271-285); the light tier is under 180 everywhere.  Draws: 100-472 against 300 (famous view 460): what is
left is the konbini (70), each tree species' three tones as three draws (60), the big shop signs one picture each
(40), a style's shadow variants.  Getting to 300 means one draw a species (per-instance tone), region atlases for
the big signs (+5-10 MB near you), and the konbini's fixtures folded: a day's work each, none a visible cut.
Load: ~5 s to the Start button against 3: the build is one pass (2.9 s), then packing, compiling and the first
upload (2.2 s); 3 s needs the town built in two parts (the famous view first, the south behind the start card).

### Checked
- Sheets against the desktop, 69 spots (scripts/_mini.mjs), full and light; a walk grid (175 points x 8 ways): no
  holes.  The konbini's labels and tags in a visit: as before.
- Hachi's whole tour on the mini town (a dev probe driving the guide with a follower): 40 legs, every place,
  both visits (his home, the shrine's fox), the nap at the gate after 451 s, never stuck, never through a wall;
  "the tour again" offered and taken.
- `scripts/_zfight.mjs --phone` (65 poses): 11021 solid flickering pixels and 21 poses over the limit -> 101 and
  none.  Besides the 16-bit positions: ドンペン堂's entrance end walls and floor, the bus shelter's bargeboards and
  the kennel's eaves stood in one plane with their neighbours (the last two flicker on the desktop too, 594 and
  35 px at the same poses, which its own pose list does not have): a few mm apart in the phone build only.
- Flow by touch (scripts/_mini-flow.mjs), landscape, portrait and the light tier: all pass, no console errors.
- UI (scripts/_mobile-ui.mjs, 65 checks pass): the title's face (TMBJ Title) on the start, pause and gate cards;
  the portrait start card shows Fuji's peak and Hachi's paws; the whole map opens on "you are here"; the
  postcard's share buttons at 390 px.
- `npm run build`; every file of dist/assets is byte for byte main's (83d4223); phone download 4.99 MB, 1.61 before
  the tap.
- To see on desktop one day: ドンペン堂's south side wall is a dark panel there and a pale one on the phone (as it
  was before this pass), and the two seams above.

## After this: the pocket town (2026-10-03 to 04)
The phone became its own smaller town in portrait (src/mobile/plan.js, pocket-lots.js; `@mini` marks), with a
two-thumb panel, Walk with Hachi, its own key art, freed canvases and decoded sounds, and no Han, ぺったん堂 or
Hachi's home. The record is in DECISIONS.md, from "The pocket town, portrait, smaller still". The phone's check is
scripts/_mini-flow.mjs (portrait); scripts/_mobile-ui.mjs (the landscape layout) was retired.
