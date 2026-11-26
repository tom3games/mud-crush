// 絵はすべてその場で描く（画像ファイルなし）。採石場の土・泥・岩肌・空
import * as THREE from 'three'
import { WORLD, MUDS, MOUNDS } from './arena.js?v=1'

function rnd(seed) { let a = seed; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 } }
function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')] }
function tex(c, srgb = true, aniso = 8, wrap = true) {
  const t = new THREE.CanvasTexture(c)
  if (wrap) t.wrapS = t.wrapT = THREE.RepeatWrapping
  if (srgb) t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = aniso; return t
}
// 1m = px 画素ぶんの世界座標の変換
const W2 = WORLD + 10
// 地面（世界を1枚で）: 乾いた土・轍・小石・泥のくぼみ。同じ寸法の粗さの絵（泥は濡れて光る）も返す
export function groundTextures(size = 2048, aniso = 8) {
  const [c, g] = canvas(size, size), [rc, rg] = canvas(size, size), R = rnd(77)
  const k = size / (W2 * 2), P = (x, z) => [(x + W2) * k, (z + W2) * k]
  g.fillStyle = '#7a5a3b'; g.fillRect(0, 0, size, size); rg.fillStyle = '#e8e8e8'; rg.fillRect(0, 0, size, size)
  // 土の大きなむら
  for (let i = 0; i < 2600; i++) { const x = R() * size, y = R() * size, r = 8 + R() * 70, v = R(); g.fillStyle = `rgba(${v < 0.5 ? '98,70,44' : '138,104,68'},${0.05 + R() * 0.1})`; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill() }
  // 乾いた明るい土のたまり
  for (let i = 0; i < 180; i++) { const x = R() * size, y = R() * size, r = 20 + R() * 90; g.fillStyle = `rgba(176,140,98,${0.05 + R() * 0.07})`; g.beginPath(); g.ellipse(x, y, r, r * (0.5 + R() * 0.5), R() * 3, 0, 7); g.fill() }
  // 小石
  for (let i = 0; i < 9000; i++) { const x = R() * size, y = R() * size, r = 0.6 + R() * 2.2, v = 70 + R() * 90; g.fillStyle = `rgba(${v},${v * 0.86},${v * 0.7},${0.35 + R() * 0.4})`; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill() }
  // 轍: 外周の大きな輪と、真ん中へ向かう筋
  g.lineCap = 'round'
  for (let i = 0; i < 26; i++) {
    const r0 = 14 + R() * 60, a0 = R() * 6.28, span = 0.8 + R() * 2.4, wd = 0.45 + R() * 0.35
    for (const off of [-1.15, 1.15]) {
      g.strokeStyle = `rgba(52,36,24,${0.28 + R() * 0.2})`; g.lineWidth = wd * k; g.beginPath()
      for (let s = 0; s <= 24; s++) { const a = a0 + span * s / 24, rr = r0 + off + Math.sin(a * 3 + i) * 0.8; const [x, y] = P(Math.sin(a) * rr, Math.cos(a) * rr); s ? g.lineTo(x, y) : g.moveTo(x, y) }
      g.stroke()
    }
  }
  for (let i = 0; i < 30; i++) {
    const a = R() * 6.28, r0 = 8 + R() * 30, r1 = r0 + 14 + R() * 40
    for (const off of [-1.15, 1.15]) { g.strokeStyle = `rgba(48,34,22,${0.25 + R() * 0.2})`; g.lineWidth = 0.5 * k; g.beginPath(); const [x0, y0] = P(Math.sin(a) * r0 + Math.cos(a) * off, Math.cos(a) * r0 - Math.sin(a) * off), [x1, y1] = P(Math.sin(a + 0.05) * r1 + Math.cos(a) * off, Math.cos(a + 0.05) * r1 - Math.sin(a) * off); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke() }
  }
  // 小山のてっぺんは乾いて明るい
  for (const m of MOUNDS) { const [x, y] = P(m.x, m.z); const gr = g.createRadialGradient(x, y, 0, x, y, m.r * k); gr.addColorStop(0, 'rgba(190,150,104,0.35)'); gr.addColorStop(1, 'rgba(190,150,104,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, m.r * k, 0, 7); g.fill() }
  // 泥: 暗く湿った色。ふちはまだらに広がり、濡れて光る（粗さを下げる）
  for (const m of MUDS) {
    const [x, y] = P(m.x, m.z)
    for (let i = 0; i < 70; i++) {
      const a = R() * 6.28, d = Math.sqrt(R()) * m.r * 0.92, px = x + Math.sin(a) * d * k, py = y + Math.cos(a) * d * k, r = (1.2 + R() * 4.2) * k, f = 1 - d / m.r
      g.fillStyle = `rgba(${34 + R() * 12},${24 + R() * 8},${16},${0.35 + f * 0.5})`; g.beginPath(); g.arc(px, py, r, 0, 7); g.fill()
      rg.fillStyle = `rgba(30,30,30,${0.4 + f * 0.5})`; g.globalAlpha = 1; rg.beginPath(); rg.arc(px, py, r, 0, 7); rg.fill()
    }
    const gr = g.createRadialGradient(x, y, 0, x, y, m.r * k * 0.8); gr.addColorStop(0, 'rgba(30,20,13,0.82)'); gr.addColorStop(0.7, 'rgba(36,25,16,0.5)'); gr.addColorStop(1, 'rgba(36,25,16,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, m.r * k * 0.8, 0, 7); g.fill()
    const gr2 = rg.createRadialGradient(x, y, 0, x, y, m.r * k * 0.8); gr2.addColorStop(0, 'rgba(26,26,26,0.95)'); gr2.addColorStop(0.7, 'rgba(60,60,60,0.7)'); gr2.addColorStop(1, 'rgba(60,60,60,0)'); rg.fillStyle = gr2; rg.beginPath(); rg.arc(x, y, m.r * k * 0.8, 0, 7); rg.fill()
    // 泥の中の水たまり（空を映す）
    for (let i = 0; i < 6; i++) { const a = R() * 6.28, d = R() * m.r * 0.55, px = x + Math.sin(a) * d * k, py = y + Math.cos(a) * d * k, r = (0.8 + R() * 2.2) * k; rg.fillStyle = 'rgba(8,8,8,0.9)'; rg.beginPath(); rg.ellipse(px, py, r, r * 0.6, R() * 3, 0, 7); rg.fill(); g.fillStyle = 'rgba(70,56,44,0.55)'; g.beginPath(); g.ellipse(px, py, r, r * 0.6, R() * 3, 0, 7); g.fill() }
  }
  return { map: tex(c, true, aniso, false), rough: tex(rc, false, aniso, false) }
}
// 細かい土の粒（床に細かく何度も重ねて、近づいても粗く見えないようにする）
export function detailTexture(aniso = 8) {
  const [c, g] = canvas(256, 256), R = rnd(9)
  g.fillStyle = '#808080'; g.fillRect(0, 0, 256, 256)
  for (let i = 0; i < 1800; i++) { const v = 90 + R() * 90; g.fillStyle = `rgba(${v},${v},${v},${0.18 + R() * 0.3})`; g.beginPath(); g.arc(R() * 256, R() * 256, 0.6 + R() * 2.4, 0, 7); g.fill() }
  for (let i = 0; i < 90; i++) { g.strokeStyle = `rgba(60,60,60,${0.12 + R() * 0.12})`; g.lineWidth = 0.7; g.beginPath(); const x = R() * 256, y = R() * 256; g.moveTo(x, y); g.lineTo(x + (R() - 0.5) * 26, y + (R() - 0.5) * 26); g.stroke() }
  return tex(c, false, aniso)
}
// 外の岩壁: 横の地層の帯・縦のひび・石灰の白い筋
export function rockTexture(aniso = 8) {
  const [c, g] = canvas(1024, 1024), R = rnd(31)
  g.fillStyle = '#9a7650'; g.fillRect(0, 0, 1024, 1024)
  let y = 0
  while (y < 1024) { const h = 18 + R() * 70, v = R(); g.fillStyle = v < 0.3 ? `rgba(206,176,132,${0.35 + R() * 0.3})` : v < 0.7 ? `rgba(120,86,56,${0.3 + R() * 0.35})` : `rgba(92,66,44,${0.25 + R() * 0.3})`; g.fillRect(0, y, 1024, h); y += h }
  for (let i = 0; i < 520; i++) { const x = R() * 1024, y0 = R() * 1024, l = 20 + R() * 130; g.strokeStyle = `rgba(36,26,18,${0.18 + R() * 0.3})`; g.lineWidth = 1 + R() * 2.4; g.beginPath(); g.moveTo(x, y0); g.lineTo(x + (R() - 0.5) * 22, y0 + l); g.stroke() }
  for (let i = 0; i < 360; i++) { const x = R() * 1024, y0 = R() * 1024; g.fillStyle = `rgba(${R() < 0.5 ? '210,196,170' : '60,44,30'},${0.12 + R() * 0.2})`; g.beginPath(); g.ellipse(x, y0, 6 + R() * 30, 2 + R() * 6, 0, 0, 7); g.fill() }
  // 下は土ぼこりで霞む
  const gr = g.createLinearGradient(0, 760, 0, 1024); gr.addColorStop(0, 'rgba(150,118,84,0)'); gr.addColorStop(1, 'rgba(150,118,84,0.65)'); g.fillStyle = gr; g.fillRect(0, 760, 1024, 264)
  const t = tex(c, true, aniso); t.repeat.set(7, 1); return t
}
// 空: 夕方の土ぼこりで黄ばんだ空と、低い太陽
export function skyTexture() {
  const [c, g] = canvas(1024, 512)
  const gr = g.createLinearGradient(0, 0, 0, 512); gr.addColorStop(0, '#5c7592'); gr.addColorStop(0.45, '#c9a77c'); gr.addColorStop(0.52, '#e0b27a'); gr.addColorStop(1, '#9b7a55'); g.fillStyle = gr; g.fillRect(0, 0, 1024, 512)
  const sg = g.createRadialGradient(300, 250, 4, 300, 250, 160); sg.addColorStop(0, 'rgba(255,248,226,1)'); sg.addColorStop(0.1, 'rgba(255,224,160,0.95)'); sg.addColorStop(1, 'rgba(255,190,110,0)'); g.fillStyle = sg; g.fillRect(0, 0, 1024, 512)
  const R = rnd(4); for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(255,236,210,${0.04 + R() * 0.07})`; g.beginPath(); g.ellipse(R() * 1024, 80 + R() * 170, 60 + R() * 150, 6 + R() * 16, 0, 0, 7); g.fill() }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t
}
export function splatTexture() {   // 泥のはねあと
  const [c, g] = canvas(128, 128), R = rnd(3)
  for (let i = 0; i < 26; i++) { const a = R() * 6.28, d = R() * 40, r = 3 + R() * 16 * (1 - d / 60); g.fillStyle = `rgba(255,255,255,${0.5 + R() * 0.5})`; g.beginPath(); g.arc(64 + Math.cos(a) * d, 64 + Math.sin(a) * d, r, 0, 7); g.fill() }
  const t = new THREE.CanvasTexture(c); return t
}
export function trackTexture() {   // タイヤのあと（横に長い）
  const [c, g] = canvas(128, 32)
  const gr = g.createLinearGradient(0, 0, 128, 0); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.2, 'rgba(255,255,255,1)'); gr.addColorStop(0.8, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 4, 128, 24)
  for (let x = 6; x < 128; x += 9) { g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(x, 4, 3, 24) }
  const t = new THREE.CanvasTexture(c); return t
}
export function glowTexture() {
  const [c, g] = canvas(64, 64)
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64)
  return new THREE.CanvasTexture(c)
}
// 車体の横の番号（白のステンシル）
export function numberTexture(n, bg) {
  const [c, g] = canvas(128, 128)
  g.fillStyle = bg; g.fillRect(0, 0, 128, 128)
  g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, 100, 128, 28)
  g.fillStyle = '#efe6d2'; g.font = '900 92px "Big Shoulders Display", Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(n), 64, 62)
  g.globalCompositeOperation = 'destination-out'
  const R = rnd(n * 13 + 1); for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(0,0,0,${0.15 + R() * 0.5})`; g.fillRect(R() * 128, R() * 128, 1 + R() * 3, 1 + R() * 3) }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t
}
// 黄黒の注意の帯（排土板の縁）
export function hazardTexture() {
  const [c, g] = canvas(128, 32)
  g.fillStyle = '#c9a233'; g.fillRect(0, 0, 128, 32); g.fillStyle = '#1d1b18'
  for (let x = -32; x < 160; x += 32) { g.beginPath(); g.moveTo(x, 32); g.lineTo(x + 16, 32); g.lineTo(x + 32, 0); g.lineTo(x + 16, 0); g.fill() }
  const R = rnd(8); for (let i = 0; i < 100; i++) { g.fillStyle = `rgba(60,36,18,${0.1 + R() * 0.4})`; g.fillRect(R() * 128, R() * 32, 2 + R() * 6, 1 + R() * 3) }
  const t = tex(c, true, 4); return t
}

// 車体の汚れ: 泥はね・擦り傷・錆びのしみ（色に掛け算で重ねる）
export function grungeTexture() {
  const [c, g] = canvas(256, 256), R = rnd(51)
  g.fillStyle = '#f2ece2'; g.fillRect(0, 0, 256, 256)
  for (let i = 0; i < 60; i++) { const x = R() * 256, y = R() * 256, w = 3 + R() * 18, h = 20 + R() * 120; const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, 'rgba(70,46,28,0)'); gr.addColorStop(1, `rgba(70,46,28,${0.1 + R() * 0.25})`); g.fillStyle = gr; g.fillRect(x, y, w, h) }
  const bg = g.createLinearGradient(0, 160, 0, 256); bg.addColorStop(0, 'rgba(60,40,24,0)'); bg.addColorStop(1, 'rgba(60,40,24,0.55)'); g.fillStyle = bg; g.fillRect(0, 160, 256, 96)
  for (let i = 0; i < 90; i++) { g.strokeStyle = `rgba(250,244,230,${0.15 + R() * 0.3})`; g.lineWidth = 0.7; g.beginPath(); const x = R() * 256, y = R() * 256; g.moveTo(x, y); g.lineTo(x + (R() - 0.5) * 40, y + (R() - 0.5) * 12); g.stroke() }
  for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(120,60,24,${0.12 + R() * 0.25})`; g.beginPath(); g.ellipse(R() * 256, R() * 256, 2 + R() * 9, 1 + R() * 5, R() * 3, 0, 7); g.fill() }
  for (let i = 0; i < 700; i++) { g.fillStyle = `rgba(50,34,20,${0.2 + R() * 0.4})`; g.fillRect(R() * 256, R() * 256, 1 + R() * 2, 1 + R() * 2) }
  const t = tex(c, true, 4); return t
}
