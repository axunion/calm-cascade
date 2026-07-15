# 05. 実装ロードマップ v2 — テーマパック + 面白さ拡張

> v1（フェーズ 0〜7: コアゲーム一式）は完了済み。内容は git 履歴（`06e3e55`〜`abb9658`）を参照。

## 進め方（1 フェーズ = 1 ループ）

各フェーズは 1 コミット規模。以下のループを回す:

1. **実装 + テスト**: 該当 spec 章（`.claude/skills/spec-map` のマップ参照）を読み、テストを実装と同時に書く
2. **ゲート検証**: `phase-gate-verifier` エージェントで独立検証する（完了マーカー確認 + `pnpm check && pnpm test` + spec/06 のケース網羅チェック。手動確認項目はユーザーへのチェックリストとして提示）。赤のまま次へ進まない
3. **準拠レビュー**: ゲート通過後、`spec-compliance-reviewer` エージェントでフェーズの diff を spec 不変条件と照合し、Violation はコミット前に修正する
4. **コミット**: レビュー通過後にコミットして次のフェーズへ

- 各フェーズの「完了マーカー」は進捗判定用の機械確認可能な条件（`/next-phase` スキルがここを読む）
- フェーズの実装で spec の誤り・不足が見つかったら、黙って逸脱せず spec 修正を提案する
- **全フェーズ共通の Calm 検収観点**: カウントダウン・点滅・強制モーダルを追加しない。トーストが入力を遮らない。「未達成」「失敗」表示を出さない

## フェーズ 1: スコア式のエンジン移管

**作業**
- `src/engine/scoring.ts` 新規: `stepScore(clearedCount, combo)`（spec/01 §3 の式の単一情報源）
- `src/engine/scoring.test.ts` 新規（spec/06 §3 のケース）
- `src/game/gameLoop.ts` の `reportStep` が式の再実装をやめ `stepScore()` を呼ぶ

**完了マーカー**: `src/engine/scoring.ts` と `scoring.test.ts` が存在し、`gameLoop.ts` に `* 10 *` のインライン式がない

**検証ゲート**: `pnpm check && pnpm test` 緑。手動: 3 個消しで 30 点、2 連鎖目が ×2 になる（挙動不変の確認）

## フェーズ 2: 永続化スキーマ v2

**作業**
- `src/store/puzzleStore.ts`: `PuzzleSettings` に `skin: string`（`DEFAULT_SKIN = "classic"`）、`PuzzleStats` に `bombsDetonated` / `prismsFired` / `iceBroken` / `dailiesPlayed`（初期値 0）、state に `unlockedAchievements: string[]` / `daily: DailyRecord | null` を追加
- `src/store/persistence.ts`: `SCHEMA_VERSION = 2` + 1→2 マイグレーション（spec/04 §7.5。v1 は欠落フィールドをデフォルト補完して受理）
- `src/store/persistence.test.ts`: v1 ペイロード互換 + v2 ラウンドトリップを追加（spec/06 §3）

**完了マーカー**: `persistence.ts` に `SCHEMA_VERSION = 2` とマイグレーション分岐があり、settings 型に `skin` がある

**検証ゲート**: `pnpm check && pnpm test` 緑。手動: 既存の localStorage（v1 データ）がある状態で `pnpm dev` → リロードしても設定・統計が消えない

## フェーズ 3: manifest スキーマ + バリデータ

**作業**
- `src/render/themePack.ts` 新規: `ThemeManifest` / `ThemePackColors` 型 + `validateManifest`（手書き型ガード、spec/04 §7.2）
- `src/render/themePack.test.ts` 新規（spec/06 §3）

**完了マーカー**: `src/render/themePack.ts` と `themePack.test.ts` が存在する

**検証ゲート**: `pnpm check && pnpm test` 緑（このフェーズに手動確認はない）

## フェーズ 4: テーマレジストリ + 同梱カラーオンリーパック

**作業**
- `themes/pastel-bloom/manifest.json` 新規（画像なし・色のみのパック — glob とバリデーションの実証を兼ねる）
- `src/render/themeRegistry.ts` 新規: `import.meta.glob`（`/themes/*/manifest.json` eager + `/themes/*/*.{png,webp,jpg,jpeg}` `?url`）、`listSkins` / `getManifest` / `getAssetUrl` / `getUiAccent`（spec/04 §7.1）
- `src/render/themeRegistry.test.ts` 新規

**完了マーカー**: `themes/pastel-bloom/manifest.json` と `src/render/themeRegistry.ts` が存在する

**検証ゲート**: `pnpm check && pnpm test` 緑（`import.meta.glob` が vitest node 環境で解決されることの確認を兼ねる）

## フェーズ 5: Theme 一般化 + ローダ

**作業**
- `src/render/theme.ts`: `Theme` に `gems: readonly (ImageBitmap | null)[]` / `background: ImageBitmap | null` を**必須フィールド**として追加（組み込み 2 定数は共有の凍結 null 配列で埋める — ホットループで optional chaining を書かないため）。`getTheme(mode)` のシグネチャは不変
- `src/render/themeLoader.ts` 新規: `loadBitmap` / `resolveTheme(skinId, mode, loader?)` + `Map<skin/mode, Theme>` キャッシュ（spec/04 §7.3）
- `src/render/themeLoader.test.ts` 新規（`BitmapLoader` スタブ注入）

**完了マーカー**: `Theme` 型に `gems` フィールドがあり、`src/render/themeLoader.ts` が存在する

**検証ゲート**: `pnpm check && pnpm test` 緑。手動: 描画は未接続のため挙動変化ゼロであること（`pnpm dev` で従来どおり）

## フェーズ 6: render 統合（画像描画）

**作業**
- `src/render/scaledBitmaps.ts` 新規: 事前スケールキャッシュ（spec/04 §7.4）
- `src/render/renderBoard.ts`: `RenderOptions` に `dpr` / `colorBlindShapes` を追加、`drawBackground` / `drawGems` に画像分岐（spec/04 §1.3。特殊アイコンは画像の上にも常時描画）
- `src/components/PuzzleGrid.tsx`: リサイズ処理が `renderOptions.dpr` を書き込む。skin / mode **だけ**を読む createEffect で `resolveTheme` を呼び、世代トークンでレース防御して `renderOptions.theme` を差し替え（spec/02 §8）

**完了マーカー**: `src/render/scaledBitmaps.ts` が存在し、`renderBoard.ts` に `drawImage` 分岐がある

**検証ゲート**: `pnpm check && pnpm test` 緑。手動:
- classic で従来とピクセル同等の見た目
- localStorage の `settings.skin` を `"pastel-bloom"` に手書き → 宝石・盤面の色が変わる
- ウィンドウリサイズ・DPR 変更（ズーム）でぼやけない
- DevTools CPU 4x throttle で連鎖中 60fps 近傍、Performance でフレーム内アロケーション増なし
- 画像経路の確認用に任意の 256px PNG で `themes/dev-test/` を一時作成してよい（コミットしない）

## フェーズ 7: テーマ選択 UI + uiAccent

**作業**
- `src/components/SettingsDialog.tsx`: Kobalte `RadioGroup` でテーマパック選択（`listSkins()` を列挙。spec/03 §3）
- `src/styles/dialogs.module.css`: radio 行のグラススタイル（44px ターゲット）
- `src/App.tsx`: `getUiAccent(skin, mode)` を createEffect で CSS 変数 `--accent` に反映（classic / 未定義時は `removeProperty`）

**完了マーカー**: `SettingsDialog.tsx` に `RadioGroup` があり、`App.tsx` に `--accent` の反映処理がある

**検証ゲート**: `pnpm check && pnpm test` 緑。手動: 設定 UI で切替 → 即反映 → リロード後も維持。accent 色が HUD / ボタンに反映。Esc・フォーカストラップが壊れていない

## フェーズ 8: colorBlindShapes の描画接続

**作業**
- `src/render/renderBoard.ts` の `drawGems`: 設定 ON 時、ベクタ宝石は輪郭強調 stroke、画像宝石は中央ミニグリフ（spec/03 §6）。**縮小は必ず `ctx.scale`** — `gemShapePath` を複数 cellSize で呼ばない（spec/04 §1.3 の罠）

**完了マーカー**: `renderBoard.ts` の `drawGems` に colorBlindShapes による分岐（ベクタの輪郭 stroke / 画像のミニグリフ描画）がある（フェーズ 6 の `RenderOptions.colorBlindShapes` フィールド追加だけでは未達）

**検証ゲート**: `pnpm check && pnpm test` 緑。手動: ベクタ / 画像の両テーマでトグル ON/OFF の見た目が仕様どおり。Performance でフレーム内アロケーション増なし

## フェーズ 9: 画像パック実証 + テーマ作者ガイド

**作業**
- 実画像入りテーマパックを 1 つ同梱（宝石 6 枚 + 背景。アセットは癒し系トンマナで用意し人間がレビュー）
- `themes/README.md` 新規: テーマ作者向けガイド（manifest 仕様・推奨 256×256 webp/png・ハイブリッド可・失敗時挙動・a11y 上書き不可の説明）

**完了マーカー**: `themes/` 配下に manifest の `gems` に非 null を含むパックが 1 つ以上あり、`themes/README.md` が存在する

**検証ゲート**: `pnpm check && pnpm test && pnpm build` 緑。手動: 画像パックで一通りプレイ（スワップ・連鎖・レーザー・リシャッフル・リサイズ・dark/light 切替）し、フェーズ 6 の手動チェックリストを再走

## フェーズ 10: 発火機構の一般化 + ボム

**作業**
- `src/engine/board.ts`: `Special` に `"bomb"` を追加、`Gem` に `ice: number` を追加（既定 0 — 型だけ先行し挙動はフェーズ 14）
- `src/engine/lasers.ts` → `src/engine/fires.ts` リネーム: `resolveSpecialFires` / `SpecialFire`（bomb = 3x3 クリップ掃引。spec/02 §3）。`lasers.test.ts` → `fires.test.ts`
- `src/engine/specials.ts`: L/T 字交差検出 → 共有セルに bomb（優先度 prism > bomb > laserH > laserV の骨格を入れる）
- `src/engine/cascade.ts`: `StepResult.laserFires` → `fires` リネーム
- `src/engine/testHelpers.ts`: 接尾辞 `*` を追加
- `src/render/theme.ts` + `renderBoard.ts`: ボムアイコン（Path2D、色非依存）
- `src/game/gameLoop.ts`: `fires` を special でフィルタし、laser 分のみ従来の `LaserFire` に変換して `laserTiming` へ（`laserTiming.ts` の API 不変）。bomb は bloom 演出（パーティクル + 微小 trauma）。stats `bombsDetonated` 加算
- テスト追加: spec/06 §3 の bomb 生成・発火・チェーン・クリップ

**完了マーカー**: `src/engine/fires.ts` が存在し（`lasers.ts` は無い）、`Special` 型に `"bomb"` が含まれる

**検証ゲート**: `pnpm check && pnpm test` 緑（既存テストは機械的リネームのみで通る — specials の「5個=laser」ケースはフェーズ 11 で変更するため触らない）。手動: L 字マッチで角にボム生成 → 巻き込むと 3x3 がふわっと消える。ボム×レーザースワップで両発動

## フェーズ 11: プリズム

**作業**
- `Special` に `"prism"` 追加、`specials.ts` に直線 5+ 分岐（生成位置はレーザーと同規則）
- `fires.ts` に同 kind 全消し掃引
- `testHelpers.ts` に接尾辞 `#`、プリズムアイコン（Path2D）
- `gameLoop.ts`: prism は全対象一律フェード（スタッガーなし）+ チャイム音。stats `prismsFired` 加算
- `specials.test.ts` の「5 個直線 = laser 1 個」ケースを prism 期待に更新（意図的な仕様変更）
- `InfoDialog.tsx` の How to Play に特殊ピース 3 種の 1 行説明を追加
- spec/01 §4 との整合を確認

**完了マーカー**: `Special` 型に `"prism"` が含まれ、`specials.ts` に 5+ 分岐がある

**検証ゲート**: `pnpm check && pnpm test` 緑。手動: 5 個直線でプリズム生成 → マッチに巻き込むと同色が全部やわらかく消える。プリズム同士スワップで 2 色同時消し

## フェーズ 12: 実績 + テーマ解放

**作業**
- `src/game/achievements.ts` 新規: `AchievementDef`（`id` / `title` / `description` / `unlocksTheme?` / `isUnlocked(stats)`）+ spec/01 §9 の 10 実績 + `newlyUnlocked(stats, already)` + テスト
- `src/store/puzzleStore.ts`: `evaluateAchievements` を `applyStepResult` / `recordShuffle` の `batch()` 末尾に接続。解除分を `unlockedAchievements` と `achievementToasts` へ
- `src/components/AchievementToast.tsx` 新規（spec/03 §8: グラスチップ・直列・3.5 秒・pointer-events なし）
- `src/components/InfoDialog.tsx`: 「Goals」タブ追加（解除済み / 未解除一覧、条件は常時表示）
- `src/components/SettingsDialog.tsx`: `unlocksTheme` 付き実績が未解除のテーマパックをロック表示・選択不可に（解放条件の実績名を表示。ロックは選択 UI のみ — spec/01 §9 の割り当て方針参照）
- `unlocksTheme` 割り当て: フェーズ 9 の画像パック id を `prismatic` に設定（`pastel-bloom` は常時解放。「候補」実績は unlocksTheme なしで実装）

**完了マーカー**: `src/game/achievements.ts` と `AchievementToast.tsx` が存在し、InfoDialog に Goals タブがある

**検証ゲート**: `pnpm check && pnpm test` 緑。手動: コンボ 3 達成で「✦ Ripple」チップが 3.5 秒表示され消える（入力は遮られない）。リロードで解除状態が復元。未解放テーマが設定で選べない。旧 v1 の localStorage でも起動する

## フェーズ 13: デイリーチャレンジ「Today's Garden」

**作業**
- `src/engine/rng.ts`: `seedFromString`（FNV-1a 32bit）+ テスト
- `src/game/daily.ts` 新規: `todayKey(now?)` / `createDailyRun(dateKey)` / マイルストーン判定（500 / 2,000 / 5,000）+ テスト（spec/01 §8、spec/06 §3）
- `src/store/puzzleStore.ts`: `mode` / `daily` / `recordDailyBest`（カスケード終端でベスト更新時に保存。`batch()` 末尾で `evaluateAchievements` を呼ぶ — spec/02 §5）/ その日初プレイで `dailiesPlayed` +1
- `src/App.tsx`: `state.mode` の keyed 分岐で PuzzleGrid 再マウント。`PuzzleGrid` は props で `board / rng / nextId` を注入可能に（endless は従来どおり `Date.now()` シード）
- `src/components/PuzzleUI.tsx`: カレンダーボタン + デイリー小ダイアログ（日付・今日のベスト・花 3 輪・切替。spec/03 §3）

**完了マーカー**: `src/game/daily.ts` が存在し、store に `mode` がある

**検証ゲート**: `pnpm check && pnpm test` 緑。手動: デイリーに切替すると盤面が変わり、リロード・再切替で**同じ初期盤面**が出る。ベストスコアが残り花が灯る。エンドレスに戻れる。タイマー・「未達成」表示が一切ない

## フェーズ 14: 氷ギミック

**作業**
- `src/engine/testHelpers.ts`: 数字接尾辞（氷層数）対応（`boardFromStrings` / `boardToStrings` 対称）
- `src/engine/swap.ts` + `board.ts`: ice > 0 のスワップ無効ガード（`isValidSwap` / `hasValidMove` の整合）
- `src/engine/cascade.ts`: 消去ループに「ice > 0 → 減層して残す」分岐 + `StepResult.iceBreaks`
- `src/engine/ice.ts` 新規: `placeIce(board, rng, count)`（special なし宝石に決定的付与、`hasValidMove` 維持）
- `src/game/daily.ts`: `createDailyRun` が `placeIce(board, rng, 6)` を呼ぶ
- 描画: `Sprite.ice` + 宝石の上に半透明の霜、割れたら小パーティクル。stats `iceBroken` 加算
- テスト追加: spec/06 §3 の氷ケース一式

**完了マーカー**: `src/engine/ice.ts` が存在し、`cascade.ts` に減層分岐がある

**検証ゲート**: `pnpm check && pnpm test && pnpm build` 緑（既存テストは helper が `ice: 0` を埋めるため無傷であることを確認）。手動: デイリー盤面に霜宝石が出る。マッチで霜が割れ宝石が残り、もう一度消すと消える。霜宝石はスワップできず首振りで戻る。CPU 4x throttle で 60fps 維持

## 実装順の依存関係

```
フェーズ1 ─▶ フェーズ2 ─┬▶ 3 ─▶ 4 ─▶ 5 ─▶ 6 ─▶ 7 ─▶ 8 ─▶ 9      （テーマ系列）
                        └▶ 10 ─▶ 11 ─▶ 12 ─▶ 13 ─▶ 14           （ゲーム性系列）
                                     ▲
                        12 は 7（テーマ選択 UI）・9（画像パック）にも依存
```

- 2 系列はフェーズ 2 完了後なら並行可能。単独で進める場合は番号順（テーマ系列を先に — 本ロードマップの主目的）
- **フェーズ 12 は 7・9・10・11 のすべての完了後**に着手する（ロック表示はフェーズ 7 の RadioGroup、`unlocksTheme` の割り当て先はフェーズ 9 の画像パックが前提）。ゲーム性系列を先行させる場合は 11 の後に 13・14 へ進み、テーマ系列の 9 が終わってから 12 に戻ってよい（12 と 13・14 に依存関係はない）

## 元指示の要件トレーサビリティ

| 元指示の要件 | 対応する spec |
|---|---|
| 背景・宝石を任意の画像に差し替え可能なシステム | 04 §7、03 §5、フェーズ 3〜9 |
| テーマパックの追加が容易（世界観の切替で面白さを作る） | 04 §7.1「置くだけ」、themes/README.md（フェーズ 9） |
| 面白さの追加: 特殊ピース拡張 | 01 §4、フェーズ 10〜11 |
| 面白さの追加: 実績・テーマ解放（収集） | 01 §9、03 §8、フェーズ 12 |
| 面白さの追加: デイリーチャレンジ | 01 §8、フェーズ 13 |
| 面白さの追加: 盤面ギミック（氷） | 01 §7、フェーズ 14 |
| AI が実装しやすい区切りとチェックゲート | 本ファイル（完了マーカー + 検証ゲート + 1 コミット規模） |
| テスト→実装チェック→コミットのループ | 「進め方」節、`/next-phase` スキル |
| Calm ピラーの維持 | 00 §ピラー、各フェーズの Calm 検収観点 |
