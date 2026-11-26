// 実物のモデル（Poly Haven・CC0）: 岩2種とタイヤ。起動時に1回読み、複製して使う
import * as THREE from 'three'
import { GLTFLoader } from '../vendor/jsm/loaders/GLTFLoader.js'

const A = { rocks: [], tyre: null }
// 三角形を減らす（頂点を格子で束ねる）。束ねた中の頂点のうち中心に近い物の法線・UV を使い、位置は平均にする
function decimate(geo, target) {
  const pos = geo.attributes.position, nrm = geo.attributes.normal, uv = geo.attributes.uv, idx = geo.index ? geo.index.array : null
  if (!idx) return geo
  geo.computeBoundingBox(); const b = geo.boundingBox, mx = Math.max(b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z), n = pos.count
  let cells = 40, best = null
  for (let iter = 0; iter < 30; iter++) {
    const cell = mx / cells, map = new Map(), cid = new Int32Array(n); let m = 0
    const sx = [], sy = [], sz = [], cnt = []
    for (let i = 0; i < n; i++) {
      const key = Math.floor((pos.getX(i) - b.min.x) / cell) + 4096 * (Math.floor((pos.getY(i) - b.min.y) / cell) + 4096 * Math.floor((pos.getZ(i) - b.min.z) / cell))
      let c = map.get(key); if (c === undefined) { c = m++; map.set(key, c); sx.push(0); sy.push(0); sz.push(0); cnt.push(0) }
      cid[i] = c; sx[c] += pos.getX(i); sy[c] += pos.getY(i); sz[c] += pos.getZ(i); cnt[c]++
    }
    const rep = new Int32Array(m).fill(-1), rd = new Float32Array(m).fill(1e9)
    for (let i = 0; i < n; i++) { const c = cid[i], dx = pos.getX(i) - sx[c] / cnt[c], dy = pos.getY(i) - sy[c] / cnt[c], dz = pos.getZ(i) - sz[c] / cnt[c], d = dx * dx + dy * dy + dz * dz; if (d < rd[c]) { rd[c] = d; rep[c] = i } }
    const tri = []; for (let i = 0; i < idx.length; i += 3) { const a = cid[idx[i]], b2 = cid[idx[i + 1]], c = cid[idx[i + 2]]; if (a !== b2 && b2 !== c && a !== c) tri.push(a, b2, c) }
    best = { m, rep, sx, sy, sz, cnt, tri }
    if (tri.length / 3 <= target) break
    cells = Math.max(5, Math.min(cells - 1, Math.floor(cells * Math.sqrt(target / (tri.length / 3)) * 0.95)))
  }
  const { m, rep, sx, sy, sz, cnt, tri } = best, P = new Float32Array(m * 3), N = new Float32Array(m * 3), U = new Float32Array(m * 2)
  for (let c = 0; c < m; c++) { P[c * 3] = sx[c] / cnt[c]; P[c * 3 + 1] = sy[c] / cnt[c]; P[c * 3 + 2] = sz[c] / cnt[c]; N[c * 3] = nrm.getX(rep[c]); N[c * 3 + 1] = nrm.getY(rep[c]); N[c * 3 + 2] = nrm.getZ(rep[c]); U[c * 2] = uv.getX(rep[c]); U[c * 2 + 1] = uv.getY(rep[c]) }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.BufferAttribute(N, 3)); g.setAttribute('uv', new THREE.BufferAttribute(U, 2)); g.setIndex(tri)
  g.computeBoundingBox(); return g
}
const load = url => new Promise((ok, ng) => new GLTFLoader().load(url, g => ok(g.scene), undefined, ng))
function firstMesh(root) { let m = null; root.traverse(o => { if (o.isMesh && !m) m = o }); return m }
export async function loadAssets(onStep = () => {}) {
  const [r7, r9, ty] = await Promise.all([load('models/rock_07/rock_07.gltf'), load('models/rock_09/rock_09.gltf'), load('models/old_tyre/old_tyre.gltf')])
  onStep()
  for (const root of [r7, r9]) {
    const m = firstMesh(root); m.geometry = decimate(m.geometry, 7000); m.geometry.computeBoundingBox(); const b = m.geometry.boundingBox, s = new THREE.Vector3(); b.getSize(s)
    m.geometry.translate(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2)    // 底を y=0・真ん中を原点に
    m.material.envMapIntensity = 0.35; m.material.metalness = 0; m.material.metalnessMap = null; m.material.roughnessMap = null; m.material.roughness = 0.95; m.material.aoMap = null; m.material.color.setScalar(1.35); A.rocks.push({ geo: m.geometry, mat: m.material, size: s })
  }
  const t = firstMesh(ty); t.geometry = decimate(t.geometry, 1300); const g = t.geometry; g.computeBoundingBox(); const b = g.boundingBox, s = new THREE.Vector3(); b.getSize(s)
  // 一番薄い向きをタイヤの軸として X に合わせ、中心を原点・直径1にそろえる
  const ax = s.x <= s.y && s.x <= s.z ? 'x' : s.y <= s.z ? 'y' : 'z'
  if (ax === 'y') g.rotateZ(Math.PI / 2); else if (ax === 'z') g.rotateY(Math.PI / 2)
  g.computeBoundingBox(); const bb = g.boundingBox, ss = new THREE.Vector3(); bb.getSize(ss)
  g.translate(-(bb.min.x + bb.max.x) / 2, -(bb.min.y + bb.max.y) / 2, -(bb.min.z + bb.max.z) / 2)
  const dia = Math.max(ss.y, ss.z); g.scale(1 / dia, 1 / dia, 1 / dia)
  t.material.envMapIntensity = 0.4
  A.tyre = { geo: g, mat: t.material, w: ss.x / dia }
  onStep()
  return A
}
export const assets = A
