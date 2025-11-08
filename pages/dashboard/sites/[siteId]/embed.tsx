import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/layout';
import Link from 'next/link';
import { createSupabaseClient } from '@/utils/supabase-auth';

interface Site {
  id: string;
  name: string;
  base_url: string;
  status: 'idle' | 'training' | 'ready' | 'error';
  is_embed_enabled: boolean;
  embed_script_id: string | null;
}

export default function EmbedSettingsPage() {
  const router = useRouter();
  const { siteId } = router.query;
  const [authLoading, setAuthLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [site, setSite] = useState<Site | null>(null);
  const [isEmbedEnabled, setIsEmbedEnabled] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  // サイト情報を取得
  useEffect(() => {
    if (authLoading || !siteId || typeof siteId !== 'string') return;

    const fetchSite = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) return;

      try {
        setLoading(true);

        // サイト情報を取得
        const { data: siteData, error: siteError } = await supabase
          .from('sites')
          .select('id, name, base_url, status, is_embed_enabled, embed_script_id')
          .eq('id', siteId)
          .single();

        let normalizedSite: Site | null = null;

        if (siteError) {
          // カラムが存在しない（未マイグレーション）の場合はフォールバック
          if ((siteError as any)?.code === '42703') {
            console.warn('[EmbedSettings] Missing embed columns on sites table, falling back to defaults.');
            const { data: fallbackSite, error: fallbackError } = await supabase
              .from('sites')
              .select('id, name, base_url, status')
              .eq('id', siteId)
              .single();

            if (fallbackError || !fallbackSite) {
              console.error('Site not found (fallback):', fallbackError);
              setError(`サイトが見つかりません: ${fallbackError?.message || '不明なエラー'}`);
              setLoading(false);
              return;
            }

            normalizedSite = {
              ...fallbackSite,
              is_embed_enabled: false,
              embed_script_id: null,
            } as Site;
          } else {
            console.error('Site not found:', siteError);
            setError(`サイトが見つかりません: ${siteError?.message || '不明なエラー'}`);
            setLoading(false);
            return;
          }
        } else if (siteData) {
          normalizedSite = siteData as Site;
        }

        if (!normalizedSite) {
          setError('サイト情報を取得できませんでした');
          setLoading(false);
          return;
        }

        // 所有者チェック
        const { data: siteOwner, error: ownerError } = await supabase
          .from('sites')
          .select('user_id')
          .eq('id', siteId)
          .single();

        if (ownerError || !siteOwner) {
          console.error('Site owner check failed:', ownerError);
          setError('このサイトの所有者を確認できませんでした');
          setLoading(false);
          return;
        }

        if (siteOwner.user_id !== session.user.id) {
          setError('このサイトへのアクセス権限がありません');
          setLoading(false);
          return;
        }

        setSite(normalizedSite);
        setIsEmbedEnabled(Boolean(normalizedSite.is_embed_enabled));
        setLoading(false);
      } catch (error) {
        console.error('Error fetching site:', error);
        setError(`エラーが発生しました: ${error instanceof Error ? error.message : '不明なエラー'}`);
        setLoading(false);
      }
    };

    fetchSite();
  }, [authLoading, siteId, router, supabase]);

  // 埋め込み設定を更新
  const handleToggleEmbed = async () => {
    if (!site || saving) return;

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) return;

    // ステータスが 'ready' でない場合は警告
    if (site.status !== 'ready' && !isEmbedEnabled) {
      if (
        !confirm(
          'このサイトはまだ学習が完了していません（status: ' +
            site.status +
            '）。\n埋め込みを有効にするには、まず学習を完了してください。'
        )
      ) {
        return;
      }
    }

    try {
      setSaving(true);
      const newValue = !isEmbedEnabled;

      const { error } = await supabase
        .from('sites')
        .update({ is_embed_enabled: newValue })
        .eq('id', site.id);

      if (error) {
        throw error;
      }

      setIsEmbedEnabled(newValue);
      setSite({ ...site, is_embed_enabled: newValue });
    } catch (error) {
      console.error('Error updating embed settings:', error);
      alert('設定の更新に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  // 埋め込みスクリプトのURLを取得
  const getEmbedScriptUrl = () => {
    if (!site) return '';
    const protocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'https' : 'http';
    const host = typeof window !== 'undefined' ? window.location.host : 'localhost:3005';
    return `${protocol}://${host}/api/embed/script?site_id=${site.id}`;
  };

  // スクリプトタグをコピー
  const handleCopyScript = async () => {
    const scriptTag = `<script src="${getEmbedScriptUrl()}"></script>`;
    try {
      await navigator.clipboard.writeText(scriptTag);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
      alert('コピーに失敗しました');
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

  if (!site && !loading) {
    return (
      <Layout>
        <div className="relative mx-auto max-w-4xl px-4 py-8 text-slate-100">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute right-0 top-0 h-48 w-48 rounded-full bg-emerald-500/20 blur-3xl" />
          </div>
          <div className="relative rounded-[32px] border border-white/10 bg-white/5 p-6 shadow-[0_35px_120px_rgba(1,6,3,0.6)] backdrop-blur-2xl">
            <div className="mb-6">
              <Link
                href="/dashboard"
                className="mb-2 inline-flex items-center text-[11px] uppercase tracking-[0.35em] text-emerald-200/80"
              >
                ← ダッシュボード
              </Link>
              <h1 className="text-2xl font-semibold text-white">埋め込み設定</h1>
            </div>
            {error ? (
              <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4">
                <h3 className="text-sm font-semibold text-rose-100 mb-2">エラー</h3>
                <p className="text-sm text-rose-50">{error}</p>
                <p className="text-xs text-rose-200 mt-2">siteId: {siteId || '未取得'}</p>
              </div>
            ) : (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center text-slate-200">
                <p>サイトが見つかりません</p>
                <p className="mt-2 text-xs text-slate-400">siteId: {siteId || '未取得'}</p>
              </div>
            )}
          </div>
        </div>
      </Layout>
    );
  }

  if (!site) {
    return (
      <Layout>
        <div className="flex min-h-screen items-center justify-center">
          <div className="rounded-full border border-white/10 bg-white/5 px-6 py-3 text-xs uppercase tracking-[0.25em] text-slate-200">
            サイト情報を取得できませんでした
          </div>
        </div>
      </Layout>
    );
  }

  const embedScriptUrl = getEmbedScriptUrl();
  const scriptTag = `<script src="${embedScriptUrl}"></script>`;

  return (
    <Layout>
      <div className="relative mx-auto max-w-4xl px-4 py-8 text-slate-100">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-emerald-500/20 to-transparent blur-3xl" />
        </div>

        <div className="relative space-y-6 rounded-[32px] border border-white/10 bg-white/5 p-6 shadow-[0_35px_120px_rgba(1,6,3,0.6)] backdrop-blur-2xl">
          {/* ヘッダー */}
          <div className="border-b border-white/10 pb-6">
            <Link
              href={`/dashboard/${site.id}`}
              className="mb-2 inline-flex items-center text-[11px] uppercase tracking-[0.35em] text-emerald-200/80"
            >
              ← サイトに戻る
            </Link>
            <h1 className="text-3xl font-semibold text-white">埋め込み設定</h1>
            <p className="mt-1 text-slate-300">{site.name}</p>
          </div>

          {/* ステータス警告 */}
          {site.status !== 'ready' && (
            <div className="rounded-3xl border border-amber-400/30 bg-amber-500/10 p-4">
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-amber-400/30 p-2 text-amber-200">
                  <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-amber-50">学習が完了していません</h3>
                  <p className="mt-1 text-sm text-amber-100">
                    埋め込み機能を使用するには、サイトのステータスが「ready」である必要があります。
                    現在のステータス: <span className="font-semibold">{site.status}</span>
                  </p>
                  {site.status === 'idle' && (
                    <Link
                      href={`/dashboard/${site.id}`}
                      className="mt-2 inline-flex text-xs font-medium text-amber-50 underline-offset-4 hover:underline"
                    >
                      学習を開始する →
                    </Link>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 埋め込み有効化スイッチ */}
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">埋め込み機能を有効にする</h2>
                <p className="mt-1 text-sm text-slate-300">
                  このサイトにチャットボットウィジェットを埋め込むことができます。
                  {site.status !== 'ready' && (
                    <span className="font-medium text-amber-200"> （学習完了後に有効化できます）</span>
                  )}
                </p>
              </div>
              <button
                onClick={handleToggleEmbed}
                disabled={saving || site.status !== 'ready'}
                className={`relative inline-flex h-7 w-14 flex-shrink-0 cursor-pointer items-center rounded-full border border-white/10 transition ${
                  isEmbedEnabled ? 'bg-gradient-to-r from-emerald-400 to-cyan-300' : 'bg-white/10'
                } ${saving || site.status !== 'ready' ? 'cursor-not-allowed opacity-40' : ''}`}
              >
                <span
                  className={`ml-1 inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                    isEmbedEnabled ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* 埋め込みスクリプト */}
          {isEmbedEnabled && site.status === 'ready' && (
            <div className="space-y-4 rounded-3xl border border-white/10 bg-white/5 p-6">
              <div>
                <h2 className="text-lg font-semibold text-white">埋め込みスクリプト</h2>
                <p className="mt-1 text-sm text-slate-300">
                  以下のスクリプトタグを、埋め込みたいページの
                  <code className="rounded bg-white/10 px-1 text-xs">&lt;/body&gt;</code>
                  タグの直前に追加してください。
                </p>
              </div>

              <div className="relative rounded-2xl border border-white/10 bg-black/30 p-4">
                <code className="block break-all text-sm text-emerald-100">{scriptTag}</code>
                <button
                  onClick={handleCopyScript}
                  className="absolute right-3 top-3 rounded-full bg-gradient-to-r from-emerald-400 via-green-300 to-cyan-300 px-4 py-1.5 text-xs font-semibold text-slate-900 shadow-[0_15px_25px_rgba(16,185,129,0.35)]"
                >
                  {copied ? 'コピー済み' : 'コピー'}
                </button>
              </div>

              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4 text-sm text-emerald-50">
                <h3 className="mb-2 text-sm font-semibold">📝 使用方法</h3>
                <ol className="list-decimal space-y-1 pl-5">
                  <li>上記のスクリプトタグをコピーします</li>
                  <li>埋め込みたいHTMLページの &lt;/body&gt; タグ直前に貼り付けます</li>
                  <li>ページを読み込むと右下にチャットボタンが表示されます</li>
                </ol>
              </div>
            </div>
          )}

          {/* スクリプトURL（デバッグ用） */}
          {isEmbedEnabled && site.status === 'ready' && (
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-lg font-semibold text-white">スクリプトURL（参考）</h2>
              <div className="mt-3 rounded-2xl border border-white/10 bg-black/30 p-4">
                <code className="block break-all text-sm text-emerald-100">{embedScriptUrl}</code>
              </div>
              <p className="mt-2 text-xs text-slate-400">このURLに直接アクセスすると、埋め込みスクリプトが表示されます。</p>
            </div>
          )}

          {/* 無効化時のメッセージ */}
          {!isEmbedEnabled && (
            <div className="rounded-3xl border border-dashed border-white/20 bg-white/5 p-6 text-center text-slate-200">
              <p>
                埋め込み機能が無効になっています。
                {site.status === 'ready' ? (
                  <span className="block pt-2 text-sm text-slate-300">
                    上記のスイッチを有効にすると、埋め込みスクリプトが表示されます。
                  </span>
                ) : (
                  <span className="block pt-2 text-sm text-slate-300">
                    まず学習を完了して、ステータスを「ready」にしてください。
                  </span>
                )}
              </p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
