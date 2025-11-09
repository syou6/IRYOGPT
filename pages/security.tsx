import Layout from '@/components/layout';
import Link from 'next/link';

const ITEMS = [
  {
    title: '通信とデータの暗号化',
    body: '管理画面・API・埋め込みウィジェットすべてTLSで暗号化し、保存時も暗号化を行っています。',
  },
  {
    title: 'アクセス制御',
    body: '管理機能はロールベースで制御し、必要最小限の権限のみを付与。監査ログも保管します。',
  },
  {
    title: 'データ保護',
    body: '学習データは専用ストレージで保管し、ユーザーごとに分離して管理します。',
  },
  {
    title: '外部サービス',
    body: 'OpenAI / Supabase / Stripe など信頼性の高いサービスを利用し、契約に基づいて情報を取り扱っています。',
  },
];

export default function SecurityPage() {
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
            <p className="text-xs uppercase tracking-[0.35em] text-emerald-200">Security</p>
            <h1 className="mt-2 text-4xl font-semibold text-white">セキュリティ</h1>
            <p className="mt-3 text-sm text-slate-300">安心してお使いいただくための取り組みをご紹介します。</p>
          </div>
          <div className="space-y-4 text-sm text-slate-300">
            {ITEMS.map((item) => (
              <div key={item.title} className="rounded-[24px] border border-white/10 bg-white/5 p-5">
                <h2 className="text-lg font-semibold text-white">{item.title}</h2>
                <p className="mt-2">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}
