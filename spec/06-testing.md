# 06. テスト戦略（Vitest）

## 1. 方針

- **テスト対象**: `engine/` 全モジュール + `game/input.ts` + `game/juice.ts` + `game/daily.ts` + `game/achievements.ts` +
  `render/themePack.ts` + `render/themeRegistry.ts` + `render/themeLoader.ts`（`BitmapLoader` をスタブ注入 — node に
  ImageBitmap の実物はないため `{} as ImageBitmap` で足りる。ローダは中身を覗かない）+ `store/persistence.ts` —
  すべて純 TS または注入で DOM 不要。node 環境の Vitest がそのまま走る（jsdom・canvas モック不要。
  `import.meta.glob` は vitest が vite 経由で解決する）
- **テスト対象外（意図的）**: レンダリング（drawImage の見た目・DPR のクリスプさ含む）・rAF ループ・Solid コンポーネント。
  canvas モックや `@solidjs/testing-library` 追加は ROI が低く、実機確認（各フェーズの検証ゲート）でカバーする
- テストは実装と同時に書く。各テストは完全に自己完結（共有可変状態なし — CLAUDE.md 規約）
- 乱数は必ず注入（`mulberry32(固定シード)` またはスクリプト化スタブ）。`Date.now()` に依存するテストを書かない

## 2. テストヘルパ

```ts
// 盤面を「絵」として書けるフィクスチャヘルパ
boardFromStrings([
  'RRGB.PYG',
  'GBRP.YGR',
  ...
])
// 文字 → kind のマッピング、'.' = null、大文字に後置修飾で特殊 / 氷
// 特殊: 'R>' = laserH、'R^' = laserV、'R*' = bomb、'R#' = prism
// 氷:   'G1' = 氷 1 層の G、'G2' = 氷 2 層（special と氷は併存させない — 仕様どおり）
```

期待値側も文字列盤面で比較できるよう `boardToStrings(board)` を用意し、差分が図で見えるようにする。

## 3. モジュール別テストケース

### engine/matches.ts — findMatches

- 横 3 / 4 / 5、縦 3 / 4 / 5 をそれぞれ 1 グループで検出
- **L 字・T 字**: セルを共有する 2 グループとして返る（グループ統合しない）
- 離れた場所の同時マッチ 2 件を両方検出
- 盤面の 4 辺・4 隅に接するマッチ
- `null`（空セル）を跨いだ誤検出がない
- 安定盤面ではマッチゼロ

### engine/swap.ts — isValidSwap / applySwap

- 非隣接（斜め・遠隔）は無効
- 隣接だがマッチ不成立は無効
- 隣接でマッチ成立は有効
- **特殊ピース同士のスワップは色マッチなしでも有効**（laser×laser に加え laser×bomb / bomb×prism / prism×prism も）
- 特殊ピース単独をマッチ不成立位置へ動かすのは無効
- `applySwap` は新しい配列を返し、元の盤面を変異させない

### engine/specials.ts — planSpecialSpawns

- スワップ起点の横 4: `swapTarget` がグループ内 → そのセルに laserH
- カスケード起点の横 4 → 中央セル（`cells[floor(len/2)]`）に laserH
- カスケード起点の縦 4 → 最下段セルに laserV
- **5 個直線 → prism がちょうど 1 個**（位置規則はレーザーと同じ: swapTarget 優先 / 横=中央 / 縦=最下段）
- **L 字 / T 字（横・縦グループのセル共有）→ 共有セル（角）に bomb**（swapTarget に関係なく角固定）。4+3 の交差も bomb
- **横 4 と縦 4 が交差**するセル → ピース 1 個のみ・優先度 prism > bomb > laserH > laserV
- 生成セルはそのステップの消去集合から除外される（生成ピースが生き残る）
- 氷付き宝石のセルには生成しない

### engine/fires.ts — resolveSpecialFires

- laserH がその行 8 セルすべてを消す / laserV が列 8 セル
- **bomb が自セル中心 3x3 を消す。盤の隅では 2x2 にクリップ**される
- **prism が盤面上の同 kind 全宝石を消す**（発火セル自身を含む）
- マッチで消された特殊ピースが発火する
- **効果が別の特殊ピースに命中 → チェーン発火**（laser→bomb、bomb→prism 等の異種チェーン含む）
- 3 個以上のチェーンが停止する（無限ループしない）
- 発火済みピースのセルはちょうど 1 回だけ消去集合に入る
- 特殊同士スワップ → 交換後の位置から両方発動（laser 同士 = 十字消し、prism 同士 = 2 色全消し）

### engine/scoring.ts — stepScore

- `stepScore(3, 1) === 30` / `stepScore(5, 3) === 150` / `stepScore(0, 1) === 0`
- spec/01 §3 の 3 連鎖例: 30 + 80 + 150 = 260 の合算が cascade テストのシナリオと一致

### engine/ice.ts + 氷の減層（cascade / swap）

- 氷 1 層の宝石がマッチに巻き込まれる → `clearedGems` に入らず `iceBreaks` に入る（`remaining: 0`）。宝石は盤面に残り落下しない
- 氷 2 層 → 1 ステップ目で `remaining: 1`、同じマッチが残っていれば次ステップで `remaining: 0`、その次で消える
- ビーム / 爆風 / 全消しに巻き込まれた氷も同一ルール（消去 1 回 = 1 層）
- `isValidSwap`: 片方が ice > 0 → false（マッチが成立する配置でも）
- `hasValidMove`: 氷絡みスワップを有効手に数えない
- `placeIce`: 同一 rng で同配置（決定的）、special なし宝石のみに付与、配置後も `hasValidMove` を満たす

### engine/cascade.ts — resolveStep / applyGravity / spawnGems

- 1 ステップ: 消去 → 重力 → スポーンがシードで決定的に再現される
- 重力: 複数ギャップのある列が順序と gem `id` を保存して詰まる
- スポーン: 上から充填され `fromAboveRows` が正しい（アニメ用オフセット）
- **3 連鎖シナリオ**: コンボ 1→2→3 でステップが進み、スコアが `10 × 個数 × コンボ` の累積と一致
- 安定盤面で `resolveStep` が `null` を返す
- `StepResult.matchGroups` に juice 位置決め用のグループが入っている

### engine/board.ts — createBoard / hasValidMove / reshuffle

- `createBoard`: 200 シードで初期マッチなし + 有効手ありを常に満たす（プロパティ風）
- `hasValidMove`: 有効手あり盤面で true / **有効手ゼロの実 8x8 フィクスチャ**で false
- `reshuffle`: 200 シードで — 宝石の multiset（種類内訳 + 特殊）を保存 / 即時マッチなし / 有効手 ≥ 1

### game/input.ts — ポインタ状態機械（合成イベント注入）

- 9px 移動して up → タップ判定
- 11px 移動 → スワイプ判定・支配軸の方向が正しい（dx > dy なら水平）
- タップで選択 → 隣接セルタップでスワップ発行・選択解除
- 同一セル再タップで選択解除
- **同一セルへの 250ms 以内の再タップは無視**（debounce）
- 非隣接セルタップで選択が移動する
- `pointercancel` で状態が NONE にリセット
- 2 本目の指（別 pointerId）のイベントを無視

### game/juice.ts — ティア変換表

- コンボ 1 → イベントなし、2–3 → small、4 → medium（FABULOUS!!）、5 → medium、6+ → large（TRANSCENDENT!!）
- テキスト・ティア・trauma 加算値のマッピングが表どおり

### game/daily.ts + engine/rng.ts — デイリーの決定性

- `seedFromString("daily:2026-07-15")` が固定値（スナップショット）で、別日・別プレフィックスと異なる
- `createDailyRun(dateKey)` を 2 回呼ぶ → `boardToStrings` が完全一致（決定性）
- 生成盤面が「初期マッチなし + 有効手あり」を満たす
- マイルストーン判定: スコア 2,500 → 2 輪（500 / 2,000 達成、5,000 未達）。境界値 500 ちょうど → 1 輪

### game/achievements.ts — newlyUnlocked

- bestCombo 3 の stats → `["ripple"]` のみ。`already` に含めると空配列
- 閾値境界: gemsCleared 999 → 未解除、1,000 → 解除
- 複数同時解除（1 ステップで 2 条件を跨いだ場合）が両方返る
- 全実績の `isUnlocked` がゼロ値 stats で false（初期状態で誤発火しない）

### render/themePack.ts — validateManifest

- 正常系の manifest が型どおり通る（`background: undefined` → null 正規化）
- `manifestVersion` 不一致 / `displayName` 空 / `gems` の長さ ≠ 6 / `colors.gemColors` の長さ ≠ 6 → null
- `colorsLight` は存在するキーだけ型チェックされる（部分上書き）

### render/themeRegistry.ts — 一覧と URL 解決

- `listSkins()` の先頭が常に `classic`、同梱パックが id 昇順で列挙される
- `getManifest("classic")` / 未知 id → null（ローダが組み込みへ短絡する合図）
- `getAssetUrl` の未知ファイル → null
- `getUiAccent`: mode = light で `colorsLight.uiAccent` が優先される

### render/themeLoader.ts — resolveTheme（BitmapLoader スタブ注入）

- 全画像成功 → `theme.gems` にビットマップが入る
- 1 枚だけ失敗（null）→ そのスロットのみ null（残りは画像）— 資産単位フォールバック
- 未知 skin → `getTheme(mode)` と同一参照を返す
- light モード → `colorsLight` がマージされた色になる
- 同一 (skin, mode) の 2 回目呼び出しで loader が呼ばれない（キャッシュ）

### store/persistence.ts — v2 マイグレーション

- version 1 ペイロード → `settings.skin: "classic"`・新 stats 4 種 = 0・`unlockedAchievements: []`・`daily: null` が補完される
- v2 ペイロードのラウンドトリップ（save → load で同値）
- `unlockedAchievements` が非配列などの破損 → デフォルトへフォールバック
- 既存: スキーマ不明・破損 JSON・private browsing throw の各フォールバック（従来テスト維持）

## 4. 実行

```bash
pnpm test          # vitest run（CI / pre-push 想定）
pnpm vitest        # watch モード（開発中）
```

- `vite.config.ts` に `test: { environment: 'node' }` を明示する（フェーズ 0 で設定）。vite-plugin-solid が既定で jsdom 環境を要求するが jsdom は未インストールで、テスト対象は純 TS のため node 環境で十分
- テストが 1 つも存在しない状態では `vitest run` は exit 1 になる（`pnpm test` のゲートはフェーズ 1 から有効）
- lefthook の pre-commit は Biome、テストはフェーズゲート（[05-implementation-plan.md](./05-implementation-plan.md)）で必ず全緑にしてから次フェーズへ進む
