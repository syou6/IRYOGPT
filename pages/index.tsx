import Link from 'next/link';
import Layout from '@/components/layout';
import { PLAN_CONFIG, planOrder } from '@/lib/planConfig';

const HERO_BADGES = ['初期設定代行', '24/365応答', 'SSL / RLS 保護'];

const VALUE_POINTS = [
  '「また返信が遅れてしまった…」そんな罪悪感から卒業できます。',
  '同じ質問ばかりに追われる時間を、創る・考える・伝える時間へ。',
  'AIが冷たく答えるのではなく、あなたの声色で代わりに話します。',
];

const STEPS = [
  { label: '① URLを登録', description: 'WEBGPTに対象サイトを登録するだけ。', example: 'https://example.com' },
  { label: '② AIが学習', description: 'スタッフ付きでページを分割・要約し、RAG構成を調整。', example: 'サービス紹介 / FAQ / ブログなど' },
  { label: '③ チャットを埋め込む', description: '発行されたタグを1行貼れば右下にAIが登場。', example: '<script src="...\"></script>' },
];

const CAPABILITIES = [
  { icon: '🔍', title: '自動理解RAG学習', description: 'サイトの“言葉”を正確に読み取り、根拠のある回答だけを返します。' },
  { icon: '💬', title: 'GPT-4o-mini日本語対応', description: '敬語もニュアンスも自然。夜間でも温かみを保った応対。' },
  { icon: '🧩', title: 'どのサイトでも埋め込みOK', description: 'WordPress / Shopify / Wix など全CMSに対応。' },
  { icon: '📊', title: '質問ログ分析', description: '訪問者が“何を知りたいか”を見える化し、施策に活かせます。' },
  { icon: '🛡️', title: 'データ保護', description: 'OpenAI / Supabase / Stripe の安全基準を遵守。' },
];

const INDUSTRY_USE = [
  { label: '🎓 教育・スクール', effect: '生徒・保護者からの質問をAIが回答' },
  { label: '🏠 不動産・工務店', effect: '見学予約・物件案内を自動化' },
  { label: '💇‍♀️ サロン・美容', effect: '営業時間・予約方法を即時回答' },
  { label: '🏢 中小企業サイト', effect: '採用・アクセス・製品情報をAIが説明' },
  { label: '🛍 EC・ブランド', effect: '商品説明から購入導線までAIが案内' },
];

const PRICING_ROWS = [
  { icon: '🟢', plan: 'Starter', price: '¥980', detail: 'サイト1件・AI学習代行・100質問まで' },
  { icon: '🔵', plan: 'Pro', price: '¥2,980', detail: 'サイト3件・自動学習・500質問まで' },
  { icon: '🟣', plan: 'Business', price: '¥9,800', detail: '無制限・ホワイトラベル・API連携' },
];

export default function Home() {
  return (
    <Layout>
      <div className="relative overflow-hidden bg-gradient-to-b from-[#01090f] via-[#030a12] to-[#00040a] text-slate-100">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-32 right-0 h-72 w-72 rounded-full bg-emerald-500/20 blur-3xl" />
          <div className="absolute left-10 top-1/2 h-64 w-64 rounded-full bg-cyan-400/20 blur-[160px]" />
        </div>

        <main className="relative mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl flex-col gap-14 px-6 py-16 sm:py-20">
          <section className="grid gap-10 lg:grid-cols-[3fr_2fr] lg:items-center">
            <div>
              <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.35em] text-emerald-200">7-day Trial</span>
              <h1 className="mt-4 text-5xl font-semibold leading-tight text-white sm:text-6xl lg:text-7xl">
                あなたのサイトが、人の心で話す。
              </h1>
              <p className="mt-4 text-xl text-slate-300 sm:text-2xl lg:text-3xl">
                忙しくても、夜でも、誰かが見てくれている。WEBGPTはあなたの言葉を学び、訪問者の“わからない”を、やさしく“わかる”に変えます。
              </p>
              <p className="mt-3 text-base text-slate-300 sm:text-lg">
                URLを登録するだけ。3分で、あなたのサイトが「話す力」を手に入れます。
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href="/auth/login" className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-emerald-400 via-green-300 to-cyan-300 px-6 py-3 text-xl font-semibold text-slate-900 shadow-[0_25px_45px_rgba(16,185,129,0.35)] transition hover:-translate-y-0.5">
                  無料で試してみる
                </Link>
                <a href="#workflow" className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-6 py-3 text-xl font-medium text-slate-100 transition hover:bg-white/10">
                  導入ステップを見る →
                </a>
              </div>
              <div className="mt-8 grid gap-3 text-xs uppercase tracking-[0.3em] text-slate-300 sm:grid-cols-3">
                {HERO_BADGES.map((pill) => (
                  <div key={pill} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-center">
                    {pill}
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-[30px] border border-white/10 bg-gradient-to-b from-[#07151f] via-[#060c15] to-[#04060a] p-6 shadow-[0_40px_120px_rgba(1,5,3,0.75)]">
              <p className="text-sm uppercase tracking-[0.3em] text-emerald-200">ユーザーの声</p>
              <p className="mt-3 text-2xl font-semibold text-white">「URLを渡した翌週にはテストまで完了。夜中の問い合わせ対応がゼロになりました。」</p>
              <p className="mt-4 text-sm text-slate-400">― SaaS運営 / カスタマーサクセス担当</p>
            </div>
          </section>

          <section className="rounded-[32px] border border-white/10 bg-white/5 p-6">
            <h2 className="text-5xl font-semibold text-white">時間を取り戻す、という価値</h2>
            <div className="mt-4 space-y-3 text-base text-slate-200">
              {VALUE_POINTS.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
            <p className="mt-6 text-base text-emerald-200">働き方を、もっと人間らしく。これが私たちのAIで目指す未来です。</p>
          </section>

          <section id="workflow" className="rounded-[32px] border border-white/10 bg-white/5 p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-emerald-200">Flow</p>
                <h2 className="mt-2 text-4xl font-semibold text-white">導入は 3 ステップ</h2>
              </div>
              <p className="text-sm text-slate-400">コード不要。誰でもAIを味方にできます。</p>
            </div>
            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[720px] border-separate border-spacing-0 text-sm text-slate-200">
                <thead>
                  <tr className="bg-white/10 text-left text-xs uppercase tracking-[0.2em]">
                    <th className="rounded-tl-2xl px-4 py-3">ステップ</th>
                    <th className="px-4 py-3">内容</th>
                    <th className="rounded-tr-2xl px-4 py-3">例</th>
                  </tr>
                </thead>
                <tbody>
                  {STEPS.map((step, idx) => (
                    <tr key={step.label} className={idx % 2 === 0 ? 'bg-white/5' : ''}>
                      <td className="px-4 py-3 font-semibold text-white">{step.label}</td>
                      <td className="px-4 py-3">{step.description}</td>
                      <td className="px-4 py-3 text-slate-400">{step.example}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section className="grid gap-6 md:grid-cols-3">
            {CAPABILITIES.map((feature) => (
              <div key={feature.title} className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
                <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-emerald-400/40 bg-emerald-500/10 text-emerald-200 text-xl">
                  {feature.icon}
                </div>
                <h3 className="text-2xl font-semibold text-white">{feature.title}</h3>
                <p className="mt-2 text-base text-slate-300">{feature.description}</p>
              </div>
            ))}
          </section>

          <section className="rounded-[32px] border border-white/10 bg-white/5 p-6">
            <h2 className="text-4xl font-semibold text-white">こんな方に選ばれています</h2>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {INDUSTRY_USE.map((item) => (
                <div key={item.label} className="rounded-2xl border border-white/10 bg-slate-950/30 p-4 text-base text-slate-200">
                  <p className="text-lg font-semibold text-white">{item.label}</p>
                  <p className="mt-1 text-slate-300">{item.effect}</p>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs text-slate-400">「夜中でも問い合わせが来て安心」「スタッフがひとり増えたみたい」──導入企業の声より</p>
          </section>

          <section className="rounded-[32px] border border-white/10 bg-white/5 p-6">
            <p className="text-xs uppercase tracking-[0.35em] text-emerald-200">Pricing</p>
            <h2 className="mt-2 text-4xl font-semibold text-white">どのプランも、始めやすく。</h2>
            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[640px] border-separate border-spacing-0 text-sm text-slate-200">
                <thead>
                  <tr className="bg-white/10 text-left">
                    <th className="rounded-tl-2xl px-4 py-3">プラン</th>
                    <th className="px-4 py-3">月額（税込）</th>
                    <th className="rounded-tr-2xl px-4 py-3">主な内容</th>
                  </tr>
                </thead>
                <tbody>
                  {PRICING_ROWS.map((row, idx) => (
                    <tr key={row.plan} className={idx % 2 === 0 ? 'bg-white/5' : ''}>
                      <td className="px-4 py-3 font-semibold text-white">{row.icon} {row.plan}</td>
                      <td className="px-4 py-3">{row.price}</td>
                      <td className="px-4 py-3 text-slate-300">{row.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-xs text-slate-400">まずは無料で試して、あなたのサイトが“話す”瞬間を体験してください。</p>
            <div className="mt-6 text-center">
              <Link href="/auth/login" className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-emerald-400 via-green-300 to-cyan-300 px-8 py-3 text-xl font-semibold text-slate-900 shadow-[0_25px_45px_rgba(16,185,129,0.35)]">
                今すぐ無料登録する
              </Link>
            </div>
          </section>

          <section className="rounded-[32px] border border-white/10 bg-white/5 p-6 text-slate-200">
            <h2 className="text-4xl font-semibold text-white">WEBGPT の哲学</h2>
            <p className="mt-4 text-base">
              AIは、人を置き換えるためのものではありません。人が“伝えたい気持ち”を、もっと遠くまで届けるための道具。あなたのビジネス、あなたの物語、そのすべてを理解し、言葉に変えるAIでありたい──それがWEBGPTの使命です。
            </p>
          </section>

          <section className="rounded-[32px] border border-white/10 bg-white/5 p-6 text-sm text-slate-200">
            <h2 className="text-4xl font-semibold text-white">安心・誠実な運営体制</h2>
            <ul className="mt-4 list-disc space-y-2 pl-5">
              <li>Tech Samurai合同会社（東京都新宿区）による国内運営</li>
              <li>OpenAI / Supabase / Stripe の安全基準に準拠</li>
              <li>すべての通信をSSL/TLSで暗号化</li>
              <li>特定商取引法・利用規約・プライバシーポリシーを完備</li>
            </ul>
            <p className="mt-4 text-xs text-slate-400">透明性を守ることが信頼を生む──私たちはAIの力を、人の信頼で支えます。</p>
          </section>

          <section className="rounded-[32px] border border-white/10 bg-gradient-to-r from-emerald-500/20 via-green-400/10 to-cyan-400/20 p-6 text-center shadow-[0_35px_120px_rgba(1,6,3,0.55)]">
            <h2 className="text-4xl font-semibold text-white">あなたのサイトを、AIで動かす。</h2>
            <p className="mt-3 text-base text-slate-100">
              「忙しい日々の中で、本当はもっとお客様と向き合いたい。」その想い、AIが受け取りました。
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Link href="/auth/login" className="rounded-full bg-white px-6 py-3 text-xl font-semibold text-slate-900 shadow-[0_20px_45px_rgba(255,255,255,0.25)]">
                あなたのサイトをAIで動かす →
              </Link>
              <a href="mailto:heartssh@gmail.com" className="rounded-full border border-white/30 px-6 py-3 text-xl font-semibold text-white">
                担当者と相談する
              </a>
            </div>
          </section>

          <footer className="rounded-[32px] border border-white/10 bg-white/5 px-6 py-4 text-xs text-slate-300">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p>© 2025 WEBGPT.jp</p>
              <nav className="flex flex-wrap gap-4">
                <Link href="/legal" className="transition hover:text-white">
                  特定商取引法に基づく表記
                </Link>
              </nav>
            </div>
          </footer>
        </main>
      </div>
    </Layout>
  );
}
