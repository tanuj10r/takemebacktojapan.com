# Take Me Back to Japan: agent rules

First-person, anime-style browser game: Fujikawaguchikko (富士川口湖町),
a compact town under Mt. Fuji, as experiences (docs/EXPERIENCES.md): to
do (konbini, Han's RX-7, train, slow-life bench, ぺったん堂) and to hear (walk
signals, ドンペン堂, station, level crossing, shrine), Osaka and Deer Park
teasers. Full design: SPEC.md; read only the sections the work needs.

## Base
- Built on Sakura Crossing (MIT) by Kenton Wang. Keep LICENSE and the
  credit in the game.
- Reuse src/core (toon, post, outline, sky, palette, textures, player, hud)
  for all rendering. Its technique wins over SPEC.md; SPEC.md and reference/
  win on colour, mood and anything specific to the Lawson and Fuji.
- The world is flat. Never reintroduce the planet or spherical placement.
- src/world's base modules (street, buildings, trees, props, railway) are
  parts: place one only when the current milestone in SPEC.md says so, in
  our layout with our own signs.

## Hard rules
- Desktop is the full game; never lower its quality for weak devices. Phones
  get m.html, the portrait pocket town (src/mobile/, `@mini` marks).
- Visuals are built in code: no downloaded models or images. Signage is
  drawn with Canvas2D.
- Sound files live in assets/audio/ (SPEC section 9 audio list). Never
  commit them; never add a soundboard or sound gallery; fall back to the
  procedural recipes when a file is missing. No station departure
  melodies. The one chain jingle is Tan's call: the door chime uses their
  assets/audio/lawson-chime.mp3 (the FamilyMart melody; rights noted in
  DECISIONS.md M3d).
- People: only the player's hand and Han (and the animals).
- Names: close homages for brands (ドンペン堂, Strong Nine, Choco Wafer
  Jumbo); Tan's one exception is the real Mazda RX-7 from the film.
- The store is NIPPON / ニッポン (config.js STORE_NAME), a generic konbini
  in Lawson-style blue design: no real chain's name or mark anywhere. Products
  may evoke 7-Eleven, FamilyMart and Lawson, always under original names.
- UI instructions (prompts, toasts, keys, choices) are English only;
  Japanese only in the world and beside product and place names.
- No runtime requests to other domains (except Tan's DataFast analytics,
  live site only). Fuji elevation is baked by scripts/fetch-fuji-dem.mjs.
- No bloom by default.
- Sounds are local: a place's sounds and cues are heard only near that
  place (config.js SOUND), never across town. SPEC section 9.
- All place and shop names are our own (src/data/town.js; npm run
  check:names).
- UI text in src/data/strings.js, products in src/data/catalog.js,
  tunables in src/config.js.

## Performance (read before adding anything; SPEC section 11)
- Draw only what is seen: hidden draws nothing, paused draws 10 fps. New
  animation hooks into the main loop, never its own rAF or setInterval.
- Budget: whole game 300 MB memory, 5.25 MB download. Measure before and
  after every change (npm run size, frame GPU ms) and put the numbers in
  the commit. Textures are most of the memory: 4096^2 = 89 MB, 2048^2 =
  22 MB. Make a texture the size it is seen at; never pad a page.
- Only what is near exists: a place loads when approached, frees when
  left (sounds already stop beyond `far`). One instanced mesh per kind.
- Long audio streams; short audio decodes. Nothing redraws every frame
  that does not change every frame (shadows redraw on a snapped grid).
- Test tools clean up their servers and browsers.

## Reference images
- reference/real-day.png, reference/real-bluehour.png: exact hero-view
  composition.
- reference/mood.png, reference/mood-day.png: colour and mood.

## Workflow
- One milestone per session (SPEC section 12). Propose a short plan, wait
  for OK, implement, then check every acceptance item and report pass/fail.
- Log judgement calls in DECISIONS.md.
- Specialist builders (town pass): docs/BUILDERS.md, their files only.
- Keep this file under 80 lines.

## Commands
- npm install
- npm run dev     (dev server)
- npm run audio   (assets/audio/ -> public/audio/, AAC, 3 MB budget)
- npm run size    (first-visit download; report it when it grows)
- npm run fonts   (assets/fonts/ -> subset sign fonts in src/assets/fonts/)
- npm run build   (static dist/)