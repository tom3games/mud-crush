// 車の絵: ダンプ・ゴミ収集車・改造バスを箱と筒で組む。前のバンパー（排土板・槍・タイヤの束）は別の入れ物に入れて、壊れたら外れて飛ぶ
import * as THREE from 'three'
import { Baker, rbox } from './models.js?v=1'
import { numberTexture, hazardTexture, grungeTexture } from './textures.js?v=1'

const box = (w, h, d) => new THREE.BoxGeometry(w, h, d)
const cyl = (r0, r1, h, n = 12) => new THREE.CylinderGeometry(r0, r1, h, n)
const M = {}
function mats() {
  if (M.steel) return M
  M.steel = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.8 })
  M.glass = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.12, metalness: 0.4, transparent: true, opacity: 0.8 })
  M.rubber = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0.0 })
  M.lamp = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false })
  M.hazard = new THREE.MeshStandardMaterial({ map: hazardTexture(), roughness: 0.7, metalness: 0.2 })
  return M
}
const mulb = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 }
const _c = new THREE.Color(), _r = new THREE.Color(0x5a2f17)
// 錆びと汚れで色をゆらす
function tone(hex, R, amt = 0.16) { _c.setHex(hex); _c.lerp(_r, R() * amt); _c.multiplyScalar(1 - R() * 0.12); return _c.getHex() }
const BODY_VIEW = { dump: { y: 2.85, z: 0.9 }, trash: { y: 2.8, z: 0.8 }, bus: { y: 3.15, z: 2.95 } }
const FRONT_Z = { dump: 2.6, trash: 2.45, bus: 3.4 }
const DARK = 0x2a2b2d, STEEL = 0x74787c, DSTEEL = 0x45484b

export function buildTruck(car, num) {
  const m = mats(), bodyId = car.T.id, R = mulb(car.id * 91 + 5), col = car.color
  const root = new THREE.Group(), tilt = new THREE.Group(); root.add(tilt)
  const bb = new Baker(), bs = new Baker(), bl = new Baker(), bg = new Baker()   // 車体の色・鉄・灯り・ガラス
  const body = (g, x, y, z, c, ry = 0, rx = 0, rz = 0) => bb.add(g, x, y, z, tone(c, R), rx, ry, rz)
  const steel = (g, x, y, z, c = DSTEEL, rx = 0, ry = 0, rz = 0) => bs.add(g, x, y, z, tone(c, R, 0.1), rx, ry, rz)
  const plate = (w, h, d, x, y, z, ry = 0, rx = 0, rz = 0) => bs.add(box(w, h, d), x, y, z, tone(DSTEEL, R, 0.22), rx, ry, rz)   // 溶接した鉄板
  const wheels = [], addWheel = (x, y, z, r, wd, front) => {
    const g = new THREE.Group(); g.position.set(x, y, z); const wb = new Baker()
    wb.add(cyl(r, r, wd, 18), 0, 0, 0, 0x151515, 0, 0, Math.PI / 2)
    wb.add(cyl(r * 0.62, r * 0.62, wd + 0.02, 14), 0, 0, 0, 0x55524c, 0, 0, Math.PI / 2)
    wb.add(cyl(r * 0.2, r * 0.2, wd + 0.08, 8), 0, 0, 0, 0x2a2a2a, 0, 0, Math.PI / 2)
    for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283; wb.add(box(wd + 0.04, r * 0.09, r * 0.13), 0, Math.sin(a) * r * 0.8, Math.cos(a) * r * 0.8, 0x090909, a) }   // 溝のこぶ
    const mesh = wb.mesh(m.rubber, true); g.add(mesh); tilt.add(g); wheels.push({ g, mesh, front, r }); return g
  }
  const lamp = (w, h, x, y, z, c = 0xffe2a0) => bl.add(box(w, h, 0.06), x, y, z, c)
  let W
  const view = BODY_VIEW[bodyId], fz = FRONT_Z[bodyId], smoke = {}
  if (bodyId === 'dump') {
    W = 3.1
    steel(box(2.3, 0.5, 6.4), 0, 1.25, -0.2, DARK)
    body(rbox(1.7, 0.8, 1.45, 0.2), 0, 1.35, 1.85, col)            // ボンネット
    for (const sx of [-1, 1]) body(rbox(0.6, 0.6, 1.5, 0.2), sx * 1.1, 1.35, 1.85, col)   // 泥よけ
    for (let i = 0; i < 5; i++) steel(box(0.9, 0.04, 0.07), 0, 2.17, 1.45 + i * 0.22, DARK)   // 通気の溝
    steel(box(0.1, 0.1, 1.3), 0, 2.2, 1.85, STEEL)
    body(rbox(2.8, 1.75, 1.5, 0.22), 0, 1.35, 0.4, col)             // 運転台
    body(box(3.0, 0.3, 3.1), 0, 1.5, -2.0, col)                       // 荷台の床
    body(box(0.24, 1.45, 3.1), 1.4, 2.2, -2.0, col); body(box(0.24, 1.45, 3.1), -1.4, 2.2, -2.0, col)
    body(box(3.0, 1.4, 0.24), 0, 2.2, -3.5, col)
    body(box(3.1, 2.3, 0.28), 0, 2.65, -0.55, col)                    // 荷台の前の壁（運転台の上へ張り出す）
    body(box(3.0, 0.2, 1.0), 0, 3.45, -0.65, col, 0, -0.04)
    for (const sx of [-1, 1]) steel(cyl(0.1, 0.1, 1.7, 8), sx * 1.3, 3.3, -0.1, STEEL)          // 縦の排気管
    for (let i = 0; i < 6; i++) plate(0.7 + R() * 0.8, 0.5 + R() * 0.8, 0.05, (R() < 0.5 ? 1 : -1) * 1.5, 2.1 + R() * 0.9, -2.0 + R() * 3.0 - 0.4, Math.PI / 2)   // 荷台の補強板
    for (const sx of [-1, 1]) { plate(0.06, 0.9, 1.2, sx * 1.42, 2.2, 0.5, 0); plate(0.06, 0.6, 1.0, sx * 1.42, 3.0, 0.4, 0) }
    for (const sx of [-1, 1]) bg.add(box(0.05, 0.75, 1.0), sx * 1.4, 2.7, 0.55, 0x1a2128)
    bg.add(box(2.55, 0.85, 0.05), 0, 2.65, 1.14, 0x1a2128)
    steel(box(2.3, 0.7, 0.08), 0, 1.95, 2.59, DSTEEL)                                              // 格子の板
    for (let i = -4; i <= 4; i++) steel(box(0.06, 0.62, 0.1), i * 0.24, 1.95, 2.63, STEEL)
    lamp(0.45, 0.22, -0.9, 2.15, 2.66); lamp(0.45, 0.22, 0.9, 2.15, 2.66)
    for (let i = -2; i <= 2; i++) lamp(0.3, 0.2, i * 0.4, 3.6, -0.2)                                    // 屋根の灯り
    for (const sx of [-1, 1]) addWheel(sx * 1.4, 0.85, 1.85, 0.85, 0.55, true)
    for (const z of [-2.0, -3.05]) for (const sx of [-1, 1]) addWheel(sx * 1.42, 0.85, z, 0.85, 0.55, false)
    smoke.f = [0, 2.5, 2.1]; smoke.l = [1.3, 2.4, 0.2]; smoke.r = [-1.3, 2.4, 0.2]; smoke.b = [0, 2.9, -3.2]; smoke.top = [1.3, 4.2, -0.1]
  } else if (bodyId === 'trash') {
    W = 2.7
    steel(box(2.2, 0.4, 6.0), 0, 1.2, -0.3, DARK)
    body(rbox(1.6, 0.8, 1.25, 0.18), 0, 1.35, 1.8, col)
    for (const sx of [-1, 1]) body(rbox(0.55, 0.6, 1.3, 0.18), sx * 1.05, 1.35, 1.8, col)
    for (let i = 0; i < 4; i++) steel(box(0.8, 0.04, 0.07), 0, 2.17, 1.45 + i * 0.22, DARK)
    body(rbox(2.55, 1.7, 1.5, 0.2), 0, 1.35, 0.45, col)
    body(rbox(2.72, 2.4, 2.9, 0.4), 0, 1.45, -1.8, col)             // 圧縮機の箱
    body(rbox(2.5, 0.9, 1.0, 0.2), 0, 1.15, -3.1, col)              // 後ろの投入口
    steel(box(0.18, 0.18, 1.7), 1.35, 3.2, -1.8, STEEL); steel(box(0.18, 0.18, 1.7), -1.35, 3.2, -1.8, STEEL)
    for (let i = 0; i < 7; i++) plate(0.6 + R() * 0.9, 0.5 + R() * 0.9, 0.05, (R() < 0.5 ? 1 : -1) * 1.38, 1.9 + R() * 1.6, -1.8 + (R() - 0.5) * 2.4, Math.PI / 2)
    for (const sx of [-1, 1]) plate(0.06, 1.0, 1.2, sx * 1.3, 2.2, 0.45)
    plate(1.0, 0.1, 1.2, 0, 3.08, 0.45)
    bg.add(box(0.05, 0.7, 1.0), 1.28, 2.55, 0.5, 0x1a2128); bg.add(box(0.05, 0.7, 1.0), -1.28, 2.55, 0.5, 0x1a2128); bg.add(box(2.3, 0.8, 0.05), 0, 2.55, 1.21, 0x1a2128)
    steel(box(2.2, 0.6, 0.08), 0, 1.9, 2.44, DSTEEL); for (let i = -3; i <= 3; i++) steel(box(0.06, 0.5, 0.1), i * 0.28, 1.9, 2.48, STEEL)
    lamp(0.4, 0.2, -0.8, 2.1, 2.5); lamp(0.4, 0.2, 0.8, 2.1, 2.5)
    for (let i = -2; i <= 2; i++) lamp(0.26, 0.18, i * 0.38, 3.18, 0.0)
    steel(cyl(0.11, 0.11, 1.6, 8), 1.1, 3.1, 0.0, STEEL)
    for (const sx of [-1, 1]) addWheel(sx * 1.25, 0.8, 1.75, 0.8, 0.5, true)
    for (const z of [-1.4, -2.45]) for (const sx of [-1, 1]) addWheel(sx * 1.27, 0.8, z, 0.8, 0.5, false)
    smoke.f = [0, 2.3, 2.0]; smoke.l = [1.2, 2.4, 0.2]; smoke.r = [-1.2, 2.4, 0.2]; smoke.b = [0, 2.0, -3.1]; smoke.top = [1.1, 3.9, 0.0]
  } else {
    W = 2.7
    steel(box(2.2, 0.4, 8.0), 0, 1.0, -0.3, DARK)
    body(rbox(2.7, 2.25, 6.4, 0.28), 0, 1.2, -0.8, col)              // 長い箱
    body(rbox(2.6, 1.15, 1.05, 0.14), 0, 1.25, 2.9, col)             // 鉄板を溶接した鼻
    plate(2.5, 0.9, 0.08, 0, 1.85, 3.43, 0, -0.35); plate(2.7, 0.12, 1.0, 0, 2.43, 2.9)
    for (let i = 0; i < 5; i++) { const x = (R() - 0.5) * 2.2; steel(box(0.1, 0.1, 0.5 + R() * 0.3), x, 2.32, 3.2, STEEL) }
    for (const sx of [-1, 1]) for (let i = 0; i < 5; i++) { bg.add(box(0.05, 0.7, 0.9), sx * 1.36, 2.85, 1.7 - i * 1.2, 0x1a2128); for (let b = 0; b < 3; b++) steel(box(0.06, 0.76, 0.06), sx * 1.4, 2.85, 1.45 - i * 1.2 + b * 0.25, STEEL) }   // 窓と格子
    bg.add(box(2.4, 0.9, 0.05), 0, 3.0, 2.43, 0x1a2128); for (let i = -3; i <= 3; i++) steel(box(0.06, 0.95, 0.07), i * 0.33, 3.0, 2.47, STEEL)
    for (let i = 0; i < 8; i++) plate(0.5 + R() * 1.3, 0.35 + R() * 0.5, 0.05, (R() < 0.5 ? 1 : -1) * 1.38, 1.6 + R() * 0.5, -3 + R() * 5, Math.PI / 2)
    for (let i = 0; i < 5; i++) steel(box(0.1, 0.1, 6), -1.0 + i * 0.5, 3.55, -0.8, STEEL)            // 屋根のかご
    for (const z of [-2.6, -0.6]) body(cyl(0.5, 0.5, 0.45, 12), 0.6, 3.85, z, 0x161616, 0, 0, Math.PI / 2)   // 屋根のスペアタイヤ
    steel(cyl(0.1, 0.1, 1.5, 8), 1.2, 3.3, 2.1, STEEL)
    lamp(0.5, 0.22, -0.8, 1.75, 3.46); lamp(0.5, 0.22, 0.8, 1.75, 3.46)
    for (let i = -3; i <= 3; i++) lamp(0.26, 0.18, i * 0.32, 3.55, 2.46)
    for (const sx of [-1, 1]) addWheel(sx * 1.3, 0.72, 1.9, 0.72, 0.5, true)
    for (const z of [-2.3, -3.3]) for (const sx of [-1, 1]) addWheel(sx * 1.32, 0.72, z, 0.72, 0.5, false)
    smoke.f = [0, 2.5, 2.9]; smoke.l = [1.3, 2.9, 0.6]; smoke.r = [-1.3, 2.9, 0.6]; smoke.b = [0, 2.5, -3.9]; smoke.top = [1.2, 4.1, 2.1]
  }
  // 車体の横の番号
  { const nt = numberTexture(num, '#' + col.toString(16).padStart(6, '0')); nt.anisotropy = 4
    const nm = new THREE.MeshStandardMaterial({ map: nt, transparent: true, roughness: 0.8, metalness: 0.1 })
    const zN = bodyId === 'dump' ? -2.0 : bodyId === 'trash' ? -1.8 : -1.0, yN = bodyId === 'dump' ? 2.25 : bodyId === 'trash' ? 2.7 : 2.4, sN = bodyId === 'bus' ? 1.3 : 1.15
    const xN = bodyId === 'dump' ? 1.53 : 1.42
    for (const sx of [-1, 1]) { const pl = new THREE.Mesh(new THREE.PlaneGeometry(sN, sN), nm); pl.position.set(sx * xN, yN, zN); pl.rotation.y = sx * Math.PI / 2; tilt.add(pl) }
  }
  const bodyMat = new THREE.MeshStandardMaterial({ map: (M.grunge = M.grunge || grungeTexture()), vertexColors: true, roughness: 0.78, metalness: 0.28, envMapIntensity: 0.55 })
  const parts = { body: bb.mesh(bodyMat, true), steel: bs.mesh(m.steel, true), lamp: bl.mesh(m.lamp, false), glass: bg.mesh(m.glass, false) }
  for (const k in parts) if (parts[k]) { parts[k].receiveShadow = false; tilt.add(parts[k]) }
  // 前のバンパー
  const bump = new THREE.Group(); bump.position.set(0, 0, fz); tilt.add(bump)
  const bsb = new Baker(), brb = new Baker(), hazards = []
  const bsteel = (g, x, y, z, c = STEEL, rx = 0, ry = 0, rz = 0) => bsb.add(g, x, y, z, tone(c, R, 0.12), rx, ry, rz)
  const bk = car.T.bump.id
  if (bk === 'plow') {
    const half = W / 2 + 0.1
    for (const sx of [-1, 1]) {
      bsteel(box(half + 0.05, 1.5, 0.13), sx * half * 0.5, 1.45, 0.5, DSTEEL, -0.28, -sx * 0.32, 0)
      bsteel(box(half + 0.05, 0.1, 0.5), sx * half * 0.5, 2.2, 0.45, STEEL, 0, -sx * 0.32, 0)
      const hz = new THREE.Mesh(new THREE.PlaneGeometry(half, 0.28), m.hazard); hz.position.set(sx * half * 0.5, 0.9, 0.74); hz.rotation.set(-0.28, -sx * 0.32, 0); hazards.push(hz)
    }
    bsteel(box(1.0, 1.1, 0.5), 0, 1.6, 0.15, DSTEEL)
  } else if (bk === 'spike') {
    bsteel(box(W + 0.1, 0.45, 0.4), 0, 1.0, 0.2, DSTEEL); bsteel(box(W + 0.1, 0.4, 0.4), 0, 2.15, 0.2, DSTEEL); bsteel(box(0.4, 1.4, 0.4), 0.0, 1.6, 0.15, DSTEEL)
    for (let i = -3; i <= 3; i++) for (const y of [1.05, 2.15]) bsteel(cyl(0.0, 0.17, 0.95, 7), i * 0.45, y, 0.9, 0xb8b4aa, Math.PI / 2)
    bsteel(cyl(0.0, 0.26, 1.5, 7), 0, 1.6, 1.1, 0xc4c0b4, Math.PI / 2)
    for (const sx of [-1, 1]) bsteel(box(0.2, 1.6, 0.9), sx * (W / 2), 1.4, 0.2, DSTEEL)
  } else {
    bsteel(box(W, 0.3, 0.3), 0, 1.0, 0.15, DSTEEL); bsteel(box(W, 0.3, 0.3), 0, 1.85, 0.15, DSTEEL)
    for (const sx of [-1, 1]) bsteel(box(0.16, 1.1, 0.16), sx * (W / 2 - 0.2), 1.45, 0.15, DSTEEL)
    for (let i = -2; i <= 2; i++) for (const y of [1.05, 1.95]) brb.add(new THREE.TorusGeometry(0.4, 0.2, 8, 16), i * 0.62, y, 0.65, 0x141414)
    for (let i = -1; i <= 1; i++) brb.add(new THREE.TorusGeometry(0.38, 0.19, 8, 16), i * 0.62, 1.5, 1.0, 0x181818)
  }
  const bm = bsb.mesh(m.steel, true); if (bm) bump.add(bm)
  const brm = brb.mesh(m.rubber, true); if (brm) bump.add(brm)
  for (const h of hazards) bump.add(h)
  return { root, tilt, wheels, bump, parts, bodyMat, smoke, eye: { y: view.y, z: view.z }, W, fz, bumpKind: bk }
}
