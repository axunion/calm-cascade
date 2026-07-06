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
│  ┌──────┐ ┌──────┐      │
│  │ ⓘ 情報│ │⚙ 設定│      │  ← Kobalte トリガーボタン（44px 以上）
│  └──────┘ └──────┘      │
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
| 設定 | `Dialog`（SettingsDialog.tsx） | テーマ切替 / モーション低減 / ハプティクス / 色覚サポート / サウンド / パーティクルの各トグル（Kobalte `Switch`） |
| 情報 | `Dialog` + `Tabs`（InfoDialog.tsx） | タブ 1「How to Play」: 図解 3 ステップ程度の簡潔な説明。タブ 2「Stats」: 統計 5 項目 |
| トリガー | `Button` | lucide-solid の `Info` / `Settings` アイコン |

- Dialog はモバイルでは下から出るボトムシート風、デスクトップでは中央モーダル（CSS で切替）
- Dialog 表示中はゲーム入力が自然に遮断される（オーバーレイが canvas を覆う）。加えてループ側も IDLE 以外と同様に入力を無視してよい
- Kobalte の a11y（フォーカストラップ・Esc 閉じ・aria 属性）をそのまま活かす。独自実装で上書きしない

## 4. タッチターゲット

- すべてのボタンは **最小 44x44px**（アイコン自体は 24px、パディングで確保）
- 下部ボタン間の間隔は 8px 以上（誤タップ防止）
- 盤面のセルは 8x8 で画面幅いっぱいのため、375px 幅端末でもセルあたり ~44px を確保できる

## 5. テーマ — ダーク / ライト

- CSS 変数をルートに定義し、`data-theme="dark" | "light"` 属性で切替。`App.tsx` が store の `settings.theme` を購読して属性を付与
- 初期値: `prefers-color-scheme` を尊重し、ユーザーが設定で変更したら永続化した値を優先
- **Canvas 側の色**も `render/theme.ts` に同じパレットを定義（単一情報源）。宝石カラーはダーク/ライトで彩度・明度を調整した 2 セットを持つ
- トーン & マナー: 癒し系 — 低彩度の背景、柔らかいグラデーション、パステル寄りの宝石色、丸いフォルム。ネオン・高コントラストの警告色は使わない

## 6. アクセシビリティ

### prefers-reduced-motion

- `matchMedia('(prefers-reduced-motion: reduce)')` と設定トグルの **OR** で最終判定
- 低減時: 画面シェイク無効、パーティクル無効、全トゥイーンを 80ms の線形クロスフェードに短縮、juice テキストは float-up なしの単純フェード
- **論理的なゲーム進行は同一**（連鎖のテンポが変わるだけで結果は変わらない）

### 色覚多様性対応

- 宝石は **色 + 形状** の 2 チャネルで識別する（丸・三角・四角・菱形・星・雫 の 6 形状）
- 形状は常時描画する（トグル `colorBlindShapes` は形状の**強調度**を上げるオプション: 輪郭線の太さ・内部シンボルの明瞭化）
- レーザーは形状に加え、行/列方向の矢印マークで向きを示す

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
