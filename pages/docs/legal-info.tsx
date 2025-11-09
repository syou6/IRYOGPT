import Layout from '@/components/layout';
import Link from 'next/link';

export default function LegalInfoPage() {
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
            <p className="text-xs uppercase tracking-[0.35em] text-emerald-200">Compliance</p>
            <h1 className="mt-2 text-4xl font-semibold text-white">法的情報一覧</h1>
            <p className="mt-3 text-sm text-slate-300">プライバシー、利用規約、セキュリティに関する情報をまとめています。</p>
          </div>
          <div className="grid gap-4 md:grid-cols-3 text-sm text-slate-300">
            <Link href="/legal" className="rounded-[24px] border border-white/10 bg-white/5 p-4 transition hover:border-emerald-300">
              特定商取引法に基づく表記
            </Link>
            <Link href="/privacy" className="rounded-[24px] border border-white/10 bg-white/5 p-4 transition hover-border-emerald-300">
              プライバシーポリシー
            </Link>
            <Link href="/terms" className="rounded-[24px] border border-white/10 bg-white/5 p-4 transition hover:border-emerald-300">
              利用規約
            </Link>
            <Link href="/security" className="rounded-[24px] border border-white/10 bg-white/5 p-4 transition hover:border-emerald-300">
              セキュリティについて
            </Link>
          </div>
        </div>
      </div>
    </Layout>
  );
}
