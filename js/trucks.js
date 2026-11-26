// 車の絵: ダンプ・ゴミ収集車・改造バス。運転台とボンネットは横から見た輪郭を押し出して作り、斜めの窓・面取り・部品（灯り・格子・ミラー・泥よけ・タンク・リベット）を足す。
// タイヤは実物のモデル（Poly Haven CC0）。前のバンパーは別の入れ物で、壊れたら外れて飛ぶ。泥の汚れは車ごとの uDirt で下から上へ付いていく
import * as THREE from 'three'
import { Baker, rbox } from './models.js?v=7'
import { numberTexture, hazardTexture, grungeTexture, wornPaintTexture } from './textures.js?v=7'
import { assets } from './assets.js?v=7'

const box = (w, h, d) => new THREE.BoxGeometry(w, h, d)
const cyl = (r0, r1, h, n = 12) => new THREE.CylinderGeometry(r0, r1, h, n)
// 横から見た輪郭 [[z,y],...] を幅 w で押し出す（面取りつき）。b は面取りの大きさ
export function prof(pts, w, b = 0.05) {
  const sh = new THREE.Shape(); pts.forEach(([z, y], i) => i ? sh.lineTo(z, y) : sh.moveTo(z, y)); sh.closePath()
  const g = new THREE.ExtrudeGeometry(sh, { depth: Math.max(0.01, w - 2 * b), bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 2, curveSegments: 1 })
  g.translate(0, 0, -(w - 2 * b) / 2); g.rotateY(-Math.PI / 2); g.computeVertexNormals(); return g
}
const M = {}
function mats() {
  if (M.glass) return M
  M.glass = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.06, metalness: 0.85, transparent: true, opacity: 0.88, envMapIntensity: 1.7 })
  M.lamp = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false })
  M.hazard = new THREE.MeshStandardMaterial({ map: hazardTexture(), roughness: 0.7, metalness: 0.2 })
  M.grunge = grungeTexture(); M.worn = wornPaintTexture('flat'); M.wornEdge = wornPaintTexture('edge')
  return M
}
const mulb = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 }
const _c = new THREE.Color(), _r = new THREE.Color(0x5a2f17)
export function tone(hex, R, amt = 0.16) { _c.setHex(hex); _c.lerp(_r, R() * amt); _c.multiplyScalar(1 - R() * 0.12); return _c.getHex() }
// 泥の汚れ: 車の低い所から上へ。uDirt(0〜1) が増えるほど高くまで、まだらに茶色く染まる
function dirtify(mat, U) {
  mat.onBeforeCompile = sh => {
    sh.uniforms.uDirt = U
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vLP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvLP = position;')
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vLP; uniform float uDirt; float dMask;\nfloat hsh(vec3 p){ return fract(sin(dot(floor(p), vec3(12.9898, 78.233, 37.719))) * 43758.5453); }')
      .replace('#include <color_fragment>', `#include <color_fragment>
        { float n = hsh(vLP * 7.0) * 0.55 + hsh(vLP * 2.3) * 0.45; dMask = clamp(uDirt * 1.5 - vLP.y * 0.28 + (n - 0.5) * 0.7, 0.0, 1.0); dMask = smoothstep(0.1, 0.55, dMask);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.2, 0.135, 0.08) * (0.7 + n * 0.6), dMask * 0.94); }`)
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor *= (1.0 - dMask);')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.95, dMask);')
  }
  return mat
}
const BODY_VIEW = { dump: { y: 2.8, z: 0.6 }, trash: { y: 2.75, z: 0.55 }, bus: { y: 3.15, z: 2.95 } }
const FRONT_Z = { dump: 2.6, trash: 2.45, bus: 3.4 }
const DARK = 0x2a2b2d, STEEL = 0x74787c, DSTEEL = 0x45484b, CHROME = 0x9a9d9a

// タイヤ（実物のモデル）。幅 wd・半径 r に合わせる
function tyreMesh(r, wd) {
  const t = assets.tyre; const m = new THREE.Mesh(t.geo, t.mat)
  m.scale.set(wd / t.w, 2 * r, 2 * r); m.castShadow = true; m.frustumCulled = false; return m
}
export function buildTruck(car, num) {
  const m = mats(), bodyId = car.T.id, R = mulb(car.id * 91 + 5), col = car.color
  const root = new THREE.Group(), tilt = new THREE.Group(); root.add(tilt)
  const dirtU = { value: 0 }
  const bb = new Baker(), bs = new Baker(), bl = new Baker(), bg = new Baker()
  const body = (g, x, y, z, c, ry = 0, rx = 0, rz = 0) => bb.add(g, x, y, z, tone(c, R), rx, ry, rz)
  const steel = (g, x, y, z, c = DSTEEL, rx = 0, ry = 0, rz = 0) => bs.add(g, x, y, z, tone(c, R, 0.1), rx, ry, rz)
  const plate = (w, h, d, x, y, z, ry = 0, rx = 0, rz = 0) => bs.add(box(w, h, d), x, y, z, tone(DSTEEL, R, 0.22), rx, ry, rz)
  const lamp = (w, h, x, y, z, c = 0xffe2a0) => bl.add(box(w, h, 0.05), x, y, z, c)
  const bm2 = new Baker(), wheels = []
  // 車輪: タイヤは回る別の部品、ホイールは車体に焼き込む。dual は後ろの2本組（1つの幅広タイヤに見せる）
  const addWheel = (x, y, z, r, wd, front, dual = false) => {
    const g = new THREE.Group(); g.position.set(x, y, z)
    const mesh = tyreMesh(r, dual ? wd * 2.15 : wd); g.add(mesh); tilt.add(g); wheels.push({ g, mesh, front, r })
    const ox = Math.sign(x) * wd * (dual ? 1.1 : 0.5) * 0.9
    if (dual) { body(box(wd * 2.2 + 0.3, 0.12, r * 2.25), x, 2 * r + 0.07, z, col); body(box(0.1, 0.34, r * 2.1), x + Math.sign(x) * (wd * 1.1 + 0.12), 2 * r - 0.06, z, col) }   // 後ろのタイヤの上の泥よけ（タイヤハウスの屋根と外側の縁）
    steel(cyl(r * 0.58, r * 0.58, 0.06, 18), x + ox, y, z, 0x4a3a2c, 0, 0, Math.PI / 2)
    steel(cyl(r * 0.2, r * 0.2, 0.12, 8), x + ox * 1.05, y, z, 0x2a2a2a, 0, 0, Math.PI / 2)
    for (let i = 0; i < 8; i++) { const a = i / 8 * 6.283; steel(cyl(0.035, 0.035, 0.1, 6), x + ox * 1.06, y + Math.sin(a) * r * 0.36, z + Math.cos(a) * r * 0.36, 0x8a8a84, 0, 0, Math.PI / 2) }
  }
  const mudflap = (x, y, z, w = 0.8, h = 0.7) => steel(box(0.05, h, w), x, y, z, 0x1a1a1a)
  const mirror = (sx, y, z) => { bm2.add(cyl(0.025, 0.025, 0.5, 6), sx * 1.48, y, z, 0x74787c, 0, 0, Math.PI / 2 + sx * 0.35); bm2.add(box(0.08, 0.3, 0.18), sx * 1.7, y, z, 0x2a2b2d) }
  const door = (sx, x, y0, y1, z0, z1) => {
    for (const z of [z0, z1]) steel(box(0.025, y1 - y0, 0.025), sx * (x + 0.012), (y0 + y1) / 2, z, 0x1a1a1a)
    steel(box(0.025, 0.025, z1 - z0), sx * (x + 0.012), y0, (z0 + z1) / 2, 0x1a1a1a); steel(box(0.04, 0.06, 0.22), sx * (x + 0.03), (y0 + y1) / 2 + 0.15, z1 - 0.18, CHROME)
  }
  const rivets = (x, y, z0, z1, n) => { for (let i = 0; i < n; i++) steel(cyl(0.032, 0.032, 0.05, 6), x, y, z0 + (z1 - z0) * i / (n - 1), 0x6a5a48, 0, 0, Math.PI / 2) }
  let W
  const view = BODY_VIEW[bodyId], fz = FRONT_Z[bodyId], smoke = {}
  if (bodyId === 'dump') {
    W = 3.1
    steel(box(2.3, 0.5, 6.4), 0, 1.25, -0.2, DARK)
    body(prof([[-0.45, 1.35], [-0.45, 3.1], [0.7, 3.15], [1.1, 2.45], [1.15, 1.35]], 2.7, 0.07), 0, 0, 0, col)
    body(prof([[1.1, 1.35], [1.1, 1.82], [1.6, 1.9], [2.3, 1.74], [2.5, 1.56], [2.58, 1.35]], 1.5, 0.06), 0, 0, 0, col)
    for (const sx of [-1, 1]) body(prof([[0.85, 1.35], [0.85, 1.72], [1.6, 1.76], [2.4, 1.64], [2.58, 1.45], [2.58, 1.35]], 0.62, 0.05), sx * 1.06, 0, 0, col)
    for (let i = 0; i < 4; i++) steel(box(0.6, 0.02, 0.04), 0, 1.93, 1.4 + i * 0.18, 0x4a3426)
    body(box(3.0, 0.3, 3.1), 0, 1.5, -2.0, col)
    body(box(0.24, 1.45, 3.1), 1.4, 2.2, -2.0, col); body(box(0.24, 1.45, 3.1), -1.4, 2.2, -2.0, col); body(box(3.0, 1.4, 0.24), 0, 2.2, -3.5, col)
    body(prof([[-0.7, 1.5], [-0.7, 4.0], [-0.35, 3.9], [0.3, 3.55], [0.3, 1.5]], 3.1, 0.06), 0, 0, 0, col)
    for (const sx of [-1, 1]) { steel(box(0.2, 0.2, 3.1), sx * 1.45, 2.95, -2.0, DSTEEL); for (let i = 0; i < 5; i++) steel(box(0.13, 1.5, 0.14), sx * 1.5, 2.2, -3.3 + i * 0.68, DSTEEL) }
    steel(box(3.0, 0.2, 0.2), 0, 2.95, -3.55, DSTEEL)
    for (const sx of [-1, 1]) rivets(sx * 1.53, 2.7, -3.3, -0.8, 12)
    steel(cyl(0.12, 0.12, 1.5, 8), 0.0, 2.05, -0.85, STEEL, -0.45); steel(cyl(0.07, 0.07, 1.2, 8), 0, 2.1, -0.95, CHROME, -0.45)
    for (const sx of [-1, 1]) steel(cyl(0.1, 0.1, 1.7, 8), sx * 1.3, 3.2, -0.2, STEEL)
    for (const sx of [-1, 1]) steel(cyl(0.15, 0.15, 0.2, 8), sx * 1.3, 4.06, -0.2, 0x2a2a2a)
    for (let i = 0; i < 6; i++) plate(0.6 + R() * 0.8, 0.5 + R() * 0.8, 0.05, (R() < 0.5 ? 1 : -1) * 1.54, 2.1 + R() * 0.9, -3.2 + R() * 2.2, Math.PI / 2)
    for (const sx of [-1, 1]) { door(sx, 1.36, 1.6, 2.9, -0.3, 0.9); mirror(sx, 2.85, 0.95); steel(box(0.35, 0.08, 0.5), sx * 1.5, 1.05, 0.3, DSTEEL); steel(box(0.35, 0.08, 0.5), sx * 1.5, 1.3, 0.3, DSTEEL)
      steel(cyl(0.34, 0.34, 1.2, 12), sx * 1.28, 0.95, -0.9, 0x6a6a64, Math.PI / 2); mudflap(sx * 1.62, 0.5, -3.7); mudflap(sx * 1.62, 0.55, 1.1, 0.8, 0.6) }
    for (const sx of [-1, 1]) bg.add(box(0.05, 0.75, 1.0), sx * 1.38, 2.7, 0.3, 0x24313a)
    bg.add(prof([[0.7, 3.0], [1.12, 2.5], [1.14, 2.5], [0.72, 3.0]], 2.5, 0.01), 0, 0, 0, 0x24313a)
    steel(box(1.3, 0.5, 0.06), 0, 1.6, 2.58, 0x222222); for (let i = -4; i <= 4; i++) steel(box(0.05, 0.42, 0.09), i * 0.15, 1.6, 2.62, CHROME)
    for (const sx of [-1, 1]) { steel(box(0.5, 0.32, 0.14), sx * 1.06, 1.52, 2.56, 0x1d1d1d); lamp(0.38, 0.2, sx * 1.06, 1.52, 2.64) }
    for (let i = -2; i <= 2; i++) lamp(0.3, 0.2, i * 0.4, 3.3, 0.1)
    for (const sx of [-1, 1]) addWheel(sx * 1.4, 0.85, 1.85, 0.85, 0.55, true)
    for (const sx of [-1, 1]) addWheel(sx * 1.42, 0.85, -2.55, 0.85, 0.55, false, true)
    smoke.f = [0, 2.1, 2.0]; smoke.l = [1.3, 2.4, 0.2]; smoke.r = [-1.3, 2.4, 0.2]; smoke.b = [0, 2.9, -3.2]; smoke.top = [1.3, 4.2, -0.2]
  } else if (bodyId === 'trash') {
    W = 2.7
    steel(box(2.2, 0.4, 6.0), 0, 1.2, -0.3, DARK)
    body(prof([[-0.3, 1.35], [-0.3, 3.0], [0.65, 3.05], [1.0, 2.4], [1.2, 1.35]], 2.5, 0.07), 0, 0, 0, col)
    body(prof([[1.2, 1.35], [1.2, 1.82], [1.7, 1.9], [2.2, 1.74], [2.38, 1.56], [2.45, 1.35]], 1.4, 0.06), 0, 0, 0, col)
    for (const sx of [-1, 1]) body(prof([[0.95, 1.35], [0.95, 1.7], [1.6, 1.74], [2.3, 1.64], [2.45, 1.45], [2.45, 1.35]], 0.6, 0.05), sx * 1.0, 0, 0, col)
    for (let i = 0; i < 4; i++) steel(box(0.5, 0.02, 0.04), 0, 1.93, 1.4 + i * 0.17, 0x4a3426)
    body(rbox(2.72, 2.4, 2.9, 0.4), 0, 1.45, -1.8, col)
    body(rbox(2.5, 0.9, 1.0, 0.2), 0, 1.15, -3.1, col)
    for (const sx of [-1, 1]) { steel(box(0.18, 0.18, 1.7), sx * 1.35, 3.2, -1.8, STEEL); for (let i = 0; i < 5; i++) steel(box(0.08, 1.9, 0.12), sx * 1.4, 2.5, -3.0 + i * 0.6, DSTEEL) }
    steel(box(2.5, 0.1, 0.5), 0, 1.0, -3.75, 0x3a3a3a); steel(box(2.2, 0.1, 0.1), 0, 2.1, -3.6, DSTEEL)
    for (let i = 0; i < 6; i++) plate(0.6 + R() * 0.9, 0.5 + R() * 0.9, 0.05, (R() < 0.5 ? 1 : -1) * 1.4, 1.9 + R() * 1.6, -1.8 + (R() - 0.5) * 2.4, Math.PI / 2)
    for (const sx of [-1, 1]) { rivets(sx * 1.38, 3.1, -3.1, -0.5, 10); door(sx, 1.27, 1.55, 2.75, -0.1, 0.9); mirror(sx, 2.8, 0.9); steel(box(0.3, 0.08, 0.45), sx * 1.38, 1.05, 0.35, DSTEEL); steel(cyl(0.3, 0.3, 1.0, 12), sx * 1.15, 0.95, -0.9, 0x6a6a64, Math.PI / 2); mudflap(sx * 1.5, 0.5, -3.2, 0.7, 0.6) }
    steel(cyl(0.18, 0.18, 0.3, 10), 0, 3.95, -1.8, 0xe0a020)
    for (const sx of [-1, 1]) bg.add(box(0.05, 0.7, 1.0), sx * 1.27, 2.55, 0.3, 0x24313a)
    bg.add(prof([[0.62, 2.95], [1.0, 2.45], [1.02, 2.45], [0.64, 2.95]], 2.3, 0.01), 0, 0, 0, 0x24313a)
    steel(box(1.2, 0.5, 0.06), 0, 1.6, 2.43, 0x222222); for (let i = -3; i <= 3; i++) steel(box(0.05, 0.42, 0.09), i * 0.17, 1.6, 2.47, CHROME)
    for (const sx of [-1, 1]) { steel(box(0.46, 0.3, 0.14), sx * 1.0, 1.52, 2.4, 0x1d1d1d); lamp(0.34, 0.18, sx * 1.0, 1.52, 2.48) }
    for (let i = -2; i <= 2; i++) lamp(0.26, 0.18, i * 0.38, 3.1, 0.12)
    steel(cyl(0.11, 0.11, 1.6, 8), 1.15, 3.1, -0.1, STEEL)
    for (const sx of [-1, 1]) addWheel(sx * 1.25, 0.8, 1.75, 0.8, 0.5, true)
    for (const sx of [-1, 1]) addWheel(sx * 1.27, 0.8, -1.95, 0.8, 0.5, false, true)
    smoke.f = [0, 2.05, 1.9]; smoke.l = [1.2, 2.4, 0.2]; smoke.r = [-1.2, 2.4, 0.2]; smoke.b = [0, 2.0, -3.1]; smoke.top = [1.1, 3.9, -0.1]
  } else {
    W = 2.7
    steel(box(2.2, 0.4, 8.0), 0, 1.0, -0.3, DARK)
    body(rbox(2.7, 2.25, 6.4, 0.28), 0, 1.2, -0.8, col)
    body(prof([[2.35, 1.25], [2.35, 2.3], [3.0, 2.48], [3.43, 2.1], [3.45, 1.25]], 2.6, 0.06), 0, 0, 0, col)
    plate(2.5, 0.9, 0.08, 0, 1.85, 3.46, 0, -0.35); plate(2.7, 0.1, 1.0, 0, 2.5, 2.95)
    for (let i = 0; i < 6; i++) steel(box(0.08, 0.08, 0.7), -1.1 + i * 0.44, 2.58, 3.0, STEEL)
    for (const sx of [-1, 1]) for (let i = 0; i < 5; i++) { bg.add(box(0.05, 0.7, 0.9), sx * 1.36, 2.85, 1.7 - i * 1.2, 0x24313a); for (let b = 0; b < 3; b++) steel(box(0.06, 0.76, 0.06), sx * 1.4, 2.85, 1.45 - i * 1.2 + b * 0.25, STEEL) }
    bg.add(box(2.4, 0.9, 0.05), 0, 3.0, 2.43, 0x24313a); for (let i = -3; i <= 3; i++) steel(box(0.06, 0.95, 0.07), i * 0.33, 3.0, 2.47, STEEL)
    for (let i = 0; i < 8; i++) plate(0.5 + R() * 1.3, 0.35 + R() * 0.5, 0.05, (R() < 0.5 ? 1 : -1) * 1.38, 1.6 + R() * 0.5, -3 + R() * 5, Math.PI / 2)
    for (const sx of [-1, 1]) { rivets(sx * 1.38, 1.5, -3.9, 2.2, 14); rivets(sx * 1.38, 3.3, -3.9, 2.2, 14); mirror(sx, 2.7, 2.3); mudflap(sx * 1.5, 0.45, -3.9, 0.7, 0.6) }
    for (let i = 0; i < 5; i++) steel(box(0.1, 0.1, 6), -1.0 + i * 0.5, 3.55, -0.8, STEEL)
    for (let i = 0; i < 12; i++) steel(box(2.2, 0.08, 0.08), 0, 3.55, -3.5 + i * 0.55, STEEL)
    steel(cyl(0.1, 0.1, 1.5, 8), 1.2, 3.3, 2.1, STEEL); steel(cyl(0.1, 0.1, 1.5, 8), -1.2, 3.3, 2.1, STEEL)
    lamp(0.5, 0.22, -0.8, 1.75, 3.5); lamp(0.5, 0.22, 0.8, 1.75, 3.5)
    for (const sx of [-1, 1]) steel(box(0.46, 0.32, 0.12), sx * 0.8, 1.75, 3.44, 0x1d1d1d)
    for (let i = -3; i <= 3; i++) lamp(0.26, 0.18, i * 0.32, 3.55, 2.46)
    for (const sx of [-1, 1]) addWheel(sx * 1.3, 0.72, 1.9, 0.72, 0.5, true)
    for (const sx of [-1, 1]) addWheel(sx * 1.32, 0.72, -2.8, 0.72, 0.5, false, true)
    smoke.f = [0, 2.5, 2.9]; smoke.l = [1.3, 2.9, 0.6]; smoke.r = [-1.3, 2.9, 0.6]; smoke.b = [0, 2.5, -3.9]; smoke.top = [1.2, 4.1, 2.1]
  }
  if (bodyId === 'bus') for (const z of [-2.6, -0.6]) { const t = tyreMesh(0.55, 0.45); t.rotation.z = Math.PI / 2; t.position.set(0.5, 3.95, z); tilt.add(t) }
  { const nt = numberTexture(num, '#' + col.toString(16).padStart(6, '0')); nt.anisotropy = 4
    const nm = new THREE.MeshStandardMaterial({ map: nt, transparent: true, roughness: 0.8, metalness: 0.1 })
    const zN = bodyId === 'dump' ? -2.0 : bodyId === 'trash' ? -1.8 : -1.0, yN = bodyId === 'dump' ? 2.25 : bodyId === 'trash' ? 2.7 : 2.4, sN = bodyId === 'bus' ? 1.3 : 1.15
    const xN = bodyId === 'dump' ? 1.55 : 1.42
    for (const sx of [-1, 1]) { const pl = new THREE.Mesh(new THREE.PlaneGeometry(sN, sN), nm); pl.position.set(sx * xN, yN, zN); pl.rotation.y = sx * Math.PI / 2; tilt.add(pl) }
  }
  const bodyMat = dirtify(new THREE.MeshStandardMaterial({ map: m.grunge, vertexColors: true, roughness: 0.74, metalness: 0.3, envMapIntensity: 0.55 }), dirtU)
  const steelMat = dirtify(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.8 }), dirtU)
  const parts = { body: bb.mesh(bodyMat, true), steel: bs.mesh(steelMat, true), lamp: bl.mesh(m.lamp, false), glass: bg.mesh(m.glass, false), mirror: bm2.mesh(steelMat, true) }
  for (const k in parts) if (parts[k]) { parts[k].receiveShadow = false; tilt.add(parts[k]) }
  const bump = new THREE.Group(); bump.position.set(0, 0, fz); tilt.add(bump)
  const bsb = new Baker(), bpb = new Baker(), hazards = []
  const bpaint = (g, x, y, z, c, rx = 0, ry = 0, rz = 0) => bpb.add(g, x, y, z, tone(c, R, 0.3), rx, ry, rz)
  const bsteel = (g, x, y, z, c = STEEL, rx = 0, ry = 0, rz = 0) => bsb.add(g, x, y, z, tone(c, R, 0.12), rx, ry, rz)
  const bk = car.T.bump.id
  if (bk === 'plow') {
    // 厚い鉄の湾曲した排土板。V字の2枚。表は凹んだ曲面、縁は巻いた補強、溶接の筋・ボルト・刃先・油圧の腕
    const wt = m.worn, we = m.wornEdge, mk = t => dirtify(new THREE.MeshStandardMaterial({ map: t.map, bumpMap: t.bump, bumpScale: 1.4, vertexColors: true, roughness: 0.5, metalness: 0.3, envMapIntensity: 0.6 }), dirtU), plowMat = mk(wt), edgeMat = mk(we), bed = new Baker()
    const bpl = new Baker(), half = W / 2 + 0.1, wing = half * 0.97, th = -0.32
    const board = [[0.5, 0.5], [0.72, 0.62], [0.79, 0.95], [0.74, 1.35], [0.62, 1.7], [0.46, 1.98], [0.3, 2.05], [0.22, 1.95], [0.36, 1.72], [0.5, 1.4], [0.56, 1.0], [0.52, 0.72]]
    for (const sx of [-1, 1]) {
      const ang = sx * th, cs = Math.cos(ang), sn = Math.sin(ang), cx = sx * wing * 0.5
      // 板に沿った位置（局所の x, y, z）→ 世界の位置。局所は板の面が z 向き
      const at = (lx, y, lz) => [cx + lx * cs + lz * sn, y, -lx * sn + lz * cs]
      const put = (geo, lx, y, lz, c, rx = 0, rz = 0) => { const [px, py, pz] = at(lx, y, lz); bpl.add(geo, px, py, pz, c, rx, ang, rz) }
      put(prof(board, wing, 0.05), 0, 0, 0, 0xffffff)                                   // 板（面取りした輪郭を押し出し）
      { const [px, py, pz] = at(0, 2.0, 0.28); bed.add(cyl(0.11, 0.11, wing, 10), px, py, pz, 0xffffff, 0, ang, Math.PI / 2) }             // 上の縁の巻いた補強の筒
      for (let i = 0; i < 4; i++) put(box(0.13, 1.5, 0.12), -wing * 0.42 + i * wing * 0.28, 1.3, 0.38, 0x7a7e80)   // 裏の補強の柱
      for (const [y, z] of [[0.95, 0.79], [1.62, 0.65]]) for (let i = 0; i < 6; i++) put(cyl(0.07, 0.07, 0.06, 6), -wing * 0.4 + i * wing * 0.16, y, z + 0.02, 0x4a4a46, Math.PI / 2)   // ボルトの頭
      for (const [y, z] of [[1.3, 0.77]]) put(cyl(0.035, 0.035, wing * 0.96, 6), 0, y, z + 0.03, 0x2a2622, 0, Math.PI / 2)       // 溶接の筋
      { const [px, py, pz] = at(0, 0.5, 0.64); bed.add(box(wing, 0.13, 0.2), px, py, pz, 0x9a9c9a, 0, ang, 0) }                                 // 刃先（地金の鉄）
      { const [px, py, pz] = at(sx * -wing * 0.5, 1.1, 0.5); bed.add(box(0.06, 1.2, 0.5), px, py, pz, 0xb0a898, 0, ang, 0) }                    // 端の板
      const hz = new THREE.Mesh(new THREE.PlaneGeometry(wing * 0.96, 0.26), m.hazard); const [hx, hy, hzz] = at(0, 0.82, 0.83); hz.position.set(hx, hy, hzz); hz.rotation.set(-0.16, ang, 0); hazards.push(hz)
    }
    bpl.add(box(1.3, 1.0, 0.7), 0, 1.45, 0.1, 0xe8d8c0); bpl.add(box(1.5, 0.2, 0.9), 0, 0.85, 0.2, 0xc8b8a0)      // 中央の台座
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) bsteel(box(0.1, 1.04, 0.1), sx * 0.64, 1.45, 0.1 + sz * 0.34, 0x6a6e70)   // 台座の角の山形鋼
    bsteel(box(1.4, 0.1, 0.1), 0, 1.97, 0.44, 0x6a6e70); bsteel(box(1.4, 0.1, 0.1), 0, 0.95, 0.46, 0x6a6e70)
    for (let i = -3; i <= 3; i++) bsteel(cyl(0.05, 0.05, 0.06, 6), i * 0.2, 1.97, 0.5, 0x3a3a38, Math.PI / 2)
    for (const sx of [-1, 1]) { bpl.add(cyl(0.09, 0.09, 1.3, 8), sx * 0.85, 1.25, -0.2, 0x9a9d9a, 0.75); bpl.add(cyl(0.13, 0.13, 0.5, 8), sx * 0.85, 1.0, -0.6, 0x3a3a3a, 0.75) }   // 油圧の腕
    const pm = bpl.mesh(plowMat, true); if (pm) bump.add(pm)
    const pe = bed.mesh(edgeMat, true); if (pe) bump.add(pe)
  } else if (bk === 'spike') {
    bsteel(box(W + 0.1, 0.45, 0.4), 0, 1.0, 0.2, DSTEEL); bsteel(box(W + 0.1, 0.4, 0.4), 0, 2.15, 0.2, DSTEEL); bsteel(box(0.4, 1.4, 0.4), 0.0, 1.6, 0.15, DSTEEL)
    for (let i = -3; i <= 3; i++) for (const y of [1.05, 2.15]) bsteel(cyl(0.0, 0.17, 0.95, 7), i * 0.45, y, 0.9, 0xb8b4aa, Math.PI / 2)
    bsteel(cyl(0.0, 0.26, 1.5, 7), 0, 1.6, 1.1, 0xc4c0b4, Math.PI / 2)
    for (const sx of [-1, 1]) bsteel(box(0.2, 1.6, 0.9), sx * (W / 2), 1.4, 0.2, DSTEEL)
    for (let i = -3; i <= 3; i++) for (const y of [1.05, 2.15]) bsteel(cyl(0.2, 0.2, 0.1, 8), i * 0.45, y, 0.35, 0x3a3a3a, Math.PI / 2)
  } else {
    bsteel(box(W, 0.3, 0.3), 0, 1.0, 0.15, DSTEEL); bsteel(box(W, 0.3, 0.3), 0, 1.85, 0.15, DSTEEL)
    for (const sx of [-1, 1]) bsteel(box(0.16, 1.1, 0.16), sx * (W / 2 - 0.2), 1.45, 0.15, DSTEEL)
    for (let i = -2; i <= 2; i++) for (const y of [1.05, 1.95]) { const t = tyreMesh(0.62, 0.5); t.rotation.y = Math.PI / 2; t.position.set(i * 0.62, y, 0.62); bump.add(t) }
    for (let i = -1; i <= 1; i++) { const t = tyreMesh(0.58, 0.5); t.rotation.y = Math.PI / 2; t.position.set(i * 0.62, 1.5, 1.0); bump.add(t) }
  }
  const bm = bsb.mesh(steelMat, true); if (bm) bump.add(bm)
  const bpm = bpb.mesh(bodyMat, true); if (bpm) bump.add(bpm)
  for (const h of hazards) bump.add(h)
  return { root, tilt, wheels, bump, parts, bodyMat, steelMat, dirtU, smoke, eye: { y: view.y, z: view.z }, W, fz, bumpKind: bk }
}
// 廃車置き場用の車の抜け殻（輪郭を押し出して面取り・ホイールハウス・割れた窓・バンパー）。bj に車体、bg に窓とホイールハウスの暗い面を足す。ang は向き（y 回り）
export function wreckInto(bj, bg, x, y, z, ang, col, R, tilt = 0) {
  const c = tone(col, R, 0.35), s = Math.sin(ang), co = Math.cos(ang)
  const at = (lx, ly, lz) => [x + lx * co + lz * s, y + ly, z - lx * s + lz * co]      // 車の局所 → 世界（傾きは無視した近似）
  bj.add(prof([[-2.15, 0.15], [-2.15, 0.9], [-1.95, 1.08], [-0.9, 1.1], [-0.4, 1.12], [1.1, 1.08], [1.95, 0.98], [2.2, 0.62], [2.2, 0.15]], 2.0, 0.07), x, y + 0.1, z, c, 0, ang, tilt)
  bj.add(prof([[-1.35, 1.1], [-1.05, 1.78], [0.45, 1.8], [1.0, 1.12]], 1.78, 0.06), x, y + 0.1, z, tone(col, R, 0.55), 0, ang, tilt)
  const gl = (w, h, d, lx, ly, lz) => { const [px, py, pz] = at(lx, ly, lz); bg.add(box(w, h, d), px, py, pz, 0x15191c, 0, ang, tilt) }
  gl(1.62, 0.5, 0.05, 0, 1.55, 0.74); gl(1.62, 0.5, 0.05, 0, 1.5, -1.02); gl(0.05, 0.4, 1.0, 0.9, 1.52, -0.2); gl(0.05, 0.4, 1.0, -0.9, 1.52, -0.2)   // 窓
  for (const sx of [-1, 1]) for (const lz of [-1.35, 1.4]) { const [px, py, pz] = at(sx * 1.01, 0.62, lz); bg.add(cyl(0.5, 0.5, 0.06, 14), px, py, pz, 0x0d0d0d, 0, ang, Math.PI / 2 + tilt); bj.add(cyl(0.26, 0.26, 0.08, 10), px + sx * 0.02 * co, py, pz - sx * 0.02 * s, 0x6a5a48, 0, ang, Math.PI / 2 + tilt) }   // ホイールハウスとむき出しのホイール
  { const [px, py, pz] = at(0, 0.38, 2.22); bj.add(box(2.1, 0.16, 0.2), px, py, pz, 0x6a6a66, 0, ang, tilt) }
  { const [px, py, pz] = at(0, 0.4, -2.18); bj.add(box(2.1, 0.16, 0.2), px, py, pz, 0x6a6a66, 0, ang, tilt) }
}
