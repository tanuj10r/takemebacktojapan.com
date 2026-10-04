# Add-on: Director Mode Version C, "Hachi Hears Japan"

Add this as a third version in Director Mode (selector, `P`, `Shift+P`, same rules as A and B).

## The idea

One continuous take, no cuts: a close-up of Hachi's face while eight of the game's sounds play one after another. Hachi reacts to each one differently, and the video builds from curious, to scared, to confused, to calm, to party, to overjoyed at the end. Hachi's face and reactions are the entire video, so this is where the reaction library (Part 3) must be at its best.

## Camera and setting

- **Framing:** locked close-up of Hachi's head and shoulders, camera at his eye height (0.32 m), about 0.9 m away, FOV 35, Hachi centred slightly below the middle so the ears never leave frame when they perk. A very slow push-in across the whole video (ending ~15% closer).
- **Where:** Hachi sits on the pavement in front of the konbini with Fuji visible behind and slightly out of frame to one side. Golden hour, so the light on his face is warm. Keep the background calm: no cars, trains or people passing through frame.
- **Hachi sits the whole time.** He reacts with head, ears, eyes, mouth, tail (visible at the side when it wags) and front paws only. He never walks out of frame.
- **Eye contact:** between sounds, Hachi looks at the camera. On each sound, he looks toward where the sound "comes from" (just off camera), then back to the camera at the peak of his reaction.
- **Sound:** each sound plays alone and clean, not positioned in the world (straight to the listener at full clarity), with a quiet town ambience bed underneath the whole time so there's never dead silence. 0.3 s of just the bed between sounds, so each reaction resets.

## The sequence (about 28 s)

| Time | Sound | Hachi's reaction |
|---|---|---|
| 0.0 to 1.0 | Ambience only | Idle: sitting, a natural blink, looks at camera, tiny tail wag |
| 1.0 to 4.0 | Walk signal, piyo (chick call), 2 cycles | Ears perk, head turns toward it, `headTilt` to one side and holds; on the second cycle, `earAsym` (one ear up) |
| 4.0 to 7.0 | Walk signal, kakko (cuckoo call), 2 cycles | Head tilts the *other* way, then a double tilt, "hm?" (dog-hmm); a tiny `sniff` toward it |
| 7.0 to 10.5 | Level crossing bells | `startle` (little hop in place), then `earsBack`, `crouch` lower, `tailTuck`, `tremble`, eyes big, soft whine; relaxes slowly as the bells fade |
| 10.5 to 14.0 | In-train "next stop" announcement | Confused: `earAsym`, slow `headTilt`, looks at camera as if asking, a blink, "hm?"; at the end, a small `sneeze` |
| 14.0 to 18.5 | Rural flute | Calm: ears soften, `slowBlink` twice, eyes half closed, head gently sways, a big `wakeUp`-style yawn in the middle, content |
| 18.5 to 21.5 | ドンペン堂 theme (short excerpt) | Eyes snap open, head bobs to the beat, `tippyTaps`, tongue out, ears past 1 (excited), tail helicopter wag |
| 21.5 to 23.5 | Ka-ching | Freezes mid-bob, ears shoot up, `eyeBig`, looks straight at camera ("...treat?"), one paw lifts |
| 23.5 to 27.0 | Konbini door chime (the whole phrase) | Maximum joy: `happyWiggle`, giggle and yip, happy squint, tongue out, tail going wild, a little bounce on the front paws; ends looking at camera with the happiest face |
| 27.0 to 28.0 | Chime's last note fades, ambience | Holds the happy face, one slow blink at the camera (end card goes over this in the edit) |

## On-screen labels

Burn in nothing. Instead, export a sidecar `hachi-C-captions.srt` with each sound's name at its time, Japanese and English, so I can style them in the editor:

- ぴよぴよ · crosswalk chick
- カッコー · crosswalk cuckoo
- 踏切 · level crossing
- 次は渋谷 · next stop, Shibuya
- のんびり · slow life
- ドンペン堂 · megastore theme
- チャリン · ka-ching
- 入店チャイム · konbini chime

## 4K

Version C is also rendered at **2160x3840**: `Shift+X` (in Director Mode, with Version C selected) runs the deterministic frame-by-frame render at 60 fps and saves `hachi-C-4k.mp4` with its audio muxed in. Take as long as it needs; no dropped frames. Keep the normal real-time `Shift+P` recording at 1080x1920 as well.

## Verify

- Contact sheet of Hachi's face at the peak of each of the eight reactions: each must read clearly as a different emotion at phone size, and the last one must be the happiest frame in the video.
- Every reaction lands on its sound within 2 frames (the startle on the first bell, the freeze on the ka-ching, the wiggle on the chime's first note).
- Record Version C with `Shift+P` and render the 4K version; check both files play, are the right length, and stay in sync.
