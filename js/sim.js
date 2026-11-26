// 試合の中身（状態と進め方）。THREE にも DOM にも依存しない。入力は 車ごとに { throttle, steer, nitro }。
// オンラインにする時は、この step(S, inputs, dt) をそのままサーバーで回して、events と状態を配るだけでよい。
import { H, WORLD, SAFE0, SAFE_MIN, NCAR, SPAWNS, pushOutCircle, clamp, mudAt } from './arena.js?v=1'

export const DT = 1 / 60
export const G = 24
export const GO_COUNT = 3
export const GRACE = 40          // 縮み始めるまで（秒）
export const SHRINK = 150        // 縮みきるまで（秒）
export const TMAX = 230          // これを過ぎたら時間切れ（残った車は体力で順位）

// ---- 部品。名前は画面に出す短い言葉。stat は札のゲージ（1〜5）
export const BODIES = [
  { id: 'dump', name: 'ダンプ', note: '重くて硬い。曲がりにくい', mass: 2.5, maxF: 15.5, acc: 5.2, dur: 1.5, steer: 0.82, yawTau: 0.22, wb: 3.3, r: 1.5, off: 1.7, stab: 1.4, stat: [1, 5, 5] },
  { id: 'trash', name: 'ゴミ収集車', note: 'どれも平均点。尻が重い', mass: 1.9, maxF: 17.5, acc: 6.2, dur: 1.2, steer: 0.9, yawTau: 0.18, wb: 3.1, r: 1.45, off: 1.5, stab: 1.1, stat: [3, 3, 3] },
  { id: 'bus', name: '改造バス', note: '速くて軽い。横から当たられると転ぶ', mass: 1.45, maxF: 20.5, acc: 7.6, dur: 1.0, steer: 0.98, yawTau: 0.14, wb: 3.7, r: 1.4, off: 2.4, stab: 1.0, stat: [5, 2, 1] },
]
export const BUMPERS = [
  { id: 'plow', name: '押す', note: '鉄板の排土板。押し勝つ', push: 1.22, dealK: 1.0, takeK: 0.82, e: 0.42, flipK: 1.35, stat: [3, 5, 2] },
  { id: 'spike', name: '刺さる', note: '槍の列。深く食い込む', push: 1.0, dealK: 1.45, takeK: 1.0, e: 0.15, flipK: 0.9, stat: [5, 2, 1] },
  { id: 'spring', name: '弾く', note: 'タイヤの束。大きく跳ね返す', push: 0.95, dealK: 0.78, takeK: 0.78, e: 0.98, flipK: 0.8, stat: [2, 3, 5] },
]
export const TIRES = [
  { id: 'mud', name: '泥に強い', note: '泥でもよく進む', mudGrip: 0.85, mudSpeed: 0.93, spd: 0.97, acc: 0.97, stat: [2, 5] },
  { id: 'std', name: 'ふつう', note: '土の上なら不満なし', mudGrip: 0.6, mudSpeed: 0.78, spd: 1.0, acc: 1.0, stat: [3, 3] },
  { id: 'speed', name: '速い', note: '泥に入ると捕まる', mudGrip: 0.42, mudSpeed: 0.62, spd: 1.1, acc: 1.1, stat: [5, 1] },
]
export const ENGINES = [
  { id: 'tank', name: '大容量', note: 'ニトロが長く続く', tank: 1.6, charge: 0.8, stat: [5, 2] },
  { id: 'bal', name: 'ふつう', note: 'どちらも平均', tank: 1.0, charge: 1.0, stat: [3, 3] },
  { id: 'quick', name: '急速', note: 'ニトロがすぐ溜まる', tank: 0.7, charge: 1.8, stat: [2, 5] },
]
export const PARTS = { body: BODIES, bumper: BUMPERS, tire: TIRES, engine: ENGINES }
export const CAR_COLORS = [0xa6551f, 0x5d6b73, 0x8c2f27, 0x6f7a3a, 0xb99a32, 0x4a5b7a]
export const CPU_NAMES = ['ごりら組', 'タイヤ兄弟', 'ネジ屋', 'ボルト工業', 'ドンドコ組', 'かみなり屋', 'さび丸', 'ぶんぶん号']
const ZONES = ['f', 'l', 'r', 'b']

function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 } }
export const randLoadout = rng => ({ body: (rng() * 3) | 0, bumper: (rng() * 3) | 0, tire: (rng() * 3) | 0, engine: (rng() * 3) | 0 })
export function statsOf(lo) {
  const b = BODIES[lo.body], u = BUMPERS[lo.bumper], t = TIRES[lo.tire], e = ENGINES[lo.engine]
  return { ...b, bump: u, tireT: t, eng: e, maxF: b.maxF * t.spd, acc: b.acc * t.acc, grip: 9.0 }
}
const fwd = c => [Math.sin(c.yaw), Math.cos(c.yaw)]
export const rightOf = c => [-Math.cos(c.yaw), Math.sin(c.yaw)]
export function circles(c) { const s = Math.sin(c.yaw), co = Math.cos(c.yaw), o = c.T.off; return [[c.x + s * o, c.z + co * o], [c.x - s * o, c.z - co * o]] }
export const carR = c => c.T.r

let UID = 1
function newCar(S, i, lo, human, name) {
  const sp = SPAWNS[i % SPAWNS.length], T = statsOf(lo)
  const c = {
    id: UID++, idx: i, human, name, color: CAR_COLORS[i % CAR_COLORS.length], lo, T, x: sp.x, z: sp.z, y: H(sp.x, sp.z), yaw: sp.yaw, vx: 0, vz: 0, vy: 0, steer: 0, pitch: 0, roll: 0, tip: 0, tipV: 0, air: false, lift: 0,
    hp: 100, zone: { f: 100, l: 100, r: 100, b: 100 }, alive: true, out: false, outT: 0, outHow: '', outBy: -1, place: 0, nitro: 0.4, boosting: false, nitroLock: false, thr: 0, brk: 0, yawRate: 0, slip: 0, ax: 0,
    flips: 0, kos: 0, lastHit: null, invT: 0, dmgFlash: 0, speedKmh: 0, mud: 0, wob: 0, inp: null, ringT: 0, hitT: 0, wreckT: 0,
  }
  c.px = c.x; c.py = c.y; c.pz = c.z; c.pyaw = c.yaw; c.ppitch = 0; c.proll = 0; c.ptip = 0
  S.cars.push(c); return c
}
export function createState(seed = 1, opts = {}) {
  UID = 1
  const S = {
    seed, rng: mulberry(seed), t: 0, tMatch: 0, T: opts.matchSec || TMAX, phase: opts.noCountdown ? 'play' : 'ready', go: opts.noCountdown ? 0 : GO_COUNT, lastGo: 0, over: false, overT: 0, winner: -1, ranking: [],
    cars: [], events: [], outCount: 0, noEnd: !!opts.noEnd, safeR: SAFE0, human: -1,
  }
  const n = opts.n || NCAR
  for (let i = 0; i < n; i++) {
    const isMe = i === 0 && !!opts.player
    const lo = isMe ? opts.player : randLoadout(S.rng)
    const c = newCar(S, i, lo, isMe, isMe ? (opts.name || 'あなた') : (opts.names ? opts.names[i - 1] : CPU_NAMES[i % CPU_NAMES.length]))
    c.invT = 0.5
    if (isMe) S.human = c.id
  }
  return S
}
export const carById = (S, id) => S.cars.find(c => c.id === id)
export const ev = (S, o) => S.events.push(o)
export const aliveCars = S => S.cars.filter(c => c.alive)
export function safeRadius(S) { return S.tMatch < GRACE ? SAFE0 : Math.max(SAFE_MIN, SAFE0 - (SAFE0 - SAFE_MIN) * (S.tMatch - GRACE) / SHRINK) }

// ---------------------------------------------------------------- 1 ステップ
export function step(S, inputs, dt = DT) {
  S.t += dt
  for (const c of S.cars) { c.px = c.x; c.py = c.y; c.pz = c.z; c.pyaw = c.yaw; c.ppitch = c.pitch; c.proll = c.roll; c.ptip = c.tip }
  if (S.phase === 'ready') {
    S.go -= dt
    if (S.go > 0) { const n = Math.ceil(S.go); if (n !== S.lastGo) { S.lastGo = n; ev(S, { k: 'go321', n }) } }
    else { S.phase = 'play'; S.go = 0; ev(S, { k: 'go' }) }
  }
  const live = S.phase === 'play' && !S.over
  if (live) S.tMatch += dt
  S.safeR = safeRadius(S)
  for (const c of S.cars) updateCar(S, c, inputs[c.id] || null, dt, live)
  collideCars(S, dt)
  if (live) {
    for (const c of S.cars) {
      if (!c.alive) continue
      // 縮んだ輪の外は崩れる地面: 体力がどんどん減る
      const r = Math.hypot(c.x, c.z)
      if (r > S.safeR) { c.ringT += dt; hurt(S, c, (2.5 + (r - S.safeR) * 0.18) * dt, null, c.x, c.z, 'ring', null) } else c.ringT = Math.max(0, c.ringT - dt * 2)
      if (c.hp <= 0) wreck(S, c, 'wreck')
      else if (Math.abs(c.tip) > 0.95) wreck(S, c, 'flip')
    }
    const alive = S.cars.filter(c => c.alive)
    if (!S.noEnd && (alive.length <= 1 || S.tMatch >= S.T)) { if (!S.endAt) S.endAt = S.t + (alive.length <= 1 ? 2.2 : 0.3) }
    if (S.endAt && S.t >= S.endAt) finish(S)
  }
  if (S.over) S.overT += dt
  return S
}
function wreck(S, c, how) {
  if (!c.alive) return
  c.alive = false; c.out = true; c.outT = S.tMatch; c.outHow = how; c.outOrder = ++S.outCount; c.hp = Math.max(0, c.hp)
  if (how === 'flip') { c.flipDir = c.tip >= 0 ? 1 : -1; c.flipT = 0 }
  const by = c.lastHit && S.t - c.lastHit.t < 6 ? S.cars.find(q => q.id === c.lastHit.by) : null
  if (by) { c.outBy = by.id; by.kos++; if (how === 'flip') by.flips++ }
  ev(S, { k: how, id: c.id, by: by ? by.id : -1, x: c.x, y: c.y, z: c.z })
  ev(S, { k: 'out', id: c.id, left: S.cars.filter(q => q.alive).length })
}
function finish(S) {
  S.over = true; S.phase = 'over'
  const left = S.cars.filter(c => c.alive).sort((a, b) => b.hp - a.hp)
  const gone = S.cars.filter(c => !c.alive).sort((a, b) => b.outT - a.outT || b.outOrder - a.outOrder)
  S.ranking = [...left, ...gone].map(c => c.id)
  S.ranking.forEach((id, i) => { carById(S, id).place = i + 1 })
  S.winner = S.ranking[0]
  ev(S, { k: 'over', winner: S.winner })
}

// ---------------------------------------------------------------- 車の動き
function updateCar(S, c, inp, dt, live) {
  c.dmgFlash = Math.max(0, c.dmgFlash - dt); c.invT -= dt; c.hitT = Math.max(0, c.hitT - dt)
  if (!c.alive) { c.wreckT += dt; if (c.outHow === 'flip') { c.flipT += dt; c.tip += (c.flipDir * Math.PI - c.tip) * Math.min(1, 5 * dt) } stepBody(S, c, dt, null, false); return }
  if (!live) inp = null
  const T = c.T
  const nitroIn = !!(inp && inp.nitro)
  const boosting = nitroIn && (c.nitro > 0 && !c.nitroLock) && !c.air
  if (boosting) { c.nitro -= dt / (2.6 * T.eng.tank); if (c.nitro <= 0) { c.nitro = 0; c.nitroLock = true } }
  else { if (c.nitroLock && c.nitro > 0.12) c.nitroLock = false }
  c.boosting = boosting
  c.inp = inp
  // ねじれ（横の壊れ）でハンドルがぶれる
  c.wob = (1 - (c.zone.l + c.zone.r) / 200)
  stepBody(S, c, dt, inp, boosting)
  // 傾きで転ぶ: 横から強く当てられると片側が持ち上がる。重い車・低い車は戻りが強い
  const k = 20 * T.stab
  c.tipV += (-k * c.tip - 2.8 * c.tipV) * dt; c.tip += c.tipV * dt
  if (Math.abs(c.tip) < 0.002 && Math.abs(c.tipV) < 0.01) { c.tip = 0; c.tipV = 0 }
}
function stepBody(S, c, dt, inp, boosting) {
  const T = c.T, hulk = !c.alive
  const mud = hulk ? 0 : mudAt(c.x, c.z); c.mud = mud
  if (!c.air) {
    let [fx, fz] = fwd(c)
    let sp = c.vx * fx + c.vz * fz
    const zf = 0.5 + 0.5 * c.zone.f / 100
    const mudSpd = 1 + (T.tireT.mudSpeed - 1) * mud
    const vmax = T.maxF * zf * mudSpd * (boosting ? 1.4 : 1)
    const thrIn = inp ? clamp(inp.throttle || 0, -1, 1) : 0
    const thrEff = boosting ? 1 : thrIn
    // ハンドル: ゆっくり切れて、ゆっくり戻る。重い車ほど鈍い
    let want = inp ? clamp(inp.steer || 0, -1, 1) : 0
    if (inp && c.wob > 0.02) want = clamp(want + c.wob * 0.55 * Math.sin(S.t * 3.1 + c.id) * Math.sin(S.t * 1.3 + c.id * 2), -1, 1)
    const rate = (Math.abs(want) > Math.abs(c.steer) || Math.sign(want) !== Math.sign(c.steer) && want !== 0 ? 2.0 : 1.6) * (1.15 - 0.2 * T.mass * 0.6)
    const d = want - c.steer
    c.steer += Math.sign(d) * Math.min(Math.abs(d), rate * dt)
    const spN = clamp(Math.abs(sp) / Math.max(10, vmax), 0, 1.3)
    const maxSteer = (0.3 - 0.17 * clamp(Math.abs(sp) / 26, 0, 1)) * T.steer
    const under = 1 - 0.24 * clamp(spN * spN * Math.abs(c.steer) * 1.4, 0, 1)
    const yawT = sp * Math.tan(c.steer * maxSteer) / T.wb * under
    c.yawRate += (yawT - c.yawRate) * (1 - Math.exp(-dt / T.yawTau))
    c.yaw -= c.yawRate * dt
    ;[fx, fz] = fwd(c)
    const rx = -Math.cos(c.yaw), rz = Math.sin(c.yaw)
    sp = c.vx * fx + c.vz * fz
    let lat = c.vx * rx + c.vz * rz
    // 踏み込みと離しにも慣性（重い車ほどゆっくり）
    const kth = thrEff > c.thr ? 2.2 / T.mass ** 0.5 : 5.0
    c.thr += clamp(thrEff - c.thr, -kth * dt, kth * dt)
    const backOk = c.zone.b > 18
    const brkIn = thrEff < -0.02 ? 1 : 0
    c.brk += clamp(brkIn - c.brk, -8 * dt, 6 * dt)
    let ax = 0
    if (!hulk) {
      if (c.thr > 0.02 && thrEff > -0.02) {
        if (sp < -0.5) ax = 24
        else ax = T.acc * zf * c.thr * (1 - Math.pow(Math.max(0, sp) / vmax, 3.2) * 0.92) * (1 + (T.tireT.mudSpeed - 1) * mud * 0.8) + (boosting ? 11 : 0)
      } else if (c.brk > 0.05) {
        if (sp > 0.6) ax = -11 * c.brk
        else ax = backOk ? -8 * c.brk * (sp > -7 * c.zone.b / 100 - 1.5 ? 1 : 0) : -sp * 6
      } else {
        const drag = (inp ? 3.4 : 6) + 0.006 * sp * sp + 2.5 * mud
        ax = -Math.sign(sp) * Math.min(Math.abs(sp) / Math.max(dt, 1e-3), drag)
      }
      if (sp > vmax && ax < -5) ax = -5
      sp = Math.min(sp + ax * dt, Math.max(sp, vmax))
    } else sp -= Math.sign(sp) * Math.min(Math.abs(sp), 14 * dt)
    c.ax = ax
    // 横の滑り。泥ではグリップが落ちる
    let grip = T.grip * (1 + (T.tireT.mudGrip - 1) * mud)
    grip *= (1 - 0.14 * clamp(Math.abs(c.steer) * Math.abs(sp) / 22, 0, 1))
    { const lat0 = lat; lat *= Math.exp(-grip * dt); if (sp > 2) sp = Math.min(sp + (Math.abs(lat0) - Math.abs(lat)) * 0.5, Math.max(sp, vmax)) }
    c.slip = Math.abs(lat)
    c.vx = fx * sp + rx * lat; c.vz = fz * sp + rz * lat
    // 坂道の重さ
    const e = 0.5, gx = (H(c.x + e, c.z) - H(c.x - e, c.z)) / (2 * e), gz = (H(c.x, c.z + e) - H(c.x, c.z - e)) / (2 * e)
    c.vx -= 8 * gx * dt; c.vz -= 8 * gz * dt
  } else {
    c.yaw -= (inp ? (inp.steer || 0) : 0) * 0.35 * dt
    c.vx *= 1 - 0.05 * dt; c.vz *= 1 - 0.05 * dt
  }
  // 移動（急な崖は壁）
  let nx = c.x + c.vx * dt, nz = c.z + c.vz * dt
  const hh = 0.55
  if (H(nx, nz) - c.y > hh) { nx = c.x; nz = c.z; c.vx *= -0.2; c.vz *= -0.2 }
  c.x = nx; c.z = nz
  // 外の岩壁
  const lim = WORLD - 3
  let hit = 0
  { const rr = Math.hypot(c.x, c.z); if (rr > lim) { const ux = c.x / rr, uz = c.z / rr; c.x = ux * lim; c.z = uz * lim; const vn = c.vx * ux + c.vz * uz; if (vn > 0) { hit = vn; c.vx -= 1.6 * vn * ux; c.vz -= 1.6 * vn * uz } } }
  if (hit > 4) { if (c.alive) hurt(S, c, Math.max(0, hit - 5) * 0.8, null, c.x, c.z, 'wall', 'f'); ev(S, { k: 'wall', x: c.x, y: c.y + 1, z: c.z, power: hit, id: c.id }) }
  // 上下
  const nh = H(c.x, c.z)
  if (!c.air) {
    const vyT = (nh - c.y) / dt
    if (vyT < c.vy - G * dt - 1.2 && Math.hypot(c.vx, c.vz) > 4) { c.air = true; c.vy = Math.max(c.vy, -2); c.vy -= G * dt; c.y += c.vy * dt; c.airT = 0; ev(S, { k: 'takeoff', x: c.x, y: c.y, z: c.z, id: c.id }) }
    else { c.vy = clamp(vyT, -40, 14); c.y = nh }
  } else {
    c.airT = (c.airT || 0) + dt
    c.vy -= G * dt; c.y += c.vy * dt
    if (c.y <= nh) {
      const imp = -c.vy
      c.y = nh; c.air = false; c.vy = 0
      if (imp > 4) { ev(S, { k: 'land', x: c.x, y: c.y, z: c.z, power: imp, id: c.id }); if (c.alive && imp > 9) c.tipV += (S.rng() - 0.5) * imp * 0.06 / c.T.stab }
    }
  }
  // 傾き（見た目）
  const [fx, fz] = fwd(c), rx = -fz, rz = fx
  if (!c.air) {
    const hf = H(c.x + fx * 2, c.z + fz * 2), hb = H(c.x - fx * 2, c.z - fz * 2), hr = H(c.x + rx * 1.2, c.z + rz * 1.2), hl = H(c.x - rx * 1.2, c.z - rz * 1.2)
    const tp = Math.atan2(hf - hb, 4), tr = Math.atan2(hr - hl, 2.4)
    const k = Math.min(1, 12 * dt); c.pitch += (clamp(tp, -0.5, 0.5) - c.pitch) * k; c.roll += (clamp(tr, -0.4, 0.4) - c.roll) * k
  } else {
    const sp = c.vx * fx + c.vz * fz
    const tp = Math.atan2(c.vy, Math.max(4, Math.abs(sp))), k = Math.min(1, 3 * dt)
    c.pitch += (clamp(tp, -0.5, 0.5) - c.pitch) * k; c.roll += (0 - c.roll) * k
  }
  // 障害物の押し出し（円2つ）
  const cs = circles(c), out = []
  for (const [cx, cz] of cs) {
    out.length = 0
    if (!pushOutCircle(cx, c.y, cz, carR(c), 2.6, out)) continue
    let best = out[0]; for (const o of out) if (o[2] > best[2]) best = o
    for (const o of out) { c.x += o[0] * o[2] * 0.9; c.z += o[1] * o[2] * 0.9 }
    const vn = c.vx * best[0] + c.vz * best[1]
    if (vn < 0) {
      const soft = best[3] && best[3].kind === 'tires'
      c.vx -= (soft ? 1.7 : 1.35) * vn * best[0]; c.vz -= (soft ? 1.7 : 1.35) * vn * best[1]; c.yawRate += (S.rng() - 0.5) * Math.min(1.4, -vn * 0.06)
      if (-vn > 3.5) {
        if (c.alive && !soft) hurt(S, c, Math.max(0, -vn - 5) * 0.9, null, cx, cz, 'obst', zoneOfDir(c, -best[0], -best[1]))
        ev(S, { k: 'wall', x: cx, y: c.y + 1, z: cz, power: -vn, id: c.id, soft })
      }
    }
  }
  c.speedKmh = Math.hypot(c.vx, c.vz) * 3.6
}
// 向き（car→相手）がどの部位に当たるか
function zoneOfDir(c, dx, dz) {
  const [fx, fz] = fwd(c), [rx, rz] = rightOf(c), l = Math.hypot(dx, dz) || 1
  const f = (dx * fx + dz * fz) / l, s = (dx * rx + dz * rz) / l
  return f > 0.6 ? 'f' : f < -0.6 ? 'b' : s > 0 ? 'r' : 'l'
}
// ダメージ。by は相手の車の id（null なら自爆・地形）。体力は全体、部位は性能が落ちる分
export function hurt(S, c, dmg, by, x, z, how, zone) {
  if (!c.alive || dmg <= 0 || c.invT > 0 || S.phase !== 'play' || S.over) return 0
  c.hp -= dmg; c.dmgFlash = 0.25
  if (zone) {
    const was = c.zone[zone]; c.zone[zone] = Math.max(0, was - dmg * 1.7)
    if (was > 0 && c.zone[zone] <= 0) ev(S, { k: 'zoneBreak', id: c.id, zone, x: c.x, y: c.y, z: c.z })
  }
  if (by != null && by !== c.id) c.lastHit = { by, t: S.t }
  return dmg
}

// ---------------------------------------------------------------- 車どうし
function collideCars(S, dt) {
  const cs = S.cars
  for (let i = 0; i < cs.length; i++) {
    const A = cs[i]
    for (let j = i + 1; j < cs.length; j++) {
      const B = cs[j]
      if (!A.alive && !B.alive) continue
      if (Math.abs(A.x - B.x) > 7.5 || Math.abs(A.z - B.z) > 7.5) continue
      if (Math.abs(A.y - B.y) > 1.8) continue
      const ca = circles(A), cb = circles(B)
      let pen = 0, nx = 0, nz = 0, ax = 0, az = 0
      for (const [px, pz] of ca) for (const [qx, qz] of cb) {
        const dx = px - qx, dz = pz - qz, d = Math.hypot(dx, dz), p = carR(A) + carR(B) - d
        if (p > pen && d > 1e-4) { pen = p; nx = dx / d; nz = dz / d; ax = (px + qx) / 2; az = (pz + qz) / 2 }
      }
      if (pen <= 0) continue
      const [afx, afz] = fwd(A), [bfx, bfz] = fwd(B), [arx, arz] = rightOf(A), [brx, brz] = rightOf(B)
      const fa = -nx * afx + -nz * afz, fb = nx * bfx + nz * bfz          // 自分の前が相手に向いている度合い
      const sa = -nx * arx + -nz * arz, sb = nx * brx + nz * brz
      const frontA = fa > 0.55, frontB = fb > 0.55
      const sideA = Math.abs(fa) < 0.6, sideB = Math.abs(fb) < 0.6
      const under = c => 1 + 0.3 * (1 - clamp(c.hp, 0, 100) / 100)           // 体力が少ないほど押す力が少し上がる
      const mA = A.T.mass * (frontA ? A.T.bump.push : 1) * under(A) * (A.boosting ? 1.25 : 1)
      const mB = B.T.mass * (frontB ? B.T.bump.push : 1) * under(B) * (B.boosting ? 1.25 : 1)
      const iA = A.alive ? 1 / mA : 0, iB = B.alive ? 1 / mB : 0, sum = iA + iB
      A.x += nx * pen * iA / sum; A.z += nz * pen * iA / sum; B.x -= nx * pen * iB / sum; B.z -= nz * pen * iB / sum
      const vn = (A.vx - B.vx) * nx + (A.vz - B.vz) * nz
      if (vn >= 0) continue
      const closing = -vn
      const eA = frontA ? A.T.bump.e : 0.5, eB = frontB ? B.T.bump.e : 0.5
      let e = (eA + eB) / 2
      if ((sideA && B.alive) || (sideB && A.alive)) e += 0.22            // 横から当てると大きく弾ける
      e = clamp(e, 0.1, 1.15)
      const jn = -(1 + e) * vn / sum
      A.vx += nx * jn * iA; A.vz += nz * jn * iA; B.vx -= nx * jn * iB; B.vz -= nz * jn * iB
      // ぶつかり方でひねる
      const twA = (-nx) * (-afz) + (-nz) * afx, twB = nx * (-bfz) + nz * bfx
      if (A.alive) A.yaw -= clamp(twA * closing * 0.01 / A.T.mass, -0.3, 0.3)
      if (B.alive) B.yaw -= clamp(twB * closing * 0.01 / B.T.mass, -0.3, 0.3)
      if (closing < 3 || S.phase !== 'play') continue
      // 横から当てられた時に傾く（強いと転ぶ）
      const tipK = 0.26
      if (A.alive) A.tipV += -(jn * iA * (nx * arx + nz * arz)) * tipK / A.T.stab * (frontB ? B.T.bump.flipK : 1) * (B.boosting ? 1.2 : 1)
      if (B.alive) B.tipV += -(-jn * iB * (nx * brx + nz * brz)) * tipK / B.T.stab * (frontA ? A.T.bump.flipK : 1) * (A.boosting ? 1.2 : 1)
      const dmgTo = (X, Y, fx_, fy_, front) => {   // Y が X にぶつかった時の X のダメージ
        if (!X.alive) return 0
        const dealY = (fy_ > 0.55 ? Y.T.bump.dealK : 0.6) * (Y.boosting ? 1.15 : 1)
        const mult = front ? 0.75 * X.T.bump.takeK : fx_ < -0.35 ? 1.45 : 1.15
        const d = Math.min(30, (closing - 3) * 0.12 * Math.sqrt(Y.T.mass / X.T.mass) * dealY * mult / X.T.dur)
        return hurt(S, X, d, Y.id, ax, az, 'ram', zoneOfDir(X, -nx * (X === A ? 1 : -1), -nz * (X === A ? 1 : -1)))
      }
      const dA = dmgTo(A, B, fa, fb, frontA), dB = dmgTo(B, A, fb, fa, frontB)
      // ニトロは、ぶつけた・ぶつけられた時に溜まる
      const gain = (X, atk) => { X.nitro = Math.min(1, X.nitro + (0.06 + closing * 0.011) * X.T.eng.charge * (atk ? 1.3 : 1)) }
      gain(A, frontA); gain(B, frontB)
      A.hitT = B.hitT = 0.3
      ev(S, { k: 'ram', x: ax, y: Math.max(A.y, B.y) + 1.2, z: az, power: closing, a: A.id, b: B.id, za: zoneOfDir(A, -nx, -nz), zb: zoneOfDir(B, nx, nz), da: dA, db: dB, side: sideA || sideB })
    }
  }
}
export const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d }
