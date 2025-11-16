# 緑基調 Frontend Skill

catnose × WEBGPT のプレミアム（エメラルド）トーンを保ちながら、「AIっぽい」無難なUIを避けるための指示セット。Claude や Skills に読み込ませて LP / UI を生成するときのベースにする。

## 0. 目的

- LLM がデフォルトで選びがちな紫グラデ＋Inter＋平板レイアウトを避け、深いグリーン×静かな余白×ディスプレイ系タイポで構成する。
- `premium.*` カラートークンを使用し、背景も単色ではなくグラデやパターンで奥行きを作る。
- ターゲットは catnose 研究レポートのような読ませるLP。エメラルドを主色とし、紫系は禁止。

## 1. タイポグラフィ

```prompt
<use_interesting_fonts_green>
Typography は品質のシグナル。以下を厳守：
- 禁止: Inter / Roboto / Open Sans / Lato / デフォルトシステムフォント
- 推奨: IBM Plex Sans/Mono, Space Grotesk, Bricolage Grotesque, Crimson Pro + Source Sans, Noto Serif JP
- コントラストを極端に。100-200 と 800-900 の組み合わせ、大きさは 3x 以上跳ねる。
- 1 つの際立つフォントを決め、ヘッダーやナビに集中して使う。
</use_interesting_fonts_green>
```

## 2. カラー＆テーマ

```prompt
<green_theme>
- Dominant: 深いグリーン (`#040607`, `#0B1410`, `#131F1A`).
- Accent: エメラルド (`#19C37D`, `#7AF4C1`).
- 禁止: 青/紫グラデーション。
- CSS変数 `--premium-*` を使い、背景はレイヤー化（ラジアル/グリッド）。
- カードは `bg-premium-card` + 薄いボーダー。影は控えめ。
</green_theme>
```

## 3. モーション

```prompt
<motion_guidelines>
- ページロード時にセクションを0.2〜0.4s遅延でフェードアップ。
- CTAやカードには hover 時の微妙な浮遊感（translateY(-4px)）を追加。
- CSS のみで完結できるアニメにする。React なら Framer Motion を使用。
</motion_guidelines>
```

## 4. 背景処理

```prompt
<background_layers>
- 単色禁止。ラジアルグラデや幾何学パターンで空気感を出す。
- グリーン〜ティール系で、白ではなく暗いキャンバスを基調にする。
- 過度なノイズや写真背景は禁止。catnose ドキュメントで使われるような繊細なグリッドが理想。
</background_layers>
```

## 5. レイアウト

- 最大幅は 680〜768px（`max-w-3xl` 前後）。中央揃え、左右の余白は広く。
- セクション間隔は `pt-14` 以上。区切り線に `border-premium-stroke/60` を用いる。
- ナビは大文字＋ letter-spacing 0.3em。ログイン導線はテキスト＋矢印でミニマルに。

## 6. 料金モデル反映

- 文言は「初期 30〜60 万円 + 月次手数料/API実費」を徹底。無料トライアル表現は禁止。
- FAQ・CTA も同じトーンで統一する。

## 7. 実装ヒント

- Skills で読み込ませる場合、上記 `<...>` ブロックをそのまま渡す。
- web-artifacts-builder のようなスクリプトと併用すると、React + Tailwind + shadcn/ui でモックを作りやすい。

