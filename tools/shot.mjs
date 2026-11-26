import '../mute-auto.mjs'
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { MUTE_LAUNCH, muteContext } from '../mute.mjs'
// 画面を撮る。node tools/shot.mjs 名前 "クエリ" 幅 高さ "待ち(ms,カンマ区切り)" "ページ内で実行する式"
const PORT = 5617
mkdirSync(import.meta.dirname + '/../shots', { recursive: true })
const server = spawn(process.execPath, ['server.mjs'], { cwd: import.meta.dirname + '/..', env: { ...process.env, PORT: String(PORT) } })
await new Promise(r => setTimeout(r, 400))
const [, , name = 'a', query = '', w = '390', h = '844', waitMs = '3000', script = '', after = ''] = process.argv
const touch = /touch=1/.test(query)
const b = await chromium.launch({ ...MUTE_LAUNCH, args: [...MUTE_LAUNCH.args, '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const ctx = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1, hasTouch: touch, isMobile: touch })
await muteContext(ctx)
const p = await ctx.newPage(); const errs = []
p.on('pageerror', e => errs.push('pageerror ' + e.message)); p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ' ' + m.text()) })
await p.goto(`${process.env.BASE || 'http://localhost:' + PORT + '/'}?${query}`)
await p.waitForFunction(() => window.__mcReady, null, { timeout: 40000 }).catch(async e => errs.push('notready ' + JSON.stringify(await p.evaluate(() => [window.__jsUp, window.__mcReady, document.getElementById('err') && document.getElementById('err').textContent]).catch(x => String(x)))))
if (script) { const r = await p.evaluate(script).catch(e => errs.push('script ' + e.message)); if (r !== undefined) console.log('result', JSON.stringify(r)) }
const ws = String(waitMs).split(',').map(Number)
for (let i = 0; i < ws.length; i++) { await p.waitForTimeout(ws[i]); await p.screenshot({ path: `shots/${name}${ws.length > 1 ? '_' + i : ''}.png` }) }
if (after) console.log('after', JSON.stringify(await p.evaluate(after)))
console.log('frames', await p.evaluate(() => window.__mcFrames), 'info', JSON.stringify(await p.evaluate(() => window.__mc && { calls: window.__mc.stage.renderer.info.render.calls, tris: window.__mc.stage.renderer.info.render.triangles, geo: window.__mc.stage.renderer.info.memory.geometries })))
console.log(name, 'errors:', errs.slice(0, 8))
await b.close(); server.kill()
