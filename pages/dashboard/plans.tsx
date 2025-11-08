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
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-gray-500">読み込み中...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* ヘッダー */}
        <div className="mb-8">
          <Link
            href="/dashboard"
            className="text-blue-600 hover:text-blue-800 text-sm mb-2 inline-block"
          >
            ← ダッシュボードに戻る
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">プラン比較</h1>
          <p className="text-gray-600 mt-2">
            あなたのニーズに合ったプランを選択してください
          </p>
        </div>

        {/* 現在のプラン表示 */}
        {user && (
          <div className="mb-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              現在のプラン:{' '}
              <strong>
                {plans.find((p) => p.id === user.plan)?.name || user.plan}
              </strong>
            </p>
          </div>
        )}

        {/* プラン一覧 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan) => {
            const isCurrentPlan = user?.plan === plan.id;
            const isUpgrading = upgrading === plan.id;

            return (
              <div
                key={plan.id}
                className={`relative bg-white border-2 rounded-lg p-6 ${
                  plan.popular
                    ? 'border-blue-500 shadow-lg'
                    : 'border-gray-200'
                }`}
              >
                {plan.popular && (
                  <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                    <span className="bg-blue-500 text-white text-xs font-semibold px-3 py-1 rounded-full">
                      人気
                    </span>
                  </div>
                )}

                {isCurrentPlan && (
                  <div className="absolute top-4 right-4">
                    <span className="bg-green-500 text-white text-xs font-semibold px-2 py-1 rounded">
                      現在のプラン
                    </span>
                  </div>
                )}

                <div className="mb-4">
                  <h2 className="text-2xl font-bold text-gray-900">
                    {plan.name}
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">
                    {plan.description}
                  </p>
                </div>

                <div className="mb-6">
                  <div className="text-3xl font-bold text-gray-900">
                    {plan.price}
                  </div>
                  {plan.price !== '無料' && plan.price !== 'カスタム' && (
                    <div className="text-sm text-gray-500">税込</div>
                  )}
                </div>

                <div className="mb-6 space-y-3">
                  <div className="flex items-start">
                    <svg
                      className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <span className="text-sm text-gray-700">
                      {plan.chat_quota === -1
                        ? '無制限のチャット'
                        : `月${plan.chat_quota.toLocaleString()}回のチャット`}
                    </span>
                  </div>
                  <div className="flex items-start">
                    <svg
                      className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <span className="text-sm text-gray-700">
                      {plan.embedding_quota === -1
                        ? '無制限の埋め込み'
                        : `月${plan.embedding_quota.toLocaleString()}トークンの埋め込み`}
                    </span>
                  </div>
                  {plan.features.map((feature, index) => (
                    <div key={index} className="flex items-start">
                      <svg
                        className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      <span className="text-sm text-gray-700">{feature}</span>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => handleUpgrade(plan.id)}
                  disabled={isCurrentPlan || isUpgrading}
                  className={`w-full py-2 px-4 rounded-lg font-semibold transition-colors ${
                    isCurrentPlan
                      ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                      : plan.popular
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                  }`}
                >
                  {isCurrentPlan
                    ? '現在のプラン'
                    : isUpgrading
                    ? '処理中...'
                    : plan.id === 'enterprise'
                    ? 'お問い合わせ'
                    : plan.id === 'starter'
                    ? 'このプランに変更'
                    : 'このプランに変更'}
                </button>
              </div>
            );
          })}
        </div>

        {/* 注意事項 */}
        <div className="mt-8 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-yellow-800 mb-2">
            ⚠️ 注意事項
          </h3>
          <ul className="text-sm text-yellow-700 list-disc list-inside space-y-1">
            <li>
              プラン変更は即座に反映されますが、決済処理が必要な場合は別途お手続きが必要です。
            </li>
            <li>
              エンタープライズプランへの変更は、担当者からの連絡が必要です。
            </li>
            <li>
              プランをダウングレードした場合、現在の使用量が新しいクォータを超えている場合は制限が適用されます。
            </li>
          </ul>
        </div>
      </div>
    </Layout>
  );
}

