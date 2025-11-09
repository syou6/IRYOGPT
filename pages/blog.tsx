import Layout from '@/components/layout';
import Link from 'next/link';

export default function BlogPage() {
  const posts = [
    {
      title: '夜間サポートを自動化するためのAI導入ガイド',
      summary: '深夜帯の一次対応をAIに任せるための準備と実践ステップを解説。',
    },
    {
      title: 'ブランドトーンを崩さないチャットボット運用',
      summary: 'トーン&マナー設定と再学習のコツを紹介します。',
    },
    {
      title: '導入事例：B2B SaaSでの問い合わせ削減',
      summary: '実際の導入企業での効果や運用ノウハウをまとめました。',
    },
  ];

  return (
    <Layout>
      <div className="relative mx-auto max-w-6xl px-6 py-12 text-slate-100">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-emerald-500/15 to-transparent blur-3xl" />
        </div>
        <div className="relative space-y-6">
          <Link href="/" className="inline-flex text-xs uppercase tracking-[0.35em] text-emerald-200/80">
            ← ホームに戻る
          </Link>
          <div className="rounded-[32px] border border-white/10 bg-white/5 p-6">
            <p className="text-xs uppercase tracking-[0.35em] text-emerald-200">Blog</p>
            <h1 className="mt-2 text-4xl font-semibold text-white">お知らせ / ナレッジ</h1>
            <p className="mt-3 text-sm text-slate-300">最新の記事やノウハウをこちらで公開しています。</p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {posts.map((post) => (
              <div key={post.title} className="rounded-[24px] border border-white/10 bg-white/5 p-5">
                <h2 className="text-lg font-semibold text-white">{post.title}</h2>
                <p className="mt-2 text-sm text-slate-300">{post.summary}</p>
                <p className="mt-4 text-xs text-emerald-200">Coming soon...</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}
