// dev: what is in an MP4 (plain or fragmented): each track's kind, samples, duration and so its frame rate.
//   node scripts/_mp4-info.mjs <file.mp4>
import fs from 'node:fs';
const b = fs.readFileSync(process.argv[2]);
const tracks = {}; let cur = null;
function walk(a, z, depth = 0) {
  while (a + 8 <= z) {
    let size = b.readUInt32BE(a); const type = b.toString('latin1', a + 4, a + 8); let h = 8;
    if (size === 1) { size = Number(b.readBigUInt64BE(a + 8)); h = 16; } else if (size === 0) size = z - a;
    const body = a + h, end = a + size;
    if (['moov', 'trak', 'mdia', 'minf', 'stbl', 'moof', 'traf', 'mvex'].includes(type)) { if (type === 'trak') cur = { samples: 0, deltas: [] }; walk(body, end, depth + 1); if (type === 'trak') { tracks[cur.id] = cur; cur = null; } }
    else if (type === 'tkhd') { const v = b[body]; cur.id = b.readUInt32BE(body + (v ? 20 : 12)); }
    else if (type === 'mdhd') { const v = b[body]; cur.scale = b.readUInt32BE(body + (v ? 20 : 12)); cur.dur = v ? Number(b.readBigUInt64BE(body + 24)) : b.readUInt32BE(body + 16); }
    else if (type === 'hdlr') cur.kind = b.toString('latin1', body + 8, body + 12);
    else if (type === 'stsz') cur.samples += b.readUInt32BE(body + 8);
    else if (type === 'stts') { const n = b.readUInt32BE(body + 4); for (let i = 0; i < n; i++) cur.deltas.push([b.readUInt32BE(body + 8 + i * 8), b.readUInt32BE(body + 12 + i * 8)]); }
    else if (type === 'tfhd') { const fl = b.readUInt32BE(body) & 0xffffff; const id = b.readUInt32BE(body + 4); cur = tracks[id]; let p = body + 8; if (fl & 1) p += 8; if (fl & 2) p += 4; cur.defDur = fl & 8 ? b.readUInt32BE(p) : cur.defDur; }
    else if (type === 'trun') { const fl = b.readUInt32BE(body) & 0xffffff, n = b.readUInt32BE(body + 4); let p = body + 8; if (fl & 1) p += 4; if (fl & 4) p += 4; const per = ((fl & 0x100) ? 4 : 0) + ((fl & 0x200) ? 4 : 0) + ((fl & 0x400) ? 4 : 0) + ((fl & 0x800) ? 4 : 0);
      for (let i = 0; i < n; i++) { const d = fl & 0x100 ? b.readUInt32BE(p + i * per) : cur.defDur ?? 0; cur.samples++; cur.fragDur = (cur.fragDur ?? 0) + d; (cur.ds ??= []).push(d); } }
    a = end;
  }
}
walk(0, b.length);
for (const t of Object.values(tracks)) {
  const dur = (t.fragDur ?? t.dur) / t.scale;
  const ds = t.ds ?? t.deltas.flatMap(([n, d]) => Array(Math.min(n, 100000)).fill(d));
  const sorted = [...ds].sort((x, y) => x - y), ms = (d) => +(d / t.scale * 1000).toFixed(1);
  console.log(JSON.stringify({ kind: t.kind, samples: t.samples, dur: +dur.toFixed(3), rate: +(t.samples / dur).toFixed(2), ...(t.kind === 'vide' ? { frameMs: { median: ms(sorted[sorted.length >> 1]), p95: ms(sorted[Math.floor(sorted.length * 0.95)]), max: ms(sorted[sorted.length - 1]) } } : {}) }));
}
