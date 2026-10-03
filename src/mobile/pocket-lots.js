import { SPECIALS } from '../world/town-plan.js';

/* The pocket town's special lots (plan.js has set config.js; town-plan.js read it as it loaded).  On the desktop
 * the shrine stands on lane z 80 behind the store and ドンペン堂 halfway down the shopping street; here the shrine
 * fronts the main road beside the store (the key art's torii, left of NIPPON) and ドンペン堂 takes the shopping
 * lane's corner (its jingle, right of NIPPON).  What the pocket town has no room for goes: the coin parking, the
 * apartment and the vacant lot. */
const keep = SPECIALS.filter((s) => !['coinParking', 'apartment', 'vacant', 'park'].includes(s.kind));
for (const s of keep) {
  if (s.kind === 'shrine') Object.assign(s, { x0: 44, z0: 20.5, x1: 58, z1: 39.3, face: 'z-' });
  if (s.kind === 'megastore') Object.assign(s, { x0: -69.3, z0: 20.5, x1: -55.3, z1: 38.3, face: 'x+' });
}
SPECIALS.length = 0;
SPECIALS.push(...keep);
