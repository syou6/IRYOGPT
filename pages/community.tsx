import Layout from '@/components/layout';
import Link from 'next/link';

export default function CommunityPage() {
  return (
    <Layout>
      <div className="relative mx-auto max-w-4xl px-6 py-12 text-slate-100">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-emerald-500/15 to-transparent blur-3xl" />
        </div>
        <div className="relative space-y-6">
          <Link href="/" className="inline-flex text-xs uppercase tracking-[0.35em] text-emerald-200/80">
            ← ホームに戻る
          </Link>
          <div className="rounded-[32px] border border-white/10 bg-white/5 p-6">
            <p className="text-xs uppercase tracking-[0.35em] text-emerald-200">Community</p>
            <h1 className="mt-2 text-4xl font-semibold text-white">コミュニティ</h1>
            <p className="mt-3 text-sm text-slate-300">
              よやくらくの活用アイデアや運用ノウハウを共有するコミュニティを準備中です。公開までお待ちください。
            </p>
          </div>
          <div className="rounded-[24px] border border-white/10 bg-white/5 p-5 text-sm text-slate-300">
            最新情報はブログやサポートメールでご案内予定です。先行参加に興味がある方は <a href="mailto:heartssh@gmail.com" className="text-emerald-200 underline">heartssh@gmail.com</a> までご連絡ください。
          </div>
        </div>
      </div>
    </Layout>
  );
}
