# Decisions

Judgement calls, newest milestone last.

## M0: Fork and strip

- **Planet removed, not disabled.** `planet.js` is deleted. The world was already
  authored flat and only projected onto the sphere at the end, so the
  projection, the player's spherical camera frame, the x-wrap and the P orbit
  view went with it. The lights now use fixed world-space directions, and the
  shadow camera follows the player.
- **Flat outer ground.** A large plane (±1200 m) sits 65 mm under the street's
  320 m terrain grid and follows the same `groundY` profile. It replaces the
  sphere as the ground beyond the grid. The fog hides where it ends.
- **Ink pass fix (`src/core/post.js`).** The ink edge test now uses the second
  difference of reciprocal depth instead of linear depth. Linear depth is not
  flat across a plane in screen space, and on a flat world the ground 40–100 m
  out, near the horizon, inked as a solid dark band. The planet hid this by
  curving the ground out of sight within about 30 m. For small depth steps the
  new term equals the old one, so silhouettes and creases ink as before
  (hero view compared before and after).
- **Train on a straight line.** The track is ±400 m. The train runs off one end
  in the fog and re-enters at the other (about a 30 s cycle). The crossing
  still triggers on the train's distance, not on a timer. It now starts at the
  far end, so the first thing seen is a full approach. The 3-minute interval
  and the tree-lined cuttings are M2.
- **Districts deleted.** Every named district, plus hills, tunnel, lake, canal,
  landform, planet, traffic, the housing sweep (`district.js`) and the e-bike,
  is deleted from the tree (history: commit de01898). The parts SPEC section 2
  lists as reusable are kept but unused for now (vehicles, streetprops,
  housing, shotengai, shops, details), together with the files they import
  (ground, showa).
- **Kept in the build:** the street, the railway with its crossing and station,
  the train, the corner shop, and the houses, poles, wires, sakura, props and
  cat around the crossing.
- **Deferred to M2:** the shop fascia (青空商店) and the station and poster
  signs (ひばり台) still show names that are not ours. M2's acceptance list
  covers renaming them.
- **Title card:** renamed to the game's own title (then a working title; since
  Take Me Back to Japan) with minimal text, and the Chinese
  description replaced. UI strings are still inline in `hud.js`. They move to
  `src/data/strings.js` when the title screen is built (M7).
- **Audio:** the stock track is deleted and the playlist is empty. The game
  runs silently until M4. `public/audio/` and `assets/audio/` are git-ignored.
- **Known, not fixed:** a three.js warning that `flatShading` is not a property
  of `MeshToonMaterial` (from `toon.js`, inherited), and a 404 for
  `/favicon.ico`, which the page does not declare.

## M0 correction (Tan): the world starts empty

- **Empty world.** `main.js` now builds the world from our own `src/world/town.js`,
  which places only a flat ground plane (±1200 m) under the sky. Nothing else
  is placed: no crossing, train, street, houses, poles, trees,
  petals or props. SPEC M0's acceptance list and AGENTS.md were updated to
  match.
- **Base modules.** The remaining base modules in `src/world` (street,
  railway, train, shop, buildings, trees, petals, props, vending, vehicles,
  streetprops, housing, shotengai, shops, details, ground, showa) stay in the
  tree unimported. `index.js`, the base world assembly, is kept for reference,
  marked "not imported". The district modules already deleted in M0 stay
  deleted; they are in git history (de01898).
- **Spawn at the hero spot.** `src/config.js` sets the storefront centred on
  x = 0 with its glass at z = 0, facing +Z, and the hero spot 40 m straight
  back at (0, 0, 40), eye 1.6 m, yaw 0 (looking −Z, where the Lawson and Fuji
  will stand). 40 m is the middle of SPEC's 35–45 m range; M1 tunes it.
- **Sakura UI removed:** the fading hint line (which listed "R opening view"),
  the R reset-to-opening-view key, the H hint toggle, and the start card's art
  panel (level-crossing icon, "Nihonmachi · 05:42 PM", 春の日本街, 桜の季節,
  进入日本街, "3D scene · 2D animation spirit") with all its styling. The start
  card is now a plain placeholder until M7. Its text lives in
  `src/data/strings.js`.
- **Checked:** the production bundle contains none of 青空商店, ひばり, 踏切,
  Sakura, Nihonmachi, 日本街, 桜の季節, さかえ or "opening view". At runtime the
  scene holds only the sky dome, its cloud billboards and the ground.

## M1: Look-dev, the hero view

- **Hero cameras reconstructed from the photos.** The store is 4 m tall, so
  its pixel height in each photo gives a scale, and the eye height (1.6 m)
  gives the horizon. The real peak sits 10.3° up from the real Lawson (from the
  baked DEM), and that fixes the focal length. Day: 30.4 m back, vertical
  FOV 24.1° (35.8° across the photo's width, just over SPEC's 30–35° lens, and
  30 m back, not SPEC's 35–45 m). Blue hour: 23.4 m back, vertical FOV
  42.6°, a closer, wider shot. The photos win. The overlays confirm both.
- **Lens shift, not tilt.** Both photos keep verticals straight with the
  horizon well below centre, so the hero camera stays level and its projection
  is shifted (`HERO_VIEWS.shift`). The frame is matched on its height, so the
  composition holds at any aspect ratio. The R overlay fits the photo by
  height the same way.
- **The blue-hour photo is a different shot.** Its storefront is also square
  and centred, but its peak sits 1.5° right of centre, not 9.8°. So the
  photographer stood about 3.4 m further left, with the frame shifted back
  over the store. Hero 3 reproduces exactly that: x = −3.36 plus a horizontal
  lens shift. The storefront stays straight-on.
- **Golden hour uses hero 1's framing** (SPEC: the game opens on hero camera 1
  at golden hour). There is no golden-hour photo, so R shows real-day.png for
  composition.
- **Store size from the photos, not SPEC's 14 m.** The real store is 17 m
  wide and 4 m tall, plus a 2.6 m tiled section at the right end. The sign
  band is 0.62 m under a 0.42 m cap (SPEC: 1.2 m band). The entrance is
  2.3 m left of centre, behind the zebra walk, as in both photos. The
  wordmark is blue on a white panel, as photographed (SPEC: white wordmark).
  The milk-can logo is on the plate above the door and on the side band with
  ローソン. Depth stays 10 m for M3.
- **Street plan from the photos:** a 10.5 m forecourt (bays 2.7 m), a 6.7 m
  road, and the far kerb with its tactile strip at z = 17.2. Beyond that, a
  sidewalk and a paved lot where the photographers stand. M2 can dress the lot.
- **Fuji at "infinity".** The DEM (GSI dem_png z12, 384² grid, ±11.5 km,
  60 m cells, cropped to an 11 km disc whose edge is buried below the
  horizon) is rotated so the real Lawson→summit line points 9.8° right of −Z,
  and scaled so its angles are the real ones. It is drawn 1.4 km out and rides
  with the camera like the sky. At 16 km the real mountain does not move as
  you cross a 250 m town. Scale is true (`FUJI.exaggeration` = 1). The camera
  far plane is now 3.2 km and the sky dome radius 2.9 km.
- **Fuji shading** is its own shader in the toon idiom: two hard light bands,
  a posterised snow line (2,450 m, jagged, pushed down gullies using DEM
  curvature), faint painted ridge strokes where the bands meet on the snow,
  alpenglow and base haze. No outline and no ink-pass lines, as SPEC section 4
  says for Fuji (the ink pass fades out long before 1.4 km anyway).
- **Looks, not a cycle.** `LOOKS` in config.js holds day, golden and blue:
  sky, clouds, fog, lights, grade, Fuji colours and store glow. M6 blends
  these keyframes. Blue hour has no clouds (the photo is clear).
- **Sky.** The dome takes look colours plus a low glow band toward a bearing.
  Clouds use the same seeded ring pushed out behind Fuji (so it occludes
  them), at 0.55× angular size (at full size, a cloud filled the telephoto
  frame as one band), and lifted clear of the low sky around Fuji's bearing.
- **Gameplay FOV is 70° measured across 16:9** (about 43° vertical, held at
  every aspect). M1 first applied SPEC's 70° vertically, about 102° across,
  and leaving a hero view zoomed out about 3×. Tan flagged it. Now it is
  about 1.8×, eased over 1.6 s.
- **Fuji keeps its famous-view size in play** (Tan). In the gameplay lens the
  mountain is magnified across and up the line of sight (not brought closer),
  and its bearing spreads the same way (tan b × k). So Fuji sits exactly as
  large, and where, the day photo puts it on screen, wherever you walk
  (`FUJI.gameplaySize`, 1.0 = photo size).
- **No lens change in play** (Tan: no zoom-out on moving). Keys 1, 2, 3 and
  the spawn stand you on `HERO_VIEWS[].play` in the ordinary 70° lens, at the
  spot where the store fills the frame as in the photo. That is 16.5 m out
  (30.4 ÷ 1.85, in the road's far lane, by the kerb) for day and golden, and
  23.4 m for blue hour, whose photo lens is already about 43°. A slight
  upward look (0.16 / 0.09 rad) puts the horizon where the photos have it.
  With the magnified Fuji, the day view matches real-day.png almost exactly
  under the overlay. Moving never changes the lens.
- **One framing, three times of day** (Tan). The views are named morning (1),
  golden hour (2) and night (3), and all three stand on the same spot with the
  same framing. They differ only in look (day, golden and blue presets).
  Night no longer copies the blue-hour photo's closer, wider shot, and may
  differ from it.
- **The exact photo cameras stay, for look-dev only.** The dev R overlay
  switches to the exact photo lens (narrow, shifted, true-size Fuji) at the
  photographer's spot, and switches back when R is pressed again.
  `?lookdev` saves both: `hero-*.jpg` (what keys 1–3 show) and
  `hero-*-photo-lens.jpg` (the exact reconstruction).
- **Shadow map 4096, ±40 m,** centred 16 m ahead of the player, so the
  storefront 30 m from a hero camera is inside it.
- **Interior is a painted card** (back wall, gondolas under 1.6 m, drinks
  wall, ceiling light rows) behind real glass with shine streaks. M3 replaces
  it. Window spill on the forecourt is a hard-edged painted pool, on at golden
  and blue hour.
- **Screenshots:** `?lookdev` (dev only) frames each hero camera and writes
  `reference/lookdev/hero-{day,golden,blue}.jpg`. It also writes copies with
  the reference photo overlaid to `.shots/`. Those contain third-party photos,
  so they stay local.
- **Deferred:** parked kei cars, vending machines, bins, ashtray, bike rack,
  umbrella stand and the roadside pole sign (M2, with the town's props and
  colliders). The lone shopper (figures come with the clerk, M5). The kei van,
  the sign flicker and the wet road (M6). Sakura at the frame edges (M2).
  Nothing in M1 blocks Fuji or the sign.

## M2: Compact town

- **The famous views are protected by placement.** Tan approved low town at
  the frame edges. Nothing new stands in front of the storefront, the sign or
  Fuji's cone. Poles and wires stay out of the 70° frame or pass above it.
  The Lawson's vending machines and bins stand on its left side wall, hidden
  behind the front corner. Its parked cars use the outer bays. One wheel stop
  that would have edged into the bottom-left corner is left out. The two
  houses behind the store are single-storey, so they stay below its roofline.
  Pixel comparison against the approved M1 frames: mean difference 0.2/255
  over the storefront and 0.03/255 over Fuji (falling petals and the edges).
- **No poles along the Lawson frontage.** At golden hour the low sun laid the
  nearest pair's shadow across the sign. The real store has no overhead lines
  in front of it, so the main-road line runs from x ±44 outward.
- **Layout (config.js TOWN).**
  - Residential lane behind-left of the store, reached by a side lane.
  - Park behind-right.
  - Main road the full width of town, barricaded 通行止め at x ±118.
  - Shopping street 富士見通り商店街 west of the photographers' lot.
  - Side road at x 30 to the level crossing, with the station east of it.
  - Railway at z = 60.
  - Vegetable fields fill the open ground between zones.
  - Tree lines and a low fence all round. The player clamp sits on that
    fence, and roads end at visible barricades and guardrails.
- **Parts reused, re-signed.** Houses, shopfronts, poles, wires, sakura,
  groves, shrubs, vending, cars, props, the railway, crossing, station and
  train come from the base modules. Every sign name lives in
  `src/data/town.js`. The shared textures that carried other names
  (shop fascia table, station board, train destination, lanterns, a poster
  strapline) now read from it. The bundle contains none of ひばり, 青空商店,
  さかえ, 桜坂 or any other name that is not ours.
- **Railway placed whole.** The base railway module is authored round its
  own crossing, so it is placed as one part at (30, 60) through an offset context
  (`world/ctx.js`). The train is two cars, green and cream (a `livery` option
  on the part), and waits off-scene between passes: one every 180 s. Gates
  and lamps still follow the train's distance. The line leaves town between
  planted earth banks (the cutting), with fences and 線路内立入禁止 plates
  across the right-of-way.
- **Our own traffic signals** (`world/signals.js`). The library has none.
  They are Japanese horizontal heads with a glowing blue-green, plus
  pedestrian heads, at a zebra at x = -35.
- **Performance: static batching** (`world/merge.js`, SPEC section 11).
  - Static meshes are merged per material, per 128 m cell, so the camera and
    the shadow map can still cull.
  - Plain-colour toon and basic materials are folded into vertex colours,
    one shared material per lighting style. The toon shadow tint moved to a
    per-vertex attribute (`cel({ tintAttr })` in core/toon.js) so it doesn't
    split batches. The look is unchanged.
  - Materials changed at runtime are tagged `userData.live` and never
    folded: the store glass, lit interior and sign, signal and crossing
    lamps, and the ground.
  - The train batches inside itself, and the cloud ring into two draws.
  - Far tree lines are one instanced draw each, with coarser blobs and no
    shadows.
  - Before: about 2,000 calls and 5–7M triangles. After: 83–294 calls and
    0.61–0.73M triangles in every first-person view. The dev overview shots
    from 95 m up reach 322.
- **Petals follow the player:** 150 in a 48 m box (SPEC: 150 on High),
  instead of the base module's 980 along one street.
- **Measured (dev `?m2check`, headless Chrome, Apple M2).**
  - Straight end-to-end routes: 91–96 s at walking pace. A loop through
    every zone: 322 s. Nothing got stuck.
  - Fuji's peak is in line of sight from 87% of walkable sample points.
  - Frame time at 2560×1440: 6.7–7.1 ms.
- **Open question for Tan: walking time.** SPEC asks for a town of about
  250 × 200 m that takes about 3 minutes to cross. At the controller's walk
  speed (2.55 m/s), 250 m takes about 100 s, so the two numbers don't agree.
  The town follows the size; crossing it takes about 1.5 minutes.
- **Deferred.** Crossing bells and all other sound (M4). The kei van, sign
  flicker and wet road (M6). The Lawson's ashtray and umbrella stand; the
  umbrella stand belongs by the door, which is in the famous frame.
  Pedestrians.
- **Status:** built and checked, pending Tan's sign-off. Tan's first read:
  "kind of okay". Needs a review pass before M3.

## M2a: Town kit and screenshot script

- **Render-check loop** (`scripts/shots.mjs`, `npm run shots`).
  - Runs the Vite dev server through its API and drives headless system
    Chrome (`channel: 'chrome'`, Metal). It uses the system Chrome because
    the cached Playwright Chromium didn't match Playwright 1.63, and this
    way nothing is downloaded.
  - `?shots` freezes game time (dt = 0), so frames repeat exactly. Two runs
    of the heroes diff at 0.000%.
  - Heroes 1/2/3 are diffed against `screenshots/baseline/` (taken before
    any kit code landed). Over 0.5% of pixels changed is a FAIL.
  - Frame time: 30 frames at 2560×1440, render scale 1.5, with readPixels
    fencing, the same method as M2's `?m2check`.
  - The old `?screenshots` mode is gone; `?tour` and `?m2check` stay.
- **Reference frames renamed** to `reference/density/NN-what-it-shows.png`
  so spots in `SHOT_SPOTS` can name them. Still untracked, like every
  third-party reference image.
- **Kit shown on a dev-only test street (`?kit`)**, not in the town. M2a is
  the kit; M2b replaces the town plan, and a kit applied to today's zoned
  town would be thrown away. `kit-test.js` is tree-shaken out of the build.
- **Network model.** Axis-aligned edges on a grid (SPEC asks for a tight
  grid). Junction rules: x roads carry their pavement round a corner, z
  roads butt against it, and a lane mouth cuts through a pavement. So
  slabs never overlap and corners are never bare.
- **Road classes (config.js ROADS).**
  - Lane: 4.6 m, 0.36 m gutters with lids.
  - Shopping street: 6 m, 1.6 m pavements.
  - Main road: 7 m carriageway, 1.5 m green cycle lanes inside the kerb,
    2 m pavements.
- **Decals.** Everything flush with the ground comes from one Canvas2D atlas
  in one static mesh: paint, manholes (sewer, water, fire, telecom, and
  the town's own sakura-over-mountain lid), grates, gutter lids, patches,
  cracks, stains, grit, petal drifts and tactile tiles. Decals write no
  depth, so the ink pass never outlines paint.
- **Marking rules.**
  - At a junction, the lower-rank road stops; between equal ranks, the z
    road stops.
  - 止まれ is skipped where a zebra already fills the approach.
  - ◇ is painted 30 m and 50 m before a zebra.
  - Speed numerals: 40 on the main road, 30 elsewhere.
  - About half the lanes are school zones (with green side strips) or
    歩行者優先.
- **Poles.**
  - One side per street, every 20–30 m.
  - A transformer on every 3rd pole, a lamp on every 2nd, a 消火栓 plate
    (with a yellow lid in the road) on every 3rd, an address plate on
    every 2nd, and ads on about 45% of the rest.
  - Guards on every pole: the reference frames show nearly all poles
    guarded.
  - Wires: 5 power and 2 telecom lines per street (SPEC: 4–8). Straight
    on, all of them span a junction; round a corner, three power lines
    and one telecom line do. Service drops go to every facade.
  - `makePole` gained options (plates, guard, telecom, anchors, lit
    plates). Its defaults are unchanged, so the M2 town and the hero view
    are byte-identical.
- **Lit plates.** Kit signs and pole plates use toon materials, not unlit
  ones, so they go dark at blue hour like everything else. Only lamps glow.
- **Names.** Ads, the address (富士見町), direction boards and the bus stop
  are ours, in `src/data/town.js`.
- **Measured.**
  - Kit spots: 103–203 calls, ~280k triangles, 5.0–5.9 ms per frame at
    1440p on an Apple M2.
  - Heroes: unchanged (0.000%), 5.6–5.8 ms.

## M2b: Dense town

- **Plan (config.js TOWN.grid, world/town-plan.js).**
  - South of the main road, a grid about 190 × 135 m.
  - The shopping spine runs at x −50 from the main road to the station
    plaza; lanes run every 25–35 m; the railway moved to the south edge
    (z 158), with its level crossing on lane x −80.
  - The grid lines become a kit network (every crossing is a node), so
    the M2a kit lays and dresses every street.
- **The north side is M2's, unchanged (world/town-edge.js).** It is what
  shows at the edges of the famous views, so it moved out of
  town-blocks.js as it was. Everything south of the main road sits behind
  the hero cameras' image plane (z > 16.5) and was rebuilt freely.
- **The main road keeps the photo's cross-section** (6.7 m, lawson.js).
  - It is a network edge the kit dresses but doesn't pave (`surface:
    false`).
  - Its cycle lanes are blue 自転車ナビライン arrows with bike symbols
    (SPEC allows green or blue).
  - The south walk breaks for every road that meets it
    (`mainRoadGaps()`).
- **Golden-hour shadows set the rules near the hero view.** The sun is 14°
  up, from the east.
  - No poles or signs from x −30 to 55 on the main road (quiet zone);
    a pole there throws a 35 m shadow across the forecourt.
  - Lots from x 4 to 28 are one storey; from x 28 to 62, two.
  - Hero 2 differs from the M2 baseline by 0.357%: M2's two south-frontage
    poles (x −10, 20) are gone, and so are their shadows on the forecourt.
    M1 had neither. Heroes 1 and 3 are identical.
- **Lots and mixing (kit/lots.js, kit/buildings.js).**
  - Lots are 7–12 m wide with 0.5–1.5 m gaps, up to 14 m deep, so they
    meet back to back. Busier streets are cut first.
  - Spine and main road: 70% shop-houses. Lanes: 12% shops, 50% on
    corners. Trades are dealt from a shuffled deck.
- **Generators.**
  - Houses (kit/houses.js) have four styles on the library house:
    siding, mortar, old/kawara and modern. Attic houses, terraces and
    walk-ups add variety. Fronts are dressed by yard depth, and side walls
    get windows.
  - Shopfronts (kit/shopfronts.js) have 14 trades on the library shop
    unit. The recess is 1.9 m deep, with shelves, counter, washers or
    chairs and a lit ceiling panel. Clutter is chosen per trade.
  - All new names are in src/data/town.js.
- **Special lots (kit/specials.js).**
  - Inari shrine (富士見稲荷神社): two torii, foxes, lanterns, nobori and
    a small hall.
  - Coin parking (ふじみパーク): a corner plot, shrunk so a building and a
    pole stand within 25 m of its middle. The photographers' strip round
    x = 0 stays clear.
  - Apartment (ふもと荘): 2 floors, on the library walk-up.
  - Vacant lot (売地, 富士見不動産) and tiny park (ふじみ ちびっこ広場).
  - The plaza is paving, a big sakura, a ring of benches and bike racks;
    M2c brings the station.
- **Density check (kit/density.js; `npm run shots` prints it).**
  - It works from a registry the generators fill, because batching
    merges the scene away.
  - A building counts if any point round its footprint is inside the view
    cone within 25 m; there is no occlusion test.
  - "Bare" is measured along both frontages and down the asphalt of
    every kit street. Special lots, and quiet zones (the hero window, the
    railway), count as covered.
- **Walkability.**
  - The shopping pavement is 2.2 m, not 1.6 m, so a pole and a shop's
    clutter never meet across it. Poles stand at the kerb; pavement
    clutter has colliders of at most 0.3 m.
  - `?m2check` scans both spine pavements for a gap the player (0.34 m)
    fits through at every 0.25 m. Its walker now uses the carriageway,
    because it steers straight at waypoints.
- **Performance.**
  - A texture atlas at batch time (merge.js): multi-material meshes are
    split per group, and every non-repeating texture is packed into
    4096² pages with remapped UVs. Signage then batches by style.
    Street-level draw calls fell from 1,100–1,360 to 250–450, and frame
    time from 10.7 to about 7 ms. The Lawson opts out (`noAtlas`) so the
    famous view keeps its textures.
  - Kit wires use 8 × 3 tubes (M2's keep 14 × 4).
  - A distance-culled "detail" layer (small props in 32/64 m cells) was
    tried. It cut triangles by about 0.25M but added calls and time, so
    it is off. The hook (`userData.detail`, `detailCell`, `cullDetail`)
    stays for M2d.
  - Measured (headless Chrome, Apple M2, 2560×1440): 5.7–8.9 ms at
    every spot. Draw calls are 160–450 at street level and 550 from the
    overview. Triangles are 1.5–2.0M per frame, shadow pass included.
    **Over SPEC 11's budgets (< 300 calls, < 1M triangles)**: M2d's
    performance pass, with distance-based detail for far buildings.
- **Bug fixed in a base module:** `makeWall` made NaN geometry for any
  run under 0.9 m (n = 0). This was behind the console's NaN warnings,
  including M2's.
- **Names.** The walk-up's block plates carried ひばり台
  and さくら坂 names; they are ours now. `npm run check:names` builds and
  searches the bundle for 15 names: none.
- **Measured (`?m2check`).**
  - Walk routes: 0 stuck points on all four.
  - Fuji's peak is in line of sight from 67% of walkable points (M2:
    87%; the bar is "most").

## M2c: Station and trains

- **Layout (config.js TOWN.rail, TOWN.station).**
  - The line runs along the south edge: double track at z 160.1 (track 1,
    eastbound) and z 163.9 (track 2, westbound). Trains keep left.
  - The station building (x −64..−38, z 148–155) closes the plaza at the
    end of the spine. Its concourse is at platform height, up six steps
    from the plaza, and platform 1 is through its ticket gates.
  - Platform 2 is reached by an in-station crossing (構内踏切) at the east
    end, not a footbridge (SPEC allows either). It is lighter and can be
    walked end to end.
  - The public level crossing is on lane x −80, 6 m west of the platform
    ends.
  - Lane z 146 moved to 144, so the lots south of it stay 7 m deep.
- **Our own line.** The base railway module is single-track and
  built round its own street constants; `line/track.js` and
  `line/crossing.js` are new. `railway.js` and `train.js` stay as base
  modules, and `town-rail.js` (M2's placement of them) is gone.
- **Our own train (`line/emu.js`).** It keeps the library EMU's
  proportions, but every car is a shell:
  - side walls are built between the door and window openings, with a
    cream lining inside;
  - the interior is real: long bench seats, poles, racks, straps, lit
    ceiling strips;
  - door leaves slide into the wall pocket;
  - at night the interior glows (`setNight`, driven by the look).
  - **Passengers:** a few dark silhouettes, seated and standing. SPEC asks
    for them. The library train's "no people" note does not apply
    here.
- **Two sets, one per track.** One set can't manage the SPEC headway: it
  needs about 30 s to run out and 30 s to run back in, so the next arrival
  60 s after a departure has to be the other set. Each set runs out into
  the fog and waits there for its next turn.
- **Service timings (line/service.js SERVICE).**
  - Cruise 22 m/s; brake 1.0 m/s²; accelerate 0.9 m/s².
  - Doors open over 1.6 s; dwell 60 s; chime 1.4 s; doors close over 2.2 s.
  - The set holds 3 s, then departs.
  - The next arrival is timed for 60 s after the departure.
- **Crossing logic.**
  - For each set, the service steps a copy of its motion forward (0.25 s
    steps, 25 s horizon) to predict when the front will be within 4 m of
    the crossing. That covers cruising, braking to a stop short of it, and
    sitting at the platform about to depart over it.
  - The crossing closes under 25 s and stays closed while any part of a
    train is within 4 m.
  - Lamps and bells come first; the arms follow 5 s later, lower over 6 s
    and rise over 5 s. The direction arrows show which way the train is
    going.
  - Westbound trains stop 10 m short of the crossing, so the gates come
    down about 20 s before they leave: what real stations beside a crossing
    do.
- **Checked by `?traincheck`** (in `npm run shots`): 20 min of service in
  1/20 s steps.
  - Dwell 60.0–60.1 s; the chime always comes before the doors close.
  - Headway 59.6–59.7 s; tracks and directions alternate.
  - The crossing was open with a train within 4 m at 0 of 24,001 steps;
    lamps were off while the arms were down at 0 steps.
- **Sound, minimal until M4 (`core/sfx.js`).**
  - Crossing bells: positional, from assets/audio/crossing-bells.mp3 when
    it loads, else SPEC 9's procedural FM bell.
  - Door chime: an original three-note phrase.
  - Started by the same click as the music. M4 folds this into its
    engine.
- **Density at the station.**
  - Catenary masts register as poles (they are poles with wires). They
    stand every 20 m, skipping the level crossing and the ticket-gate
    aisles, plus one at x −42.
  - Added, as real stations have: a waiting room on platform 2, a toilet
    annex, a kiosk beside the entrance, a police box and a café on the
    plaza, a light by the steps.
  - A row of houses beyond the line, out of bounds, faces the tracks,
    like the reference frames.
  - `town-crossing` is retired: it was M2b's placeholder view of the same
    crossing, which `crossing-train` now covers from 12 m closer.
  - Several spots were re-aimed. The 25 m / 70° cone is strict at the
    edge of an open plaza, so each spot looks the way its reference frame
    looks.
- **Names.** Station 「さくら富士」 (M2); the line 富士見線; the stations in
  between (ふじみ台, こもれび野, 富士山麓) are ours, and the termini (大月,
  河口湖) are real towns. Also ours: ふじみ売店, 富士見交通 and the
  community bus plate. The base module's bus-stop plate said ひばり台;
  it doesn't now.
- **Measured.**
  - Heroes unchanged (1 and 3: 0.000%; 2: 0.356%, as M2b).
  - Frame time 6.0–8.1 ms at 1440p at every spot.
  - Draw calls rise to 500–650 where a train stands at the platform: the
    two sets, their glass and doors. Still M2d's performance pass.

## Local sounds (Tan, after M2c)

- **Rule, town-wide:** a place's sounds and interactive cues are heard only
  as the player nears that place, never across town. It is in SPEC
  section 9 and AGENTS.md, and M4 builds every positional sound on it.
- **Why:** the crossing bells faded out only at 180 m, so they carried to
  the Lawson (176 m away) and ticked through the famous view.
- **How:** config.js `SOUND` gives each sound a `near` (full volume) and a
  `far` (silent) range, with an eased fade between (`falloff` in
  core/sfx.js). Beyond `far` a sound is not playing at all.
  - Crossing bells: near 10 m, far 45 m. They carry to the plaza's south
    edge (23% at 34 m) and fade out by the middle of the plaza.
  - Door chime: near 5 m, far 28 m (the platforms and the ticket gates).

## M2d: town polish

- **Sakura.** The town south of the main road gets its own cherry
  (kit/sakura.js); M2's north side keeps the library tree, since it frames
  the famous views.
  - 4–7 limbs, each forking. Blossom clumps number 85 per tree (150 on
    hero trees), in three tones by height, with drooping outer clumps.
  - Hero trees (scale 1.5–1.9) stand at the plaza, shrine and park.
  - Every town tree is one wood mesh plus instanced blossom.
  - A clump is six small round balls merged: one sphere reads as a
    balloon, and a low-poly sphere reads as a gem. Beyond 40 m a clump is
    one ball.
  - Petal drifts are decals in a ring under each tree.
- **Petals.** The air field (150) is unchanged, so the hero frames are
  unchanged. A second field (250) falls only from canopies near the
  player: it respawns at a tree and never wraps around the camera.
- **Night** (kit/night.js, driven by the look's shop spill).
  - House windows: 55% lit warm (#ffd9a0), the rest dim violet.
  - Warm glow behind shop glass and station doors.
  - One additive mesh of light pools under lamps, shopfronts, vending
    machines, canopies and the station entrance.
  - The blossom keeps a little pink after dark.
- **Life** (kit/life.js).
  - 60 sparrows on the power lines and 4 crows.
  - Ground flocks in the park, plaza, shrine and vacant lot. They hop and
    peck, fly up to a wire within 3.2 m, and come back once the player
    has gone 8 m away.
  - Cats swish their tails.
  - Only birds within 32 m are animated.
- **Clutter.**
  - Shops: AC units and gas meters on their flanks.
  - Station front: downpipes, posters and vending machines.
  - Walk-road props sit on the kerb edge, with colliders no deeper than
    0.3 m, so every pavement stays walkable.
  - Idle people (optional) are not added: the triangle budget below does
    not pass.
- **Performance.** No visible quality cut, as AGENTS.md requires. Lossless
  changes only:
  - Train doors: only the platform side opens, so each car has two
    sliding groups (baked per material), and the far side's leaves batch
    with the body. This removes about 220 meshes.
  - Fences share one chain-link texture, with the tiling baked into UVs.
    The batcher now does the same for any texture clone that differs only
    in repeat or offset (merge.js `mapKey`/`uvBaked`).
  - Glow panels are no longer `keep`, so they batch.
  - Small props (the kit's `detail` tag) receive shadows but cast none.
  - Blossom: clumps outside the view cone (plus a 0.45 rad margin) are
    not drawn. They are re-sorted after a 2 m move or a 0.15 rad turn.
  - Blossom shadows come from stand-ins drawn only into the shadow map
    (`userData.shadowOnly`, main.js wraps `shadowMap.render`): the full
    clump within 30 m, one round ball beyond. Only those that can fall in
    the sun's shadow box are included.
  - A single ball (icosa 0) was tried as the shadow stand-in and dropped:
    its shadows showed as hexagons on the park grass.
  - 64 m cells were tried: 20–30% fewer triangles, but 40–50% more
    calls. Kept 128 m.
- **Measured** (shots, 1440p, Apple M2).
  - Frame time 6–12 ms at every spot: 60 fps passes with room.
  - SPEC 11 budgets do **not** pass at street spots:
    - calls 200–490 (overview 609);
    - triangles 1.1–2.5M, all passes;
    - main pass alone 0.75–1.54M.
  - Before M2d's performance pass, the lane view was 695 calls and
    2.92M triangles; it is now 492 calls and 2.27M.
  - The remaining calls are real material differences: toon band ramps,
    tints, live night materials, hulls.
  - The remaining triangles are the dense town inside 128 m cells, drawn
    in both passes, plus Fuji (209k).
  - Closing the gap needs far-building LOD proxies and a shared toon
    material. Neither is polish; both are proposed for a later milestone.
- **Heroes:** 0.000 / 0.356 / 0.000%. Density 27 of 27 and bare stretches
  pass; traincheck passes; check:names passes.

## M2e.3: the town moves between the Lawson and Fuji (Tan)

- **Why:** the game opens on the famous views, but the town lay behind the
  player, south of the main road. Tan wanted to walk *ahead* past the
  store into the town, toward Fuji.
- **How: a rigid half-turn, not a rebuild.** Everything that makes up the
  town is built as before, in its own tested frame, inside a context
  turned 180° about the main road's centreline
  (world/ctx.js `turned`: local (x, z) → world (−x, 27.7 − z)).
  - It is a rotation, not a mirror, so signs, text, stairs, the trains, the
    crossing's timing, lots and density all keep working as tested.
  - M2's old north side (the residential lane, park and fields) turns with
    it and now lies south, behind the start.
- **What stays in world coordinates.** The Lawson, its forecourt, the main
  road's walks, ends, signals and crosswalk, the Lawson's own dressing and
  the two sakura framing the view (town-edge.js `buildFrame`).
- **What crosses the boundary.** The only places the two frames meet:
  - colliders and platforms (ctx converts them);
  - the line's crossing and events, and train gusts (a facade in town.js);
  - the sakura and bird cameras (a turned camera proxy);
  - petal emitters, the Lawson's lot decals, and the density registry
    (kept in the town's frame);
  - shot spots (`frame: 'core'`, turned by `__shot`);
  - `PLACES` (`placeAt`).
- **A frame bug found and fixed.** The kit read positions with
  `matrixWorld`. Under the turn, the wire anchors, service drops, lamp
  pools and one registry point were turned twice, and the wires tangled
  across the sky. They now use positions in the builder's own frame.
- **The famous views' sightline.** From the hero camera the store's
  roofline is about 4.5° up, so behind the store, inside the frame:
  - buildings take a height envelope (floors from the sightline over each
    lot's nearest edge);
  - a 10 m pole would show until about 80 m back, so poles there are
    replaced by 4.5 m lamp posts (防犯灯) with no overhead lines, and houses
    there take no service drop (TOWN.lowPoles);
  - the apartment block lights its entrance with one.
- **The Lawson's ground is reserved** in the town's frame (TOWN.lawsonReserve).
  - The x −25 lane starts at the back of the forecourt instead of crossing it.
  - The coin parking moved west of the forecourt.
  - M2's two low houses behind the store went, because the town's own lots
    stand there now.
- **The famous views moved by 1.2–1.7%**, all at the frame edges beside the
  store (the town's houses behind its corners). Re-baselined, on Tan's
  standing OK for view changes during M2e.
- **Checks.** Density 27 of 27, bare stretches and traincheck pass; frame
  time 6–9.5 ms at 1440p.
- **Contention in timings.** Timings taken while the in-app browser pane
  was running the game read 2–4× slower. The pane is blanked for
  measurements now.
- **Next.** M2f (added to SPEC) draws the minimap from config.js PLACES.

## M2e Phase 3: the sakura, painted

- **What the reference does.** Its canopies are still faceted clumps; the
  difference is the paint. Florets over each clump, pink shading to lilac
  underneath, lacy rims with sky between, many thin twigs, and the ground
  washed pink under each tree.
- **Florets** (kit/paint.js `floretTex`). A tiling skin of about 900
  five-petalled florets with pale centres, over soft cluster blotches. The
  tones (light, mid, deep by height) are now pale; the florets bring the
  pink. The shade side is a soft lilac, and the new `blossom` ramp
  (202/230/255) turns a clump gently instead of in a hard band.
- **Cushions, not balls.** Clumps are flattened (y 0.55–0.7) and widened.
  Hero trees carry 200 of them, others 95.
- **Lacy rim** (`blossomCardTex`). Alpha-cut sprays of florets on twigs
  stand out past the outer clumps. They are instanced per tone, culled with
  the view like the clumps, and their normals face up and out, so both
  sides shade alike.
- **Wood.** Limbs bend: they rise to a knee, then reach out. Hero trees
  have 6–8 limbs spreading lower and wider. Three fine twigs fan out from
  every branch end, past the blossom.
- **Petal carpet** (decal `petalCarpet`, 2 × 2 cells). A pink wash, then
  9000 fine petals with a ragged edge, 6 m across under an ordinary tree
  and 8.4 m under a hero tree (× its scale), on top of the old drifts.
- **Every cherry is the painted one now.** The old park's trees join the
  town's batch. The two framing the famous view get their own small batch
  in the world's frame (town.js). The famous views changed 1.6–2.0% at
  their left and right edges; re-baselined.
- **Checks.** Density 27 of 27, bare stretches, traincheck; 5.5–9.7 ms at
  1440p.

## M2e Phase 4: greenery

- **One tree builder, many species.** The painted cherry's builder became
  kit/canopy.js, parameterised by a *look* (form, tones, skin, rim cards,
  ground). The sakura is one look (kit/sakura.js), and the refactor is
  pixel-exact: the heroes stayed at 0.000%.
- **Species** (kit/green.js), all painted with leaf skins and rim sprays
  (kit/paint.js `leafTex`, `leafCardTex`, `needleTex`):
  - zelkova, the street tree: a vase of upward limbs, fresh spring green;
  - camphor, the shrine's and the parks': round, dense, glossy;
  - maple, green or red: small, layered;
  - pine, the clipped garden pine: flat pads only, on a leaning trunk;
  - shrub: the plant in a pot.
  - Green's shade side is blue-violet, never grey-green, in the palette's
    shadow family.
- **Where they grow:**
  - zelkovas in grated pits along the main road's north walk. West of the
    Lawson only from the coin parking on, east only past 70 m, because the
    golden-hour sun would lay a nearer tree's shadow over the famous
    views' forecourt;
  - a camphor and a zelkova in the park and in the old park, two zelkovas
    at the plaza's road corners;
  - the shrine's sacred camphor (神木), girdled with a shimenawa and its
    shide;
  - garden trees behind 45% of lane walls with a yard (pine most often).
- **Pots** (`potCrowd`). Clay, glazed and plastic pots of every size, and
  styrofoam boxes of seedlings, each with a painted plant. They crowd 70%
  of doorsteps with a yard, and the street edge of 45% of houses without
  one (Tan's Yotsugi photo).
- **The library's planters and pot shelves.** Their shared leaf materials
  now carry the painted leaf skin, and their foliage is round and
  smooth-shaded, so they match the new trees.
- **Weeds.** Crossed-quad tufts in one instanced draw: at lane wall feet
  and gutters, round poles, and a field of them in the vacant lot.
- **Ivy** on 30% of block and timber walls.
- **Cost.** Empty instanced sets are hidden, and so are empty shadow
  stand-ins. About 50 more calls at the famous view; 4.3–8.6 ms at 1440p.
- **Checks.** Density 27 of 27, bare stretches, traincheck; heroes 0.000%.

## M2e Phase 5: buildings

- **Behind the glass.** One painted atlas of 8 window interiors
  (kit/paint.js `windowAtlas`): lace curtain, drawn curtains, venetian
  blind, frosted bathroom glass with bottles, a dark room with the sky's
  sheen, a plant on the sill, shoji, a roller blind. Every pane picks a
  cell (`windowCell`). Frosted glass is likelier low down; shoji go on old
  hip-roofed houses.
- **The same atlas lights the night.** It is the night glass's emissive
  map, so a lit window glows through its curtains or blind instead of as
  a flat panel.
- **Sashes.** Aluminium in silver, bronze or grey per house, with the two
  leaves' meeting rails. 40% of houses have 面格子 grilles on their
  ground-floor windows.
- **Sill streaks.** A soft painted streak under every window, front and
  side (`sillStreakTex`), darkest under the sill's ends. The wear atlas
  dropped its guessed sill streaks; these sit under real windows.
- **Downpipes.** PVC in grey, beige, brown or white per house, with wall
  brackets and a shoe at the foot.
- **Steel stairs.** The walk-up's stair is now painted steel (maroon,
  brown or grey) on stringers, with rust showing through (Tan's photo 1).
- **Storage sheds** (物置). A steel garden shed with sliding doors and a
  sloped lid in 30% of lane gardens with room; half of them rusting.
- **The famous views moved 0.10–0.12%** (window detail at their edges), well
  within the guard, so no re-baseline was needed.
- **Checks.** Density 27 of 27, bare stretches, traincheck; 4.4–9.1 ms at
  1440p.

## M2e Phase 6: shopfronts and ground

- **Paper on the glass.** 80% of open shops have one or two notices taped
  inside the glass: hand-lettered, sun-faded at the top, tape at the
  corners (kit/paint.js `noticeTex`). The wording lives in
  data/town.js `SHOP_NOTICES`: staff wanted, today's special, hours, a
  closing notice, a cashless sticker, the cherry festival.
- **The closed shop** carries the estate agent's 貸店舗 board on its shutter
  (`FOR_RENT`).
- **Worn shutters** (`wornShutterTex`), on every shop that has one: grime
  rising from the ground, rust running from the slat joints and along the
  bottom rail, the scuff where it is pushed up, an old sticker.
- **Interiors.** Packets on the shelves have label bands and a shine, with
  price cards along the shelf edges (a third are red sale cards). Most
  shelved shops hang a POP banner. The ramen, soba and wagashi shops have
  the row of wooden menu tags (品書き) along the top of the back wall
  (`MENU_TAGS`).
- **Red paving** (カラー舗装, decal cell `red`). The lane in front of the
  shrine is surfaced red-brown between its two junctions, worn pale in the
  wheel tracks.
- **Timings under load.** A full run read 19 ms at one spot while the
  machine sat at load 7. Back to back under the same load, Phase 5 and
  Phase 6 read 8.8 and 9.6 ms at that spot: the cost is under 1 ms.
- **Checks.** Density 27 of 27, bare stretches, traincheck; heroes
  0.10–0.12%.

## M2e Phase 7: review against the references

Every fixed spot was compared side by side with its `reference/density/`
frame (screenshots/<date>/*-vs-ref.jpg), using japan-details.md as the
checklist.

**Close to the reference**
- **Shopping street (spine-north).** Fuji now closes the view. Shop
  fascias, poles, wires and the zebra match. Missing: the petal carpet on
  the road and the crates and banners crowding the fronts.
- **Lanes (lane-houses, lane-junction).** Green school strips, 止まれ, pots,
  garden trees, block walls, windows with curtains and the steel stair all
  read as a real lane. Missing: a shop or shrine on the corner, as the
  reference has.
- **Station plaza.** The big cherry, benches, the petal carpet, the clock
  and the kiosk. Missing: people, a post box, bollards and a paved grid.
- **Sakura close-up.** Florets, lacy rims and twigs, near the reference's
  canopy.

**Short of the reference**
- **Shop interiors (spine-shops).** Ours read as a painted back wall. The
  reference's are deep rooms, with counters, freezers and lit shelves, seen
  through the glass.
- **The main road (main-west, main-east).** Since the town moved, the
  road's south side is the old town's fields. The reference has houses on
  both sides. The frontage behind the start needs building up.
- **The shrine.** Ours is an open gravel lot behind a fence. The
  reference's sits tight among a ramen shop and houses, with lanterns, a
  notice board and a 手水舎.
- **The park spot.** It is badly aimed: a fence fills the frame.
- **The station inside (gates, to-platform).** Ours shows plain gates in
  front of a train's side. The reference has a ticket window, clock, fare
  board, 有人改札, a ceiling with lights, and posters. Two spots also stare
  into the train at close range; they need re-aiming.
- **Platforms and the line (departures, train-at-platform, canopy,
  crossing).** Ours has no ballast (the track bed is flat grey), no
  sakura along the line, and plain fences. The reference lines the tracks
  with cherries, gravel, the platform clock and people.

**Measurements** (load 13–15 on this machine; the unchanged kit street,
normally 5.9 ms, read 10.8 ms, so figures are about 1.8× high)
- **Frame time.** 10.7–18.7 ms measured, about 6–10.5 ms idle
  (estimated): 60 fps at 1440p.
- **SPEC 11 budgets.** Not met: 300–780 calls, 1.9–3.5M triangles (all
  passes).
- **Other checks.** Heroes 0.10–0.12%; density 27 of 27; bare stretches
  pass; traincheck passes; check:names passes.

## M2e round 2: closing the gaps the review found

- **The main road's far side.** The lot cutter builds a frontage row of
  shops and houses facing the store across the road (TOWN.frontRow),
  except on the photographers' lot where the famous views stand
  (TOWN.photoLot). The old town's fields pulled back behind it.
- **Shop rooms.** Recesses are now 3.4 m deep rooms furnished by trade
  (shopfronts.js `furnish`), goods baked per colour:
  - general stores and grocers: stocked wall shelving, low islands you
    can see over, a counter and register, a lit drinks fridge;
  - ramen, soba and wagashi: a counter with stools and a kitchen shelf;
  - cafés: tables and chairs, and a coffee machine;
  - laundromats: stacked machines; barbers: chairs and mirrors;
  - fluorescent strips on every ceiling.
  - The fittings take a little warm light (emissive 0.3–0.45), so a lit
    shop reads brighter than the shade under its awning.
- **The shrine.** A 手水舎 water pavilion with ladles, an 絵馬 rack, the
  prayer-notice board, an offering box with the bell rope, and paper
  lanterns strung along the approach.
- **The line.** The track bed is painted gravel (`gravelTex`). A row of
  cherries runs between the south fence and the houses beyond, clear of
  the level crossing.
- **Re-aimed spots.** train-at-platform stands along platform 2;
  station-gates takes the window, clock, gates and board at an angle;
  station-to-platform is on the gate line; the park looks down its
  cherry-lined street. The two concourse spots are `indoor`: the density
  check skips its building count there, since the room is the one
  building in view. Every other count still applies.
- **Checks.** Density 27 of 27; bare stretches; traincheck; heroes
  0.10–0.12%; check:names passes. Measured near idle (the kit street
  read 6.15 ms against its usual 5.9): 5–13 ms at every town spot, so
  60 fps at 1440p passes.
- **Still open.** SPEC 11's draw budgets (300–780 calls, 1.9–3.5M
  triangles, against 300 and 1M); a ticket window with a staff member;
  people.

## M2f: the minimap

- **Keys.** M opens the full map; sound moved to N (Tan). The pause
  screen lists both.
- **One painted map, drawn once** (src/ui/mapArt.js), from the game's own
  data turned into the world:
  - the kit network's roads (pavements under the asphalt, the shopping
    street darker), the Lawson's road and forecourt;
  - building footprints from the density registry, the special lots in
    their colours, the railway with both tracks, the platforms;
  - the old town's lane, park and fields, and the Lawson in its blue.
  - It cannot drift from the town: move a lot and the map moves with it.
- **The corner map** (src/ui/minimap.js). 196 px, 60 m to the rim, turned
  so you face up; a compass ring with 北 in red; place icons upright (a
  glyph in a coloured disc). The Lawson is always on it, pinned to the rim
  and pointing home when it is out of range. It is redrawn only when you
  move or turn, as a single drawImage: no measurable frame cost (vsync
  held at 16.7 ms while turning).
- **The full map.** North up, every place in Japanese over English, the
  labels placed clear of one another, 現在地 over your arrow. While it is
  open you neither walk nor look; Esc (leaving pointer lock) closes it.
- **Kept off the famous views.** Hidden while you stand on a famous view
  (the game opens on one) until you walk 1.5 m off it; hidden on the start
  and pause screens, with the reference overlay, and in dev captures.

## M3a: the store interior

- **Research first.** reference/konbini-details.md records a Lawson's
  plan, fixtures, the counter and the room, and is the checklist for every
  interior spot: 29 of 30 details are in (the charity box and small goods
  at the register wait for M5).
- **Painted, not lit.** A konbini is lit evenly from a ceiling full of
  lights. So the room uses unlit, vertex-coloured materials with each
  face shaded by hand (store/painter.js), and the ink pass draws every
  edge. The sun's shadow through the roof would otherwise darken the
  room, and the cost stays low. Every material is white-based and joins
  the store's `lit` list, so the look scales the room's brightness.
- **The plan** (store/interior.js). Looking in from the door, which is
  left of centre:
  - **left wall:** the ticket kiosk (red, generic), copier and ATM, then
    the open chilled case;
  - **back wall:** an 8-bay walk-in cooler with bottles in columns and a
    price rail on every shelf;
  - **the floor:** four 1.5 m gondolas, below eye height so you see over
    them to the drinks, with end caps and POP cards (新商品, おすすめ,
    期間限定, お買い得);
  - **front:** the magazine rack along the glass, behind the pale-blue
    film;
  - **right:** the counter, with the hot showcase, steamer, two
    registers, oden and the self-serve coffee at its end; behind it the
    numbered cigarette wall, microwaves, the back counter and the staff
    door;
  - **back right:** the toilet door;
  - hanging category signs, LED troffer rows, a tiled floor with a
    sheen, a mirror and dome cameras.
  - Aisles are 1.4 m.
- **The door.** Two sliding leaves in the store's glass. They open within
  1.8 m, close 2 s after you are clear, and are solid until mostly open.
  The store's solid collider became walls, fixtures and the glass either
  side of the door. Walked in and out headless: the door opened and
  closed, the aisles were walkable, the cooler and glass were solid.
- **Slots.** Every shelf run is recorded (zone, position, facing) for
  M3b's products. The painted blocks on the shelves are filler until then.
- **The famous views changed 4.5–5.8%**: the real room shows through the
  glass instead of the painted card. They await Tan's OK before
  re-baselining.
- **Cost.** Hero-1 is 9.5 ms at 1440p; with the interior hidden, 9.7 ms.
  No measurable cost.

## M3b: the products

- **The catalogue** (data/catalog.js): SPEC 7's 30 products in its Product
  shape. The names are ours (やすらぎ緑茶, あさの微糖, うすしおポテト, きのこチョコ
  and so on) and every package is generic.
- **Painted packaging** (store/labels.js). One 2048 atlas with a 256 px
  cell per product, each designed by shape:
  - an onigiri's clear wrapper with grains, nori and its name strip;
  - a bento seen through its lid; a sandwich cut to show its filling;
  - a bottle's wrap label (the name twice round, so it reads from any
    side); boxes, bags and pouches with bands and names;
  - melon pan's crust.
  - A second atlas holds the shelf tags: name, ¥price, (税込).
  - Labels are seeded, so they are the same on every load.
- **Shaped meshes** (store/products.js). Rounded onigiri and sandwich
  prisms, PET bottles with shoulder and cap, cans, a codd bottle with its
  marble, gable-topped cartons, puffed chip bags, cups with lids, bento
  with lids, melon pan domes, umbrellas, and the hot items. Each is hand-
  shaded like the room, with the label mapped front, wrap or top.
- **One unit drawn per facing.** A slot's stock (3–6) is a count behind it,
  so the stock is 2,450 facings (11,212 units) in 31 instanced draws, about
  265k triangles. Drawing every unit would have been over 600k.
- **The planogram** (store/planogram.js) fills every recorded slot in
  blocks of facings, with a price tag under each block, and no filler:
  - chilled case: onigiri on the lowest decks, then sandwiches and salad,
    bento, pudding;
  - cooler: the six drinks in blocks of two;
  - gondolas by aisle, each end cap with a featured product;
  - karaage and nikuman in the hot case and steamer, oden, coffee cups;
  - ice under the freezer lids (the tinted lid became an open top with a
    rail), and umbrellas in a stand by the counter.
  - Every unit is recorded { id, mesh, index, position, count } for M3c.
- **Cost.** The famous view is 9.3 ms at 1440p with the stock (9.7 ms with
  the interior hidden).
- **The famous views changed about 1%:** real products through the glass.
  This awaits Tan's OK before re-baselining.

## M3b.2: a konbini's stock (Tan: "okay but not impressive")

- **Research first** (reference/konbini-details.md, section 8). The key
  finding: real konbini are organised by category in *vertical* blocks,
  both door by door in the cooler and section by section in the chilled
  case. M3b's deck-by-deck rows are what made it look fake.
- **The store is 13 m deep, not 10.** It grew backwards, behind the
  famous facade, which is unchanged.
- **82 products.** The 30 are kept (SPEC 7: adding items is data-only),
  and the new ones cover the range people remember. Every one is an
  evocation with an original name. Real brands are refused by
  check-names, which now lists 44 real brand names alongside the Sakura
  Crossing ones.
- **The cooler.** 8 doors by category with header signs, 6 gravity shelves
  sloped 8° toward you, blocks of facings two deep, 冷えてます stickers.
- **The chilled case.** Onigiri (leaning back on sloped decks),
  sandwiches, bento and noodles, salads, sweets (fruit sando, roll cake,
  cream puff, cheesecake, pudding), dairy. Each section has a canopy strip.
- **Ice.** An open flat case (冷凍平台) of 12 wire baskets piled two deep:
  premium cups, mochi ice, soda and chocolate bars, cones, family packs,
  kakigori. Plus an upright freezer for bags of ice and frozen food.
- **Tan's additions:**
  - the self-serve smoothie corner: a fruit-cup freezer and two blenders;
    the drinks are made in M5 and M6;
  - an eat-in counter at the right-hand window, with stools, two
    self-serve microwaves and a sanitiser;
  - a generic battery-rental kiosk by the ATM;
  - an alcohol shelf (one-cup sake, whisky, wine, otsumami).
- **Bugs caught on the way.** The two new freezers and the ice case were
  first built as solid boxes, which hid their stock; they are now hollow.
  The ice case's well was too deep to see into from standing height; its
  floor was raised and the stock piled.
- **Cost.** 82 instanced draws, 4,744 facings on show and 15,715 units.
  The famous view is 10.3 ms at 1440p.
- **The famous views changed 2.0–2.3%** (the eat-in at the window, the new
  stock). They await Tan's OK.

## M3c: picking up and the basket

- **Aiming is boxes, not meshes.** One box per shelf facing (the front unit
  unioned with the rows drawn behind it), plus the fridge doors and the basket
  stack, tested in the interior's frame. 3,580 facings take 0.03 ms a frame,
  and the test only runs inside the store. Shelf boards don't block the ray; at
  worst you can reach a facing just past a board's edge.
- **Facings keep their stock count** (the planogram's `unitsPerSlot`). Taking
  one lowers it; the next unit slides forward 0.25 s later, which is the
  gravity shelf; the drawn rows behind thin out as the count falls below them;
  the last one leaves a gap. The ice case's piles have no slide: the top layer
  goes first.
- **What you carry is drawn over the world, not in a separate pass.** The
  plan said an overlay pass in post.js, but clearing depth for it would have
  cost the ink pass the world's depth. Instead the basket's and held items'
  materials squeeze their depth into the nearest 2% of the range
  (`onTop`, store/basket.js). They never sink into a shelf you stand against,
  they still write depth, and the ink still outlines them.
- **The basket is blue, not red** (SPEC 5 says red). The store's own stack
  is blue, as Lawson's baskets are, and the one you carry is one of those. It
  has no logo: the basket isn't on AGENTS.md's branding list.
- **Fridge doors** replace the single glass sheets: 8 cooler doors, 2 on the
  upright freezer, 2 on the smoothie freezer (it has a middle post). Each
  door is a pivot with its frame, handle and pane; the 冷えてます stickers
  moved onto the leaves. They don't block walking; you step round them. The
  famous views moved 0.14–0.16% (the pane now stops at each post), inside
  the guard; that costs 25 more draw calls.
- **The panel is keyboard-driven** (W/S, X, Tab): the pointer stays locked,
  as with the full map.
- **Deferred:**
  - the sounds of taking, the doors and the basket (hooks are in place for M4);
  - the hot case (asked for at the counter), the coffee station and the blenders (M5/M6);
  - the wallet in the HUD (M5).
- **The code:** store/shop.js (aiming, taking, flights), store/doors.js,
  store/basket.js, ui/basketPanel.js. The test trip is scripts/_m3c.mjs.

## M3d: Tan's store feedback: ホタル, English UI, a real range

- **The store is ホタル / HOTARU.** Tan made the store generic and kept the
  Lawson look. The name is a firefly: a small light at dusk below Fuji. It
  is six letters, the same as LAWSON, so the wordmark panel is unchanged.
  The milk can is Lawson's trademark, so our own emblem replaces it: a
  firefly with a lit tail in a ring. The blue, the white panels and 野菜 /
  くだもの stay. The name lives in config.js `STORE_NAME`. check-names now
  refuses LAWSON / Lawson / ローソン in the bundle. The code keeps its
  lawson.js file names (the identifiers aren't seen by players).
- **The game's title is "Hotaru Fuji".** It follows the store; one string.
- **Instructions are English only** (strings.js; SPEC 10 rewritten). Product
  and place names show their Japanese as small secondary text.
- **The ¥1,000 wallet refuses, it doesn't warn.** What would take the basket
  over ¥1,000 stays on the shelf: the rim goes red and shakes, and a red
  toast says how much is left and what the item costs.
- **The shopping card** (top left) appears when you take a basket or pick
  something up by hand. It shows the wallet, the basket and what's left,
  and only the keys that work in the store, each lit when it applies. The
  door line shows only near a fridge. "Pay at the counter" stays greyed
  until M5. On walking in with nothing, a hint says where the baskets are
  and what you have.
- **Fridge doors stay open while you're at them.** They shut when you walk
  2.5 m away, or when you aim at the open leaf ("Close the door") and press E.
- **Petals:** both petal fields take an `exclude` rect, the store's
  footprint under its roof. A petal that drifts in is respawned. Over 600
  frames by the storefront, 0 of 24,000 samples were inside.
- **Baskets:** the sides now flare, so a stack nests and shows every rim.
  There are two stacks of six on grey dollies with an お買い物かご / BASKETS
  card, one by the door and one at the counter's end.
- **The range: 446 products in 27 sections**, written as family tables in
  catalog.js (reference/konbini-details.md, section 9). Each product
  appears once, with at most a second block, and never more than 18 units
  (the STOCK check in shots.mjs). A facing's count is what you can see, the
  front and the row behind. Shelves fill in catalogue order, so families
  stand together, with tall things wherever they fit. The four gondolas
  are bread | instant, snacks | chocolate and sweets, medicine | cosmetics,
  daily goods | wine, sake and otsumami. Each side has category strips on
  its top edge, and the hanging signs name the aisles. One ice multipack
  doesn't fit.
- **Stock batching.** 446 InstancedMeshes would have been about 440 draws
  seen through the glass. Instead, all about 6,400 units bake into one mesh
  per label page (2 draws). Each unit keeps its vertex range; hiding or
  sliding one rewrites that range (`addUpdateRange`).
- **Labels** are 192 px cells on 3072 px pages (255 a page), drawn in the
  old 256 box scaled down, so the painters didn't change. That makes 2
  pages of about 36 MB each on the GPU, and the JS heap is 457 MB (it was
  400). Both are M7 work.
- **The famous views move** (the wordmark, the emblem, the new stock
  through the glass). They await Tan's OK.

### M3d, round 2 (Tan)

- **NIPPON, not HOTARU.** Tan didn't like the firefly. The store is NIPPON
  / ニッポン, with a mark from Tan's sketch: a red rising-sun disc behind 日本
  in heavy black type with a white keyline, on a white round plate so it
  reads on the blue. It's drawn in Canvas2D, not taken from the image. The
  wordmark panel reads NIPPON (six letters, like LAWSON), and the side sign
  reads ニッポン. The title is "Nippon Fuji".
- **The door chime is the FamilyMart melody, by Tan's choice (option a).**
  Tan was told: the melody is Yasushi Inada's "Melody Chime No.1 '大盛況'"
  (1978, written for a Panasonic doorbell) and is still under copyright;
  the recording may have its own owner; serving it from a public site
  carries a small risk of a takedown. Tan chose to use their file
  (assets/audio/lawson-chime.mp3, never committed). AGENTS.md and SPEC M4
  are updated. If it's ever taken down, the procedural chime is the
  fallback.

## M4: audio

- **Encoding needs nothing installed.** There's no ffmpeg on the machine,
  so `npm run audio` uses macOS's `afconvert` for decoding and AAC
  encoding. Node does the cutting, loop crossfades, fades and levels,
  following scripts/audio-cuts.json. The output goes to public/audio/
  (git-ignored, so Vite ships it in dist/) with a manifest. The set is
  **2.28 MB** in 15 files (the store music alone is 1.68 MB, the whole 5.6
  minutes at 40 kbps). Chrome decodes each file to exactly its cut length,
  so the loops are seamless.
- **Everything is mono.** Konbini sound comes from a place or a ceiling
  speaker; positional sounds are panned in the engine (HRTF).
- **What was cut from the packs:**
  - one stamp of the seventeen;
  - a whole number of bell periods (4 s) from the middle of the 145 s
    crossing recording;
  - the chime's full phrase (5.9 s of 7.7 s). It was very quiet, so it is
    normalised.
- **`scan-beep.mp3` isn't used.** It is 107 s of continuous low-level sound,
  not a single beep. M5 uses the procedural beep until a single-beep file
  is chosen.
- **One engine, `core/sound.js`**, replacing the old playlist
  (audio.js) and the M2c sfx.js:
  - the buses of SPEC 9: sfx with a reverb made in code, outdoor through a
    lowpass, indoor, music, then a compressor;
  - every placed sound uses the local-sound falloff and doesn't play at all
    beyond its `far`;
  - the procedural recipes remain as fallbacks for every file.
- **The mix:**
  - stepping in: the town's lowpass reaches 930 Hz in under a second
    (measured), the store hum and the music come up over 1.5 s, and the
    reverb goes wetter;
  - the beds are chosen by the look: birds in the morning, crows at golden
    hour, insects at night, and wind always, low.
- **No cicadas.** They're summer insects, and this is sakura season.
- **The door chime** plays when you cross the door line, in or out, not on
  proximity, so it's exactly once each way. The automatic door now starts
  shut instead of opening for its first 2 s after load, which you'd have
  heard from the famous view. The famous views didn't move.
- **Sounds hooked up:**
  - the automatic door, the fridge doors (a softer, lower close) and the
    cooler's cycling compressor;
  - taking and putting back, by each product's material;
  - the basket, a refused take, the Tab panel;
  - footsteps, one per stride, grittier outdoors;
  - scan, drawer, coins, microwave and stamp are encoded but unplayed until
    M5 and M6 (there is no soundboard).
- **Not yet verified in Safari or Firefox.** Playwright has only Chromium
  here; their browsers are about 250 MB to install, which needs Tan's OK.
  The M4 item stays open.
- **The store music's source is unknown**, so its licence to be served
  publicly is still open (README, SPEC 9).

### M4, round 2 (Tan's review)

- **The exit chime fades behind you.** The chime now comes from a speaker
  in the ceiling just inside the door. A placed sound that is still playing
  follows the listener every frame, so walking out it drops away (0.22 at
  the door, 0.10 at 12 m, silent by 22 m). From outside it comes through
  the glass: lowpassed to 1.4 kHz at 40%.
- **The beds are 12% quieter.**
- **Footsteps come half as often**, one every other head-bob swing, so
  walking no longer sounds like running.
- **Zebra crossings have a walk-signal sound.** Tan says crossing-bells.mp3
  is the pedestrian signal (piyo-piyo and kakko). Every zebra plays it (a
  16 s loop) while its walk light is green, heard only within 34 m. The
  town has three zebras: the signalled one on the main road, and two on
  the shopping spine, which had only crossing signs. Those two now have
  walk-signal posts at both ends (buildWalkSignal, signals.js), each on
  its own offset cycle.
- **The level crossing** uses Tan's new railway-crossing-bells.mp3, 3.8 s
  looped on the bell period (23 KB).
- **The store music's credit:** "Sounds of Japanese Lawson" by Joonas on
  YouTube, in the README. Crediting isn't a licence. The recording is made
  inside a Lawson, so it probably carries the chain's own in-store music,
  and permission to serve it is not confirmed. That's the same kind of
  decision as the chime; Tan knows.
- **Browsers:** Playwright's WebKit (Safari's engine) and Firefox are
  installed (about 590 MB in the cache, not in the project). Every audio
  check passes in Chrome, WebKit 26.6 and Firefox 155. A refused pointer
  lock (the window not focused) is now caught, not an unhandled rejection.
- **Size (`npm run size`):** 3.00 MB in all. 0.64 MB loads before the
  first click (code 0.36 MB gzip, Fuji 0.28 MB) and the audio's 2.36 MB
  after it. The SPEC 7 budget is 5 MB. Not counted in download: start-up is
  6–9 s and the JS heap about 457 MB (M7 targets 5 s and 300 MB).

### M4, round 3 (Tan's review)

- **The shelves were running out, not the stock.** The filler gave each
  product at most two blocks, so an aisle whose section is short on range
  (bread 22, medicine 28, liquor 31) trailed off into bare shelf at the
  front, which is what Tan saw. Two fixes, no fixture changes:
  - once every product in a section has its block, the filler goes round
    again and gives the ones with stock left another, so a run fills to
    its end;
  - how deep a side is stocked now follows its range: a section with
    enough products to fill its five shelves twice over is faced two
    deep, as a real gondola is, and a shorter one is faced one deep.
    Nobody can see the row behind, and it frees that product's stock to
    cover more shelf.
  Every gondola run is now 82-93% full and none is empty (it was 16-93%
  with two bare). Total units fell from 6,403 to 5,950 (less hidden
  depth), so this also costs less memory. Three products still find no
  shelf: two tall bottles and an ice multipack.
- **Five sound settings, not a slider** (Tan): 0, 25, 50, 75, 100%,
  playing at 0, 0.15, 0.30, 0.45 and 0.60 of full scale, so 100% is the
  old free slider's 60%. The default is 50%, the 0.30 Tan liked. A value
  between settings snaps to the nearest.
- **A real bug this found:** with nothing saved in the browser,
  `Number(null)` is 0, which is a valid setting, so a first-time player
  started the game silent. Only a setting that was really saved is used now.
- **The zebras' signal, tuned.** It was there but easy to miss: green 16 s
  of every 47, at 0.5 level within 34 m. Now:
  - the junction's cycle is 36 s with 12 s of walk, and the side-street
    signals 36 s with 11 s;
  - the crossings on one street run nearly in step, as coordinated signals
    do, so the town is quiet between greens instead of one always calling;
  - it carries 62 m instead of 34, at 0.8, so it reaches you as you come
    up the street rather than only on top of it.
  Measured standing in the shopping street and at the famous view: heard
  42-43% of the time, in long stretches with quiet between.
- **The audio checks were flaky, in two ways worth naming.** One raced the
  green light; the other read an audio value that Firefox does not update
  while it ramps, so a real fade looked like a failure. The check now
  asserts what the engine asked for and that the measured value is well
  muffled. All three browsers pass.

### M4, round 4 (Tan's review)

- **The gondolas are closed at the back, as Tan asked.** Seen end-on from
  the back of the store, a gondola showed a long run of half-bare shelf:
  goods are faced at the aisle edge, and the rest of a 0.45 m board is
  empty, with nothing closing the end. Now:
  - a solid panel closes each gondola's back end, carrying the two aisle
    names and a POP card, the way a real gondola end does;
  - the shelf board reaches 0.3 m back instead of 0.45, so what you see
    end-on is stock rather than board.
  No products were added and nothing grew: the store is still 439 products
  and 5,950 units.
- **The walk signal was playing but too quiet to notice.** Measuring the
  master output (a new dev-only `sound.debug.level()`) at Tan's 25%
  setting settled it: the cut I took from his recording was from one of
  its quietest stretches (RMS 0.061 against 0.136 in the loudest). The
  encoder can now level a sound by loudness rather than by its loudest
  transient (`rms` in audio-cuts.json), and the walk signal is cut from
  the loudest 14 s. With the level raised to 1.1 and the range widened to
  20 m / 70 m, at 25% volume it measures 0.014 at 30 m, 0.022 at 12 m and
  0.031 at 3 m, against 0.0027 for the ambience bed: five to fourteen
  times the bed, where before it was under it.
- **The walk signal is Tan's zebracrossing.mp3** (round 5). Tan replaced
  the recording: the old one was a railway bell, not a pedestrian signal.
  The new one calls on a 4.39 s cycle, so the loop is exactly one cycle,
  which is also a third of the size (30 KB, was 88 KB). Its chirps peak
  far above their body, so the peak limit binds before the loudness
  target; the in-game level is 1.6 to make up for it. Measured at the 25%
  setting: 3.3 times the ambience bed in loudness and 5.5 times in peak,
  at full strength from 25 m in.
- **The town has three zebra crossings**: one on the main road by the
  store and two on the shopping spine toward the station. All three are
  now drawn on the map as their own black-and-white bars (mapArt.js), no
  label.
- **Memory, asked and answered.** 501 MB of JS heap and about 432 MB of
  textures. It is all on the player's own machine: the server sends 3 MB
  of static files, so a hundred thousand players cost bandwidth, not
  memory. It is still more than the M7 budget of 300 MB, and the
  breakdown is now recorded in SPEC M7 so the cut is a known job.

### M4, round 6 (Tan's review)

- **Two voices, one per direction.** Japan's crossings call with two
  different sounds so you can tell which way you are crossing: the cuckoo
  (カッコー) and the chick (ピヨピヨ). Which is which varies by
  prefecture; the common pairing is the cuckoo on the main road, walked
  one way, and the chick on the side streets, walked across it. Tan's
  recording is of a junction calling to itself, so it holds both: the
  chick's falling chirps (2,580 → 1,900 Hz) at 0.1, 1.15 and 1.45 s, and
  the cuckoo's two notes (1,200 then 960 Hz) at 2.3 and 3.35 s, over one
  4.39 s cycle.
  `npm run audio` now takes a `keep` list of stretches and silences the
  rest, so the one recording makes both loops, each keeping the original
  cycle and therefore its real rhythm: `walk-kakko` (15 KB) and
  `walk-piyo` (12 KB). Which one a crossing calls with follows the road it
  crosses: over an east-west road it is walked north-south, so the cuckoo;
  over the north-south shopping spine, the chick. Our main-road crossing
  is the cuckoo, the two spine crossings the chick.
- **The ranges no longer overlap.** From where the game starts you stood
  33 m from the main road's crossing and 57 m from the shopping street's,
  and the 70 m range meant both called at once. The call now carries
  14 m at full and fades out by 40 m, which is the street it is on and no
  further: measured at the spawn point, only the cuckoo is ever heard, and
  never two crossings at a time.

### M4, round 7: the audio method, and a 65 MB waste found

Tan asked whether we use three.js's positional audio, with more places
(a deer park, a village) in mind.

- **We use the Web Audio API directly, not `THREE.PositionalAudio`,** and
  that is the right call here. three.js's wrapper hangs an Object3D on
  each emitter and leans on Web Audio's physical distance models, which
  taper but never reach zero, so every emitter in the world keeps a live,
  processing voice. Ours does the thing game audio actually wants: each
  place's sound has a `near` and a `far` (config.js SOUND), the level is
  our own smoothstep between them, and **beyond `far` no source exists at
  all** -- we stop it and free the nodes. The panner is used only for
  direction (HRTF), with its own rolloff switched off. That is what lets
  the town hold many sound sources while only a handful are ever running:
  measured at eight at once while grabbing things off the shelves as fast
  as the code allows, and one or two while walking.
- **The listener** is driven from the camera each frame (position and
  forward), so what three.js's wrapper would have given us for free costs
  six parameter writes.
- **The waste this turned up: the in-store music was being decoded whole.**
  A 5.6-minute track is 1.7 MB as a file and **64.7 MB as raw audio in
  memory** -- four fifths of all the audio memory we held. It now streams
  through an `<audio>` element into the same graph, so the browser keeps
  only a little of it. Decoded audio fell from **80.6 MB to 15.9 MB**.
  The short sounds and the ambience beds stay decoded, because a buffer
  loops seamlessly and a media element does not; that matters for a
  continuous bed and not for a five-minute track.
  Worth being precise: this memory sits outside the JS heap, so the heap
  figure Tan asked about does not move. It is still 65 MB less for the
  browser to hold.
- **What this means for more places.** The shape already fits: sounds are
  named in one manifest, loaded on first need, shared by every user of
  them, culled by distance, and answer to one master. What a deer park or
  a village would need next is a way to *release* what a place holds once
  you are far from it; buffers are never freed today. At 16 MB that is not
  yet a problem, and it is a small addition when it is.

### M4, round 8: the keys on screen, and Space

- **Space pauses and plays** (Tan). Pausing is letting the pointer go,
  which raises the same card Esc does, so both work and neither fights the
  browser (Esc is the browser's own way out of a pointer lock and cannot
  be taken away).
- **The keys that do something where you are, in the bottom-left corner**
  (`src/ui/controls.js`), changing with the place:
  - walking the town: move, look, run, the map, sound, pause;
  - inside the store: move, look, E, the basket panel, sound, pause -- no
    run (SPEC 5: no running indoors) and no map;
  - with the basket panel open: choose, put one back, close;
  - standing on a famous view: only how to take the camera back, so the
    shot stays clean, as the minimap already does there;
  - paused, or in a screenshot run: nothing.
  A key that belongs to the place but cannot be used this second -- E with
  nothing under the crosshair, or the basket before you have one -- is
  dimmed rather than removed, so the list does not jump about.
- **Where the name of a thing appears.** The list names the key and what it
  does in general ("E: take / open"); the prompt under the crosshair still
  names the thing itself ("E · Take Matcha sticks"), so the two do not say
  the same words twice. The shopping card keeps the money and gave its key
  rows to the list.
- **E stays the one interact key.** Tan's note sketched X for taking a
  basket; asked, he chose to keep E for taking a basket, opening a fridge
  and taking an item, with X still putting one back from the panel.

### M4, round 9: why the laptop slowed down (Tan)

Tan: the whole laptop slows while the game is open, and recovers when it
is closed. Measured rather than guessed:

- **The machine was out of memory.** 9.6 GB of a 10 GB swap in use, 23%
  free, later 10.9 GB of swap. Everything slows when a machine pages, and
  the game was one of its largest single tabs: about 500 MB of JS heap and
  430 MB of textures. That is the root cause, and the budget of SPEC 11
  (300 MB) is now a rule in AGENTS.md, not an M7 wish.
- **It drew when nobody was looking.** The loop rendered every display
  frame whether playing, paused behind the card, in a window behind
  another, or in a hidden tab. SPEC 11 asked for a pause on a hidden tab;
  it had never been built. Now the loop draws nothing while hidden (and
  suspends the audio), 10 frames a second while paused or unfocused, and
  every frame only while playing. Measured in a real window: 230 drawn a
  second playing, 10 paused, 0 hidden.
- **The shadow map redrew every frame, and followed the mouse.** The
  code's own comment said the shadow camera sat on a snapped grid; it did
  not, so every turn of the head moved it and forced a full shadow pass
  (and made shadows crawl). It now snaps to 4 m and redraws only on a new
  square, plus four times a second for the train and the doors: GPU time
  per frame 4.86 ms to 3.14 ms (35% less).
- **The shadow map is 2048, not SPEC's 4096.** That is a quality trade,
  so it is Tan's to keep or reverse: it frees about 50 MB of GPU memory,
  and the famous views move 0.14-0.24% (inside the guard). One line in
  main.js puts it back.
- **The town atlas allocated a full page it did not fill.** Its second
  4096 page was 41% used; pages are now packed first and the last trimmed
  to what landed on it (4096 x 1664): textures 432 MB to 379 MB, signs
  checked on the famous view.
- **My test tools were adding to it.** Killing a screenshot run left its
  own dev server and headless Chrome behind; two dev servers from
  sessions a day old were still running too. All cleared, and the
  harness now allows a slow cold start instead of timing out and being
  retried. Worth being blunt: the full screenshot suite could not finish
  this round because the machine was out of memory. What was verified:
  the famous views (0.14% and 0.24%), the train service, the atlas signs,
  and the frame rates above. The rest are rendering-only changes that do
  not touch the stock, the density or the sound.

## Fix: the frame loop scheduled itself twice (2026-09-27)
- M4.9 moved `requestAnimationFrame(frame)` to the top of `frame` (so the
  throttle could return early) but left the old call at the bottom. Every
  fully drawn frame scheduled two more: while playing, the renders per
  screen refresh kept multiplying. The "230 drawn a second" above was
  this bug, not a frame rate. Removed the second call. Measured in a real
  window: 60 drawn a second while playing (the display's rate), 9.3 while
  paused.
- The same bug is why the screenshot runs hung for hours: `?shots` never
  throttles, so the page drowned in renders after the first capture. The
  full run of 12 frames now takes 8 s.
- `__shot` also left `shadowMap.autoUpdate` on after each capture (pre-M4.9
  code); it now stays off, as the game sets it.
- shots.mjs: dropped `--enable-gpu-rasterization`; added `--quick` (frames
  and the hero guard only), `--no-density`, `--no-train`, `--scale`, and
  `--verbose`; a lock so parallel agents take turns; closing Chrome and the
  dev server when stopped. New spot `land-overview`; `town-overview-east`
  moved to see the town.

## Town pass, phase 0: the smaller town and the land (2026-09-27)
- **Tan's calls** (2026-09-26/27): the town may shrink; a river and
  paddies where the old residential lane, fields and park stood (they had
  no purpose left); animals yes, people not yet; keep today's cartoon look
  (no film effects); a "Deer Park, coming soon" spot for a later place;
  budgets are guides, seamless play is the test.
- **The shrink.** The core's two east lanes (town x 62 and 92) went, and
  the east-west lanes stop at x 52 with a guardrail. The main road keeps
  its shops the whole length (lots ending before z 36 may run to x 97);
  behind them, east of x 52, paddies. The shrine, small park, apartment,
  vacant lot, spine, plaza and station are all kept.
- **Seeds kept.** network.js seeds each edge by its list position, so
  removing lanes re-drew every house in town, including the ones at the
  famous views' edges (guard 1.4%). town-plan.js now gives every edge the
  seed it had in the pre-pass grid (LEGACY): the houses are the ones they
  were. Guard after: 0.248 / 0.348 / 0.143%.
- **The land** (TOWN.land, town frame, north is -z): paddies from the far-
  side row to the levee (z -9.5 to -40), the levee (1.4 m) and river
  (z -46 to -62, 16 m), a far bank, paddies to the tree line, a farm track
  from the main road's zebra (town x 35 = world x -35) over a bridge to the
  Deer Park gate at the north fence. Named 桜川 (Sakuragawa: a common river
  name). Phase 0 builds it as flat placeholders with
  final colliders; the river & paddies builder replaces the look.
- **The gate's board** carries an English line ("Deer Park · coming soon")
  under 鹿公園 近日公開. An exception to Japanese-only world text: it is a
  message to players about the game, like a title card.
- **Sign fonts.** M PLUS Rounded 1c Bold (every character in src/, 155 KB)
  and Yuji Syuku (only src/data/town.js, 290 KB: a brush glyph costs about
  0.6 KB, so the whole source would be 580 KB), both SIL OFL 1.1, subset
  by `npm run fonts` from full fonts kept out of git in assets/fonts/.
  Loaded by core/fonts.js with a top-level await before the town paints
  its signs (build target es2022; desktop browsers only). Download 2.95 ->
  3.38 MB (1.08 MB before the first click); ready time unchanged (4 s).
- **A pole in the zebra.** The kit's main-road poles never knew about the
  main road's own zebra (signals.js builds it in the world frame), and one
  stood in its landing on the store side, 80 degrees off the famous views.
  poles.js now keeps the hero edge clear of it; the walk to the gate needed
  it.
- **The walk test was stale.** ?m2check's town routes were still in the
  pre-M2e.3 (unturned) coordinates and walked into walls; they go through
  the town's frame now. All pass: spine to plaza 152 m, lanes loop 382 m,
  road end to end 231 m, and the new one, store to the Deer Park gate over
  the zebra, the track and the bridge, 114 m, never stuck.
- **Cost of phase 0** (before -> after, famous view, headless Chrome on
  Tan's M2): JS heap 482 -> 399 MB; textures 363 -> 366 MB (the gate
  board); draw calls 756 -> 737; triangles 3.40 -> 2.83 M; ready 4.0 ->
  3.1 s. Town overview: 870 -> 806 calls, 3.34 -> 2.50 M triangles.

## Town pass, wave 1: streets & poles, facades & shopfronts (2026-09-27)
Two specialist builders (docs/BUILDERS.md); their own judgement calls are
in docs/decisions/streets.md and facades.md. Mine, at review and merge:
- **Sent back: "mirrored" shop names.** The fascias read backwards in the
  facades frames. Not a flipped texture: balconies stood in front of the
  boards' top halves. Balconies over a fascia now sit higher; noren hang
  below the new transom; a corner sign stood out of its case.
- **Not fixed: stepped shadow edges on house walls at 1-3 m.** Present on
  main before the pass: the 2048 shadow map spans 80 m (about 3.9 cm a
  texel) and the toon bands turn its soft edge into steps. A tighter
  shadow area round the player would halve it at no memory cost, but it
  touches the famous views' shadows: left for a later pass, with Tan.
- **A real brand** on a shop notice (PayPay) is now 「QR決済 使えます」.
- **Bikes in a lane's mouth.** The kerb bike rows didn't skip junctions;
  one row blocked lane z 112 at the spine (the lanes walk got stuck).
  Street clutter now keeps 1 m clear of every junction. All four walks
  pass, stuck 0.
- **Fonts** re-cut for the new sign text: 468 KB; the guide goes 450 ->
  520 KB rather than splitting the brush face further for 18 KB.
- **Cost of wave 1** (headless Chrome, Tan's M2, famous view): frame 7.19
  -> 7.41 ms at 1440p; draw calls 737 -> 751; triangles 2.83 -> 2.95 M;
  JS heap 399 -> 388 MB; textures 366 -> 355 MB (the painted rooms behind
  shop glass replaced furniture geometry, and the atlas shrank). Download
  3.38 -> 3.42 MB. Hero guard 0.258 / 0.353 / 0.148%; stock pass.
- **The bicycles** are most of the new triangles and draw town-wide (one
  instanced mesh). If the final frame check shows a cost, split per area.

## Town pass, wave 2a: sakura & greenery (2026-09-27)
The builder's calls are in docs/decisions/green.md. Mine:
- **Sent back: limbs like black paper at 1-3 m.** Now round, smooth-shaded
  wood with knots (12/9/5 sides by thickness) inside 32 m, a coarse copy
  beyond, in one batch; bark 0x6e5a53 with two bands in daylight, a
  slight glow at blue hour so it never goes black.
- **The famous views keep their trees.** Cherries the hero cameras can
  see (6 of 46, found by rays at build time) and the two frame trees keep
  the old look; town.js now asks for `classic` on the frame trees
  explicitly. A hero re-baseline, letting them take the new look, is
  Tan's call for later.
- **Cost** (famous view, 1440p): 7.25 ms (7.41 before; within noise);
  calls 751 -> 764; triangles 2.95 -> 3.02 M; heap 388 -> 379 MB. My
  texture estimate went 355 -> 371 MB, but it counts clones that share an
  image (the far trees reuse the camphor skin) twice; three.js uploads a
  shared image once, and the builder added no textures. Town park: +3
  calls, 2.06 M main-pass triangles.
- Walks all stuck 0; guard 0.258 / 0.353 / 0.148%; stock pass.

## Town pass, wave 2b: river & paddies (2026-09-27)
The builder's calls are in docs/decisions/land.md (the levee widened to a
6 m crest, the river z -49 to -65, 21 sakura on the levee and at the
gate, painted hill rings, the bridge 富士見橋). Mine, at merge:
- **The edge fences crossed the river.** The east and west boundary
  fences and tree rows now open between the far bank and the levee; the
  river runs out to the hills.
- **Night before the land.** town.js makes the night (kit/night.js)
  before buildLand, so the gate's lantern lights the gravel after dark;
  buildCore reuses it.
- **River petals under the water.** The sakura builder floated them at
  `river.surface ?? 0.03`; the land builder named it `river.water` (0.06).
  They now float just on it.
- **Load time.** The merged build took 9.5 s to be ready (about 4 s
  before): the fallen petals raycast every mesh under a crown, and the
  land's sheets span the whole land, so each levee cherry's rays tested
  thousands of triangles. Land surfaces over 60 m across are tagged
  `ground` and skipped: their height comes from groundAt (the platforms).
  Petals 5.0 -> 0.8 s; ready 4.8-5.4 s.
- **Cost** (1440p): famous view 7.43 ms, 779 calls, 3.17 M triangles; the
  new view back from the levee 7.57 ms; along the river 4-5 ms. Heap 378
  MB; textures (estimate) 377 MB. Download 3.44 MB (fonts 474 KB).
- Not done, noted: the north fence's plinth reads as a long low wall
  behind the far paddies; the land is built once (no load-by-distance).
- Walks all stuck 0; guard 0.258 / 0.353 / 0.148%; stock pass.

## Town pass, wave 2c: Tan's layout, the sunken river and 鏡池 (2026-09-27)
- **Tan's layout:** turn round at the spawn and the river is right there,
  in a sunken channel (河川敷): stone stairs down behind the spawn, lower
  walks on both banks, stepping stones (飛び石) across, stairs up the far
  side to the paddies, the pond and the Deer Park gate. The raised levee
  and far bank went. The track's bridge spans the channel at street level
  and can be walked under.
- **鏡池 (Kagami-ike)** replaces the regimented paddies west of the track:
  Tan's afternoon on a bench by Sarusawa-ike in Nara, made our own (no
  real names or buildings). A rounded-triangle pond of olive water, a
  granite promenade to the edge, post pairs, a white lantern string, black
  pines and a weeping willow, a lotus patch, かがみ茶屋 and low houses
  behind, benches facing the water (M6's sit-and-eat will use them).
- **Engine:** ctx.sink lowers the base ground over a rect; town.js builds
  the ground plane last with a hole over each sink. Tan asked that walking
  below ground not cost weight or smoothness: measured, it costs nothing
  (one rect test per height lookup; the channel replaces the levee's
  geometry).
- **The builder was stopped by a usage limit** mid-task; I finished its
  work: the noren's name fits its cloth (かがみ茶屋 was cut to いがみ茶屋),
  shoji lattice, a denser lotus patch, and a spawn-to-pond route in
  ?m2check (down the stairs' left lane: a handrail runs down the middle).
- **Honest limit:** from the spawn, turned round, the channel's far rail
  and cherries show across the road, not the water; the water shows as you
  reach the edge. That is what sunken means.
- **Cost** (1440p): famous view 7.49 ms (7.43), 781 calls; spawn turned
  round 5.3 ms; stepping stones 4.4 ms; pond bench 3.4 ms. Heap 400 MB
  (378); textures (estimate) 381 MB; ready 4.0 s. Download 3.45 MB (fonts
  477 KB). Guard 0.258 / 0.353 / 0.148%; all five walks stuck 0.

## 鏡池, second pass: Tan found it fake (2026-09-27)
What made it fake, against Tan's photo: flat olive water with printed
dashes (real still water is mostly what it reflects), a row of identical
boxes on a lurid lawn, a drawn shoreline.
- **A real mirror near the pond** (land/mirror.js, three's Reflector):
  one extra render of the scene from a mirrored camera into a 768 px
  target, only while the pond is drawn and within 140 m (beyond, the
  painted water). Tinted olive, stronger at a glancing angle, shaken by a
  wobble map, stepped into a few tones so it stays painted, and dimmed
  with the look (blue hour).
- **It renders only a layer** (REFLECT): meshes within 40 m of the pond,
  the view-sorted crowns, and everything outside the town (sky, clouds,
  Fuji, lights). Without it the mirror drew the whole town again (+750
  calls); with it about +40. Fuji is tagged again once its elevation
  loads, so it stands in the water.
- **Found on the way:** the mirror's oblique clip lost the sky looking
  steeply down (it clears to the look's sky colour now), and a deep blue
  zenith through olive water went black (the body and reflection are
  lifted).
- **Round the pond:** the town's own houses (kit, with the facades pass's
  detail) of one to three storeys, set back unevenly, an inn standing over
  them, hedges, a camphor and maples; the old townhouse and the tea house
  stay. The lawn toned down; the shore wanders by up to a metre.
- **Cost** (1440p): pond bench 3.4 -> 5.8 ms; the far bank looking back at
  the town and Fuji 9.2 ms (the game's highest spot now; the town and the
  mirror both in view); spawn turned round 7.1 ms; famous view 7.38 ms.
  Heap 412 MB; ready 4.0 s. Guard unchanged; walks stuck 0.

## Tan's layout: the town in a square (2026-09-28)
Tan drew the town's scope on the map and asked for it first:
- **Behind the spawn:** the photographers' lot is a monthly car park (bays,
  wheel stops, a walkway kept clear to the stairs, a few cars, its board),
  and the river channel starts right behind it and the shop row (about
  7 m nearer). Everything beyond the river went: the far paddies, the old
  pond, the far land. The far walk is the town's edge; the bridge road
  from the master junction ends at the Deer Park gate.
- **The master junction:** Tan found four zebras cluttered. It is the
  main road's original zebra (kakko) and one across lane x 30 (piyo), side
  by side, so both tunes are heard at one corner; the lane's walk light
  runs 19 s off the main road's, inside its car green, so they take turns
  (the audio test's "only one crossing heard from the spawn" holds). The
  engine also merges same-tune crossings within 15 m into one voice.
- **鏡池 moved** to the corner by the railway (town x 54-97, z 100-152):
  its long side and lanterns along the railway, benches on the two town
  banks facing north (Fuji beyond the railway), the tea house and houses
  at its point, where lanes z 112 and 144 open into its grounds (no
  guardrails there). Smaller pond, smaller corner roundings, a smaller
  lotus patch; turtles, ducks and benches moved with it.
- **The paddies Tan kept** (I had built houses there first; Tan wanted the
  paddies): the block between the main road's shops and the pond, lanes z
  45 and 80 ending at them. Better than before: the flooded plots are a
  mirror too (512 px, within 55 m), a hand-set April mix (flooded,
  seedlings, two ploughed, renge, the pump shed's corner), a feeder
  channel with sluices, the scarecrow in the renge; egrets back in them,
  butterflies over the renge.
- **Mirrors cost:** with the pond inside the town, its mirror redrew whole
  cells of it (+250 calls at the famous view). The reflection layer now
  takes only trees, the land's own pieces, the water's animals, and town
  meshes wholly by the water; the pond's pieces stay out of the static
  cells so they can be taken; the pond's mirror wakes within 70 m.
- **Cost** (1440p, measured back to back with the commit before): famous
  view 7.61 -> 8.22 ms, 813 calls; pond bench 7.7 ms; railway bank 9.6
  ms; paddies from the lane end 10.9 ms; junction 10.4 ms. Heap about 410-
  430 MB; download 3.48 MB. Guard 0.258 / 0.353 / 0.148% (as before);
  six walks stuck 0; audio all pass.

## The master junction, designed for traffic (2026-09-28)
Tan: cluttered, roads of different kinds, ground patterns that don't carry
on; account for cars and walkers. What was wrong, and what it is now:
- **Three road styles met there:** the main road, lane x 30 north, and the
  land's own asphalt "bridge road" with grass verges south. Lane x 30 now
  runs on through the junction as the bridge road (z0 -11), one kit lane
  with one asphalt, edge lines, kerbed walks, its own stop line at the
  main road. The legacy seed grid keeps lane x 30's old start, so no house
  re-rolled (guard 0.269 / 0.365 / 0.158%).
- **The far pavement ran across the bridge road's mouth**, raised: a car
  couldn't turn in. lawson.js now breaks it (and its tactile strip) for any
  lane that crosses the main road.
- **The main road's zebra was signals.js's**, so the kit didn't know it:
  no stop lines, a "40" and the bus box painted beside it. It is a kit
  crossing now (stop lines, diamonds, tactile pads, like every crossing),
  flagged `signalised`; signals.js keeps its signal posts and walk light
  (`zebra: false`; the kit adds no second walk light). A stop line that
  would fall inside the junction moves to its near side, so westbound
  traffic stops before the junction. Speed numerals keep 10 m clear of
  zebras; the bus stop moved 12 m east.
- **A signalled junction** (nodes within 12 m of a signalised zebra): no
  止まれ signs or words, no convex mirror, no second stop bar where the
  zebra's own stop line serves, no utility poles within 8 m, no lane trees
  within 11 m of its zebras.
- Walks all stuck 0; audio all pass (four walk lights; at the spawn one at
  a time).
- **The main road's own paint** (lawson.js, 2026-09-28, Tan: the centre
  line bothered them): its dashed centre line stops between the master
  junction's stop lines (eastbound before the zebra, westbound past the
  junction), and the store-side edge line now breaks at every lane's
  mouth, as the far-side one does. At the minor T-junctions the centre
  line carries on (the main road has priority there).

## The experiences, built overnight (2026-09-28)
Tan turned the game into seven experiences and two teasers in the compact
town (docs/EXPERIENCES.md is the brief). Built by seven specialist builders
in parallel worktrees; each report reviewed against its frames, sent back
where below the bar, merged; builders' own calls in docs/decisions/*.md.
- **Groundwork (mine):** experience spots (world/experiences.js: a soft
  yellow ground glow and a floating diamond, E to use, dims when done),
  sound zones and one-shots (core/sound.js, core/soundBus.js), Tan's six
  recordings encoded; the minimap and town map show the spots as yellow
  diamonds. A file asked for before it loads now plays when loaded, not as
  a tap (the first いらっしゃいませ was a tap).
- **Sent back at review:** the shrine's foxes (faceted) and a clipped
  nobori (正一位 cut off); Han's RX-7 silhouette (read as a generic
  supercar: the FD's bubble cabin and Fortune hips pushed); the kit.
- **Tan's calls tonight:** close homages for brands, but the real Mazda
  RX-7 from the film and Han modelled on the actor as Han; Han triggered by
  proximity (the song fades in as you walk up; step into the glow and he
  drives), no E; the minimal checkout; no people but the four.
- **At merge:** Han's bay moved to the one the quality pass reserved (its
  re-marked lot shifted the bays 1.2 m); fonts re-cut each merge (556 KB,
  guide raised 520 -> 600); audio 3.67 MB (the clerk's lines are Kyoko,
  generated); the audio test's keys check follows the new store keys.
- **Famous views:** hero-2 is at 0.487% (limit 0.5%), from fixing the
  forecourt cars (nosed into their bays: their golden-hour shadows moved)
  and the store's changes. A re-baseline with Tan's OK is recommended so
  the guard has room again.
- **Checks on main after all merges:** konbini loop 15/15, audio all pass,
  walks all stuck 0, STOCK pass, train timing pass, guard pass.

## Time of day, the view spot, the highlight, the konbini scene (2026-09-28, Tan's review)
- 1 2 3 change the time of day wherever you are (a 0.7 s dip to dark hides the switch); they no longer jump to the famous view.
- The Nippon Fuji view is an experience: its highlight at the photo spot (HERO_VIEWS.*.play); stepping on it glides the camera into the framing (1.3 s) and hands it back as you walk off.
- The highlight (experiences.js): Tan found the first ring and diamond lame and the paper lanterns not evident. Now a crisp painted ring with a gold edge, a ripple running out from its middle, a column of warm light (the finder from afar, gone as you step in) and rising motes. 4 draws a spot when near, 2 far; no download.
- Nippon Mart is a scene, not a store to roam: stand on its spot, pick one of five (egg sando, fruit sando, onigiri, Strong Nine, Choco Wafer Jumbo) with 1-5; the walk in, the take, the till, the walk out and eating play by themselves, no skipping (Tan). The walk is planned on the store's colliders (a grid search, pulled taut, corners rounded), so it follows any planogram. The door opens only for the scene; anyone inside is let out. Gone: the wallet card, the shelf glows, X to put back, E at the shelves. About 45-49 s a visit.
- The Strong Nine: ten seconds of a CSS blur on the canvas and a slow sway after you drink it (Tan's add-on); nothing is left running after.

## Konbini, second pass (2026-09-28, Tan's review)
- Hands: no note, no wallet, no left hand. The right hand comes up only to take the item (a short reach toward the shelf), drops while the item is on the counter, and comes back with it.
- The walk: A* on a 10 cm grid of the store's colliders, planned with 0.55 m clearance (0.38 m where an aisle is narrower), pulled taut, corners rounded only where the curve stays clear. The old pass cut corners through the gondolas. `node scripts/_konbini.mjs --paths` prints the floor and each walk.
- The checkout: Tan's cashier-checkout recording (a self-checkout, 7.2 s cut from 3.3 s, 32 kbps) plays at the till under the cashier's lines; paying happens out of view (the drawer, the display). The store's bed, music and hum are up 15% (SOUND.storeInside).
- Sandos: a clear rectangular pack standing upright, two crustless halves with their cut faces to the front, a label band (Tan's photo); eaten as a rectangular half, not a triangle.
- The cooler's glass leaves: 0.08 opacity, barely tinted (the milky film at 0.18 read as glare).
- The choice card: a red "Recommended" stamp on the Strong Nine, "Lemon beer · 9%" beside it (Tan).
- Open: hero-2 is 0.510% against its baseline (the sando packs, seen through the glass, shift ink edges; it was already 0.487%); the download is 5.03 MB. Both are Tan's calls (re-baseline; budget).
- Sandos, corrected (Tan's photos, same day): every sando is a wedge, a square cut corner to corner. On the shelf a right-triangle pack (back upright, base flat), the slanted cut face to the front showing the filling between the two slices, the label band at its foot; eaten as the same wedge, turned so the cut face shows, bitten from the top corner.

## Self-checkout, no cashier (2026-09-28, Tan)
- Tan removed the cashier ("the conversation during checkout seems very fake"): the counter's two registers are now self-checkouts (セルフレジ), each a white terminal with a leaned-back touchscreen (drawn by shop.js, redrawn only on change), the scanner glass, a lit IC reader, a receipt slot and a bagging shelf; a hanging セルフレジ sign.
- The checkout plays Tan's self-checkout recording in two cuts (kiosk-scan 3.3-10.9 s, kiosk-pay 24.0-29.2 s of cashier-checkout.mp3; STORE.kiosk says where their beeps fall): the item goes onto the scanner on the first beep, the screen shows it and the total, then the right hand brings up the IC card and touches the reader on the second. The hand homes in on the pad each frame, so the card lands on it whatever the stance.
- The card is ours: "Fujica" (フジカ), a mint-green transit IC card with Fuji on it (Tan asked for Suica; a real brand, so a homage).
- Gone: the cashier (store/cashier.js), her voice clips (scripts/gen-voices.mjs, 24 v-* cuts), the till beep and drawer cuts, the entering "irasshaimase" and every subtitle. Download 5.03 -> 4.75 MB.
- Visits run 46-54 s (the kiosk keeps the recording's own pace).
- Famous views re-baselined (Tan's OK, 2026-09-28): hero-1/2/3 had drifted to 0.374/0.570/0.272% from the town's growth and the store's new inside (no cashier, self-checkouts, wedge sandos) seen through the glass. All three checked by eye first; the guard now reads 0.000%. The baseline lives in screenshots/baseline/ (not committed); the old one is kept outside the repo.

## Han's drive keeps to the roads (2026-09-28, Tan: "How can somebody drive a car over the footpath like that?")
- The old drive left the bay nose first straight over the far footpath and kerb, and came back the same way. The route (han/drive.js) now: backs out into the car park's aisle, out of its east mouth onto the bridge road, north to the master junction, across into the westbound lane (Japan drives on the left), west past the store, a handbrake 180 on NIPPON's forecourt (it meets the road with no kerb; clear of the wheel stops and the parked keis), back into the eastbound lane, a drift through the master junction onto the bridge road (drift 0.55: the lane is 4.6 m), into the car park's mouth and nose first into the bay.
- The guard: `node scripts/_han-route.mjs` samples the drive at 120 Hz and fails if any corner of the car (its body as drawn, drift included) leaves the car park, its mouth, the bridge road, the main road or the forecourt, or touches a parked car, or if it doesn't end in the bay. Run it after any change to the route or the town's layout there.
- The smoke is soft translucent puffs (one Points draw) instead of solid white balls.
- A player standing in the glow is clear of the car (1.25 m at the closest); one standing in its path makes it wait, as before.

## After the rename merge (2026-09-28)
- The line's next station was 河口湖 / Kawaguchiko, a real town a letter away from our own name: it is 富士山 / Fujisan now (train destinations, the fare map, the bus's stops); the onsen ad reads 西湖 温泉.
- The train's listening spot moved 0.35 m back from the platform edge: its light column had cut into the train's side.
- The station entrance board, the map title and the signs read Fujikawaguchikko / 富士川口湖; 富士見 stays where it names the view (Fujimi Line, 富士見通り, 富士見稲荷神社), not the town.

## H: back to the Nippon view; the counter laid out (2026-09-28)
- H puts the player back on the Nippon Fuji view from anywhere, at the time of day they're in (Tan: "I'm finding it difficult to get back to the Nippon store" since 1 2 3 only change the light). Not during the konbini's scene, the map or the glide onto the view; it ends Han's watch and a seat like any move. _play step 29-home.
- The counter: the second self-checkout sat inside the bun steamer and the first's bagging shelf ran into the oden pot; the second now stands at z -3.62 (its reader and printer on its far side, no shelf of its own), the oden pot moved to -5.62..-5.12, its cups on the lid.

## The Shiba's voice (2026-09-28, Tan: "Don't you add very cute, adorable sounds?")
- Made in code (core/sound.js `voice`: a sawtooth glide through two bandpass formants with a breath of noise; no files): a happy double yip when you arrive at a spot (always plays), a cheek-puffed little "boof" on some look-backs, a curious "hm?" with some head tilts, a soft rising whine once if you've kept it waiting 9 s, quick panting at a trot every few seconds, the collar tag jingling as it shakes off, snuffly breaths asleep. Placed at the dog (near 3 m, far 18 m), never two within 1.2 s. scripts/_guide.mjs checks each is really heard and that the dog uses them on a walk.
- toon.js no longer passes flatShading to MeshToonMaterial (r180 has none; it only logged a warning per material at load; nothing on screen changed).
- Han's watch keeps up on slow frames: the car keeps the song's real time, but the head turned by the capped frame time (1/20 s), so on a slow machine the car left the frame (the test's worst angle reached 90°). The turn now uses real elapsed time and turns quicker while it's well behind: worst 20-22° over three loaded runs.

## Placed sounds follow you for as long as they play (2026-09-28, Tan: the next-stop announcement stayed loud as he ran off)
- core/sound.js followed a placed one-shot's level for a fixed 8 s; a longer one (the train's announcement, Han's song) then froze at that level wherever the player went. It is now followed until its source ends (recipes: 4 s), and a not-yet-decoded placeholder no longer lingers in the list. _play step 25-announce-fades: full in the ring after 9 s, silent 40 m off.

## No tree through a building (2026-09-28, Tan found one by the shrine)
- An audit found 40 trees whose crowns cut into buildings (sakura, pine, maple, camphor, zelkova). kit/canopy.js now grows each tree dry first (a tree is its seed's alone, so the dry crown is the real one), tests its cushions against every building-sized collider, and slides it away from what it hits (up to ~9 m), or makes it smaller if there's no room. After: 0. _play step 03-trees-clear keeps it so.
- Moving the famous views' framing sakura changes hero-1 to 0.61% (hero-2 0.36, hero-3 0.32): to be looked at and re-baselined.
- Re-baselined the famous views after the tree fix (the framing sakura on hero-1's left had cut into the house behind it and now stands clear; checked by eye): guard 0.000%.

## Shadows that don't pixelate; the bench looks around (2026-09-29, Tan)
- "Some places pixelate a lot ... this staircase near the river ... when I walk past, it pixelates and acts up": the sun's shadow map (2048 over 80 m, ~4 cm a texel) drew a low sun's shadows (handrail posts, a tree) as blocks on the steps, and the shadow camera moved in 4 m steps, which are 102.4 texels: every step re-sampled every shadow edge (the crawl). Now PCFSoftShadowMap (filtered edges) and the camera snapped to whole texels in the sun's own frame. Frames qa-stairs-a/b (half a metre apart) show no blocks and no change between them; hero-1 9.5 ms @1440p (unchanged within noise); famous views 0.002%.
- The slow-life bench: seated, the mouse looks around (±1.9 rad, up and down); only a walking key (arrows/WASD) stands you up, and you rise facing where you looked; 1 2 3, N and Space still work there. _play 40-seated-key checks it.

## Hachi's whistle, seen coming; tipsy with you (2026-09-29, Tan)
Tan: "whenever or wherever I whistle from, the pup magically appears next to me ... Sometimes it walks from behind and from the side"; the run should be seen, and cute. And after the Strong Nine: "I want the puppy to giggle, roll on the floor, and enjoy that moment."
- **Where it comes from.** If you can see it (within 40 m, 30 degrees of the lens, nothing between) it runs from where it is. Otherwise it is set where you'll see it come, never popping up in view: a street 10-18 m ahead that is hidden right now (behind a building's corner, a car, a machine: the walk grid now marks colliders over 1.1 m and the store as `tall`) and whose way to you comes out into the middle of the view within 5 m. Fallbacks, in order: hidden to a side and out into view within 10 m; round a corner at the view's edge; far and small in plain view (24-40 m); the old corner out of view. It is set facing down its way, already running.
- **The run.** A bounding gallop (4.4 m/s; a bounce a stride, rocking nose-up nose-down), ears half back, tongue out, tail going hard, a yip as it closes. It runs for a spot that slides in from 7 m out in front of you to 4.2 m, so it swings across the middle of the view, not along its edge. The answering yip comes from where it is placed (it used to sound at the old spot, out of earshot).
- **The greeting** (act `greet`, 3.8 s): a skid, a spin on the spot with a giggle, two little bounces up on the hind legs with a yip, then a sit looking up, tongue out, a head tilt and a "hm?". Already just in front of you, it greets you there; beside or behind you, it bounds out to the spot first.
- **Why 4.2 m:** at eye height 1.6 m and a 70 degree lens, a 24 cm pup nearer than ~4 m is under the bottom of the view. The old greeting (a hop at 2.2 m) was mostly unseen for that reason.
- **The facing-the-store case** (the start): everything within 28 degrees beyond 11 m is the store, so it comes round the store's corner at the edge of the view and swings in (on screen about a third of the run, then the whole greeting). Facing anywhere else, most of the run is seen (car park: out from behind a parked car).
- **Tipsy** (`GUIDE.tipsy`, from main.js's onTipsy): Hachi comes flat out (5.4 m/s) to 4 m in front of you, the same way, then for the ten seconds rolls onto its back side-on to you, tipped your way so you see the belly and paws going, giggling (a new `dog-giggle`: quick breathy huffs with tiny squeaks), a play bow, a tail chase, more rolls. Then back to the tour.
- **Cost:** the way to you is grown over the whistle's 0.85 s (3 ms a frame) and other ways pause meanwhile (two fields grown in turn undo each other's work: a 150 ms stall before); the spot search is 1-4 ms once, about 35 ms the first time after load (compiling). No new draws or textures; download unchanged (4.90 MB).
- **Checks:** `_guide` whistle (five cases: facing the store, facing the car park, the pup behind the store, in view 22 m off, beside you) wants no pop-up in view, the greeting, the timing, and the run on screen (most of it; a quarter facing the store); `_guide` tipsy wants it there within 4 s, two rolls or more, three giggles or more, in the lens 85% of the time. All `_guide`, `_play`, `_konbini` pass; hero guard 0.002 / 0.001 / 0.000%.

## Hachi guides and doesn't follow; the station over the plaza; vending machines quiet (2026-09-29, Tan)
- **A jog** (Tan: "a little annoying to slowly follow the dog"): it leads at 3.6 m/s (your walk is 2.55), 4-9 m ahead along the way, bounding a little; past 9 m it stops and looks back; you running, it runs (up to 5.4). The tour's own time is set by the walker (the test's walker, 2.3 m/s, takes 425 s), but you no longer walk at the dog's pace.
- **A guide, not a follower** (Tan: "very difficult to guess whether it wants to follow me or I need to follow it"). Gone: bounding after you, keeping you company, invitations, the lap round your legs. Now: walk away (off its way for 1.7 s, the spot receding while it waits, or 16 m off: raised from 10, as it now leads from up to 9 m) and it stops where it is, tilts its head, and waits, playing a little. Walk back to within 4 m and it carries on the tour where it left off. Whistle (F) and it comes (seen, as before), greets you, and rushes you to the nearest place you haven't been (by the way; one you walked away from counts 30 m further), the tour going on from there.
- **The hello** now says F: "Follow me, I'll show you around town. Wander off whenever you like: press F to whistle and I'll come running." (7 s on screen.)
- **The station over the plaza** (Tan: "I don't hear the station announcements in the station plaza"): the plaza runs 6-36 m from the zone's middle, where the old edge (a third, gone by 42 m) left it at 0.15 under the plaza's own sounds. Now edge 0.75, near 20, far 62: the plaza's middle 0.34 (the concourse 0.45), its far corners 0.20. In the train's listening spot the station dims to 30% (full dim within 1.5 m of it, back by 6 m) under the next-stop announcement.
- **Vending machines** have no prompt or E (they aren't for sale yet); the dispense animation stays in vending.js for later.
- **Tests:** `_guide` turnaway (it waits and doesn't follow; walk back and it goes on; F: it comes, greets, and rushes you to the nearest place, jogging 3.6) and wander (a minute wandering: it stays within 3.5 m of where it stopped) are rewritten; the tour's walker follows the dog's trail (a player does not beeline at a dog 9 m ahead round a corner) and wants its mean moving speed over 2.7 m/s (2.83). `_play` 23-station wants the plaza at 0.25 or more, its corners 0.12, and the dim in the listening spot. All `_guide`, `_play`, `_audio` pass; hero guard 0.002%; download 4.90 MB.

## Hachi's hello, every start (2026-09-29, Tan: "Why don't we do this when the game begins, not just once for every user?")
- **Every start, nothing remembered.** The hello no longer waits for you to happen to look at the pup off the famous view, and no longer writes localStorage (the `hachi-intro` key and `?fresh` are gone). 0.6 s into play it runs out from its spot behind you (the bounding gallop) to 3.2 m in front, turns to face you, sits, yips, and the caption shows (same words, with F). It then sits there (`ready`), watching you, a tilt or a play bow now and then, until you walk off the view; then the tour.
- **The view eases down to it.** The start view looks up at Fuji (pitch 0.16): a pup 3.2 m in front is under the frame's bottom (at 6 m only its ears showed). While it runs in and says hello, main.js `watchPup` eases the view down to it, aiming 0.18 rad above it so it sits in the lower third with the store behind (pitch about -0.28), then eases back to where you were. Nothing holds you: move the mouse or take a step and the view is yours at once. The caption moved up to 36% from the bottom, just above the pup, so it doesn't cover it.
- **The famous-view rule** (the pup goes home when it would be in the picture) doesn't apply during the hello and the wait after it; R (a jump back to the view) still sends it home. The hero guard runs frozen (no time passes, so no hello): 0.002 / 0.001 / 0.000%.
- **Checks:** `_guide` intro (fires 0.6 s in, sits 2-4.5 m in front within 5 s, faces you within 25 degrees, the caption says F, waits in `ready` on the view, leads when you walk off, nothing stored); `_play` 45-hachi-hello, in the real loop (the view dips to -0.29 and comes back to 0.16 within 0.05, the pup on screen every sample while it sits, the caption shown). All `_guide`, `_play`, `_konbini`, `_audio` pass; download 4.90 MB.
- **4 s later** (Tan, same day: "I would want the players to first take a look at the view before engaging with Hachi"): the hello starts 4 s into play (play time: the pause card stops the clock). Walk off the view sooner and it comes then instead; the pup never starts the tour before it has said hello. `_guide` intro checks both (4.0 s; 0.7 s after walking off).

## Tan's song on the start and pause cards (2026-09-29)
- **The song:** "Nippon Let's Go", made by Tan with Suno, their own lyrics. It loops while the start card or the pause card is up; the game's own sound steps down to 15% under it (a new `world` bus in core/sound.js; the song goes straight to the master); pressing Start or resuming fades it out (1.5 s) and the game back in; pausing again picks the song up where it left off. Streamed (an `<audio>` element), fetched only when a card first plays it.
- **The file** is Tan's to download from Suno (its CDN answers 403 to a direct fetch, and the game makes no requests to other domains): `assets/audio/nippon-lets-go.mp3`, then `npm run audio`. A `song` entry in audio-cuts.json keeps it whole and in stereo (96 kbps AAC; everything else is mono and cut). Until it is there, the cards are silent as before.
- **The browser's rule:** no sound before the visitor's first click or key. The first click or key anywhere now starts the sound, so the song plays on the start card if the visitor touches anything on it (the volume, the card) before Start; most will press Start at once and first hear the song on pausing. A "click to begin" step before the card would guarantee it; not added (Tan's call).
- **Checks:** `_audio` "Tan's song loops on the start and pause cards" (tested with a stand-in file, not committed): on a card it plays and the game is at 0.15; in play it is paused and the game at 1; paused again it resumes later in the track, not from the top. Skipped while the file is missing. All `_audio`, `_play` pass; download unchanged until the file is added.
- Also: `_guide --only x` no longer writes its trail map into a folder named after the scenario list.
- **The file arrived** as `assets/audio/title bgm.mp3` (172 s, stereo, 256 kbps MP3, 5.5 MB). Encoded HE-AAC (`aach`) 48 kbps stereo: 1.03 MB (plain AAC 96 kbps was 2.1 MB, 64 kbps 1.4 MB); plays and loops in Chrome, WebKit and Firefox (`_audio` in all three, all pass). It is mastered loud (rms 0.22 against the store music's 0.05, its first 5 s quieter), so its level is 0.3, not 0.55: the lead on the cards without a jump when play comes back.
- **Over budget:** `npm run size` 4.90 -> 5.91 MB (budget 5 MB: FAIL); the audio set 4.37 of its 4.5 MB. The song is fetched only when a card first plays it (streamed, `preload: none`), so a visitor who never touches the start card and never pauses never downloads it; one who does downloads about 1 MB more. Left for Tan: raise the budget, count the streamed song apart, or loop a shorter part of it.
- **Tan's call: the first 45 s, looped.** Cut in stereo (0-45 s), the last 2.5 s faded out so it comes round to the opening cleanly: 276 KB (HE-AAC 48 kbps). Still 0.17 MB over with it (5.17 MB), so the store music moved to HE-AAC 32 kbps mono (1.72 -> 1.37 MB; its level in play unchanged, rms 0.012). `npm run size` 4.87 MB (budget 5 MB: pass; 4.90 before the song). `_audio` passes in Chrome, WebKit and Firefox, and checks the 45 s loop wraps to its start still playing.

## Tan's play-through: Deer Park last, the track walkable, trees off the road, the train's ring (2026-09-29)
- **Deer Park last.** The tour went konbini, Han, then out over 富士見橋 to the gate and back. Now it goes konbini, Han, the shopping street, the station and the train, the crossing, the shrine, the bench, then back down lane x 30, over the master junction and the bridge to the gate, where it naps (A.nap moved from the bench to beside the gate). With everything done out of order (whistles), the last thing it takes you to is still the gate. Tour 475 s for the test's walker; every sound place still passed near.
- **Sunk at the gate.** The farm track from the bridge's end to the gate is drawn 12 cm up (TOWN.land.track.top) and was never a platform: Hachi stood at 0 in it (you, at 1.6 m, never saw the 12 cm). It is walkable now. New `_guide` check `ground`: along the whole tour, every half metre, nothing drawn more than 6 cm over the ground Hachi stands on (1,558 samples, 0 now; night-light pools and decals aside).
- **Trees on the road.** The fix that slid trees clear of buildings (2026-09-28) slid 8 into lanes (up to 4.7 m; two by the small park, Tan's photo). A slide may no longer end on a carriageway (town-core's new `ctx.onRoad`, the kit network's carriageways and junctions plus 0.6 m); it tries straight away from the building, then along the street either way; with no room anywhere the tree is left out (7 of 350: town x 7.5/14.8/22.1 by lanes z 45, 80 and 112, x 26.5 z 93.5). `_play` 03-trees-clear now also wants no trunk on a road and at most 8 left out. One of them showed at the left edge of the famous morning view, behind the store (the house behind it shows instead): hero-1 0.335% (guard 0.5%), hero-2 0.128%, hero-3 0.088%; not re-baselined, Tan to look.
- **The train's listening ring** shows only while platform 1's train stands with its doors open (`opening` past 90%, or `dwell`), and the next-stop announcement plays only then (experiences `show(on)`: no ring, no column, no E; `_play` 24-train checks both states).
- **Hachi took Tan back to the bench** they had sat on: the pup counted a place done only when you stood in its ring, and the bench seats you off its ring. Experiences now carry `used` (their own done(): the seat, Han's show, the konbini, the announcement) and `hidden`; the pup counts either. `_play` 26-slowlife checks sitting marks it done for Hachi. Also found: at a spot reached within a second of setting out (the konbini) its clock never ran, so it never let you walk away (`atSpot` now counts time).
- All `_guide` (8), `_play` pass; walks stuck 0; download 4.87 MB.

## Paused, everything stands still (2026-09-29, Tan: Hachi said hello behind the pause card)
- The game loop kept drawing at 10 fps behind a card and gave the world its time step, so the pup's clock ran on, its hello fired and its caption showed over the pause card. Now while a card is up (the start or pause card) the world's time step is 0: Hachi, its hello, the trains and the crossing, Han's show, the konbini's scene, the petals all hold; the clock is still read so play resumes without a jump. The scene is still drawn, blurred. Hachi's caption hides under a card (`body.game-paused`) and comes back where it was on resume. Under the song the game is now silent (duck 0, was 0.15).
- `_play` 46-pause-holds: the hello shown, pause 3 s: the pup's clock, the trains and the pup don't move, the caption hidden; resume: time runs, the caption shows. `_guide` turnaway now walks away from where the pup is leading (walking "away from the pup" could run past the place it was leading to, and it rightly kept leading).

## Launch page: icons, share images, credits, hosting (2026-09-30; QA-005, 008, 018, 019)
- **The emblem** (public/favicon.svg, drawn by hand as SVG): the town's Fuji manhole lid (street/atlas.js mhFuji: the cast rim, studs, sakura sprays) with the famous view cast into it at golden hour: Fuji behind the NIPPON konbini (blue band, the name panel, a lit glass front). Golden-hour lavender and peach, not the lid's daytime blue, to match the key art. Every raster icon and the share images come from it and from the game's own render: `node scripts/share-art.mjs` (the hero view, `?shots`; the title, the place line and 日本へ、もう一度 laid on with Canvas2D in NF Round and the card's serif). 399 KB in all (og.jpg 118 KB, og-square.jpg 134 KB, icon-512 88 KB).
- **og:image is a JPG now** (1200x630, then a 1200 square as a second og:image); keyart.webp stays for the card only. theme-color is the Start button's ink (#3b3263).
- **Credits** are a static page (public/credits.html), opened in a new tab by a "Credits" link beside the Sakura Crossing line on the card (the card ignores clicks on links, so it doesn't start the game). It lists Tan, Sakura Crossing with its MIT notice (LICENSE also ships as LICENSE.txt), three.js, the GSI credit in GSI's own form (出典：国土地理院; 「標高タイル」（国土地理院）（URL）を加工して作成), the title song (Tan, with Suno), 効果音ラボ, the two OFL fonts (OFL.txt ships), and the disclaimer. Third-party music is not listed there.
- **npm run size** counts the share images, large icons and side pages as "page extras" outside the 5 MB game budget: only link previews, home screens and the Credits link fetch them. Game download 4.88 MB (was 4.87; the favicon), extras 0.39 MB.
- **Hosting**: public/_headers (hashed /assets a year immutable, audio and images a day, pages no-cache, `.m4a` as audio/mp4, a same-origin CSP), 404.html, robots.txt.

## Launch audio fixes: QA-006, 007, 009, 013, 014 (2026-09-30)
- **One announcement at a time (QA-006).** `sound.oneShot` (and `soundBus.oneShot`) now return a handle, `{ ended }`; the train spot starts the next-stop announcement only when the last one has played out, so stepping out and back in neither restarts it nor stacks a second. The file is warmed with `soundBus.preload` at 80 m (was a silent 25 s copy played at gain 0.0001).
- **The trains join the engine (QA-007).** `line/sfx.js` builds its voices on the engine's context (new `sound.graph()`: the context and the outdoor bus) instead of a second AudioContext; it no longer reads `window.__scene.sound`. Volume, mute, the pause card's silence, the store's muffling and the hidden tab now reach it. Same voices and levels (0.9 into the outdoor bus; the master's compressor has the settings the trains' own had).
- **Paused, the one-shots stand still too (QA-013).** Every file one-shot still playing is held when a card comes up (stopped with a 20 ms fade, its place kept) and picks up there on resume. Han's song stays with the car; the announcement and the checkout lines no longer run on unheard. Han's show takes its first frame after a pause as 0 s, so the two restart together (measured 0.02 s apart after a 6 s pause; before, 6 s).
- **Han's song on time (QA-014).** Decoded as you come within 40 m of the car (SOUND.hanSong.preload), never before the first click; stepped in before it is ready, the show waits for it up to 3 s. The famous view is within 40 m, so in practice it is fetched (131 KB) just after Start. The song now starts in the same frame as the show (was 3.5 s late).
- **The bench's ring (QA-009).** Its E hitbox (experiences `hitInside`) stands 2.4 m tall and is hit from inside too, so "E · Sit a while" shows in every direction standing in the ring, and still from outside. Hachi's rule (standing in the ring counts it done) left as is.
- Checks: an instrumented Chrome run (one AudioContext; trains rms 0.023 in play, 0 paused with the song off, 0 muted; six steps in and out: one announcement; replays once after it ends; Han paused 6 s: song held, in step after; E in 8 directions in the bench ring; no sources or held voices left over). `_audio` all pass. `npm run size` 4.87 MB unchanged (code +243 bytes gzip).
## Launch: phones, loading, no WebGL, GPU reset, small windows (2026-09-30, QA-001/003/004/011/012/023)
- **Desktop only, said kindly.** A head script in index.html decides before anything loads: a coarse pointer with no fine one, or a touch screen under 600 px, or touch without pointer lock, is a phone or tablet. It gets a static card (the key art, the name, "Made for a computer", Copy link and, where the browser has it, Share) and the game's code is never imported: a phone downloads the page, the key art and a 2 KB loader (~170 KB) instead of ~1.5 MB of code, fonts and Fuji. A touch laptop with a trackpad plays.
- **No WebGL 2** (three r180 needs it): the head script tests a context (and gives it back); main.js also catches the renderer failing. Same card, its own words; nothing else loads.
- **Loading card**: the start card's art and name with a line and a bar, static HTML, painted at first paint (~0.13 s) instead of after the build (8 s here). The bar's glint runs on the compositor, so it moves while the build blocks the thread; main.js steps the line and bar and gives the page a frame before and after buildTown. The game's own card takes over in the same place.
- **GPU reset**: `webglcontextlost` is prevented, the loop stops, the sound suspends, the card says "The graphics card reset" with Reload. No rebuild: not worth it for a rare event.
- **Small windows** (under 800 px wide or 560 px tall): the card takes the window's width, the art crops to 42vh (Fuji's peak kept), the keys wrap over a full-width Start, and if it still doesn't fit the card scrolls. Normal windows unchanged.
- **Debug keys** C, O, G and `window.__scene` / `__setOutlineRes` are dev only. line/sfx.js read the volume off `window.__scene.sound`; it now reads `soundBus.level`.
- The cards' words live in strings.js (`boot`, `gate`); vite.config.js writes them into index.html (`%S:key%`), failing the build on an unknown key.
## Leaner before launch: what nothing uses, out (2026-09-30, Tan: "find what we are not using and remove it")
- **Audio (QA-033):** door-chime (only a fallback behind lawson-chime), ui-tap and stamp were fetched or shipped and never played: gone from audio-cuts.json, the preload list and core/sound.js (the ui-tap *recipe* stays, the engine's default procedural sound). `npm run audio` deletes the stale .m4a; the sources in assets/audio/ (door-chime, ui-tap, stamp, and the unused scan-beep, till-beep, coins, register-drawer, microwave-ding, v-*.aiff) can go from Tan's disk. gen-sfx no longer makes till-beep.
- **The konbini:** the free-roam shop was replaced by the scene (choose at the door, keys 1-5; the self-checkout; eat outside) on 2026-09-28, but its parts stayed: the carry limit and the wallet check (QA-028: they flashed strings that no longer existed), the hidden left hand, the ¥1,000 note, the change in coins, the basket you carried, the aim boxes, the register display, the subtitles. All out; the store and the scene look and play the same (every store shot pixel-identical, `_konbini` the same timings).
- **Unused base modules:** the world modules that nothing imported (world/index.js, shop.js, shotengai.js, showa.js, train.js, details.js) are deleted, and every top-level declaration nothing refers to (172, mostly sign textures). They were never in the build; git history keeps them if a milestone wants one back. AGENTS.md's base-modules line now means what src/ still holds.
- **Kept on purpose:** the product catalogue in full (every product stands on a shelf), the catalogue's `zone` field (read by nothing, but it is the first argument of every family row), shop.wallet (the konbini check prints it), window.__scene in production (tools read it from a build), and the dev tools the checks use.


## Title tune: not Suno (2026-09-30)
- Correction from Tan: the title tune ("title bgm.mp3") is a copyright-free track Tan found online, not a Suno song; Suno was never used. The Suno notes above are wrong. Per Tan, it is not credited.

## The key art: a diorama of the town (2026-09-30, Tan: "as many of the famous places as possible, in one made-up picture")
- Replaces the RX-7-bay frame on every card. `?poster` (dev only, src/dev/poster.js) builds the town unmerged (buildTown `{ merge: false }`) and moves whole places, by their own groups, in front of one lens: NIPPON under Fuji (unmoved; the lens is the old bay's axis, Fuji's peak at 37%), the railway set (line, crossing, station, trains) turned square across the view with the local train pulling out of the platform and the gates down, the shrine behind its torii, ドンペン堂 and its penguin, Han on the RX-7, the slow-life bench and jizo, Hachi sitting on a zebra at your feet.
- Added for the picture, from the game's own builders only: the zebra (signals.js's bar recipe), a side street's walk post (buildWalkSignal, 25 s into its cycle: walk lit), one classic town cherry (kit/sakura.js) framing the top left.
- Left out of the frame on purpose: the line's catenary (its gantries cut across Fuji and the title's sky), the junction's 5 m car-signal posts (same), the clouds (only a cloud's underside showed, cut by the top edge), the lantern of the slow-life spot (7 m off, it stood in the road), the photographers' lot's bay lines and wheel stops under the zebra (sunk by vertex in the merged land meshes). The paddies stay home: their water and mirror are one land-wide mesh.
- Layout: top right is sky for the card's title (ドンペン堂's roof stops at 30% height, the title at ~24%); top left, under PAUSED, only blossom. Lens: eye height, 38.5° vertical (Fuji larger than 40°, the peak still 7% from the top).
- Files: a lossless 3840x2160 master in assets/keyart/keyart-3840.png (5.1 MB, tracked, not served); public/keyart-1920.webp (241 KB) for every card, by srcset keyart-1280.webp (123 KB) for small windows and the phone page and keyart-2560.webp (387 KB) for large high-DPI screens, keyart-portrait.webp (900x1600, 112 KB, a 9:16 crop round Fuji, the torii and the NIPPON sign) for the phone card in portrait. Downsampled from the master in Chrome, so the ink stays crisp. `npm run size` counts the 1920 one; the alternates are listed apart (a screen takes one of them instead).
- Share images (og.jpg, og-square.jpg) keep the famous view with the title: at link-preview size the one big storefront reads; the diorama's small places don't.

## Waiting for the train (2026-09-30, QA-010)
- **Never a long wait.** On platform 1 or 2, in the concourse, or within 14 m of the listening spot (config `TOWN.trainWait`), if platform 1's train isn't due within 30 s, service.summon sends it now: it begins its ordinary run 330 m out (`minAppear`, past every look's fog: day's fog ends at 320 m), so it stops about 26 s later (`lead`) with no jump anyone can see. It is that same set's run, early: a pending platform-1 start is dropped, and the timetable picks up from its departure as before (platform 2's train, a headway later). The crossing needs nothing: it works from where trains are, so it closes the moment the run begins (arms down ~11 s later, ~5 s before the train reaches it; a natural run from 420 m gets ~9 s). Checked at 20 Hz through a whole wait: 0 samples of a train within 4 m of an open crossing.
- **Only platform 1's train** is counted and sent: the listening spot is by its door. After it leaves, the next is sent once it has run out (its run ends 460 m away), so a second wait while you stay is ~60 s, not ~26 s (counted down all the way from the doors closing). Cutting the leaving train short in the fog would save ~6 s; not worth a second rule.
- **The waiting spot** is the same ring, meshes and materials (experiences `wait(p)`): no column, no motes, the ring at a third of its brightness and its ripple standing still as a fill that grows from the middle as the train nears. When the doors open the spot eases (0.4 s) into today's glowing ring; still walk-in, no E (the brief's "E · Listen" doesn't exist today, so nothing was added). After the doors close it goes back to waiting.
- **"Next train · 0:25"**: a small pill above the prompt (ui/trainWait.js, one DOM element, shared with the phone HUD), with a warm fill behind the text for the same progress. Counts to the doors being open, hidden on the cards and the full map. The words are in strings.js (`nextTrain`).
- **The departure boards** (all three) count it too: row 1 is platform 1's train, row 2 becomes 次の電車 あと25秒 (まもなく到着 at 0) in the boards' LED style, Japanese from data/town.js `RIDE.next`. Same canvas and texture; redrawn when the shown second changes, one board a frame, and a second-only change repaints only the lower line's lamps (2.2 ms a board in headless Chrome, was 3.1 ms for the whole panel). The LED helper reuses one scratch canvas per size instead of making one per draw.
- **Hachi** (guide.js `atSpot`, the train only, while its entry says `wait`): sits beside the ring turned down the line toward where the train comes from, head along it; no idle acts or whine there (the head-tilt at you still comes now and then). When the arriving train is within 70 m of the spot (`hear`; the train's sound carries 80 m) his ears go up and he gives one boof (dog-boof); when the doors open after waiting with you, 3 s of a full wag (`ANIMALS.guide.trainCheer`). Everything else in his brain is unchanged.
- **Dev:** a staged moment (`__train`) is left alone: no train is sent and no countdown shows, so screenshots stay as they were. `__train('quiet')` clears the line with platform 2's train two minutes off and lets the service (and the sending) run on.
- Numbers: code +2.3 KB gzip (544,400 -> 546,733 B), `npm run size` 4.91 MB unchanged; no new textures, images or audio. JS heap after start (production build, after GC, two loads each): 290.0/290.0 -> 289.5/290.8 MB. renderer.info on platform 1 with the same staged moment: 178 textures / 932 geometries before and after.

## Made by Tan: the chip and the postcard (2026-10-01, Tan: "turn the traffic into followers")
- The game has no ads or sales (a nostalgia project), so the asks are Tan's: Buy Me a Coffee (buymeacoffee.com/tanuj10r0; tanuj10r without the 0 is a 404), X, GitHub, tanuj.fyi. Three options were mocked on the real cards; Tan chose A + B. The receipt from the konbini (C) was left out: the pointer is locked in play, so nobody can click it until they pause.
- **A, the chip** (ui/maker.js): Tan's face, "Made by Tan / Free, no ads. Say hi?", Coffee first (yellow, the one ask that pays), then X, GitHub, site. It sits on the key art's bottom right, the empty road below the RX-7, on the loading, start and pause cards: no new height, the card's body (Volume, Resume, the address, the credit line) unchanged. Tan's first idea, the screen's corner off the card, ran into the credit line at 1280x720 and read as an ad. On the phone card (the gate), the same as a row under the words: face and name, then Buy Tan a coffee and the icons. A click on the chip never starts the game (hud.js's overlay click skips it).
- **The avatar** is Tan's own portrait (tanuj-fyi/public/tanuj.png): the head cropped to a circle, the black backdrop lifted toward the cards' ink, 96 px webp (48 CSS px at 2x), 3.5 KB; scripts/_avatar.mjs remakes it. Icons are inline SVG; links are plain `<a target="_blank" rel="noopener">`, so nothing is requested from those sites and the CSP is unchanged.
- **B, the postcard** (ui/postcard.js, its own chunk, loaded at the nap): once a page load, 3.5 s of play after Hachi has lain down by the gate at the end of the tour (guide.js calls `GUIDE.onNap` once; config `MAKER.postcardAfter`). Never over the konbini's scene, the full map, Han's drive or a staged view: it waits for them. The pointer is let go while it shows (the game stands still, as behind any card) and the pause card waits behind it (`hud.holdCard`). A click anywhere off its buttons takes the pointer back and the walk goes on; if the browser refuses the pointer, the pause card comes after 0.9 s. Space does the same through its own handler (the pointer back closes the postcard). Esc (not a user gesture, so it cannot take the pointer) puts it away for the pause card. Its links and buttons never close it. Share is the system's share sheet where there is one (else Copy link leads), Post is an X intent with the canonical address and via @tanuj10r.
- **Analytics:** every link and button carries a DataFast goal (`data-fast-goal`: maker_coffee / maker_x / maker_github / maker_site with `data-fast-goal-where` loading_card, start_card, pause_card, phone_card, postcard; postcard_share / postcard_copy / postcard_post), and the postcard calls `datafast('postcard_shown')`. DataFast only runs on the desktop site; elsewhere the attributes do nothing.
- Words in strings.js (`maker`, `postcard`), links and timing in config.js (`MAKER`); vite.config.js writes the chip, the row and their CSS into index.html (`%MAKER:chip:where%`, `%MAKER:row:where%`, `%MAKER:css%`).
- Numbers (production build): code gzip 546,733 -> 549,338 B before the first click (+2.6 KB; the main bundle and a shared chunk), the postcard's chunk 4.1 KB at the nap; index.html 7,745 -> 9,478 B gzip (+1.7 KB, the loading card's chip, the gate's row, their CSS); tan.webp 3,522 B. `npm run size` 4.91 -> 4.92 MB, before the first click 1.59 -> 1.60 MB. No textures, geometry or draw changes.

## The postcard stays reachable; start and resume only on purpose (2026-10-01, Tan)
- **The little postcard.** Once the postcard has come (the end of Hachi's tour), the pause card keeps a small tilted postcard (the Fuji stamp, "Your postcard ✉") in the art's corner beside the chip (core/hud.js `.menu-corner`). It opens the postcard again (`data-fast-goal="postcard_reopen"`; a reopen is not counted again as `postcard_shown`). It glows softly (a warm pulse, CSS) the first time the pause card shows with it, then stays quiet for good; reduced motion: a still yellow ring instead.
- **The postcard's way out is the menu.** A Back button (over the picture's corner), Esc, or a click outside the card all return to the pause card; only Space walks on from it. This reconciles "outside-click resumes" with the new rule below: walking on is always on purpose.
- **Start and Resume only on purpose.** A click anywhere on the start or pause card (or its backdrop) only wakes the sound (`hud.onWake`), so the title song now plays on the start card from the first click instead of being skipped by a click that started the game. The game starts or resumes only from the card's button or Space. The card's cursor is the arrow now, not the hand. Links (Credits, the chip) open their pages; the volume slider is unchanged.
- **Space and the pointer.** Space asks for pointer lock from its keydown (a user activation in Chrome, Safari and Firefox). Checked headless: Firefox grants it from Space as from a click; headless Chrome and WebKit refuse every request, click or key (no focused window), so they could not be told apart there. If a browser refuses (`pointerlockerror` or a rejected promise), the card stays (or the postcard gives way to the pause card) and a toast says "This browser wants a click: press Start" (or Resume). `player.lock()` now returns the browser's promise.
- Numbers (production build): code gzip before the first click 549,338 -> 549,935 B (+0.6 KB), the postcard's chunk 4,078 -> 3,982 B (its stamp moved to ui/maker.js, shared with the little postcard); index.html gzip 9,478 -> 9,948 B. `npm run size` 4.92 MB (1.60 -> 1.61 MB before the first click). No draw changes.

## Links say where they came from; the postcard on every pause (2026-10-01, Tan's items 1 and 7)
- **`?ref=takemebacktojapan`** on every link out to Tan (Coffee, X, GitHub, tanuj.fyi) wherever they show: the chip (loading, start, pause), the phone card's row, the postcard. One place: `MAKER.ref` in config.js (`''` turns it off), applied by `makerLink()` in ui/maker.js. Tan wrote "?jakemebacktojapan works": read as a typo. Checked with curl (a browser's user agent, following redirects): all four answer 200 with the parameter kept; tanuj.fyi redirects to www.tanuj.fyi and carries it along.
- **The shared link stays clean.** The postcard's Share, Copy link and the X post share `https://takemebacktojapan.com` as it is: a `ref` naming the site itself would say nothing in the site's own analytics, and a clean address is what people paste on. If Tan wants shares counted, `MAKER.share` is the one place (say `?ref=postcard`).
- **The little postcard on every pause.** "Your postcard ✉" (the screen's bottom-right corner) shows on every pause card from the first, never on the start card (`hud.setLocked`: hidden until the game has started once). It glows on the first pause that shows it, then is quiet. Its click loads ui/postcard.js then (still its own chunk; nothing loaded before a click or the nap).
- **Its words fit the moment.** Before Hachi's tour is over: "Wish you were here. A little town under Mt. Fuji, and a shiba called Hachi to show you round. Send it to someone who misses Japan too." After the nap: today's "You've seen the whole town, and Hachi's napping by the gate..." (`STRINGS.postcard.msgEarly` / `msg`; main.js `toured`). The postcard still comes by itself once a page load at the nap, whether or not it was opened by hand before (`postcardCame`, not the postcard's own count).
- Checks: `_maker.mjs` 36 pass (no little postcard on the start card; there and glowing on the first pause, quiet on the next; the early words before the tour, the later ones after; every link with the ref), `_play.mjs` all pass. Numbers (production build): all code gzip 556,125 -> 556,299 B (+0.2 KB), the postcard's chunk 3,983 -> 4,007 B, index.html gzip 10,119 -> 10,112 B; `npm run size` 4.92 MB, 1.61 MB before the first click (unchanged). No draw changes.

## EXPERIMENT (branch postcard-selfie, not merged): the selfie postcard (2026-10-01, Tan's item 8)
- **What.** The postcard's picture has "Add your selfie 📷" (top right). On its click only: ui/postcardSelfie.js loads (its own chunk), the front camera is asked for (`getUserMedia`, video only), and the picture becomes the key art with a polaroid standing on the crossing where Hachi sits, the live view in it, Hachi lying over its top corner (paws on the photo, head tilted, tongue out). A shutter, Cancel; after the shot Retake and Save image (a 1600x1000 JPEG, ~0.3 MB, with "Greetings from Fujikawaguchikko / Take Me Back to Japan" in the sky and takemebacktojapan.com in the corner). The postcard's Share sends the picture where the share sheet takes files (`navigator.canShare({ files })`), else the link as before.
- **Hachi** is the game's own pup, not a drawing: scripts/hachi-sprite.mjs renders shiba.js's geometry and rig with the animals' cel material alone on nothing (src/dev/hachiSprite.js, dev only: lying, forepaws out, seen from the front, tilt 0.3, ears past 1 so the tongue is out), adds the ink line in 2D, and writes src/assets/hachi-peek.webp (266x314, 14.6 KB, alpha). No background removal of the player's photo: a polaroid frame instead (cheap, honest, and it reads as a souvenir).
- **The photo never leaves the device.** It is drawn into a canvas in the page and nowhere else: no request, no storage; the note under it says so. The check watches every request: only GETs to this host. The camera stops at the shot (the frame is copied first), at Cancel, when the postcard is put away (Back, Esc, outside click, Space) and on pagehide; a camera granted after the postcard was put away is let go at once.
- **No camera** (none, refused, an old browser): "No camera? Choose a photo instead." and a file input; the same picture from the file.
- **No frame loop.** The live view is a `<video>` under a canvas drawn once with a hole where the photo goes; nothing runs when it is not open. Headers: `Permissions-Policy: camera=(self)` (was `camera=()`); the CSP is unchanged (blob: images were already allowed; a MediaStream needs no CSP source).
- **Cost.** Before the click: nothing new is fetched; the postcard's own chunk grows 4,007 -> 4,410 B gzip (the button, the share-with-file). On the click: postcardSelfie 3,909 B gzip + hachi-peek.webp 14,970 B + keyart-1920.webp if the card took another size (247 KB). `npm run size` counts every file in dist: 4.92 -> 4.94 MB. Memory while open: two 1600x1000 canvases for a moment (6.4 MB each), given back on Cancel.
- **Checks.** scripts/_selfie.mjs with Chrome's fake camera (`--use-fake-device-for-media-stream --use-fake-ui-for-media-stream`): 14 pass. `_maker.mjs` still all pass on the branch.
- **Not checked / open.** A real camera and a real face (the fake feed is a green card); Safari and Firefox; iOS (the phone page never loads the game or the postcard, so this only matters if the postcard is ever shown there: the video is already `playsinline muted autoplay`, the camera is asked from the click; iOS ignores `download` on a blob link, so Save should become Share-with-file there; HTTPS only). In the card the buttons sit over the polaroid's written lip. Space on a focused button also walks on (main.js's Space), as on the postcard's other buttons. Desktop Chrome on macOS has no `navigator.share`, so there the picture goes out by Save image only.

## The selfie postcard, for shipping (2026-10-01, Tan: "proceed with the build"; branch postcard-selfie-2)
Tan's four notes on the experiment above, and what was done:
- **Impossible to miss.** "Add your selfie with Hachi" is now the postcard's first button: the full width of the writing side, filled ink, a camera icon, taller than the share row under it, and it has the focus when the postcard opens (Space still walks on from it). Share, Copy link and Post are all outlined now, so there is one primary. The little "Your postcard" by the pause card carries a round camera badge on its corner.
- **Nothing over the picture.** The picture shows only the art, the polaroid (bigger: 500x600 of the 1600x1000 picture, the live view 245 px wide in the card at 1280x720, was ~190) and Hachi. While the selfie is on, the writing side swaps its message and address lines for the selfie's: one line of words (Allow the camera / Smile! / There you are / what went wrong), Take photo (or Save image, or Try again) full width, Cancel (or Retake and Remove) under it, then the lock and "Your photo stays on your device", then the share row and Tan's row as before. `_selfie.mjs` measures it: no control overlaps the picture or another control, all inside the card.
- **Camera only.** The file input and "Choose a photo" are gone. Refused: "The camera is blocked for this site. Click the camera or lock icon in the address bar, allow the camera, then try again." with Try again. None: "No camera was found on this device..."; busy in another app: says so.
- **Hachi, cuter and sharper.** Rendered at 635x918 (was 266x314; 2.4x what the saved picture shows) with the expression rig from `director-mode` (aPose3..5: big eyes, ear asymmetry, open mouth, both front paws up), head tilted 0.28, tongue out, ears pricked. Two sprites of one view: all of him (hachi-peek.webp, 44.4 KB) and his forelegs (hachi-paws.webp, 11.7 KB). The picture draws him, then the polaroid over him, then the forelegs again clipped below the paper's top edge: he stands behind it with his paws over the edge, on the left so Fuji's peak stays clear. Three poses tried (big eyes; happy squint with the mouth wide; sitting with the other tilt): the big sparkling eyes won. No second sprite: 56 KB is already the ask's ceiling. `scripts/hachi-sprite.mjs --rig director-mode` reads shiba.js and shade.js from that ref for the render only (nothing copied into the tree); once the rig is on main it runs without the flag.
- **Space.** On one of the selfie's buttons Space is that button's (main.js: `[data-sf]`), so the shutter can be pressed with it and the walk does not resume. Elsewhere on the postcard Space still walks on.
- **Live at the first frame.** The live view is shown when the video's first frame is in (`loadeddata`, or 4 s), not when `play()` resolves: in headless Chrome that promise sometimes never settled on a second stream.
- Kept: the photo only ever in a canvas in the page; the camera stops at the shot, Cancel, the postcard put away, pagehide; its own chunk; nothing fetched before the click.
- **Cost.** Before the click: the postcard's chunk 4,410 -> 4,643 B gzip (itself lazy), the main bundle +~0.2 KB (the camera icon, the badge), index.html 10,146 -> 10,254 B gzip. On the click: postcardSelfie 4,187 B gzip + 44.4 KB + 11.7 KB of Hachi. `npm run size` counts all of dist: 4.94 -> 4.98 MB, 0.02 MB under the 5 MB budget (it now lists the selfie's files on their own line and leaves them out of "before the first click"). If the budget pinches, Hachi at 1.7x instead of 2.4x is ~35 KB for the pair.
- Checks: `_selfie.mjs` 21 pass (Chrome's fake camera), `_maker.mjs` all pass. Still not checked: a real camera and face, Safari, Firefox.

## Selfie postcard: how many take one; three Hachis to choose from (2026-10-01, Tan)
- **Goals** (DataFast, the live desktop site only; `window.datafast?.(name)` as `postcard_shown` is fired, a name and nothing else, never the photo): `selfie_open` ("Add your selfie with Hachi" clicked), `selfie_camera_allowed` (a camera came; also on Retake and Try again), `selfie_camera_refused` (no camera came: refused, missing or busy), `selfie_taken` (the shutter), `selfie_saved` (Save image), `selfie_shared` (the share sheet took the picture and resolved). They replace the three `data-fast-goal` attributes the selfie's buttons had (`postcard_selfie`, `postcard_selfie_shot`, `postcard_selfie_save`), so nothing is counted twice. `_selfie.mjs` stubs `window.datafast` and `navigator.share` and counts each (23 pass).
- **Three Hachis, not wired in** (Tan did not like the shipped one's open dark mouth): `scripts/hachi-options.mjs OUT --rig director-mode` renders A (peeking over the top edge, two paws, a head tilt, a blep), B (round the top left corner, paws on it, leaning in, a wink) and C (sitting on top, tail curled, a hachimaki, a petal on his nose), each 1150-1350 x 1620-1760 px with alpha, alone and on the polaroid in the saved picture, and one sheet. They are the game's pup, with things only the postcard's render adds round the rig (src/dev/hachiSprite.js): chibi proportions (head x1.2, body x0.9 about the neck's root), a wink, rosy cheeks and the hachimaki painted in the fragment shader, the petal drawn in 2D where his nose projects; the mouth closed (the smile's line), the tongue a tip at most. `compose()` in ui/postcardSelfie.js takes an optional `stage` so the options are drawn by the same code as the real picture; without it nothing changes.

## Selfie postcard: the first Hachi back (2026-10-01, Tan)
- Tan chose none of the three options and asked for the very first sprite again: src/assets/hachi-peek.webp is the file from the experiment (commit 7c83e24: 266x314, 15.0 KB; lying over the polaroid's top right corner, paws on the photo, head tilted, tongue out), with its first placement (43% of him over the paper, 14% past its right edge, leaning 0.1), scaled with the bigger polaroid (284 px wide in the 1600 px picture, so the 266 px file is drawn a touch over its size: 1.07x).
- Not re-rendered larger: with today's rig (Hachi's reactions) the same pose draws a dark open mouth behind the tongue that the first one did not have, so it is not the same face. scripts/hachi-sprite.mjs keeps the pose for the day that is wanted; the shipped file is the original.
- Gone: hachi-paws.webp, the two-layer drawing, the three options' dev code (src/dev/hachiOptions.js, scripts/hachi-options.mjs) and `compose()`'s `stage`. Kept from v2: the first, plain-to-see button and the camera badge, the controls on the writing side, camera only, the goals, Space on a selfie button.
- Cost now: on the click postcardSelfie 4,185 B gzip + hachi-peek.webp 14,970 B; the postcard's chunk 4,675 B gzip. `npm run size` 4.97 MB in all (main with Hachi's reactions and the store's stock is most of it; the selfie's own files are 19 KB of that), 1.63 MB before the first click.

## Train floors: no more streaks (2026-10-01, Tan's play-test)
- **Cause:** z-fighting. Each car's underframe skin was one 0.2 m slab per side whose top face sat at exactly `FLOOR`, the same height as the floor's top, across the whole car. Two coplanar faces from different meshes (and, on the Pokémon set, two different textures: the floor art and the side art's lowest row) won pixel by pixel by rounding, which drew the horizontal streaks and stair-step bands Tan saw on every type, most on train-poke (paw-print floor against the brown band). Not shadow acne (back faces cast here, and the floor doesn't cast), not texture filtering (the art page is mipmapped; the plain sets have no texture and showed it too).
- **Fix (line/emu.js):** the underframe is now a slab under the floor (FLOOR-0.2..FLOOR-0.1) and a 6 cm rim round it (sides and ends) up to FLOOR, abutting the floor box instead of under it; the gangway's tread plate now stops at the car end instead of reaching 2 cm under the rim. Nothing else lies at floor height inside a car. From outside the skin reads the same (same height, same faces, same art); same draw calls (the extra boxes merge into the same meshes), +48 triangles a car.

## Hachi's bedtime on the gate's bench (2026-10-01, Tan's play-test: "half sunk into the ground"; make it "aww")
- **Cause of the sinking:** the gate's gravel forecourt is drawn 2.5 cm up (land/gate.js) but the ground model said 0 there, and the lying pose (shiba.js `LIE_DROP`) puts the belly ~5 mm under the pup's own feet: lying on the gravel it was ~3 cm into it, legs gone. Fixed twice over: the forecourt is now a platform at its drawn height (`ctx.platform`, top 0.025: the pup and you stand on the gravel), and lying lifts the pup 12 mm so the belly rests on whatever it lies on (guide.js; shiba.js, shared with the other shibas, is untouched).
- **The bench** (land/gate.js, config `TOWN.land.gateBench`): a small 縁台, three slats on two leg frames and a stretcher, in the gate's own wood, 1.4 m along the gate in front of the rope, on the left of the track (it leaves the way to the gate and the board clear). Collider to its seat height (0.42 m: the player's 0.38 m step doesn't climb it; the walk grid keeps the pup's paths round it).
- **The bedtime** (guide.js `bedtime()`, timings in `ANIMALS.guide.bedtime`): the nap spot (`nap`) is now the bench's foot. It turns to the bench, crouches and hops up in an arc (0.5 s), lands with a yip, a play bow at you with its rump wiggling, a happy spin that ends side-on, over onto its back with its paws going (a snort), sits up with a head tilt ("hm?"), turns round one and a half times nose down, and lies down along the seat, the way round that turns its sleeping face to the forecourt; a sleepy breath (dog-snore: there is no sigh recipe and a new sound wasn't wanted). About 8.6 s from landing. While you're about (25 m) it plays to you; else out over the forecourt. Asleep, it wakes its ears and wags if you come within 3 m, and snores now and then, as before.
- **`GUIDE.onNap`** keeps its name and meaning: it fires once, when it has settled (lying, after the circles), not on arrival. The postcard comes `MAKER.postcardAfter` s after that, as before.
- **Leaving the bench:** whatever moves it on (a whistle, the Strong Nine, a jump to a famous view) it hops down to the bench's foot first (0.42 s), never walking off in the air; anything that sets it somewhere (setAt, the respawn, a staged pose, reset) takes it off the bench at once.
- Checks: `_guide.mjs bedtime` (new): lands on the seat (never below it), settles asleep on it, onNap at the settle and not before, its yip, snort, hmm and snore heard; the tour check ignores the bench's collider while it is perched. Frames: scratchpad nap/seq/.

## The whistle: he comes from where he is (2026-10-01, Tan's play-test: "runs in from a random place in front of me, out of nowhere")
- **Cause:** answer() moved the pup whenever you couldn't see it (beyond 40 m, outside a 30° cone, or anything between): it was set on a street 10-18 m *ahead* of you and ran in from there. So a pup you had just overtaken (behind you, out of the cone) appeared in front of you; and up on the gate's bench (a blocked cell, so never "in sight") it always jumped.
- **Now (config `ANIMALS.guide.whistle`):** within `runFrom` 60 m of you and `reach` 80 m by the way, it is never moved: it runs from where it really is, down the walk grid's field (behind you it comes from behind, round a corner round the corner), at a `sprint` of 8.5 m/s while more than ~20 m off, easing to the bounding 4.4 m/s gallop for the last ten metres, where you see it come. Coming up from behind, it runs past your shoulder to the spot in front of you and greets you there (it used to greet you at your heels, out of view, once within 1.1 m). The steer looks further ahead at a sprint (half a second of way), or it could never go faster than ~6 m/s.
- **Farther (or no way from there):** `comeFrom()` sets it on its own way to you, at the first point of that way 14-45 m from you by the way that you can't see (more than 62° off your lens, or behind something tall); with no way from where it is, on a street on the side it really is, out of sight. It then runs in. If there is nowhere unseen, it isn't moved at all (it runs the whole way). Never a jump into your view.
- The whistle's field is grown 320 pavement-metres out over the notes (a road crossed off a zebra counts ~20 a metre; at 120 the way round the store, 35 m off, didn't reach). answer() itself takes 0.1-1.3 ms.
- The Strong Nine's party still enters your view as before (Tan asked for that one to be seen); only the whistle changed.
- Checks: `_guide.mjs whistle` now runs six cases: 18 m behind you (just overtaken), 20 m to the side, 20 m ahead in view, ~35 m behind the store (out of sight), and 100+ m away facing either way. It records where it starts after the answer, whether it was moved, the way it was from you against the way it is set (`sideDeg`), and every frame any jump of more than a metre that lands in your view (`popped`). All pass: the four near cases never move (reached in 4.0, 4.8, 4.5 and 9.8 s); the far ones are set 15 m off by the way, on its route, 90° to your side, out of view, and with you in 3.4 s.

## Hachi's reactions in play, the konbini bits, and after the tour (2026-10-01, Tan: "the game has become centred on Hachi's cuteness; more reactions = more fun")
- **The rig** (animals/shiba.js, shade.js `Herd extra`): Director Mode's expression channels are in the game: three more pose vectors on the one instance (aPose3 ears back / one ear up / eyelids / big eyes, aPose4 mouth / tail tucked / crouch / one paw, aPose5 hips / face squish / both paws), the eyes, their glints and the mouth as parts of their own. Still one draw call, the same 11,632 triangles; with every channel at 0 the shader does what it did (`_hachi.mjs rest`: all twelve values 0 standing, sat and lying). Director Mode itself (src/director) stays on its branch.
- **The reaction layer** (new animals/reactions.js): guide.js still works out where the pup is and how it stands; the layer lays a face (a mood asked for each frame: ears back and tongue at a gallop, a squint and a grin on its back, eyes shut asleep) and timed reactions over that pose as it is drawn, each blended in and out, sounds on their beats, the ears sprung. Nothing playing: the base pose goes through unchanged. A reaction marked `hold` stands the pup where it is while it plays (in lead, atSpot, gate, wait, linger, ready); the tour's own clocks pause for those seconds.
- **When** (config `ANIMALS.guide.react`): blinks always (every 2-5 s, sometimes two; not asleep); a head tilt with one ear up when you stand looking at it for a second (then not for 9-18 s); tippy taps when you come up to a place with it and at the gate, a happy wiggle and spin when you step into a ring; a petal on the nose (sniff, sneeze, shake) every 22-50 s of waiting; a yawn after 9 s kept waiting, then a slow blink, a yawn...; a proud strut for a few strides every 14-30 s of leading you; a startle when the crossing's bells start within 24 m or the RX-7 passes within 10 m at speed (a jump, low and trembling, a shake, then a brave woof; not again for 45 s); watching you walk off, big eyes and ears back; asleep, eyes shut and a dream now and then. Idle play gained tippy taps, a grin, a sniff of the ground and a lick. Puppy eyes and begging are the konbini's (below).
- **The pigeons** (config `charge`; animals/pigeons.js `PIGEONS`): leading you past a flock on the ground ahead of it within 12 m (you within 13 m), it bows at them, tears in along a tangent onto a 2.5 s lap round them at 6.4 m/s (the existing zoomies), they go up as they do for you, and it looks up after them, pleased, then leads on. Both flocks (the shopping street's, the plaza's) are on the tour's line. Not the same flock again for 150 s. A judgement call: it is its own state (`charge`), not an act inside `lead`, so the tour's leg logic is untouched.
- **Voices** (core/sound.js, recipes, no files): dog-yawn, dog-tip, dog-yelp, dog-sniff from Director Mode, now shipped; new dog-hic, dog-lick, dog-munch. Local to the pup like the rest (16 m).
- **The konbini** (reactions.js `SNACKS`, guide.js `snack`, shop.js `onSnack`): paid and on your way out, it runs to a spot 3.9 m out in front of where you eat and 1 m to your left and begs (puppy eyes, a paw). While you eat it does the product's bit on your clock, then its end: Strong Nine: both paws up round a can that isn't there, head tipped back for your two gulps, "paah"; then hiccups, a wobble, over onto its back giggling, up, a shake, one last hic (9 s, the length of your tipsiness). Egg sando: munches bite for bite, then a long lick of the lips and a grin. Fruit sando: up on its haunches, dainty nibbles, then it swoons flat with a sigh and one eye opens. Tuna onigiri: the nose goes mad, chomps with a shake of the head, then a sneeze (rice on the nose) and tippy taps for more. Choco Wafer Jumbo: the biggest puppy eyes and a paw, licking the air at each bite; then the cold hits (a shiver), and a happy spin in the air. Afterwards the tour goes on as it would have. The spot is on the road's zebra in front of the door (the forecourt is shallower than the 3.4 m at which a 24 cm pup clears the bottom of your view); your eyes while you eat are now 5 degrees down the road (shop.js: the look-at point's height 1.45 -> 0.55 m) so it sits whole in the frame, left of the hand. The old `party` state and `GUIDE.tipsy(10)` call are gone; `tipsy()` remains as the Strong Nine's end played anywhere (dev and the check).
- **The sinking** (Tan: tipsy and rolling, it sank under the road): measured, the idle roll put the pup up to 7 cm under the ground: on its back it rests on its head and shoulders, which stand higher than the 9 cm the roll was lifted by; half-sat and already turning over, its rump went under; on its side the paddling legs and a turned head went under. Now: the lift a roll needs is a measured table by angle, standing and lying (config `rollUp`; `_hachi.mjs --only profile` prints it); it goes over only once it is down; the paws go only once it is on its back; the head's turn fades on its side; the trot's bob stays out of a roll; a play bow sits 3 cm higher (its elbows were in the ground) and a pup tipped nose-up or nose-down comes up with the tip (`bowLift`, `tipLift`). The check: dev `__guide.lowest()` draws the pup alone side-on and end-on through an orthographic lens and reads the lowest drawn row; the roll and every bit stay within 1.5 cm of the surface (the plain sit already rests 1.1-1.5 cm in, unchanged).
- **After the tour** (guide.js `pal`, config `pal`): the tour ends as before (the bench, the nap, `GUIDE.onNap` once it has settled). Whistled then, it comes and stays: at your side and a little ahead as you walk, sat in front of you and playing when you stop. The tour again: E when it is within 6 m and you look at it ("E · Take the tour again", strings.js `hachi.again`; also by the bench while it sleeps), and only that (a second whistle just brings it to you: a tour restarted by a stray F was too easy; changed at the merge with the tour rework). Everything is to do again, his home and the shrine's fox included, from the konbini (a place counts this time when you step into its ring, since each place's own `used` flag stays set); a spin, a toast ("Off we go again. Follow Hachi"). `onNap` fires again when that tour is over (main.js still shows the postcard once per load). Left alone it goes back to its bench: it follows at no more than its jog (3.6 m/s), so a run leaves it behind; you more than 14 m off, or in the store, for 25 s. Judgement call: "left alone" needed a way to happen, since a pup that can outrun you is never left; hence the jog cap in this state only.
- **Scripts:** `_guide.mjs` gains `reactions`, `snack`, `after`, the tour counts its charges (2), the tipsy check is the Strong Nine's end; new `_hachi.mjs` makes the contact sheets (reactions, rest, surface, each konbini visit in your view and close, pigeons, after). `_guide`, `_hachi`, `_konbini`, `_play` now take `/tmp/lawson-browser.lock` themselves, before the shots lock (taken after it, a run that held the browser lock in a wrapper and queued on the shots lock deadlocked with one waiting the other way round).
- Numbers: code gzip 556,268 -> 567,236 B (+11.0 KB: reactions.js and the states); `npm run size` 4.92 -> 4.93 MB in all, 1.61 -> 1.62 MB before the first click. No textures, no audio files, no new draw calls: hero 730 calls / 2,476k triangles, the door 828 / 3,171k, both as before; dog 11,632 triangles as before. JS heap after start (dev, `_guide.mjs --measure`) 305 -> 306 MB. Frame ms at the four spots 10.4 / 11.1 / 8.7 / 10.9 before, 11.9 / 12.2 / 9.1 / 12.9 after, measured back to back on a laptop other runs were loading at the time: same calls and triangles, so read it as noise, not as proof of no cost.
- Also: waiting where you left it, its zoomies now keep to a circle by where it stopped (lap after lap it could drift 6 m down the street: `_guide.mjs wander` caught it once the idle mix changed).
## Hachi's tour: the crossing, his own home, the shrine's fox (2026-10-01, Tan's play-test items 5 and 6)
- **The route** (config `ANIMALS.guide.tour`, 41 legs, 867 m by the waypoints; the follower's run: 931 m of pup, 495 s with a wait at the crossing): view, konbini (14 m), the main road's zebra, Han (72), the far pavement to the shopping street (178), ドンペン堂 (215), the plaza and platform 1's train (305), **through the plaza to the level crossing** (361), over it to **ハチのおうち** (380), back over, up lane x 80 and west along lane z 112 to lane x 0, **the shrine** (573: in under the torii to the fox), lane z 80 and lane x 30 to the pond's gate and the slow-life bench (672), back out by the pond's gate and down lane x 30 over the master junction and 富士見橋 to the Deer Park gate (867) and the bench nap, last as before. Gone: the hop over the main road and back after Han (the piyo zebra is heard from the kakko zebra, and passed at the end), the walk from the crossing to lane x 30 and back for the shrine. What is still walked twice: the crossing's lane (30 m: his home is a dead end), the pond gate's lane (23 m) and lane x 30 between lanes z 112 and z 80 (32 m): the bench is a dead end too. Lane z 80's own end at the paddies was tried and dropped: a guardrail shuts it to you (the pup squeezed by; the follower stood stuck).
- **The level crossing** (`cross` legs, one each side): at the barrier he goes over only with the arms right up and nothing due (`service.cross.closing` false, `armT` under 0.04). Else he sits facing the line, a boof and his head following the train while it is within 70 m, up on his feet as the arms lift, a hop and a yip, and over. Not "timed" beyond that: no train is sent to make a wait (the timetable shuts it about once a minute; the tour check met a 36 s wait). Two guards hold whatever he is doing (a whistle, a rush): `move()` never steps onto the crossing while it is shut, and caught on it as it shuts (he had stopped to look back for you) he runs off it (`railClear`: off in 1.4 s, the arms still up).
- **His home** (`TOWN.hachiHome`, animals/home.js): the house beyond the line at the lane's end is not built (line/index.js `buildBeyond` skips that lot: one of the row of out-of-bounds houses, no name, no sign, in no famous view); the lane's guardrail went and the south fence opens there (town-core.js). In the lot: a gate with ハチのおうち over it, a lawn, stepping stones, his kennel (shiba.js `buildKennel`, moved from the lane yard it was searched into at load; that search and its scene traversal are gone) with a ハチ plate, a checked blanket, the water bowl and a food bowl on a tray, a ball, a chew bone, a rope, a squeaky duck, a frisbee, flower beds, a low white picket fence, a hedge behind, a paper lamp lit after dark, a cherry. One painted mesh (vertex colours) + the kennel + one 256x128 sign page (gate board, kennel plate) + the lamp + the ball (its own mesh: it rolls when he noses it). The whole group is hidden beyond 130 m.
- **The garden lies past the town's bounds** (z 172-180.4; the clamp is 174): `world.pocket`, one rect the player's clamp lets through (core/player.js, 4 lines); its own fences are the colliders. The guide's grid reaches it (340,990 cells, +3%). Walked in by the real loop: over the crossing, through the gate, to every fence.
- **The visit** (`visit` legs; `ANIMALS.guide.visit`): he waits just inside his gate, hopping, until you are within 9 m; then the joy: a bounding run to the middle of the lawn, three high bounces (0.3 m: he is 0.24), two spins, a lap, a play bow at his ball and a push with his nose (it rolls), after it; then onto his blanket, sat tall, chin up, looking at you for 3.2 s; a hop, and on to the shrine. About 12 s. The place counts as visited when you step in through the gate; if you only watch from the lane he moves on after 16 s. At the shrine he goes in under the torii and up the path to a guardian fox, sits by its plinth looking back at you, 3 s once you are in past the stone fence (14 s if you stay out). Neither is an engagement: no ring, no E; a paw on the map ("Hachi's home · ハチのおうち").
- **Whistle:** rushing you to the nearest place you haven't been, a place on the tour before it that you haven't been into comes first (`tourRush`), from its crossing barrier.
- **Other fixes on the way:** the shrine's gravel and stone path are ground now (platforms 4 and 7.5 cm: the pup stood 7-9 cm into the path); Hachi leaves the car park by its west end (a 15 cm kerb along the pavement); a map label never runs off the sheet.
- **Checks:** `_guide.mjs` tour (the trains run in it now; visited home and shrine, never onto the crossing while shut, the joy's phases seen), new `crossing` (shut as he comes: sat 16.6 s, the train by, over at arm 0.00; the joy; caught on the deck: off in 1.4 s), and the other seven: all pass. `_play` 20/20, `_audio` all passed, the walk check 6 routes stuck 0. Hero guard 0.335 / 0.128 / 0.088 %: the same three numbers as main's own code against the same baseline (a cherry's shadow on the house left of the store, there before this), so this change moves no pixel of the famous views.
- **Cost:** `npm run size` 4.93 MB (code 0.54 MB), as before. Hero view 730 draw calls (main 730), 2,462k triangles (main 2,476k: the house); heap 310 MB against main's 305 (within the run-to-run spread; the fields grew 3%). Textures 181 = main's 181 (the sign page in, the house's out).
- **Merged with the tour rework ([tour-B]: the crossing's barrier, his home, the shrine's fox).** Order in a frame: off the rails first (`railClear`), then this block's states and holds, then the tour. In his home and by the fox nothing of this plays (the visit is the show); sat at the barrier only the startle as the bells start (seated), and then he watches the train as the tour has him. The pigeons' charge and every move here go through the same `move()`, so never onto a shut crossing. The tour again clears the visits too (`tourReset`).


## The konbini, only what is seen (2026-10-01, Tan's item 3: "lighter and smoother"; the desktop takes what the phone build learned)
- **Why:** you no longer roam the store: you stand outside, or one of five scripted visits walks you through. But it was built and held for roaming: 192 MB of textures (the price tags 2048 x 5472 = 57 MB, two label pages 3072^2 = 48 MB each, the second 45% empty), the same again in the canvases they were painted on (144 MB, never let go), 36 MB of stock vertices on the GPU and the same on the CPU. Nearly half the game's texture memory.
- **What is ever seen is measured, not guessed** (`node scripts/_store-seen.mjs`, page side src/dev/store-seen.js; it writes src/world/store/seen-data.js). 35,412 poses: the five visits stepped at 60 and 30 frames a second; every way you can look along the walk out (found on the way: once you have paid the mouse is yours again while the walk carries you, so the "fixed route" is not a fixed view); a grid over the forecourt, the car park and the street up to the glass, every way toward the store; the famous views' own lenses. From each the store is drawn with every stock unit's six sides, every painted quad and every solid part in its own colour behind everything opaque (glass, cut-outs and what moves never hide: the safe side), at a 32:9 window. A side seen on one unit counts for its neighbours within 13 cm; the featured things and everything within 40 cm of them stay whole (they are taken, the next slides forward).
- **The honest result:** because you can look round on the way out, almost everything is seen from somewhere: 3 of 6164 units, 44 of 1006 quads and 2 of 981 solid parts are never seen (the phone, with no free look, dropped 106 units). What does go is sides: of 36,984 unit sides 25,669 are ever seen (backs on 53% of units, bottoms on 21%). No room, back area or fixture turned out to be invisible: nothing else was removed.
- **Stock geometry** (store/products.js): only the sides ever seen, each vertex once (indexed), the arrays let go once the GPU has them (`onUpload`); what can be taken keeps its own small rewritable mesh. 542k -> 423k triangles, 36.4 -> 20.2 MB on the GPU, 36.4 -> 2.5 MB kept on the CPU.
- **The painted pages** (store/pages.js): a page lives at a level, 0 the painting, L its mipmap L. A level above 0 is made on the GPU as a texel-for-texel copy of the painting's own mipmap (and its chain made the same way), so it draws what the painting would have wherever the sampler kept to level L and up; the tool measures that (the most screen pixels a metre of each label ever covers at a 2160-line 16:9 frame, against its texels a metre, with a 15% margin). Products are grouped into pages by the level they can be from afar (store/labels.js; 11 rows a page at most, no padding), price tags likewise. Beyond 15 m of the glass (`near`; the famous view's spot is 16.5 m out) the pages are at those levels; within it and through a visit they are the paintings again, repainted a few cells a frame (8 ms a frame at most) and uploaded one page a frame, then let go when you leave (past 16.2 m). The far levels are measured from 9 m out, so there are 6 m of walking to bring them back (in the headless check they were all back by 11.8 m at 4 m/s, by 7.6 m at 9 m/s; you walk at 2.55 and run at 5.1). Every canvas is given back once uploaded.
- **Not pixel-identical, and why:** regrouping the label cells changes which label is next to which, and at grazing angles the filter reaches a texel or two across a cell's edge. Against a pristine build, same frames (scripts/_store-lean.mjs frames / compare, 102 frames: the famous views, the forecourt, the glass, the door, all five visits every 1.5 s): differences are isolated pixels on shelves, 0.1-0.5% of a frame, invisible at 3x zoom side by side; two runs of the pristine build differ as much from bubbles and blossom outside. The hero guard: 0.001%, 0.002%, 0.006% (limit 0.5%). With the cells left where they were (an earlier step) the famous views were identical to the bit.
- **Unmeasured stores build whole.** seen-data.js carries the counts it was measured on (units, quads, solid parts, products); change the planogram, the catalogue or the room and the game builds everything as before (pages always the paintings) until the tool is run again. `?storewhole` (dev) does the same on purpose: the old free-roam dev spots (shots.mjs store-*) stand where no player does, so from them a never-seen side can be missing; use `?storewhole` for stills from there.
- **Numbers** (headless Chrome, M-series, same run back to back; before -> after): store textures 192.2 -> 59.6 MB away from it (anywhere past 16 m, the famous view included), 172.8 MB at it; canvases behind them 144.2 -> 29.3 MB; whole scene's textures at the famous view 425.9 -> 293.2 MB; JS heap after start 301 -> 272 MB; frame at 2560x1440 x1.5: famous view 13.5 -> 11.1 ms, door 9.8 -> 8.9 ms, visits (average) 7.9-8.8 -> 6.9-8.2 ms; draw calls +6 at the famous view (731 -> 737: four label pages and five tag pages where there were two and one), triangles 2476k -> 2357k. `npm run size` 4.92 -> 4.93 MB (seen-data.js). _konbini.mjs (all five visits), _play.mjs, _audio.mjs pass.
- **Left for later, with what it would give:** the store at the door is still 173 MB, because up close the labels really are magnified (443 of 456 are seen at their whole 192 px somewhere) and 328 of 456 price tags are passed within 35 cm; a third "inside, this visit" level as on the phone would cut that but repaint between visits. The ~55 small sign textures (38 MB together, one draw each) could share one page: fewer draws, but their mipmaps would no longer be their own. If memory is wanted back as quality instead: the 25 products that stay at level 0 from the street and the five featured things could be painted at 256 px cells (+4 MB) for sharper labels in the hand.

## ぺったん堂, the mochi-pounding shop (2026-10-01, Tan)
- The shop, its show, the buying and the new hand: docs/decisions/mochi.md.
- **Its sound is Tan's file** `assets/audio/mochimochi.mp3` (cut `mochi-pound`), a recording of the real Kyoto shop's pounding and chant, used by Tan's choice as the door chime is (M3d); never committed. Without it the engine's recipe plays from the same cue table.
- **Download budget 5 -> 5.25 MB** (Tan): scripts/size.mjs and AGENTS.md. Now 5.03 MB.

## The crossing's rails, the lane's end at Hachi's gate, a better home (2026-10-02, Tan's play-test of the tour rework)
- **The rails flickered on the level crossing: cause.** The deck's top and the rails' heads were at the same height (both `RAIL_TOP + 0.01`, 0.31 m) and the deck's boards lay right across the rails, so two faces shared one plane; the sleepers under the deck (top 0.30) were inside the boards too. The station's own crossing (構内踏切) had the same fault (a solid 0.31 m slab over the rails). **Fix:** one surface owns each strip. `track.js deckBoards()` lays the boards between and beside the rails with a groove at each (4 cm clear of the head on the field side, 9 cm on the gauge side, as a real flangeway), so a rail stands in its groove with its head flush and no board lies over it; `buildTrack({ decks })` lays no sleepers under a deck. Both crossings use it. No polygon offset, no lifted rails. Measured standing on the ramp, 12 frames 0.2 mm apart (a rail's edge moves 0.05 px): 5,400-14,800 pixels changed frame to frame before, 0 after (one frame 960: a single row). There is no separate Pocket/mobile crossing in this repo: the one `line/crossing.js` serves every build.
- **The lane's end.** A 止まれ, a stop line, two warning tiles and the lane's green bands ran into Hachi's gate, left from when the lane was a dead end at a house. South of the line there is no traffic now, so the stop line and 止まれ stay only on the north approach (the word narrowed to 2.1 m: it lay over the lane's edge lines), the warning tiles only on the north side (`kit/street/walks.js`), and the stub south of the ramp is a paved forecourt (`line/crossing.js`): stone setts in a running bond with a border course, kerbed at the sides, from the ramp's foot to the fence; it lies over the lane's own paint, which ends at its edge. The mat (いらっしゃい) and a red mailbox (ハチ) stand on it by the gate. Not done: a yellow hatch on the crossing (the game has none anywhere).
- **The home, again** (`animals/home.js`, rebuilt). A Japanese doghouse 1.7 x 1.5 m and 1.75 m to its ridge (it was a 0.7 m box): raised floor and porch with a step, plaster in a timber frame, a tiled roof with rolls and a ridge, an arched doorway, round windows, a paper lantern, his hand-painted name with a paw, a red cushion inside. Round it: a cushion bed on the checked blanket, two bowls in a stand with his name, a basket of toys spilling over (duck, frisbee, bone, a blue ball, the rope trailing out), the red ball (it still rolls), a play tunnel, a hoop, a sandpit with a bone half dug up and a spade, paw prints on the stepping stones, potted flowers, bunting and a string of bulbs from post to post (the bulbs and the two lamps glow after dark, kit/night.js). Not built: a tyre swing (the hoop and tunnel are the play things; nothing to hang it from but the town's instanced cherry). `shiba.js buildKennel` is untouched and no longer called.
- **Cost of the home:** 4 draws (was 6): one painted mesh, the sign page, the glowing paper and bulbs, the ball; 31,738 triangles (was 19,520); one 256x128 texture as before (gate board, name plate, mat: 131 KB, 0.17 MB with mips). Stood in the garden: 191 draw calls, 1,737k triangles (before 195, 1,716k). Hidden beyond 130 m as before.
- **His door, his tunnel, his hoop keep you out, not him:** colliders flagged `pet` (the player's own collision takes them; the guide's grid skips them). The doghouse's back and side walls are plain colliders; its floor, porch, step and his cushion are platforms (he stands on them, not in them).
- **The joy** (`ANIMALS.guide.visit.home`, about 17 s): the gate hops, in at a run, 1.3 s of high bounces, two spins, through his tunnel, a leap through his hoop (the hop, 0.4 m), up his porch and in at his door, round, his head out of the door with a yip, out, a play bow at his ball and a push (it rolls), and a flop onto his cushion on his side, looking at you, 3.4 s once you are in; then on to the shrine. The lap of the lawn and the proud sit on the blanket went. Through the tunnel, the hoop and the door he is moved straight (`glide`), not by the grid.
- **Checks (after merging main with the selfie postcard and the mochi shop):** `_guide.mjs` 13/13 (tour: every phase of the joy seen, never onto a shut crossing; crossing; ground: nothing drawn over where he stands, which found the deck's edge and the gate's threshold, both fixed), `_play` 20/20, the walk check 6 routes stuck 0, hero guard 0.336 / 0.130 / 0.094 % (main's own code: 0.337 / 0.130 / 0.094), `npm run size` 5.06 MB (main 5.06; code 0.58 against 0.57), heap 287 MB, hero view 739 calls.

## The plaza's bus stop, rebuilt (2026-10-02, Tan: "looks pathetic. Redo that area.")
- **What was there** (line/station.js, M2c): a roof slab on two posts, a glass plane, a plank with no legs, the stop pole; on the paving nothing, behind it the police box's blank wall.
- **Now** (new world/line/busstop.js, called from station.js; names in new data/bus.js): a country shelter 4.2 x 1.7 m: timber posts on stone feet, wall plates, tie beams and braces, boarded to the waist with battens, a window in the back's south bay and in the two half sides, a gabled roof (0.42 rad) with standing seams, a ridge cap, bargeboards, boarded gables, a gutter on each eave and a downpipe to the corner post; the kit's slat bench with legs and a backrest; inside a route map (ふじみ号 路線図: a loop of six stops, this one in red, the fare) and a poster; バスのりば / 富士川口湖駅前 / ふじみ号 on a board under the eave; a lamp on a cord (the street lamps' material, so it lights with them), a pool of light and a warm wash on the boards after dark. Round it: the stop pole (the existing head and timetable) with a "1 ふじみ号 のりば" plate, a vending machine and its bin, two planters, a clipped hedge along the plaza's edge behind it all (boxes with a lumpy top, two greens: about 2k triangles; the kit's painted shrubs were 5k each and came through the back wall), and on the police box's blank wall two posters and a crowd of pots. The side windows of the station's small buildings (the police box, the kiosk) got a pale frame and a sill: they were dark squares on a wall.
- **On the paving:** a bus bay (yellow box 2.8 x 8 m, バス, a white boarding line) in front of the shelter, and the tactile path now comes west along the plaza's north side, round the bay's end, to a pad of warning blocks at the door (it used to run straight across where the bay is).
- **Found on the way:** the station's decals (the tactile path to the steps, the taxi rank's yellow box) were laid at `y - asphaltY`, 2 cm under the paving, so they had never been seen. A decal's height is the surface's own (kit/decals.js adds its hair): both show now.
- **Names:** ふじみ号 (the community bus), 富士川口湖駅前 (the stop), its loop 駅前 / 商店街 / ニッポン前 / 湖畔公園 / ふじみ稲荷 / 役場前: ours. They live in data/bus.js, not data/town.js, because the brush font is cut from town.js alone and nothing here is brushed (it would have cost about 5 KB of glyphs).
- **Cost** (Tan's viewpoint, 1600x900, same run, main -> this): draw calls 338 -> 343, triangles 2,238k -> 2,279k (+41k: the vending machine, the five pot plants, the bench, planters; the shelter itself is 5 meshes, about 2k), frame 3.5-4.0 ms both (within the run's noise). Three small canvases (512x64, 256x72, 512x320: 0.4 MB with mipmaps). Code +2.6 KB gzip.
- Frames: scratchpad desk5/busstop/ (before- and after-, tan / front / north / bay at day, golden, blue; after-inside-blue).

## Sign fonts cut again (2026-10-02, Tan approved installing the tool)
- **Why:** the subsets were last cut before ぺったん堂, the train's countdown and today's bus stop, so their new characters fell back to a system face. In the brush face: 兎 (the shop's seal) and 抹 (抹茶いちご餅), ¥, and 次 到 着 秒 (the boards' countdown strings in data/town.js); 速 茶 餅 高 were already there. In the round face 25: 丸 兎 到 増 役 担 杵 柔 漂 王 着 秒 組 臼 芋 苔 虫 軟 郎 鉢, É ū ’ ‹ › ↑ ↓. Hachi's home (ハチのおうち, いらっしゃい) is kana: always in.
- **The tool:** fontTools 4.60.2 and brotli 1.2.0, `python3 -m pip install --user fonttools brotli` (Tan's user site, ~/Library/Python/3.9). scripts/subset-fonts.mjs now finds pip's per-user `pyftsubset` when it is not on PATH, so `npm run fonts` runs as is.
- **Sizes:** round.woff2 180,532 -> 155,980 B (982 characters: 25 in, 155 out that nothing in src/ draws any more, from before the launch's clean-out); brush.woff2 385,748 -> 388,348 B (608 characters: 7 in). Together 566.3 -> 544.3 KB. `npm run size` 5.07 -> 5.05 MB in all, 1.66 -> 1.65 MB before the first click.
- **Not in either font file** (so still a system face): ✉ (the postcard's button, UI) and 框 (a comment). 〜 is not in Yuji Syuku.
- Checked on the page: the shop's 兎 seal before (gothic) and after (brush), the nobori, the noren, Hachi's gate: scratchpad desk5/fonts/.

## Share images from the banner's key art (2026-10-02)
- og.jpg (1200x630) and og-square.jpg (1200x1200) are now the diorama with Hachi on the crossing (assets/keyart/keyart-3840.png), not the old konbini render. scripts/share-art.mjs no longer starts the game or a server: a blank page in headless Chrome composes the master with Canvas2D (`--og`: only the two share images).
- **og.jpg:** the whole width; the 45 px that must go come two thirds off the top, so Hachi's paws stay in and the peak keeps 17 px. The key art has no empty sky on the left (blossom) and the peak is left of centre, so the title is set right, over the sky beside the mountain's shoulder, on a soft paper wash; the emblem moved to the bottom left corner, the address stays bottom right.
- **og-square.jpg:** a 16:9 picture cannot fill a square without losing Hachi or Fuji, so the top 30 % is the cards' paper with the emblem, the place line, the title and the Japanese line, melting into the sky; the art fills the rest (80 % of its width: the RX-7's nose is cut).
- **Sizes:** each under 150 KB (the JPEG quality steps down until it is): og.jpg 120.9 -> 147.6 KB, og-square.jpg 137.5 -> 147.1 KB (quality 0.74). Page extras, outside the game's budget.
- index.html: dimensions unchanged (1200x630, 1200x1200); the three alt texts now describe the diorama.
## Hachi on the surface, hops over steps and kerbs, the tour past ドンペン堂, the postcard as the ending (2026-10-02, Tan's play-test)
- **Sunk into things: the cause was not one bug but the ground he used.** His height was the walker's `heightAt` (the platforms): right for an eye 1.6 m up, wrong by centimetres for a pup 24 cm tall. Measured with a new check (below), along the whole tour: 137 of 3,427 samples more than 1.5 cm under what is drawn, worst 37 cm. What it found: every kit road's asphalt is drawn 2 cm over the ground plane and its gutters 3.2 cm (no platform: he was 2 cm into every lane); the car park's asphalt and his own lawn the same (2 and 3 cm); a dropped kerb's ramp is two flat steps for the walker but a slope as drawn (up to 2.8 cm out); the shrine path's kerb stones (2 cm); the konbini's and the car park's wheel stops (12-13 cm) and anything else under 30 cm high were neither obstacles nor ground to him, so he stood chest-deep in them; sat, his rump is 1.2 cm lower than his paws; bowing, 3.4 cm; lying asleep with his head down, his chin 2.4 cm; the trip's "dip" pushed him 3 cm into the ground by design.
- **Fix: one ground for him, the drawn surface** (`ctx.surfaceAt`, world/ctx.js). The platforms as before, plus: `ctx.surface({ rect, top })`, "fine" surfaces that are no step for a person (registered where they are drawn: kit/roads.js asphalt, junctions and gutters; land/parking.js; lawson.js forecourt, apron and road; animals/home.js lawn, stepping stones and blanket; kit/shrine kerb stones), and a dropped kerb's platforms carry the slope they stand for (`ramp`, streetprops.js): his paws follow the slope. The player's `heightAt` is untouched. Low colliders (5-30 cm over the ground they stand on: wheel stops) shut his grid's cells with 10 cm of clearance: he goes round them (the konbini's stops got colliders with a `top`, which the player steps over as before). His posture has a measured lift (`ANIMALS.guide.postureUp`, `_hachi.mjs --only posture`), his chin its own when he lies with his head down, and the trip dips on his legs (the crouch channel), not through the ground.
- **Not done in the forbidden areas** (other builders were in world/line, world/mochi, world/han): nothing there needed a change for the tour's route; the station platform's coping (2 cm proud, 40 cm wide along the edge) is the one known gap he can stand on, see "Unsure" in the hand-over.
- **He hops** (`ANIMALS.guide.jump`; guide.js tryJump/jumpStep). move() looks along his way for an edge (the ground's height changing 6 cm or more between two points 4 cm apart: a slope is no edge). A dip on his legs (0.08 s), then off the ground short of the edge and down past it on the first stretch long enough to land on (a kerb stone or a wheel stop would be cleared whole), nose up then down, ears back and flopping on their spring, front paws tucked, a squash on landing. Flights go tread by tread with no crouch between, two treads a hop above 4.2 m/s. Not yet facing the way, he turns before the edge rather than slide over it sideways. Whatever else carries him over an edge (a lap of zoomies, his porch in the joy) gets a small "pop" instead of a snap; zoomies and the pigeons' lap now need level ground all round; he sits, lies and plays only on level ground (stopped at a kerb's edge he shuffles to the nearest level spot first).
- **The tour skipped ドンペン堂: cause.** Not the waypoints: the tour's own legs pass it. Called (F) on that stretch (or after a snack), `rushNext` led straight at "the nearest place not had" by the crow, with the legs between thrown away; from the shopping street that was platform 1 (or the slow-life bench, whose barrier leg is at the level crossing), and the planner's cheapest way there turns west at the first cross lane and runs down lane x 26 to the plaza (measured from six points between the mochi shop and z -33: five of them leave the shopping street; the nearest pass to ドンペン堂's spot 11-30 m, its radius 12). **Fix:** with the tour under way a call takes it up where you are: the tour's own next stop, joined at the end of the stretch of the chain you stand nearest (`tourJoin`), so the streets between are walked. Only a place you stand within 25 m of (`drop.near`) comes before the tour's next. `_guide.mjs` got `route` (F at the mochi shop, at the street's mouth, short of ドンペン堂: each passes its spot at 4.7 m, in order, never more than 6 m off the street's middle) and the tour asserts every stop and sound place in order.
- **The postcard is the ending.** It waited for the whole bedtime (8 s) and 3.5 s more, while "Take the tour again" was already on offer. `GUIDE.onTourEnd` fires as he lands on the bench; main.js shows the card 1 s of play later (`MAKER.postcardAfter`), and the tour is not offered again while the card is due. The game stands still behind any card (Tan, 2026-09-29), so his happy bit and settling play out when the card is put away, not behind it. `GUIDE.onNap` still fires when he has settled (nothing listens now). Once a page load, as before.
- **The check** (`_guide.mjs`, every scenario): each 0.25 m he moves and each 0.4 s he stays, the lowest point he is drawn at (`__guide.lowest()`) against what is drawn under him: five rays 6 cm apart straight down through the scene's own triangles (binned by the metre: three's raycast took 35 ms a ray on the merged town). Fails on: more than 1.5 cm under; over it unless in a stride, a hop or a reaction's jump; his body in a collider's box; a snap (9 cm of height in a frame). Exempt by design: in his tunnel and his house (a roof over him), 3.5 cm into his cushion (it is soft).
- **Numbers:** the tour, 3,427 samples: before 137 under the surface (worst 37 cm), 4 over; after 0 / 0, 0 snaps, 36 kerb hops, 24 stair hops, 5 pops. `_guide.mjs` 14/14 (new: `route`; every scenario now carries the surface check), `_hachi.mjs` 12/12, `_play` and `_maker` pass, build passes. `npm run size` 5.07 MB (code 0.58 MB; budget 5.25). No new draws, textures or meshes: frame GPU cost unchanged by construction (not re-measured). CPU: the guide's step 0.13-0.2 ms in the checks (0.14 before), its grid 0.21-0.26 s once (0.21 before). Sheets: scratchpad/hachiC/ (kerb, stairs, platform, donki; before and after).

## The konbini: the view is the visit's until you are outside (2026-10-02, Tan: "whatever saves memory; I want a good gaming experience")
- **What changed** (store/shop.js): the mouse used to come back at 'paid' while the walk still carried you to the door. Now it comes back on the pavement, as you turn to the street to eat. No half-look in between (my call): the mouse is already off for the 15-20 s before you pay, so the walk out is the same walk as the walk in (it looks along its path, a little down), and a mouse that half-works for five seconds would be the odd thing. All five visits play as before (`_konbini.mjs` 9 pass, same timings).
- **The tool again** (`_store-seen.mjs`, 11.1 min; 32,556 poses, was 35,412): "looking round" is now 1 place (where you eat), 56 poses.
- **The honest result: it saves little.** Never seen: 3 of 6164 units, 44 of 1006 quads, 2 of 981 solid parts: exactly as before. Unit sides seen 25,669 -> 25,416. Labels that must be the whole painting somewhere: 443 -> 417 of 456. The look on the way out was not what keeps the stock: (a) outside you can stand at the glass and look in at anything, and (b) the five walks pass within 2-4 m of nearly every shelf, where a label is magnified at a 2160-line frame.
- **What was taken from it** (store/labels.js, seen-data `labelNear`): the label pages are now grouped by the level they can be at the store as well as from afar (as the price tags already were), so the 39 labels never seen close sit on small pages even at the door.
- **Numbers** (`_store-lean.mjs measure`, main -> this): store textures at the door and through every visit 172.8 -> 161.8 MB; away from it 59.6 MB both; store triangles 424.7k -> 421.7k; store geometry 20.4 -> 20.3 MB; heap 301 -> 303 MB (run to run); draw calls on a visit 732/771/771/694/658 -> 727/766/766/698/664. **Frame ms could not be compared:** the after run shared the laptop with other agents' browsers (every spot read 2.2-2.5x, the famous view included, which this does not touch); no draw or triangle count went up.
- **The lever that is left** (not built; it needs Tan's OK, it repaints between visits): a level per visit. Each visit only comes close to its own aisles; pages grouped by which visits need them whole would hold about a third of the labels at full size at a time.
- Also in this commit's run: `_play` 20/20, `_audio` all passed, hero guard 0.337 / 0.130 / 0.095 %, `npm run size` 5.05 MB.
## Z-fighting: one surface owns each face (2026-10-02, Tan: "in the Pikachu train the walls between compartments feel pixelated; fix it in all trains and all surfaces")
- **Cause, everywhere:** two faces in one plane (boxes pushed through each other so their faces coincide, a plate laid exactly in a wall's face). Which wins each pixel changes with the least movement, so the surface crawls.
- **The detector** (`scripts/_zfight.mjs`, `src/dev/zfight.js`, dev only, nothing in the build): 212 poses (famous views, the konbini outside and in, every tour stop, each train type inside both cars and from the platform, station, crossing, shopping street, ドンペン堂, shrine, Hachi's home, ぺったん堂, bench, pond, roads). Each is drawn 12 times with time frozen (`?shots`) and the pixels that change counted: `flicker` (changed twice or more), `solid` (in a 2 x 2 block of them: an area, not the one row that flips where two surfaces meet along a line; this is the pass/fail, 12 a pose), regions, a mask, and a ray through each region naming the two faces (in dev `merge.js` keeps each batched part's name, shape and place). **Judgement:** the default perturbation is the near plane nudged 0.02 % a frame, not the camera moved 0.2 mm: at arm's length a 0.2 mm move shifts every ink line a tenth of a pixel and buries the signal (6,000-48,000 px a pose on a clean frame); the near-plane nudge re-rounds every depth and moves no edge. `--move` is the camera jitter.
- **Trains** (`line/emu.js`, all three types): the end wall was the car's full width and height, so it lay in the side skins, the floor rim, the roof's cap and the side linings' ends (cream through the yellow between the Pokemon cars). Now the side skins own the corners, the end wall the middle, the roof everything over the eaves, the rim everything under the floor; linings stop behind the end wall; the gangway's rubber jambs stand 12 mm into the opening; bellows and plate run end face to end face; the round roof starts at the eaves strip's top; stripes lie on the skin; the sill is proud of the jambs; seams 2 mm proud of the paint; the strap's clasp wraps its rail; cab glass, glints and LEDs a centimetre apart (3 mm fought from the crossing).
- **Station:** the coping lies on the deck; the lineside fence no longer runs in the platforms' back faces and the annex's wall (each platform carries its own on the deck, the same height above it; the collider stays).
- **Hidden paint that bled through (a look change, Tan to confirm):** the platforms' tactile strip and the plaza's yellow guide path and taxi box were laid at `y - asphaltY`, 14 mm under their surface, unseen since M2c, and their polygon offset let them through in patches at a low angle. They are on the surface now, so they are seen: the yellow strip along both platforms, the guide path across the plaza.
- **Town:** a shop's glazing head and soffit (`shops.js`), pavements behind their kerb stones and asphalt between a lane's gutters (`kit/roads.js`; main's `fine()` surface for the asphalt narrowed to match, the gutter registers its own), the river stairs' nosings and foot posts (`land/channel.js`: Tan's "it pixelates and acts up"), block-wall joints, guardrails, house corner boards and door trims, the attic house's door surround, the walk-up's stringer, laundry, cars (grille, tailgate line, exhaust), the kei truck's windscreen, the air conditioner's lid, vending labels, the ice-cream freezer's sign, the megastore's canopy, gondolas, cases, bin and board, the ryokan's balusters, lily pads, fallen petals (true decals: polygon offset), the south fence at Hachi's gate posts.
- **Store** (`store/interior.js`, coordinates only, no part added or removed so `seen-data.js` holds): gondola shelves stop at their price rails, end caps sit between their uprights, the toilet's sign 1 cm off the wall, the chilled case's shelves inside its ends.
- **Measured (212 poses):** flickering pixels 168,868 -> 6,798; solid 138,376 -> 677; poses over 12 solid: 145 -> 11. The Pokemon train's 29 poses: 46,860 solid -> 22. The river stairs: 16,439 -> 0.
- **Left** (each has an allowance in the script, so the check passes today and fails on anything new): ぺったん堂's walls from the main road (87 and 40 solid; `world/mochi/`, another builder's), a shopfront seen from the pond 143 m off (86), a signpost at the megastore's corner from 28 m (60), a house's eaves and attic gable (35, 27), a pole 75 m off (20), the rails' heads on their sleepers (18: a contact line). Beyond about 70 m a 24-bit depth buffer with the near plane at 0.25 m cannot separate faces closer than 2-5 mm; a reversed depth buffer would, and is not done here. Not z-fighting, found on the way: the JR car's number sits 2 mm behind its orange band (unseen); a shop's upstairs window panes and curtains are inside their frame boxes (unseen); the store's smoothie sign is behind the wall's face.

## After the z-fighting sweep: the bus stop checked, three hidden things brought out (2026-10-02)
- **Merged main's sweep** (1222be1). station.js: the sweep's coping (on the deck, top PH + 0.02) with the `ctx.surface` strip for Hachi at that height; the plaza's guide path and taxi box are laid once, on the surface (both sides had found the same "2 cm under the paving" fault); the bus stop's own branch of the tactile path and its bay stay in busstop.js.
- **The bus stop under `_zfight.mjs`** (three new poses: `bus-stop`, `bus-stop-paint`, `bus-stop-inside`): the route map and the poster overlapped by 2 cm in one plane on the back boards (200-550 solid pixels): moved apart. The bay's side lines now stop between its end lines, the tactile row stops short of the station's path and the column short of the warning pad: no paint lies twice. After: 0 solid on the paint and inside; `bus-stop` reads 16, all of it the barber's gable 14 m behind (the kit's, like the other houses' eaves the sweep left: allowance 20).
- **The JR car's number** (line/emu.js): 2 mm proud of the orange band now (it sat 2 mm behind it, unseen). The other two trains' numbers move out the same 4 mm.
- **A shop's upstairs windows** (shops.js): the pane, its mullion and the curtain were inside the frame's box, so every such window was a blank metal slab. The pane now stands 1 cm proud of the frame's face, the mullion over it, the curtain on the pane. A look change on every two-storey kit shop (dark or lit glass, some with a curtain): Tan to confirm.
- **The smoothie sign** (store/interior.js): 1 cm off the wall's face (X1 - 0.03); it was behind it. `seen-data.js` measured again, since a sign that was never seen is now seen: never seen 3 units, 43 quads (was 44: the sign), 3 solid parts; labels as before (417 / 31 / 3 / 0 / 5 at the store).
- **Checks on this tree:** `_zfight` for the station, platforms, plaza, bus stop and the JR train: all pass (with the allowance above); `_konbini` 9 pass, `_play` 20/20, `_guide` 14 pass, `_audio` all passed; hero guard 0.372 / 0.166 / 0.131 % (0.337 / 0.130 / 0.095 before the sweep and the windows; limit 0.5); build OK; `npm run size` 5.05 MB, 1.65 MB before the first click.

## Docs wording: the base project is named only for credit and licence (2026-10-02, Tan)
- The base project is now named only where credit and licence need it: LICENSE and public/LICENSE.txt, the credits page, the start card's credit line (strings.js), README's credits, package.json's description, one line each in AGENTS.md and SPEC.md (what src/core is built on), main.js's header, and the two log entries that record the credit line and the credits page. Everywhere else the docs and comments say "src/core" or "the base modules"; the names rule reads "all place and shop names are our own" (`npm run check:names`, unchanged in what it checks). One reference note was removed from the repo. No code behaviour changed.

## The tour's ending, in order: his bit, the postcard, then the tour again (2026-10-02, Tan's play-test)
- **Was:** `GUIDE.onTourEnd` fired as Hachi landed on the bench and the postcard came 1 s later; the game stands still behind a card, so his happy bit (8 s: bow, spin, roll, tilt, circles, down) was cut.
- **Now** (guide.js `endTour`, main.js): `onTourEnd` fires once he has settled, with `onNap` (measured in `_guide` bedtime: landed 5.3 s, settled and ended 13.9 s); the postcard comes `MAKER.postcardAfter` 0.6 s of play after that. "E · Take the tour again" needs the postcard to have been up this page load and put away (`postcardSeen`), and is never on offer while the card is due.
- **Whistled off the bench before he has settled** (or whistled to you before he got to it): the bit is cut at your call, so that counts as the ending: the card comes then (else it would never come, and the tour would never be offered).
- **Seen from the pause card already** (my reading of Tan's note; say if the ending's card should come regardless): no second card at the tour's end; the tour is on offer as soon as he has settled. Offline (the card's chunk can't load): no card, the tour on offer.
- **Checks:** `_guide` bedtime asserts onTourEnd at the settle and more than 7 s after the landing; `_maker` has four new lines (seen from the pause card: nothing due and the gate open; not before the card; not while due; open once put away; `__postcard.gate/forget`, dev only).

## Han in the RX-7: his legs out of the floor (2026-10-02, Tan: "after the car leaves, Han's leg is visible under the car")
- **Cause:** not the sprung body (he is its child and rolls with it). His seat pose was a chair's: thighs level, shins straight down, on a seat 0.28 m up in a car whose floor is at 0.13 m. Measured (`_han-seat.mjs`): shins, hems and shoes down to -0.28 m in the body's frame, under the floor within the footprint on 849 of 1,091 frames (t 1.98 to 16.12 s).
- **Fix** (han.js `POSES.seat`, han/index.js): legs out ahead in the footwell (hip -1.72, knee 0.5), seat 0.24 (was 0.2), a little more recline so his head keeps 6 cm under the roof. Lowest point seated 0.169 m (floor 0.165).
- **Getting in and out, rebuilt** (`seatMove`): the old straight blend took him through the sill. Now he steps into the open door with his back to the seat, sits back onto its edge with his feet still on the ground (two-bone IK, so they neither sink nor float), ducks under the roof, then swings his legs in over the sill, knees up, hands from his thighs to the wheel; out is the same backwards. He stands clear of the door's swing (STAND 0.3 m further back).
- **Check:** `node scripts/_han-seat.mjs` runs in node with no browser (60 Hz through the whole show: nothing under the floor within the footprint, nothing outside the body seated, the roof or glass over all of him, feet not in the ground); `--sheets` adds contact sheets from the watching spot and low at both sides. **The sheets were not made:** the browser lock was held by another session's hung process for the whole session, so the new get-in and get-out have been measured but not looked at.

## Your hand closes round what it holds (2026-10-02, Tan: "grab objects around them, not ahead of them; the shape looks odd")
- **Cause of "ahead":** one fixed loose grip, fingers pointing up, with the thing set 5 cm off the palm and always turned to face you; and `onTopClamped` never matched (`#include project_vertex` without angle brackets), so what you carry was not in the hand's sliver of depth and the hand always drew over it.
- **Depth, properly:** the clamp matches now, so hand and thing share one depth range and the depth test orders them: fingers and palm behind, the thing, the thumb in front. No render-order tricks; the grips are laid out so that is what the geometry is.
- **Grips** (hands.js `GRIP`, `HOLDS`, `setHold`), each laid out in the held thing's own frame and the hand turned to it, so the thing stays exactly where it was: `round` (the can: across the palm, fingers wrapped round the back by a small solver, thumb round the front), `pinch` (onigiri, wafer, card, the sando half and onigiri being eaten: fingers flat behind, thumb's pad on the face near an edge), `under` (the sando pack, the mochi in its cup: palm up under it, thumb against its side). Set where the thing arrives: shop.js (take, card, back from the till), eat.js (as it comes out of its pack), mochi/index.js (card, mochi).
- **Shape, modestly:** joints the finger's own width (no knobs), the knuckle ridges on the back down from 2.4 to 1 mm, rounder fingertips, the thumb from lower on the palm with a ball at its root, a smooth wrist the forearm turns on (each grip bends it). The old hand otherwise.
- **Cost:** one geometry per grip, cached (about 6.5k triangles, 0.9 MB each; a konbini visit uses three). One draw, as before.
- **Checked without a browser** (the browser lock was held by another session's hung process all session): no hand vertex inside what it holds in any of the nine holds; a software z-buffer render of each hold in the game's camera frame, before and after. **Not run: `_konbini`, `_mochi`, `_play` and the in-game close-ups**; the reach to the card reader and the eating moves use the new hand turns and have not been seen moving.

## Phone build live, and Tan's six fixes (2026-10-02)
- **Sharpness is never what pays** (Tan, on Chrome on an iPhone 15: "details near the eye are blurry"). Chrome and the in-app browsers on a big iPhone were on the light tier (2x, paintings at 0.75, down to 1.25x under load). Now: big iPhones play the full tier in any browser; full never drops under 2.25x; the light tier (4 GB iPhones, small Androids, a lost context) is 3x capped at 2.7 Mpx with whole paintings, paid for with draw distance (far 70, fog 24..66).
  Measured (the whole flow, emulated iPhone 15): full 213-268 MB, peak 296 in the konbini; light 187-250, peak 271 (was 122-172 soft). The light tier is over its ~180 goal: the next cut there is town, not pixels.
- **Start card and postcard on a short screen on its side** (734 x 337 in Chrome): "Buy Tan a coffee" whole on its button (sheet 312-340 px wide, icons 38 px); "Add your selfie with Hachi" inside its button; the postcard whole on the screen (the ruled lines go), the town's name beside Back.
- **ぺったん堂's pounding seen from a step back** (MOCHI.order.back 1.15 m, side 0.55 m, eyes lower): the three rabbits, the mortar and Hachi before it in one picture; you step up to the stand again as the mallets are laid down. Desktop and phone alike.
- **The hand clasps what it holds** (store/hands.js GRIP.clasp): the palm behind a pack, the fingers over its edge and bent onto its face (an onigiri's left slope, a wafer's top, a sando wedge's ridge), the thumb on its face; eaten, the same grip. Cans were held by the onigiri's grip (their shape is `tallcan`): now by their own, the thumb round the front.
- **The phone's ending in the desktop's order**: Hachi's bench bit, then the postcard, then "Take the tour again" only once the card has been up.
- **MOBILE.route on**: phones and tablets on the site go to m.html. DataFast stays desktop-only.

## Tan's staging feedback, six points (2026-10-02)
- **The card tap, palm down** (store/hands.js GRIP.key): the hand on its thumb side, the card between the thumb's pad and the first finger's side, the forearm in from your own lower right. Konbini and ぺったん堂 alike.
- **ぺったん堂 from further back, for longer** (MOCHI.order.back 1.75, side 0.5): back from the moment you have paid until the turner brings your mochi round, so Hachi's bobbing, his hop at the finale and his treat are all in the picture. The serving step is 0.58 m (was 0.24): the rabbit's paws are over the table's top and it serves face to face, not from under it.
- **Hachi stands on the highest thing under his paws** (guide.js G.paws): his height came from the one point under his middle, so beside a kerb half of him was in it. Fore, hind, left and right are sampled (a step's height at most), eased.
- **His garden**: his bed's bolster lowered and its middle filled (he lay 12 cm under its rim: only his head showed); his kennel cushion flattened with a surface on its top; the tunnel and the hoop are walls to his walk (he goes through them only on his run and his leap); the flower beds are walls to both of you; the sandpit's sand and timbers are surfaces he steps onto.
- **The tour after the konbini**: the main road's zebra (x -35) is cut; he goes back over the road by the store's own crossing and west along the far pavement to the gap in the car park's kerb (x -18.3), and out by the same gap (the old way ran to the west end and back). The order stays fixed (Tan asked): one loop that passes every sound and ends at the bench by the Deer Park; places already had are skipped.
- **The postcard as a picture** (ui/postcardImage.js, 1600 x 1240, ~330 KB, made on the device): the whole key art with the game's name, the selfie as a polaroid in it when one was taken, and under it the greeting, three lines that say what this is, "To: a friend who misses Japan", a stamp and the address. Share sends it (phone and Safari); "Save postcard" downloads it where there is no share sheet. Before, Share sent only the link, whose preview is the site's banner.
- Checks: _maker 39/39, _selfie 23/23, _konbini 9/9, _play 20/20, _mochi 6/6, _hachi 12/12, _guide all 14 (tour and turnaway on a second run; the check's tunnel/hoop and paws rules updated), _mobile-ui 103 pass / 1 fail (portrait walk easing, a timing number).

## The pocket town, portrait, smaller still (2026-10-03, Tan)
- **The phone is a glimpse; the desktop is the whole of it.** m.html runs the desktop's generator on a much smaller plan (src/mobile/plan.js, pocket-lots.js; the `@mini`/`@dz` marks, vite.config.js miniPlan): the main road, the shopping lane to the plaza, the station and the line, the level crossing, the shrine beside the store, two paddies and the slow-life bench, the gate road to the Deer Park. No river, bridge, pond, back lanes or Osaka boards. Nothing streams: the whole town is resident.
- **Portrait, two thumbs** (Tan's pick after tap-to-walk and one-stick trials): the town in the top 75 %, a panel in the bottom 25 % (mobile/panel.js): the guide line, a fixed stick (a thumb held on it walks, slid up runs, pulled down steps back, across sidesteps), the action button ("Walk with Hachi" when there is nothing to do), Hachi, Pause. A drag on the picture looks. Turned sideways it asks to be turned back.
- **Smaller still** (Tan: "remove Han, Mochi, Hachi's house"): on the phone only. Han's bay takes a parked kei car; ぺったん堂's lot is a plain house; the station lane ends at a guardrail before an unbroken fence. Hachi's tour: view, konbini, along the store's pavement to ドンペン堂, the lane's zebra, the plaza, platform 1, short of the level crossing's barrier and back, the shrine and its fox, the bench, the two zebras, the gate. Every sound place still passed within earshot.
- **The hello card never over Hachi**: the portrait lens is ~77 deg tall, and the famous view's 9 deg lift put the horizon four fifths down with the pup at the picture's foot under the cards. In portrait the view looks 0.18 rad lower (MOBILE.portraitTilt); the card and the hints move to the top of the picture while they would cover him (a quarter second of overlap first). Hachi is 1.3x on the phone (24 -> 31 cm at the shoulder).
- **Memory** (emulated iPhone 15, portrait, the whole flow): before this round 188 MB at the start, 316 in the konbini, 253 elsewhere; now 170 / 282 / 246. The cuts gave ~17 MB everywhere; the konbini's label pages one level smaller gave 26 MB (side by side in a visit they read the same). Most of the konbini's apparent jump is town pages first drawn when the visit's camera turns, not the store.
- **CPU copies**: the pocket town streams nothing, so each painted page's canvas goes once the GPU has it (lite.js releaseCanvases; not the pages drawn on in play: the departure board, the till's screen, the label and shelf pages), and the static batches' vertex arrays go once uploaded (MOBILE.keepCpu false; the light tier, which streams, keeps both). Canvases 118 MB -> 64 MB four seconds in, falling as each page is first drawn; vertex arrays 46 -> 27 MB. A lost GPU context now shows the Reload card (and the light tier next time).
- **Quality, paid for by the cuts**: small things drawn to 60 m (42), loose parts to 130 m (90), the desktop's petal fall (150 in the air, 250 from the trees; 70 and 110). The desktop's 2048 shadow map was tried and put back: +14 MB for reach, not sharpness.
- **Decoded sounds let go when far** (2026-10-04, Tan): a decoded file is raw PCM (~0.18 MB a second) and every one stayed (48 MB after a walk round the pocket town, 54 with night). On the phone (MOBILE.soundRelease 25 m; core/sound.js sweep, once a second) a place's loop, a placed line of 5 s or more and the time of day's unused bed give their decoded copy back once you are 25 m beyond where they are heard and nothing plays them; within half that margin they are decoded again (the browser's cache), before their range begins. The train's announcement, warmed within 80 m of platform 1, carries where it belongs (soundBus.preload's `at`) and is warmed again on the way back. The wind (always on) and short sounds stay. Measured on a walk (view, platform, plaza, ドンペン堂, shrine, bench, gate, plaza, night): peak 35 MB (54), 17 at the gate (48); the station's ambience back on return. Desktop: off.

## Tan's phone feedback, ten points (2026-10-04)
- **Transparent trains with just doors** (priority): the phone shared one train set between the two tracks (`lend`), but in the pocket town both runs stand at the platform together, so one ran with no set at all, and a set built in play came after the phone had let its pages' canvases go: its clones uploaded from emptied canvases (fully transparent: doors and number plates only). Now each track has its own set, both built at load (emu.js primeSecond, `@mini`; a free spare is reused whichever slot it was made for), and `releaseCanvases` has a safety net: a texture copied from a page whose canvas has gone gets the picture back first, read from the GPU texture (texelFetch, sRGB encoded again, the flip undone); checked by restoring and re-uploading every released page: the town's frames unchanged.
- **The panel** is a fixed height (206 px + the home indicator: its rows didn't fit a quarter of a short screen) and the town takes the rest; the stick 112 px (it rode over the guide line); a stray CSS line had dropped the action button's rule (its width and look: the light look Tan has seen kept, now full width; lit while walking with Hachi). The home-screen app (iOS, black-translucent): 100dvh is a status bar short there, which left a band under the panel; the layout takes the screen's height (`--app-h`). The manifest says portrait.
- **Grey and blurry until close**: a lost GPU context marked the phone for the light tier for good (fog from 24 m, pages a quarter size past 22 m). The mark is now per build; the light tier is hazier than the full one but no wall (fog 45-125, pages whole to 34 m).
- **Walk with Hachi**: stays on through the tour (into the ring, stood there while he waits, on again when he goes); he is told to move on when the stop has been had (konbini or bench: 2 s after the visit or the sit; the platform: once a train has stood and gone; elsewhere 4 s; GUIDE.moveOn), and you walk right up to him while he waits for you to set off (the two of you stood waiting for each other). A drag looks without ending it; a thumb held on the stick keeps it, slid up runs; pulled back or across ends it. The way is his trail with room for your shoulders (three sight lines, 0.3 m apart); no headway for 2 s and you are put down 2.2 m behind him (a blink).
- **No crossing detour** after the station; its bells still carry to the plaza's corner when a train goes over.
- **The postcard** comes 20 s after Hachi reaches the gate if he has not settled on its bench first (MOBILE.overWait); before, walking off before his bench bit meant no card.
- **"Full experience on Desktop"** on the start card, and in the panel's foot throughout the game with the address, small and muted (the home indicator's strip on an iPhone app).
- Checks: _mini-flow 18/18; _guide --phone tour pass (255 s); a follow script (to the konbini, a look, the visit, on after him 13 m, the stick's three ways, a catch-up).

## The phone's own key art, the way round, the platform, the map's key (2026-10-04, Tan)
- **Upright key art** (Tan: "the banner doesn't fit on mobile... even Fuji is half hidden; it's okay to use Han"): the 9:16 crop of the banner showed a slice above the sheet. Now its own frame (scripts/keyart.mjs --portrait; src/dev/poster.js POSTER_PORTRAIT, 1440 x 1920 master, keyart-portrait.webp 1080 x 1440, 154 KB): NIPPON under Fuji, the torii, Han leaning on the RX-7 parked on the store's forecourt (first staged on the far kerb's footpath, its wheels in it: Tan, "pathetic"), Hachi on the zebra; Fuji a little left with bare sky above for the title, everything 10% in from the sides (the picture above the sheet runs from ~0.62 to ~0.9 wide). The pause card upright shows it above itself, as the start card does.
- **The way round** (Tan: obstacles between him and you; the respawn "looks very odd"): Walk with Hachi walks your own distance field on his walk grid, grown from him (or the place he waits at) and grown again a few frames at a time as he goes, aimed at the farthest point down it that is clear for your shoulders; the trail only until the first field has grown. The put-down behind him is a last resort after 6 s with no headway.
- **The platform** (Tan: after the train, Walk with Hachi on again did nothing until he walked out of the ring): turned on while he lingers at a place you have had, he goes on at once; and the follow walks into a waiting ring by the field, not only by a straight line in sight.
- **The map's key** (the phone): "things to do / to hear" and "Tap to close" go in a strip under the sheet; they sat on it over the Deer Park.

## The mallets in the floor, Hachi's tunnel, housekeeping (2026-10-04, Tan)
- **ぺったん堂's mallets** (desktop): let down aside a pounder's mallet face sat 15 cm under its feet, and in a bow (the entrance, the finale) 44 cm, so the head went into the stage. Each frame a held mallet's swing is held back so the head's lowest edge stays over the stage floor (mochi/index.js place; malletFace/swingFor). `_mochi.mjs` now fails if the lowest edge goes under it in the show (6/6).
- **Hachi's tunnel** (desktop): its arch was 0.36 m (0.34 over his flanks) and he is 0.37 m to his ear tips, so his back and ears ran through the cloth the whole way. The arch is 0.48 (0.45 over his flanks). _guide crossing (the home visit) passes: never under, over or inside.
- **Housekeeping**: 26 old agent worktrees removed (1.3 GB; their branches kept); the empty lawson-fuji stub to the Trash; the phone's dead code out (Han's watch and ぺったん堂's hand in mobile/main.js, the tap and hold paths in touch.js, the old schemes' and places' strings); scripts/_mobile-ui.mjs (the landscape layout) retired for _mini-flow; AGENTS.md, README, SPEC, EXPERIENCES and mobile-lite.md say what the phone is now; the phone-local preview in .claude/launch.json kept.
