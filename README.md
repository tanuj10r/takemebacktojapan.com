# Take Me Back to Japan (日本へ、もう一度)

Play it at [takemebacktojapan.com](https://takemebacktojapan.com).

A cozy first-person browser game set in Fujikawaguchikko (富士川口湖町), a
small Japanese town at the foot of Mt. Fuji. It opens on the famous view:
NIPPON, a konbini with Fuji rising over its roof. Step onto the glowing ring
by the door, pick something, pay at the self-checkout and eat it outside.
Then walk the town with Hachi, a shiba pup who leads the tour, reacts to
what you do and has a home of his own past the level crossing.

- **Things to do** (diamonds on the map): the konbini, the Nippon Fuji view,
  Han's RX-7 and its drift, the train's listening spot, the slow-life bench,
  ぺったん堂 (three moon rabbits pounding mochi: buy one for ¥200).
- **Things to hear** (speakers on the map): walk signals, ドンペン堂, the
  station, the level crossing, the shrine. A sound's name shows top left as
  you come near it.
- **A postcard** at the tour's end and on the pause card: share it, or add a
  selfie with Hachi (camera only; the photo never leaves your browser).

## Run it
```bash
npm install
npm run audio   # optional: encode assets/audio/ for the web (see Audio)
npm run dev
npm run size    # what a first visit downloads (budget 5.25 MB; 5.05 MB today)
```

Desktop browsers get the whole town. Phones get the pocket town (m.html, its
own build): portrait, a smaller town from the same generator, two-thumb
controls and Walk with Hachi, with the full experience left to desktop.

## Controls
The keys that do something where you are standing are always listed in the
corner of the screen, and E's prompt says what it does there ("E · Buy a
mochi ¥200", "E · Take the tour again"), so this table is only for reference.

| Action | Input |
| --- | --- |
| Move | Arrow keys (W A S D also work) |
| Run (outdoors) | Shift |
| Look | Mouse (pointer lock; Esc to release) |
| Interact (the prompt names it) | E |
| Choose at the konbini | 1 to 5 |
| Time of day: morning, golden hour, night | 1 2 3 |
| Back to the start (the famous view, same time of day) | R |
| Whistle for Hachi | F |
| Town map | M |
| Sound on/off | N |
| Pause / resume | Space (Esc also pauses) |

## Audio
Sound files are not included in this repository and are not covered by the
MIT licence. SPEC.md section 9 lists each one and where to get it; save
them into `assets/audio/`, then run `npm run audio`. It cuts, loops,
levels and encodes them as AAC into `public/audio/` (about 3.4 MB, also
never committed), using macOS's built-in `afconvert`. The game falls back
to generated sounds for any file that is missing.

Some of those files are third-party recordings, such as the door chime
(Yasushi Inada's "Melody Chime No.1 大盛況", 1978, still in copyright).
They are not ours, not original to this project and not covered by the MIT
licence; using them is the project owner's call (DECISIONS.md, M3d).

## Credits
Also on the site: [credits.html](public/credits.html), linked from the start card.

- Made by Tan (Tanuj R): [tanuj.fyi](https://tanuj.fyi), and the chip on
  the start card
- Built on Sakura Crossing by Kenton Wang (MIT):
  https://github.com/Kenton-GMI/sakura-crossing
- Mt. Fuji elevation data: 出典：国土地理院. 「標高タイル」（国土地理院）
  （https://maps.gsi.go.jp/development/demtile.html）を加工して作成
- Sound effects: 効果音ラボ (soundeffect-lab.info)
- Sign fonts (SIL Open Font License 1.1, subset): M PLUS Rounded 1c by
  the Rounded M+ Project Authors; Yuji Syuku by the Yuji Project Authors
  (Kinuta Font Factory)
- three.js (MIT); built with Vite (MIT)

## Analytics
The live site (desktop and phone) loads DataFast (datafa.st): page views and a few named
goals (postcard shown, selfie taken, a link clicked). Nothing else leaves the
page, and a selfie never does. A local build loads no analytics.

## Disclaimer
Unofficial fan project. The store, NIPPON, is fictional; its look nods to
Japan's convenience stores, and it is not affiliated with or endorsed by
Lawson, FamilyMart, Seven-Eleven or any other chain. All products in the
game are fictional.
