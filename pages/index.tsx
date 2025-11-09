import Link from 'next/link';
import { useState } from 'react';
import Layout from '@/components/layout';

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

export default function Home() {
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  return (
    <Layout>
      <div className="relative mx-auto flex max-w-6xl flex-col gap-24 px-6 pb-24 pt-8 text-slate-100">
        <section className="grid gap-10 lg:grid-cols-[3fr_2fr] lg:items-center">
          <div>
            <div className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-4 py-1 text-xs font-semibold uppercase tracking-[0.35em] text-emerald-200">
              🏆 本日の製品ナンバー1
            </div>
            <h1 className="mt-4 text-5xl font-semibold leading-tight text-white sm:text-6xl lg:text-7xl">
              夜間も休日も、あなたのチームの一員としてAIが常駐
            </h1>
            <p className="mt-4 text-lg text-slate-300">
              WEBGPTはサイトの情報とサポートノウハウを学習し、訪問者の疑問にすぐ応答できる専属チャットコンシェルジュです。
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {HERO_FEATURES.map((feature) => (
                <div key={feature} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm">
                  <span className="text-emerald-300">✓</span>
                  <span>{feature}</span>
                </div>
              ))}
            </div>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/auth/login"
                className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-emerald-400 via-green-300 to-cyan-300 px-8 py-3 text-lg font-semibold text-slate-900 shadow-[0_25px_45px_rgba(16,185,129,0.35)] transition hover:-translate-y-0.5"
              >
                無料トライアルを開始
              </Link>
              <a
                href="#demo"
                className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-8 py-3 text-lg font-semibold text-white transition hover:bg-white/10"
              >
                デモを予約
              </a>
            </div>
          </div>
          <div className="rounded-[32px] border border-white/10 bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900 p-6 shadow-[0_45px_120px_rgba(1,5,3,0.75)]">
            <div className="rounded-2xl border border-white/10 bg-black/40 p-6">
              <p className="text-sm uppercase tracking-[0.3em] text-emerald-200">AIチャットボット GPT-4搭載</p>
              <div className="mt-6 flex flex-col gap-4">
                <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <span className="h-10 w-10 rounded-full bg-gradient-to-br from-emerald-400 to-cyan-400 text-center text-xl leading-[40px] text-slate-900">
                    💬
                  </span>
                  <p className="text-sm text-slate-300">サイト訪問者の質問に即座に回答します</p>
                </div>
                <div className="flex gap-2">
                  {[0, 1, 2].map((dot) => (
                    <span
                      key={dot}
                      className="h-2 w-2 animate-bounce rounded-full bg-emerald-300"
                      style={{ animationDelay: `${dot * 150}ms` }}
                    />
                  ))}
                </div>
                <p className="text-xs uppercase tracking-[0.35em] text-emerald-200">これらの企業に信頼されています</p>
                <div className="grid grid-cols-2 gap-4 text-sm text-slate-300 sm:grid-cols-3">
                  {TRUST_LOGOS.map((logo, idx) => (
                    <div key={`${logo}-${idx}`} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-center transition hover:border-emerald-300">
                      {logo}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 rounded-[32px] border border-white/10 bg-gradient-to-r from-emerald-600/30 via-emerald-600/20 to-cyan-500/30 p-6 text-center sm:grid-cols-4">
          {STAT_ITEMS.map((item) => (
            <div key={item.label} className="space-y-2">
              <p className="text-3xl font-semibold text-white">{item.value}</p>
              <p className="text-sm text-emerald-100">{item.label}</p>
            </div>
          ))}
        </section>

        <section className="grid gap-6 rounded-[32px] border border-white/10 bg-white/5 p-6 lg:grid-cols-2">
          <div className="rounded-[28px] border border-rose-500/20 bg-rose-500/10 p-6">
            <span className="inline-flex rounded-full bg-rose-500/20 px-3 py-1 text-xs font-semibold text-rose-100">以前</span>
            <h2 className="mt-3 text-2xl font-semibold text-white">{COMPARISON.before.title}</h2>
            <ul className="mt-4 space-y-3 text-sm text-rose-50">
              {COMPARISON.before.points.map((point) => (
                <li key={point} className="flex items-start gap-2">
                  <span>✕</span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-[28px] border border-emerald-400/20 bg-emerald-500/10 p-6">
            <span className="inline-flex rounded-full bg-emerald-400/20 px-3 py-1 text-xs font-semibold text-emerald-100">導入後</span>
            <h2 className="mt-3 text-2xl font-semibold text-white">{COMPARISON.after.title}</h2>
            <ul className="mt-4 space-y-3 text-sm text-emerald-50">
              {COMPARISON.after.points.map((point) => (
                <li key={point} className="flex items-start gap-2">
                  <span>✓</span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="workflow" className="space-y-6 rounded-[32px] border border-white/10 bg-white/5 p-6">
          <div className="flex flex-col gap-2 text-center">
            <p className="text-xs uppercase tracking-[0.35em] text-emerald-200">導入フロー</p>
            <h2 className="text-4xl font-semibold text-white">たった 3 ステップで本番運用へ</h2>
            <p className="text-sm text-slate-300">面倒な初期設定は不要。お申し込みから最短即日でテストに進めます。</p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {STEPS.map((step) => (
              <div key={step.number} className="rounded-[28px] border border-white/10 bg-white/5 p-5">
                <div className="flex items-center justify-between text-sm text-slate-400">
                  <span className="rounded-full border border-white/10 px-3 py-1 text-xs tracking-[0.35em]">STEP</span>
                  <span className="text-3xl font-semibold text-white">{step.number}</span>
                </div>
                <h3 className="mt-4 text-xl font-semibold text-white">{step.title}</h3>
                <p className="mt-2 text-sm text-slate-300">{step.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-6 rounded-[32px] border border-white/10 bg-white/5 p-6" id="features">
          <div className="text-center">
            <p className="text-xs uppercase tracking-[0.35em] text-emerald-200">詳細機能</p>
            <h2 className="mt-2 text-4xl font-semibold text-white">サポート現場の「こうだったら」を詰め込みました</h2>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            {DETAILED_FEATURES.map((feature) => (
              <div key={feature.title} className="rounded-[28px] border border-white/10 bg-gradient-to-br from-slate-900/60 to-slate-900/20 p-5">
                <span className="text-xs uppercase tracking-[0.35em] text-emerald-200">{feature.badge}</span>
                <h3 className="mt-3 text-2xl font-semibold text-white">{feature.title}</h3>
                <p className="mt-2 text-sm text-slate-300">{feature.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-4 rounded-[32px] border border-white/10 bg-white/5 p-6">
          <div className="text-center">
            <p className="text-xs uppercase tracking-[0.35em] text-emerald-200">主要機能</p>
            <h2 className="mt-2 text-4xl font-semibold text-white">導入・運用・改善をシンプルにする装備</h2>
            <p className="text-sm text-slate-300">よく使う機能を厳選し、初めてでも迷わず扱えます。</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {FEATURE_CARDS.map((card) => (
              <div key={card.title} className="rounded-[24px] border border-white/10 bg-white/5 p-5">
                <div className="text-2xl">{card.icon}</div>
                <h3 className="mt-3 text-xl font-semibold text-white">{card.title}</h3>
                <p className="mt-1 text-sm text-slate-300">{card.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="integrations" className="space-y-6 rounded-[32px] border border-white/10 bg-white/5 p-6">
          <div className="text-center">
            <p className="text-xs uppercase tracking-[0.35em] text-emerald-200">チャットボットを強化</p>
            <h2 className="mt-2 text-4xl font-semibold text-white">外部ツール連携（準備中）</h2>
            <p className="text-sm text-slate-300">Slack や Zendesk などとの連携は現在開発中です。対応予定ツールを先行公開しています。</p>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {INTEGRATIONS.map((integration) => (
              <div key={integration.name} className="rounded-3xl border border-white/10 bg-white/5 px-4 py-3 text-center text-sm text-slate-200 transition hover:border-emerald-300">
                <div className="text-2xl">{integration.icon}</div>
                <p className="mt-1 font-semibold">{integration.name}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="demo" className="grid gap-6 rounded-[32px] border border-white/10 bg-white/5 p-6 lg:grid-cols-2">
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.35em] text-emerald-200">ライブデモ</p>
            <h2 className="text-4xl font-semibold text-white">実際の受け答えをその場でチェック</h2>
            <p className="text-sm text-slate-300">WEBGPT にサービス内容を質問して、応答スピードや自然さを確認してみてください。</p>
            <p className="text-sm text-slate-300">例: 「WEBGPTにはどんな機能がありますか？」「料金プランは？」など。</p>
          </div>
          <div className="rounded-[28px] border border-white/10 bg-slate-900/60 p-6">
            <div className="aspect-video rounded-2xl border border-white/10 bg-gradient-to-br from-emerald-500/10 via-slate-900 to-slate-900/80 p-6 text-center">
              <h3 className="text-xl font-semibold text-white">インタラクティブチャットボットデモ</h3>
              <p className="mt-2 text-sm text-slate-300">会話を開始して、AI の応答品質を体験しましょう。</p>
              <Link
                href="/auth/login"
                className="mt-6 inline-flex items-center justify-center rounded-full bg-gradient-to-r from-emerald-400 via-green-300 to-cyan-300 px-6 py-2 text-sm font-semibold text-slate-900"
              >
                会話を開始
              </Link>
            </div>
          </div>
        </section>

        <section className="space-y-6 rounded-[32px] border border-white/10 bg-white/5 p-6">
          <div className="text-center">
            <p className="text-xs uppercase tracking-[0.35em] text-emerald-200">導入事例</p>
            <h2 className="mt-2 text-4xl font-semibold text-white">導入事例は準備中です</h2>
            <p className="mt-2 text-sm text-slate-300">現在ベータユーザー様の事例を整理している段階です。公開までしばらくお待ちください。</p>
          </div>
          <div className="rounded-[24px] border border-white/10 bg-white/5 p-5 text-center text-sm text-slate-300">
            Coming soon...
          </div>
        </section>

        <section id="pricing" className="space-y-6 rounded-[32px] border border-white/10 bg-white/5 p-6">
          <div className="text-center">
            <p className="text-xs uppercase tracking-[0.35em] text-emerald-200">料金プラン</p>
            <h2 className="mt-2 text-4xl font-semibold text-white">シンプルでわかりやすい定額制</h2>
            <p className="text-sm text-slate-300">全プランに 7 日間の無料トライアルが付属します。</p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-[28px] border border-white/10 bg-white/5 p-6">
              <span className="inline-flex rounded-full bg-emerald-400/20 px-3 py-1 text-xs font-semibold text-emerald-100">提供中</span>
              <h3 className="mt-2 text-2xl font-semibold text-white">スターター</h3>
              <p className="mt-1 text-sm text-slate-300">月100チャット / サイト1件 / 初回学習代行</p>
              <p className="mt-4 text-3xl font-semibold text-white">¥980 / 月</p>
              <ul className="mt-4 space-y-2 text-sm text-slate-200">
                <li className="flex items-start gap-2"><span>✓</span><span>メールサポート</span></li>
                <li className="flex items-start gap-2"><span>✓</span><span>埋め込みスクリプト提供</span></li>
                <li className="flex items-start gap-2"><span>✓</span><span>訪問者ログ簡易レポート</span></li>
              </ul>
              <Link
                href="/auth/login"
                className="mt-6 inline-flex w-full items-center justify-center rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                無料トライアルを開始
              </Link>
            </div>
            <div className="rounded-[28px] border border-dashed border-white/10 bg-white/5 p-6 text-slate-300">
              <span className="inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-semibold">近日公開</span>
              <h3 className="mt-2 text-2xl font-semibold text-white/70">スタジオ</h3>
              <p className="mt-1 text-sm">月500チャット / 自動再学習 / 優先サポート</p>
              <p className="mt-4 text-3xl font-semibold text-white/70">¥2,980 / 月</p>
              <p className="mt-6 text-sm">ローンチ準備中です</p>
            </div>
            <div className="rounded-[28px] border border-dashed border-white/10 bg-white/5 p-6 text-slate-300">
              <span className="inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-semibold">近日公開</span>
              <h3 className="mt-2 text-2xl font-semibold text白/70">アンリミテッド</h3>
              <p className="mt-1 text-sm">無制限チャット / API・Webhook / SLA対応</p>
              <p className="mt-4 text-3xl font-semibold text-white/70">¥9,800 / 月〜</p>
              <p className="mt-6 text-sm">カスタムプランを準備中です</p>
            </div>
          </div>
        </section>

        <section className="space-y-6 rounded-[32px] border border-white/10 bg-white/5 p-6" id="faq">
          <div className="text-center">
            <p className="text-xs uppercase tracking-[0.35em] text-emerald-200">FAQ</p>
            <h2 className="mt-2 text-4xl font-semibold text-white">よくあるご質問</h2>
            <p className="text-sm text-slate-300">
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
                  className="w-full rounded-[24px] border border-white/10 bg-white/5 px-4 py-3 text-left text-sm text-slate-200 transition hover:border-emerald-300"
                >
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-white">
                      <span className="mr-3 text-emerald-200">Q{String(idx + 1).padStart(2, '0')}.</span>
                      {faq.question}
                    </p>
                    <span className="text-emerald-200">{isOpen ? '−' : '+'}</span>
                  </div>
                  {isOpen && <p className="mt-2 text-slate-300">{faq.answer}</p>}
                </button>
              );
            })}
          </div>
        </section>

        <section className="grid gap-6 rounded-[32px] border border-white/10 bg-gradient-to-r from-emerald-500/20 via-green-400/10 to-cyan-400/20 p-6 lg:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-emerald-200">Final Message</p>
            <h2 className="mt-2 text-4xl font-semibold text-white">WEBGPTをあなたのチームにも</h2>
            <p className="mt-2 text-sm text-emerald-50">まずは無料トライアルで、実際の会話品質と運用フローを体感してください。</p>
            <div className="mt-4 flex flex-col gap-2 text-sm text-emerald-50">
              {FINAL_POINTS.map((point) => (
                <div key={point} className="flex items-center gap-2">
                  <span>✓</span>
                  <span>{point}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
            <Link
              href="/auth/login"
              className="inline-flex flex-1 items-center justify-center rounded-full bg-white px-6 py-3 text-lg font-semibold text-slate-900 shadow-[0_20px_45px_rgba(255,255,255,0.25)]"
            >
              無料トライアルを開始
            </Link>
            <Link
              href="/auth/login"
              className="inline-flex flex-1 items-center justify-center rounded-full border border-white/20 px-6 py-3 text-lg font-semibold text-white"
            >
              デモを予約
            </Link>
          </div>
        </section>
        <footer className="border-t border-white/5 bg-slate-950/80 py-8">
        <div className="mx-auto grid max-w-6xl gap-6 px-6 text-sm text-slate-300 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-emerald-200">製品</p>
            <ul className="mt-3 space-y-2">
              <li><Link href="#features" className="transition hover:text-white">機能</Link></li>
              <li><Link href="#pricing" className="transition hover:text-white">料金</Link></li>
              <li><Link href="#integrations" className="transition hover:text-white">連携</Link></li>
              <li><Link href="/docs" className="transition hover:text-white">API</Link></li>
            </ul>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-emerald-200">会社</p>
            <ul className="mt-3 space-y-2">
              <li><Link href="/about" className="transition hover:text-white">について</Link></li>
              <li><Link href="/blog" className="transition hover:text-white">ブログ</Link></li>
              <li><Link href="/careers" className="transition hover:text-white">採用情報</Link></li>
              <li><Link href="/press" className="transition hover:text-white">プレス</Link></li>
            </ul>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-emerald-200">リソース</p>
            <ul className="mt-3 space-y-2">
              <li><Link href="/docs" className="transition hover:text-white">ドキュメント</Link></li>
              <li><Link href="/help" className="transition hover:text-white">ヘルプセンター</Link></li>
              <li><Link href="/community" className="transition hover:text-white">コミュニティ</Link></li>
              <li><Link href="/contact" className="transition hover:text-white">お問い合わせフォーム</Link></li>
            </ul>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-emerald-200">法的情報</p>
            <ul className="mt-3 space-y-2">
              <li><Link href="/legal" className="transition hover:text-white">特定商取引法</Link></li>
              <li><Link href="/privacy" className="transition hover:text-white">プライバシー</Link></li>
              <li><Link href="/terms" className="transition hover:text-white">利用規約</Link></li>
              <li><Link href="/security" className="transition hover:text-white">セキュリティ</Link></li>
            </ul>
          </div>
        </div>
        <div className="mt-6 border-t border-white/5">
          <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-4 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-cyan-400 text-lg font-bold text-slate-900">
                S
              </div>
              <p>© {new Date().getFullYear()} WEBGPT. All rights reserved.</p>
            </div>
            <p>東京都新宿区新宿1-36-2 新宿第七葉山ビル3F / 電話 +81 852 52 7323 / heartssh@gmail.com</p>
          </div>
        </div>
        </footer>
      </div>
    </Layout>
  );
}
