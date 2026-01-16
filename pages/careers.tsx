import Layout from '@/components/layout';
import Link from 'next/link';

const POSITIONS = [
  {
    title: 'カスタマーサクセス（リード）',
    status: '募集中',
    summary: 'オンボーディングや運用支援をリードし、お客様の成功を並走で支えます。',
  },
  {
    title: 'フロントエンドエンジニア',
    status: '募集中',
    summary: 'ダッシュボードやLPの体験を改善し、自動化ワークフローを開発します。',
  },
  {
    title: 'AI/データエンジニア',
    status: '募集中',
    summary: 'ナレッジ抽出・学習の仕組みを高度化し、精度改善を推進します。',
  },
];

export default function CareersPage() {
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
            <p className="text-xs uppercase tracking-[0.35em] text-emerald-200">Careers</p>
            <h1 className="mt-2 text-4xl font-semibold text-white">採用情報</h1>
            <p className="mt-3 text-sm text-slate-300">
              よやくらくはサポート業務に寄り添える仲間を募集しています。フルリモート・副業可。
            </p>
          </div>
          <div className="space-y-4">
            {POSITIONS.map((position) => (
              <div key={position.title} className="rounded-[24px] border border-white/10 bg-white/5 p-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-white">{position.title}</h2>
                  <span className="text-xs uppercase tracking-[0.35em] text-emerald-200">{position.status}</span>
                </div>
                <p className="mt-2 text-sm text-slate-300">{position.summary}</p>
                <p className="mt-3 text-xs text-emerald-200">詳細は順次公開予定です。興味がある方は heartssh@gmail.com まで。</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}
