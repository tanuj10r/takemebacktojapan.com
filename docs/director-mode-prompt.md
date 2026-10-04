# Build: Director Mode for the Hachi promo videos

Read AGENTS.md, docs/BUILDERS.md and docs/EXPERIENCES.md first. This adds to them.

## Goal

I'm launching takemebacktojapan.com with two short vertical promo videos starring **Hachi**, the guide shiba (src/world/animals/guide.js, shiba.js). Your job is to build a **dev-only Director Mode** that plays every shot of both videos automatically: camera move, time of day, Hachi's performance, Han's performance, world events and sound, all timed and repeatable, and **records itself** to a video file with the real game audio, on this Mac. I press one key, the whole version plays, and a finished video file downloads. I only add on-screen text afterwards in an editor.

**Cuteness is the hook.** Hachi's expressions and body language are what will make this go viral. Spend most of your effort on Hachi's reactions. Every beat should read instantly on a phone screen with the sound off, and be adorable with the sound on.

## Hard rules

- Director Mode exists only in DEV builds behind `?director` (same pattern as `?shots` in main.js, `import.meta.env.DEV`). The production build must be byte-for-byte unaffected in behaviour; verify with `npm run build` and `npm run size`, and confirm the director code is tree-shaken out.
- Do not change normal gameplay, Hachi's guide brain, Han's show or the konbini flow when Director Mode is off. Add hooks (one line each, flagged in your report) rather than rewriting systems you don't own.
- Keep the town's cel look. No bloom, haze, depth of field or film effects.
- Reuse existing systems: soundBus.zone/oneShot, the dog voice recipes in core/sound.js, Han's rig and drive (han/*), the store's doors, kiosk sounds and eating (store/*), the existing drunk effect, time of day (keys 1 2 3), the train service and level crossing (line/*).
- Stylised Han only, never the actor's likeness (docs/decisions/han.md).
- Log judgement calls in docs/decisions/director.md. Small commits on a branch `director-mode`, each ending with "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>".

---

## Part 1: Capture foundation

1. `?director` in the URL turns on Director Mode.
2. **HUD off:** key hints, prompts, minimap, map, labels, crosshair, Hachi's card, and the experience glow rings and floating markers (they break the fiction in third person). Key `H` toggles the HUD back for debugging.
3. **9:16 frame:** render the canvas at exactly 1080x1920 CSS pixels (device pixel ratio 1), centred in the window, black around it. Everything outside the canvas is the director's panel (Part 6), and only the canvas is ever recorded. If the window is smaller than 1920 px tall, scale the canvas's display down with CSS but keep rendering at 1080x1920.
4. **Audio listener follows the camera**, not the player, so what you hear matches what you see. Exception: POV shots, where camera and player are the same.
5. **Shot clock:** each shot runs on its own timeline clock (like Han's show uses wall time), so a shot plays identically every take. Random behaviour (Hachi's idle choices, crows, pigeons) is seeded per shot.
6. `T` toggles slow motion (0.35x) for the world and animation. Audio keeps normal speed and pitch.
7. `B` toggles a **safe-frame overlay** (top 15% and bottom 20% shaded, where Instagram and TikTok put their UI) so I can check nothing important sits there. Never visible in a recorded shot unless toggled.
8. Mute buses independently for recording passes: `Shift+1` ambience, `Shift+2` music, `Shift+3` effects, `Shift+4` dog voice, `Shift+0` all on.
9. **Self-recording (the main way I'll capture):** `Shift+P` plays the chosen version from start to finish and records it with the browser's MediaRecorder: the canvas via `canvas.captureStream(60)`, plus every game sound routed into one `MediaStreamAudioDestinationNode`. That must include the sound engine's buses AND the train's separate audio graph in line/sfx.js, so nothing is missing from the file (the audio still plays through the speakers too). Use the highest bitrate the browser allows (at least 16 Mbps video, 192 kbps audio). When the version ends, the file downloads automatically as `hachi-A.webm` / `hachi-B.webm` (MP4 if the browser can record it directly). `Shift+Enter` records just the selected shot, as `hachi-A07.webm` and so on. A small red dot shows in the director panel (never on the canvas) while recording.
10. **Fallback if live recording drops frames at 1080x1920:** a deterministic render: step the world one frame at a time at exactly 1/60 s, capture each frame, and record the audio separately with an OfflineAudioContext or a real-time capture of the same timeline, then mux them (ffmpeg is fine, from a script in scripts/). Report which approach you used and why.

## Part 2: Camera toolkit

Build a small camera director that shots are written in, with every move eased (ease-in-out, no linear starts or stops) and no jitter:

- **follow**: low chase cam behind a target (Hachi, Han, the RX-7), with offset, height, lag (damped spring) and look-ahead. Hachi's default: 0.45 m high, 1.6 m behind, looking slightly up at him so he looks heroic and small.
- **hachiEye**: camera at Hachi's eye height (0.32 m), looking where Hachi looks. For "what Hachi sees" cuts.
- **tripod**: locked position and look-at, optional slow push-in (a few cm per second).
- **dolly**: smooth spline through 2 to 5 keyframes (position, look-at, FOV), with timing.
- **orbit**: around a point at radius and height, degrees per second.
- **drone**: high to low descent onto a target.
- **pov**: the player's first-person camera, with the player scripted (Part 5).
- **cut**: hard cut between rigs at a timestamp within a shot.
- Per-shot FOV (default 50, close-ups 35, wide 65) and an optional gentle handheld drift (tiny, slow noise, off by default).
- Collision: cameras never clip into buildings, poles, the car or Hachi.

## Part 3: Hachi puppeteer and the reaction library (the heart of this)

While a shot is running, the shot owns Hachi: suspend the guide brain and drive Hachi from a script. Hachi moves along paths on the guide's walk grid (so he never walks through things), at named gaits: `walk`, `trot`, `jog`, `sprint`, `sneak`, `strut`.

### Extend the rig

The rig (shiba.js `RIG`) already has: trot phase and amplitude, look, nod, sit, lie, bow (play bow), wag, ear perk (past 1 = excited, tongue out), head tilt. Add these as per-instance floats or morphs, keeping it one draw call:

- **earsBack**: ears flatten back against the head (scared, sheepish, apologetic).
- **earAsym**: one ear up, one ear down (confused, curious).
- **eyeClose**: eyelids, for blinks, slow blinks, squints and sleep. Hachi blinks naturally every 2 to 5 s, and double-blinks sometimes.
- **eyeBig**: pupils and shine grow up to 1.25x ("puppy eyes"), used sparingly for the big cute beats.
- **mouthOpen**: for yawn, pant, smile and awoo, separate from the tongue.
- **tailTuck**: tail uncurls and tucks down (scared) versus the normal curl.
- **crouch**: body lowered on all four legs, weight back (scared, stalking, hiding).
- **tremble**: fine fast shiver of the body (scared). Amplitude-controlled.
- **pawLift**: one front paw raised (begging, hesitation, "tippy taps" when alternated fast).
- **wiggle**: whole-back-end wag where the hips swing with the tail (overjoyed).
- **squish**: cheek and nose flatten against a plane (face on the konbini glass).
- **headShake**: fast side-to-side head shake (sneeze aftermath, shaking off smoke).

### Secondary motion (makes it alive)

- Ears and tail follow through: when Hachi stops, turns or startles, ears jiggle and settle, the tail overshoots.
- Anticipation: a small crouch before every jump, sprint or zoomie.
- Tiny squash on landing from a hop.
- Head leads the body on turns; eyes lead the head.
- When the camera is in front of Hachi on a cute beat, Hachi looks at the camera (eye contact sells cuteness).

### Reaction library

Each reaction is a named, reusable function with a duration, blending in and out over 0.15 to 0.3 s, with its sound from the existing dog recipes (dog-yip, dog-boof, dog-whine, dog-hmm, dog-pant, dog-shake, dog-snore, dog-awoo, dog-snort, dog-giggle, dog-sneeze). Add new recipes only where listed (in core/sound.js's recipe style).

| Reaction | What it looks like | Sound |
|---|---|---|
| wakeUp | Asleep curled; one ear pops up, then the other; eyes open; big yawn (mouth wide, tongue curl); full stretch into a play bow | snore, then new `dog-yawn` (a squeaky rising yawn) |
| zoomOff | Anticipation crouch, then sprint away, ears back from speed, tongue flapping | yip |
| proudStrut | Chest out, head high, tail high and wagging slowly, bouncy exaggerated steps | none |
| stripeHop | Hops only on the white zebra stripes, little bounce each time | new `dog-tip` (soft paw pats) |
| sitWatch | Sits, head smoothly tracks a moving target (the train), ears perked | none |
| startle | Jumps a few cm straight up, all four legs, eyes wide, ears back, lands and freezes | new `dog-yelp` (tiny squeak) |
| scared | Crouch, ears flat, tail tucked, tremble, eyes big, backs away slowly | whine |
| hideAndPeek | Ducks fully behind cover; then only the head slides out sideways, ears flat, one eye; slowly the rest follows | whine (quiet) |
| headTilt | Tilts one way, holds, then the other way (double tilt), ears asymmetric | hmm |
| sniff | Nose bobs down toward something, short sniffs, nostril twitch | new `dog-sniff` |
| sneeze | Head pulls back, eyes squeeze shut, sharp sneeze, head shake after, one ear flops | sneeze |
| shakeOff | Full-body shake from head to tail, ears flapping, fur-ruffle wobble | shake |
| zoomies | Tight fast circles with the rump tucked, ears back, then a sudden flop | awoo, snort |
| playBow | Front end down, rump up, tail helicopter wag, a quick bounce | boof |
| tippyTaps | Front paws alternate fast in place, wiggle, tongue out, ears perked past 1 | giggle |
| faceOnGlass | Front paws up on the glass, face squished against it, eyes big, breath fog puff on the glass | pant (muffled) |
| puppyEyes | Sits very straight, head tilted up to the camera, eyeBig, slow blink, one paw lifts | whine (soft, high) |
| beg | Sit, paw lift and wave, tilt, lip lick | giggle |
| happyWiggle | Whole back end wiggles, spin in place once, tongue out, happy squint | yip, giggle |
| munch | Head dips, chews with exaggerated jaw, tail wagging, happy squint | bite, munch |
| lookBack | Mid-trot, looks back over the shoulder at the camera or Han, ears perk | boof |
| leadOn | Trots ahead a few metres, stops, looks back, waits with a tail wag, repeats | boof |
| slowBlink | Eyes close slowly and open slowly, relaxed ears | none |
| fallAsleep | Circles once, curls up, head on paws, eyes droop and close, ear twitch in a dream | snore |

Add a debug key in Director Mode: `J` opens a reaction tester: pick any reaction, play it on Hachi in place, with an orbit camera, so I can review them all.

## Part 4: Han puppeteer

While a shot runs, the shot owns Han and the RX-7. Reuse Han's rig and the drive's path system (han/drive.js turtle paths). Add:

- **driftToKonbini**: the RX-7 drifts round the corner into the konbini car park in smoke (a new path, same style as Han's show), and parks nose-in, with the drift track playing.
- **exitCar**: door opens, Han gets out, door shuts (han-door sound).
- **walk**: a cool, relaxed walk cycle for Han, and a **drunkWalk**: slow, weaving, a stumble step, one hand out.
- **enterStore / exitStore**: Han walks through the konbini doors (doors open with the chime, auto-door sound).
- **Inside:** Han takes a Strong Nine from the fridge and pays at the self-checkout, driven by the store's existing kiosk timings and sounds (scan, card, paid, ka-ching), seen from outside through the glass.
- **drink**: Han cracks the can and drinks (can-open, gulp), head back.
- Han can be told to look at Hachi, and to follow a target (Hachi) at a distance.

## Part 5: POV and the player

- A scripted player for POV shots: walk a path, turn, look at a target, with the player's own hand and the store's existing hand and eating animations.
- **Drunk POV**: use the game's existing drunk effect. For Version A only, add a director-only **double vision** of Hachi: a second Hachi instance offset left and right (drifting in and out of alignment in sync with the sway), both doing the same reaction.

## Part 6: The director panel

A panel outside the 9:16 canvas (so it never appears in any recording):

- Version selector: **A: Hachi's Big Day (25 s)**, **B: Hachi Fears Nothing (16 s)**.
- Shot list for the chosen version, each with its number, name and duration.
- Keys: `Up/Down` select a shot, `Enter` play it, `Esc` stop and reset, `P` play the whole version back to back (preview, no recording), `Shift+P` play and record the whole version, `Shift+Enter` play and record the selected shot, `R` reset the selected shot to its first frame and hold it frozen.
- Whole-version playback cuts straight from shot to shot (no black between them), so the recorded file is already edited in order. Prepare each next shot (time of day, positions, sounds loaded, textures warmed) during the one before, so cuts never hitch or pop, and cross-fade ambience across cuts over ~0.2 s so audio never drops out. Single-shot recordings keep 1 s of pre-roll and post-roll as edit handles.

## Part 7: The shots

Times are within each shot. "Hachi" means the puppeteer; reactions are from Part 3.

### Version A: "Hachi's Big Day" (target 25 s)

| # | Dur | Time of day | Camera | Action | Sound |
|---|---|---|---|---|---|
| A1 | 1.5 | Morning | tripod close on the kennel, low, slow push-in | Hachi `wakeUp`, looks at camera, `zoomOff` out of frame | snore, yawn, yip, birds |
| A2 | 1.5 | Morning | follow, low, side-on at the side-street zebra, then cut to the main road overhead | `stripeHop` across both crossings | piyo walk signal, then kakko |
| A3 | 1.5 | Morning | tripod low beside the level crossing barrier, Hachi in foreground | `sitWatch` as the train passes and brakes; `startle` at the brake squeal's peak | crossing bells, inverter whine, squeal |
| A4 | 1.0 | Morning | hachiEye at the station gates, then cut to Hachi's face | Hachi's ears go `earsBack` at the announcement, then `headTilt` | station announcement |
| A5 | 1.5 | Morning | dolly forward low down the torii tunnel | Hachi trots ahead, a petal falls in front of him, `headTilt` then `sniff` at it, `sneeze` | wind chimes, hmm, sneeze |
| A6 | 1.5 | Golden hour | tripod wide in front of ドンペン堂, mascot rocking | `zoomies` then `playBow` at the mascot | megastore theme, awoo, boof |
| A7 | 1.0 | Golden hour | tripod low over the pond | `shakeOff` by the water | rural flute, shake |
| A8 | 1.0 | Night (switch visible) | drone, high to low | Hachi trots toward the glowing konbini, Fuji behind | night insects |
| A9 | 2.0 | Night | tripod low near the konbini car park, Hachi in foreground | RX-7 `driftToKonbini` in smoke; Hachi `startle`, then `scared`, then darts behind the vending machine | drift track, yelp, whine |
| A10 | 1.5 | Night | tripod past the vending machine's edge | Han `exitCar`, `walk`s into the store; Hachi `hideAndPeek` in the foreground | car door, chime |
| A11 | 1.5 | Night | from inside the store, looking out through the glass | Hachi `faceOnGlass`, eyes big | muffled store music, pant |
| A12 | 1.5 | Night | from outside through the glass, Hachi's ears in the bottom of frame | Han at fridge and self-checkout | fridge door, scan, card beep, ka-ching |
| A13 | 1.0 | Night | tripod low at the doors | Han walks out, cracks the can, drinks; Hachi `tippyTaps` | chime, can open, gulp |
| A14 | 3.0 | Night | pov as Han, drunk sway, double vision | Two Hachis `headTilt`, then `sneeze` in sync; Han's view wobbles and turns the wrong way | hmm, sneeze |
| A15 | 2.5 | Night | follow, low behind Hachi, Han weaving in the background | Hachi `leadOn`, `lookBack` at Han; Han `drunkWalk` following | boof, yip |
| A16 | 1.5 | Night | drone slow pull-back from the bench by the paddies | Hachi `fallAsleep` curled beside Han asleep on the bench; Fuji and the town | snore, title song swells |

### Version B: "Hachi Fears Nothing" (target 16 s, no alcohol, no Han drinking)

| # | Dur | Time of day | Camera | Action | Sound |
|---|---|---|---|---|---|
| B1 | 1.0 | Morning | tripod low, Hachi walking toward camera | `proudStrut` | kakko walk signal |
| B2 | 1.5 | Morning | tripod low beside the level crossing | Train roars past; `startle` then `scared` | bells, inverter whine, yelp |
| B3 | 1.5 | Golden hour | tripod in front of ドンペン堂 | Mascot rocks; Hachi `scared`, backs away slowly, tail tucked | megastore theme, whine |
| B4 | 2.0 | Golden hour | tripod low, the RX-7 drifting past close | Smoke puff rolls over Hachi; `sneeze`, `headShake` | drift track, sneeze |
| B5 | 1.5 | Night | tripod low at the konbini doors | Doors slide open, chime: `startle`... then ears perk, `headTilt`, `tippyTaps` | auto door, chime, hmm, giggle |
| B6 | 2.5 | Night | pov, fast cuts: fridge, egg sando, scanner, card tap on the reader (slow motion on the tap) | Player's konbini visit, the egg sando | fridge door, scan, card beep, ka-ching |
| B7 | 2.0 | Night | pov outside, looking down; Hachi sitting at the player's feet | `puppyEyes`, `beg` | wrapper rustle, soft whine |
| B8 | 2.0 | Night | pov, then cut to tripod close on Hachi | The hand drops a piece of egg sando; Hachi `munch`, then `happyWiggle` | bite, munch, yip, giggle |
| B9 | 2.0 | Night | drone slow pull-back | Hachi `fallAsleep`, full belly, Fuji behind | snore, door chime |

Egg sando, never the choco wafer (chocolate is bad for dogs).

## Part 8: Verify and report

1. For every reaction, `node scripts/shots.mjs` key poses at full size (1080x1920), and a contact sheet of all reactions. Look at every frame closely: does it read as cute and clear at phone size? Fix and repeat. The bar is the pond pass quality (docs/EXPERIENCES.md).
2. For every shot, frames at its start, middle and end, and a check that nothing important sits in the safe-frame margins.
3. Frame time during the busiest shots (A9, A14, B4) on this Mac: no dropped frames at 1080x1920 while recording.
4. **Record both versions yourself** with `Shift+P` and check the files: they play in QuickTime or Chrome, are 1080x1920 at 60 fps, the right length (A about 25 s, B about 16 s), every sound in the shot tables is audible (including the train's), audio stays in sync to the end, and no cut hitches.
5. Normal game unaffected: the hero guard (< 0.5%), the walk check (all routes stuck 0), the konbini and Han checks, `npm run build` and `npm run size` unchanged.
6. Write **DIRECTOR.md** at the repo root: how to open Director Mode (exact URL), every key, how to record each version (`Shift+P`), where the files land, and the fallback render command if you built one.
7. Report: branch, files changed with a line each, the hooks you added in files you don't own, numbers before and after, absolute paths of the contact sheet, the best frame of each shot and your two recorded videos, and anything unsure or cut.

Never leave Chrome or a dev server running when you finish.
