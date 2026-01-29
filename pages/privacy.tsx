import Layout from '@/components/layout';
import Link from 'next/link';

export default function PrivacyPage() {
  const sections = [
    {
      title: '1. 取得する情報',
      content: 'メールアドレス、氏名、アクセスログ、チャット統計など、サービス提供に必要な範囲で取得します。',
    },
    {
      title: '2. 利用目的',
      content: 'サービス提供、サポート対応、改善・分析、不正防止、各種案内に利用します。',
    },
    {
      title: '3. 第三者提供',
      content: 'Stripe等の決済代行会社や分析ツールなど、必要な範囲で提供する場合があります。',
    },
    {
      title: '4. 安全管理',
      content: '漏洩防止のため適切な管理を行い、不要になったデータは削除します。',
    },
    {
      title: '5. お問い合わせ',
      content: '個人情報の開示・訂正・削除をご希望の場合は info@amorjp.com までご連絡ください。',
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
            <p className="text-xs uppercase tracking-[0.35em] text-emerald-200">Privacy Policy</p>
            <h1 className="mt-2 text-4xl font-semibold text-white">プライバシーポリシー</h1>
            <p className="mt-3 text-sm text-slate-300">個人情報の取り扱いについての基本方針です。</p>
          </div>
          <div className="space-y-4 text-sm text-slate-300">
            {sections.map((section) => (
              <div key={section.title} className="rounded-[24px] border border-white/10 bg-white/5 p-5">
                <h2 className="text-lg font-semibold text-white">{section.title}</h2>
                <p className="mt-2">{section.content}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}
