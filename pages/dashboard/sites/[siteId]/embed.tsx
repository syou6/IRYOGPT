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
  spreadsheet_id: string | null;
  chat_mode: 'rag_only' | 'appointment_only' | 'hybrid' | null;
}

type ChatMode = 'rag_only' | 'appointment_only' | 'hybrid';

const CHAT_MODE_OPTIONS: { value: ChatMode; label: string; description: string }[] = [
  { value: 'rag_only', label: 'RAGのみ', description: 'WEBサイト情報で回答' },
  { value: 'appointment_only', label: '予約のみ', description: 'スプレッドシートで予約対応' },
  { value: 'hybrid', label: 'ハイブリッド ★推奨', description: '両方を使用（予約 + WEB情報）' },
];

const ADMIN_EMAILS = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || process.env.ADMIN_EMAILS || '')
  .split(',')
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

const isAdminEmail = (email?: string | null) => {
  if (!email) return false;
  if (ADMIN_EMAILS.length === 0) return true;
  return ADMIN_EMAILS.includes(email.toLowerCase());
};

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
  const [spreadsheetId, setSpreadsheetId] = useState('');
  const [savingSpreadsheet, setSavingSpreadsheet] = useState(false);
  const [spreadsheetSaved, setSpreadsheetSaved] = useState(false);
  const [chatMode, setChatMode] = useState<ChatMode>('rag_only');
  const [savingChatMode, setSavingChatMode] = useState(false);
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

        // 管理者チェック（先に実行）
        const userEmail = session.user.email?.toLowerCase() ?? '';
        const isAdmin = isAdminEmail(userEmail);

        // サイト情報を取得
        let normalizedSite: Site | null = null;

        // 管理者の場合はAPI経由で取得（RLSをバイパス）
        if (isAdmin) {
          try {
            const response = await fetch('/api/sites', {
              headers: {
                Authorization: `Bearer ${session.access_token}`,
              },
            });

            if (response.ok) {
              const sites: Site[] = await response.json();
              const found = sites.find((s) => s.id === siteId);
              if (found) {
                normalizedSite = found;
              }
            }
          } catch (apiError) {
            console.error('[EmbedSettings] API fetch error:', apiError);
          }
        }

        // API経由で取得できなかった場合、または管理者でない場合は直接取得
        if (!normalizedSite) {
          const { data: siteData, error: siteError } = await supabase
            .from('sites')
            .select('id, name, base_url, status, is_embed_enabled, embed_script_id, spreadsheet_id, chat_mode')
            .eq('id', siteId)
            .single();

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
                spreadsheet_id: null,
                chat_mode: 'rag_only',
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
        }

        if (!normalizedSite) {
          setError('サイト情報を取得できませんでした');
          setLoading(false);
          return;
        }

        // 管理者の場合は所有者チェックをスキップ
        if (!isAdmin) {
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

          // 所有者でない場合はアクセス拒否
          if (siteOwner.user_id !== session.user.id) {
            setError('このサイトへのアクセス権限がありません');
            setLoading(false);
            return;
          }
        }

        setSite(normalizedSite);
        setIsEmbedEnabled(Boolean(normalizedSite.is_embed_enabled));
        setSpreadsheetId(normalizedSite.spreadsheet_id || '');
        setChatMode(normalizedSite.chat_mode || 'rag_only');
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

  // スプレッドシートIDからIDを抽出
  const extractSpreadsheetId = (input: string): string => {
    // URLの場合はIDを抽出
    const urlMatch = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (urlMatch) {
      return urlMatch[1];
    }
    // IDのみの場合はそのまま返す
    return input.trim();
  };

  // スプレッドシートID設定を保存
  const handleSaveSpreadsheet = async () => {
    if (!site || savingSpreadsheet) return;

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) return;

    try {
      setSavingSpreadsheet(true);
      const extractedId = extractSpreadsheetId(spreadsheetId);

      const { error } = await supabase
        .from('sites')
        .update({ spreadsheet_id: extractedId || null })
        .eq('id', site.id);

      if (error) {
        throw error;
      }

      setSpreadsheetId(extractedId);
      setSite({ ...site, spreadsheet_id: extractedId || null });
      setSpreadsheetSaved(true);
      setTimeout(() => setSpreadsheetSaved(false), 2000);
    } catch (error) {
      console.error('Error saving spreadsheet:', error);
      alert('設定の保存に失敗しました');
    } finally {
      setSavingSpreadsheet(false);
    }
  };

  // チャットモード設定を保存
  const handleSaveChatMode = async (newMode: ChatMode) => {
    if (!site || savingChatMode) return;

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) return;

    try {
      setSavingChatMode(true);

      const { error } = await supabase
        .from('sites')
        .update({ chat_mode: newMode })
        .eq('id', site.id);

      if (error) {
        throw error;
      }

      setChatMode(newMode);
      setSite({ ...site, chat_mode: newMode });
    } catch (error) {
      console.error('Error saving chat mode:', error);
      alert('チャットモードの保存に失敗しました');
      // 元の値に戻す
      setChatMode(site.chat_mode || 'rag_only');
    } finally {
      setSavingChatMode(false);
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

          {/* チャットモード設定 */}
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-white">チャットモード設定</h2>
              <p className="mt-1 text-sm text-slate-300">
                チャットボットの動作モードを選択します。
              </p>
            </div>

            <div className="space-y-6">
              {/* チャットモード選択 */}
              <div>
                <label className="block text-sm font-medium text-slate-200 mb-3">
                  モード選択
                </label>
                <div className="grid gap-3 sm:grid-cols-3">
                  {CHAT_MODE_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => handleSaveChatMode(option.value)}
                      disabled={savingChatMode}
                      className={`relative rounded-xl border p-4 text-left transition ${
                        chatMode === option.value
                          ? 'border-emerald-400/50 bg-emerald-500/20'
                          : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10'
                      } ${savingChatMode ? 'cursor-not-allowed opacity-50' : ''}`}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${
                            chatMode === option.value
                              ? 'border-emerald-400 bg-emerald-400'
                              : 'border-white/30'
                          }`}
                        >
                          {chatMode === option.value && (
                            <div className="h-1.5 w-1.5 rounded-full bg-white" />
                          )}
                        </div>
                        <span className={`text-sm font-medium ${
                          chatMode === option.value ? 'text-emerald-100' : 'text-slate-200'
                        }`}>
                          {option.label}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-slate-400">{option.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* スプレッドシートID設定（予約モードの場合のみ表示） */}
              {(chatMode === 'appointment_only' || chatMode === 'hybrid') && (
                <div className="border-t border-white/10 pt-6">
                  <label className="block text-sm font-medium text-slate-200 mb-2">
                    スプレッドシートID または URL
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={spreadsheetId}
                      onChange={(e) => setSpreadsheetId(e.target.value)}
                      placeholder="例: 136Iu0vdefE7h-UibePv0wyk_WIN-XGm1PCoES1u32lc"
                      className="flex-1 rounded-xl border border-white/10 bg-black/30 px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-400/50 focus:outline-none focus:ring-1 focus:ring-emerald-400/50"
                    />
                    <button
                      onClick={handleSaveSpreadsheet}
                      disabled={savingSpreadsheet}
                      className={`rounded-xl px-5 py-2.5 text-sm font-semibold transition ${
                        spreadsheetSaved
                          ? 'bg-emerald-500 text-white'
                          : 'bg-gradient-to-r from-emerald-400 via-green-300 to-cyan-300 text-slate-900 shadow-[0_10px_20px_rgba(16,185,129,0.25)]'
                      } ${savingSpreadsheet ? 'cursor-not-allowed opacity-50' : 'hover:opacity-90'}`}
                    >
                      {spreadsheetSaved ? '保存済み' : savingSpreadsheet ? '保存中...' : '保存'}
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-slate-400">
                    Google スプレッドシートのURL全体を貼り付けても、IDだけを貼り付けても大丈夫です。
                  </p>

                  {site.spreadsheet_id && (
                    <div className="mt-4 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4">
                      <div className="flex items-center gap-2 text-sm text-emerald-100">
                        <svg className="h-5 w-5 text-emerald-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="font-medium">スプレッドシート連携済み</span>
                      </div>
                      <a
                        href={`https://docs.google.com/spreadsheets/d/${site.spreadsheet_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-emerald-300 hover:text-emerald-200"
                      >
                        スプレッドシートを開く
                        <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="none">
                          <path d="M7.5 5h7.5v7.5" stroke="currentColor" strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" />
                          <path d="M7.5 12.5 15 5" stroke="currentColor" strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </a>
                    </div>
                  )}

                  {!site.spreadsheet_id && (
                    <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4">
                      <div className="flex items-center gap-2 text-sm text-amber-100">
                        <svg className="h-5 w-5 text-amber-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <span className="font-medium">スプレッドシートIDを設定してください</span>
                      </div>
                      <p className="mt-2 text-xs text-amber-200/80">
                        予約機能を使用するには、スプレッドシートIDの設定が必要です。
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* 現在のモード状態表示 */}
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <h3 className="text-sm font-medium text-slate-200 mb-2">現在の設定</h3>
                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-medium text-emerald-200">
                    {CHAT_MODE_OPTIONS.find(o => o.value === chatMode)?.label || 'RAGのみ'}
                  </span>
                  {(chatMode === 'appointment_only' || chatMode === 'hybrid') && site.spreadsheet_id && (
                    <span className="inline-flex items-center rounded-full bg-cyan-500/20 px-3 py-1 text-xs font-medium text-cyan-200">
                      スプレッドシート連携済み
                    </span>
                  )}
                  {chatMode === 'hybrid' && (
                    <span className="inline-flex items-center rounded-full bg-purple-500/20 px-3 py-1 text-xs font-medium text-purple-200">
                      WEB情報 + 予約対応
                    </span>
                  )}
                </div>
                <p className="mt-2 text-xs text-slate-400">
                  {chatMode === 'rag_only' && 'WEBサイトの情報を元に質問に回答します。'}
                  {chatMode === 'appointment_only' && 'スプレッドシートを使って予約対応のみを行います。'}
                  {chatMode === 'hybrid' && 'WEBサイト情報を参照しながら、予約対応も行います。（推奨）'}
                </p>
              </div>
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
