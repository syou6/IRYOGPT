# プレミアムSaaS UIデザイン・リファレンス

> 緑×黒を基調にしたミニマルで高級感のあるSaaS UIを設計するためのリファレンス。Apple HIG / Material / Fluent など世界的ガイドラインの要点を抽出し、AIやデザイナーチームに読み込ませる前提で構成しています。

---

## 1. ブランド指針
- **ビジュアルトーン:** 「抑制されたラグジュアリー」。黒をベースに深緑とネオングリーンでアクセント、余白とタイポで上質感を演出。
- **キーワード:** Minimal / Precise / Confident / Adaptive。
- **アクセシビリティ:** コントラスト比 WCAG AA 以上。明暗モード両対応を想定。

## 2. カラーパレット（例）
| レイヤ | 目的 | Hex | ノート |
| --- | --- | --- | --- |
| `Base` | 画面背景 | `#040607` | ピュアブラックではなく深みを意識した黒系。 |
| `Surface` | カード背景 | `#0B1410` | 若干のグリーンを混ぜてブランドらしさを付与。 |
| `Primary` | アクション | `#19C37D` | Supabase系の鮮やかなグリーン。 |
| `Primary/Deep` | 強調 | `#0F8A5F` | 大 CTA、チャートライン等で使用。 |
| `Accent` | グラデ・ハイライト | `#7AF4C1` | 透明度やグラデーションで使用。 |
| `Text/Main` | 本文 | `#F5F7F4` | 柔らかい白で高コントラスト確保。 |
| `Text/Muted` | 補足 | `#8BA39B` | サブ情報やラベル。 |
| `Stroke` | 境界 | `#1F2A23` | 透明 40% で使用。 |

> **Tips:** ダーク背景 + ネオングリーンは発光感を出しやすいが、アクセントの使いすぎはチープになるため 1 画面 2 箇所以内に制限。

## 3. タイポグラフィ
- **Primary:** `Söhne` / `Inter` などサンセリフ系でモダンさを確保。
- **Secondary:** セリフまたはコンデンス系を見出し限定で併用可。
- **階層:** H1 40px, H2 28px, H3 20px, Body 16px, Caption 14px（1.4–1.6 行間）。
- **カーニング:** 視覚的中央揃え。数字は等幅タブラーを使用しダッシュボードの信頼感を担保。

## 4. レイアウト・余白
- 8pt グリッドベース。主要ブレークポイント：1440 / 1200 / 768 / 375。
- カード間隔は 24–32px、セクション間は 48px 以上。
- ヒーローや主要 CTA 付近は余白を多めに取り、呼吸感を演出。

## 5. マテリアル感・モーション
- **Apple HIG:** Clarity / Deference / Depth。大型カードはガラスのような半透明＋微細なグラデ影。
- **Material3:** レイヤーごとに Elevation（例: Base 0, Surface 2, Floating CTA 6）。影はソフトに。
- **Fluent:** 光沢・ハイライトで触れたくなる質感。ホバー時に subtle な光の走りを追加。
- **モーション:** 滑らか（200–300ms）。意味を持つトランジションのみ。Easing は `cubic-bezier(0.4, 0, 0.2, 1)` ベース。

## 6. ナビゲーション・情報構造
- ヘッダーはフローティング（80px）＋ガラスモーフィズム。
- 左サイドバー or 上部タブで主要セクションを整理。アイコン + テキストで明瞭に。
- 情報階層：ヒーロー → KPI/プラン → 詳細カード → サポート CTA の順で視線誘導。
- 重要 KPI は最大 3 つ。グラフはライン + ドットで精度の高さを演出。

## 7. インタラクション・フィードバック
- **ボタン状態:** Default / Hover（微発光） / Pressed（彩度ダウン） / Disabled（30% Opacity）。
- **フォーム:** フォーカス時に緑の微光ラインとドロップ影。エラーは赤 `#FF5A5F` + メッセージ。
- **ローディング:** 線形インジケータ or 線が走るアニメーションで先進感。
- **サクセス通知:** トースト or バナーで「オペレーションに移る」旨を明記（Stripe 直後など）。

## 8. アクセシビリティ & 多端末
- ボタン/タップ領域は最小 44px。
- コントラスト: 背景 #040607 × 文字 #F5F7F4 → Ratio 12:1。
- モバイルでは余白比率を維持しつつコンポーネントを縦積み。
- 色覚バリア対策: 重要状態はアイコンやテキストでも示す。

## 9. グローバルガイドラインからのエッセンス
| ガイドライン | 引用エッセンス | 実装ノート |
| --- | --- | --- |
| Apple HIG | Clarity / Deference / Depth | コンテンツ最優先。背景は控えめ。余白で高級感を演出。 |
| Material 3 | レイヤード設計、意味あるモーション | Elevation マップを定義、動きで階層を補強。 |
| Fluent 2 | 光・素材・奥行き | グラデ + 微光エッジ。マルチデバイス対応。 |
| Carbon | エンタープライズ級の秩序 | 情報量が多くても規則性を維持。 |
| Polaris | ショップ/サブスクの親しみやすさ | CTAの文言・配置を明快に。 |
| Atlassian | コラボ向けの情報整理 | ナビとステータス表示をシンプルに。 |
| Spectrum | クリエイティブ x シンプル | 専門機能でも UI を重くしない。 |
| Lightning | 強いブランド感 + 機能性 | 緑×黒の世界観を徹底しつつフォームを充実。 |
| Base Web | 高速・レスポンシブ | パフォーマンスを UX の一部として扱う。 |
| Ant Design | 豊富なパターン | ページテンプレや表組を効率的に構築。 |

## 10. AI/デザイン生成用プロンプト例
```
あなたはプレミアムSaaS UIをデザインするプロフェッショナルです。ブランドカラーは緑(#19C37D)と黒(#040607)を基調に、ミニマルで高級感あるトーンを表現してください。Apple HIG / Material3 / Fluent2 / Carbon などのガイドライン要点（Clarity, Depth, Layered layout, Light & Motion）を取り入れ、配色・余白・質感・インタラクション・アクセシビリティを以下のチェックリストに沿って設計してください。

【チェックリスト】
1. 余白は8ptグリッド、セクション間48px以上。
2. Elevationと影でカード階層を表現、モーションは200-300ms。
3. コントラスト AA 以上、タップ領域44px以上。
4. CTAはPrimary Green、ホバー時に微発光。
5. Stripe決済完了後には「運営が学習を進めるので少々お待ちください」というステータスバナーを表示。
```

## 11. 運用チェックリスト
- [ ] 主要画面（Dashboard / Settings / Pricing / Auth / Marketing）の状態別デザインが揃っている
- [ ] ダーク/ライト双方でカラー変換ルールが定義済み
- [ ] UI Kit（Figma Components）の命名規則と階層が統一されている
- [ ] モーション仕様（タイムライン / Easing / 状態遷移）がドキュメント化されている
- [ ] Stripe 決済後のサクセスフローでユーザーの次アクションが必ず提示される

---

### 付録：参考リンク
- Apple Human Interface Guidelines – https://developer.apple.com/design/human-interface-guidelines/
- Material Design 3 – https://m3.material.io/
- Fluent 2 – https://fluent2.microsoft.design/
- Carbon Design System – https://carbondesignsystem.com/
- Polaris – https://polaris.shopify.com/
- Atlassian Design System – https://atlassian.design/
- Spectrum – https://spectrum.adobe.com/
- Lightning Design System – https://www.lightningdesignsystem.com/
- Base Web – https://baseweb.design/
- Ant Design – https://ant.design/
