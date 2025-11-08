import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/layout';
import Link from 'next/link';
import { createSupabaseClient } from '@/utils/supabase-auth';

interface User {
  id: string;
  plan: 'starter' | 'pro' | 'enterprise';
  chat_quota: number;
  embedding_quota: number;
}

interface Plan {
  id: 'starter' | 'pro' | 'enterprise';
  name: string;
  description: string;
  price: string;
  chat_quota: number;
  embedding_quota: number;
  features: string[];
  popular?: boolean;
}

const plans: Plan[] = [
  {
    id: 'starter',
    name: 'スターター',
    description: '個人・小規模サイト向け',
    price: '無料',
    chat_quota: 1000,
    embedding_quota: 100000,
    features: [
      '月1,000回のチャット',
      '月100,000トークンの埋め込み',
      '最大3サイト',
      '基本的なサポート',
    ],
  },
  {
    id: 'pro',
    name: 'プロ',
    description: 'ビジネス・中規模サイト向け',
    price: '¥9,800/月',
    chat_quota: 10000,
    embedding_quota: 1000000,
    features: [
      '月10,000回のチャット',
      '月1,000,000トークンの埋め込み',
      '無制限のサイト数',
      '優先サポート',
      'カスタムブランディング',
      'APIアクセス',
    ],
    popular: true,
  },
  {
    id: 'enterprise',
    name: 'エンタープライズ',
    description: '大規模・企業向け',
    price: 'カスタム',
    chat_quota: -1, // 無制限
    embedding_quota: -1, // 無制限
    features: [
      '無制限のチャット',
      '無制限の埋め込み',
      '無制限のサイト数',
      '専任サポート',
      'カスタム統合',
      'SLA保証',
      'オンプレミス対応可能',
    ],
  },
];

export default function PlansPage() {
  const router = useRouter();
  const [authLoading, setAuthLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const supabase = createSupabaseClient();

  // 認証チェック
  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push('/auth/login');
        return;
      }

      setAuthLoading(false);
    };

    checkAuth();
  }, [router, supabase]);

  // ユーザー情報を取得
  useEffect(() => {
    if (authLoading) return;

    const fetchUser = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) return;

      try {
        setLoading(true);

        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (userError || !userData) {
          // ユーザーが存在しない場合は作成
          const { data: newUser } = await supabase
            .from('users')
            .insert({
              id: session.user.id,
              plan: 'starter',
              chat_quota: 1000,
              embedding_quota: 100000,
            })
            .select()
            .single();

          if (newUser) {
            setUser(newUser);
          }
        } else {
          setUser(userData);
        }
      } catch (error) {
        console.error('Error fetching user:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [authLoading, supabase]);

  // プラン変更（実際の実装では決済処理が必要）
  const handleUpgrade = async (planId: 'starter' | 'pro' | 'enterprise') => {
    if (!user || upgrading) return;

    // 現在のプランと同じ場合は何もしない
    if (user.plan === planId) {
      return;
    }

    // ダウングレードの場合は確認
    const currentPlanIndex = plans.findIndex((p) => p.id === user.plan);
    const newPlanIndex = plans.findIndex((p) => p.id === planId);
    if (newPlanIndex < currentPlanIndex && planId !== 'starter') {
      if (
        !confirm(
          'より低いプランに変更しますか？\n現在のプランの機能が制限される可能性があります。'
        )
      ) {
        return;
      }
    }

    try {
      setUpgrading(planId);

      // プランに応じたクォータを設定
      const selectedPlan = plans.find((p) => p.id === planId);
      if (!selectedPlan) return;

      const { error } = await supabase
        .from('users')
        .update({
          plan: planId,
          chat_quota: selectedPlan.chat_quota,
          embedding_quota: selectedPlan.embedding_quota,
        })
        .eq('id', user.id);

      if (error) {
        throw error;
      }

      // ユーザー情報を更新
      setUser({
        ...user,
        plan: planId,
        chat_quota: selectedPlan.chat_quota,
        embedding_quota: selectedPlan.embedding_quota,
      });

      // エンタープライズプランの場合は別途連絡が必要
      if (planId === 'enterprise') {
        alert(
          'エンタープライズプランへの変更リクエストを受け付けました。\n担当者から連絡いたします。'
        );
      } else if (planId === 'pro') {
        // 実際の実装では決済処理が必要
        alert(
          'プロプランへの変更は、決済処理が必要です。\n現在はデモモードのため、プランのみ変更されました。'
        );
      } else {
        alert('プランを変更しました');
      }
    } catch (error) {
      console.error('Error upgrading plan:', error);
      alert('プランの変更に失敗しました');
    } finally {
      setUpgrading(null);
    }
  };

  if (authLoading || loading) {
    return (
      <Layout>
        <div className="flex min-h-screen items-center justify-center">
          <div className="rounded-full border border-white/10 bg-white/5 px-6 py-3 text-xs uppercase tracking-[0.25em] text-slate-200">
            読み込み中...
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="relative mx-auto max-w-6xl px-4 py-6 text-slate-100 sm:py-8">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-emerald-500/20 to-transparent blur-3xl" />
          <div className="absolute bottom-[-20%] left-[-10%] h-72 w-72 rounded-full bg-teal-400/15 blur-[140px]" />
        </div>

        <div className="relative space-y-8">
          {/* ヘッダー */}
          <div className="rounded-[32px] border border-white/10 bg-white/5 p-6 shadow-[0_35px_120px_rgba(1,6,3,0.55)] backdrop-blur-2xl">
            <Link
              href="/dashboard"
              className="text-[11px] uppercase tracking-[0.35em] text-emerald-200/80"
            >
              ← ダッシュボード
            </Link>
            <h1 className="mt-2 text-3xl font-semibold text-white">プラン比較</h1>
            <p className="text-sm text-slate-300">
              あなたのニーズに合ったプランを選択してください
            </p>
          </div>

          {/* 現在のプラン表示 */}
          {user && (
            <div className="rounded-[28px] border border-white/10 bg-gradient-to-r from-emerald-500/10 via-green-400/5 to-cyan-300/10 p-4 text-sm text-emerald-50">
              現在のプラン: <strong>{plans.find((p) => p.id === user.plan)?.name || user.plan}</strong>
            </div>
          )}

          {/* プラン一覧 */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {plans.map((plan) => {
              const isCurrentPlan = user?.plan === plan.id;
              const isUpgrading = upgrading === plan.id;
              return (
                <div
                  key={plan.id}
                  className={`relative overflow-hidden rounded-[32px] border border-white/10 bg-white/5 p-6 shadow-[0_35px_120px_rgba(1,3,6,0.55)] backdrop-blur-2xl ${
                    plan.popular ? 'ring-1 ring-emerald-400/40' : ''
                  }`}
                >
                  <div className="pointer-events-none absolute inset-0 opacity-50">
                    {plan.popular && (
                      <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-emerald-500/30 blur-[90px]" />
                    )}
                  </div>
                  <div className="relative">
                    {plan.popular && (
                      <span className="inline-flex items-center rounded-full bg-emerald-400/20 px-3 py-1 text-xs font-semibold text-emerald-100">
                        人気
                      </span>
                    )}
                    {isCurrentPlan && (
                      <span className="ml-2 inline-flex items-center rounded-full border border-emerald-400/40 px-3 py-1 text-xs font-semibold text-emerald-100">
                        現在のプラン
                      </span>
                    )}

                    <div className="mt-4">
                      <h2 className="text-2xl font-semibold text-white">{plan.name}</h2>
                      <p className="mt-1 text-sm text-slate-300">{plan.description}</p>
                    </div>

                    <div className="mt-6">
                      <div className="text-3xl font-semibold text-white">{plan.price}</div>
                      {plan.price !== '無料' && plan.price !== 'カスタム' && (
                        <div className="text-xs uppercase tracking-[0.3em] text-slate-400">税込</div>
                      )}
                    </div>

                    <div className="mt-6 space-y-3">
                      {[{
                        label:
                          plan.chat_quota === -1
                            ? '無制限のチャット'
                            : `月${plan.chat_quota.toLocaleString()}回のチャット`,
                      }, {
                        label:
                          plan.embedding_quota === -1
                            ? '無制限の埋め込み'
                            : `月${plan.embedding_quota.toLocaleString()}トークンの埋め込み`,
                      }, ...plan.features.map((label) => ({ label }))].map((item, index) => (
                        <div key={index} className="flex items-start text-sm text-slate-200">
                          <svg
                            className="mr-2 h-5 w-5 flex-shrink-0 text-emerald-300"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span>{item.label}</span>
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={() => handleUpgrade(plan.id)}
                      disabled={isCurrentPlan || isUpgrading}
                      className={`mt-6 w-full rounded-full px-4 py-2.5 text-sm font-semibold transition ${
                        isCurrentPlan
                          ? 'cursor-not-allowed border border-white/10 bg-white/5 text-slate-400'
                          : 'bg-gradient-to-r from-emerald-400 via-green-300 to-cyan-300 text-slate-900 shadow-[0_20px_45px_rgba(16,185,129,0.35)] hover:-translate-y-0.5'
                      }`}
                    >
                      {isCurrentPlan
                        ? '現在のプラン'
                        : isUpgrading
                        ? '処理中...'
                        : plan.id === 'enterprise'
                        ? 'お問い合わせ'
                        : 'このプランに変更'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 注意事項 */}
          <div className="rounded-[28px] border border-amber-300/30 bg-amber-500/10 p-4 text-sm text-amber-50">
            <h3 className="mb-2 font-semibold">⚠️ 注意事項</h3>
            <ul className="list-disc space-y-1 pl-5 text-amber-100">
              <li>プラン変更は即座に反映されますが、決済処理が必要な場合は別途お手続きが必要です。</li>
              <li>エンタープライズプランへの変更は、担当者からの連絡が必要です。</li>
              <li>プランをダウングレードした場合、現在の使用量が新しいクォータを超えている場合は制限が適用されます。</li>
            </ul>
          </div>
        </div>
      </div>
    </Layout>
  );
}
