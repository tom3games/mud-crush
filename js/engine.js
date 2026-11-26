// エンジン音: 録音のループ3本（アイドル・中速・高速）を回転数で重ねて混ぜる。自分の車は大きく、ほかは近い数台だけ距離と左右で鳴らす
const URLS = ['snd/eng_idle.wav', 'snd/eng_mid.wav', 'snd/eng_high.wav']
export const ENGINE_URLS = URLS
const TYPE_PITCH = [0.7, 0.86, 1.02]       // 車の種類ごとの音の太さ（重い車は低く太く）
const TYPE_BODY = [1.35, 1.15, 0.95]
const clamp = (v, a, b) => v < a ? a : v > b ? b : v

class Voice {
  constructor(ctx, dest, type) {
    this.ctx = ctx; this.type = type; this.rpm = 0.15; this.gear = 0; this.dip = 0; this.alive = true
    this.pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null
    this.out = ctx.createGain(); this.out.gain.value = 0
    if (this.pan) { this.out.connect(this.pan); this.pan.connect(dest) } else this.out.connect(dest)
    this.layers = URLS.map((u, i) => {
      const buf = window.Snd.bufs[u]; if (!buf || buf === 'loading') return null
      const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; const g = ctx.createGain(); g.gain.value = 0
      s.connect(g); g.connect(this.out); s.start(0, Math.random() * buf.duration); return { s, g }
    })
  }
  update(dt, speedN, thr, boosting, vol, pan, slip) {
    // ギア: 速さを4段に割り、段の中で回転が上がる。段を越えた瞬間にすっと落ちる
    const gear = Math.min(3, Math.floor(speedN * 4)), frac = clamp(speedN * 4 - gear, 0, 1)
    if (gear > this.gear) this.dip = 0.2
    if (gear < this.gear) this.dip = -0.05
    this.gear = gear; this.dip *= Math.exp(-dt * 7)
    const target = clamp(0.16 + frac * 0.5 + gear * 0.08 + thr * 0.2 + (boosting ? 0.12 : 0) - this.dip, 0.1, 1)
    const k = target > this.rpm ? 5.5 : 2.4        // 踏むと唸り、離すとゆっくり下がる
    this.rpm += (target - this.rpm) * (1 - Math.exp(-k * dt))
    const r = this.rpm, tp = TYPE_PITCH[this.type] || 1
    const w = [clamp(1 - r * 2.6, 0, 1), clamp(1 - Math.abs(r - 0.5) * 3, 0, 1), clamp((r - 0.42) * 2.4, 0, 1)]
    const t = this.ctx.currentTime
    this.layers.forEach((L, i) => { if (!L) return; L.g.gain.setTargetAtTime(w[i] * (i === 0 ? 0.7 : 1) * (TYPE_BODY[this.type] || 1), t, 0.05); L.s.playbackRate.setTargetAtTime((0.82 + r * 0.55) * tp * (i === 2 ? 0.92 : 1), t, 0.05) })
    this.out.gain.setTargetAtTime(vol * (0.7 + thr * 0.3), t, 0.06)
    if (this.pan) this.pan.pan.setTargetAtTime(pan, t, 0.1)
  }
  stop() { this.alive = false; const t = this.ctx.currentTime; try { this.out.gain.setTargetAtTime(0, t, 0.05); for (const L of this.layers) if (L) L.s.stop(t + 0.3) } catch (e) {} setTimeout(() => { try { this.out.disconnect() } catch (e) {} }, 500) }
}
export class EngineMix {
  constructor() { this.voices = new Map(); this.max = 4 }
  ready() { return window.Snd.ctx && URLS.every(u => window.Snd.bufs[u] && window.Snd.bufs[u] !== 'loading') }
  update(S, dt, me, camYaw, muted, live) {
    const Snd = window.Snd
    if (!Snd.ctx || Snd.away || !this.ready()) return
    if (!live || muted) { for (const [id, v] of this.voices) { v.stop(); this.voices.delete(id) } return }
    // 鳴らすのは 自分 + 近い数台
    const want = []
    if (me && me.alive) want.push([me, 0])
    const all = S.cars.filter(c => c !== me && c.alive).map(c => [c, me ? Math.hypot(c.x - me.x, c.z - me.z) : 999]).filter(a => a[1] < 75).sort((a, b) => a[1] - b[1])
    // 入れ替わりで音が作り直されないよう、鳴らしている車は少し順位が落ちても残す
    const near = all.slice(0, this.max - 1); const keep = all.slice(0, this.max + 1).filter(a => this.voices.has(a[0].id) && !near.includes(a))
    for (const a of near) want.push(a)
    for (const a of keep) if (want.length < this.max) want.push(a)
    const ids = new Set(want.map(w => w[0].id))
    for (const [id, v] of this.voices) if (!ids.has(id)) { v.stop(); this.voices.delete(id) }
    const sy = Math.sin(camYaw), cy = Math.cos(camYaw)
    for (const [c, d] of want) {
      let v = this.voices.get(c.id)
      if (!v) { v = new Voice(Snd.ctx, Snd.sfxBus, c.lo.body); this.voices.set(c.id, v) }
      const T = c.T, sp = Math.hypot(c.vx, c.vz), speedN = clamp(sp / (T.maxF * 1.2), 0, 1.2)
      const isMe = c === me
      const vol = isMe ? 0.5 : 0.2 / (1 + (d / 16) ** 2)
      // 左右: カメラの右（-cos, sin）に対する向き
      let pan = 0; if (!isMe && me) { const dx = c.x - me.x, dz = c.z - me.z, l = Math.hypot(dx, dz) || 1; pan = clamp(((-cy) * dx + sy * dz) / l, -1, 1) * 0.85 }
      v.update(dt, Math.min(1, speedN), isMe ? Math.max(0, c.thr) : clamp(speedN > 0.2 ? 0.5 : 0.1, 0, 1), c.boosting, vol, pan, c.slip)
    }
  }
  clear() { for (const [id, v] of this.voices) v.stop(); this.voices.clear() }
}
