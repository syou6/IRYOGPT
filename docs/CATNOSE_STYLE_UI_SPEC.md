# catnose 風ダークテーマ UI の仕様書

（Team Blog Hub / timeline ベース、WebGPT カラーパレット適用版）

## 0. コンセプト

- ベースは **ダークグリーン + 白 + アクセント 1 色（エメラルドグリーン）** のミニマル構成。

- 余白は広め、要素は少なめで「静か・落ち着いている」ことを最優先。

- 装飾より **タイポグラフィとカードの構成** で見せる。

- UI の「動き」はほんの少し（hover でちょっと明るくなる程度）。

- **色は現在の WebGPT の premium.\*カラーパレット（エメラルドグリーン系）を維持**。

---

## 1. デザイントークン

### 1-1. カラー

現在の WebGPT の Tailwind 設定（`tailwind.config.cjs`）をベースに、catnose 風の構造に適用します。

```css
/* Tailwindのpremium.*トークン（現在の設定） */
:root {
  --premium-base: #040607; /* ページ背景（深い黒） */
  --premium-surface: #0b1410; /* カード背景（深緑がかった黒） */
  --premium-elevated: #131f1a; /* 浮いたカード背景 */
  --premium-card: rgba(11, 20, 16, 0.82); /* カード背景（半透明） */
  --premium-stroke: #1f2a23; /* 枠線・区切り線 */
  --premium-accent: #19c37d; /* アクセント（エメラルドグリーン） */
  --premium-accentDeep: #0f8a5f; /* アクセント（深いエメラルド） */
  --premium-accentGlow: #7af4c1; /* アクセント（明るいエメラルド） */
  --premium-text: #f5f7f4; /* メインテキスト（白） */
  --premium-muted: #8ba39b; /* サブテキスト・メタ情報 */
}
```

**Tailwind クラスでの使用例:**

| 役割                         | Tailwind クラス例                                      | 備考                               |
| ---------------------------- | ------------------------------------------------------ | ---------------------------------- |
| ページ背景                   | `bg-premium-base`                                      | 全体の背景色                       |
| 浮いたカード背景             | `bg-premium-surface` または `bg-premium-elevated`      | カード・Surface コンポーネント     |
| メインテキスト               | `text-premium-text`                                    | 見出し・本文                       |
| サブテキスト・メタ情報       | `text-premium-muted`                                   | 日付・説明文・ラベル               |
| 枠線・区切り線               | `border-premium-stroke`                                | カードのボーダー、セクション区切り |
| アクセント背景（Badge 等）   | `bg-premium-accent`                                    | バッジ・ボタン（アクティブ）       |
| アクセントテキスト・hover 色 | `text-premium-accent` または `text-premium-accentGlow` | リンク・ホバー状態                 |

**ルール:**

- ページ全体は `bg-premium-base` 一色で塗る。

- コンテンツの箱（Surface/Card）は必ず `bg-premium-surface` または `bg-premium-elevated` を使う。

- テキストカラーは **基本 `text-premium-text`**、補足は `text-premium-muted` のみ。色を増やさない。

- アクセント色（エメラルドグリーン）は

  - リンク・バッジ・小さなボタンだけに限定する（乱用しない）。

  - hover 時は `text-premium-accentGlow` や `bg-premium-accent/20` など透明度を活用。

---

### 1-2. タイポグラフィ

厳密な px 値はソースから取れないので、**catnose 風のバランス**を Tailwind に落とした推奨値です。

**フォントファミリー**

- 現在の設定を維持: `font-sans`（Inter, Söhne, system-ui 系）

  - `Inter, Söhne, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif`

**フォントサイズ（目安）**

| 用途                   | Tailwind の例     | 備考                                  |
| ---------------------- | ----------------- | ------------------------------------- |
| ページタイトル（Hero） | `text-4xl`〜`5xl` | Team Blog Hub / timeline っぽい大きさ |
| セクションタイトル     | `text-xl`〜`2xl`  | `Members`, `Articles` など            |
| カードタイトル（記事） | `text-lg`         | `font-semibold`                       |
| 本文                   | `text-sm`〜`base` | 行間は `leading-relaxed`              |
| メタ情報・日付         | `text-xs`         | `text-premium-muted`                  |

**その他ルール**

- 行間は必ず広め（`leading-relaxed` 以上）。

- セクションタイトルは **全部小文字 or 単語先頭だけ大文字**など統一する。

- マイクロコピーは短く：`See Details →`, `Articles`, `Members` のようにシンプル。

- ラベルは `text-xs uppercase tracking-[0.2em] text-premium-muted` で統一。

---

### 1-3. スペーシング

catnose 風の「距離感」を数値化したイメージです。

**ページ全体**

- ページ上部余白: `py-8`〜`py-12`

- セクション間余白: `py-10`〜`py-12`

- コンテンツ左右マージン: `px-4 sm:px-6 lg:px-8`

- コンテナ最大幅: `max-w-3xl`〜`max-w-4xl`（だいたい 720〜960px くらい）

**カード内**

- 上下: `py-4`〜`py-5`

- 左右: `px-4`〜`px-5`

- カード同士の縦間隔（Articles）：`space-y-3`〜`space-y-4`

---

### 1-4. 角丸・ボーダー・シャドウ

catnose 風の見え方ベース。

- カードの角丸: `rounded-xl`〜`rounded-2xl`

- Badge / Chip: `rounded-full`

- ボーダー:

  - `border border-premium-stroke/40` または `border-premium-stroke/60`

  - ページの区切り線は `border-t border-premium-stroke/60`

- シャドウ:

  - ほぼ使わない or ごく控えめ

  - Tailwind なら `shadow-sm`〜`shadow-md` 程度

  - 影ではなく **背景色の差 + ボーダー** で段差を作る思想

  - 現在の `shadow-premium` や `shadow-glow` は控えめに使用

---

## 2. レイアウトパターン

### 2-1. Page Shell（ページ全体の骨組み）

Team Blog Hub デモから構造を抽出すると：

1. **ヘッダー**

   - 左: ロゴ（丸アイコン）

   - 右: テキストリンク `About / Company / GitHub`

   - 高さはそこまで高くない（`py-3`〜`py-4`）

2. **Hero**

   - `h1`: サイト名（例: Team Blog Hub）

   - `p`: サブタイトル（1〜2 行）

   - Hero 全体は中央寄せ、上下に広い余白 (`py-8`〜`py-10`)

3. **セクション（Members / Articles）**

   - セクションヘッダー行：

     - 左: `h2`（セクション名）

     - 右: 小さなリンク `See Details →`

   - ヘッダーの下にコンテンツ（カード or リスト）

**Tailwind 例（WebGPT カラー適用）**

```tsx
<div className="min-h-screen bg-premium-base text-premium-text">
  <header className="border-b border-premium-stroke/60">
    <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
      {/* Logo */}
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-full bg-premium-accent/20" />
        <span className="text-lg font-semibold">WebGPT</span>
      </div>
      {/* Nav Links */}
      <nav className="flex gap-6">
        <a
          href="#"
          className="text-sm text-premium-muted hover:text-premium-accentGlow transition"
        >
          About
        </a>
        <a
          href="#"
          className="text-sm text-premium-muted hover:text-premium-accentGlow transition"
        >
          Dashboard
        </a>
      </nav>
    </div>
  </header>

  <main className="mx-auto max-w-4xl px-4 pb-16 pt-8 sm:px-6 lg:px-8">
    {/* Hero */}
    <section className="py-10 text-center">
      <h1 className="text-4xl font-semibold mb-3">WebGPT Dashboard</h1>
      <p className="text-sm text-premium-muted leading-relaxed">
        Manage your AI chatbots and training data
      </p>
    </section>

    {/* Sections */}
  </main>
</div>
```

---

### 2-2. Members セクション

- `Members` のタイトル + `See Details →` のリンク行。

- 下に、メンバーカードを横に並べるレイアウト。

**メンバーカード仕様（WebGPT カラー適用）**

- 横幅：固定 200〜240px 程度（`w-52`〜`w-60`）

- 要素構造：

  - 丸いアバター

  - 名前（太字）

  - ロール（薄いグレーの小さな文字）

Tailwind っぽく書くと：

```tsx
<div className="mb-10">
  {/* セクションヘッダー */}
  <div className="mb-6 flex items-center justify-between">
    <h2 className="text-xl font-semibold">Members</h2>
    <a
      href="#"
      className="text-xs text-premium-muted hover:text-premium-accentGlow transition"
    >
      See Details →
    </a>
  </div>

  {/* メンバーカード */}
  <div className="flex gap-4 overflow-x-auto py-3">
    <div className="min-w-[200px] rounded-2xl bg-premium-surface border border-premium-stroke/40 px-4 py-4">
      <div className="h-12 w-12 rounded-full bg-premium-accent/20 mb-3" />
      <p className="text-sm font-semibold text-premium-text">CatNose</p>
      <p className="text-xs text-premium-muted">CTO</p>
    </div>
    {/* ... */}
  </div>
</div>
```

---

### 2-3. Articles セクション

- `Articles` タイトル行の下に、記事カードが縦に並ぶ。

**各記事カードの構造**

1. 一番上: メタ

   - `Author · 6 days ago` のような文

   - `text-xs text-premium-muted`

2. タイトル:

   - `a` 要素で全体がクリックできる

   - `text-lg font-semibold`

3. 場合によっては右上に `NEW` Badge

**見た目のルール（WebGPT カラー適用）**

- カード背景: `bg-premium-surface` または `bg-premium-elevated`

- 角丸大きめ + 薄い border: `rounded-xl border border-premium-stroke/40`

- hover:

  - `bg-premium-surface` → `bg-premium-elevated`

  - `border-premium-stroke/40` → `border-premium-accent/30`

**実装例:**

```tsx
<div className="mb-10">
  {/* セクションヘッダー */}
  <div className="mb-6 flex items-center justify-between">
    <h2 className="text-xl font-semibold">Articles</h2>
    <a
      href="#"
      className="text-xs text-premium-muted hover:text-premium-accentGlow transition"
    >
      See Details →
    </a>
  </div>

  {/* 記事カードリスト */}
  <div className="space-y-4">
    <a
      href="#"
      className="block rounded-xl bg-premium-surface border border-premium-stroke/40 p-5 transition hover:bg-premium-elevated hover:border-premium-accent/30"
    >
      <div className="mb-2 text-xs text-premium-muted">Author · 6 days ago</div>
      <h3 className="text-lg font-semibold text-premium-text">
        Article Title Here
      </h3>
    </a>
    {/* ... */}
  </div>
</div>
```

---

### 2-4. timeline のレイアウト

timeline のスクショから読み取れる構造：

1. **Hero**（左寄せ）

   - `Hi, I'm catnose`（大きな見出し）

   - 1〜2 段落の自己紹介文

   - 下に細いボーダーで区切り

2. **タイムライン**

   - 左側に縦線（`border-l`）

   - 年ごとに pill バッジ `2021` など

   - その右に各イベント（記事、登壇など）

Tailwind での骨組み例（WebGPT カラー適用）：

```tsx
<div className="mb-12">
  {/* Hero */}
  <div className="mb-10 pb-8 border-b border-premium-stroke/60">
    <h1 className="text-4xl font-semibold mb-4">Hi, I'm WebGPT</h1>
    <p className="text-sm text-premium-muted leading-relaxed max-w-2xl">
      Introduction text here...
    </p>
  </div>

  {/* Timeline */}
  <div className="grid gap-10 md:grid-cols-[auto,1fr]">
    {/* left: line + year badges */}
    <div className="relative">
      <div className="absolute left-3 top-0 bottom-0 border-l border-premium-stroke/60" />
      <div className="relative space-y-8">
        <div className="flex items-center gap-3">
          <div className="h-6 w-6 rounded-full bg-premium-accent/20 border-2 border-premium-accent" />
          <span className="text-xs font-semibold text-premium-muted">2021</span>
        </div>
        {/* ... */}
      </div>
    </div>

    {/* right: events */}
    <div className="space-y-6">
      <div className="rounded-xl bg-premium-surface border border-premium-stroke/40 p-5">
        <div className="mb-2 text-xs text-premium-muted">Event meta</div>
        <h3 className="text-lg font-semibold text-premium-text">Event Title</h3>
      </div>
      {/* ... */}
    </div>
  </div>
</div>
```

---

## 3. コンポーネント仕様

### 3-1. Surface / Card

**Surface（大きな箱、チャット全体など）**

- 背景: `bg-premium-surface` または `bg-premium-elevated`

- 枠線: `border border-premium-stroke/40`

- 角丸: `rounded-3xl` くらいまで大きくしても良い

- パディング: `p-5`〜`p-6`

**Card（Members / Articles / Timeline イベント）**

- 背景: `bg-premium-surface`

- 枠線: `border border-premium-stroke/40`

- 角丸: `rounded-xl` or `rounded-2xl`

- hover:

  - `bg-premium-surface` → `bg-premium-elevated`

  - `border-premium-stroke/40` → `border-premium-accent/30`

**実装例:**

```tsx
// Surface
<div className="rounded-3xl bg-premium-surface border border-premium-stroke/40 p-6">
  {/* content */}
</div>

// Card
<div className="rounded-xl bg-premium-surface border border-premium-stroke/40 p-5 transition hover:bg-premium-elevated hover:border-premium-accent/30">
  {/* content */}
</div>
```

---

### 3-2. Badge / Pill

timeline の年バッジや `NEW` ラベルのイメージ（WebGPT カラー適用）。

- `inline-flex items-center rounded-full px-3 py-1`

- フォント: `text-xs font-semibold`

- 背景:

  - 標準：`bg-premium-elevated border border-premium-stroke/40`

  - アクセント：`bg-premium-accent/20 text-premium-accentGlow border border-premium-accent/30`

**実装例:**

```tsx
// 標準バッジ
<span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold bg-premium-elevated border border-premium-stroke/40 text-premium-muted">
  Label
</span>

// アクセントバッジ
<span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold bg-premium-accent/20 text-premium-accentGlow border border-premium-accent/30">
  NEW
</span>
```

---

### 3-3. リンク / ボタン

- 見た目はできるだけ「テキスト」に近くする。

- ヘッダー右のナビや `See Details →` は

  - `text-sm text-premium-muted`

  - hover で `text-premium-accentGlow` に変化

- ボタンは

  - `rounded-full`

  - `px-4 py-1.5 text-sm font-medium`

  - 影は `shadow-sm` 程度

**実装例:**

```tsx
// テキストリンク
<a href="#" className="text-sm text-premium-muted hover:text-premium-accentGlow transition">
  See Details →
</a>

// ボタン（プライマリ）
<button className="rounded-full bg-premium-accent px-4 py-1.5 text-sm font-medium text-slate-900 shadow-sm hover:bg-premium-accentDeep transition">
  Button
</button>

// ボタン（セカンダリ）
<button className="rounded-full border border-premium-stroke/40 bg-premium-surface px-4 py-1.5 text-sm font-medium text-premium-text hover:bg-premium-elevated transition">
  Button
</button>
```

---

## 4. チャット画面に適用するときの指針

WebGPT チャットにこの UI を持ってくるときの「仕様」っぽいまとめ。

### 4-1. ページ全体

- 背景：`bg-premium-base`

- 中央に `max-w-3xl` のチャットカード（Surface）を 1 個置く

- 上に小さなヘッダコピー：

  - ラベル: `WEBGPT CHATBOT`（`text-[11px] uppercase tracking-[0.2em] text-premium-muted`）

  - タイトル: `text-3xl font-semibold text-premium-text`

  - サブ: `text-sm text-premium-muted`

**実装例:**

```tsx
<div className="min-h-screen bg-premium-base">
  <div className="mx-auto max-w-3xl px-4 py-8">
    <div className="mb-6 text-center">
      <p className="text-[11px] uppercase tracking-[0.2em] text-premium-muted mb-2">
        WEBGPT CHATBOT
      </p>
      <h1 className="text-3xl font-semibold text-premium-text mb-2">
        Chat with AI
      </h1>
      <p className="text-sm text-premium-muted">
        Ask questions about your content
      </p>
    </div>

    {/* チャットSurface */}
    <div className="rounded-3xl bg-premium-surface border border-premium-stroke/40 p-6">
      {/* メッセージエリア */}
    </div>
  </div>
</div>
```

---

### 4-2. メッセージバブル

- **User**

  - 右寄せ (`justify-end`)

  - 背景: `bg-premium-elevated` または `bg-slate-900` みたいに真っ黒に近い色でも OK

  - 角丸: `rounded-2xl rounded-br-sm`（右下だけ小さく）

- **Assistant**

  - 左寄せ (`justify-start`)

  - 背景: `bg-premium-surface`

  - 枠線: `border border-premium-stroke/40`

  - 角丸: `rounded-2xl rounded-bl-sm`

ラベル（`You`, `Bot`）は `text-[11px] uppercase tracking-[0.16em] text-premium-muted`。

**実装例:**

```tsx
{
  /* User Message */
}
<div className="flex justify-end mb-4">
  <div className="max-w-[80%]">
    <p className="text-[11px] uppercase tracking-[0.16em] text-premium-muted mb-1">
      You
    </p>
    <div className="rounded-2xl rounded-br-sm bg-premium-elevated px-4 py-3">
      <p className="text-sm text-premium-text">User message here</p>
    </div>
  </div>
</div>;

{
  /* Assistant Message */
}
<div className="flex justify-start mb-4">
  <div className="max-w-[80%]">
    <p className="text-[11px] uppercase tracking-[0.16em] text-premium-muted mb-1">
      Bot
    </p>
    <div className="rounded-2xl rounded-bl-sm bg-premium-surface border border-premium-stroke/40 px-4 py-3">
      <p className="text-sm text-premium-text">Assistant response here</p>
    </div>
  </div>
</div>;
```

---

### 4-3. 入力欄

- 1 行〜複数行の textarea をカード内に埋め込む。

- 枠は `border-premium-stroke/40` → フォーカス時に `border-premium-accent` + `ring-1 ring-premium-accent/60`

- 説明テキストでショートカットを表示（`Cmd+Enter で送信` など）。

- Enter 周りの UX は `use-chat-submit` をそのまま使うと catnose 本人の実装由来になります。

**実装例:**

```tsx
<div className="mt-6 border-t border-premium-stroke/60 pt-4">
  <textarea
    className="w-full rounded-xl border border-premium-stroke/40 bg-premium-elevated px-4 py-3 text-sm text-premium-text placeholder:text-premium-muted focus:outline-none focus:border-premium-accent focus:ring-1 focus:ring-premium-accent/60 transition"
    placeholder="Type your message..."
    rows={3}
  />
  <p className="mt-2 text-xs text-premium-muted">
    Press{' '}
    <kbd className="px-1.5 py-0.5 rounded bg-premium-elevated border border-premium-stroke/40">
      Cmd+Enter
    </kbd>{' '}
    to send
  </p>
</div>
```

---

## 5. ダッシュボードへの適用

### 5-1. フィルタリングバー

catnose 風の軽量なフィルタ UI（WebGPT カラー適用）。

```tsx
<div className="mb-6 flex flex-wrap items-center gap-3 border-b border-premium-stroke/60 pb-4">
  {/* ステータスフィルタ */}
  <div className="flex items-center gap-2">
    <label className="text-xs font-medium text-premium-muted">Type:</label>
    <select className="rounded-lg border border-premium-stroke/40 bg-premium-surface px-3 py-1.5 text-sm text-premium-text focus:outline-none focus:ring-1 focus:ring-premium-accent/60">
      <option value="all">All</option>
      <option value="ready">Ready</option>
      <option value="training">Training</option>
    </select>
  </div>

  {/* ソート */}
  <div className="flex items-center gap-2">
    <label className="text-xs font-medium text-premium-muted">Sort:</label>
    <select className="rounded-lg border border-premium-stroke/40 bg-premium-surface px-3 py-1.5 text-sm text-premium-text focus:outline-none focus:ring-1 focus:ring-premium-accent/60">
      <option value="last_updated">Last updated</option>
      <option value="name">Name</option>
    </select>
  </div>

  {/* 検索 */}
  <div className="flex-1 min-w-[200px]">
    <input
      type="search"
      placeholder="Search sites..."
      className="w-full rounded-lg border border-premium-stroke/40 bg-premium-surface px-3 py-1.5 text-sm text-premium-text placeholder:text-premium-muted focus:outline-none focus:ring-1 focus:ring-premium-accent/60"
    />
  </div>

  {/* 結果数 */}
  <div className="text-xs text-premium-muted">5 sites</div>
</div>
```

---

### 5-2. サイトカード

catnose 風のシンプルなカード（WebGPT カラー適用）。

```tsx
<div className="rounded-xl bg-premium-surface border border-premium-stroke/40 p-5 transition hover:bg-premium-elevated hover:border-premium-accent/30">
  {/* ヘッダー */}
  <div className="mb-3 flex items-start justify-between gap-3">
    <div className="flex-1 min-w-0">
      <h2 className="mb-1 text-lg font-semibold text-premium-text truncate">
        Site Name
      </h2>
      <a
        href="#"
        className="text-xs text-premium-accentGlow hover:underline truncate block"
      >
        https://example.com
      </a>
    </div>
    <div className="flex-shrink-0">
      <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold bg-premium-accent/20 text-premium-accentGlow border border-premium-accent/30">
        Ready
      </span>
    </div>
  </div>

  {/* メタ情報 */}
  <div className="mb-4 flex flex-wrap items-center gap-4 text-xs text-premium-muted">
    <div className="flex items-center gap-1">
      <span>Updated 2 days ago</span>
    </div>
    <div className="flex items-center gap-1">
      <span>Created 1 month ago</span>
    </div>
  </div>

  {/* アクションボタン */}
  <div className="flex gap-2">
    <button className="flex-1 rounded-lg bg-premium-accent px-3 py-2 text-center text-sm font-semibold text-slate-900 hover:bg-premium-accentDeep transition">
      Chat
    </button>
    <button className="rounded-lg border border-premium-stroke/40 bg-premium-surface px-3 py-2 text-sm font-medium text-premium-text hover:bg-premium-elevated transition">
      Settings
    </button>
  </div>
</div>
```

---

## 6. ライセンス的な注意

- **Team Blog Hub / timeline のコードは MIT** なので、色・レイアウト・クラス設計はかなり自由に参考にして OK。

- timeline だけ「ロゴ画像（`/public/icon.*`）は除く」と書かれているので、ロゴは必ず自作する。

- 「完全コピペ」ではなく、色や角丸を少しだけ自分のサービス寄りに調整すると安全。

- **このドキュメントでは、catnose 風の構造・レイアウトパターンを採用しつつ、色は WebGPT の既存カラーパレット（エメラルドグリーン系）を維持**しています。

---

## 7. 実装チェックリスト

### Phase 1: 基本レイアウト ✅

- [ ] Page Shell の実装
- [ ] Hero セクションの実装
- [ ] セクションヘッダーの実装

### Phase 2: コンポーネント ✅

- [ ] Surface / Card コンポーネント
- [ ] Badge / Pill コンポーネント
- [ ] リンク / ボタンコンポーネント

### Phase 3: チャット画面 ✅

- [ ] チャットページのレイアウト
- [ ] メッセージバブルのスタイル
- [ ] 入力欄のスタイル

### Phase 4: ダッシュボード ✅

- [ ] フィルタリングバーの実装
- [ ] サイトカードのリデザイン
- [ ] 空状態の改善

---

## 8. 参考リンク

- [catnose99 さんの GitHub](https://github.com/catnose99?tab=repositories)
- [catnose99 さんのウェブサイト](https://catnose.me)
- [Team Blog Hub](https://github.com/catnose99/team-blog-hub)
- [timeline](https://github.com/catnose99/timeline)

---

## 9. 次のステップ

このドキュメントをベースに、

- `tailwind.config.cjs` の `premium.*` を確認・調整（必要に応じて）

- `PageShell` / `ChatShell` / `MessageBubble` を仕様どおり実装

- ダッシュボードのフィルタリングとカードを catnose 風にリデザイン

ところまでいけば、かなり **「見た目は catnose っぽいけど、WebGPT のエメラルドグリーンカラーを維持した UI」** にできます。
