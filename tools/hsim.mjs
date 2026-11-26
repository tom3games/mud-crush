// CPU だけの試合を画面なしで回し、決着までの時間・倒れ方・転覆の数を出す。node tools/hsim.mjs [試合数]
import { createState, step, DT } from '../js/sim.js'
import { makeInputs } from '../js/cpu.js'
const N = +(process.argv[2] || 20)
const rows = []
for (let s = 1; s <= N; s++) {
  const S = createState(s * 101 + 7, {})
  let n = 0, stillMax = 0, still = new Map()
  while (!S.over && n < 60 * 400) {
    step(S, makeInputs(S, DT, null), DT); S.events.length = 0; n++
    if (n % 30 === 0) for (const c of S.cars) if (c.alive) { const k = c.id, o = still.get(k) || { x: c.x, z: c.z, t: 0 }; if (Math.hypot(c.x - o.x, c.z - o.z) < 1.2) o.t += 0.5; else { o.x = c.x; o.z = c.z; o.t = 0 } still.set(k, o); stillMax = Math.max(stillMax, o.t) }
  }
  const how = S.cars.map(c => c.outHow || 'alive')
  rows.push({ s, sec: +S.tMatch.toFixed(0), over: S.over, win: S.cars.find(c => c.id === S.winner)?.lo, flips: S.cars.reduce((a, c) => a + c.flips, 0), wreck: how.filter(h => h === 'wreck').length, flip: how.filter(h => h === 'flip').length, ring: S.cars.filter(c => c.outHow === 'wreck' && c.ringT > 1).length, still: stillMax, nan: S.cars.some(c => !isFinite(c.x + c.z + c.y)) })
}
const avg = k => (rows.reduce((a, r) => a + r[k], 0) / rows.length).toFixed(1)
console.log(rows.map(r => `seed${r.s}: ${r.sec}s over=${r.over} flip=${r.flip} wreck=${r.wreck} ringDeaths=${r.ring} stillMax=${r.still}s nan=${r.nan}`).join('\n'))
console.log(`平均 ${avg('sec')}秒 / 転覆 ${avg('flip')} / 大破 ${avg('wreck')} / 輪で死 ${avg('ring')} / 最大静止 ${Math.max(...rows.map(r => r.still))}s / 未決着 ${rows.filter(r => !r.over).length}`)
const w = {}; for (const r of rows) if (r.win) { const k = ['dump', 'trash', 'bus'][r.win.body]; w[k] = (w[k] || 0) + 1 } console.log('勝った車体', JSON.stringify(w))
