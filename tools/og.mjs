import '../mute-auto.mjs'
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { MUTE_LAUNCH, muteContext } from '../mute.mjs'
// og.png（1200x630）: 試合の見せ場（2台がぶつかる所）＋題名。node tools/og.mjs
const PORT = 5619
const server = spawn(process.execPath, ['server.mjs'], { cwd: import.meta.dirname + '/..', env: { ...process.env, PORT: String(PORT) } })
await new Promise(r => setTimeout(r, 500))
const b = await chromium.launch({ ...MUTE_LAUNCH, args: [...MUTE_LAUNCH.args, '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const ctx = await b.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 }); await muteContext(ctx)
const p = await ctx.newPage()
await p.goto(`http://localhost:${PORT}/?start=1&auto=1&seed=${process.argv[2] || 7}&lo=0,0,1,1`)
await p.waitForFunction(() => window.__mcReady)
const found = await p.evaluate(() => {
  const m = window.__mc; m.setSpeed(1)
  for (let i = 0; i < 60 * 80; i++) {
    m.advance(1)
    const S = m.S(); if (S.phase !== 'play') continue
    const cs = S.cars.filter(c => c.alive)
    for (const a of cs) for (const c of cs) if (a.id < c.id) { const d = Math.hypot(a.x - c.x, a.z - c.z), sp = Math.hypot(a.vx - c.vx, a.vz - c.vz); if (d < 3.8 && sp > 12 && Math.abs(a.x) < 40) { window.__pair = [a.id, c.id]; return [a.x, a.y, a.z, c.x, c.z, S.tMatch] } }
  }
  return null
})
console.log('見せ場', found)
await p.evaluate(() => { document.getElementById('hud').hidden = true; document.getElementById('vig').style.display = 'none'; document.getElementById('crack').style.display = 'none'; document.getElementById('wind').style.display = 'none' })
// ぶつかった場所を斜め前から
const f = found || [0, 0, 0, 3, 3]
const mx = (f[0] + f[3]) / 2, mz = (f[2] + f[4]) / 2
await p.evaluate(([mx, mz, y]) => { window.__mc.setSpeed(0); window.__mcCam = { p: [mx + 11, y + 4.2, mz - 12], l: [mx, y + 1.6, mz], fov: 52 } }, [mx, mz, f[1]])
await p.waitForTimeout(600)
await p.evaluate(() => { window.__mcPause = false; const d = document.createElement('div'); d.id = 'ogt'; d.style.cssText = 'position:fixed;inset:0;z-index:50;background:linear-gradient(90deg,rgba(14,9,5,.82) 0,rgba(14,9,5,.45) 38%,rgba(14,9,5,0) 62%);padding:70px 60px;font-family:"Shippori Mincho B1",serif;color:#d9c7a4'; d.innerHTML = '<div style="font:800 28px/1 \'Big Shoulders Display\',sans-serif;letter-spacing:.4em;color:#e0763a;transform:rotate(-2deg)">車の潰し合い・6台</div><div style="font-weight:800;font-size:196px;line-height:.86;transform:rotate(-2.2deg);transform-origin:0 0;margin-top:10px;text-shadow:0 6px 0 rgba(10,6,3,.6)">鉄と<br><span style="color:#e0763a;margin-left:.3em">泥</span></div><div style="font:900 38px/1 \'Big Shoulders Display\',sans-serif;letter-spacing:.34em;margin-top:18px;transform:rotate(-2deg)">IRON &amp; MUD</div>'; document.body.appendChild(d) })
await p.waitForTimeout(500)
await p.screenshot({ path: import.meta.dirname + '/../og.png' })
await b.close(); server.kill()
