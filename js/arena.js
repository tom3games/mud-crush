// 採石場の形と高さ（sim と view の両方が読む。THREE にも DOM にも依存しない）
export const WORLD = 84           // 外の岩壁までの半径（当たり判定の限界）
export const SAFE0 = 64           // 試合の最初の安全な半径（時間で縮む）
export const SAFE_MIN = 15        // 縮みきった時の半径
export const NCAR = 6
const SQ = Math.sqrt
// 土の小山（なだらかな斜面。どの向きからも登れる。突っ込むと跳ぶ）
export const MOUNDS = [
  { x: -30, z: -26, r: 12, h: 2.5 }, { x: 33, z: 20, r: 11, h: 2.1 }, { x: 4, z: 44, r: 10, h: 1.9 }, { x: 8, z: -50, r: 13, h: 2.7 }, { x: -50, z: 28, r: 9, h: 1.7 },
]
// 泥の場所（真ん中のくぼみと水たまり）。mud 0..1 が高いほど滑って遅い
export const MUDS = [
  { x: 0, z: 0, r: 20, pit: 1.3 }, { x: 40, z: -34, r: 12, pit: 0.4 }, { x: -42, z: -4, r: 11, pit: 0.4 }, { x: -12, z: 52, r: 9, pit: 0.3 },
]
const sstep = (a, b, v) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t) }
export function mudAt(x, z) {
  let m = 0
  for (const p of MUDS) { const d = Math.hypot(x - p.x, z - p.z); if (d < p.r) m = Math.max(m, 1 - sstep(p.r * 0.55, p.r, d)) }
  return m
}
export function H(x, z) {
  let h = 0
  for (const m of MOUNDS) { const d = Math.hypot(x - m.x, z - m.z); if (d < m.r) h += m.h * 0.5 * (1 + Math.cos(Math.PI * d / m.r)) }
  for (const p of MUDS) { const d = Math.hypot(x - p.x, z - p.z); if (d < p.r) h -= p.pit * 0.5 * (1 + Math.cos(Math.PI * d / p.r)) }
  // 轍（わだち）のような細かい起伏。ごく浅い
  h += 0.07 * Math.sin(x * 0.31 + z * 0.17) * Math.cos(z * 0.23 - x * 0.09)
  return h
}
// 障害物。円: 岩・タイヤの山。箱: 積み上げた廃車
export const POLES = [
  { x: -12, z: -34, r: 2.6, h: 4.6, kind: 'rock' }, { x: 22, z: -8, r: 2.2, h: 3.8, kind: 'rock' }, { x: -24, z: 18, r: 3.0, h: 5.2, kind: 'rock' },
  { x: 30, z: 40, r: 2.4, h: 4.2, kind: 'rock' }, { x: -44, z: -36, r: 2.8, h: 4.8, kind: 'rock' }, { x: 52, z: 6, r: 2.5, h: 4.0, kind: 'rock' }, { x: -6, z: 24, r: 1.9, h: 3.2, kind: 'rock' },
  { x: 14, z: -30, r: 1.2, h: 1.9, kind: 'tires' }, { x: 16.2, z: -31.4, r: 1.2, h: 1.9, kind: 'tires' }, { x: -36, z: 46, r: 1.2, h: 1.9, kind: 'tires' }, { x: -34, z: 44.2, r: 1.2, h: 1.9, kind: 'tires' },
]
export const BOXES = [
  { x: 26, z: -50, w: 6.4, d: 2.7, h: 2.9, kind: 'junk', a: 0 }, { x: -52, z: -14, w: 2.7, d: 6.4, h: 2.9, kind: 'junk', a: 1 },
  { x: 46, z: 36, w: 2.7, d: 6.0, h: 2.7, kind: 'junk', a: 2 }, { x: -22, z: -56, w: 6.0, d: 2.7, h: 2.7, kind: 'junk', a: 3 },
]
for (const o of POLES) { o.base = H(o.x, o.z); o.top = o.base + o.h }
for (const o of BOXES) { o.base = H(o.x, o.z); o.top = o.base + o.h }

// ---- 格子（10m）。障害物ごとに近くの升目へ登録し、当たりと見通しはその升目だけ調べる
const CELL = 10, NC = Math.ceil(WORLD * 2 / CELL) + 1
const cellPoles = Array.from({ length: NC * NC }, () => []), cellBoxes = Array.from({ length: NC * NC }, () => [])
const ci = v => Math.max(0, Math.min(NC - 1, Math.floor((v + WORLD) / CELL)))
for (const o of POLES) { const m = o.r + 3; for (let i = ci(o.x - m); i <= ci(o.x + m); i++) for (let j = ci(o.z - m); j <= ci(o.z + m); j++) cellPoles[j * NC + i].push(o) }
for (const o of BOXES) { const mx = o.w / 2 + 3, mz = o.d / 2 + 3; for (let i = ci(o.x - mx); i <= ci(o.x + mx); i++) for (let j = ci(o.z - mz); j <= ci(o.z + mz); j++) cellBoxes[j * NC + i].push(o) }

// 円の押し出し。out に [向きx, 向きz, 食い込み量, 相手] を積む
export function pushOutCircle(x, y, z, r, hgt, out) {
  let hit = false
  const k = ci(z) * NC + ci(x)
  for (const o of cellPoles[k]) {
    if (y > o.top - 0.2 || y + hgt < o.base + 0.1) continue
    const dx = x - o.x, dz = z - o.z, rr = r + o.r, d2 = dx * dx + dz * dz
    if (d2 < rr * rr) { const d = SQ(d2) || 0.001; out.push([dx / d, dz / d, rr - d, o]); hit = true }
  }
  for (const o of cellBoxes[k]) {
    if (y > o.top - 0.2 || y + hgt < o.base + 0.1) continue
    const hx = o.w / 2, hz = o.d / 2
    const qx = Math.max(o.x - hx, Math.min(x, o.x + hx)), qz = Math.max(o.z - hz, Math.min(z, o.z + hz))
    const dx = x - qx, dz = z - qz, d2 = dx * dx + dz * dz
    if (d2 < r * r) {
      if (d2 > 1e-8) { const d = SQ(d2); out.push([dx / d, dz / d, r - d, o]) }
      else { const ox = hx - Math.abs(x - o.x), oz = hz - Math.abs(z - o.z); if (ox < oz) out.push([Math.sign(x - o.x) || 1, 0, ox + r, o]); else out.push([0, Math.sign(z - o.z) || 1, oz + r, o]) }
      hit = true
    }
  }
  return hit
}
export function solidAtPoint(x, y, z) {
  const k = ci(z) * NC + ci(x)
  for (const o of cellPoles[k]) { if (y < o.base || y > o.top) continue; const dx = x - o.x, dz = z - o.z; if (dx * dx + dz * dz < o.r * o.r) return o }
  for (const o of cellBoxes[k]) { if (y < o.base || y > o.top) continue; if (Math.abs(x - o.x) < o.w / 2 && Math.abs(z - o.z) < o.d / 2) return o }
  return null
}
export function lineClear(ax, ay, az, bx, by, bz) {
  const n = Math.max(2, Math.ceil(Math.hypot(bx - ax, bz - az) / 1.6))
  for (let i = 1; i < n; i++) {
    const t = i / n, x = ax + (bx - ax) * t, y = ay + (by - ay) * t, z = az + (bz - az) * t
    if (solidAtPoint(x, y, z)) return false
  }
  return true
}
export const clamp = (v, a, b) => v < a ? a : v > b ? b : v
export const inArena = (x, z, m = 0) => x * x + z * z < (WORLD - m) * (WORLD - m)
// 空いている場所を探す
export function freeSpot(x, z, r = 3.2) {
  const out = []
  for (let d = 0; d < 40; d += 2) for (let k = 0; k < (d ? 12 : 1); k++) {
    const a = k / 12 * 6.283, px = x + Math.sin(a) * d, pz = z + Math.cos(a) * d
    if (!inArena(px, pz, 6)) continue
    out.length = 0; const y = H(px, pz)
    if (!pushOutCircle(px, y, pz, r, 2, out) && Math.abs(H(px + 4, pz) - y) < 0.4 && Math.abs(H(px - 4, pz) - y) < 0.4 && Math.abs(H(px, pz + 4) - y) < 0.4 && Math.abs(H(px, pz - 4) - y) < 0.4 && mudAt(px, pz) < 0.3) return { x: px, z: pz }
  }
  return { x, z }
}
// 出発地点: 外側の輪に6台（中央を向く）。ひとつ目が自分
export const SPAWNS = Array.from({ length: NCAR }, (_, i) => { const a = i * 2 * Math.PI / NCAR + 0.4; const p = freeSpot(46 * Math.sin(a), 46 * Math.cos(a), 5); return { x: p.x, z: p.z, yaw: Math.atan2(-p.x, -p.z) } })
