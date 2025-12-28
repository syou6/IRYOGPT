import { useRef, useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/layout';
import { Message, SourceLink } from '@/types/chat';
import { fetchEventSource } from '@microsoft/fetch-event-source';
import ReactMarkdown from 'react-markdown';
import type { Components as MarkdownComponents } from 'react-markdown';
import LoadingDots from '@/components/ui/LoadingDots';
import Link from 'next/link';
import Button from '@/components/ui/Button';
import { createSupabaseClient } from '@/utils/supabase-auth';
import { ChatInput } from '@/components/chat/ChatInput';

interface Site {
  id: string;
  name: string;
  base_url: string;
  status: 'idle' | 'training' | 'ready' | 'error';
  spreadsheet_id?: string | null;
  chat_mode?: 'rag_only' | 'appointment_only' | 'hybrid' | null;
}

type ChatMode = 'rag_only' | 'appointment_only' | 'hybrid';

const CHAT_MODE_OPTIONS: { value: ChatMode; label: string }[] = [
  { value: 'rag_only', label: 'RAG' },
  { value: 'appointment_only', label: '予約' },
  { value: 'hybrid', label: 'ハイブリッド' },
];

// クイックリプライの定義
interface QuickReply {
  label: string;
  type: 'static' | 'api';
  response?: string;  // staticの場合の応答
  message?: string;   // apiの場合の送信メッセージ
}

const APPOINTMENT_QUICK_REPLIES: QuickReply[] = [
  { label: '予約したい', type: 'static', response: 'ご予約を承ります。ご希望の日時はございますか？' },
  { label: '空き状況を確認', type: 'api', message: '空き状況を教えてください' },
  { label: '診療時間', type: 'api', message: '診療時間を教えてください' },
  { label: 'キャンセル', type: 'static', response: 'ご予約のキャンセルにつきましては、お手数ですがお電話にてご連絡をお願いいたします。' },
];

interface TrainingJob {
  id: string;
  site_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  started_at: string;
  finished_at: string | null;
  total_pages: number;
  processed_pages: number;
  error_message: string | null;
  metadata?: {
    detected_sitemap_url?: string | null;
    detection_method?: string;
    url_count?: number;
    urls?: string[]; // 学習されたURLのリスト
  };
  created_at: string;
}

export default function SiteChat() {
  const router = useRouter();
  const { siteId } = router.query;
  const [site, setSite] = useState<Site | null>(null);
  const [trainingJobs, setTrainingJobs] = useState<TrainingJob[]>([]);
  const [query, setQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [messageState, setMessageState] = useState<{
    messages: Message[];
    pending?: string;
    history: [string, string][];
    sources?: string[]; // 旧仕様の引用元URL（複数）
    bestSource?: SourceLink; // 最も関連度の高い引用元
  }>({
    messages: [],
    history: [],
  });

  const { messages, pending, history } = messageState;
  const messageListRef = useRef<HTMLDivElement>(null);
  // textAreaRefは削除（ChatInputコンポーネント内で管理されるため）
  const channelRef = useRef<any>(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const [chatMode, setChatMode] = useState<ChatMode>('rag_only');
  const [savingChatMode, setSavingChatMode] = useState(false);
  const supabase = createSupabaseClient();

  const normalizeSourceLink = (raw: unknown): SourceLink | undefined => {
    if (!raw) return undefined;
    if (typeof raw === 'string') {
      return { url: raw };
    }
    if (typeof raw === 'object') {
      const candidate = raw as { url?: unknown; title?: unknown };
      if (candidate.url && typeof candidate.url === 'string') {
        return {
          url: candidate.url,
          title: typeof candidate.title === 'string' ? candidate.title : undefined,
        };
      }
    }
    return undefined;
  };

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
    if (!siteId || typeof siteId !== 'string' || authLoading) return;
    
    const fetchSite = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) return;

      try {
        const response = await fetch('/api/sites', {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (!response.ok) {
          if (response.status === 401) {
            router.push('/auth/login');
            return;
          }
          throw new Error('Failed to fetch sites');
        }

        const sites: Site[] = await response.json();
        const found = sites.find((s) => s.id === siteId);
        
        if (found) {
          setSite(found);
          setChatMode(found.chat_mode || 'rag_only');
          if (found.status !== 'ready') {
            setMessageState({
              messages: [
                {
                  message: `「${found.name}」の学習が完了していません。ステータス: ${found.status}`,
                  type: 'apiMessage',
                },
              ],
              history: [],
            });
          } else {
            // チャットモードで初期メッセージを変える
            const mode = found.chat_mode || 'rag_only';
            let welcomeMessage = 'こんにちは。AIアシスタントです。お困りのことはありませんか？何でもお気軽にお聞きください。';
            if (mode === 'appointment_only' && found.spreadsheet_id) {
              welcomeMessage = 'こんにちは。ご予約のお手伝いをいたします。ご希望の日時や空き状況についてお気軽にお聞きください。';
            } else if (mode === 'hybrid' && found.spreadsheet_id) {
              welcomeMessage = 'こんにちは。ご予約やお問い合わせのお手伝いをいたします。ご質問やご予約希望など、お気軽にどうぞ。';
            }
            setMessageState({
              messages: [
                {
                  message: welcomeMessage,
                  type: 'apiMessage',
                },
              ],
              history: [],
            });
          }
        } else {
          router.push('/dashboard');
        }
      } catch (error) {
        console.error('Error fetching site:', error);
        router.push('/dashboard');
      }
    };

    fetchSite();
  }, [siteId, router, authLoading, supabase]);

  // 学習履歴を取得
  useEffect(() => {
    if (!siteId || typeof siteId !== 'string' || authLoading) return;

    const fetchTrainingJobs = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) return;

      try {
        const response = await fetch(`/api/training-jobs/${siteId}`, {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (!response.ok) {
          if (response.status === 401) {
            router.push('/auth/login');
            return;
          }
          throw new Error('Failed to fetch training jobs');
        }

        const jobs: TrainingJob[] = await response.json();
        setTrainingJobs(jobs);
      } catch (error) {
        console.error('Error fetching training jobs:', error);
      }
    };

    fetchTrainingJobs();

    // Supabase Realtimeでtraining_jobsテーブルの変更を監視
    const setupRealtime = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) return;

      // 既存のチャンネルを削除
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }

      channelRef.current = supabase
        .channel(`training-jobs-${siteId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'training_jobs',
            filter: `site_id=eq.${siteId}`,
          },
          (payload: any) => {
            // ジョブの変更を検知したら再取得
            fetchTrainingJobs();
          }
        )
        .subscribe();
    };

    setupRealtime();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [siteId, router, authLoading, supabase]);

  // textAreaRefのフォーカス処理は削除（ChatInputコンポーネント内で管理されるため）

  useEffect(() => {
    messageListRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [messages, pending]);

  // pendingが存在する時はloadingをfalseにしてストリーミング表示に切り替え
  useEffect(() => {
    if (pending && pending.length > 0 && loading) {
      setLoading(false);
    }
  }, [pending, loading]);

  // フォーム送信
  async function handleSubmit(textOrEvent?: string | any) {
    // ChatInputから呼ばれる場合は文字列、フォームから呼ばれる場合はイベント
    const question = typeof textOrEvent === 'string' 
      ? textOrEvent.trim()
      : query.trim();

    if (textOrEvent && typeof textOrEvent !== 'string') {
      textOrEvent.preventDefault();
    }

    if (!question || !siteId || typeof siteId !== 'string') {
      return; // alertは削除（UIで無効化されているので不要）
    }

    if (site?.status !== 'ready') {
      return; // alertは削除
    }

    setMessageState((state) => ({
      ...state,
      messages: [
        ...state.messages,
        {
          type: 'userMessage',
          message: question,
        },
      ],
      pending: undefined,
      sources: undefined,
      bestSource: undefined,
    }));

    setQuery('');
    setMessageState((state) => ({ ...state, pending: '', sources: undefined, bestSource: undefined }));
    setLoading(true);

    const ctrl = new AbortController();

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push('/auth/login');
        return;
      }

      await fetchEventSource('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          question,
          history,
          site_id: siteId,
        }),
        signal: ctrl.signal,
        onopen: async (response) => {
          if (response.ok && response.status === 200) {
            if (process.env.NODE_ENV === 'development') {
              console.log('[Chat] Connection opened');
            }
          } else if (response.status === 403) {
            // クォータ超過エラー
            const errorData = await response.json().catch(() => ({ error: 'クォータ超過' }));
            console.error('[Chat] Quota exceeded:', errorData);
            setMessageState((state) => ({
              ...state,
              messages: [
                ...state.messages,
                {
                  type: 'apiMessage',
                  message: errorData.error || '月間チャット上限に達しました。プランのアップグレードをご検討ください。',
                },
              ],
              pending: undefined,
              bestSource: undefined,
              sources: undefined,
            }));
            setLoading(false);
            ctrl.abort();
          } else if (response.status >= 400 && response.status < 500 && response.status !== 429) {
            const errorText = await response.text();
            console.error('[Chat] Client error:', response.status, errorText);
            setMessageState((state) => ({
              ...state,
              messages: [
                ...state.messages,
                {
                  type: 'apiMessage',
                  message: `エラー: ${response.status} ${errorText || 'リクエストエラー'}`,
                },
              ],
              pending: undefined,
              bestSource: undefined,
              sources: undefined,
            }));
            setLoading(false);
            ctrl.abort();
          } else {
            console.error('[Chat] Server error:', response.status);
            setMessageState((state) => ({
              ...state,
              messages: [
                ...state.messages,
                {
                  type: 'apiMessage',
                  message: `エラー: サーバーエラー (${response.status})`,
                },
              ],
              pending: undefined,
              bestSource: undefined,
              sources: undefined,
            }));
            setLoading(false);
            ctrl.abort();
          }
        },
        onmessage: (event) => {
          if (process.env.NODE_ENV === 'development') {
            console.log('[Chat] Received message:', event.data);
          }
          if (event.data === '[DONE]') {
            setMessageState((state) => {
              if (process.env.NODE_ENV === 'development') {
                console.log('[Chat] Stream completed, final pending length:', state.pending?.length || 0);
              }
              return {
                history: [...state.history, [question, state.pending ?? '']],
                messages: [
                  ...state.messages,
                  {
                    type: 'apiMessage',
                    message: state.pending ?? '',
                    sources: state.sources, // 旧形式の引用元URLを保存
                    source: state.bestSource,
                  },
                ],
                pending: undefined,
                sources: undefined,
                bestSource: undefined,
              };
            });
            setLoading(false);
            ctrl.abort();
          } else {
            try {
              const data = JSON.parse(event.data);
              if (process.env.NODE_ENV === 'development') {
                console.log('[Chat] Parsed data:', data);
              }
              if (data.error) {
                setMessageState((state) => ({
                  ...state,
                  messages: [
                    ...state.messages,
                    {
                      type: 'apiMessage',
                      message: `エラー: ${data.error}`,
                    },
                  ],
                  pending: undefined,
                  bestSource: undefined,
                  sources: undefined,
                }));
                setLoading(false);
                ctrl.abort();
              } else if (data.source) {
                const normalized = normalizeSourceLink(data.source);
                if (normalized) {
                  setMessageState((state) => ({
                    ...state,
                    bestSource: normalized,
                  }));
                }
              } else if (data.sources) {
                // 旧仕様（配列）の引用元URLを受信
                const urlList = Array.isArray(data.sources)
                  ? data.sources.filter((url: unknown): url is string => typeof url === 'string')
                  : [];
                setMessageState((state) => ({
                  ...state,
                  sources: urlList,
                  bestSource: state.bestSource || (urlList.length > 0 ? { url: urlList[0] } : undefined),
                }));
              } else {
                const token = data.data || '';
                if (process.env.NODE_ENV === 'development') {
                  console.log('[Chat] Adding token:', token);
                }
                setMessageState((state) => {
                  const newPending = (state.pending ?? '') + token;
                  if (process.env.NODE_ENV === 'development') {
                    console.log('[Chat] New pending length:', newPending.length);
                  }
                  return {
                    ...state,
                    pending: newPending,
                  };
                });
              }
            } catch (parseError) {
              console.error('[Chat] Failed to parse message:', parseError, event.data);
            }
          }
        },
        onerror: (err) => {
          console.error('[Chat] EventSource error:', err);
          setMessageState((state) => ({
            ...state,
            messages: [
              ...state.messages,
              {
                type: 'apiMessage',
                message: 'エラー: 接続エラーが発生しました。もう一度お試しください。',
              },
            ],
            pending: undefined,
            bestSource: undefined,
            sources: undefined,
          }));
          setLoading(false);
          throw err; // 再試行を停止
        },
      });
    } catch (error) {
      setLoading(false);
      console.log('error', error);
    }
  }

  // handleEnter関数は削除（use-chat-submitで処理されるため）

  // クイックリプライのクリックハンドラー
  const handleQuickReply = (reply: QuickReply) => {
    if (loading || site?.status !== 'ready') return;

    if (reply.type === 'static' && reply.response) {
      // staticの場合はAPI呼び出しなしで即座に応答
      setMessageState((state) => ({
        ...state,
        messages: [
          ...state.messages,
          { type: 'userMessage', message: reply.label },
          { type: 'apiMessage', message: reply.response! },
        ],
        history: [...state.history, [reply.label, reply.response!]],
      }));
    } else if (reply.type === 'api' && reply.message) {
      // apiの場合は通常のチャット送信
      handleSubmit(reply.message);
    }
  };

  // チャットモード保存
  const handleSaveChatMode = async (newMode: ChatMode) => {
    if (!site || savingChatMode) return;

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) return;

    try {
      setSavingChatMode(true);

      const response = await fetch(`/api/sites/${site.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ chat_mode: newMode }),
      });

      if (!response.ok) {
        throw new Error('Failed to update chat mode');
      }

      setChatMode(newMode);
      setSite({ ...site, chat_mode: newMode });
    } catch (error) {
      console.error('Error saving chat mode:', error);
      alert('チャットモードの保存に失敗しました');
      setChatMode(site.chat_mode || 'rag_only');
    } finally {
      setSavingChatMode(false);
    }
  };

  // 予約モードかどうか（予約機能を使用するモード）
  const isAppointmentMode = chatMode === 'appointment_only' || chatMode === 'hybrid';

  const chatMessages = useMemo(() => {
    return [
      ...messages,
      ...(pending
        ? [
            {
              type: 'apiMessage' as const,
              message: pending,
            },
          ]
        : []),
    ];
  }, [messages, pending]);

  const markdownComponents = useMemo<MarkdownComponents>(() => ({
    a({ children, ...props }) {
      return (
        <a
          {...props}
          target="_blank"
          rel="noopener noreferrer"
          className="text-emerald-300 underline decoration-emerald-500/50 underline-offset-2 transition hover:text-emerald-200"
        >
          {children}
        </a>
      );
    },
    code({ inline, className, children, ...props }) {
      if (inline) {
        return (
          <code
            {...props}
            className={`rounded-md bg-white/10 px-1.5 py-0.5 text-[0.85em] text-emerald-100 ${className || ''}`.trim()}
          >
            {children}
          </code>
        );
      }
      return (
        <pre className="mt-3 overflow-x-auto rounded-2xl border border-white/10 bg-black/30 p-3">
          <code {...props} className={`text-[0.9em] leading-relaxed text-emerald-50 ${className || ''}`.trim()}>
            {children}
          </code>
        </pre>
      );
    },
    ul({ children, ...props }) {
      return (
        <ul {...props} className="ml-4 list-disc space-y-1 text-slate-100">
          {children}
        </ul>
      );
    },
    ol({ children, ...props }) {
      return (
        <ol {...props} className="ml-4 list-decimal space-y-1 text-slate-100">
          {children}
        </ol>
      );
    },
    p({ children, ...props }) {
      return (
        <p {...props} className="mb-3 text-slate-100 last:mb-0">
          {children}
        </p>
      );
    },
  }), []);

  if (authLoading || !site) {
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

  // ステータスラベルの取得
  const getStatusLabel = (status: TrainingJob['status']) => {
    const labels = {
      pending: '待機中',
      running: '実行中',
      completed: '完了',
      failed: '失敗',
    };
    return labels[status];
  };

  // 日付フォーマット
  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('ja-JP');
  };

  if (!site) {
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

  // site.idが確実に存在することを確認
  const siteIdForLinks = (siteId && typeof siteId === 'string') ? siteId : (site?.id && typeof site.id === 'string' ? site.id : null);
  const embedHref = siteIdForLinks 
    ? `/dashboard/sites/${siteIdForLinks}/embed` 
    : null;
  const insightsHref = siteIdForLinks
    ? `/dashboard/${siteIdForLinks}/insights`
    : null;

  return (
    <Layout>
      {showSidebar && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setShowSidebar(false)}
        />
      )}
      <div className="relative mx-auto max-w-6xl px-4 py-6 text-slate-100 lg:py-8">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-emerald-500/20 to-transparent blur-3xl" />
          <div className="absolute bottom-[-20%] left-0 h-72 w-72 rounded-full bg-teal-400/15 blur-[140px]" />
        </div>

        <div className="relative flex flex-col gap-6 lg:flex-row">
          {/* メインコンテンツ（チャット） */}
          <div className="flex min-h-[70vh] flex-1 flex-col overflow-hidden rounded-[32px] border border-white/10 bg-white/5 shadow-[0_35px_120px_rgba(1,6,3,0.6)] backdrop-blur-2xl">
            {/* ヘッダー */}
            <div className="flex flex-col gap-3 border-b border-white/10 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <Link
                  href="/dashboard"
                  className="mb-1 inline-flex items-center text-[11px] uppercase tracking-[0.35em] text-emerald-200/80"
                >
                  ← ダッシュボード
                </Link>
                <h1 className="truncate text-2xl font-semibold text-white">{site.name}</h1>
                <p className="mt-1 break-all text-xs text-slate-400">{site.base_url}</p>
              </div>
              <div className="flex flex-col gap-2 sm:items-end">
                {/* チャットモード切替 */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">モード:</span>
                  <div className="flex rounded-full border border-white/10 bg-white/5 p-0.5">
                    {CHAT_MODE_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => handleSaveChatMode(option.value)}
                        disabled={savingChatMode}
                        className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                          chatMode === option.value
                            ? 'bg-emerald-400/20 text-emerald-100'
                            : 'text-slate-400 hover:text-slate-200'
                        } ${savingChatMode ? 'cursor-not-allowed opacity-50' : ''}`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full border px-3 py-1 text-xs font-medium ${
                    site.status === 'ready'
                      ? 'border-emerald-400/40 bg-emerald-400/15 text-emerald-50'
                      : 'border-white/15 bg-white/10 text-slate-200'
                  }`}>
                    {site.status === 'ready' ? '準備完了' : site.status}
                  </span>
                  {embedHref && (
                    <Link
                      href={embedHref}
                      className="rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium text-slate-100 transition hover:bg-white/15"
                    >
                      埋め込み設定
                    </Link>
                  )}
                  {siteIdForLinks && (
                    <Button
                      variant="secondary"
                      onClick={() => {
                        if (siteIdForLinks) {
                          router.push(`/dashboard/${siteIdForLinks}/insights`);
                        }
                      }}
                      className="rounded-full border border-emerald-400/40 bg-emerald-400/15 px-4 py-1.5 text-xs font-medium text-emerald-100 transition hover:bg-emerald-400/25"
                    >
                      質問インサイト
                    </Button>
                  )}
                  <button
                    onClick={() => setShowSidebar(true)}
                    className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium text-slate-100 transition hover:bg-white/15 lg:hidden"
                    aria-label="学習履歴を表示"
                  >
                    学習履歴
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            {/* チャットエリア */}
            <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
              <div className="mx-auto max-w-3xl">
                {chatMessages.length === 0 ? (
                  <div className="mt-8 text-center text-slate-400">メッセージがありません</div>
                ) : (
                  <div className="space-y-4">
                    {chatMessages.map((message, index) => {
                      const bestSource =
                        message.source ??
                        (message.sources && message.sources.length > 0
                          ? { url: message.sources[0] }
                          : undefined);

                      return (
                        <div
                          key={index}
                          ref={index === chatMessages.length - 1 ? messageListRef : undefined}
                          className={`flex ${
                            message.type === 'userMessage' ? 'justify-end' : 'justify-start'
                          }`}
                        >
                          <div
                            className={`max-w-[85%] rounded-3xl px-4 py-3 text-sm leading-relaxed shadow-lg sm:max-w-[80%] ${
                              message.type === 'userMessage'
                                ? 'bg-gradient-to-r from-emerald-400 via-green-300 to-cyan-300 text-slate-900 shadow-[0_15px_30px_rgba(16,185,129,0.35)]'
                                : 'border border-white/10 bg-white/10 text-slate-100'
                            }`}
                          >
                            {message.type === 'apiMessage' ? (
                              <>
                                <ReactMarkdown
                                  className="prose prose-sm prose-invert max-w-none break-words"
                                  components={markdownComponents}
                                >
                                  {message.message}
                                </ReactMarkdown>
                                {bestSource && (
                                  <a
                                    href={bestSource.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="mt-4 block rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-slate-200 transition hover:border-emerald-400/60 hover:bg-emerald-500/5"
                                  >
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-emerald-200/70">
                                      引用元
                                    </p>
                                    {bestSource.title && (
                                      <p className="mt-2 text-base font-semibold text-white">
                                        {bestSource.title}
                                      </p>
                                    )}
                                    <p className="mt-1 break-words text-[11px] text-emerald-200">
                                      {bestSource.url}
                                    </p>
                                    <span className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-300">
                                      詳しく見る
                                      <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="none">
                                        <path
                                          d="M7.5 5h7.5v7.5"
                                          stroke="currentColor"
                                          strokeWidth={1.3}
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                        />
                                        <path
                                          d="M7.5 12.5 15 5"
                                          stroke="currentColor"
                                          strokeWidth={1.3}
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                        />
                                      </svg>
                                    </span>
                                  </a>
                                )}
                              </>
                            ) : (
                              <p className="whitespace-pre-wrap break-words">{message.message}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {loading && !pending && (
                      <div className="flex justify-start">
                        <div className="rounded-3xl border border-white/10 bg-white/10 px-4 py-2">
                          <LoadingDots color="#33F699" />
                        </div>
                      </div>
                    )}
                    {/* sentinel removed; ref attached to last message */}
                  </div>
                )}
              </div>
            </div>

            {/* クイックリプライボタン（予約モードでスプレッドシート設定済みの場合のみ表示） */}
            {isAppointmentMode && site.spreadsheet_id && site.status === 'ready' && (
              <div className="border-t border-white/10 px-4 pt-4 sm:px-6">
                <div className="mx-auto max-w-3xl">
                  <div className="mb-2 text-xs text-slate-400">よくある質問</div>
                  <div className="flex flex-wrap gap-2">
                    {APPOINTMENT_QUICK_REPLIES.map((reply, index) => (
                      <button
                        key={index}
                        onClick={() => handleQuickReply(reply)}
                        disabled={loading}
                        className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-sm font-medium text-emerald-100 transition hover:border-emerald-400/50 hover:bg-emerald-400/20 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {reply.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 入力フォーム */}
            <div className="border-t border-white/10 px-4 py-5 sm:px-6">
              <div className="mx-auto max-w-3xl">
                <ChatInput
                  onSubmit={handleSubmit}
                  disabled={loading || site.status !== 'ready'}
                  placeholder={
                    site.status === 'ready'
                      ? (isAppointmentMode ? 'ご予約・ご質問をどうぞ...' : '質問を入力してください...')
                      : 'サイトの学習が完了していません'
                  }
                  value={query}
                  onChange={setQuery}
                />
              </div>
            </div>
          </div>

          {/* サイドバー（学習履歴） */}
          <div
            className={`${
              showSidebar ? 'fixed inset-x-6 inset-y-10 z-50 lg:static lg:w-80' : 'hidden lg:block lg:w-80'
            }`}
          >
            <div className="flex h-full flex-col rounded-[28px] border border-white/10 bg-white/5 p-5 shadow-[0_35px_120px_rgba(1,3,6,0.55)] backdrop-blur-2xl">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">学習履歴</h2>
                <button
                  onClick={() => setShowSidebar(false)}
                  className="rounded-full border border-white/10 p-1 text-slate-300 hover:text-white lg:hidden"
                  aria-label="閉じる"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                {trainingJobs.length === 0 ? (
                  <p className="text-sm text-slate-400">学習履歴がありません</p>
                ) : (
                  <div className="space-y-3">
                    {trainingJobs.map((job) => (
                      <div
                        key={job.id}
                        className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-slate-200"
                      >
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <span
                            className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
                              job.status === 'completed'
                                ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-100'
                                : job.status === 'failed'
                                ? 'border-rose-400/40 bg-rose-500/15 text-rose-100'
                                : job.status === 'running'
                                ? 'border-cyan-400/40 bg-cyan-500/15 text-cyan-100'
                                : 'border-white/15 bg-white/10 text-slate-200'
                            }`}
                          >
                            {getStatusLabel(job.status)}
                          </span>
                          <span className="truncate text-xs text-slate-400">{formatDate(job.created_at)}</span>
                        </div>
                        {job.status === 'running' && job.total_pages > 0 && (
                          <div className="mb-2">
                            <div className="mb-1 flex justify-between text-[11px] text-slate-400">
                              <span>進捗</span>
                              <span>
                                {job.processed_pages} / {job.total_pages}
                              </span>
                            </div>
                            <div className="h-2 w-full rounded-full bg-white/10">
                              <div
                                className="h-2 rounded-full bg-gradient-to-r from-emerald-400 via-green-300 to-cyan-300"
                                style={{ width: `${(job.processed_pages / job.total_pages) * 100}%` }}
                              />
                            </div>
                          </div>
                        )}
                        {job.finished_at && (
                          <div className="text-xs text-slate-400">完了: {formatDate(job.finished_at)}</div>
                        )}
                        {job.metadata?.detection_method && (
                          <div className="mt-2 text-xs">
                            <span className="font-medium text-slate-200">検出方法:</span> {job.metadata.detection_method}
                          </div>
                        )}
                        {job.metadata?.url_count !== undefined && (
                          <div className="mt-1 text-xs text-slate-300">
                            <span className="font-medium text-slate-200">学習URL数:</span> {job.metadata.url_count}件
                            {job.metadata.url_count === 1 && job.metadata.detection_method?.includes('ベースURLのみ') && (
                              <span className="ml-1 text-orange-300">（ベースURLのみ）</span>
                            )}
                            {job.metadata.url_count > 1 && <span className="ml-1 text-emerald-300">✓</span>}
                          </div>
                        )}
                        {job.metadata?.detected_sitemap_url && (
                          <div className="mt-1 text-xs">
                            <span className="font-medium text-slate-200">サイトマップ:</span>{' '}
                            <a
                              href={job.metadata.detected_sitemap_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="break-all text-emerald-200 underline-offset-4 hover:underline"
                            >
                              {job.metadata.detected_sitemap_url}
                            </a>
                          </div>
                        )}
                        {job.metadata?.urls && job.metadata.urls.length > 0 && (
                          <details className="mt-2 rounded-xl border border-white/5 bg-white/5 p-2">
                            <summary className="cursor-pointer text-xs font-medium text-emerald-200">
                              学習URL ({job.metadata.urls.length}件)
                            </summary>
                            <div className="mt-2 max-h-40 overflow-y-auto text-[11px]">
                              <ul className="space-y-1 font-mono">
                                {job.metadata.urls.map((url, idx) => (
                                  <li key={idx} className="break-all text-slate-200">
                                    {idx + 1}. {url}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </details>
                        )}
                        {job.error_message && (
                          <div className="mt-2 text-xs text-rose-300">
                            <span className="font-medium text-rose-200">エラー:</span> {job.error_message}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
