import '../mute-auto.mjs'
import { chromium, webkit } from 'playwright'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { MUTE_LAUNCH, muteContext } from '../mute.mjs'
// node tools/verify.mjs [quick]。ブラウザで: 起動・画面ごとの一画面・整備→試合→結果・CPU戦の通し・境界
const ROOT = import.meta.dirname + '/..'
mkdirSync(ROOT + '/shots', { recursive: true })
const PORT = 5618
const server = spawn(process.execPath, ['server.mjs'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) } })
await new Promise(r => setTimeout(r, 500))
const URL0 = `http://localhost:${PORT}/`
const QUICK = process.argv.includes('quick')
let pass = 0, fail = 0; const results = []
async function t(name, fn) { try { const r = await fn(); if (r === false) throw new Error('false'); pass++; results.push(`ok   ${name}${r && r !== true ? '  ' + JSON.stringify(r) : ''}`) } catch (e) { fail++; results.push(`FAIL ${name}  ${String(e.message).split('\n')[0]}`) } }
const expect = (c, m) => { if (!c) throw new Error(m) }
const GL = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
async function open(browser, opts = {}, q = '') {
  const ctx = await browser.newContext({ locale: 'ja-JP', viewport: { width: 390, height: 844 }, ...opts })
  await muteContext(ctx)
  await ctx.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  const p = await ctx.newPage(); p.errs = []
  p.on('pageerror', e => p.errs.push('pageerror ' + e.message))
  p.on('console', m => { if (m.type() === 'error' && !/ERR_ABORTED|Failed to load resource/.test(m.text())) p.errs.push('console ' + m.text()) })
  p.on('requestfailed', r => { if (!/fonts\.(googleapis|gstatic)|ERR_ABORTED/.test(r.url() + (r.failure()?.errorText || ''))) p.errs.push('reqfail ' + r.url()) })
  await p.goto(URL0 + q); await p.waitForFunction(() => window.__mcReady, null, { timeout: 40000 })
  return p
}
const fit = p => p.evaluate(() => { const H = innerHeight, W = innerWidth, de = document.documentElement, bad = []; if (de.scrollHeight > H + 1 || de.scrollWidth > W + 1) bad.push('page:' + de.scrollWidth + 'x' + de.scrollHeight); for (const el of document.querySelectorAll('section:not([hidden]) button, section:not([hidden]) h1')) { if (!el.offsetParent) continue; const r = el.getBoundingClientRect(); if (r.width && (r.right > W + 1 || r.left < -1 || r.bottom > H + 1 || r.top < -1)) bad.push((el.id || el.className || el.tagName) + ':' + [r.left, r.top, r.right, r.bottom].map(Math.round)) } return bad.slice(0, 6) })
const SIZES = [[360, 640], [390, 844], [430, 932], [844, 390], [1440, 900]]
for (const [name, bt, extra] of [['chromium', chromium, { args: [...MUTE_LAUNCH.args, ...GL] }], ['webkit', webkit, {}]]) {
  if (QUICK && name === 'webkit') continue
  const browser = await bt.launch(bt === chromium ? { ...MUTE_LAUNCH, ...extra } : extra)
  const mob = { isMobile: true, hasTouch: true }
  const p = await open(browser, name === 'webkit' ? mob : {}, '?touch=' + (name === 'webkit' ? 1 : 0))
  await t(`[${name}] 起動時にエラーが出ない`, async () => { expect(p.errs.length === 0, p.errs.join('|')) })
  await t(`[${name}] 拡大止め（viewport）`, async () => { expect(/maximum-scale=1/.test(await p.evaluate(() => document.querySelector('meta[name=viewport]').content))) })
  await t(`[${name}] OGP と description`, async () => { const r = await p.evaluate(() => ({ og: document.querySelector('meta[property="og:image"]')?.content, d: document.querySelector('meta[name=description]')?.content?.length, tw: document.querySelector('meta[name="twitter:card"]')?.content })); expect(r.og && r.d > 40 && r.tw, JSON.stringify(r)); return true })
  // 画面ごとの一画面
  for (const [w, h] of SIZES) {
    await t(`[${name}] ${w}x${h} タイトル/整備/試合/結果が一画面`, async () => {
      await p.setViewportSize({ width: w, height: h }); await p.waitForTimeout(150)
      const out = {}
      out.title = await fit(p)
      await p.evaluate(() => window.__mc.toPrep()); await p.waitForTimeout(200); out.prep = await fit(p)
      await p.evaluate(() => window.__mc.startMatch()); await p.waitForTimeout(300); out.hud = await fit(p)
      await p.evaluate(() => window.__mc.showResult(3)); await p.waitForTimeout(150); out.result = await fit(p)
      await p.evaluate(() => window.__mc.toTitle())
      const bad = Object.entries(out).filter(([, v]) => v.length); expect(!bad.length, JSON.stringify(bad)); return true
    })
  }
  await p.setViewportSize({ width: 390, height: 844 })
  await p.context().close()
  // 通し: タイトル → 整備（選ぶ）→ 出発 → 運転 → CPU戦 → 結果
  const q = await open(browser, name === 'webkit' ? mob : {}, '?touch=' + (name === 'webkit' ? 1 : 0))
  await t(`[${name}] 整備で選ぶと車と部品が変わり、試合に反映される`, async () => {
    await q.click('#goPrep'); await q.waitForTimeout(300)
    await q.click('.opt[data-i="2"]'); await q.click('.tab[data-i="1"]'); await q.click('.opt[data-i="1"]'); await q.click('.tab[data-i="2"]'); await q.click('.opt[data-i="0"]'); await q.click('.tab[data-i="3"]'); await q.click('.opt[data-i="2"]')
    const lo = await q.evaluate(() => window.__mc.lo()); expect(JSON.stringify(lo) === '{"body":2,"bumper":1,"tire":0,"engine":2}', JSON.stringify(lo))
    await q.click('#pGo'); await q.waitForTimeout(400)
    const c = await q.evaluate(() => { const c = window.__mc.me(); return { b: c.lo.body, u: c.lo.bumper, t: c.lo.tire, e: c.lo.engine } }); expect(c.b === 2 && c.u === 1 && c.t === 0 && c.e === 2, JSON.stringify(c)); return true
  })
  await t(`[${name}] 3・2・1のあと走れる（W・ニトロ・ハンドル）`, async () => {
    await q.waitForTimeout(3600)
    await q.keyboard.down('KeyW'); await q.keyboard.down('KeyD'); await q.waitForTimeout(1800); await q.keyboard.up('KeyD')
    const v = await q.evaluate(() => window.__mc.me().speedKmh); expect(v > 10, 'speed ' + v)
    await q.keyboard.up('KeyW'); await q.keyboard.down('ShiftLeft'); await q.waitForTimeout(700)
    const n = await q.evaluate(() => ({ b: window.__mc.me().boosting, n: window.__mc.me().nitro })); await q.keyboard.up('ShiftLeft')
    expect(n.b || n.n < 0.4, JSON.stringify(n)); return { kmh: Math.round(v) }
  })
  await t(`[${name}] 画面のボタン（タッチ）でも走れる`, async () => {
    await q.evaluate(() => { document.body.classList.add('touch') })
    const box = await q.locator('#bGas').boundingBox(); await q.mouse.move(box.x + 30, box.y + 40); await q.mouse.down(); await q.waitForTimeout(1500)
    const v = await q.evaluate(() => window.__mc.K.gas); await q.mouse.up(); expect(v === true, 'gas ' + v); return true
  })
  await t(`[${name}] ニトロ連打・ハンドル全開でも壊れない`, async () => {
    for (let i = 0; i < 40; i++) { await q.keyboard.down('ShiftLeft'); await q.keyboard.down(i % 2 ? 'KeyA' : 'KeyD'); await q.waitForTimeout(40); await q.keyboard.up('ShiftLeft'); await q.keyboard.up(i % 2 ? 'KeyA' : 'KeyD') }
    const r = await q.evaluate(() => { const c = window.__mc.me(); return isFinite(c.x + c.z + c.y) && c.nitro >= 0 && c.nitro <= 1 }); expect(r); expect(q.errs.length === 0, q.errs.join('|')); return true
  })
  await t(`[${name}] 一時停止と再開`, async () => {
    await q.keyboard.press('KeyP'); await q.waitForTimeout(200); const hid = await q.evaluate(() => !document.getElementById('pause').hidden)
    await q.click('#pResume'); await q.waitForTimeout(200); const ok = await q.evaluate(() => document.getElementById('pause').hidden); expect(hid && ok); return true
  })
  await t(`[${name}] 試合を最後まで（CPUに任せて高速で回す）→ 結果が出る`, async () => {
    await q.evaluate(() => { window.__mc.K.auto = true; window.__mc.setSpeed(8) })
    await q.waitForFunction(() => window.__mc.phase() === 'result', null, { timeout: 200000 })
    const r = await q.evaluate(() => ({ done: window.__mcDone, rows: document.querySelectorAll('#rkList li').length, rank: document.getElementById('rkN').textContent }))
    expect(r.rows === 6 && r.done && r.done.tMatch > 3, JSON.stringify(r)); await q.screenshot({ path: ROOT + `/shots/v-result-${name}.png` }); return { sec: Math.round(r.done.tMatch), rank: r.rank, flips: r.done.flips }
  })
  await t(`[${name}] 結果から もう一回 ・整備しなおす・タイトル`, async () => {
    await q.evaluate(() => window.__mc.setSpeed(1)); await q.click('#btnAgain'); await q.waitForTimeout(400); expect(await q.evaluate(() => window.__mc.phase()) === 'play')
    await q.evaluate(() => window.__mc.showResult(2)); await q.click('#btnPrep'); await q.waitForTimeout(300); expect(await q.evaluate(() => window.__mc.phase()) === 'prep')
    await q.click('#pGo'); await q.waitForTimeout(300); await q.evaluate(() => window.__mc.showResult(1)); await q.click('#btnTitle'); await q.waitForTimeout(300); expect(await q.evaluate(() => window.__mc.phase()) === 'title'); return true
  })
  await t(`[${name}] 試合中に何度も結果→もう一回してもエラーなし`, async () => { for (let i = 0; i < 4; i++) { await q.evaluate(() => window.__mc.startMatch()); await q.waitForTimeout(200); await q.evaluate(() => window.__mc.advance(300)) } expect(q.errs.length === 0, q.errs.join('|')); return true })
  await t(`[${name}] 音が呼ばれている（鳴らさず回数で確認）`, async () => { const s = await q.evaluate(() => window.__mc.sound()); expect(Object.keys(s.played).length > 2, JSON.stringify(s.played)); return Object.keys(s.played).length })
  await t(`[${name}] 最後にエラー0`, async () => { expect(q.errs.length === 0, q.errs.join('|')) })
  await browser.close()
}
console.log(results.join('\n')); console.log(`\n${pass} ok / ${fail} NG`)
server.kill(); process.exit(fail ? 1 : 0)
