# テーマパック作者ガイド

Calm Cascade のテーマパック（スキン）は、このリポジトリの `themes/<name>/` に
ディレクトリを置くだけで追加できます。索引ファイルの手動保守は不要です
（`render/themeRegistry.ts` が `import.meta.glob` でビルド時に自動発見します）。

## 配置

```
themes/
  <name>/            ← ディレクトリ名がそのままパック id（manifest に id は持たせない）
    manifest.json
    gem-0.png         ← 任意のファイル名（manifest から相対パスで参照）
    background.png
```

- `<name>` はパック選択 UI で使う id そのもの。重複や manifest との不一致が起きないよう、
  意図的に manifest 側に id フィールドを持たせていない
- 対応拡張子: `.png` / `.webp` / `.jpg` / `.jpeg`

## manifest.json

```ts
interface ThemePackColors {
  gemColors: string[];       // 必須・長さ 6。パーティクル色・ビーム色・ベクタ fallback の塗り色を兼ねる
  boardTileA: string;        // 背景画像なし時の市松 A / 画像失敗時 fallback
  boardTileB: string;
  selectionRing: string;
  uiAccent?: string;         // CSS 変数 --accent の上書き。省略時は CSS デフォルト
}

interface ThemeManifest {
  manifestVersion: 1;
  displayName: string;              // 設定 UI の表示名
  gems: (string | null)[];          // 長さ 6。同ディレクトリ相対のファイル名。null = ベクタ形状で描画
  background: string | null;        // 盤面全体の背景画像。null = 市松
  colors: ThemePackColors;
  colorsLight?: Partial<ThemePackColors>; // light モード時の部分上書き。省略時は colors をそのまま使用
}
```

- `manifestVersion` は現在 `1` のみ
- `gemColors` は色数固定（6 色）。ベクタ fallback の塗り色・パーティクル/ビームの発色源にもなるため、
  画像を使うスロットでも必ず埋める
- 色値は hex 文字列であれば形式チェックはされません（自由記法可）

## 推奨アセット

- 256×256 の `webp` / `png`（透過）
- 宝石画像は円形の余白を透過にしておくと、選択リング・特殊ピースアイコンとの重なりが自然になります
- トーン & マナー: 癒し系 — 低彩度の背景、柔らかいグラデーション、パステル寄りの色、丸いフォルム。
  ネオン・高コントラストの警告色は避けてください

## ハイブリッド構成（画像 + ベクタの混在）

`gems` 配列は一部だけ画像・残り `null`（ベクタ）にできます。これは失敗時フォールバックと
同一のコードパスなので、正式にサポートされた構成です。一部の宝石だけ差し替えたい場合や、
アセット制作の途中段階でも安心して commit できます。

## 失敗時の挙動（資産単位フォールバック）

- 宝石画像が 1 枚だけ読み込みに失敗しても、そのスロットだけがベクタ描画に切り替わります
  （他の宝石・背景には影響しません）
- 背景画像の読み込みに失敗した場合は市松模様（`boardTileA` / `boardTileB`）にフォールバックします
- manifest 自体が不正、または未知の skin id が指定された場合は、パック全体が組み込みの
  `classic` テーマに縮退します
- いずれの場合もエラーはユーザーに通知されず、`console.warn` のみです（ゲームを止めません）

## できないこと（意図的な制限）

- レーザー矢印・ボム・プリズムなど特殊ピースのアイコンは manifest では定義できません。
  これは色覚多様性対応のキューをテーマ作者が壊せないようにするための意図的な制限です
- 色値の hex 形式や画像の実サイズはバリデーションされません。壊れた画像は読み込み失敗として
  扱われ、上記の資産単位フォールバックに従います

## 検証

- `pnpm dev` で起動し、設定 UI からパックを選んで盤面・宝石が想定どおり切り替わるか確認してください
- `pnpm check && pnpm test` が通ることを確認してください（`render/themePack.ts` の
  `validateManifest` が manifest の形をテストします）
