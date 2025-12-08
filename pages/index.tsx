import Link from 'next/link';
import { useState } from 'react';
import Layout from '@/components/layout';
import Button from '@/components/ui/Button';
import WebgptIcon from '@/components/WebgptIcon';

const NAV_LINKS = [
  { label: '導入の流れ', href: '#flow' },
  { label: '機能', href: '#features' },
  { label: '料金', href: '#pricing' },
  { label: 'よくある質問', href: '#faq' },
];

const HERO_FEATURES = [
  '導入企業 2社（SaaS / メディア）',
  '最短10日で本番公開',
  '平均一次回答 8秒',
  '95言語を自動認識',
];

const STAT_ITEMS = [
  { label: '導入企業', value: '2社' },
  { label: '平均一次回答', value: '8秒' },
  { label: '導入準備期間', value: '10日' },
  { label: '対応言語', value: '95言語' },
];

const STEPS = [
  {
    number: '01',
    title: '初回ヒアリング',
    points: ['対象サイトと目的を共有', '禁止事項やトーンを整理', '7日間のスケジュールを確定'],
  },
  {
    number: '02',
    title: 'ナレッジ同期',
    points: ['URLと資料をアップロード', 'AIがチャットを生成', 'その日のうちにテスト共有'],
  },
  {
    number: '03',
    title: '公開と伴走',
    points: ['コード1行で設置', '応答ログを確認', '週次で改善フィードバック'],
  },
];

const DETAILED_FEATURES = [
  {
    badge: 'パーソナライズ',
    title: 'ブランドらしい会話',
    description: 'マニュアルとFAQを学習し、トーンを崩さずに回答。',
  },
  {
    badge: '声かけ',
    title: '状況に合わせた案内',
    description: '離脱しそうな訪問者へ一言メッセージを自動表示。',
  },
  {
    badge: '要約',
    title: '毎日の問い合わせを要約',
    description: '会話ログを1本のサマリーにしてメール共有。',
  },
  {
    badge: '有人連携',
    title: '人へのスムーズな切り替え',
    description: '対応が難しい会話は担当者へログ付きで転送。',
  },
  {
    badge: 'リード獲得',
    title: 'メールと要望を取得',
    description: 'チャットだけで連絡先と希望内容を安全に収集。',
  },
  {
    badge: '自動処理',
    title: '予約や資料送付を自動化',
    description: '自然言語の指示で定型処理を実行します。',
  },
];

const FEATURE_CARDS = [
  { icon: '⚡', title: '即日で体験', description: '申し込み当日に試作チャットを確認できます。' },
  { icon: '🌐', title: '多言語', description: '95言語の判定と翻訳を自動で切り替え。' },
  { icon: '💬', title: '会話チューニング', description: 'ナレッジと禁止ワードを設定し質を管理。' },
  { icon: '📊', title: '会話インサイト', description: '質問傾向と離脱箇所を可視化。' },
  { icon: '🛡️', title: 'セキュリティ', description: 'データ暗号化と権限管理を徹底。' },
  { icon: '✨', title: '継続学習', description: 'ログをもとに自動で再学習を提案。' },
];

const ARTICLE_ITEMS = [
  {
    title: 'Ship Note 0.4.1',
    summary: '埋め込みチャットにストリーム表示とバブル整理を追加。ライトなUXを目指しています。',
    date: '2025.02.09',
    tag: 'Ship note',
    href: '/blog',
  },
  {
    title: 'Beta Team Memo #07',
    summary: '24社の導入で見えた「夜間応答」と「運用移管」の課題やメトリクスを共有。',
    date: '2025.01.28',
    tag: 'Team memo',
    href: '/blog',
  },
  {
    title: 'Docs: Embed Spec v2',
    summary: '埋め込みチャットのデザインルールとアクセント切り替えのトークン設計を整理した新版ドキュメント。',
    date: '2025.01.15',
    tag: 'Docs update',
    href: '/docs',
  },
];

const PRICING_PLANS = [
  {
    name: 'Web Booster',
    price: '初期 ¥198,000 / 月額 ¥33,000〜',
    description: 'Webサイトに松竹梅の“梅”プラン。サイトへの搭載までコミコミ。',
    features: ['AIチャットボットの作成', '貴社Webサイトへの埋め込み', '情報源となるデータ整備', 'モデル精度の調整サポート'],
    tag: 'Webサイト向け',
    cta: { label: 'Web Boosterを相談', href: '/contact' },
  },
  {
    name: 'LINE Full Auto',
    price: '初期 ¥330,000 / 月額 ¥55,000〜',
    description: '公式LINEでAI全自動対応。おすすめの“竹”プラン。',
    features: ['公式LINEに搭載', '特定ワードへの自動応答', 'ブランドに合わせたデザイン', '手動対応への切り替え機能'],
    tag: 'おすすめ',
    cta: { label: 'LINE Full Autoを相談', href: '/contact' },
  },
  {
    name: 'Assistant Pro',
    price: '初期 ¥440,000 / 月額 ¥77,000〜',
    description: '“松”グレード。手厚いサポートで体験を最大化。',
    features: ['LINE Full Autoの全機能', '有人対応へのシームレス切替', '複数担当者での管理', '管理サイトへの通知・レポート'],
    tag: 'サポート強化',
    cta: { label: 'Assistant Proを相談', href: '/contact' },
  },
];

const FAQ_ITEMS = [
  {
    question: '初期費用には何が含まれますか？',
    answer: '要件ヒアリング、ナレッジ収集、プロンプト設計、デモ環境でのQA、埋め込みサポートまでを30〜60万円の範囲に含めています。',
  },
  {
    question: '月次費用はどのように計算しますか？',
    answer: '月3万円〜でCS伴走・監視・改善会を提供し、OpenAIやSupabaseなど実際に消費したAPIコストを明細付きで精算します。',
  },
  {
    question: '契約期間はどの程度必要ですか？',
    answer: '初期導入後は月単位で解約可能です。コンテンツ返却やデータ削除ポリシーも契約時に取り決めます。',
  },
  {
    question: 'サイトへ組み込む手順は？',
    answer: '発行された1行のスクリプトを `</body>` 直前に貼るだけです。WordPressやWixなど主要CMSでも同様です。',
  },
];

const FINAL_POINTS = [
  '導入〜運用まで同じCSメンバーが伴走',
  '導入企業 2社 / 最短10日で公開',
  '平均一次回答 8秒・95言語対応',
  '月次は3万円〜＋実費で柔軟に拡張',
];

export default function Home() {
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  return (
    <Layout showShellHeader={false} fullWidth>
      <div className="relative mx-auto w-full max-w-5xl px-4 pb-16 pt-6 sm:px-6 lg:px-10">
        <header className="sticky top-0 z-40 border-b border-premium-stroke/60 bg-premium-base/90 pb-5 backdrop-blur supports-[backdrop-filter]:bg-premium-base/80">
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <Link href="/" className="flex items-center gap-3">
                <WebgptIcon size={48} className="border-premium-stroke/70" />
                <div>
                  <p className="font-plex-mono text-sm uppercase tracking-[0.5em] text-premium-muted">WEBGPT</p>
                  <p className="-mt-1 font-display text-2xl font-semibold text-premium-text">Language Support OS</p>
                </div>
              </Link>
              <div className="flex flex-wrap items-center gap-2 font-plex-mono text-sm uppercase tracking-[0.35em] text-premium-muted">
                <span className="rounded-full border border-premium-stroke/80 px-3 py-1">導入企業 2社</span>
                <span className="rounded-full border border-premium-stroke/80 px-3 py-1">MIT ライセンス</span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3 font-plex-mono text-base uppercase tracking-[0.32em] text-premium-muted">
                <nav className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  {NAV_LINKS.map((link) => (
                    <a key={link.href} href={link.href} className="transition hover:text-premium-text">
                      {link.label}
                    </a>
                  ))}
                </nav>
                <div className="flex flex-1 items-center justify-end gap-2 text-sm tracking-[0.3em]">
                  <span className="hidden text-premium-muted sm:inline">常時稼働 99.9%</span>
                  <Link
                    href="/auth/login"
                    className="inline-flex items-center gap-2 whitespace-nowrap text-premium-muted transition hover:text-premium-accent"
                  >
                    ログイン
                    <span className="text-premium-accent">→</span>
                  </Link>
                </div>
              </div>
            </div>
          </header>

          <main className="space-y-10 sm:space-y-14">
            <section
              className="relative overflow-hidden rounded-[36px] border border-premium-stroke/40 bg-premium-surface/80 px-6 pb-10 pt-12 sm:px-8 section-fade shadow-[0_45px_120px_rgba(1,8,4,0.65)]"
              style={{ animationDelay: '0.05s' }}
            >
              <div className="pointer-events-none absolute inset-0 bg-premium-grid opacity-25" />
              <div className="pointer-events-none absolute -right-10 top-0 h-64 w-64 rounded-full bg-[radial-gradient(circle_at_top,_rgba(122,244,193,0.25),_transparent_70%)] blur-3xl" />
              <div className="pointer-events-none absolute -left-10 bottom-0 h-64 w-64 rounded-full bg-[radial-gradient(circle_at_bottom,_rgba(25,195,125,0.2),_transparent_70%)] blur-3xl" />
              <div className="grid gap-8 lg:grid-cols-[1.2fr,0.8fr] lg:items-center">
                <div>
                  <p className="text-sm uppercase tracking-[0.35em] text-premium-muted">AI SUPPORT OS</p>
                  <h1 className="font-display mt-4 text-4xl font-semibold leading-tight sm:text-6xl">
                    夜間も途切れないAIサポートを常設
                  </h1>
                  <p className="mt-4 text-xl text-premium-muted leading-relaxed">
                    専任CSがLPとナレッジを読み合わせしながら、最短10日で常設チャットを公開します。
                  </p>
                  <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                    <Button size="lg" onClick={() => (window.location.href = '/contact')}>
                      導入の相談をする
                    </Button>
                    <Button size="lg" variant="secondary" onClick={() => (window.location.href = '#pricing')}>
                      料金の仕組みを見る
                    </Button>
                  </div>
                </div>
                <div className="rounded-3xl border border-premium-stroke/60 bg-premium-card/30 p-5">
                  <p className="text-sm uppercase tracking-[0.35em] text-premium-muted">導入のポイント</p>
                  <div className="mt-4 grid gap-3 text-xl text-premium-muted">
                    {HERO_FEATURES.map((feature) => (
                      <div key={feature} className="flex items-start gap-3">
                        <span className="text-premium-accent">✓</span>
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <section
              id="stats"
              className="section-fade border-t border-premium-stroke/60 pt-10"
              style={{ animationDelay: '0.12s' }}
            >
              <div className="rounded-[32px] border border-premium-stroke/40 bg-premium-card/20 px-6 py-6 sm:px-8">
                <SectionHeading eyebrow="実績" title="数字で見る導入状況" align="left" />
                <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
                  {STAT_ITEMS.map((item) => (
                    <div key={item.label} className="rounded-2xl border border-premium-stroke/60 bg-premium-card/30 px-6 py-5">
                      <p className="text-4xl font-semibold">{item.value}</p>
                      <p className="text-xl text-premium-muted">{item.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section
              id="flow"
              className="section-fade border-t border-premium-stroke/60 pt-10"
              style={{ animationDelay: '0.18s' }}
            >
              <div className="rounded-[32px] border border-premium-stroke/40 bg-premium-card/20 px-6 py-6 sm:px-8">
                <SectionHeading
                  eyebrow="導入の流れ"
                  title="申し込み後10日で常設チャットへ"
                  description="ヒアリングから公開まで同じCSメンバーが伴走します。"
                />
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                  {STEPS.map((step) => (
                    <div key={step.number} className="rounded-2xl border border-premium-stroke/60 bg-premium-card/30 p-5">
                      <p className="text-sm uppercase tracking-[0.35em] text-premium-muted">STEP {step.number}</p>
                      <h3 className="mt-2 text-2xl font-semibold">{step.title}</h3>
                      <ul className="mt-3 space-y-2 text-lg text-premium-muted">
                        {step.points.map((point) => (
                          <li key={point} className="flex items-start gap-2">
                            <span>・</span>
                            <span>{point}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section
              className="section-fade border-t border-premium-stroke/60 pt-10"
              style={{ animationDelay: '0.24s' }}
            >
              <div className="rounded-[32px] border border-premium-stroke/40 bg-premium-card/20 px-6 py-6 sm:px-8">
                <SectionHeading eyebrow="導入前後" title="現場の声から逆算した会話体験" />
                <div className="grid gap-5 md:grid-cols-2">
                  {Object.entries({ before: 'よくあるチャットボットの困りごと', after: 'WEBGPT導入後に得られる体験' }).map(([key, title]) => (
                    <div key={key} className="rounded-2xl border border-premium-stroke/60 bg-premium-card/30 p-5">
                      <p className="text-sm uppercase tracking-[0.35em] text-premium-muted">{key === 'before' ? '導入前' : '導入後'}</p>
                      <h3 className="mt-2 text-2xl font-semibold">{title}</h3>
                      <ul className="mt-3 space-y-2 text-xl text-premium-muted">
                        {(key === 'before' ? ['回答の精度が日によってバラバラ', '夜間は誰も対応できない', 'ブランドらしさが失われる', '結局サポート工数は減らない'] : ['24時間365日の即時応答', 'ブランドトーンに合わせた会話', '社内ナレッジを安全に活用', '一次対応を自動化してコスト削減']).map((point) => (
                          <li key={point} className="flex items-start gap-3">
                            <span>{key === 'before' ? '・' : '✓'}</span>
                            <span>{point}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section
              id="features"
              className="section-fade border-t border-premium-stroke/60 pt-10"
              style={{ animationDelay: '0.3s' }}
            >
              <div className="rounded-[32px] border border-premium-stroke/40 bg-premium-card/20 px-6 py-6 sm:px-8">
                <SectionHeading
                  eyebrow="機能"
                  title="サポート現場の「こうだったら」を詰め込みました"
                  description="毎日使う機能だけを残し、迷わず扱えるようにしています。"
                />
                <div className="grid gap-4 md:grid-cols-2">
                  {DETAILED_FEATURES.map((feature) => (
                    <div key={feature.title} className="rounded-2xl border border-premium-stroke/60 bg-premium-card/30 p-5">
                      <span className="text-sm uppercase tracking-[0.35em] text-premium-muted">{feature.badge}</span>
                      <h3 className="mt-3 text-2xl font-semibold">{feature.title}</h3>
                      <p className="mt-2 text-lg text-premium-muted leading-relaxed">{feature.description}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  {FEATURE_CARDS.map((card) => (
                    <div key={card.title} className="rounded-2xl border border-premium-stroke/60 bg-premium-card/20 p-4">
                      <div className="text-2xl">{card.icon}</div>
                      <h3 className="mt-3 text-xl font-semibold">{card.title}</h3>
                      <p className="mt-2 text-lg text-premium-muted leading-relaxed">{card.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section
              id="articles"
              className="section-fade border-t border-premium-stroke/60 pt-10"
              style={{ animationDelay: '0.42s' }}
            >
              <div className="rounded-[32px] border border-premium-stroke/40 bg-premium-card/20 px-6 py-6 sm:px-8">
                <SectionHeading
                  eyebrow="お知らせ"
                  title="Ship Notes / Team Memo"
                  action={{ label: 'すべて見る →', href: '/blog' }}
                />
                <div className="space-y-4">
                  {ARTICLE_ITEMS.map((article) => (
                    <Link
                      key={article.title}
                      href={article.href}
                      className="block rounded-2xl border border-premium-stroke/60 bg-premium-card/30 p-5 transition hover:border-premium-accent/60"
                    >
                      <div className="flex items-center justify-between text-sm text-premium-muted">
                        <span className="rounded-full border border-premium-stroke/60 px-3 py-1 uppercase tracking-[0.35em]">{article.tag}</span>
                        <span>{article.date}</span>
                      </div>
                      <h3 className="mt-3 text-xl font-semibold">{article.title}</h3>
                      <p className="mt-2 text-base text-premium-muted leading-relaxed">{article.summary}</p>
                      <span className="mt-4 inline-flex items-center text-base uppercase tracking-[0.35em] text-premium-accent">
                        続きを読む →
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            </section>

            <section
              id="pricing"
              className="section-fade border-t border-premium-stroke/60 pt-10"
              style={{ animationDelay: '0.6s' }}
            >
              <div className="rounded-[32px] border border-premium-stroke/40 bg-premium-card/20 px-6 py-6 sm:px-8">
                <SectionHeading
                  eyebrow="料金"
                  title="松竹梅で選べる3つのプラン"
                  description="Web Booster（Webサイト） / LINE Full Auto（LINE自動応答） / Assistant Pro（手厚い伴走）の3構成。初期費用 + 月額でシンプルです。"
                />
                <div className="grid gap-4 md:grid-cols-3">
                  {PRICING_PLANS.map((plan) => (
                    <div
                      key={plan.name}
                      className="rounded-2xl border border-premium-stroke/60 bg-premium-card/30 p-6"
                    >
                      {plan.tag && (
                        <span className="inline-flex rounded-full border border-premium-stroke/60 px-3 py-1 text-sm font-semibold uppercase tracking-[0.3em] text-premium-muted">
                          {plan.tag}
                        </span>
                      )}
                      <h3 className="mt-3 text-3xl font-semibold">{plan.name}</h3>
                      <p className="mt-1 text-xl text-premium-muted">{plan.description}</p>
                      <p className="mt-4 text-3xl font-semibold text-premium-accent">{plan.price}</p>
                      <ul className="mt-4 space-y-2 text-xl text-premium-muted">
                        {plan.features.map((feature) => (
                          <li key={feature} className="flex items-center gap-2">
                            <span className="text-premium-accent">✓</span>
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                      {plan.cta && (
                        <Link href={plan.cta.href} className="mt-6 block">
                          <Button className="w-full" size="full" variant="secondary">
                            {plan.cta.label}
                          </Button>
                        </Link>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section
              id="faq"
              className="section-fade border-t border-premium-stroke/60 pt-10"
              style={{ animationDelay: '0.66s' }}
            >
              <div className="rounded-[32px] border border-premium-stroke/40 bg-premium-card/20 px-6 py-6 sm:px-8">
                <SectionHeading
                  eyebrow="よくある質問"
                  title="初期費用と運用方法の質問"
                  description="実際に問い合わせが多い項目を4つにまとめました。その他は heartssh@gmail.com まで。"
                />
                <div className="space-y-3">
                  {FAQ_ITEMS.map((faq, idx) => {
                    const isOpen = openFaqIndex === idx;
                    return (
                      <button
                        key={faq.question}
                        type="button"
                        onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                        className="w-full rounded-2xl border border-premium-stroke/60 bg-premium-card/30 px-5 py-5 text-left text-xl text-premium-muted transition hover:border-premium-accent/60"
                      >
                        <div className="flex items-center justify-between">
                          <p className="font-semibold text-premium-text">
                            <span className="mr-3 text-premium-muted">Q{String(idx + 1).padStart(2, '0')}.</span>
                            {faq.question}
                          </p>
                          <span>{isOpen ? '−' : '+'}</span>
                        </div>
                        {isOpen && <p className="mt-2 text-xl text-premium-muted leading-relaxed">{faq.answer}</p>}
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>

            <section
              className="section-fade border-t border-premium-stroke/60 pt-10"
              style={{ animationDelay: '0.72s' }}
            >
              <div className="rounded-3xl border border-premium-stroke/60 bg-premium-elevated/50 p-8">
                <p className="text-sm uppercase tracking-[0.35em] text-premium-muted">お問い合わせ</p>
                <h2 className="mt-3 text-4xl font-semibold">WEBGPTをあなたの運用にも</h2>
                <p className="mt-3 text-xl text-premium-muted leading-relaxed">
                  標準は初期30〜60万円 + 月次手数料とAPI実費。導入後も同じCSメンバーが改善まで伴走します。
                </p>
                <div className="mt-4 space-y-2 text-xl text-premium-muted">
                  {FINAL_POINTS.map((point) => (
                    <div key={point} className="flex items-center gap-2">
                      <span className="text-premium-accent">✓</span>
                      <span>{point}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  <Button size="lg" onClick={() => (window.location.href = '/contact')}>
                    導入の相談をする
                  </Button>
                  <Button size="lg" variant="secondary" onClick={() => (window.location.href = '/dashboard/usage')}>
                    月次コストを見る
                  </Button>
                </div>
              </div>
            </section>
          </main>

          <footer className="mt-16 border-t border-premium-stroke/60 pt-6 text-base text-premium-muted">
            <p>© {new Date().getFullYear()} WEBGPT. This LP and embed UI are MIT Licensed.</p>
            <p className="mt-2">カラーやレイアウトは WEBGPT の独自ガイドラインに沿って設計しています。</p>
          </footer>
        </div>
    </Layout>
  );
}

interface SectionHeadingProps {
  eyebrow: string;
  title: string;
  description?: string;
  action?: { label: string; href: string };
  align?: 'left' | 'center';
}

function SectionHeading({ eyebrow, title, description, action, align = 'left' }: SectionHeadingProps) {
  return (
    <div className={`mb-6 ${align === 'center' ? 'text-center' : 'text-left'}`}>
      <p className="text-sm uppercase tracking-[0.35em] text-premium-muted">{eyebrow}</p>
      <div
        className={`mt-3 flex flex-col gap-3 ${
          align === 'center' ? 'items-center text-center' : 'items-start text-left'
        } ${action ? 'sm:flex-row sm:items-end sm:justify-between' : ''}`}
      >
        <div className={align === 'center' ? 'max-w-2xl' : 'w-full'}>
          <h2 className="font-display text-4xl font-semibold text-premium-text">{title}</h2>
          {description && <p className="mt-2 text-xl text-premium-muted leading-relaxed">{description}</p>}
        </div>
        {action && (
          <Link href={action.href} className="text-sm uppercase tracking-[0.35em] text-premium-muted transition hover:text-premium-accent">
            {action.label}
          </Link>
        )}
      </div>
    </div>
  );
}
