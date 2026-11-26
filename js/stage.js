// 画面: 採石場を組み、試合の状態(sim)を毎フレーム絵にする。出来事(events)から演出を出す
import * as THREE from 'three'
import { WORLD, SAFE0, POLES, BOXES, MUDS, H, mudAt } from './arena.js?v=7'
import * as TX from './textures.js?v=7'
import { Baker, rbox } from './models.js?v=7'
import { buildTruck, wreckInto } from './trucks.js?v=7'
import { assets } from './assets.js?v=7'
import { Particles, Debris, Rings } from './fx.js?v=7'
import { statsOf } from './sim.js?v=7'

const clampN = (v, a, b) => v < a ? a : v > b ? b : v
const lerp = (a, b, t) => a + (b - a) * t
const lerpAng = (a, b, t) => { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return a + d * t }
export const PREVIEW_AT = { x: 38, z: -14 }
const DUST = 0xb8a07c, MUDC = 0x3a2a1c

export class Stage {
  constructor(host, opts = {}) {
    this.low = !!opts.low; this.host = host; this.snd = () => {}
    const r = this.renderer = new THREE.WebGLRenderer({ antialias: !this.low, powerPreference: 'high-performance', preserveDrawingBuffer: !!opts.preserve })
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.low ? 1.6 : 2))
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap
    r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 0.95
    host.appendChild(r.domElement); r.domElement.id = 'gl'
    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color(0xb59c78); this.scene.fog = new THREE.FogExp2(0xbfa786, 0.0072)
    this.cam = new THREE.PerspectiveCamera(75, 1, 0.25, 600)
    this.scene.add(this.cam)
    this.camYaw = 0; this.shake = 0; this.hitStop = 0; this.time = 0; this.camRoll = 0
    this.views = new Map(); this.preview = null; this.safeR = SAFE0
    this.buildEnv(); this.buildLights(); this.buildArena(); this.buildDynamic()
    this.resize()
  }
  resize() {
    const w = this.host.clientWidth || innerWidth, h = this.host.clientHeight || innerHeight
    this.renderer.setSize(w, h, false); this.renderer.domElement.style.width = w + 'px'; this.renderer.domElement.style.height = h + 'px'
    const asp = w / h; this.cam.aspect = asp
    this.cam.fov = asp < 1 ? Math.min(88, 2 * Math.atan(Math.tan(0.5 * 52 * Math.PI / 180) / asp) * 180 / Math.PI * 0.62 + 36) : 64
    this.cam.updateProjectionMatrix(); this.w = w; this.h = h
    const sc = h * this.renderer.getPixelRatio() * 0.5
    this.pDust && this.pDust.setScale(sc); this.pFire && this.pFire.setScale(sc)
  }
  buildEnv() {   // 濡れた泥や鉄の映り込み用の簡単な空
    const env = new THREE.Scene()
    const dome = new THREE.Mesh(new THREE.SphereGeometry(50, 24, 16), new THREE.MeshBasicMaterial({ side: THREE.BackSide, vertexColors: true }))
    const pos = dome.geometry.attributes.position, col = new Float32Array(pos.count * 3), c = new THREE.Color()
    for (let i = 0; i < pos.count; i++) { const y = pos.getY(i) / 50; c.setRGB(...(y > 0 ? [0.62 + y * 0.1, 0.5 + y * 0.08, 0.36 + y * 0.1] : [0.26, 0.18, 0.12])); col.set([c.r, c.g, c.b], i * 3) }
    dome.geometry.setAttribute('color', new THREE.BufferAttribute(col, 3)); env.add(dome)
    const sunP = new THREE.Mesh(new THREE.PlaneGeometry(16, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 4.6, 3) })); sunP.position.set(-30, 24, 28); sunP.lookAt(0, 0, 0); env.add(sunP)
    const pm = new THREE.PMREMGenerator(this.renderer); this.scene.environment = pm.fromScene(env, 0.03).texture; this.scene.environmentIntensity = 0.35; pm.dispose()
  }
  buildLights() {
    const s = this.scene
    s.add(new THREE.HemisphereLight(0xe8d2ac, 0x6a5038, 0.8))
    const sun = this.sun = new THREE.DirectionalLight(0xffd6a4, 2.25); sun.position.set(-48, 24, 34); sun.castShadow = true
    const ms = this.low ? 1024 : 2048; sun.shadow.mapSize.set(ms, ms); const sc = sun.shadow.camera; sc.left = -56; sc.right = 56; sc.top = 56; sc.bottom = -56; sc.near = 5; sc.far = 170; sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.1
    s.add(sun); s.add(sun.target)
    const fill = new THREE.DirectionalLight(0x9fb0c8, 0.4); fill.position.set(30, 14, -30); s.add(fill)
    this.sunOff = new THREE.Vector3(-48, 24, 34)
  }
  // ---------------------------------------------------------------- 固定の景色
  buildArena() {
    const S = this.scene, aniso = this.low ? 4 : 8, Wd = WORLD + 10
    // 空
    const sky = new THREE.Mesh(new THREE.SphereGeometry(450, 32, 16), new THREE.MeshBasicMaterial({ map: TX.skyTexture(), side: THREE.BackSide, fog: false, depthWrite: false, toneMapped: false })); sky.renderOrder = -10; sky.rotation.y = 2.52; S.add(sky); this.sky = sky
    // 地面: 高さ付きの格子。世界を1枚の絵で貼り、細かい土の粒を重ねる。泥は濡れて光る
    const step = 2, n = Math.round(Wd * 2 / step) + 1, pos = new Float32Array(n * n * 3), uv = new Float32Array(n * n * 2), idx = []
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const k = j * n + i, x = -Wd + i * step, z = -Wd + j * step; pos.set([x, H(x, z), z], k * 3); uv.set([(x + Wd) / (2 * Wd), (z + Wd) / (2 * Wd)], k * 2) }
    for (let j = 0; j < n - 1; j++) for (let i = 0; i < n - 1; i++) { const a = j * n + i, b = a + 1, c = a + n, d = c + 1; idx.push(a, c, b, b, c, d) }
    const g = this.groundGeo = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals()
    const gt = TX.groundTextures(this.low ? 1536 : 2048, aniso), det = TX.detailTexture(aniso)
    const fm = new THREE.MeshStandardMaterial({ map: gt.map, bumpMap: gt.bump, bumpScale: 1.7, roughnessMap: gt.rough, roughness: 1, metalness: 0.0, envMapIntensity: 0.9 })
    fm.onBeforeCompile = sh => {
      sh.uniforms.uDetail = { value: det }
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vWP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP = position.xz;')
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vWP; uniform sampler2D uDetail;')
        .replace('#include <map_fragment>', `#include <map_fragment>
          vec3 dt = texture2D(uDetail, vWP * 0.31).rgb * texture2D(uDetail, vWP * 0.083 + 0.37).rgb * 4.0;
          diffuseColor.rgb *= clamp(dt, 0.45, 1.5);`)
    }
    const floor = new THREE.Mesh(g, fm); floor.receiveShadow = true; S.add(floor); this.floor = floor
    // 縮んだ輪の外は崩れる地面: 暗く赤茶けて縞が出る
    this.ringU = { uR: { value: SAFE0 }, uT: { value: 0 } }
    const om = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: this.ringU, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
      vertexShader: 'varying vec2 vP; void main(){ vP = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform float uR; uniform float uT; varying vec2 vP; void main(){ float r = length(vP); float a = smoothstep(uR - 0.5, uR + 2.0, r); float s = 0.5 + 0.5 * sin((vP.x + vP.y) * 0.9 + uT * 1.5); float w = 0.5 + 0.5 * sin(r * 1.3 - uT * 2.5); vec3 col = mix(vec3(0.16, 0.06, 0.03), vec3(0.45, 0.16, 0.05), s * 0.4 + w * 0.3); float edge = smoothstep(uR + 2.6, uR, r) * smoothstep(uR - 0.2, uR + 0.4, r); col += vec3(0.7, 0.28, 0.06) * edge; gl_FragColor = vec4(col, a * 0.62 + edge * 0.3); }' })
    const over = new THREE.Mesh(g, om); over.renderOrder = 1; over.position.y = 0.05; S.add(over)
    // 縮む輪のふち: 土ぼこりの壁
    const wallM = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false, uniforms: this.ringU,
      vertexShader: 'varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vW = (modelMatrix * vec4(position,1.0)).xyz; gl_Position = projectionMatrix * viewMatrix * vec4(vW, 1.0); }',
      fragmentShader: 'uniform float uT; varying vec2 vUv; varying vec3 vW; void main(){ float a = atan(vW.x, vW.z); float n = 0.5 + 0.5 * sin(a * 31.0 + uT * 1.4 + vUv.y * 5.0) * sin(a * 17.0 - uT * 0.8); float v = pow(1.0 - vUv.y, 1.6); float near = smoothstep(6.0, 34.0, distance(vW, cameraPosition)); gl_FragColor = vec4(vec3(0.78, 0.52, 0.25) + n * 0.1, v * (0.16 + n * 0.22) * near); }' })
    
    // 岩壁: 採石場の段（ベンチ）。壁と平らな段を交互に重ね、岩肌を凹凸にする。段は土ぼこりで明るく、壁は地層の縞
    const pr = [[WORLD + 3, -3]], seg = (r0, y0, r1, y1, n) => { for (let i = 1; i <= n; i++) pr.push([r0 + (r1 - r0) * i / n, y0 + (y1 - y0) * i / n]) }
    seg(WORLD + 3, -3, WORLD + 4.5, 9, 14); seg(WORLD + 4.5, 9, WORLD + 15, 9.8, 4); seg(WORLD + 15, 9.8, WORLD + 16.5, 23, 12); seg(WORLD + 16.5, 23, WORLD + 29, 23.8, 4); seg(WORLD + 29, 23.8, WORLD + 31, 42, 14); seg(WORLD + 31, 42, WORLD + 70, 48, 3)
    const rg = new THREE.LatheGeometry(pr.map(([r, y]) => new THREE.Vector2(r, y)), 200), rp = rg.attributes.position
    for (let i = 0; i < rp.count; i++) { const x = rp.getX(i), y = rp.getY(i), z = rp.getZ(i), a = Math.atan2(x, z), steep = Math.abs(Math.sin(y * 0.9)) < 2 ? 1 : 0
      const k = 1 + 0.03 * Math.sin(a * 9 + y * 0.2) + 0.022 * Math.sin(a * 23 + y * 0.5) + 0.014 * Math.sin(a * 47 - y * 0.3) + 0.01 * Math.sin(a * 91 + y * 1.1)
      rp.setXYZ(i, x * k, y + 0.6 * Math.sin(a * 13 + y) * steep, z * k) }
    rg.computeVertexNormals()
    { const nrm = rg.attributes.normal, col = new Float32Array(rp.count * 3); for (let i = 0; i < rp.count; i++) { const up = Math.max(0, nrm.getY(i)), n = 0.5 + 0.5 * Math.sin(rp.getX(i) * 0.7 + rp.getZ(i) * 0.4), v = 1 - up * 0.0; col.set([0.92 * v + up * 0.08 + n * 0.05, 0.86 * v + up * 0.02, 0.78 * v - up * 0.1], i * 3) } rg.setAttribute('color', new THREE.BufferAttribute(col, 3)) }
    const rockT = TX.rockTexture(aniso), rockM = new THREE.MeshStandardMaterial({ map: rockT, bumpMap: rockT, bumpScale: 2.6, vertexColors: true, roughness: 1, metalness: 0, side: THREE.DoubleSide, envMapIntensity: 0.25 })
    const wall = new THREE.Mesh(rg, rockM); wall.receiveShadow = true; S.add(wall)
    // 壁の上の外: 遠くの山
    

  }
  // 岩・タイヤの山・廃車の積み重ね（実物のモデルを読んだあとに置く）
  buildProps() {
    const S = this.scene
    let sd = 7; const rr = () => { sd = (sd * 16807) % 2147483647; return (sd - 1) / 2147483646 }
    let ri = 0
    for (const o of POLES) {
      if (o.kind === 'rock') {
        const A = assets.rocks[ri++ % assets.rocks.length], k = o.r * 2.05 / Math.max(A.size.x, A.size.z), hy = clampN(o.h * 1.05 / A.size.y, k * 0.8, k * 1.6)
        const m = new THREE.Mesh(A.geo, A.mat); m.scale.set(k, hy, k); m.position.set(o.x, o.base - 0.15, o.z); m.rotation.y = rr() * 6.28; m.castShadow = true; m.receiveShadow = true; S.add(m)
      } else if (o.kind === 'tires') {
        const t = new THREE.Mesh(assets.tyre.geo, assets.tyre.mat); t.scale.set(0.5 / assets.tyre.w, 1.5, 1.5)
        for (let i = 0; i < 4; i++) { const q = t.clone(); q.rotation.z = Math.PI / 2; q.rotation.y = rr() * 6; q.position.set(o.x + (i % 2) * 0.05, o.base + 0.25 + i * 0.5, o.z); q.castShadow = true; S.add(q) }
      }
    }
    // 積み上げた廃車
    const bJ = new Baker(), bG = new Baker(), cols = [0x6a4028, 0x4a5258, 0x5e3328, 0x586240, 0x7a6a34, 0x34445a], R = () => rr()
    const jm = new THREE.MeshStandardMaterial({ map: TX.grungeTexture(), vertexColors: true, color: 0x8a7a6c, roughness: 0.9, metalness: 0.25 })
    for (const o of BOXES) {
      const along = o.w > o.d, ang = along ? Math.PI / 2 : 0, ci = o.a * 2
      const lay = (y, c, dx, tl) => wreckInto(bJ, bG, o.x + (along ? 0 : dx), o.base + y, o.z + (along ? dx : 0), ang, c, R, tl)
      lay(0.05, cols[ci % 6], 0, 0); lay(1.25, cols[(ci + 1) % 6], 0.18, 0.05); if (o.h > 2.8) lay(2.45, cols[(ci + 2) % 6], -0.2, -0.06)
      const L = along ? o.w : o.d; void L
    }
    const jmesh = bJ.mesh(jm); if (jmesh) S.add(jmesh); const gmesh = bG.mesh(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.15, metalness: 0.7, envMapIntensity: 1.6 }), false); if (gmesh) S.add(gmesh)
  }
  // ---------------------------------------------------------------- 動くもの
  buildDynamic() {
    const S = this.scene, sc = (this.h || 800) * 0.5
    this.pDust = new Particles(S, this.low ? 700 : 1400, false, sc)
    this.pFire = new Particles(S, 500, true, sc)
    this.debris = new Debris(S); this.rings = new Rings(S)
    // タイヤのあと
    const tg = new THREE.PlaneGeometry(0.5, 1.1); tg.rotateX(-Math.PI / 2)
    const tmat = new THREE.MeshBasicMaterial({ alphaMap: TX.trackTexture(), color: 0x2b1e13, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3, opacity: 0.8 })
    tmat.alphaMap.rotation = 0
    this.trackN = 900; this.tracks = new THREE.InstancedMesh(tg, tmat, this.trackN); this.tracks.frustumCulled = false; this.tracks.count = 0; this.trackI = 0; this.tracks.renderOrder = 2; S.add(this.tracks)
    this.trackM = new THREE.Matrix4(); this.trackQ = new THREE.Quaternion(); this.trackE = new THREE.Euler()
    // 台座（準備画面の車）
    this.pad = new THREE.Mesh(new THREE.CylinderGeometry(8, 8.4, 0.3, 40), new THREE.MeshStandardMaterial({ color: 0x4a443b, roughness: 0.95 })); this.pad.position.set(PREVIEW_AT.x, H(PREVIEW_AT.x, PREVIEW_AT.z) + 0.1, PREVIEW_AT.z); this.pad.visible = false; this.pad.receiveShadow = true; S.add(this.pad)
  }
  clearDynamic() {
    for (const v of this.views.values()) { this.scene.remove(v.root) }
    this.views.clear(); this.pDust.clear(); this.pFire.clear(); this.tracks.count = 0; this.trackI = 0
    for (const d of this.debris.list) this.scene.remove(d.m); this.debris.list.length = 0
    this.shake = 0; this.hitStop = 0; this.lastTrack = {}
  }
  // 準備画面: 選んだ部品の車を台座にのせて見せる
  setPreview(lo, color) {
    if (this.preview) { this.scene.remove(this.preview.v.root); this.preview = null }
    if (!lo) { this.pad.visible = false; return }
    const fake = { id: 900, T: statsOf(lo), color, lo }
    const v = buildTruck(fake, 1); this.finishView(v, false)
    const y = H(PREVIEW_AT.x, PREVIEW_AT.z) + 0.25
    v.root.position.set(PREVIEW_AT.x, y, PREVIEW_AT.z); this.scene.add(v.root); this.pad.visible = true
    this.preview = { v, yaw: this.preview ? this.preview.yaw : 0.7 }
    for (const w of v.wheels) w.g.rotation.y = 0
  }
  finishView(v, mine) { v.root.traverse(o => { if (o.isMesh) { o.castShadow = o.castShadow !== false; o.frustumCulled = false } }); void mine }
  viewOf(c) {
    let v = this.views.get(c.id)
    if (!v) { v = buildTruck(c, c.idx + 1); this.finishView(v, c.human); v.bumpGone = false; v.smokeT = 0; v.fireT = 0; v.dustT = 0; v.spin = 0; v.trackD = 0; this.scene.add(v.root); this.views.set(c.id, v) }
    return v
  }
  // ---------------------------------------------------------------- 毎フレーム
  sync(S, alpha, dt, o = {}) {
    this.time += dt
    this.ringU.uT.value = this.time; this.ringU.uR.value = S.safeR; this.safeR = S.safeR
    const me = o.me
    for (const c of S.cars) {
      const v = this.viewOf(c), x = lerp(c.px, c.x, alpha), y = lerp(c.py, c.y, alpha), z = lerp(c.pz, c.z, alpha), yaw = lerpAng(c.pyaw, c.yaw, alpha)
      const pitch = lerp(c.ppitch, c.pitch, alpha), roll = lerp(c.proll, c.roll, alpha), tip = lerp(c.ptip, c.tip, alpha)
      v.root.position.set(x, y, z); v.root.rotation.y = yaw
      // 壊れた所で傾く: 前が壊れると鼻が沈み、片側が壊れるとその側が沈む
      const sagP = (1 - c.zone.f / 100) * 0.05 - (1 - c.zone.b / 100) * 0.035, sagR = ((1 - c.zone.l / 100) - (1 - c.zone.r / 100)) * 0.045
      // 曲がる時のふくらみ（外へ傾く）
      const lean = c.alive ? -c.yawRate * Math.min(1, Math.hypot(c.vx, c.vz) / 12) * 0.05 : 0
      const phi = -(roll + tip + sagR + lean)
      v.tilt.rotation.set(-(pitch + sagP), 0, phi, 'ZXY')
      // 傾いた側の車輪の接地点を軸に回る（ひっくり返る時は屋根が地面につく）
      const cx = -Math.sign(phi) * v.W / 2, cph = Math.cos(phi), sph = Math.sin(phi)
      v.tilt.position.set(cx * (1 - cph), -cx * sph + 3.4 * Math.max(0, -cph) * 0.98 + (c.lift || 0), 0)
      // 車輪: 転がり・ハンドル
      const sp = c.vx * Math.sin(c.yaw) + c.vz * Math.cos(c.yaw)
      v.spin += sp * dt
      for (const w of v.wheels) { w.mesh.rotation.x = v.spin / w.r; if (w.front) w.g.rotation.y = -c.steer * 0.42 }
      v.bodyMat.color.setScalar(0.62 + 0.38 * Math.max(0, c.hp) / 100)
      if (c.alive) { const spd = Math.hypot(c.vx, c.vz); if (c.mud > 0.25 && spd > 3) v.dirtU.value = Math.min(1, v.dirtU.value + dt * c.mud * spd * 0.0038); else if (spd > 4) v.dirtU.value = Math.min(1, v.dirtU.value + dt * spd * 0.00025) }
      { const fpv = c.human && o.mine !== false; if (v.parts.glass) v.parts.glass.visible = !fpv; if (v.parts.mirror) v.parts.mirror.visible = !fpv }
      if (!v.preview) this.effects(S, c, v, dt, x, y, z, yaw, sp)
    }
    this.ambT = (this.ambT || 0) - dt
    if (this.ambT <= 0 && o.focus) { this.ambT = this.low ? 0.5 : 0.28; const a = Math.random() * 6.283, d = 22 + Math.random() * 50; this.pDust.emit(o.focus.x + Math.sin(a) * d, 0.8 + Math.random() * 2.5, o.focus.z + Math.cos(a) * d, 3.4, 0.1, 1.3, 9, 7, 15, 0xc9b08a, 0xd8c09a, 0.11, 0, 0) }
    this.pDust.update(dt); this.pFire.update(dt); this.debris.update(dt); this.rings.update(dt)
    // 影を追う
    const fc = o.focus ? o.focus : { x: 0, z: 0 }
    this.sun.position.set(fc.x + this.sunOff.x, this.sunOff.y, fc.z + this.sunOff.z); this.sun.target.position.set(fc.x, 0, fc.z)
    void me
  }
  effects(S, c, v, dt, x, y, z, yaw, sp) {
    const T = c.T, sy = Math.sin(yaw), cy = Math.cos(yaw), rr = (a) => Math.random() * a
    const wp = (lx, ly, lz) => [x + cy * lx + sy * lz, y + ly, z - sy * lx + cy * lz]
    const mudk = c.mud, speed = Math.hypot(c.vx, c.vz)
    if (c.alive) {
      // 土ぼこり・泥はね: 速いほど、後ろの車輪から
      v.dustT -= dt
      if (!c.air && speed > 3 && v.dustT <= 0) {
        v.dustT = Math.max(0.025, 0.12 - speed * 0.004)
        for (const sx of [-1, 1]) {
          const [px, py, pz] = wp(sx * 1.3, 0.2, -2.2)
          if (mudk > 0.3) { for (let q = 0; q < 3; q++) this.pDust.emit(px, py, pz, -c.vx * 0.25 + (Math.random() - 0.5) * 4 + sx * (2 + rr(4)) * cy, 2.5 + rr(5), -c.vz * 0.25 + (Math.random() - 0.5) * 4 - sx * (2 + rr(4)) * sy, 0.9 + rr(0.7), 0.3 + rr(0.35), 0.5 + rr(0.4), MUDC, 0x2e2216, 0.95, 16, 0.05); this.pDust.emit(px, py + 0.4, pz, 0, 0.8, 0, 1.2, 1.2, 3.2, 0x5a4630, 0x6e5a40, 0.3, 0, 1.4) }
          else this.pDust.emit(px, py + 0.2, pz, -c.vx * 0.12 + (Math.random() - 0.5) * 1.4, 0.7 + rr(1.2), -c.vz * 0.12 + (Math.random() - 0.5) * 1.4, 1.4 + rr(0.9), 0.9 + speed * 0.04, 3.2 + speed * 0.12, DUST, 0xcab592, 0.34, 0, 1.4)
        }
        // タイヤのあと
        v.trackD += speed * dt
        if (v.trackD > 0.85 && speed > 3) { v.trackD = 0; for (const sx of [-1, 1]) this.addTrack(wp(sx * 1.3, 0, -2.2), yaw) }
      }
      if (c.boosting) { const [px, py, pz] = wp(1.3, 3.0, 0.9), [qx, qy, qz] = wp(-1.3, 3.0, 0.9); for (const [a, b, d] of [[px, py, pz], [qx, qy, qz]]) { this.pFire.emit(a, b, d, (Math.random() - 0.5) * 2, 2 + rr(2), (Math.random() - 0.5) * 2, 0.4 + rr(0.2), 0.4, 0.9, 0xffa040, 0xff3a10, 0.85, -2, 1.0); this.pDust.emit(a, b + 0.3, d, 0, 1.8, 0, 0.8, 0.5, 1.8, 0x2a2622, 0x4a4540, 0.4, -1.5, 1.2) } }
      // 壊れた所から煙・炎
      v.smokeT -= dt
      if (v.smokeT <= 0) {
        v.smokeT = 0.07
        for (const k of ['f', 'l', 'r', 'b']) {
          const zv = c.zone[k]; if (zv >= 70) continue
          const [px, py, pz] = wp(...v.smoke[k]), sev = 1 - zv / 70
          if (Math.random() < 0.35 + sev * 0.65) this.pDust.emit(px + (Math.random() - 0.5) * 0.8, py, pz + (Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 0.7, 2.1 + sev * 2.2, (Math.random() - 0.5) * 0.7, 1.5 + sev, 0.45, 1.9 + sev, 0x3a3835, 0x77736a, 0.4 + sev * 0.4, -0.3, 0.5)
          if (zv < 24 && Math.random() < 0.5) this.pFire.emit(px, py - 0.1, pz, (Math.random() - 0.5), 1.6 + rr(1.4), (Math.random() - 0.5), 0.5, 0.5, 0.15, 0xff9a30, 0xd02a08, 0.9, -1, 0.5)
        }
        if (c.hp < 40 && Math.random() < 0.5) { const [px, py, pz] = wp(...v.smoke.top); this.pDust.emit(px, py, pz, (Math.random() - 0.5) * 0.5, 3.4, (Math.random() - 0.5) * 0.5, 1.9, 0.5, 2.4, 0x141414, 0x4a4540, 0.65, -0.2, 0.4) }
      }
      if (c.zone.f <= 0 && !v.bumpGone) this.dropBump(c, v)
    } else {
      // 大破・転覆: くすぶり続ける
      v.smokeT -= dt
      if (v.smokeT <= 0) { v.smokeT = 0.09; const [px, py, pz] = wp(0, 2.2, 1.2); this.pDust.emit(px, py, pz, (Math.random() - 0.5) * 0.8, 3.4, (Math.random() - 0.5) * 0.8, 2.6, 0.7, 3.4, 0x111111, 0x5a554e, 0.7, -0.3, 0.4); if (c.outHow === 'wreck' && c.wreckT < 12 && Math.random() < 0.6) this.pFire.emit(px, py - 0.5, pz, (Math.random() - 0.5), 1.8 + rr(1.4), (Math.random() - 0.5), 0.55, 0.7, 0.15, 0xff9a30, 0xd02a08, 0.9, -1.5, 0.5) }
    }
  }
  addTrack([x, y, z], yaw) {
    const i = this.trackI++ % this.trackN; this.tracks.count = Math.min(this.tracks.count + (this.tracks.count < this.trackN ? 1 : 0), this.trackN)
    const m = this.trackM.compose(new THREE.Vector3(x, H(x, z) + 0.05, z), this.trackQ.setFromEuler(this.trackE.set(0, yaw, 0)), new THREE.Vector3(1, 1, 1))
    this.tracks.setMatrixAt(i, m); this.tracks.instanceMatrix.needsUpdate = true
  }
  dropBump(c, v) {
    v.bumpGone = true
    const b = v.bump; if (!b.parent) return
    const dir = new THREE.Vector3(Math.sin(c.yaw), 0, Math.cos(c.yaw))
    this.debris.fling(b, dir.multiplyScalar(5 + Math.random() * 4).setY(8 + Math.random() * 3), 7)
    this.snd('debris', { vol: 0.8 }); this.snd('clink', { vol: 0.6 })
  }
  // ---------------------------------------------------------------- 出来事から演出
  onEvent(e, S, focusCar) {
    const near = focusCar ? Math.hypot(e.x - focusCar.x, e.z - focusCar.z) : 99
    const att = 1 / (1 + (near / 38) ** 2)
    switch (e.k) {
      case 'ram': {
        const p = e.power
        this.shake = Math.max(this.shake, Math.min(1, p / 18) * att)
        for (let i = 0; i < 6 + p * 0.8; i++) { const a = Math.random() * 6.28, s = 4 + Math.random() * 9; this.pFire.emit(e.x, e.y - 0.6, e.z, Math.cos(a) * s, 2 + Math.random() * 6, Math.sin(a) * s, 0.28 + Math.random() * 0.3, 0.2, 0.05, 0xffd890, 0xff6a20, 0.95, 18, 0.6) }
        for (let i = 0; i < 4 + p * 0.5; i++) { const a = Math.random() * 6.28, s = 1 + Math.random() * 3; this.pDust.emit(e.x, e.y - 1, e.z, Math.cos(a) * s, 0.6 + Math.random() * 1.8, Math.sin(a) * s, 1.1 + Math.random() * 0.8, 1.2, 4.2, DUST, 0xcab592, 0.5, 0, 1.8) }
        if (p > 7) this.rings.ring(e.x, e.y - 1.1, e.z, 3 + p * 0.25, 0xffe0b0, 0.4, 0.6)
        break
      }
      case 'wall': { for (let i = 0; i < 5; i++) this.pDust.emit(e.x, e.y - 0.5, e.z, (Math.random() - 0.5) * 4, 1 + Math.random() * 2, (Math.random() - 0.5) * 4, 1.2, 1, 4, DUST, 0xcab592, 0.55, 0, 1.6); this.shake = Math.max(this.shake, Math.min(0.5, e.power / 30) * att); break }
      case 'takeoff': break
      case 'land': { for (let i = 0; i < 10; i++) { const a = Math.random() * 6.28, s = 3 + Math.random() * 4; this.pDust.emit(e.x, e.y + 0.2, e.z, Math.cos(a) * s, 0.5 + Math.random(), Math.sin(a) * s, 1.3, 1.2, 4.5, DUST, 0xcab592, 0.55, 0, 1.6) } this.shake = Math.max(this.shake, Math.min(0.6, e.power / 14) * att); break }
      case 'wreck': {
        for (let i = 0; i < 24; i++) { const a = Math.random() * 6.28, s = 2 + Math.random() * 8; this.pFire.emit(e.x, e.y + 1.5, e.z, Math.cos(a) * s, 3 + Math.random() * 8, Math.sin(a) * s, 0.5 + Math.random() * 0.5, 1.2, 0.2, 0xffc060, 0xc02a08, 0.95, 12, 0.8) }
        for (let i = 0; i < 14; i++) this.pDust.emit(e.x + (Math.random() - 0.5) * 3, e.y + 1.5, e.z + (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3, 3 + Math.random() * 3, (Math.random() - 0.5) * 3, 2.6, 1.4, 5, 0x1a1816, 0x6a6560, 0.8, -0.3, 0.8)
        this.rings.flash(e.x, e.y + 1.8, e.z, 7, 0xffd9a0, 0.35); this.rings.ring(e.x, e.y, e.z, 14, 0xffc890, 0.6, 0.7); this.shake = Math.max(this.shake, 0.8 * att); break
      }
      case 'flip': {
        for (let i = 0; i < 26; i++) { const a = Math.random() * 6.28, s = 3 + Math.random() * 7; this.pDust.emit(e.x + Math.cos(a) * 2, e.y + 0.3, e.z + Math.sin(a) * 2, Math.cos(a) * s, 1 + Math.random() * 3.4, Math.sin(a) * s, 1.8, 1.4, 5.5, DUST, 0xcab592, 0.7, 0, 1.4) }
        this.rings.ring(e.x, e.y, e.z, 12, 0xe8d4b0, 0.7, 0.5); this.shake = Math.max(this.shake, 0.85 * att); break
      }
      case 'zoneBreak': if (e.zone === 'f') { const c = S.cars.find(q => q.id === e.id); const v = c && this.views.get(c.id); if (v && !v.bumpGone) this.dropBump(c, v) } break
    }
  }
  // ---------------------------------------------------------------- カメラ
  // cv: { mode: 'orbit' | 'prep' | 'drive' | 'spec', car, look, snap, roll }
  updateCamera(S, cv, dt, alpha) {
    const cam = this.cam, t = this.time
    if (cv.mode === 'prep' && this.preview) {
      const a = t * 0.35 + 0.7, d = cv.dist || 12.5
      this.preview.v.root.rotation.y = a * 0.0 + 0.6
      cam.position.set(PREVIEW_AT.x + Math.sin(a) * d, H(PREVIEW_AT.x, PREVIEW_AT.z) + 3.9, PREVIEW_AT.z + Math.cos(a) * d); cam.lookAt(PREVIEW_AT.x, H(PREVIEW_AT.x, PREVIEW_AT.z) + 1.9, PREVIEW_AT.z)
      this.camYaw = a + Math.PI; cam.rotation.z += 0; return
    }
    if (cv.mode === 'orbit') {
      const a = t * 0.08, r = 70
      cam.position.set(Math.sin(a) * r, 22, Math.cos(a) * r); cam.lookAt(0, 3, 0); this.camYaw = a + Math.PI; return
    }
    const c = cv.car, v = this.views.get(c.id)
    if (!v) return
    const x = lerp(c.px, c.x, alpha), z = lerp(c.pz, c.z, alpha), yaw = lerpAng(c.pyaw, c.yaw, alpha)
    if (cv.mode === 'drive') {
      // 運転席: 目の高さに置く。車の傾き・ひっくり返りの回転をそのまま写す（傾きの半分）
      v.root.updateMatrixWorld(true)
      const eyeW = v.tilt.localToWorld(new THREE.Vector3(0, v.eye.y, v.eye.z))
      const look = cv.look || 0
      const yawC = this.camYaw = cv.snap ? yaw : lerpAng(this.camYaw, yaw, 1 - Math.exp(-dt * 9))
      const yawF = yawC + look + Math.PI
      cam.position.copy(eyeW)
      const pitchC = lerp(c.ppitch, c.pitch, alpha)
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.07 - pitchC * 0.5, yawF, 0, 'YXZ'))
      const phi = -(lerp(c.proll, c.roll, alpha) * 0.4 + lerp(c.ptip, c.tip, alpha))
      this.camRoll = c.alive ? lerp(this.camRoll, phi, 1 - Math.exp(-dt * 10)) : phi
      q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), this.camRoll))
      // 振り向いた時だけ、見回している向きに合わせて少し位置をずらさない（運転席に座ったまま）
      cam.quaternion.copy(q)
    } else {
      // 観戦: 車の後ろの上から
      const yawC = this.camYaw = cv.snap ? yaw + Math.PI * 0 : lerpAng(this.camYaw, yaw, 1 - Math.exp(-dt * 3))
      const d = 15, y = lerp(c.py, c.y, alpha)
      cam.position.set(x - Math.sin(yawC) * d, y + 8.5, z - Math.cos(yawC) * d); cam.lookAt(x, y + 2, z)
      this.camRoll = 0
    }
    if (this.shake > 0.003) { const k = this.shake * this.shake * 0.5 * (cv.mode === 'drive' ? 1 : 0.6); cam.position.x += (Math.random() - 0.5) * k; cam.position.y += (Math.random() - 0.5) * k; cam.position.z += (Math.random() - 0.5) * k; cam.rotateZ((Math.random() - 0.5) * k * 0.05); this.shake *= Math.exp(-dt * 6) }
  }
  render() { this.renderer.render(this.scene, this.cam) }
  // 画面座標に変えた位置（札やレーダーに使う）
  project(x, y, z, out) { out.set(x, y, z).project(this.cam); return out }
}
