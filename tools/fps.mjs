import '../mute-auto.mjs'
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { MUTE_LAUNCH, muteContext } from '../mute.mjs'
// 試合中の fps を測る。node tools/fps.mjs [gpu|soft]。gpu=Mac の GPU（Metal）、soft=ソフト描画
const mode = process.argv[2] || 'gpu', PORT = 5620
const server = spawn(process.execPath, ['server.mjs'], { cwd: import.meta.dirname + '/..', env: { ...process.env, PORT: String(PORT) } })
await new Promise(r => setTimeout(r, 500))
const args = mode === 'gpu' ? ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-frame-rate-limit', '--disable-gpu-vsync'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
const b = await chromium.launch({ ...MUTE_LAUNCH, args: [...MUTE_LAUNCH.args, ...args] })
for (const [name, w, h, dpr, q, cpu] of [['PC 1440x900', 1440, 900, 1, 'touch=0', 1], ['スマホ縦 390x844 (低品質・CPU4倍遅)', 390, 844, 3, 'touch=1', 4]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, hasTouch: q === 'touch=1', isMobile: q === 'touch=1' }); await muteContext(ctx)
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message))
  const c = await ctx.newCDPSession(p); if (cpu > 1) await c.send('Emulation.setCPUThrottlingRate', { rate: cpu })
  await p.goto(`http://localhost:${PORT}/?start=1&auto=1&seed=11&lo=0,0,1,1&${q}`); await p.waitForFunction(() => window.__mcReady, null, { timeout: 60000 })
  await p.waitForTimeout(5000)   // 3・2・1のあとまで
  const gl = await p.evaluate(() => { const g = document.createElement('canvas').getContext('webgl2'); const e = g && g.getExtension('WEBGL_debug_renderer_info'); return e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : '?' })
  const res = []
  for (let k = 0; k < 3; k++) { const f0 = await p.evaluate(() => window.__mcFrames), t0 = Date.now(); await p.waitForTimeout(4000); const f1 = await p.evaluate(() => window.__mcFrames); res.push((f1 - f0) / ((Date.now() - t0) / 1000)) }
  const info = await p.evaluate(() => { const i = window.__mc.stage.renderer.info; return { calls: i.render.calls, tris: i.render.triangles } })
  console.log(`${name} [${mode}] ${gl.slice(0, 60)}\n  fps ${res.map(v => v.toFixed(1)).join(' / ')}  描画回数 ${info.calls}  三角形 ${info.tris}  エラー ${errs.length}`)
  await ctx.close()
}
await b.close(); server.kill()
