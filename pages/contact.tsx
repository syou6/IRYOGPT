import { useState } from 'react';
import Link from 'next/link';
import Layout from '@/components/layout';

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', message: '' });
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('sending');
    try {
      await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      setStatus('sent');
      setForm({ name: '', email: '', message: '' });
    } catch {
      setStatus('error');
    }
  };

  return (
    <Layout>
      <div className="relative mx-auto max-w-4xl px-6 py-16 lg:py-24 text-premium-text">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-emerald-500/15 to-transparent blur-3xl" />
        </div>
        <div className="relative space-y-8">
          <Link href="/" className="inline-flex items-center gap-2 text-lg text-premium-muted hover:text-premium-accent transition">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            トップページに戻る
          </Link>
          <div className="rounded-[32px] border border-premium-stroke bg-white p-8 lg:p-12 shadow-sm">
            <p className="text-base uppercase tracking-[0.35em] text-premium-accent font-semibold">Contact</p>
            <h1 className="mt-4 text-4xl lg:text-5xl font-bold text-premium-text">お問い合わせ</h1>
            <p className="mt-4 text-lg lg:text-xl text-premium-muted leading-relaxed">製品に関するご相談や導入のご質問はこちらからお送りください。通常1営業日以内に返信いたします。</p>
          </div>
          <form onSubmit={handleSubmit} className="rounded-[28px] border border-premium-stroke bg-white p-8 lg:p-12 space-y-6 shadow-sm">
            <div>
              <label className="text-lg font-bold text-premium-text">お名前</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="mt-3 w-full rounded-2xl border border-premium-stroke bg-premium-surface px-5 py-4 text-lg text-premium-text placeholder:text-premium-muted focus:outline-none focus:ring-2 focus:ring-premium-accent"
              />
            </div>
            <div>
              <label className="text-lg font-bold text-premium-text">メールアドレス</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="mt-3 w-full rounded-2xl border border-premium-stroke bg-premium-surface px-5 py-4 text-lg text-premium-text placeholder:text-premium-muted focus:outline-none focus:ring-2 focus:ring-premium-accent"
              />
            </div>
            <div>
              <label className="text-lg font-bold text-premium-text">お問い合わせ内容</label>
              <textarea
                required
                rows={6}
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                className="mt-3 w-full rounded-2xl border border-premium-stroke bg-premium-surface px-5 py-4 text-lg text-premium-text placeholder:text-premium-muted focus:outline-none focus:ring-2 focus:ring-premium-accent"
              />
            </div>
            <button
              type="submit"
              disabled={status === 'sending'}
              className="w-full rounded-full bg-gradient-to-r from-emerald-400 via-green-300 to-cyan-300 px-8 py-5 text-xl font-bold text-slate-900 shadow-[0_20px_45px_rgba(16,185,129,0.35)] disabled:cursor-not-allowed disabled:opacity-60 hover:shadow-lg transition-shadow"
            >
              {status === 'sending' ? '送信中...' : '送信する'}
            </button>
            {status === 'sent' && <p className="text-lg text-premium-accent font-bold">送信しました。ありがとうございます。</p>}
            {status === 'error' && <p className="text-lg text-rose-600 font-bold">送信に失敗しました。メールでお知らせください。</p>}
          </form>
        </div>
      </div>
    </Layout>
  );
}
