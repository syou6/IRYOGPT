# Apple Human Interface Guidelines ベース デザインガイドライン

## 概要

このドキュメントは、[Apple Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/)の原則と哲学を Web アプリケーション（特にプレミアム SaaS サービス）に適用するための詳細なガイドラインです。

Apple HIG の 3 つの核心原則である**Clarity（明確性）**、**Deference（尊重）**、**Depth（深度）**を基盤とし、Web アプリケーションの特性に合わせて実装可能な形で体系化しています。

---

## 1. Apple HIG の 6 つのデザイン原則

Apple Human Interface Guidelines は、以下の 6 つの基本原則を提唱しています。これらは相互に関連し、優れたユーザー体験を実現するための基盤となります。

### 1.1 Aesthetic Integrity（美的整合性）

**定義**: アプリの外観と動作が、その目的や機能と調和していること。ユーザーの期待に応えるデザインを目指します。

#### 実装ガイドライン

**ブランドとの調和**

- アプリの目的とデザインスタイルが一致している
- 過度な装飾を避け、機能に集中する
- プレミアムサービスなら洗練された高級感を表現

**視覚的階層**

- 重要な機能が視覚的に強調されている
- 装飾要素は控えめで、コンテンツを邪魔しない
- 一貫したデザイン言語の使用

**プラットフォーム適応**

- iOS/macOS の標準パターンに従う
- プラットフォームの特性を尊重
- ネイティブな体験を提供

### 1.2 Consistency（一貫性）

**定義**: システム全体で統一されたデザインと動作を維持すること。ユーザーが予測可能な操作を可能にします。

#### 実装ガイドライン

**標準 UI 要素の使用**

- プラットフォーム標準のコンポーネントを優先
- カスタム要素は標準要素の動作を模倣
- ユーザーの学習コストを最小化

**用語の統一**

- 同じ機能には同じ名前を使用
- 標準的な用語を採用（例：「保存」「削除」「キャンセル」）
- 専門用語の使用を最小限に

**操作パターンの統一**

- 同じ操作は同じ方法で実行
- ジェスチャーの一貫性
- ナビゲーションパターンの統一

### 1.3 Direct Manipulation（直接操作）

**定義**: ユーザーが直感的に操作できるインターフェースを提供すること。画面上のコンテンツを直接操作できるようにします。

#### 実装ガイドライン

**視覚的フィードバック**

- 操作可能な要素が明確に識別できる
- ホバー/タッチ状態の明確な表示
- ドラッグ&ドロップの視覚的フィードバック

**ジェスチャーの活用**

- 標準的なジェスチャーを使用
  - タップ: 選択・実行
  - スワイプ: ナビゲーション・削除
  - ピンチ: ズーム
  - ロングプレス: コンテキストメニュー
- ジェスチャーの一貫性
- ジェスチャーのヒント提供

**操作の可逆性**

- 操作を取り消せるようにする
- 確認ダイアログの適切な使用
- 履歴・アンドゥ機能の提供

### 1.4 Feedback（フィードバック）

**定義**: ユーザーの操作に対して即座に適切な反応を示すこと。操作の結果を明確に伝えます。

#### 実装ガイドライン

**即時の視覚的フィードバック**

- 100ms 以内の応答
- ボタンの押下状態の表示
- ローディング状態の明確な表示

**多様なフィードバック**

- 視覚的: 色、形状、アニメーション
- 聴覚的: システムサウンド（適切な場合）
- 触覚的: ハプティックフィードバック（モバイル）

**状態の明確な表示**

- 成功/エラー/警告の明確な区別
- プログレスインジケーター
- トースト通知

### 1.5 Metaphors（メタファー）

**定義**: 現実世界の概念を取り入れ、理解しやすいインターフェースを設計すること。ユーザーが既に知っている経験に基づきます。

#### 実装ガイドライン

**現実世界の概念**

- フォルダ: ファイル整理
- ゴミ箱: 削除
- カレンダー: 日付選択
- スイッチ: オン/オフ

**メタファーの適切な使用**

- 過度に複雑なメタファーを避ける
- 直感的で理解しやすい
- 文化的背景を考慮

**抽象概念の視覚化**

- データの可視化
- プロセスの視覚的表現
- 状態の視覚的表現

### 1.6 User Control（ユーザー制御）

**定義**: ユーザーが操作を主導できるようにすること。予期しない動作を避け、ユーザーの意図を尊重します。

#### 実装ガイドライン

**操作の主導権**

- ユーザーが操作を開始・停止できる
- 自動実行を避ける（重要な操作）
- 設定のカスタマイズ可能

**確認と警告**

- 破壊的な操作には確認を求める
- 重要な変更には警告を表示
- 操作の取り消し可能性

**設定とカスタマイズ**

- ユーザー設定の保存
- テーマの選択
- 通知設定の制御

---

## 2. デザインの核心原則（Clarity, Deference, Depth）

### 2.1 Clarity（明確性）

**定義**: インターフェイスは明確で理解しやすく、ユーザーが目的を達成するための手順が直感的であるべきです。

#### 実装ガイドライン

**タイポグラフィ**

- **階層の明確化**: 情報の重要度を視覚的に表現
  - 最重要: 48px, font-weight: 600
  - 重要: 36px, font-weight: 600
  - 標準: 16px, font-weight: 400
  - 補助: 14px, font-weight: 400
- **読みやすさ**: 行間は 1.5 倍以上、文字間隔は適切に設定
- **コントラスト**: WCAG AA 準拠（4.5:1 以上）

**レイアウト**

- **余白の活用**: 要素間の関係性を明確にする
  - 関連要素: 8-16px
  - セクション間: 32-48px
  - ページマージン: 24-48px
- **グリッドシステム**: 8 ポイントグリッドに準拠
- **視覚的階層**: サイズ、色、位置で情報の優先順位を表現

**カラー**

- **意味のある色使い**: 色だけでなく、形状やラベルでも情報を伝達
- **コントラスト比**: テキストと背景は 4.5:1 以上
- **色の一貫性**: 同じ意味には同じ色を使用

**アイコンと画像**

- **シンプルで認識しやすい**: 複雑すぎず、一目で意味が伝わる
- **一貫性**: 同じ機能には同じアイコンを使用
- **サイズ**: タッチターゲットは 44px×44px 以上

### 1.2 Deference（尊重）

**定義**: 装飾を最小限に抑え、コンテンツが主役となるようにデザインします。

#### 実装ガイドライン

**視覚的な控えめさ**

- **背景**: 控えめな色とテクスチャでコンテンツを引き立てる
  - ダークモード: `#030712` → `#111827` のグラデーション
  - ライトモード: `#FFFFFF` → `#F9FAFB` のグラデーション
- **装飾の最小化**: 不要な装飾要素を排除
- **コンテンツファースト**: UI 要素はコンテンツを邪魔しない

**インタラクションの控えめさ**

- **アニメーション**: 機能的な目的がある場合のみ使用
- **トランジション**: 250ms 以下の短い時間で滑らかに
- **フィードバック**: 必要最小限の視覚的フィードバック

**情報の優先順位**

- **主要コンテンツ**: 最大の視覚的重み
- **ナビゲーション**: 控えめだがアクセス可能
- **メタ情報**: 最小限の視覚的重み

### 1.3 Depth（深度）

**定義**: 視覚的な階層や動きを活用し、ユーザーに理解しやすいインターフェイスを提供します。

#### 実装ガイドライン

**視覚的階層**

- **エレベーション**: 影とオーバーレイで階層を表現
  ```
  Level 0 (背景):    なし
  Level 1 (カード):  0 1px 3px rgba(0,0,0,0.12)
  Level 2 (ホバー):  0 3px 6px rgba(0,0,0,0.16)
  Level 3 (モーダル): 0 10px 20px rgba(0,0,0,0.19)
  ```
- **Z-index 階層**: 明確なレイヤー構造
  ```
  Base:        0
  Content:     1-10
  Navigation:  20-30
  Overlay:     40-50
  Modal:       60-70
  Toast:       80-90
  ```

**動きとアニメーション**

- **機能的な動き**: 状態変化を明確に伝える
- **自然な動き**: 物理法則に基づいたイージング

  ```css
  /* 標準 */
  cubic-bezier(0.4, 0.0, 0.2, 1)

  /* エントランス */
  cubic-bezier(0.0, 0.0, 0.2, 1)

  /* イグジット */
  cubic-bezier(0.4, 0.0, 1, 1)
  ```

- **持続時間**:
  - 即座のフィードバック: 100-150ms
  - 標準トランジション: 200-250ms
  - 複雑なアニメーション: 300-400ms

**3D 効果とパースペクティブ**

- **グラスモーフィズム**: 控えめな透明度とブラー
  ```css
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  ```
- **パララックス**: 控えめな視差効果で深度を表現

---

## 2. 一貫性（Consistency）

### 2.1 プラットフォーム一貫性

**標準 UI 要素の活用**

- プラットフォーム標準のパターンに従う
- カスタム要素は標準要素の動作を模倣
- ユーザーの期待に応える

**アプリ内一貫性**

- 同じ操作は同じ方法で実行
- 同じ要素は同じ見た目と動作
- ナビゲーションパターンの統一

### 2.2 デザイントークン

**カラートークン**

```typescript
export const colors = {
  // セマンティックカラー
  primary: {
    light: '#4ADE80',
    base: '#22C55E',
    dark: '#16A34A',
  },
  background: {
    base: '#030712',
    elevated: '#111827',
    overlay: 'rgba(0, 0, 0, 0.6)',
  },
  text: {
    primary: '#F9FAFB',
    secondary: '#9CA3AF',
    tertiary: '#6B7280',
  },
  // ...
};
```

**スペーシングトークン**

```typescript
export const spacing = {
  xs: '4px', // 0.5
  sm: '8px', // 1
  md: '16px', // 2
  lg: '24px', // 3
  xl: '32px', // 4
  '2xl': '48px', // 6
  '3xl': '64px', // 8
};
```

**タイポグラフィトークン**

```typescript
export const typography = {
  h1: { fontSize: '48px', lineHeight: '56px', fontWeight: 600 },
  h2: { fontSize: '36px', lineHeight: '44px', fontWeight: 600 },
  h3: { fontSize: '28px', lineHeight: '36px', fontWeight: 600 },
  body: { fontSize: '16px', lineHeight: '24px', fontWeight: 400 },
  caption: { fontSize: '12px', lineHeight: '16px', fontWeight: 400 },
};
```

---

## 3. フィードバック（Feedback）

### 3.1 即座のフィードバック

**視覚的フィードバック**

- **ホバー状態**: 150ms 以内に変化
- **アクティブ状態**: 即座に変化
- **ローディング状態**: 明確なインジケーター

**インタラクティブ要素の状態**

```css
/* デフォルト */
.button {
  opacity: 1;
  transform: translateY(0);
}

/* ホバー */
.button:hover {
  opacity: 0.9;
  transform: translateY(-2px);
  transition: all 150ms;
}

/* アクティブ */
.button:active {
  opacity: 0.8;
  transform: translateY(0);
  transition: all 50ms;
}

/* 無効 */
.button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

### 3.2 ローディングとプログレス

**スケルトンローディング**

- コンテンツの形状を保持
- 控えめなアニメーション
- 実際のコンテンツに近いレイアウト

**プログレスインジケーター**

- 明確な進捗表示
- 残り時間の表示（可能な場合）
- キャンセル可能な操作にはキャンセルボタン

**エラーと成功のフィードバック**

- エラー: 明確なメッセージと修正方法の提示
- 成功: 控えめだが明確な確認
- トースト通知: 3-5 秒で自動非表示

---

## 4. 効率性（Efficiency）

### 4.1 操作の最適化

**最小限のステップ**

- 必要な情報のみを要求
- デフォルト値の活用
- バッチ操作のサポート

**ショートカット**

- キーボードショートカットの提供
- よく使う機能へのクイックアクセス
- 検索機能の充実

**コンテキストの保持**

- 操作履歴の保存
- フォームデータの自動保存
- セッション状態の維持

### 4.2 パフォーマンス

**読み込み速度**

- 重要コンテンツの優先読み込み
- 画像の遅延読み込み
- コード分割と最適化

**レスポンシブネス**

- 100ms 以内のインタラクション応答
- スムーズなアニメーション（60fps）
- ネットワーク状態の考慮

---

## 5. 柔軟性（Flexibility）

### 5.1 カスタマイズ性

**ユーザー設定**

- テーマの選択（ダーク/ライト）
- フォントサイズの調整
- レイアウトのカスタマイズ

**多様な操作方法**

- マウス/キーボード操作
- タッチ操作
- キーボードナビゲーション

### 5.2 適応性

**レスポンシブデザイン**

- モバイル: 320px+
- タブレット: 768px+
- デスクトップ: 1024px+
- 大画面: 1280px+

**デバイス特性の考慮**

- タッチターゲット: 44px×44px 以上
- マウス操作: ホバー状態の提供
- キーボード: フォーカス管理

---

## 6. タイポグラフィ

### 6.1 San Francisco フォントシステム

**SF Pro Display vs SF Pro Text**
Apple は、サイズに応じて 2 つのフォントバリエーションを提供しています：

- **SF Pro Display**: 20 ポイント以上の大きなテキスト用

  - より広い文字間隔
  - ディスプレイ用途に最適化
  - 見出し、タイトルに使用

- **SF Pro Text**: 19 ポイント以下の小さなテキスト用
  - よりタイトな文字間隔
  - 可読性に最適化
  - 本文、キャプションに使用

**システムフォントの優先**

```css
/* 英語・数字 */
font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text',
  'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;

/* 日本語 */
font-family: -apple-system, BlinkMacSystemFont, 'Hiragino Kaku Gothic ProN',
  'Hiragino Sans', 'Noto Sans JP', 'Yu Gothic', 'Meiryo', sans-serif;
```

**フォントサイズによる自動切り替え**

```css
/* 20px以上はDisplay、19px以下はTextを使用 */
.heading-large {
  font-size: 24px; /* SF Pro Displayが使用される */
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif;
}

.body-text {
  font-size: 16px; /* SF Pro Textが使用される */
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif;
}
```

**New York フォント（macOS）**
macOS では、セリフフォントとして「New York」も提供されています：

```css
font-family: 'New York', 'Times New Roman', serif;
```

### 6.2 タイポグラフィスケール

**見出し階層**

```
H1 (Hero):     48px / 56px  / 600
H2 (Section):   36px / 44px  / 600
H3 (Subsection):28px / 36px  / 600
H4 (Card):      24px / 32px  / 600
H5 (Label):     20px / 28px  / 600
H6 (Small):     18px / 24px  / 600
```

**本文階層**

```
Body Large:     18px / 28px  / 400
Body:           16px / 24px  / 400
Body Small:     14px / 20px  / 400
Caption:        12px / 16px  / 400
```

### 6.3 読みやすさの最適化

**行間**

- 本文: 1.5 倍（24px / 16px = 1.5）
- 見出し: 1.2 倍（44px / 36px ≈ 1.22）

**文字間隔**

- 日本語: デフォルト
- 英語: -0.01em（タイトなトラッキング）
- 大文字ラベル: 0.1em-0.35em

**行の長さ**

- 日本語: 60-75 文字
- 英語: 45-75 文字

---

## 7. カラーシステム

### 7.1 カラーパレット

**プライマリカラー（緑系）**

```
50:  #F0FDF4   (最軽背景)
100: #DCFCE7   (軽背景)
200: #BBF7D0   (ホバー)
300: #86EFAC   (アクセント)
400: #4ADE80   (メインアクション)
500: #22C55E   (プライマリ) ★
600: #16A34A   (ホバー・アクティブ)
700: #15803D   (テキスト・強調)
800: #166534   (ダークモード)
900: #14532D   (最深)
```

**ニュートラルカラー（グレー系）**

```
50:  #F9FAFB   (最軽背景)
100: #F3F4F6   (ライト背景)
200: #E5E7EB   (境界線)
300: #D1D5DB   (軽い境界線)
400: #9CA3AF   (プレースホルダー)
500: #6B7280   (セカンダリテキスト)
600: #4B5563   (無効テキスト)
700: #374151   (境界線)
800: #1F2937   (カード背景)
900: #111827   (ダーク背景)
950: #030712   (最深背景) ★
```

### 7.2 セマンティックカラー

**成功（Success）**

- Light: `#10B981`
- Base: `#059669`
- Background: `rgba(16, 185, 129, 0.1)`

**警告（Warning）**

- Light: `#F59E0B`
- Base: `#D97706`
- Background: `rgba(245, 158, 11, 0.1)`

**エラー（Error）**

- Light: `#EF4444`
- Base: `#DC2626`
- Background: `rgba(239, 68, 68, 0.1)`

**情報（Info）**

- Light: `#3B82F6`
- Base: `#2563EB`
- Background: `rgba(59, 130, 246, 0.1)`

### 7.3 ダイナミックカラーとアダプティブカラー

**システムカラーの活用**
Apple は、システムカラーを提供しており、これらは自動的にダークモードやアクセシビリティ設定に適応します：

```css
/* システムカラー（CSS変数） */
:root {
  /* iOS/macOSシステムカラー */
  --system-blue: #007aff;
  --system-green: #34c759;
  --system-indigo: #5856d6;
  --system-orange: #ff9500;
  --system-pink: #ff2d55;
  --system-purple: #af52de;
  --system-red: #ff3b30;
  --system-teal: #5ac8fa;
  --system-yellow: #ffcc00;

  /* グレースケール */
  --system-gray: #8e8e93;
  --system-gray2: #aeaeb2;
  --system-gray3: #c7c7cc;
  --system-gray4: #d1d1d6;
  --system-gray5: #e5e5ea;
  --system-gray6: #f2f2f7;
}

/* ダークモード適応 */
@media (prefers-color-scheme: dark) {
  :root {
    --system-gray6: #1c1c1e;
    --system-gray5: #2c2c2e;
    /* ... */
  }
}
```

**アダプティブカラーの実装**

```css
/* カスタムカラーもダークモードに対応 */
:root {
  --primary-color: #22c55e;
  --primary-color-dark: #16a34a;
  --background-color: #ffffff;
  --background-color-dark: #030712;
}

@media (prefers-color-scheme: dark) {
  :root {
    --primary-color: var(--primary-color-dark);
    --background-color: var(--background-color-dark);
  }
}
```

**カラー使用ガイドライン**

**コントラスト比**

- 本文テキスト: 4.5:1 以上（WCAG AA）
- 大見出し: 3:1 以上（WCAG AA）
- インタラクティブ要素: 3:1 以上

**色の意味**

- 色だけで情報を伝えない（形状やラベルも併用）
- 一貫した色の使用（同じ意味には同じ色）
- アクセシビリティを考慮した色選択

**色覚多様性への配慮**

- 色だけでなく、アイコンやテキストでも情報を伝達
- コントラスト比を十分に確保
- 色覚シミュレーションツールで確認

**ダークモード対応**

- すべてのカラーをダークモード用に定義
- 自動切り替えの実装
- ユーザー設定の尊重

---

## 8. スペーシングシステム

### 8.1 8 ポイントグリッド

**基本単位**: 8px

**スケール**

```
0:    0px
1:    4px   (0.5×8)
2:    8px   (1×8)
3:    12px  (1.5×8)
4:    16px  (2×8)
5:    20px  (2.5×8)
6:    24px  (3×8)
8:    32px  (4×8)
10:   40px  (5×8)
12:   48px  (6×8)
16:   64px  (8×8)
20:   80px  (10×8)
24:   96px  (12×8)
32:   128px (16×8)
```

### 8.2 スペーシングガイドライン

**コンテナ**

- ページマージン: 24px（モバイル）、32px（タブレット）、48px（デスクトップ）
- コンテンツ最大幅: 1280px
- セクション間隔: 64px-96px

**コンポーネント**

- カードパディング: 24px（標準）、32px（大）
- ボタンパディング: 12px 24px（標準）、16px 32px（大）
- 入力フィールド: 12px 16px（標準）、16px 20px（大）
- 要素間隔: 16px（密）、24px（標準）、32px（疎）

**グリッド**

- カラム間隔: 24px（標準）、32px（大）
- 行間隔: 24px（標準）、32px（大）

---

## 9. インタラクションとアニメーション

### 9.1 アニメーション原則

**機能的な目的**

- 状態変化の明確化
- 空間的関係の理解
- フィードバックの提供

**自然な動き**

- 物理法則に基づいたイージング
- 適切な持続時間
- 滑らかなトランジション

**パフォーマンス**

- 60fps の維持
- GPU 加速の活用
- 不要なアニメーションの回避

### 9.2 アニメーションタイミングカーブ

**標準イージングカーブ**
Apple HIG では、以下の標準的なイージングカーブを推奨しています：

```css
/* 標準トランジション */
transition: all 250ms cubic-bezier(0.4, 0, 0.2, 1);

/* エントランス（加速） */
animation: fadeIn 250ms cubic-bezier(0, 0, 0.2, 1);

/* イグジット（減速） */
animation: fadeOut 200ms cubic-bezier(0.4, 0, 1, 1);
```

**スプリングアニメーション**
より自然な動きを実現するためのスプリング物理：

```css
/* スプリングアニメーション（CSS） */
@keyframes spring {
  0% {
    transform: scale(0.8);
    opacity: 0;
  }
  50% {
    transform: scale(1.05);
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

.spring-animation {
  animation: spring 400ms cubic-bezier(0.68, -0.55, 0.265, 1.55);
}

/* JavaScript実装（より正確なスプリング） */
const springConfig = {
  tension: 300,      // 張力（高いほど速い）
  friction: 30,       // 摩擦（高いほど減衰が速い）
  mass: 1,            // 質量
};
```

**持続時間のガイドライン**

- **即座のフィードバック**: 100-150ms（ボタンタップ、ホバー）
- **標準トランジション**: 200-250ms（フェード、スライド）
- **複雑なアニメーション**: 300-400ms（モーダル表示、ページ遷移）
- **スプリングアニメーション**: 400-600ms（自然なバウンス）

**アニメーションの目的**

- 状態変化の明確化
- 空間的関係の理解
- フィードバックの提供
- 注意の誘導

**避けるべきアニメーション**

- 装飾的なアニメーション（機能的な目的がない）
- 過度に長いアニメーション（500ms 以上）
- 頻繁に繰り返されるアニメーション
- ユーザーの操作を妨げるアニメーション

### 9.3 インタラクティブ要素

**ボタン**

- ホバー: 150ms、translateY(-2px)
- アクティブ: 50ms、translateY(0)
- フォーカス: 明確なリング表示

**カード**

- ホバー: 150ms、translateY(-4px)、影の強化
- クリック: 50ms、translateY(0)

**入力フィールド**

- フォーカス: ボーダーカラーの変化、影の追加
- エラー: 明確な視覚的フィードバック

---

## 10. レイアウトとナビゲーション

### 10.1 レイアウト原則

**一貫性**

- 主要要素の配置を統一
- グリッドシステムの使用
- レスポンシブな適応

**階層**

- 視覚的階層の明確化
- 情報の優先順位
- コンテンツの流れ

**余白**

- 適切な余白の確保
- 要素間の関係性の表現
- 読みやすさの向上

### 10.2 ナビゲーションパターン

**ナビゲーションバー（Navigation Bar）**
iOS の標準的なナビゲーションパターン：

```css
.navigation-bar {
  height: 44px; /* iOS標準 */
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(20px);
  border-bottom: 0.5px solid rgba(0, 0, 0, 0.1);
  display: flex;
  align-items: center;
  padding: 0 16px;
}

.navigation-title {
  font-size: 17px;
  font-weight: 600;
  text-align: center;
  flex: 1;
}

.navigation-button {
  min-width: 44px;
  min-height: 44px;
  padding: 8px;
}
```

**タブバー（Tab Bar）**
主要セクションへのアクセスを提供：

```css
.tab-bar {
  height: 49px; /* iOS標準（ホームインジケーター考慮） */
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  border-top: 0.5px solid rgba(0, 0, 0, 0.1);
  display: flex;
  justify-content: space-around;
  padding-bottom: env(safe-area-inset-bottom);
}

.tab-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 49px;
  color: #8e8e93;
  font-size: 10px;
}

.tab-item.active {
  color: #007aff; /* システムブルー */
}
```

**構造**

- 階層的で論理的な構造
- 現在位置の明確な表示
- 簡単な移動方法

**パターン**

- **トップナビゲーション**: 主要セクションへのアクセス
- **サイドバー**: 詳細ナビゲーション（iPad/macOS）
- **ブレッドクラム**: 階層の表示
- **タブ**: 関連コンテンツの切り替え
- **モーダルナビゲーション**: 一時的なコンテキスト

**アクセシビリティ**

- キーボードナビゲーション
- フォーカス管理
- ARIA ラベルの適切な使用
- 現在位置の明確な表示（aria-current）

---

## 11. アクセシビリティ

### 11.1 WCAG 準拠

**レベル**: AA 準拠（推奨）、AAA 準拠（可能な限り）

**コントラスト比**

- 本文テキスト: 4.5:1 以上
- 大見出し: 3:1 以上
- インタラクティブ要素: 3:1 以上

### 11.2 キーボードナビゲーション

**Tab 順序**

- 論理的な順序
- すべてのインタラクティブ要素にアクセス可能
- スキップリンクの提供

**フォーカス管理**

- 明確なフォーカス表示
- フォーカストラップ（モーダル内）
- フォーカスの復元

**ショートカット**

- 主要機能へのキーボードショートカット
- 標準的なショートカットの使用
- カスタムショートカットの文書化

### 11.3 スクリーンリーダー

**ARIA ラベル**

- 適切なラベル付け
- ライブリージョンの使用
- ロールの適切な指定

**セマンティック HTML**

- 適切な HTML 要素の使用
- ランドマークの提供
- 見出し階層の維持

### 11.4 VoiceOver とスクリーンリーダー

**VoiceOver 対応**
iOS/macOS の標準スクリーンリーダーに対応：

```html
<!-- 適切なセマンティックHTML -->
<button aria-label="閉じる">
  <span aria-hidden="true">×</span>
</button>

<!-- ランドマーク -->
<nav aria-label="メインナビゲーション">
  <!-- ナビゲーション要素 -->
</nav>

<!-- ライブリージョン -->
<div aria-live="polite" aria-atomic="true">
  <!-- 動的に更新されるコンテンツ -->
</div>
```

**ARIA 属性の適切な使用**

- `aria-label`: 要素の目的を説明
- `aria-describedby`: 追加の説明を参照
- `aria-hidden`: 装飾要素をスクリーンリーダーから隠す
- `aria-live`: 動的コンテンツの更新を通知
- `role`: 要素の役割を明確化

### 11.5 ダイナミックタイプ

**フォントサイズの調整に対応**
ユーザーがシステム設定でフォントサイズを変更できるように：

```css
/* 相対単位の使用 */
body {
  font-size: 16px; /* ベースサイズ */
}

h1 {
  font-size: 2rem; /* ベースサイズの2倍 */
}

/* スケーリング */
.text-scale {
  font-size: clamp(14px, 1rem, 18px);
}

/* カスタムプロパティでスケーリング */
:root {
  --base-font-size: 16px;
  --scale-factor: 1;
}

@media (prefers-font-size: large) {
  :root {
    --scale-factor: 1.2;
  }
}

.dynamic-text {
  font-size: calc(var(--base-font-size) * var(--scale-factor));
}
```

**レイアウトの適応**

- テキストが大きくなってもレイアウトが崩れない
- スクロール可能な領域の確保
- 要素の最小/最大サイズの設定

### 11.6 その他のアクセシビリティ機能

**モーションの軽減**

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
  }

  /* スムーズスクロールも無効化 */
  html {
    scroll-behavior: auto !important;
  }
}
```

**色の調整**

- 色だけで情報を伝えない
- コントラストの確保
- カラーブラインド対応
- ハイコントラストモード対応

**ハイコントラストモード**

```css
@media (prefers-contrast: high) {
  .element {
    border: 2px solid currentColor;
    background: transparent;
  }
}
```

**透明度の調整**

```css
@media (prefers-reduced-transparency: reduce) {
  .glass-effect {
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: none;
  }
}
```

---

## 12. コンポーネントデザイン

### 12.1 ボタン

**プライマリボタン**

```css
.button-primary {
  background: linear-gradient(135deg, #4ade80 0%, #22d3ee 100%);
  color: #030712;
  font-weight: 600;
  padding: 12px 24px;
  border-radius: 9999px;
  box-shadow: 0 20px 45px rgba(16, 185, 129, 0.35);
  transition: transform 150ms, box-shadow 150ms;
}

.button-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 25px 50px rgba(16, 185, 129, 0.4);
}

.button-primary:active {
  transform: translateY(0);
  transition: transform 50ms;
}
```

**セカンダリボタン**

```css
.button-secondary {
  background: rgba(255, 255, 255, 0.05);
  color: #f9fafb;
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 12px 24px;
  border-radius: 9999px;
  transition: background 150ms, border-color 150ms;
}

.button-secondary:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.2);
}
```

### 12.2 カード

```css
.card {
  background: rgba(17, 24, 39, 0.8);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 24px;
  padding: 24px;
  box-shadow: 0 35px 120px rgba(1, 6, 3, 0.55);
  transition: transform 150ms, box-shadow 150ms, border-color 150ms;
}

.card:hover {
  transform: translateY(-4px);
  border-color: rgba(34, 197, 94, 0.3);
  box-shadow: 0 45px 140px rgba(1, 8, 4, 0.65);
}
```

### 12.3 入力フィールド

```css
.input {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  padding: 12px 16px;
  color: #f9fafb;
  transition: border-color 150ms, box-shadow 150ms;
}

.input:focus {
  outline: none;
  border-color: rgba(34, 197, 94, 0.5);
  box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.1);
}

.input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

### 12.4 バッジ

```css
.badge-success {
  background: rgba(16, 185, 129, 0.15);
  color: #6ee7b7;
  border: 1px solid rgba(16, 185, 129, 0.3);
  padding: 4px 12px;
  border-radius: 9999px;
  font-size: 12px;
  font-weight: 600;
}
```

---

## 13. レスポンシブデザイン

### 13.1 ブレークポイント

```
Mobile:      < 640px   (sm)
Tablet:      640px+    (md)
Desktop:     1024px+   (lg)
Large:       1280px+   (xl)
Extra Large: 1536px+   (2xl)
```

### 13.2 セーフエリアとインセット

**セーフエリアの考慮**
iOS デバイスでは、ノッチ、ホームインジケーター、ステータスバーなどのシステム UI を避ける必要があります：

```css
/* CSSセーフエリア */
.safe-area {
  padding-top: env(safe-area-inset-top);
  padding-right: env(safe-area-inset-right);
  padding-bottom: env(safe-area-inset-bottom);
  padding-left: env(safe-area-inset-left);
}

/* ビューポートメタタグ */
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
```

**インセットの推奨値**

- **最小インセット**: 16px（コンテンツと画面端の間）
- **標準インセット**: 20px
- **大インセット**: 24px（重要なコンテンツ）

### 13.3 モバイルファースト

**アプローチ**

- モバイルから設計を開始
- 段階的に大画面に対応
- タッチ操作を優先

**タッチターゲット**
Apple HIG では、タッチターゲットのサイズについて以下のガイドラインを提供しています：

- **最小サイズ**: 44pt×44pt（iOS）、44px×44px（Web）
- **推奨サイズ**: 48pt×48pt（iOS）、48px×48px（Web）
- **要素間の間隔**: 8pt 以上（iOS）、8px 以上（Web）

**タッチターゲットの実装**

```css
/* 最小タッチターゲット */
.touch-target {
  min-width: 44px;
  min-height: 44px;
  padding: 12px; /* 視覚的なサイズが小さくても、タッチ領域は確保 */
}

/* 推奨タッチターゲット */
.touch-target-recommended {
  min-width: 48px;
  min-height: 48px;
  padding: 14px;
}
```

**タッチ操作の最適化**

- 誤タップを防ぐため、要素間に十分な間隔を確保
- 重要な操作は画面の中央下部に配置（親指が届きやすい）
- スワイプジェスチャーの領域を確保

### 13.3 適応的レイアウト

**グリッドシステム**

- モバイル: 1 カラム
- タブレット: 2 カラム
- デスクトップ: 3-4 カラム

**ナビゲーション**

- モバイル: ハンバーガーメニュー
- タブレット: タブナビゲーション
- デスクトップ: トップナビゲーション

---

## 14. パフォーマンス最適化

### 14.1 読み込み速度

**最適化手法**

- 重要コンテンツの優先読み込み
- 画像の遅延読み込み
- コード分割と最適化
- CDN の活用

**目標**

- First Contentful Paint: < 1.5 秒
- Time to Interactive: < 3.5 秒
- Largest Contentful Paint: < 2.5 秒

### 14.2 アニメーションパフォーマンス

**GPU 加速**

```css
.will-change-transform {
  will-change: transform;
}

.gpu-accelerated {
  transform: translateZ(0);
}
```

**最適化**

- transform と opacity の使用
- レイアウトシフトの回避
- 60fps の維持

---

## 15. 実装チェックリスト

### 15.1 デザイン原則

- [ ] Clarity（明確性）が実装されている
- [ ] Deference（尊重）が実装されている
- [ ] Depth（深度）が実装されている

### 15.2 一貫性

- [ ] デザイントークンが統一されている
- [ ] コンポーネントが一貫して使用されている
- [ ] ナビゲーションパターンが統一されている

### 15.3 アクセシビリティ

- [ ] WCAG AA 準拠（コントラスト比 4.5:1 以上）
- [ ] キーボードナビゲーションが機能する
- [ ] スクリーンリーダーで読み取り可能
- [ ] フォーカス表示が明確

### 15.4 パフォーマンス

- [ ] 読み込み速度が最適化されている
- [ ] アニメーションが 60fps で動作
- [ ] レスポンシブデザインが適切

### 15.5 ユーザー体験

- [ ] フィードバックが即座に提供される
- [ ] エラーメッセージが明確
- [ ] ローディング状態が明確
- [ ] 操作が直感的

---

## 16. SF Symbols とアイコノグラフィ

### 16.1 SF Symbols

**SF Symbols とは**
Apple が提供する、統一されたアイコンシステム。San Francisco フォントと調和するように設計されています。

**特徴**

- 9 つのウェイト（Ultra Light から Black）
- 3 つのサイズ（Small, Medium, Large）
- 自動的なレンダリングモード（Hierarchical, Palette, Multicolor）

**Web での使用**

```css
/* SF Symbolsをフォントとして使用（Webでは制限あり） */
.icon {
  font-family: 'SF Pro Display', 'SF Pro Text', -apple-system;
  font-weight: 400;
  font-size: 24px;
}

/* SVGとして使用（推奨） */
.icon-svg {
  width: 24px;
  height: 24px;
  fill: currentColor;
}
```

**アイコンデザインの原則**

- **シンプル**: 複雑すぎない、明確な形状
- **一貫性**: 同じスタイルで統一
- **認識しやすさ**: 一目で意味が伝わる
- **スケーラビリティ**: 様々なサイズで使用可能

### 16.2 アイコンサイズ

**推奨サイズ**

- **小**: 16px×16px（インライン、リスト）
- **中**: 24px×24px（標準、ボタン）
- **大**: 32px×32px（強調、カード）
- **特大**: 48px×48px（ヒーロー、空状態）

**アイコンとテキストの配置**

```css
.icon-text {
  display: flex;
  align-items: center;
  gap: 8px; /* アイコンとテキストの間隔 */
}

.icon-text .icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}
```

---

## 17. 参考リソース

### 17.1 公式ドキュメント

- [Apple Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/)
- [iOS Design Guidelines](https://developer.apple.com/design/human-interface-guidelines/ios)
- [macOS Design Guidelines](https://developer.apple.com/design/human-interface-guidelines/macos)
- [SF Symbols](https://developer.apple.com/sf-symbols/)
- [SF Pro Font](https://developer.apple.com/fonts/)

### 16.2 アクセシビリティ

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)

### 16.3 パフォーマンス

- [Web Vitals](https://web.dev/vitals/)
- [Chrome DevTools Performance](https://developer.chrome.com/docs/devtools/performance/)

---

## 18. プラットフォーム固有の考慮事項

### 18.1 iOS/iPadOS

**特徴**

- タッチ操作が主
- ジェスチャーナビゲーション
- モーダル表示が多い
- セーフエリアの考慮が重要

**推奨事項**

- タッチターゲット: 44pt×44pt 以上
- スワイプジェスチャーの活用
- ハプティックフィードバックの提供
- ステータスバーとの調和

### 18.2 macOS

**特徴**

- マウスとキーボード操作
- ウィンドウ管理
- メニューバーの活用
- より大きな画面サイズ

**推奨事項**

- ホバー状態の提供
- キーボードショートカット
- ウィンドウサイズの適応
- メニューバーとの統合

### 18.3 Web アプリケーション

**考慮事項**

- クロスプラットフォーム対応
- ブラウザの違い
- ネットワーク状態の考慮
- プログレッシブエンハンスメント

**実装戦略**

- モバイルファーストアプローチ
- レスポンシブデザイン
- タッチとマウスの両方に対応
- フォールバックの提供

---

## 19. まとめ

Apple Human Interface Guidelines の原則を Web アプリケーションに適用することで、以下のような価値を提供できます：

1. **明確性**: ユーザーが迷わず目的を達成できる
2. **尊重**: コンテンツが主役となる洗練されたデザイン
3. **深度**: 視覚的階層と動きによる理解しやすいインターフェース
4. **一貫性**: プラットフォーム全体での統一された体験
5. **アクセシビリティ**: すべてのユーザーが利用可能

これらの原則を実装することで、プレミアム SaaS サービスとしての品質と使いやすさを両立できます。

---

**最終更新**: 2024 年 11 月 10 日
**バージョン**: 1.0.0
**参考**: [Apple Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/)
