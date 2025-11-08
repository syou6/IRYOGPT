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
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-gray-500">読み込み中...</div>
        </div>
      </Layout>
    );
  }

  if (!site && !loading) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="mb-8">
            <Link
              href="/dashboard"
              className="text-blue-600 hover:text-blue-800 text-sm mb-2 inline-block"
            >
              ← ダッシュボードに戻る
            </Link>
            <h1 className="text-3xl font-bold text-gray-900">埋め込み設定</h1>
          </div>
          {error ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-red-800 mb-2">エラー</h3>
              <p className="text-sm text-red-700">{error}</p>
              <p className="text-xs text-red-600 mt-2">
                siteId: {siteId || '未取得'}
              </p>
            </div>
          ) : (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
              <p className="text-gray-600">サイトが見つかりません</p>
              <p className="text-xs text-gray-500 mt-2">
                siteId: {siteId || '未取得'}
              </p>
            </div>
          )}
        </div>
      </Layout>
    );
  }

  if (!site) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-gray-500">サイト情報を取得できませんでした</div>
        </div>
      </Layout>
    );
  }

  const embedScriptUrl = getEmbedScriptUrl();
  const scriptTag = `<script src="${embedScriptUrl}"></script>`;

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* ヘッダー */}
        <div className="mb-8">
          <Link
            href={`/dashboard/${site.id}`}
            className="text-blue-600 hover:text-blue-800 text-sm mb-2 inline-block"
          >
            ← サイトに戻る
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">埋め込み設定</h1>
          <p className="text-gray-600 mt-2">{site.name}</p>
        </div>

        {/* ステータス警告 */}
        {site.status !== 'ready' && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-yellow-400"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">
                  学習が完了していません
                </h3>
                <div className="mt-2 text-sm text-yellow-700">
                  <p>
                    埋め込み機能を使用するには、サイトのステータスが「ready」である必要があります。
                    現在のステータス: <strong>{site.status}</strong>
                  </p>
                  {site.status === 'idle' && (
                    <Link
                      href={`/dashboard/${site.id}`}
                      className="mt-2 inline-block text-yellow-800 underline"
                    >
                      学習を開始する →
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 埋め込み有効化スイッチ */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">
                埋め込み機能を有効にする
              </h2>
              <p className="text-sm text-gray-600">
                このサイトにチャットボットウィジェットを埋め込むことができます。
                {site.status !== 'ready' && (
                  <span className="text-yellow-600 font-medium">
                    {' '}（学習完了後に有効化できます）
                  </span>
                )}
              </p>
            </div>
            <button
              onClick={handleToggleEmbed}
              disabled={saving || site.status !== 'ready'}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                isEmbedEnabled ? 'bg-blue-600' : 'bg-gray-200'
              } ${saving || site.status !== 'ready' ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  isEmbedEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {/* 埋め込みスクリプト */}
        {isEmbedEnabled && site.status === 'ready' && (
          <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              埋め込みスクリプト
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              以下のスクリプトタグを、埋め込みたいページの
              <code className="bg-gray-100 px-1 rounded">&lt;/body&gt;</code>
              タグの直前に追加してください。
            </p>

            <div className="bg-gray-50 border border-gray-300 rounded-lg p-4 mb-4 relative">
              <code className="text-sm text-gray-800 break-all">
                {scriptTag}
              </code>
              <button
                onClick={handleCopyScript}
                className="absolute top-2 right-2 px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
              >
                {copied ? 'コピー済み' : 'コピー'}
              </button>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-blue-900 mb-2">
                📝 使用方法
              </h3>
              <ol className="text-sm text-blue-800 list-decimal list-inside space-y-1">
                <li>上記のスクリプトタグをコピーします</li>
                <li>埋め込みたいHTMLページの &lt;/body&gt; タグの直前に貼り付けます</li>
                <li>ページを読み込むと、右下にチャットボタンが表示されます</li>
              </ol>
            </div>
          </div>
        )}

        {/* スクリプトURL（デバッグ用） */}
        {isEmbedEnabled && site.status === 'ready' && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              スクリプトURL（参考）
            </h2>
            <div className="bg-white border border-gray-300 rounded-lg p-4">
              <code className="text-sm text-gray-800 break-all">
                {embedScriptUrl}
              </code>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              このURLに直接アクセスすると、埋め込みスクリプトが表示されます。
            </p>
          </div>
        )}

        {/* 無効化時のメッセージ */}
        {!isEmbedEnabled && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
            <p className="text-gray-600">
              埋め込み機能が無効になっています。
              {site.status === 'ready' ? (
                <>
                  <br />
                  上記のスイッチを有効にすると、埋め込みスクリプトが表示されます。
                </>
              ) : (
                <>
                  <br />
                  まず学習を完了して、ステータスを「ready」にしてください。
                </>
              )}
            </p>
          </div>
        )}
      </div>
    </Layout>
  );
}
