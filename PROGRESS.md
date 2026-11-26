# 鉄と泥（仮: mud-crush）進み具合

仕様の正本は ~/Desktop/claudecode/ideas/mud-crush.md。元は tagteam-wreck（BANG BUMPERS）。あちらは触らない。

## 2026-11-26 ①遊べる版
- 読んだ: ideas/mud-crush.md 全部・bakage スキルと reference/game-rules.md・knowledge-games.md / knowledge-games-3d.md の見出し・index-games.md の作り方のルール・ship の anti-ai-tells / design.md
- 決めた事: 名前は「鉄と泥（IRON & MUD）」。視点は運転席（車の目の高さ・ボンネットとバンパーが見える）。BANG の射手・アイテム・チーム制は外し、車6台の乱戦（自分＋CPU5）。点は「ひっくり返したら1点」、勝ちは「最後の1台」。計算（js/sim.js・cpu.js・arena.js）は画面と切り離したまま（THREE も DOM も使わない）
- 作り直した所: sim.js（部位ごとの壊れ・ニトロ・転覆・縮む輪・泥）、cpu.js（横腹へ回り込む・ニトロの使い所・引っかかり脱出）、arena.js（採石場）、stage.js・trucks.js・textures.js（ダンプ・ゴミ収集車・改造バス＋バンパー3種を箱と筒で組む）、main.js、index.html、style.css（錆びた鉄と泥の色）
- 残した物: fx.js（粒・破片・輪）、engine.js（エンジン音）、sfx.js、models.js、効果音
- 慣性（本人の指摘・2026-11-26）: アクセルを離した時の減速を大型車に寄せた。tools/coast.mjs で測定。離す時 ダンプ55km/h→半分まで2.0秒・止まるまで4.2秒・32m、ゴミ収集車63km/h→半分2.2秒・3.3秒・32m、バス74km/h→半分1.2秒・2.3秒・24m
- CPU 戦（tools/hsim.mjs 40試合）: 平均 約88秒・未決着0・転覆 平均1.4・最大静止 6.5秒
- tools/simtest.mjs: 部位の壊れ方・ニトロ・転覆の点・同時全滅・場外・再現性 13項目
- 検査: tools/verify.mjs（Chromium・WebKit 36項目 全部OK: 5サイズの全画面が一画面・整備→試合→結果・キーとタッチ・ニトロ連打・一時停止・CPU戦の通し・エラー0）、tools/simtest.mjs 13項目、live.mjs（公開版 Chromium/WebKit エラー0・og 200・GitHub に個人名なし）
- 公開: https://tom3games.github.io/mud-crush/?v=1（Pages built）。横丁（tom3games.com）への登録は未（portal の6か所＋検査15〜20分＋デプロイはメインで）
- 未検証: iOS シミュレーターでの人としての通し・実機のスマホの動き・耳での音の聞こえ方
