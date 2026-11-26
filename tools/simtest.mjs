// 画面なしで試合の中身を叩く。node tools/simtest.mjs
import { createState, step, DT, BODIES } from '../js/sim.js'
import { makeInputs } from '../js/cpu.js'
import { H } from '../js/arena.js'
let ok = 0, ng = 0
const t = (name, c, info = '') => { c ? ok++ : ng++; console.log((c ? 'ok   ' : 'FAIL ') + name + (info ? '  ' + info : '')) }
const lone = (body = 0) => { const S = createState(5, { n: 2, player: { body, bumper: 0, tire: 1, engine: 1 }, noCountdown: true, noEnd: true }); const c = S.cars[0], d = S.cars[1]; d.x = 0; d.z = -200; c.x = -38; c.z = 67; c.y = H(c.x, c.z); c.yaw = Math.PI / 2; c.invT = 0; return { S, c } }
const run = (S, c, inp, sec) => { for (let i = 0; i < sec * 60; i++) step(S, { [c.id]: inp, [S.cars[1].id]: { throttle: 0, steer: 0, nitro: false } }, DT) }
// 前が壊れると遅くなる
{ const a = lone(), b = lone(); b.c.zone.f = 0; run(a.S, a.c, { throttle: 1, steer: 0, nitro: false }, 4); run(b.S, b.c, { throttle: 1, steer: 0, nitro: false }, 4); t('前が壊れると遅い', Math.hypot(b.c.vx, b.c.vz) < Math.hypot(a.c.vx, a.c.vz) * 0.85, `${(Math.hypot(a.c.vx, a.c.vz) * 3.6).toFixed(0)} -> ${(Math.hypot(b.c.vx, b.c.vz) * 3.6).toFixed(0)}km/h`) }
// 後ろが壊れるとバックできない
{ const a = lone(), b = lone(); b.c.zone.b = 0; run(a.S, a.c, { throttle: -1, steer: 0, nitro: false }, 3); run(b.S, b.c, { throttle: -1, steer: 0, nitro: false }, 3); const ba = Math.abs(a.c.x + 38), bb = Math.abs(b.c.x + 38); t('後ろが壊れるとバックできない', bb < 0.5 && ba > 4, `${ba.toFixed(1)}m / ${bb.toFixed(1)}m`) }
// 横が壊れるとハンドルがぶれる（まっすぐ走らない）
{ const a = lone(), b = lone(); b.c.zone.l = 0; b.c.zone.r = 0; let ya = 0, yb = 0; for (let i = 0; i < 360; i++) { step(a.S, { [a.c.id]: { throttle: 1, steer: 0, nitro: false }, [a.S.cars[1].id]: {} }, DT); step(b.S, { [b.c.id]: { throttle: 1, steer: 0, nitro: false }, [b.S.cars[1].id]: {} }, DT); ya = Math.max(ya, Math.abs(a.c.yaw - Math.PI / 2)); yb = Math.max(yb, Math.abs(b.c.yaw - Math.PI / 2)) } t('横が壊れるとぶれる', yb > ya + 0.04, `向きのずれ ${ya.toFixed(3)} / ${yb.toFixed(3)}rad`) }
// ニトロはアクセル込みで速く、溜まりが減り、空で止まる
{ const a = lone(), b = lone(); a.c.nitro = 1; run(a.S, a.c, { throttle: 0, steer: 0, nitro: true }, 2); run(b.S, b.c, { throttle: 1, steer: 0, nitro: false }, 2); t('ニトロだけで進み、速い', Math.hypot(a.c.vx, a.c.vz) > Math.hypot(b.c.vx, b.c.vz) * 1.15 && a.c.nitro < 0.6, `ニトロ ${(Math.hypot(a.c.vx, a.c.vz) * 3.6).toFixed(0)} / ふつう ${(Math.hypot(b.c.vx, b.c.vz) * 3.6).toFixed(0)}km/h 残り${a.c.nitro.toFixed(2)}`); run(a.S, a.c, { throttle: 0, steer: 0, nitro: true }, 6); t('ニトロが空になったら押し続けても出ない', a.c.nitro === 0 && !a.c.boosting) }
// ニトロ連打でも値が壊れない
{ const a = lone(); a.c.nitro = 1; for (let i = 0; i < 1200; i++) step(a.S, { [a.c.id]: { throttle: 1, steer: 0, nitro: (i >> 1) % 2 === 0 }, [a.S.cars[1].id]: {} }, DT); t('ニトロ連打で 0〜1 に収まる', a.c.nitro >= 0 && a.c.nitro <= 1 && isFinite(a.c.x)) }
// ぶつけると溜まる
{ const S = createState(9, { n: 2, player: { body: 1, bumper: 0, tire: 1, engine: 1 }, noCountdown: true, noEnd: true }); const [A, B] = S.cars; A.x = -30; A.z = 66; A.yaw = Math.PI / 2; B.x = -22; B.z = 66; B.yaw = -Math.PI / 2; A.y = B.y = H(-26, 66); A.invT = B.invT = 0; A.nitro = B.nitro = 0; for (let i = 0; i < 200; i++) step(S, { [A.id]: { throttle: 1, steer: 0, nitro: false }, [B.id]: { throttle: 1, steer: 0, nitro: false } }, DT); t('ぶつけ合うと両方のニトロが溜まる', A.nitro > 0.1 && B.nitro > 0.1 && A.hp < 100 && B.hp < 100, `A ${A.nitro.toFixed(2)} B ${B.nitro.toFixed(2)} hp ${A.hp.toFixed(0)}/${B.hp.toFixed(0)}`) }
// 横から強く当てるとひっくり返る
{ let flips = 0, N = 12; for (let k = 0; k < N; k++) { const S = createState(20 + k, { n: 2, player: { body: 2, bumper: 0, tire: 1, engine: 1 }, noCountdown: true, noEnd: true }); const [A, B] = S.cars; A.x = -40; A.z = 66; A.yaw = Math.PI / 2; B.x = -20; B.z = 66; B.yaw = 0; A.y = B.y = 0; A.invT = B.invT = 0; A.nitro = 1; for (let i = 0; i < 360; i++) step(S, { [A.id]: { throttle: 1, steer: 0, nitro: i < 160 }, [B.id]: { throttle: 0, steer: 0, nitro: false } }, DT); if (!B.alive && B.outHow === 'flip') flips++ } t('改造バスの横腹にニトロで突っ込むと転ぶことがある（全部は転ばない）', flips > 0 && flips < N, `${flips}/${N}`) }
// 転覆は当てた側に1点
{ const S = createState(31, { n: 2, player: { body: 2, bumper: 0, tire: 1, engine: 1 }, noCountdown: true, noEnd: true }); const [A, B] = S.cars; B.lastHit = { by: A.id, t: S.t }; B.tip = 1; B.tipV = 3; for (let i = 0; i < 10; i++) step(S, {}, DT); t('転覆の点が当てた側に入る', !B.alive && B.outHow === 'flip' && A.flips === 1) }
// 全員が同じ瞬間に壊れても勝者が決まる
{ const S = createState(41, { n: 4, noCountdown: true }); for (let i = 0; i < 400; i++) step(S, makeInputs(S, DT, null), DT); for (const c of S.cars) c.hp = 0; for (let i = 0; i < 400 && !S.over; i++) step(S, makeInputs(S, DT, null), DT); t('全員同時に壊れても決着する', S.over && S.winner > 0 && S.ranking.length === 4) }
// 場外は崩れて体力が減る
{ const { S, c } = lone(); c.x = -70; c.z = 40; c.y = 0; run(S, c, { throttle: 0, steer: 0, nitro: false }, 0.1); const hp0 = c.hp; run(S, c, { throttle: 0, steer: 0, nitro: false }, 10); t('縮んだ輪の外は体力が減る', c.hp < hp0 - 15, `${hp0.toFixed(0)} -> ${c.hp.toFixed(0)}`) }
// 同じ種で同じ結果
{ const f = () => { const S = createState(77, {}); for (let i = 0; i < 60 * 40; i++) step(S, makeInputs(S, DT, null), DT); return S.cars.map(c => c.x.toFixed(3) + c.hp.toFixed(2)).join() }; t('同じ種で同じ結果', f() === f()) }
// 体力が少ないほど押す力が上がる（質量が実効で増える）→ 弱った側が押し負けにくい
{ const mk = hp => { const S = createState(51, { n: 2, player: { body: 1, bumper: 0, tire: 1, engine: 1 }, noCountdown: true, noEnd: true }); const [A, B] = S.cars; B.lo = A.lo; A.x = -34; A.z = 66; A.yaw = Math.PI / 2; B.x = -24; B.z = 66; B.yaw = -Math.PI / 2; A.y = B.y = 0; A.invT = B.invT = 99; A.hp = hp; for (let i = 0; i < 150; i++) step(S, { [A.id]: { throttle: 1, steer: 0, nitro: false }, [B.id]: { throttle: 1, steer: 0, nitro: false } }, DT); return (A.x + B.x) / 2 }; const full = mk(100), weak = mk(15); t('体力が少ない側は押し勝ちやすい', weak > full + 0.3, `中央のずれ ${full.toFixed(2)} -> ${weak.toFixed(2)}`) }
console.log(`\n${ok} ok / ${ng} NG`); process.exit(ng ? 1 : 0)
