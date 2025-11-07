import { useRef, useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/layout';
import { Message } from '@/types/chat';
import { fetchEventSource } from '@microsoft/fetch-event-source';
import ReactMarkdown from 'react-markdown';
import LoadingDots from '@/components/ui/LoadingDots';
import Link from 'next/link';
import { createSupabaseClient } from '@/utils/supabase-auth';

interface Site {
  id: string;
  name: string;
  base_url: string;
  status: 'idle' | 'training' | 'ready' | 'error';
}

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
  }>({
    messages: [],
    history: [],
  });

  const { messages, pending, history } = messageState;
  const messageListRef = useRef<HTMLDivElement>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const channelRef = useRef<any>(null);
  const [showSidebar, setShowSidebar] = useState(false);
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
            setMessageState({
              messages: [
                {
                  message: `「${found.name}」について何かお聞きしたいことはありますか？`,
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
          (payload) => {
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

  useEffect(() => {
    textAreaRef.current?.focus();
  }, []);

  useEffect(() => {
    messageListRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, pending]);

  // フォーム送信
  async function handleSubmit(e: any) {
    e.preventDefault();

    if (!query || !siteId || typeof siteId !== 'string') {
      alert('質問を入力してください');
      return;
    }

    if (site?.status !== 'ready') {
      alert('サイトの学習が完了していません');
      return;
    }

    const question = query.trim();

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
    }));

    setLoading(true);
    setQuery('');
    setMessageState((state) => ({ ...state, pending: '' }));

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
                  },
                ],
                pending: undefined,
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
                }));
                setLoading(false);
                ctrl.abort();
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

  const handleEnter = (e: any) => {
    if (e.key === 'Enter' && query) {
      handleSubmit(e);
    } else if (e.key == 'Enter') {
      e.preventDefault();
    }
  };

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

  if (authLoading || !site) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-lg">読み込み中...</div>
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

  return (
    <Layout>
      <div className="flex h-screen">
        {/* メインコンテンツ（チャット） */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* ヘッダー */}
          <div className="border-b border-gray-200 bg-white px-3 md:px-4 py-2 md:py-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1 min-w-0">
                <Link
                  href="/dashboard"
                  className="text-blue-600 hover:text-blue-800 text-xs md:text-sm mb-1 inline-block"
                >
                  ← ダッシュボードに戻る
                </Link>
                <h1 className="text-base md:text-xl font-semibold truncate">{site.name}</h1>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-xs md:text-sm text-gray-500 hidden sm:block">
                  {site.status === 'ready' ? '準備完了' : site.status}
                </div>
                <button
                  onClick={() => setShowSidebar(!showSidebar)}
                  className="lg:hidden bg-gray-100 hover:bg-gray-200 p-2 rounded-lg"
                  aria-label="学習履歴を表示"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* チャットエリア */}
          <div className="flex-1 overflow-y-auto px-3 md:px-4 py-4 md:py-6">
            <div className="max-w-3xl mx-auto">
            {chatMessages.length === 0 ? (
              <div className="text-center text-gray-500 mt-8">
                メッセージがありません
              </div>
            ) : (
              <div className="space-y-4">
                {chatMessages.map((message, index) => (
                  <div
                    key={index}
                    className={`flex ${
                      message.type === 'userMessage'
                        ? 'justify-end'
                        : 'justify-start'
                    }`}
                  >
                    <div
                      className={`max-w-[85%] sm:max-w-[80%] rounded-lg px-3 md:px-4 py-2 text-sm md:text-base ${
                        message.type === 'userMessage'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-900'
                      }`}
                    >
                      {message.type === 'apiMessage' ? (
                        <ReactMarkdown className="prose prose-sm max-w-none break-words">
                          {message.message}
                        </ReactMarkdown>
                      ) : (
                        <p className="whitespace-pre-wrap break-words">{message.message}</p>
                      )}
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex justify-start">
                    <div className="bg-gray-100 rounded-lg px-4 py-2">
                      <LoadingDots color="#000000" />
                    </div>
                  </div>
                )}
                <div ref={messageListRef} />
              </div>
            )}
          </div>
        </div>

          {/* 入力フォーム */}
          <div className="border-t border-gray-200 bg-white px-3 md:px-4 py-3 md:py-4">
            <div className="max-w-3xl mx-auto">
              <form onSubmit={handleSubmit} className="flex gap-2">
                <textarea
                  ref={textAreaRef}
                  disabled={loading || site.status !== 'ready'}
                  onKeyDown={handleEnter}
                  rows={1}
                  className="flex-1 px-3 md:px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none text-sm md:text-base"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={
                    site.status === 'ready'
                      ? '質問を入力してください...'
                      : 'サイトの学習が完了していません'
                  }
                />
                <button
                  type="submit"
                  disabled={loading || !query || site.status !== 'ready'}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-4 md:px-6 py-2 rounded-lg font-medium text-sm md:text-base whitespace-nowrap"
                >
                  送信
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* サイドバー（学習履歴） */}
        <div
          className={`${
            showSidebar ? 'fixed' : 'hidden'
          } lg:block lg:static inset-0 lg:inset-auto w-full lg:w-80 border-l border-gray-200 bg-gray-50 overflow-y-auto z-40 lg:z-auto`}
        >
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base md:text-lg font-semibold">学習履歴</h2>
              <button
                onClick={() => setShowSidebar(false)}
                className="lg:hidden text-gray-500 hover:text-gray-700"
                aria-label="閉じる"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            {trainingJobs.length === 0 ? (
              <p className="text-xs md:text-sm text-gray-500">学習履歴がありません</p>
            ) : (
              <div className="space-y-2 md:space-y-3">
                {trainingJobs.map((job) => (
                  <div
                    key={job.id}
                    className="bg-white rounded-lg p-2 md:p-3 border border-gray-200"
                  >
                    <div className="flex items-center justify-between mb-2 gap-2">
                      <span
                        className={`text-xs font-medium px-2 py-1 rounded flex-shrink-0 ${
                          job.status === 'completed'
                            ? 'bg-green-100 text-green-800'
                            : job.status === 'failed'
                            ? 'bg-red-100 text-red-800'
                            : job.status === 'running'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {getStatusLabel(job.status)}
                      </span>
                      <span className="text-xs text-gray-500 truncate ml-2">
                        {formatDate(job.created_at)}
                      </span>
                    </div>
                    {job.status === 'running' && job.total_pages > 0 && (
                      <div className="mb-2">
                        <div className="flex justify-between text-xs text-gray-600 mb-1">
                          <span>進捗</span>
                          <span>
                            {job.processed_pages} / {job.total_pages}
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full transition-all"
                            style={{
                              width: `${
                                (job.processed_pages / job.total_pages) * 100
                              }%`,
                            }}
                          />
                        </div>
                      </div>
                    )}
                    {job.finished_at && (
                      <div className="text-xs text-gray-500 break-words">
                        完了: {formatDate(job.finished_at)}
                      </div>
                    )}
                    {job.metadata?.detection_method && (
                      <div className="mt-2 text-xs text-gray-600 break-words">
                        <span className="font-medium">検出方法:</span> {job.metadata.detection_method}
                      </div>
                    )}
                    {job.metadata?.url_count !== undefined && (
                      <div className="mt-1 text-xs text-gray-600 break-words">
                        <span className="font-medium">学習URL数:</span> {job.metadata.url_count}件
                        {job.metadata.url_count === 1 && job.metadata.detection_method?.includes('ベースURLのみ') && (
                          <span className="text-orange-600 ml-1">（ベースURLのみ）</span>
                        )}
                        {job.metadata.url_count > 1 && (
                          <span className="text-green-600 ml-1">✓</span>
                        )}
                      </div>
                    )}
                    {job.metadata?.detected_sitemap_url && (
                      <div className="mt-1 text-xs text-gray-600 break-words">
                        <span className="font-medium">サイトマップ:</span>{' '}
                        <a
                          href={job.metadata.detected_sitemap_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline break-all"
                        >
                          {job.metadata.detected_sitemap_url}
                        </a>
                      </div>
                    )}
                    {job.metadata?.urls && job.metadata.urls.length > 0 && (
                      <details className="mt-2">
                        <summary className="text-xs text-blue-600 hover:text-blue-800 cursor-pointer font-medium">
                          学習されたURL一覧を表示 ({job.metadata.urls.length}件)
                        </summary>
                        <div className="mt-2 max-h-40 overflow-y-auto border border-gray-200 rounded p-2 bg-gray-50">
                          <ul className="space-y-1 text-xs font-mono">
                            {job.metadata.urls.map((url, idx) => (
                              <li key={idx} className="break-all text-gray-700">
                                {idx + 1}. {url}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </details>
                    )}
                    {job.error_message && (
                      <div className="mt-2 text-xs text-red-600 break-words">
                        <span className="font-medium">エラー:</span> {job.error_message}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}

