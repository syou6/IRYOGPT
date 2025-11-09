import Layout from '@/components/layout';
import Link from 'next/link';

export default function PressPage() {
  const items = [
    {
      title: 'プレスリリース（準備中）',
      summary: '新プランや機能追加のお知らせをこちらで公開予定です。',
    },
    {
      title: 'メディア掲載情報（準備中）',
      summary: '各種メディアで取り上げられた記事やインタビューを順次掲載します。',
    },
    {
      title: 'プレスキット（準備中）',
      summary: 'ブランドロゴやスクリーンショットなどの素材は現在整備中です。',
    },
  ];

  return (
    <Layout>
      <div className="relative mx-auto max-w-5xl px-6 py-12 text-slate-100">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-emerald-500/15 to-transparent blur-3xl" />
        </div>
        <div className="relative space-y-6">
          <Link href="/" className="inline-flex text-xs uppercase tracking-[0.35em] text-emerald-200/80">
            ← ホームに戻る
          </Link>
          <div className="rounded-[32px] border border-white/10 bg-white/5 p-6">
            <p className="text-xs uppercase tracking-[0.35em] text-emerald-200">Press</p>
            <h1 className="mt-2 text-4xl font-semibold text-white">プレス情報</h1>
            <p className="mt-3 text-sm text-slate-300">メディア掲載・プレスリリース・各種素材はこちらからご確認ください。</p>
          </div>
          <div className="space-y-4">
            {items.map((item) => (
              <div key={item.title} className="rounded-[24px] border border白/10 bg白/5 p-5">
                <h2 className="text-lg font-semibold text-white">{item.title}</h2>
                <p className="mt-2 text-sm text-slate-300">{item.summary}</p>
                <p className="mt-3 text-xs text-emerald-200">Coming soon...／お問い合わせは heartssh@gmail.com まで。</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}
