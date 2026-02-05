import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/layout';
import { createSupabaseClient } from '@/utils/supabase-auth';

// 許可されたメールアドレスのリスト（環境変数から取得）
const ALLOWED_EMAILS = (process.env.NEXT_PUBLIC_ALLOWED_EMAILS || '')
  .split(',')
  .map(email => email.trim().toLowerCase())
  .filter(Boolean);

export default function AuthCallback() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push('/auth/login');
        return;
      }

      const userEmail = user.email?.toLowerCase() || '';

      // 許可リストが設定されていて、ユーザーが含まれていない場合
      if (ALLOWED_EMAILS.length > 0 && !ALLOWED_EMAILS.includes(userEmail)) {
        await supabase.auth.signOut();
        setError('このアカウントではログインできません。');
        return;
      }

      // 許可されていればダッシュボードへ
      router.push('/dashboard');
    };

    checkAuth();
  }, [router]);

  if (error) {
    return (
      <Layout>
        <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4">
          <div className="w-full max-w-md rounded-2xl border border-rose-400/30 bg-rose-500/10 p-6 text-center">
            <p className="text-lg font-semibold text-rose-100">{error}</p>
            <button
              onClick={() => router.push('/auth/login')}
              className="mt-4 text-sm text-premium-muted underline hover:text-premium-text"
            >
              ログインページに戻る
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <p className="text-premium-muted">認証中...</p>
      </div>
    </Layout>
  );
}
