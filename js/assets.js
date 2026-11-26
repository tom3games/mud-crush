// 実物のモデル（Poly Haven・CC0）: 岩2種とタイヤ。起動時に1回読み、複製して使う
import * as THREE from 'three'
import { GLTFLoader } from '../vendor/jsm/loaders/GLTFLoader.js'

const A = { rocks: [], tyre: null }
const load = url => new Promise((ok, ng) => new GLTFLoader().load(url, g => ok(g.scene), undefined, ng))
function firstMesh(root) { let m = null; root.traverse(o => { if (o.isMesh && !m) m = o }); return m }
export async function loadAssets(onStep = () => {}) {
  const [r7, r9, ty] = await Promise.all([load('models/rock_07/rock_07.gltf'), load('models/rock_09/rock_09.gltf'), load('models/old_tyre/old_tyre.gltf')])
  onStep()
  for (const root of [r7, r9]) {
    const m = firstMesh(root); m.geometry.computeBoundingBox(); const b = m.geometry.boundingBox, s = new THREE.Vector3(); b.getSize(s)
    m.geometry.translate(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2)    // 底を y=0・真ん中を原点に
    m.material.envMapIntensity = 0.5; A.rocks.push({ geo: m.geometry, mat: m.material, size: s })
  }
  const t = firstMesh(ty), g = t.geometry; g.computeBoundingBox(); const b = g.boundingBox, s = new THREE.Vector3(); b.getSize(s)
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
