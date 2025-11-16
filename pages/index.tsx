import Link from 'next/link';
import { useState } from 'react';
import Layout from '@/components/layout';
import Button from '@/components/ui/Button';

const NAV_LINKS = [
  { label: 'Flow', href: '#flow' },
  { label: 'Features', href: '#features' },
  { label: 'Members', href: '#members' },
  { label: 'Timeline', href: '#timeline' },
  { label: 'Pricing', href: '#pricing' },
];

const HERO_FEATURES = [
  '導入から活用まで専任チームが伴走',
  '使った分だけのシンプルな料金体系',
  '95言語を自動認識して自然に応対',
  'まずは 7 日間の無料トライアル',
];

const TRUST_LOGOS = ['Coming Soon 1', 'Coming Soon 2', 'Coming Soon 3', 'Coming Soon 4', 'Coming Soon 5'];

const STAT_ITEMS = [
  { label: 'ベータ参加企業', value: '24社' },
  { label: '稼働中のサイト数', value: '38サイト' },
  { label: '対応言語', value: '95以上' },
  { label: '稼働率', value: '99.9%' },
];

const STEPS = [
  {
    number: '01',
    title: 'トレーニングデータを同期',
    description: 'ベースURLを登録するだけで、クローラーが対象ページを収集し学習に反映します。',
  },
  {
    number: '02',
    title: 'サイトにインストール',
    description: '発行されたスクリプトを 1 行貼れば、どのCMSでもすぐにチャットが表示されます。',
  },
  {
    number: '03',
    title: '学習と改善',
    description: '会話ログとフィードバックをもとに自動で調整。必要に応じて人の手でも微調整できます。',
  },
];

const DETAILED_FEATURES = [
  {
    badge: 'Personalized',
    title: 'ブランドらしい受け答え',
    description: 'マニュアルやFAQから学習し、トーン&マナーを崩さずに回答します。',
  },
  {
    badge: 'Prompt',
    title: '声かけスクリプト',
    description: '来訪状況に合わせた一言を自動で表示し、会話のきっかけをつくります。',
  },
  {
    badge: 'Summary',
    title: 'メールサマリー',
    description: '1日の問い合わせを要点だけまとめてチームへ共有。素早く振り返れます。',
  },
  {
    badge: 'Human handoff',
    title: '人へのエスカレーション',
    description: 'AIで対応できない内容は、ログ付きで担当者に引き継げます。',
  },
  {
    badge: 'Lead',
    title: 'リード獲得',
    description: 'メールアドレスや要望をチャット内で取得し、そのままCRMへ連携。',
  },
  {
    badge: 'Actions',
    title: 'アクション実行',
    description: '予約・資料送付などを自然言語で指示し、定形処理を自動でこなします。',
  },
];

const FEATURE_CARDS = [
  { icon: '⚡', title: 'すぐに開始', description: 'トライアル申込からその日のうちにプロトタイプを確認できます。' },
  { icon: '🌐', title: '多言語対応', description: 'ユーザーの言語を自動判定し、自然な表現で返答します。' },
  { icon: '💬', title: '会話チューニング', description: 'ナレッジや禁止ワードを設定し、応答の質をコントロール。' },
  { icon: '📊', title: '会話インサイト', description: 'よくある質問や離脱ポイントを可視化し、改善施策に活かせます。' },
  { icon: '🛡️', title: '堅牢なセキュリティ', description: 'データは暗号化して保存し、アクセス権限も細かく管理。' },
  { icon: '✨', title: '継続学習', description: '会話ログをもとに自動でアップデート。必要に応じて再学習も代行します。' },
];

const MEMBER_CARDS = [
  {
    name: 'Ami Otsuka',
    role: 'Product Navigator',
    focus: 'LP / embedの体験を設計。ベータ企業との定例を担当。',
    timezone: 'Tokyo',
  },
  {
    name: 'Sho Hara',
    role: 'Customer Success',
    focus: 'トライアル中の改修依頼やヒアリングを担当。',
    timezone: 'Remote',
  },
  {
    name: 'Haruka Mori',
    role: 'Infra & Docs',
    focus: 'SSE / RPC / ドキュメント整備。MITライセンス周りも管轄。',
    timezone: 'Kyoto',
  },
  {
    name: 'Guest Maintainers',
    role: 'Community',
    focus: 'OSSユーザーと共同で ship note を更新中。',
    timezone: 'As needed',
  },
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

const TIMELINE = [
  {
    year: '2025',
    items: [
      {
        title: 'LPを新デザインにリビルド',
        description: 'Hero / Stats / Members / Timeline を独自トーンで再構築。',
        date: 'Feb',
      },
      {
        title: 'Embed Script Dev モード',
        description: 'ローカル向け `localhost:3000/api/embed/script` を公開し QA を容易に。',
        date: 'Feb',
      },
    ],
  },
  {
    year: '2024',
    items: [
      {
        title: 'Beta 24社をサポート',
        description: '24時間稼働 / 95言語対応の会話エンジンを稼働率99.9%で運用。',
        date: 'Dec',
      },
      {
        title: 'Members/Articlesセクションを刷新',
        description: 'LP構造と ship note の見せ方を統一し、読みやすさを優先。',
        date: 'Nov',
      },
    ],
  },
];

const PRICING_PLANS = [
  {
    name: 'スタンダード導入',
    price: '¥300,000〜¥600,000 / 初期',
    description: '1件30〜60万円でトレーニング〜埋め込みまで伴走。1サイト＋ナレッジ整備込み。',
    features: ['要件ヒアリング / 設計', 'コンテンツクローリング & テスト', '初回チューニング & QAフィードバック'],
    tag: '基本プラン',
    cta: { label: '導入相談する', href: '/contact' },
  },
  {
    name: 'カスタム導入',
    price: '¥1,000,000〜',
    description: '複数ブランドやワークフロー連携、UIカスタムを含む案件。要件に応じて個別見積もり。',
    features: ['Webhook / API 連携', '追加プロンプト・翻訳設計', 'セキュリティレビュー / NDA対応'],
    tag: 'フルカスタム',
    cta: { label: '要件を相談', href: '/contact' },
  },
  {
    name: '運用・API費用',
    price: '月 ¥30,000〜 + API実費',
    description: '初期導入後は月次で手数料とAPIコストを頂きます。利用量に応じた従量課金。',
    features: ['ダッシュボード利用 / 監視', '月次レポート・CS伴走', 'OpenAI / Supabase コストの実費精算'],
    tag: '月次',
    cta: { label: '料金の内訳を見る', href: '/dashboard/usage' },
  },
];

const FAQ_ITEMS = [
  {
    question: '初期費用の範囲には何が含まれますか？',
    answer: '30〜60万円の中に要件ヒアリング、ナレッジ収集、プロンプト設計、デモ環境でのQA、埋め込みサポートまでを含めています。複数ブランドや高度な連携が加わる場合は別途お見積りです。',
  },
  {
    question: '月次費用はどのように計算されますか？',
    answer: 'ベースは月3万円〜で、CS伴走・モニタリング・改善会を含みます。加えてOpenAIやSupabaseなど実際に消費したAPIコストを明細付きで精算します。',
  },
  {
    question: '契約期間の縛りはありますか？',
    answer: '初期導入完了後は月単位で解約可能です。コンテンツの返却やデータ削除ポリシーも契約時に取り決めます。',
  },
  {
    question: 'サイトの内容が変わったときは自動で再学習しますか？',
    answer: 'スタータープランでは再学習依頼をお送りいただく形です。スタジオ以降のプランでは自動再学習機能を搭載予定です。',
  },
  {
    question: 'チャットボットをサイトに組み込む手順は？',
    answer: '発行された1行のスクリプトを `</body>` 直前に貼るだけです。WordPressやWixなど主要CMSでも同様に設置できます。',
  },
  {
    question: '初回の学習にはどのくらい時間がかかりますか？',
    answer: 'URL登録から最短数時間でテスト可能です。ページ数が多い場合でも原則1営業日以内にサンプルをお送りします。',
  },
  {
    question: '代理店やOEM向けのプランは用意されていますか？',
    answer: '近日公開予定のアンリミテッドプランでOEM/ホワイトラベルに対応予定です。個別要件はお問い合わせください。',
  },
  {
    question: 'API実費の見積もりは出せますか？',
    answer: '利用予定のトラフィックや会話長さを共有いただければ、OpenAIなどの推奨モデルと概算コストをあらかじめご提示します。',
  },
];

const FINAL_POINTS = [
  '導入〜運用までカスタマーサクセスが伴走',
  '利用規模に合わせたシンプルな料金',
  '95以上の言語を自動でカバー',
  'まずは7日間の無料トライアル',
  '期間中いつでもキャンセルOK',
];

const EMBED_SNIPPET =
  '<script src="http://localhost:3000/api/embed/script?site_id=fe8aba45-7a35-41a5-9e57-9fbb88224c03"></script>';

export default function Home() {
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  return (
    <Layout showShellHeader={false} fullWidth>
      <div className="relative mx-auto w-full max-w-3xl px-4 pb-16 pt-6 sm:px-6 lg:px-8">
        <header className="sticky top-0 z-40 border-b border-premium-stroke/60 bg-premium-base/90 pb-5 backdrop-blur supports-[backdrop-filter]:bg-premium-base/80">
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <Link href="/" className="flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-full border border-premium-stroke/70 text-xs font-semibold tracking-[0.4em] text-premium-text">
                  WG
                </span>
                <div>
                  <p className="font-plex-mono text-[0.7rem] uppercase tracking-[0.5em] text-premium-muted">WEBGPT</p>
                  <p className="-mt-1 font-display text-2xl font-semibold text-premium-text">Language Support OS</p>
                </div>
              </Link>
              <div className="flex flex-wrap items-center gap-2 font-plex-mono text-[0.62rem] uppercase tracking-[0.35em] text-premium-muted">
                <span className="rounded-full border border-premium-stroke/80 px-3 py-1">Beta 24社</span>
                <span className="rounded-full border border-premium-stroke/80 px-3 py-1">MIT Copy OK</span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3 font-plex-mono text-[0.65rem] uppercase tracking-[0.32em] text-premium-muted">
                <nav className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  {NAV_LINKS.map((link) => (
                    <a key={link.href} href={link.href} className="transition hover:text-premium-text">
                      {link.label}
                    </a>
                  ))}
                </nav>
                <div className="flex flex-1 items-center justify-end gap-2 text-xs tracking-[0.3em]">
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

          <main className="space-y-16 sm:space-y-20">
            <section
              className="relative overflow-hidden rounded-[36px] border border-premium-stroke/40 bg-premium-surface/80 px-6 pb-12 pt-16 sm:px-8 section-fade shadow-[0_45px_120px_rgba(1,8,4,0.65)]"
              style={{ animationDelay: '0.05s' }}
            >
              <div className="pointer-events-none absolute inset-0 bg-premium-grid opacity-25" />
              <div className="pointer-events-none absolute -right-10 top-0 h-64 w-64 rounded-full bg-[radial-gradient(circle_at_top,_rgba(122,244,193,0.25),_transparent_70%)] blur-3xl" />
              <div className="pointer-events-none absolute -left-10 bottom-0 h-64 w-64 rounded-full bg-[radial-gradient(circle_at_bottom,_rgba(25,195,125,0.2),_transparent_70%)] blur-3xl" />
              <p className="text-xs uppercase tracking-[0.35em] text-premium-muted">AI SUPPORT OS</p>
              <h1 className="font-display mt-4 text-4xl font-semibold leading-tight sm:text-5xl">
                夜間も休日も、あなたのチームの一員としてAIが常駐
              </h1>
              <p className="mt-4 text-base text-premium-muted leading-relaxed">
                WEBGPTはサイトの情報とサポートノウハウを学習し、訪問者の疑問にすぐ応答できる専属チャットコンシェルジュです。
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button size="lg" onClick={() => (window.location.href = '/contact')}>
                  導入の相談をする
                </Button>
                <Button size="lg" variant="secondary" onClick={() => (window.location.href = '#pricing')}>
                  料金の仕組みを見る
                </Button>
              </div>
              <div className="mt-8 grid gap-3 text-sm text-premium-muted sm:grid-cols-2">
                {HERO_FEATURES.map((feature) => (
                  <div key={feature} className="rounded-2xl border border-premium-stroke/50 bg-premium-card/40 px-4 py-3">
                    <span className="text-premium-accent">✓</span>
                    <span className="ml-3">{feature}</span>
                  </div>
                ))}
              </div>
              <div className="mt-10 flex flex-wrap gap-3 text-xs uppercase tracking-[0.35em] text-premium-muted">
                {TRUST_LOGOS.map((logo, idx) => (
                  <span key={`${logo}-${idx}`} className="rounded-full border border-premium-stroke/60 px-4 py-2">
                    {logo}
                  </span>
                ))}
              </div>
            </section>

            <section
              id="stats"
              className="section-fade border-t border-premium-stroke/60 pt-14"
              style={{ animationDelay: '0.12s' }}
            >
              <div className="rounded-[32px] border border-premium-stroke/40 bg-premium-card/20 px-6 py-8 sm:px-8">
                <SectionHeading eyebrow="STATS" title="数字で把握する現在地" align="left" />
                <div className="grid gap-4 sm:grid-cols-2">
                  {STAT_ITEMS.map((item) => (
                    <div key={item.label} className="rounded-2xl border border-premium-stroke/60 bg-premium-card/30 px-6 py-5">
                      <p className="text-3xl font-semibold">{item.value}</p>
                      <p className="text-sm text-premium-muted">{item.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section
              id="flow"
              className="section-fade border-t border-premium-stroke/60 pt-14"
              style={{ animationDelay: '0.18s' }}
            >
              <div className="rounded-[32px] border border-premium-stroke/40 bg-premium-card/20 px-6 py-8 sm:px-8">
                <SectionHeading
                  eyebrow="FLOW"
                  title="申し込みから本番運用まで同じチームで"
                  description="申し込みから本番公開まで、すべての工程を一緒に進められます。"
                />
                <div className="space-y-5">
                  {STEPS.map((step) => (
                    <div key={step.number} className="rounded-2xl border border-premium-stroke/60 bg-premium-card/30 p-5">
                      <p className="text-xs uppercase tracking-[0.35em] text-premium-muted">STEP {step.number}</p>
                      <h3 className="mt-2 text-xl font-semibold">{step.title}</h3>
                      <p className="mt-2 text-sm text-premium-muted leading-relaxed">{step.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section
              className="section-fade border-t border-premium-stroke/60 pt-14"
              style={{ animationDelay: '0.24s' }}
            >
              <div className="rounded-[32px] border border-premium-stroke/40 bg-premium-card/20 px-6 py-8 sm:px-8">
                <SectionHeading eyebrow="Before / After" title="現場の声から逆算した会話体験" />
                <div className="grid gap-5 md:grid-cols-2">
                  {Object.entries({ before: 'よくあるチャットボットの困りごと', after: 'WEBGPT導入後に得られる体験' }).map(([key, title]) => (
                    <div key={key} className="rounded-2xl border border-premium-stroke/60 bg-premium-card/30 p-5">
                      <p className="text-xs uppercase tracking-[0.35em] text-premium-muted">{key === 'before' ? 'BEFORE' : 'AFTER'}</p>
                      <h3 className="mt-2 text-xl font-semibold">{title}</h3>
                      <ul className="mt-3 space-y-2 text-sm text-premium-muted">
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
              className="section-fade border-t border-premium-stroke/60 pt-14"
              style={{ animationDelay: '0.3s' }}
            >
              <div className="rounded-[32px] border border-premium-stroke/40 bg-premium-card/20 px-6 py-8 sm:px-8">
                <SectionHeading
                  eyebrow="FEATURES"
                  title="サポート現場の「こうだったら」を詰め込みました"
                  description="よく使う機能を厳選し、初めてでも迷わず扱えます。"
                />
                <div className="grid gap-4 md:grid-cols-2">
                  {DETAILED_FEATURES.map((feature) => (
                    <div key={feature.title} className="rounded-2xl border border-premium-stroke/60 bg-premium-card/30 p-5">
                      <span className="text-xs uppercase tracking-[0.35em] text-premium-muted">{feature.badge}</span>
                      <h3 className="mt-3 text-2xl font-semibold">{feature.title}</h3>
                      <p className="mt-2 text-sm text-premium-muted leading-relaxed">{feature.description}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  {FEATURE_CARDS.map((card) => (
                    <div key={card.title} className="rounded-2xl border border-premium-stroke/60 bg-premium-card/20 p-4">
                      <div className="text-2xl">{card.icon}</div>
                      <h3 className="mt-3 text-xl font-semibold">{card.title}</h3>
                      <p className="mt-2 text-sm text-premium-muted leading-relaxed">{card.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section
              id="members"
              className="section-fade border-t border-premium-stroke/60 pt-14"
              style={{ animationDelay: '0.36s' }}
            >
              <div className="rounded-[32px] border border-premium-stroke/40 bg-premium-card/20 px-6 py-8 sm:px-8">
                <SectionHeading
                  eyebrow="MEMBERS"
                  title="Team Blog Hub 風のカードでサポートメンバーを紹介"
                  action={{ label: 'See Details →', href: '/about' }}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  {MEMBER_CARDS.map((member) => (
                    <div key={member.name} className="rounded-2xl border border-premium-stroke/60 bg-premium-card/40 p-5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-premium-stroke/70 text-sm font-semibold text-premium-accent">
                          {getInitials(member.name)}
                        </div>
                        <div>
                          <p className="text-sm uppercase tracking-[0.25em] text-premium-muted">{member.role}</p>
                          <h3 className="text-lg font-semibold">{member.name}</h3>
                        </div>
                      </div>
                      <p className="mt-3 text-sm text-premium-muted leading-relaxed">{member.focus}</p>
                      <p className="mt-2 text-xs text-premium-muted">Timezone: {member.timezone}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section
              id="articles"
              className="section-fade border-t border-premium-stroke/60 pt-14"
              style={{ animationDelay: '0.42s' }}
            >
              <div className="rounded-[32px] border border-premium-stroke/40 bg-premium-card/20 px-6 py-8 sm:px-8">
                <SectionHeading
                  eyebrow="ARTICLES"
                  title="Ship Notes / Team Memo"
                  action={{ label: 'See All →', href: '/blog' }}
                />
                <div className="space-y-4">
                  {ARTICLE_ITEMS.map((article) => (
                    <Link
                      key={article.title}
                      href={article.href}
                      className="block rounded-2xl border border-premium-stroke/60 bg-premium-card/30 p-5 transition hover:border-premium-accent/60"
                    >
                      <div className="flex items-center justify-between text-xs text-premium-muted">
                        <span className="rounded-full border border-premium-stroke/60 px-3 py-1 uppercase tracking-[0.35em]">{article.tag}</span>
                        <span>{article.date}</span>
                      </div>
                      <h3 className="mt-3 text-xl font-semibold">{article.title}</h3>
                      <p className="mt-2 text-sm text-premium-muted leading-relaxed">{article.summary}</p>
                      <span className="mt-4 inline-flex items-center text-[0.65rem] uppercase tracking-[0.35em] text-premium-accent">
                        Read note →
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            </section>

            <section
              id="timeline"
              className="section-fade border-t border-premium-stroke/60 pt-14"
              style={{ animationDelay: '0.48s' }}
            >
              <div className="rounded-[32px] border border-premium-stroke/40 bg-premium-card/20 px-6 py-8 sm:px-8">
                <SectionHeading eyebrow="TIMELINE" title="README風の縦軸で更新履歴を整理" />
                <div className="space-y-16">
                  {TIMELINE.map((block) => (
                    <div key={block.year} className="grid gap-6 sm:grid-cols-[120px,1fr]">
                      <div className="sm:sticky top-28">
                        <span className="inline-flex w-full items-center justify-center rounded-full border border-premium-stroke/70 px-3 py-1 text-sm font-semibold">
                          {block.year}
                        </span>
                      </div>
                      <div className="relative pl-6">
                        <span className="absolute left-0 top-4 h-full w-px bg-premium-stroke/40" />
                        {block.items.map((item, idx) => (
                          <div key={`${block.year}-${item.title}`} className="relative mb-8 rounded-2xl border border-premium-stroke/60 bg-premium-card/30 p-5 shadow-[0_25px_70px_rgba(1,8,4,0.35)]">
                            <span className="absolute -left-[11px] top-6 h-4 w-4 rounded-full border-2 border-premium-base bg-premium-accent" />
                            <p className="text-xs uppercase tracking-[0.35em] text-premium-muted">{item.date}</p>
                            <h3 className="mt-2 text-lg font-semibold">{item.title}</h3>
                            <p className="mt-2 text-sm text-premium-muted leading-relaxed">{item.description}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section
              id="demo"
              className="section-fade border-t border-premium-stroke/60 pt-14"
              style={{ animationDelay: '0.54s' }}
            >
              <div className="rounded-[32px] border border-premium-stroke/40 bg-premium-card/20 px-6 py-8 sm:px-8">
                <SectionHeading
                  eyebrow="DEMO"
                  title="埋め込みチャットはローカルでも同じ振る舞い"
                  description="scriptタグを貼るだけで、LPで確認した体験をそのまま持ち込めます。"
                />
                <div className="rounded-2xl border border-premium-stroke/60 bg-premium-card/30 p-5">
                  <p className="text-sm text-premium-muted">開発用スニペット（Streamingインジケーター付き）</p>
                  <pre className="mt-3 overflow-x-auto rounded-xl border border-premium-stroke/60 bg-premium-elevated/60 p-4 text-xs text-premium-muted">
{EMBED_SNIPPET}
                  </pre>
                  <p className="mt-3 text-xs text-premium-muted">
                    Script は MIT ライセンスで公開。二重UIを避けた構造とストリーム中のプレースホルダーを同封しています。
                  </p>
                </div>
              </div>
            </section>

            <section
              id="pricing"
              className="section-fade border-t border-premium-stroke/60 pt-14"
              style={{ animationDelay: '0.6s' }}
            >
              <div className="rounded-[32px] border border-premium-stroke/40 bg-premium-card/20 px-6 py-8 sm:px-8">
                <SectionHeading
                  eyebrow="PRICING"
                  title="初期導入（30〜60万円）＋月次費用の二段構成"
                  description="標準は１案件あたり30〜60万円でセットアップ。その後は毎月の手数料とAPI実費をご請求します。"
                />
                <div className="grid gap-4 md:grid-cols-3">
                  {PRICING_PLANS.map((plan) => (
                    <div
                      key={plan.name}
                      className="rounded-2xl border border-premium-stroke/60 bg-premium-card/30 p-6"
                    >
                      {plan.tag && (
                        <span className="inline-flex rounded-full border border-premium-stroke/60 px-3 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.3em] text-premium-muted">
                          {plan.tag}
                        </span>
                      )}
                      <h3 className="mt-3 text-2xl font-semibold">{plan.name}</h3>
                      <p className="mt-1 text-sm text-premium-muted">{plan.description}</p>
                      <p className="mt-4 text-2xl font-semibold text-premium-accent">{plan.price}</p>
                      <ul className="mt-4 space-y-2 text-sm text-premium-muted">
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
              className="section-fade border-t border-premium-stroke/60 pt-14"
              style={{ animationDelay: '0.66s' }}
            >
              <div className="rounded-[32px] border border-premium-stroke/40 bg-premium-card/20 px-6 py-8 sm:px-8">
                <SectionHeading
                  eyebrow="FAQ"
                  title="初期費用＋月次費用まわりの質問"
                  description="運用モデル、API実費、契約期間などよく聞かれる内容をまとめました。その他は heartssh@gmail.com まで。"
                />
                <div className="space-y-3">
                  {FAQ_ITEMS.map((faq, idx) => {
                    const isOpen = openFaqIndex === idx;
                    return (
                      <button
                        key={faq.question}
                        type="button"
                        onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                        className="w-full rounded-2xl border border-premium-stroke/60 bg-premium-card/30 px-4 py-4 text-left text-sm text-premium-muted transition hover:border-premium-accent/60"
                      >
                        <div className="flex items-center justify-between">
                          <p className="font-semibold text-premium-text">
                            <span className="mr-3 text-premium-muted">Q{String(idx + 1).padStart(2, '0')}.</span>
                            {faq.question}
                          </p>
                          <span>{isOpen ? '−' : '+'}</span>
                        </div>
                        {isOpen && <p className="mt-2 text-premium-muted leading-relaxed">{faq.answer}</p>}
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>

            <section
              className="section-fade border-t border-premium-stroke/60 pt-14"
              style={{ animationDelay: '0.72s' }}
            >
              <div className="rounded-3xl border border-premium-stroke/60 bg-premium-elevated/50 p-8">
                <p className="text-xs uppercase tracking-[0.35em] text-premium-muted">FINAL CTA</p>
                <h2 className="mt-3 text-3xl font-semibold">WEBGPTをあなたのチームにも</h2>
                <p className="mt-3 text-sm text-premium-muted leading-relaxed">
                  標準は初期30〜60万円 + 月次手数料とAPI実費。要件に合わせて細かく見積もりし、導入後もCSが伴走します。
                </p>
                <div className="mt-4 space-y-2 text-sm text-premium-muted">
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

          <footer className="mt-16 border-t border-premium-stroke/60 pt-6 text-xs text-premium-muted">
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
    <div className={`mb-8 ${align === 'center' ? 'text-center' : 'text-left'}`}>
      <p className="text-xs uppercase tracking-[0.35em] text-premium-muted">{eyebrow}</p>
      <div
        className={`mt-3 flex flex-col gap-3 ${
          align === 'center' ? 'items-center text-center' : 'items-start text-left'
        } ${action ? 'sm:flex-row sm:items-end sm:justify-between' : ''}`}
      >
        <div className={align === 'center' ? 'max-w-2xl' : 'w-full'}>
          <h2 className="font-display text-3xl font-semibold text-premium-text">{title}</h2>
          {description && <p className="mt-2 text-sm text-premium-muted leading-relaxed">{description}</p>}
        </div>
        {action && (
          <Link href={action.href} className="text-xs uppercase tracking-[0.35em] text-premium-muted transition hover:text-premium-accent">
            {action.label}
          </Link>
        )}
      </div>
    </div>
  );
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}
