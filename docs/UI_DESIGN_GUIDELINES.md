# WEBGPT UIデザインガイドライン

## 概要

このドキュメントは、WEBGPTのプレミアムSaaSサービスとしてのUIデザインガイドラインです。ミニマルかつ洗練された高級感を保ちながら、世界的に評価されているデザインシステム（Apple HIG、Google Material Design、Microsoft Fluent Design）のエッセンスを取り入れた設計方針を定義します。

**重要**: このドキュメントはデザイン案であり、実装の変更は行いません。今後のデザイン改善の参考として使用してください。

---

## 1. デザイン哲学

### 1.1 コアバリュー
- **ミニマリズム**: 不要な要素を排除し、本質的な機能に集中
- **洗練された高級感**: プレミアムサービスとしての品質感を表現
- **機能性重視**: 美しさと使いやすさの両立
- **一貫性**: 全画面で統一されたデザイン言語

### 1.2 デザイン原則
1. **Clarity（明確性）**: 情報の階層を明確にし、ユーザーが迷わない
2. **Deference（尊重）**: コンテンツを尊重し、UIは控えめに
3. **Depth（深度）**: 適切な階層と奥行きで情報を整理

---

## 2. カラーパレット

### 2.1 ベースカラー

#### プライマリカラー（緑系）
```
Primary 50:  #F0FDF4   (背景・ハイライト)
Primary 100: #DCFCE7   (軽い背景)
Primary 200: #BBF7D0   (ホバー状態)
Primary 300: #86EFAC   (アクセント)
Primary 400: #4ADE80   (メインアクション)
Primary 500: #22C55E   (プライマリ)
Primary 600: #16A34A   (ホバー・アクティブ)
Primary 700: #15803D   (テキスト・強調)
Primary 800: #166534   (ダークモード)
Primary 900: #14532D   (最深)
```

#### セカンダリカラー（シアン系）
```
Cyan 50:  #ECFEFF
Cyan 100: #CFFAFE
Cyan 200: #A5F3FC
Cyan 300: #67E8F9
Cyan 400: #22D3EE
Cyan 500: #06B6D4   (セカンダリ)
Cyan 600: #0891B2
Cyan 700: #0E7490
Cyan 800: #155E75
Cyan 900: #164E63
```

#### ニュートラルカラー（黒・グレー系）
```
Black:      #000000   (純黒)
Gray 950:   #030712   (最深背景)
Gray 900:   #111827   (ダーク背景)
Gray 800:   #1F2937   (カード背景)
Gray 700:   #374151   (境界線)
Gray 600:   #4B5563   (無効テキスト)
Gray 500:   #6B7280   (セカンダリテキスト)
Gray 400:   #9CA3AF   (プレースホルダー)
Gray 300:   #D1D5DB   (軽い境界線)
Gray 200:   #E5E7EB   (背景)
Gray 100:   #F3F4F6   (ライト背景)
Gray 50:    #F9FAFB   (最軽背景)
White:      #FFFFFF   (純白)
```

### 2.2 セマンティックカラー

#### 成功（Success）
```
Success Light: #10B981
Success Dark:  #059669
Success BG:    rgba(16, 185, 129, 0.1)
```

#### 警告（Warning）
```
Warning Light: #F59E0B
Warning Dark:  #D97706
Warning BG:    rgba(245, 158, 11, 0.1)
```

#### エラー（Error）
```
Error Light:   #EF4444
Error Dark:     #DC2626
Error BG:       rgba(239, 68, 68, 0.1)
```

#### 情報（Info）
```
Info Light:    #3B82F6
Info Dark:      #2563EB
Info BG:        rgba(59, 130, 246, 0.1)
```

### 2.3 カラー使用ガイドライン

#### ダークモード（推奨）
- **背景**: Gray 950 → Gray 900 のグラデーション
- **カード**: Gray 900 / 10% opacity overlay
- **テキスト**: White / Gray 100
- **アクセント**: Primary 400-500

#### ライトモード（オプション）
- **背景**: White / Gray 50
- **カード**: White / Gray 100
- **テキスト**: Gray 900 / Gray 700
- **アクセント**: Primary 600-700

#### コントラスト比
- **本文テキスト**: WCAG AA準拠（4.5:1以上）
- **大見出し**: WCAG AA準拠（3:1以上）
- **インタラクティブ要素**: WCAG AA準拠（3:1以上）

---

## 3. タイポグラフィ

### 3.1 フォントファミリー

#### 推奨フォントスタック
```css
/* 日本語 */
font-family: -apple-system, BlinkMacSystemFont, "Hiragino Kaku Gothic ProN", 
             "Hiragino Sans", "Noto Sans JP", "Yu Gothic", "Meiryo", 
             sans-serif;

/* 英語・数字 */
font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", 
             "SF Pro Text", "Segoe UI", Roboto, "Helvetica Neue", 
             Arial, sans-serif;

/* モノスペース（コード・データ） */
font-family: "SF Mono", "Monaco", "Inconsolata", "Fira Code", 
             "Droid Sans Mono", "Source Code Pro", monospace;
```

### 3.2 タイポグラフィスケール

#### 見出し
```
H1 (Hero):     48px / 56px  (font-weight: 600)
H2 (Section):   36px / 44px  (font-weight: 600)
H3 (Subsection):28px / 36px  (font-weight: 600)
H4 (Card):      24px / 32px  (font-weight: 600)
H5 (Label):     20px / 28px  (font-weight: 600)
H6 (Small):     18px / 24px  (font-weight: 600)
```

#### 本文
```
Body Large:     18px / 28px  (font-weight: 400)
Body:           16px / 24px  (font-weight: 400)
Body Small:     14px / 20px  (font-weight: 400)
Caption:        12px / 16px  (font-weight: 400)
```

#### 特殊用途
```
Label:          14px / 20px  (font-weight: 500, letter-spacing: 0.1em)
Button:         14px / 20px  (font-weight: 600)
Code:           14px / 20px  (font-family: monospace)
```

### 3.3 タイポグラフィガイドライン

- **行間**: 1.5倍（本文）、1.2倍（見出し）
- **文字間隔**: デフォルト（日本語）、-0.01em（英語）
- **トラッキング**: 大文字ラベルは0.1em-0.35em
- **テキストの長さ**: 1行60-75文字（日本語）、45-75文字（英語）

---

## 4. スペーシング（余白）

### 4.1 スペーシングスケール

```
0:    0px
1:    4px
2:    8px
3:    12px
4:    16px
5:    20px
6:    24px
8:    32px
10:   40px
12:   48px
16:   64px
20:   80px
24:   96px
32:   128px
```

### 4.2 スペーシングガイドライン

#### コンテナ
- **ページマージン**: 24px（モバイル）、32px（タブレット）、48px（デスクトップ）
- **コンテンツ最大幅**: 1280px（6xl）
- **セクション間隔**: 64px-96px

#### コンポーネント
- **カードパディング**: 24px（標準）、32px（大）
- **ボタンパディング**: 12px 24px（標準）、16px 32px（大）
- **入力フィールド**: 12px 16px（標準）、16px 20px（大）
- **要素間隔**: 16px（密）、24px（標準）、32px（疎）

#### グリッドシステム
- **カラム間隔**: 24px（標準）、32px（大）
- **行間隔**: 24px（標準）、32px（大）

---

## 5. 質感（Material & Depth）

### 5.1 エレベーション（影）

```
Level 0 (Flat):        none
Level 1 (Card):        0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24)
Level 2 (Hover):      0 3px 6px rgba(0,0,0,0.16), 0 3px 6px rgba(0,0,0,0.23)
Level 3 (Modal):      0 10px 20px rgba(0,0,0,0.19), 0 6px 6px rgba(0,0,0,0.23)
Level 4 (Popover):    0 14px 28px rgba(0,0,0,0.25), 0 10px 10px rgba(0,0,0,0.22)
Level 5 (Toast):      0 19px 38px rgba(0,0,0,0.30), 0 15px 12px rgba(0,0,0,0.22)
```

### 5.2 グラスモーフィズム

```css
/* カード背景 */
background: rgba(255, 255, 255, 0.05);
backdrop-filter: blur(20px);
-webkit-backdrop-filter: blur(20px);
border: 1px solid rgba(255, 255, 255, 0.1);

/* ダークモード */
background: rgba(17, 24, 39, 0.8);
backdrop-filter: blur(20px);
border: 1px solid rgba(255, 255, 255, 0.1);
```

### 5.3 グラデーション

#### アクセントグラデーション
```css
/* プライマリ */
background: linear-gradient(135deg, #4ADE80 0%, #22D3EE 100%);

/* セカンダリ */
background: linear-gradient(135deg, #22C55E 0%, #06B6D4 100%);

/* 背景グラデーション */
background: linear-gradient(180deg, #030712 0%, #111827 50%, #1F2937 100%);
```

### 5.4 ボーダー

```css
/* 標準ボーダー */
border: 1px solid rgba(255, 255, 255, 0.1);

/* 強調ボーダー */
border: 1px solid rgba(34, 197, 94, 0.3);

/* エラーボーダー */
border: 1px solid rgba(239, 68, 68, 0.3);
```

---

## 6. インタラクション

### 6.1 アニメーション

#### 持続時間
```
Fast:     150ms   (ホバー、フォーカス)
Normal:   250ms   (標準トランジション)
Slow:     350ms   (モーダル、ページ遷移)
```

#### イージング
```css
/* 標準 */
transition-timing-function: cubic-bezier(0.4, 0.0, 0.2, 1);

/* エントランス */
transition-timing-function: cubic-bezier(0.0, 0.0, 0.2, 1);

/* イグジット */
transition-timing-function: cubic-bezier(0.4, 0.0, 1, 1);

/* バウンス（軽い） */
transition-timing-function: cubic-bezier(0.68, -0.55, 0.265, 1.55);
```

### 6.2 ホバー効果

#### ボタン
```css
/* プライマリボタン */
transform: translateY(-2px);
box-shadow: 0 20px 45px rgba(16, 185, 129, 0.35);

/* セカンダリボタン */
background: rgba(255, 255, 255, 0.1);
border-color: rgba(255, 255, 255, 0.2);
```

#### カード
```css
transform: translateY(-4px);
border-color: rgba(34, 197, 94, 0.3);
box-shadow: 0 45px 140px rgba(1, 8, 4, 0.65);
```

### 6.3 フィードバック

#### ローディング
- **スケルトンローディング**: コンテンツの形状を保持
- **プログレスバー**: 明確な進捗表示
- **スピナー**: 軽量なアニメーション

#### トースト通知
- **表示時間**: 3-5秒（自動非表示）
- **位置**: 右上（デスクトップ）、下部中央（モバイル）
- **アニメーション**: スライドイン/アウト

---

## 7. アクセシビリティ

### 7.1 WCAG準拠

- **レベル**: AA準拠（推奨）、AAA準拠（可能な限り）
- **コントラスト比**: 4.5:1（本文）、3:1（大見出し）
- **フォーカス表示**: 明確なフォーカスリング（2px solid Primary 400）

### 7.2 キーボードナビゲーション

- **Tab順序**: 論理的な順序
- **フォーカストラップ**: モーダル内で有効
- **ショートカット**: 主要機能にキーボードショートカットを提供

### 7.3 スクリーンリーダー

- **ARIAラベル**: 適切なラベル付け
- **ランドマーク**: セマンティックなHTML構造
- **ライブリージョン**: 動的コンテンツの更新を通知

### 7.4 モーション

- **prefers-reduced-motion**: ユーザーの設定を尊重
```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 8. 構造と階層

### 8.1 レイアウト原則

#### 8ポイントグリッド
- すべての要素は8pxの倍数で配置
- 例外: 4pxの細かい調整は許可

#### コンテンツ階層
1. **プライマリ**: 主要なアクション・情報
2. **セカンダリ**: 補助的な情報・アクション
3. **ターシャリ**: 詳細情報・メタ情報

### 8.2 ナビゲーション構造

```
Header
├── Logo
├── Primary Navigation
│   ├── Dashboard
│   ├── Usage
│   └── Plans
└── User Menu
    ├── Profile
    └── Logout
```

### 8.3 ページ構造

```
Page Container (max-width: 1280px)
├── Header Section
│   ├── Breadcrumb (optional)
│   ├── Page Title
│   └── Action Buttons
├── Content Section
│   ├── Stats Cards (optional)
│   ├── Main Content
│   └── Sidebar (optional)
└── Footer (optional)
```

---

## 9. コンポーネントデザイン

### 9.1 ボタン

#### プライマリボタン
```css
background: linear-gradient(135deg, #4ADE80 0%, #22D3EE 100%);
color: #030712;
font-weight: 600;
padding: 12px 24px;
border-radius: 9999px;
box-shadow: 0 20px 45px rgba(16, 185, 129, 0.35);
transition: transform 150ms, box-shadow 150ms;
```

#### セカンダリボタン
```css
background: rgba(255, 255, 255, 0.05);
color: #F9FAFB;
border: 1px solid rgba(255, 255, 255, 0.1);
padding: 12px 24px;
border-radius: 9999px;
transition: background 150ms, border-color 150ms;
```

#### テキストボタン
```css
color: #4ADE80;
background: transparent;
padding: 8px 16px;
border-radius: 8px;
transition: background 150ms;
```

### 9.2 カード

```css
background: rgba(17, 24, 39, 0.8);
backdrop-filter: blur(20px);
border: 1px solid rgba(255, 255, 255, 0.1);
border-radius: 24px;
padding: 24px;
box-shadow: 0 35px 120px rgba(1, 6, 3, 0.55);
```

### 9.3 入力フィールド

```css
background: rgba(255, 255, 255, 0.05);
border: 1px solid rgba(255, 255, 255, 0.1);
border-radius: 16px;
padding: 12px 16px;
color: #F9FAFB;
transition: border-color 150ms, box-shadow 150ms;

/* フォーカス */
&:focus {
  outline: none;
  border-color: rgba(34, 197, 94, 0.5);
  box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.1);
}
```

### 9.4 バッジ

```css
/* 成功 */
background: rgba(16, 185, 129, 0.15);
color: #6EE7B7;
border: 1px solid rgba(16, 185, 129, 0.3);

/* 警告 */
background: rgba(245, 158, 11, 0.15);
color: #FCD34D;
border: 1px solid rgba(245, 158, 11, 0.3);

/* エラー */
background: rgba(239, 68, 68, 0.15);
color: #FCA5A5;
border: 1px solid rgba(239, 68, 68, 0.3);
```

---

## 10. レスポンシブデザイン

### 10.1 ブレークポイント

```
Mobile:      < 640px   (sm)
Tablet:      640px+    (md)
Desktop:     1024px+   (lg)
Large:       1280px+   (xl)
Extra Large: 1536px+   (2xl)
```

### 10.2 レスポンシブガイドライン

- **モバイル**: 1カラム、タッチターゲット44px以上
- **タブレット**: 2カラム、適切な余白
- **デスクトップ**: 3-4カラム、最大幅1280px

---

## 11. デザインシステムの実装

### 11.1 デザイントークン

```typescript
// カラー
export const colors = {
  primary: {
    50: '#F0FDF4',
    100: '#DCFCE7',
    // ... 上記カラーパレット参照
  },
  // ...
};

// スペーシング
export const spacing = {
  0: '0px',
  1: '4px',
  2: '8px',
  // ... 上記スペーシングスケール参照
};

// タイポグラフィ
export const typography = {
  h1: {
    fontSize: '48px',
    lineHeight: '56px',
    fontWeight: 600,
  },
  // ...
};
```

### 11.2 コンポーネントライブラリ

推奨: Tailwind CSS + Headless UI / Radix UI
- **Tailwind CSS**: ユーティリティファーストのスタイリング
- **Headless UI / Radix UI**: アクセシブルなコンポーネント

---

## 12. デザインレビューチェックリスト

### 12.1 ビジュアル
- [ ] カラーパレットが一貫している
- [ ] タイポグラフィが統一されている
- [ ] スペーシングが8ポイントグリッドに準拠している
- [ ] 影とエレベーションが適切に使用されている

### 12.2 インタラクション
- [ ] ホバー状態が明確に定義されている
- [ ] アニメーションが滑らかで適切な速度
- [ ] フィードバックが即座に提供される
- [ ] ローディング状態が明確

### 12.3 アクセシビリティ
- [ ] コントラスト比がWCAG AA準拠
- [ ] キーボードナビゲーションが機能
- [ ] スクリーンリーダーで読み取り可能
- [ ] フォーカス表示が明確

### 12.4 レスポンシブ
- [ ] モバイルで適切に表示される
- [ ] タブレットで最適化されている
- [ ] デスクトップで最大幅が設定されている
- [ ] タッチターゲットが適切なサイズ

---

## 13. 参考リソース

### 13.1 デザインシステム
- [Apple Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/)
- [Google Material Design](https://material.io/design)
- [Microsoft Fluent Design System](https://www.microsoft.com/design/fluent/)

### 13.2 アクセシビリティ
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)

### 13.3 ツール
- [Figma](https://www.figma.com/) - デザインツール
- [Tailwind CSS](https://tailwindcss.com/) - CSSフレームワーク
- [Storybook](https://storybook.js.org/) - コンポーネント開発環境

---

## 14. 今後の改善案

### 14.1 短期（1-3ヶ月）
- デザイントークンの実装
- コンポーネントライブラリの整備
- アクセシビリティの改善

### 14.2 中期（3-6ヶ月）
- ダークモードの完全対応
- アニメーションの最適化
- モバイルUXの改善

### 14.3 長期（6-12ヶ月）
- デザインシステムの完全実装
- カスタマイズ可能なテーマ
- 多言語対応の改善

---

**最終更新**: 2024年11月9日
**バージョン**: 1.0.0
**ステータス**: デザイン案（実装変更なし）

