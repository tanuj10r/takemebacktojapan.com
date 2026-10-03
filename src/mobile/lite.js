import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { MOBILE, TOWN, ANIMALS, LAWSON } from '../config.js';
import { decalAtlas } from '../world/kit/tex.js';
import { storePages } from '../world/store/pages.js';
import { mergeStatic } from '../world/merge.js';

/* ------------------------------------------------------------------ *
 * What makes the town light enough for a phone (docs/decisions/
 * mobile-lite.md).  The desktop game's builders and look are used as they
 * are; around them:
 *
 *   before the build   liteConfig(): the shared tunables the builders read
 *                      (config.js), turned down: fewer petals, fewer
 *                      distance fields for Hachi.  The desktop never runs it.
 *   after the build    liteScene(): no mirrors (the painted water they
 *                      stand in for stays), textures no bigger than
 *                      MOBILE.maxTexture on the GPU, and the CPU's copies of
 *                      the big static textures and batches freed once they
 *                      are on the GPU
 *   every frame        the culler: static batches past MOBILE.far, and the
 *                      small instanced things past MOBILE.detail, are not
 *                      drawn (the fog has closed in before either)
 * ------------------------------------------------------------------ */

export function liteConfig() {
  // the two petal fields: 150 in the air and 250 falling from the trees, as on the desktop (the pocket town's quality
  // pass, 2026-10-03: 70 and 110 before)
  // Hachi's distance fields kept grown at once (2.6 MB each)
  ANIMALS.guide.fields = 3;
  // POCKET: the plain local trains only (the Pokémon wrap's 4096 x 1024 page is 21 MB on the GPU)
  /* the plain local, both ways: a set for each track, both built at load (line/emu.js primeSecond: in the pocket
   * town the two runs stand at the platform together) */
  TOWN.rail.trains = ['box'];
  /* Hachi a size up (Tan, 2026-10-03: "way too small while playing the mobile Pocket Town"): on a phone's small
   * picture the desktop's 24 cm pup was a speck a few metres ahead; 1.3 is a grown shiba's ~31 cm */
  ANIMALS.guide.size = 1.3;
}

/**
 * After the build: the mirrors off, the texture cap, the CPU copies freed.
 * Returns what it did, for the report.
 */
export function liteScene(scene, renderer, world) {
  const T = (n) => globalThis.__sys?.(n);
  const siblings = MOBILE.noSiblings ? 0 : mergeSiblings(scene), folded = MOBILE.noFold ? 0 : foldPlain(scene);
  T('lite-siblings');
  const storeQuads = packStoreQuads(scene);
  T('lite-quads');
  const packed = packBatches(scene);
  T('lite-pack');
  const decals = cropDecals(scene), atlasPages = cropAtlasPages(scene);
  T('lite-crop');
  const out = { siblings, folded, storeQuads, packed, decals, atlasPages, mirrors: 0, freedTextures: 0, freedTextureMB: 0, freedGeometry: 0, freedGeometryMB: 0 };

  /* The mirrors (land/mirror.js: the pond, the river, the paddies) stay, as on the desktop (v3): each is a
   * small target drawn only while you stand by its water, and without them the water is a flat sheet (Tan:
   * "a green mat"). */

  /* The inverted-hull outlines (core/outline.js: a second, heavier contour
   * round the hero props) go: the ink pass still draws every line, and at a
   * phone's size the two read as one.  A draw call and the shape again each. */
  const hulls = [];
  scene.traverse((o) => { if (o.isMesh && o.material?.uniforms?.uThickness && o.material.uniforms.uResolution) hulls.push(o); });
  for (const o of hulls) o.parent?.remove(o);
  out.hulls = hulls.length;

  /* One shader program per toon style, not per shadow tint.  core/toon.js
   * puts the tint's hex in each material's program key, but the tint is a
   * uniform (uShadowTint, set per material in onBeforeCompile, which three
   * runs for every material even when it reuses a compiled program): the
   * shaders are the same text.  326 programs became ~half, each one less
   * to compile and to hold on the GPU. */
  const programKeys = new Set();
  scene.traverse((o) => {
    for (const m of [o.material].flat()) {
      if (!m?.customProgramCacheKey || !m.isMeshToonMaterial || m.userData.liteKey) continue;
      const k = m.customProgramCacheKey();
      const g = /^celTint_[0-9a-f]{6}(W?)$/.exec(k);
      if (!g) continue;
      m.userData.liteKey = true;
      m.customProgramCacheKey = () => 'celTint' + g[1];
      programKeys.add(k);
    }
  });
  out.tintKeysShared = programKeys.size;

  /* The store's insides cast no sun shadows: under its roof the sun only
   * reaches them through the glass, and the shadow pass drew every can. */
  scene.getObjectByName('lawson-interior')?.traverse((o) => { if (o.isMesh) o.castShadow = false; });

  /* Textures: the town's and the konbini's pages at the size a phone sees
   * them (shrinkCanvases; town.js already did most of it while building). */
  const real = renderer.capabilities.maxTextureSize;
  renderer.capabilities.maxTextureSize = Math.min(real, MOBILE.storeTexture);
  Object.assign(out, shrinkCanvases(scene, { real }));
  // the light tier keeps every CPU copy: to stream (makeCuller) and to survive a lost context
  if (MOBILE.keepCpu) { world.batching = null; boundsOf(scene); if (import.meta.env?.DEV) window.__lite = out; return out; }

  /* Once uploaded, the small copies made here go too (a phone counts a
   * canvas's backing store against the tab), when one texture uses them: a
   * redraw later (the departure board) puts them back first (see trap). */
  const users = new Map();
  scene.traverse((o) => {
    for (const m of [o.material].flat()) if (m) for (const t of texturesOf(m)) {
      if (!t.source) continue;
      if (!users.has(t.source)) users.set(t.source, new Set());
      users.get(t.source).add(t);
    }
  });
  for (const [src, set] of users) {
    const img = src.data, dims = SMALL.get(img);
    if (set.size !== 1 || !dims || Math.max(dims.w, dims.h) < 256) continue;
    const t = [...set][0];
    if (t.onUpdate) continue;
    const mb = (dims.w * dims.h * 4) / 1048576;
    t.onUpdate = () => {
      t.onUpdate = null;
      t.__w = dims.w; t.__h = dims.h;
      img.width = 1; img.height = 1;
      out.freedTextures++; out.freedTextureMB += mb;
    };
  }

  /* The static batches (merge.js: everything that never moves, baked into
   * world space) keep a CPU copy of every vertex: free it once uploaded.
   * Their bounds are computed first (culling reads them; nothing raycasts
   * them: the player picks hitboxes, the town is walked on colliders). */
  /* The town's batching result holds (in its cullDetail closure's scope)
   * every mesh it merged away, geometry and all: ~90 MB the phone can't
   * spare.  The lite build culls on its own, so the reference goes. */
  world.batching = null;
  boundsOf(scene);
  scene.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || !(/^merged/.test(o.name) || o.name === 'fuji-dem')) return;
    const g = o.geometry;
    const attrs = [...Object.values(g.attributes), ...(g.index ? [g.index] : [])];
    for (const a of attrs) {
      if (a.__lite) continue;
      a.__lite = true;
      a.onUpload(function () {
        out.freedGeometryMB += this.array.byteLength / 1048576;
        this.array = new this.array.constructor(0);   // (an empty array: count reads stay safe)
      });
    }
    out.freedGeometry++;
  });
  if (import.meta.env?.DEV) window.__lite = out;
  return out;
}

/* ------------------------------------------------------------------ *
 * Painted pages at a phone's size.  Every canvas texture larger than
 * MOBILE.maxTexture (the town) or MOBILE.storeTexture (the konbini, where
 * the labels are read up close) is redrawn into a small canvas, which the
 * texture (and every clone sharing its image) uses instead; the big
 * original is left to be collected.  Called during the build (town.js),
 * as each big part is made, so the big pages never pile up, and again
 * after it.  A texture drawn on later (the departure board, the till's
 * screen) is caught: setting its needsUpdate redraws the original, if it is
 * still alive, into the small copy first.
 * ------------------------------------------------------------------ */
const SMALL = new WeakMap();             // small canvas -> { w, h, from: WeakRef(original) }
export function texturesOf(m) {
  const list = [];
  for (const v of Object.values(m)) if (v?.isTexture) list.push(v);
  if (m.uniforms) for (const u of Object.values(m.uniforms)) if (u?.value?.isTexture) list.push(u.value);
  return list;
}
function trap(t) {
  if (Object.getOwnPropertyDescriptor(t, 'needsUpdate')) return;
  Object.defineProperty(t, 'needsUpdate', {
    configurable: true,
    set(v) {
      if (v !== true) return;
      const small = t.source.data, d = SMALL.get(small), from = d?.from.deref();
      if (d && from && from.width > 1) {
        if (small.width !== d.w) { small.width = d.w; small.height = d.h; }
        const c = small.getContext('2d');
        c.clearRect(0, 0, d.w, d.h);
        c.drawImage(from, 0, 0, d.w, d.h);
      }
      t.version++;
      t.source.needsUpdate = true;
    },
  });
}
export function shrinkCanvases(root, { store = false, real = 16384 } = {}) {
  const out = { resized: 0, resizedFromMB: 0, resizedToMB: 0 };
  const inStore = new Set();
  if (!store) root.getObjectByName?.('lawson')?.traverse((o) => inStore.add(o));
  const users = new Map();
  root.traverse((o) => {
    for (const m of [o.material].flat()) if (m) for (const t of texturesOf(m)) {
      if (!t.source) continue;
      if (!users.has(t.source)) users.set(t.source, { set: new Set(), store: false });
      const u = users.get(t.source);
      u.set.add(t);
      if (store || inStore.has(o)) u.store = true;
    }
  });
  for (const [src, u] of users) {
    const img = src.data;
    if (!(img instanceof HTMLCanvasElement) || SMALL.has(img)) continue;
    const limit = Math.min(real, u.store ? MOBILE.storeTexture : MOBILE.maxTexture);
    const side = Math.max(img.width, img.height);
    /* BUDGET (the light tier, MOBILE.texScale): its frame has 0.7 of the full tier's pixels each way, so a
     * painting at 0.75 of its size is as fine on its screen as the whole one is on the full tier's */
    const scale = img.width * img.height >= 128 * 128 ? MOBILE.texScale ?? 1 : 1;
    if (side <= limit && scale >= 1) continue;
    const k = Math.min(1, limit / side) * scale;
    const cv = document.createElement('canvas');
    const w = Math.max(1, Math.floor(img.width * k)), h = Math.max(1, Math.floor(img.height * k));
    cv.width = w; cv.height = h;
    const c = cv.getContext('2d');
    c.imageSmoothingQuality = 'high';
    c.drawImage(img, 0, 0, w, h);
    SMALL.set(cv, { w, h, from: new WeakRef(img) });
    src.data = cv;
    for (const t of u.set) { trap(t); t.needsUpdate = true; }
    out.resized++;
    out.resizedFromMB += (img.width * img.height * 4) / 1048576;
    out.resizedToMB += (w * h * 4) / 1048576;
  }
  return out;
}

/**
 * The static batches' vertices in fewer bytes: merge.js bakes every part
 * into float32 position, normal, colour and shadow tint (48 bytes a vertex,
 * unindexed).  A normal needs no more than a byte an axis, a colour or a
 * tint no more than 16 bits: 27 bytes, the same picture.  Before the first
 * upload, so the GPU and the CPU copy both shrink.
 */
export function packBatches(scene) {
  let before = 0, after = 0, indexed = 0;
  const pack = (g, name, Type, bytes) => {
    const a = g.attributes[name];
    if (!a || !(a.array instanceof Float32Array) || a.isInterleavedBufferAttribute) return;
    const src = a.array, dst = new Type(src.length), max = Type === Int8Array ? 127 : 65535;
    for (let i = 0; i < src.length; i++) {
      const v = Type === Int8Array ? Math.max(-1, Math.min(1, src[i])) : Math.max(0, Math.min(1, src[i]));
      dst[i] = Math.round(v * max);
    }
    before += src.byteLength; after += dst.byteLength;
    g.setAttribute(name, new THREE.BufferAttribute(dst, a.itemSize, true));
    void bytes;
  };
  scene.traverse((o) => {
    // (and the trees' trunks and limbs: one static mesh per kind, 170 K vertices for the sakura)
    /* (and the konbini's standing stock, store/products.js `stock-page-N`: 0.6 M vertices that never move.  The
     * desktop lets their CPU arrays go once uploaded; here the packed copies are kept, so the stock can give its
     * GPU copy back when you are away from the store and take it again) */
    const stock = /^stock-page/.test(o.name);
    if (!o.isMesh || o.isInstancedMesh || !(/^merged|Wood$/.test(o.name) || stock) || o.geometry.userData.packed) return;
    const g = o.geometry;
    g.userData.packed = true;
    if (stock) {
      for (const a of Object.values(g.attributes)) if (a.array?.length) a.onUploadCallback = () => {};
      if (g.index) g.index.onUploadCallback = () => {};
      const uv = g.attributes.uv;
      if (uv && uv.array instanceof Float32Array) {
        let ok = true;
        for (let i = 0; i < uv.array.length && ok; i++) ok = uv.array[i] >= 0 && uv.array[i] <= 1;
        if (ok) pack(g, 'uv', Uint16Array);
      }
    }
    pack(g, 'normal', Int8Array);
    pack(g, 'color', Uint16Array);
    pack(g, 'aTint', Uint16Array);
    // POCKET: and the position in 16 bits a side over the batch's own box (the mesh carries the box)
    const b0 = g.attributes.position?.array.byteLength ?? 0, b1 = MOBILE.quant === false ? 0 : quantizePositions(o);
    if (b1) { before += b0; after += b1; }
    // BUDGET: ... and each corner once (indexLocal, below)
    const saved = MOBILE.noIndex ? 0 : indexLocal(g);
    after -= saved; indexed += saved;
  });
  return { beforeMB: +(before / 1048576).toFixed(1), afterMB: +(after / 1048576).toFixed(1), indexedMB: +(indexed / 1048576).toFixed(1) };
}

/**
 * BUDGET: a static batch is baked unindexed (world/merge.js): a wall's two triangles carry its four corners as six
 * vertices, a pillar's every corner comes four or six times.  Here a vertex that is byte for byte one of the last
 * few written (same place, normal, colour, tint, uv: the same corner of the same face) is written once and
 * pointed at, so the triangles are the same triangles and the picture the same picture, in a quarter to a half
 * fewer bytes.  One pass, a short look back (a quad's and a strip's shared corners are never further apart).
 * Returns the bytes saved (0: left alone).
 */
const LOOK = 8;
export function indexLocal(g) {
  if (g.index || g.morphAttributes.position || g.groups.length) return 0;
  const attrs = Object.values(g.attributes);
  const n = g.attributes.position?.count ?? 0;
  if (n < 6 || attrs.some((a) => a.isInterleavedBufferAttribute || !a.array || a.count !== n)) return 0;
  // a vertex as 32-bit words would need aligned sizes: a hash of every attribute's numbers, then the numbers themselves
  const hash = new Int32Array(n);
  for (const a of attrs) {
    const arr = a.array, k = a.itemSize, f = arr instanceof Float32Array ? new Int32Array(arr.buffer, arr.byteOffset, arr.length) : arr;
    for (let i = 0, j = 0; i < n; i++) { let h = hash[i]; for (let e = 0; e < k; e++, j++) h = (Math.imul(h, 31) + f[j]) | 0; hash[i] = h; }
  }
  const same = (i, j) => { for (const a of attrs) { const arr = a.array, k = a.itemSize; for (let e = 0; e < k; e++) if (arr[i * k + e] !== arr[j * k + e]) return false; } return true; };
  const index = new Uint32Array(n), keep = new Uint32Array(n);   // keep[m]: the old vertex written as new vertex m
  let m = 0;
  for (let i = 0; i < n; i++) {
    let at = -1;
    for (let q = m - 1, lo = Math.max(0, m - LOOK); q >= lo; q--) if (hash[keep[q]] === hash[i] && same(keep[q], i)) { at = q; break; }
    if (at < 0) { keep[m] = i; at = m++; }
    index[i] = at;
  }
  const idx = m <= 65535 ? new Uint16Array(index) : index;
  let from = 0, to = idx.byteLength;
  for (const a of attrs) from += a.array.byteLength;
  if (m > n * 0.85) return 0;                 // (hardly anything shared: not worth an index)
  for (const [name, a] of Object.entries(g.attributes)) {
    const k = a.itemSize, src = a.array, dst = new src.constructor(m * k);
    for (let v = 0; v < m; v++) { const o = keep[v] * k; for (let e = 0; e < k; e++) dst[v * k + e] = src[o + e]; }
    const out = new THREE.BufferAttribute(dst, k, a.normalized);
    out.usage = a.usage;
    g.setAttribute(name, out);
    to += dst.byteLength;
  }
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  return from - to;
}



/** Bounds for every static batch before its arrays can go (culling reads them). */
function boundsOf(scene) {
  scene.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || !/^merged/.test(o.name)) return;
    if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
  });
}

/**
 * POCKET: a mesh's positions as 16-bit integers over its own box
 * (normalised: -1..1 across it), the box's middle and half size moved into
 * the mesh's position and scale: 12 -> 6 bytes a vertex.  A 64 m cell is
 * then drawn to 1 mm, its height to a fraction of that; the shaders never
 * read the raw attribute (the toon, wear and tint patches read their own).
 * Only for a mesh at the identity whose attributes are the plain ones (the
 * swaying batches offset their positions in the shader, in metres).
 * Returns the new byte size, or 0 when left alone.
 */
const PLAIN = new Set(['position', 'normal', 'color', 'aTint', 'uv', 'aWear']);
export function quantizePositions(o, pad = 0) {
  const g = o.geometry, a = g.attributes.position;
  if (!a || !(a.array instanceof Float32Array) || a.isInterleavedBufferAttribute || g.morphAttributes.position) return 0;
  if (Object.keys(g.attributes).some((k) => !PLAIN.has(k))) return 0;
  if (o.position.lengthSq() || o.rotation.x || o.rotation.y || o.rotation.z || o.scale.x !== 1 || o.scale.y !== 1 || o.scale.z !== 1) return 0;
  const src = a.array, n = src.length;
  if (!n) return 0;
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < n; i += 3) for (let k = 0; k < 3; k++) { const v = src[i + k]; if (v < lo[k]) lo[k] = v; if (v > hi[k]) hi[k] = v; }
  const c = [0, 0, 0], h = [1, 1, 1];
  for (let k = 0; k < 3; k++) { c[k] = (lo[k] + hi[k]) / 2; h[k] = Math.max(1e-3, (hi[k] - lo[k]) / 2 + pad); }
  /* BUDGET: only where 16 bits are fine enough.  Over a batch `quantSpan` m across (40: 1.2 mm a step) a panel
   * standing 3 mm proud of its wall lands in the wall's plane and the two flicker (scripts/_zfight.mjs --phone
   * found 16 such places with the town's plain colours in 256 m cells, 4 mm a step): such a batch keeps its
   * floats (6 bytes a vertex more). */
  if (Math.max(h[0], h[1], h[2]) > (MOBILE.quantSpan ?? 40)) return 0;
  const q = new Int16Array(n);
  for (let i = 0; i < n; i += 3) for (let k = 0; k < 3; k++) q[i + k] = Math.round(Math.max(-1, Math.min(1, (src[i + k] - c[k]) / h[k])) * 32767);
  const attr = new THREE.BufferAttribute(q, 3, true);
  attr.usage = a.usage;
  g.setAttribute('position', attr);
  g.boundingBox = null; g.boundingSphere = null;
  o.position.set(c[0], c[1], c[2]);
  o.scale.set(h[0], h[1], h[2]);
  o.updateMatrix();
  o.userData.quant = { c, h };
  return q.byteLength;
}

/**
 * The parts world/merge.js leaves alone because their place moves or is driven as a whole (the level crossing,
 * the station, the shrine: `userData.dynamic`) are still mostly still: an arm's 24 stripes are 24 draws.  Within
 * one parent, the unnamed meshes that share a material (and shadow flags) become one mesh in that parent's own
 * frame, so whatever turns or hides the parent still does.  Named meshes and `keep` ones (what code holds on
 * to) are left.  Returns how many draws went.
 */
const SIBLING_OWNERS = /^(level-crossing|station|shrine|pole|megastore|lawson-props|lawson-dress)$/;
export function mergeSiblings(scene) {
  const parents = new Set();
  scene.traverse((o) => {
    if (!o.isMesh || !o.parent) return;
    for (let a = o.parent; a; a = a.parent) if (SIBLING_OWNERS.test(a.name)) { parents.add(o.parent); return; }
  });
  const plain = THREE.Object3D.prototype.onBeforeRender;
  let saved = 0;
  for (const p of parents) {
    const groups = new Map();
    for (const c of p.children) {
      if (!c.isMesh || c.isInstancedMesh || c.isSkinnedMesh || c.children.length || c.userData.keep || c.name || !c.visible) continue;
      if (Array.isArray(c.material) || c.onBeforeRender !== plain || c.geometry.morphAttributes.position) continue;
      const key = `${c.material.uuid}|${+c.castShadow}${+c.receiveShadow}|${c.renderOrder}|${c.layers.mask}|${Object.keys(c.geometry.attributes).sort().join(',')}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(c);
    }
    for (const list of groups.values()) {
      if (list.length < 2) continue;
      const geos = list.map((c) => {
        c.updateMatrix();
        const g = c.geometry.index ? c.geometry.toNonIndexed() : c.geometry.clone();
        g.applyMatrix4(c.matrix);
        return g;
      });
      const geo = mergeGeometries(geos, false);
      geos.forEach((g) => g.dispose());
      if (!geo) continue;
      const a = list[0], mesh = new THREE.Mesh(geo, a.material);
      mesh.castShadow = a.castShadow; mesh.receiveShadow = a.receiveShadow; mesh.renderOrder = a.renderOrder;
      mesh.layers.mask = a.layers.mask;
      mesh.userData = { ...a.userData };
      mesh.matrixAutoUpdate = false;
      p.add(mesh);
      for (const c of list) p.remove(c);
      saved += list.length - 1;
    }
  }
  return saved;
}

/**
 * BUDGET: the places built as one mesh a material and kept out of the town's batches (the pond's grounds, the
 * river's banks, the shrine: `userData.dynamic`, so a mirror can draw them alone) are still mostly plain colours:
 * a lantern's stone, its cap, a post, a rail, each a draw.  world/merge.js folds plain colours into one
 * vertex-coloured batch a lighting style; here it is run on each such group's own plain-coloured children, in the
 * group's own frame (so the group can still be shown, hidden or mirrored whole).  Anything with a picture, a
 * colour that changes (`live`), children, or a name the game may hold (`keep`) is left.  Returns the draws saved.
 */
const PLAIN_OWNERS = /^(land-pond|land-channel-reflect|shrine)$/;
export function foldPlain(scene) {
  const owners = [];
  scene.traverse((o) => { if (PLAIN_OWNERS.test(o.name)) owners.push(o); });
  let saved = 0;
  for (const P of owners) {
    const list = P.children.filter((c) => {
      const m = c.material;
      return c.isMesh && !c.isInstancedMesh && !c.isSkinnedMesh && c.visible && !c.children.length && !c.userData.keep && !c.userData.dynamic
        && m && !Array.isArray(m) && (m.isMeshToonMaterial || m.isMeshBasicMaterial) && !m.map && !m.alphaMap && !m.vertexColors && !m.userData.live
        && c.onBeforeRender === THREE.Object3D.prototype.onBeforeRender && !c.geometry.morphAttributes.position;
    });
    if (list.length < 3) continue;
    const tmp = new THREE.Group();
    P.add(tmp);
    for (const c of list) tmp.add(c);
    mergeStatic(tmp, { cell: 0 });
    saved += list.length - tmp.children.length;
    for (const c of [...tmp.children]) { if (c.name === 'merged') c.name = P.name + '-plain'; P.add(c); }
    P.remove(tmp);
  }
  return saved;
}

/**
 * The konbini's painted quads (store/painter.js: signs, posters, POP cards, one mesh a picture: ~60 draws
 * through the glass from the famous view) and the posters on its glass, packed onto one page and drawn as one
 * mesh per kind (opaque, see-through).  Their brightness still follows the look: each merged material shares
 * its originals' colour object, which lawson.js setLook sets in place.  The label and price-tag pages
 * (store/pages.js: they change size with where you stand) are not touched.
 */
export function packStoreQuads(scene, { page = 2048 } = {}) {
  const store = scene.getObjectByName('lawson'), inside = scene.getObjectByName('lawson-interior');
  if (!store || !inside) return null;
  store.updateMatrixWorld(true);
  const paged = new Set();
  for (const p of storePages) for (const m of p.mats) paged.add(m);
  const list = [];
  store.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || o.userData.keep || !o.visible) return;
    if (!(o.name === 'store-quads' || (!o.name && o.parent === store))) return;
    const m = o.material;
    if (Array.isArray(m) || !m.isMeshBasicMaterial || paged.has(m) || m.alphaMap || m.vertexColors) return;
    const t = m.map, img = t?.image;
    if (!img || !(img.width > 0) || !(img instanceof HTMLCanvasElement) || t.userData.size || img.width > 1300) return;
    const uv = o.geometry.attributes.uv;
    if (!uv) return;
    for (let i = 0; i < uv.count; i++) { const u = uv.getX(i), v = uv.getY(i); if (u < -0.001 || u > 1.001 || v < -0.001 || v > 1.001) return; }
    if (t.wrapS !== THREE.ClampToEdgeWrapping || t.wrapT !== THREE.ClampToEdgeWrapping || !t.flipY || t.repeat.x !== 1 || t.repeat.y !== 1 || t.offset.x || t.offset.y) return;
    list.push(o);
  });
  if (list.length < 2) return null;
  const inv = store.matrixWorld.clone().invert(), rel = new THREE.Matrix4();
  let removed = 0;
  /** One page of these quads: each picture once at its own size, drawn as one mesh a kind.  Returns show(k). */
  const pageOf = (list, name) => {
    const texs = [...new Set(list.map((o) => o.material.map))];
    /* BUDGET: shelf packing, tallest first, the page as wide as packs them tightest (2048 across left a quarter of
     * it empty: four 512-wide posters and their padding are 2080); WebGL 2 has no powers of two to keep. */
    const PAD = 4, sorted = [...texs].sort((a, b) => b.image.height - a.image.height);
    const packAt = (W, slots = null) => {
      let x = 0, y = 0, shelf = 0;
      for (const t of sorted) {
        const w = t.image.width, h = t.image.height;
        if (x + w + PAD * 2 > W) { x = 0; y += shelf; shelf = 0; }
        slots?.set(t, { x: x + PAD, y: y + PAD, w, h });
        x += w + PAD * 2; shelf = Math.max(shelf, h + PAD * 2);
      }
      return y + shelf;
    };
    let pageW = page, area = Infinity;
    for (let W = Math.max(Math.max(...sorted.map((t) => t.image.width)) + PAD * 2, 512); W <= 4096; W += 8) { const a = W * packAt(W); if (a < area) { area = a; pageW = W; } }
    const slots = new Map();
    const pageH = packAt(pageW, slots);
    const cv = document.createElement('canvas');
    cv.width = pageW; cv.height = pageH;
    const c = cv.getContext('2d');
    for (const [t, s] of slots) {
      c.drawImage(t.image, s.x - PAD, s.y - PAD, s.w + PAD * 2, s.h + PAD * 2);   // its own edge bled into the padding
      c.clearRect(s.x, s.y, s.w, s.h);
      c.drawImage(t.image, s.x, s.y, s.w, s.h);
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.userData.live = true;            // (its size changes as you come near: releaseCanvases keeps its pictures)
    tex.colorSpace = list[0].material.map.colorSpace;
    tex.anisotropy = 8;
    tex.name = name;
    const groups = new Map();
    for (const o of list) {
      const m = o.material, key = `${m.transparent}|${m.opacity}|${m.alphaTest}|${m.side}|${m.depthWrite}|${m.color.getHexString()}|${m.fog}|${o.renderOrder}|${m.toneMapped}`;
      if (!groups.has(key)) groups.set(key, { src: m, order: o.renderOrder, geos: [], meshes: [] });
      const s = slots.get(m.map);
      const g = (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone());
      for (const an of Object.keys(g.attributes)) if (an !== 'position' && an !== 'uv') g.deleteAttribute(an);
      const uv = g.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, (s.x + uv.getX(i) * s.w) / pageW, 1 - (s.y + (1 - uv.getY(i)) * s.h) / pageH);
      g.applyMatrix4(rel.multiplyMatrices(inv, o.matrixWorld));
      const G = groups.get(key);
      G.geos.push(g); G.meshes.push(o);
    }
    for (const { src, order, geos, meshes } of groups.values()) {
      const geo = mergeGeometries(geos, false);
      if (!geo) continue;
      const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: src.transparent, opacity: src.opacity, alphaTest: src.alphaTest, side: src.side, depthWrite: src.depthWrite, fog: src.fog, toneMapped: src.toneMapped });
      mat.color = src.color;               // the same Color object: setLook brightens it in place
      mat.userData = src.userData;
      const mesh = new THREE.Mesh(geo, mat);
      mesh.name = 'store-quads-lite';
      mesh.userData.noOutline = true;
      mesh.castShadow = mesh.receiveShadow = false;
      mesh.renderOrder = order;
      mesh.matrixAutoUpdate = false;
      store.add(mesh);
      for (const o of meshes) { o.parent.remove(o); removed++; }
      removed--;
    }
    // (its smaller copies: the same picture as its first and second mipmaps, made once)
    const copies = new Map([[1, cv]]);
    const at = (k) => {
      if (!copies.has(k)) {
        const small = document.createElement('canvas');
        small.width = Math.max(4, Math.round(pageW * k)); small.height = Math.max(4, Math.round(pageH * k));
        const q = small.getContext('2d'); q.imageSmoothingQuality = 'high'; q.drawImage(cv, 0, 0, small.width, small.height);
        copies.set(k, small);
      }
      return copies.get(k);
    };
    let cur = 1;
    return { texs, show(k) { if (k === 1) k = MOBILE.texScale ?? 1; if (k === cur) return; cur = k; tex.dispose(); tex.image = at(k); tex.needsUpdate = true; } };
  };
  /* BUDGET: two pages.  `front`: what hangs on the glass, stands outside it, or within MOBILE.store.quadsDeep m
   * behind it (what you can put your nose to from the forecourt); `deep`: the signs further in.  Away from the
   * store both are quarter-size copies (what a poster 110 px tall from the famous view samples); on the forecourt
   * the front page is whole and the deep one a half (its nearest sign is 5 m from the door's spot: a phone shows
   * ~240 px of a metre there, the half holds 190-310); inside, and through a visit, both whole. */
  const c3 = new THREE.Vector3(), deepZ = LAWSON.frontZ - (MOBILE.store.quadsDeep ?? 3);
  const isFront = (o) => { if (!o.geometry.boundingBox) o.geometry.computeBoundingBox(); return o.geometry.boundingBox.getCenter(c3).applyMatrix4(o.matrixWorld).z > deepZ; };
  const front = list.filter(isFront), deep = list.filter((o) => !front.includes(o));
  const pages = [front.length ? pageOf(front, 'store-quads-front') : null, deep.length ? pageOf(deep, 'store-quads') : null];
  if (import.meta.env?.DEV) window.__storeQuads = { front: front.length, deep: deep.length };
  // the pictures now on the pages, where nothing else draws with them: their canvases go
  const still = new Set();
  scene.traverse((o) => { for (const m of [o.material].flat()) if (m?.map) still.add(m.map); });
  for (const pg of pages) if (pg) for (const t of pg.texs) if (!still.has(t)) { t.dispose(); t.image.width = 1; t.image.height = 1; }
  let near = null, visit = null;
  const level = (n, i = false) => {
    if (n === near && i === visit) return;
    near = n; visit = i;
    pages[0]?.show(n || i ? 1 : 0.25);
    pages[1]?.show(i ? 1 : n ? 0.5 : 0.25);
  };
  level(false, false);
  return { removed, level, get near() { return near; } };
}

/**
 * The pocket town keeps everything (MOBILE.stream 0): nothing is ever given back to be uploaded again, so once
 * the GPU holds a painted page its canvas is only weight.  A phone counts every canvas's backing store against
 * the tab (118 MB of them at the start, Tan, 2026-10-03: "reduce even more memory"): each page's canvas goes to
 * 1 x 1 once every texture made from it is on the GPU.  Not the pages drawn on as the game runs
 * (`userData.live`: the departure board, the till's screen; `userData.size`: the konbini's label pages, which
 * change level), nor any clone not yet drawn (a clone with its own wrap would upload again from the source).
 * A lost GPU context can't be survived after this: main.js shows the Reload card (and the light tier, which
 * streams and keeps its canvases, next time).  Returns { tick() } for the main loop (a sweep a second).
 */
export function releaseCanvases(scene, renderer) {
  const users = new Map();
  const out = { released: 0, releasedMB: 0, pending: 0, any: false };
  const gather = () => {
    users.clear();
    scene.traverse((o) => {
      for (const m of [o.material].flat()) if (m) for (const t of texturesOf(m)) {
        if (!t.source) continue;
        if (!users.has(t.source)) users.set(t.source, new Set());
        users.get(t.source).add(t);
      }
    });
  };
  const live = (t) => t.userData.live || t.userData.size || t.isRenderTargetTexture || t.isDataTexture || t.isVideoTexture;
  const shut = (t) => {
    // (a released page drawn on again would upload the 1 x 1: said loudly, never silently blank)
    Object.defineProperty(t, 'needsUpdate', { configurable: true, set(v) { if (v === true) console.error(`releaseCanvases: ${t.name || t.uuid} was drawn on after its canvas went`); } });
  };
  /* A safety net (Tan, 2026-10-04: a train built in play came out with no sides): a texture made later from a page
   * whose canvas has gone (a clone with its own wrap or repeat uploads again from the canvas) gets the picture
   * back first, read from the GPU texture that still holds it, at its whole size; the sweep lets it go again once
   * the new texture is up too. */
  let reader = null;
  const restore = (src) => {
    const t0 = src.__t0, w = t0.__w, h = t0.__h;
    reader ??= new FullScreenQuad(new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3, uniforms: { map: { value: null }, srgb: { value: 0 } },
      vertexShader: 'in vec3 position; void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: `precision highp float; uniform highp sampler2D map; uniform int srgb; out highp vec4 o;
        vec3 enc(vec3 c) { return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
        void main() { vec4 c = texelFetch(map, ivec2(gl_FragCoord.xy), 0); o = vec4(srgb == 1 ? enc(c.rgb) : c.rgb, c.a); }`,
      depthTest: false, depthWrite: false, blending: THREE.NoBlending, toneMapped: false,
    }));
    const rt = new THREE.WebGLRenderTarget(w, h, { depthBuffer: false, type: THREE.UnsignedByteType, colorSpace: THREE.NoColorSpace });
    reader.material.uniforms.map.value = t0;
    reader.material.uniforms.srgb.value = t0.colorSpace === THREE.SRGBColorSpace ? 1 : 0;
    const was = renderer.getRenderTarget();
    renderer.setRenderTarget(rt); reader.render(renderer); renderer.setRenderTarget(was);
    const buf = new Uint8ClampedArray(w * h * 4);
    renderer.readRenderTargetPixels(rt, 0, 0, w, h, buf);
    rt.dispose(); reader.material.uniforms.map.value = null;
    // (uploaded flipped, the GPU's first row is the canvas's last)
    const img = new ImageData(w, h);
    for (let y = 0; y < h; y++) img.data.set(buf.subarray((t0.flipY ? h - 1 - y : y) * w * 4, ((t0.flipY ? h - 1 - y : y) + 1) * w * 4), y * w * 4);
    const cv = src.data;
    cv.width = w; cv.height = h;
    cv.getContext('2d').putImageData(img, 0, 0);
    src.__released = false;
    out.restored = (out.restored ?? 0) + 1;
  };
  const copy = THREE.Texture.prototype.copy;
  THREE.Texture.prototype.copy = function (from) {
    if (from.source?.__released === true) restore(from.source);
    return copy.call(this, from);
  };
  let clock = 0;
  return {
    out,
    tick(dt) {
      if ((clock += dt) < 1) return;
      clock = 0;
      gather();
      out.pending = 0;
      for (const [src, set] of users) {
        const img = src.data;
        if (!(img instanceof HTMLCanvasElement) || img.width * img.height < 64 * 64 || src.__released) continue;
        if ([...set].some(live)) { src.__released = 'live'; continue; }
        let ready = true;
        for (const t of set) { const p = renderer.properties.get(t); if (!p.__webglTexture || p.__version !== t.version) { ready = false; break; } }
        if (!ready) { out.pending++; continue; }
        out.released++; out.releasedMB += (img.width * img.height * 4) / 1048576;
        for (const t of set) { t.__w = img.width; t.__h = img.height; shut(t); }
        src.__released = true; src.__t0 = [...set][0];
        img.width = 1; img.height = 1;
        out.any = true;
      }
    },
  };
}

/**
 * The town's decal atlas (kit/tex.js: every road marking, lid, crack and
 * petal drift, 8 x 8 cells of 256 px on a 2048 page) has its bottom two rows
 * empty: the page is cropped to the six that are painted, and every decal's
 * v scaled to match.  The same cells at the same size; 21 -> 16 MB.
 */
export function cropDecals(scene, rows = 6) {
  const t = decalAtlas(), img = t.image;
  if (!img || t.userData.cropped) return 0;
  const h = Math.round(img.height * rows / 8), k = img.height / h;
  const cv = document.createElement('canvas');
  cv.width = img.width; cv.height = h;
  cv.getContext('2d').drawImage(img, 0, 0, img.width, h, 0, 0, img.width, h);
  t.image = cv;
  t.userData.cropped = true;
  t.needsUpdate = true;
  const done = new Set();
  let n = 0;
  scene.traverse((o) => {
    if (!o.isMesh || o.material?.map !== t || done.has(o.geometry)) return;
    done.add(o.geometry);
    const uv = o.geometry.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - (1 - uv.getY(i)) * k);
    uv.needsUpdate = true;
    n++;
  });
  img.width = img.height = 1;
  return n;
}

/**
 * The town's sign atlas pages (world/merge.js) are always 4096 wide, the
 * last of a set only as tall as what landed on it: packed per region
 * (mobile/town.js), a region's page is often a few hundred texels of one
 * shelf, the rest of its width empty.  Each page is cropped to the width
 * its signs use and the batches' u scaled to match: the same texels, less
 * page.  Returns [before, after] MB.
 */
export function cropAtlasPages(scene) {
  const users = new Map();
  scene.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of [o.material].flat()) {
      const t = m?.map;
      if (!t) continue;
      if (!users.has(t)) users.set(t, []);
      users.get(t).push(o);
    }
  });
  let from = 0, to = 0;
  for (const [t, list] of users) {
    const img = t.image;
    if (!(img instanceof HTMLCanvasElement) || img.width < 2048 || !list.some((o) => /^merged/.test(o.name))) continue;
    if (list.some((o) => Array.isArray(o.material))) continue;
    const c = img.getContext('2d', { willReadFrequently: true });
    const d = c.getImageData(0, 0, img.width, img.height).data;
    let used = 0;
    for (let y = 0; y < img.height; y++) for (let x = img.width - 1; x > used; x--) if (d[(y * img.width + x) * 4 + 3]) { used = x; break; }
    const w = Math.min(img.width, Math.ceil((used + 9) / 16) * 16);
    if (w > img.width * 0.9) continue;
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = img.height;
    cv.getContext('2d').drawImage(img, 0, 0);
    const k = img.width / w;
    const done = new Set();
    for (const o of list) {
      const uv = o.geometry.attributes.uv;
      if (!uv || done.has(uv)) continue;
      done.add(uv);
      for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * k);
      uv.needsUpdate = true;
    }
    from += img.width * img.height; to += w * img.height;
    t.image = cv;
    t.needsUpdate = true;
    img.width = img.height = 1;
  }
  const MB = (n) => +((n * 4 * 4 / 3) / 1048576).toFixed(1);
  return [MB(from), MB(to)];
}

/**
 * Mt. Fuji at half the grid (a quarter of the triangles): the same
 * vertices, so the snow line, the gullies and the silhouette's shape stay;
 * every other row and column of the elevation grid joins the mesh.
 */
export function liteFuji(mesh) {
  const g = mesh?.geometry;
  if (!g?.index || g.userData.lite) return 0;
  const n = Math.round(Math.sqrt(g.attributes.position.count));
  if (n * n !== g.attributes.position.count) return 0;
  const old = g.index.array, used = new Uint8Array(n * n);
  for (let i = 0; i < old.length; i++) used[old[i]] = 1;
  const idx = [];
  const at = (r, c) => r * n + c;
  for (let r = 0; r + 2 < n; r += 2) {
    for (let c = 0; c + 2 < n; c += 2) {
      const a = at(r, c), b = at(r, c + 2), d = at(r + 2, c), e = at(r + 2, c + 2);
      if (!(used[a] && used[b] && used[d] && used[e])) continue;
      idx.push(a, d, b, b, d, e);
    }
  }
  const before = old.length / 3;
  /* POCKET: and only the vertices the half grid uses (a quarter of them) are kept */
  const map = new Int32Array(n * n).fill(-1);
  let m = 0;
  for (const v of idx) if (map[v] < 0) map[v] = m++;
  for (const [name, a] of Object.entries(g.attributes)) {
    const k = a.itemSize, src = a.array, dst = new src.constructor(m * k);
    for (let v = 0; v < n * n; v++) if (map[v] >= 0) for (let j = 0; j < k; j++) dst[map[v] * k + j] = src[v * k + j];
    g.setAttribute(name, new THREE.BufferAttribute(dst, k, a.normalized));
  }
  g.setIndex(idx.map((v) => map[v]));
  g.userData.lite = true;
  // static from here: its CPU copy goes once it is on the GPU
  if (!MOBILE.keepCpu) for (const a of [...Object.values(g.attributes), g.index]) a.onUpload(function () { this.array = new this.array.constructor(0); });
  return { before, after: idx.length / 3 };
}

/**
 * BUDGET: the water's mirrors (land/mirror.js: the pond's, the river's, the paddies') draw what stands round them
 * a second time, upside down, into a target of their own (4-7 MB each), whenever you are within 45-70 m of their
 * water: also when the water is behind a row of shops, or the konbini, and not a pixel of it is on the screen
 * (the pond's ran at the konbini's door, 66 m off through the whole town: 100-170 draws and 7 MB for nothing).
 *
 * Here each mirror asks the GPU whether any of its water was drawn (an occlusion query round its own draw, read a
 * frame later).  While none is, the second drawing is skipped; after `rest` seconds of none, or when the game hides
 * the mirror, its target is given back.  The moment a pixel of water shows, the reflection is drawn again before
 * the water is (the first frame samples the last picture it held: a sliver, a frame).  The water itself is drawn
 * after everything opaque, so what stands in front of it has already claimed its pixels.
 * Returns update(dt), for every frame.
 */
export function lazyMirrors(scene, renderer, { rest = 2.5 } = {}) {
  const gl = renderer.getContext();
  const blank = new THREE.DataTexture(new Uint8Array([120, 130, 140, 255]), 1, 1);
  blank.needsUpdate = true;
  const list = [];
  scene.traverse((o) => {
    if (!o.isMesh || typeof o.getRenderTarget !== 'function' || !o.material?.uniforms?.tDiffuse) return;
    const st = { o, q: null, pending: null, seen: true, drawn: false, unseen: 0, held: true, rt: o.getRenderTarget() };
    const inner = o.onBeforeRender;
    o.renderOrder = Math.max(o.renderOrder, 6);
    o.onBeforeRender = function (r, sc, camera, ...more) {
      st.drawn = true;
      try {
        if (st.pending && gl.getQueryParameter(st.pending, gl.QUERY_RESULT_AVAILABLE)) {
          st.seen = !!gl.getQueryParameter(st.pending, gl.QUERY_RESULT);
          gl.deleteQuery(st.pending); st.pending = null;
        }
      } catch { st.pending = null; st.seen = true; }
      if (st.seen) {
        if (!st.held) { o.material.uniforms.tDiffuse.value = st.rt.texture; st.held = true; }
        inner.call(this, r, sc, camera, ...more);
      }
      if (!st.pending && !st.q) { st.q = gl.createQuery(); gl.beginQuery(gl.ANY_SAMPLES_PASSED_CONSERVATIVE, st.q); }
    };
    o.onAfterRender = function () {
      if (!st.q) return;
      gl.endQuery(gl.ANY_SAMPLES_PASSED_CONSERVATIVE);
      st.pending = st.q; st.q = null;
    };
    list.push(st);
  });
  const drop = (st) => {
    if (!st.held || !renderer.properties.get(st.rt).__webglFramebuffer) return;
    st.o.material.uniforms.tDiffuse.value = blank;
    st.rt.dispose();
    st.held = false;
  };
  return {
    list,
    update(dt) {
      for (const st of list) {
        if (!st.o.visible) { st.seen = true; st.unseen = 0; st.drawn = false; drop(st); continue; }   // (hidden by the game: it comes back drawing)
        // none of it on the screen (hidden behind something, or out of the view altogether) for a while
        if (st.seen && st.drawn) st.unseen = 0; else if ((st.unseen += dt) > rest) drop(st);
        st.drawn = false;
      }
    },
  };
}

/**
 * Distance culling.  `far`: the static batches (their bounds are in world
 * space); `detail`: small instanced kinds (clutter, weeds, flowers: one
 * draw each, spread town-wide, so they are shown when their nearest
 * instance is within reach) and merge.js's detail cells.
 */
export function makeCuller(scene, world, renderer) {
  const list = [];
  const sphere = new THREE.Sphere(), box = new THREE.Box3();
  scene.updateMatrixWorld(true);
  scene.traverse((o) => {
    // the konbini's goods (hundreds of thousands of vertices) are drawn only from near the store
    const stock = /^stock-page/.test(o.name);
    if (!(o.isMesh || o.isPoints || o.isLine) || (!o.frustumCulled && !stock) || o.userData.shadowOnly) return;
    const own = Object.getOwnPropertyDescriptor(o, 'visible');
    if (own && (own.get || !own.writable)) return;                  // (the mirrors: always off)
    const g = o.geometry;
    if (/mirror$/.test(o.name)) return;                             // (the water's mirrors show and hide themselves)
    /* a kind's instances are measured together (three's own bounds for an InstancedMesh): by its one shape's
     * bounds every kind sat at the origin, and the sleepers, shrubs, seedlings and pigeons were cut wherever you
     * stood more than `detail` from it */
    let bs = null;
    if (o.isInstancedMesh) {
      if (o.instanceMatrix.usage === THREE.DynamicDrawUsage) return;   // (its instances move: three and the game cull it)
      if (!o.boundingSphere) o.computeBoundingSphere();
      bs = o.boundingSphere;
    } else {
      if (!g.boundingSphere) g.computeBoundingSphere();
      bs = g.boundingSphere;
    }
    if (!bs || !Number.isFinite(bs.radius)) return;
    sphere.copy(bs).applyMatrix4(o.matrixWorld);
    // spread town-wide (a kind's instances, a moving thing's long reach): always drawn; what never moves is measured by its box instead
    if (sphere.radius > MOBILE.far * 0.6 && (o.matrixAutoUpdate || o.isInstancedMesh)) return;
    /* The game shows and hides things itself (the trees' near and far
     * sets, the painted water under a mirror, the store's goods): `visible`
     * becomes what the game says AND near enough, so neither undoes the other. */
    let mine = o.visible;
    // (a kind's far set, and the far tree lines, are what is seen from afar: never cut at the detail distance)
    const e = { o, near: true, detail: o.name === 'merged-detail' || (o.isInstancedMesh && sphere.radius < 40 && !/Far\d?$/.test(o.name)), small: !o.isInstancedMesh && !/^merged/.test(o.name) && sphere.radius < (MOBILE.small?.r ?? 0), moves: o.matrixAutoUpdate, inst: o.isInstancedMesh ? o.instanceMatrix.version : -1, x: sphere.center.x, z: sphere.center.z, r: sphere.radius, box: null, reach: stock ? MOBILE.store.goods : 0 };
    // what never moves is measured by its box (a batch's cell is square: its sphere reaches far past its corners)
    if (!e.moves && !o.isInstancedMesh) {
      if (!g.boundingBox) g.computeBoundingBox();
      if (g.boundingBox && Number.isFinite(g.boundingBox.min.x)) e.box = box.copy(g.boundingBox).applyMatrix4(o.matrixWorld).clone();
    }
    Object.defineProperty(o, 'visible', { get: () => mine && e.near, set: (v) => { mine = v; }, configurable: true });
    list.push(e);
  });
  // the store's own parts are never behind it
  scene.getObjectByName('lawson')?.traverse((o) => { const e = list.find((q) => q.o === o); if (e) e.store = true; });
  /* Streaming (MOBILE.stream, the light tier): what lies past far + stream
   * gives its GPU copy back (geometry.dispose(); textures only it uses too),
   * keeping the CPU copy, and three uploads it again when it is drawn next.
   * Only geometry and textures with no other user in the scene take part. */
  const stream = MOBILE.stream > 0 && MOBILE.keepCpu;
  if (stream) {
    const geoUsers = new Map(), texUsers = new Map();
    const texOf = (m) => Object.values(m).filter((v) => v?.isTexture);
    scene.traverse((o) => {
      if (!o.geometry) return;
      geoUsers.set(o.geometry, (geoUsers.get(o.geometry) ?? 0) + 1);
      for (const m of [o.material].flat()) if (m) for (const t of texOf(m)) { if (!texUsers.has(t)) texUsers.set(t, new Set()); texUsers.get(t).add(o); }
    });
    const inList = new Set(list.map((e) => e.o));
    for (const e of list) {
      e.streams = !e.o.isInstancedMesh && geoUsers.get(e.o.geometry) === 1;
      // its textures: those whose every user is streamed
      e.tex = [];
      for (const m of [e.o.material].flat()) if (m) for (const t of texOf(m)) if ([...texUsers.get(t)].every((u) => inList.has(u))) e.tex.push(t);
    }
    // each texture goes when all its users are out, back when one comes in
    for (const e of list) for (const t of e.tex) t.__users = (t.__users ?? 0) + (e.streams ? 1 : 1e9);
    for (const e of list) for (const t of e.tex) t.__in = t.__users;
  }
  /* Far pages (MOBILE.texLod): a painted page whose every user is farther
   * than texLod.far from you shows a quarter-size copy of itself instead, the
   * same picture as its second mip level, which is all a sign that far can
   * sample on a phone's screen (a 4 m sign 44 m off is ~120 px wide); within
   * texLod.near of any user the whole page comes back.  From inside the
   * konbini every one is at most a half (texLod.store): what is outside is
   * seen through the glass from metres off, while you are walked to a
   * shelf.  The konbini's own pages have their own levels (konbini.js). */
  /* BUDGET: how finely a page is painted on what wears it: its texels a metre, at the coarsest place (where it is
   * seen largest).  From that, the distance past which a phone's screen cannot show more than the page's half or
   * its quarter (update, below): a 0.6 m plate painted 256 across is a quarter's worth from 14 m, a 5 m fascia
   * painted 1024 across from 29 m.  Not for a kind's instances (the leaf skins: the old near and far apply). */
  const density = (src, es, img) => {
    let lo = Infinity;
    const p = [0, 0, 0, 0, 0, 0, 0, 0, 0];
    for (const e of es) {
      const o = e.o, g = o.geometry, pos = g.attributes.position, uv = g.attributes.uv;
      if (o.isInstancedMesh || !pos || !uv || !(pos.array?.length > 0)) return 0;
      let rep = 1;
      for (const m of [o.material].flat()) if (m) for (const t of texturesOf(m)) if (t.source === src) rep = Math.abs(t.repeat.x * t.repeat.y) || 1;
      const E = o.matrixWorld.elements, ix = g.index, n = ix ? ix.count : pos.count, texels = img.width * img.height * rep;
      for (let i = 0; i + 2 < n; i += 3) {
        const a = ix ? ix.getX(i) : i, b = ix ? ix.getX(i + 1) : i + 1, c = ix ? ix.getX(i + 2) : i + 2;
        let k = 0;
        for (const v of [a, b, c]) {
          const x = pos.getX(v), y = pos.getY(v), z = pos.getZ(v);
          p[k++] = E[0] * x + E[4] * y + E[8] * z; p[k++] = E[1] * x + E[5] * y + E[9] * z; p[k++] = E[2] * x + E[6] * y + E[10] * z;
        }
        const ux = p[3] - p[0], uy = p[4] - p[1], uz = p[5] - p[2], vx = p[6] - p[0], vy = p[7] - p[1], vz = p[8] - p[2];
        const world = Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) / 2;
        const tu = Math.abs((uv.getX(b) - uv.getX(a)) * (uv.getY(c) - uv.getY(a)) - (uv.getX(c) - uv.getX(a)) * (uv.getY(b) - uv.getY(a))) / 2;
        if (world > 1e-4 && tu > 1e-10) lo = Math.min(lo, Math.sqrt(tu * texels / world));
      }
    }
    return Number.isFinite(lo) ? lo : 0;
  };
  const lod = [];
  if (stream && MOBILE.texLod) {
    const inStore = new Set();
    scene.getObjectByName('lawson')?.traverse((o) => inStore.add(o));
    /* by source: a page's clones (the leaf skins, cloned for their repeat) share its picture, so they
     * change size together, each given back and uploaded again */
    const users = new Map(), clones = new Map();
    scene.traverse((o) => { for (const m of [o.material].flat()) if (m) for (const t of texturesOf(m)) { if (!clones.has(t.source)) clones.set(t.source, new Set()); clones.get(t.source).add(t); } });
    for (const e of list) for (const t of e.tex) { if (!users.has(t.source)) users.set(t.source, []); users.get(t.source).push(e); }
    for (const [src, es] of users) {
      const img = src.data, ts = [...clones.get(src)];
      if (!(img instanceof HTMLCanvasElement) || img.width * img.height < MOBILE.texLod.min || es.some((e) => inStore.has(e.o))) continue;
      // (only when every clone is one the culler streams: a clone drawn elsewhere keeps the page whole)
      if (!ts.every((t) => list.some((e) => e.tex.includes(t)))) continue;
      lod.push({ ts, src, es, full: img, imgs: new Map(), k: 1, tpm: density(src, es, img) });
    }
  }
  /** A page's copy at `k` its size (made once, kept), the same picture as that mip level. */
  const sized = (L, k) => {
    if (k >= 1) return L.full;
    if (!L.imgs.has(k)) {
      const cv = document.createElement('canvas');
      cv.width = Math.max(16, Math.round(L.full.width * k)); cv.height = Math.max(16, Math.round(L.full.height * k));
      const c = cv.getContext('2d');
      c.imageSmoothingQuality = 'high';
      c.drawImage(L.full, 0, 0, cv.width, cv.height);
      L.imgs.set(k, cv);
    }
    return L.imgs.get(k);
  };
  // (each clone given back first: a new size needs new storage)
  const swap = (L, img) => { for (const t of L.ts) t.dispose(); L.src.data = img; for (const t of L.ts) t.needsUpdate = true; };
  let n = 0, out = 0, clock = 0, lastBehind = null;
  const lastAt = { x: 0, z: 0 };
  const api = {
    list,
    lod,
    lodFar: 0,
    pxm: 1300,                 // the screen's pixels a metre at a metre (main.js sets it at every resize)
    get out() { return out; },
    /** Every few frames: what is near enough to draw. */
    update(cam, every = 3, behind = null, force = false) {
      /* into or out of the store, or a jump (the start again, a famous view): at once, so the new place's
       * pages and batches never land on top of the old ones */
      const jumped = Math.hypot(cam.x - lastAt.x, cam.z - lastAt.z) > 12;
      lastAt.x = cam.x; lastAt.z = cam.z;
      const turned = force || jumped || behind !== lastBehind;
      lastBehind = behind;
      if (n++ % every && !turned) return;
      /* `behind` (in the konbini: MOBILE.store.behind, world z): what lies wholly north of that line (the
       * glass) is behind the store's walls, never seen from inside; it is not drawn and streams out */
      const px = cam.x, pz = cam.z;
      const streamNow = stream && (++clock % 10 === 0 || turned);       // (about three times a second)
      for (const e of list) {
        // a kind whose instances are placed again as the game runs (view-sorted crowns): never cut by where they were
        if (e.inst >= 0 && e.o.instanceMatrix.version !== e.inst) { e.live = true; e.streams = false; }
        if (e.live) { e.near = true; e.d = 0; continue; }
        if (e.moves) {
          const bs = (e.o.isInstancedMesh && e.o.boundingSphere) || e.o.geometry.boundingSphere;
          sphere.copy(bs).applyMatrix4(e.o.matrixWorld);
          e.x = sphere.center.x; e.z = sphere.center.z;
        }
        const d = e.box
          ? Math.hypot(Math.max(e.box.min.x - px, 0, px - e.box.max.x), Math.max(e.box.min.z - pz, 0, pz - e.box.max.z))
          : Math.hypot(e.x - px, e.z - pz) - e.r;
        const hidden = behind !== null && !e.store && (e.box ? e.box.max.z : e.z + e.r) < behind;
        e.near = !hidden && d < (e.reach || (e.detail ? MOBILE.detail : e.small ? MOBILE.small.far : MOBILE.far));   // (the konbini's goods: only within their reach)
        e.d = hidden ? Infinity : d;
        if (!streamNow || !e.streams) continue;
        // small props (the detail cells) stream just past where they stop being drawn
        const far = hidden ? -1e9 : e.reach || (e.detail ? MOBILE.detail + 16 : MOBILE.far + MOBILE.stream);
        if (!e.gone && d > far) {
          /* (a geometry that let its CPU arrays go once uploaded, as the konbini's stock does (store/products.js),
           * cannot be uploaded again: it stays) */
          const g = e.o.geometry;
          if ([...Object.values(g.attributes), g.index].some((a) => a && !(a.array?.length > 0) && !a.isInterleavedBufferAttribute)) { e.streams = false; continue; }
          e.gone = true; out++;
          e.o.geometry.dispose();
          for (const t of e.tex) if (--t.__in <= 0) t.dispose();
        } else if (e.gone && d < far - 10) {
          e.gone = false; out--;
          for (const t of e.tex) t.__in++;          // (three uploads it when it is drawn)
        }
      }
      if (streamNow) for (const L of lod) {
        let d = Infinity;
        for (const e of L.es) if (e.d < d) d = e.d;
        const T = MOBILE.texLod;
        let want = L.k;
        if (L.tpm > 0 && T.safe) {
          /* by what the screen can show (api.pxm: its pixels a metre, a metre away): the half from where the
           * page's half is still finer than the screen, the quarter likewise; never later than `far`, and
           * coming nearer the finer copy is back before it is needed (the margin is in `safe`) */
          const dq = Math.min(T.far, Math.max(T.least, 4 * api.pxm * T.safe / L.tpm)), dh = Math.min(dq, Math.max(T.least / 2, 2 * api.pxm * T.safe / L.tpm));
          const at = (x) => (x > dq ? 0.25 : x > dh ? 0.5 : 1);
          // (finer a little before it is due; coarser only well past it, so standing on a line changes nothing)
          const fine = at(d * 0.9 - 0.5), coarse = at(d * 0.8 - 0.5);
          if (fine > L.k) want = fine; else if (coarse < L.k) want = coarse;
        } else if (d > T.far) want = T.k; else if (d < T.near) want = 1;
        // in the konbini, what is outside is seen through the glass, metres off: at most `store` its size
        if (behind !== null && want > T.store) want = T.store;
        if (want === L.k) continue;
        api.lodFar += (want < 1) - (L.k < 1);
        L.k = want;
        swap(L, sized(L, want));
      }
    },
  };
  return api;
}

/** Dev: what the scene costs (textures, geometry), for the report. */
export function census(scene, renderer) {
  const texs = new Map();
  let geoBytes = 0;
  const geos = new Set();
  scene.traverse((o) => {
    const g = o.geometry;
    if (g && !geos.has(g)) {
      geos.add(g);
      for (const a of Object.values(g.attributes)) geoBytes += a.array?.byteLength ?? 0;
      if (g.index) geoBytes += g.index.array?.byteLength ?? 0;
    }
    for (const m of [o.material].flat()) {
      if (!m) continue;
      for (const v of Object.values(m)) if (v?.isTexture) texs.set(v.source?.uuid ?? v.uuid, v);
      if (m.uniforms) for (const u of Object.values(m.uniforms)) if (u?.value?.isTexture) texs.set(u.value.source?.uuid ?? u.value.uuid, u.value);
    }
  });
  const cap = renderer.capabilities.maxTextureSize;
  let gpu = 0;
  for (const t of texs.values()) {
    let w = t.image?.width ?? 0, h = t.image?.height ?? 0;
    if (t.__w) { w = t.__w; h = t.__h; }
    const k = Math.min(1, cap / Math.max(w, h, 1));
    gpu += Math.floor(w * k) * Math.floor(h * k) * 4 * (t.generateMipmaps ? 4 / 3 : 1);
  }
  return { textures: texs.size, textureMB: Math.round(gpu / 1048576), geometryCpuMB: Math.round(geoBytes / 1048576), info: renderer.info.memory };
}
