import Layout from '@/components/layout';
import Link from 'next/link';

const ITEMS = [
  {
    title: '第1条（適用）',
    body: '本規約は、よやくらくの提供するサービスの利用条件を定めるものです。登録ユーザーは本規約に同意した上でサービスを利用します。',
  },
  {
    title: '第2条（禁止事項）',
    body: '法令や公序良俗に反する行為、第三者の権利を侵害する行為、その他運営が不適切と判断する行為は禁止します。',
  },
  {
    title: '第3条（サービスの停止）',
    body: '保守・災害その他やむを得ない場合、事前の予告なくサービスを一時停止することがあります。',
  },
  {
    title: '第4条（免責）',
    body: '提供情報の正確性や有用性は保証されず、利用により生じた損害について当社は責任を負いません。',
  },
  {
    title: '第5条（規約の変更）',
    body: '本規約は随時変更する場合があります。重要な変更がある場合は、サイト上で周知いたします。',
  },
];

export default function TermsPage() {
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
            <p className="text-xs uppercase tracking-[0.35em] text-emerald-200">Terms of Service</p>
            <h1 className="mt-2 text-4xl font-semibold text-white">利用規約</h1>
            <p className="mt-3 text-sm text-slate-300">サービスご利用前に必ずご確認ください。</p>
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
