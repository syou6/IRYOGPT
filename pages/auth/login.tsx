import { useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/layout';
import Button from '@/components/ui/Button';
import { createSupabaseClient } from '@/utils/supabase-auth';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createSupabaseClient();
  const onboardingSteps = [
    { label: 'アカウント登録', helper: 'URLを登録するだけで準備完了' },
    { label: 'よやくらくが学習', helper: '運営が内容を確認しオペレーション' },
    { label: '埋め込み & 公開', helper: 'コードを貼るだけでチャット稼働' },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isSignUp) {
        // サインアップ
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });

        if (error) throw error;

        if (data.user) {
          alert('確認メールを送信しました。メールを確認してください。');
        }
      } else {
        // ログイン
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        if (data.user) {
          // ダッシュボードにリダイレクト
          router.push('/dashboard');
        }
      }
    } catch (err: any) {
      setError(err.message || 'エラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
        },
      });

      if (error) throw error;
    } catch (err: any) {
      setError(err.message || 'Googleログインに失敗しました');
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="relative flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-8">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-x-[-30%] top-[-20%] h-64 rounded-full bg-emerald-500/20 blur-[140px]" />
          <div className="absolute bottom-[-30%] right-[-10%] h-64 w-64 rounded-full bg-cyan-400/20 blur-[160px]" />
        </div>

        <div className="relative z-10 w-full max-w-lg rounded-[32px] border border-premium-stroke/40 bg-premium-surface/70 p-6 text-premium-text shadow-[0_45px_120px_rgba(1,8,4,0.65)] backdrop-blur-2xl sm:p-8">
          <div className="text-center">
            <p className="text-xs uppercase tracking-[0.4em] text-premium-muted/80">よやくらく Access</p>
            <h1 className="mt-2 text-2xl font-semibold text-premium-text">
              {isSignUp ? '新規登録' : 'ログイン'}
            </h1>
            <p className="mt-1 text-sm text-premium-muted">
              ネオングロウのコントロールルームへ入室
            </p>
          </div>

          {error && (
            <div className="mt-6 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            <div>
              <label className="text-sm font-medium text-premium-muted">メールアドレス</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-2 w-full rounded-2xl border border-premium-stroke/40 bg-premium-elevated/70 px-4 py-3 text-sm text-premium-text placeholder:text-slate-400 shadow-[0_15px_35px_rgba(1,5,3,0.35)] backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/70"
                placeholder="example@email.com"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-premium-muted">パスワード</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-2 w-full rounded-2xl border border-premium-stroke/40 bg-premium-elevated/70 px-4 py-3 text-sm text-premium-text placeholder:text-slate-400 shadow-[0_15px_35px_rgba(1,5,3,0.35)] backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/70"
                placeholder="••••••••"
              />
            </div>

            <Button type="submit" disabled={loading} className="w-full" size="full">
              {loading ? '処理中...' : isSignUp ? '新規登録' : 'ログイン'}
            </Button>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-premium-stroke/40" />
              </div>
              <div className="relative flex justify-center text-xs uppercase tracking-[0.3em] text-slate-400">
                <span className="bg-transparent px-3">または</span>
              </div>
            </div>

            <Button
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading}
              variant="secondary"
              size="full"
              className="mt-5 gap-2"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Googleでログイン
            </Button>
          </div>

          <div className="mt-6 text-center text-sm text-premium-muted">
            <button
              type="button"
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-premium-muted underline-offset-4 transition hover:underline"
            >
              {isSignUp
                ? '既にアカウントをお持ちですか？ログイン'
                : 'アカウントをお持ちでない方は新規登録'}
            </button>
          </div>

          <div className="mt-6 rounded-3xl border border-premium-stroke/40 bg-premium-surface/70 px-5 py-4 text-sm text-premium-muted">
            <p className="text-xs uppercase tracking-[0.35em] text-premium-muted">ご利用の流れ</p>
            <ol className="mt-3 space-y-2 text-xs">
              {onboardingSteps.map((step, idx) => (
                <li key={step.label} className="flex items-start gap-3">
                  <span className="text-premium-accent">{String(idx + 1).padStart(2, '0')}</span>
                  <div>
                    <p className="text-premium-text">{step.label}</p>
                    <p className="text-[11px]">{step.helper}</p>
                  </div>
                </li>
              ))}
            </ol>
            <p className="mt-3 text-xs">
              URL登録 → よやくらくが学習 → 埋め込みコードを貼るだけでチャットが稼働します。
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
}
