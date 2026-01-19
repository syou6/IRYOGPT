import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import Layout from '@/components/layout';
import Button from '@/components/ui/Button';

// 3D Icons from Icons8
const Icon3D = ({ name, size = 48 }: { name: string; size?: number }) => (
  <Image
    src={`https://img.icons8.com/3d-fluency/94/${name}.png`}
    alt={name}
    width={size}
    height={size}
    className="object-contain"
  />
);

// Check icon for lists
const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const NAV_LINKS = [
  { label: '機能', href: '#features' },
  { label: '料金', href: '#pricing' },
  { label: 'よくある質問', href: '#faq' },
];

const PAIN_POINTS = [
  {
    icon: 'phone',
    title: '電話対応で業務が中断',
    description: '施術中や診察中に電話が鳴り、スタッフが対応に追われる',
  },
  {
    icon: 'sleep',
    title: '夜間・休診日の取りこぼし',
    description: '営業時間外の予約希望を逃し、機会損失が発生',
  },
  {
    icon: 'conference',
    title: '採用・教育コストの増加',
    description: '受付スタッフの確保と育成に時間とコストがかかる',
  },
  {
    icon: 'calendar',
    title: 'ダブルブッキングのリスク',
    description: '手動管理によるミスで患者様にご迷惑をかけてしまう',
  },
];

const FEATURES = [
  {
    icon: 'robot',
    title: '24時間自動予約受付',
    description: 'AIが24時間365日、自然な会話で予約を受け付け。夜間や休診日も予約を逃しません。',
  },
  {
    icon: 'table',
    title: 'スプレッドシート連携',
    description: 'Googleスプレッドシートで予約を一元管理。既存の業務フローを変えずに導入できます。',
  },
  {
    icon: 'globe',
    title: 'HP情報も自動回答',
    description: '診療時間、アクセス、料金などのよくある質問にも自動で回答。電話を減らします。',
  },
  {
    icon: 'stethoscope',
    title: '担当医指名・診察券対応',
    description: '担当医の指名予約や診察券番号の確認も対応。再診患者にも安心の体験を。',
  },
];

const TARGET_INDUSTRIES = [
  { icon: 'tooth', name: '歯科医院' },
  { icon: 'hospital', name: 'クリニック' },
  { icon: 'hand', name: '整骨院・接骨院' },
  { icon: 'spa', name: 'エステサロン' },
  { icon: 'nail', name: 'ネイルサロン' },
  { icon: 'cut', name: '美容室' },
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
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-premium-accent text-white font-bold text-lg">
              IR
            </div>
            <span className="text-xl font-bold text-premium-text">よやくらく</span>
          </Link>
          <nav className="hidden items-center gap-8 md:flex">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-base text-premium-muted transition hover:text-premium-text"
              >
                {link.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-4">
            <Link
              href="/auth/login"
              className="hidden text-base text-premium-muted transition hover:text-premium-text sm:block"
            >
              ログイン
            </Link>
            <Button size="md" onClick={() => (window.location.href = '/contact')}>
              無料相談
            </Button>
          </div>
        </div>
      </header>

      <main>
        {/* ===== HERO SECTION ===== */}
        <section className="relative min-h-[700px] overflow-hidden bg-gradient-to-br from-[#0a3d3d] via-[#0d4a47] to-[#064038] px-4 py-20 sm:px-6 sm:py-24 lg:min-h-[800px] lg:px-8 lg:py-32">
          {/* Background decoration */}
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -right-40 -top-40 h-[600px] w-[600px] rounded-full bg-[#19c37d]/10 blur-3xl" />
            <div className="absolute -bottom-40 -left-40 h-[500px] w-[500px] rounded-full bg-[#0d9668]/10 blur-3xl" />
          </div>

          <div className="relative mx-auto max-w-7xl">
            <div className="lg:max-w-[55%]">
              <p className="inline-flex items-center gap-2 rounded-full border border-[#19c37d]/30 bg-[#19c37d]/10 px-6 py-3 text-lg font-medium text-[#7af4c1]">
                <Icon3D name="goal" size={24} />
                医療・美容業界特化
              </p>
              <h1 className="font-hero mt-8 text-5xl leading-[1.1] text-white sm:text-6xl md:text-7xl lg:text-[5.5rem] xl:text-[6.5rem]">
                <span className="whitespace-nowrap">もう予約電話に</span>
                <br />
                <span className="whitespace-nowrap bg-gradient-to-r from-[#7af4c1] to-[#4ade80] bg-clip-text text-transparent">振り回されない</span>
              </h1>
              <p className="mt-8 text-2xl leading-relaxed text-white/80 sm:text-3xl lg:mt-10">
                24時間365日、AIが予約を自動受付。
                <br />
                スタッフは本業に集中できます。
              </p>
              <div className="mt-10 flex flex-col gap-4 sm:flex-row lg:mt-12">
                <Button size="lg" className="px-10 py-5 text-xl" onClick={() => (window.location.href = '/contact')}>
                  無料で相談する
                </Button>
                <Button
                  size="lg"
                  variant="secondary"
                  className="border-white/20 bg-white/10 px-10 py-5 text-xl text-white hover:bg-white/20"
                  onClick={() => (window.location.href = '#features')}
                >
                  機能を見る
                </Button>
              </div>

              {/* Trust Badges */}
              <div className="mt-12 flex flex-wrap items-center gap-8 border-t border-white/10 pt-8 lg:mt-16 lg:gap-12 lg:pt-10">
                <div className="flex items-center gap-4">
                  <Icon3D name="hospital" size={56} />
                  <div>
                    <p className="text-xl font-bold text-white lg:text-2xl">医療・美容特化</p>
                    <p className="text-lg text-white/60">業界専門AI</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <Icon3D name="sun" size={56} />
                  <div>
                    <p className="text-xl font-bold text-white lg:text-2xl">24時間対応</p>
                    <p className="text-lg text-white/60">夜間・休日も</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <Icon3D name="phone" size={56} />
                  <div>
                    <p className="text-xl font-bold text-white lg:text-2xl">電話80%削減</p>
                    <p className="text-lg text-white/60">業務効率化</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Laptop Mockup */}
            <div className="pointer-events-none absolute -right-20 top-1/2 hidden -translate-y-1/2 lg:block xl:right-0">
              <div className="relative rounded-t-3xl bg-gray-800 p-4 shadow-2xl xl:p-5">
                <div className="absolute left-1/2 top-3 h-3 w-3 -translate-x-1/2 rounded-full bg-gray-600" />
                <div className="overflow-hidden rounded-2xl bg-white">
                  <video autoPlay muted loop playsInline className="h-auto w-[420px] xl:w-[500px]">
                    <source src="/videos/demo.mp4" type="video/mp4" />
                  </video>
                </div>
              </div>
              <div className="relative h-5 rounded-b-2xl bg-gray-700">
                <div className="absolute inset-x-1/4 top-0 h-2 rounded-b bg-gray-600" />
              </div>
              <div className="h-2.5 rounded-b-2xl bg-gray-800 shadow-lg" />
            </div>
          </div>
        </section>

        {/* ===== BANNER SECTION ===== */}
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
            <div className="overflow-hidden rounded-2xl bg-premium-surface">
              <Image
                src="https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=400&h=300&fit=crop"
                alt="歯科医院"
                width={400}
                height={300}
                className="h-48 w-full object-cover transition hover:scale-105"
              />
            </div>
            <div className="overflow-hidden rounded-2xl bg-premium-surface">
              <Image
                src="https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=400&h=300&fit=crop"
                alt="クリニック受付"
                width={400}
                height={300}
                className="h-48 w-full object-cover transition hover:scale-105"
              />
            </div>
            <div className="overflow-hidden rounded-2xl bg-premium-surface">
              <Image
                src="https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=400&h=300&fit=crop"
                alt="医療スタッフ"
                width={400}
                height={300}
                className="h-48 w-full object-cover transition hover:scale-105"
              />
            </div>
            <div className="overflow-hidden rounded-2xl bg-premium-surface">
              <Image
                src="https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=400&h=300&fit=crop"
                alt="予約システム"
                width={400}
                height={300}
                className="h-48 w-full object-cover transition hover:scale-105"
              />
            </div>
          </div>
        </section>

        {/* ===== LOGO SLIDER ===== */}
        <section className="py-12">
          <div className="text-center">
            <p className="text-xl font-medium text-premium-muted">多くの医療機関・サロンで導入いただいています</p>
          </div>
          <div className="relative mt-10 overflow-hidden">
            <div className="pointer-events-none absolute left-0 top-0 z-10 h-full w-20 bg-gradient-to-r from-white to-transparent" />
            <div className="pointer-events-none absolute right-0 top-0 z-10 h-full w-20 bg-gradient-to-l from-white to-transparent" />
            <div className="flex animate-scroll">
              {[...Array(2)].map((_, setIndex) => (
                <div key={setIndex} className="flex shrink-0 items-center gap-12 px-6">
                  {['さくら歯科', '青山クリニック', '田中整骨院', '美容室 HAIR', '渋谷皮膚科', 'Nail Salon M', '新宿内科', 'エステ LUXE'].map((name) => (
                    <div key={name} className="flex h-20 w-48 items-center justify-center rounded-lg bg-gray-100 px-4">
                      <span className="text-xl font-bold text-gray-400">{name}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ===== BEFORE/AFTER SECTION ===== */}
        <section className="bg-gradient-to-b from-[#e8f4f8] to-white py-20 lg:py-28">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <h2 className="text-4xl font-bold text-premium-text sm:text-5xl lg:text-6xl">
                予約対応の悩みを
                <br />
                <span className="text-premium-accent">AIがまるっと解決</span>
              </h2>
            </div>

            <div className="mt-16 grid items-center gap-8 lg:grid-cols-[1fr_auto_1fr] lg:gap-6">
              {/* Before */}
              <div className="relative">
                <div className="absolute -left-2 -top-2 z-10 rounded-full bg-red-500 px-5 py-2 text-base font-bold text-white lg:-left-4 lg:-top-4">
                  Before
                </div>
                <div className="rounded-2xl bg-red-50 p-8">
                  <div className="relative h-[320px] lg:h-[380px]">
                    <div className="absolute left-[5%] top-[5%] rounded-lg bg-white px-4 py-3 text-base font-medium text-red-600 shadow-md">📞 電話が鳴り止まない</div>
                    <div className="absolute right-[3%] top-[12%] rounded-lg bg-white px-4 py-3 text-base font-medium text-orange-600 shadow-md">😰 施術中に対応できない</div>
                    <div className="absolute left-[8%] top-[30%] rounded-lg bg-white px-4 py-3 text-base font-medium text-red-500 shadow-md">📝 手書きでミス発生</div>
                    <div className="absolute right-[5%] top-[35%] rounded-lg bg-white px-4 py-3 text-base font-medium text-orange-500 shadow-md">🌙 夜間の予約逃す</div>
                    <div className="absolute left-[12%] top-[55%] rounded-lg bg-white px-4 py-3 text-base font-medium text-red-600 shadow-md">⚠️ ダブルブッキング</div>
                    <div className="absolute right-[8%] top-[58%] rounded-lg bg-white px-4 py-3 text-base font-medium text-orange-600 shadow-md">💸 人件費が高い</div>
                    <div className="absolute left-[5%] top-[78%] rounded-lg bg-white px-4 py-3 text-base font-medium text-red-500 shadow-md">😫 スタッフ疲弊</div>
                    <div className="absolute right-[12%] top-[82%] rounded-lg bg-white px-4 py-3 text-base font-medium text-orange-500 shadow-md">📅 休日も対応</div>
                  </div>
                </div>
              </div>

              {/* Arrow */}
              <div className="flex flex-col items-center justify-center py-4 lg:py-0">
                <div className="flex items-center gap-4">
                  <div className="h-0.5 w-8 bg-gray-300 lg:w-12" />
                  <div className="flex h-28 w-28 flex-col items-center justify-center rounded-2xl border-2 border-premium-accent bg-white shadow-lg">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-premium-accent text-white text-lg font-bold">
                      IR
                    </div>
                    <span className="mt-1 text-sm font-bold text-premium-text">よやくらく</span>
                  </div>
                  <div className="flex items-center">
                    <div className="h-0.5 w-8 bg-premium-accent lg:w-12" />
                    <div className="h-0 w-0 border-y-[8px] border-l-[12px] border-y-transparent border-l-premium-accent" />
                  </div>
                </div>
              </div>

              {/* After */}
              <div className="relative">
                <div className="absolute -right-2 -top-2 z-10 rounded-full bg-premium-accent px-5 py-2 text-base font-bold text-white lg:-right-4 lg:-top-4">
                  After
                </div>
                <div className="rounded-2xl bg-premium-accent/5 p-8">
                  <div className="space-y-5">
                    {/* AI Chat */}
                    <div className="rounded-xl bg-white p-6 shadow-md">
                      <div className="mb-4 flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-premium-accent text-base text-white">AI</div>
                        <span className="text-lg font-bold text-gray-800">予約受付AI</span>
                        <span className="rounded-full bg-green-100 px-3 py-1 text-sm text-green-600">24時間稼働中</span>
                      </div>
                      <div className="space-y-3 text-base">
                        <div className="rounded-lg bg-gray-100 p-4 text-gray-600">明日の10時予約できますか？</div>
                        <div className="rounded-lg bg-premium-accent/10 p-4 text-premium-accent">はい、10時空いております。お名前をお聞かせください。</div>
                      </div>
                    </div>

                    {/* Spreadsheet */}
                    <div className="rounded-xl bg-white p-6 shadow-md">
                      <div className="mb-4 flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-green-500 text-base text-white">📊</div>
                        <span className="text-lg font-bold text-gray-800">スプレッドシート</span>
                        <span className="rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-600">自動記録</span>
                      </div>
                      <div className="overflow-hidden rounded-lg border border-gray-200 text-base">
                        <div className="grid grid-cols-4 bg-gray-50">
                          <div className="border-b border-r border-gray-200 p-2.5 font-medium">日時</div>
                          <div className="border-b border-r border-gray-200 p-2.5 font-medium">お名前</div>
                          <div className="border-b border-r border-gray-200 p-2.5 font-medium">電話番号</div>
                          <div className="border-b border-gray-200 p-2.5 font-medium">症状</div>
                        </div>
                        <div className="grid grid-cols-4">
                          <div className="border-r border-gray-200 p-2.5 text-gray-600">1/20 10:00</div>
                          <div className="border-r border-gray-200 p-2.5 text-gray-600">山田様</div>
                          <div className="border-r border-gray-200 p-2.5 text-gray-600">090-xxxx</div>
                          <div className="p-2.5 text-gray-600">定期検診</div>
                        </div>
                      </div>
                    </div>

                    {/* Benefits */}
                    <div className="flex flex-wrap gap-3">
                      <span className="rounded-full bg-premium-accent/20 px-5 py-2 text-base font-medium text-premium-accent">✓ 電話80%削減</span>
                      <span className="rounded-full bg-premium-accent/20 px-5 py-2 text-base font-medium text-premium-accent">✓ 24時間対応</span>
                      <span className="rounded-full bg-premium-accent/20 px-5 py-2 text-base font-medium text-premium-accent">✓ ミスゼロ</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ===== PAIN POINTS SECTION ===== */}
        <section className="py-20 lg:py-28">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <h2 className="text-4xl font-bold text-premium-text sm:text-5xl lg:text-6xl">
                こんなお悩みありませんか？
              </h2>
              <p className="mt-6 text-xl text-premium-muted lg:text-2xl">
                予約対応に追われる毎日から解放されましょう
              </p>
            </div>
            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:mt-16">
              {PAIN_POINTS.map((point) => (
                <div
                  key={point.title}
                  className="flex gap-6 rounded-2xl border border-premium-stroke bg-white p-8 shadow-sm lg:p-10"
                >
                  <div className="flex-shrink-0">
                    <Icon3D name={point.icon} size={64} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-semibold text-premium-text">{point.title}</h3>
                    <p className="mt-3 text-lg text-premium-muted leading-relaxed">{point.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ===== WHY CHOOSE US SECTION ===== */}
        <section className="bg-gradient-to-b from-premium-surface to-white py-20 lg:py-28">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <p className="text-xl font-semibold text-premium-accent">WHY CHOOSE US</p>
              <h2 className="mt-3 text-4xl font-bold text-premium-text sm:text-5xl lg:text-6xl">
                <span className="text-premium-accent">よやくらく</span>が選ばれる
                <span className="text-premium-accent">2</span>つの理由
              </h2>
            </div>

            {/* Reason 1 */}
            <div className="mt-16 grid items-center gap-10 lg:mt-20 lg:grid-cols-2 lg:gap-16">
              <div className="order-2 lg:order-1">
                <div className="flex items-center gap-3">
                  <span className="flex h-14 w-14 items-center justify-center rounded-full bg-premium-accent text-2xl font-bold text-white">1</span>
                  <p className="text-base font-medium text-premium-accent">REASON 01</p>
                </div>
                <h3 className="mt-5 text-3xl font-bold leading-tight text-premium-text sm:text-4xl lg:text-5xl">
                  AI×スプレッドシートで
                  <br />
                  誰でも簡単運用
                </h3>
                <p className="mt-6 text-lg leading-relaxed text-premium-muted lg:text-xl">
                  特別なシステムは不要。使い慣れたGoogleスプレッドシートで予約を一元管理。
                  AIが自動で予約を受け付け、スタッフが電話で受けた予約も同じシートに追加するだけ。
                  リアルタイムで同期されるから、ダブルブッキングの心配もありません。
                </p>
                <ul className="mt-8 space-y-4">
                  <li className="flex items-center gap-3 text-lg text-premium-text">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-premium-accent/10 text-premium-accent"><CheckIcon /></span>
                    導入に専用システム不要
                  </li>
                  <li className="flex items-center gap-3 text-lg text-premium-text">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-premium-accent/10 text-premium-accent"><CheckIcon /></span>
                    スマホからも予約確認OK
                  </li>
                  <li className="flex items-center gap-3 text-lg text-premium-text">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-premium-accent/10 text-premium-accent"><CheckIcon /></span>
                    AI×人のハイブリッド運用
                  </li>
                </ul>
              </div>
              <div className="order-1 flex justify-center lg:order-2">
                <div className="relative h-80 w-80 overflow-hidden rounded-3xl shadow-2xl sm:h-96 sm:w-96">
                  <Image
                    src="https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=600&h=600&fit=crop"
                    alt="医療とテクノロジー"
                    fill
                    className="object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#34A853]/90 via-[#34A853]/40 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-8 text-center text-white">
                    <p className="text-2xl font-bold">Google</p>
                    <p className="text-3xl font-bold">スプレッドシート</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Reason 2 */}
            <div className="mt-20 grid items-center gap-10 lg:mt-28 lg:grid-cols-2 lg:gap-16">
              <div className="flex justify-center">
                <div className="relative h-80 w-80 overflow-hidden rounded-3xl shadow-2xl sm:h-96 sm:w-96">
                  <Image
                    src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&h=600&fit=crop"
                    alt="データ分析とコスト削減"
                    fill
                    className="object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#F59E0B]/90 via-[#F59E0B]/40 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-8 text-center text-white">
                    <p className="text-2xl font-bold">年間</p>
                    <p className="text-5xl font-bold">250万円</p>
                    <p className="text-2xl font-bold">削減</p>
                  </div>
                </div>
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <span className="flex h-14 w-14 items-center justify-center rounded-full bg-premium-accent text-2xl font-bold text-white">2</span>
                  <p className="text-base font-medium text-premium-accent">REASON 02</p>
                </div>
                <h3 className="mt-5 text-3xl font-bold leading-tight text-premium-text sm:text-4xl lg:text-5xl">
                  圧倒的な
                  <br />
                  コストパフォーマンス
                </h3>
                <p className="mt-6 text-lg leading-relaxed text-premium-muted lg:text-xl">
                  受付スタッフを1人雇用すると年間400万円以上。よやくらくなら年間150万円で、
                  24時間365日の予約対応が実現。夜間・休日の予約取りこぼしもゼロに。
                  人件費を抑えながら、予約数アップを同時に実現します。
                </p>
                <ul className="mt-8 space-y-4">
                  <li className="flex items-center gap-3 text-lg text-premium-text">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-premium-accent/10 text-premium-accent"><CheckIcon /></span>
                    年間250万円以上のコスト削減
                  </li>
                  <li className="flex items-center gap-3 text-lg text-premium-text">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-premium-accent/10 text-premium-accent"><CheckIcon /></span>
                    24時間365日の予約対応
                  </li>
                  <li className="flex items-center gap-3 text-lg text-premium-text">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-premium-accent/10 text-premium-accent"><CheckIcon /></span>
                    夜間予約で売上30%アップ
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ===== FEATURES SECTION ===== */}
        <section id="features" className="py-20 lg:py-28">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <p className="text-xl font-semibold text-premium-accent">FEATURES</p>
              <h2 className="mt-3 text-4xl font-bold text-premium-text sm:text-5xl lg:text-6xl">
                よやくらくの機能
              </h2>
              <p className="mt-6 text-xl text-premium-muted lg:text-2xl">
                AI予約システムで業務効率を劇的に改善
              </p>
            </div>
            <div className="mt-12 grid gap-8 md:grid-cols-2 lg:mt-16">
              {FEATURES.map((feature) => (
                <div
                  key={feature.title}
                  className="rounded-2xl border border-premium-stroke bg-white p-8 shadow-sm transition hover:shadow-md lg:p-10"
                >
                  <Icon3D name={feature.icon} size={72} />
                  <h3 className="mt-6 text-2xl font-semibold text-premium-text lg:text-3xl">{feature.title}</h3>
                  <p className="mt-4 text-lg text-premium-muted leading-relaxed lg:text-xl">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ===== HOW IT WORKS SECTION ===== */}
        <section className="bg-premium-surface py-20 lg:py-28">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <p className="text-xl font-semibold text-premium-accent">HOW IT WORKS</p>
              <h2 className="mt-3 text-4xl font-bold text-premium-text sm:text-5xl lg:text-6xl">
                シンプルな仕組み
              </h2>
              <p className="mt-6 text-xl text-premium-muted lg:text-2xl">
                患者様とスタッフ、両方にとって使いやすい設計
              </p>
            </div>
            <div className="mt-12 grid gap-8 md:grid-cols-3 lg:mt-16">
              {[
                {
                  step: 1,
                  title: 'AIがチャットで対応',
                  description: '患者様がHPのチャットで予約希望を伝えると、AIが空き状況を確認して予約を完了',
                  image: 'https://images.unsplash.com/photo-1611746872915-64382b5c76da?w=400&h=300&fit=crop',
                },
                {
                  step: 2,
                  title: 'スプシに自動記録',
                  description: '予約情報は即座にGoogleスプレッドシートに記録。スタッフの手動入力も反映',
                  image: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=400&h=300&fit=crop',
                },
                {
                  step: 3,
                  title: 'スタッフが確認',
                  description: 'スタッフはスプシを見るだけで全予約を把握。スマホからも確認できます',
                  image: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=400&h=300&fit=crop',
                },
              ].map((item) => (
                <div key={item.step} className="relative rounded-2xl bg-white p-8 shadow-sm lg:p-10">
                  <div className="absolute -top-5 left-8">
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-premium-accent text-white text-xl font-bold">{item.step}</span>
                  </div>
                  <div className="mt-4">
                    <div className="aspect-[4/3] w-full overflow-hidden rounded-2xl bg-premium-surface">
                      <Image src={item.image} alt={item.title} width={400} height={300} className="h-full w-full object-cover" />
                    </div>
                    <h3 className="mt-6 text-2xl font-semibold text-premium-text">{item.title}</h3>
                    <p className="mt-3 text-lg text-premium-muted leading-relaxed">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ===== DEMO VIDEO SECTION ===== */}
        <section className="py-20 lg:py-28">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <p className="text-xl font-semibold text-premium-accent">DEMO</p>
              <h2 className="mt-3 text-4xl font-bold text-premium-text sm:text-5xl lg:text-6xl">
                実際の動作をご覧ください
              </h2>
              <p className="mt-6 text-xl text-premium-muted lg:text-2xl">
                AIが自然な会話で予約を完了する様子
              </p>
            </div>
            <div className="mt-12 lg:mt-16">
              <div className="overflow-hidden rounded-3xl border border-premium-stroke bg-white shadow-xl">
                <video controls playsInline className="h-auto w-full">
                  <source src="/videos/demo.mp4" type="video/mp4" />
                  お使いのブラウザは動画再生に対応していません。
                </video>
              </div>
            </div>
          </div>
        </section>

        {/* ===== TARGET INDUSTRIES ===== */}
        <section className="bg-premium-surface py-20 lg:py-28">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <h2 className="text-4xl font-bold text-premium-text sm:text-5xl lg:text-6xl">対象業種</h2>
              <p className="mt-6 text-xl text-premium-muted lg:text-2xl">
                予約管理が必要なあらゆる業種に対応
              </p>
            </div>
            <div className="mt-12 grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-6 lg:mt-16">
              {TARGET_INDUSTRIES.map((industry) => (
                <div
                  key={industry.name}
                  className="flex flex-col items-center rounded-2xl bg-white p-6 shadow-sm transition hover:shadow-md lg:p-8"
                >
                  <Icon3D name={industry.icon} size={64} />
                  <span className="mt-4 text-lg font-medium text-premium-text">{industry.name}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ===== PRICING SECTION ===== */}
        <section id="pricing" className="py-20 lg:py-28">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <p className="text-xl font-semibold text-premium-accent">PRICING</p>
              <h2 className="mt-3 text-4xl font-bold text-premium-text sm:text-5xl lg:text-6xl">
                シンプルな料金体系
              </h2>
              <p className="mt-6 text-xl text-premium-muted lg:text-2xl">
                追加料金なし。必要な機能がすべて含まれています
              </p>
            </div>
            <div className="mt-12 lg:mt-16">
              <div className="overflow-hidden rounded-3xl border-2 border-premium-accent bg-white shadow-lg">
                <div className="bg-premium-accent px-8 py-12 text-center text-white">
                  <p className="text-xl font-medium opacity-90">よやくらく スタンダード</p>
                  <p className="mt-4 text-6xl font-bold lg:text-7xl">¥100,000<span className="text-2xl font-normal lg:text-3xl">/月</span></p>
                  <p className="mt-4 text-lg opacity-90">初期導入費用: ¥300,000（税別）</p>
                </div>
                <div className="p-8 lg:p-12">
                  <p className="text-center text-xl text-premium-muted">含まれる機能</p>
                  <ul className="mt-8 space-y-5">
                    {PRICING_FEATURES.map((feature) => (
                      <li key={feature} className="flex items-center gap-4">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-premium-accent/10 text-premium-accent">
                          <CheckIcon />
                        </span>
                        <span className="text-xl text-premium-text">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    size="lg"
                    className="mt-12 w-full py-5 text-xl"
                    onClick={() => (window.location.href = '/contact')}
                  >
                    無料で相談する
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ===== FAQ SECTION ===== */}
        <section id="faq" className="bg-premium-surface py-20 lg:py-28">
          <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <p className="text-xl font-semibold text-premium-accent">FAQ</p>
              <h2 className="mt-3 text-4xl font-bold text-premium-text sm:text-5xl lg:text-6xl">
                よくある質問
              </h2>
            </div>
            <div className="mt-12 space-y-4 lg:mt-16">
              {FAQ_ITEMS.map((faq, idx) => {
                const isOpen = openFaqIndex === idx;
                return (
                  <button
                    key={faq.question}
                    type="button"
                    onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                    className="w-full rounded-2xl border border-premium-stroke bg-white px-8 py-7 text-left shadow-sm transition hover:shadow-md"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-xl font-semibold text-premium-text pr-4">{faq.question}</p>
                      <span className="flex-shrink-0 text-premium-accent text-3xl">
                        {isOpen ? '−' : '+'}
                      </span>
                    </div>
                    {isOpen && (
                      <p className="mt-5 text-lg text-premium-muted leading-relaxed">{faq.answer}</p>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* ===== CTA SECTION ===== */}
        <section className="py-20 lg:py-28">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <div className="rounded-3xl bg-gradient-to-r from-premium-accent to-premium-accentDeep p-10 text-center text-white sm:p-16">
              <h2 className="text-4xl font-bold sm:text-5xl lg:text-6xl">
                まずは無料相談から
              </h2>
              <p className="mx-auto mt-6 max-w-2xl text-xl opacity-90 lg:text-2xl">
                導入についてのご質問、お見積もりなど、お気軽にご相談ください。
                <br />
                専門スタッフが丁寧にご説明いたします。
              </p>
              <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
                <Button
                  size="lg"
                  variant="secondary"
                  className="bg-white px-10 py-5 text-xl text-premium-accent hover:bg-gray-50"
                  onClick={() => (window.location.href = '/contact')}
                >
                  無料で相談する
                </Button>
                <a
                  href="mailto:heartssh@gmail.com"
                  className="text-lg text-white underline underline-offset-4 opacity-90 transition hover:opacity-100"
                >
                  heartssh@gmail.com
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-premium-stroke py-10">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-premium-accent text-white font-bold text-sm">
                  IR
                </div>
                <span className="font-bold text-premium-text">よやくらく</span>
              </div>
              <nav className="flex flex-wrap items-center justify-center gap-4 text-sm">
                <Link href="/legal/company" className="text-premium-muted hover:text-premium-text transition">
                  会社概要
                </Link>
                <span className="text-premium-stroke">|</span>
                <Link href="/legal/tokushoho" className="text-premium-muted hover:text-premium-text transition">
                  特定商取引法に基づく表記
                </Link>
                <span className="text-premium-stroke">|</span>
                <Link href="/legal/privacy" className="text-premium-muted hover:text-premium-text transition">
                  プライバシーポリシー
                </Link>
                <span className="text-premium-stroke">|</span>
                <Link href="/legal/terms" className="text-premium-muted hover:text-premium-text transition">
                  利用規約
                </Link>
              </nav>
            </div>
            <div className="text-center">
              <p className="text-sm text-premium-muted">
                © {new Date().getFullYear()} よやくらく. All rights reserved.
              </p>
            </div>
          </div>
        </div>
      </footer>
    </Layout>
  );
}
