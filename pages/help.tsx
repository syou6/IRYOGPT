import Layout from '@/components/layout';
import Link from 'next/link';

const FAQS = [
  {
    question: '埋め込みウィジェットが表示されません',
    answer: 'サイトのステータスが「ready」になっているか、`is_embed_enabled` が true になっているかご確認ください。',
  },
  {
    question: 'チャットの応答が遅い',
    answer: 'ダッシュボードの「使用状況」でチャット回数がクォータを超えていないか確認してください。',
  },
  {
    question: '学習ジョブが完了しません',
    answer: '対象URLがブロックされている可能性があります。サポートまでURLをお送りください。',
  },
];

export default function HelpPage() {
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
            <p className="text-xs uppercase tracking-[0.35em] text-emerald-200">Help Center</p>
            <h1 className="mt-2 text-4xl font-semibold text-white">ヘルプセンター</h1>
            <p className="mt-3 text-sm text-slate-300">お困りごとはまずこちらを参照ください。解決しない場合はメールでお知らせください。</p>
          </div>
          <div className="space-y-4">
            {FAQS.map((faq) => (
              <div key={faq.question} className="rounded-[24px] border border-white/10 bg-white/5 p-5">
                <h2 className="text-lg font-semibold text-white">{faq.question}</h2>
                <p className="mt-2 text-sm text-slate-300">{faq.answer}</p>
              </div>
            ))}
            <div className="rounded-[24px] border border-white/10 bg-white/5 p-5 text-sm text-slate-300">
              それでも解決しない場合は <a href="mailto:heartssh@gmail.com" className="text-emerald-200 underline">heartssh@gmail.com</a> までご連絡ください。
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
