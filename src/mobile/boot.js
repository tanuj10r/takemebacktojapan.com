/* The phone page's entry (m.html): loaded only when the page's own check found WebGL 2.  The mini town's plan
 * first (plan.js sets config.js to the compact Fujikawaguchikko before any builder reads it:
 * docs/decisions/mobile-lite.md, "Mobile v3"), then the game. */
import './plan.js';
import './pocket-lots.js';   // (the special lots, moved to the pocket plan: after plan.js, before any builder)
import './sakura-seen.js'; // (which cherries the famous views see: kept, not found again at every load)
import './pages.js';     // (the konbini's pages painted at a phone's size: before world/store/ makes any)
import './main.js';
