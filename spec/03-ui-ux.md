# 03. UI / UX 仕様

## 1. レイアウト — ボトムヘビー・片手操作

モバイル縦持ちを既定とし、親指の可動域（画面下 1/3）に操作要素を集約する。

```
┌─────────────────────────┐
│      （フレキシブル余白）  │  ← 上部はブランドロゴ程度。操作要素なし
│                         │
│  ┌───────────────────┐  │
│  │                   │  │
│  │   Canvas 盤面      │  │  ← 幅 100%・アスペクト比 1:1
│  │   （8x8 グリッド）  │  │     + JuiceOverlay（同サイズで重ねる）
│  │                   │  │
│  └───────────────────┘  │
│                         │
│  ┌───────────────────┐  │
│  │  Score    Combo    │  │  ← グラスモーフィズム HUD
│  └───────────────────┘  │
│  ┌─────┐ ┌─────┐ ┌─────┐│
│  │ⓘ 情報│ │📅 日替│ │⚙ 設定││  ← Kobalte トリガーボタン（44px 以上）
│  └─────┘ └─────┘ └─────┘│
└─────────────────────────┘
```

### CSS 設計

- ルート: `height: 100dvh`（直前の行に `100vh` フォールバック）、CSS Grid 1 カラム
  `grid-template-rows: 1fr auto auto`（余白 / 盤面 / HUD+ボタン）
- 盤面サイズ: `width: min(100%, calc(100dvh - HUD予算))` + `aspect-ratio: 1`。縦長端末では幅 100%、横長・デスクトップでは高さ基準に自動で収まる
- `html, body`: `overscroll-behavior: none`（バウンス抑止）、`margin: 0`、スクロールなし
- `touch-action: none` は **canvas 要素のみ**に付与。body に付けると Kobalte Dialog 内のスクロールやディスミス操作を壊す（[04-technical.md](./04-technical.md) リスク 1）
- セーフエリア: 下部ボタン列に `padding-bottom: env(safe-area-inset-bottom)`

### デスクトップへのスケール

モバイルファーストで書き、`@media (min-width: 768px)` で:
- 盤面の最大幅を `min(560px, 80dvh)` 程度に制限し中央寄せ
- HUD とボタンは盤面幅に揃える
- ホバー状態（`@media (hover: hover)` ガード付き）を追加

## 2. HUD — グラスモーフィズム

- 半透明背景 + `backdrop-filter: blur(12px)` + 1px の半透明ボーダー + 大きめの角丸
- **canvas とは重ねない**（下に並べる）— 毎フレーム再描画される canvas の上の blur はミッドレンジ Android で合成コストが跳ね上がる
- `@supports not (backdrop-filter: blur(1px))` でほぼ不透明な背景色にフォールバック
- 表示内容: Score（数値はカウントアップアニメーション）、Combo（連鎖中のみ強調表示）
- スコア数値は `font-variant-numeric: tabular-nums` で桁ブレを防ぐ

## 3. Kobalte コンポーネント構成

| UI | コンポーネント | 内容 |
|---|---|---|
| 設定 | `Dialog`（SettingsDialog.tsx） | **テーマパック選択（Kobalte `RadioGroup`）** + ダーク/ライト・モーション低減・ハプティクス・色覚サポート・サウンド・パーティクルの各トグル（Kobalte `Switch`） |
| 情報 | `Dialog` + `Tabs`（InfoDialog.tsx） | タブ 1「How to Play」: 図解 3 ステップ程度の簡潔な説明。タブ 2「Stats」: 統計一覧。タブ 3「Goals」: 実績一覧（解除済み/未解除。未解除も条件をそのまま表示） |
| デイリー | `Dialog`（PuzzleUI 内の小ダイアログ） | 日付・今日のベスト・花 3 輪（🌸 のマイルストーン表示）・モード切替ボタン。カウントダウンや「未達成」表示は置かない |
| トリガー | `Button` | lucide-solid の `Info` / `Settings` / `CalendarDays` アイコン |

- テーマパック選択に `Select` ではなく `RadioGroup` を使う理由: 選択肢が少なく、ボトムシート内で全選択肢が見える・popover の z-index/ポータル問題がない・44px タッチターゲットを確保しやすい
- 未解放のテーマパック（実績 `unlocksTheme` で解放されるもの）は RadioGroup 上でロック表示（鍵アイコン + 解放条件の実績名）にし、選択不可にする

- Dialog はモバイルでは下から出るボトムシート風、デスクトップでは中央モーダル（CSS で切替）
- Dialog 表示中はゲーム入力が自然に遮断される（オーバーレイが canvas を覆う）。加えてループ側も IDLE 以外と同様に入力を無視してよい
- Kobalte の a11y（フォーカストラップ・Esc 閉じ・aria 属性）をそのまま活かす。独自実装で上書きしない

## 4. タッチターゲット

- すべてのボタンは **最小 44x44px**（アイコン自体は 24px、パディングで確保）
- 下部ボタン間の間隔は 8px 以上（誤タップ防止）
- 盤面のセルは 8x8 で画面幅いっぱいのため、375px 幅端末でもセルあたり ~44px を確保できる

## 5. テーマ — 2 軸: ダーク/ライト × テーマパック（skin）

テーマは直交する 2 軸で構成する:

- **ダーク / ライト（mode）**: 従来どおり。CSS 変数をルートに定義し、`data-theme="dark" | "light"` 属性で切替。`App.tsx` が store の `settings.theme` を購読して属性を付与。初期値は `prefers-color-scheme` を尊重し、ユーザーが設定で変更したら永続化した値を優先
- **テーマパック（skin）**: `settings.skin` で選択。宝石画像・背景画像・宝石パレット・盤面タイル色・選択リング色・UI アクセント色を丸ごと差し替える（manifest の仕様は [04-technical.md](./04-technical.md) §7）

### skin 軸のルール

- 組み込み `"classic"` は現行のベクタ描画テーマ（dark/light 2 パレット）。常に選択肢の先頭にあり、画像パックのロード失敗時のフォールバック先でもある
- テーマパックは `colors` 1 セット + 任意の `colorsLight`（light モード時の部分上書き）を持つ。dark/light 両対応は強制しない
- `uiAccent` が定義されたパックは、CSS 変数 `--accent` をインラインスタイルで上書きする（`App.tsx` の createEffect。パック切替・classic 復帰で `removeProperty`）
- **Canvas 側の色の単一情報源は解決済み `Theme` オブジェクト**（`render/theme.ts` の型）。エフェクト（パーティクル・ビーム）は `theme.gemColors` を参照するため、パックの色が自動で反映される
- 一部の実績はテーマパックを解放する（[01-game-design.md](./01-game-design.md) §9）。未解放パックは設定 UI でロック表示
- トーン & マナー（classic および同梱パックの基準): 癒し系 — 低彩度の背景、柔らかいグラデーション、パステル寄りの宝石色、丸いフォルム。ネオン・高コントラストの警告色は使わない

## 6. アクセシビリティ

### prefers-reduced-motion

- `matchMedia('(prefers-reduced-motion: reduce)')` と設定トグルの **OR** で最終判定
- 低減時: 画面シェイク無効、パーティクル無効、全トゥイーンを 80ms の線形クロスフェードに短縮、juice テキストは float-up なしの単純フェード
- **論理的なゲーム進行は同一**（連鎖のテンポが変わるだけで結果は変わらない）

### 色覚多様性対応

- 宝石は **色 + 形状** の 2 チャネルで識別する（丸・三角・四角・菱形・星・雫 の 6 形状）
- ベクタ宝石（classic / 画像なしスロット）は形状を常時描画する
- トグル `colorBlindShapes` は形状の**強調度**を上げるオプション。描画仕様:
  - **ベクタ宝石 + ON**: fill 後に同じ Path2D を白系（`rgba(255,255,255,0.85)`）・`lineWidth = cellSize × 0.05` で stroke（輪郭強調）
  - **画像宝石 + ON**: drawImage 後、中央に kind の形状を**ミニグリフ**（約 0.45 倍、白 fill + 細い暗色 stroke）として重ねる — 画像テーマでも形状チャネルが機能する
  - **OFF**: ベクタは形状そのもの、画像はそのまま
- 特殊ピースのアイコン（レーザーの行/列矢印・ボム・プリズムのマーク）は**色非依存キュー**として常時描画し、テーマパックからは上書きできない（テーマ作者が a11y を壊せない）

### その他

- Dialog / Tabs / Switch は Kobalte 準拠で WAI-ARIA 対応
- スコア更新は HUD 内の `aria-live="polite"` 領域で通知（連鎖中の連続更新はステップ境界のみ）
- Canvas 自体には `role="application"` と簡潔な `aria-label` を付与（盤面の完全な読み上げ対応は将来構想）
- フォントサイズは rem 基準、OS のフォントスケールに追従

## 7. マイクロインタラクション

| 対象 | 演出 |
|---|---|
| ボタン押下 | `transform: scale(0.96)` + 100ms のイーズ（`:active`） |
| 選択中セル | Canvas 上で柔らかいパルスリング（1.2s ループ、reduced-motion 時は静的リング） |
| Dialog 開閉 | フェード + 8px スライド（150ms / 200ms） |
| テーマ切替 | 全 CSS 変数を 300ms でクロスフェード（`transition: background-color, color`） |
| スコア加算 | 数値カウントアップ（~400ms）+ 一瞬のグロー |

## 8. 実績トースト（AchievementToast.tsx）

Calm 準拠の控えめな通知。JuiceOverlay と同系の DOM オーバーレイで、Canvas には描かない。

- 盤面上端に小さなグラスチップを 1 枚表示: 「✦ Ripple」程度の 1 行のみ
- フェードイン 300ms → 3.5 秒表示 → フェードアウト。`pointer-events: none` で**入力を一切遮らない**
- キューは直列（同時に 1 枚）。store の `achievementToasts` から先頭を取り、表示完了で自己削除
- reduced-motion 時はフェードのみ短縮。音は既存のやわらかいシンセ 2 音（`settings.sound` ゲート下、なくても成立する）
- 点滅・バッジ数字・強制モーダルは使わない（Calm ピラー）
