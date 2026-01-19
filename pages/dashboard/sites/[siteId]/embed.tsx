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

interface LineConfig {
  lineChannelId: string;
  lineChannelSecret: string;
  lineChannelAccessToken: string;
  lineEnabled: boolean;
  hasChannelSecret: boolean;
  hasChannelAccessToken: boolean;
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

  // LINE 設定関連の状態
  const [lineConfig, setLineConfig] = useState<LineConfig>({
    lineChannelId: '',
    lineChannelSecret: '',
    lineChannelAccessToken: '',
    lineEnabled: false,
    hasChannelSecret: false,
    hasChannelAccessToken: false,
  });
  const [lineChannelIdInput, setLineChannelIdInput] = useState('');
  const [lineChannelSecretInput, setLineChannelSecretInput] = useState('');
  const [lineChannelAccessTokenInput, setLineChannelAccessTokenInput] = useState('');
  const [lineEnabled, setLineEnabled] = useState(false);
  const [savingLine, setSavingLine] = useState(false);
  const [lineSaved, setLineSaved] = useState(false);
  const [showLineSecret, setShowLineSecret] = useState(false);
  const [showLineToken, setShowLineToken] = useState(false);
  const [lineWebhookCopied, setLineWebhookCopied] = useState(false);

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

        // LINE 設定を取得
        try {
          const lineResponse = await fetch(`/api/sites/${siteId}/line-config`, {
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
          });

          if (lineResponse.ok) {
            const lineData: LineConfig = await lineResponse.json();
            setLineConfig(lineData);
            setLineChannelIdInput(lineData.lineChannelId || '');
            setLineChannelSecretInput(lineData.lineChannelSecret || '');
            setLineChannelAccessTokenInput(lineData.lineChannelAccessToken || '');
            setLineEnabled(lineData.lineEnabled || false);
          }
        } catch (lineError) {
          console.error('[EmbedSettings] Failed to fetch LINE config:', lineError);
          // LINE設定取得に失敗してもページは表示する
        }

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

  // LINE Webhook URLを取得
  const getLineWebhookUrl = () => {
    if (!site) return '';
    const protocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'https' : 'http';
    const host = typeof window !== 'undefined' ? window.location.host : 'localhost:3005';
    return `${protocol}://${host}/api/line/webhook?site_id=${site.id}`;
  };

  // LINE Webhook URLをコピー
  const handleCopyLineWebhook = async () => {
    const webhookUrl = getLineWebhookUrl();
    try {
      await navigator.clipboard.writeText(webhookUrl);
      setLineWebhookCopied(true);
      setTimeout(() => setLineWebhookCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
      alert('コピーに失敗しました');
    }
  };

  // LINE 設定を保存
  const handleSaveLineConfig = async () => {
    if (!site || savingLine) return;

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) return;

    try {
      setSavingLine(true);

      const response = await fetch(`/api/sites/${site.id}/line-config`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          lineChannelId: lineChannelIdInput,
          lineChannelSecret: lineChannelSecretInput,
          lineChannelAccessToken: lineChannelAccessTokenInput,
          lineEnabled: lineEnabled,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'LINE設定の保存に失敗しました');
      }

      const updatedConfig: LineConfig = await response.json();
      setLineConfig(updatedConfig);
      setLineChannelSecretInput(updatedConfig.lineChannelSecret || '');
      setLineChannelAccessTokenInput(updatedConfig.lineChannelAccessToken || '');
      setLineSaved(true);
      setTimeout(() => setLineSaved(false), 2000);
    } catch (error) {
      console.error('Error saving LINE config:', error);
      alert(error instanceof Error ? error.message : 'LINE設定の保存に失敗しました');
    } finally {
      setSavingLine(false);
    }
  };

  // LINE有効/無効の切り替え
  const handleToggleLine = async () => {
    if (!site || savingLine) return;

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) return;

    // 有効にする場合は設定が完了しているかチェック
    if (!lineEnabled && (!lineChannelIdInput || !lineConfig.hasChannelSecret || !lineConfig.hasChannelAccessToken)) {
      alert('LINE連携を有効にするには、まずチャネル設定を保存してください');
      return;
    }

    try {
      setSavingLine(true);
      const newValue = !lineEnabled;

      const response = await fetch(`/api/sites/${site.id}/line-config`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          lineEnabled: newValue,
        }),
      });

      if (!response.ok) {
        throw new Error('LINE設定の更新に失敗しました');
      }

      const updatedConfig: LineConfig = await response.json();
      setLineEnabled(newValue);
      setLineConfig(updatedConfig);
    } catch (error) {
      console.error('Error toggling LINE:', error);
      alert('LINE設定の更新に失敗しました');
    } finally {
      setSavingLine(false);
    }
  };

  if (authLoading || loading) {
    return (
      <Layout>
        <div className="flex min-h-screen items-center justify-center">
          <div className="rounded-full border border-premium-stroke bg-premium-surface px-6 py-3 text-xs uppercase tracking-[0.25em] text-premium-text">
            読み込み中...
          </div>
        </div>
      </Layout>
    );
  }

  if (!site && !loading) {
    return (
      <Layout>
        <div className="relative mx-auto max-w-4xl px-4 py-8 text-premium-text">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute right-0 top-0 h-48 w-48 rounded-full bg-emerald-500/20 blur-3xl" />
          </div>
          <div className="relative rounded-[32px] border border-premium-stroke bg-premium-surface p-6 shadow-[0_25px_60px_rgba(0,0,0,0.08)] backdrop-blur-2xl">
            <div className="mb-6">
              <Link
                href="/dashboard"
                className="mb-2 inline-flex items-center text-[11px] uppercase tracking-[0.35em] text-emerald-600/80"
              >
                ← ダッシュボード
              </Link>
              <h1 className="text-2xl font-semibold text-premium-text">埋め込み設定</h1>
            </div>
            {error ? (
              <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4">
                <h3 className="text-sm font-semibold text-rose-700 mb-2">エラー</h3>
                <p className="text-sm text-rose-600">{error}</p>
                <p className="text-xs text-rose-600 mt-2">siteId: {siteId || '未取得'}</p>
              </div>
            ) : (
              <div className="rounded-2xl border border-premium-stroke bg-premium-surface p-4 text-center text-premium-text">
                <p>サイトが見つかりません</p>
                <p className="mt-2 text-xs text-premium-muted">siteId: {siteId || '未取得'}</p>
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
          <div className="rounded-full border border-premium-stroke bg-premium-surface px-6 py-3 text-xs uppercase tracking-[0.25em] text-premium-text">
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
      <div className="relative mx-auto max-w-4xl px-4 py-8 text-premium-text">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-emerald-500/20 to-transparent blur-3xl" />
        </div>

        <div className="relative space-y-6 rounded-[32px] border border-premium-stroke bg-premium-surface p-6 shadow-[0_25px_60px_rgba(0,0,0,0.08)] backdrop-blur-2xl">
          {/* ヘッダー */}
          <div className="border-b border-premium-stroke pb-6">
            <Link
              href={`/dashboard/${site.id}`}
              className="mb-2 inline-flex items-center text-[11px] uppercase tracking-[0.35em] text-emerald-600/80"
            >
              ← サイトに戻る
            </Link>
            <h1 className="text-3xl font-semibold text-premium-text">埋め込み設定</h1>
            <p className="mt-1 text-premium-muted">{site.name}</p>
          </div>

          {/* ステータス警告 */}
          {site.status !== 'ready' && (
            <div className="rounded-3xl border border-amber-400/30 bg-amber-500/10 p-4">
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-amber-400/30 p-2 text-amber-600">
                  <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-amber-700">学習が完了していません</h3>
                  <p className="mt-1 text-sm text-amber-700">
                    埋め込み機能を使用するには、サイトのステータスが「ready」である必要があります。
                    現在のステータス: <span className="font-semibold">{site.status}</span>
                  </p>
                  {site.status === 'idle' && (
                    <Link
                      href={`/dashboard/${site.id}`}
                      className="mt-2 inline-flex text-xs font-medium text-amber-700 underline-offset-4 hover:underline"
                    >
                      学習を開始する →
                    </Link>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 埋め込み有効化スイッチ */}
          <div className="rounded-3xl border border-premium-stroke bg-premium-surface p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-premium-text">埋め込み機能を有効にする</h2>
                <p className="mt-1 text-sm text-premium-muted">
                  このサイトにチャットボットウィジェットを埋め込むことができます。
                  {site.status !== 'ready' && (
                    <span className="font-medium text-amber-600"> （学習完了後に有効化できます）</span>
                  )}
                </p>
              </div>
              <button
                onClick={handleToggleEmbed}
                disabled={saving || site.status !== 'ready'}
                className={`relative inline-flex h-7 w-14 flex-shrink-0 cursor-pointer items-center rounded-full border border-premium-stroke transition ${
                  isEmbedEnabled ? 'bg-gradient-to-r from-emerald-400 to-cyan-300' : 'bg-premium-elevated'
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
          <div className="rounded-3xl border border-premium-stroke bg-premium-surface p-6">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-premium-text">チャットモード設定</h2>
              <p className="mt-1 text-sm text-premium-muted">
                チャットボットの動作モードを選択します。
              </p>
            </div>

            <div className="space-y-6">
              {/* チャットモード選択 */}
              <div>
                <label className="block text-sm font-medium text-premium-text mb-3">
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
                          : 'border-premium-stroke bg-premium-surface hover:border-premium-stroke hover:bg-premium-elevated'
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
                          chatMode === option.value ? 'text-emerald-700' : 'text-premium-text'
                        }`}>
                          {option.label}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-premium-muted">{option.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* スプレッドシートID設定（予約モードの場合のみ表示） */}
              {(chatMode === 'appointment_only' || chatMode === 'hybrid') && (
                <div className="border-t border-premium-stroke pt-6">
                  <label className="block text-sm font-medium text-premium-text mb-2">
                    スプレッドシートID または URL
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={spreadsheetId}
                      onChange={(e) => setSpreadsheetId(e.target.value)}
                      placeholder="例: 136Iu0vdefE7h-UibePv0wyk_WIN-XGm1PCoES1u32lc"
                      className="flex-1 rounded-xl border border-premium-stroke bg-slate-100 px-4 py-2.5 text-sm text-premium-text placeholder-slate-400 focus:border-emerald-400/50 focus:outline-none focus:ring-1 focus:ring-emerald-400/50"
                    />
                    <button
                      onClick={handleSaveSpreadsheet}
                      disabled={savingSpreadsheet}
                      className={`rounded-xl px-5 py-2.5 text-sm font-semibold transition ${
                        spreadsheetSaved
                          ? 'bg-emerald-500 text-premium-text'
                          : 'bg-gradient-to-r from-emerald-400 via-green-300 to-cyan-300 text-slate-900 shadow-[0_10px_20px_rgba(16,185,129,0.25)]'
                      } ${savingSpreadsheet ? 'cursor-not-allowed opacity-50' : 'hover:opacity-90'}`}
                    >
                      {spreadsheetSaved ? '保存済み' : savingSpreadsheet ? '保存中...' : '保存'}
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-premium-muted">
                    Google スプレッドシートのURL全体を貼り付けても、IDだけを貼り付けても大丈夫です。
                  </p>

                  {site.spreadsheet_id && (
                    <div className="mt-4 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4">
                      <div className="flex items-center gap-2 text-sm text-emerald-700">
                        <svg className="h-5 w-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="font-medium">スプレッドシート連携済み</span>
                      </div>
                      <a
                        href={`https://docs.google.com/spreadsheets/d/${site.spreadsheet_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-emerald-600 hover:text-emerald-600"
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
                      <div className="flex items-center gap-2 text-sm text-amber-700">
                        <svg className="h-5 w-5 text-amber-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <span className="font-medium">スプレッドシートIDを設定してください</span>
                      </div>
                      <p className="mt-2 text-xs text-amber-600/80">
                        予約機能を使用するには、スプレッドシートIDの設定が必要です。
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* 現在のモード状態表示 */}
              <div className="rounded-2xl border border-premium-stroke bg-premium-surface p-4">
                <h3 className="text-sm font-medium text-premium-text mb-2">現在の設定</h3>
                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-medium text-emerald-600">
                    {CHAT_MODE_OPTIONS.find(o => o.value === chatMode)?.label || 'RAGのみ'}
                  </span>
                  {(chatMode === 'appointment_only' || chatMode === 'hybrid') && site.spreadsheet_id && (
                    <span className="inline-flex items-center rounded-full bg-cyan-500/20 px-3 py-1 text-xs font-medium text-cyan-700">
                      スプレッドシート連携済み
                    </span>
                  )}
                  {chatMode === 'hybrid' && (
                    <span className="inline-flex items-center rounded-full bg-purple-500/20 px-3 py-1 text-xs font-medium text-purple-700">
                      WEB情報 + 予約対応
                    </span>
                  )}
                </div>
                <p className="mt-2 text-xs text-premium-muted">
                  {chatMode === 'rag_only' && 'WEBサイトの情報を元に質問に回答します。'}
                  {chatMode === 'appointment_only' && 'スプレッドシートを使って予約対応のみを行います。'}
                  {chatMode === 'hybrid' && 'WEBサイト情報を参照しながら、予約対応も行います。（推奨）'}
                </p>
              </div>
            </div>
          </div>

          {/* 埋め込みスクリプト */}
          {isEmbedEnabled && site.status === 'ready' && (
            <div className="space-y-4 rounded-3xl border border-premium-stroke bg-premium-surface p-6">
              <div>
                <h2 className="text-lg font-semibold text-premium-text">埋め込みスクリプト</h2>
                <p className="mt-1 text-sm text-premium-muted">
                  以下のスクリプトタグを、埋め込みたいページの
                  <code className="rounded bg-premium-elevated px-1 text-xs">&lt;/body&gt;</code>
                  タグの直前に追加してください。
                </p>
              </div>

              <div className="relative rounded-2xl border border-premium-stroke bg-slate-100 p-4">
                <code className="block break-all text-sm text-emerald-700">{scriptTag}</code>
                <button
                  onClick={handleCopyScript}
                  className="absolute right-3 top-3 rounded-full bg-gradient-to-r from-emerald-400 via-green-300 to-cyan-300 px-4 py-1.5 text-xs font-semibold text-slate-900 shadow-[0_15px_25px_rgba(16,185,129,0.35)]"
                >
                  {copied ? 'コピー済み' : 'コピー'}
                </button>
              </div>

              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4 text-sm text-emerald-700">
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
            <div className="rounded-3xl border border-premium-stroke bg-premium-surface p-6">
              <h2 className="text-lg font-semibold text-premium-text">スクリプトURL（参考）</h2>
              <div className="mt-3 rounded-2xl border border-premium-stroke bg-slate-100 p-4">
                <code className="block break-all text-sm text-emerald-700">{embedScriptUrl}</code>
              </div>
              <p className="mt-2 text-xs text-premium-muted">このURLに直接アクセスすると、埋め込みスクリプトが表示されます。</p>
            </div>
          )}

          {/* 無効化時のメッセージ */}
          {!isEmbedEnabled && (
            <div className="rounded-3xl border border-dashed border-premium-stroke bg-premium-surface p-6 text-center text-premium-text">
              <p>
                埋め込み機能が無効になっています。
                {site.status === 'ready' ? (
                  <span className="block pt-2 text-sm text-premium-muted">
                    上記のスイッチを有効にすると、埋め込みスクリプトが表示されます。
                  </span>
                ) : (
                  <span className="block pt-2 text-sm text-premium-muted">
                    まず学習を完了して、ステータスを「ready」にしてください。
                  </span>
                )}
              </p>
            </div>
          )}

          {/* LINE連携設定 */}
          {(chatMode === 'appointment_only' || chatMode === 'hybrid') && (
            <div className="rounded-3xl border border-premium-stroke bg-premium-surface p-6">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#06C755]/20">
                  <svg className="h-6 w-6 text-[#06C755]" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.105.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.349 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-premium-text">LINE連携設定</h2>
                  <p className="mt-1 text-sm text-premium-muted">
                    LINE公式アカウントと連携して、LINEからも予約を受け付けられます。
                  </p>
                </div>
              </div>

              <div className="space-y-6">
                {/* LINE有効化スイッチ */}
                <div className="flex items-center justify-between rounded-2xl border border-premium-stroke bg-premium-surface p-4">
                  <div>
                    <h3 className="text-sm font-medium text-premium-text">LINE連携を有効にする</h3>
                    <p className="mt-1 text-xs text-premium-muted">
                      有効にするには、まず下記のチャネル設定を保存してください
                    </p>
                  </div>
                  <button
                    onClick={handleToggleLine}
                    disabled={savingLine}
                    className={`relative inline-flex h-7 w-14 flex-shrink-0 cursor-pointer items-center rounded-full border border-premium-stroke transition ${
                      lineEnabled ? 'bg-[#06C755]' : 'bg-premium-elevated'
                    } ${savingLine ? 'cursor-not-allowed opacity-40' : ''}`}
                  >
                    <span
                      className={`ml-1 inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                        lineEnabled ? 'translate-x-6' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* チャネル設定 */}
                <div className="space-y-4">
                  {/* チャネルID */}
                  <div>
                    <label className="block text-sm font-medium text-premium-text mb-2">
                      チャネルID
                    </label>
                    <input
                      type="text"
                      value={lineChannelIdInput}
                      onChange={(e) => setLineChannelIdInput(e.target.value)}
                      placeholder="例: 1234567890"
                      className="w-full rounded-xl border border-premium-stroke bg-slate-100 px-4 py-2.5 text-sm text-premium-text placeholder-slate-400 focus:border-[#06C755]/50 focus:outline-none focus:ring-1 focus:ring-[#06C755]/50"
                    />
                  </div>

                  {/* チャネルシークレット */}
                  <div>
                    <label className="block text-sm font-medium text-premium-text mb-2">
                      チャネルシークレット
                    </label>
                    <div className="relative">
                      <input
                        type={showLineSecret ? 'text' : 'password'}
                        value={lineChannelSecretInput}
                        onChange={(e) => setLineChannelSecretInput(e.target.value)}
                        placeholder={lineConfig.hasChannelSecret ? '設定済み（変更する場合は新しい値を入力）' : '例: abcdef123456...'}
                        className="w-full rounded-xl border border-premium-stroke bg-slate-100 px-4 py-2.5 pr-12 text-sm text-premium-text placeholder-slate-400 focus:border-[#06C755]/50 focus:outline-none focus:ring-1 focus:ring-[#06C755]/50"
                      />
                      <button
                        type="button"
                        onClick={() => setShowLineSecret(!showLineSecret)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-premium-muted hover:text-premium-text"
                      >
                        {showLineSecret ? (
                          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                          </svg>
                        ) : (
                          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* チャネルアクセストークン */}
                  <div>
                    <label className="block text-sm font-medium text-premium-text mb-2">
                      チャネルアクセストークン（長期）
                    </label>
                    <div className="relative">
                      <input
                        type={showLineToken ? 'text' : 'password'}
                        value={lineChannelAccessTokenInput}
                        onChange={(e) => setLineChannelAccessTokenInput(e.target.value)}
                        placeholder={lineConfig.hasChannelAccessToken ? '設定済み（変更する場合は新しい値を入力）' : '例: XYZABC123...'}
                        className="w-full rounded-xl border border-premium-stroke bg-slate-100 px-4 py-2.5 pr-12 text-sm text-premium-text placeholder-slate-400 focus:border-[#06C755]/50 focus:outline-none focus:ring-1 focus:ring-[#06C755]/50"
                      />
                      <button
                        type="button"
                        onClick={() => setShowLineToken(!showLineToken)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-premium-muted hover:text-premium-text"
                      >
                        {showLineToken ? (
                          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                          </svg>
                        ) : (
                          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* 保存ボタン */}
                  <div className="flex justify-end">
                    <button
                      onClick={handleSaveLineConfig}
                      disabled={savingLine}
                      className={`rounded-xl px-6 py-2.5 text-sm font-semibold transition ${
                        lineSaved
                          ? 'bg-[#06C755] text-white'
                          : 'bg-[#06C755] text-white shadow-[0_10px_20px_rgba(6,199,85,0.25)]'
                      } ${savingLine ? 'cursor-not-allowed opacity-50' : 'hover:opacity-90'}`}
                    >
                      {lineSaved ? '保存済み' : savingLine ? '保存中...' : 'チャネル設定を保存'}
                    </button>
                  </div>
                </div>

                {/* Webhook URL */}
                {lineConfig.hasChannelSecret && lineConfig.hasChannelAccessToken && (
                  <div className="border-t border-premium-stroke pt-6">
                    <label className="block text-sm font-medium text-premium-text mb-2">
                      Webhook URL
                    </label>
                    <p className="mb-3 text-xs text-premium-muted">
                      このURLをLINE Developersコンソールの「Webhook URL」に設定してください。
                    </p>
                    <div className="relative rounded-xl border border-premium-stroke bg-slate-100 p-4">
                      <code className="block break-all text-sm text-[#06C755]">{getLineWebhookUrl()}</code>
                      <button
                        onClick={handleCopyLineWebhook}
                        className="absolute right-3 top-3 rounded-full bg-[#06C755] px-4 py-1.5 text-xs font-semibold text-white shadow-md"
                      >
                        {lineWebhookCopied ? 'コピー済み' : 'コピー'}
                      </button>
                    </div>
                  </div>
                )}

                {/* 設定手順 */}
                <div className="rounded-2xl border border-[#06C755]/20 bg-[#06C755]/10 p-4 text-sm text-[#06C755]">
                  <h3 className="mb-2 text-sm font-semibold">設定手順</h3>
                  <ol className="list-decimal space-y-1 pl-5 text-xs">
                    <li>
                      <a
                        href="https://developers.line.biz/console/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline"
                      >
                        LINE Developers Console
                      </a>
                      にアクセス
                    </li>
                    <li>プロバイダーを作成し、Messaging APIチャネルを作成</li>
                    <li>「チャネル基本設定」からチャネルID、チャネルシークレットを取得</li>
                    <li>「Messaging API設定」からチャネルアクセストークン（長期）を発行</li>
                    <li>上記の設定を保存後、Webhook URLをLINE Developersに設定</li>
                    <li>「Webhook設定」でWebhookの利用を「ON」にする</li>
                  </ol>
                </div>

                {/* 現在の状態表示 */}
                <div className="rounded-2xl border border-premium-stroke bg-premium-surface p-4">
                  <h3 className="text-sm font-medium text-premium-text mb-2">LINE連携状態</h3>
                  <div className="flex flex-wrap gap-2">
                    {lineEnabled ? (
                      <span className="inline-flex items-center rounded-full bg-[#06C755]/20 px-3 py-1 text-xs font-medium text-[#06C755]">
                        LINE連携: 有効
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-slate-500/20 px-3 py-1 text-xs font-medium text-slate-600">
                        LINE連携: 無効
                      </span>
                    )}
                    {lineConfig.hasChannelSecret && lineConfig.hasChannelAccessToken ? (
                      <span className="inline-flex items-center rounded-full bg-[#06C755]/20 px-3 py-1 text-xs font-medium text-[#06C755]">
                        チャネル設定: 完了
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-amber-500/20 px-3 py-1 text-xs font-medium text-amber-700">
                        チャネル設定: 未完了
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
