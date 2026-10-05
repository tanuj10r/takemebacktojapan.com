import * as THREE from 'three';
import { cel } from '../../core/toon.js';

/* ------------------------------------------------------------------ *
 * How the animals are drawn.
 *
 *   animalMaterial   the town's cel material (flat bands, violet shade),
 *                    painted by vertex colour, with a vertex-shader rig:
 *                    each kind's GLSL turns its parts (head, wings, legs,
 *                    tail) by the instance's pose, so a whole flock is one
 *                    draw with no bones
 *   Herd             one InstancedMesh per kind, its poses, and a flush
 *   Shadows          one multiply-blended mesh of soft contact shadows for
 *                    every animal on the ground (the shadow map redraws on
 *                    a grid, not every frame, so moving things can't use it)
 *   Marks            rings and wakes on the water, one mesh each
 * ------------------------------------------------------------------ */

/* shared GLSL: rotations and the attributes every rig reads */
const HEADER = /* glsl */`
attribute vec4 aJoint;
attribute vec3 aMorph;
attribute vec4 aPose;
attribute vec4 aPose2;
varying vec3 vLocal;
varying float vPart;
varying vec4 vPose;
varying vec4 vPose2;
uniform mat3 uLightRot;
vec3 rotX(vec3 v, float a) { float c = cos(a), s = sin(a); return vec3(v.x, c * v.y - s * v.z, s * v.y + c * v.z); }
vec3 rotY(vec3 v, float a) { float c = cos(a), s = sin(a); return vec3(c * v.x + s * v.z, v.y, -s * v.x + c * v.z); }
vec3 rotZ(vec3 v, float a) { float c = cos(a), s = sin(a); return vec3(c * v.x - s * v.y, s * v.x + c * v.y, v.z); }
bool isPart(float id) { return abs(aJoint.w - id) < 0.5; }
`;

/**
 * @param o.tint     the shade's violet (as the town's materials)
 * @param o.rig      GLSL defining `void rig(inout vec3 p, inout vec3 n)`
 * @param o.frag     GLSL run after the vertex colour is applied: may change
 *                   `diffuseColor` (reads vLocal, vPart, vPose, vPose2)
 * @param o.key      a name for the program cache
 */
export function animalMaterial({ tint = 0x6c5f8c, rig = 'void rig(inout vec3 p, inout vec3 n) {}', frag = '', key, transparent = false, bands = 3, uniforms = {}, side = THREE.FrontSide, fragHead = '' }) {
  const mat = cel({ color: 0xffffff, bands, tint, flat: false, vertexColors: true, cache: false, transparent, side });
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (shader, renderer) => {
    prev?.call(mat, shader, renderer);
    Object.assign(shader.uniforms, uniforms, { uLightRot: mat.userData.lightRot });
    shader.vertexShader = HEADER + rig + '\n' + shader.vertexShader
      .replace('#include <beginnormal_vertex>', `
        vec3 rigP = position;
        vec3 objectNormal = normal;
        vLocal = position;
        vPart = aJoint.w;
        vPose = aPose; vPose2 = aPose2;
        rig(rigP, objectNormal);
        objectNormal = uLightRot * objectNormal;`)
      .replace('#include <begin_vertex>', 'vec3 transformed = rigP;');
    shader.fragmentShader = 'varying vec3 vLocal;\nvarying float vPart;\nvarying vec4 vPose;\nvarying vec4 vPose2;\n' + fragHead + '\n'
      + shader.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n' + frag);
  };
  mat.customProgramCacheKey = () => 'animal_' + key;
  mat.userData.animal = key;
  /* the light, turned about the animal for its shading alone (the identity in the game: Director Mode's close-ups
   * bring the sun round to the lens, where from the side or above its band edges streaked the pup's front) */
  mat.userData.lightRot = { value: new THREE.Matrix3() };
  return mat;
}

/**
 * A kind's reflection in still water (the paddies' and the river's are
 * painted, not mirrors): the same instances drawn again upside down about
 * the water at `waterY`, tinted by the water and a little see-through.
 * Each vertex keeps the depth of the water where its ray meets it, so the
 * reflection lies *in* the surface: whatever stands in front hides it.
 */
export function reflectionOf(ctx, herd, { rig, key, waterY, tint = 0xbcd2ea, mix = 0.35, alpha = 0.6, uniforms = {}, frag = '', fragHead = '' }) {
  const mat = animalMaterial({
    key: `${key}Refl`, rig, transparent: true, side: THREE.DoubleSide,
    uniforms: { ...uniforms, uReflTint: { value: new THREE.Color(tint) }, uWaterY: { value: waterY } },
    fragHead: `${fragHead}\nuniform vec3 uReflTint;`,
    frag: `${frag}\ndiffuseColor.rgb = mix(diffuseColor.rgb, uReflTint, ${mix.toFixed(3)});\ndiffuseColor.a *= ${alpha.toFixed(3)};`,
  });
  mat.depthWrite = false;
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (s, r) => {
    prev(s, r);
    s.vertexShader = 'uniform float uWaterY;\n' + s.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
      {
        vec4 rw = modelMatrix * instanceMatrix * vec4(transformed, 1.0);
        rw.y = 2.0 * uWaterY - rw.y;
        gl_Position = projectionMatrix * viewMatrix * rw;
        float rt = (uWaterY - cameraPosition.y) / min(rw.y - cameraPosition.y, -1e-4);
        vec3 hit = cameraPosition + (rw.xyz - cameraPosition) * clamp(rt, 0.0, 1.0);
        vec4 ch = projectionMatrix * viewMatrix * vec4(hit, 1.0);
        gl_Position.z = (ch.z / ch.w - 0.00003) * gl_Position.w;
      }`);
  };
  const mesh = new THREE.InstancedMesh(herd.mesh.geometry, mat, herd.n);
  mesh.instanceMatrix = herd.mesh.instanceMatrix;          // the same places: nothing more to upload
  mesh.name = `${herd.mesh.name}-reflection`;
  mesh.castShadow = mesh.receiveShadow = false;
  mesh.userData.dynamic = true;
  mesh.userData.noAtlas = true;
  mesh.userData.noOutline = true;
  mesh.renderOrder = 1;
  if (herd.mesh.boundingSphere) mesh.boundingSphere = herd.mesh.boundingSphere; else mesh.frustumCulled = false;
  ctx.add(mesh);
  return mesh;
}

/**
 * One kind's instances.  `set` places one (yaw about y, then pitch, then
 * roll), `pose` its two pose vectors; `flush` uploads what changed.
 */
export class Herd {
  constructor(ctx, geometry, material, count, name, { reflect = false, bounds = null, extra = 0 } = {}) {
    this.n = count;
    this.pose = new THREE.InstancedBufferAttribute(new Float32Array(count * 4), 4);
    this.pose2 = new THREE.InstancedBufferAttribute(new Float32Array(count * 4), 4);
    this.pose.setUsage(THREE.DynamicDrawUsage);
    this.pose2.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('aPose', this.pose);
    geometry.setAttribute('aPose2', this.pose2);
    // `extra`: more pose vectors (aPose3...), for a rig that reads them (the shiba's expressions)
    this.more = [];
    for (let k = 0; k < extra; k++) {
      const a = new THREE.InstancedBufferAttribute(new Float32Array(count * 4), 4);
      a.setUsage(THREE.DynamicDrawUsage);
      geometry.setAttribute('aPose' + (k + 3), a);
      this.more.push(a);
    }
    const mesh = new THREE.InstancedMesh(geometry, material, count);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.name = `animals-${name}`;
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    mesh.userData.dynamic = true;
    mesh.userData.noAtlas = true;
    if (reflect) mesh.layers.enable(reflect);
    // culled as a whole by where the kind lives (instances move within it)
    if (bounds) mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(bounds[0], bounds[1], bounds[2]), bounds[3]);
    else mesh.frustumCulled = false;
    ctx.add(mesh);
    this.mesh = mesh;
    this.o = new THREE.Object3D();
    this.o.rotation.order = 'YXZ';
    this.dirty = false;
  }
  set(i, x, y, z, yaw = 0, pitch = 0, roll = 0, s = 1) {
    const o = this.o;
    o.position.set(x, y, z);
    o.rotation.set(pitch, yaw, roll);
    if (typeof s === 'number') o.scale.setScalar(s); else o.scale.set(s[0], s[1], s[2]);
    o.updateMatrix();
    this.mesh.setMatrixAt(i, o.matrix);
    this.dirty = true;
  }
  setPose(i, a = 0, b = 0, c = 0, d = 0) { this.pose.setXYZW(i, a, b, c, d); this.dirty = true; }
  setPose2(i, a = 0, b = 0, c = 0, d = 0) { this.pose2.setXYZW(i, a, b, c, d); this.dirty = true; }
  /** An extra pose vector (k 0 is aPose3). */
  setPoseN(k, i, a = 0, b = 0, c = 0, d = 0) { this.more[k].setXYZW(i, a, b, c, d); this.dirty = true; }
  flush() {
    if (!this.dirty) return;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.pose.needsUpdate = true;
    this.pose2.needsUpdate = true;
    for (const a of this.more) a.needsUpdate = true;
    this.dirty = false;
  }
}

/**
 * Soft contact shadows: an ellipse under each animal on the ground, drawn
 * by multiplying what is under it (cool violet, like the town's shade).
 */
export function makeShadows(ctx, max = 64) {
  const g = new THREE.CircleGeometry(1, 20);
  g.rotateX(-Math.PI / 2);
  // soft edge: the rim a little lighter (a vertex colour ring)
  const col = [];
  const P = g.attributes.position;
  for (let i = 0; i < P.count; i++) {
    const r = Math.hypot(P.getX(i), P.getZ(i));
    const k = r < 0.01 ? 0.62 : 0.8;
    col.push(k, k * 0.98, k * 1.06);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const mat = new THREE.MeshBasicMaterial({
    vertexColors: true, transparent: true, depthWrite: false, fog: false,
    blending: THREE.MultiplyBlending, premultipliedAlpha: true,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  const mesh = new THREE.InstancedMesh(g, mat, max);
  mesh.name = 'animals-shadows';
  mesh.frustumCulled = false;
  mesh.castShadow = mesh.receiveShadow = false;
  mesh.userData.dynamic = true;
  mesh.userData.noAtlas = true;
  mesh.userData.noOutline = true;
  mesh.renderOrder = 1;
  mesh.count = 0;
  ctx.add(mesh);
  const o = new THREE.Object3D();
  let used = 0;
  const hide = new THREE.Matrix4().makeScale(0, 0, 0);
  return {
    mesh,
    slot() { const i = used++; mesh.count = used; mesh.setMatrixAt(i, hide); return i; },
    /** under (x, z) at ground y, rx across, rz along, turned by yaw */
    set(i, x, y, z, rx, rz, yaw = 0) {
      if (rx <= 0) { mesh.setMatrixAt(i, hide); mesh.instanceMatrix.needsUpdate = true; return; }
      o.position.set(x, y + 0.006, z);
      o.rotation.set(0, yaw, 0);
      o.scale.set(rx, 1, rz);
      o.updateMatrix();
      mesh.setMatrixAt(i, o.matrix);
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}

/**
 * Marks on the water: rings (a gulp, a plop, a heron's feet) that spread
 * and fade, and wakes (a V behind a swimming duck).  Pale lines, a little
 * see-through; each is one instanced mesh.
 */
export function makeMarks(ctx, { rings = 24, wakes = 8 } = {}) {
  const fadeMat = (color, opacity) => {
    const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
    m.onBeforeCompile = (s) => {
      s.vertexShader = 'attribute float aFade;\nattribute float aAlong;\nvarying float vFade;\n' + s.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvFade = aFade * (1.0 - aAlong);');
      s.fragmentShader = 'varying float vFade;\n' + s.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.a *= vFade;');
    };
    m.customProgramCacheKey = () => 'animalMarks';
    return m;
  };
  // a ring: two thin circles, the outer one fainter
  const ringGeo = (() => {
    const a = new THREE.RingGeometry(0.955, 1.0, 40, 1);
    const b = new THREE.RingGeometry(0.7, 0.725, 40, 1);
    const pos = [...a.attributes.position.array, ...b.attributes.position.array];
    const along = [...new Array(a.attributes.position.count).fill(0), ...new Array(b.attributes.position.count).fill(0.5)];
    const idx = [...a.index.array, ...Array.from(b.index.array, (k) => k + a.attributes.position.count)];
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('aAlong', new THREE.Float32BufferAttribute(along, 1));
    g.setIndex(idx);
    g.rotateX(-Math.PI / 2);
    return g;
  })();
  // a wake: two lines spreading back from the bow (+z), fading to nothing,
  // and a short ripple line between them
  const wakeGeo = (() => {
    const pos = [], along = [], idx = [];
    const arm = (s) => {
      const n = 10;
      const b = pos.length / 3;
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const z = -t, x = s * (0.08 + t * 0.42) + s * Math.sin(t * 9) * 0.012;
        const w = 0.012 + t * 0.03;
        pos.push(x - w, 0, z, x + w, 0, z);
        along.push(t, t);
      }
      for (let i = 0; i < n; i++) { const a = b + i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    };
    arm(-1); arm(1);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('aAlong', new THREE.Float32BufferAttribute(along, 1));
    g.setIndex(idx);
    return g;
  })();
  const make = (geo, n, name, color, opacity) => {
    const fade = new THREE.InstancedBufferAttribute(new Float32Array(n), 1);
    fade.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aFade', fade);
    const mesh = new THREE.InstancedMesh(geo, fadeMat(color, opacity), n);
    mesh.name = name;
    mesh.frustumCulled = false;
    mesh.castShadow = mesh.receiveShadow = false;
    mesh.userData.dynamic = true;
    mesh.userData.noAtlas = true;
    mesh.userData.noOutline = true;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.renderOrder = 2;
    const hide = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < n; i++) mesh.setMatrixAt(i, hide);
    ctx.add(mesh);
    return { mesh, fade, hide };
  };
  const R = make(ringGeo, rings, 'animals-rings', 0xf4f6ec, 0.55);
  const W = make(wakeGeo, wakes, 'animals-wakes', 0xf4f6ec, 0.5);
  const live = [];           // rings: { i, x, y, z, t, life, r0, r1 }
  let next = 0, kept = 0;    // rings from the end of the list are kept (still)
  const wakeAt = [];
  const o = new THREE.Object3D();
  return {
    /** a ring at (x, y, z) growing from r0 to r1 over `life` seconds */
    ring(x, y, z, { r0 = 0.05, r1 = 0.6, life = 1.8, strength = 1 } = {}) {
      const i = next; next = (next + 1) % (rings - kept);
      const k = live.findIndex((q) => q.i === i);
      if (k >= 0) live.splice(k, 1);
      live.push({ i, x, y, z, t: 0, life, r0, r1, strength });
    },
    /** a wake behind (x, z) heading `yaw`, its length by speed (0 hides it) */
    wake(i, x, y, z, yaw, len) {
      wakeAt[i] = len > 0.01 ? { x, z } : null;
      if (len <= 0.01) { W.mesh.setMatrixAt(i, W.hide); W.fade.setX(i, 0); } else {
        o.position.set(x, y + 0.004, z);
        o.rotation.set(0, yaw, 0);
        o.scale.set(0.7 + len * 0.6, 1, len);
        o.updateMatrix();
        W.mesh.setMatrixAt(i, o.matrix);
        W.fade.setX(i, Math.min(1, len * 1.2));
      }
      W.mesh.instanceMatrix.needsUpdate = true;
      W.fade.needsUpdate = true;
    },
    /** show the rings only with one near the camera, the wakes with a duck near */
    cull(cam, reach = 45) {
      R.mesh.visible = live.some((q) => q.strength > 0 && Math.hypot(q.x - cam.x, q.z - cam.z) < reach);
      W.mesh.visible = wakeAt.some((w) => w && Math.hypot(w.x - cam.x, w.z - cam.z) < reach);
    },
    update(dt) {
      if (!live.length) return;
      for (let k = live.length - 1; k >= 0; k--) {
        const q = live[k];
        q.t += dt;
        const u = q.t / q.life;
        if (u >= 1) {
          R.mesh.setMatrixAt(q.i, R.hide);
          R.fade.setX(q.i, 0);
          live.splice(k, 1);
          continue;
        }
        const e = 1 - (1 - u) * (1 - u);
        const r = q.r0 + (q.r1 - q.r0) * e;
        o.position.set(q.x, q.y + 0.005, q.z);
        o.rotation.set(0, 0, 0);
        o.scale.set(r, 1, r);
        o.updateMatrix();
        R.mesh.setMatrixAt(q.i, o.matrix);
        R.fade.setX(q.i, (1 - u) * q.strength);
      }
      R.mesh.instanceMatrix.needsUpdate = true;
      R.fade.needsUpdate = true;
    },
    meshes: [R.mesh, W.mesh],
    /** a ring that stays (where a standing bird's legs meet the water) */
    still(x, y, z, r, strength = 0.5) {
      const i = rings - 1 - kept++;
      live.push({ i, x, y, z, t: 0, life: 1e9, r0: r, r1: r, strength });
      return i;
    },
    /** move a kept ring (strength 0 hides it) */
    move(i, x, y, z, strength) {
      const q = live.find((p) => p.i === i);
      if (q) Object.assign(q, { x, y, z, strength });
    },
  };
}

/** One painted material for the animals' static things (stones, kennel, cats). */
let paintedMat = null;
export function painted() {
  paintedMat ??= cel({ color: 0xffffff, bands: 3, tint: 0x6a6490, flat: false, vertexColors: true, cache: false });
  return paintedMat;
}

/** smoothstep */
export const ease = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
/** the shortest turn from a to b */
export const turn = (a, b) => {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
};
