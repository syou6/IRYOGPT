# UI Design v3 – Luminous Minimalism

> これは世界をとるアプリになるからユーザーを驚かせる Apple のような洗練された美しさが必要だ。世界トップの UI デザイナーの自覚を持って、挑戦的なデザインにも恐れずチャレンジしてみて。それが世界をとる。

## 1. コンセプト

- **Luminous Minimalism**：ミニマルな余白と透明感のある光。ガラス感や柔らかい白をベースに、アクセントカラーで差し込み。
- **Soft Motion**：フェード & スケールを滑らかに組み合わせ、0.2〜0.3s の自然な動き。
- **Human Warmth**：AI であっても柔らかい表情とメッセージで迎える。ラウンドなトークバブル、穏やかなアイコン。
- **Seamless Custom**：配色やロゴなどを JSON で即差し替え。アップルのような統一美と拡張性を両立。

## 2. ビジュアルガイド

### カラー（ライト）
- Base: `#F6F8FB`
- Text Primary: `#0B1220`
- Text Secondary: `#4B5563`
- Accent: `#8B7CFF`
- Accent Secondary: `#EDEBFF`
- Glass: `rgba(255, 255, 255, 0.78)`

※ Dark モードは NightSky (`#0F172A`) をベースに、アクセントを淡いブルーへ。

### タイポ
- 見出し: SF Pro Display / 24–32px / 600
- 本文: SF Pro Text / 14–16px / 400
- ラベル／ボタン: 12–14px / 500, letter-spacing +0.02em

### モーション
- Hero: 120ms ずらして順番にフェードアップ
- カード: hover 時に 3D transform (rotate 1.5°) + shadow 0→8px
- チャット: メッセージ出現時に scale 0.96→1, opacity 0 → 1

## 3. 画面ごとの刷新案

### `/dashboard`
- **Hero**: 透明なグラデ背景＋ウェルカムテキスト
- **KPIガラスカード**: Chat / Embedding / Cost の3枚を並列
- **サイトグリッド**: カードにステータスピル、進捗リングを埋め込む
- **Activity**: BullMQ 状態をタイムラインで表示

### `/dashboard/[siteId]`
- 上部にサイト概要カード（背景画像 + ステータス）
- メインはチャット / 学習ログ / 埋め込みへのショートカットをタブ化
- モーション: セクション間スライド

### 埋め込みウィジェット
- フローティングハブ + Luminous カード（前述）
- Shadow DOM で独立、テーマ JSON に対応

### `/dashboard/sites/[siteId]/embed`
- ガイドカード、スイッチ、スクリプトタグを Apple ライクなガラスカードで統一

### `/dashboard/admin/usage`
- ガラス KPI + テーブル + ハイライトグラフ
- セクション毎に淡い仕切り線、スクロール時にパネルを固定

## 4. 実装ロードマップ
1. 共通スタイル（Tailwind config / CSS 変数）を整備
2. `/dashboard` の Hero + KPI + グリッドを差し替え
3. `/dashboard/[siteId]` のヘッダー・チャットUI を刷新
4. 埋め込みウィジェットの Shadow DOM 版を適用
5. `/dashboard/sites/[siteId]/embed` と `/dashboard/admin/usage` を順次更新

## 5. カスタマイズ / 拡張
- `site.embed_theme` → `{ accent, accentSecondary, ... }` を反映
- ダークモード、ブランドロゴ挿入、Welcomecard のメッセージを JSON で制御

---

これらを順次実装し、Apple らしい驚きと洗練を持った UI へ刷新する。
