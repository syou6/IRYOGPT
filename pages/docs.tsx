import Layout from '@/components/layout';
import Link from 'next/link';

const SECTIONS = [
  {
    title: 'はじめに',
    items: ['アカウント作成', 'サイト登録の流れ', '埋め込み手順'],
  },
  {
    title: '機能ガイド',
    items: ['ダッシュボードの見方', '使用状況レポート', '学習ジョブ管理'],
  },
  {
    title: 'API / 連携',
    items: ['REST API エンドポイント', 'Webhook イベント', '外部ツールとの接続'],
  },
];

export default function DocsPage() {
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
            <p className="text-xs uppercase tracking-[0.35em] text-emerald-200">Documentation</p>
            <h1 className="mt-2 text-4xl font-semibold text-white">ドキュメント</h1>
            <p className="mt-3 text-sm text-slate-300">セットアップからAPI連携まで、順次こちらで公開予定です。</p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {SECTIONS.map((section) => (
              <div key={section.title} className="rounded-[24px] border border-white/10 bg-white/5 p-5">
                <h2 className="text-lg font-semibold text-white">{section.title}</h2>
                <ul className="mt-3 space-y-2 text-sm text-slate-300">
                  {section.items.map((item) => (
                    <li key={item}>{item}（準備中）</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}
