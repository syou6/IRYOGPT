import Layout from '@/components/layout';
import Link from 'next/link';

export default function AboutPage() {
  return (
    <Layout>
      <div className="relative mx-auto max-w-5xl px-6 py-12 text-slate-100">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-emerald-500/15 to-transparent blur-3xl" />
          <div className="absolute bottom-[-20%] right-[-10%] h-64 w-64 rounded-full bg-cyan-400/15 blur-[140px]" />
        </div>
        <div className="relative space-y-6">
          <Link href="/" className="inline-flex text-xs uppercase tracking-[0.35em] text-emerald-200/80">
            ← ホームに戻る
          </Link>
          <div className="rounded-[32px] border border-white/10 bg-white/5 p-6">
            <p className="text-xs uppercase tracking-[0.35em] text-emerald-200">About</p>
            <h1 className="mt-2 text-4xl font-semibold text-white">よやくらくについて</h1>
            <p className="mt-3 text-sm text-slate-300">
              よやくらく は、医療・美容業界の予約対応を自動化するために生まれた AI チャットボットプラットフォームです。
              サポート現場の声をもとに、ブランドトーンを保ちながら 24/365 で応対できる体制づくりを支援しています。
            </p>
          </div>
          <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 space-y-4 text-sm text-slate-300">
            <p>
              私たちのミッションは、「夜間も休日も、誰かがそばにいるオンライン体験」を提供することです。単なるAI導入ではなく、
              運用設計から改善サイクルまで伴走し、顧客との会話を資産化できる仕組みを目指しています。
            </p>
            <p>
              チームは東京を拠点に、サポート設計・データエンジニアリング・デザインの専門家で構成されています。
              今後も継続的にプロダクトとナレッジをアップデートし、「かゆいところに手が届く」AIサポートを追求し続けます。
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
}
