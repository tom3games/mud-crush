// CPU の運転。入力は人と同じ { throttle, steer, nitro }。sim にだけ依存する（画面なし）
import { solidAtPoint, clamp } from './arena.js?v=5'
import { angDiff } from './sim.js?v=5'

function brain(S, c) {
  if (c.ai) return c.ai
  const r = S.rng
  return c.ai = { target: -1, retT: 0, back: 0, stuck: 0, skill: 0.72 + r() * 0.28, side: r() < 0.5 ? 1 : -1, noiseP: r() * 6, lx: c.x, lz: c.z, chkT: 0, wait: 0.2 + r() * 0.9, flee: 0 }
}
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z)
// 狙う相手を選ぶ: 近い・弱っている・こちらに横腹を向けている車を優先
function pickTarget(S, c, ai) {
  let best = null, bs = 1e9
  for (const o of S.cars) {
    if (o === c || !o.alive) continue
    const d = dist(c, o), dx = c.x - o.x, dz = c.z - o.z, l = Math.hypot(dx, dz) || 1
    const exposed = Math.abs((dx * Math.sin(o.yaw) + dz * Math.cos(o.yaw)) / l)   // 0 なら横腹がこちら
    const s = d * (0.8 + exposed * 0.5) - (100 - o.hp) * 0.25 + (o.id === ai.target ? -8 : 0) + (S.rng() - 0.5) * 20 * (1.2 - ai.skill)
    if (s < bs) { bs = s; best = o }
  }
  return best
}
export function cpuInput(S, c, dt) {
  const ai = brain(S, c)
  const out = { throttle: 1, steer: 0, nitro: false }
  if (S.phase !== 'play' || !c.alive) return out
  const r = Math.hypot(c.x, c.z), margin = S.safeR - r
  const sp = c.vx * Math.sin(c.yaw) + c.vz * Math.cos(c.yaw)
  // 引っかかり: 進まない時間が続いたら、少しバックして向きを変える
  ai.chkT += dt
  if (S.tMatch < ai.wait + 0.6) { ai.chkT = 0; ai.lx = c.x; ai.lz = c.z }
  else if (ai.chkT > 0.5) { const moved = Math.hypot(c.x - ai.lx, c.z - ai.lz); ai.lx = c.x; ai.lz = c.z; ai.chkT = 0; ai.stuck = moved < 0.9 && !c.air ? ai.stuck + 1 : 0; if (ai.stuck >= 2 && ai.back <= 0) { ai.back = 1.1 + S.rng() * 0.5; ai.side = -ai.side; ai.stuck = 0; ai.esc = (ai.esc || 0) + 1 } }
  ai.retT -= dt
  let tgt = ai.target >= 0 ? S.cars.find(o => o.id === ai.target && o.alive) : null
  if (!tgt || ai.retT <= 0) { tgt = pickTarget(S, c, ai); ai.target = tgt ? tgt.id : -1; ai.retT = 1.2 + S.rng() * 1.2 }
  let px = 0, pz = 0, havePt = false, panic = false
  if (margin < 7) { px = 0; pz = 0; havePt = true; panic = margin < 0 }   // 縮む輪の外へ出そうなら真ん中へ
  else if (tgt) {
    const d = dist(c, tgt), v = Math.hypot(tgt.vx, tgt.vz), lead = clamp(d / (Math.max(6, Math.abs(sp)) + 6), 0, 1.2) * 0.8 * ai.skill
    px = tgt.x + tgt.vx * lead; pz = tgt.z + tgt.vz * lead; void v
    if (d > 15) {   // 遠いうちは相手の横腹へ回り込む
      const rxs = -Math.cos(tgt.yaw), rzs = Math.sin(tgt.yaw)
      const sgn = Math.sign((c.x - tgt.x) * rxs + (c.z - tgt.z) * rzs) || ai.side
      px += rxs * sgn * 5.5; pz += rzs * sgn * 5.5
    }
    havePt = true
  }
  if (S.tMatch < ai.wait) havePt = false
  if (ai.back > 0) {   // バック中
    ai.back -= dt; out.throttle = (c.zone.b > 18 && ai.esc % 2 === 1) ? -1 : 1; out.steer = (out.throttle < 0 ? ai.side * 0.8 : ai.side)
    return out
  }
  if (havePt) {
    const want = Math.atan2(px - c.x, pz - c.z)
    let err = angDiff(want, c.yaw)
    // 前方の岩・廃車をよける
    const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw)
    let avoid = 0
    for (const [dd, ang] of [[7, 0.45], [7, -0.45], [12, 0.25], [12, -0.25], [5, 0]]) {
      const a = c.yaw + ang
      if (solidAtPoint(c.x + Math.sin(a) * dd, c.y + 1, c.z + Math.cos(a) * dd)) avoid += ang === 0 ? ai.side * 1.2 : -Math.sign(ang) * (1.2 - dd * 0.05)
    }
    if (avoid) err = clamp(err * 0.3 + avoid, -1.6, 1.6)
    const noise = Math.sin(S.t * 1.7 + ai.noiseP) * 0.07 * (1.2 - ai.skill) * 2
    out.steer = clamp(-(err + noise) * 1.9, -1, 1)
    const d = tgt ? dist(c, tgt) : 99
    // 大きく向きがずれていて近いなら減速して回る
    if (Math.abs(err) > 1.25 && sp > 7) out.throttle = d < 14 ? -0.4 : 0.5
    if (c.nitro > 0.3 && !c.nitroLock && !avoid) {
      if (panic && c.nitro > 0.15) out.nitro = true
      else if (tgt && !panic && d > 6 && d < 30 && Math.abs(err) < 0.22 && sp > 6 && (tgt.hp < 70 || c.nitro > 0.8 || S.rng() < 0.01)) out.nitro = true
    }
    void fx; void fz
  } else { out.throttle = 0 }
  return out
}
// 全車ぶんの入力。human は人の入力（無ければ CPU が代わりに動かす＝見せ場・検査用）
export function makeInputs(S, dt, human) {
  const inp = {}
  for (const c of S.cars) {
    if (c.human && human) inp[c.id] = human
    else inp[c.id] = cpuInput(S, c, dt)
  }
  return inp
}
