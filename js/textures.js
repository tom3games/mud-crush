// 絵はすべてその場で描く（画像ファイルなし）。採石場の土・泥・岩肌・空
import * as THREE from 'three'
import { WORLD, MUDS, MOUNDS } from './arena.js?v=7'

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
  const [c, g] = canvas(size, size), [rc, rg] = canvas(size, size), [bc, bg] = canvas(size, size), R = rnd(77)
  const k = size / (W2 * 2), P = (x, z) => [(x + W2) * k, (z + W2) * k]
  g.fillStyle = '#6c4e32'; g.fillRect(0, 0, size, size); rg.fillStyle = '#e8e8e8'; rg.fillRect(0, 0, size, size); bg.fillStyle = '#808080'; bg.fillRect(0, 0, size, size)
  for (let i = 0; i < 14000; i++) { const x = R() * size, y = R() * size, r = 0.5 + R() * 1.8, v = 150 + R() * 100; bg.fillStyle = `rgba(${v},${v},${v},${0.5 + R() * 0.4})`; bg.beginPath(); bg.arc(x, y, r, 0, 7); bg.fill() }   // 小石
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
      g.strokeStyle = `rgba(52,36,24,${0.2 + R() * 0.16})`; g.lineWidth = wd * k; g.beginPath()
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
      rg.fillStyle = `rgba(185,185,185,${0.4 + f * 0.5})`; g.globalAlpha = 1; rg.beginPath(); rg.arc(px, py, r, 0, 7); rg.fill()
    }
    const gr = g.createRadialGradient(x, y, 0, x, y, m.r * k * 0.8); gr.addColorStop(0, 'rgba(30,20,13,0.82)'); gr.addColorStop(0.7, 'rgba(36,25,16,0.5)'); gr.addColorStop(1, 'rgba(36,25,16,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, m.r * k * 0.8, 0, 7); g.fill()
    const gr2 = rg.createRadialGradient(x, y, 0, x, y, m.r * k * 0.8); gr2.addColorStop(0, 'rgba(178,178,178,0.95)'); gr2.addColorStop(0.7, 'rgba(195,195,195,0.7)'); gr2.addColorStop(1, 'rgba(120,120,120,0)'); rg.fillStyle = gr2; rg.beginPath(); rg.arc(x, y, m.r * k * 0.8, 0, 7); rg.fill()
    // 縁の盛り上がり（押し出された泥）・わだち・泥の塊・縁の小石（高さの絵と色の両方）
    { const rr0 = m.r * 0.95 * k
      bg.save(); const hg = bg.createRadialGradient(x, y, rr0 * 0.2, x, y, rr0 * 1.1); hg.addColorStop(0, 'rgba(88,88,88,0.85)'); hg.addColorStop(0.78, 'rgba(128,128,128,0.4)'); hg.addColorStop(0.93, 'rgba(235,235,235,0.9)'); hg.addColorStop(1, 'rgba(128,128,128,0)'); bg.fillStyle = hg; bg.beginPath(); bg.arc(x, y, rr0 * 1.12, 0, 7); bg.fill(); bg.restore()
      g.save(); g.strokeStyle = 'rgba(40,28,18,0.5)'; g.lineWidth = m.r * 0.08 * k; g.beginPath(); g.arc(x, y, rr0, 0, 7); g.stroke(); g.strokeStyle = 'rgba(120,92,62,0.35)'; g.lineWidth = m.r * 0.03 * k; g.beginPath(); g.arc(x, y, rr0 * 1.045, 0, 7); g.stroke(); g.restore()
      for (let i = 0; i < 7; i++) {   // わだち: 泥の中を横切る二本の溝
        const a0 = R() * 6.28, cx0 = x + Math.sin(a0) * rr0 * 0.2, cy0 = y + Math.cos(a0) * rr0 * 0.2, ang = R() * 6.28, len = rr0 * (1.1 + R() * 0.7), bend = (R() - 0.5) * 0.9
        for (const off of [-1.15, 1.15]) for (const [ctx2, col2, lw] of [[g, 'rgba(24,16,10,0.75)', 0.9], [bg, 'rgba(40,40,40,0.95)', 0.9], [rg, 'rgba(120,120,120,0.9)', 0.9]]) {
          ctx2.strokeStyle = col2; ctx2.lineWidth = lw * k; ctx2.lineCap = 'round'; ctx2.beginPath()
          for (let s = 0; s <= 16; s++) { const f = s / 16 - 0.5, aa = ang + f * bend, px = cx0 + Math.sin(aa) * f * len + Math.cos(aa) * off * k, py = cy0 + Math.cos(aa) * f * len - Math.sin(aa) * off * k; s ? ctx2.lineTo(px, py) : ctx2.moveTo(px, py) }
          ctx2.stroke()
        }
        bg.strokeStyle = 'rgba(210,210,210,0.6)'; bg.lineWidth = 0.45 * k; bg.beginPath()
        for (let s = 0; s <= 16; s++) { const f = s / 16 - 0.5, aa = ang + f * bend, px = cx0 + Math.sin(aa) * f * len + Math.cos(aa) * 1.9 * k, py = cy0 + Math.cos(aa) * f * len - Math.sin(aa) * 1.9 * k; s ? bg.lineTo(px, py) : bg.moveTo(px, py) } bg.stroke()
      }
      for (let i = 0; i < 160; i++) { const a = R() * 6.28, d = (0.15 + R() * 0.85) * rr0, px = x + Math.sin(a) * d, py = y + Math.cos(a) * d, r = (0.15 + R() * 0.5) * k; const q = bg.createRadialGradient(px, py, 0, px, py, r); q.addColorStop(0, 'rgba(255,255,255,0.9)'); q.addColorStop(1, 'rgba(255,255,255,0)'); bg.fillStyle = q; bg.beginPath(); bg.arc(px, py, r, 0, 7); bg.fill() }   // 泥の塊
      for (let i = 0; i < 90; i++) { const a = R() * 6.28, d = rr0 * (0.92 + R() * 0.22), px = x + Math.sin(a) * d, py = y + Math.cos(a) * d, r = (0.08 + R() * 0.2) * k, v = 70 + R() * 50; g.fillStyle = `rgb(${v},${v * 0.82},${v * 0.64})`; g.beginPath(); g.arc(px, py, r, 0, 7); g.fill(); bg.fillStyle = 'rgba(255,255,255,0.95)'; bg.beginPath(); bg.arc(px, py, r, 0, 7); bg.fill() }   // 縁の小石
    }
    // 泥の中の水たまり（空を映す）
    for (let i = 0; i < 6; i++) { const a = R() * 6.28, d = R() * m.r * 0.55, px = x + Math.sin(a) * d * k, py = y + Math.cos(a) * d * k, r = (0.8 + R() * 2.2) * k; rg.fillStyle = 'rgba(150,150,150,0.9)'; rg.beginPath(); rg.ellipse(px, py, r, r * 0.6, R() * 3, 0, 7); rg.fill(); { const ro = R() * 3; g.strokeStyle = 'rgba(28,20,13,0.85)'; g.lineWidth = 0.18 * k; g.fillStyle = 'rgba(78,62,48,0.6)'; g.beginPath(); g.ellipse(px, py, r, r * 0.6, ro, 0, 7); g.fill(); g.stroke(); bg.fillStyle = 'rgba(60,60,60,0.9)'; bg.beginPath(); bg.ellipse(px, py, r, r * 0.6, ro, 0, 7); bg.fill() } }
  }
  return { map: tex(c, true, aniso, false), rough: tex(rc, false, aniso, false), bump: tex(bc, false, aniso, false) }
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
  const [c, g] = canvas(1024, 512), R = rnd(4)
  const gr = g.createLinearGradient(0, 0, 0, 512); gr.addColorStop(0, '#3d5d86'); gr.addColorStop(0.22, '#6f86a0'); gr.addColorStop(0.38, '#c2a47c'); gr.addColorStop(0.47, '#d9b184'); gr.addColorStop(0.5, '#c9a67c'); gr.addColorStop(1, '#8a6a48'); g.fillStyle = gr; g.fillRect(0, 0, 1024, 512)
  // 薄い雲の筋と、土ぼこりの層
  for (let i = 0; i < 70; i++) { const y = 40 + R() * 190, w = 80 + R() * 260, x0 = R() * 1024, al = 0.05 + R() * 0.1; for (const o of [-1024, 0, 1024]) { g.save(); g.translate(x0 + o, y); g.scale(w / 8, 1); const gg = g.createRadialGradient(0, 0, 0, 0, 0, 8); gg.addColorStop(0, `rgba(255,226,190,${al})`); gg.addColorStop(1, 'rgba(255,226,190,0)'); g.fillStyle = gg; g.beginPath(); g.arc(0, 0, 8, 0, 7); g.fill(); g.restore() } }   // 雲の筋（端が柔らかい楕円。縁が縦の線に見えないように）
  const hz = g.createLinearGradient(0, 150, 0, 262); hz.addColorStop(0, 'rgba(214,170,120,0)'); hz.addColorStop(1, 'rgba(226,176,120,0.65)'); g.fillStyle = hz; g.fillRect(0, 150, 1024, 112)
  // 低い太陽（光の向きに合わせた位置）。まわりは黄ばんだ光のにじみ
  const sg = g.createRadialGradient(512, 193, 3, 512, 193, 220); sg.addColorStop(0, 'rgba(255,250,232,1)'); sg.addColorStop(0.035, 'rgba(255,238,190,0.98)'); sg.addColorStop(0.12, 'rgba(255,210,140,0.55)'); sg.addColorStop(1, 'rgba(255,170,90,0)'); g.fillStyle = sg; g.fillRect(0, 0, 1024, 512)
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
  const [c, g] = canvas(512, 512), R = rnd(51)
  g.scale(2, 2)
  g.fillStyle = '#f2ece2'; g.fillRect(0, 0, 256, 256)
  for (let i = 0; i < 60; i++) { const x = R() * 256, y = R() * 256, w = 3 + R() * 18, h = 20 + R() * 120; const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, 'rgba(70,46,28,0)'); gr.addColorStop(1, `rgba(70,46,28,${0.06 + R() * 0.14})`); g.fillStyle = gr; g.fillRect(x, y, w, h) }
  const bg = g.createLinearGradient(0, 160, 0, 256); bg.addColorStop(0, 'rgba(60,40,24,0)'); bg.addColorStop(1, 'rgba(60,40,24,0.55)'); g.fillStyle = bg; g.fillRect(0, 160, 256, 96)
  for (let i = 0; i < 90; i++) { g.strokeStyle = `rgba(250,244,230,${0.15 + R() * 0.3})`; g.lineWidth = 0.7; g.beginPath(); const x = R() * 256, y = R() * 256; g.moveTo(x, y); g.lineTo(x + (R() - 0.5) * 40, y + (R() - 0.5) * 12); g.stroke() }
  for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(120,60,24,${0.12 + R() * 0.25})`; g.beginPath(); g.ellipse(R() * 256, R() * 256, 2 + R() * 9, 1 + R() * 5, R() * 3, 0, 7); g.fill() }
  for (let i = 0; i < 700; i++) { g.fillStyle = `rgba(50,34,20,${0.2 + R() * 0.4})`; g.fillRect(R() * 256, R() * 256, 1 + R() * 2, 1 + R() * 2) }
  const t = tex(c, true, 4); return t
}
// 排土板の塗装: 黄橙の塗装が剥げて地金と錆が出る。溶接の筋・擦り傷・泥のこびりつき。bump は剥げた所を凹ませる高さの絵
export function wornPaintTexture(kind = 'flat') {
  const S = 512, [c, g] = canvas(S, S), [bc, bg] = canvas(S, S), R = rnd(kind === 'edge' ? 63 : 61)
  g.fillStyle = '#c4801e'; g.fillRect(0, 0, S, S); bg.fillStyle = '#9a9a9a'; bg.fillRect(0, 0, S, S)
  // 塗装の色むらとつや・ほこり（平らな面はこれを残す）
  for (let i = 0; i < 260; i++) { const x = R() * S, y = R() * S, r = 10 + R() * 70; g.fillStyle = `rgba(${R() < 0.5 ? '160,100,26' : '226,160,58'},${0.04 + R() * 0.07})`; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill() }
  for (let i = 0; i < 26; i++) { const x = R() * S, y = R() * S, w = 2 + R() * 7, h = 50 + R() * 190; const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, 'rgba(110,50,18,0)'); gr.addColorStop(0.3, `rgba(110,50,18,${0.1 + R() * 0.2})`); gr.addColorStop(1, 'rgba(110,50,18,0)'); g.fillStyle = gr; g.fillRect(x, y, w, h) }   // 錆の垂れ（少し）
  // 剥げ: かたまりで出る。flat は少数の小さなかたまり、edge は多めのかたまり。中は地金と錆、縁に明るい欠け口
  const chip = (x, y, r) => { const n = 6 + (R() * 5 | 0), pts = []; for (let i = 0; i < n; i++) { const a = i / n * 6.283 + R() * 0.5, d = r * (0.45 + R() * 0.7); pts.push([x + Math.cos(a) * d * 1.3, y + Math.sin(a) * d * 0.8]) }
    for (const [ctx, fill, stroke] of [[g, R() < 0.35 ? '#6b3a1c' : '#2d2d2e', 'rgba(220,200,160,0.7)'], [bg, '#2a2a2a', '#f0f0f0']]) { ctx.fillStyle = fill; ctx.strokeStyle = stroke; ctx.lineWidth = 1.2; ctx.beginPath(); pts.forEach(([px, py], i) => i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)); ctx.closePath(); ctx.fill(); ctx.stroke() } }
  const nCl = kind === 'edge' ? 7 : 3, per = kind === 'edge' ? 16 : 5, rmax = kind === 'edge' ? 9 : 5
  for (let k = 0; k < nCl; k++) { const cx = R() * S, cy = R() * S, sp = 30 + R() * 50; for (let i = 0; i < per; i++) chip(cx + (R() - 0.5) * sp * 2, cy + (R() - 0.5) * sp, 1.5 + R() * rmax) }
  // 擦れ: 明るい金属の細い傷（向きをそろえる）
  const ns = kind === 'edge' ? 110 : 50
  for (let i = 0; i < ns; i++) { const x = R() * S, y = R() * S, l = 14 + R() * 60, a = -0.45 + R() * 0.3; for (const [ctx, col] of [[g, `rgba(235,225,205,${0.12 + R() * 0.25})`], [bg, 'rgba(70,70,70,0.9)']]) { ctx.strokeStyle = col; ctx.lineWidth = 0.7 + R() * 0.8; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke() } }
  // 溶接の筋
  for (const y0 of [90, 250, 420]) { for (let x = 0; x < S; x += 4) { const y = y0 + Math.sin(x * 0.5) * 2.2; g.fillStyle = 'rgba(30,24,18,0.5)'; g.beginPath(); g.arc(x, y, 2.4, 0, 7); g.fill(); bg.fillStyle = 'rgba(240,240,240,0.9)'; bg.beginPath(); bg.arc(x, y, 2.4, 0, 7); bg.fill() } }
  // 下はこびりついた泥
  const mg = g.createLinearGradient(0, S * 0.62, 0, S); mg.addColorStop(0, 'rgba(58,40,24,0)'); mg.addColorStop(1, 'rgba(58,40,24,0.7)'); g.fillStyle = mg; g.fillRect(0, S * 0.62, S, S * 0.38)
  for (let i = 0; i < 60; i++) { const x = R() * S, y = S * (0.74 + R() * 0.26), r = 3 + R() * 9; g.fillStyle = 'rgba(52,36,22,0.65)'; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); bg.fillStyle = 'rgba(235,235,235,0.9)'; bg.beginPath(); bg.arc(x, y, r, 0, 7); bg.fill() }
  const m = tex(c, true, 8), b = tex(bc, false, 4); return { map: m, bump: b }
}
