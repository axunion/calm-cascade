# 02. アーキテクチャ仕様

## 1. 設計原則

1. **純粋なエンジンと副作用の分離** — マッチ3 のロジック（`engine/`）は DOM・Canvas・SolidJS に一切依存しない純関数群。Vitest で node 環境のままテストできる
2. **ロジックとビジュアルの分離** — 盤面（`Board`）はステップ解決の瞬間に即時更新され、描画側はスプライトをトゥイーンで追従させる。同期キーは宝石の安定 `id`
3. **リアクティビティは DOM のためだけに** — rAF ホットループは Solid の Proxy を触らない。store への書き込みはステップ境界のみ
4. **1 ファイル 1 関心・~300 行以内**（CLAUDE.md 規約）

## 2. ディレクトリ / モジュール構成

```
src/
  index.tsx                     # エントリ（既存）
  index.css                     # リセット・dvh レイアウト・テーマ CSS 変数
  App.tsx                       # 構成ルート: テーマ class 付与 + <PuzzleGrid/> + <JuiceOverlay/> + <PuzzleUI/>
  engine/                       # ★純関数のみ。DOM/Solid 依存禁止。全面テスト対象
    board.ts                    #   型定義、createBoard、idx ヘルパ、hasValidMove、reshuffle
    rng.ts                      #   mulberry32 / seedFromString（シード付き RNG）
    matches.ts                  #   findMatches（直線 3+ 検出。L/T 字は 2 グループで返す）
    specials.ts                 #   planSpecialSpawns（prism / bomb / laser 生成ルール）
    swap.ts                     #   isAdjacent / applySwap / isValidSwap（氷ガード含む）
    fires.ts                    #   resolveSpecialFires（BFS チェーン発火。旧 lasers.ts の一般化）
    cascade.ts                  #   resolveStep / applyGravity / spawnGems / 氷の減層
    scoring.ts                  #   stepScore（スコア式の単一情報源）
    ice.ts                      #   placeIce（デイリー盤面への氷配置）
  game/                         # 命令的・ブラウザ側・非リアクティブ
    gameLoop.ts                 #   フェーズ状態機械 + rAF オーケストレーション
    input.ts                    #   ポインタ入力状態機械（合成イベントで単体テスト可能な純度を保つ）
    animations.ts               #   Tween 型・イージング・updateTweens
    particles.ts                #   固定プールのパーティクルシステム
    juice.ts                    #   コンボ → JuiceEvent / ハプティクスパターン変換表
    audio.ts                    #   Web Audio シンセ（lazy 初期化・設定ゲート）
    daily.ts                    #   todayKey / createDailyRun（Date 依存はここだけの薄い層）
    achievements.ts             #   実績定義リスト + newlyUnlocked（stats → 判定の純関数）
  render/
    renderBoard.ts              #   グリッド背景・宝石スプライト（画像 / ベクタ分岐）・選択リング
    effects.ts                  #   ビーム・シェイク変換・リシャッフルフェード
    theme.ts                    #   組み込み（classic）の宝石パレット + 形状定義 + Theme 型
    themePack.ts                #   ThemeManifest 型 + validateManifest（unknown → ThemeManifest | null）
    themeRegistry.ts            #   import.meta.glob によるテーマパック発見・一覧・URL 解決
    themeLoader.ts              #   resolveTheme（ImageBitmap ロード・フォールバック・キャッシュ）
    scaledBitmaps.ts            #   cellSize×DPR 変化時のみ再構築する事前スケールキャッシュ
  store/
    puzzleStore.ts              #   ★createStore: score/combo/stats/settings/mode/daily/実績 + アクション
    persistence.ts              #   localStorage ロード/セーブ（スキーマ v2・1→2 マイグレーション）
  components/
    PuzzleGrid.tsx              #   ★canvas 要素・ループのライフサイクル・resize/DPR・ポインタバインド
    PuzzleUI.tsx                #   ★グラスモーフィズム HUD（スコア/コンボ）+ 下部トリガーボタン
    JuiceOverlay.tsx            #   DOM コンボテキストオーバーレイ
    AchievementToast.tsx        #   実績解除のグラスチップトースト（直列キュー）
    SettingsDialog.tsx          #   Kobalte Dialog: テーマパック選択 + 各トグル
    InfoDialog.tsx              #   Kobalte Dialog + Tabs: 遊び方 / 統計 / Goals
  styles/
    Puzzle.module.css           #   ★盤面フレーム・HUD グラス・オーバーレイアニメ・juice ティア
    dialogs.module.css          #   Kobalte dialog/tabs/radio のグラススタイル

themes/                         # リポジトリルート。バンドル型テーマパック置き場
  <name>/manifest.json          #   置くだけで themeRegistry が自動発見（index ファイル不要）
  <name>/*.png|webp             #   宝石 6 枚・背景（いずれも任意 — 色のみのパックも可）
```

★ = 元指示の必須 5 ファイル。名前はそのまま維持し、300 行規約を満たすためロジックを上記モジュールに分割する。

設定変更: `vite.config.ts` に `css: { modules: { localsConvention: 'camelCaseOnly' } }` を追加。

## 3. エンジンのデータモデル

```ts
// engine/board.ts
export const BOARD_SIZE = 8
export const GEM_KINDS = 6                    // 0..5

export type Special = 'none' | 'laserH' | 'laserV' | 'bomb' | 'prism'

export interface Gem {
  id: number          // セッション内で単調増加・一意。アニメーションの同期キー
  kind: number        // 0..5
  special: Special
  ice: number         // 0 = なし、1〜2 = 氷の層数（special と併存させない）
}

export type Board = (Gem | null)[]            // フラット配列 64 要素。index = row * 8 + col
export const idx = (row: number, col: number) => row * BOARD_SIZE + col
export interface Cell { row: number; col: number }
```

**選定理由**:
- フラット配列は `board.slice()` でクローンでき、テストでのスナップショットが容易
- `Uint8Array` にしない — 宝石に安定 `id` が必要（描画側が「特定の宝石」を落下越しにトゥイーンするため）。64 セルでは型付き配列の性能利点もない
- `special` を 7 番目の kind ではなく色付き宝石への**ペイロード**にする — レーザーが通常宝石として `kind` でマッチするため、「スワップでマッチに参加したら発動」が特別扱いなしで成立する

### RNG 注入

宝石を生成するすべてのエンジン関数は `Rng`（`() => number`、[0,1)）を引数に取る。
本番は `mulberry32(Date.now())`、テストは固定シード or スクリプト化したスタブを注入し、カスケードを決定的に再現する。

デイリーチャレンジ用に `seedFromString(s: string): number`（FNV-1a 32bit）を `engine/rng.ts` に置く。
`game/daily.ts` が `mulberry32(seedFromString("daily:" + dateKey))` で決定的な盤面と補充ストリームを作る
（`Date` を読むのは `game/daily.ts` の `todayKey()` だけ — エンジンには入れない）。

### 主要エンジン API

```ts
// engine/matches.ts
interface MatchGroup { cells: Cell[]; orientation: 'h' | 'v'; kind: number }
findMatches(board: Board): MatchGroup[]
// 行→列の順に 3 連以上の run を走査。L/T 字はセルを共有する 2 グループとして返す
// （重複消去は消去時に Set<number> で解決）

// engine/swap.ts
isValidSwap(board: Board, a: Cell, b: Cell): boolean
// 隣接 かつ 両方 ice なし かつ（スワップ後に findMatches が非空 または 両方特殊ピース）
// 「両方特殊ピース」= special !== 'none' 同士のすべての組合せ（spec/01 §4.4）

// engine/fires.ts（旧 lasers.ts の一般化）
type SpecialKind = Exclude<Special, 'none'>
interface SpecialFire { cell: Cell; special: SpecialKind }
resolveSpecialFires(board: Board, initialCleared: Set<number>): { cleared: Set<number>; fires: SpecialFire[] }
// BFS ワークリスト: マッチで消えるセル集合から開始し、含まれる特殊ピースを発火、
// 効果範囲（laser = 行/列、bomb = 3x3、prism = 同 kind 全セル）に含まれる特殊を追加発火。
// 各ピースは 1 回のみ → 必ず停止

// engine/scoring.ts
stepScore(clearedCount: number, combo: number): number    // = clearedCount * 10 * combo（式の単一情報源）

// engine/ice.ts
placeIce(board: Board, rng: Rng, count: number): Board
// デイリー盤面生成用。special なし宝石から決定的に選び ice を付与、hasValidMove を満たすまで再試行

// engine/cascade.ts
interface StepResult {
  board: Board
  clearedGems: { cell: Cell; gem: Gem }[]
  fires: SpecialFire[]                                     // { cell, special }
  specialSpawns: SpecialSpawn[]                            // { cell, special, kind }
  falls: { gem: Gem; from: Cell; to: Cell }[]
  spawns: { gem: Gem; to: Cell; fromAboveRows: number }[]  // 降ってくるアニメ用のオフセット
  matchGroups: MatchGroup[]                                // juice テキストの位置決め用
  iceBreaks: { cell: Cell; gem: Gem; remaining: number }[] // 消去の代わりに氷が 1 層減ったセル
}
resolveStep(board: Board, rng: Rng, swapTarget: Cell | null): StepResult | null
// null = 盤面安定（マッチなし）。1 ステップ = 消去 + 特殊連鎖 + 特殊生成 + 氷減層 + 重力 + スポーン。
// エンジン自身はループしない — ゲームループがアニメーションを挟みながら繰り返し呼ぶ
```

レーザーのビーム演出（掃引方向・スタッガー）は `orientation` を必要とするが、これは gameLoop 側で
`SpecialFire`（laser 分のみ）から変換して `laserTiming` に渡す — `laserTiming` の API は変えない。

## 4. ゲーム状態機械（gameLoop.ts が所有、非リアクティブ）

```
        ジェスチャ                有効               resolveStep != null
 IDLE ──────────────▶ SWAPPING ────────▶ RESOLVING ◀──┐
   ▲                      │                   │        │ (ステップごとに:
   │       無効スワップ    ▼                   │        │  消去アニメ → 落下アニメ)
   ├─────────────── SWAP_REJECT               │────────┘
   │  （戻りトゥイーン ~180ms）                │ resolveStep == null
   ├──────────────────────────────────────────┤
   └── SHUFFLING（!hasValidMove 時のみ自動）◀─┘
```

- **IDLE** — 入力を受け付ける唯一のフェーズ。他フェーズ中の入力は破棄（キューしない）
- **SWAPPING** — 2 宝石が互いのセルへトゥイーン（~160ms easeInOutQuad）。有効/無効は**トゥイーン開始前に判定済み**（アニメ前の盤面で `isValidSwap`）
- **SWAP_REJECT** — 同じ 2 スプライトが戻る（~180ms easeOutQuad + 4px ウィグル）。盤面は一度も変異していない
- **RESOLVING** — ステップごとのマイクロループ: `resolveStep` → 消去アニメ（~220ms + ビーム）→ 落下/スポーントゥイーン（落下距離に応じ 120ms + 40ms×距離）→ 完了したら再度 `resolveStep`。`null` が返ったら `hasValidMove` を確認し、false なら SHUFFLING、true なら IDLE へ。コンボ = このループのステップ数
- **SHUFFLING** — フェードアウト（200ms）→ `reshuffle()` → フェードイン（300ms）→ IDLE

## 5. SolidJS 統合 — 状態の 3 層

| 層 | 機構 | 内容 | 理由 |
|---|---|---|---|
| リアクティブ・共有 | `createStore`（puzzleStore.ts） | `score` / `combo` / `stats` / `settings` / `juiceEvents` | DOM が描画するものの単一情報源。PuzzleGrid と PuzzleUI の両方が消費 |
| リアクティブ・ローカル | コンポーネント内 signal | Dialog 開閉、アクティブタブ | UI 限定の関心事 |
| 非リアクティブ | gameLoop.ts の plain オブジェクト | `board` / `phase` / sprites Map / tween 配列 / パーティクルプール / 入力状態 / `settingsSnapshot` | 60fps × 数十回/frame の Proxy 読み取りはミッドレンジ端末で実測可能な無駄 |

### store の形

```ts
// store/puzzleStore.ts
type GameMode = 'endless' | 'daily'
interface DailyRecord { date: string; bestScore: number }   // 当日分のみ保持

interface PuzzleState {
  score: number
  combo: number                       // 表示用コピー（真値はループ側）
  mode: GameMode                      // 切替は PuzzleGrid の再マウントで反映（§8）
  daily: DailyRecord | null
  stats: {
    totalScore: number; bestCombo: number; gemsCleared: number
    lasersFired: number; bombsDetonated: number; prismsFired: number
    iceBroken: number; dailiesPlayed: number; gamesShuffled: number
  }
  unlockedAchievements: string[]      // 実績 id。解除は不可逆・永続化
  achievementToasts: { id: string; title: string }[]  // 表示待ちキュー（直列・セッション限り）
  settings: {
    theme: 'dark' | 'light'
    skin: string                      // テーマパック id。デフォルト "classic"（組み込みベクタ）
    reducedMotion: boolean            // OS 設定との OR で最終判定
    haptics: boolean
    colorBlindShapes: boolean
    sound: boolean
    particles: boolean
  }
  juiceEvents: JuiceEvent[]
}
```

実績評価は `applyStepResult` / `recordShuffle` / デイリーベスト更新の `batch()` 末尾で
`game/achievements.ts` の `newlyUnlocked(stats, already)` を呼ぶ（stats が変化する箇所 = ステップ境界のみ）。

### 2 つの世界の橋渡し

- **store → ループ（settings）**: `PuzzleGrid.tsx` の `createEffect` が settings スライスを plain なフリーズ済みオブジェクトへコピーし `loop.settingsSnapshot` に代入。ループは毎フレームゼロコストで読む
- **ループ → store（score/combo/stats）**: **ステップ境界でのみ** `batch()` に包んで setter を呼ぶ（カスケード 1 回につき数回。フレーム単位では絶対に書かない）

### juice イベントの経路（engine → DOM オーバーレイ）

```ts
interface JuiceEvent {
  id: number
  text: string
  tier: 'small' | 'medium' | 'large'
  xPct: number; yPct: number          // canvas ボックスに対する % 座標
}
```

1. ループがステップ解決時にマッチ重心（セル空間）→ **canvas ボックスの %** に変換（オーバーレイはピクセル同期不要になる）
2. `puzzleStore.pushJuice(event)` を呼ぶ（キュー上限 8、超過は古いものから破棄）
3. `JuiceOverlay.tsx`（canvas を正確に覆う `position: absolute` + `pointer-events: none` の div）が keyed な `<For>` で描画
4. 各要素は CSS アニメーション（float-up + fade、ティアでサイズ/色が変わる）を再生し、`animationend` で store アクションにより自己削除（reduced-motion 時は単純フェード + 1500ms の setTimeout フォールバック）

### Canvas ライフサイクル（PuzzleGrid.tsx）

- `onMount`: ループ生成・ポインタリスナ登録・rAF 開始
- `onCleanup`: rAF キャンセル・リスナ解除
- リサイズ: canvas ラッパーへの `ResizeObserver` → 「dirty フラグ」を立て、**rAF 内で 1 フレーム 1 回だけ消費**（タイマー debounce より安価で滑らか）
- DPR 対応・変化検知は [04-technical.md](./04-technical.md) 参照

## 6. rAF ループの形（単一ループ・責務固定）

```
frame(t):
  dt = clamp(t - last, 0, 50)   // バックグラウンド復帰でワープしない
  advancePhase(dt)              // 状態機械。resolveStep 呼び出し・トゥイーン登録・juice 発行
  updateTweens(dt); updateParticles(dt); updateShake(dt)
  render(ctx)                   // clear → シェイク translate → 盤面背景 → スプライト
                                //   → ビーム → パーティクル → 選択リング
```

## 7. 永続化（store/persistence.ts）

- キー: `localStorage["calm-cascade/v1"]`（キー名は据え置き — 単なる名前）。`SCHEMA_VERSION = 2`
- 対象: `settings` / `stats` / `unlockedAchievements` / `daily`。`score` / `combo` / `mode` / トーストはセッション限り
- **マイグレーション**: `version === 1` のペイロードは欠落フィールドをデフォルト補完して受理する
  （`settings.skin = "classic"`、新 stats 4 種 = 0、`unlockedAchievements = []`、`daily = null`）。
  既存ユーザーの設定・統計を絶対に消さない。マイグレーションは 1→2 の 1 段のみ。詳細スキーマは [04-technical.md](./04-technical.md) §7.5
- 破損・不明バージョンはデフォルトへフォールバック（try/catch 必須 — プライベートブラウジングで throw する環境がある）
- 保存: `createEffect` で serialize、**500ms debounce**
- 読み込み: store 生成時に 1 回

## 8. テーマパックの解決フローとモード切替

### テーマ解決（非同期 → plain オブジェクト）

原則: **テーマ解決は非同期、rAF ホットループは解決済みの plain な `Theme` オブジェクトだけを読む**。

1. `render/themeRegistry.ts` がモジュール初期化時に `import.meta.glob` で全 manifest を同期収集し、
   `validateManifest` を通らないパックは console.warn して一覧から除外（設定 UI に出ない = 選べない）
2. `PuzzleGrid.tsx` の createEffect（**skin と theme だけを読む専用 effect** — 他のトグル変更で再ロードさせない）が
   `resolveTheme(skin, mode)` を呼ぶ。完了までは組み込み `getTheme(mode)` を即時セットしておき、
   解決したら `renderOptions.theme` をフィールド書き換えで差し替える（世代トークンでレース防御）
3. `render/themeLoader.ts` は画像を `fetch → createImageBitmap` で並列ロード。
   **失敗は資産単位で null**（その宝石だけベクタ描画 / 背景だけ市松にフォールバック）。
   manifest 不明・skin 不明は組み込み classic に全体縮退。結果は `Map<skinId/mode, Theme>` にキャッシュ
4. 描画は `render/scaledBitmaps.ts` の事前スケールキャッシュを参照（[04-technical.md](./04-technical.md) §7.4）

### モード切替（endless ⇄ daily）

- `App.tsx` が `state.mode` を keyed な `<Show>` / `<Switch>` で分岐し、**PuzzleGrid を再マウント**する
- PuzzleGrid は props で `board / rng / nextId` を注入可能にする（endless = `mulberry32(Date.now())` の従来生成、
  daily = `game/daily.ts` の `createDailyRun(todayKey())`）
- ゲームループ・スプライト・入力状態はマウント時に全部作り直す（途中状態の移送はしない — 最も単純で確実）
