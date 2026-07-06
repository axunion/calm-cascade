# 05. 実装ロードマップ

各フェーズは「検証基準を満たしたら次へ進む」ゲート付き。テストはフェーズ内で実装と同時に書く（CLAUDE.md 規約: テストは成功基準）。

## フェーズ 0: 足場 — 設定と骨格

**作業**
- `vite.config.ts` に `css: { modules: { localsConvention: 'camelCaseOnly' } }` を追加
- スターターのデモコード（`App.tsx` / `App.css` / `assets/` の不要分）を削除・置換
- `index.css` にリセット・dvh レイアウト・テーマ CSS 変数の骨格
- ディレクトリ作成（engine / game / render / store / components / styles）

**検証**: `pnpm dev` で空のレイアウト骨格が表示され、`pnpm check` が通る

## フェーズ 1: エンジン純関数 + テスト（ゲームの心臓）

**作業**
- `engine/rng.ts`（mulberry32）→ `board.ts`（型・createBoard・hasValidMove・reshuffle）→ `matches.ts` → `swap.ts` → `specials.ts` → `lasers.ts` → `cascade.ts`（resolveStep・スコア）
- 同時に [06-testing.md](./06-testing.md) のテストケースを実装（`boardFromStrings` ヘルパ先行）

**検証**: `pnpm test` 全緑。カバレッジ対象は engine/ 全モジュール。3 連鎖シナリオのステップ列・スコア・コンボがテストで再現される

## フェーズ 2: Canvas 描画 + タッチ入力（静的な盤面が触れるようになる）

**作業**
- `render/theme.ts`（パレット + 6 形状の Path2D）、`renderBoard.ts`（盤面・宝石・選択リング）
- `components/PuzzleGrid.tsx`（canvas ライフサイクル・ResizeObserver・DPR 対応）
- `game/input.ts`（ポインタ状態機械）+ 単体テスト
- `game/gameLoop.ts` の骨格: IDLE / SWAPPING / SWAP_REJECT のみ（マッチ即消し・アニメなしの仮実装で可）
- `store/puzzleStore.ts` の骨格

**検証**: 実機（または DevTools モバイルエミュレーション）でスワイプとタップタップの両方でスワップでき、無効スワップは戻る。ページがスクロール・バウンスしない。回転・リサイズで盤面が追従しぼやけない

## フェーズ 3: カスケード + アニメーション（ゲームとして成立）

**作業**
- `game/animations.ts`（トゥイーンエンジン + イージング）
- RESOLVING フェーズ完成: resolveStep ループ・消去/落下/スポーンのトゥイーン・コンボ集計・ステップ境界の store 書き込み（`batch`）
- SHUFFLING フェーズ（自動リシャッフル演出）
- `components/JuiceOverlay.tsx` + juice イベント経路 + `game/juice.ts`（ティア表）

**検証**: 連鎖が滑らかにアニメーションし、コンボテキストがマッチ位置に浮かぶ。連鎖中の入力が無視される。dt クランプの動作確認（タブを裏に回して復帰）

## フェーズ 4: レーザーピース

**作業**
- レーザーの描画（形状 + 方向矢印）・ビーム演出（`render/effects.ts`）・スタッガー消去
- レーザー同士スワップの十字消し・チェーン発火の演出接続
- stats の `lasersFired` 計上

**検証**: 横 4 / 縦 4 でレーザーが正しい位置に生成され、マッチに巻き込むと行/列が掃引されて消える。レーザー同士のスワップで十字消し。チェーン発火が視覚的に追える

## フェーズ 5: UI / HUD（Kobalte + グラスモーフィズム）

**作業**
- `components/PuzzleUI.tsx`（HUD・スコアカウントアップ・下部ボタン）
- `SettingsDialog.tsx`（6 トグル）/ `InfoDialog.tsx`（How to Play + Stats タブ）
- `styles/Puzzle.module.css` / `dialogs.module.css`（ボトムヘビー・グラス・ボトムシート風 Dialog）
- ダーク / ライトテーマ切替（DOM CSS 変数 + canvas パレットの同期）

**検証**: 全ボタンが 44px 以上。Dialog が開閉でき、開いている間ゲーム入力が遮断される。テーマ切替が DOM と canvas の両方に即時反映される。キーボード（Tab / Esc）で Dialog を操作できる

## フェーズ 6: 演出強化（ジュース仕上げ）

**作業**
- `game/particles.ts`（固定プール）+ マッチバースト
- 画面シェイク（trauma モデル）
- `game/audio.ts`（シンセ効果音・コンボ上行音・レーザースウィープ・設定ゲート）
- ハプティクスヘルパ
- reduced-motion 縮退の全経路実装（OS 設定 OR トグル）

**検証**: `prefers-reduced-motion: reduce`（DevTools エミュレーション）でシェイク・パーティクルが消え、アニメが短縮フェードになる。サウンド・ハプティクスが設定でオンオフできる。iOS 実機でサウンドが初回タップから鳴る

## フェーズ 7: 仕上げ — 永続化・a11y・パフォーマンス

**作業**
- `store/persistence.ts`（スキーマバージョン・try/catch・500ms debounce）
- `aria-live` スコア通知・canvas の aria-label・フォーカス順の点検
- パフォーマンス計測と調整

**検証**
- リロードしても設定と統計が復元される。localStorage を破損値にしてもデフォルトで起動する
- Chrome DevTools Performance（CPU 4x スロットリング + モバイルエミュレーション）で連鎖中に 60fps（フレーム 16.6ms 以内）を維持、ホットループ内の GC スパイクがない
- Lighthouse（モバイル）で a11y スコアを確認
- `pnpm check && pnpm test && pnpm build` が全部通る

## 実装順の依存関係

```
フェーズ0 ─▶ フェーズ1 ─▶ フェーズ2 ─▶ フェーズ3 ─▶ フェーズ4 ─▶ フェーズ6
                                          │                        ▲
                                          └─▶ フェーズ5 ────────────┘─▶ フェーズ7
```

フェーズ 5（UI）はフェーズ 3 完了後なら 4 と並行可能。フェーズ 6・7 は全体の収束点。

## 元指示の要件トレーサビリティ

| 元指示の要件 | 対応する spec |
|---|---|
| Vite + SolidJS + TS / Kobalte / lucide-solid / CSS Modules camelCaseOnly | 00 §技術スタック、フェーズ 0 |
| ボトムヘビーレイアウト / 片手操作 | 03 §1 |
| Canvas の 100% 幅リサイズ / touch-action: none | 03 §1、04 §1.2・§3.1 |
| スワイプ + タップタップ / 10px 閾値 / ダブルタップ debounce | 04 §3.2 |
| prefers-reduced-motion | 03 §6、04 §2 |
| rAF + delta-time / DPR / 60fps / リサイズ throttle | 04 §1・§2・§4 |
| createStore 共有ストア（puzzleStore.ts） | 02 §5 |
| コンボテキストは DOM オーバーレイ | 02 §5 juice イベント、01 §5 |
| 最小の App.tsx 構成ルート | 02 §2 |
| 8x8・カスケード・落下・スポーン | 01 §1–2、02 §3 |
| レーザーピース（横4→行 / 縦4→列、スワップ発動） | 01 §4 |
| ゲームオーバー・タイマーなし | 00 §ピラー、01 §1 |
| パーティクル・画面シェイク | 04 §2.3–2.4 |
| 拡張: 永続化 / ハプティクス / 色覚対応 / サウンド | 02 §7、04 §5–6、03 §6 |
