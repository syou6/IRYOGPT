import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/layout';
import Link from 'next/link';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Surface from '@/components/ui/Surface';
import { createSupabaseClient } from '@/utils/supabase-auth';
import {
  PLAN_CONFIG,
  planOrder,
  PlanTier,
  InternalPlan,
  getPlanLabel,
  getPlanConfigByInternalPlan,
} from '@/lib/planConfig';

interface User {
  id: string;
  plan: InternalPlan;
  chat_quota: number;
  embedding_quota: number;
  stripe_subscription_id?: string | null;
  subscription_status?: string | null;
  cancel_at_period_end?: boolean | null;
}

const AVAILABLE_PLAN_TIERS: PlanTier[] = ['solo'];

const planCards = planOrder.map((tier) => ({
  tier,
  ...PLAN_CONFIG[tier],
  comingSoon: !AVAILABLE_PLAN_TIERS.includes(tier),
}));

// Plans hero: uses Surface, timeline cards, CTA for chat/embed guidance
export default function PlansPage() {
  const router = useRouter();
  const [authLoading, setAuthLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [upgrading, setUpgrading] = useState<PlanTier | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [resumeLoading, setResumeLoading] = useState(false);
  const [stripeError, setStripeError] = useState<string | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
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

  // Stripe決済完了クエリの検知
  useEffect(() => {
    if (!router.isReady) return;

    const localKey = 'recent_payment_success';

    const setFromStorage = () => {
      if (typeof window === 'undefined') return;
      setPaymentSuccess(window.localStorage.getItem(localKey) === 'true');
    };

    if (router.query.payment === 'success') {
      setPaymentSuccess(true);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(localKey, 'true');
      }

      const nextQuery = { ...router.query };
      delete nextQuery.payment;
      delete nextQuery.session_id;
      router.replace({ pathname: router.pathname, query: nextQuery }, undefined, {
        shallow: true,
      });
    } else {
      setFromStorage();
    }
  }, [router]);

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

  const handleCheckout = async (tier: PlanTier) => {
    if (!user || upgrading || !AVAILABLE_PLAN_TIERS.includes(tier)) {
      return;
    }

    const targetPlan = PLAN_CONFIG[tier];
    if (user.plan === targetPlan.internalPlan) {
      return;
    }

    try {
      setStripeError(null);
      setUpgrading(tier);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error('認証情報の取得に失敗しました。再ログインしてください。');
      }

      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ plan: tier }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.message || '決済セッションの作成に失敗しました。');
      }

      if (payload?.url) {
        window.location.href = payload.url as string;
        return;
      }

      throw new Error('StripeチェックアウトURLが取得できませんでした。');
    } catch (error: any) {
      console.error('Stripe checkout error:', error);
      setStripeError(error?.message ?? '決済ページへの遷移に失敗しました。');
    } finally {
      setUpgrading(null);
    }
  };

  const handleCancelSubscription = async () => {
    if (!user || cancelLoading) {
      return;
    }

    if (!confirm('次回の更新タイミングで解約します。よろしいですか？')) {
      return;
    }

    try {
      setStripeError(null);
      setCancelLoading(true);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error('認証情報の取得に失敗しました。再ログインしてください。');
      }

      const response = await fetch('/api/stripe/cancel-subscription', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.status === 401) {
        throw new Error('認証情報の有効期限が切れました。ログインし直してください。');
      }

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.message || '解約処理に失敗しました。');
      }

      setUser({
        ...user,
        subscription_status: payload?.status ?? user.subscription_status,
        cancel_at_period_end:
          typeof payload?.cancel_at_period_end === 'boolean'
            ? payload.cancel_at_period_end
            : true,
      });
    } catch (error: any) {
      console.error('Cancel subscription error:', error);
      setStripeError(error?.message ?? '解約手続きに失敗しました。');
    } finally {
      setCancelLoading(false);
    }
  };

  const handleResumeSubscription = async () => {
    if (!user || resumeLoading) {
      return;
    }

    try {
      setStripeError(null);
      setResumeLoading(true);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error('認証情報の取得に失敗しました。再ログインしてください。');
      }

      const response = await fetch('/api/stripe/resume-subscription', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.status === 401) {
        throw new Error('認証情報の有効期限が切れました。ログインし直してください。');
      }

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.message || '解約予約の取り消しに失敗しました。');
      }

      setUser({
        ...user,
        subscription_status: payload?.status ?? user.subscription_status,
        cancel_at_period_end:
          typeof payload?.cancel_at_period_end === 'boolean'
            ? payload.cancel_at_period_end
            : false,
      });
    } catch (error: any) {
      console.error('Resume subscription error:', error);
      setStripeError(error?.message ?? '解約予約の取り消しに失敗しました。');
    } finally {
      setResumeLoading(false);
    }
  };

  const dismissPaymentSuccess = () => {
    setPaymentSuccess(false);
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('recent_payment_success');
    }
  };

  if (authLoading || loading) {
    return (
      <Layout>
        <div className="flex min-h-screen items-center justify-center">
          <div className="rounded-full border border-premium-stroke/60 bg-premium-surface/70 px-6 py-3 text-xs uppercase tracking-[0.25em] text-premium-muted">
            読み込み中...
          </div>
        </div>
      </Layout>
    );
  }

  const currentPlanLabel = user ? getPlanLabel(user.plan) : null;
  const currentPlanConfig = user ? getPlanConfigByInternalPlan(user.plan) : null;
  const planTimeline = [
    { label: 'URL登録', done: Boolean(user) },
    { label: 'よやくらくが学習', done: Boolean(user?.stripe_subscription_id) },
    { label: 'チャット埋め込み & 公開', done: ['starter', 'pro', 'enterprise'].includes(user?.plan ?? '') },
  ];
  const heroHighlights = [
    {
      label: '現在のプラン',
      value: currentPlanLabel ?? '未契約',
      helper: user?.stripe_subscription_id ? '決済済み' : 'お申し込み前',
    },
    {
      label: 'URL登録上限',
      value: currentPlanConfig?.siteLimitText ?? '未設定',
      helper: '登録済みURLから運営が学習',
    },
    {
      label: 'サポート',
      value: user?.stripe_subscription_id ? '優先サポート' : 'チャットでご案内',
      helper: '24時間以内に返信',
    },
  ];
  const showPostPurchaseBanner = paymentSuccess;

  return (
    <Layout>
      <div className="relative mx-auto max-w-6xl px-4 py-8 text-premium-text sm:py-12">
        <div className="pointer-events-none absolute inset-0 -z-20 bg-premium-grid opacity-60" />
        <div className="pointer-events-none absolute inset-0 -z-10 bg-premium-radial opacity-70" />

        <div className="relative space-y-8">
          <Surface className="p-6 sm:p-10">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <Link
                  href="/dashboard"
                  className="text-[11px] uppercase tracking-[0.35em] text-premium-muted"
                >
                  ← ダッシュボード
                </Link>
                <h1 className="mt-3 text-3xl font-semibold text-premium-text sm:text-4xl">プラン比較</h1>
                <p className="mt-2 max-w-xl text-sm text-premium-muted">
                  スタータープランは即日Stripe決済が可能です。プロ / ビジネスは最終調整中のため、ご希望の場合はサポートにお問い合わせください。
                </p>
              </div>
              <div className="rounded-full border border-premium-stroke/60 bg-premium-elevated/60 px-4 py-2 text-[11px] uppercase tracking-[0.3em] text-premium-muted">
                Secure Stripe Checkout
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
              {heroHighlights.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-4xl border border-premium-stroke/40 bg-premium-elevated/70 px-4 py-3 text-sm"
                >
                  <p className="text-[11px] uppercase tracking-[0.3em] text-premium-muted">{stat.label}</p>
                  <p className="mt-2 text-xl font-semibold text-premium-text">{stat.value}</p>
                  <p className="text-xs text-premium-muted">{stat.helper}</p>
                </div>
              ))}
            </div>
            <Card className="mt-6 space-y-3 px-5 py-4 text-sm text-premium-muted">
              <p className="text-xs uppercase tracking-[0.35em] text-premium-muted">導入ステップ</p>
              <div className="flex flex-col gap-3 lg:flex-row">
                <ol className="flex-1 space-y-2 text-xs">
                  {planTimeline.map((step, idx) => (
                    <li key={step.label} className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${step.done ? 'bg-premium-accent' : 'bg-premium-stroke/60'}`} />
                      <span className={step.done ? 'text-premium-text' : undefined}>
                        {idx + 1}. {step.label}
                      </span>
                    </li>
                  ))}
                </ol>
                <div className="flex-1 rounded-2xl border border-premium-stroke/40 bg-premium-elevated/70 px-4 py-3 text-xs">
                  <p className="font-semibold text-premium-text">チャット公開までの動き</p>
                  <p className="mt-1 text-premium-muted">
                    URLを登録するとよやくらくが学習し、準備が整えば埋め込みコードを貼るだけでデモの会話をそのまま本番化できます。
                  </p>
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                    <Button size="md" onClick={() => router.push('/dashboard')}>
                      ダッシュボードで進捗確認
                    </Button>
                    <Button
                      size="md"
                      variant="secondary"
                      onClick={() => {
                        if (typeof window !== 'undefined') {
                          window.open('mailto:heartssh@gmail.com', '_blank');
                        }
                      }}
                    >
                      サポートに相談
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          </Surface>

          {showPostPurchaseBanner && (
            <div className="rounded-4xl border border-premium-accent/40 bg-premium-surface/80 p-5 text-sm text-premium-text shadow-glow">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-base font-semibold text-premium-text">ご契約ありがとうございます</p>
                  <p className="mt-1 text-premium-muted">
                    よやくらく チームが登録済み URL をもとに学習を開始します。内容確認のうえ、稼働準備が整い次第メールとダッシュボードでお知らせします。
                  </p>
                  <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-premium-muted">
                    <li>追加URLや修正依頼があればダッシュボードのサポートチャットへ</li>
                    <li>優先対応キューに入った旨をメールでもご案内します</li>
                    <li>オペレーターが学習完了後にステータスを更新します</li>
                  </ul>
                </div>
                <button
                  onClick={dismissPaymentSuccess}
                  className="inline-flex items-center justify-center rounded-full border border-premium-stroke/60 px-4 py-1.5 text-xs font-semibold text-premium-muted transition hover:border-premium-accent hover:text-premium-text"
                >
                  表示を閉じる
                </button>
              </div>
            </div>
          )}

          {stripeError && (
            <div className="rounded-4xl border border-premium-danger/40 bg-premium-base/60 px-4 py-3 text-sm text-premium-text">
              {stripeError}
            </div>
          )}

          {user && (
            <div className="rounded-4xl border border-premium-stroke/40 bg-premium-surface/70 p-5 text-sm shadow-premium">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <span className="text-premium-muted">現在のプラン</span>
                  <span className="ml-2 text-base font-semibold text-premium-text">{currentPlanLabel}</span>
                  {user.stripe_subscription_id && (
                    <p className="text-xs text-premium-muted">
                      {user.cancel_at_period_end
                        ? '解約予約済み：現在の請求期間終了後に自動停止します'
                        : `サブスクリプション状態: ${user.subscription_status || 'active'}`}
                    </p>
                  )}
                </div>
                {user.stripe_subscription_id && (
                  <div className="flex flex-wrap gap-2">
                    {!user.cancel_at_period_end ? (
                      <button
                        onClick={handleCancelSubscription}
                        disabled={cancelLoading}
                        className="inline-flex items-center justify-center rounded-full border border-premium-stroke/60 px-4 py-2 text-xs font-semibold text-premium-text transition hover:border-premium-accent disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {cancelLoading ? '処理中...' : '次回更新で解約'}
                      </button>
                    ) : (
                      <button
                        onClick={handleResumeSubscription}
                        disabled={resumeLoading}
                        className="inline-flex items-center justify-center rounded-full border border-premium-accent/60 px-4 py-2 text-xs font-semibold text-premium-text transition hover:border-premium-accent disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {resumeLoading ? '処理中...' : '解約予約を取り消す'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="rounded-4xl border border-dashed border-premium-stroke/50 bg-premium-surface/60 px-4 py-3 text-xs text-premium-muted">
            プロ / ビジネス（旧プロ / エンタープライズ）プランは現在最終調整中です。公開までしばらくお待ちください。
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {planCards.map((plan) => {
              const isCurrentPlan = user?.plan === plan.internalPlan;
              const isComingSoon = plan.comingSoon;
              const isProcessing = upgrading === plan.tier;
              const featureItems = [
                plan.siteLimitText,
                `月${plan.chatQuota.toLocaleString()}チャット`,
                `月${plan.embeddingQuota.toLocaleString()}トークン`,
                ...plan.features,
              ].filter(Boolean);

              const buttonDisabled = isCurrentPlan || isComingSoon || isProcessing;
              const buttonLabel = isCurrentPlan
                ? '現在のプラン'
                : isComingSoon
                ? '近日公開'
                : isProcessing
                ? 'リダイレクト中...'
                : '今すぐ申し込む';

              return (
                <div
                  key={plan.tier}
                  className={`relative overflow-hidden rounded-4xl border border-premium-stroke/40 bg-premium-surface/80 p-6 shadow-premium backdrop-blur-xl ${
                    plan.popular ? 'ring-1 ring-premium-accent/40' : ''
                  }`}
                >
                  <div className="pointer-events-none absolute inset-0 opacity-40">
                    {plan.popular && (
                      <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-premium-accent/30 blur-[90px]" />
                    )}
                  </div>
                  <div className="relative">
                    <div className="flex flex-wrap gap-2">
                      {plan.popular && (
                        <span className="inline-flex items-center rounded-full bg-premium-accent/10 px-3 py-1 text-xs font-semibold text-premium-accent">
                          人気
                        </span>
                      )}
                      {isComingSoon && (
                        <span className="inline-flex items-center rounded-full border border-premium-stroke/50 px-3 py-1 text-xs font-semibold text-premium-muted">
                          近日公開
                        </span>
                      )}
                      {isCurrentPlan && (
                        <span className="inline-flex items-center rounded-full border border-premium-accent/40 px-3 py-1 text-xs font-semibold text-premium-accent">
                          現在のプラン
                        </span>
                      )}
                    </div>

                    <div className="mt-4">
                      <h2 className="text-2xl font-semibold text-premium-text">{plan.label}</h2>
                      <p className="mt-1 text-sm text-premium-muted">{plan.description}</p>
                    </div>

                    <div className="mt-6">
                      <div className="text-3xl font-semibold text-premium-text">{plan.priceLabel}</div>
                      <div className="text-xs uppercase tracking-[0.3em] text-premium-muted">税込</div>
                    </div>

                    <div className="mt-6 space-y-3">
                      {featureItems.map((label, index) => (
                        <div key={index} className="flex items-start text-sm text-premium-text">
                          <svg
                            className="mr-2 h-5 w-5 flex-shrink-0 text-premium-accent"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span>{label}</span>
                        </div>
                      ))}
                    </div>

                    <Button
                      onClick={() => handleCheckout(plan.tier)}
                      disabled={buttonDisabled}
                      variant={buttonDisabled ? 'secondary' : 'primary'}
                      size="full"
                      className="mt-6"
                    >
                      {buttonLabel}
                    </Button>
                    <p className="mt-2 text-xs text-premium-muted">
                      {isCurrentPlan
                        ? 'ご利用中のプランです'
                        : isComingSoon
                        ? '現在準備中のため少々お待ちください'
                        : 'Stripeの決済画面に遷移します'}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="rounded-4xl border border-premium-warning/40 bg-premium-surface/70 p-4 text-sm text-premium-text">
            <h3 className="mb-2 font-semibold text-premium-text">⚠️ 注意事項</h3>
            <ul className="list-disc space-y-1 pl-5 text-premium-muted">
              <li>スタータープランのお申し込みはStripe決済完了後に自動で反映されます。</li>
              <li>近日公開プランをご希望の場合はサポートチャットまたはメールでご連絡ください。</li>
              <li>プラン変更後のチャット / トークン枠は次の課金期間から適用されます。</li>
            </ul>
          </div>
        </div>
      </div>
    </Layout>
  );
}
