import { soundBus } from '../../core/soundBus.js';
import { falloff } from '../../core/sound.js';

/* ------------------------------------------------------------------ *
 * The line's procedural sounds (Tan: "braking and acceleration sounds"):
 *
 *   motor     the VVVF inverter's song: an asynchronous carrier whine as
 *             the train starts, then the synchronous modes, each a rising
 *             sweep that drops back as the next mode takes over (the stepped
 *             "wooo-wiii" every Japanese commuter knows), the motor's hum
 *             under it; the same falling as it brakes (regenerative)
 *   rolling   wheel-on-rail rumble with speed, and the joints' ta-tan
 *   squeal    the brakes' squeal in the last metres, and the air let out
 *             once it stands
 *
 * Everything is local to where it happens (config SOUND-style near/far).
 *
 * They are built on the engine's own context and go into its outdoor bus
 * (soundBus.graph(), QA-007): the engine's volume and mute, the pause
 * card's silence, the store's walls and the hidden tab all reach them.
 * ------------------------------------------------------------------ */

export const TRAIN_SOUND = { near: 14, far: 80 };

let ac = null, out = null, noise = null;
const listener = { x: 0, z: 0 };

function ensure() {
  if (ac) return ac;
  const G = soundBus.graph();                     // null before the first click
  if (!G) return null;
  ac = G.ac;
  out = ac.createGain(); out.gain.value = 0.9; out.connect(G.out);
  const n = ac.sampleRate, b = ac.createBuffer(1, n * 2, n), d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  noise = b;
  return ac;
}

let fxOn = 1;
/** Each frame: where the listener is (world). */
export function sfxListen(p) {
  listener.x = p.x; listener.z = p.z;
  if (out && fxOn !== 1) out.gain.setTargetAtTime(0, ac.currentTime, 0.1);
}
/** Director Mode (dev): the trains play through the engine's own graph now (soundBus.graph), so its tap has them:
 * nothing of their own to hand the recording; `sfxOn` still switches them (the effects group). */
export function sfxTap() { return null; }
export function sfxOn(on) { fxOn = on ? 1 : 0; if (out && on) out.gain.setTargetAtTime(0.9, ac.currentTime, 0.1); }

/**
 * One set's running sound.  `step(dt, { v, dv, at, phase })`: speed (m/s),
 * acceleration, the nearest point of the train to the listener (world),
 * the service phase.  Builds its graph when first in range, drops it when
 * out of range.
 */
export function trainVoice() {
  let g = null, lastPhase = null, joint = 0;
  const build = () => {
    const t = ac.currentTime;
    const master = ac.createGain(); master.gain.value = 0; master.connect(out);
    // the carrier: a square through a band, its level the motor's effort
    const car = ac.createOscillator(); car.type = 'square'; car.frequency.value = 1050;
    const carF = ac.createBiquadFilter(); carF.type = 'bandpass'; carF.Q.value = 2.2; carF.frequency.value = 1050;
    const carG = ac.createGain(); carG.gain.value = 0;
    car.connect(carF).connect(carG).connect(master);
    // a second voice an octave up, thin, for the inverter's edge
    const car2 = ac.createOscillator(); car2.type = 'sawtooth'; car2.frequency.value = 2100;
    const car2G = ac.createGain(); car2G.gain.value = 0;
    const car2F = ac.createBiquadFilter(); car2F.type = 'lowpass'; car2F.frequency.value = 3200;
    car2.connect(car2F).connect(car2G).connect(master);
    // the motor's hum, at the stator frequency
    const hum = ac.createOscillator(); hum.type = 'sawtooth'; hum.frequency.value = 20;
    const humF = ac.createBiquadFilter(); humF.type = 'lowpass'; humF.frequency.value = 500;
    const humG = ac.createGain(); humG.gain.value = 0;
    hum.connect(humF).connect(humG).connect(master);
    // rolling: low noise
    const roll = ac.createBufferSource(); roll.buffer = noise; roll.loop = true;
    const rollF = ac.createBiquadFilter(); rollF.type = 'lowpass'; rollF.frequency.value = 380;
    const rollG = ac.createGain(); rollG.gain.value = 0;
    roll.connect(rollF).connect(rollG).connect(master);
    // the brake squeal: a high sine with a wobble
    const sq = ac.createOscillator(); sq.type = 'sine'; sq.frequency.value = 3150;
    const lfo = ac.createOscillator(); lfo.frequency.value = 6.5;
    const lfoG = ac.createGain(); lfoG.gain.value = 60;
    lfo.connect(lfoG).connect(sq.frequency);
    const sqG = ac.createGain(); sqG.gain.value = 0;
    const sq2 = ac.createOscillator(); sq2.type = 'triangle'; sq2.frequency.value = 4720;
    lfoG.connect(sq2.frequency);
    sq.connect(sqG); sq2.connect(sqG); sqG.connect(master);
    for (const o of [car, car2, hum, sq, sq2, lfo]) o.start(t);
    roll.start(t, Math.random());
    return { master, car, carF, carG, car2, car2G, hum, humG, rollG, sqG, nodes: [car, car2, hum, roll, sq, sq2, lfo] };
  };
  const drop = () => {
    if (!g) return;
    const G = g; g = null;
    G.master.gain.setTargetAtTime(0, ac.currentTime, 0.1);
    setTimeout(() => { for (const n of G.nodes) { try { n.stop(); } catch { /* stopped */ } } G.master.disconnect(); }, 600);
  };
  /** The joint clicks: two pairs (the bogies) each rail length. */
  const clack = (level) => {
    const t = ac.currentTime;
    for (const dt of [0, 0.09]) {
      const s = ac.createBufferSource(); s.buffer = noise;
      const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 1.4;
      const e = ac.createGain();
      e.gain.setValueAtTime(level, t + dt); e.gain.exponentialRampToValueAtTime(0.0005, t + dt + 0.07);
      s.connect(f).connect(e).connect(g.master);
      s.start(t + dt, Math.random()); s.stop(t + dt + 0.1);
    }
  };
  /** Air out: after the stop, and as the doors go. */
  const air = (level, dur = 0.9, freq = 3000) => {
    const t = ac.currentTime;
    const s = ac.createBufferSource(); s.buffer = noise;
    const f = ac.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = freq;
    const e = ac.createGain();
    e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(level, t + 0.04); e.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    s.connect(f).connect(e).connect(g.master);
    s.start(t, Math.random()); s.stop(t + dur + 0.05);
  };

  return {
    step(dt, { v, dv, at, phase, visible }) {
      if (!ensure()) return;
      const d = Math.hypot(at.x - listener.x, at.z - listener.z);
      const inRange = visible && d < TRAIN_SOUND.far;
      if (!inRange) { drop(); lastPhase = phase; return; }
      if (!g) g = build();
      const t = ac.currentTime;
      g.master.gain.setTargetAtTime(falloff(d, TRAIN_SOUND), t, 0.08);
      // the inverter: effort when pulling away or braking electrically (above ~2 m/s)
      const power = phase === 'depart' ? Math.min(1, Math.max(0, dv) / 0.8) : phase === 'braking' ? (v > 1.6 ? 0.8 : 0) : 0;
      const fs = Math.max(2, v * 5.2);                               // the stator frequency
      let fc;
      if (v < 4.5) fc = 1050;                                         // asynchronous: a steady whine
      else {
        // synchronous modes: carrier = N x stator, N stepping down as speed rises
        const N = [27, 15, 9, 5, 3].find((n) => n * fs <= 1500) ?? 1;
        fc = N * fs;
      }
      g.car.frequency.setTargetAtTime(fc, t, 0.03);
      g.carF.frequency.setTargetAtTime(fc, t, 0.03);
      g.car2.frequency.setTargetAtTime(fc * 2.01, t, 0.03);
      g.hum.frequency.setTargetAtTime(fs, t, 0.05);
      const whine = power * (v > 0.2 ? 1 : 0) * (1 - Math.min(1, Math.max(0, v - 16) / 6) * 0.6);
      g.carG.gain.setTargetAtTime(0.09 * whine, t, 0.06);
      g.car2G.gain.setTargetAtTime(0.018 * whine, t, 0.06);
      g.humG.gain.setTargetAtTime(0.08 * power * Math.min(1, v / 3), t, 0.08);
      g.rollG.gain.setTargetAtTime(Math.min(0.5, 0.04 + v * 0.022) * (v > 0.1 ? 1 : 0), t, 0.1);
      // the squeal: the last few metres of the stop
      const sq = phase === 'braking' && v < 4.2 ? Math.min(1, (4.2 - v) / 2.5) * (v > 0.05 ? 1 : 0) : 0;
      g.sqG.gain.setTargetAtTime(0.05 * sq, t, 0.05);
      // the rail joints
      if (v > 2) {
        joint += v * dt;
        if (joint > 25) { joint -= 25; clack(Math.min(0.35, v * 0.016)); }
      }
      if (phase !== lastPhase) {
        if (phase === 'opening' && lastPhase === 'braking') air(0.22, 1.2, 2600);     // the brakes let off
        else if (phase === 'opening') air(0.08, 0.5, 4000);
        if (phase === 'closing') air(0.1, 0.6, 3600);
      }
      lastPhase = phase;
    },
    stop: drop,
  };
}
