# Take Me Back to Japan: Build Spec

Rewritten 2026-09-29 from where the game is today; brought up to date 2026-10-02
(the desktop game is live) · @Tanuj (Tan, they/them)

> The first spec (Sep 23, "Konbini Game", under an old working title) is in git history
> (`git show ea1ab1f:SPEC.md`). Since then the game has changed on purpose,
> many times, to make it better: the store became NIPPON, the cashier
> became self-checkouts, the shopping loop became a short scene, and the
> town became a set of experiences. This document describes the game as it
> is and will ship. Section 12 lists what the first spec asked for that
> was dropped or is still open, and section 13 is the road to launch.
> DECISIONS.md and docs/decisions/*.md hold the reasons for each call.

## 1. Overview

**Take Me Back to Japan** (日本へ、もう一度) is a cozy, first-person 3D
browser game set in Fujikawaguchikko (富士川口湖町; its station is
富士川口湖駅), a compact town at the foot of Mt. Fuji. It opens on the
famous view: a konbini, NIPPON, with Fuji rising over its roof. From there
you wander a small town of things to do and things to hear, with Hachi, a
shiba pup, to show you round. It is a nostalgia piece: someone who has been
to Japan should feel it within 10 seconds, through the look, the sounds and
the small rituals.

It lives at **takemebacktojapan.com**.

**Goals**

- A static website, playable from a shared link in desktop browsers
  (Chrome, Edge, Firefox, Safari on macOS). The desktop game is live and
  nothing in it is compromised for phones: phones get their own build, the
  pocket town (m.html, src/mobile/; docs/decisions/mobile-lite.md), portrait
  and smaller, with the full experience left to desktop.
- Ready in about 4 s on desktop broadband; smooth on a normal laptop, 60 fps
  at 1440p on a mid-range GPU.
- Everything is built in code: no downloaded models or images. Every sign
  is drawn with Canvas2D. The one image file is the key art, rendered by the
  game's own renderer.
- Sound carries the nostalgia: real recordings (効果音ラボ and Tan's own
  recordings), each heard only near its place, with generated sound as the
  fallback for any missing file.

**What the game is**

- **The famous view.** The spawn, and the reason the game exists: the
  konbini straight on, Fuji's upper cone over its flat roof (section 3).
- **Things to do** (a highlight in town, a diamond on the map): the konbini,
  the Nippon Fuji view, Han's RX-7, the train's listening spot, the
  slow-life bench, ぺったん堂 (the mochi-pounding shop).
- **Things to hear** (no highlight, no key; a speaker on the map): the walk
  signals, ドンペン堂, the station, the level crossing, the shrine. Each
  sound's name shows top left as you come near it.
- **Hachi**, the guide pup, who leads you on a tour from one to the next
  (past his own home, ハチのおうち, across the level crossing), reacts to
  what you do, and stays with you once the tour is done.
- **A postcard** when the tour ends (and from the pause card): share it, or
  add a selfie with Hachi.
- **Teasers**: the Deer Park gate (鹿公園 近日公開) and Osaka posters,
  for places that come later.

**Priority.** Clarity, polish and build effort go first to the konbini
experience and the famous view, then to the store's surroundings, then to
the town and its experiences.

**Base.** Built on Sakura Crossing (MIT) by Kenton Wang: the rendering
pipeline and first-person controller in src/core and some base modules in
src/world come from it; LICENSE and the credits page carry the notice. The
town, store, Fuji, experiences, sound and UI are ours, and every place and
shop name is our own.

**Non-goals**

- Photorealism. The game is a painted anime background you can walk in:
  cel-shaded, outlined, true to real Japan in its details (section 4).
- Crowds. The only people are the player's own hand and Han. Animals are
  welcome.
- Multiplayer, accounts, a backend, saving across devices.
- Combat, fail states, timers, scores, collectables.

## 2. Tech stack and structure

| Area | Choice |
| --- | --- |
| Rendering | three.js r180 (`three@^0.180.0`), the toon pipeline in src/core |
| Language | JavaScript ES modules (es2022 target) |
| Build | Vite 6: `npm run dev`, `npm run build` to a static `dist/` |
| Assets | Geometry and textures in code; signs in Canvas2D; two self-hosted OFL sign fonts, subset (`npm run fonts`) |
| Mt. Fuji | Real elevation from Japan's GSI tiles, baked once into `src/data/fuji-dem.bin` (`scripts/fetch-fuji-dem.mjs`) |
| Audio | Web Audio API (`src/core/sound.js`, `soundBus.js`); AAC files in `public/audio/` from `assets/audio/` (`npm run audio`) |
| Input | Keyboard and mouse, pointer lock |
| UI | HTML/CSS overlay; all text in `src/data/strings.js` |
| Storage | `localStorage` (try/catch) for the volume only |
| Hosting | A static host serving `dist/` at takemebacktojapan.com (section 13) |
| Runtime requests | Our own domain only. Nothing is fetched from anywhere else |

**Files that matter**

```
AGENTS.md            standing rules for every agent (CLAUDE.md = @AGENTS.md)
SPEC.md  DECISIONS.md  README.md  LICENSE
docs/EXPERIENCES.md  the experiences brief
docs/BUILDERS.md     how specialist builders work (ownership, API, loop)
docs/decisions/      each builder's judgement calls
reference/           reference photos (local only) and research notes
assets/audio/        Tan's source audio, never committed
scripts/             audio, fonts, size, key art, shots and the test suite
src/
  main.js            boot, loop, keys, views, cards
  config.js          every tunable: views, looks, town, store, sound, animals
  core/              toon, post, outline, sky, palette, textures, player,
                     hud, sound, soundBus, fonts
  data/              catalog.js (store stock), strings.js, town.js, fuji-dem.bin
  ui/                controls panel, hands, minimap, town map
  world/             town (kit/), store/, han/, line/ (station, trains),
                     land/ (river, pond, paddies, gate), animals/,
                     experiences.js, fuji.js
```

## 3. The world

Units are metres, +Y is up. The town is built in its own turned frame
(world = (−x, 27.7 − z)); config.js says which frame each number is in.

**The famous view (unchanged since M1; the heart of the game)**

- Recreates the real photos of the Lawson under Fuji at Fujikawaguchiko, in
  our anime style: a straight-on, symmetrical storefront from across the
  road at eye height; only Fuji's upper cone showing, rising over the flat
  roof, peak slightly right of centre, looking enormous.
- Three looks on keys 1, 2, 3, from wherever you are: morning (clear blue,
  bright snow), golden hour (the start: lavender sky, pink Fuji) and night
  (deep blue, glowing store).
- Nothing (poles, wires, trees, cars) may block Fuji or the sign from the
  view. The **hero guard** (`node scripts/shots.mjs --spots hero --quick`)
  compares all three against a baseline and must stay under 0.5%. A
  re-baseline is Tan's call, after checking by eye.

**The store: NIPPON / ニッポン**

- A generic konbini in Lawson-style blue design, with its own wordmark and a
  rising sun behind 日本. No real chain's name or mark anywhere
  (`npm run check:names` fails the build if one appears).
- The low flat-roofed box of the photos: full-width glass, a blue-and-white
  band, a tiled end wall, a forecourt with painted bays, a short zebra
  walkway, a yellow bollard and parked kei cars.
- Inside: a real konbini, readable through the glass and on the scene's
  walk: gondolas by aisle, the drinks and freezer wall behind glass doors,
  the chilled case, about 440 products (catalog.js; never more than 18 of
  one), a counter with two self-checkouts (セルフレジ), a bun steamer and an
  oden pot. Research: reference/konbini-details.md.

**The town plan (Tan's square)**

- **The main road** runs past the store, with shops along it the whole
  way. The town lies between the store and Fuji: you walk past the store
  into it.
- **Behind the spawn:** a monthly car park, then 桜川, a river in a sunken
  channel (河川敷) with stairs down, lower walks and stepping stones. The
  river is the town's edge.
- **The master junction:** the main road's zebra (kakko) and lane x 30's
  (piyo), side by side, their walk lights taking turns. Lane x 30 carries on
  south as the bridge road over the river to the Deer Park gate.
- **The shopping street** (商店街) runs north to the station plaza and
  富士川口湖駅, with the railway along the far edge and the level crossing on
  lane x −80.
- **ドンペン堂**, the discount megastore (a MEGA Don Quijote homage), with its
  goods out front.
- **The Inari shrine** (富士見稲荷神社): torii tunnel, foxes, halls, wind
  chimes.
- **鏡池 (Kagami Pond)** in the corner by the railway: a real mirror, a
  granite promenade, lanterns, the tea house, the ryokan 鏡月旅館, benches
  facing Fuji. **The paddies** (flooded, seedlings, ploughed, renge; a
  mirror of their own) lie between it and the main road's shops.
- **Also:** coin parking, an apartment block, a vacant lot, a small park,
  residential lanes.

**Town rules**

- Density and truth to Japan (reference/japan-details.md): within 25 m of
  any walkable spot, detailed buildings, a pole with wires, small props and
  road markings. Nothing reads as a bare box at arm's length.
- Seeded generators, not hand placement: lots, houses, shopfronts, poles
  and wires, markings, clutter.
- No tree crown through a building (`_play` 03-trees-clear). Nothing can be
  walked through. No invisible walls on open road (`.shots/walk.mjs`:
  every route stuck 0).
- Signalled junctions have no 止まれ, mirrors or poles in the way; Japan
  drives on the left.
- The quality bar is the 鏡池 rework: Tan said "this is the kind of quality
  level you need to work towards in all aspects."

**The railway (the Fujimi Line)**

- Station building with gates, a ticket office, fare map and posters (an
  Osaka poster among them); two platforms; nobody works there.
- A train cycle: arrive, doors open, wait, doors close, depart; the level
  crossing's bells and barriers follow the real train.
- **Three trains in rotation**, all drawn in code: the box EMU in our
  livery, an E233-style JR commuter, and a Pokémon train ("POKÉMON with
  YOU": Pikachu, Eevee, Piplup, Bulbasaur on clouds). Nobody boards. Next
  station: 富士山 / Fujisan.

**Mt. Fuji and the sky:** the GSI mesh, toon-shaded with a posterised snow
line and alpenglow, scaled from the hero cameras (FUJI.gameplaySize keeps it
right in play); src/core's sky tuned per look; painted hill rings
at the horizon.

**Season:** spring. Sakura with painted canopies and dark limbs, falling
petals, drifts along kerbs, petals on the water.

## 4. Art direction

- **Technique (src/core):** toon ramps with
  violet-shifted shadows; ink lines from the depth's second difference;
  inverted-hull outlines on hero props; the two-light anime setup; a
  split-tone grade; FXAA.
- **Mood (ours):** reference/mood.png (golden hour), mood-day.png (day), the
  real photos for the famous view. Warm sky, cool ground, high saturation,
  never grey.
- **No bloom, haze or film effects.** Today's cartoon cel look is the look
  (Tan, town pass). Quality comes from detail, density and the land.
- **Shadows:** PCF soft, with the sun's camera snapped to whole texels so
  edges don't crawl as you walk.
- **Water:** real mirrors (three's Reflector, stepped to a few tones so they
  stay painted) on 鏡池, the paddies and the river through town, rendering
  only a reflection layer and only when near; painted water beyond.
- **The highlight** for things to do: a crisp painted ring with a gold
  edge, a ripple from its middle, a column of warm light seen from afar,
  and rising motes.
- **Characters:** Han and the animals get the most care. They should read as
  figures in a painted anime background, never as robots or toys.

## 5. Player, camera and controls

- First person, eye height 1.6 m, src/core's controller on flat ground.
  No avatar. The only body parts shown are the right hand, when it takes
  something and when it taps the IC card.
- Collision on everything; stairs walk like stairs.
- The keys that work where you stand are listed in the bottom-left corner.
  A key that belongs there but can't be used this second is dimmed, not
  removed.

| Action | Input |
| --- | --- |
| Move | Arrow keys (W A S D also work, unadvertised) |
| Look | Mouse (pointer lock; Esc releases and pauses) |
| Run (outdoors) | Shift |
| Interact | E (the prompt names it: "E · Buy a mochi ¥200", "E · Take the tour again") |
| Time of day: morning, golden hour, night | 1 2 3 (anywhere; a short dip to dark hides the switch) |
| Back to the start (the famous view, same time of day) | R |
| Whistle for Hachi | F |
| Town map | M |
| Sound on/off | N |
| Pause / resume | Space |
| Choose (the konbini's card) | 1 to 5 |

Seated on the bench, the mouse looks around and only a movement key stands
you up.

**Screens** (core/hud.js; English UI, Japanese only in the world and beside
names):

- **The start card:** the key art, full width (public/keyart-1920.webp and -2560
  by srcset, a portrait crop on phones; baked by `scripts/keyart.mjs` from
  the ?poster diorama, src/dev/poster.js), the title in the sky, the tagline, every key as a
  key cap, Start. It is sized to the window and never scrolls
  (`scripts/_cards.mjs` checks 1280x720 to 2560x1440).
- **Pause:** the same card with a PAUSED chip, the volume (five steps) and
  Resume. The game keeps drawing, blurred, at 10 fps.
- **Made by Tan** (ui/maker.js): a chip on the key art of the loading, start
  and pause cards: Tan's face, Buy Me a Coffee, X, GitHub, tanuj.fyi. Plain
  links in a new tab; a click on it never starts the game.
- **The postcard** (ui/postcard.js): shown once Hachi has settled for his
  nap at the tour's end, and from the little "Your postcard" by every pause
  card. Share, Copy link, Post; and **Add your selfie with Hachi**
  (ui/postcardSelfie.js, its own chunk, fetched on the click): camera only,
  the photo never leaves the page's canvas, Hachi peeks over the polaroid,
  Save image.
- **Sound labels** (ui/soundLabels.js): top left, the name of a sound as you
  come near it, Japanese and English ("カンカン · level crossing"). Han's
  song is not named.
- **The song:** the first 45 s of the title tune (a copyright-free track Tan found; not credited, per Tan) loop on the start
  and pause cards, with the game's own sound down under it, and fades out as
  play starts or resumes; paused again, it carries on where it left off. The
  browser allows sound only after a first click or key, so on the start card
  it plays once the visitor has touched anything.
- **Minimap** (bottom right: compass, your arrow, places) and **town map**
  (M): an illustrated map drawn from the game's own data, with diamonds for
  things to do and speakers for things to hear. Hidden on the famous view.
- **Toasts:** short, above the card, 15 px.

## 6. The experiences

Built on `ctx.experiences.add` (world/experiences.js): `kind: 'engage'`
spots get the highlight and E; `kind: 'sound'` spots are a speaker on the
map. docs/EXPERIENCES.md is the builders' brief.

**1. Nippon Konbini** (store/shop.js). Step onto its highlight and a card
asks "What would you like?". Pick one of five with 1 to 5: egg sando, fruit
sando, onigiri, Strong Nine (a red Recommended stamp; "Lemon beer · 9%"),
Choco Wafer Jumbo. Then a scene plays with no skipping, about 22 to 30 s:

1. The door opens and chimes (Tan's door chime). You walk in along a path
   planned on the store's colliders, down the aisles and never through
   them, at 2.0 m/s.
2. The right hand reaches and takes the item.
3. At a self-checkout the item goes on the scanner with the first beep, and
   the screen shows it and the total (Tan's self-checkout recording, two
   cuts).
4. The hand taps "Fujica" (フジカ, our mint-green IC card with Fuji on it)
   on the reader, and **ka-ching**.
5. You walk out and eat it outside: sandos are wedges and show their cut
   face. The Strong Nine leaves you tipsy for ten seconds (a soft blur and
   sway).

The view is the scene's from the door until you stand outside again, facing
the street (Tan, 2026-10-02): the mouse is yours as you eat. So every pose
inside the store is known, and the store is built and textured only for what
those poses see (store/seen.js; `scripts/_store-seen.mjs` measures it).

- Inside, the store's music, hum and bed are heard, and the outdoors is
  muffled.
- No cashier, no wallet, no basket, no subtitles.

**2. The Nippon Fuji view.** Its highlight is the famous view's spot. Step
on it and the camera glides into the photo's framing (1.3 s); walk off and
it hands back.

**3. Han and the RX-7** (han/). Han leans on the real Mazda RX-7 from The
Fast and the Furious: Tokyo Drift (FD, VeilSide Fortune kit, orange with the
black sweep) in the car park's reserved bay, modelled from the film's
stills: side-parted shaggy hair, a half-smile, a denim overshirt. Step into
the glow and the song starts:

- the car backs out of the bay and takes the bridge road to the master
  junction, on the left;
- a feint, the handbrake, and one long slide round the junction (about 3 s,
  the tail out up to 40 degrees), the tail thrown the other way and caught;
- smoke from the rear tyres only, tyre marks that fade, the rotary's buzz and
  the tyres' howl made in code, under the song;
- the front wheels steer into the turn while it grips and against the slide
  while it slips; the body rolls, dives and squats;
- it parks nose first again; the view follows the car the whole way.

`scripts/_han-route.mjs` fails if any corner of the car leaves the road or
touches a parked car, or if a steered wheel points the wrong way
(docs/decisions/han.md, "The real drift").

**4. The train's listening spot.** On platform 1, by a door: while the train
stands there with its doors open, the ring shows; stand in it and hear the
in-train next-stop announcement. It fades as you walk away.

**5. The slow-life bench** (land/slowlife.js). By the paddies and the pond,
facing Fuji: sit, look around with the mouse, and hear the flute theme.

**6. ぺったん堂** (world/mochi/; docs/decisions/mochi.md). A mochi-pounding
shop on the main road, opposite the shopping street's mouth, a homage to
Kyoto's high-speed pounders
with nobody in it: three moon rabbits pound and turn the mochi in a stone
mortar to the chant (Tan's recording). Step onto its ring: "E · Buy a mochi
¥200". A matcha-strawberry mochi is served on a plate, your hand takes it,
the first bite stretches, and Hachi gets a dried sweet potato of his own.

**Things to hear** (each only near its place):

| Place | Sound |
| --- | --- |
| Every zebra | Its walk-signal tune while green: the main road's cuckoo (kakko), the side streets' chick (piyo) |
| ドンペン堂 | Its theme as you pass |
| The station | Station ambience and announcements, clearly heard over the plaza, dimmed while you stand in the train's listening spot |
| The level crossing | Its bells while closed |
| The shrine | Wind chimes in the grounds |
| ぺったん堂 | The pounding and the chant, with the show |

**Hachi, the guide** (animals/guide.js, shiba.js). A 3-4-month red shiba
pup, about 24 cm at the shoulder, with sit, lie, trot, tilt, shake and nap:

- **The hello:** every time the game starts, after 4 s of looking at the
  view (or as soon as you walk off it), he runs out from behind you,
  sits 3 m in front facing you, and says "Hi, I'm Hachi!" with a caption
  that tells you to follow him and that F whistles for him. The view eases
  down to him and back (your mouse takes it back at once). He waits there
  until you walk off. Nothing is saved between visits.
- **The tour:** he leads a town tour at a jog, 4-9 m ahead, stopping to
  look back when you fall behind (config `ANIMALS.guide.tour`, about 870 m):
  the view, the konbini, the zebra, Han, the shopping street, ドンペン堂,
  ぺったん堂, the plaza and platform 1's train, the level crossing, his own
  home, the shrine and its fox, the bridge, the Deer Park gate. No water
  crossings, no alleys, and he takes stairs like a person.
- **The level crossing:** he goes over only with the arms right up. Shut, he
  sits facing the line, boofs, follows the train with his head, and hops up
  as the arms lift.
- **ハチのおうち** (animals/home.js, `TOWN.hachiHome`): his own garden past
  the crossing, at the lane's end: a gate with his name, a Japanese doghouse
  with a porch, a cushion, bowls, a ball, a tunnel and a hoop. He waits for
  you inside the gate, then shows it all off (about 17 s) and leads on.
- **A guide, not a follower:** walk away and he stops where he is and waits.
  Walk back to him and he carries on the tour where he left off.
- **The whistle:** F whistles; he answers after the whistle ends, comes to
  you, and then rushes you to the nearest place you haven't been. You
  always see him come. He never pops up in view: he comes round a corner,
  from behind a car or a building ahead of you, in a bounding gallop across
  the middle of your view. Then he greets you 4 m in front (nearer, he'd be
  below the frame): a skid, a spin, two hops, a sit and a head tilt.
- **The Strong Nine:** while you're tipsy he comes to just in front of you
  and rolls on his back, paws going, giggling, for the whole ten seconds.
- **His voice:** made in code. Yips, a "boof", a curious "hm?", a whine,
  a giggle, panting and his collar tag.
- **Reactions** (animals/reactions.js; expression channels on the one
  instance, still one draw call): blinks, a head tilt when you look at him,
  tippy taps at a place, a wiggle and spin when you step into a ring, a petal
  on his nose (sniff, sneeze, shake), a yawn when kept waiting, a charge
  through the pigeons, a startle as the crossing's bells start.
- **At the konbini:** as you come out he begs, then does a bit for what you
  bought, on your clock (the Strong Nine: paws round a can that isn't there,
  then hiccups and over onto his back).
- **Bedtime:** at the tour's end he hops onto the bench by the Deer Park
  gate, bows, spins, rolls, circles and lies down; the postcard follows.
- **After the tour:** whistled, he comes and stays, at your side as you walk
  and playing when you stop. Look at him within 6 m: "E · Take the tour
  again".

`scripts/_guide.mjs` checks all of this.

**Other animals:** a cat, pigeons at the plaza, koi, turtles and ducks in
鏡池, a heron and egrets in the paddies, butterflies over the renge, crows
heard now and then at golden hour. They are instanced and frozen beyond
60 m.

**Teasers:** the Deer Park gate at the bridge road's end (鹿公園 近日公開 /
"Deer Park · coming soon", closed); Osaka posters ("tickets to Osaka,
reservations open soon") at the station and the gate.

## 7. The store's stock

`src/data/catalog.js`: about 440 original products in one shape (id, JA and
EN names, price, zone, mesh recipe, sound), with labels drawn on shared
atlas pages. Close homages for brands (Strong Nine, Choco Wafer Jumbo);
never a real package copied. The scene's five choices come from the
catalogue. `_konbini.mjs` checks the stock is on its shelves (0 of 5,942
facings out of place).

## 8. Characters

- **People:** only the player's right hand and Han. The clerk, the cashier
  and the station master were built and removed (Tan). Idle people are not
  planned.
- **Han** (han/han.js): a stylised racer modelled on the film's stills, as
  Han. Tan's one exception to "close homages only" is the real RX-7.
- **Animals:** section 6.

## 9. Audio

- **Engine** (`src/core/sound.js`): Web Audio directly.
  - Each placed sound has a `near`/`far` range (config `SOUND`); beyond
    `far` no source exists.
  - HRTF panners give direction.
  - Placed one-shots follow the listener until they end.
  - Short sounds decode once and are shared; long music streams through an
    `<audio>` element.
  - A file asked for before it loads plays once it has loaded.
- **Local sounds:** a place's sounds are heard only near it, never across
  town. Only the ambience beds (wind, birds, night insects) are everywhere
  they apply.
- **Indoors:** the outdoors is low-passed and ducked inside the store; the
  store's music and bed come up (`SOUND.storeInside`).
- **Pipeline:** `npm run audio` (scripts/encode-audio.mjs, macOS
  `afconvert`) cuts, loops, levels and encodes `assets/audio/*` to mono AAC
  in `public/audio/` with a manifest (scripts/audio-cuts.json). There are
  28 files, 3.4 MB on disk. Files are fetched after the first click.
- **Missing files** fall back to procedural recipes. Hachi's voice, the
  RX-7's engine and tyres, the store hum and some beds are always procedural.
- **Names:** each placed sound has a label (strings.js `soundNames`), shown
  top left while it is heard.
- **Files in use:**
  - door chime (lawson-chime: the well-known entrance melody, Tan's call);
  - auto door, store music (store-bgm);
  - the self-checkout cuts (kiosk-scan, kiosk-pay), ka-ching;
  - can-open, wrapper, bite, munch, gulp;
  - walk signals (walk-kakko, walk-piyo);
  - railway bells, station ambience, the next-stop announcement;
  - Han's song (han-drift), ドンペン堂's theme, shrine chimes, the rural
    flute, ぺったん堂's pounding (mochi-pound, Tan's file);
  - birds, crows, night insects, wind.
  - Tan's song for the cards, `title bgm.mp3`: its first 45 s looped, in
    stereo, HE-AAC 48 kbps, 276 KB.
- **Rules:**
  - audio files are never committed;
  - no soundboard or sound gallery (効果音ラボ's terms);
  - no hotlinking;
  - no station departure melodies.

## 10. UI text

- English only for instructions: prompts, toasts, keys, cards.
- Japanese only in the world (signs, packaging) and small beside product
  and place names.
- All text lives in `src/data/strings.js`.
- The page is `lang="en"` with `translate="no"` (Chrome once
  "translated" the start card), and the Japanese spans carry `lang="ja"`.

## 11. Performance

**Rules** (AGENTS.md):

- Draw only what is seen: the tab hidden draws nothing and suspends audio;
  paused or unfocused draws at 10 fps.
- New animation hooks into the main loop.
- One instanced mesh per kind of thing.
- Textures are the size they are seen at.
- A place loads when approached and frees when left.
- Long audio streams; short audio decodes.
- Measure before and after every change, and put the numbers in the commit.

**Where we are** (2026-10-02, headless Chrome on Tan's M2):

| Measure | Target | Now |
| --- | --- | --- |
| First-visit download (`npm run size`) | < 5.25 MB (5 MB before ぺったん堂; Tan, 2026-10-01) | 5.05 MB (1.65 MB before the first click; sign fonts 0.52 MB; audio 3.39 MB) |
| Ready to play | < 5 s | about 4 s |
| Famous view frame, 1440p x1.5 | 60 fps | about 11 ms |
| JS heap after start | 300 MB | about 270-310 MB (run to run) |
| Store textures | none set | see DECISIONS.md, "The konbini, only what is seen" |
| Main chunk | none set | about 570 KB gzip (one Vite warning) |

**Known costs:**

- The three trains stay loaded (about 147k triangles).
- The Pokémon livery page is 4096 wide (about 21 MB on the GPU; Tan chose
  quality).
- three.js keeps a CPU copy of every static geometry buffer. Freeing it on
  upload is the largest remaining saving.

## 12. The first spec against today

What the first spec asked for, and what became of it. **Done**: built, and
kept. **Changed**: built, then reshaped on purpose. **Dropped**: removed by
Tan's call. **Open**: not built yet, and still wanted or undecided.

| First spec | Status |
| --- | --- |
| M0 fork and strip, flat world | Done |
| M1 hero views, GSI Fuji, reference overlay | Done (overlay on the backquote key, dev only) |
| M2a-f town kit, dense town, station and trains, polish, art fidelity, minimap | Done; the town shrank and was redrawn to Tan's square |
| Town quality pass (river, paddies, fonts, builders) | Done; 鏡池 and the paddy mirrors added |
| M3 store interior, ~440 products, basket and pickup | Changed: the interior stays, but you don't roam it; the konbini is a scene |
| The Lawson (name, milk-can logo, uniform) | Changed: NIPPON / ニッポン, no real chain |
| M4 audio engine, local sounds, pipeline | Done |
| M5 clerk, dialogue (bag, heat, chopsticks), cash and change, receipt | Dropped: self-checkout with an IC card; no clerk, no receipt |
| VOICEVOX clerk voice | Dropped with the clerk |
| M6 microwave, hot food, coffee machine | Dropped |
| M6 a continuous 12-minute day/night cycle, dawn | Changed: three fixed looks on 1 2 3 (morning, golden, night) |
| M6 the blue-hour kei van parking out front | Open (not built) |
| M6 sit-and-eat | Changed: you eat outside after the konbini scene; the slow-life bench |
| M6 bins with sorting | Dropped |
| Usable vending machines | Open (decorative only, no prompt) |
| Stamp card, receipt book | Dropped (no collectables; Tan) |
| Photo mode | Dropped (the Nippon Fuji view spot does its job) |
| Settings: sensitivity, invert-Y, FOV, head bob, graphics tier, auto quality | Open: only the volume exists |
| Wet road reflections at golden hour, lens flare, selective night glow | Open (not built; the mirrors went to the pond and paddies) |
| Boarding the train, the station master, the shrine prayer, confetti | Built, then dropped (Tan) |
| People (students, shoppers) | Dropped: only the hand and Han |
| Birds on wires, cat, sparrows | Changed: cat, pigeons, koi, turtles, ducks, heron, egrets, butterflies, crows, Hachi |
| Friendly "best on desktop" screen for phones | Done (the phone card), then the pocket town (m.html, 2026-10-04) |
| Title screen, credits in the game | Done: the start card, and credits.html linked from it |
| M7 memory under 300 MB | About there (270-310 MB after start) |
| M7 download under 5 MB | Changed: 5.25 MB (Tan); 5.05 MB today |
| M7 tested in Chrome, Edge, Firefox (Windows), Chrome and Safari (macOS) | Open: audio was tested in WebKit and Firefox at M4; nothing since |
| M7 hosted on a CDN with long-lived caching | Done: live at takemebacktojapan.com |
| M7 "a first-timer completes a purchase in 3 minutes" | Changed: the konbini is its own highlight, a step from the spawn, and Hachi leads the way |

**Known gaps Tan has seen and accepted for now:**

- Han is a painted likeness, not a portrait.
- From behind, the pup reads as a small dog more than clearly a puppy.
- The Pokémon train has no giant two-bay figures.
- A postbox partly hides ドンペン堂's displays from one angle.
- Hachi's full tour takes about 8 minutes.
- Han's song is heard muffled inside the store if you walk in mid-show.

## 13. The road to launch

Tan deploys `dist/` from `npm run build` to takemebacktojapan.com. **The
desktop game is live** (2026-09-30). Section A is kept as the record of what
launch needed; B and C are what is next.

**Since launch** (each in DECISIONS.md): the Made by Tan chip and the
postcard, the selfie postcard, sound labels, Hachi's reactions and his life
after the tour, the tour's rework (the crossing, his home, the shrine's
fox), the konbini built only for what is seen, ぺったん堂, Han's real
drift, the station plaza's bus stop, and share images from the key art.
**Analytics:** DataFast (datafa.st), on the live site only (desktop and phone): page
views and named goals (the postcard, the selfie, the chip's links), never a
photo. It is the one script from another domain (AGENTS.md).
**Phones:** the pocket town (m.html, live 2026-10-04): the main road, the
shopping lane to the station, the shrine, the bench and the Deer Park gate;
no Han, ぺったん堂 or Hachi's home. DECISIONS.md "The pocket town" onwards.

**A. Before it went live (the launch list)**

1. **Back up the repo.** `main` is 218 commits ahead of GitHub
   (origin: tanuj10r/takemebacktojapan.com) and has never been pushed. Push it. Decide
   whether the repo is public (it carries no audio, so it can be).
2. **Final QA pass.** Play every experience at all three times of day, from
   a fresh start and a reload. Also: the cards at 1280x720
   and 2560x1440, R, F, M, N, Space, Esc, and a long idle. Fix what's found
   (the fix-known-gaps rule). Then run the whole suite: `_play`, `_konbini`,
   `_guide`, `_han-route`, `_cards`, `_audio`, the hero guard, the walks,
   `npm run check:names`, `npm run build`, `npm run size`.
3. **Browsers and machines.** Chrome, Safari and Firefox on macOS; Chrome
   and Edge on Windows. One normal laptop with integrated graphics, not only
   the M2. Check the audio starts after the click, the pointer lock, the
   frame time, and that nothing is missing.
4. **Phones and failures.** A shared link will often be opened on a phone.
   Show a friendly card on touch-only devices: "Best played on a desktop
   browser", with the key art and the URL to open later. This is a
   message, not a mobile version. Also show a clear message if WebGL2 is
   missing or the GPU context is lost, instead of a blank page.
5. **Rights review (Tan's calls).** The site is public, so decide each of
   these: keep, replace, or keep with a takedown contact.
   - the Pokémon train's art and names (Tan allowed actual Pikachu and
     Pokémon materials);
   - Han's song and ドンペン堂's theme, if they are recordings of the
     film's song and the store's real theme;
   - store-bgm ("Sounds of Japanese Lawson" by Joonas; permission not
     confirmed);
   - the entrance chime (Yasushi Inada's melody, still in copyright);
   - the real RX-7 and Han as a likeness.

   The disclaimer in the README and a contact line should also be on the
   site.
6. **Credits in the game.** Add a small Credits link on the start card:
   - Sakura Crossing (MIT);
   - 出典 国土地理院, which GSI's terms ask for wherever the data is used;
   - 効果音ラボ;
   - the fonts (OFL);
   - the music sources;
   - three.js.

   Also confirm the name in LICENSE ("Tanuj").
7. **Page polish.** Add a favicon (none today). Add a 1200x630 JPG share
   image next to the WebP, which some apps don't preview. Fix the README's
   stale line ("heat a bento, chat with the clerk").
8. **Hosting.** The recommendation is Cloudflare Pages: free, fast in Japan
   and everywhere, custom domain and HTTPS included.
   - Create a Pages project and upload `dist/`, by drag and drop or
     `npx wrangler pages deploy dist`.
   - Add takemebacktojapan.com and www as custom domains. Move the domain's
     nameservers to Cloudflare, or add the CNAME it asks for at the
     registrar. Redirect www to the apex.
   - Add `public/_headers`:
     - `/assets/*`: cache for a year, immutable (Vite hashes their names);
     - `/audio/*` and `/keyart-*.webp`: a day;
     - `index.html`: no-cache;
     - a Content-Security-Policy of `default-src 'self'` (with the
       `blob:`, `data:` and inline allowances the game needs), which also
       enforces "no requests to other domains";
     - `.m4a` served as `audio/mp4`.
   - Check the live site with `npm run size`'s numbers against the network
     panel, then share the link.

**B. Soon after launch**

- **Memory to 300 MB.**
  - Free static geometry's CPU copies after upload.
  - Load the trains only near the railway.
  - Weigh the Pokémon page at 3072.
- **Code-split the main chunk,** e.g. the map, Han, the trains.
- **Headroom under 5.25 MB** before adding anything (0.2 MB today).
- **The pocket town** (phones): the label page and the store's signs held a
  size smaller; a phone start for the guide check's voice line.

**C. Later (new content; each a milestone with a plan and Tan's OK)**

- **Deer Park** (Nara), through the gate. It loads when approached and
  frees when left.
- **Osaka / Dotonbori**, as the posters promise.
- **From the first spec, if Tan wants them:**
  - the blue-hour kei van;
  - usable vending machines;
  - a continuous day cycle;
  - wet roads at golden hour;
  - basic settings (mouse sensitivity, invert-Y, field of view).
- **The accepted gaps** in section 12, as time allows.

## 14. How we work

- AGENTS.md holds the standing rules; this file holds the design.
- One piece of work at a time: propose a short plan, wait for Tan's OK,
  build, then check every acceptance item and report pass or fail.
- Big passes go to specialist builders in worktrees (docs/BUILDERS.md), two
  at a time. I review every frame against the references and fix known gaps
  before merging.
- Every change is measured: size, frame time, memory. The numbers go in the
  commit and DECISIONS.md. The hero guard, walks, STOCK and the play tests
  must pass on main after every merge.
- Tests clean up their own browsers and servers. Tan's laptop swaps, so run
  one screenshot job at a time (shots.mjs takes a lock).
