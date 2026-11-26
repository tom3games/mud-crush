// 粒（煙・火・火花・紙吹雪）、床と壁のペイントのしみ、飛んでいく部品、衝撃の輪
import * as THREE from 'three'
import { H } from './arena.js?v=6'
import { splatTexture } from './textures.js?v=6'

const VS = `
attribute float aSize; attribute vec4 aColor; attribute float aShape;
varying vec4 vC; varying float vS; varying float vD;
uniform float uScale;
void main(){ vC=aColor; vS=aShape; vec4 mv=modelViewMatrix*vec4(position,1.0); vD=-mv.z; gl_Position=projectionMatrix*mv; gl_PointSize=min(aSize*uScale/max(0.5,-mv.z), 110.0); }`
const FS = `
varying vec4 vC; varying float vS; varying float vD;
void main(){ vec2 p=gl_PointCoord-0.5; float a;
  if(vS>0.5){ a=step(max(abs(p.x),abs(p.y)),0.42); } else { float d=length(p)*2.0; a=smoothstep(1.0,0.35,d); }
  a*=smoothstep(2.0,9.0,vD); if(vC.a*a<0.01) discard; gl_FragColor=vec4(vC.rgb, vC.a*a); }`

export class Particles {
  constructor(scene, max, additive, scale) {
    this.max = max; this.n = 0; this.add = additive
    this.p = new Float32Array(max * 3); this.c = new Float32Array(max * 4); this.s = new Float32Array(max); this.sh = new Float32Array(max)
    this.v = new Float32Array(max * 3); this.life = new Float32Array(max); this.age = new Float32Array(max); this.s0 = new Float32Array(max); this.s1 = new Float32Array(max)
    this.c0 = new Float32Array(max * 3); this.c1 = new Float32Array(max * 3); this.al = new Float32Array(max); this.grav = new Float32Array(max); this.drag = new Float32Array(max)
    const g = new THREE.BufferGeometry()
    this.ap = new THREE.BufferAttribute(this.p, 3).setUsage(THREE.DynamicDrawUsage); this.ac = new THREE.BufferAttribute(this.c, 4).setUsage(THREE.DynamicDrawUsage)
    this.as = new THREE.BufferAttribute(this.s, 1).setUsage(THREE.DynamicDrawUsage); this.ash = new THREE.BufferAttribute(this.sh, 1)
    g.setAttribute('position', this.ap); g.setAttribute('aColor', this.ac); g.setAttribute('aSize', this.as); g.setAttribute('aShape', this.ash)
    this.mat = new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, uniforms: { uScale: { value: scale } } })
    this.pts = new THREE.Points(g, this.mat); this.pts.frustumCulled = false; this.pts.renderOrder = additive ? 6 : 5; scene.add(this.pts)
    g.setDrawRange(0, 0)
  }
  setScale(s) { this.mat.uniforms.uScale.value = s }
  // 1粒: 位置・速さ・寿命・大きさ(最初→最後)・色(最初→最後)・濃さ・重力・空気抵抗・形(0丸 1四角)
  emit(x, y, z, vx, vy, vz, life, s0, s1, c0, c1, al = 1, grav = 0, drag = 0, shape = 0) {
    if (this.n >= this.max) return
    const i = this.n++, i3 = i * 3
    this.p[i3] = x; this.p[i3 + 1] = y; this.p[i3 + 2] = z; this.v[i3] = vx; this.v[i3 + 1] = vy; this.v[i3 + 2] = vz
    this.life[i] = life; this.age[i] = 0; this.s0[i] = s0; this.s1[i] = s1; this.al[i] = al; this.grav[i] = grav; this.drag[i] = drag; this.sh[i] = shape
    const a = col(c0), b = col(c1); this.c0.set(a, i3); this.c1.set(b, i3)
  }
  update(dt) {
    let n = this.n
    for (let i = 0; i < n; i++) {
      this.age[i] += dt
      if (this.age[i] >= this.life[i]) { // 最後の粒を持ってくる
        n--; if (i !== n) this.copy(n, i); i--; continue
      }
      const i3 = i * 3, k = this.age[i] / this.life[i]
      const dr = 1 - this.drag[i] * dt
      this.v[i3] *= dr; this.v[i3 + 1] = this.v[i3 + 1] * dr - this.grav[i] * dt; this.v[i3 + 2] *= dr
      this.p[i3] += this.v[i3] * dt; this.p[i3 + 1] += this.v[i3 + 1] * dt; this.p[i3 + 2] += this.v[i3 + 2] * dt
      if (this.grav[i] > 0 && this.p[i3 + 1] < H(this.p[i3], this.p[i3 + 2]) + 0.03) { this.p[i3 + 1] = H(this.p[i3], this.p[i3 + 2]) + 0.03; this.v[i3 + 1] *= -0.25; this.v[i3] *= 0.6; this.v[i3 + 2] *= 0.6 }
      this.s[i] = this.s0[i] + (this.s1[i] - this.s0[i]) * k
      const i4 = i * 4
      this.c[i4] = this.c0[i3] + (this.c1[i3] - this.c0[i3]) * k; this.c[i4 + 1] = this.c0[i3 + 1] + (this.c1[i3 + 1] - this.c0[i3 + 1]) * k; this.c[i4 + 2] = this.c0[i3 + 2] + (this.c1[i3 + 2] - this.c0[i3 + 2]) * k
      this.c[i4 + 3] = this.al[i] * (k < 0.12 ? k / 0.12 : 1 - (k - 0.12) / 0.88)
    }
    this.n = n
    this.ap.needsUpdate = this.ac.needsUpdate = this.as.needsUpdate = this.ash.needsUpdate = true
    this.pts.geometry.setDrawRange(0, n)
  }
  copy(a, b) {
    for (const arr of [this.p, this.v, this.c0, this.c1]) for (let k = 0; k < 3; k++) arr[b * 3 + k] = arr[a * 3 + k]
    for (const arr of [this.life, this.age, this.s0, this.s1, this.al, this.grav, this.drag, this.s, this.sh]) arr[b] = arr[a]
    for (let k = 0; k < 4; k++) this.c[b * 4 + k] = this.c[a * 4 + k]
  }
  clear() { this.n = 0; this.pts.geometry.setDrawRange(0, 0) }
}
const _c = new THREE.Color()
function col(h) { _c.setHex(h); return [_c.r, _c.g, _c.b] }

// ペイントのしみ（床・壁・柱）
export class Splats {
  constructor(scene, max = 90) {
    this.max = max; this.i = 0
    const mat = new THREE.MeshBasicMaterial({ alphaMap: splatTexture(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, color: 0xffffff })
    mat.alphaTest = 0.02
    this.mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), mat, max)
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.mesh.frustumCulled = false; this.mesh.renderOrder = 2
    this.mesh.count = 0; this.t = new Float32Array(max); this.life = new Float32Array(max); this.base = new Array(max)
    this.m = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.col = new THREE.Color()
    for (let i = 0; i < max; i++) this.mesh.setColorAt(i, this.col.setHex(0xffffff))
    scene.add(this.mesh)
  }
  add(x, y, z, nx, ny, nz, hex, size = 1) {
    const i = this.i++ % this.max; this.mesh.count = Math.min(this.mesh.count + (this.mesh.count < this.max ? 1 : 0), this.max)
    const n = new THREE.Vector3(nx, ny, nz).normalize()
    this.q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n); const rot = new THREE.Quaternion().setFromAxisAngle(n, Math.random() * 6.28); this.q.premultiply(rot)
    const s = size * (0.7 + Math.random() * 0.8)
    this.m.compose(new THREE.Vector3(x + n.x * 0.04, y + n.y * 0.04, z + n.z * 0.04), this.q, new THREE.Vector3(s, s, s))
    this.mesh.setMatrixAt(i, this.m); this.mesh.setColorAt(i, this.col.setHex(hex))
    this.mesh.instanceMatrix.needsUpdate = true; if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true
  }
  clear() { this.mesh.count = 0; this.i = 0 }
}

// 飛んでいく部品
export class Debris {
  constructor(scene) { this.scene = scene; this.list = [] }
  fling(mesh, vel, spin = 10) {
    if (!mesh.parent) return
    this.scene.attach(mesh); mesh.visible = true
    this.list.push({ m: mesh, v: vel.clone(), w: new THREE.Vector3((Math.random() - 0.5) * spin, (Math.random() - 0.5) * spin, (Math.random() - 0.5) * spin), t: 0, rest: false })
    if (this.list.length > 40) { const o = this.list.shift(); this.scene.remove(o.m); o.m.visible = false }
  }
  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const d = this.list[i]; d.t += dt
      if (d.t > 9) { this.scene.remove(d.m); this.list.splice(i, 1); continue }
      if (d.t > 7) d.m.scale.multiplyScalar(1 - 3 * dt)
      if (d.rest) continue
      d.v.y -= 24 * dt; d.m.position.addScaledVector(d.v, dt)
      d.m.rotation.x += d.w.x * dt; d.m.rotation.y += d.w.y * dt; d.m.rotation.z += d.w.z * dt
      const gy = H(d.m.position.x, d.m.position.z) + 0.12
      if (d.m.position.y < gy) { d.m.position.y = gy; d.v.y *= -0.3; d.v.x *= 0.55; d.v.z *= 0.55; d.w.multiplyScalar(0.5); if (d.v.lengthSq() < 0.6) d.rest = true }
    }
  }
}

// 衝撃の輪・閃光
export class Rings {
  constructor(scene) {
    this.scene = scene; this.list = []
    this.geo = new THREE.RingGeometry(0.82, 1, 40); this.geo.rotateX(-Math.PI / 2)
    this.sph = new THREE.SphereGeometry(1, 16, 12)
  }
  ring(x, y, z, r, color = 0xffd9a0, life = 0.5, op = 0.8) {
    const m = new THREE.Mesh(this.geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }))
    m.position.set(x, y + 0.2, z); m.scale.setScalar(0.3); this.scene.add(m); this.list.push({ m, t: 0, life, r, op, kind: 'ring' })
  }
  flash(x, y, z, r, color = 0xfff0c0, life = 0.28) {
    const m = new THREE.Mesh(this.sph, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending }))
    m.position.set(x, y, z); m.scale.setScalar(0.3); this.scene.add(m); this.list.push({ m, t: 0, life, r, op: 0.95, kind: 'flash' })
  }
  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const o = this.list[i]; o.t += dt; const k = o.t / o.life
      if (k >= 1) { this.scene.remove(o.m); o.m.material.dispose(); this.list.splice(i, 1); continue }
      const e = 1 - Math.pow(1 - k, 3)
      o.m.scale.setScalar(o.r * (0.15 + 0.85 * e)); o.m.material.opacity = o.op * (1 - k)
    }
  }
}
