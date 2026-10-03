/* Tunables (AGENTS.md).  Units are metres unless noted; +Y is up.
 *
 * World frame (SPEC section 3): the Lawson's front faces +Z toward the main
 * road and Fuji lies far behind it to -Z.  The storefront is centred on x = 0
 * with its glass at z = 0.
 *
 * Sizes below are measured off reference/real-day.png and
 * reference/real-bluehour.png (see DECISIONS.md, M1), where the photos win
 * over SPEC's starting numbers. */

export const PLAYER = {
  eye: 1.6,
  /* Gameplay FOV, degrees, measured across a 16:9 frame (SPEC section 5's
   * 70°).  The vertical angle this gives (~43°) is held at every aspect. */
  hfov: 70,
};
export const PLAYER_VFOV =
  2 * Math.atan(Math.tan((PLAYER.hfov * Math.PI) / 360) / (16 / 9)) * (180 / Math.PI);

/* The store's name (M3d, Tan): a generic konbini in the Lawson-style blue
 * design, no real chain's name or mark anywhere.  NIPPON, its mark the
 * rising sun behind 日本. */
export const STORE_NAME = { mark: 'NIPPON', kana: 'ニッポン', en: 'Nippon' };

export const LAWSON = {
  x: 0,
  frontZ: 0,       // storefront glass line
  width: 17,       // main box; the real store is long and low
  depth: 13,       // back wall at frontZ - depth (M3b.2: deeper, behind the famous facade)
  height: 4.0,     // ground to top of the parapet
  signBand: 0.62,  // blue band height
  coping: 0.42,    // pale cap above the band
  doorX: -2.3,     // entrance centre: left of centre, as in both photos
  doorWidth: 2.0,
  wingWidth: 2.6,  // tiled wall section at the right end
};

/* Sound (M4, Tan's review): five settings, not a free slider.  The number
 * shown is the setting; the gain is what it actually plays at, scaled so
 * 100% is comfortable (the old free slider's 60%). */
export const VOLUME_STEPS = [0, 25, 50, 75, 100];
export const volumeGain = (step) => (step / 100) * 0.6;

/* Made by Tan (Tan, 2026-10-01; DECISIONS.md, Made by Tan): the chip on every card and the postcard
 * at the end of Hachi's tour (ui/maker.js).  Plain links, opened in a new tab: nothing is loaded from
 * these sites.  `avatar`: Tan's own portrait, cropped (scripts/_avatar.mjs), beside the page. */
export const MAKER = {
  avatar: 'tan.webp',
  links: {
    coffee: 'https://buymeacoffee.com/tanuj10r0',
    x: 'https://x.com/tanuj10r',
    github: 'https://github.com/tanuj10r',
    site: 'https://tanuj.fyi',
  },
  /* every link out says where it came from (Tan, 2026-10-01): `?ref=takemebacktojapan` on Coffee, X, GitHub and
   * the site (ui/maker.js makerLink); all four still resolve with it (curl, 2026-10-01).  '' turns it off. */
  ref: 'takemebacktojapan',
  handle: 'tanuj10r',                     // the X share's "via"
  share: 'https://takemebacktojapan.com', // what the postcard shares (the canonical address, never a local one)
  postcardAfter: 0.6,                     // s after Hachi's happy bit on his bench at the gate is over and he has settled, before the postcard comes
};
export const DEFAULT_VOLUME = 50;                      // 30% of full scale: the level Tan liked

/* The konbini (store/shop.js; SPEC 5 and 6.3). */
export const STORE = {
  wallet: 1000,        // yen you start with (Tan: ¥1,000 a visit)
  flight: 0.35,        // seconds, shelf to hand
  slide: 0.25,         // seconds for the next unit to come forward
  door: { open: 1.66, ease: 0.3, away: 2.5 },   // fridge doors: radians, s, m (shut when you walk off)
  /* Tan's konbini (store/shop.js) */
  till: { x: 7.32, z: -4.5 },                 // the self-checkout's line on the counter (store frame; no cashier: Tan). Not the other one at -3.3: its IC reader is under the bun steamer
  tillSound: { near: 3, far: 14 },            // the self-checkout's voice and beeps: the counter and the aisles near it
  eatGain: { bite: 0.9, munch: 0.7, gulp: 0.8, 'can-open': 0.8, wrapper: 0.6 },
  recommended: 'strong_nine',   // the choice card's stamp (Tan)
  checkoutGain: 0.9,  // the self-checkout (Tan's recording)
  /* Tan's self-checkout recording, in two short cuts (scripts/audio-cuts.json
   * kiosk-scan, kiosk-pay; Tan 2026-09-28: parts of it, not all 31 s): how
   * long each is and where its beeps fall, so the item meets the scanner on
   * the scan beep, the card the reader on the card beep, and the screen
   * thanks you on the paid beep. */
  kiosk: { scanLen: 1.5, scanBeep: 0.15, payLen: 3.95, payCard: 0.25, payDone: 1.15 },
  /* The visit's pace (Tan 2026-09-28: the whole thing, choice to eaten, in
   * no more than 30-35 s): walking speed in m/s, brisk but not a hurry
   * (2.0 before; 2.5 read as a rush in first person). */
  walk: 2.2,
};

/* Watching Han's drive (main.js watchCar): how fast the view closes on the
 * car (1/s), the most it turns (rad/s: a head turning, not a camera rig),
 * and the pitch it keeps within (rad). */
export const HAN_WATCH = { follow: 3.2, maxTurn: 1.9, pitch: [-0.3, 0.22] };

/* Han's drive (world/han/drive.js; Tan, 2026-10-02: "The drift feels very fake").  A car's limits, in m, s, rad:
 * the route's speeds come from them, then the whole drive is scaled a few per cent to the song. */
export const HAN_DRIVE = {
  ease: 0.6,                 // the path's curvature eased over this far each way (the wheel is turned, not snapped)
  lat: 12, latSlide: 14,     // sideways grip (v^2 / R) gripping, and what a slide is allowed
  acc: 7.5, brake: 10, accRev: 4.5,
  /* the slide in the master junction: north at x `xIn`; from z `z` a feint east (radius rf, angle a), then round to
   * the west (radius r, 270 deg + a) and the transition (radius re, 90 deg) onto the bridge road south.  `v` its
   * speed; the slip angles: the feint's, the slide's (34 deg), the transition's (the other way) */
  teardrop: { xIn: 28.9, z: 14.6, rf: 6, a: 0.3, r: 3.0, re: 4.0, v: 6.2, feint: 0.1, slip: 0.6, slipOut: 0.5 },
  lead: 0.15,                // the hands lead the car: a slide is asked for this long before its arc
  spring: 6.8, damp: 0.56,   // the slip angle chases what is asked (rad/s; under-damped: the catch wobbles)
  waver: 0.07, waverHz: 1.7, // the throttle wavering through the slide
  handbrake: 0.3,            // the rear wheels locked this long as the slide starts
  counter: 0.85, counterTurn: 0.15, lock: 0.6, hands: 0.05,   // counter-steer per rad of slip, what of the turn's own steer stays, full lock, how quick the wheel is turned
  spin: 0.9, launchV: 5, launchSpin: 6,                      // rear wheelspin over road speed in a slide; the launch's, until launchV
  roll: 0.045, rollAt: 7, pitch: 0.022, pitchAt: 5, squat: 0.008, body: 9, bodyDamp: 0.4,   // the body on its springs
  pivot: 0.6,                // the body turns about a point this far ahead of its middle: the tail swings, the nose keeps the line
};
/* What the slide leaves (world/han/fx.js): each one draw, there only while there is something of it. */
export const HAN_FX = {
  /* rear-tyre smoke: `rate` puffs a second from each tyre at full slide, `max` alive at once (the oldest go
   * first), each living `life` s, `size` m across swelling by `swell`x, `alpha` at its thickest; it leaves the
   * tyre with `carry` of the car's speed and `fling` of the wheelspin (backward), slowed by `drag`, rising */
  smoke: { max: 160, rate: 36, life: 2.2, size: 1.0, swell: 2.0, alpha: 0.62, rise: 0.8, drag: 1.6, spread: 0.9, carry: 0.3, fling: 0.22 },
  /* tyre marks: a ribbon of `quads` quads (both tyres), one every `step` m, `width` m wide, `lift` m over the
   * road, `dark` opaque when laid at full slide, fading between fade[0] and fade[1] s old */
  marks: { quads: 640, step: 0.14, width: 0.22, lift: 0.012, dark: 0.62, fade: [9, 17] },
  /* the car's sound, made in code (no file): levels of the engine and the tyres' howl (0: not made at all), heard
   * full within `near` m of the car and not at all beyond `far`; the gears' top speeds (m/s), the revs' pitch (Hz) */
  sound: { engine: 0.05, squeal: 0.5, near: 8, far: 34, gears: [5, 9, 14], hz: [70, 240] },
};

/* Ground plan in front of the store, as z lines (the store glass is z = 0). */
export const STREET = {
  apron: 1.6,      // concrete walk along the glass
  stopZ: 2.5,      // wheel stops
  bayZ0: 2.9,      // painted bay lines start ...
  bayZ1: 8.2,      // ... and end
  bayWidth: 2.7,
  bayFirstX: -6.1, // one divider line; the rest repeat every bayWidth
  forecourtZ: 10.5,// forecourt meets the road
  roadZ: 17.2,     // far kerb
  tactileZ: 17.55, // centre of the yellow tactile strip
  sidewalkZ: 20.5, // far sidewalk ends, a paved lot begins
  lotZ: 42.5,      // to the lane at z 45
  x0: -40,         // forecourt
  x1: 40,
  roadX0: -125,    // the main road runs the width of the town (M2)
  roadX1: 125,
  lotX0: -22.5,    // the paved lot where the photographers stand (coin parking)
  lotX1: 27.5,
  bayX0: -20,      // painted bays and wheel stops, out past the hero frame
  bayX1: 22,
};

/* Hero views (SPEC section 1).
 *
 *   play   where keys 1, 2, 3 and the spawn put you, in the ordinary gameplay
 *          lens: the spot where the store fills the frame as it does in the
 *          photo.  Fuji is magnified in play to match (FUJI.gameplaySize), so
 *          the view reads as the photo and walking off never zooms.
 *
 * The rest is the exact camera of the reference photo, used only under the
 * dev reference overlay (Backquote), reconstructed from the store's size in it:
 *   vfov   vertical field of view, degrees
 *   shift  lens shift [x, y] in units of half the frame height.  The photos
 *          keep verticals straight with the horizon well below centre, so the
 *          camera stays level and the lens shifts instead of tilting.
 * The composition then holds at any window aspect: the frame is matched on
 * its height, and the reference overlay fits the reference by height too. */
export const HERO_VIEWS = {
  morning: {
    key: 'Digit1',
    look: 'day',
    play: { pos: [0, 0, 16.5], yaw: 0, pitch: 0.16 },
    pos: [0, 0, 30.4],
    yaw: 0,
    vfov: 24.1,
    shift: [0, 0.4135],
    ref: 'real-day.png',
  },
  /* Golden hour uses hero camera 1's framing; the game opens on it (SPEC 1).
   * There is no real photo at golden hour, so R shows the day photo for
   * composition. */
  golden: {
    key: 'Digit2',
    look: 'golden',
    play: { pos: [0, 0, 16.5], yaw: 0, pitch: 0.16 },
    pos: [0, 0, 30.4],
    yaw: 0,
    vfov: 24.1,
    shift: [0, 0.4135],
    ref: 'real-day.png',
  },
  /* Night stands where morning and golden hour do.  Its photo camera (dev R
   * overlay only) is the blue-hour photo's: closer and a little left, with the
   * storefront still square to the frame, so its peak sits nearer the centre. */
  night: {
    key: 'Digit3',
    look: 'blue',
    play: { pos: [0, 0, 16.5], yaw: 0, pitch: 0.16 },
    pos: [-3.36, 0, 23.4],
    yaw: 0,
    vfov: 42.6,
    shift: [0.376, 0.232],
    ref: 'real-bluehour.png',
  },
};

/* The player starts on the famous view at golden hour (SPEC section 1). */
export const SPAWN = { view: 'golden', ...HERO_VIEWS.golden.play };

/* Mt. Fuji from the baked GSI grid (scripts/fetch-fuji-dem.mjs).
 *
 * It is drawn at a fixed offset from the camera, like the sky, because at the
 * real 16 km nothing in a 250 m town moves it.  The mesh is scaled so its
 * angular size is the real one from the real Lawson. */
export const FUJI = {
  bearing: 9.8,        // peak direction, degrees right of -Z (real-day.png)
  distance: 1400,      // drawn distance to the peak, metres
  exaggeration: 1.0,   // vertical scale on top of the true shape
  radius: 11000,       // crop around the summit, real metres
  snowLine: 2450,      // real metres; jagged, and lower in the gullies
  /* Fuji's on-screen size in the gameplay lens, relative to hero camera 1
   * (1 = exactly as large as in the famous photo).  The hero cameras always
   * show the true size. */
  gameplaySize: 1.0,
};

/* Time-of-day looks for M1's three hero views.  M6's day/night cycle
 * interpolates between keyframes in this shape.  Colours are sRGB hex. */
export const LOOKS = {
  day: {
    sky: { top: 0x2a6ad8, mid: 0x6ba6ec, haze: 0xcbe3f6, glow: 0xe6f2ff, glowAmount: 0.15, glowYaw: 10 },
    clouds: { light: 0xffffff, shade: 0xc9d6ee, opacity: 1 },
    fog: { color: 0xc8def2, near: 70, far: 320 },
    sun: { color: 0xfff3dc, intensity: 2.2, dir: [34, 70, 62] },
    fill: { color: 0xa9bdf5, intensity: 1.0 },
    bounce: 0.3,
    hemi: { sky: 0xd6e8ff, ground: 0xb3a8c8, intensity: 1.05 },
    grade: { shadow: 0xb4b4d8, light: 0xfffaf2, saturation: 1.12, lift: 0.03, vignette: 0.12, warmth: 0.015 },
    fuji: {
      lit: 0x8ea0d4, shade: 0x5a6db4, snow: 0xf9faff, snowShade: 0xb6c4ec,
      alpen: 0xffb6cc, alpenAmount: 0.0, haze: 0xc8def2, hazeAmount: 0.16,
      light: [-0.62, 0.52, 0.58],
    },
    ground: 0xc9ccc0,
    store: { interior: 0.82, sign: 1.0, spill: 0.0, glass: 0.34 },
  },
  golden: {
    sky: { top: 0x5a55b0, mid: 0xc79ac8, haze: 0xffc49c, glow: 0xffd9a8, glowAmount: 0.75, glowYaw: 38 },
    clouds: { light: 0xffd2b8, shade: 0xb48cc0, opacity: 1 },
    fog: { color: 0xe8b8b0, near: 60, far: 300 },
    sun: { color: 0xffc896, intensity: 1.9, dir: [70, 20, 34] },
    fill: { color: 0x9aa4ee, intensity: 1.05 },
    bounce: 0.34,
    hemi: { sky: 0xe6d0ec, ground: 0xa892c0, intensity: 1.0 },
    grade: { shadow: 0xb2a2d4, light: 0xfff0e2, saturation: 1.14, lift: 0.034, vignette: 0.16, warmth: 0.06 },
    fuji: {
      lit: 0xa28cc4, shade: 0x6660aa, snow: 0xfff0f2, snowShade: 0xc0aee0,
      alpen: 0xffa2bc, alpenAmount: 0.55, haze: 0xe8b8b0, hazeAmount: 0.18,
      light: [0.8, 0.34, 0.36],
    },
    ground: 0xc8b8b4,
    store: { interior: 0.92, sign: 1.12, spill: 0.12, glass: 0.3 },
  },
  blue: {
    sky: { top: 0x123c9a, mid: 0x2e6ad2, haze: 0x7ea2e6, glow: 0xa8b8f0, glowAmount: 0.3, glowYaw: 20 },
    clouds: { light: 0x8a96d8, shade: 0x4a5aa8, opacity: 0 },
    fog: { color: 0x7488c8, near: 50, far: 260 },
    sun: { color: 0x94a8ea, intensity: 0.5, dir: [-20, 70, 40] },
    fill: { color: 0x6c84d8, intensity: 0.75 },
    bounce: 0.2,
    hemi: { sky: 0x6a82d0, ground: 0x3c3a6c, intensity: 0.95 },
    grade: { shadow: 0xa4b0dc, light: 0xf2f6ff, saturation: 1.14, lift: 0.024, vignette: 0.18, warmth: 0.0 },
    fuji: {
      lit: 0x6a6cb0, shade: 0x464a8c, snow: 0xf4c6e0, snowShade: 0xb49ad4,
      alpen: 0xff9ccc, alpenAmount: 0.45, haze: 0x7488c8, hazeAmount: 0.12,
      light: [0.75, 0.4, 0.4],
    },
    ground: 0x7a80a8,
    store: { interior: 1.1, sign: 1.5, spill: 0.34, glass: 0.12 },
  },
};

/* The town (SPEC section 3, M2b).
 *
 *   north (-z)  the frame-edge side: residential lane (left), the Lawson and
 *               open ground toward Fuji, the park (right) -- M2's, kept as is
 *               so the famous views never change
 *   z 10.5-17.2 the main road (lawson.js), barricaded where it leaves town
 *   south (+z)  the dense core on a grid (TOWN.grid, world/town-plan.js):
 *               shopping spine to the station plaza, lanes everywhere, the
 *               railway along the south edge */
export const TOWN = {
  bounds: { x0: -122, x1: 122, z0: -42, z1: 174 },   // z0: the river's far walk and the gate are the town's edge (Tan's square)
  /* The core's edges (fences, groves).  Lots are cut only west of buildX1,
   * except the main road's frontage (lots ending before frontZ), which runs
   * the whole road: east of buildX1 behind it lie paddies (town pass). */
  core: { x0: -97, x1: 97, z0: 20.5, z1: 168, buildX1: 52, frontZ: 36 },
  /* Everything below is in the town's own frame, which is built turned
   * half round about the main road (world = (-x, 2*main - z)) so the town
   * stands between the Lawson and Fuji (M2e.3, world/ctx.js `turned`).
   * The line (M2c, world/line/): double track along the south edge, the
   * station at the spine's end, the level crossing on lane x -80. */
  /* `trains`: the types that take turns, run by run (line/emu.js TYPES: `box` the Fujimi
   * Line's own EMU, `jr` the E233-style JR commuter, `poke` the Pokémon train) */
  rail: { crossX: -80, z: 162, gauge: 1.067, spacing: 3.8, trains: ['box', 'jr', 'poke'] },
  /* Waiting for platform 1's train (QA-010: the listening spot only lights while it stands there, and the timetable
   * could leave you 4 minutes with nothing).  On the platforms or the concourse (or within `near` m of the spot) with
   * no platform-1 train due within `due` s, the next one is sent now, `lead` s from its stop (it starts out of sight:
   * never nearer than `minAppear` m, past every look's fog); the dimmed ring and "Next train · 0:25" count it down.
   * `hear`: the arriving train is this near the spot (its sound has come up), Hachi's ears go up and he boofs. */
  trainWait: { due: 30, lead: 26, minAppear: 330, near: 14, hear: 70 },
  crosswalk: { x: -35, width: 4 },              // the main road's zebra, by the master junction (lane x 30 = world x -30); its perpendicular partner crosses the lane (town-plan.js)
  petals: { air: 150, trees: 250 },               // SPEC 11: 400 on Ultra -- M2's field, plus the fall from the town's sakura
  /* Grid lines of the core.  `ns` run south from the main road (z = main)
   * unless `z0` says otherwise; `ew` run between x0 and x1. */
  grid: {
    main: 13.85,
    mainX: [-118, 118],
    ns: [
      { x: -80, cls: 'lane', z1: 172 },           // crosses the railway
      { x: -50, cls: 'shopping', z1: 126 },       // the spine, to the plaza
      { x: -25, cls: 'lane', z0: 28, z1: 144 },  // starts behind the Lawson's forecourt
      { x: 0, cls: 'lane', z0: 45, z1: 144 },
      { x: 30, cls: 'lane', z0: -11, z1: 144 },    // through the master junction and on as the bridge road, to the bridge (TOWN.land.bridge.z1)
    ],
    // (the town pass took the two east lanes, x 62 and 92: paddies now)
    ew: [
      { z: 45, x0: -80, x1: 52 },
      { z: 80, x0: -80, x1: 52 },
      { z: 112, x0: -80, x1: 52 },
      { z: 144, x0: -25, x1: 52 },
    ],
  },
  plaza: { x0: -78, x1: -27, z0: 126, z1: 148 },
  /* Hachi's own home (Tan, 2026-10-01; animals/home.js): a little garden across the level crossing, where a house
   * beyond the line stood at the lane's end (line/index.js buildBeyond leaves that lot out).  Town frame.  The rect is
   * its lawn (it lies past TOWN.bounds: the player's one pocket outside the square, town.js `pocket`); `gate`: the
   * opening in the south fence, on the lane; where his things are (the guide's joy goes round them: animals/guide.js):
   * `kennel` the doghouse's middle (its door looks at the gate), `bed` his cushion, `ball`, `mid` the open lawn,
   * `tunnel` (along z), `hoop` (he leaps through it along x), `basket` the toys, `sand` the sandpit. */
  hachiHome: {
    x0: -83.5, x1: -73.2, z0: 172.2, z1: 180.4,
    gate: { x: -80, w: 2.6 },
    kennel: [-78.3, 178.85], bed: [-75.7, 176.6], ball: [-78.6, 175.6], mid: [-79.2, 174.6],
    tunnel: { x: -81.9, z0: 173.9, z1: 175.9 }, hoop: { x: -80.7, z: 177.3 }, basket: [-74.4, 175.2], sand: [-82.1, 179.2],
  },
  /* The station (M2c): building on the plaza's south side, platform 1 behind
   * its ticket gates, platform 2 across the tracks (in-station crossing). */
  station: {
    building: { x0: -64, x1: -38, z0: 148, z1: 155 },
    platforms: { x0: -74, x1: -26, depth: 3.5 },
    stopX: -50,
  },
  /* Quiet zones: no poles, signs or road words.  In the town's own frame,
   * which is built turned north of the road (M2e.3): the hero window (world
   * x -55..30, z -20..24: the forecourt, the road, and behind the store,
   * reaching east because the golden-hour sun throws a pole's shadow 35 m
   * west), and the railway. */
  quiet: [[-55, 3.7, 30, 47.7], [-200, 153, 200, 171]],
  /* Behind the store, the famous views' cone: a 10 m pole clears the roof's
   * sightline only past about 80 m (world z -82), and the frame widens with
   * distance (world |x| < 26 to z -45, < 34 to z -82).  In here the lanes
   * get 4.5 m lamp posts (防犯灯) and no overhead lines. */
  lowPoles: [[-26, 47.7, 26, 72.7], [-34, 72.7, 34, 109.7]],
  /* The Lawson's ground, in the town's frame: no lot is cut here.  The
   * forecourt row along the main road, and the store with its back yard. */
  lawsonReserve: [[-42, 17, 42, 28], [-34, 28, 32, 44]],
  /* The main road's far side, facing the store (world z 20.5-35): a row of
   * frontage lots, all but the photographers' lot (world x -27..32), where
   * the famous views stand. */
  frontRow: { z0: -7.5, z1: 7.3 },
  photoLot: [-32, -7.5, 27, 7.4],
  /* The land (town quality pass), where M2's old town stood: north of the
   * main road, behind the famous views, in the town's frame (north is -z).
   * Rects are [x0, z0, x1, z1]; heights are tops in metres.  world/land/
   * builds it; nothing else is placed here. */
  land: {
    /* Tan's layout (2026-09-27, the town inside their square): turn round at
     * the spawn and past the parking lot the river runs at once, in a sunken
     * channel (河川敷): stone stairs down, lower walks, stepping stones.  The
     * river is the town's edge: the bridge road from the master junction
     * (the main road's zebra, lane x 30) crosses it to the Deer Park gate.
     * 鏡池 moved into the town, by the railway.  Heights in metres; the
     * street is y 0. */
    top: { z0: -11, z1: -7.5 },             // the town-side river walk at street level, railing at z0
    sunk: {                                  // the channel, open to the ground plane's hole (ctx.sink)
      x0: -600, x1: 600, z0: -34, z1: -11,
      walk: -2.4,                            // the lower walks (河川敷), both sides
      revet: 1.2,                            // each masonry revetment's run, top edge to walk
    },
    walks: { town: [-15.4, -12.2], far: [-32.8, -29.6] },   // [z0, z1] of each lower walk
    river: { z0: -29.6, z1: -15.4, water: -2.65, bed: -2.75 },   // 14 m of water, 0.25 m below the walks
    stairs: [                                // x, width, side: stone stairs between top and walk
      { x: 0, w: 3.2, side: 'town' },        // straight behind the spawn
      { x: -64, w: 2.2, side: 'town' },
      { x: 76, w: 2.2, side: 'town' },
      { x: 0, w: 3.2, side: 'far' },
    ],
    stones: { x: 0, top: -2.5 },            // 飛び石 across the water, on the spawn's axis
    riverMirror: [-130, 130],                // the stretch of river (x) that mirrors its banks when you are near (land/channel.js)
    farTop: { z0: -37, z1: -34 },            // the far river walk, railing at z1: the town's edge
    far: [-118, -41, 118, -37],             // what lies past the far walk: a verge, then the tree line
    /* 鏡池, in the town's corner by the railway (the freed east block): a
     * rounded triangle, its long side along the railway, its point toward
     * the lanes that lead in.  Water `water` below the promenade (y 0). */
    pond: {
      corners: [[59, 144], [93, 144], [72, 106]],
      fillets: [9, 8, 9],                   // each corner's rounding (smaller pond, smaller radii)
      water: -0.4, promenade: 4.5,
      box: [54, 100, 97, 152],              // the pond's grounds: sunk, floored and paved by land/pond.js
      gates: [112, 144],                    // the lanes (z) whose ends open into its grounds
    },
    /* the paddies (田んぼ) Tan kept: between the main road's shops and the
     * pond, where lanes z 45 and 80 end at them */
    paddies: { box: [54, 37, 97, 98.5] },
    parking: [-32, -7.5, 27, 7.4],          // the photographers' lot, a parking lot now (= TOWN.photoLot)
    track: { x: 30, w: 5.0, z0: -37, z1: 7.3, top: 0.12 },   // the bridge road: from the master junction to the gate
    bridge: { x: 30, w: 5.4, z0: -34, z1: -11, deck: 0.2 },  // road-level bridge over the whole channel
    hills: { r: [620, 900], span: 1.85 },   // the painted far hills: radii (m) and half-angle (rad) round the town's north
    deerGate: { x: 30, z: -40.6 },          // 鹿公園, coming soon: at the bridge's end, the town's edge
    /* a little waiting bench (縁台) by the gate, in front of the rope, the seat along x: Hachi's bed at the end of the
     * tour (animals/guide.js: he hops up, plays a moment, curls up asleep on it).  Town frame; `seat` is its top (m) */
    gateBench: { x: 28.45, z: -38.5, len: 1.4, depth: 0.44, seat: 0.42 },
  },

};

/* The flat ground plane under everything. */
export const WORLD = {
  groundHalf: 1200,          // flat ground plane, well past the fog
  groundColor: 0xc4c4b6,
  // the town's bounds, turned into the world with it (M2e.3)
  bounds: {
    x0: -TOWN.bounds.x1, x1: -TOWN.bounds.x0,
    z0: 2 * TOWN.grid.main - TOWN.bounds.z1, z1: 2 * TOWN.grid.main - TOWN.bounds.z0,
  },
};

/* ------------------------------------------------------------------ *
 * The town kit (SPEC section 3, M2a): roads, markings, poles and wires,
 * signs.  Widths are metres across the whole road; see world/kit/.
 * ------------------------------------------------------------------ */

/** Road classes.  `asphalt` is the full paved width between kerbs (or
 * between the side gutters on a lane); `walk` is each pavement. */
export const ROADS = {
  lane: { asphalt: 4.6, walk: 0, gutter: 0.36, speed: 30, rank: 0 },
  shopping: { asphalt: 6.0, walk: 2.2, gutter: 0, speed: 30, rank: 1 },   // narrow, but two can pass a pole
  main: { asphalt: 10.0, carriage: 7.0, cycle: 1.5, walk: 2.0, gutter: 0, speed: 40, rank: 2 },
  /* The Lawson's own road (lawson.js builds it; the photo wins over SPEC's
   * width): 6.7 m of asphalt, 3.3 m walk.  The kit only dresses it. */
  hero: { asphalt: 6.7, carriage: 6.7, walk: 3.3, gutter: 0, speed: 40, rank: 2 },
  kerbH: 0.15,      // pavement top above the asphalt
  asphaltY: 0.02,   // asphalt top above the ground plane
};

export const MARKINGS = {
  dash: [3, 3],             // white dashed centreline: paint, gap
  edgeInset: 0.25,          // lane edge lines, in from the gutter
  diamondAhead: [30, 50],   // ◇ before a zebra, metres
  manholeEvery: [14, 26],
  drainEvery: [8, 12],
  gutterLid: 0.6,           // lane gutter lid length
  gratingEvery: 5,          // one lid in N is a grating
  patchesPer100m: 9,
  cracksPer100m: 14,
  petalsPer100m: 7,
  schoolZoneChance: 0.5,
  pedPriorityChance: 0.5,
};

export const POLES = {
  spacing: [20, 30],
  height: [8.8, 10.2],
  transformerEvery: 3,
  lampEvery: 2,
  adChance: 0.45,
  hydrantEvery: 3,          // a 消火栓 plate on one pole in N
  sag: 0.55,
  wireR: 0.022,
  dropR: 0.016,
};

/* Named camera spots for scripts/shots.mjs (SPEC M2 working method).
 *   scene  'town' or 'kit' (the ?kit test street)
 *   hero   stand on a hero view instead of pos/yaw/pitch
 *   looks  LOOKS keys to shoot the spot in
 *   ref    the frame in reference/density/ it is judged against */
export const SHOT_SPOTS = [
  { name: 'hero-1', scene: 'town', hero: 'morning', looks: ['day'], guard: true },
  { name: 'hero-2', scene: 'town', hero: 'golden', looks: ['golden'], guard: true },
  { name: 'hero-3', scene: 'town', hero: 'night', looks: ['blue'], guard: true },
  // M2b: street level round the core
  { name: 'town-spine-north', scene: 'town', pos: [-46.2, 0, 23.5], yaw: 3.1416, pitch: 0.03, looks: ['day', 'golden'], ref: '05-shopping-street-petals.png' },
  { name: 'town-spine-shops', scene: 'town', pos: [-46.6, 0, 62], yaw: 2.2, pitch: 0.02, looks: ['day'], ref: '06-general-store-front.png' },
  { name: 'town-spine-night', scene: 'town', pos: [-46.2, 0, 88], yaw: 3.1416, pitch: 0.04, looks: ['blue'] },
  { name: 'town-main-west', scene: 'town', pos: [-72, 0, 18.8], yaw: -1.5708, pitch: 0.03, looks: ['day'], ref: '02-main-road-van-poles.png' },
  { name: 'town-main-east', scene: 'town', pos: [96, 0, 18.8], yaw: 1.5708, pitch: 0.03, looks: ['golden'], ref: '01-main-road-cycle-lanes.png' },
  { name: 'town-lane-houses', scene: 'town', pos: [52, 0, 79.4], yaw: 1.5708, pitch: 0.04, looks: ['day', 'blue'], ref: '03-street-shrine-house.png' },
  { name: 'town-lane-junction', scene: 'town', pos: [-25.6, 0, 62], yaw: 3.1416, pitch: 0.02, looks: ['day'], ref: '09-konbini-corner-tomare.png' },
  { name: 'town-shrine', scene: 'town', pos: [11, 0, 77.6], yaw: 2.9, pitch: 0.05, looks: ['day'], ref: '04-shrine-pole-ramen.png' },
  // the Inari shrine (experience 3): lot x 6..20, z 82.7..101.5, frontage on lane z 80
  { name: 'shrine-approach', scene: 'town', pos: [13, 0, 77.5], yaw: 3.1416, pitch: 0.09, looks: ['day'] },
  { name: 'shrine-tunnel', scene: 'town', pos: [13, 0, 88.2], yaw: 3.1416, pitch: 0.05, looks: ['day'] },
  { name: 'shrine-hall', scene: 'town', pos: [7.4, 0, 90.7], yaw: -2.35, pitch: 0.13, looks: ['day'] },
  { name: 'shrine-fox', scene: 'town', pos: [13.4, 0, 85.15], yaw: -1.95, pitch: 0.1, looks: ['day'] },
  { name: 'shrine-golden', scene: 'town', pos: [13.1, 0, 92.2], yaw: 0.04, pitch: 0.03, looks: ['golden'] },
  { name: 'shrine-back', scene: 'town', pos: [13.1, 0, 93.3], yaw: 0.04, pitch: 0.02, looks: ['day'] },   // walking out: the donors' names
  { name: 'shrine-night', scene: 'town', pos: [13, 0, 80.9], yaw: 3.1416, pitch: 0.08, looks: ['blue'] },
  { name: 'shrine-overview', scene: 'town', pos: [13, 0, 76], yaw: 3.1416, pitch: -0.75, lift: 16, looks: ['day'] },
  { name: 'town-coin-parking', scene: 'town', pos: [50, 0, 18.6], yaw: 3.1416, pitch: 0.0, looks: ['day'] },   // moved west of the store (M2e.3)
  { name: 'town-apartment', scene: 'town', pos: [28.2, 0, 83], yaw: -2.4, pitch: 0.06, looks: ['day'] },
  { name: 'town-vacant', scene: 'town', pos: [47, 0, 113.6], yaw: 0.35, pitch: 0.0, looks: ['golden'] },
  { name: 'town-park', scene: 'town', pos: [27.5, 0, 110], yaw: 1.9, pitch: 0.04, looks: ['day'], ref: '11-plaza-zebra-sakura.png' },
  { name: 'town-plaza', scene: 'town', pos: [-50, 0, 125.5], yaw: 3.1416, pitch: 0.05, looks: ['day', 'blue'], ref: '12-station-plaza-big-sakura.png' },
  // M2c: the station and the line (`train` stands the service in a moment)
  { name: 'station-plaza-clock', scene: 'town', pos: [-50, 0, 134], yaw: 2.2, pitch: 0.08, looks: ['day'], ref: '13-plaza-clock.png' },
  { name: 'station-entrance', scene: 'town', pos: [-41.8, 0, 136.5], yaw: 2.82, pitch: 0.1, looks: ['day'], ref: '14-station-entrance.png' },
  { name: 'station-gates', scene: 'town', pos: [-46, 0, 151], yaw: 1.9, pitch: 0.05, looks: ['day'], train: 'platform', indoor: true, ref: '15-station-gates.png' },
  { name: 'station-to-platform', scene: 'town', pos: [-50, 0, 148.7], yaw: 3.1416, pitch: 0.02, looks: ['day'], train: 'platform', indoor: true, ref: '16-station-to-platform.png' },
  { name: 'platform-departures', scene: 'town', pos: [-29, 0, 157.2], yaw: 1.5708, pitch: 0.03, looks: ['day'], train: 'platform', ref: '17-platform-departures.png' },
  { name: 'train-at-platform', scene: 'town', pos: [-28, 0, 166.8], yaw: 1.2, pitch: 0.03, looks: ['day', 'blue'], train: 'platform', ref: '18-train-at-platform.png' },
  { name: 'crossing-train', scene: 'town', pos: [-80.6, 0, 150], yaw: 3.1416, pitch: 0.03, looks: ['golden'], train: 'crossing', ref: '19-level-crossing-train.png' },
  { name: 'crossing-fence', scene: 'town', pos: [-78.4, 0, 155.6], yaw: -2.5, pitch: 0.0, looks: ['day'], train: 'approach', ref: '20-level-crossing-fence.png' },
  { name: 'crossing-path', scene: 'town', pos: [-28.5, 0, 156.6], yaw: -2.3, pitch: -0.05, looks: ['day'], ref: '21-crossing-path-fence.png' },
  { name: 'platform-canopy', scene: 'town', pos: [-56, 0, 167.2], yaw: -1.5708, pitch: 0.06, looks: ['day'], train: 'platform', ref: '22-platform-canopy.png' },
  // the station and train experiences (2026-09-28): the concourse, the train's listening spot, the train close up and inside, the Osaka posters
  { name: 'station-concourse', scene: 'town', pos: [-55.6, 0, 148.7], yaw: -1.95, pitch: 0.06, looks: ['day'], train: 'platform', indoor: true, close: true },
  { name: 'train-listen', scene: 'town', pos: [-49.0, 0, 155.2], yaw: 1.67, pitch: -0.1, looks: ['day'], train: 'platform', close: true },
  { name: 'train-front', scene: 'town', pos: [-26.8, 0, 157.4], yaw: 2.24, pitch: 0.02, looks: ['day', 'blue'], train: 'platform', close: true },
  { name: 'train-side', scene: 'town', pos: [-27.4, 0, 157.0], yaw: 1.76, pitch: 0.02, looks: ['day'], train: 'platform', close: true },
  { name: 'train-inside', scene: 'town', pos: [-44.65, 0, 160.75], yaw: 0.62, pitch: -0.04, looks: ['day', 'blue'], train: 'platform', close: true },
  { name: 'train-under', scene: 'town', pos: [-36.5, 0, 157.2], yaw: 2.6, pitch: -0.3, looks: ['day'], train: 'platform', close: true },
  // the entrance blockers and the train's doors (Tan, 2026-09-29): the approach from the foot of the steps, and beside a car with its doors open and shut
  { name: 'station-approach', scene: 'town', pos: [-51, 0, 143.2], yaw: 3.1416, pitch: 0.1, looks: ['day', 'golden'], train: 'platform' },
  { name: 'train-beside-open', scene: 'town', pos: [-45.2, 0, 156.4], yaw: 2.45, pitch: 0.0, looks: ['day', 'blue'], train: 'platform', close: true },
  { name: 'train-beside-shut', scene: 'town', pos: [-45.2, 0, 156.4], yaw: 2.45, pitch: 0.0, looks: ['day'], train: 'platform-shut', close: true },
  { name: 'poster-station', scene: 'town', pos: [-46.3, 0, 150.9], yaw: -0.12, pitch: 0.05, looks: ['day'], train: 'platform', indoor: true, close: true },
  // the three trains (Tan, 2026-09-29): each beside a car (doors open and shut), the front from the platform end, the side from the crossing, the listening spot
  ...['jr', 'poke'].flatMap((t) => [
    { name: `train-${t}-beside-open`, scene: 'town', pos: [-45.2, 0, 156.4], yaw: 2.45, pitch: 0.0, looks: ['day', 'blue'], train: `platform:${t}`, close: true },
    { name: `train-${t}-beside-shut`, scene: 'town', pos: [-45.2, 0, 156.4], yaw: 2.45, pitch: 0.0, looks: ['day', 'golden'], train: `platform-shut:${t}`, close: true },
    { name: `train-${t}-front`, scene: 'town', pos: [-26.8, 0, 157.4], yaw: 2.24, pitch: 0.02, looks: ['day', 'blue'], train: `platform:${t}`, close: true },
    { name: `train-${t}-side`, scene: 'town', pos: [-27.4, 0, 157.0], yaw: 1.76, pitch: 0.02, looks: ['day'], train: `platform:${t}`, close: true },
    { name: `train-${t}-crossing`, scene: 'town', pos: [-80.6, 0, 150], yaw: 3.1416, pitch: 0.03, looks: ['golden'], train: `crossing:${t}` },
    { name: `train-${t}-listen`, scene: 'town', pos: [-49.0, 0, 155.2], yaw: 1.67, pitch: -0.1, looks: ['day'], train: `platform:${t}`, close: true },
    { name: `train-${t}-inside`, scene: 'town', pos: [-44.65, 0, 160.75], yaw: 0.62, pitch: -0.04, looks: ['day', 'blue'], train: `platform:${t}`, close: true },
  ]),
  { name: 'poster-gate', scene: 'town', pos: [27.4, 0, -35.4], yaw: 0.12, pitch: 0.02, looks: ['day'], close: true },
  // M2e: close-ups, at arm's length, where finish shows (no density check)
  { name: 'close-lawson-front', scene: 'town', pos: [3.5, 0, 2.6], yaw: 0.25, pitch: 0.12, looks: ['day'], close: true },
  // the experience highlights (experiences.js): the konbini's and the view's, from the forecourt's edge
  { name: 'close-lawson-highlights', scene: 'town', pos: [3.0, 0, 9.5], yaw: 0.35, pitch: 0.02, looks: ['day', 'blue'], close: true },
  { name: 'close-lawson-side', scene: 'town', pos: [15.5, 0, 3.5], yaw: 0.75, pitch: 0.1, looks: ['day'], close: true },
  { name: 'close-forecourt', scene: 'town', pos: [-5, 0, 7], yaw: 0.35, pitch: -0.42, looks: ['day'], close: true },
  { name: 'close-house-wall', scene: 'town', pos: [60, 0, 77.5], yaw: 1.9, pitch: 0.1, looks: ['day'], close: true },
  // streets & poles (town quality pass): the spine's kerb at arm's length
  { name: 'close-street-spine', scene: 'town', pos: [-45.2, 0, 113.5], yaw: 2.8, pitch: -0.16, looks: ['day'], close: true },
  { name: 'close-street-pole', scene: 'town', pos: [-45.3, 0, 104], yaw: 2.85, pitch: 0.45, looks: ['day'], close: true },
  { name: 'close-street-kerb', scene: 'town', pos: [-46.6, 0, 56], yaw: 2.5, pitch: -0.08, looks: ['day'], close: true },
  // town pass, facades: shopfronts and a house front at arm's length
  { name: 'close-facade-shop', scene: 'town', pos: [-47.4, 0, 60], yaw: 1.9, pitch: 0.12, looks: ['day'], close: true },
  { name: 'close-facade-house', scene: 'town', pos: [-26.2, 0, 63], yaw: -1.5708, pitch: 0.1, looks: ['day'], close: true },
  { name: 'close-green-river', scene: 'town', pos: [12, 0, -35.5], yaw: 0.3, pitch: -0.5, lift: 3.5, looks: ['day'], close: true },
  { name: 'close-green-limb', scene: 'town', pos: [-49, 0, 129.8], yaw: 2.9, pitch: 0.6, looks: ['day', 'blue'], close: true },
  { name: 'close-sakura', scene: 'town', pos: [-50, 0, 128], yaw: 3.1416, pitch: 0.55, looks: ['day'], close: true, ref: '12-station-plaza-big-sakura.png' },
  // M3a: inside the Lawson (world frame; judged against reference/konbini-details.md)
  { name: 'store-door', scene: 'town', pos: [-2.3, 0, -0.6], yaw: 0, pitch: -0.05, looks: ['day'], close: true, frame: 'world' },
  { name: 'store-aisle', scene: 'town', pos: [-2.1, 0, -3.0], yaw: 0, pitch: -0.12, looks: ['day'], close: true, frame: 'world' },
  { name: 'store-cooler', scene: 'town', pos: [-4.4, 0, -10.9], yaw: 0.35, pitch: -0.08, looks: ['day'], close: true, frame: 'world' },
  { name: 'store-counter', scene: 'town', pos: [3.4, 0, -2.2], yaw: -1.2, pitch: -0.1, looks: ['day', 'blue'], close: true, frame: 'world' },
  { name: 'store-onigiri', scene: 'town', pos: [-6.4, 0, -4.9], yaw: 1.35, pitch: -0.3, looks: ['day'], close: true, frame: 'world' },
  { name: 'store-shelf', scene: 'town', pos: [-4.4, 0, -4.5], yaw: 1.5708, pitch: -0.25, looks: ['day'], close: true, frame: 'world' },
  { name: 'store-drinks', scene: 'town', pos: [-2.5, 0, -10.9], yaw: 0.1, pitch: -0.05, looks: ['day'], close: true, frame: 'world' },
  { name: 'store-cooler-doors', scene: 'town', pos: [-4.4, 0, -10.2], yaw: 0, pitch: -0.05, looks: ['day'], close: true, frame: 'world' },
  { name: 'store-icecase', scene: 'town', pos: [5.0, 0, -4.3], yaw: 1.5708, pitch: -0.62, looks: ['day'], close: true, frame: 'world' },
  { name: 'store-selfserve', scene: 'town', pos: [6.2, 0, -9.5], yaw: -1.57, pitch: -0.05, looks: ['day'], close: true, frame: 'world' },
  { name: 'store-back', scene: 'town', pos: [4.9, 0, -2.4], yaw: 0.25, pitch: -0.08, looks: ['day'], close: true, frame: 'world' },
  { name: 'store-baskets', scene: 'town', pos: [-3.3, 0, -2.1], yaw: 2.45, pitch: -0.55, looks: ['day'], close: true, frame: 'world' },
  { name: 'store-left', scene: 'town', pos: [-5.0, 0, -1.4], yaw: 1.0, pitch: -0.1, looks: ['day'], close: true, frame: 'world' },
  { name: 'town-overview', scene: 'town', pos: [0, 0, 95], yaw: 0, pitch: -0.5, lift: 95, looks: ['golden'], frame: 'world' },
  { name: 'town-overview-east', scene: 'town', pos: [150, 0, 80], yaw: -1.5708, pitch: -0.55, lift: 80, looks: ['day'] },
  // the land north of the main road (town pass): paddies, the river, the Deer Park gate
  { name: 'junction', scene: 'town', pos: [-30, 0, 30], yaw: 0, pitch: -0.95, lift: 22, looks: ['day'], frame: 'world' },   // the master junction from above (Tan)
  { name: 'paddy-lane', scene: 'town', pos: [49, 0, 45], yaw: -1.5708, pitch: -0.04, looks: ['day', 'golden'] },   // the paddies from lane z 45's end
  { name: 'paddy-overview', scene: 'town', pos: [40, 0, 68], yaw: -1.5708, pitch: -0.6, lift: 28, looks: ['day'] },
  { name: 'close-paddy', scene: 'town', pos: [53.5, 0, 72], yaw: -1.9, pitch: -0.3, looks: ['day'] },
  { name: 'junction-top', scene: 'town', pos: [-30, 0, 13], yaw: 0, pitch: -1.5, lift: 38, looks: ['day'], frame: 'world' },
  { name: 'junction-east', scene: 'town', pos: [-10, 0, 15.5], yaw: 1.5708, pitch: -0.08, looks: ['day'], frame: 'world' },   // driving west toward it
  { name: 'junction-north', scene: 'town', pos: [-30.5, 0, -8], yaw: 3.1416, pitch: -0.1, looks: ['day'], frame: 'world' },  // coming down lane x 30
  { name: 'junction-south', scene: 'town', pos: [-30, 0, 34], yaw: 0, pitch: -0.1, looks: ['day'], frame: 'world' },          // up the bridge road
  { name: 'junction-tan', scene: 'town', pos: [-24.5, 0, 16.2], yaw: 0.42, pitch: -0.28, looks: ['golden'], frame: 'world' },   // Tan's view from the junction (2026-09-28)
  { name: 'junction-walk', scene: 'town', pos: [-20, 0, 21.5], yaw: 1.3, pitch: -0.15, looks: ['day'], frame: 'world' },     // on the north walk
  { name: 'land-track', scene: 'town', pos: [30, 0, 5], yaw: 0, pitch: 0.02, looks: ['day', 'golden'] },   // the bridge road from the master junction
  { name: 'land-gate', scene: 'town', pos: [30, 0, -35.5], yaw: 0, pitch: 0.04, looks: ['day'] },
  { name: 'land-overview', scene: 'town', pos: [26, 0, 6], yaw: 3.1416, pitch: -0.82, lift: 95, looks: ['day', 'golden'], frame: 'world' },
  // wave 2c: Tan's river you walk down to, and the pond 鏡池
  { name: 'land-spawn-back', scene: 'town', pos: [0, 0, 16.5], yaw: 3.1416, pitch: -0.02, looks: ['day', 'golden'], frame: 'world' },
  // quality pass: Tan's walk from the spawn, turned round, down the stairs to the river (2026-09-28)
  { name: 'qp-walk-1', scene: 'town', pos: [0, 0, 22], yaw: 3.1416, pitch: -0.06, looks: ['day'], frame: 'world' },
  { name: 'qp-walk-2', scene: 'town', pos: [0, 0, 31], yaw: 3.1416, pitch: -0.1, looks: ['day', 'golden'], frame: 'world' },
  { name: 'qp-walk-3', scene: 'town', pos: [0, 0, 37.5], yaw: 3.1416, pitch: -0.22, looks: ['day'], frame: 'world' },
  { name: 'qp-walk-4', scene: 'town', pos: [0.9, 0, 40.2], yaw: 3.1416, pitch: -0.3, looks: ['day', 'golden'], frame: 'world' },
  { name: 'qp-walk-5', scene: 'town', pos: [0, 0, 42.4], yaw: 3.1416, pitch: -0.12, looks: ['day'], frame: 'world' },
  { name: 'qp-walk-6', scene: 'town', pos: [0.5, 0, 42.4], yaw: 2.2, pitch: -0.08, looks: ['day'], frame: 'world' },
  // the ryokan and the old wooden house by the pond (quality pass)
  { name: 'qp-ryokan-lane', scene: 'town', pos: [70, 0, 110], yaw: -1.45, pitch: 0.06, looks: ['day', 'blue'] },        // arriving down the lane
  { name: 'qp-ryokan-gate', scene: 'town', pos: [80.5, 0, 107.5], yaw: -1.5708, pitch: 0.1, looks: ['day', 'golden'] },
  { name: 'qp-ryokan-engawa', scene: 'town', pos: [83, 0, 97.5], yaw: -2.4, pitch: 0.08, looks: ['day'] },             // the paddies' side, from the bench path
  { name: 'qp-kominka', scene: 'town', pos: [82.5, 0, 121], yaw: -1.35, pitch: 0.06, looks: ['day', 'golden'] },
  { name: 'qp-ryokan-back', scene: 'town', pos: [88, 0, 116], yaw: 2.7, pitch: 0.12, looks: ['day'] },
  { name: 'qp-ryokan-over', scene: 'town', pos: [78, 0, 112], yaw: -1.5708, pitch: -0.5, lift: 14, looks: ['day'] },
  { name: 'qp-teahouse-back', scene: 'town', pos: [63, 0, 91.5], yaw: 3.1416, pitch: 0.06, looks: ['day'] },           // from the paddies' path
  { name: 'land-rail', scene: 'town', pos: [4, 0, -9.3], yaw: 0.15, pitch: -0.32, looks: ['day'] },
  { name: 'close-land-stairs', scene: 'town', pos: [0.4, 0, -9.2], yaw: 0, pitch: -0.42, looks: ['day'] },
  // up the river stairs from the lower walk at golden hour (Tan: "it pixelates and acts up"); a and b half a metre apart show the shimmer
  { name: 'qa-stairs-a', scene: 'town', pos: [0.6, 0, -14.2], yaw: 3.1416, pitch: 0.12, looks: ['golden'] },
  { name: 'qa-stairs-b', scene: 'town', pos: [1.1, 0, -14.2], yaw: 3.1416, pitch: 0.12, looks: ['golden'] },
  { name: 'close-land-stones', scene: 'town', pos: [0.3, 0, -13.8], yaw: -0.08, pitch: -0.22, looks: ['day'] },
  { name: 'land-walk', scene: 'town', pos: [-20, 0, -13.6], yaw: -1.5708, pitch: 0.0, looks: ['day', 'golden'] },
  { name: 'close-land-under-bridge', scene: 'town', pos: [21, 0, -13.6], yaw: -1.5708, pitch: 0.04, looks: ['day'] },
  { name: 'close-land-bridge', scene: 'town', pos: [30, 0, -9.3], yaw: 0, pitch: -0.05, looks: ['day'] },
  { name: 'land-river', scene: 'town', pos: [30, 0, -22.5], yaw: 1.5708, pitch: -0.2, looks: ['day', 'golden'] },
  { name: 'land-hills', scene: 'town', pos: [50, 0, -35.5], yaw: 0.2, pitch: 0.05, looks: ['day', 'blue'] },
  { name: 'pond-bench', scene: 'town', pos: [66, 0, 116.3], yaw: -2.59, pitch: -0.1, looks: ['day', 'golden', 'blue'] },
  { name: 'pond-fuji', scene: 'town', pos: [72, 0, 102.5], yaw: -3.03, pitch: 0.08, looks: ['day', 'golden'] },
  { name: 'pond-lotus', scene: 'town', pos: [92, 0, 134], yaw: 2.19, pitch: -0.35, looks: ['day'] },
  { name: 'pond-teahouse', scene: 'town', pos: [62, 0, 112], yaw: 0.165, pitch: 0.05, looks: ['day', 'blue'] },
  { name: 'pond-overview', scene: 'town', pos: [76, 0, 88], yaw: 3.1416, pitch: -0.55, lift: 30, looks: ['day'] },
  // ひと休み, the slow-life bench where the paddies meet 鏡池 (world/land/slowlife.js)
  { name: 'slowlife-spot', scene: 'town', pos: [71.6, 0, 108.2], yaw: -0.4, pitch: 0.04, looks: ['day', 'golden'] },
  { name: 'slowlife-seated', scene: 'town', pos: [73.0, 0, 102.24], yaw: 3.13, pitch: 0.11, lift: -0.48, looks: ['golden', 'day'] },
  { name: 'slowlife-wide', scene: 'town', pos: [53.5, 0, 80.2], yaw: -2.43, pitch: -0.02, looks: ['golden', 'day'] },
  { name: 'pond-rail', scene: 'town', pos: [76, 0, 148.5], yaw: 0.06, pitch: -0.05, looks: ['day', 'golden'] },   // from the railway bank, back across the water to the town
  // wave 3: the animals, close up and in their places
  { name: 'close-animals-turtles', scene: 'town', pos: [66.5, 0, 118.5], yaw: -2.06, pitch: -0.42, looks: ['day'], close: true },
  { name: 'animals-pond-ducks', scene: 'town', pos: [64, 0, 128], yaw: -2.03, pitch: -0.22, looks: ['day', 'golden'], close: true },
  { name: 'animals-river-heron', scene: 'town', pos: [-29.5, 0, -13.5], yaw: 1.24, pitch: -0.1, looks: ['day', 'golden'], close: true },
  { name: 'close-animals-heron', scene: 'town', pos: [-30, 0, -13.5], yaw: 0.859, pitch: -0.15, looks: ['day', 'golden'], close: true },
  { name: 'animals-river-egrets', scene: 'town', pos: [54, 0, -13.8], yaw: -0.26, pitch: -0.12, looks: ['day'], close: true },
  { name: 'close-animals-egret', scene: 'town', pos: [57, 0, -31], yaw: -2.73, pitch: -0.3, looks: ['day'], close: true },
  { name: 'animals-plaza-pigeons', scene: 'town', pos: [-51.2, 0, 127.6], yaw: 3.0, pitch: -0.22, looks: ['day'], close: true },
  { name: 'close-animals-pigeon', scene: 'town', pos: [-50.6, 0, 129.6], yaw: 3.3, pitch: -0.55, looks: ['day'], close: true },
  { name: 'animals-spine-pigeons', scene: 'town', pos: [-47.6, 0, 100.2], yaw: 2.4, pitch: -0.3, looks: ['day'], close: true },
  { name: 'hachi-home', scene: 'town', pos: [-80, 0, 168.6], yaw: 3.1416, pitch: -0.12, looks: ['day', 'golden', 'blue'], close: true },          // Hachi's own garden, from the crossing
  { name: 'close-hachi-home', scene: 'town', pos: [-80.6, 0, 174.2], yaw: 3.59, pitch: -0.32, looks: ['day', 'golden'], close: true },   // his kennel, mat and toys
  { name: 'animals-butterflies', scene: 'town', pos: [-6, 0, -13.8], yaw: 1.5708, pitch: -0.3, looks: ['day'], close: true },
  { name: 'animals-pond-koi', scene: 'town', pos: [77.4, 0, 113.8], yaw: 2.19, pitch: -0.62, looks: ['day'], close: true },
  // the discount megastore (ドンペン堂, experiences): its front across the spine, the packed entrance, the mascot, night, the approach
  { name: 'donki-front', scene: 'town', pos: [-46.3, 0, 53.5], yaw: 2.45, pitch: 0.24, looks: ['day'] },
  { name: 'donki-entrance', scene: 'town', pos: [-53.3, 0, 66.4], yaw: 1.5708, pitch: 0.1, looks: ['day'] },
  { name: 'donki-mascot', scene: 'town', pos: [-49.5, 0, 67.3], yaw: 1.855, pitch: 0.55, looks: ['day'] },
  { name: 'donki-night', scene: 'town', pos: [-45.2, 0, 62.5], yaw: 1.95, pitch: 0.16, looks: ['blue'] },
  { name: 'donki-goods', scene: 'town', pos: [-53.3, 0, 75.4], yaw: 0.72, pitch: -0.06, looks: ['day', 'golden', 'blue'] },
  { name: 'donki-street', scene: 'town', pos: [-47.6, 0, 38], yaw: 3.0, pitch: 0.06, looks: ['day', 'golden'] },
  // Han and the RX-7 (world/han/): the car park's bay by the bridge road
  { name: 'han-wide', scene: 'town', pos: [0, 0, 16.5], yaw: 1.85, pitch: -0.03, looks: ['golden'], frame: 'world' },      // from the spawn, turned round
  { name: 'han-top', scene: 'town', pos: [-24, 0, 19], yaw: 3.1416, pitch: -1.1, lift: 14, looks: ['day'], frame: 'world' },
  { name: 'han-car', scene: 'town', pos: [19.0, 0, 6.8], yaw: -0.93, pitch: -0.12, looks: ['day', 'golden'] },          // the car and Han at 3 m
  { name: 'han-close', scene: 'town', pos: [20.7, 0, 3.2], yaw: -2.24, pitch: -0.06, looks: ['day'] },                  // Han at 1.5 m
  { name: 'han-face', scene: 'town', pos: [21.15, 0, 3.55], yaw: -2.17, pitch: -0.1, looks: ['day'] },                  // his face, close
  { name: 'han-head', scene: 'town', pos: [22.25, 0, 3.96], yaw: -1.5, pitch: -0.05, looks: ['day', 'golden', 'blue'] },   // head and shoulders at 0.8 m (the portrait check)
  { name: 'han-front', scene: 'town', pos: [25, 0, 11], yaw: 0.315, pitch: -0.1, looks: ['day'] },                      // the car's nose, from the walk
  { name: 'han-side', scene: 'town', pos: [17.6, 0, 4.7], yaw: -1.5708, pitch: -0.06, looks: ['day'] },                // the profile at 5 m
  { name: 'han-front34', scene: 'town', pos: [19.4, 0, 9.0], yaw: -0.72, pitch: -0.1, looks: ['day'] },                 // front three-quarter at 5.5 m
  { name: 'han-rear', scene: 'town', pos: [20.0, 0, -1.0], yaw: -2.66, pitch: -0.08, looks: ['day'] },                  // its tail, from the aisle
  { name: 'han-drift-mid', scene: 'town', pos: [20.5, 0, 4.2], yaw: -2.97, pitch: -0.08, looks: ['day'], train: 'han:10.0' },   // mid-slide over the forecourt's mouth, from the spot
  { name: 'han-out', scene: 'town', pos: [20.5, 0, 4.2], yaw: -1.20, pitch: -0.05, looks: ['day'], train: 'han:7.0' },         // out of the car park's mouth onto the bridge road
  { name: 'han-flick', scene: 'town', pos: [20.5, 0, 4.2], yaw: -2.55, pitch: -0.04, looks: ['day'], train: 'han:8.85' },        // the handbrake, the tail stepping out in the master junction
  { name: 'han-getin', scene: 'town', pos: [20.2, 0, 6.2], yaw: -1.0, pitch: -0.1, looks: ['day'], train: 'han:2.0' },              // the door open, Han getting in
  // the guide pup (animals/guide.js), staged in a pose `kind@metres` in front of the lens on the far pavement (world frame):
  // at eye height looking down (how you see it beside you), following it from behind, and at pup height
  { name: 'guide-trot', scene: 'town', frame: 'world', pos: [7.5, 0, 19.0], yaw: 1.5708, pitch: -0.72, looks: ['day', 'golden'], guide: 'trot@1.7' },
  { name: 'guide-look', scene: 'town', frame: 'world', pos: [7.5, 0, 19.0], yaw: 1.5708, pitch: -0.72, looks: ['day'], guide: 'look@1.7' },
  { name: 'guide-sit', scene: 'town', frame: 'world', pos: [7.5, 0, 19.0], yaw: 1.5708, pitch: -0.8, looks: ['day', 'blue'], guide: 'sit@1.5' },
  { name: 'guide-tilt', scene: 'town', frame: 'world', pos: [7.5, 0, 19.0], yaw: 1.5708, pitch: -0.84, looks: ['golden'], guide: 'tilt@1.4' },
  { name: 'guide-lie', scene: 'town', frame: 'world', pos: [7.5, 0, 19.0], yaw: 1.5708, pitch: -0.86, looks: ['day'], guide: 'lie@1.5' },
  { name: 'guide-nap', scene: 'town', frame: 'world', pos: [7.5, 0, 19.0], yaw: 1.5708, pitch: -0.86, looks: ['day'], guide: 'nap@1.5' },
  { name: 'guide-bow', scene: 'town', frame: 'world', pos: [7.5, 0, 19.0], yaw: 1.5708, pitch: -0.82, looks: ['day', 'golden'], guide: 'bow@1.5' },
  { name: 'guide-roll', scene: 'town', frame: 'world', pos: [7.5, 0, 19.0], yaw: 1.5708, pitch: -0.88, looks: ['day', 'golden'], guide: 'roll@1.4' },
  { name: 'guide-hop', scene: 'town', frame: 'world', pos: [7.5, 0, 19.0], yaw: 1.5708, pitch: -0.7, looks: ['day'], guide: 'hop@1.6' },
  { name: 'guide-zoom', scene: 'town', frame: 'world', pos: [7.5, 0, 19.0], yaw: 1.5708, pitch: -0.6, looks: ['golden'], guide: 'zoom@2.2' },
  { name: 'guide-chase', scene: 'town', frame: 'world', pos: [7.5, 0, 19.0], yaw: 1.5708, pitch: -0.54, looks: ['day'], guide: 'chase@2.6' },
  { name: 'guide-follow', scene: 'town', frame: 'world', pos: [7.5, 0, 19.0], yaw: 1.5708, pitch: -0.44, looks: ['day', 'golden'], guide: 'behind@3.2' },        // following it, as you mostly do
  { name: 'guide-low', scene: 'town', frame: 'world', pos: [7.0, 0, 19.0], yaw: 1.5708, pitch: 0.02, lift: -1.32, looks: ['day', 'golden'], guide: 'stand@1.4' },   // at pup height
  { name: 'guide-low-sit', scene: 'town', frame: 'world', pos: [7.0, 0, 19.0], yaw: 1.5708, pitch: 0.04, lift: -1.3, looks: ['day', 'blue'], guide: 'sit@1.3' },
  { name: 'guide-low-side', scene: 'town', frame: 'world', pos: [7.0, 0, 19.0], yaw: 1.5708, pitch: 0.02, lift: -1.32, looks: ['day', 'golden'], guide: 'side@1.6' },     // mid-stride, from the side
  { name: 'guide-low-behind', scene: 'town', frame: 'world', pos: [7.0, 0, 19.0], yaw: 1.5708, pitch: 0.0, lift: -1.25, looks: ['day'], guide: 'behind@1.6' },          // trotting away
  { name: 'guide-low-bow', scene: 'town', frame: 'world', pos: [7.0, 0, 19.0], yaw: 1.5708, pitch: 0.06, lift: -1.34, looks: ['golden'], guide: 'bow@1.4' },
  { name: 'guide-low-roll', scene: 'town', frame: 'world', pos: [7.0, 0, 19.0], yaw: 1.5708, pitch: 0.12, lift: -1.3, looks: ['day'], guide: 'roll@1.9' },
  { name: 'guide-low-tail', scene: 'town', frame: 'world', pos: [7.0, 0, 19.0], yaw: 1.5708, pitch: 0.04, lift: -1.32, looks: ['day'], guide: 'tail@1.5' },
  { name: 'guide-low-lie', scene: 'town', frame: 'world', pos: [7.0, 0, 19.0], yaw: 1.5708, pitch: 0.1, lift: -1.34, looks: ['blue'], guide: 'lie@1.9' },
  // Hachi on the town tour (ANIMALS.guide.tour): the shopping street, the level crossing, the bridge, the station's front steps, the gate
  { name: 'tour-shopping', scene: 'town', frame: 'world', pos: [50.5, 0, -30], yaw: 0, pitch: -0.2, looks: ['day', 'golden'], guide: 'behind@3.4' },
  { name: 'tour-crossing', scene: 'town', frame: 'world', pos: [80, 0, -121], yaw: 0, pitch: -0.18, looks: ['day'], guide: 'look@3.2' },
  { name: 'tour-bridge', scene: 'town', frame: 'world', pos: [-30, 0, 38], yaw: 3.1416, pitch: -0.2, looks: ['day', 'golden'], guide: 'behind@3.4' },
  { name: 'tour-stairs', scene: 'town', frame: 'world', pos: [51, 0, -110.5], yaw: 0, pitch: -0.22, looks: ['day'], guide: 'behind@6.6' },
  { name: 'tour-gate', scene: 'town', frame: 'world', pos: [-30, 0, 58], yaw: 3.1416, pitch: -0.2, looks: ['golden'], guide: 'look@3.2' },

  { name: 'kit-main-road', scene: 'kit', pos: [-54, 0, -1.6], yaw: -1.5708, pitch: 0.02, looks: ['day', 'golden'], ref: '01-main-road-cycle-lanes.png' },
  { name: 'kit-lane-poles', scene: 'kit', pos: [31, 0, -6], yaw: 0, pitch: 0.06, looks: ['day'], ref: '03-street-shrine-house.png' },
  { name: 'kit-junction', scene: 'kit', pos: [-21, 0, -27], yaw: 3.1416, pitch: -0.02, looks: ['day'], ref: '09-konbini-corner-tomare.png' },
  { name: 'kit-zebra-cycle', scene: 'kit', pos: [-4, 0, -5.6], yaw: -1.4, pitch: -0.04, looks: ['day'], ref: '07-florist-konbini-cycle-lane.png' },
  { name: 'kit-bus-stop', scene: 'kit', pos: [40, 0, -6.1], yaw: -1.62, pitch: -0.03, looks: ['golden'], ref: '10-bus-stop-road.png' },
  { name: 'kit-lane-signs', scene: 'kit', pos: [-6, 0, -35.5], yaw: -1.5708, pitch: 0.03, looks: ['day', 'blue'], ref: '02-main-road-van-poles.png' },
  { name: 'kit-overview', scene: 'kit', pos: [0, 0, 70], yaw: 0, pitch: -0.5, lift: 60, looks: ['golden'] },
];

/* Town spots are authored in the town's own frame (built turned, M2e.3):
 * everything but the famous views and the Lawson close-ups, and anything
 * marked `frame: 'world'`.  __shot turns them into the world. */
for (const s of SHOT_SPOTS) {
  if (s.scene === 'town' && !s.hero && !s.name.startsWith('close-lawson') && !s.frame) s.frame = 'core';
}

/* The places worth walking to: the town map's icons and labels (map 2.0:
 * only where there is something to do or see; Tan, 2026-09-28).  `at` is in
 * the town's own frame unless `frame: 'world'`; placeAt() gives world.
 * `kind` picks the pictogram (ui/map/icons.js); the label is
 * STRINGS.map.places[id].  `exp`: the experience it belongs to (its diamond
 * sits on the icon as a badge). */
export const PLACES = [
  { id: 'lawson', kind: 'konbini', at: [0, -5], frame: 'world', exp: 'konbini' },
  { id: 'start', kind: 'view', at: [0, 16.5], frame: 'world', exp: 'view' },   // the map draws it at HERO_VIEWS.morning.play.pos
  { id: 'han', kind: 'car', at: [24.15, 4.7], exp: 'han' },                    // the RX-7 in its bay (han/index.js HAN_BAY)
  { id: 'mochi', kind: 'mochi', at: [39.2, 22.0], frame: 'world', exp: 'mochi' },   // ぺったん堂's mortar (MOCHI)
  { id: 'spine', kind: 'shops', at: [-50, 100] },
  { id: 'donpen', kind: 'mega', at: [-62.3, 67.1], exp: 'donki' },            // ドンペン堂's lot (town-plan.js SPECIALS)
  { id: 'shrine', kind: 'shrine', at: [13, 88], exp: 'shrine' },
  { id: 'plaza', kind: 'plaza', at: [-52.5, 137] },
  { id: 'station', kind: 'station', at: [-51, 151.5], exp: 'station' },
  { id: 'crossing', kind: 'crossing', at: [-80, 162], exp: 'crossing' },
  { id: 'hachiHome', kind: 'paw', at: [-78.4, 176.6] },                       // Hachi's own garden (TOWN.hachiHome)
  { id: 'pond', kind: 'pond', at: [75, 128] },
  { id: 'slowlife', kind: 'bench', at: [73, 102.2], exp: 'slowlife' },        // SLOWLIFE.bench
  { id: 'river', kind: 'river', at: [-10, -22] },
  { id: 'deerGate', kind: 'deer', at: [30, -40.6] },
];
/** A place's world position (x, z). */
export function placeAt(p) {
  const [x, z] = p.at;
  return p.frame === 'world' ? { x, z } : { x: -x, z: 2 * TOWN.grid.main - z };
}

/* Dropped kerbs (town quality pass, Tan: how does a car get into the car
 * park?): where cars cross a main-road walk into a car park, as world x
 * ranges.  The walk stays, lowered, with a ramp each side; the road's edge
 * line runs on across it.  `far`: the walk on the spawn's side
 * (lawson.js), the monthly car park's way in (land/parking.js); `north`:
 * the store's side (town-edge.js), the coin parking's (kit/specials.js). */
export const DRIVEWAYS = {
  far: [[26.2, 31.4]],
  north: [[-56.8, -51.6]],
  ramp: 0.8,      // each side, from the kerb's height down to `drop`
  drop: 0.04,     // the lowered walk's top
  zebraBand: 0.9, // at a zebra only this much of the walk drops, from the kerb (shop fronts and the guide line keep their level)
};

/** Where the main road's north walk breaks for the town's roads that meet it (world x). */
export function mainRoadGaps() {
  // on the north walk, in world x: the town is built turned, so its x runs west
  return TOWN.grid.ns
    .filter((r) => r.z0 === undefined || r.z0 < TOWN.grid.main)   // lanes that meet the road, or cross it
    .map((r) => [-r.x - ROADS[r.cls].asphalt / 2, -r.x + ROADS[r.cls].asphalt / 2]);
}

/* ひと休み, the slow-life spot (Tan's experiences; world/land/slowlife.js),
 * in the town's frame.  [x, z, ry] for the pieces; the view is where the
 * seated eye looks (town-frame yaw, pitch, eye height above the ground). */
export const SLOWLIFE = {
  bench: [73.0, 102.2, -0.08],
  tree: [75.9, 105.2, 1.55],                // the sakura: x, z, scale
  jizo: [71.15, 102.1, 0.3],
  lantern: [74.3, 109.3, 0.2],
  view: { yaw: 3.13, pitch: 0.11, eye: 1.12 },
  sound: { near: 5, far: 22, level: 0.45, seated: 0.62 },
  near: 50,                                  // the petals, butterflies and glints move only this close
  slowTo: 0.35,                              // time's pace while you sit
  petals: { count: 36, at: [73, 105], half: [5, 3.5], top: 4.2 },
  butterflies: { count: 2, at: [73.2, 105.2], size: 1.5, beatHz: 5 },
  glints: { count: 34, box: [60, 115, 88, 140] },
};

/* ぺったん堂 / PETTAN-DO (world/mochi/): the mochi-pounding shop on the main road's far side, opposite the shopping
 * street's mouth: three moon rabbits at a stone mortar (a homage to Kyoto's high-speed mochi pounders; no real name,
 * mark or person).  `lot`: the generated lot it takes, in the town's frame (matched by rect after cutLots in
 * town-core.js, so no other lot moves).  Everything else is in the lot's own frame, metres: x along the frontage
 * (+x is the world's -x, toward the monthly car park), z out toward the main road from the frontage line (the
 * pavement's edge), so the stage is z -`setback`..0 and the shop stands behind it. */
export const MOCHI = {
  id: 'mochi_ichigo',                        // data/catalog.js STREET
  lot: [-44.6, -6.9, -33.9, 7.1],
  setback: 3.0,
  usu: [0.05, -1.4],                         // the mortar: world (39.2, 22.0)
  spot: [0.05, 1.2, 1.2],                    // the engagement's ring on the pavement: x, z, radius: world (39.2, 19.4)
  stand: [-1.95, -0.5],                      // the display table: the day's mochi on their tray, the price, the dogs' jar
  counter: [-0.29, 0.2],                     // the order stand at the stage's edge: the card reader, the plate yours is served on
  hachi: [0.62, -0.45],                      // where Hachi sits to watch: before the mortar, on your right
  near: 9,                                   // within this of the mortar the rabbits peek at you over the counter (m)
  live: 26,                                  // their ears twitch within this; beyond it only the steamer steams
  hide: 60,                                  // and beyond this nothing of the shop's is drawn or moved
  rest: 4,                                   // s after they have gone back in before the ring offers another
  gain: 0.75,
  /* The show is one 13 s recording (scripts/audio-cuts.json mochi-pound; Tan's assets/audio/mochimochi.mp3) and the
   * rabbits move to it by this table: seconds into the file, read from the AUDIO clock (core/sound.js: the one-shot's
   * `pos()`), never frame time.  Keyed by hand from an offline analysis of the file (band envelopes: the mallet's
   * thud is a broadband crack with a 35-110 Hz body about every 1.6 s; between thuds the chant falls on a 0.4 s
   * pulse, read from the 250-1800 Hz and 3.5-9 kHz onsets; docs/decisions/mochi.md):
   *   hit    the mallet lands (the two pounders take turns)        turn   the turner's paw darts in, folds the dough
   *   shout  a call on the pulse: ears bob, the next mallet lifts  big    the long cheer: everyone jumps
   * `sync`: seconds added to the audio clock before the table is read (+ if the picture runs late on a machine). */
  sync: 0.03,
  len: 12.98,
  cues: [
    { t: 0.05, kind: 'shout' }, { t: 0.55, kind: 'shout' },
    { t: 1.01, kind: 'hit' }, { t: 1.41, kind: 'turn' }, { t: 1.83, kind: 'shout' }, { t: 2.21, kind: 'turn' },
    { t: 2.67, kind: 'hit' }, { t: 3.04, kind: 'turn' }, { t: 3.44, kind: 'shout' }, { t: 3.83, kind: 'turn' },
    { t: 4.28, kind: 'hit' }, { t: 4.67, kind: 'turn' }, { t: 5.03, kind: 'shout' }, { t: 5.42, kind: 'turn' },
    { t: 5.87, kind: 'hit' }, { t: 6.23, kind: 'turn' }, { t: 6.64, kind: 'shout' }, { t: 7.04, kind: 'turn' },
    { t: 7.47, kind: 'hit' }, { t: 7.90, kind: 'turn' }, { t: 8.24, kind: 'shout' }, { t: 8.67, kind: 'turn' },
    { t: 9.06, kind: 'hit' }, { t: 9.44, kind: 'turn' }, { t: 9.85, kind: 'shout' }, { t: 10.33, kind: 'turn' },
    { t: 10.66, kind: 'hit' }, { t: 10.86, kind: 'big' }, { t: 11.83, kind: 'turn' },
    { t: 12.29, kind: 'hit' }, { t: 12.54, kind: 'shout' },
  ],
  /* An order (E on the ring; Tan, 2026-10-02): nothing plays until you order.  You are walked to the order stand
   * (`at`, the lot's frame; `walk` m/s), your IC card comes up (`card` s from the key, held to be seen), taps the
   * reader (`tap`: the ka-ching) and goes away (`away`: the hand down); the three hop out one by one (`enter` after the
   * key, `stagger` apart, `hop` s a hop) and bow; the recording plays, the rabbits to its cue table; the finale
   * (`finale` s: the fresh mochi held up, the bow); a pounder takes Hachi his dried sweet potato if he is watching
   * (`feed` s, your eyes eased to them); the turner brings yours to the plate (`serve` s; `take`: your hand has it;
   * `eat`: store/eat.js eats it); they wave, bow and hop back in (`bye` s before the first leaves). */
  order: { at: [-0.12, 0.9], back: 1.75, side: 0.5, walk: 1.5, card: 0.6, tap: 1.55, away: 2.15, enter: 2.3, stagger: 0.8, hop: 0.29, finale: 2.4, feed: 3.0, serve: 2.2, take: 2.9, eat: 3.35, bye: 1.9 },
};

/* Local sounds (SPEC section 9): anything that belongs to a place is heard
 * only as you near that place, never across town.  `near`: full volume
 * within this many metres; `far`: silent (and not playing at all) beyond it.
 * The fade between is an ease, so a sound arrives as you approach rather
 * than switching on. */
export const SOUND = {
  storeInside: 1.15,   // the store's bed, music and hum while you are in it (Tan: +15%, 2026-09-28)
  /* Golden hour's crows (Tan 2026-09-28: "a million crows cawing right next
   * to me").  Not the recording's chorus looped any more: now and then a
   * single caw cut out of it (`calls`: its loudest caws, seconds into
   * crows.m4a, heard from `before` to `after` around each), from somewhere
   * `dist` metres off, high up and dulled by the distance.  One every
   * `every` seconds, sometimes (`pair`) answered by a second. */
  crows: { calls: [2.72, 4.32, 9.34, 10.28, 17.9, 22.96], before: 0.25, after: 0.6, every: [9, 20], pair: 0.35, level: 0.13, dist: [55, 95], lowpass: 2600 },
  crossingBells: { near: 10, far: 45 },    // the crossing, the plaza's south edge, the platforms' west end
  doorChime: { near: 5, far: 28 },         // the platform, the gates
  // the store (M4): its chime and door carry across the forecourt to the famous view, no further
  storeChime: { near: 3, far: 22 },         // from a speaker just inside the door: fades as you walk away
  // each zebra's piyo-piyo while its walk light is green: carried down the
  // street, so you hear it as you come up to the crossing, never only on top of it
  /* Each crossing's call reaches the street it is on, and no further: the
   * crossings are about 55 m apart at the closest, so from the famous view
   * you hear the main road's alone, never two at once (M4, Tan). */
  walkSignal: { near: 14, far: 40 },
  /* the station's announcements (a thing to hear): full within the `core`
   * (the concourse, the gates, the platforms), then an `edge` carried over
   * the plaza and the approach, gone by `far`.  Tan, 2026-09-29: "In the
   * station plaza, announcements can be even louder than earlier" (they
   * were a third there, and lost under the plaza's own sounds: the plaza
   * runs 6-36 m from the zone's middle); `duck`: dimmed to this while you
   * stand in the train's listening spot, for the next-stop announcement */
  station: { near: 20, far: 62, edge: 0.75, core: { near: 8, far: 20 }, level: 0.45, duck: 0.3 },
  // the train's next-stop announcement, played where you stand on platform 1's listening spot
  trainListen: { near: 4, far: 14 },
  /* Han's song (han-drift): fetched and decoded as you come within `preload` m of the car, so the show starts on
   * the song; stepped in before it is ready, the show waits for it up to `wait` s (QA-014) */
  hanSong: { preload: 40, wait: 3 },
  /* Tan's song on the start and pause cards: its level, the game's own sound under it (`duck`), fades (s) */
  menu: { level: 0.3, duck: 0, fadeIn: 1.2, fadeOut: 1.5 },   // (the song is mastered loud: rms 0.22, the store music 0.05; duck 0: paused, the game is silent under it, as it stands still)
  autoDoor: { near: 4, far: 18 },
  fridge: { near: 2.5, far: 9 },           // the cooler: its doors and its compressor
  shelf: { near: 3, far: 10 },             // taking it off the shelf
  mochi: { near: 7, far: 26 },             // ぺったん堂's pounding and chant (MOCHI): the stage and the pavement by it; silent at the famous view (40 m off) and down the shopping street
};

/* The sound labels (ui/soundLabels.js; Tan, 2026-10-01): top left, a sound's name as you come near it.  Shown for
 * `ms`; a name at most once per `cooldown` s; "near" is this far (0..1) from a sound's near to its far; at most `max`
 * at once.  `once`: named once a visit (the beds of the time of day: nowhere to walk up to).  `ambient` (s): a bed
 * `bed` s after its time of day begins, the wind after `wind` s of play, neither within `quiet` s of another label. */
export const SOUND_LABELS = {
  ms: 5600, cooldown: 45, near: 0.55, shot: 0.85, max: 2,
  once: ['wind', 'birds', 'night-insects', 'crows'],
  ambient: { bed: 14, wind: 75, quiet: 9 },
};

/* The animals (town pass, wave 3; src/world/animals/).  Distances in metres,
 * times in seconds.  Everything moves only within `near` of the camera. */
export const ANIMALS = {
  near: 60,
  koi: { count: 11, watchReach: 3.2, gather: 16, surfaceTime: 3.6 },
  /* pond sliders on basking stones in 鏡池: [x, z, width, depth, height above the water, yaw] */
  turtles: { count: 5, flee: 5.5, back: 14, stones: [[71.2, 121.0, 1.15, 0.8, 0.2, 0.25], [71.95, 120.45, 0.5, 0.42, 0.09, 1.1], [70.6, 121.45, 0.34, 0.3, 0.05, 0.4], [77.0, 137, 1.0, 0.85, 0.16, 1.2], [77.6, 136.3, 0.45, 0.4, 0.07, 0.3]] },
  ducks: { shy: 3.2 },
  /* the waders: flee within `flee`, fly a hop of [min, max] metres at `flySpeed`, `cruise` above the water */
  heron: { flee: 7, hop: [25, 70], flySpeed: 3.6, cruise: 2.0, beatHz: 2.1, beatAmp: 0.6, walkChance: 0.12, walkSpeed: 0.12, stepAngle: 0.32 },
  /* (the shiba's kennel stands in Hachi's own garden now: TOWN.hachiHome, animals/home.js) */
  /* the guide (animals/guide.js): the shiba that leads you to the engagements one at a time */
  guide: {
    size: 1.0,                                // (the pup is built at its own size: ~24 cm at the shoulder)
    home: [4.6, 19.3],                        // world: the far pavement behind the famous view, out of every hero frame
    /* leading (Tan, 2026-09-29: "a little annoying to slowly follow the dog"): it jogs `jog` m/s (quicker than your walk,
     * 2.55), keeps `lead` [min, max] m ahead of you along the way, and past the max stops and looks back for you;
     * you running, it runs */
    lead: [4, 9], jog: 3.6,
    trot: 2.4, run: 5.4,                      // m/s (you walk at 2.55, run at 5.1: it can always catch you)
    waitSit: 3,                               // stands waiting this long, then sits
    trainCheer: 3,                            // s of happy wag when the train's doors open after waiting for it with you (QA-010)
    /* "not interested" (the pup suggests, you decide): your heading more than `angle` degrees off its way for
     * `angleT` s, your distance to the spot grown by `grow` m while it waits, or you `away` m off (it leads from up to 9
     * m ahead): it stops and waits
     * where it is (Tan, 2026-09-29: a guide, not a follower).  Walk back within `rejoin` m and it takes you on where it
     * left off; F calls
     * it to you, and it rushes you to the nearest place you haven't been (one you walked away from counts `skipped` m
     * further off). */
    drop: { angle: 100, angleT: 1.7, grow: 6, away: 16, rejoin: 4, skipped: 30, near: 25 },   // (`near`: whistled with the tour under way, it is the tour's next stop unless you stand within this of another place not had)
    zoom: { r: 1.5, speed: 4.6 },             // zoomies: the circle's radius and speed
    tripEvery: 45,                            // trips over its own paws about once in this many seconds at a trot
    fields: 6,                                // distance fields kept grown at once (2.6 MB each)
    introCard: 7,                             // the "Hi, I'm Hachi" caption stays this long (s: two lines, the whistle's key)
    /* the hello, every start: `after` s into play (Tan: a look at the view first) it runs to `d` m in front of you and sits `hold` s; your view eases
     * down to it meanwhile (main.js watchPup: `follow` 1/s, the pitch no lower than `pitchMin`) and back after */
    intro: { after: 4, d: 3.2, hold: 5.5, follow: 3, pitchMin: -0.55, above: 0.18 },   // (`above`: the view aims this much over it: it sits in the lower third, the store still in the frame)
    /* F: it answers `answer` s after the whistle starts (the whistle is 0.52 s long).  Within `runFrom` m of you (and
     * `reach` m by the way) it runs from where it really is, by the way, at a `sprint` m/s while far, the bounding
     * `gallop` m/s for the last ten metres: behind you, it comes from behind (Tan, QA: it used to be set on a street in
     * front of you and run in from out of nowhere, having just been behind you).  Farther, or with no way from there, it
     * is set on its own way to you, `hide` [min, max] m off by the way, where you can't see it (more than `view` degrees
     * off your lens, or round a corner), and runs in from there.  It stops `near` m from you and greets you (a skid, a
     * spin, two bounces, a sit and a head tilt).  `grow`: how far the way to you is grown over the whistle's notes, in
     * pavement metres (a road crossed off a zebra counts ~20 a metre: 80 m by the way round the store is ~250). */
    whistle: { far: 80, near: 4.2, answer: 0.85, gallop: 4.4, sprint: 8.5, runFrom: 60, reach: 80, hide: [14, 45], view: 62, grow: 320 },   // (`near`: nearer than ~4 m a 24 cm pup is under the bottom of your view)
    /* its reactions in play (animals/reactions.js; Tan, 2026-10-01).  `look`: you stand looking at it within [degrees]
     * of the middle of your view for [s]: a head tilt, then not again for [s] to twice that; `bored`: a yawn after this
     * long kept waiting (then a slow blink, a yawn...); `petal`: a petal lands on its nose every [min, max] s of waiting;
     * `strut`: a proud strut every [min, max] s of leading you; the crossing's bells starting within `bells` m, or the
     * RX-7 passing within `car` m at over `carSpeed` m/s: a startle (not again for `again` s) */
    react: { look: [10, 1.1, 9], bored: 9, petal: [22, 50], strut: [14, 30], bells: 24, car: 10, carSpeed: 5, again: 45 },
    /* the pigeons (Tan: "he does zoomies through the pigeons and scatters them"): leading you past a flock on the ground
     * within `from` m (you within `you` m of it, to see it), it bows at them for `wind` s, tears in at `speed` m/s onto a
     * lap of `lap` s round them (ANIMALS.pigeons flush as it would for you), and looks up after them; not the same flock
     * again for `again` s */
    charge: { from: 12, you: 13, wind: 0.55, speed: 6.4, lap: 2.5, again: 150 },
    /* the konbini's bits (reactions.js SNACKS): you eat at the door's spot looking out over the road (`eatZ`, world;
     * store/shop.js SPOT); it sits `d` m out in front of that and `side` m to your left (the hand with the food is on
     * the right; your eyes are a little down the road while you eat, store/shop.js, so it is in your view from ~3.4 m).  From far off it is set where you see it
     * come from, `from` [min, max] m away */
    snack: { eatZ: 2.4, d: 3.9, side: 1.0, from: [7, 12] },
    /* rolled over (the idle roll, tipsy on its back), how far the pup must come up for its lowest part to rest ON the
     * ground, by the roll's angle every `step` radians from 0 to pi, standing and lying (measured: scripts/_hachi.mjs
     * --only profile; Tan: it sank under the road) */
    rollUp: { step: 0.3, stand: [0, 0.019, 0.03, 0.023, 0.015, 0.019, 0.046, 0.116, 0.171, 0.206, 0.21, 0.21], lie: [0, 0.027, 0.042, 0.042, 0.04, 0.033, 0.023, 0.029, 0.046, 0.07, 0.081, 0.085] },
    /* m up by posture, every `step` from `from` (-1 a full play bow: the elbows rest on the ground, not in it; 0
     * standing; 1 sat: the rump; 2 lying), so the lowest part of the pup rests ON the ground (measured:
     * scripts/_hachi.mjs --only posture; Tan, 2026-10-02: sat, he was 1.5 cm into the platform) */
    postureUp: {
      from: -1, step: 0.0625,
      up: [0.038, 0.042, 0.042, 0.038, 0.038, 0.038, 0.038, 0.034, 0.031, 0.031, 0.027, 0.027, 0.023, 0.017, 0.012, 0.007,       // the bow (4 mm more: its rump wiggles)
        0.003, 0.003, 0.003, 0.003, 0.003, 0.003, 0.003, 0.003, 0.003, 0.003, 0.003, 0.003, 0.003, 0.003, 0.003, 0.007,            // standing, sitting down
        0.015, 0.011, 0.011, 0.011, 0.011, 0.011, 0.011, 0.011, 0.007, 0.007, 0.007, 0.007, 0.007, 0.003, 0.003, 0.003, 0.003],    // sat, lying down
    },
    tipLift: 0.11,                            // m up per radian it is tipped nose-up or nose-down (the low end stays on the ground)
    /* after the tour, whistled: it stays with you, `ahead` m ahead and `aside` m to a side as you walk, sat `sit[0]` m in
     * front of you when you stop (it comes round when you are past `sit[1]` m or it is out of your view).  Within
     * `ask[0]` m and `ask[1]` degrees of the middle of your view the tour is on offer again (E).  You more than `far` m
     * off (it follows at no more than its jog: run and you leave it behind) or in the store for `alone` s: back to its bench */
    pal: { ahead: 2.6, aside: 1.0, sit: [3.6, 6], ask: [6, 22], far: 14, alone: 25 },
    engage: { konbini: 1.2, view: 1.0, han: 0.85, train: 1.1, slowlife: 1.1, mochi: 1.2 },   // the engagements' ring radii (and which ids count until the list says `kind`)
    cell: 0.4, radius: 0.25,                  // its map of the town: cell size, and clearance from anything solid (its own half-width and a little)
    step: 0.45,                               // the biggest step between neighbouring cells it will take: kerbs yes, the channel no
    /* steps and kerbs (Tan, 2026-10-02: "he must JUMP ... never sliding up a riser or dropping instantly").  A change
     * of the ground's height of `min` m or more within `look` m ahead (+ `lookV` s of its speed): a `crouch` s dip,
     * then `air` [min, max] s off the ground over the edge, landing `land` m past it (+ `landV` s of its speed; on a
     * flight the middle of the next tread, of the one after at over `two` m/s; a strip narrower than `run` m, a kerb
     * stone, is cleared whole), `arc` m over the higher side, nose up then down by `pitch` rad, and a `squash` s dip
     * as it lands.  Anything else that takes it over an edge (zoomies, its garden's bits): `pop` s of a small hop
     * `popArc` m high instead of a snap. */
    jump: { min: 0.06, look: 0.3, lookV: 0.07, land: 0.2, landV: 0.035, run: 0.3, crouch: 0.08, air: [0.22, 0.32], arc: 0.09, pitch: 0.3, squash: 0.14, two: 4.2, pop: 0.2, popArc: 0.07 },
    /* a metre of each, relative: it keeps to pavements, plazas and lanes, crosses kerbed roads on the zebras (main-road
     * asphalt is dear), keeps off paddy plots, and never takes an alley or a gap between houses (`alley`: every cell
     * that is not a street, a plaza, the land's paths or a lot; forty pavements a metre, so only where nothing else leads) */
    costs: { pavement: 10, plaza: 12, ground: 15, lot: 20, lane: 30, plot: 120, asphalt: 200, alley: 400 },
    /* The town tour (Tan, 2026-09-29: "take the player through the streets so that they experience all aspects of the
     * town"): an ordered chain of street waypoints, world frame, that Hachi leads along instead of the shortest way.
     * `id`: an engagement it waits at (done = you step into its ring), or `gate` (it waits until you are `wait` m off);
     * `hear`: a sound place passed within earshot (a glance back there; no stop). Legs are routed on the walk grid. */
    tour: [
      { id: 'view', x: 0, z: 16.5 },
      { id: 'konbini', x: -2.3, z: 2.3 },
      /* (Tan, 2026-10-02: "after the Nippon Mart, Hachi takes me to the zebra crossing before... Han... we can cut off
       * that") straight back over the road by the store's own crossing, then west along the far pavement to the car park */
      { x: -1, z: 9 },
      { x: -1, z: 18.6 },
      { x: -18.3, z: 20.5 },                       // west along the far pavement to the gap in the car park's kerb
      { id: 'han', x: -21.7, z: 23.5 },           // the car park: Han and the RX-7
      { x: -18.3, z: 20.5 },                       // out by the same gap
      { x: -12, z: 19.3 },                        // east along the far pavement, behind the famous view
      { x: 20, z: 19.3 },
      { id: 'mochi', x: 39.2, z: 19.4 },          // ぺったん堂: the rabbits' mochi pounding (world/mochi/)
      { x: 50, z: 17 },                           // the shopping street's mouth
      { x: 50, z: -2.3, hear: 'walk1' },          // its first zebra
      { x: 50, z: -40, hear: 'donki' },           // ドンペン堂's theme
      { x: 50, z: -72.3, hear: 'walk2' },         // the halfway zebra
      { x: 50, z: -101, hear: 'station' },        // the plaza: the station's announcements
      { x: 51, z: -115.5 },                       // the foot of the station's steps
      { id: 'train', x: 53, z: -129.2 },          // platform 1, up the front steps: the train's listening spot
      { x: 51, z: -115.5 },                       // back down
      /* Tan, 2026-10-01: from the station through the plaza to the level crossing, over it when it is open, to
       * Hachi's own home; then the shrine (in through the torii, to the guardian fox); no wandering through alleys */
      { x: 68, z: -110 },                         // through the station plaza
      { x: 80, z: -116 },                         // onto the crossing's lane
      { x: 80, z: -127.6, cross: true, hear: 'crossing' },   // at the barrier: he waits here while it is shut (the bells, the train going by)
      { x: 80, z: -141.0 },                       // over the line
      { visit: 'home', x: 79.4, z: -146.6 },      // ハチのおうち: his own garden, in through the gate (visited: you come in)
      { x: 80, z: -141.0, cross: true },          // back to the barrier, from the south
      { x: 80, z: -127.6 },
      { x: 80, z: -84.3 },                        // up lane x 80 to lane z 112
      { x: 50, z: -84.3 },                        // west along it: over the shopping street
      { x: 25, z: -84.3 },
      { x: 0, z: -84.3 },
      { x: 0, z: -52.3 },                         // north up lane x 0 to lane z 80
      { x: -13, z: -52.9, hear: 'shrine' },       // the shrine's front: its wind chimes
      { visit: 'shrine', x: -13.95, z: -58.0 },    // 富士見稲荷: through the torii, up the path, to the guardian fox (visited: you come in)
      { x: -13, z: -52.9 },                       // out again
      { x: -30, z: -52.3 },                       // on west along lane z 80
      { x: -30, z: -84.3 },                       // south down lane x 30 to lane z 112
      { x: -53, z: -84.3 },                       // the lane's end: the pond's gate
      { id: 'slowlife', x: -73, z: -74.8 },       // the slow-life bench, where the paddies meet the pond
      /* last (Tan, 2026-09-29: "Deer Park can be the last place Hachi takes the players to"): out by the pond's gate
       * (the one way in and out), back up lane x 30, over the master junction and 富士見橋 to the gate; it naps there */
      { x: -53, z: -84.3 },
      { x: -30, z: -84.3 },
      { x: -30, z: 4, hear: 'walk3' },            // the master junction (its lane zebra: piyo)
      { x: -30, z: 36 },                          // the bridge road
      { x: -30, z: 50, hear: 'bridge' },          // 富士見橋
      { id: 'gate', x: -30, z: 65, wait: 7 },     // 鹿公園, coming soon
    ],
    /* the stops that are places, not engagements (`visit` legs): Hachi goes in and does his bit, and the place counts
     * as visited once you come in after him.  home: he waits at the gate for you to be `see` m near, then the joy:
     * `bounce` s of jumping, a `spin`, through his tunnel and his hoop, into his house (`inside` s looking out of the
     * door) and out, his ball nosed along (`toy` s), and a flop onto his cushion, `flop` s looking at you.
     * shrine: he sits by the fox looking back at you for `sit` s. */
    visit: { home: { see: 9, bounce: 1.3, spin: 1.0, inside: 1.1, toy: 2.2, flop: 3.4 }, shrine: { sit: 3 } },
    /* the level crossing (`cross` legs): he goes over only with the arms right up and no train due; else he sits at
     * the barrier and watches the train by (ears up when it is within `hear` m), and goes when the arms have lifted */
    crossing: { hear: 70, open: 0.04 },
    hear: { walk0: [-35, 13.8, 14], walk1: [50, -5, 14], walk2: [50, -75, 14], walk3: [-30, 1.5, 14], donki: [55.9, -41.4, 12], station: [51, -125.5, 14], crossing: [80, -134.3, 10], shrine: [-13, -64.4, 14] },   // each sound place and how near the tour must pass (m)
    nap: [28.45, -37.75],                     // town frame: in front of the gate's bench (TOWN.land.gateBench), the tour's last stop: it hops up from here and sleeps on it once everything is done
    /* the bedtime on the bench (s from landing on it): a play bow at you, a happy spin, a roll belly-up, a sit and a
     * head tilt, two slow circles, and down, curled up; `onNap` and `onTourEnd` (the postcard) fire once it is settled */
    bedtime: { hop: 0.5, bow: [0.35, 1.6], spin: [1.6, 2.5], roll: [2.5, 4.6], sit: [4.6, 5.6], circle: [5.6, 7.3], settle: 8.0 },
  },
  butterflies: { size: 1.15, beatHz: 9, speed: 0.9, near: 45, shy: 1.0 },
  pigeons: { plaza: 9, spine: 5, flush: 2.4, flushSpeed: 0.6, shy: 1.3, walkSpeed: 0.2, stepAngle: 0.36, flySpeed: 5, sit: [8, 20], back: 10 },
  egret: { flee: 6, hop: [8, 30], flySpeed: 3.0, cruise: 1.6, beatHz: 2.8, beatAmp: 0.62, walkChance: 0.55, walkSpeed: 0.2, stepAngle: 0.38 },
};

/* ------------------------------------------------------------------ *
 * The phone build (src/mobile/, m.html; docs/decisions/mobile-lite.md,
 * "Mobile v3: the mini town").  The desktop game reads none of this.
 *
 *   route   false: phones get the "best on a computer" card.  true:
 *           index.html sends phones and tablets to m.html instead.  Tan
 *           flips it once the phone version is approved.
 * ------------------------------------------------------------------ */
export const MOBILE = {
  /* (Tan, 2026-10-03) the phone is a glimpse in portrait: the town in the top three quarters, a panel of controls and the
   * guide line in the bottom quarter (mobile/panel.js); turned sideways it asks to be turned back */
  portrait: true,
  route: true,
  /* The mini town (src/mobile/plan.js): the desktop's plan with the block row south of lane 112 taken out;
   * everything south of it (the plaza, the station, the line, the crossing, Hachi's home, 鏡池, the bench)
   * stands `dz` m further north.  Numbers written into the shared builders are moved by the phone build
   * itself (vite.config.js miniPlan: the `@dz` and `@mini` marks). */
  plan: { dz: 76 },
  /* The render: the phone's own pixels (its DPR, up to `maxDpr`; an iPhone 15 on its side is 2556 x 1179 at 3),
   * capped at `pixels`.  The scale steps down by `step` only while two seconds of frames average under
   * `fpsLow`, never below `minScale`, and back up over `fpsHigh`. */
  render: { maxDpr: 3, pixels: 3.6e6, minScale: 2.25, step: 0.25, fpsLow: 42, fpsHigh: 55 },   // (Tan, 2026-10-02: never soft: the scale gives way late and little)
  maxTexture: 4096,          // the largest painted texture's side on the GPU: the desktop's own sizes
  storeTexture: 4096,
  wear: 1024,                // the painted weather's page (kit/paint.js wearAtlas: 2048 on the desktop; soft grime)
  /* the konbini's label and price-tag pages (world/store/pages.js) are held this many mipmap levels smaller
   * than the desktop holds them (measured there at 3840 px across; a phone on its side is 2556): `far` away
   * from the store, `near` on its forecourt and in a visit */
  storePages: { far: 1, near: 1 },
  shadow: { size: 1536, half: 32, every: 2.0 },   // map size, half-width (m), refresh at most every s when still (desktop 2048 over 40; 4.2 cm a texel here, 3.9 there)
  /* Draw distance: batches whose bounds lie past `far` m are not drawn; the fog (each look's own colour) has
   * closed in before it, so the edge is never seen.  The town is ~190 m across: from the famous view the far
   * tree line stands in the haze as on the desktop. */
  far: 210,                  // (the pocket town: the whole of it, from anywhere in it)
  fog: { near: 70, far: 205 },
  detail: 42,                // small instanced things (clutter, flowers, weeds) only this close
  small: { r: 2, far: 90 },  // a loose part under `r` m across (a gate machine, a lamp, a plate) is drawn only within `far` m
  cell: 64,                  // batches with a page of their own, per cell (m): small enough to shrink and stream by distance
  bulkCell: 256,             // ... and everything plain-coloured or skinned with the town's shared tiles: big cells, few draws
  plainCell: 0,              // ... what has no picture, and the town-wide sign atlas: one batch a style for the whole town (0: no cells)
  detailCell: 32,            // ... and the small props' own cells (drawn within `detail`)
  dt: 1 / 20,                // the longest step a frame may take (s)
  look: 0.0052,              // drag to look: radians per CSS pixel
  stick: { radius: 56, dead: 0.12, run: 0.92 },   // the joystick: px; dead zone and the push that runs (0..1)
  aimAssist: { reach: 2.8, cone: 0.6 },           // no crosshair hit: the nearest thing within reach (m) and this cone (rad)
  /* `stream`: batches and textures farther than far + stream (m) give their GPU copy back, and upload again
   * as you come near (0: never). */
  stream: 0,                 // (the pocket town: everything stays; nothing loads or unloads as you walk, no page swaps size)
  /* A painted page farther than `far` m from you (its nearest user) shows a copy `k` its size, the whole one
   * again within `near`; in the konbini, every town page (seen through the glass) at most `store` its size
   * (lite.js makeCuller). */
  texLod: { min: 256 * 256, near: 40, far: 48, k: 0.25, store: 0.5, safe: 1.1, least: 10 },   // (safe, least: a page whose texels a metre are known steps to its half and quarter by what the screen can show, lite.js; never nearer than `least` m)
  /* In the store, what lies wholly north of `behind` (world z: the glass; the walls hide the rest) is neither
   * drawn nor kept; its goods are drawn (and kept) only within `goods` m. */
  store: { behind: -0.5, goods: 45, quadsNear: 15, quadsFar: 17.5, quadsDeep: 3 },
  /* The town's sign atlas (mobile/town.js mergePocket): only pages of at most `max` texels that belong to one
   * region go in, packed per region of a grid cut at these world z and x lines; the rest keep their own. */
  atlas: { max: 256 * 256, z: [-35, -70], x: [-45, 45] },
  keepCpu: true,             // keep the CPU copies (needed to stream, and to survive a lost GPU context)
  /* The light tier: the 4 GB iPhones, small Android phones and their web views, and any phone that lost the GPU
   * context here before (main.js picks).  The same textures and the same sharp frame near you (Tan, 2026-10-02:
   * sharpness is never what pays): what goes is draw distance and far pages.  ?tier=light / ?tier=full by hand. */
  tiers: {
    light: {
      far: 70, fog: { near: 24, far: 66 }, detail: 24,
      texLod: { min: 256 * 256, near: 16, far: 22, k: 0.25, store: 0.5, safe: 1.0, least: 8 },
      store: { behind: -0.5, goods: 34, quadsNear: 15, quadsFar: 17.5, quadsDeep: 3 },
      shadow: { size: 1024, half: 28, every: 2.5 },
      render: { maxDpr: 3, pixels: 2.7e6, minScale: 2, step: 0.25, fpsLow: 40, fpsHigh: 55 },   // (Tan, 2026-10-02: sharp here too; what pays is distance, below)
      stream: 5,
    },
  },
};
