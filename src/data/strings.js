/* All player-facing UI text (AGENTS.md). */

/* The game's name (Tan, 2026-09-28: it lives at takemebacktojapan.com).  The
 * town keeps its own name (data/town.js TOWN_NAME), shown as the place line;
 * the store stays NIPPON.  docs/decisions/start-screens.md. */
export const GAME = {
  title: 'Take Me Back to Japan',
  titleJp: '日本へ、もう一度',
  url: 'takemebacktojapan.com',
};

/* Every key the game answers to, once: the start and pause cards list them
 * all in this order (core/hud.js) and the corner panel shows the ones that
 * belong where you stand (main.js controlRows, ui/controls.js), from here.
 * `keys` are drawn as key caps.  WASD still walks, unadvertised (Tan: the
 * arrow keys are the ones shown). */
const CONTROLS = {
  move: { keys: ['↑', '↓', '←', '→'], what: 'Move' },
  look: { keys: ['Mouse'], what: 'Look around' },
  run: { keys: ['Shift'], what: 'Run' },
  interact: { keys: ['E'], what: 'Interact' },
  views: { keys: ['1', '2', '3'], what: 'Time of day' },
  home: { keys: ['R'], what: 'Back to the start' },
  whistle: { keys: ['F'], what: 'Whistle for Hachi' },
  map: { keys: ['M'], what: 'Map' },
  sound: { keys: ['N'], what: 'Sound' },
  pause: { keys: ['Space'], what: 'Pause' },
};

export const STRINGS = {
  title: GAME.title,
  titleJp: GAME.titleJp,
  url: GAME.url,
  tagline: 'A small town under Mt. Fuji. Take your time.',
  paused: 'Paused',
  start: 'Start',
  /* Space was pressed but the browser wants a click for the pointer (some do): the card stays, and says so */
  pointerRefused: { start: 'This browser wants a click: press Start', resume: 'This browser wants a click: press Resume' },
  resume: 'Resume',
  volume: 'Volume',
  volumeAria: 'Volume',
  controlsTitle: 'Controls',
  credit: 'Built on Sakura Crossing (MIT)',
  credits: 'Credits',
  artAlt: 'Golden hour under Mt. Fuji: a shiba sits on a zebra crossing by a green walk light, a local train waits at the level crossing, a red torii, the NIPPON konbini, the ドンペン堂 megastore, Han leaning on his orange RX-7, a bench and a jizo under cherry blossom.',
  /* The cards' list, in order (every key). */
  controls: Object.values(CONTROLS),
  /* The corner panel's rows, by name: [key caps, what it does]. */
  control: (id) => [CONTROLS[id].keys, CONTROLS[id].what],
  /* Rows only the corner panel shows, where they apply. */
  keys: {
    choose: 'Choose',
    closeMap: 'Close the map',
    standUp: 'Stand up',
  },
  soundOn: 'Sound on',
  soundOff: 'Sound off',
  coordsOn: 'coordinates on',
  coordsOff: 'coordinates off',
  copied: 'copied',
  /* Hachi's hello (the guide pup, animals/guide.js): a caption the first time you look at it, off the famous view */
  /* Waiting on platform 1 for the next train (world/line/station.js, ui/trainWait.js): "Next train · 0:25" */
  nextTrain: (secs) => `Next train  ·  ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`,
  hachi: {
    hi: "Hi, I'm Hachi!", line: "Follow me, I'll show you around town. Wander off whenever you like: press F to whistle and I'll come running.",
    /* after the tour, Hachi by you and looked at: the prompt ("E · ..."), and the note when the tour starts over */
    again: 'Take the tour again', againToast: 'Off we go again. Follow Hachi',
  },
  map: {
    titleJp: '富士川口湖町 マップ',
    title: 'Fujikawaguchikko',
    close: 'M to close',
    here: 'You are here',
    todo: 'Things to do',
    hear: 'Things to hear',
    north: 'N',
    scale: (m) => `${m} m`,
    /* The places' labels (config.js PLACES): English, the Japanese name small beside it. */
    // (`short`: the phone's whole map, one short line a place)
    places: {
      lawson: { en: 'Nippon Mart', jp: 'ニッポン', short: "Konbini" },
      start: { en: 'Nippon Mart Viewpoint', jp: '富士山ビュー', short: "Fuji view" },
      han: { en: 'Tokyo Drift', jp: 'ハンのRX-7', short: "Tokyo Drift" },
      spine: { en: 'Shopping street', jp: '商店街', short: "Shops" },
      donpen: { en: 'Donpen-do', jp: 'ドンペン堂', short: "Donpen-do" },
      shrine: { en: 'Inari shrine', jp: '富士見稲荷神社', short: "Shrine" },
      plaza: { en: 'Station plaza', jp: '駅前広場', short: "Plaza" },
      station: { en: 'Fujikawaguchikko Station', jp: '富士川口湖駅', short: "Station" },
      crossing: { en: 'Level crossing', jp: '踏切', short: "Crossing" },
      hachiHome: { en: "Hachi's home", jp: 'ハチのおうち', short: "Hachi's home" },
      pond: { en: 'Kagami Pond', jp: '鏡池', short: "Pond" },
      slowlife: { en: 'Slow-life bench', jp: 'ひと休み', short: "Bench" },
      river: { en: 'The river', jp: '桜川', short: "River" },
      deerGate: { en: 'Deer Park (coming soon)', jp: '鹿公園', short: "Deer Park (soon)" },
      mochi: { en: 'Mochi pounding', jp: 'もちつき', short: "Mochi" },
    },
  },
  /* ぺったん堂, the mochi-pounding shop (world/mochi/): the E prompt on its ring, the toast as your card taps, and the one once you've eaten */
  mochi: {
    name: 'Mochi pounding',
    jp: 'もちつき',
    buy: (yen) => `Order a mochi  ¥${yen}`,
    paid: (yen) => `Paid  ¥${yen}`,
    ate: 'Still warm. Step back onto the highlight for another',
  },
  /* The konbini (Tan's experience): English only; product names come from
   * the catalogue (the Japanese shown small beside them). */
  store: {
    menuTitle: 'What would you like?',
    menuHint: 'Press a number',
    recommended: 'Recommended',
    menuNames: { strong_nine: 'Strong Nine' },
    menuNotes: { strong_nine: 'Lemon beer · 9%' },
    notOut: 'Pay at the till first',
    ate: 'Delicious. Step back onto the highlight for another',
    tipsy: 'That Strong Nine is living up to its name',
  },
  /* Made by Tan (ui/maker.js): the chip on every card, the postcard when Hachi's tour is over */
  maker: {
    name: 'Made by Tan',
    line: 'Free, no ads. Say hi?',
    follow: 'Free, no ads. Follow along for the next town.',
    coffee: 'Coffee',
    coffeeLong: 'Buy Tan a coffee',
    x: 'Tan on X',
    github: 'Tan on GitHub',
    site: 'Tan’s site, tanuj.fyi',
    avatarAlt: 'Tan',
  },
  postcard: {
    label: 'A postcard from Fujikawaguchikko',
    title: 'Greetings from Fujikawaguchikko',
    msg: 'You’ve seen the whole town, and Hachi’s napping by the gate. Send it to someone who misses Japan too.',
    /* opened from the pause card before Hachi's tour is over */
    msgEarly: 'Wish you were here. A little town under Mt. Fuji, and a shiba called Hachi to show you round. Send it to someone who misses Japan too.',
    to: 'To: a friend who misses Japan',
    share: 'Share',
    copy: 'Copy link',
    copied: 'Link copied',
    post: 'Post',
    postAria: 'Post it on X',
    shareText: 'I just walked a little town under Mt. Fuji, in my browser.',
    save: 'Save postcard',
    /* the postcard as a picture (ui/postcardImage.js): what Share and Save send */
    image: {
      msg: 'Wish you were here. It’s a little town under Mt. Fuji that you walk around in your browser: a konbini, a train, mochi-pounding rabbits, and a shiba called Hachi to show you round.',
      from: 'From: me, and Hachi the shiba',
      play: 'Walk it yourself:',
    },
    follow: 'Follow for the next town.',
    back: 'Back',
    backAria: 'Back to the menu',
    close: 'Space to walk on  ·  Back or Esc for the menu',
    closeTouch: 'Back, or a tap outside the card, for the menu',
    /* the selfie postcard (ui/postcardSelfie.js): asked for, never by itself */
    selfie: {
      add: 'Add your selfie with Hachi',
      note: 'Your photo stays on your device',
      /* the words on the writing side, by where it is */
      say: {
        ask: 'Allow the camera when your browser asks.',
        live: 'Smile! Hachi wants to be in it too.',
        done: 'There you are, with Hachi. Save it, or share the postcard.',
        blocked: 'The camera is blocked for this site. Click the camera or lock icon in the address bar, allow the camera, then try again.',
        none: 'No camera was found on this device. Plug one in, then try again.',
        busy: 'The camera is busy in another app. Close it there, then try again.',
      },
      shutter: 'Take photo',
      again: 'Try again',
      cancel: 'Cancel',
      remove: 'Remove',
      retake: 'Retake',
      save: 'Save image',
      caption: 'Hachi and me',
      alt: 'Your postcard: your photo in Fujikawaguchikko, Hachi peeking over it',
      file: 'takemebacktojapan-postcard.jpg',
    },
    /* the little postcard by the pause card, every pause */
    mini: 'Your postcard ✉',
    miniAria: 'Open your postcard: add your selfie with Hachi',
  },
  /* The sounds' names, shown top left as you come near one (ui/soundLabels.js), keyed by the engine's names:
   * [japanese, english, a few words more].  Han's song is not named (AGENTS.md: no titles). */
  soundNames: {
    'walk-piyo': ['ぴよぴよ', 'crosswalk chick'],
    'walk-kakko': ['カッコー', 'crosswalk cuckoo'],
    'railway-bells': ['カンカン', 'level crossing'],
    'train-arrive': ['電車', 'train arriving'],
    'train-chime': ['ドアチャイム', 'door chime'],
    'train-depart': ['発車', 'train departing'],
    'train-nextstop': ['次は渋谷', 'next stop, Shibuya'],
    'station-ambience': ['駅のアナウンス', 'station announcements'],
    'shrine-chimes': ['風鈴', 'wind chimes'],
    'rural-flute': ['のんびり', 'slow life'],
    'donki-theme': ['ドンペン堂', 'megastore jingle'],
    'store-chime': ['入店チャイム', 'konbini door chime'],
    'store-music': ['店内BGM', 'store music'],
    'kiosk-scan': ['ピッ', 'self-checkout beep'],
    'ka-ching': ['チャリン', 'ka-ching'],
    'han-drift': ['ドリフト', 'Han’s drift'],
    'mochi-pound': ['もちつき', 'mochi pounding'],
    birds: ['小鳥', 'birdsong'],
    crows: ['カラス', 'crows'],
    'night-insects': ['虫の声', 'night insects'],
    wind: ['風', 'wind'],
  },
  refOn: 'reference overlay on',
  refOff: 'reference overlay off',
  /* The cards index.html paints before the game's code runs (QA-001/003/004/012).
   * vite.config.js writes these into index.html at build time (%S:boot.loading%),
   * so a phone reads them without downloading the game. */
  boot: {
    loading: 'Loading the town…',
    building: 'Building the town…',
    ready: 'Almost there…',
  },
  gate: {
    phoneTitle: 'Best on a computer',
    phone: 'A small town under Mt. Fuji, made to be walked with a keyboard and mouse. Open this link on a desktop or laptop for the full stroll.',
    copy: 'Copy link',
    share: 'Share',
    copied: 'Link copied',
    noglTitle: 'Your browser can’t draw the town',
    nogl: 'This game needs WebGL 2, which is turned off or not available here. Try the latest Chrome, Edge, Firefox or Safari on a computer, with hardware acceleration on.',
    lostTitle: 'The graphics card reset',
    lost: 'Reload to continue.',
    reload: 'Reload',
  },
};

/* The phone build's words (src/mobile/, m.html: `%S:m.key%`), English as
 * the desktop's.  The desktop game never imports this. */
export const MOBILE_STRINGS = {
  start: 'Start',
  loading: 'Loading the town…',
  building: 'Building the town…',
  ready: 'Almost there…',
  /* the start card: one line, and a small second one */
  tagline: 'A pocket-sized Japan. Best with sound on 🎧',
  desktop: 'Full town on desktop',
  /* (an iPhone in a browser tab: the one way past the URL bar) */
  homeScreen: 'Full screen: Share, then Add to Home Screen',
  rotate: 'Turn your phone sideways for a wider view',
  soundBack: 'Tap to bring the sound back',
  paused: 'Paused',
  resume: 'Resume',
  restart: 'Back to the start',
  volume: 'Volume',
  /* the buttons' labels, under their icons (and what a screen reader says) */
  buttons: { hachi: 'Hachi', time: 'Time', pause: 'Pause', map: 'Map' },
  aria: { hachi: 'Whistle for Hachi', time: 'Change the time of day', pause: 'Pause', map: 'Open the map', act: 'Interact' },
  /* until each has been done once */
  hints: { walk: 'Hold to walk', look: 'Drag to look around' },   // (the stick: a thumb held on it walks, Tan 2026-10-03)
  /* the portrait phone's bottom panel (mobile/panel.js) */
  panel: {
    walkWithHachi: 'Walk with Hachi', walkSub: 'he leads, you look',
    stopFollowing: 'Stop here', followingSub: 'walking behind Hachi',
    heading: (place) => `Hachi is heading to ${place}`, stop: (k, n) => `Stop ${k} of ${n}`, next: 'the next stop',
    overTitle: 'You’ve seen the whole town', overLine: 'Wander as you like, or take the tour again',
    idleTitle: 'Fujikawaguchikko', idleLine: 'Walk with Hachi, or explore on your own',
    holdHint: 'Hold the picture to walk · slide to steer',
    switchTitle: 'Controls', schemes: { pad: 'Pad', hold: 'Hold to walk', stick: 'Two thumbs' },
    turn: 'Turn your phone upright',
    /* [name, a line about it]: the guide line at a place */
    places: {
      view: ['The famous view', 'NIPPON with Mt. Fuji behind it'],
      konbini: ['NIPPON · ニッポン', 'Pick a snack, pay at the till, eat it outside'],
      han: ['Han’s RX-7', 'Say hello, and watch him drift'],
      mochi: ['ぺったん堂 · mochi pounding', 'Three moon rabbits pound fresh mochi'],
      train: ['The station · 富士川口湖駅', 'Wait for the train and listen'],
      slowlife: ['The bench · ひと休み', 'Sit a while and look at Fuji'],
      gate: ['Deer Park · 鹿公園', 'Coming soon. Hachi naps here'],
      home: ['Hachi’s home · ハチのおうち', 'His garden, his ball, his bed'],
      shrine: ['The shrine · 富士見稲荷', 'Wind chimes and a guardian fox'],
      donki: ['ドンペン堂', 'A loud, happy megastore'],
      station: ['The station · 富士川口湖駅', 'Announcements on the platform'],
      crossing: ['The level crossing · 踏切', 'Bells, barriers, the train going by'],
    },
  },
  closeMap: 'Tap to close',
  times: { morning: 'Morning', golden: 'Golden hour', night: 'Night' },
  timeShort: { morning: 'Morning', golden: 'Golden', night: 'Night' },
  /* Hachi's hello, in touch words (animals/guide.js reads STRINGS.hachi) */
  hachiLine: "Follow me, I'll show you around town. Wander off whenever you like: tap the paw 🐾 and I'll come running.",
  menuHint: 'Tap one',
  /* the postcard on a phone (ui/postcard.js, ui/postcardSelfie.js read STRINGS.postcard) */
  selfie: {
    insecure: 'The camera only works on a secure (https) page. Open takemebacktojapan.com to add your selfie.',
    blocked: 'The camera is blocked for this site. Allow it in your browser’s settings for this page, then try again.',
    none: 'No camera was found on this phone.',
    save: 'Save or share',
  },
  gate: {
    noglTitle: 'Your phone can’t draw the town',
    nogl: 'This game needs WebGL 2. Try the latest Safari or Chrome, or open the link on a computer.',
    lostTitle: 'The town was put away',
    lost: 'Your phone needed its memory back. Reload to walk on.',
    reload: 'Reload',
  },
};
