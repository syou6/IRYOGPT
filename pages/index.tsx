import Link from 'next/link';
import Image from 'next/image';
import { useState, ReactNode } from 'react';
import Layout from '@/components/layout';
import Button from '@/components/ui/Button';

// Premium SVG Icons
const Icons = {
  phone: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
    </svg>
  ),
  moon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
    </svg>
  ),
  users: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
    </svg>
  ),
  calendar: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  bot: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
      <rect x="3" y="11" width="18" height="10" rx="2" />
      <circle cx="12" cy="5" r="2" />
      <path d="M12 7v4" />
      <line x1="8" y1="16" x2="8" y2="16" />
      <line x1="16" y1="16" x2="16" y2="16" />
    </svg>
  ),
  spreadsheet: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="3" y1="15" x2="21" y2="15" />
      <line x1="9" y1="3" x2="9" y2="21" />
      <line x1="15" y1="3" x2="15" y2="21" />
    </svg>
  ),
  globe: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
    </svg>
  ),
  doctor: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
      <circle cx="12" cy="7" r="4" />
      <path d="M12 11v4M10 13h4" />
    </svg>
  ),
  sync: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
      <path d="M23 4v6h-6M1 20v-6h6" />
      <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
    </svg>
  ),
  touch: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
      <path d="M18 11V6a2 2 0 00-2-2 2 2 0 00-2 2v0M14 10V4a2 2 0 00-2-2 2 2 0 00-2 2v2M10 10.5V6a2 2 0 00-2-2 2 2 0 00-2 2v8" />
      <path d="M18 8a2 2 0 012 2v7.4a6 6 0 01-.8 2.9l-.6 1.1a2 2 0 01-1.7 1H8.6a2 2 0 01-1.6-.8l-4-5a2 2 0 01.3-2.8l.3-.2a2 2 0 012.6.3L8 16V6" />
    </svg>
  ),
  handshake: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  ),
  tooth: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
      <path d="M12 2C9.5 2 7 4 7 7c0 2-1 3-1 5 0 4 2 10 4 10 1 0 1.5-2 2-2s1 2 2 2c2 0 4-6 4-10 0-2-1-3-1-5 0-3-2.5-5-5-5z" />
    </svg>
  ),
  hospital: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
      <path d="M3 21h18M9 8h1M9 12h1M9 16h1M14 8h1M14 12h1M14 16h1" />
      <path d="M5 21V5a2 2 0 012-2h10a2 2 0 012 2v16" />
    </svg>
  ),
  bone: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
      <path d="M18.5 4a2.5 2.5 0 00-2.4 3.2L8.8 14.5a2.5 2.5 0 10.7.7l7.3-7.3A2.5 2.5 0 1018.5 4z" />
      <path d="M5.5 20a2.5 2.5 0 002.4-3.2l7.3-7.3a2.5 2.5 0 10-.7-.7l-7.3 7.3A2.5 2.5 0 105.5 20z" />
    </svg>
  ),
  spa: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
      <path d="M12 22c-4-3-8-6-8-11a8 8 0 0116 0c0 5-4 8-8 11z" />
      <path d="M12 11a3 3 0 100-6 3 3 0 000 6z" />
    </svg>
  ),
  nail: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
      <path d="M12 3v18M8 6c0-1 .9-2 2-2h4c1.1 0 2 .9 2 2v2c0 1-.9 2-2 2h-4c-1.1 0-2-.9-2-2V6z" />
      <path d="M8 14h8M8 18h8" />
    </svg>
  ),
  scissors: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
      <circle cx="6" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <line x1="20" y1="4" x2="8.12" y2="15.88" />
      <line x1="14.47" y1="14.48" x2="20" y2="20" />
      <line x1="8.12" y1="8.12" x2="12" y2="12" />
    </svg>
  ),
  user: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
  robot: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
      <rect x="3" y="11" width="18" height="10" rx="2" />
      <circle cx="12" cy="5" r="2" />
      <path d="M12 7v4" />
      <circle cx="8" cy="16" r="1" fill="currentColor" />
      <circle cx="16" cy="16" r="1" fill="currentColor" />
    </svg>
  ),
  money: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
    </svg>
  ),
  target: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  ),
};

// Icon wrapper component for consistent styling
const IconBox = ({ children, variant = 'accent' }: { children: ReactNode; variant?: 'accent' | 'danger' }) => (
  <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl ${
    variant === 'danger'
      ? 'bg-gradient-to-br from-red-50 to-red-100 text-red-500'
      : 'bg-gradient-to-br from-premium-accent/10 to-premium-accent/20 text-premium-accent'
  }`}>
    {children}
  </div>
);

const NAV_LINKS = [
  { label: '機能', href: '#features' },
  { label: '料金', href: '#pricing' },
  { label: 'よくある質問', href: '#faq' },
];

const PAIN_POINTS = [
  {
    icon: Icons.phone,
    title: '電話対応で業務が中断',
    description: '施術中や診察中に電話が鳴り、スタッフが対応に追われる',
  },
  {
    icon: Icons.moon,
    title: '夜間・休診日の取りこぼし',
    description: '営業時間外の予約希望を逃し、機会損失が発生',
  },
  {
    icon: Icons.users,
    title: '採用・教育コストの増加',
    description: '受付スタッフの確保と育成に時間とコストがかかる',
  },
  {
    icon: Icons.calendar,
    title: 'ダブルブッキングのリスク',
    description: '手動管理によるミスで患者様にご迷惑をかけてしまう',
  },
];

const FEATURES = [
  {
    icon: Icons.robot,
    title: '24時間自動予約受付',
    description: 'AIが24時間365日、自然な会話で予約を受け付け。夜間や休診日も予約を逃しません。',
  },
  {
    icon: Icons.spreadsheet,
    title: 'スプレッドシート連携',
    description: 'Googleスプレッドシートで予約を一元管理。既存の業務フローを変えずに導入できます。',
  },
  {
    icon: Icons.globe,
    title: 'HP情報も自動回答',
    description: '診療時間、アクセス、料金などのよくある質問にも自動で回答。電話を減らします。',
  },
  {
    icon: Icons.doctor,
    title: '担当医指名・診察券対応',
    description: '担当医の指名予約や診察券番号の確認も対応。再診患者にも安心の体験を。',
  },
];

const TARGET_INDUSTRIES = [
  { icon: Icons.tooth, name: '歯科医院' },
  { icon: Icons.hospital, name: 'クリニック' },
  { icon: Icons.bone, name: '整骨院・接骨院' },
  { icon: Icons.spa, name: 'エステサロン' },
  { icon: Icons.nail, name: 'ネイルサロン' },
  { icon: Icons.scissors, name: '美容室' },
];

const STATS = [
  { value: '80%', label: '電話対応削減' },
  { value: '24h', label: '予約受付対応' },
  { value: '+30%', label: '夜間予約獲得' },
  { value: '10日', label: '導入期間' },
];

// 人件費比較データ
const COST_COMPARISON = {
  staff: {
    title: '受付スタッフを雇う場合',
    items: [
      { label: '月給', value: '¥250,000〜' },
      { label: '社会保険', value: '¥40,000〜' },
      { label: '採用コスト', value: '¥100,000〜' },
      { label: '教育期間', value: '1〜3ヶ月' },
      { label: '対応時間', value: '営業時間のみ' },
    ],
    total: '年間 ¥400万円以上',
  },
  iryoGpt: {
    title: 'IRYO GPTを導入する場合',
    items: [
      { label: '月額費用', value: '¥100,000' },
      { label: '初期費用', value: '¥300,000（初回のみ）' },
      { label: '追加コスト', value: '¥0' },
      { label: '導入期間', value: '約10日' },
      { label: '対応時間', value: '24時間365日' },
    ],
    total: '年間 ¥150万円',
  },
};

// ハイブリッド運用の特徴
const HYBRID_FEATURES = [
  {
    icon: Icons.sync,
    title: 'リアルタイム同期',
    description: 'スタッフが電話で受けた予約をスプレッドシートに追加しても、AIが即座に認識。ダブルブッキングを自動で防止。',
  },
  {
    icon: Icons.touch,
    title: '誰でも簡単操作',
    description: 'Googleスプレッドシートだから、PCが苦手なスタッフでも簡単に操作可能。特別な研修は不要です。',
  },
  {
    icon: Icons.handshake,
    title: 'AI×人のベストミックス',
    description: '定型的な予約はAIが自動対応。複雑な相談や緊急の問い合わせはスタッフが対応する最適な役割分担。',
  },
];

const PRICING_FEATURES = [
  'AIチャットボット構築',
  '予約システム連携',
  'HP情報の学習・回答',
  '導入サポート',
  '月次レポート',
  '継続的な改善提案',
];

const FAQ_ITEMS = [
  {
    question: '導入にどのくらい時間がかかりますか？',
    answer: '最短10日で本番公開が可能です。初回ヒアリング後、ナレッジ同期、テスト、公開という流れで進めます。',
  },
  {
    question: '既存の予約システムと連携できますか？',
    answer: 'Googleスプレッドシートを使用した予約管理に対応しています。既存システムとの連携については個別にご相談ください。',
  },
  {
    question: 'AIが間違った回答をすることはありますか？',
    answer: '医療アドバイスは一切行わないよう設計されています。予約と基本的なご案内に特化し、複雑な質問は「お問い合わせください」と案内します。',
  },
  {
    question: '解約はいつでもできますか？',
    answer: 'はい、月単位で解約可能です。最低契約期間はございません。',
  },
];

export default function Home() {
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  return (
    <Layout showShellHeader={false} fullWidth darkMode={false}>
      <div className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-6 lg:px-8">
        {/* Header */}
        <header className="sticky top-0 z-40 -mx-4 bg-white/95 px-4 py-4 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-premium-accent text-white font-bold text-lg">
                IR
              </div>
              <span className="text-xl font-bold text-premium-text">IRYO GPT</span>
            </Link>
            <nav className="hidden items-center gap-6 md:flex">
              {NAV_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="text-premium-muted transition hover:text-premium-text"
                >
                  {link.label}
                </a>
              ))}
            </nav>
            <div className="flex items-center gap-3">
              <Link
                href="/auth/login"
                className="hidden text-premium-muted transition hover:text-premium-text sm:block"
              >
                ログイン
              </Link>
              <Button size="md" onClick={() => (window.location.href = '/contact')}>
                無料相談
              </Button>
            </div>
          </div>
        </header>

        <main className="space-y-20 pt-8">
          {/* Hero Section */}
          <section className="section-fade" style={{ animationDelay: '0.05s' }}>
            <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
              <div>
                <p className="inline-flex items-center gap-2 rounded-full bg-premium-accent/10 px-4 py-2 text-sm font-medium text-premium-accent">
                  <span className="text-premium-accent">{Icons.target}</span>
                  医療・美容業界特化
                </p>
                <h1 className="mt-6 text-4xl font-bold leading-tight text-premium-text sm:text-5xl lg:text-6xl">
                  予約対応の
                  <br />
                  <span className="text-premium-accent">人件費を80%削減</span>
                </h1>
                <p className="mt-6 text-lg text-premium-muted leading-relaxed">
                  24時間365日、AIが予約を自動受付。
                  <br />
                  スタッフは本業に集中できます。
                </p>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <Button size="lg" onClick={() => (window.location.href = '/contact')}>
                    無料で相談する
                  </Button>
                  <Button size="lg" variant="secondary" onClick={() => (window.location.href = '#features')}>
                    機能を見る
                  </Button>
                </div>
              </div>
              <div className="relative">
                <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-premium-accent/20 to-premium-surface shadow-xl">
                  <video
                    autoPlay
                    muted
                    loop
                    playsInline
                    className="h-auto w-full object-cover"
                  >
                    <source src="/videos/demo.mp4" type="video/mp4" />
                  </video>
                </div>
              </div>
            </div>
          </section>

          {/* Stats Section */}
          <section className="section-fade" style={{ animationDelay: '0.1s' }}>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {STATS.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-2xl border border-premium-stroke bg-white p-6 text-center shadow-sm"
                >
                  <p className="text-3xl font-bold text-premium-accent sm:text-4xl">{stat.value}</p>
                  <p className="mt-2 text-premium-muted">{stat.label}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Pain Points Section */}
          <section className="section-fade" style={{ animationDelay: '0.15s' }}>
            <div className="text-center">
              <h2 className="text-3xl font-bold text-premium-text sm:text-4xl">
                こんなお悩みありませんか？
              </h2>
              <p className="mt-4 text-lg text-premium-muted">
                予約対応に追われる毎日から解放されましょう
              </p>
            </div>
            <div className="mt-12 grid gap-6 sm:grid-cols-2">
              {PAIN_POINTS.map((point) => (
                <div
                  key={point.title}
                  className="flex gap-4 rounded-2xl border border-premium-stroke bg-white p-6 shadow-sm"
                >
                  <IconBox variant="danger">{point.icon}</IconBox>
                  <div>
                    <h3 className="text-lg font-semibold text-premium-text">{point.title}</h3>
                    <p className="mt-1 text-premium-muted">{point.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Demo Video Section */}
          <section className="section-fade" style={{ animationDelay: '0.17s' }}>
            <div className="text-center">
              <p className="text-premium-accent font-semibold">DEMO</p>
              <h2 className="mt-2 text-3xl font-bold text-premium-text sm:text-4xl">
                実際の動作をご覧ください
              </h2>
              <p className="mt-4 text-lg text-premium-muted">
                AIが自然な会話で予約を完了する様子
              </p>
            </div>
            <div className="mx-auto mt-10 max-w-4xl">
              <div className="overflow-hidden rounded-3xl border border-premium-stroke bg-white shadow-xl">
                <video
                  controls
                  playsInline
                  className="h-auto w-full"
                >
                  <source src="/videos/demo.mp4" type="video/mp4" />
                  お使いのブラウザは動画再生に対応していません。
                </video>
              </div>
            </div>
          </section>

          {/* Cost Comparison Section */}
          <section className="section-fade" style={{ animationDelay: '0.18s' }}>
            <div className="text-center">
              <p className="text-premium-accent font-semibold">COST SAVING</p>
              <h2 className="mt-2 text-3xl font-bold text-premium-text sm:text-4xl">
                人件費を大幅カット
              </h2>
              <p className="mt-4 text-lg text-premium-muted">
                受付スタッフ1人分のコストで、24時間対応が実現
              </p>
            </div>
            <div className="mt-12 grid gap-8 lg:grid-cols-2">
              {/* Staff Cost */}
              <div className="rounded-2xl border border-red-200 bg-red-50/50 p-8">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-red-100 to-red-200 text-red-500">
                    {Icons.user}
                  </div>
                  <h3 className="text-xl font-semibold text-premium-text">{COST_COMPARISON.staff.title}</h3>
                </div>
                <ul className="mt-6 space-y-3">
                  {COST_COMPARISON.staff.items.map((item) => (
                    <li key={item.label} className="flex justify-between border-b border-red-100 pb-2">
                      <span className="text-premium-muted">{item.label}</span>
                      <span className="font-medium text-premium-text">{item.value}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-6 rounded-xl bg-red-100 p-4 text-center">
                  <p className="text-sm text-red-600">合計コスト</p>
                  <p className="text-2xl font-bold text-red-700">{COST_COMPARISON.staff.total}</p>
                </div>
              </div>
              {/* IRYO GPT Cost */}
              <div className="rounded-2xl border-2 border-premium-accent bg-premium-accent/5 p-8">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-premium-accent/20 to-premium-accent/30 text-premium-accent">
                    {Icons.robot}
                  </div>
                  <h3 className="text-xl font-semibold text-premium-text">{COST_COMPARISON.iryoGpt.title}</h3>
                </div>
                <ul className="mt-6 space-y-3">
                  {COST_COMPARISON.iryoGpt.items.map((item) => (
                    <li key={item.label} className="flex justify-between border-b border-premium-accent/20 pb-2">
                      <span className="text-premium-muted">{item.label}</span>
                      <span className="font-medium text-premium-text">{item.value}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-6 rounded-xl bg-premium-accent p-4 text-center text-white">
                  <p className="text-sm opacity-90">合計コスト</p>
                  <p className="text-2xl font-bold">{COST_COMPARISON.iryoGpt.total}</p>
                </div>
              </div>
            </div>
            <div className="mt-8 text-center">
              <p className="inline-flex items-center gap-2 rounded-full bg-premium-accent/10 px-6 py-3 text-lg font-semibold text-premium-accent">
                <span className="text-premium-accent">{Icons.money}</span>
                年間約250万円のコスト削減！
              </p>
            </div>
          </section>

          {/* Hybrid Operation Section */}
          <section className="section-fade" style={{ animationDelay: '0.19s' }}>
            <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
              <div className="order-2 lg:order-1">
                <div className="overflow-hidden rounded-3xl shadow-xl">
                  <Image
                    src="https://images.unsplash.com/photo-1586880244406-556ebe35f282?w=800&h=600&fit=crop"
                    alt="スプレッドシートで予約管理"
                    width={800}
                    height={600}
                    className="h-auto w-full object-cover"
                  />
                </div>
              </div>
              <div className="order-1 lg:order-2">
                <p className="text-premium-accent font-semibold">HYBRID OPERATION</p>
                <h2 className="mt-2 text-3xl font-bold text-premium-text sm:text-4xl">
                  完全自動化じゃなくてもOK
                </h2>
                <p className="mt-4 text-lg text-premium-muted leading-relaxed">
                  電話予約とAI予約を併用したい？問題ありません。<br />
                  スプレッドシートで一元管理するから、どちらの予約も見える化。
                </p>
                <div className="mt-8 space-y-4">
                  {HYBRID_FEATURES.map((feature) => (
                    <div key={feature.title} className="flex gap-4">
                      <IconBox>{feature.icon}</IconBox>
                      <div>
                        <h3 className="font-semibold text-premium-text">{feature.title}</h3>
                        <p className="mt-1 text-sm text-premium-muted">{feature.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Solution Section */}
          <section id="features" className="section-fade" style={{ animationDelay: '0.2s' }}>
            <div className="text-center">
              <p className="text-premium-accent font-semibold">SOLUTION</p>
              <h2 className="mt-2 text-3xl font-bold text-premium-text sm:text-4xl">
                IRYO GPTが解決します
              </h2>
              <p className="mt-4 text-lg text-premium-muted">
                AI予約システムで業務効率を劇的に改善
              </p>
            </div>
            <div className="mt-12 grid gap-6 md:grid-cols-2">
              {FEATURES.map((feature) => (
                <div
                  key={feature.title}
                  className="rounded-2xl border border-premium-stroke bg-white p-8 shadow-sm transition hover:shadow-md"
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-premium-accent/10 to-premium-accent/20 text-premium-accent">
                    {feature.icon}
                  </div>
                  <h3 className="mt-4 text-xl font-semibold text-premium-text">{feature.title}</h3>
                  <p className="mt-2 text-premium-muted leading-relaxed">{feature.description}</p>
                </div>
              ))}
            </div>
          </section>

          {/* How It Works Section */}
          <section className="section-fade" style={{ animationDelay: '0.22s' }}>
            <div className="text-center">
              <p className="text-premium-accent font-semibold">HOW IT WORKS</p>
              <h2 className="mt-2 text-3xl font-bold text-premium-text sm:text-4xl">
                シンプルな仕組み
              </h2>
              <p className="mt-4 text-lg text-premium-muted">
                患者様とスタッフ、両方にとって使いやすい設計
              </p>
            </div>
            <div className="mt-12 grid gap-6 md:grid-cols-3">
              <div className="relative rounded-2xl border border-premium-stroke bg-white p-6 text-center shadow-sm">
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-premium-accent text-white font-bold">1</span>
                </div>
                <div className="mt-4">
                  <div className="mx-auto aspect-[4/3] w-full overflow-hidden rounded-2xl bg-premium-surface">
                    <Image
                      src="https://images.unsplash.com/photo-1611746872915-64382b5c76da?w=400&h=300&fit=crop"
                      alt="チャットで予約"
                      width={400}
                      height={300}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <h3 className="mt-4 font-semibold text-premium-text">AIがチャットで対応</h3>
                  <p className="mt-2 text-sm text-premium-muted">
                    患者様がHPのチャットで予約希望を伝えると、AIが空き状況を確認して予約を完了
                  </p>
                </div>
              </div>
              <div className="relative rounded-2xl border border-premium-stroke bg-white p-6 text-center shadow-sm">
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-premium-accent text-white font-bold">2</span>
                </div>
                <div className="mt-4">
                  <div className="mx-auto aspect-[4/3] w-full overflow-hidden rounded-2xl bg-premium-surface">
                    <Image
                      src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=400&h=300&fit=crop"
                      alt="スプレッドシートに自動記録"
                      width={400}
                      height={300}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <h3 className="mt-4 font-semibold text-premium-text">スプシに自動記録</h3>
                  <p className="mt-2 text-sm text-premium-muted">
                    予約情報は即座にGoogleスプレッドシートに記録。スタッフの手動入力も反映
                  </p>
                </div>
              </div>
              <div className="relative rounded-2xl border border-premium-stroke bg-white p-6 text-center shadow-sm">
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-premium-accent text-white font-bold">3</span>
                </div>
                <div className="mt-4">
                  <div className="mx-auto aspect-[4/3] w-full overflow-hidden rounded-2xl bg-premium-surface">
                    <Image
                      src="https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=400&h=300&fit=crop"
                      alt="スタッフが確認"
                      width={400}
                      height={300}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <h3 className="mt-4 font-semibold text-premium-text">スタッフが確認</h3>
                  <p className="mt-2 text-sm text-premium-muted">
                    スタッフはスプシを見るだけで全予約を把握。スマホからも確認できます
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Target Industries */}
          <section className="section-fade" style={{ animationDelay: '0.25s' }}>
            <div className="rounded-3xl bg-premium-surface p-8 sm:p-12">
              <div className="text-center">
                <h2 className="text-3xl font-bold text-premium-text sm:text-4xl">対象業種</h2>
                <p className="mt-4 text-lg text-premium-muted">
                  予約管理が必要なあらゆる業種に対応
                </p>
              </div>
              <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-6">
                {TARGET_INDUSTRIES.map((industry) => (
                  <div
                    key={industry.name}
                    className="flex flex-col items-center rounded-2xl bg-white p-6 shadow-sm transition hover:shadow-md"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-premium-accent/10 to-premium-accent/20 text-premium-accent">
                      {industry.icon}
                    </div>
                    <span className="mt-3 text-sm font-medium text-premium-text">{industry.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Pricing Section */}
          <section id="pricing" className="section-fade" style={{ animationDelay: '0.3s' }}>
            <div className="text-center">
              <p className="text-premium-accent font-semibold">PRICING</p>
              <h2 className="mt-2 text-3xl font-bold text-premium-text sm:text-4xl">
                シンプルな料金体系
              </h2>
              <p className="mt-4 text-lg text-premium-muted">
                追加料金なし。必要な機能がすべて含まれています
              </p>
            </div>
            <div className="mx-auto mt-12 max-w-lg">
              <div className="overflow-hidden rounded-3xl border-2 border-premium-accent bg-white shadow-lg">
                <div className="bg-premium-accent px-8 py-6 text-center text-white">
                  <p className="text-sm font-medium opacity-90">IRYO GPT スタンダード</p>
                  <p className="mt-2 text-4xl font-bold">¥100,000<span className="text-lg font-normal">/月</span></p>
                  <p className="mt-2 text-sm opacity-90">初期導入費用: ¥300,000（税別）</p>
                </div>
                <div className="p-8">
                  <p className="text-center text-premium-muted">含まれる機能</p>
                  <ul className="mt-6 space-y-4">
                    {PRICING_FEATURES.map((feature) => (
                      <li key={feature} className="flex items-center gap-3">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-premium-accent/10 text-premium-accent">
                          ✓
                        </span>
                        <span className="text-premium-text">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    size="lg"
                    className="mt-8 w-full"
                    onClick={() => (window.location.href = '/contact')}
                  >
                    無料で相談する
                  </Button>
                </div>
              </div>
            </div>
          </section>

          {/* FAQ Section */}
          <section id="faq" className="section-fade" style={{ animationDelay: '0.35s' }}>
            <div className="text-center">
              <p className="text-premium-accent font-semibold">FAQ</p>
              <h2 className="mt-2 text-3xl font-bold text-premium-text sm:text-4xl">
                よくある質問
              </h2>
            </div>
            <div className="mx-auto mt-12 max-w-3xl space-y-4">
              {FAQ_ITEMS.map((faq, idx) => {
                const isOpen = openFaqIndex === idx;
                return (
                  <button
                    key={faq.question}
                    type="button"
                    onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                    className="w-full rounded-2xl border border-premium-stroke bg-white px-6 py-5 text-left shadow-sm transition hover:shadow-md"
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-premium-text pr-4">{faq.question}</p>
                      <span className="flex-shrink-0 text-premium-accent text-xl">
                        {isOpen ? '−' : '+'}
                      </span>
                    </div>
                    {isOpen && (
                      <p className="mt-4 text-premium-muted leading-relaxed">{faq.answer}</p>
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          {/* CTA Section */}
          <section className="section-fade" style={{ animationDelay: '0.4s' }}>
            <div className="rounded-3xl bg-gradient-to-r from-premium-accent to-premium-accentDeep p-8 text-center text-white sm:p-12">
              <h2 className="text-3xl font-bold sm:text-4xl">
                まずは無料相談から
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-lg opacity-90">
                導入についてのご質問、お見積もりなど、お気軽にご相談ください。
                <br />
                専門スタッフが丁寧にご説明いたします。
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
                <Button
                  size="lg"
                  variant="secondary"
                  className="bg-white text-premium-accent hover:bg-gray-50"
                  onClick={() => (window.location.href = '/contact')}
                >
                  無料で相談する
                </Button>
                <a
                  href="mailto:heartssh@gmail.com"
                  className="text-white underline underline-offset-4 opacity-90 transition hover:opacity-100"
                >
                  heartssh@gmail.com
                </a>
              </div>
            </div>
          </section>
        </main>

        {/* Footer */}
        <footer className="mt-20 border-t border-premium-stroke pt-8">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-premium-accent text-white font-bold text-sm">
                IR
              </div>
              <span className="font-bold text-premium-text">IRYO GPT</span>
            </div>
            <p className="text-sm text-premium-muted">
              © {new Date().getFullYear()} IRYO GPT. All rights reserved.
            </p>
          </div>
        </footer>
      </div>
    </Layout>
  );
}
