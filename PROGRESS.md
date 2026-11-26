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

## 2026-11-26 v2 作り込み（本人「見た目の作り込み」）
- 読んだ: ship の reference/design.md（ゲームの行・AI臭・芯）、tmk_hub memory/semantic/knowledge-games-3d.md（3D の教訓。実測してから直す・見た目の不具合は設定の値を数える・撮って安っぽい所を強い順に3つ書いて直す周回）
- 素材: Poly Haven（CC0）の rock_07・rock_09・old_tyre を models/ に入れた（テクスチャは 512px に縮小）。トラック・重機の無料モデルは取れる所が無かった（Kenney は403・GitHub 検索は空）ので、トラックは面取り・斜めの窓・部品を足して作り込む
- 前の撮影: shots/before-pc.png（1440x900）・before-phone.png（390x844）・before-pc2.png（同じ種の別の場面）
- 変えた事（v2）: ボンネットを低く小さく（先が下がる輪郭・通気の溝・格子・ヘッドライト）、運転台は斜めの窓の輪郭で押し出し、ミラー・ドアの継ぎ目・燃料タンク・泥よけ・リベット・油圧の筒・牛追いの枠を足した。排土板は塗装した鉄板（黄橙・黄黒の縁）。タイヤは実物（old_tyre）。岩は実物（rock_07/09）。廃車は輪郭を押し出した抜け殻。車体に泥が下から上へ付いていく（uDirt）。泥のくぼみは濡れて光る（粗さの絵を作り直し）。泥はね（タイヤの泥の塊・フロントガラスの泥のしみ）・土ぼこり・漂うもや・タイヤ跡900本。空は低い太陽と雲の筋、崖は採石場の段（壁と平らな段）、光は夕方の低い角度で長い影
- 前後の撮影（同じ種・同じ時刻）: shots/before-pc.png と after-pc.png、before-phone.png と after-phone.png、before-pc2.png と after-pc2.png（どちらも壁際で詰まった場面）。ほかに v2g（PC）・v2h（スマホ）・v2i（泥の中）・v2j（遠景）
- fps（tools/fps.mjs・Mac M5 の GPU・上限なし）: PC 1440x900 約300〜380fps、スマホ縦（低品質・CPU を4倍遅くした）約240〜260fps。描画回数 約200・三角形 約48〜54万（岩2種が1つ約2.5万三角形で重い）。実機のスマホ GPU は未確認
- 検査: simtest 13/13、hsim 20試合（平均93秒・未決着0）、verify 36/36（Chromium・WebKit）
