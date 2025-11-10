import Link from 'next/link';
import { useState } from 'react';
import Layout from '@/components/layout';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Surface from '@/components/ui/Surface';

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

const COMPARISON = {
  before: {
    title: 'よくあるチャットボットの困りごと',
    points: ['回答の精度が日によってバラバラ', '夜間は誰も対応できない', 'ブランドらしさが失われる', '結局サポート工数は減らない'],
  },
  after: {
    title: 'WEBGPT導入後に得られる体験',
    points: ['24時間365日の即時応答', 'ブランドトーンに合わせた会話', '社内ナレッジを安全に活用', '一次対応を自動化してコスト削減'],
  },
};

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

const INTEGRATIONS = [
  { name: 'Slack', icon: '💬' },
  { name: 'Crisp', icon: '💭' },
  { name: 'Intercom', icon: '🎯' },
  { name: 'Zendesk', icon: '🎫' },
  { name: 'Zapier', icon: '⚡' },
  { name: 'Make', icon: '🔧' },
  { name: 'Webhooks', icon: '🔗' },
  { name: 'API', icon: '🔌' },
];

const TESTIMONIALS = [
  {
    name: 'Brent Burrows II',
    role: 'Director, CBS Bahamas',
    quote: '夜間のZendesk一次対応をWEBGPTに任せた結果、翌朝のチケット整理が激減しました。',
  },
  {
    name: 'Sarah Johnson',
    role: 'Head of CX, TechFlow Inc.',
    quote: '申込から1日でテスト運用に入れました。応答時間も約80%短縮できています。',
  },
  {
    name: 'Michael Chen',
    role: 'COO, DataSync Pro',
    quote: '開発リソースを割かずに導入でき、チームはコア業務に集中できるようになりました。',
  },
];

const PRICING_PLANS = [
  {
    name: 'スターター',
    price: '¥980 / 月',
    popular: false,
    description: '月100チャット / サイト 1 件 / 初回学習代行',
    features: ['メールサポート', '埋め込みスクリプト提供', '訪問者ログ簡易レポート'],
    comingSoon: false,
  },
  {
    name: 'スタジオ（近日公開）',
    price: '¥2,980 / 月',
    popular: false,
    description: '月500チャット / サイト 3 件 / 自動再学習',
    features: ['優先サポート', '再学習リクエスト月3回', '準備中：自動アナリティクス'],
    comingSoon: true,
  },
  {
    name: 'アンリミテッド（近日公開）',
    price: '¥9,800 / 月〜',
    popular: false,
    description: 'チャット無制限 / サイト無制限 / 専任サクセス',
    features: ['カスタムブランディング', 'API・Webhook連携', 'SLA / セキュリティレビュー対応'],
    comingSoon: true,
  },
];

const FAQ_ITEMS = [
  {
    question: 'スクレイピングするページがなくてもテキストで学習させられますか？',
    answer: '現在はベースURLを登録していただく形ですが、テキストデータの直接アップロードにも対応予定です。ご希望があればサポートまでご相談ください。',
  },
  {
    question: '実際に触れるデモ環境はありますか？',
    answer: 'ダッシュボードのライブデモ（ログイン後）で実際の応答を試せます。必要に応じてスタッフによる同席デモも調整可能です。',
  },
  {
    question: 'どのようなコンテンツ形式を学習させられますか？',
    answer: '現在は公開URLのHTMLを自動で解析しています。PDFやFAQデータなどの取り込みは順次追加予定です。',
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
    question: 'ファイルアップロードで学習できますか？',
    answer: '現在はベースURLベースですが、PDFやテキストの直接投入機能を開発中です。ベータ参加をご希望の場合はご連絡ください。',
  },
];

const FINAL_POINTS = [
  '導入〜運用までカスタマーサクセスが伴走',
  '利用規模に合わせたシンプルな料金',
  '95以上の言語を自動でカバー',
  'まずは7日間の無料トライアル',
  '期間中いつでもキャンセルOK',
];

const FLOW_STEPS = [
  { title: 'URLを登録', body: '学習させたいサイトURLを入力するだけで準備完了。' },
  { title: 'WEBGPTが学習', body: '運営チームが内容を確認し最適な返答をセットアップ。' },
  { title: '埋め込み＆公開', body: 'コードを貼るだけで、デモと同じ会話を本番に。' },
];

export default function Home() {
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  return (
    <Layout>
      <div className="relative mx-auto flex max-w-6xl flex-col gap-20 px-4 pb-24 pt-10 text-premium-text sm:px-6">
        <div className="pointer-events-none absolute inset-0 -z-20 bg-premium-grid opacity-60" />
        <div className="pointer-events-none absolute inset-0 -z-10 bg-premium-radial opacity-70" />

        <Surface className="grid gap-10 lg:grid-cols-[3fr_2fr] lg:items-center">
          <div>
            <div className="inline-flex items-center rounded-full border border-premium-stroke/60 bg-premium-surface/80 px-4 py-1 text-xs font-semibold uppercase tracking-[0.35em] text-premium-muted">
              🏆 本日の製品ナンバー1
            </div>
            <h1 className="mt-4 text-5xl font-semibold leading-tight text-premium-text sm:text-6xl lg:text-7xl">
              夜間も休日も、あなたのチームの一員としてAIが常駐
            </h1>
            <p className="mt-4 text-lg text-premium-muted">
              WEBGPTはサイトの情報とサポートノウハウを学習し、訪問者の疑問にすぐ応答できる専属チャットコンシェルジュです。
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {HERO_FEATURES.map((feature) => (
                <div key={feature} className="flex items-center gap-3 rounded-3xl border border-premium-stroke/60 bg-premium-surface/80 px-4 py-2 text-sm">
                  <span className="text-premium-accent">✓</span>
                  <span>{feature}</span>
                </div>
              ))}
            </div>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button size="lg" onClick={() => (window.location.href = '/auth/login')}>
              無料トライアルを開始
            </Button>
            <Button
              size="lg"
              variant="secondary"
              onClick={() => (window.location.href = '#demo')}
            >
              デモを予約
            </Button>
            </div>
          </div>
          <Card variant="surface" className="p-6">
            <div className="rounded-4xl border border-premium-stroke/50 bg-premium-elevated/80 p-6">
              <p className="text-sm uppercase tracking-[0.3em] text-premium-muted">AIチャットボット GPT-4搭載</p>
              <div className="mt-6 flex flex-col gap-4">
                <div className="flex items-center gap-3 rounded-3xl border border-premium-stroke/50 bg-premium-surface/80 px-4 py-3">
                  <span className="h-10 w-10 rounded-full bg-gradient-to-br from-premium-accent to-premium-accentGlow text-center text-xl leading-[40px] text-black">
                    💬
                  </span>
                  <p className="text-sm text-premium-muted">サイト訪問者の質問に即座に回答します</p>
                </div>
                <div className="flex gap-2">
                  {[0, 1, 2].map((dot) => (
                    <span
                      key={dot}
                      className="h-2 w-2 animate-bounce rounded-full bg-premium-accent"
                      style={{ animationDelay: `${dot * 150}ms` }}
                    />
                  ))}
                </div>
                <p className="text-xs uppercase tracking-[0.35em] text-premium-muted">これらの企業に信頼されています</p>
                <div className="grid grid-cols-2 gap-4 text-sm text-premium-muted sm:grid-cols-3">
                  {TRUST_LOGOS.map((logo, idx) => (
                    <div
                      key={`${logo}-${idx}`}
                      className="rounded-3xl border border-premium-stroke/40 bg-premium-surface/70 px-4 py-3 text-center transition hover:border-premium-accent/50"
                    >
                      {logo}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        </Surface>

        <Surface className="grid gap-4 text-center sm:grid-cols-4">
          {STAT_ITEMS.map((item) => (
            <div key={item.label} className="rounded-4xl border border-premium-stroke/40 bg-premium-elevated/70 p-4">
              <p className="text-3xl font-semibold text-premium-text">{item.value}</p>
              <p className="text-sm text-premium-muted">{item.label}</p>
            </div>
          ))}
        </Surface>

        <Surface className="grid gap-6 lg:grid-cols-3">
          {FLOW_STEPS.map((step, idx) => (
            <Card key={step.title} className="border border-premium-stroke/40 bg-premium-surface/80 p-5 text-sm text-premium-muted">
              <p className="text-xs uppercase tracking-[0.35em] text-premium-muted">Step {String(idx + 1).padStart(2, '0')}</p>
              <h3 className="mt-2 text-xl font-semibold text-premium-text">{step.title}</h3>
              <p className="mt-1 text-sm">{step.body}</p>
            </Card>
          ))}
        </Surface>

        <Surface className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-4xl border border-premium-stroke/40 bg-premium-base/60 p-6">
            <span className="inline-flex rounded-full border border-premium-stroke/60 px-3 py-1 text-xs font-semibold text-premium-muted">以前</span>
            <h2 className="mt-3 text-2xl font-semibold text-premium-text">{COMPARISON.before.title}</h2>
            <ul className="mt-4 space-y-3 text-sm text-premium-muted">
              {COMPARISON.before.points.map((point) => (
                <li key={point} className="flex items-center gap-3">
                  <span className="text-premium-danger">✕</span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-4xl border border-premium-accent/40 bg-premium-surface/80 p-6">
            <span className="inline-flex rounded-full border border-premium-accent/50 px-3 py-1 text-xs font-semibold text-premium-accent">導入後</span>
            <h2 className="mt-3 text-2xl font-semibold text-premium-text">{COMPARISON.after.title}</h2>
            <ul className="mt-4 space-y-3 text-sm text-premium-text">
              {COMPARISON.after.points.map((point) => (
                <li key={point} className="flex items-center gap-3">
                  <span className="text-premium-accent">✓</span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>
        </Surface>

        <Surface id="workflow" className="space-y-6">
          <div className="flex flex-col gap-2 text-center">
            <p className="text-xs uppercase tracking-[0.35em] text-premium-muted">導入フロー</p>
            <h2 className="text-4xl font-semibold text-premium-text">たった 3 ステップで本番運用へ</h2>
            <p className="text-sm text-premium-muted">面倒な初期設定は不要。お申し込みから最短即日でテストに進めます。</p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {STEPS.map((step) => (
              <div key={step.number} className="rounded-4xl border border-premium-stroke/40 bg-premium-surface/80 p-5">
                <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-premium-muted">
                  <span className="rounded-full border border-premium-stroke/60 px-3 py-1">STEP</span>
                  <span className="text-3xl font-semibold text-premium-text">{step.number}</span>
                </div>
                <h3 className="mt-4 text-xl font-semibold text-premium-text">{step.title}</h3>
                <p className="mt-2 text-sm text-premium-muted">{step.description}</p>
              </div>
            ))}
          </div>
        </Surface>

        <Surface className="space-y-6" id="features">
          <div className="text-center">
            <p className="text-xs uppercase tracking-[0.35em] text-premium-muted">詳細機能</p>
            <h2 className="mt-2 text-4xl font-semibold text-premium-text">サポート現場の「こうだったら」を詰め込みました</h2>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            {DETAILED_FEATURES.map((feature) => (
              <div key={feature.title} className="rounded-[28px] border border-premium-stroke/40 bg-gradient-to-br from-slate-900/60 to-slate-900/20 p-5">
                <span className="text-xs uppercase tracking-[0.35em] text-premium-muted">{feature.badge}</span>
                <h3 className="mt-3 text-2xl font-semibold text-premium-text">{feature.title}</h3>
                <p className="mt-2 text-sm text-premium-muted">{feature.description}</p>
              </div>
            ))}
          </div>
        </Surface>

        <section className="space-y-4 rounded-[32px] border border-premium-stroke/40 bg-premium-surface/70 p-6">
          <div className="text-center">
            <p className="text-xs uppercase tracking-[0.35em] text-premium-muted">主要機能</p>
            <h2 className="mt-2 text-4xl font-semibold text-premium-text">導入・運用・改善をシンプルにする装備</h2>
            <p className="text-sm text-premium-muted">よく使う機能を厳選し、初めてでも迷わず扱えます。</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {FEATURE_CARDS.map((card) => (
              <div key={card.title} className="rounded-[24px] border border-premium-stroke/40 bg-premium-surface/70 p-5">
                <div className="text-2xl">{card.icon}</div>
                <h3 className="mt-3 text-xl font-semibold text-premium-text">{card.title}</h3>
                <p className="mt-1 text-sm text-premium-muted">{card.description}</p>
              </div>
            ))}
          </div>
        </section>

        <Surface id="integrations" className="space-y-6">
          <div className="text-center">
            <p className="text-xs uppercase tracking-[0.35em] text-premium-muted">チャットボットを強化</p>
            <h2 className="mt-2 text-4xl font-semibold text-premium-text">外部ツール連携（準備中）</h2>
            <p className="text-sm text-premium-muted">Slack や Zendesk などとの連携は現在開発中です。対応予定ツールを先行公開しています。</p>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {INTEGRATIONS.map((integration) => (
              <div key={integration.name} className="rounded-3xl border border-premium-stroke/40 bg-premium-surface/70 px-4 py-3 text-center text-sm text-premium-muted transition hover:border-premium-accent/40">
                <div className="text-2xl">{integration.icon}</div>
                <p className="mt-1 font-semibold">{integration.name}</p>
              </div>
            ))}
          </div>
        </Surface>

        <Surface id="demo" className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.35em] text-premium-muted">ライブデモ</p>
            <h2 className="text-4xl font-semibold text-premium-text">実際の受け答えをその場でチェック</h2>
            <p className="text-sm text-premium-muted">WEBGPT にサービス内容を質問して、応答スピードや自然さを確認してみてください。</p>
            <p className="text-sm text-premium-muted">例: 「WEBGPTにはどんな機能がありますか？」「料金プランは？」など。</p>
          </div>
          <div className="rounded-[28px] border border-premium-stroke/40 bg-slate-900/60 p-6">
            <div className="aspect-video rounded-2xl border border-premium-stroke/40 bg-gradient-to-br from-emerald-500/10 via-slate-900 to-slate-900/80 p-6 text-center">
              <h3 className="text-xl font-semibold text-premium-text">インタラクティブチャットボットデモ</h3>
              <p className="mt-2 text-sm text-premium-muted">会話を開始して、AI の応答品質を体験しましょう。</p>
              <Link
                href="/auth/login"
                className="mt-6 inline-flex items-center justify-center rounded-full bg-gradient-to-r from-premium-accent via-premium-accentGlow to-premium-accent px-6 py-2 text-sm font-semibold text-black shadow-glow"
              >
                会話を開始
              </Link>
            </div>
          </div>
        </Surface>

        <Surface className="space-y-6">
          <div className="text-center">
            <p className="text-xs uppercase tracking-[0.35em] text-premium-muted">導入事例</p>
            <h2 className="mt-2 text-4xl font-semibold text-premium-text">導入事例は準備中です</h2>
            <p className="mt-2 text-sm text-premium-muted">現在ベータユーザー様の事例を整理している段階です。公開までしばらくお待ちください。</p>
          </div>
          <div className="rounded-[24px] border border-premium-stroke/40 bg-premium-surface/70 p-5 text-center text-sm text-premium-muted">
            Coming soon...
          </div>
        </Surface>

        <Surface id="pricing" className="space-y-6">
          <div className="text-center">
            <p className="text-xs uppercase tracking-[0.35em] text-premium-muted">料金プラン</p>
            <h2 className="mt-2 text-4xl font-semibold text-premium-text">シンプルでわかりやすい定額制</h2>
            <p className="text-sm text-premium-muted">全プランに 7 日間の無料トライアルが付属します。</p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-4xl border border-premium-accent/40 bg-premium-surface/80 p-6 shadow-glow">
              <span className="inline-flex rounded-full border border-premium-accent/50 px-3 py-1 text-xs font-semibold text-premium-accent">提供中</span>
              <h3 className="mt-2.text-2xl font-semibold text-premium-text">スターター</h3>
              <p className="mt-1 text-sm text-premium-muted">月100チャット / サイト1件 / 初回学習代行</p>
              <p className="mt-4 text-3xl font-semibold text-premium-text">¥980 / 月</p>
              <ul className="mt-4 space-y-2 text-sm text-premium-muted">
                <li className="flex items-center gap-2"><span className="text-premium-accent">✓</span><span>メールサポート</span></li>
                <li className="flex items-center gap-2"><span className="text-premium-accent">✓</span><span>埋め込みスクリプト提供</span></li>
                <li className="flex items-center gap-2"><span className="text-premium-accent">✓</span><span>訪問者ログ簡易レポート</span></li>
              </ul>
              <Link href="/dashboard/plans" className="block">
                <Button className="mt-6 w-full" size="full">
                  プランを確認
                </Button>
              </Link>
            </div>
            <div className="rounded-4xl border border-dashed border-premium-stroke/40 bg-premium-surface/70 p-6 text-premium-muted">
              <span className="inline-flex rounded-full border border-premium-stroke/50 px-3 py-1 text-xs font-semibold">近日公開</span>
              <h3 className="mt-2 text-2xl font-semibold text-premium-text/70">スタジオ</h3>
              <p className="mt-1 text-sm">月500チャット / 自動再学習 / 優先サポート</p>
              <p className="mt-4 text-3xl font-semibold text-premium-text/70">¥2,980 / 月</p>
              <p className="mt-6 text-sm">ローンチ準備中です</p>
            </div>
            <div className="rounded-4xl border border-dashed border-premium-stroke/40 bg-premium-surface/70 p-6 text-premium-muted">
              <span className="inline-flex rounded-full border border-premium-stroke/50 px-3 py-1 text-xs font-semibold">近日公開</span>
              <h3 className="mt-2 text-2xl font-semibold text-premium-text/70">アンリミテッド</h3>
              <p className="mt-1 text-sm">無制限チャット / API・Webhook / SLA対応</p>
              <p className="mt-4 text-3xl font-semibold text-premium-text/70">¥9,800 / 月〜</p>
              <p className="mt-6 text-sm">カスタムプランを準備中です</p>
            </div>
          </div>
        </Surface>

        <Surface className="space-y-6" id="faq">
          <div className="text-center">
            <p className="text-xs uppercase tracking-[0.35em] text-premium-muted">FAQ</p>
            <h2 className="mt-2 text-4xl font-semibold text-premium-text">よくあるご質問</h2>
            <p className="text-sm text-premium-muted">
              下記で解決しない場合は heartssh@gmail.com までお気軽にご連絡ください。
            </p>
          </div>
          <div className="space-y-3">
            {FAQ_ITEMS.map((faq, idx) => {
              const isOpen = openFaqIndex === idx;
              return (
                <button
                  key={faq.question}
                  type="button"
                  onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                  className="w-full rounded-[24px] border border-premium-stroke/40 bg-premium-surface/70 px-4 py-3 text-left text-sm text-premium-muted transition hover:border-emerald-300"
                >
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-premium-text">
                      <span className="mr-3 text-premium-muted">Q{String(idx + 1).padStart(2, '0')}.</span>
                      {faq.question}
                    </p>
                    <span className="text-premium-muted">{isOpen ? '−' : '+'}</span>
                  </div>
                  {isOpen && <p className="mt-2 text-premium-muted">{faq.answer}</p>}
                </button>
              );
            })}
          </div>
        </Surface>

        <Surface className="grid gap-6 lg:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-premium-muted">Final Message</p>
            <h2 className="mt-2 text-4xl font-semibold text-premium-text">WEBGPTをあなたのチームにも</h2>
            <p className="mt-2 text-sm text-premium-muted">URL登録→運営が学習→稼働連絡までのフローはすべて私たちが伴走します。</p>
            <div className="mt-4 flex flex-col gap-2 text-sm text-premium-muted">
              {FINAL_POINTS.map((point) => (
                <div key={point} className="flex items-center gap-2">
                  <span className="text-premium-accent">✓</span>
                  <span>{point}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
            <Button size="lg" onClick={() => (window.location.href = '/auth/login')}>
              無料トライアルを開始
            </Button>
            <Button
              size="lg"
              variant="secondary"
              onClick={() => (window.location.href = '#demo')}
            >
              デモを予約
            </Button>
          </div>
        </Surface>
        <footer className="border-t border-premium-stroke/40 bg-premium-base/80 py-8">
        <div className="mx-auto grid max-w-6xl gap-6 px-6 text-sm text-premium-muted sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-premium-muted">製品</p>
            <ul className="mt-3 space-y-2">
              <li><Link href="#features" className="transition hover:text-premium-text">機能</Link></li>
              <li><Link href="#pricing" className="transition hover:text-premium-text">料金</Link></li>
              <li><Link href="#integrations" className="transition hover:text-premium-text">連携</Link></li>
              <li><Link href="/docs" className="transition hover:text-premium-text">API</Link></li>
            </ul>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-premium-muted">会社</p>
            <ul className="mt-3 space-y-2">
              <li><Link href="/about" className="transition hover:text-premium-text">について</Link></li>
              <li><Link href="/blog" className="transition hover:text-premium-text">ブログ</Link></li>
              <li><Link href="/careers" className="transition hover:text-premium-text">採用情報</Link></li>
              <li><Link href="/press" className="transition hover:text-premium-text">プレス</Link></li>
            </ul>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-premium-muted">リソース</p>
            <ul className="mt-3 space-y-2">
              <li><Link href="/docs" className="transition hover:text-premium-text">ドキュメント</Link></li>
              <li><Link href="/help" className="transition hover:text-premium-text">ヘルプセンター</Link></li>
              <li><Link href="/community" className="transition hover:text-premium-text">コミュニティ</Link></li>
              <li><Link href="/contact" className="transition hover:text-premium-text">お問い合わせフォーム</Link></li>
            </ul>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-premium-muted">法的情報</p>
            <ul className="mt-3 space-y-2">
              <li><Link href="/legal" className="transition hover:text-premium-text">特定商取引法</Link></li>
              <li><Link href="/privacy" className="transition hover:text-premium-text">プライバシー</Link></li>
              <li><Link href="/terms" className="transition hover:text-premium-text">利用規約</Link></li>
              <li><Link href="/security" className="transition hover:text-premium-text">セキュリティ</Link></li>
            </ul>
          </div>
        </div>
        <div className="mt-6 border-t border-premium-stroke/40">
          <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-4 text-xs text-premium-muted sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br to from-premium-accent to-cyan-400 text-lg font-bold text-slate-900">
                S
              </div>
              <p>© {new Date().getFullYear()} WEBGPT. All rights reserved.</p>
            </div>
          </div>
        </div>
        </footer>
      </div>
    </Layout>
  );
}
