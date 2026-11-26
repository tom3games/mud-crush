// 形づくりの部品: 角の丸い箱（rbox）と、同じ材質の形を1つにまとめる Baker。車は cars.js・人は people.js
import * as THREE from 'three'
import { mergeGeometries } from '../vendor/jsm/utils/BufferGeometryUtils.js'

const cache = {}
function rbox(w, h, d, r = 0.2) {
  const key = `rb${w}_${h}_${d}_${r}`; if (cache[key]) return cache[key]
  const b = Math.min(r * 0.45, w / 4, h / 4, d / 4), rr = Math.max(0.001, Math.min(r - b, (w - 2 * b) / 2 - 0.001, (d - 2 * b) / 2 - 0.001))
  const W = w - 2 * b, D = d - 2 * b, s = new THREE.Shape(), x = -W / 2, y = -D / 2
  s.moveTo(x + rr, y); s.lineTo(x + W - rr, y); s.quadraticCurveTo(x + W, y, x + W, y + rr); s.lineTo(x + W, y + D - rr); s.quadraticCurveTo(x + W, y + D, x + W - rr, y + D)
  s.lineTo(x + rr, y + D); s.quadraticCurveTo(x, y + D, x, y + D - rr); s.lineTo(x, y + rr); s.quadraticCurveTo(x, y, x + rr, y)
  const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(0.001, h - 2 * b), bevelEnabled: b > 0.001, bevelThickness: b, bevelSize: b, bevelSegments: 2, curveSegments: 5 })
  g.rotateX(-Math.PI / 2); g.translate(0, b, 0)   // 底が y=0 になるように
  g.translate(0, 0, 0); g.computeVertexNormals()
  return cache[key] = g
}
const G = (k, f) => cache[k] || (cache[k] = f())
const M = {}
function mats() {
  if (M.dark) return M
  M.dark = new THREE.MeshStandardMaterial({ color: 0x1c1d1f, roughness: 0.6, metalness: 0.3 })
  M.rubber = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.9 })
  M.steel = new THREE.MeshStandardMaterial({ color: 0xb8bcc0, roughness: 0.28, metalness: 0.95 })
  M.glass = new THREE.MeshPhysicalMaterial({ color: 0x1b2833, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.62, envMapIntensity: 1.4 })
  M.white = new THREE.MeshStandardMaterial({ color: 0xf0ece0, roughness: 0.5 })
  M.lamp = new THREE.MeshStandardMaterial({ color: 0xfff4d0, emissive: 0xffe8a0, emissiveIntensity: 1.1, roughness: 0.2 })
  M.tail = new THREE.MeshStandardMaterial({ color: 0xaa1a12, emissive: 0xff2a10, emissiveIntensity: 0.9, roughness: 0.3 })
  M.skin = new THREE.MeshStandardMaterial({ color: 0xe8b890, roughness: 0.7 })
  M.goggle = new THREE.MeshStandardMaterial({ color: 0x1e3340, roughness: 0.15, metalness: 0.5 })
  return M
}

// 描く回数を減らすため、動かない部品は材質ごとに1つの形に焼き込む
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color()
export class Baker {
  constructor() { this.geos = [] }
  add(geo, x = 0, y = 0, z = 0, color = null, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone()
    _m.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz)); g.applyMatrix4(_m)
    if (g.attributes.uv2) g.deleteAttribute('uv2')
    if (color !== null) { const n = g.attributes.position.count, a = new Float32Array(n * 3); _c.setHex(color); for (let i = 0; i < n; i++) { a[i * 3] = _c.r; a[i * 3 + 1] = _c.g; a[i * 3 + 2] = _c.b } g.setAttribute('color', new THREE.BufferAttribute(a, 3)) }
    this.geos.push(g); return this
  }
  mesh(mat, shadow = true) { if (!this.geos.length) return null; const o = new THREE.Mesh(mergeGeometries(this.geos), mat); o.geometry.userData.own = true; o.castShadow = shadow; o.receiveShadow = true; return o }
}
export { rbox }
