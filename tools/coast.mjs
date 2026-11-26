// アクセルを離してから止まるまでを測る。node tools/coast.mjs
import { H } from '../js/arena.js'
import { createState, step, DT, BODIES } from '../js/sim.js'
for (let b = 0; b < 3; b++) {
  const S = createState(5, { n: 1, player: { body: b, bumper: 0, tire: 1, engine: 1 }, noCountdown: true, noEnd: true }); const c = S.cars[0]
  c.x = -38; c.z = 67; c.y = H(c.x, c.z); c.yaw = Math.PI / 2; c.invT = 99
  const run = (thr, sec) => { for (let i = 0; i < sec * 60; i++) step(S, { [c.id]: { throttle: thr, steer: 0, nitro: false } }, DT) }
  run(1, 5); const v0 = Math.hypot(c.vx, c.vz), z0 = c.x
  let t = 0, t50 = null, t10 = null
  while (t < 20 && Math.hypot(c.vx, c.vz) > 0.3) { step(S, { [c.id]: { throttle: 0, steer: 0, nitro: false } }, DT); t += DT; const v = Math.hypot(c.vx, c.vz); if (t50 === null && v < v0 * 0.5) t50 = t; if (t10 === null && v < v0 * 0.15) t10 = t }
  console.log(BODIES[b].name, `離す時 ${(v0 * 3.6).toFixed(0)}km/h  半分まで ${t50?.toFixed(1)}秒  15%まで ${t10?.toFixed(1)}秒  止まるまで ${t.toFixed(1)}秒  距離 ${Math.abs(c.x - z0).toFixed(0)}m`)
}
