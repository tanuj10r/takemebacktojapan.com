/* ------------------------------------------------------------------ *
 * Recording (Director Mode, dev only; Part 1.9-1.10, Version C's 4K).
 *
 *   makeRecorder        real time: MediaRecorder on the out canvas's
 *                       captureStream(60) and every game sound (the
 *                       engine's master and the train's own graph, mixed
 *                       into one MediaStreamAudioDestinationNode); MP4 when
 *                       the browser records it directly, else WebM
 *   renderDeterministic frame by frame at exactly 1/60 s: each frame drawn
 *                       and encoded with WebCodecs (H.264), the audio mixed
 *                       offline from the version's cue list and encoded
 *                       (AAC), both muxed into an MP4 by the small muxer
 *                       below (no ffmpeg on this Mac; none needed)
 * Files download to the browser's downloads folder.
 * ------------------------------------------------------------------ */

function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 60000);
}

export function makeRecorder({ canvas, sound, sfxTap, onState }) {
  const types = [
    'video/mp4;codecs=avc1.640033,mp4a.40.2', 'video/mp4;codecs=avc1.640033,opus', 'video/mp4',
    'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm',
  ];
  return {
    start(name, done) {
      const mime = types.find((t) => window.MediaRecorder?.isTypeSupported?.(t)) ?? '';
      const video = canvas.captureStream(60);
      const tap = sound.tap();
      const tracks = [...video.getVideoTracks()];
      if (tap) {
        try { const tr = sfxTap?.(); if (tr) tap.ac.createMediaStreamSource(tr).connect(tap.node); } catch { /* the train's graph not up yet */ }
        tracks.push(...tap.stream.getAudioTracks());
      }
      const rec = new MediaRecorder(new MediaStream(tracks), { mimeType: mime || undefined, videoBitsPerSecond: 24e6, audioBitsPerSecond: 192000 });
      const parts = [];
      rec.ondataavailable = (e) => { if (e.data.size) parts.push(e.data); };
      let cancelled = false;
      rec.onstop = () => {
        onState?.(false);
        if (!cancelled) {
          const ext = (rec.mimeType || mime).includes('mp4') ? 'mp4' : 'webm';
          const blob = new Blob(parts, { type: rec.mimeType || mime });
          window.__lastRecording = { name: `${name}.${ext}`, size: blob.size, mime: rec.mimeType || mime };
          download(blob, `${name}.${ext}`);
        }
        done?.();
      };
      rec.start(250);
      onState?.(true);
      return { stop(cancel = false) { cancelled = cancel; if (rec.state !== 'inactive') rec.stop(); }, rec };
    },
  };
}

/* ---------------------------------------- the deterministic render ---------------------------------------- */
export async function renderDeterministic({ name, w, h, fps = 60, total, canvas, sound, version, seek, progress, voices }) {
  const n = Math.round(total * fps);
  const chunksV = [], chunksA = [];
  let vConfig = null, aConfig = null;
  // the video encoder: H.264 High, level 5.1 (2160x3840 fits), about 45 Mbps at 4K
  const codec = w * h > 2.2e6 ? 'avc1.640033' : 'avc1.64002A';
  const vcfg = { codec, width: w, height: h, bitrate: w * h > 2.2e6 ? 45e6 : 20e6, framerate: fps, avc: { format: 'avc' }, latencyMode: 'quality', bitrateMode: 'variable' };
  const sup = await VideoEncoder.isConfigSupported(vcfg);
  if (!sup.supported) throw new Error('H.264 at this size is not supported by this browser: ' + JSON.stringify(vcfg));
  const venc = new VideoEncoder({
    output: (c, meta) => { const b = new Uint8Array(c.byteLength); c.copyTo(b); chunksV.push({ data: b, ts: c.timestamp, dur: c.duration, key: c.type === 'key' }); if (meta?.decoderConfig) vConfig = meta.decoderConfig; },
    error: (e) => { throw e; },
  });
  venc.configure(vcfg);
  for (let f = 0; f < n; f++) {
    seek(f / fps);
    const frame = new VideoFrame(canvas, { timestamp: Math.round(f * 1e6 / fps), duration: Math.round(1e6 / fps) });
    venc.encode(frame, { keyFrame: f % (fps * 2) === 0 });
    frame.close();
    if (venc.encodeQueueSize > 6) await new Promise((r) => { const t = () => (venc.encodeQueueSize > 2 ? setTimeout(t, 2) : r()); t(); });
    if (f % 30 === 0) { progress?.(f, n); await new Promise((r) => setTimeout(r, 0)); }
  }
  await venc.flush();
  venc.close();

  // the audio: the version's cue list, mixed offline (the same clips, times, gains and fades the real-time take plays)
  const sr = 48000;
  const off = new OfflineAudioContext(2, Math.ceil(total * sr), sr);
  const man = await (await fetch('audio/manifest.json')).json();
  const buf = {};
  for (const c of version.cues ?? []) {
    if (buf[c.name] || !man[c.name]) continue;
    buf[c.name] = await off.decodeAudioData(await (await fetch('audio/' + man[c.name].file)).arrayBuffer());
  }
  for (const c of version.cues ?? []) {
    const b = buf[c.name];
    if (!b) continue;
    const s = off.createBufferSource();
    s.buffer = b; s.loop = !!c.loop; s.loopStart = c.loopStart ?? 0; s.loopEnd = c.loopEnd ?? 0;
    const g = off.createGain();
    const t0 = c.t, len = c.dur ?? b.duration, fi = c.fadeIn ?? 0.02, fo = c.fadeOut ?? 0.05;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(c.gain, t0 + fi);
    g.gain.setValueAtTime(c.gain, Math.max(t0 + fi, t0 + len - fo));
    g.gain.linearRampToValueAtTime(0, t0 + len);
    s.connect(g).connect(off.destination);
    s.start(t0, c.offset ?? 0);
    s.stop(t0 + len + 0.05);
  }
  // the dog's voice (recipes rendered by the engine into this context) and its files, at their times
  for (const v of voices?.() ?? []) {
    if (v.t < 0 || v.t > total) continue;
    if (!sound.renderRecipe(off, off.destination, v.name, v.t, v.gain ?? 0.7) && man[v.name]) {
      const b = buf[v.name] ?? (buf[v.name] = await off.decodeAudioData(await (await fetch('audio/' + man[v.name].file)).arrayBuffer()));
      const s2 = off.createBufferSource(), g2 = off.createGain(); g2.gain.value = v.gain ?? 0.7;
      s2.buffer = b; s2.connect(g2).connect(off.destination); s2.start(v.t);
    }
  }
  const mix = await off.startRendering();
  const acodec = (await AudioEncoder.isConfigSupported({ codec: 'mp4a.40.2', sampleRate: sr, numberOfChannels: 2, bitrate: 192000 })).supported ? 'mp4a.40.2' : 'opus';
  const aenc = new AudioEncoder({
    output: (c, meta) => { const b = new Uint8Array(c.byteLength); c.copyTo(b); chunksA.push({ data: b, ts: c.timestamp, dur: c.duration }); if (meta?.decoderConfig) aConfig = meta.decoderConfig; },
    error: (e) => { throw e; },
  });
  aenc.configure({ codec: acodec, sampleRate: sr, numberOfChannels: 2, bitrate: 192000 });
  const L = mix.getChannelData(0), R = mix.getChannelData(1);
  const FR = 1024;
  for (let i = 0; i < L.length; i += FR) {
    const k = Math.min(FR, L.length - i);
    const data = new Float32Array(k * 2);
    data.set(L.subarray(i, i + k), 0); data.set(R.subarray(i, i + k), k);
    const ad = new AudioData({ format: 'f32-planar', sampleRate: sr, numberOfFrames: k, numberOfChannels: 2, timestamp: Math.round(i * 1e6 / sr), data });
    aenc.encode(ad);
    ad.close();
  }
  await aenc.flush();
  aenc.close();

  const file = muxMP4({ w, h, fps, video: chunksV, vConfig, audio: chunksA, aConfig, acodec, sr });
  const blob = new Blob([file], { type: 'video/mp4' });
  window.__lastRecording = { name: `${name}.mp4`, size: blob.size, frames: n, video: chunksV.length, audio: chunksA.length, codec, acodec };
  download(blob, `${name}.mp4`);
  return window.__lastRecording;
}

/* ---------------------------------------- a small MP4 muxer ----------------------------------------
 * One video (avc1) and one audio track (mp4a, or Opus), each sample its own chunk, mdat before moov.  Enough for
 * QuickTime, Chrome and editors. */
function muxMP4({ w, h, fps, video, vConfig, audio, aConfig, acodec, sr }) {
  const enc = new TextEncoder();
  const u32 = (v) => [(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255];
  const u16 = (v) => [(v >>> 8) & 255, v & 255];
  const str = (s) => [...enc.encode(s)];
  const box = (type, ...parts) => {
    const body = parts.flat(Infinity);
    return [...u32(body.length + 8), ...str(type), ...body];
  };
  const full = (type, ver, flags, ...parts) => box(type, [ver, (flags >> 16) & 255, (flags >> 8) & 255, flags & 255], ...parts);
  const matrix = [...u32(0x00010000), ...u32(0), ...u32(0), ...u32(0), ...u32(0x00010000), ...u32(0), ...u32(0), ...u32(0), ...u32(0x40000000)];

  // decode order is output order; composition offsets if the encoder reordered (B-frames)
  const vts = 6000, vdelta = Math.round(vts / fps);
  const vSizes = video.map((c) => c.data.length), aSizes = audio.map((c) => c.data.length);
  const ftyp = box('ftyp', str('isom'), u32(0x200), str('isom'), str('iso2'), str('avc1'), str('mp41'));
  // mdat
  const mdatLen = 8 + vSizes.reduce((a, b) => a + b, 0) + aSizes.reduce((a, b) => a + b, 0);
  let off = ftyp.length + 8;
  const vOff = [], aOff = [];
  // interleave by time so players read smoothly
  const order = [...video.map((c, i) => ({ k: 'v', i, t: c.ts })), ...audio.map((c, i) => ({ k: 'a', i, t: c.ts }))].sort((a, b) => a.t - b.t || (a.k === 'v' ? -1 : 1));
  for (const o of order) { if (o.k === 'v') { vOff[o.i] = off; off += vSizes[o.i]; } else { aOff[o.i] = off; off += aSizes[o.i]; } }

  const vDur = video.length * vdelta;
  const aDurSamples = audio.reduce((a, c) => a + Math.round((c.dur ?? 21333) * sr / 1e6), 0);
  const movieDur = Math.round(Math.max(vDur / vts, aDurSamples / sr) * 1000);
  const mvhd = full('mvhd', 0, 0, u32(0), u32(0), u32(1000), u32(movieDur), u32(0x00010000), u16(0x0100), u16(0), u32(0), u32(0), matrix, [...Array(24)].map(() => 0), u32(3));
  const dinf = box('dinf', full('dref', 0, 0, u32(1), full('url ', 0, 1)));
  // video
  const pts = video.map((c) => Math.round(c.ts * vts / 1e6));
  const ctts = pts.some((p, i) => p !== i * vdelta) ? full('ctts', 1, 0, u32(video.length), pts.map((p, i) => [...u32(1), ...u32((p - i * vdelta) | 0)])) : [];
  const avcC = box('avcC', [...new Uint8Array(vConfig.description)]);
  const avc1 = box('avc1', [0, 0, 0, 0, 0, 0], u16(1), [...Array(16)].map(() => 0), u16(w), u16(h), u32(0x00480000), u32(0x00480000), u32(0), u16(1), [...Array(32)].map(() => 0), u16(0x18), u16(0xffff), avcC);
  const vstbl = box('stbl',
    full('stsd', 0, 0, u32(1), avc1),
    full('stts', 0, 0, u32(1), u32(video.length), u32(vdelta)),
    ctts,
    full('stss', 0, 0, u32(video.filter((c) => c.key).length), video.map((c, i) => (c.key ? u32(i + 1) : [])).flat()),
    full('stsc', 0, 0, u32(1), u32(1), u32(1), u32(1)),
    full('stsz', 0, 0, u32(0), u32(video.length), vSizes.map(u32).flat()),
    full('stco', 0, 0, u32(video.length), vOff.map(u32).flat()));
  const vtrak = box('trak',
    full('tkhd', 0, 3, u32(0), u32(0), u32(1), u32(0), u32(Math.round(vDur / vts * 1000)), u32(0), u32(0), u16(0), u16(0), u16(0), u16(0), matrix, u32(w << 16), u32(h << 16)),
    box('mdia', full('mdhd', 0, 0, u32(0), u32(0), u32(vts), u32(vDur), u16(0x55c4), u16(0)),
      full('hdlr', 0, 0, u32(0), str('vide'), u32(0), u32(0), u32(0), str('Video\0')),
      box('minf', full('vmhd', 0, 1, u16(0), u16(0), u16(0), u16(0)), dinf, vstbl)));
  // audio
  let sampleEntry;
  if (acodec === 'mp4a.40.2') {
    const asc = aConfig?.description ? [...new Uint8Array(aConfig.description)] : [0x11, 0x90];
    const desc = (tag, body) => [tag, 0x80, 0x80, 0x80, body.length, ...body];
    const dcd = desc(0x04, [0x40, 0x15, 0, 0, 0, ...u32(192000), ...u32(192000), ...desc(0x05, asc)]);
    const es = desc(0x03, [0, 2, 0, ...dcd, ...desc(0x06, [0x02])]);
    sampleEntry = box('mp4a', [0, 0, 0, 0, 0, 0], u16(1), u32(0), u32(0), u16(2), u16(16), u16(0), u16(0), u32(sr << 16 >>> 0), full('esds', 0, 0, es));
  } else {
    const dOps = box('dOps', [0, 2], u16(312), u32(sr), u16(0), [0]);
    sampleEntry = box('Opus', [0, 0, 0, 0, 0, 0], u16(1), u32(0), u32(0), u16(2), u16(16), u16(0), u16(0), u32(sr << 16 >>> 0), dOps);
  }
  const aDurs = audio.map((c) => Math.round((c.dur ?? 21333) * sr / 1e6));
  const stts = [];
  for (const d of aDurs) { const last = stts[stts.length - 1]; if (last && last[1] === d) last[0]++; else stts.push([1, d]); }
  const astbl = box('stbl',
    full('stsd', 0, 0, u32(1), sampleEntry),
    full('stts', 0, 0, u32(stts.length), stts.map(([c, d]) => [...u32(c), ...u32(d)]).flat()),
    full('stsc', 0, 0, u32(1), u32(1), u32(1), u32(1)),
    full('stsz', 0, 0, u32(0), u32(audio.length), aSizes.map(u32).flat()),
    full('stco', 0, 0, u32(audio.length), aOff.map(u32).flat()));
  const atrak = box('trak',
    full('tkhd', 0, 3, u32(0), u32(0), u32(2), u32(0), u32(Math.round(aDurSamples / sr * 1000)), u32(0), u32(0), u16(0), u16(1), u16(0x0100), u16(0), matrix, u32(0), u32(0)),
    box('mdia', full('mdhd', 0, 0, u32(0), u32(0), u32(sr), u32(aDurSamples), u16(0x55c4), u16(0)),
      full('hdlr', 0, 0, u32(0), str('soun'), u32(0), u32(0), u32(0), str('Sound\0')),
      box('minf', full('smhd', 0, 0, u16(0), u16(0)), dinf, astbl)));
  const moov = box('moov', mvhd, vtrak, audio.length ? atrak : []);

  const outLen = ftyp.length + mdatLen + moov.length;
  const outBuf = new Uint8Array(outLen);
  let p = 0;
  outBuf.set(ftyp, p); p += ftyp.length;
  outBuf.set([...u32(mdatLen), ...str('mdat')], p); p += 8;
  for (const o of order) { const d = o.k === 'v' ? video[o.i].data : audio[o.i].data; outBuf.set(d, p); p += d.length; }
  outBuf.set(moov, p);
  return outBuf;
}
