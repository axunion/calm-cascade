# 04. 技術仕様 — Canvas / アニメーション / 入力 / パフォーマンス

## 1. Canvas とレンダリング

### 1.1 devicePixelRatio（DPR）対応

- 表示サイズは CSS が決める（コンテナ幅 100%・aspect-ratio 1:1）
- backing store は `canvas.width = cssWidth * dpr` / `canvas.height = cssHeight * dpr`、描画前に `ctx.setTransform(dpr, 0, 0, dpr, 0, 0)` — 以降の描画コードは **CSS px 座標系**のまま書ける
- **DPR 変化の検知**（ピンチズーム・モニタ間移動は resize イベントを発火しないブラウザがある）:
  - `matchMedia(`(resolution: ${dpr}dppx)`)` のリスナを張り、発火のたびに再アーム
  - ResizeObserver ハンドラでも毎回 DPR を再チェック（ベルト & サスペンダー）
  - 変化時は backing store を作り直す（怠ると盤面がぼやける）

### 1.2 リサイズ処理

- canvas ラッパーに `ResizeObserver`。ハンドラは **dirty フラグを立てるだけ**
- rAF ループの先頭でフラグを消費し、1 フレームに 1 回だけ実サイズ再計算・backing store 再生成を行う（タイマー debounce より安価で、リサイズ中も滑らか）
- 盤面サイズはコンテナの観測サイズから導出する。**`window.innerHeight` は使わない**（iOS Safari の URL バー伸縮対策 — バーの出入りは通常の ResizeObserver 経路に乗る）

### 1.3 描画順（render/renderBoard.ts + effects.ts）

```
clear → シェイク translate → 盤面背景（背景画像 or セルのうっすらした市松） → 宝石スプライト
     → ビーム → パーティクル → 選択パルスリング
```

- 宝石はテーマパックの解決結果で分岐する:
  - **画像あり**（`theme.gems[kind] !== null`）→ `render/scaledBitmaps.ts` の事前スケール済み canvas を `drawImage`
  - **画像なし** → 従来どおり `render/theme.ts` の形状定義（Path2D）+ `theme.gemColors[kind]` で fill
  - 既存の translate / scale / alpha（トゥイーン）は両経路で共通に効く
- 背景も同様: `theme.background` があれば盤面全体に 1 回の `drawImage`、なければ市松の fillRect ループ。
  シェイク translate の内側なので画像も一緒に揺れる（現仕様どおり）
- 特殊ピースのアイコン（矢印・ボム・プリズム）は画像の上にも常時ベクタ描画（色非依存キュー — [03-ui-ux.md](./03-ui-ux.md) §6）
- 形状・アイコンはセルサイズに対する比率で定義（リサイズ耐性）
- テキストは Canvas に一切描かない（DOM オーバーレイの責務）

**shapeCache の罠**: `gemShapePath(kind, cellSize)` のキャッシュは「直近の cellSize 1 値」で無効化される。
同一フレームで複数の cellSize を渡すと毎フレーム全再構築になる — 縮小描画（色覚ミニグリフ等）は
必ず `ctx.scale` で行い、`gemShapePath` は常に単一の cellSize でのみ呼ぶこと。

## 2. アニメーションシステム（game/animations.ts）

### 2.1 トゥイーンエンジン

```ts
interface Tween {
  sprite: Sprite                       // { x, y, scale, alpha, kind, special }（セル空間 float）
  prop: 'x' | 'y' | 'scale' | 'alpha'
  from: number; to: number
  elapsed: number; duration: number
  ease: (t: number) => number
  onDone?: () => void
}
```

- 単一の `updateTweens(tweens, dt)` を rAF で回す。**delta-time ベース**（`dt = clamp(t - last, 0, 50)` — バックグラウンドタブ復帰でカスケード途中がワープしない）
- スプライト座標は**セル空間の float**（ピクセルではない）。リサイズしてもトゥイーンが壊れない
- 完了トゥイーンは swap-remove（配列末尾と交換して pop）— フレーム内アロケーションゼロ

### 2.2 イージング一覧

| 対象 | イージング | 時間 |
|---|---|---|
| スワップ / 戻り | easeInOutQuad / easeOutQuad | 160ms / 180ms |
| 重力落下 | easeInQuad + 着地で ~0.08 セルの小バウンド 1 回 | 120ms + 40ms × 落下距離 |
| 消去 | スケール 1 → 1.15 → 0 + アルファフェード（easeOutQuad） | 220ms |
| リシャッフル | 全体フェードアウト / イン | 200ms / 300ms |

reduced-motion 時: すべて 80ms の線形クロスフェードに縮退。バウンドなし。

### 2.3 パーティクル（game/particles.ts）

- **固定プール 256 個**の struct 配列 `{ active, x, y, vx, vy, life, maxLife, size, hue }` + カーソル — ホットループで GC ゼロ
- マッチ消去時: 宝石ごとに中心から 6〜10 個バースト。重力 + 空気抵抗、`alpha = life / maxLife`
- 描画は `globalCompositeOperation: 'lighter'` のソフト円（柔らかいグロー）
- プール枯渇時は最古を黙って上書き。**絶対にアロケートしない**
- 設定 `particles: false` / reduced-motion で完全無効

### 2.4 画面シェイク（trauma モデル）

- `trauma ∈ [0, 1]`、毎フレーム `trauma -= dt × 1.8` で線形減衰
- 振幅 = `trauma² × 6px`。盤面描画の前後で `ctx.translate(noise, noise)`（**canvas のみ** — DOM HUD は動かさない。上質に見え、レイアウトジャンクも避けられる）
- コンボティアで加算: medium +0.25、large +0.45
- reduced-motion で無効

### 2.5 ビーム演出（render/effects.ts）

- レーザー発動時: 行/列全体の角丸矩形を 250ms で描画 — 幅 0 → 0.6 セル（easeOutQuad）、アルファ 0.9 → 0
- 中心に明るいコアライン + 宝石色の外側グラデーション
- ビームに撃たれる宝石は発射元からの距離 × 18ms のスタッガーで順に消去開始（掃引して見える）
- チェーン発火したレーザーは、掃引ビームが到達した時点で自分のビームを開始する

## 3. タッチ入力（game/input.ts）

### 3.1 方針: Pointer Events のみ

- `pointerdown / pointermove / pointerup / pointercancel` を canvas に登録。**touch イベントは使わない**
  - mouse / touch / pen が統一される
  - `touchmove` の passive-by-default 罠（`preventDefault()` が黙って効かない）を回避
- CSS `touch-action: none`（canvas のみ）がスクロール・ズームをコンポジタレベルで抑止
- `pointerdown` で `setPointerCapture(pointerId)` — 指が canvas 外に出てもジェスチャが継続
- 最初のアクティブ pointerId だけを追跡。2 本目以降の指は無視
- `click` / `touchstart` を並行して張らない（Android の合成 mouse イベントによる二重発火防止）

### 3.2 状態機械

```
 NONE ── pointerdown（セル上）──▶ PRESSED { startXY, startCell, pointerId }
 PRESSED ── pointermove, hypot(dx,dy) > 10px ──▶ スワイプ確定（支配軸方向の隣へ trySwap）──▶ CONSUMED
 PRESSED ── pointerup, 移動 ≤ 10px ──▶ タップ処理 ──▶ NONE
 PRESSED / CONSUMED ── pointerup | pointercancel ──▶ NONE
```

- **スワイプ**: 閾値 10px（CSS px）を最初に超えた move で方向 = |dx| vs |dy| の支配軸。同一ジェスチャ内の以降の移動は無視（CONSUMED）
- **タップタップ**:
  - 未選択 → `startCell` を選択（パルスリング表示）
  - 選択中 + 4 近傍セルをタップ → `trySwap(selected, tapped)`、選択解除
  - 選択中 + 同一セル → 選択解除
  - 選択中 + 非隣接セル → 選択を移動
- **ダブルタップ debounce**: 同一セルへの 250ms 以内の再タップは無視（選択→解除のチラつき防止。iOS のダブルタップズーム残滓対策の保険にもなる）
- 発行されたスワップはループが `phase === IDLE` のときのみ受理（input モジュール自身はフェーズを知らない — 合成イベントを食わせて単体テストできる純度を保つ）

### 3.3 座標 → セル変換

```ts
const r = canvas.getBoundingClientRect()
const col = Math.floor((e.clientX - r.left) / (r.width / 8))
```

- 入力計算は **CSS px のみ**。DPR は backing store にしか影響しない
- 盤面パディング（ガター）内のタップは reject する（clamp して受理しない）

## 4. パフォーマンス予算

- 目標: **ミッドレンジモバイルで 60fps**（フレーム 16.6ms、描画 + 更新で ~8ms 以内を目安）
- 対策一覧:
  - rAF ホットループは Solid の Proxy を読まない（settings は plain snapshot、書き込みはステップ境界の `batch()` のみ）
  - フレーム内アロケーションゼロ（トゥイーン swap-remove・パーティクル固定プール・一時オブジェクト再利用）
  - 描画は毎フレーム全消去 + 全描画のシンプル構成（8x8 + パーティクルは十分軽い。ダーティ矩形などの複雑化はしない）
  - `backdrop-filter` を canvas に重ねない
  - 検証方法は [05-implementation-plan.md](./05-implementation-plan.md) の各フェーズの検証ゲート参照（Canvas 描画に触れるフェーズ 6・14 で Chrome DevTools の CPU 4x throttle + Performance パネル）

## 5. サウンド（game/audio.ts）

- **Web Audio API・外部音源ファイルなし**（シンセ生成のみ）。バンドルが軽く、ロード待ちゼロ
- `AudioContext` は**初回ユーザージェスチャで lazy 初期化**（iOS Safari の autoplay 制約で必須）。`ctx.state === 'suspended'` なら `resume()`
- 音のデザイン（癒し系）:
  - マッチ音: 柔らかいサイン波 + 短い減衰エンベロープ（ADSR の A=5ms, R=300ms 程度）。ペンタトニックスケール上の音程
  - コンボ: ステップが上がるごとに音程を上昇（1 → 2 → 3 連鎖で上行フレーズになる）
  - レーザー: 低めのスウィープ（周波数を 300ms でグライド）
  - アンビエントパッド（任意・第 2 優先）: 極小音量のロングトーンをループ
- 発音はステップ境界のみ（ハプティクスと同じフック点 — `game/juice.ts` がイベントを配る）
- `settings.sound: false` で GainNode をミュート（コンテキストは破棄しない）

## 6. ハプティクス

- `navigator.vibrate?.(pattern)` — 存在チェック + `settings.haptics` ゲートの 5 行ヘルパ（抽象層は作らない）
- パターン: マッチ 10ms、コンボティア上昇 20ms
- iOS Safari は非対応（`navigator.vibrate` が undefined）— 自然に no-op になる

## 7. テーマパック技術仕様

### 7.1 配置と発見

- テーマパックはリポジトリルート `themes/<name>/` に置く。`<name>`（ディレクトリ名）がそのままパック id
  （manifest に id は持たせない — 重複・不一致の余地を消す）
- 発見は `render/themeRegistry.ts` の `import.meta.glob`（root 絶対パターン）:
  - `"/themes/*/manifest.json"` — eager import（微小 JSON なので同期バンドル）
  - `"/themes/*/*.{png,webp,jpg,jpeg}"` — `query: "?url"`（URL 文字列のみバンドル。実データは選択時に初めてダウンロード）
- `public/` 配下は glob 対象にできないため使わない。root 絶対 glob は dev / build / vitest（node）すべてで機能する
- ディレクトリを置くだけで一覧に出る。index ファイルの手動保守はしない

### 7.2 manifest スキーマ（`themes/<name>/manifest.json`）

TypeScript 型（`render/themePack.ts`）が正:

```ts
interface ThemePackColors {
  gemColors: string[]       // 必須・長さ 6。パーティクル色・ビーム色・ベクタ fallback 塗り色を兼ねる
  boardTileA: string        // 背景画像なし時の市松 A / 画像失敗時 fallback
  boardTileB: string
  selectionRing: string
  uiAccent?: string         // CSS 変数 --accent の上書き。省略時は CSS デフォルト
}

interface ThemeManifest {
  manifestVersion: 1
  displayName: string                   // 設定 UI の表示名
  gems: (string | null)[]               // 長さ 6。同ディレクトリ相対のファイル名。null = ベクタ形状で描画
  background: string | null             // 盤面全体の背景画像。null = 市松
  colors: ThemePackColors
  colorsLight?: Partial<ThemePackColors> // light モード時の部分上書き。省略時は colors をそのまま使用
}
```

- **ハイブリッド許可**: `gems` の一部だけ画像・残り null（ベクタ）は正式仕様（フォールバック経路と同一コードパス）
- バリデーション: `validateManifest(value: unknown): ThemeManifest | null` — 手書きチェックのパース関数
  （zod 等の依存追加はしない）。不正は null を返し、`background: undefined` は null に正規化する。
  不正な manifest は console.warn して一覧から除外（設定 UI に出ない = 選べない）。色値の hex 形式までは検証しない
- **レーザー矢印等の特殊ピースアイコンは manifest で定義できない**（意図的 — a11y キューをテーマ作者が壊せない）
- 推奨画像: 256×256 の webp / png（透過）。詳細はテーマ作者向け `themes/README.md` に記載

### 7.3 ロードとフォールバック（render/themeLoader.ts）

```ts
type BitmapLoader = (url: string) => Promise<ImageBitmap | null>   // テスト時の注入点
resolveTheme(skinId: string, mode: ThemeMode, loader?: BitmapLoader): Promise<Theme>
```

- 実装: `fetch → blob → createImageBitmap`。**あらゆる失敗は null**（throw しない・ユーザー通知しない・console.warn のみ）
- フォールバックは**資産単位**: 宝石 1 枚の失敗 → その宝石だけベクタ。背景の失敗 → 市松。
  manifest 不明 / skin 不明 → 組み込み `getTheme(mode)` に全体縮退
- `settings.skin` の値は失敗しても巻き戻さない — パックが後で直れば次回ロードで復活する（最も単純）
- 結果は `Map<"skinId/mode", Theme>` にキャッシュ（dark/light トグルやスキン往復で再デコードしない）
- mode = light のとき `colors` に `colorsLight` をスプレッドマージしてから解決する

### 7.4 事前スケールキャッシュ（render/scaledBitmaps.ts）

ImageBitmap を毎フレーム縮小 drawImage しない（ミッドレンジモバイルの縮小コスト・DPR ぼやけ対策）。

- `(theme 参照, round(cellSize × dpr))` が変わった時だけオフスクリーン canvas に再スケール —
  既存 shapeCache と同一の無効化パターン。**フレーム内は lookup + drawImage のみ**（§4 アロケーション規約に準拠）
- 宝石: `cellPx = round(cellSize × 0.9 × dpr)` の正方 canvas。背景: 盤面実ピクセルサイズの canvas
- 描画側は CSS px 座標のまま `drawImage(canvas, dx, dy, cssSize, cssSize)` — ctx の DPR transform で
  1:1 デバイスピクセルになり、クリスプかつ縮小コストゼロ
- `RenderOptions` に `dpr` フィールドを追加し、PuzzleGrid のリサイズ処理が書き込む

### 7.5 永続化スキーマ v2（store/persistence.ts）

```ts
const SCHEMA_VERSION = 2   // STORAGE_KEY "calm-cascade/v1" は据え置き（キー名は単なる名前）

interface PersistedPayload {
  version: 2
  settings: PuzzleSettings          // skin を含む
  stats: PuzzleStats                // bombsDetonated / prismsFired / iceBroken / dailiesPlayed を含む
  unlockedAchievements: string[]
  daily: DailyRecord | null         // { date: "YYYY-MM-DD", bestScore: number }
}
```

- **1→2 マイグレーション**: `version === 1` は欠落フィールドをデフォルト補完して受理
  （`skin: "classic"`、新 stats = 0、`unlockedAchievements: []`、`daily: null`）。既存の設定・統計は消さない
- 存在しない skin id（パックが削除された等）は永続化層では関知しない — `resolveTheme` が classic に縮退する

## 8. 既知リスクと対策（実装時チェックリスト）

| # | リスク | 対策 |
|---|---|---|
| 1 | `touch-action: none` を body に付けると Kobalte Dialog のスクロール・ディスミスが壊れる | canvas 要素のみにスコープ。バウンス抑止は `overscroll-behavior: none` を html/body に |
| 2 | iOS Safari の `100vh` が URL バーを含む | `100dvh` + `100vh` フォールバック。サイズはコンテナの ResizeObserver から取得 |
| 3 | `touchmove` の passive-by-default で preventDefault が無効 | Pointer Events + CSS touch-action で回避。touch リスナを足す場合は必ず `{ passive: false }` |
| 4 | DPR 変化（ピンチズーム・モニタ移動）で盤面がぼやける | matchMedia(resolution) 再アーム + ResizeObserver 内で DPR 再チェック |
| 5 | ホットループの store Proxy 読み取りで 60fps 未達 | 状態 3 層アーキテクチャで構造的に禁止（[02-architecture.md](./02-architecture.md)） |
| 6 | バックグラウンド復帰で dt が数秒になりアニメがワープ | `dt ≤ 50ms` クランプ |
| 7 | Android の合成 mouse イベントで入力二重発火 | Pointer Events のみ + キャプチャ済み pointerId 以外を無視 |
| 8 | Canvas テキストの品質・a11y 問題 | テキストは全部 DOM オーバーレイ（設計で回避済み） |
| 9 | `backdrop-filter` × 再描画 canvas の合成コスト | HUD は canvas の下に並べる + `@supports` フォールバック |
| 10 | AudioContext が autoplay 制約で始動しない | 初回ジェスチャで lazy 初期化 + resume |
| 11 | localStorage がプライベートブラウジングで throw | 全アクセスを try/catch + メモリフォールバック |
| 12 | テーマ画像のロード/デコード失敗で盤面が壊れる | 資産単位フォールバック（§7.3）— 失敗した宝石だけベクタ、manifest 不正は classic 縮退 |
| 13 | 画像の毎フレーム縮小 drawImage / 複数 cellSize の gemShapePath 呼び出しでフレーム予算超過 | 事前スケールキャッシュ（§7.4）+ 縮小は ctx.scale で行う（§1.3 の罠） |
| 14 | スキーマ v2 バンプで既存ユーザーの stats が消える | version === 1 をデフォルト補完で受理する 1→2 マイグレーション（§7.5）。reject しない |
