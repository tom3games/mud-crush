// 入口: 画面の切り替え・入力・HUD・音・ループ。試合の中身は sim.js、CPU は cpu.js、絵は stage.js
import * as THREE from 'three'
import { createState, step, DT, BODIES, BUMPERS, TIRES, ENGINES, CAR_COLORS, GRACE } from './sim.js?v=6'
import { EngineMix } from './engine.js?v=6'
import { makeInputs } from './cpu.js?v=6'
import { Stage } from './stage.js?v=6'
import { loadAssets } from './assets.js?v=6'
import { SAFE0, WORLD, POLES, BOXES, MUDS } from './arena.js?v=6'

const Q = new URLSearchParams(location.search)
const $ = id => document.getElementById(id)
const hex = h => '#' + h.toString(16).padStart(6, '0')
const touchy = Q.get('touch') === '1' || (Q.get('touch') !== '0' && (('ontouchstart' in window) && matchMedia('(pointer:coarse)').matches))
if (touchy) document.body.classList.add('touch')
const low = touchy || Math.min(innerWidth, innerHeight) < 600 || Q.get('low') === '1'

// ------------------------------------------------------------ 音
const SND = {
  crash: ['snd/crash1.mp3', 'snd/crash2.mp3', 'snd/crash3.mp3', 'snd/crash4.mp3'], clink: ['snd/clink1.mp3', 'snd/clink2.mp3', 'snd/clink3.mp3'], punch: ['snd/punch1.mp3', 'snd/punch2.mp3'],
  hitl: ['snd/hitl1.mp3', 'snd/hitl2.mp3', 'snd/hitl3.mp3'], boom: ['snd/boom1.mp3', 'snd/boom2.mp3', 'snd/boom3.mp3', 'snd/boom4.mp3'], debris: ['snd/debris1.mp3', 'snd/debris2.mp3'], thud: ['snd/thud.mp3'],
  whoosh: ['snd/jet.mp3'], spring: ['snd/spring1.mp3', 'snd/spring2.mp3', 'snd/spring3.mp3'], plop: ['snd/plop1.mp3', 'snd/plop2.mp3'], splash: ['snd/splash1.mp3'], glass: ['snd/glass1.mp3', 'snd/glass2.mp3'],
  horn: ['snd/horn.mp3'], tick: ['snd/tick.mp3'], win: ['snd/win.mp3'], lose: ['snd/lose.mp3'], switch: ['snd/switch1.mp3'], roll: ['snd/roll1.mp3', 'snd/roll2.mp3'], boxbreak: ['snd/boxbreak.mp3'],
  eng: ['snd/eng_idle.wav', 'snd/eng_mid.wav', 'snd/eng_high.wav'],
}
Snd.def(SND)
const engine = new EngineMix()
let bgmOn = false
function bgm(v, fade = 1.4) {
  if (!Snd.ctx) return
  if (!bgmOn) { bgmOn = true; Snd.loop('bgm', 'snd/music.mp3', v, 1.5); return }
  const l = Snd.loops.bgm; if (l && l.g) { const t = Snd.ctx.currentTime; l.g.gain.cancelScheduledValues(t); l.g.gain.setValueAtTime(l.g.gain.value, t); l.g.gain.linearRampToValueAtTime(v, t + fade); l.vol = v }
}
const sfxLast = {}
const playSnd = (name, o = {}) => { if ((o.vol ?? 1) < 0.035) return; const now = performance.now(); if (now - (sfxLast[name] || 0) < 28) return; sfxLast[name] = now; Snd.play(name, o) }

// ------------------------------------------------------------ 画面と状態
const stage = new Stage($('view'), { low, preserve: Q.get('shot') === '1' })
stage.snd = playSnd
addEventListener('resize', () => { stage.resize(); sizeWind(); sizeCrack(); sizeMud() })
if (window.visualViewport) visualViewport.addEventListener('resize', () => { stage.resize(); sizeWind(); sizeCrack(); sizeMud() })
const seedBase = +(Q.get('seed') || (Date.now() % 100000))
let S = createState(seedBase, { noCountdown: true }), phase = 'title', matchNo = 0, human = false
let lo = { body: 0, bumper: 0, tire: 0, engine: 1 }
try { const v = JSON.parse(localStorage.getItem('mc_lo') || 'null'); if (v && BODIES[v.body] && BUMPERS[v.bumper] && TIRES[v.tire] && ENGINES[v.engine]) lo = v } catch (e) {}
if (Q.get('lo')) { const a = Q.get('lo').split(',').map(Number); lo = { body: a[0] | 0, bumper: a[1] | 0, tire: a[2] | 0, engine: a[3] | 0 } }
let acc = 0, last = performance.now(), simSpeed = Math.max(1, Math.min(12, +(Q.get('speed') || 1)))
let snapCam = true, resultAt = 0, shownResult = false, msgT = 0, lookOff = 0, lookAt = 0, outAt = 0, wasBoost = false, mudT = 0, ringMsgAt = 0, shrinkSaid = false
const K = { keys: {}, gas: false, back: false, L: false, R: false, nitro: false, touches: new Map(), auto: Q.get('auto') === '1' }
const me = () => S.human >= 0 ? S.cars.find(c => c.id === S.human) : null

// ------------------------------------------------------------ 入力
const KEYMAP = { KeyW: 'gas', ArrowUp: 'gas', KeyS: 'brake', ArrowDown: 'brake', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right', ShiftLeft: 'nitro', ShiftRight: 'nitro', Space: 'nitro' }
addEventListener('keydown', e => {
  if (e.repeat) return
  const m = KEYMAP[e.code]; if (m) { K.keys[m] = true; if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault() }
  if (e.code === 'KeyM') toggleMute()
  Snd.init(); if (phase === 'title') bgm(0.22)
})
addEventListener('keyup', e => { const m = KEYMAP[e.code]; if (m) K.keys[m] = false })
addEventListener('blur', () => { K.keys = {} })
const view = $('view')
view.addEventListener('mousedown', e => { if (e.button === 0) { Snd.init(); if (phase === 'title') bgm(0.22); if (phase === 'play' && !document.pointerLockElement && !touchy && view.requestPointerLock) { try { const pr = view.requestPointerLock(); if (pr && pr.catch) pr.catch(() => {}) } catch (er) {} } } })
addEventListener('mousemove', e => { if (document.pointerLockElement && phase === 'play') { lookOff = Math.max(-2.8, Math.min(2.8, lookOff - e.movementX * 0.0035)); lookAt = performance.now() } })
const holdBtn = (id, key) => {
  const b = $(id)
  const down = e => { e.preventDefault(); Snd.init(); b.setPointerCapture?.(e.pointerId); K[key] = true; b.classList.add('on') }
  const up = () => { K[key] = false; b.classList.remove('on') }
  b.addEventListener('pointerdown', down); b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up)
}
holdBtn('bL', 'L'); holdBtn('bR', 'R'); holdBtn('bGas', 'gas'); holdBtn('bBack', 'back'); holdBtn('bNitro', 'nitro')
$('bMute').addEventListener('pointerdown', e => { e.preventDefault(); toggleMute() }); $('muteT').addEventListener('click', toggleMute)
let muted = false
function toggleMute() { muted = !muted; Snd.setMute(muted); document.body.classList.toggle('muted', muted) }
const howOpen = on => { document.body.classList.toggle('how-open', on); if (on) playSnd('switch', { vol: 0.5 }) }
$('howT').addEventListener('click', () => howOpen(true)); $('howX').addEventListener('click', () => howOpen(false))
// 画面をなぞって見回す（スマホ）
addEventListener('pointerdown', e => {
  if (e.pointerType !== 'touch' || phase !== 'play') return
  if (e.target.closest && e.target.closest('.rb,button,a')) return
  K.touches.set(e.pointerId, { x: e.clientX }); Snd.init()
})
addEventListener('pointermove', e => { const t = K.touches.get(e.pointerId); if (!t) return; lookOff = Math.max(-2.8, Math.min(2.8, lookOff - (e.clientX - t.x) * 0.006)); t.x = e.clientX; lookAt = performance.now() })
const endTouch = e => K.touches.delete(e.pointerId)
addEventListener('pointerup', endTouch); addEventListener('pointercancel', endTouch)

function readHuman() {
  const k = K.keys, nitro = !!(k.nitro || K.nitro), gas = !!(k.gas || K.gas), back = !!(k.brake || K.back)
  return { throttle: nitro || gas ? 1 : back ? -1 : 0, steer: (k.right || K.R ? 1 : 0) - (k.left || K.L ? 1 : 0), nitro }
}

// ------------------------------------------------------------ 整備（車を選ぶ）
const SVG = (inner, vb = '0 0 70 40') => `<svg viewBox="${vb}" fill="currentColor" aria-hidden="true">${inner}</svg>`
const wh = (x, y = 31, r = 5.5) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#1a130e" stroke="currentColor" stroke-width="2.4"/>`
const ICONS = {
  body: [
    SVG(`<path d="M4 17L36 12v17H4z"/><path d="M38 14h12l7 8h9v7H38z"/><rect x="40" y="16" width="9" height="6" fill="#1a130e"/>${wh(15)}${wh(28)}${wh(54)}`),
    SVG(`<rect x="4" y="9" width="33" height="20" rx="6"/><path d="M39 14h11l7 8h8v7H39z"/><rect x="41" y="16" width="8" height="6" fill="#1a130e"/>${wh(16)}${wh(29)}${wh(55)}`),
    SVG(`<path d="M3 9h50l8 7v13H3z"/><g fill="#1a130e"><rect x="7" y="12" width="7" height="6"/><rect x="17" y="12" width="7" height="6"/><rect x="27" y="12" width="7" height="6"/><rect x="37" y="12" width="7" height="6"/><rect x="53" y="17" width="6" height="4"/></g>${wh(15)}${wh(50)}`),
  ],
  bumper: [
    SVG(`<path d="M10 6h20l30 9-30 9H10z"/><rect x="2" y="12" width="10" height="10"/><path d="M24 30h40" stroke="currentColor" stroke-width="3" stroke-dasharray="5 4" fill="none"/>`),
    SVG(`<rect x="6" y="6" width="9" height="28"/><path d="M15 8l36 3-36 3zM15 17l42 3-42 3zM15 26l36 3-36 3z"/>`),
    SVG(`<g fill="none" stroke="currentColor" stroke-width="5"><circle cx="46" cy="13" r="7"/><circle cx="46" cy="27" r="7"/><circle cx="32" cy="20" r="7"/><circle cx="60" cy="20" r="7"/></g><rect x="4" y="8" width="12" height="24"/>`),
  ],
  tire: [
    SVG(`<circle cx="35" cy="20" r="16" fill="#1a130e" stroke="currentColor" stroke-width="3"/><g stroke="currentColor" stroke-width="4" stroke-linecap="butt">${[0, 1, 2, 3, 4, 5, 6, 7].map(i => { const a = i * Math.PI / 4; return `<path d="M${35 + Math.cos(a) * 12} ${20 + Math.sin(a) * 12}L${35 + Math.cos(a) * 20} ${20 + Math.sin(a) * 20}"/>` }).join('')}</g><circle cx="35" cy="20" r="5"/>`),
    SVG(`<circle cx="35" cy="20" r="16" fill="#1a130e" stroke="currentColor" stroke-width="3"/><circle cx="35" cy="20" r="10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="3 2"/><circle cx="35" cy="20" r="5"/>`),
    SVG(`<ellipse cx="35" cy="20" rx="12" ry="17" fill="#1a130e" stroke="currentColor" stroke-width="3"/><path d="M35 5v30M29 8l12 4M29 16l12 4M29 24l12 4" stroke="currentColor" stroke-width="2" fill="none"/>`),
  ],
  engine: [
    SVG(`<rect x="14" y="6" width="42" height="28" rx="12" fill="none" stroke="currentColor" stroke-width="3.5"/><rect x="18" y="10" width="34" height="20" rx="8"/><rect x="31" y="2" width="8" height="5"/>`),
    SVG(`<rect x="20" y="8" width="30" height="24" rx="10" fill="none" stroke="currentColor" stroke-width="3.5"/><rect x="24" y="14" width="22" height="14" rx="5"/><rect x="31" y="3" width="8" height="5"/>`),
    SVG(`<rect x="26" y="12" width="18" height="20" rx="7" fill="none" stroke="currentColor" stroke-width="3.5"/><rect x="29" y="22" width="12" height="7" rx="3"/><rect x="31" y="6" width="8" height="6"/><path d="M8 20h12M50 20h12M10 14h8M52 14h8M10 26h8M52 26h8" stroke="currentColor" stroke-width="2.5" fill="none"/>`),
  ],
}
const CATS = [
  { key: 'body', label: '車体', arr: BODIES, st: ['速さ', '硬さ', '重さ'] },
  { key: 'bumper', label: 'バンパー', arr: BUMPERS, st: ['攻め', '守り', '弾き'] },
  { key: 'tire', label: 'タイヤ', arr: TIRES, st: ['速さ', '泥'] },
  { key: 'engine', label: 'エンジン', arr: ENGINES, st: ['ニトロ量', '溜まり'] },
]
let tabIdx = 0
function buildPrep() {
  $('ptabs').innerHTML = CATS.map((c, i) => `<button class="tab" role="tab" data-i="${i}" aria-selected="${i === tabIdx}"><small>${c.label}</small><b>${c.arr[lo[c.key]].name}</b></button>`).join('')
  $('ptabs').querySelectorAll('.tab').forEach(el => el.addEventListener('click', () => { tabIdx = +el.dataset.i; buildPrep(); playSnd('switch', { vol: 0.5 }) }))
  const C = CATS[tabIdx]
  $('popts').innerHTML = C.arr.map((p, i) => `<button class="opt" role="radio" data-i="${i}" aria-checked="${lo[C.key] === i}"><span class="ic">${ICONS[C.key][i]}</span><span><h3>${p.name}</h3><p>${p.note}</p></span><span class="st">${C.st.map((l, k) => `<span>${l}</span><i>${[0, 1, 2, 3, 4].map(n => `<u class="${n < p.stat[k] ? 'on' : ''}"></u>`).join('')}</i>`).join('')}</span></button>`).join('')
  $('popts').querySelectorAll('.opt').forEach(el => el.addEventListener('click', () => { lo[C.key] = +el.dataset.i; buildPrep(); stage.setPreview(lo, CAR_COLORS[0]); $('pbuild').textContent = C.arr[lo[C.key]].note; playSnd('switch', { vol: 0.6 }); try { localStorage.setItem('mc_lo', JSON.stringify(lo)) } catch (e) {} }))
}
function toPrep() {
  phase = 'prep'; human = false; setPaused(false, true)
  stage.clearDynamic(); stage.setPreview(lo, CAR_COLORS[0])
  $('title').hidden = true; $('result').hidden = true; $('hud').hidden = true; $('prep').hidden = false
  $('pbuild').textContent = BODIES[lo.body].note
  tabIdx = 0; buildPrep(); clearCracks(); bgm(0.22); document.exitPointerLock?.()
  playSnd('switch', { vol: 0.6 })
}
$('goPrep').addEventListener('click', () => { Snd.init(); toPrep() })
$('pGo').addEventListener('click', () => { Snd.init(); startMatch() })

// ------------------------------------------------------------ 試合の始まりと終わり
function startMatch() {
  matchNo++
  try { localStorage.setItem('mc_lo', JSON.stringify(lo)) } catch (e) {}
  S = createState(seedBase + matchNo * 977, { player: { ...lo }, name: 'あなた' })
  stage.setPreview(null); stage.clearDynamic(); human = true
  phase = 'play'; shownResult = false; resultAt = 0; outAt = 0; snapCam = true; lookOff = 0; shrinkSaid = false; ringMsgAt = 0; wasBoost = false
  setPaused(false, true); clearCracks(); boardKey = ''
  $('title').hidden = true; $('result').hidden = true; $('prep').hidden = true; $('hud').hidden = false; $('feed').innerHTML = ''; $('msg').textContent = ''; $('flipn').hidden = true; $('fn').textContent = '0'
  hintT = 0; lastHint = null
  Snd.init(); bgm(0.17, 2.0); playSnd('switch', { vol: 0.6 })
  window.__mcOnStart && window.__mcOnStart()
}
function toTitle() {
  setPaused(false, true); document.exitPointerLock?.()
  phase = 'title'; human = false
  S = createState(seedBase + (++matchNo) * 31, { noCountdown: true }); stage.setPreview(null); stage.clearDynamic(); clearCracks()
  $('title').hidden = false; $('result').hidden = true; $('hud').hidden = true; $('prep').hidden = true
  engine.clear(); bgm(0.22)
}
$('btnAgain').addEventListener('click', () => startMatch())
$('btnPrep').addEventListener('click', () => toPrep())
$('btnTitle').addEventListener('click', () => toTitle())
$('btnPost').addEventListener('click', () => {
  const rk = $('rkN').textContent, c = me()
  const txt = `鉄と泥で${rk}位。ひっくり返した ${c ? c.flips : 0}台。ダンプとバスで潰し合う6台バトル`
  window.open('https://x.com/intent/post?text=' + encodeURIComponent(txt + '\n#鉄と泥') + '&url=' + encodeURIComponent('https://tom3games.github.io/mud-crush/'), '_blank')
})
let paused = false, lockedAt = 0, pausedAt = 0
function setPaused(on, leaving = false) {
  on = !!on && phase === 'play'
  if (on === paused) return
  paused = on; pausedAt = performance.now(); $('pause').hidden = !on
  K.keys = {}; K.gas = K.back = K.L = K.R = K.nitro = false; K.touches.clear()
  document.querySelectorAll('#tc .rb.on').forEach(b => b.classList.remove('on'))
  if (on) { engine.clear(); Snd.sleep(); document.exitPointerLock?.() } else if (!leaving) { Snd.init(); snapCam = true; last = performance.now() }
}
$('bPause').addEventListener('pointerdown', e => { e.preventDefault(); setPaused(true) })
$('pResume').addEventListener('click', () => setPaused(false))
$('pQuit').addEventListener('click', () => toTitle())
addEventListener('keydown', e => { if ((e.code === 'KeyP' || e.code === 'Escape') && phase === 'play' && !e.repeat) { e.preventDefault(); if (e.code === 'Escape' && paused && performance.now() - pausedAt < 500) return; setPaused(!paused) } })
document.addEventListener('visibilitychange', () => { if (document.hidden && phase === 'play') setPaused(true) })
document.addEventListener('pointerlockchange', () => { if (document.pointerLockElement) lockedAt = performance.now(); else if (phase === 'play' && !paused && lockedAt && !shownResult) setPaused(true) })
const VERDICT = ['最後まで走っていた。', 'あと1台だった。', 'ボロボロでも生き残った。', '中盤で潰れた。', '序盤で持っていかれた。', '真っ先に潰れた。']
function showResult(rank) {
  if (shownResult) return; shownResult = true
  const c = me()
  $('rkN').textContent = rank; $('rkV').textContent = VERDICT[Math.min(5, rank - 1)]
  const order = S.over ? S.ranking.map(id => S.cars.find(q => q.id === id)) : [...S.cars].sort((a, b) => (b.alive - a.alive) || (b.outT - a.outT) || b.hp - a.hp)
  $('rkList').innerHTML = order.map((q, i) => `<li class="${q.human ? 'me' : ''}" style="--tc:${hex(q.color)}"><b>${i + 1}</b><i></i><span>${q.name}</span><em>${q.flips ? '転覆 ' + q.flips : ''}</em></li>`).join('')
  $('result').classList.toggle('win', rank === 1)
  $('result').hidden = false; $('hud').hidden = true; $('vig').className = ''
  phase = 'result'
  playSnd(rank <= 2 ? 'win' : 'lose', { vol: 0.9 }); Snd.duck(0.3, 3); engine.clear(); bgm(0.22)
  document.exitPointerLock?.()
  window.__mcDone = { tMatch: S.tMatch, winner: S.winner, rank, flips: c ? c.flips : 0 }
  window.__mcOnResult && window.__mcOnResult(rank)
}

// ------------------------------------------------------------ フロントガラスのひび
const crackC = $('crack'), cg = crackC.getContext('2d'); let cracks = []
function sizeCrack() { crackC.width = innerWidth; crackC.height = (window.visualViewport && visualViewport.height) || innerHeight; drawCracks() }
function clearCracks() { cracks = []; drawCracks(); splats = [] }
function drawCracks() {
  cg.clearRect(0, 0, crackC.width, crackC.height)
  for (const k of cracks) {
    let sd = k.seed; const rr = () => { sd = (sd * 16807) % 2147483647; return (sd - 1) / 2147483646 }
    const cx = k.x * crackC.width, cy = k.y * crackC.height, R = k.r * Math.min(crackC.width, crackC.height * 0.8)
    const lines = []
    for (let i = 0; i < k.n; i++) { const a = (i / k.n) * 6.283 + rr() * 0.5, len = R * (0.45 + rr() * 0.75); const pts = [[cx, cy]]; let x = cx, y = cy, ang = a; for (let s = 0; s < 6; s++) { ang += (rr() - 0.5) * 0.5; x += Math.cos(ang) * len / 6; y += Math.sin(ang) * len / 6; pts.push([x, y]); if (s > 1 && rr() < 0.4) lines.push([[x, y], [x + Math.cos(ang + 0.9) * len * 0.22, y + Math.sin(ang + 0.9) * len * 0.22]]) } lines.push(pts) }
    for (const pass of [0, 1]) { cg.lineCap = 'round'; cg.strokeStyle = pass ? 'rgba(244,246,246,.7)' : 'rgba(0,0,0,.42)'; cg.lineWidth = pass ? 1.3 : 3; for (const pts of lines) { cg.beginPath(); pts.forEach(([x, y], i) => { const o = pass ? 0 : 1.2; i ? cg.lineTo(x + o, y + o) : cg.moveTo(x + o, y + o) }); cg.stroke() } }
    for (let r = 1; r <= 3; r++) { cg.strokeStyle = `rgba(240,244,244,${0.34 - r * 0.07})`; cg.lineWidth = 1; cg.beginPath(); for (let i = 0; i <= k.n; i++) { const a = (i / k.n) * 6.283, rad = R * r * 0.16 * (0.8 + ((i * 7) % 3) * 0.14); i ? cg.lineTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad) : cg.moveTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad) } cg.stroke() }
    cg.fillStyle = 'rgba(255,255,255,.55)'; cg.beginPath(); cg.arc(cx, cy, 2.6, 0, 7); cg.fill()
  }
}
// 泥はね: 泥の中を速く走る時とぶつかった時に、画面（フロントガラス）へ茶色いしみがつき、数秒でゆっくり消える
const mudC = $('mud'), mg = mudC.getContext('2d'); let splats = [], mudDrawn = false
function sizeMud() { mudC.width = innerWidth; mudC.height = (window.visualViewport && visualViewport.height) || innerHeight }
function addMud(n = 1, big = 1) { for (let i = 0; i < n && splats.length < 14; i++) splats.push({ x: 0.1 + Math.random() * 0.8, y: 0.18 + Math.random() * 0.55, r: (0.03 + Math.random() * 0.06) * big, t: performance.now(), life: 4500 + Math.random() * 3000, sd: (Math.random() * 1e6 + 1) | 0 }) }
function drawMud(now) {
  if (!splats.length) { if (mudDrawn) { mg.clearRect(0, 0, mudC.width, mudC.height); mudDrawn = false } return }
  mudDrawn = true; mg.clearRect(0, 0, mudC.width, mudC.height); const W = mudC.width, H = mudC.height, sc = Math.min(W, H * 0.8)
  splats = splats.filter(s => now - s.t < s.life)
  for (const s of splats) {
    const k = (now - s.t) / s.life, a = k < 0.55 ? 1 : 1 - (k - 0.55) / 0.45, x = s.x * W, y = s.y * H + k * k * H * 0.12, r = s.r * sc
    let sd = s.sd; const rr = () => { sd = (sd * 16807) % 2147483647; return (sd - 1) / 2147483646 }
    mg.globalAlpha = a * 0.92
    for (let i = 0; i < 7; i++) { const ang = rr() * 6.283, d = rr() * r * 0.8, q = r * (0.35 + rr() * 0.55); const gr = mg.createRadialGradient(x + Math.cos(ang) * d, y + Math.sin(ang) * d, 0, x + Math.cos(ang) * d, y + Math.sin(ang) * d, q); gr.addColorStop(0, 'rgba(46,32,20,0.95)'); gr.addColorStop(0.75, 'rgba(58,40,24,0.85)'); gr.addColorStop(1, 'rgba(58,40,24,0)'); mg.fillStyle = gr; mg.beginPath(); mg.arc(x + Math.cos(ang) * d, y + Math.sin(ang) * d, q, 0, 7); mg.fill() }
    for (let i = 0; i < 9; i++) { const ang = rr() * 6.283, d = r * (0.9 + rr() * 0.9), q = 1.5 + rr() * 4; mg.fillStyle = 'rgba(52,36,22,0.9)'; mg.beginPath(); mg.arc(x + Math.cos(ang) * d, y + Math.sin(ang) * d * 0.8, q, 0, 7); mg.fill() }
  }
  mg.globalAlpha = 1
}
sizeMud()
sizeCrack()
function addCrack(power) {
  if (cracks.length >= 7) cracks.shift()
  const sd = (Math.random() * 1e6 + 1) | 0
  cracks.push({ x: 0.16 + Math.random() * 0.68, y: 0.14 + Math.random() * 0.4, r: Math.min(0.5, 0.15 + power * 0.016), n: 7 + (Math.random() * 5 | 0), seed: sd })
  drawCracks()
}

// ------------------------------------------------------------ 出来事 → 画面の言葉と音
function feed(html, color) {
  const li = document.createElement('li'); li.innerHTML = html; if (color) li.style.setProperty('--tc', hex(color))
  const ul = $('feed'); ul.appendChild(li); while (ul.children.length > 3) ul.removeChild(ul.firstChild)
  setTimeout(() => li.remove(), 5200)
}
function say(text, small, ms = 1100) {
  const m = $('msg'); m.className = small ? 'sm' : ''; m.textContent = text; void m.offsetWidth; m.classList.add('pop'); msgT = performance.now() + ms
}
const nm = c => `<b>${c.name}</b>`
function onEvents() {
  const mc = me()
  for (const e of S.events) {
    stage.onEvent(e, S, mc)
    if (!human) { if (e.k === 'ram') ramSound(e, null); continue }
    const near = mc ? Math.hypot(e.x - mc.x, e.z - mc.z) : 99, att = 1 / (1 + (near / 30) ** 2)
    switch (e.k) {
      case 'go321': say(String(e.n), false, 900); playSnd('tick', { vol: 0.9, rate: e.n === 1 ? 1.7 : 1.4 }); break
      case 'go': say('発進', true, 900); playSnd('horn', { vol: 0.5, rate: 1.0 }); break
      case 'ram': {
        ramSound(e, mc)
        if (mc && (e.a === mc.id || e.b === mc.id)) {
          const mine = e.a === mc.id, zone = mine ? e.za : e.zb
          stage.hitStop = Math.max(stage.hitStop, 0.035 + Math.min(e.power, 20) * 0.0045)
          if (mc.mud > 0.25 || e.power > 16) addMud(2 + (e.power > 12 ? 2 : 0), 1.4)
          if (e.power > 6) { const v = $('vig'); v.classList.add('hit'); setTimeout(() => v.classList.remove('hit'), 70) }
          if (zone === 'f' && e.power > 7 && (mine ? e.da : e.db) > 0) { addCrack(e.power); playSnd('glass', { vol: 0.5 + Math.min(0.4, e.power * 0.02) }) }
        }
        break
      }
      case 'wall': if (e.power > 5) playSnd(e.soft ? 'thud' : 'punch', { vol: Math.min(0.8, e.power * 0.04) * att, rate: 0.8 }); break
      case 'land': playSnd('thud', { vol: Math.min(0.9, e.power * 0.06) * att, rate: 0.7 }); break
      case 'zoneBreak': playSnd('boxbreak', { vol: 0.7 * att }); break
      case 'flip': {
        playSnd('crash', { vol: 0.95 * Math.max(att, 0.3), rate: 0.7 }); playSnd('roll', { vol: 0.8 * att, rate: 0.7 }); playSnd('debris', { vol: 0.7 * att, delay: 0.15 })
        const v = S.cars.find(c => c.id === e.id), by = S.cars.find(c => c.id === e.by)
        feed(by ? `${nm(by)} が ${nm(v)} をひっくり返した` : `${nm(v)} が転んだ`, by ? by.color : v.color)
        if (mc && by === mc) { say('ひっくり返した', true, 1500); $('flipn').hidden = false; $('fn').textContent = mc.flips }
        else if (mc && v === mc) say('ひっくり返された', true, 1800)
        break
      }
      case 'wreck': {
        playSnd('boom', { vol: 0.9 * Math.max(att, 0.35), rate: 0.85 }); playSnd('debris', { vol: 0.6 * att, delay: 0.1 })
        const v = S.cars.find(c => c.id === e.id), by = S.cars.find(c => c.id === e.by)
        feed(by ? `${nm(by)} が ${nm(v)} を潰した` : `${nm(v)} が崩れた地面で潰れた`, by ? by.color : v.color)
        if (mc && by === mc) say('潰した', true, 1300); else if (mc && v === mc) say('潰された', true, 1800)
        break
      }
      case 'out': if (mc && e.id === mc.id) { outAt = performance.now() } break
    }
  }
  S.events.length = 0
}
function ramSound(e, mc) {
  const near = mc ? Math.hypot(e.x - mc.x, e.z - mc.z) : 30, att = 1 / (1 + (near / 30) ** 2), p = e.power
  if (p > 13) { playSnd('crash', { vol: Math.min(1, 0.55 + p * 0.025) * att }); playSnd('punch', { vol: 0.8 * att, delay: 0.02 }) }
  else if (p > 7) { playSnd('hitl', { vol: 0.8 * att }); playSnd('clink', { vol: 0.5 * att, delay: 0.03 }) }
  else playSnd('thud', { vol: 0.5 * att })
  const A = S.cars.find(c => c.id === e.a), B = S.cars.find(c => c.id === e.b)
  if (A && B && ((e.za === 'f' && A.T.bump.id === 'spring') || (e.zb === 'f' && B.T.bump.id === 'spring')) && p > 5) playSnd('spring', { vol: 0.7 * att, delay: 0.03 })
}

// ------------------------------------------------------------ HUD
let boardKey = '', hintT = 0, lastHint = null
const kb = (keys, t) => keys.map(k => `<kbd>${k}</kbd>`).join('') + t
const KEYS = kb(['W'], '進む') + kb(['A', 'D'], 'ハンドル') + kb(['Shift'], 'ニトロ') + kb(['マウス'], '見回す')
const radar = $('radar').getContext('2d')
function drawRadar(cx, cz, yaw) {
  const g = radar, W = 176, R = 88, sc = (R - 4) / 72
  g.clearRect(0, 0, W, W); g.save(); g.beginPath(); g.arc(R, R, R - 2, 0, 7); g.clip()
  g.translate(R, R); g.rotate(yaw + Math.PI); g.scale(sc, sc); g.translate(-cx, -cz)
  g.fillStyle = 'rgba(80,60,40,.9)'; g.beginPath(); g.arc(0, 0, WORLD, 0, 7); g.fill()
  g.fillStyle = 'rgba(40,28,18,.95)'; for (const m of MUDS) { g.beginPath(); g.arc(m.x, m.z, m.r * 0.8, 0, 7); g.fill() }
  g.fillStyle = 'rgba(170,150,120,.9)'; for (const o of POLES) { g.beginPath(); g.arc(o.x, o.z, Math.max(1.6, o.r), 0, 7); g.fill() }
  for (const o of BOXES) g.fillRect(o.x - o.w / 2, o.z - o.d / 2, o.w, o.d)
  g.fillStyle = 'rgba(150,40,14,.45)'; g.beginPath(); g.arc(0, 0, WORLD, 0, 7); g.arc(0, 0, S.safeR, 0, 7, true); g.fill()
  g.strokeStyle = '#e0763a'; g.lineWidth = 2.4; g.beginPath(); g.arc(0, 0, S.safeR, 0, 7); g.stroke()
  for (const c of S.cars) {
    g.save(); g.translate(c.x, c.z); g.rotate(-c.yaw)
    if (!c.alive) { g.fillStyle = 'rgba(20,14,9,.9)'; g.fillRect(-2.5, -2.5, 5, 5) }
    else { g.fillStyle = c.human ? '#fff1d8' : '#e0763a'; g.strokeStyle = 'rgba(10,6,3,.85)'; g.lineWidth = 1; const s = c.human ? 1.25 : 1; g.beginPath(); g.moveTo(0, 5.5 * s); g.lineTo(3.6 * s, -3.6 * s); g.lineTo(-3.6 * s, -3.6 * s); g.closePath(); g.fill(); g.stroke() }
    g.restore()
  }
  g.restore()
}
const marks = []
const _v = new THREE.Vector3()
function mark(i) { if (marks[i]) return marks[i]; const d = document.createElement('div'); d.className = 'mk'; $('marks').appendChild(d); return marks[i] = d }
function updateMarks(mc) {
  let n = 0; const W = innerWidth, Hh = (window.visualViewport && visualViewport.height) || innerHeight
  for (const c of S.cars) {
    if (!c.alive || c === mc) continue
    const d = Math.hypot(c.x - mc.x, c.z - mc.z); if (d > 70) continue
    _v.set(c.x, c.y + 4.4, c.z).project(stage.cam)
    let sx = (_v.x * 0.5 + 0.5) * W, sy = (-_v.y * 0.5 + 0.5) * Hh, edge = false
    const cx = W / 2, cy = Hh / 2
    if (_v.z > 1) { sx = W - sx; sy = Hh - sy; edge = true }
    const rdx = sx - cx, rdy = sy - cy, mx = 26, top = 110, bot = touchy ? 250 : 80
    if (edge || sx < mx || sx > W - mx || sy < top || sy > Hh - bot) { edge = true; const k = Math.min((W / 2 - mx) / Math.max(1, Math.abs(rdx)), (Hh / 2 - top) / Math.max(1, Math.abs(rdy)), 1e3); sx = cx + rdx * k; sy = Math.min(cy + rdy * k, Hh - bot) }
    const m = mark(n++); m.style.display = ''; m.classList.toggle('edge', edge); m.style.setProperty('--ang', (Math.atan2(rdy, rdx) - Math.PI / 2) + 'rad'); m.style.transform = `translate(${sx - 17}px,${sy - 13}px)`
  }
  for (let i = n; i < marks.length; i++) marks[i].style.display = 'none'
}
const zcol = v => v > 70 ? '#d9c7a4' : v > 40 ? '#d9a23a' : v > 15 ? '#e0762a' : '#d03a22'
let dmgKey = ''
function updateHUD(dt) {
  const c = me(); if (!c) return
  const alive = S.cars.filter(q => q.alive).length
  $('cn').textContent = alive
  $('kmh').textContent = Math.round(c.speedKmh)
  const nv = Math.round(c.nitro * 100); $('nRing').style.setProperty('--n', nv); const nb = $('bNitro'); nb.classList.toggle('full', c.nitro >= 0.99); nb.classList.toggle('empty', c.nitro < 0.03)
  const dk = ['f', 'l', 'r', 'b'].map(k => zcol(c.zone[k])).join(); if (dk !== dmgKey) { dmgKey = dk; const d = $('dmg').style; ['f', 'l', 'r', 'b'].forEach(k => d.setProperty('--z' + k, zcol(c.zone[k]))) }
  // 外へ出たら赤く縁取る
  const out = Math.hypot(c.x, c.z) > S.safeR && c.alive; $('vig').classList.toggle('out', out)
  if (out && performance.now() - ringMsgAt > 9000 && S.phase === 'play') { ringMsgAt = performance.now(); say('崩れている。戻れ', true, 1500) }
  if (!shrinkSaid && S.tMatch >= GRACE && S.phase === 'play') { shrinkSaid = true; feed('場内が狭くなっていく', 0xe0763a) }
  let hint = ''
  if (S.phase === 'play' && S.tMatch < 14 && c.alive) hint = touchy ? 'ぶつけるとニトロが溜まる' : KEYS
  if (hint !== lastHint) { lastHint = hint; $('hint').innerHTML = hint }
  if (msgT && performance.now() > msgT) { $('msg').textContent = ''; $('msg').className = ''; msgT = 0 }
}
// 疾走感: ニトロの時だけ画面の縁を流れる線
const windC = $('wind'), wg = windC.getContext('2d')
function sizeWind() { windC.width = innerWidth; windC.height = (window.visualViewport && visualViewport.height) || innerHeight }
sizeWind()
let windOn = false
function drawWind(k, boost, on) {
  const need = on && (boost || k > 0.9)
  if (!need) { if (windOn) { wg.clearRect(0, 0, windC.width, windC.height); windOn = false } return }
  windOn = true
  const W = windC.width, Hh = windC.height, cx = W / 2, cy = Hh * 0.46, R = Math.hypot(W, Hh) / 2
  wg.clearRect(0, 0, W, Hh)
  const kk = (boost ? 1 : 0.4), n = Math.round(10 + kk * 24)
  wg.lineCap = 'round'
  for (let i = 0; i < n; i++) {
    const a = Math.random() * 6.283, r0 = R * (0.5 + Math.random() * 0.4), len = R * (0.05 + Math.random() * 0.14) * (0.6 + kk), x0 = cx + Math.cos(a) * r0, y0 = cy + Math.sin(a) * r0 * 0.9
    wg.strokeStyle = `rgba(255,230,190,${0.06 + Math.random() * 0.15 * kk})`; wg.lineWidth = 1 + Math.random() * 2
    wg.beginPath(); wg.moveTo(x0, y0); wg.lineTo(x0 + Math.cos(a) * len, y0 + Math.sin(a) * len * 0.9); wg.stroke()
  }
  if (boost) { const g2 = wg.createRadialGradient(cx, cy, R * 0.45, cx, cy, R); g2.addColorStop(0, 'rgba(255,150,40,0)'); g2.addColorStop(1, 'rgba(255,120,20,0.26)'); wg.fillStyle = g2; wg.fillRect(0, 0, W, Hh) }
}

// ------------------------------------------------------------ メインループ
const FOCUS = { x: 0, z: 0 }
function frame(now) {
  requestAnimationFrame(frame)
  if (window.__mcPause || paused) { last = now; return }
  let dt = Math.min(0.05, (now - last) / 1000); last = now
  if (phase === 'prep') {
    stage.updateCamera(S, { mode: 'prep' }, dt, 1); stage.pDust.update(dt); stage.render(); window.__mcFrames = (window.__mcFrames || 0) + 1; return
  }
  if (stage.hitStop > 0) { stage.hitStop -= dt; dt *= 0.12 }
  if (S.endAt && !S.over) dt *= 0.45                           // 最後の1台が決まる所はゆっくり
  acc += dt * simSpeed
  let n = 0
  while (acc >= DT && n < 24) {
    const hin = human && phase === 'play' && !K.auto ? readHuman() : null
    step(S, makeInputs(S, DT, hin), DT); onEvents(); acc -= DT; n++
  }
  if (n === 24) acc = 0
  const alpha = Math.min(1, acc / DT), mc = me()
  let cv
  if (!human || !mc) cv = { mode: 'orbit' }
  else if (mc.alive || performance.now() - outAt < 1500) { if (performance.now() - lookAt > 700) lookOff *= Math.exp(-3.5 * dt); cv = { mode: 'drive', car: mc, snap: snapCam, look: mc.alive ? lookOff : 0 } }
  else {
    const by = S.cars.find(q => q.id === mc.outBy && q.alive), tgt = by || S.cars.filter(q => q.alive).sort((a, b) => b.hp - a.hp)[0]
    cv = tgt ? { mode: 'spec', car: tgt, snap: false } : { mode: 'orbit' }
  }
  stage.updateCamera(S, cv, dt, alpha); snapCam = false
  if (window.__mcCam) { stage.cam.position.set(...window.__mcCam.p); stage.cam.lookAt(...window.__mcCam.l); stage.cam.fov = window.__mcCam.fov || 60; stage.cam.updateProjectionMatrix() }
  stage.sync(S, alpha, dt, { focus: mc || FOCUS, me: mc, mine: true })
  if (phase === 'play' && mc) {
    updateHUD(dt)
    const hostCar = cv.mode === 'spec' ? cv.car : mc
    drawRadar(hostCar.x, hostCar.z, stage.camYaw)
    if (mc.alive && cv.mode === 'drive') updateMarks(mc); else for (const m of marks) m.style.display = 'none'
    engine.update(S, dt, cv.mode === 'spec' ? cv.car : mc, stage.camYaw, muted, S.phase === 'play' && !S.over)
    if (mc.alive) {
      if (mc.boosting && !wasBoost) playSnd('whoosh', { vol: 0.7, rate: 0.85 }); wasBoost = mc.boosting
      mudT -= dt; const sp = Math.hypot(mc.vx, mc.vz)
      if (mc.mud > 0.4 && sp > 5 && mudT <= 0) { mudT = 0.5 + Math.random() * 0.3; playSnd('plop', { vol: Math.min(0.5, sp * 0.03), rate: 0.6 + Math.random() * 0.3 }) }
      if (mc.mud > 0.45 && sp > 8 && Math.random() < dt * 2.2) addMud(1, 1)
      $('bNitro').classList.toggle('on', mc.boosting)
    }
    drawWind(0, !!mc.boosting, mc.alive); drawMud(performance.now())
    // 終わり: 自分が潰れて少したったら / 試合が決まったら
    if (!mc.alive && !shownResult && !resultAt) resultAt = S.t + (mc.outHow === 'flip' ? 2.8 : 2.4)
    if (S.over && !shownResult && !resultAt) resultAt = S.t + 1.2
    if (resultAt && S.t >= resultAt && !shownResult) showResult(S.over ? S.ranking.indexOf(mc.id) + 1 : S.cars.filter(q => q.alive).length + 1)
  } else drawWind(0, false, false)
  if (phase === 'title' && S.over && S.overT > 4) { S = createState(seedBase + (++matchNo) * 31, { noCountdown: true }); stage.clearDynamic() }
  if (Q.get('norender') !== '1') stage.render()
  window.__mcFrames = (window.__mcFrames || 0) + 1
}

// ------------------------------------------------------------ 読み込み
async function boot() {
  $('loadbar').style.width = '20%'
  await loadAssets(() => { $('loadbar').style.width = '45%' }); stage.buildProps()
  $('loadbar').style.width = '60%'
  await Promise.race([Snd.prefetch(['snd/music.mp3']), new Promise(r => setTimeout(r, 5000))])
  $('loadbar').style.width = '100%'
  await new Promise(r => setTimeout(r, 160))
  $('loading').classList.add('off'); setTimeout(() => $('loading').remove(), 600)
  $('title').hidden = false
  window.__mc = { THREE, S: () => S, stage, K, startMatch, toPrep, toTitle, phase: () => phase, lo: () => lo, setLo: v => { Object.assign(lo, v) }, setSpeed: v => { simSpeed = v }, me, advance: n => { for (let i = 0; i < n; i++) { step(S, makeInputs(S, DT, human && !K.auto ? readHuman() : null), DT); onEvents() } }, showResult, addCrack, addMud, say, sound: () => ({ played: Snd.played, level: Snd.level() }), hud: () => ({ marks: marks.length, cracks: cracks.length }), setLook: v => { lookOff = v; lookAt = performance.now() } }
  window.__mcReady = true
  if (Q.get('start')) { if (Q.get('start') === 'prep') toPrep(); else startMatch() }
  requestAnimationFrame(t => { last = t; frame(t) })
}
window.__jsUp = true
boot().catch(e => { const el = $('err'); if (el) el.textContent = String(e && e.stack || e); throw e })
