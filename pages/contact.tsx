import { useState } from 'react';
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
      <div className="relative mx-auto max-w-3xl px-6 py-12 text-slate-100">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-emerald-500/15 to-transparent blur-3xl" />
        </div>
        <div className="relative space-y-6">
          <div className="rounded-[32px] border border-white/10 bg-white/5 p-6">
            <p className="text-xs uppercase tracking-[0.35em] text-emerald-200">Contact</p>
            <h1 className="mt-2 text-4xl font-semibold text-white">お問い合わせ</h1>
            <p className="mt-3 text-sm text-slate-300">製品に関するご相談や導入のご質問はこちらからお送りください。通常1営業日以内に返信いたします。</p>
          </div>
          <form onSubmit={handleSubmit} className="rounded-[28px] border border-white/10 bg-white/5 p-6 space-y-4">
            <div>
              <label className="text-sm text-slate-300">お名前</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
            </div>
            <div>
              <label className="text-sm text-slate-300">メールアドレス</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
            </div>
            <div>
              <label className="text-sm text-slate-300">お問い合わせ内容</label>
              <textarea
                required
                rows={5}
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
            </div>
            <button
              type="submit"
              disabled={status === 'sending'}
              className="w-full rounded-full bg-gradient-to-r from-emerald-400 via-green-300 to-cyan-300 px-6 py-3 text-sm font-semibold text-slate-900 shadow-[0_20px_45px_rgba(16,185,129,0.35)] disabled:cursor-not-allowed"
            >
              {status === 'sending' ? '送信中...' : '送信する'}
            </button>
            {status === 'sent' && <p className="text-sm text-emerald-200">送信しました。ありがとうございます。</p>}
            {status === 'error' && <p className="text-sm text-rose-300">送信に失敗しました。メールでお知らせください。</p>}
          </form>
        </div>
      </div>
    </Layout>
  );
}
